import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Image } from '@tiptap/extension-image';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Extension } from '@tiptap/core';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import Topbar from '../components/Topbar';
import DocsToolbar from '../components/DocsToolbar';
import Sidebar from '../components/Sidebar';
import CommentsPanel from '../components/CommentsPanel';
import Footer from '../components/Footer';
import LoginModal from '../components/LoginModal';
import ShareModal from '../components/ShareModal';
import ToastStack from '../components/ToastStack';
import CommentComposerModal from '../components/CommentComposerModal';
import DocLauncherPanel from '../components/DocLauncherPanel';
import InviteModal from '../components/InviteModal';
import VersionHistoryModal from '../components/VersionHistoryModal';
import FolderDialog from '../components/FolderDialog';
import {
  COLOR_PALETTE,
  FONTS,
  FONT_SIZES,
  ZOOM_LEVELS,
  WS_URL,
  ROOM_NAME,
  tabsKey,
  activeTabKey,
  getDraftKey,
  getHistoryKey,
} from '../config/documentConfig';
import { useAuthProfile } from '../hooks/useAuthProfile';
import {
  acceptInvite,
  createFolder,
  deleteFolder,
  exportDocumentPdf,
  fetchInvite,
  fetchDocument,
  fetchDocumentVersions,
  fetchFolders,
  fetchInvites,
  fetchSharedDocuments,
  moveDocumentToFolder,
  renameFolder,
  restoreDocumentVersion,
  shareDocument,
  updateDocument,
} from '../services/documentService';

const stripHtml = (html) => {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
};

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const createLocalTab = (title, projectId = crypto.randomUUID()) => ({
  id: crypto.randomUUID(),
  title,
  content: '',
  documentId: null,
  folderId: null,
  projectId,
  accessRole: 'edit',
});

const QUICK_TEMPLATES = {
  meeting: {
    title: 'Meeting notes',
    content: `
      <h2>Meeting notes</h2>
      <p><strong>Date:</strong> </p>
      <p><strong>Attendees:</strong> </p>
      <h2>Agenda</h2>
      <ul>
        <li></li>
        <li></li>
        <li></li>
      </ul>
      <h2>Key decisions</h2>
      <ul>
        <li></li>
      </ul>
      <h2>Action items</h2>
      <ul>
        <li></li>
      </ul>
    `,
  },
  email: {
    title: 'Email draft',
    content: `
      <p>Subject: </p>
      <p>Hi,</p>
      <p></p>
      <p></p>
      <p>Best regards,</p>
      <p></p>
    `,
  },
};

const REACTION_EMOJIS = [
  '👍', '❤️', '🎉', '😄',
  '👏', '🔥', '😍', '🤔',
  '😂', '✅', '🚀', '✨',
];

