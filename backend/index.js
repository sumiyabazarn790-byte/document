require('dotenv').config();

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const util = require('util');
const express = require('express');
const WebSocket = require('ws');
const { OAuth2Client } = require('google-auth-library');
const { setupWSConnection } = require('y-websocket/bin/utils');
const { prisma } = require('./lib/prisma');
const { sendInviteEmail, smtpConfigured } = require('./lib/mailer');

const app = express();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 4000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const inviteUrl = (token) => `${FRONTEND_ORIGIN}?invite=${encodeURIComponent(token)}`;
const MAX_VERSIONS_PER_DOCUMENT = 25;
const PDF_EXPORT_ENABLED = process.env.PDF_EXPORT_ENABLED !== 'false';
const PRIVATE_IP_PATTERN =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i;

const googleClient = GOOGLE_CLIENT_ID
  ? new OAuth2Client(GOOGLE_CLIENT_ID)
  : null;
const scryptAsync = util.promisify(crypto.scrypt);

const mergeAuthProvider = (currentProvider, nextProvider) => {
  const current = String(currentProvider || '').trim().toLowerCase();
  const next = String(nextProvider || '').trim().toLowerCase();

  if (!current) {
    return next || 'local';
  }

  if (!next || current === next) {
    return current;
  }

  return 'hybrid';
};

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (IS_PRODUCTION) {
    return origin === FRONTEND_ORIGIN;
  }

  if (origin === FRONTEND_ORIGIN) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    return PRIVATE_IP_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
};

if (IS_PRODUCTION && !FRONTEND_ORIGIN) {
  throw new Error('FRONTEND_ORIGIN must be set in production.');
}

