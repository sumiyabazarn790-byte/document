
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
import './App.css';

const COLORS = [
  '#1a73e8',
  '#e8710a',
  '#188038',
  '#9334e6',
  '#d93025',
  '#0f9d58',
];

const NAMES = [
  'Ari',
  'Bata',
  'Saruul',
  'Naraa',
  'Temuujin',
  'Selenge',
  'Altan',
  'Zaya',
];

const FONTS = [
  'Arial',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
];

const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32];
const ZOOM_LEVELS = [50, 75, 90, 100, 110, 125, 150, 200];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';
const ROOM_NAME = import.meta.env.VITE_DOC_ROOM || 'demo-document';

const tabsKey = `doc:tabs:${ROOM_NAME}`;
const activeTabKey = `doc:activeTab:${ROOM_NAME}`;
const getDraftKey = (tabId) => `doc:draft:${ROOM_NAME}:${tabId}`;
const getHistoryKey = (tabId) => `doc:history:${ROOM_NAME}:${tabId}`;
const userKey = 'doc:user';

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

function App() {
  const guestUser = useMemo(
    () => ({ name: pick(NAMES), color: pick(COLORS) }),
    []
  );
  const [profile, setProfile] = useState(() => {
    const raw = localStorage.getItem(userKey);
    return raw ? JSON.parse(raw) : null;
  });
  const user = profile || guestUser;

  const [status, setStatus] = useState('connecting');
  const [users, setUsers] = useState([]);
  const [headings, setHeadings] = useState([]);
  const [docTitle, setDocTitle] = useState('Untitled document');
  const [menu, setMenu] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showRuler, setShowRuler] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [tabs, setTabs] = useState(() => {
    const raw = localStorage.getItem(tabsKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed;
        }
      } catch (error) {
        console.error('Failed to parse tabs', error);
      }
    }
    return [{ id: crypto.randomUUID(), title: 'Tab 1' }];
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
  const [zoom, setZoom] = useState(100);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(12);
  const [lineHeight, setLineHeight] = useState('1.6');
  const [textColor, setTextColor] = useState('#1f1f1f');

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
  const draftKey = useMemo(
    () => (activeTabId ? getDraftKey(activeTabId) : null),
    [activeTabId]
  );
  const historyKey = useMemo(
    () => (activeTabId ? getHistoryKey(activeTabId) : null),
    [activeTabId]
  );

  const roomName = activeTabId ? `${ROOM_NAME}-${activeTabId}` : ROOM_NAME;
  const ydoc = useMemo(() => new Y.Doc(), [activeTabId]);
  const provider = useMemo(
    () => new WebsocketProvider(WS_URL, roomName, ydoc),
    [WS_URL, roomName, ydoc]
  );

  const lastSavedRef = useRef('');
  const autosaveTimer = useRef(null);

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
  }, [activeTab?.title]);

  useEffect(() => {
    const handleStatus = (event) => setStatus(event.status);
    provider.on('status', handleStatus);
    return () => provider.off('status', handleStatus);
  }, [provider]);

  useEffect(() => {
    provider.awareness.setLocalStateField('user', user);
  }, [provider, user]);

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

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
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
      editorProps: {
        attributes: {
          class: 'editor-content',
        },
      },
    },
    [activeTabId]
  );

  useEffect(() => {
    if (!editor || !draftKey) return undefined;

    const saved = localStorage.getItem(draftKey);
    if (saved !== null) {
      editor.commands.setContent(saved);
      lastSavedRef.current = saved;
    } else {
      editor.commands.setContent('');
      lastSavedRef.current = '';
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
  }, [editor, draftKey]);

  useEffect(() => {
    if (!editor || !draftKey || !historyKey || !activeTabId) return undefined;

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
        localStorage.setItem(draftKey, currentHtml);
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTabId ? { ...tab, content: currentHtml } : tab
          )
        );
      }, 1500);
    };

    editor.on('update', handleUpdate);
    return () => editor.off('update', handleUpdate);
  }, [editor, comments, user.name, draftKey, historyKey, activeTabId]);

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
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  const withClose = (action) => () => {
    action?.();
    setMenu(null);
  };

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

  const handleRename = () => {
    const next = window.prompt('Rename document', activeTab?.title || docTitle);
    if (!next) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, title: trimmed } : tab
      )
    );
    setDocTitle(trimmed);
  };

  const handleNewDoc = () => {
    if (!activeTabId) return;
    editor?.commands.setContent('');
    localStorage.setItem(getDraftKey(activeTabId), '');
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, content: '', title: 'Untitled document' }
          : tab
      )
    );
    setDocTitle('Untitled document');
  };

  const handleAddTab = () => {
    const nextIndex = tabs.length + 1;
    const newTab = { id: crypto.randomUUID(), title: `Tab ${nextIndex}` };
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
    if (activeTabId && editor) {
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

  const handleWordCount = () => {
    if (!editor) return;
    const text = editor.getText().trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    window.alert(`Words: ${words}\nCharacters: ${chars}`);
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
    if (!name) return;
    const next = {
      name,
      email,
      color: pick(COLORS),
    };
    setProfile(next);
    localStorage.setItem(userKey, JSON.stringify(next));
    setShowLogin(false);
  };

  const handleLogout = () => {
    setProfile(null);
    localStorage.removeItem(userKey);
  };

  const addManualComment = () => {
    if (!editor || !historyKey) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, ' ');
    const note = window.prompt('Add a comment', selected || '');
    if (!note) return;
    const entry = {
      id: crypto.randomUUID(),
      author: user.name,
      createdAt: new Date().toISOString(),
      preview: note.slice(0, 140),
      snapshot: null,
      type: 'comment',
    };
    const next = [entry, ...comments].slice(0, 50);
    setComments(next);
    localStorage.setItem(historyKey, JSON.stringify(next));
  };

  const restoreSnapshot = (snapshot) => {
    if (!snapshot || !editor) return;
    editor.commands.setContent(snapshot);
  };

  const handleSearch = () => {
    const term = window.prompt('Search', '');
    if (!term) return;
    window.find(term);
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
      id: crypto.randomUUID(),
      title: `${activeTab?.title || 'Tab'} copy`,
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
      const fresh = { id: crypto.randomUUID(), title: 'Tab 1' };
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
    setShowComments(true);
    setCommentTypeFilter('history');
    setCommentTab('all');
  };

  const handleOffline = () => {
    localStorage.setItem(`doc:offline:${ROOM_NAME}`, 'true');
    window.alert('Offline mode enabled (local only).');
  };

  const handleDetails = () => {
    if (!editor) return;
    const text = editor.getText().trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    window.alert(
      `Title: ${docTitle}\nTabs: ${tabs.length}\nWords: ${words}\nCharacters: ${chars}`
    );
  };

  const handleEmail = () => {
    if (!editor) return;
    const body = encodeURIComponent(editor.getText().slice(0, 500));
    window.location.href = `mailto:?subject=${encodeURIComponent(
      docTitle
    )}&body=${body}`;
  };

  const handlePageSetup = () => {
    const next = window.prompt('Line spacing (e.g. 1.2, 1.6, 2.0)', lineHeight);
    if (!next) return;
    setLineHeight(next);
  };

  const handleLanguage = () => {
    window.alert('Language settings coming soon.');
  };

  const handleShortcut = () => {
    window.alert('Shortcut added (demo).');
  };

  const handleSecurity = () => {
    window.alert('Security limitations: demo mode.');
  };

  const filteredComments = comments.filter((comment) => {
    const matchesTab =
      commentTab === 'all' ? true : comment.author === user.name;
    const matchesType =
      commentTypeFilter === 'all' ? true : comment.type === commentTypeFilter;
    const matchesQuery = commentQuery
      ? comment.preview.toLowerCase().includes(commentQuery.toLowerCase())
      : true;
    const matchesTabFilter = commentTabFilter === 'all' ? true : true;
    return matchesTab && matchesType && matchesQuery && matchesTabFilter;
  });

  const headingValue = editor?.isActive('heading', { level: 1 })
    ? 'h1'
    : editor?.isActive('heading', { level: 2 })
    ? 'h2'
    : editor?.isActive('heading', { level: 3 })
    ? 'h3'
    : 'paragraph';

  const MenuItem = ({ icon, label, shortcut, onClick, submenu }) => (
    <button className="menu-item" onClick={withClose(onClick)}>
      {icon && <span className="menu-icon">{icon}</span>}
      <span className="menu-label">{label}</span>
      {shortcut && <span className="menu-shortcut">{shortcut}</span>}
      {submenu && <span className="menu-arrow">{'>'}</span>}
    </button>
  );

  const Menu = ({ id, label, children }) => (
    <div
      className="menu"
      onMouseEnter={() => setMenu(id)}
      onMouseLeave={() => setMenu(null)}
    >
      <button
        className={`ghost menu-button ${menu === id ? 'active' : ''}`}
        onClick={() => setMenu(menu === id ? null : id)}
      >
        {label}
      </button>
      {menu === id && <div className="menu-dropdown">{children}</div>}
    </div>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="doc-icon" aria-hidden />
          <div>
            <div className="doc-title">{docTitle}</div>
            <div className="doc-actions">
              <Menu id="file" label="File">
                <MenuItem icon="📄" label="New" onClick={handleAddTab} submenu />
                <MenuItem
                  icon="📂"
                  label="Open"
                  shortcut="Ctrl+O"
                  onClick={handleOpenTab}
                />
                <MenuItem icon="📑" label="Make a copy" onClick={handleDuplicateTab} />
                <div className="menu-sep" />
                <MenuItem icon="👤" label="Share" onClick={() => setShowLogin(true)} submenu />
                <MenuItem icon="✉" label="Email" onClick={handleEmail} submenu />
                <MenuItem icon="⬇" label="Download" onClick={() => window.print()} submenu />
                <div className="menu-sep" />
                <MenuItem icon="✏" label="Rename" onClick={handleRename} />
                <MenuItem icon="📁" label="Move" onClick={handleMoveTab} />
                <MenuItem
                  icon="➕"
                  label="Add shortcut to Drive"
                  onClick={handleShortcut}
                />
                <MenuItem icon="🗑" label="Move to bin" onClick={handleDeleteTab} />
                <div className="menu-sep" />
                <MenuItem
                  icon="🕘"
                  label="Version history"
                  onClick={handleVersionHistory}
                  submenu
                />
                <MenuItem icon="✅" label="Make available offline" onClick={handleOffline} />
                <div className="menu-sep" />
                <MenuItem icon="ℹ" label="Details" onClick={handleDetails} />
                <MenuItem icon="🔒" label="Security limitations" onClick={handleSecurity} />
                <MenuItem icon="🌐" label="Language" onClick={handleLanguage} submenu />
                <MenuItem icon="📄" label="Page setup" onClick={handlePageSetup} submenu />
                <MenuItem icon="🖨" label="Print" onClick={() => window.print()} submenu />
              </Menu>

              <Menu id="edit" label="Edit">
                <button
                  className="menu-item"
                  onClick={withClose(() => editor?.chain().focus().undo().run())}
                >
                  Undo
                </button>
                <button
                  className="menu-item"
                  onClick={withClose(() => editor?.chain().focus().redo().run())}
                >
                  Redo
                </button>
                <div className="menu-sep" />
                <button
                  className="menu-item"
                  onClick={withClose(() => editor?.chain().focus().selectAll().run())}
                >
                  Select all
                </button>
              </Menu>

              <Menu id="view" label="View">
                <button
                  className="menu-item"
                  onClick={withClose(() => setShowSidebar((prev) => !prev))}
                >
                  {showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                </button>
                <button
                  className="menu-item"
                  onClick={withClose(() => setShowRuler((prev) => !prev))}
                >
                  {showRuler ? 'Hide ruler' : 'Show ruler'}
                </button>
                <button
                  className="menu-item"
                  onClick={withClose(() => setShowComments((prev) => !prev))}
                >
                  {showComments ? 'Hide comments' : 'Show comments'}
                </button>
                <div className="menu-sep" />
                <button className="menu-item" onClick={withClose(handleFullscreen)}>
                  Toggle fullscreen
                </button>
              </Menu>

              <Menu id="insert" label="Insert">
                <button
                  className="menu-item"
                  onClick={withClose(() =>
                    editor
                      ?.chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run()
                  )}
                >
                  Table
                </button>
                <button className="menu-item" onClick={withClose(setLink)}>
                  Link
                </button>
                <button
                  className="menu-item"
                  onClick={withClose(() => editor?.chain().focus().toggleCodeBlock().run())}
                >
                  Code block
                </button>
              </Menu>

              <Menu id="format" label="Format">
                <button
                  className="menu-item"
                  onClick={withClose(() => editor?.chain().focus().toggleBold().run())}
                >
                  Bold
                </button>
                <button
                  className="menu-item"
                  onClick={withClose(() => editor?.chain().focus().toggleItalic().run())}
                >
                  Italic
                </button>
                <button
                  className="menu-item"
                  onClick={withClose(() => editor?.chain().focus().toggleUnderline().run())}
                >
                  Underline
                </button>
                <div className="menu-sep" />
                <button
                  className="menu-item"
                  onClick={withClose(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())}
                >
                  Heading 1
                </button>
                <button
                  className="menu-item"
                  onClick={withClose(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
                >
                  Heading 2
                </button>
                <button
                  className="menu-item"
                  onClick={withClose(() => editor?.chain().focus().toggleHeading({ level: 3 }).run())}
                >
                  Heading 3
                </button>
                <button
                  className="menu-item"
                  onClick={withClose(() => editor?.chain().focus().setParagraph().run())}
                >
                  Normal text
                </button>
              </Menu>

              <Menu id="tools" label="Tools">
                <button className="menu-item" onClick={withClose(handleWordCount)}>
                  Word count
                </button>
                <button className="menu-item" onClick={withClose(addManualComment)}>
                  Add comment
                </button>
                <button
                  className="menu-item"
                  onClick={withClose(() =>
                    editor?.chain().focus().clearNodes().unsetAllMarks().run()
                  )}
                >
                  Clear formatting
                </button>
              </Menu>

              <Menu id="extensions" label="Extensions">
                <button
                  className="menu-item"
                  onClick={withClose(() => window.alert('Extensions panel coming soon.'))}
                >
                  Manage extensions
                </button>
              </Menu>

              <Menu id="help" label="Help">
                <button
                  className="menu-item"
                  onClick={withClose(() =>
                    window.alert('Shortcuts:\nCtrl+B bold\nCtrl+I italic\nCtrl+U underline')
                  )}
                >
                  Keyboard shortcuts
                </button>
              </Menu>
            </div>
          </div>
        </div>
        <div className="topbar-right">
          <div className={`status-pill ${status}`}>
            <span className="status-dot" />
            {status}
          </div>
          <button
            className="share"
            onClick={() => (profile ? window.alert('Share dialog coming soon.') : setShowLogin(true))}
          >
            Share
          </button>
          {profile ? (
            <button className="avatar" onClick={handleLogout} title="Sign out">
              {profile.name.charAt(0).toUpperCase()}
            </button>
          ) : (
            <button className="login" onClick={() => setShowLogin(true)}>
              Sign in
            </button>
          )}
        </div>
      </header>

      <div className="docs-toolbar">
        <div className="toolbar-group">
          <button className="icon" onClick={handleSearch} title="Search">
            🔍
          </button>
          <button
            className="icon"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().chain().focus().undo().run()}
            title="Undo"
          >
            ↶
          </button>
          <button
            className="icon"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().chain().focus().redo().run()}
            title="Redo"
          >
            ↷
          </button>
          <button className="icon" onClick={() => window.print()} title="Print">
            🖨
          </button>
          <button
            className="icon"
            onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
            title="Clear formatting"
          >
            A
          </button>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <button
            className="icon"
            onClick={() => handleZoomChange(Math.max(50, zoom - 10))}
          >
            -
          </button>
          <select
            className="pill select"
            value={zoom}
            onChange={(event) => handleZoomChange(event.target.value)}
          >
            {ZOOM_LEVELS.map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
          <button
            className="icon"
            onClick={() => handleZoomChange(Math.min(200, zoom + 10))}
          >
            +
          </button>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <select
            className="pill select"
            value={headingValue}
            onChange={(event) => {
              const value = event.target.value;
              if (!editor) return;
              if (value === 'paragraph') {
                editor.chain().focus().setParagraph().run();
              } else if (value === 'h1') {
                editor.chain().focus().toggleHeading({ level: 1 }).run();
              } else if (value === 'h2') {
                editor.chain().focus().toggleHeading({ level: 2 }).run();
              } else if (value === 'h3') {
                editor.chain().focus().toggleHeading({ level: 3 }).run();
              }
            }}
          >
            <option value="paragraph">Normal text</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
          <select
            className="pill select"
            value={fontFamily}
            onChange={(event) => handleFontFamilyChange(event.target.value)}
          >
            {FONTS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
          <div className="font-size">
            <button className="icon" onClick={() => handleFontSizeChange(fontSize - 1)}>
              -
            </button>
            <select
              className="pill select"
              value={fontSize}
              onChange={(event) => handleFontSizeChange(event.target.value)}
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <button className="icon" onClick={() => handleFontSizeChange(fontSize + 1)}>
              +
            </button>
          </div>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <button
            className={`icon ${editor?.isActive('bold') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </button>
          <button
            className={`icon ${editor?.isActive('italic') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </button>
          <button
            className={`icon ${editor?.isActive('underline') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <span className="underline">U</span>
          </button>
          <input
            className="color-input"
            type="color"
            value={textColor}
            onChange={(event) => {
              setTextColor(event.target.value);
              editor?.chain().focus().setColor(event.target.value).run();
            }}
            title="Text color"
          />
          <button
            className={`icon ${editor?.isActive('highlight') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleHighlight({ color: '#ffe082' }).run()}
          >
            ✎
          </button>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <button className="icon" onClick={setLink} title="Link">
            🔗
          </button>
          <button className="icon" onClick={addManualComment} title="Comment">
            💬
          </button>
          <button className="icon" onClick={handleInsertImage} title="Insert image">
            🖼
          </button>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <button
            className={`icon ${editor?.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          >
            ⬚
          </button>
          <button
            className={`icon ${editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          >
            ▤
          </button>
          <button
            className={`icon ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          >
            ▣
          </button>
          <button
            className={`icon ${editor?.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
          >
            ☰
          </button>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <select
            className="pill select"
            value={lineHeight}
            onChange={(event) => handleLineHeightChange(event.target.value)}
          >
            <option value="1.2">1.2</option>
            <option value="1.4">1.4</option>
            <option value="1.6">1.6</option>
            <option value="1.8">1.8</option>
            <option value="2">2.0</option>
          </select>
          <button
            className={`icon ${editor?.isActive('taskList') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
          >
            ☑
          </button>
          <button
            className={`icon ${editor?.isActive('bulletList') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            •
          </button>
          <button
            className={`icon ${editor?.isActive('orderedList') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            1.
          </button>
          <button className="icon" onClick={handleOutdent} title="Outdent">
            ⇤
          </button>
          <button className="icon" onClick={handleIndent} title="Indent">
            ⇥
          </button>
          <button
            className={`icon ${editor?.isActive('codeBlock') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          >
            {'</>'}
          </button>
        </div>
      </div>

      <div
        className={`workspace ${showSidebar ? '' : 'no-sidebar'} ${
          showComments ? '' : 'no-comments'
        }`}
      >
        {showSidebar && (
          <aside className="sidebar">
            <div className="sidebar-header">
              <span>Document tabs</span>
              <button className="icon" onClick={handleAddTab}>
                +
              </button>
            </div>
            <div className="tabs-list">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab doc-tab ${tab.id === activeTabId ? 'active' : ''}`}
                  onClick={() => handleSelectTab(tab.id)}
                >
                  <span className="tab-dot" />
                  {tab.title}
                </button>
              ))}
            </div>
            <div className="sidebar-divider" />
            <div className="sidebar-header">
              <span>Document outline</span>
            </div>
            {headings.length === 0 && (
              <p className="sidebar-hint">
                Headings that you add to the document will appear here.
              </p>
            )}
            {headings.map((heading) => (
              <button
                key={heading.id}
                className={`tab heading level-${heading.level}`}
                onClick={() => editor?.chain().focus().setTextSelection(heading.pos).run()}
              >
                {heading.text}
              </button>
            ))}
          </aside>
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
          >
            <div className="page-toolbar">
              <span className="chip">Meeting notes</span>
              <span className="chip">Email draft</span>
              <span className="chip">More</span>
            </div>
            <EditorContent editor={editor} className="editor" />
            {!editor && <div className="loading">Loading editor…</div>}
          </div>
        </main>

        {showComments && (
          <aside className="comments-panel">
            <div className="comments-top">
              <div className="comments-title">Comments</div>
              <div className="comments-actions">
                <button className="icon ghost" title="Notifications">
                  🔔
                </button>
                <button
                  className="icon ghost"
                  title="Close"
                  onClick={() => setShowComments(false)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="comments-tabs">
              <button
                className={`tab-button ${commentTab === 'all' ? 'active' : ''}`}
                onClick={() => setCommentTab('all')}
              >
                All comments
              </button>
              <button
                className={`tab-button ${commentTab === 'forYou' ? 'active' : ''}`}
                onClick={() => setCommentTab('forYou')}
              >
                For you
              </button>
              <div className="comments-search">
                <input
                  value={commentQuery}
                  onChange={(event) => setCommentQuery(event.target.value)}
                  placeholder="Search"
                />
              </div>
            </div>
            <div className="comments-filters">
              <select
                className="pill select"
                value={commentTypeFilter}
                onChange={(event) => setCommentTypeFilter(event.target.value)}
              >
                <option value="all">All types</option>
                <option value="comment">Comments</option>
                <option value="history">History</option>
              </select>
              <select
                className="pill select"
                value={commentTabFilter}
                onChange={(event) => setCommentTabFilter(event.target.value)}
              >
                <option value="all">All tabs</option>
                <option value="tab1">Tab 1</option>
              </select>
              <button className="pill" onClick={addManualComment}>
                Add
              </button>
            </div>
            <div className="comments-list">
              {filteredComments.length === 0 && (
                <p className="sidebar-hint">No comments yet.</p>
              )}
              {filteredComments.map((comment) => (
                <div key={comment.id} className="comment-card">
                  <div className="comment-meta">
                    <strong>{comment.author}</strong>
                    <span>{new Date(comment.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="comment-text">{comment.preview}</p>
                  {comment.type === 'history' && comment.snapshot && (
                    <button
                      className="ghost restore"
                      onClick={() => restoreSnapshot(comment.snapshot)}
                    >
                      Restore version
                    </button>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      <footer className="footer">
        <div>Room: {ROOM_NAME}</div>
        <div>WebSocket: {WS_URL}</div>
        <div className="presence">
          {users.map((u, index) => (
            <span
              key={`${u?.name || 'user'}-${index}`}
              className="presence-dot"
              title={u?.name}
              style={{ background: u?.color || '#999' }}
            />
          ))}
          <span>{users.length} active</span>
        </div>
      </footer>

      {showLogin && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal">
            <h2>Sign in</h2>
            <p>Enter your name to join this document.</p>
            <form onSubmit={handleLogin}>
              <label>
                Name
                <input name="name" required placeholder="Your name" />
              </label>
              <label>
                Email (optional)
                <input name="email" type="email" placeholder="you@example.com" />
              </label>
              <div className="modal-actions">
                <button type="button" className="ghost" onClick={() => setShowLogin(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Sign in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
