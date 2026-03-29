let cachedTransporter = null;

const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!smtpConfigured()) {
    throw new Error('SMTP is not configured');
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  // Lazy load so the backend can still boot before dependencies are installed.
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const nodemailer = require('nodemailer');

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransporter;
};

const sendInviteEmail = async ({
  inviteEmail,
  ownerName,
  ownerEmail,
  documentTitle,
  inviteLink,
  role,
}) => {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const accessCopy = role === 'view' ? 'view' : 'edit';

  await transporter.sendMail({
    from,
    to: inviteEmail,
    subject: `${ownerName} shared "${documentTitle}" with you`,
    text: [
      `${ownerName} (${ownerEmail}) invited you to ${accessCopy} "${documentTitle}".`,
      '',
      `Open this link to review and accept the invitation: ${inviteLink}`,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#202124;line-height:1.6">
        <p><strong>${ownerName}</strong> (${ownerEmail}) invited you to <strong>${accessCopy}</strong> "<strong>${documentTitle}</strong>".</p>
        <p><a href="${inviteLink}" style="display:inline-block;padding:12px 18px;background:#1a73e8;color:#fff;border-radius:999px;text-decoration:none">Open invitation</a></p>
        <p style="font-size:12px;color:#5f6368">If the button does not work, open this link manually:<br />${inviteLink}</p>
      </div>
    `,
  });
};

module.exports = {
  sendInviteEmail,
  smtpConfigured,
};
