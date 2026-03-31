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
import OpenTabModal from '../components/OpenTabModal';
import RenameModal from '../components/RenameModal';
import FindModal from '../components/FindModal';
import PasteModal from '../components/PasteModal';
import LinkModal from '../components/LinkModal';
import LanguageModal from '../components/LanguageModal';
import ClearAllModal from '../components/ClearAllModal';
import ImageModal from '../components/ImageModal';
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
import { useI18n } from '../i18n/i18n';
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

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-width') || element.style.width || null,
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {};
          }
          return {
            'data-width': attributes.width,
            style: `width: ${attributes.width};`,
          };
        },
      },
    };
  },
});

const buildQuickTemplates = (t) => ({
  meeting: {
    title: t('template_meeting_title'),
    content: `
      <h2>${t('template_meeting_heading')}</h2>
      <p><strong>${t('template_date_label')}</strong> </p>
      <p><strong>${t('template_attendees_label')}</strong> </p>
      <h2>${t('template_agenda_heading')}</h2>
      <ul>
        <li></li>
        <li></li>
        <li></li>
      </ul>
      <h2>${t('template_key_decisions_heading')}</h2>
      <ul>
        <li></li>
      </ul>
      <h2>${t('template_action_items_heading')}</h2>
      <ul>
        <li></li>
      </ul>
    `,
  },
  email: {
    title: t('template_email_title'),
    content: `
      <p>${t('template_subject_label')} </p>
      <p>${t('template_greeting')}</p>
      <p></p>
      <p></p>
      <p>${t('template_closing')}</p>
      <p></p>
    `,
  },
});

const REACTION_EMOJIS = [
  '👍', '❤️', '🎉', '😄',
  '👏', '🔥', '😍', '🤔',
  '😂', '✅', '🚀', '✨',
];