function DocumentPage() {
  const { profile, user, loginWithEmail, loginWithGoogle, logout } = useAuthProfile();

  const [status, setStatus] = useState('connecting');
  const [users, setUsers] = useState([]);
  const [headings, setHeadings] = useState([]);
  const [docTitle, setDocTitle] = useState('Untitled document');
  const [menu, setMenu] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showRuler, setShowRuler] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showTopbar, setShowTopbar] = useState(true);
  const [sharedDocuments, setSharedDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState([]);
  const [acceptedMembers, setAcceptedMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [activeInvite, setActiveInvite] = useState(null);
  const [dismissedInviteToken, setDismissedInviteToken] = useState('');
  const [showLauncher, setShowLauncher] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [folderDialog, setFolderDialog] = useState(null);
  const [versions, setVersions] = useState([]);
  const [draggedDocument, setDraggedDocument] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCommentComposer, setShowCommentComposer] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [toasts, setToasts] = useState([]);
  const [isPresenceActive, setIsPresenceActive] = useState(
    () => !document.hidden && document.hasFocus()
  );
  const [inviteToken, setInviteToken] = useState(
    () => new URLSearchParams(window.location.search).get('invite') || ''
  );
  const isTopbarVisible = showTopbar && !showLogin && !showShare && !showLauncher;

  const [tabs, setTabs] = useState(() => {
    const raw = localStorage.getItem(tabsKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed.map((tab) => ({
            ...tab,
            projectId: tab.projectId || (tab.documentId ? `shared-${tab.documentId}` : tab.id),
          }));
        }
      } catch (error) {
        console.error('Failed to parse tabs', error);
      }
    }
    return [createLocalTab('Tab 1')];
  });

  const [activeTabId, setActiveTabId] = useState(() => {
    const stored = localStorage.getItem(activeTabKey);
    if (stored) return stored;
    const raw = localStorage.getItem(tabsKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed[0].id;
        }
      } catch (error) {
        console.error('Failed to parse tabs', error);
      }
    }
    return null;
  });

  const [comments, setComments] = useState([]);
  const [commentTab, setCommentTab] = useState('all');
  const [commentQuery, setCommentQuery] = useState('');
  const [commentTypeFilter, setCommentTypeFilter] = useState('all');
  const [commentTabFilter, setCommentTabFilter] = useState('all');
  const [showNotificationsOnly, setShowNotificationsOnly] = useState(false);
  const [lastSeenNotificationAt, setLastSeenNotificationAt] = useState('');
  const [zoom, setZoom] = useState(100);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(12);
  const [lineHeight, setLineHeight] = useState('1.6');
  const [textColor, setTextColor] = useState('#1f1f1f');

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
  const activeProjectId = activeTab?.projectId || null;
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => !activeProjectId || tab.projectId === activeProjectId),
    [tabs, activeProjectId]
  );
  const visibleSharedDocuments = useMemo(
    () =>
      sharedDocuments.filter(
        (document) => activeProjectId && activeProjectId === `shared-${document.id}`
      ),
    [sharedDocuments, activeProjectId]
  );
  const activeDocumentId = activeTab?.documentId || null;
  const currentFolderId = activeTab?.folderId || null;
  const activeAccessRole = activeTab?.accessRole || 'edit';
  const isReadOnly = activeAccessRole === 'view';
  const draftKey = useMemo(
    () => (activeTabId ? getDraftKey(activeTabId) : null),
    [activeTabId]
  );
  const historyKey = useMemo(
    () => (activeTabId ? getHistoryKey(activeTabId) : null),
    [activeTabId]
  );
  const notificationsKey = useMemo(
    () => (activeTabId ? `doc:notifications-seen:${activeTabId}` : null),
    [activeTabId]
  );

  const roomName = activeDocumentId
    ? `${ROOM_NAME}-shared-${activeDocumentId}`
    : activeTabId
      ? `${ROOM_NAME}-${activeTabId}`
      : ROOM_NAME;

  const ydoc = useMemo(() => new Y.Doc(), [activeTabId, activeDocumentId]);
  const provider = useMemo(
    () => new WebsocketProvider(WS_URL, roomName, ydoc),
    [roomName, ydoc]
  );

  const lastSavedRef = useRef('');
  const autosaveTimer = useRef(null);
  const toastTimers = useRef(new Map());

  const dismissToast = (id) => {
    const timer = toastTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const notify = ({ type = 'info', title, message }) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, title, message }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      toastTimers.current.delete(id);
    }, 4200);
    toastTimers.current.set(id, timer);
  };

  useEffect(() => {
    if (!activeTabId && tabs.length) {
      setActiveTabId(tabs[0].id);
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    localStorage.setItem(tabsKey, JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem(activeTabKey, activeTabId);
    }
  }, [activeTabId]);

  useEffect(() => {
    if (activeTab) {
      setDocTitle(activeTab.title);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!profile?.email) {
      setSharedDocuments([]);
      setAcceptedMembers([]);
      setFolders([]);
      return;
    }

    fetchSharedDocuments(profile.email)
      .then((documents) => setSharedDocuments(documents))
      .catch((error) => {
        console.error('Failed to load shared documents', error);
      });

    fetchFolders(profile.email)
      .then((nextFolders) => setFolders(nextFolders))
      .catch((error) => {
        console.error('Failed to load folders', error);
      });
  }, [profile?.email]);

  useEffect(() => {
    if (!activeDocumentId || !profile?.email) {
      setAcceptedMembers([]);
      return;
    }

    let cancelled = false;

    const loadMembers = () => {
      fetchDocument(activeDocumentId, profile.email)
        .then((document) => {
          if (cancelled) {
            return;
          }

          const nextMembers = (document.members || [])
            .map((member) => member.user)
            .filter(Boolean);

          setAcceptedMembers(nextMembers);
        })
        .catch((error) => {
          if (!cancelled) {
            console.error('Failed to load accepted members', error);
          }
        });
    };

    loadMembers();
    const timer = window.setInterval(loadMembers, 12000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeDocumentId, profile?.email]);

  useEffect(() => {
    if (!showVersions || !activeDocumentId || !profile?.email) {
      if (!showVersions) {
        setVersions([]);
      }
      return;
    }

    fetchDocumentVersions({
      documentId: activeDocumentId,
      userEmail: profile.email,
    })
      .then((nextVersions) => setVersions(nextVersions))
      .catch((error) => {
        console.error('Failed to load version history', error);
        notify({
          type: 'error',
          title: 'Version history failed',
          message: error.message,
        });
      });
  }, [showVersions, activeDocumentId, profile?.email]);

  useEffect(() => {
    if (!profile?.email) {
      setPendingInvites([]);
      return;
    }

    fetchInvites(profile.email)
      .then((invites) => setPendingInvites(invites))
      .catch((error) => {
        console.error('Failed to load invites', error);
      });
  }, [profile?.email]);

  useEffect(() => {
    if (!inviteToken) {
      return;
    }

    fetchInvite(inviteToken)
      .then((invite) => setActiveInvite(invite))
      .catch((error) => {
        console.error('Failed to load invite', error);
        notify({
          type: 'error',
          title: 'Invitation unavailable',
          message: error.message,
        });
        setActiveInvite(null);
      });
  }, [inviteToken]);

  useEffect(() => {
    if (inviteToken || activeInvite || !pendingInvites.length) {
      return;
    }

    const nextInvite = pendingInvites.find((invite) => invite.token !== dismissedInviteToken);
    if (nextInvite) {
      setActiveInvite(nextInvite);
    }
  }, [inviteToken, activeInvite, pendingInvites, dismissedInviteToken]);

  useEffect(() => {
    const handleStatus = (event) => setStatus(event.status);
    provider.on('status', handleStatus);
    return () => provider.off('status', handleStatus);
  }, [provider]);

  useEffect(() => {
    provider.awareness.setLocalStateField('user', {
      ...user,
      active: isPresenceActive,
    });
  }, [provider, user, isPresenceActive]);

  useEffect(() => {
    const syncPresence = () => {
      setIsPresenceActive(!document.hidden && document.hasFocus());
    };

    window.addEventListener('focus', syncPresence);
    window.addEventListener('blur', syncPresence);
    document.addEventListener('visibilitychange', syncPresence);

    syncPresence();

    return () => {
      window.removeEventListener('focus', syncPresence);
      window.removeEventListener('blur', syncPresence);
      document.removeEventListener('visibilitychange', syncPresence);
    };
  }, []);

  useEffect(() => {
    const awareness = provider.awareness;
    const updateUsers = () => {
      const states = Array.from(awareness.getStates().values());
      setUsers(states.map((state) => state.user).filter(Boolean));
    };

    awareness.on('change', updateUsers);
    updateUsers();

    return () => awareness.off('change', updateUsers);
  }, [provider]);

  useEffect(() => {
    if (!historyKey) return;
    const raw = localStorage.getItem(historyKey);
    setComments(raw ? JSON.parse(raw) : []);
  }, [historyKey]);

  useEffect(() => {
    if (!notificationsKey) {
      setLastSeenNotificationAt('');
      setShowNotificationsOnly(false);
      return;
    }

    const saved = localStorage.getItem(notificationsKey) || '';
    setLastSeenNotificationAt(saved);
    setShowNotificationsOnly(false);
  }, [notificationsKey]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          link: false,
          underline: false,
        }),
        Underline,
        TextStyle,
        FontSize,
        FontFamily,
        Color,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Image.configure({ inline: false, allowBase64: true }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({
          provider,
          user,
        }),
      ],
      editable: !isReadOnly,
      editorProps: {
        attributes: {
          class: 'editor-content',
        },
      },
    },
    [activeTabId, activeDocumentId, activeAccessRole, user]
  );

  useEffect(() => {
    if (!editor || !activeTab) return undefined;

    if (activeDocumentId) {
      const content = activeTab.content || '';
      editor.commands.setContent(content);
      lastSavedRef.current = content;
    } else if (draftKey) {
      const saved = localStorage.getItem(draftKey);
      if (saved !== null) {
        editor.commands.setContent(saved);
        lastSavedRef.current = saved;
      } else {
        editor.commands.setContent(activeTab.content || '');
        lastSavedRef.current = activeTab.content || '';
      }
    }

    const updateHeadings = () => {
      const items = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          items.push({
            id: `${pos}-${node.attrs.level}`,
            level: node.attrs.level,
            text: node.textContent || 'Untitled',
            pos,
          });
        }
      });
      setHeadings(items);
    };

    updateHeadings();
    editor.on('update', updateHeadings);

    return () => editor.off('update', updateHeadings);
  }, [editor, activeTab, activeDocumentId, draftKey]);

  useEffect(() => {
    if (!editor || !historyKey || !activeTabId) return undefined;

    const handleUpdate = () => {
      const currentHtml = editor.getHTML();
      if (currentHtml === lastSavedRef.current) return;

      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }

      autosaveTimer.current = setTimeout(() => {
        const previous = lastSavedRef.current;
        if (previous && previous !== currentHtml) {
          const entry = {
            id: crypto.randomUUID(),
            author: user.name,
            authorEmail: profile?.email || '',
            tabId: activeTabId,
            tabTitle: activeTab?.title || docTitle,
            createdAt: new Date().toISOString(),
            preview: stripHtml(previous).slice(0, 140) || '(empty)',
            snapshot: previous,
            type: 'history',
          };
          const next = [entry, ...comments].slice(0, 50);
          setComments(next);
          localStorage.setItem(historyKey, JSON.stringify(next));
        }

        lastSavedRef.current = currentHtml;
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTabId ? { ...tab, content: currentHtml } : tab
          )
        );

        if (activeDocumentId) {
          if (!isReadOnly && profile?.email) {
            updateDocument({
              documentId: activeDocumentId,
              userEmail: profile.email,
              content: currentHtml,
            }).catch((error) => {
              console.error('Failed to sync shared document', error);
            });
          }
        } else if (draftKey) {
          localStorage.setItem(draftKey, currentHtml);
        }
      }, 1500);
    };

    editor.on('update', handleUpdate);
    return () => editor.off('update', handleUpdate);
  }, [editor, comments, user.name, historyKey, activeTabId, activeDocumentId, isReadOnly, profile?.email, draftKey]);

  useEffect(() => {
    const handleClose = (event) => {
      if (!event.target.closest('.menu')) {
        setMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClose);
    return () => document.removeEventListener('mousedown', handleClose);
  }, []);

  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timer) => clearTimeout(timer));
      toastTimers.current.clear();
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  useEffect(() => {
    const shouldLockScroll =
      showLauncher || showLogin || showShare || showCommentComposer || Boolean(activeInvite);
    const lockForFolderDialog = Boolean(folderDialog);

    document.body.classList.toggle('app-modal-open', shouldLockScroll || lockForFolderDialog);
    document.documentElement.classList.toggle('app-modal-open', shouldLockScroll || lockForFolderDialog);

    return () => {
      document.body.classList.remove('app-modal-open');
      document.documentElement.classList.remove('app-modal-open');
    };
  }, [showLauncher, showLogin, showShare, showCommentComposer, activeInvite, folderDialog]);

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href || '';
    const url = window.prompt('Paste a link', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const handleRename = (nextTitle) => {
    const next = typeof nextTitle === 'string'
      ? nextTitle
      : window.prompt('Rename document', activeTab?.title || docTitle);
    if (!next) return;
    const trimmed = next.trim();
    if (!trimmed) return;

    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, title: trimmed } : tab
      )
    );
    setDocTitle(trimmed);

    if (activeDocumentId && profile?.email) {
      updateDocument({
        documentId: activeDocumentId,
        userEmail: profile.email,
        title: trimmed,
      })
        .then((document) => {
          setSharedDocuments((prev) =>
            prev.map((item) =>
              item.id === document.id ? { ...item, title: document.title } : item
            )
          );
        })
        .catch((error) => {
          console.error('Rename failed', error);
          notify({ type: 'error', title: 'Rename failed', message: error.message });
        });
    }
  };

  const handleNewDoc = () => {
    const newTab = createLocalTab('Untitled document');

    setTabs((prev) => {
      let next = prev;

      if (activeTabId && editor) {
        const currentHtml = editor.getHTML();
        localStorage.setItem(getDraftKey(activeTabId), currentHtml);
        next = prev.map((tab) =>
          tab.id === activeTabId ? { ...tab, content: currentHtml } : tab
        );
      }

      return [...next, newTab];
    });

    localStorage.setItem(getDraftKey(newTab.id), '');
    localStorage.setItem(getHistoryKey(newTab.id), JSON.stringify([]));
    setActiveTabId(newTab.id);
    setDocTitle(newTab.title);
    setComments([]);
    setCommentTab('all');
    setCommentQuery('');
    setCommentTypeFilter('all');
    setCommentTabFilter('all');
    setShowCommentComposer(false);
    setCommentDraft('');
    setShowEmojiPicker(false);
  };

  const handleAddTab = () => {
    const nextIndex = visibleTabs.length + 1;
    const newTab = createLocalTab(`Tab ${nextIndex}`, activeProjectId || crypto.randomUUID());
    if (activeTabId && editor) {
      const currentHtml = editor.getHTML();
      localStorage.setItem(getDraftKey(activeTabId), currentHtml);
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId ? { ...tab, content: currentHtml } : tab
        )
      );
    }
    localStorage.setItem(getDraftKey(newTab.id), '');
    localStorage.setItem(getHistoryKey(newTab.id), JSON.stringify([]));
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setDocTitle(newTab.title);
  };

  const handleSelectTab = (tabId) => {
    if (tabId === activeTabId) return;
    if (activeTabId && editor && !activeDocumentId) {
      const currentHtml = editor.getHTML();
      localStorage.setItem(getDraftKey(activeTabId), currentHtml);
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId ? { ...tab, content: currentHtml } : tab
        )
      );
    }
    setActiveTabId(tabId);
  };

  const handleOpenSharedDocument = (documentId) => {
    if (!profile?.email) {
      setShowLogin(true);
      return;
    }

    fetchDocument(documentId, profile.email)
      .then((document) => {
        setAcceptedMembers(
          (document.members || [])
            .map((member) => member.user)
            .filter(Boolean)
        );
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTabId
              ? {
                  ...tab,
                  title: document.title,
                  content: document.content || '',
                  documentId: document.id,
                  folderId: document.folderId ?? null,
                  projectId: `shared-${document.id}`,
                  accessRole: document.accessRole,
                }
              : tab
          )
        );
        setDocTitle(document.title);
      })
      .catch((error) => {
        console.error('Open shared document failed', error);
        notify({ type: 'error', title: 'Open failed', message: error.message });
      });
  };

  const clearInviteQuery = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url.toString());
    setInviteToken('');
  };

  const handleAcceptInvite = () => {
    if (!activeInvite || !profile?.email) {
      setShowLogin(true);
      return;
    }

    acceptInvite({
      token: activeInvite.token,
      userEmail: profile.email,
    })
      .then((document) => {
        setPendingInvites((prev) => prev.filter((invite) => invite.token !== activeInvite.token));
        setActiveInvite(null);
        clearInviteQuery();
        setSharedDocuments((prev) => {
          const withoutExisting = prev.filter((item) => item.id !== document.id);
          return [document, ...withoutExisting];
        });
        notify({
          type: 'success',
          title: 'Invitation accepted',
          message: `${document.title} is now in your shared documents.`,
        });
        handleOpenSharedDocument(document.id);
      })
      .catch((error) => {
        console.error('Accept invite failed', error);
        notify({
          type: 'error',
          title: 'Accept failed',
          message: error.message,
        });
      });
  };

  const handleWordCount = () => {
    if (!editor) return;
    const text = editor.getText().trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    notify({
      type: 'info',
      title: 'Document stats',
      message: `Words: ${words} • Characters: ${chars}`,
    });
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const handleLogin = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    if (!name || !email) return;

    loginWithEmail({ name, email })
      .then(() => {
        setShowLogin(false);
      })
      .catch((error) => {
        console.error('Manual login failed', error);
        notify({
          type: 'error',
          title: 'Login failed',
          message: 'Check backend and PostgreSQL configuration.',
        });
      });
  };

  const handleGoogleLogin = (credential) => {
    loginWithGoogle(credential)
      .then(() => {
        setShowLogin(false);
      })
      .catch((error) => {
        console.error('Google login failed', error);
        notify({ type: 'error', title: 'Google sign-in failed', message: error.message });
      });
  };

  const addManualComment = () => {
    if (!editor || !historyKey) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, ' ');
    setCommentDraft(selected || '');
    setShowCommentComposer(true);
  };

  const handleCommentSubmit = (note) => {
    if (!historyKey) return;
    const entry = {
      id: crypto.randomUUID(),
      author: user.name,
      authorEmail: profile?.email || '',
      tabId: activeTabId,
      tabTitle: activeTab?.title || docTitle,
      createdAt: new Date().toISOString(),
      preview: note.slice(0, 140),
      snapshot: null,
      type: 'comment',
    };
    const next = [entry, ...comments].slice(0, 50);
    setComments(next);
    localStorage.setItem(historyKey, JSON.stringify(next));
    setShowComments(true);
    setShowCommentComposer(false);
    setCommentDraft('');
  };

  const addReactionComment = (emoji) => {
    if (!historyKey) return;
    const entry = {
      id: crypto.randomUUID(),
      author: user.name,
      authorEmail: profile?.email || '',
      tabId: activeTabId,
      tabTitle: activeTab?.title || docTitle,
      createdAt: new Date().toISOString(),
      preview: `${emoji} reaction`,
      snapshot: null,
      type: 'comment',
    };
    const next = [entry, ...comments].slice(0, 50);
    setComments(next);
    localStorage.setItem(historyKey, JSON.stringify(next));
    setShowComments(true);
    setShowEmojiPicker(false);
    notify({
      type: 'success',
      title: 'Reaction added',
      message: `${emoji} was added to comments.`,
    });
  };

  const handleClearHistory = () => {
    if (!historyKey) return;
    const ok = window.confirm('Clear all history entries?');
    if (!ok) return;
    setComments((prev) => {
      const next = prev.filter((comment) => comment.type !== 'history');
      localStorage.setItem(historyKey, JSON.stringify(next));
      return next;
    });
  };

  const restoreSnapshot = (snapshot) => {
    if (!snapshot || !editor) return;
    editor.commands.setContent(snapshot);
  };

  const handleDeleteComment = (commentId) => {
    if (!historyKey) return;
    setComments((prev) => {
      const next = prev.filter((comment) => {
        if (comment.id !== commentId) {
          return true;
        }

        const normalizedCurrentEmail = String(profile?.email || '').trim().toLowerCase();
        const normalizedAuthorEmail = String(comment.authorEmail || '').trim().toLowerCase();
        const canDelete = normalizedCurrentEmail
          ? normalizedCurrentEmail === normalizedAuthorEmail
          : comment.author === user.name;

        return !canDelete;
      });
      localStorage.setItem(historyKey, JSON.stringify(next));
      return next;
    });
    notify({
      type: 'success',
      title: 'Comment deleted',
      message: 'The comment was removed.',
    });
  };

  const handleCopyCommentLink = async (commentId) => {
    const url = `${window.location.origin}${window.location.pathname}#comment-${commentId}`;
    try {
      await navigator.clipboard.writeText(url);
      notify({
        type: 'success',
        title: 'Link copied',
        message: 'Comment link copied to clipboard.',
      });
    } catch (error) {
      console.error('Copy comment link failed', error);
      notify({
        type: 'error',
        title: 'Copy failed',
        message: 'Could not copy the comment link.',
      });
    }
  };

  const handleSearch = (term) => {
    const value = String(term || '').trim();
    if (!value) {
      return;
    }

    const found = window.find(value);
    if (!found) {
      notify({
        type: 'info',
        title: 'No matches',
        message: `Nothing matched "${value}".`,
      });
    }
  };

  const handleZoomChange = (value) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    setZoom(next);
  };

  const handleFontFamilyChange = (value) => {
    setFontFamily(value);
    editor?.chain().focus().setFontFamily(value).run();
  };

  const handleFontSizeChange = (value) => {
    const next = Number(value);
    if (Number.isNaN(next) || next < 6) return;
    setFontSize(next);
    editor?.chain().focus().setFontSize(`${next}px`).run();
  };

  const handleLineHeightChange = (value) => {
    setLineHeight(value);
  };

  const applyTextColor = (value) => {
    setTextColor(value);
    editor?.chain().focus().setColor(value).run();
  };

  const handleInsertImage = () => {
    if (!editor) return;
    const url = window.prompt('Image URL');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const handleIndent = () => {
    if (!editor) return;
    if (editor.can().chain().focus().sinkListItem('listItem').run()) {
      editor.chain().focus().sinkListItem('listItem').run();
      return;
    }
    editor.chain().focus().toggleBlockquote().run();
  };

  const handleOutdent = () => {
    if (!editor) return;
    if (editor.can().chain().focus().liftListItem('listItem').run()) {
      editor.chain().focus().liftListItem('listItem').run();
      return;
    }
    editor.chain().focus().lift().run();
  };

  const handleOpenTab = () => {
    if (!tabs.length) return;
    const options = tabs
      .map((tab, index) => `${index + 1}. ${tab.title}`)
      .join('\n');
    const raw = window.prompt(`Open tab:\n${options}`, '1');
    const index = Number(raw);
    if (!index || index < 1 || index > tabs.length) return;
    handleSelectTab(tabs[index - 1].id);
  };

  const handleDuplicateTab = () => {
    if (!activeTabId) return;
    const currentHtml =
      editor?.getHTML() || localStorage.getItem(getDraftKey(activeTabId)) || '';
    const newTab = {
      ...createLocalTab(`${activeTab?.title || 'Tab'} copy`, activeProjectId || crypto.randomUUID()),
      content: currentHtml,
    };
    localStorage.setItem(getDraftKey(newTab.id), currentHtml);
    localStorage.setItem(getHistoryKey(newTab.id), JSON.stringify([]));
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setDocTitle(newTab.title);
  };

  const handleMoveTab = () => {
    if (!tabs.length || !activeTabId) return;
    const raw = window.prompt(
      `Move tab to position (1-${tabs.length})`,
      '1'
    );
    const index = Number(raw);
    if (!index || index < 1 || index > tabs.length) return;
    setTabs((prev) => {
      const next = [...prev];
      const currentIndex = next.findIndex((tab) => tab.id === activeTabId);
      if (currentIndex < 0) return next;
      const [moved] = next.splice(currentIndex, 1);
      next.splice(index - 1, 0, moved);
      return next;
    });
  };

  const handleDeleteTab = () => {
    if (!activeTabId) return;
    const ok = window.confirm('Move this tab to bin?');
    if (!ok) return;
    localStorage.removeItem(getDraftKey(activeTabId));
    localStorage.removeItem(getHistoryKey(activeTabId));
    const remaining = tabs.filter((tab) => tab.id !== activeTabId);
    if (!remaining.length) {
      const fresh = createLocalTab('Tab 1');
      localStorage.setItem(getDraftKey(fresh.id), '');
      localStorage.setItem(getHistoryKey(fresh.id), JSON.stringify([]));
      setTabs([fresh]);
      setActiveTabId(fresh.id);
      return;
    }
    const nextActive = remaining[0].id;
    setTabs(remaining);
    setActiveTabId(nextActive);
  };

  const handleVersionHistory = () => {
    if (!activeDocumentId || !profile?.email) {
      setShowComments(true);
      setCommentTypeFilter('history');
      setCommentTab('all');
      return;
    }

    setShowVersions(true);
  };

  const handleCreateFolder = () => {
    if (!profile?.email) {
      setShowLogin(true);
      return;
    }

    setFolderDialog({
      mode: 'create',
      value: '',
      folder: null,
    });
  };

  const submitCreateFolder = (name) => {
    createFolder({
      userEmail: profile.email,
      name: name.trim(),
    })
      .then((folder) => {
        setFolders((prev) => [...prev, folder]);
        setFolderDialog(null);
        notify({
          type: 'success',
          title: 'Folder created',
          message: `${folder.name} is ready.`,
        });
      })
      .catch((error) => {
        console.error('Create folder failed', error);
        notify({
          type: 'error',
          title: 'Folder failed',
          message: error.message,
        });
      });
  };

  const handleRenameFolder = (folder) => {
    if (!profile?.email) {
      return;
    }

    setFolderDialog({
      mode: 'rename',
      value: folder.name,
      folder,
    });
  };

  const submitRenameFolder = (folder, nextName) => {
    renameFolder({
      folderId: folder.id,
      userEmail: profile.email,
      name: nextName.trim(),
    })
      .then((updatedFolder) => {
        setFolders((prev) =>
          prev.map((item) => (item.id === updatedFolder.id ? updatedFolder : item))
        );
        setFolderDialog(null);
        notify({
          type: 'success',
          title: 'Folder renamed',
          message: `"${updatedFolder.name}" is ready.`,
        });
      })
      .catch((error) => {
        console.error('Rename folder failed', error);
        notify({
          type: 'error',
          title: 'Rename failed',
          message: error.message,
        });
      });
  };

  const handleDeleteFolder = (folder) => {
    if (!profile?.email) {
      return;
    }

    setFolderDialog({
      mode: 'delete',
      value: folder.name,
      folder,
    });
  };

  const submitDeleteFolder = (folder) => {
    deleteFolder({
      folderId: folder.id,
      userEmail: profile.email,
    })
      .then(() => {
        setFolderDialog(null);
        setFolders((prev) => prev.filter((item) => item.id !== folder.id));
        setCollapsedFolderIds((prev) => prev.filter((id) => id !== String(folder.id)));
        setTabs((prev) =>
          prev.map((tab) =>
            tab.folderId === folder.id
              ? { ...tab, folderId: null }
              : tab
          )
        );
        setSharedDocuments((prev) =>
          prev.map((document) =>
            document.folderId === folder.id
              ? { ...document, folderId: null }
              : document
          )
        );
        notify({
          type: 'success',
          title: 'Folder deleted',
          message: 'Its documents are now in Unfiled.',
        });
      })
      .catch((error) => {
        console.error('Delete folder failed', error);
        notify({
          type: 'error',
          title: 'Delete failed',
          message: error.message,
        });
      });
  };

  const handleFolderDialogConfirm = () => {
    if (!folderDialog || !profile?.email) {
      return;
    }

    const nextName = String(folderDialog.value || '').trim();

    if (folderDialog.mode === 'delete' && folderDialog.folder) {
      submitDeleteFolder(folderDialog.folder);
      return;
    }

    if (!nextName) {
      notify({
        type: 'error',
        title: 'Folder name required',
        message: 'Please enter a folder name first.',
      });
      return;
    }

    if (folderDialog.mode === 'rename' && folderDialog.folder) {
      if (nextName === folderDialog.folder.name) {
        setFolderDialog(null);
        return;
      }
      submitRenameFolder(folderDialog.folder, nextName);
      return;
    }

    submitCreateFolder(nextName);
  };

  const handleToggleFolder = (folderId) => {
    setCollapsedFolderIds((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId]
    );
  };

  const handleMoveActiveDocument = (folderId) => {
    if (!activeDocumentId || !profile?.email) {
      return;
    }

    if (activeAccessRole !== 'owner') {
      notify({
        type: 'error',
        title: 'Owner only',
        message: 'Only the document owner can move shared documents between folders.',
      });
      return;
    }

    moveDocumentToFolder({
      documentId: activeDocumentId,
      userEmail: profile.email,
      folderId,
    })
      .then((document) => {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTabId
              ? { ...tab, folderId: document.folderId ?? null }
              : tab
          )
        );
        setSharedDocuments((prev) =>
          prev.map((item) =>
            item.id === document.id
              ? { ...item, folderId: document.folderId ?? null }
              : item
          )
        );
        notify({
          type: 'success',
          title: 'Moved to folder',
          message: folderId
            ? 'The document was organized into the selected folder.'
            : 'The document is now in Unfiled.',
        });
      })
      .catch((error) => {
        console.error('Move document failed', error);
        notify({
          type: 'error',
          title: 'Folder move failed',
          message: error.message,
        });
      });
  };

  const handleDragDocument = (item) => {
    if (!item?.documentId) {
      notify({
        type: 'info',
        title: 'Share first',
        message: 'Local drafts can be moved into folders after they are shared or saved.',
      });
      return;
    }

    if (item?.accessRole && item.accessRole !== 'owner') {
      notify({
        type: 'info',
        title: 'Owner only',
        message: 'Only the document owner can organize shared documents into folders.',
      });
      return;
    }

    setDraggedDocument(item);
  };

  const handleDropDocument = (folderId) => {
    if (!draggedDocument?.documentId || !profile?.email) {
      setDraggedDocument(null);
      return;
    }

    moveDocumentToFolder({
      documentId: draggedDocument.documentId,
      userEmail: profile.email,
      folderId,
    })
      .then((document) => {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.documentId === document.id
              ? { ...tab, folderId: document.folderId ?? null }
              : tab
          )
        );
        setSharedDocuments((prev) =>
          prev.map((item) =>
            item.id === document.id
              ? { ...item, folderId: document.folderId ?? null }
              : item
          )
        );
        notify({
          type: 'success',
          title: 'Document moved',
          message: folderId ? 'Dropped into folder successfully.' : 'Moved back to Unfiled.',
        });
      })
      .catch((error) => {
        console.error('Drop move failed', error);
        notify({
          type: 'error',
          title: 'Drag move failed',
          message: error.message,
        });
      })
      .finally(() => {
        setDraggedDocument(null);
      });
  };

  const handleRestoreVersion = (versionId) => {
    if (!activeDocumentId || !profile?.email) {
      return;
    }

    restoreDocumentVersion({
      documentId: activeDocumentId,
      versionId,
      userEmail: profile.email,
    })
      .then((document) => {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTabId
              ? {
                  ...tab,
                  title: document.title,
                  content: document.content || '',
                  folderId: document.folderId ?? null,
                }
              : tab
          )
        );
        setSharedDocuments((prev) =>
          prev.map((item) =>
            item.id === document.id
              ? {
                  ...item,
                  title: document.title,
                  folderId: document.folderId ?? null,
                  updatedAt: document.updatedAt,
                }
              : item
          )
        );
        setDocTitle(document.title);
        editor?.commands.setContent(document.content || '');
        setShowVersions(false);
        notify({
          type: 'success',
          title: 'Version restored',
          message: 'The selected snapshot is now live.',
        });
      })
      .catch((error) => {
        console.error('Restore version failed', error);
        notify({
          type: 'error',
          title: 'Restore failed',
          message: error.message,
        });
      });
  };

  const handleExportPdf = () => {
    if (!activeDocumentId || !profile?.email) {
      window.print();
      return;
    }

    exportDocumentPdf({
      documentId: activeDocumentId,
      userEmail: profile.email,
    })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${docTitle || 'document'}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        console.error('Export PDF failed', error);
        notify({
          type: 'error',
          title: 'PDF export failed',
          message: error.message,
        });
      });
  };

  const handleOffline = () => {
    localStorage.setItem(`doc:offline:${ROOM_NAME}`, 'true');
    notify({ type: 'success', title: 'Offline mode enabled', message: 'This draft is now local only.' });
  };

  const handleDetails = () => {
    if (!editor) return;
    const text = editor.getText().trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    notify({
      type: 'info',
      title: docTitle,
      message: `Tabs: ${tabs.length} • Words: ${words} • Characters: ${chars}`,
    });
  };

  const handleEmail = () => {
    if (!editor) return;
    const body = encodeURIComponent(editor.getText().slice(0, 500));
    window.location.href = `mailto:?subject=${encodeURIComponent(
      docTitle
    )}&body=${body}`;
  };

  const handleLanguage = () => {
    notify({ type: 'info', title: 'Language', message: 'Language settings coming soon.' });
  };

  const handlePageSetup = () => {
    notify({ type: 'info', title: 'Page setup', message: 'Page setup coming soon.' });
  };

  const handleShare = () => {
    if (!profile?.email) {
      setShowLogin(true);
      return;
    }
    if (activeDocumentId && activeAccessRole === 'view') {
      notify({
        type: 'error',
        title: 'View only',
        message: 'This document is view only. You cannot share it.',
      });
      return;
    }
    setShowShare(true);
  };

  const handleShareSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextTitle = String(form.get('title') || '').trim() || 'Untitled document';
    const rawEmails = String(form.get('emails') || '');
    const role = String(form.get('role') || 'edit').trim();
    const memberEmails = Array.from(
      new Set(
        rawEmails
          .split(/[\n,]+/)
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (!memberEmails.length || !profile?.email) return;

    const invalidEmails = memberEmails.filter((email) => !email.endsWith('@gmail.com'));
    if (invalidEmails.length) {
      notify({
        type: 'error',
        title: 'Gmail only',
        message: `Only Gmail addresses are allowed: ${invalidEmails.join(', ')}`,
      });
      return;
    }

    setDocTitle(nextTitle);
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, title: nextTitle } : tab
      )
    );

    Promise.all(
      memberEmails.map((memberEmail) =>
        shareDocument({
          documentId: activeDocumentId,
          folderId: currentFolderId,
          ownerEmail: profile.email,
          memberEmail,
          title: nextTitle,
          content: editor?.getHTML() || '',
          role,
        })
      )
    )
      .then((responses) => {
        const { document } = responses[responses.length - 1];
        const inviteCount = responses.filter((item) => item.invite).length;
        const updatedMemberCount = responses.filter((item) => item.alreadyMember).length;
        setShowShare(false);
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTabId
              ? {
                  ...tab,
                  documentId: document.id,
                  folderId: document.folderId ?? null,
                  projectId: `shared-${document.id}`,
                  accessRole: 'owner',
                  title: document.title,
                  content: document.content || '',
                }
              : tab
          )
        );
        setSharedDocuments((prev) => {
          const nextDoc = {
            id: document.id,
            title: document.title,
            ownerEmail: document.owner?.email || profile.email,
            folderId: document.folderId ?? null,
            accessRole: 'owner',
            updatedAt: document.updatedAt,
          };
          const withoutExisting = prev.filter((item) => item.id !== document.id);
          return [nextDoc, ...withoutExisting];
        });
        notify({
          type: 'success',
          title: 'Invitations sent',
          message:
            inviteCount > 0
              ? `Email request sent to ${inviteCount} member${inviteCount > 1 ? 's' : ''}.${updatedMemberCount ? ` ${updatedMemberCount} existing member updated.` : ''}`
              : `Updated ${updatedMemberCount} existing member${updatedMemberCount > 1 ? 's' : ''}.`,
        });
      })
      .catch((error) => {
        console.error('Share failed', error);
        notify({ type: 'error', title: 'Share failed', message: error.message });
      });
  };

  const handleApplyQuickTemplate = (templateKey) => {
    const template = QUICK_TEMPLATES[templateKey];
    if (!template || !editor) {
      return;
    }

    editor.commands.setContent(template.content);
    setDocTitle(template.title);
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, title: template.title, content: template.content }
          : tab
      )
    );

    if (activeDocumentId && profile?.email && activeAccessRole !== 'view') {
      updateDocument({
        documentId: activeDocumentId,
        userEmail: profile.email,
        title: template.title,
        content: template.content,
      }).catch((error) => {
        console.error('Apply template failed', error);
      });
    }

    notify({
      type: 'success',
      title: `${template.title} applied`,
      message: 'Starter content was added to the document.',
    });
  };

  const isOwnComment = (comment) => {
    const normalizedCurrentEmail = String(profile?.email || user.email || '').trim().toLowerCase();
    const normalizedAuthorEmail = String(comment.authorEmail || '').trim().toLowerCase();

    if (normalizedCurrentEmail && normalizedAuthorEmail) {
      return normalizedCurrentEmail === normalizedAuthorEmail;
    }

    return comment.author === user.name;
  };

  const notificationComments = comments.filter((comment) => !isOwnComment(comment));
  const unreadNotificationComments = notificationComments.filter((comment) => {
    if (!lastSeenNotificationAt) {
      return true;
    }

    return new Date(comment.createdAt).getTime() > new Date(lastSeenNotificationAt).getTime();
  });

  const handleToggleNotifications = () => {
    setShowNotificationsOnly((prev) => {
      const next = !prev;

      if (next && notificationsKey) {
        const seenAt = new Date().toISOString();
        localStorage.setItem(notificationsKey, seenAt);
        setLastSeenNotificationAt(seenAt);
      }

      return next;
    });
  };

  const headingValue = editor?.isActive('heading', { level: 1 })
    ? 'h1'
    : editor?.isActive('heading', { level: 2 })
      ? 'h2'
      : editor?.isActive('heading', { level: 3 })
        ? 'h3'
        : 'paragraph';

  const filteredComments = comments.filter((comment) => {
    if (commentTypeFilter !== 'all' && comment.type !== commentTypeFilter) {
      return false;
    }
    if (commentTabFilter !== 'all' && comment.tabId !== commentTabFilter) {
      return false;
    }
    if (commentQuery) {
      const query = commentQuery.toLowerCase();
      const text = comment.preview.toLowerCase();
      if (!text.includes(query)) return false;
    }
    if (showNotificationsOnly && isOwnComment(comment)) {
      return false;
    }
    if (commentTab === 'forYou') {
      return comment.author === user.name;
    }
    return true;
  });

  const recentDocuments = [
    ...tabs.map((tab) => ({
      id: `tab-${tab.id}`,
      title: tab.title,
      subtitle: tab.documentId ? `Shared draft · ${tab.accessRole}` : 'Local draft',
      preview: stripHtml(tab.content || '').slice(0, 180) || tab.title,
      type: 'tab',
      tabId: tab.id,
    })),
    ...sharedDocuments.map((document) => ({
      id: `shared-${document.id}`,
      title: document.title,
      subtitle: `${document.ownerEmail} · ${document.accessRole}`,
      preview: `${document.title}\n${document.ownerEmail}`,
      type: 'shared',
      documentId: document.id,
      folderId: document.folderId ?? null,
    })),
  ].slice(0, 8);

  const launcherFolders = useMemo(
    () =>
      folders.map((folder) => ({
        ...folder,
        documents: sharedDocuments
          .filter((document) => document.folderId === folder.id)
          .map((document) => ({
            id: document.id,
            title: document.title,
            subtitle: `${document.ownerEmail} · ${document.accessRole}`,
            documentId: document.id,
          })),
      })),
    [folders, sharedDocuments]
  );

  const handleOpenLauncherRecent = (item) => {
    setShowLauncher(false);
    if (item.type === 'shared' && item.documentId) {
      handleOpenSharedDocument(item.documentId);
      return;
    }
    if (item.type === 'tab' && item.tabId) {
      handleSelectTab(item.tabId);
    }
  };

  const handleOpenLauncherFolderDocument = (item) => {
    setShowLauncher(false);
    if (item.documentId) {
      handleOpenSharedDocument(item.documentId);
    }
  };

  const commentTabOptions = useMemo(
    () =>
      visibleTabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
      })),
    [visibleTabs]
  );

  return (
    <div className="app-shell">
      <Topbar
        docTitle={docTitle}
        menu={menu}
        setMenu={setMenu}
        status={status}
        users={users}
        members={acceptedMembers}
        hasSharedDocument={Boolean(activeDocumentId)}
        profile={profile}
        onLogout={logout}
        onLogin={() => setShowLogin(true)}
        onShare={handleShare}
        onRename={handleRename}
        onNewDoc={handleNewDoc}
        onOpenTab={handleOpenTab}
        onDuplicateTab={handleDuplicateTab}
        onMoveTab={handleMoveTab}
        onDeleteTab={handleDeleteTab}
        onWordCount={handleWordCount}
        onFullscreen={handleFullscreen}
        onEmail={handleEmail}
        onExportPdf={handleExportPdf}
        onDetails={handleDetails}
        onOffline={handleOffline}
        onLanguage={handleLanguage}
        onPageSetup={handlePageSetup}
        onNotify={notify}
        onOpenLauncher={() => setShowLauncher(true)}
        onVersionHistory={handleVersionHistory}
        onClearFormatting={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
        onInsertLink={setLink}
        onAddComment={addManualComment}
        onToggleSidebar={() => setShowSidebar((prev) => !prev)}
        onToggleRuler={() => setShowRuler((prev) => !prev)}
        onToggleComments={() => setShowComments((prev) => !prev)}
        showSidebar={showSidebar}
        showRuler={showRuler}
        showComments={showComments}
        showTopbar={isTopbarVisible}
      />

      <DocsToolbar
        editor={editor}
        zoom={zoom}
        headingValue={headingValue}
        fontFamily={fontFamily}
        fontSize={fontSize}
        lineHeight={lineHeight}
        textColor={textColor}
        fonts={FONTS}
        fontSizes={FONT_SIZES}
        zoomLevels={ZOOM_LEVELS}
        colorPalette={COLOR_PALETTE}
        onZoomChange={handleZoomChange}
        onFontFamilyChange={handleFontFamilyChange}
        onFontSizeChange={handleFontSizeChange}
        onLineHeightChange={handleLineHeightChange}
        onTextColorChange={applyTextColor}
        onSearch={handleSearch}
        onExportPdf={handleExportPdf}
        onInsertImage={handleInsertImage}
        onSetLink={setLink}
        onAddComment={addManualComment}
        onIndent={handleIndent}
        onOutdent={handleOutdent}
        onToggleTopbar={() => setShowTopbar((prev) => !prev)}
        showTopbar={isTopbarVisible}
      />

      <div
        className={`workspace ${showSidebar ? '' : 'no-sidebar'} ${
          showComments ? '' : 'no-comments'
        }`}
      >
        {showSidebar && (
          <Sidebar
            tabs={visibleTabs}
            activeTabId={activeTabId}
            headings={headings}
            folders={folders}
            sharedDocuments={visibleSharedDocuments}
            activeDocumentId={activeDocumentId}
            currentFolderId={currentFolderId}
            activeAccessRole={activeAccessRole}
            collapsedFolderIds={collapsedFolderIds}
            onAddTab={handleAddTab}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onDragDocument={handleDragDocument}
            onDropDocument={handleDropDocument}
            onRenameFolder={handleRenameFolder}
            onMoveActiveDocument={handleMoveActiveDocument}
            onSelectTab={handleSelectTab}
            onOpenSharedDocument={handleOpenSharedDocument}
            onToggleFolder={handleToggleFolder}
            onSelectHeading={(pos) =>
              editor?.chain().focus().setTextSelection(pos).run()
            }
          />
        )}

        <main className="canvas">
          {showRuler && (
            <div className="ruler">
              {Array.from({ length: 18 }).map((_, index) => (
                <span key={index} className="ruler-tick">
                  {index + 1}
                </span>
              ))}
            </div>
          )}
          <div
            className="page"
            style={{ transform: `scale(${zoom / 100})`, lineHeight }}
            onMouseLeave={() => setShowEmojiPicker(false)}
          >
            <div className="page-toolbar">
              <button
                type="button"
                className="chip chip-button"
                onClick={() => handleApplyQuickTemplate('meeting')}
              >
                Meeting notes
              </button>
              <button
                type="button"
                className="chip chip-button"
                onClick={() => handleApplyQuickTemplate('email')}
              >
                Email draft
              </button>
              <span className="chip">
                {activeDocumentId ? `Access: ${activeAccessRole}` : 'Private draft'}
              </span>
            </div>
            <div className="page-corner-tools">
              <button
                type="button"
                className="page-corner-button"
                onClick={addManualComment}
                title="Add comment"
              >
                +
              </button>
              <button
                type="button"
                className={`page-corner-button ${showEmojiPicker ? 'active' : ''}`}
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                title="Add reaction"
              >
                :)
              </button>
              {showEmojiPicker && (
                <div className="emoji-picker">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="emoji-option"
                      onClick={() => addReactionComment(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {showCommentComposer && (
              <div className="page-comment-popover">
                <CommentComposerModal
                  profile={profile}
                  initialValue={commentDraft}
                  onClose={() => {
                    setShowCommentComposer(false);
                    setCommentDraft('');
                  }}
                  onSubmit={handleCommentSubmit}
                />
              </div>
            )}
            <EditorContent editor={editor} className="editor" />
            {!editor && <div className="loading">Loading editor...</div>}
          </div>
        </main>

        {showComments && (
          <CommentsPanel
            commentTab={commentTab}
            commentQuery={commentQuery}
            commentTypeFilter={commentTypeFilter}
            commentTabFilter={commentTabFilter}
            comments={filteredComments}
            notificationCount={unreadNotificationComments.length}
            notificationsActive={showNotificationsOnly}
            tabOptions={commentTabOptions}
            currentUser={profile || user}
            onChangeTab={setCommentTab}
            onChangeQuery={setCommentQuery}
            onChangeTypeFilter={setCommentTypeFilter}
            onChangeTabFilter={setCommentTabFilter}
            onToggleNotifications={handleToggleNotifications}
            onAddComment={addManualComment}
            onRestoreSnapshot={restoreSnapshot}
            onDeleteComment={handleDeleteComment}
            onCopyCommentLink={handleCopyCommentLink}
            onClose={() => setShowComments(false)}
          />
        )}
      </div>

      <Footer roomName={ROOM_NAME} wsUrl={WS_URL} users={users} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {showLauncher && (
        <DocLauncherPanel
          folders={launcherFolders}
          recentDocuments={recentDocuments}
          onClose={() => setShowLauncher(false)}
          onCreateBlank={() => {
            handleNewDoc();
            setShowLauncher(false);
          }}
          onOpenFolderDocument={handleOpenLauncherFolderDocument}
          onOpenRecent={handleOpenLauncherRecent}
        />
      )}

      {activeInvite && (
        <InviteModal
          invite={activeInvite}
          profile={profile}
          onClose={() => {
            setDismissedInviteToken(activeInvite.token);
            setActiveInvite(null);
            if (inviteToken) {
              clearInviteQuery();
            }
          }}
          onAccept={handleAcceptInvite}
          onLogin={() => setShowLogin(true)}
        />
      )}

      {showVersions && (
        <VersionHistoryModal
          title={docTitle}
          versions={versions}
          currentContent={editor?.getHTML() || activeTab?.content || ''}
          onClose={() => setShowVersions(false)}
          onRestore={handleRestoreVersion}
        />
      )}

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSubmit={handleLogin}
          onGoogleLogin={handleGoogleLogin}
        />
      )}

      {showShare && (
        <ShareModal
          title={docTitle}
          initialRole="edit"
          onClose={() => setShowShare(false)}
          onSubmit={handleShareSubmit}
        />
      )}

      {folderDialog && (
        <FolderDialog
          mode={folderDialog.mode}
          value={folderDialog.value}
          folderName={folderDialog.folder?.name || folderDialog.value}
          onChange={(value) => setFolderDialog((prev) => ({ ...prev, value }))}
          onClose={() => setFolderDialog(null)}
          onConfirm={handleFolderDialogConfirm}
        />
      )}
    </div>
  );
}

export default DocumentPage;