const pickColor = (seed = '') => {
  const colors = ['#1a73e8', '#e8710a', '#188038', '#9334e6', '#d93025', '#0f9d58'];
  const hash = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

const nameFromEmail = (email) => email.split('@')[0] || 'Member';
const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  return value === 'view' ? 'view' : 'edit';
};

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(derivedKey).toString('hex')}`;
};

const verifyPassword = async (password, storedHash) => {
  if (!storedHash || !storedHash.startsWith('scrypt:')) {
    return false;
  }

  const [, salt, key] = storedHash.split(':');
  if (!salt || !key) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, 64);
  const storedKeyBuffer = Buffer.from(key, 'hex');
  const derivedKeyBuffer = Buffer.from(derivedKey);

  if (storedKeyBuffer.length !== derivedKeyBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedKeyBuffer, derivedKeyBuffer);
};

const upsertUser = async ({ email, name, picture, authProvider, passwordHash }) => {
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    const nextData = {
      lastLoginAt: new Date(),
    };

    if (name) {
      nextData.name = name;
    }

    if (picture !== undefined) {
      nextData.picture = picture || null;
    }

    if (authProvider) {
      nextData.authProvider = mergeAuthProvider(existing.authProvider, authProvider);
    }

    if (passwordHash !== undefined) {
      nextData.passwordHash = passwordHash;
    }

    return prisma.user.update({
      where: { email },
      data: nextData,
    });
  }

  return prisma.user.create({
    data: {
      email,
      name,
      picture: picture || null,
      color: pickColor(email || name),
      authProvider: authProvider || 'local',
      passwordHash: passwordHash || null,
      lastLoginAt: new Date(),
    },
  });
};

const ensureUserByEmail = async (email) => {
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      email,
      name: nameFromEmail(email),
      color: pickColor(email),
    },
  });
};

const serializeDocument = (document, userId) => ({
  id: document.id,
  title: document.title,
  updatedAt: document.updatedAt,
  ownerEmail: document.owner.email,
  folderId: document.folderId ?? null,
  accessRole: document.ownerId === userId ? 'owner' : normalizeRole(document.members[0]?.role || 'view'),
});

const serializeInvite = (invite) => ({
  id: invite.id,
  email: invite.email,
  role: normalizeRole(invite.role),
  status: invite.status,
  token: invite.token,
  createdAt: invite.createdAt,
  updatedAt: invite.updatedAt,
  acceptedAt: invite.acceptedAt,
  document: invite.document
    ? {
        id: invite.document.id,
        title: invite.document.title,
      }
    : null,
  invitedBy: invite.invitedBy
    ? {
        id: invite.invitedBy.id,
        name: invite.invitedBy.name,
        email: invite.invitedBy.email,
      }
    : null,
});

const serializeFolder = (folder) => ({
  id: folder.id,
  name: folder.name,
  ownerId: folder.ownerId,
  createdAt: folder.createdAt,
  updatedAt: folder.updatedAt,
});

const serializeVersion = (version) => ({
  id: version.id,
  documentId: version.documentId,
  title: version.title,
  content: version.content,
  createdBy: version.createdBy,
  createdAt: version.createdAt,
});

const createVersionSnapshot = async ({ documentId, title, content, createdBy }) => {
  const currentContent = typeof content === 'string' ? content : '';

  const latest = await prisma.documentVersion.findFirst({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });

  if (latest && latest.title === title && (latest.content || '') === currentContent) {
    return latest;
  }

  const version = await prisma.documentVersion.create({
    data: {
      documentId,
      title,
      content: currentContent,
      createdBy,
    },
  });

  const stale = await prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
    skip: MAX_VERSIONS_PER_DOCUMENT,
    select: { id: true },
  });

  if (stale.length) {
    await prisma.documentVersion.deleteMany({
      where: {
        id: {
          in: stale.map((item) => item.id),
        },
      },
    });
  }

  return version;
};

const getPdfBrowser = async () => {
  if (!PDF_EXPORT_ENABLED) {
    throw new Error('PDF export is disabled by configuration.');
  }

  // Lazy load so the backend still starts before the dependency is installed.
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const puppeteer = require('puppeteer');
  const executablePath = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].find((candidate) => candidate && fs.existsSync(candidate));

  if (!executablePath) {
    throw new Error('Chromium executable not found. Set PUPPETEER_EXECUTABLE_PATH or disable PDF export.');
  }

  return puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
};

const renderPdfHtml = (title, content = '') => `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #202124;
          padding: 48px;
          line-height: 1.65;
        }
        h1 {
          margin: 0 0 24px;
          font-size: 28px;
        }
        .document-content {
          font-size: 14px;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        td, th {
          border: 1px solid #d0d7e2;
          padding: 8px;
        }
        pre {
          background: #f6f8fb;
          padding: 16px;
          border-radius: 12px;
          overflow: auto;
        }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="document-content">${content || '<p></p>'}</div>
    </body>
  </html>
`;

const resolveDocumentAccess = async (documentId, userEmail) => {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user) {
    return null;
  }

  const document = await prisma.document.findUnique({
    where: { id: Number(documentId) },
    include: {
      folder: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          picture: true,
          color: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              picture: true,
              color: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    return null;
  }

  if (document.ownerId === user.id) {
    return { document, accessRole: 'owner', user };
  }

  const membership = document.members.find((member) => member.userId === user.id);
  if (!membership) {
    return null;
  }

  return { document, accessRole: normalizeRole(membership.role), user };
};

app.use(express.json());
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;

  if (isAllowedOrigin(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin || FRONTEND_ORIGIN);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

app.post('/auth/google', async (req, res) => {
  try {
    if (!googleClient || !GOOGLE_CLIENT_ID) {
      res.status(500).json({ ok: false, error: 'GOOGLE_CLIENT_ID is not configured' });
      return;
    }

    const credential = String(req.body?.credential || '').trim();
    if (!credential) {
      res.status(400).json({ ok: false, error: 'Missing Google credential' });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email) {
      res.status(401).json({ ok: false, error: 'Google account email not available' });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });

    const user = await upsertUser({
      email: payload.email.toLowerCase(),
      name: payload.name || payload.given_name || payload.email.split('@')[0],
      picture: payload.picture,
      authProvider: 'google',
      passwordHash: existing?.passwordHash,
    });

    res.json({ ok: true, user });
  } catch (error) {
    console.error('Google auth failed', error);
    res.status(401).json({
      ok: false,
      error: error?.message || 'Google sign-in failed',
    });
  }
});

app.post('/auth/local/register', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!name || !email || password.length < 8) {
      res.status(400).json({ ok: false, error: 'Name, email, and a password with at least 8 characters are required' });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      if (existing.authProvider === 'google' || existing.authProvider === 'hybrid') {
        const passwordHash = await hashPassword(password);
        const user = await upsertUser({
          email,
          name: name || existing.name,
          picture: existing.picture,
          authProvider: 'local',
          passwordHash,
        });

        res.json({ ok: true, user });
        return;
      }

      res.status(409).json({
        ok: false,
        error: 'This email is already registered. Please sign in with your password.',
      });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await upsertUser({
      email,
      name,
      picture: null,
      authProvider: 'local',
      passwordHash,
    });

    res.json({ ok: true, user });
  } catch (error) {
    console.error('Local register failed', error);
    res.status(500).json({ ok: false, error: 'Could not save user' });
  }
});

app.post('/auth/local/login', async (req, res) => {
  try {
    const identifier = String(req.body?.identifier || '').trim();
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
      res.status(400).json({ ok: false, error: 'Email or name and password are required' });
      return;
    }

    const normalizedIdentifier = identifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          { name: identifier },
        ],
      },
    });

    if (!user) {
      res.status(404).json({ ok: false, error: 'Account not found' });
      return;
    }

    if (!user.passwordHash) {
      res.status(409).json({
        ok: false,
        error: 'This account currently uses Google sign-in only. Use Create account to add a password, or continue with Google.',
      });
      return;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ ok: false, error: 'Incorrect password' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { email: user.email },
      data: { lastLoginAt: new Date() },
    });

    res.json({ ok: true, user: updatedUser });
  } catch (error) {
    console.error('Local login failed', error);
    res.status(500).json({ ok: false, error: 'Could not sign in' });
  }
});

app.get('/folders', async (req, res) => {
  try {
    const userEmail = String(req.query?.userEmail || '').trim();
    if (!userEmail) {
      res.status(400).json({ ok: false, error: 'userEmail is required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      res.json({ ok: true, folders: [] });
      return;
    }

    const folders = await prisma.folder.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'asc' },
    });

    res.json({
      ok: true,
      folders: folders.map(serializeFolder),
    });
  } catch (error) {
    console.error('Load folders failed', error);
    res.status(500).json({ ok: false, error: 'Could not load folders' });
  }
});

app.post('/folders', async (req, res) => {
  try {
    const userEmail = String(req.body?.userEmail || '').trim();
    const name = String(req.body?.name || '').trim();

    if (!userEmail || !name) {
      res.status(400).json({ ok: false, error: 'userEmail and folder name are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      res.status(404).json({ ok: false, error: 'User not found' });
      return;
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        ownerId: user.id,
      },
    });

    res.json({ ok: true, folder: serializeFolder(folder) });
  } catch (error) {
    console.error('Create folder failed', error);
    res.status(500).json({ ok: false, error: error.message || 'Could not create folder' });
  }
});

app.put('/folders/:id', async (req, res) => {
  try {
    const folderId = Number(req.params.id);
    const userEmail = String(req.body?.userEmail || '').trim();
    const name = String(req.body?.name || '').trim();

    if (!folderId || !userEmail || !name) {
      res.status(400).json({ ok: false, error: 'folderId, userEmail and name are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      res.status(404).json({ ok: false, error: 'User not found' });
      return;
    }

    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        ownerId: user.id,
      },
    });

    if (!folder) {
      res.status(404).json({ ok: false, error: 'Folder not found' });
      return;
    }

    const updatedFolder = await prisma.folder.update({
      where: { id: folderId },
      data: { name },
    });

    res.json({ ok: true, folder: serializeFolder(updatedFolder) });
  } catch (error) {
    console.error('Rename folder failed', error);
    res.status(500).json({ ok: false, error: error.message || 'Could not rename folder' });
  }
});

app.delete('/folders/:id', async (req, res) => {
  try {
    const folderId = Number(req.params.id);
    const userEmail = String(req.query?.userEmail || '').trim();

    if (!folderId || !userEmail) {
      res.status(400).json({ ok: false, error: 'folderId and userEmail are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      res.status(404).json({ ok: false, error: 'User not found' });
      return;
    }

    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        ownerId: user.id,
      },
    });

    if (!folder) {
      res.status(404).json({ ok: false, error: 'Folder not found' });
      return;
    }

    await prisma.$transaction([
      prisma.document.updateMany({
        where: {
          folderId,
          ownerId: user.id,
        },
        data: {
          folderId: null,
        },
      }),
      prisma.folder.delete({
        where: { id: folderId },
      }),
    ]);

    res.json({ ok: true, deletedFolderId: folderId });
  } catch (error) {
    console.error('Delete folder failed', error);
    res.status(500).json({ ok: false, error: error.message || 'Could not delete folder' });
  }
});

app.post('/documents/share', async (req, res) => {
  try {
    const documentId = req.body?.documentId ? Number(req.body.documentId) : null;
    const folderId = req.body?.folderId ? Number(req.body.folderId) : null;
    const ownerEmail = String(req.body?.ownerEmail || '').trim();
    const memberEmail = String(req.body?.memberEmail || '').trim();
    const title = String(req.body?.title || '').trim() || 'Untitled document';
    const content = String(req.body?.content || '');
    const role = normalizeRole(req.body?.role || 'edit');

    if (!ownerEmail || !memberEmail) {
      res.status(400).json({ ok: false, error: 'Owner email and member email are required' });
      return;
    }

    const owner = await prisma.user.findUnique({
      where: { email: ownerEmail },
    });

    if (!owner) {
      res.status(404).json({ ok: false, error: 'Owner account not found' });
      return;
    }

    let document;
    if (documentId) {
      const access = await resolveDocumentAccess(documentId, ownerEmail);
      if (!access || access.accessRole === 'view') {
        res.status(403).json({ ok: false, error: 'You do not have permission to share this document' });
        return;
      }

      document = await prisma.document.update({
        where: { id: documentId },
        data: {
          title,
          content,
          folderId,
        },
        include: {
          folder: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    } else {
      document = await prisma.document.create({
        data: {
          title,
          content,
          ownerId: owner.id,
          folderId,
        },
        include: {
          folder: true,
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    }

    await createVersionSnapshot({
      documentId: document.id,
      title: document.title,
      content: document.content,
      createdBy: ownerEmail,
    });

    const existingMember = await prisma.user.findUnique({
      where: { email: memberEmail },
    });

    if (existingMember) {
      const membership = await prisma.documentMember.findUnique({
        where: {
          userId_documentId: {
            userId: existingMember.id,
            documentId: document.id,
          },
        },
      });

      if (membership) {
        await prisma.documentMember.update({
          where: {
            userId_documentId: {
              userId: existingMember.id,
              documentId: document.id,
            },
          },
          data: {
            role,
          },
        });

        res.json({
          ok: true,
          document,
          invite: null,
          alreadyMember: true,
        });
        return;
      }
    }

    if (!smtpConfigured()) {
      res.status(500).json({
        ok: false,
        error: 'SMTP is not configured. Add SMTP settings in backend/.env to send Gmail invitations.',
      });
      return;
    }

    const token = crypto.randomUUID();
    const invite = await prisma.documentInvite.upsert({
      where: {
        documentId_email: {
          documentId: document.id,
          email: memberEmail,
        },
      },
      update: {
        role,
        token,
        status: 'pending',
        acceptedAt: null,
        invitedById: owner.id,
      },
      create: {
        email: memberEmail,
        role,
        token,
        status: 'pending',
        documentId: document.id,
        invitedById: owner.id,
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await sendInviteEmail({
      inviteEmail: memberEmail,
      ownerName: owner.name,
      ownerEmail,
      documentTitle: document.title,
      inviteLink: inviteUrl(invite.token),
      role,
    });

    res.json({ ok: true, document, invite: serializeInvite(invite), alreadyMember: false });
  } catch (error) {
    console.error('Share failed', error);
    res.status(500).json({ ok: false, error: error.message || 'Could not share document' });
  }
});

app.get('/invites', async (req, res) => {
  try {
    const userEmail = String(req.query?.userEmail || '').trim().toLowerCase();
    if (!userEmail) {
      res.status(400).json({ ok: false, error: 'userEmail is required' });
      return;
    }

    const invites = await prisma.documentInvite.findMany({
      where: {
        email: userEmail,
        status: 'pending',
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      ok: true,
      invites: invites.map(serializeInvite),
    });
  } catch (error) {
    console.error('Load invites failed', error);
    res.status(500).json({ ok: false, error: 'Could not load invitations' });
  }
});

app.get('/invites/:token', async (req, res) => {
  try {
    const invite = await prisma.documentInvite.findUnique({
      where: { token: String(req.params.token || '').trim() },
      include: {
        document: {
          select: {
            id: true,
            title: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invite) {
      res.status(404).json({ ok: false, error: 'Invitation not found' });
      return;
    }

    if (invite.status !== 'pending') {
      res.status(410).json({ ok: false, error: 'Invitation is no longer pending' });
      return;
    }

    res.json({ ok: true, invite: serializeInvite(invite) });
  } catch (error) {
    console.error('Load invite failed', error);
    res.status(500).json({ ok: false, error: 'Could not load invitation' });
  }
});

app.post('/invites/:token/accept', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const userEmail = String(req.body?.userEmail || '').trim().toLowerCase();

    if (!userEmail) {
      res.status(400).json({ ok: false, error: 'userEmail is required' });
      return;
    }

    const invite = await prisma.documentInvite.findUnique({
      where: { token },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            ownerId: true,
            updatedAt: true,
            owner: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!invite || invite.status !== 'pending') {
      res.status(404).json({ ok: false, error: 'Pending invitation not found' });
      return;
    }

    if (invite.email.toLowerCase() !== userEmail) {
      res.status(403).json({ ok: false, error: 'This invitation belongs to another Gmail account' });
      return;
    }

    const user = await ensureUserByEmail(userEmail);

    await prisma.$transaction([
      prisma.documentMember.upsert({
        where: {
          userId_documentId: {
            userId: user.id,
            documentId: invite.documentId,
          },
        },
        update: {
          role: normalizeRole(invite.role),
        },
        create: {
          userId: user.id,
          documentId: invite.documentId,
          role: normalizeRole(invite.role),
        },
      }),
      prisma.documentInvite.update({
        where: { id: invite.id },
        data: {
          status: 'accepted',
          acceptedById: user.id,
          acceptedAt: new Date(),
        },
      }),
    ]);

    res.json({
      ok: true,
      document: {
        id: invite.document.id,
        title: invite.document.title,
        updatedAt: invite.document.updatedAt,
        ownerEmail: invite.document.owner.email,
        accessRole: normalizeRole(invite.role),
      },
    });
  } catch (error) {
    console.error('Accept invite failed', error);
    res.status(500).json({ ok: false, error: 'Could not accept invitation' });
  }
});

app.get('/documents', async (req, res) => {
  try {
    const userEmail = String(req.query?.userEmail || '').trim();
    if (!userEmail) {
      res.status(400).json({ ok: false, error: 'userEmail is required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      res.json({ ok: true, documents: [] });
      return;
    }

    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      include: {
        members: {
          where: {
            userId: user.id,
          },
          select: {
            role: true,
          },
        },
        owner: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    res.json({
      ok: true,
      documents: documents.map((document) => ({
        id: document.id,
        title: document.title,
        updatedAt: document.updatedAt,
        ownerEmail: document.owner.email,
        accessRole: document.ownerId === user.id ? 'owner' : normalizeRole(document.members[0]?.role || 'view'),
      })),
    });
  } catch (error) {
    console.error('Load documents failed', error);
    res.status(500).json({ ok: false, error: 'Could not load documents' });
  }
});

app.get('/documents/:id', async (req, res) => {
  try {
    const userEmail = String(req.query?.userEmail || '').trim();
    const access = await resolveDocumentAccess(req.params.id, userEmail);

    if (!access) {
      res.status(403).json({ ok: false, error: 'You do not have access to this document' });
      return;
    }

    res.json({
      ok: true,
      document: {
        ...access.document,
        accessRole: access.accessRole,
      },
    });
  } catch (error) {
    console.error('Open document failed', error);
    res.status(500).json({ ok: false, error: 'Could not open document' });
  }
});

app.put('/documents/:id', async (req, res) => {
  try {
    const userEmail = String(req.body?.userEmail || '').trim();
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : undefined;
    const content = typeof req.body?.content === 'string' ? req.body.content : undefined;
    const access = await resolveDocumentAccess(req.params.id, userEmail);

    if (!access || access.accessRole === 'view') {
      res.status(403).json({ ok: false, error: 'You do not have edit access to this document' });
      return;
    }

    if (title !== undefined || content !== undefined) {
      await createVersionSnapshot({
        documentId: access.document.id,
        title: access.document.title,
        content: access.document.content,
        createdBy: userEmail,
      });
    }

    const document = await prisma.document.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(title ? { title } : {}),
        ...(content !== undefined ? { content } : {}),
      },
      include: {
        folder: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    res.json({
      ok: true,
      document: {
        ...document,
        accessRole: access.accessRole,
      },
    });
  } catch (error) {
    console.error('Save document failed', error);
    res.status(500).json({ ok: false, error: 'Could not save document' });
  }
});

app.put('/documents/:id/folder', async (req, res) => {
  try {
    const userEmail = String(req.body?.userEmail || '').trim();
    const folderId = req.body?.folderId ? Number(req.body.folderId) : null;
    const access = await resolveDocumentAccess(req.params.id, userEmail);

    if (!access || access.accessRole === 'view') {
      res.status(403).json({ ok: false, error: 'You do not have permission to organize this document' });
      return;
    }

    let nextFolderId = null;
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: {
          id: folderId,
          ownerId: access.document.ownerId,
        },
      });

      if (!folder) {
        res.status(404).json({ ok: false, error: 'Folder not found' });
        return;
      }

      nextFolderId = folder.id;
    }

    const document = await prisma.document.update({
      where: { id: Number(req.params.id) },
      data: {
        folderId: nextFolderId,
      },
      include: {
        folder: true,
        owner: {
          select: {
            email: true,
            name: true,
          },
        },
        members: {
          where: {
            userId: access.user.id,
          },
          select: {
            role: true,
          },
        },
      },
    });

    res.json({
      ok: true,
      document: serializeDocument(document, access.user.id),
    });
  } catch (error) {
    console.error('Move document failed', error);
    res.status(500).json({ ok: false, error: 'Could not move document' });
  }
});

app.get('/documents/:id/versions', async (req, res) => {
  try {
    const userEmail = String(req.query?.userEmail || '').trim();
    const access = await resolveDocumentAccess(req.params.id, userEmail);

    if (!access) {
      res.status(403).json({ ok: false, error: 'You do not have access to this document' });
      return;
    }

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: Number(req.params.id) },
      orderBy: { createdAt: 'desc' },
      take: MAX_VERSIONS_PER_DOCUMENT,
    });

    res.json({
      ok: true,
      versions: versions.map(serializeVersion),
    });
  } catch (error) {
    console.error('Load versions failed', error);
    res.status(500).json({ ok: false, error: 'Could not load versions' });
  }
});

app.post('/documents/:id/versions/:versionId/restore', async (req, res) => {
  try {
    const userEmail = String(req.body?.userEmail || '').trim();
    const access = await resolveDocumentAccess(req.params.id, userEmail);

    if (!access || access.accessRole === 'view') {
      res.status(403).json({ ok: false, error: 'You do not have permission to restore versions' });
      return;
    }

    const version = await prisma.documentVersion.findFirst({
      where: {
        id: Number(req.params.versionId),
        documentId: Number(req.params.id),
      },
    });

    if (!version) {
      res.status(404).json({ ok: false, error: 'Version not found' });
      return;
    }

    await createVersionSnapshot({
      documentId: access.document.id,
      title: access.document.title,
      content: access.document.content,
      createdBy: `${userEmail} (before restore)`,
    });

    const document = await prisma.document.update({
      where: { id: Number(req.params.id) },
      data: {
        title: version.title,
        content: version.content,
      },
      include: {
        folder: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                picture: true,
                color: true,
              },
            },
          },
        },
      },
    });

    await createVersionSnapshot({
      documentId: document.id,
      title: document.title,
      content: document.content,
      createdBy: `${userEmail} (restored)`,
    });

    res.json({
      ok: true,
      document: {
        ...document,
        accessRole: access.accessRole,
      },
    });
  } catch (error) {
    console.error('Restore version failed', error);
    res.status(500).json({ ok: false, error: 'Could not restore version' });
  }
});

app.get('/documents/:id/export/pdf', async (req, res) => {
  let browser;

  try {
    const userEmail = String(req.query?.userEmail || '').trim();
    const access = await resolveDocumentAccess(req.params.id, userEmail);

    if (!access) {
      res.status(403).json({ ok: false, error: 'You do not have access to this document' });
      return;
    }

    browser = await getPdfBrowser();
    const page = await browser.newPage();
    await page.setContent(renderPdfHtml(access.document.title, access.document.content), {
      waitUntil: 'networkidle0',
    });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '24px',
        right: '24px',
        bottom: '24px',
        left: '24px',
      },
    });

    await page.close();
    await browser.close();
    browser = null;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(access.document.title || 'document')}.pdf"`
    );
    res.send(pdf);
  } catch (error) {
    console.error('Export PDF failed', error);
    if (browser) {
      await browser.close().catch(() => {});
    }
    res.status(500).json({
      ok: false,
      error: error.message || 'Could not export PDF.',
    });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    console.warn(`Rejected malformed JSON for ${req.method} ${req.originalUrl}`);
    res.status(400).json({
      ok: false,
      error: 'Request body must be valid JSON',
    });
    return;
  }

  if (error) {
    console.error('Unhandled request error', error);
    res.status(error.status || 500).json({
      ok: false,
      error: error.message || 'Internal server error',
    });
    return;
  }

  next();
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  if (!req.url?.startsWith('/ws')) {
    conn.close();
    return;
  }

  setupWSConnection(conn, req, { gc: true });
});

prisma.$connect()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`Backend listening on ${HOST}:${PORT}`);
      console.log(`Yjs WebSocket ready on ${HOST}:${PORT}`);
      console.log('Prisma connected to PostgreSQL');
    });
  })
  .catch((error) => {
    console.error('Failed to start backend', error);
    process.exit(1);
  });