function DocumentPage() {
  const { t } = useI18n();
  const { profile, user, loginWithEmail, loginWithGoogle, logout } = useAuthProfile();
  const quickTemplates = useMemo(() => buildQuickTemplates(t), [t]);

  const [status, setStatus] = useState('connecting');
  const [users, setUsers] = useState([]);
  const [headings, setHeadings] = useState([]);
  const [docTitle, setDocTitle] = useState(() => t('untitled_document'));
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
  const [showOpenTab, setShowOpenTab] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameTargetId, setRenameTargetId] = useState(null);
  const [showFind, setShowFind] = useState(false);
  const [findDraft, setFindDraft] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [pasteDraft, setPasteDraft] = useState('');
  const [showImage, setShowImage] = useState(false);
  const [imageDraft, setImageDraft] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkPrevious, setLinkPrevious] = useState('');
  const [showLanguage, setShowLanguage] = useState(false);
  const [showClearAll, setShowClearAll] = useState(false);
  const [showMoveTab, setShowMoveTab] = useState(false);
  const [moveTabDraft, setMoveTabDraft] = useState('1');
  const [showDeleteTab, setShowDeleteTab] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
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
    return [createLocalTab(t('tab_label', { index: 1 }))];
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
  const stylePrefsKey = `doc:style-prefs:${ROOM_NAME}`;
  const [fontFamily, setFontFamily] = useState(() => {
    if (typeof window === 'undefined') return 'Arial';
    try {
      const raw = localStorage.getItem(stylePrefsKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.fontFamily || 'Arial';
    } catch (error) {
      return 'Arial';
    }
  });
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window === 'undefined') return 12;
    try {
      const raw = localStorage.getItem(stylePrefsKey);
      const parsed = raw ? JSON.parse(raw) : null;
      const size = Number(parsed?.fontSize);
      return Number.isFinite(size) && size > 0 ? size : 12;
    } catch (error) {
      return 12;
    }
  });
  const [lineHeight, setLineHeight] = useState(() => {
    if (typeof window === 'undefined') return '1.6';
    try {
      const raw = localStorage.getItem(stylePrefsKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.lineHeight || '1.6';
    } catch (error) {
      return '1.6';
    }
  });
  const [textColor, setTextColor] = useState(() => {
    if (typeof window === 'undefined') return '#1f1f1f';
    try {
      const raw = localStorage.getItem(stylePrefsKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.textColor || '#1f1f1f';
    } catch (error) {
      return '#1f1f1f';
    }
  });
  const [stickyMarks, setStickyMarks] = useState(() => {
    if (typeof window === 'undefined') return { bold: false, italic: false, underline: false };
    try {
      const raw = localStorage.getItem(stylePrefsKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.stickyMarks || { bold: false, italic: false, underline: false };
    } catch (error) {
      return { bold: false, italic: false, underline: false };
    }
  });
  const stickyTextColorRef = useRef(null);
  const stickyFontFamilyRef = useRef(fontFamily);
  const stickyFontSizeRef = useRef(fontSize);
  const stickyMarksRef = useRef(stickyMarks);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
  const deleteTargetTab = deleteTargetId
    ? tabs.find((tab) => tab.id === deleteTargetId)
    : activeTab;
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
  const accessLabels = useMemo(
    () => ({
      owner: t('access_owner'),
      edit: t('access_edit'),
      view: t('access_view'),
    }),
    [t]
  );
  const getAccessLabel = (role) => accessLabels[role] || role;
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
          title: t('toast_version_history_failed'),
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
          title: t('toast_invitation_unavailable'),
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
        ResizableImage.configure({ inline: false, allowBase64: true }),
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
    stickyMarksRef.current = stickyMarks;
  }, [stickyMarks]);

  useEffect(() => {
    stickyTextColorRef.current = textColor;
  }, [textColor]);

  useEffect(() => {
    stickyFontFamilyRef.current = fontFamily;
  }, [fontFamily]);

  useEffect(() => {
    stickyFontSizeRef.current = fontSize;
  }, [fontSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      textColor,
      fontFamily,
      fontSize,
      lineHeight,
      stickyMarks,
    };
    localStorage.setItem(stylePrefsKey, JSON.stringify(payload));
  }, [textColor, fontFamily, fontSize, lineHeight, stickyMarks, stylePrefsKey]);

  useEffect(() => {
    if (!editor) return undefined;

    const ensureStickyFormatting = () => {
      const sticky = stickyTextColorRef.current;
      if (!editor.state.selection.empty) return;
      if (sticky) {
        const currentColor = editor.getAttributes('textStyle')?.color;
        if (!currentColor || currentColor.toLowerCase() !== sticky.toLowerCase()) {
          editor.chain().focus().setColor(sticky).run();
        }
      }
      const stickyFamily = stickyFontFamilyRef.current;
      if (stickyFamily) {
        const currentFamily = editor.getAttributes('textStyle')?.fontFamily;
        if (!currentFamily || currentFamily !== stickyFamily) {
          editor.chain().focus().setFontFamily(stickyFamily).run();
        }
      }
      const stickySize = stickyFontSizeRef.current;
      if (stickySize) {
        const currentSize = editor.getAttributes('textStyle')?.fontSize;
        const desired = `${stickySize}px`;
        if (!currentSize || currentSize !== desired) {
          editor.chain().focus().setFontSize(desired).run();
        }
      }
      const { bold, italic, underline } = stickyMarksRef.current;
      if (editor.isActive('bold') !== bold) {
        editor.chain().focus().toggleBold().run();
      }
      if (editor.isActive('italic') !== italic) {
        editor.chain().focus().toggleItalic().run();
      }
      if (editor.isActive('underline') !== underline) {
        editor.chain().focus().toggleUnderline().run();
      }
    };

    editor.on('selectionUpdate', ensureStickyFormatting);
    editor.on('focus', ensureStickyFormatting);
    return () => {
      editor.off('selectionUpdate', ensureStickyFormatting);
      editor.off('focus', ensureStickyFormatting);
    };
  }, [editor]);

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
            text: node.textContent || t('untitled_heading'),
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
      showLauncher ||
      showLogin ||
      showShare ||
      showOpenTab ||
      showRename ||
      showFind ||
      showPaste ||
      showImage ||
      showLink ||
      showLanguage ||
      showClearAll ||
      showMoveTab ||
      showDeleteTab ||
      showCommentComposer ||
      Boolean(activeInvite);
    const lockForFolderDialog = Boolean(folderDialog);

    document.body.classList.toggle('app-modal-open', shouldLockScroll || lockForFolderDialog);
    document.documentElement.classList.toggle('app-modal-open', shouldLockScroll || lockForFolderDialog);

    return () => {
      document.body.classList.remove('app-modal-open');
      document.documentElement.classList.remove('app-modal-open');
    };
  }, [showLauncher, showLogin, showShare, showOpenTab, showRename, showFind, showPaste, showImage, showLink, showLanguage, showClearAll, showMoveTab, showDeleteTab, showCommentComposer, activeInvite, folderDialog]);

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href || '';
    setLinkPrevious(previousUrl);
    setLinkDraft(previousUrl);
    setShowLink(true);
  };

  const applyRename = (nextTitle, targetId = activeTabId) => {
    const trimmed = String(nextTitle || '').trim();
    if (!trimmed) return;

    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === targetId ? { ...tab, title: trimmed } : tab
      )
    );
    if (targetId === activeTabId) {
      setDocTitle(trimmed);
    }

    if (targetId === activeTabId && activeDocumentId && profile?.email) {
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
        notify({ type: 'error', title: t('toast_rename_failed'), message: error.message });
      });
    }
  };

  const handleRename = (nextTitle) => {
    if (typeof nextTitle === 'string') {
      applyRename(nextTitle);
      return;
    }
    setRenameTargetId(activeTabId);
    setRenameDraft(activeTab?.title || docTitle || t('untitled_document'));
    setShowRename(true);
  };

  const handleNewDoc = () => {
    const newTab = createLocalTab(t('untitled_document'));

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
    const newTab = createLocalTab(
      t('tab_label', { index: nextIndex }),
      activeProjectId || crypto.randomUUID()
    );
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
        notify({ type: 'error', title: t('toast_open_failed'), message: error.message });
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
          title: t('toast_invitation_accepted'),
          message: t('toast_invitation_accepted_message', { title: document.title }),
        });
        handleOpenSharedDocument(document.id);
      })
      .catch((error) => {
        console.error('Accept invite failed', error);
        notify({
          type: 'error',
          title: t('toast_accept_failed'),
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
      title: t('toast_document_stats'),
      message: t('toast_document_stats_message', { words, chars }),
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
          title: t('toast_login_failed'),
          message: t('toast_login_failed_message'),
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
        notify({ type: 'error', title: t('toast_google_failed'), message: error.message });
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
      preview: t('reaction_preview', { emoji }),
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
      title: t('toast_reaction_added'),
      message: t('toast_reaction_added_message', { emoji }),
    });
  };

  const handleClearHistory = () => {
    if (!historyKey) return;
    setShowClearAll(true);
  };

  const applyClearAll = () => {
    if (!historyKey) return;
    setComments([]);
    localStorage.setItem(historyKey, JSON.stringify([]));
    setShowClearAll(false);
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
      title: t('toast_comment_deleted'),
      message: t('toast_comment_deleted_message'),
    });
  };

  const handleCopyCommentLink = async (commentId) => {
    const url = `${window.location.origin}${window.location.pathname}#comment-${commentId}`;
    try {
      await navigator.clipboard.writeText(url);
      notify({
        type: 'success',
        title: t('toast_link_copied'),
        message: t('toast_link_copied_message'),
      });
    } catch (error) {
      console.error('Copy comment link failed', error);
      notify({
        type: 'error',
        title: t('toast_copy_failed'),
        message: t('toast_copy_failed_message'),
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
        title: t('toast_no_matches'),
        message: t('toast_no_matches_message', { value }),
      });
    }
  };

  const focusEditor = () => {
    if (!editor) {
      notify({
        type: 'info',
        title: t('toast_editor_not_ready'),
        message: t('toast_editor_not_ready_message'),
      });
      return false;
    }
    editor.chain().focus().run();
    return true;
  };

  const handleUndo = () => {
    if (!focusEditor()) return;
    editor.chain().focus().undo().run();
  };

  const handleRedo = () => {
    if (!focusEditor()) return;
    editor.chain().focus().redo().run();
  };

  const handleCut = () => {
    if (!focusEditor()) return;
    try {
      const ok = document.execCommand('cut');
      if (!ok) {
        throw new Error('Cut failed');
      }
    } catch (error) {
      console.error('Cut failed', error);
      notify({
        type: 'error',
        title: t('toast_cut_failed'),
        message: t('toast_cut_failed_message'),
      });
    }
  };

  const handleCopy = () => {
    if (!focusEditor()) return;
    try {
      const ok = document.execCommand('copy');
      if (!ok) {
        throw new Error('Copy failed');
      }
    } catch (error) {
      console.error('Copy failed', error);
      notify({
        type: 'error',
        title: t('toast_copy_action_failed'),
        message: t('toast_copy_action_failed_message'),
      });
    }
  };

  const handlePaste = async () => {
    if (!focusEditor()) return;
    setPasteDraft('');
    setShowPaste(true);
  };

  const handleFind = () => {
    setFindDraft('');
    setShowFind(true);
  };

  const handleZoomChange = (value) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    setZoom(next);
  };

  const handleFontFamilyChange = (value) => {
    setFontFamily(value);
    stickyFontFamilyRef.current = value;
    editor?.chain().focus().setFontFamily(value).run();
  };

  const handleFontSizeChange = (value) => {
    const next = Number(value);
    if (Number.isNaN(next) || next < 6) return;
    setFontSize(next);
    stickyFontSizeRef.current = next;
    editor?.chain().focus().setFontSize(`${next}px`).run();
  };

  const handleLineHeightChange = (value) => {
    setLineHeight(value);
  };

  const applyTextColor = (value) => {
    setTextColor(value);
    stickyTextColorRef.current = value;
    editor?.chain().focus().setColor(value).run();
  };

  const toggleStickyMark = (mark) => {
    if (!editor) return;
    setStickyMarks((prev) => {
      const next = { ...prev, [mark]: !prev[mark] };
      stickyMarksRef.current = next;
      return next;
    });
    if (mark === 'bold') {
      editor.chain().focus().toggleBold().run();
    } else if (mark === 'italic') {
      editor.chain().focus().toggleItalic().run();
    } else if (mark === 'underline') {
      editor.chain().focus().toggleUnderline().run();
    }
  };

  const handleToggleBold = () => toggleStickyMark('bold');
  const handleToggleItalic = () => toggleStickyMark('italic');
  const handleToggleUnderline = () => toggleStickyMark('underline');

  const handleInsertImage = () => {
    if (!editor) return;
    setImageDraft('');
    setShowImage(true);
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
    setShowOpenTab(true);
  };

  const handleDuplicateTab = () => {
    if (!activeTabId) return;
    const currentHtml =
      editor?.getHTML() || localStorage.getItem(getDraftKey(activeTabId)) || '';
    const newTab = {
      ...createLocalTab(
        t('tab_copy', { title: activeTab?.title || t('tab_default') }),
        activeProjectId || crypto.randomUUID()
      ),
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
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId);
    setMoveTabDraft(String(currentIndex >= 0 ? currentIndex + 1 : 1));
    setShowMoveTab(true);
  };

  const handleRenameTab = (tabId) => {
    const target = tabs.find((tab) => tab.id === tabId);
    if (!target) return;
    setRenameTargetId(tabId);
    setRenameDraft(target.title || t('untitled_document'));
    setShowRename(true);
  };

  const handleDeleteTab = (tabId = activeTabId) => {
    if (!tabId) return;
    setDeleteTargetId(tabId);
    setShowDeleteTab(true);
  };

  const handleDuplicateTabById = (tabId) => {
    const target = tabs.find((tab) => tab.id === tabId);
    if (!target) return;
    const sourceHtml =
      tabId === activeTabId && editor
        ? editor.getHTML()
        : target.content || localStorage.getItem(getDraftKey(tabId)) || '';
    const newTab = {
      ...createLocalTab(
        t('tab_copy', { title: target.title || t('tab_default') }),
        target.projectId || crypto.randomUUID()
      ),
      content: sourceHtml,
    };
    localStorage.setItem(getDraftKey(newTab.id), sourceHtml);
    localStorage.setItem(getHistoryKey(newTab.id), JSON.stringify([]));
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setDocTitle(newTab.title);
  };

  const applyMoveTab = () => {
    const index = Number(moveTabDraft);
    if (!index || index < 1 || index > tabs.length) {
      notify({
        type: 'error',
        title: t('toast_invalid_position'),
        message: t('toast_invalid_position_message', { count: tabs.length }),
      });
      return;
    }
    setTabs((prev) => {
      const next = [...prev];
      const currentIndex = next.findIndex((tab) => tab.id === activeTabId);
      if (currentIndex < 0) return next;
      const [moved] = next.splice(currentIndex, 1);
      next.splice(index - 1, 0, moved);
      return next;
    });
    setShowMoveTab(false);
  };

  const applyDeleteTab = (targetId = activeTabId) => {
    if (!targetId) return;
    localStorage.removeItem(getDraftKey(targetId));
    localStorage.removeItem(getHistoryKey(targetId));
    const remaining = tabs.filter((tab) => tab.id !== targetId);
    if (!remaining.length) {
      const fresh = createLocalTab(t('tab_label', { index: 1 }));
      localStorage.setItem(getDraftKey(fresh.id), '');
      localStorage.setItem(getHistoryKey(fresh.id), JSON.stringify([]));
      setTabs([fresh]);
      setActiveTabId(fresh.id);
      setShowDeleteTab(false);
      setDeleteTargetId(null);
      return;
    }
    setTabs(remaining);
    if (targetId === activeTabId) {
      const nextActive = remaining[0].id;
      setActiveTabId(nextActive);
    }
    setShowDeleteTab(false);
    setDeleteTargetId(null);
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
          title: t('toast_folder_created'),
          message: t('toast_folder_created_message', { name: folder.name }),
        });
      })
      .catch((error) => {
        console.error('Create folder failed', error);
        notify({
          type: 'error',
          title: t('toast_folder_failed'),
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
          title: t('toast_folder_renamed'),
          message: t('toast_folder_renamed_message', { name: updatedFolder.name }),
        });
      })
      .catch((error) => {
        console.error('Rename folder failed', error);
        notify({
          type: 'error',
          title: t('toast_rename_failed'),
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
          title: t('toast_folder_deleted'),
          message: t('toast_folder_deleted_message', { unfiled: t('sidebar_unfiled') }),
        });
      })
      .catch((error) => {
        console.error('Delete folder failed', error);
        notify({
          type: 'error',
          title: t('toast_delete_failed'),
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
        title: t('toast_folder_name_required'),
        message: t('toast_folder_name_required_message'),
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
        title: t('toast_owner_only'),
        message: t('toast_owner_only_message_move'),
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
          title: t('toast_moved_to_folder'),
          message: folderId
            ? t('toast_moved_to_folder_message')
            : t('toast_moved_to_unfiled_message', { unfiled: t('sidebar_unfiled') }),
        });
      })
      .catch((error) => {
        console.error('Move document failed', error);
        notify({
          type: 'error',
          title: t('toast_folder_move_failed'),
          message: error.message,
        });
      });
  };

  const handleDragDocument = (item) => {
    if (!item?.documentId) {
      notify({
        type: 'info',
        title: t('toast_share_first'),
        message: t('toast_share_first_message'),
      });
      return;
    }

    if (item?.accessRole && item.accessRole !== 'owner') {
      notify({
        type: 'info',
        title: t('toast_owner_only'),
        message: t('toast_owner_only_message_organize'),
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
          title: t('toast_document_moved'),
          message: folderId
            ? t('toast_document_moved_message')
            : t('toast_document_moved_message_unfiled', { unfiled: t('sidebar_unfiled') }),
        });
      })
      .catch((error) => {
        console.error('Drop move failed', error);
        notify({
          type: 'error',
          title: t('toast_drag_move_failed'),
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
          title: t('toast_version_restored'),
          message: t('toast_version_restored_message'),
        });
      })
      .catch((error) => {
        console.error('Restore version failed', error);
        notify({
          type: 'error',
          title: t('toast_restore_failed'),
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
        link.download = `${docTitle || t('document_default')}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        console.error('Export PDF failed', error);
        notify({
          type: 'error',
          title: t('toast_pdf_export_failed'),
          message: error.message,
        });
      });
  };

  const handleOffline = () => {
    localStorage.setItem(`doc:offline:${ROOM_NAME}`, 'true');
    notify({
      type: 'success',
      title: t('toast_offline_enabled'),
      message: t('toast_offline_enabled_message'),
    });
  };

  const handleDetails = () => {
    if (!editor) return;
    const text = editor.getText().trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    notify({
      type: 'info',
      title: docTitle,
      message: t('toast_document_details_message', {
        tabs: tabs.length,
        words,
        chars,
      }),
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
    setShowLanguage(true);
  };

  const handlePageSetup = () => {
    notify({
      type: 'info',
      title: t('toast_page_setup'),
      message: t('toast_page_setup_message'),
    });
  };

  const handleShare = () => {
    if (!profile?.email) {
      setShowLogin(true);
      return;
    }
    if (activeDocumentId && activeAccessRole === 'view') {
      notify({
        type: 'error',
        title: t('toast_view_only'),
        message: t('toast_view_only_message'),
      });
      return;
    }
    setShowShare(true);
  };

  const handleShareSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextTitle = String(form.get('title') || '').trim() || t('untitled_document');
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
        title: t('toast_gmail_only'),
        message: t('toast_gmail_only_message', { emails: invalidEmails.join(', ') }),
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
        const memberLabel = inviteCount === 1 ? t('member_single') : t('member_plural');
        const updatedMemberLabel = updatedMemberCount === 1 ? t('member_single') : t('member_plural');
        const updatedPart = updatedMemberCount
          ? ` ${t('toast_invitations_sent_updated', {
              count: updatedMemberCount,
              memberLabel: updatedMemberLabel,
            })}`
          : '';
        const message =
          inviteCount > 0
            ? t('toast_invitations_sent_invites', {
                count: inviteCount,
                memberLabel,
                updatedPart,
              })
            : t('toast_invitations_sent_updates_only', {
                count: updatedMemberCount,
                memberLabel: updatedMemberLabel,
              });
        notify({
          type: 'success',
          title: t('toast_invitations_sent'),
          message,
        });
      })
      .catch((error) => {
        console.error('Share failed', error);
        notify({ type: 'error', title: t('toast_share_failed'), message: error.message });
      });
  };

  const handleApplyQuickTemplate = (templateKey) => {
    const template = quickTemplates[templateKey];
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
      title: t('toast_template_applied', { title: template.title }),
      message: t('toast_template_applied_message'),
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
      subtitle: tab.documentId
        ? t('recent_shared_draft', { role: getAccessLabel(tab.accessRole) })
        : t('recent_local_draft'),
      preview: stripHtml(tab.content || '').slice(0, 180) || tab.title,
      type: 'tab',
      tabId: tab.id,
    })),
    ...sharedDocuments.map((document) => ({
      id: `shared-${document.id}`,
      title: document.title,
      subtitle: t('recent_shared_owner', {
        owner: document.ownerEmail,
        role: getAccessLabel(document.accessRole),
      }),
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
            subtitle: t('recent_shared_owner', {
              owner: document.ownerEmail,
              role: getAccessLabel(document.accessRole),
            }),
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
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onFind={handleFind}
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
        onToggleBold={handleToggleBold}
        onToggleItalic={handleToggleItalic}
        onToggleUnderline={handleToggleUnderline}
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
            onRenameTab={handleRenameTab}
            onDeleteTab={handleDeleteTab}
            onDuplicateTab={handleDuplicateTabById}
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
                {t('template_meeting_title')}
              </button>
              <button
                type="button"
                className="chip chip-button"
                onClick={() => handleApplyQuickTemplate('email')}
              >
                {t('template_email_title')}
              </button>
              <span className="chip">
                {activeDocumentId
                  ? t('access_label', { role: getAccessLabel(activeAccessRole) })
                  : t('private_draft')}
              </span>
            </div>
            <div className="page-corner-tools">
              <button
                type="button"
                className="page-corner-button"
                onClick={addManualComment}
                title={t('add_comment')}
              >
                +
              </button>
              <button
                type="button"
                className={`page-corner-button ${showEmojiPicker ? 'active' : ''}`}
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                title={t('add_reaction')}
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
            {!editor && <div className="loading">{t('loading_editor')}</div>}
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
            onClearHistory={handleClearHistory}
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

      {showLanguage && (
        <LanguageModal onClose={() => setShowLanguage(false)} />
      )}

      {showClearAll && (
        <ClearAllModal
          onClose={() => setShowClearAll(false)}
          onConfirm={applyClearAll}
        />
      )}

      {showRename && (
        <RenameModal
          value={renameDraft}
          onChange={setRenameDraft}
          onClose={() => {
            setShowRename(false);
            setRenameTargetId(null);
          }}
          onConfirm={() => {
            applyRename(renameDraft, renameTargetId || activeTabId);
            setShowRename(false);
            setRenameTargetId(null);
          }}
        />
      )}

      {showFind && (
        <FindModal
          value={findDraft}
          onChange={setFindDraft}
          onClose={() => setShowFind(false)}
          onConfirm={() => {
            handleSearch(findDraft);
            setShowFind(false);
          }}
        />
      )}

      {showPaste && (
        <PasteModal
          value={pasteDraft}
          onChange={setPasteDraft}
          onClose={() => setShowPaste(false)}
          onConfirm={() => {
            if (pasteDraft.trim()) {
              editor?.chain().focus().insertContent(pasteDraft).run();
              setShowPaste(false);
              setPasteDraft('');
            }
          }}
        />
      )}

      {showImage && (
        <ImageModal
          value={imageDraft}
          onChange={setImageDraft}
          onClose={() => setShowImage(false)}
          onConfirm={() => {
            const url = imageDraft.trim();
            if (!url) return;
            editor?.chain().focus().setImage({ src: url }).run();
            setShowImage(false);
            setImageDraft('');
          }}
        />
      )}

      {showLink && (
        <LinkModal
          value={linkDraft}
          previous={linkPrevious}
          onChange={setLinkDraft}
          onClose={() => setShowLink(false)}
          onRemove={() => {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run();
            setShowLink(false);
            setLinkDraft('');
          }}
          onConfirm={() => {
            const trimmed = linkDraft.trim();
            if (!trimmed) {
              editor?.chain().focus().extendMarkRange('link').unsetLink().run();
            } else {
              editor?.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
            }
            setShowLink(false);
            setLinkDraft('');
          }}
        />
      )}

      {showMoveTab && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal move-tab-modal">
            <div className="move-tab-copy">
              <h2>{t('move_tab_title')}</h2>
              <p>{t('move_tab_desc', { count: tabs.length })}</p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                applyMoveTab();
              }}
            >
              <label className="auth-field">
                {t('move_tab_label')}
                <input
                  type="number"
                  min="1"
                  max={tabs.length}
                  value={moveTabDraft}
                  onChange={(event) => setMoveTabDraft(event.target.value)}
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost auth-secondary"
                  onClick={() => setShowMoveTab(false)}
                >
                  {t('cancel')}
                </button>
                <button type="submit" className="primary auth-primary">
                  {t('move_tab_confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteTab && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal delete-tab-modal">
            <div className="delete-tab-copy">
              <h2>{t('delete_tab_title')}</h2>
              <p>
                {t('delete_tab_desc', { title: deleteTargetTab?.title || t('untitled_document') })}
              </p>
            </div>
            <div className="delete-tab-note">
              {t('delete_tab_note')}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost auth-secondary"
                onClick={() => {
                  setShowDeleteTab(false);
                  setDeleteTargetId(null);
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="primary auth-primary danger"
                onClick={() => applyDeleteTab(deleteTargetId || activeTabId)}
              >
                {t('delete_tab_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOpenTab && (
        <OpenTabModal
          tabs={tabs}
          activeTabId={activeTabId}
          onClose={() => setShowOpenTab(false)}
          onSelect={(tabId) => {
            handleSelectTab(tabId);
            setShowOpenTab(false);
          }}
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
