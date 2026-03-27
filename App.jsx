
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
  'Amatic SC',
  'Caveat',
  'Comfortaa',
  'Comic Sans MS',
  'Courier New',
  'EB Garamond',
  'Georgia',
  'Impact',
  'Lexend',
  'Lobster',
  'Lora',
  'Merriweather',
  'Montserrat',
  'Nunito',
  'Oswald',
  'Pacifico',
  'Playfair Display',
  'Times New Roman',
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

const replaceTextInHtml = (html, find, replace) => {
  if (!find) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue && node.nodeValue.includes(find)) {
      node.nodeValue = node.nodeValue.split(find).join(replace);
    }
    node = walker.nextNode();
  }
  return doc.body.innerHTML;
};

const writeClipboard = async (text) => {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
};

const readClipboard = async () => {
  if (navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }
  return window.prompt('Paste text') || '';
};

const TextStyleWithClass = TextStyle.extend({
  addAttributes() {
    return {
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute('class'),
        renderHTML: (attributes) => {
          if (!attributes.class) return {};
          return { class: attributes.class };
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[class]' }, { tag: 'span[style]' }];
  },
});

const BlockClass = Extension.create({
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          class: {
            default: null,
            parseHTML: (element) => element.getAttribute('class'),
            renderHTML: (attributes) => {
              if (!attributes.class) return {};
              return { class: attributes.class };
            },
          },
        },
      },
    ];
  },
});

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
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [view, setView] = useState('home');
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
    const now = new Date().toISOString();
    return [{ id: crypto.randomUUID(), title: 'Tab 1', createdAt: now, updatedAt: now }];
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
  const [tabMenuOpenId, setTabMenuOpenId] = useState(null);
  const [templateMenu, setTemplateMenu] = useState(null);
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const [headingKey, setHeadingKey] = useState('normal');
  const [fontMenuOpen, setFontMenuOpen] = useState(false);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
  const recentTabs = useMemo(() => {
    const sorted = [...tabs].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    return sorted.slice(0, 6);
  }, [tabs]);
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
    const hash = window.location.hash;
    if (hash.startsWith('#tab=')) {
      const target = hash.replace('#tab=', '');
      if (target) {
        setActiveTabId(target);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(tabsKey, JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem(activeTabKey, activeTabId);
      window.location.hash = `tab=${activeTabId}`;
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
        TextStyleWithClass,
        BlockClass,
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
        const now = new Date().toISOString();
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTabId
              ? { ...tab, content: currentHtml, updatedAt: now }
              : tab
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
      if (!event.target.closest('.tab-menu') && !event.target.closest('.tab-kebab')) {
        setTabMenuOpenId(null);
      }
      if (!event.target.closest('.account-menu') && !event.target.closest('.account-button')) {
        setShowAccountMenu(false);
      }
      if (!event.target.closest('.template-menu') && !event.target.closest('.chip-button')) {
        setTemplateMenu(null);
      }
      if (!event.target.closest('.heading-menu') && !event.target.closest('.heading-button')) {
        setHeadingMenuOpen(false);
      }
      if (!event.target.closest('.font-menu') && !event.target.closest('.font-button')) {
        setFontMenuOpen(false);
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
    const now = new Date().toISOString();
    const newTab = {
      id: crypto.randomUUID(),
      title: `Tab ${nextIndex}`,
      createdAt: now,
      updatedAt: now,
    };
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

  const handleRenameTab = (tabId) => {
    const target = tabs.find((tab) => tab.id === tabId);
    const next = window.prompt('Rename tab', target?.title || 'Tab');
    if (!next) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, title: trimmed } : tab))
    );
    if (tabId === activeTabId) {
      setDocTitle(trimmed);
    }
  };

  const handleDuplicateTabById = (tabId) => {
    const target = tabs.find((tab) => tab.id === tabId);
    const currentHtml =
      localStorage.getItem(getDraftKey(tabId)) || target?.content || '';
    const now = new Date().toISOString();
    const newTab = {
      id: crypto.randomUUID(),
      title: `${target?.title || 'Tab'} copy`,
      createdAt: now,
      updatedAt: now,
    };
    localStorage.setItem(getDraftKey(newTab.id), currentHtml);
    localStorage.setItem(getHistoryKey(newTab.id), JSON.stringify([]));
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setDocTitle(newTab.title);
  };

  const handleDeleteTabById = (tabId) => {
    const ok = window.confirm('Move this tab to bin?');
    if (!ok) return;
    localStorage.removeItem(getDraftKey(tabId));
    localStorage.removeItem(getHistoryKey(tabId));
    const remaining = tabs.filter((tab) => tab.id !== tabId);
    if (!remaining.length) {
      const now = new Date().toISOString();
      const fresh = {
        id: crypto.randomUUID(),
        title: 'Tab 1',
        createdAt: now,
        updatedAt: now,
      };
      localStorage.setItem(getDraftKey(fresh.id), '');
      localStorage.setItem(getHistoryKey(fresh.id), JSON.stringify([]));
      setTabs([fresh]);
      setActiveTabId(fresh.id);
      return;
    }
    setTabs(remaining);
    if (tabId === activeTabId) {
      setActiveTabId(remaining[0].id);
    }
  };

  const handleAddSubtab = (tabId) => {
    const parent = tabs.find((tab) => tab.id === tabId);
    const now = new Date().toISOString();
    const newTab = {
      id: crypto.randomUUID(),
      title: 'Subtab',
      parentId: parent?.id,
      createdAt: now,
      updatedAt: now,
    };
    localStorage.setItem(getDraftKey(newTab.id), '');
    localStorage.setItem(getHistoryKey(newTab.id), JSON.stringify([]));
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setDocTitle(newTab.title);
  };

  const handleChooseEmoji = (tabId) => {
    const emoji = window.prompt('Choose emoji', '📄');
    if (!emoji) return;
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, emoji } : tab))
    );
  };

  const handleCopyTabLink = async (tabId) => {
    const link = `${window.location.origin}${window.location.pathname}#tab=${tabId}`;
    await writeClipboard(link);
  };

  const handleShowOutline = () => {
    setShowSidebar(true);
  };

  const handleMoveTabDown = (tabId) => {
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.id === tabId);
      if (index < 0 || index === prev.length - 1) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(index + 1, 0, moved);
      return next;
    });
  };

  const handleMoveInto = (tabId) => {
    const options = tabs
      .filter((tab) => tab.id !== tabId)
      .map((tab, index) => `${index + 1}. ${tab.title}`)
      .join('\n');
    const raw = window.prompt(`Move into:\n${options}`, '1');
    const index = Number(raw);
    if (!index) return;
    const candidates = tabs.filter((tab) => tab.id !== tabId);
    const target = candidates[index - 1];
    if (!target) return;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, parentId: target.id } : tab
      )
    );
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
    setShowAccountMenu(false);
  };

  const handleManageAccount = () => {
    window.alert('Manage account page coming soon.');
  };

  const handleAddAccount = () => {
    setShowAccountMenu(false);
    setShowLogin(true);
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

  useEffect(() => {
    if (!editor) return undefined;
    const updateHeadingKey = () => {
      if (editor.isActive('paragraph', { class: 'doc-title' })) {
        setHeadingKey('title');
      } else if (editor.isActive('paragraph', { class: 'doc-subtitle' })) {
        setHeadingKey('subtitle');
      } else if (editor.isActive('heading', { level: 1 })) {
        setHeadingKey('h1');
      } else if (editor.isActive('heading', { level: 2 })) {
        setHeadingKey('h2');
      } else if (editor.isActive('heading', { level: 3 })) {
        setHeadingKey('h3');
      } else {
        setHeadingKey('normal');
      }
    };
    updateHeadingKey();
    editor.on('selectionUpdate', updateHeadingKey);
    editor.on('transaction', updateHeadingKey);
    return () => {
      editor.off('selectionUpdate', updateHeadingKey);
      editor.off('transaction', updateHeadingKey);
    };
  }, [editor]);

  const headingLabelMap = {
    normal: 'Normal text',
    title: 'Title',
    subtitle: 'Subtitle',
    h1: 'Heading 1',
    h2: 'Heading 2',
    h3: 'Heading 3',
  };

  const applyHeading = (type) => {
    if (!editor) return;
    if (type === 'normal') {
      editor
        .chain()
        .focus()
        .setParagraph()
        .updateAttributes('paragraph', { class: null })
        .run();
    } else if (type === 'title') {
      editor
        .chain()
        .focus()
        .setParagraph()
        .updateAttributes('paragraph', { class: 'doc-title' })
        .run();
    } else if (type === 'subtitle') {
      editor
        .chain()
        .focus()
        .setParagraph()
        .updateAttributes('paragraph', { class: 'doc-subtitle' })
        .run();
    } else if (type === 'h1') {
      editor.chain().focus().setHeading({ level: 1 }).updateAttributes('heading', { class: null }).run();
    } else if (type === 'h2') {
      editor.chain().focus().setHeading({ level: 2 }).updateAttributes('heading', { class: null }).run();
    } else if (type === 'h3') {
      editor.chain().focus().setHeading({ level: 3 }).updateAttributes('heading', { class: null }).run();
    }
    setHeadingMenuOpen(false);
  };

  const insertTemplate = (type) => {
    if (!editor) return;
    const exitLists = () => {
      let safety = 0;
      while (editor.isActive('taskList') && safety < 4) {
        editor.commands.liftListItem('taskItem');
        safety += 1;
      }
      safety = 0;
      while ((editor.isActive('bulletList') || editor.isActive('orderedList')) && safety < 4) {
        editor.commands.liftListItem('listItem');
        safety += 1;
      }
      editor.commands.setParagraph();
    };
    const insertOutsideLists = (html) => {
      const { state } = editor;
      const { $from } = state.selection;
      let insertPos = state.selection.from;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const name = $from.node(depth).type.name;
        if (name === 'bulletList' || name === 'orderedList' || name === 'taskList') {
          insertPos = $from.after(depth);
          break;
        }
      }
      editor.chain().focus().insertContentAt(insertPos, html).run();
    };
    exitLists();
    let html = '';
    if (type === 'meeting') {
      html = `
        <div class="meeting-template">
          <p>
            <span class="meeting-pill icon-calendar">Date</span>
            <span class="meeting-sep">|</span>
            <span class="meeting-pill icon-event">Calendar event</span>
          </p>
          <p>
            <span class="meeting-label">Attendees:</span>
            <span class="meeting-chip icon-person">Person</span>
            <span class="meeting-chip icon-person">Person</span>
            <span class="meeting-chip icon-person">Person</span>
          </p>
          <p><span class="meeting-section-title">Notes</span></p>
          <ul>
            <li>Add notes</li>
            <li>Add notes</li>
          </ul>
          <p><span class="meeting-section-title">Action items</span></p>
          <ul data-type="taskList">
            <li data-type="taskItem"><label><input type="checkbox" /></label><div><p>Add action item</p></div></li>
            <li data-type="taskItem"><label><input type="checkbox" /></label><div><p>Add action item</p></div></li>
          </ul>
          <p></p>
        </div>
      `;
    } else if (type === 'email') {
      html = `
        <h2>Email draft</h2>
        <p><strong>To:</strong> </p>
        <p><strong>Subject:</strong> </p>
        <p>Hi [Name],</p>
        <p></p>
        <p>Thanks for reaching out. Here is a quick summary:</p>
        <ul>
          <li>Point one</li>
          <li>Point two</li>
        </ul>
        <p>Best regards,</p>
        <p>${user.name}</p>
        <p></p>
      `;
    } else if (type === 'status') {
      html = `
        <h2>Status update</h2>
        <p><strong>Highlights</strong></p>
        <ul>
          <li>Top highlight</li>
        </ul>
        <p><strong>Risks</strong></p>
        <ul>
          <li>Risk to track</li>
        </ul>
        <p><strong>Next steps</strong></p>
        <ul>
          <li>Upcoming task</li>
        </ul>
        <p></p>
      `;
    }
    insertOutsideLists(html);
    setTemplateMenu(null);
  };

  const handleOpenFromHome = (tabId) => {
    if (tabId !== activeTabId) {
      handleSelectTab(tabId);
    }
    setView('editor');
  };

  const handleCreateFromHome = () => {
    handleAddTab();
    setView('editor');
  };

  const AccountArea = () =>
    profile ? (
      <div className="account-area">
        <button
          className="avatar account-button"
          onClick={() => setShowAccountMenu((prev) => !prev)}
          title="Account"
        >
          {profile.name.charAt(0).toUpperCase()}
        </button>
        {showAccountMenu && (
          <div className="account-menu">
            <div className="account-header">
              <span className="account-email">{profile.email || 'guest@local'}</span>
              <button
                className="icon ghost account-close"
                onClick={() => setShowAccountMenu(false)}
                title="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="account-avatar">
              <div className="avatar large">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <button className="avatar-camera" title="Change photo">
                <span className="material-symbols-outlined">photo_camera</span>
              </button>
            </div>
            <div className="account-greeting">Hi, {profile.name}!</div>
            <button className="account-primary" onClick={handleManageAccount}>
              Manage your account
            </button>
            <div className="account-actions">
              <button className="account-action" onClick={handleAddAccount}>
                <span className="material-symbols-outlined">person_add</span>
                Add account
              </button>
              <button className="account-action" onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
                Sign out
              </button>
            </div>
            <div className="account-storage">
              <span className="material-symbols-outlined">cloud</span>
              <span>0% of 15 GB used</span>
            </div>
            <div className="account-links">
              <button className="ghost" onClick={() => window.alert('Privacy policy')}>
                Privacy policy
              </button>
              <span>•</span>
              <button className="ghost" onClick={() => window.alert('Terms of service')}>
                Terms of Service
              </button>
            </div>
          </div>
        )}
      </div>
    ) : (
      <button className="login" onClick={() => setShowLogin(true)}>
        Sign in
      </button>
    );

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

  const getSelectionText = () => {
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    if (from === to) return editor.getText();
    return editor.state.doc.textBetween(from, to, '\n');
  };

  const handleCopy = async () => {
    const text = getSelectionText();
    if (!text) return;
    await writeClipboard(text);
  };

  const handleCut = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = getSelectionText();
    if (!text) return;
    await writeClipboard(text);
    if (from !== to) {
      editor.chain().focus().deleteSelection().run();
    }
  };

  const handlePaste = async () => {
    if (!editor) return;
    const text = await readClipboard();
    if (!text) return;
    editor.chain().focus().insertContent(text).run();
  };

  const handlePastePlain = async () => {
    if (!editor) return;
    const text = await readClipboard();
    if (!text) return;
    editor.chain().focus().insertText(text).run();
  };

  const handleDelete = () => {
    if (!editor) return;
    editor.chain().focus().deleteSelection().run();
  };

  const handleFindReplace = () => {
    if (!editor) return;
    const find = window.prompt('Find');
    if (!find) return;
    const replace = window.prompt('Replace with', '');
    const html = editor.getHTML();
    const next = replaceTextInHtml(html, find, replace ?? '');
    editor.commands.setContent(next);
  };

  const handleInsertHorizontalRule = () => {
    editor?.chain().focus().setHorizontalRule().run();
  };

  const handleInsertBreak = () => {
    editor?.chain().focus().setHardBreak().run();
  };

  const handleInsertBookmark = () => {
    window.alert('Bookmark added (demo).');
  };

  const handleInsertSymbols = () => {
    const symbol = window.prompt('Insert symbol', '©');
    if (!symbol) return;
    editor?.chain().focus().insertContent(symbol).run();
  };

  const handleInsertChip = () => {
    editor?.chain().focus().insertContent('[[Smart chip]]').run();
  };

  const handleInsertPageElement = () => {
    window.alert('Page elements panel (demo).');
  };

  const handleInsertChart = () => {
    editor?.chain().focus().insertContent('[Chart]').run();
  };

  const handleInsertDrawing = () => {
    editor?.chain().focus().insertContent('[Drawing]').run();
  };

  const handleInsertBlock = () => {
    editor?.chain().focus().insertContent('[Building block]').run();
  };

  const handleInsertAudio = () => {
    editor?.chain().focus().insertContent('[Audio button]').run();
  };

  const handleInsertSignature = () => {
    editor?.chain().focus().insertContent('[Signature]').run();
  };

  const handleInsertTab = () => {
    editor?.chain().focus().insertContent('\t').run();
  };

  const handleClearFormatting = () => {
    editor?.chain().focus().clearNodes().unsetAllMarks().run();
  };

  const handleColumns = () => {
    window.alert('Columns layout is a demo placeholder.');
  };

  const handleHeadersFooters = () => {
    window.alert('Headers & footers panel (demo).');
  };

  const handlePageNumbers = () => {
    editor?.chain().focus().insertContent('Page 1').run();
  };

  const handlePageOrientation = () => {
    window.alert('Page orientation is a demo placeholder.');
  };

  const handlePageless = () => {
    window.alert('Pageless format enabled (demo).');
  };

  const handleFormatText = () => {
    if (!editor) return;
    const choice = window.prompt(
      'Text format: bold / italic / underline / strike / clear',
      'bold'
    );
    if (!choice) return;
    const key = choice.toLowerCase();
    if (key === 'bold') editor.chain().focus().toggleBold().run();
    else if (key === 'italic') editor.chain().focus().toggleItalic().run();
    else if (key === 'underline') editor.chain().focus().toggleUnderline().run();
    else if (key === 'strike') editor.chain().focus().toggleStrike().run();
    else if (key === 'clear') handleClearFormatting();
  };

  const handleParagraphStyles = () => {
    if (!editor) return;
    const choice = window.prompt(
      'Paragraph style: normal / h1 / h2 / h3',
      'normal'
    );
    if (!choice) return;
    const key = choice.toLowerCase();
    if (key === 'normal') editor.chain().focus().setParagraph().run();
    else if (key === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
    else if (key === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (key === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
  };

  const handleAlignIndent = () => {
    if (!editor) return;
    const choice = window.prompt(
      'Align/Indent: left / center / right / justify / indent / outdent',
      'left'
    );
    if (!choice) return;
    const key = choice.toLowerCase();
    if (key === 'left') editor.chain().focus().setTextAlign('left').run();
    else if (key === 'center') editor.chain().focus().setTextAlign('center').run();
    else if (key === 'right') editor.chain().focus().setTextAlign('right').run();
    else if (key === 'justify') editor.chain().focus().setTextAlign('justify').run();
    else if (key === 'indent') handleIndent();
    else if (key === 'outdent') handleOutdent();
  };

  const handleLineSpacing = () => {
    const next = window.prompt('Line spacing (1.2 / 1.4 / 1.6 / 1.8 / 2.0)', lineHeight);
    if (!next) return;
    setLineHeight(next);
  };

  const handleBulletsNumbering = () => {
    if (!editor) return;
    const choice = window.prompt(
      'List type: bullets / numbers / checklist / none',
      'bullets'
    );
    if (!choice) return;
    const key = choice.toLowerCase();
    if (key === 'bullets') editor.chain().focus().toggleBulletList().run();
    else if (key === 'numbers') editor.chain().focus().toggleOrderedList().run();
    else if (key === 'checklist') editor.chain().focus().toggleTaskList().run();
    else if (key === 'none') editor.chain().focus().clearNodes().run();
  };

  const handleSpellingGrammar = () => {
    window.alert('Spellcheck is handled by the browser.');
  };

  const handleReviewEdits = () => {
    window.alert('Suggested edits review (demo).');
  };

  const handleCompareDocs = () => {
    window.alert('Compare documents (demo).');
  };

  const handleCitations = () => {
    editor?.chain().focus().insertContent('[Citation]').run();
  };

  const handleLineNumbers = () => {
    window.alert('Line numbers toggled (demo).');
  };

  const handleLinkedObjects = () => {
    window.alert('Linked objects panel (demo).');
  };

  const handleDictionary = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, ' ');
    if (!selected) {
      window.alert('Select a word to look up.');
      return;
    }
    window.alert(`Definition for "${selected}" (demo).`);
  };

  const handleTranslate = () => {
    window.alert('Translate document (demo).');
  };

  const handleVoiceTyping = () => {
    window.alert('Voice typing (demo).');
  };

  const handleAudio = () => {
    editor?.chain().focus().insertContent('[Audio]').run();
  };

  const handleNotifications = () => {
    window.alert('Notification settings (demo).');
  };

  const handlePreferences = () => {
    window.alert('Preferences (demo).');
  };

  const handleAccessibility = () => {
    window.alert('Accessibility settings (demo).');
  };

  const handleHelpSearch = () => {
    const query = window.prompt('Search the menus');
    if (!query) return;
    window.alert(`Searching for "${query}" (demo).`);
  };

  const handleDocsHelp = () => {
    window.alert('Docs Help (demo).');
  };

  const handleTraining = () => {
    window.alert('Training resources (demo).');
  };

  const handleUpdates = () => {
    window.alert('Updates (demo).');
  };

  const handleImprove = () => {
    window.alert('Thanks for helping improve Docs! (demo)');
  };

  const handlePrivacy = () => {
    window.alert('Privacy Policy (demo).');
  };

  const handleTerms = () => {
    window.alert('Terms of Service (demo).');
  };

  const handleShortcuts = () => {
    window.alert(
      'Shortcuts:\nCtrl+B bold\nCtrl+I italic\nCtrl+U underline\nCtrl+K link\nCtrl+Z undo'
    );
  };

  const handleAddOns = () => {
    window.alert('Add-ons store (demo).');
  };

  const handleAppsScript = () => {
    window.alert('Apps Script editor (demo).');
  };

  const handleMode = () => {
    window.alert('Mode options: Editing / Suggesting / Viewing (demo).');
  };

  const handleToggleComments = () => {
    setShowComments((prev) => !prev);
  };

  const handleCollapseSidebars = () => {
    const next = !(showSidebar || showComments);
    setShowSidebar(next);
    setShowComments(next);
  };

  const handlePrintLayout = () => {
    window.alert('Print layout is enabled (demo).');
  };

  const handleEquationToolbar = () => {
    window.alert('Equation toolbar (demo).');
  };

  const handleShowNonPrinting = () => {
    window.alert('Non-printing characters (demo).');
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
    const now = new Date().toISOString();
    const newTab = {
      id: crypto.randomUUID(),
      title: `${activeTab?.title || 'Tab'} copy`,
      createdAt: now,
      updatedAt: now,
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
      const now = new Date().toISOString();
      const fresh = {
        id: crypto.randomUUID(),
        title: 'Tab 1',
        createdAt: now,
        updatedAt: now,
      };
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

  const headingLabel = headingLabelMap[headingKey] || 'Normal text';

  const MenuItem = ({ icon, label, shortcut, onClick, submenu, disabled }) => (
    <button
      className="menu-item"
      onClick={withClose(onClick)}
      disabled={disabled}
    >
      {icon && <span className="menu-icon material-symbols-outlined">{icon}</span>}
      <span className="menu-label">{label}</span>
      {shortcut && <span className="menu-shortcut">{shortcut}</span>}
      {submenu && <span className="menu-arrow">{'>'}</span>}
    </button>
  );

  const Menu = ({ id, label, children }) => (
    <div className="menu">
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
      {view === 'home' ? (
        <div className="home-screen">
          <header className="home-topbar">
            <div className="home-left">
              <button className="icon ghost" title="Menu">
                <span className="material-symbols-outlined">menu</span>
              </button>
              <div className="home-logo">
                <span className="doc-icon" aria-hidden />
                <span className="home-title">Docs</span>
              </div>
            </div>
            <div className="home-search">
              <span className="material-symbols-outlined">search</span>
              <input placeholder="Search" />
            </div>
            <div className="home-right">
              <button className="icon ghost" title="Apps">
                <span className="material-symbols-outlined">apps</span>
              </button>
              <AccountArea />
            </div>
          </header>

          <section className="home-templates">
            <div className="home-section-header">
              <span>Start a new document</span>
              <div className="home-controls">
                <button className="ghost">Template gallery</button>
                <button className="icon ghost" title="More">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
            </div>
            <div className="template-grid">
              <button className="template-card" onClick={handleCreateFromHome}>
                <div className="template-thumb blank">
                  <span className="material-symbols-outlined">add</span>
                </div>
                <div className="template-title">Blank document</div>
              </button>
              <button className="template-card" onClick={handleCreateFromHome}>
                <div className="template-thumb resume" />
                <div className="template-title">Resume</div>
                <div className="template-sub">Serif</div>
              </button>
              <button className="template-card" onClick={handleCreateFromHome}>
                <div className="template-thumb resume-alt" />
                <div className="template-title">Resume</div>
                <div className="template-sub">Coral</div>
              </button>
              <button className="template-card" onClick={handleCreateFromHome}>
                <div className="template-thumb letter" />
                <div className="template-title">Letter</div>
                <div className="template-sub">Spearmint</div>
              </button>
              <button className="template-card" onClick={handleCreateFromHome}>
                <div className="template-thumb proposal" />
                <div className="template-title">Project proposal</div>
                <div className="template-sub">Tropic</div>
              </button>
              <button className="template-card" onClick={handleCreateFromHome}>
                <div className="template-thumb brochure" />
                <div className="template-title">Brochure</div>
                <div className="template-sub">Geometric</div>
              </button>
              <button className="template-card" onClick={handleCreateFromHome}>
                <div className="template-thumb report" />
                <div className="template-title">Report</div>
                <div className="template-sub">Luxe</div>
              </button>
            </div>
          </section>

          <section className="home-recents">
            <div className="home-section-header">
              <span>Recent documents</span>
              <div className="home-controls">
                <button className="ghost">Owned by anyone</button>
                <button className="icon ghost" title="Grid view">
                  <span className="material-symbols-outlined">grid_view</span>
                </button>
                <button className="icon ghost" title="Sort">
                  <span className="material-symbols-outlined">sort</span>
                </button>
                <button className="icon ghost" title="Folder">
                  <span className="material-symbols-outlined">folder</span>
                </button>
              </div>
            </div>
            <div className="recent-grid">
              {recentTabs.map((tab) => {
                const dateLabel = new Date(
                  tab.updatedAt || tab.createdAt || Date.now()
                ).toLocaleDateString();
                return (
                  <div
                    key={tab.id}
                    className="recent-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenFromHome(tab.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleOpenFromHome(tab.id);
                    }}
                  >
                    <div className="recent-thumb" />
                    <div className="recent-meta">
                      <div className="recent-title">{tab.title}</div>
                      <div className="recent-sub">Opened {dateLabel}</div>
                    </div>
                    <button className="icon ghost recent-more" title="More">
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <>
          <header className="topbar">
            <div className="topbar-left">
              <button className="doc-icon" aria-hidden onClick={() => setView('home')} />
              <div>
                <div className="doc-title">{docTitle}</div>
                <div className="doc-actions">
              <Menu id="file" label="File">
                <MenuItem icon="note_add" label="New" onClick={handleAddTab} submenu />
                <MenuItem
                  icon="folder_open"
                  label="Open"
                  shortcut="Ctrl+O"
                  onClick={handleOpenTab}
                />
                <MenuItem icon="content_copy" label="Make a copy" onClick={handleDuplicateTab} />
                <div className="menu-sep" />
                <MenuItem icon="person_add" label="Share" onClick={() => setShowLogin(true)} submenu />
                <MenuItem icon="mail" label="Email" onClick={handleEmail} submenu />
                <MenuItem icon="download" label="Download" onClick={() => window.print()} submenu />
                <div className="menu-sep" />
                <MenuItem icon="edit" label="Rename" onClick={handleRename} />
                <MenuItem icon="drive_file_move" label="Move" onClick={handleMoveTab} />
                <MenuItem
                  icon="add_link"
                  label="Add shortcut to Drive"
                  onClick={handleShortcut}
                />
                <MenuItem icon="delete" label="Move to bin" onClick={handleDeleteTab} />
                <div className="menu-sep" />
                <MenuItem
                  icon="history"
                  label="Version history"
                  onClick={handleVersionHistory}
                  submenu
                />
                <MenuItem icon="cloud_off" label="Make available offline" onClick={handleOffline} />
                <div className="menu-sep" />
                <MenuItem icon="info" label="Details" onClick={handleDetails} />
                <MenuItem icon="security" label="Security limitations" onClick={handleSecurity} />
                <MenuItem icon="language" label="Language" onClick={handleLanguage} submenu />
                <MenuItem icon="settings" label="Page setup" onClick={handlePageSetup} submenu />
                <MenuItem icon="print" label="Print" onClick={() => window.print()} submenu />
              </Menu>

              <Menu id="edit" label="Edit">
                <MenuItem
                  icon="undo"
                  label="Undo"
                  shortcut="Ctrl+Z"
                  onClick={() => editor?.chain().focus().undo().run()}
                />
                <MenuItem
                  icon="redo"
                  label="Redo"
                  shortcut="Ctrl+Y"
                  onClick={() => editor?.chain().focus().redo().run()}
                />
                <div className="menu-sep" />
                <MenuItem
                  icon="content_cut"
                  label="Cut"
                  shortcut="Ctrl+X"
                  onClick={handleCut}
                />
                <MenuItem
                  icon="content_copy"
                  label="Copy"
                  shortcut="Ctrl+C"
                  onClick={handleCopy}
                />
                <MenuItem
                  icon="content_paste"
                  label="Paste"
                  shortcut="Ctrl+V"
                  onClick={handlePaste}
                />
                <MenuItem
                  icon="content_paste_off"
                  label="Paste without formatting"
                  shortcut="Ctrl+Shift+V"
                  onClick={handlePastePlain}
                />
                <div className="menu-sep" />
                <MenuItem
                  icon="select_all"
                  label="Select all"
                  shortcut="Ctrl+A"
                  onClick={() => editor?.chain().focus().selectAll().run()}
                />
                <MenuItem
                  icon="backspace"
                  label="Delete"
                  onClick={handleDelete}
                />
                <div className="menu-sep" />
                <MenuItem
                  icon="find_replace"
                  label="Find and replace"
                  shortcut="Ctrl+H"
                  onClick={handleFindReplace}
                />
              </Menu>

              <Menu id="view" label="View">
                <MenuItem icon="edit" label="Mode" onClick={handleMode} submenu />
                <MenuItem icon="comment" label="Comments" onClick={handleToggleComments} submenu />
                <MenuItem
                  icon="side_navigation"
                  label="Collapse tabs and outlines sidebar"
                  shortcut="Ctrl+Alt+A"
                  onClick={handleCollapseSidebars}
                />
                <div className="menu-sep" />
                <MenuItem
                  icon="check"
                  label="Show print layout"
                  onClick={handlePrintLayout}
                />
                <MenuItem
                  icon="check"
                  label="Show ruler"
                  onClick={() => setShowRuler((prev) => !prev)}
                />
                <MenuItem
                  icon="functions"
                  label="Show equation toolbar"
                  onClick={handleEquationToolbar}
                />
                <MenuItem
                  icon="notes"
                  label="Show non-printing characters"
                  shortcut="Ctrl+Shift+P"
                  onClick={handleShowNonPrinting}
                />
                <div className="menu-sep" />
                <MenuItem icon="fullscreen" label="Full screen" onClick={handleFullscreen} />
              </Menu>

              <Menu id="insert" label="Insert">
                <MenuItem icon="image" label="Image" onClick={handleInsertImage} submenu />
                <MenuItem
                  icon="table_chart"
                  label="Table"
                  onClick={() =>
                    editor
                      ?.chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run()
                  }
                  submenu
                />
                <MenuItem icon="view_module" label="Building blocks" onClick={handleInsertBlock} submenu />
                <MenuItem icon="smart_toy" label="Smart chips" onClick={handleInsertChip} submenu />
                <MenuItem
                  icon="volume_up"
                  label="Audio buttons"
                  onClick={handleInsertAudio}
                  submenu
                />
                <MenuItem icon="draw" label="eSignature" onClick={handleInsertSignature} />
                <MenuItem
                  icon="link"
                  label="Link"
                  shortcut="Ctrl+K"
                  onClick={setLink}
                />
                <MenuItem icon="draw" label="Drawing" onClick={handleInsertDrawing} submenu />
                <MenuItem icon="bar_chart" label="Chart" onClick={handleInsertChart} submenu />
                <MenuItem icon="insert_emoticon" label="Symbols" onClick={handleInsertSymbols} submenu />
                <div className="menu-sep" />
                <MenuItem icon="tab" label="Tab" shortcut="Shift+F11" onClick={handleInsertTab} />
                <MenuItem
                  icon="horizontal_rule"
                  label="Horizontal line"
                  onClick={handleInsertHorizontalRule}
                />
                <MenuItem icon="wrap_text" label="Break" onClick={handleInsertBreak} submenu />
                <MenuItem icon="bookmark" label="Bookmark" onClick={handleInsertBookmark} />
                <MenuItem
                  icon="dashboard_customize"
                  label="Page elements"
                  onClick={handleInsertPageElement}
                  submenu
                />
                <div className="menu-sep" />
                <MenuItem
                  icon="comment"
                  label="Comment"
                  shortcut="Ctrl+Alt+M"
                  onClick={addManualComment}
                />
              </Menu>

              <Menu id="format" label="Format">
                <MenuItem icon="text_fields" label="Text" onClick={handleFormatText} submenu />
                <MenuItem icon="segment" label="Paragraph styles" onClick={handleParagraphStyles} submenu />
                <MenuItem icon="format_align_left" label="Align and indent" onClick={handleAlignIndent} submenu />
                <MenuItem
                  icon="format_line_spacing"
                  label="Line & paragraph spacing"
                  onClick={handleLineSpacing}
                  submenu
                />
                <MenuItem icon="view_column" label="Columns" onClick={handleColumns} submenu />
                <MenuItem
                  icon="format_list_bulleted"
                  label="Bullets and numbering"
                  onClick={handleBulletsNumbering}
                  submenu
                />
                <div className="menu-sep" />
                <MenuItem icon="view_headline" label="Headers and footers" onClick={handleHeadersFooters} />
                <MenuItem icon="format_list_numbered" label="Page numbers" onClick={handlePageNumbers} />
                <MenuItem icon="screen_rotation" label="Page orientation" onClick={handlePageOrientation} />
                <MenuItem icon="fit_screen" label="Switch to pageless format" onClick={handlePageless} />
                <div className="menu-sep" />
                <MenuItem
                  icon="table_chart"
                  label="Table"
                  onClick={() =>
                    editor
                      ?.chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run()
                  }
                  submenu
                />
                <MenuItem icon="image" label="Image" onClick={handleInsertImage} submenu />
                <MenuItem icon="border_all" label="Borders and lines" onClick={handleInsertHorizontalRule} submenu />
                <div className="menu-sep" />
                <MenuItem
                  icon="format_clear"
                  label="Clear formatting"
                  shortcut="Ctrl+\\"
                  onClick={handleClearFormatting}
                />
              </Menu>

              <Menu id="tools" label="Tools">
                <MenuItem
                  icon="spellcheck"
                  label="Spelling and grammar"
                  onClick={handleSpellingGrammar}
                  submenu
                />
                <MenuItem
                  icon="numbers"
                  label="Word count"
                  shortcut="Ctrl+Shift+C"
                  onClick={handleWordCount}
                />
                <MenuItem
                  icon="rate_review"
                  label="Review suggested edits"
                  shortcut="Ctrl+Alt+O"
                  onClick={handleReviewEdits}
                />
                <MenuItem
                  icon="compare"
                  label="Compare documents"
                  onClick={handleCompareDocs}
                />
                <MenuItem
                  icon="format_quote"
                  label="Citations"
                  onClick={handleCitations}
                />
                <MenuItem icon="draw" label="eSignature" onClick={handleInsertSignature} />
                <MenuItem icon="format_list_numbered" label="Line numbers" onClick={handleLineNumbers} />
                <MenuItem icon="link" label="Linked objects" onClick={handleLinkedObjects} />
                <MenuItem
                  icon="menu_book"
                  label="Dictionary"
                  shortcut="Ctrl+Shift+Y"
                  onClick={handleDictionary}
                />
                <div className="menu-sep" />
                <MenuItem icon="translate" label="Translate document" onClick={handleTranslate} />
                <MenuItem
                  icon="keyboard_voice"
                  label="Voice typing"
                  shortcut="Ctrl+Shift+S"
                  onClick={handleVoiceTyping}
                />
                <MenuItem icon="volume_up" label="Audio" onClick={handleAudio} submenu />
                <div className="menu-sep" />
                <MenuItem
                  icon="notifications"
                  label="Notification settings"
                  onClick={handleNotifications}
                />
                <MenuItem icon="tune" label="Preferences" onClick={handlePreferences} />
                <MenuItem icon="accessibility" label="Accessibility" onClick={handleAccessibility} />
              </Menu>

              <Menu id="extensions" label="Extensions">
                <MenuItem icon="extension" label="Add-ons" onClick={handleAddOns} submenu />
                <MenuItem icon="code" label="Apps Script" onClick={handleAppsScript} />
              </Menu>

              <Menu id="help" label="Help">
                <MenuItem
                  icon="search"
                  label="Search the menus"
                  shortcut="Alt+/"
                  onClick={handleHelpSearch}
                />
                <MenuItem icon="help" label="Docs Help" onClick={handleDocsHelp} />
                <MenuItem icon="school" label="Training" onClick={handleTraining} />
                <MenuItem icon="system_update" label="Updates" onClick={handleUpdates} />
                <div className="menu-sep" />
                <MenuItem icon="feedback" label="Help Docs improve" onClick={handleImprove} />
                <div className="menu-sep" />
                <MenuItem icon="policy" label="Privacy Policy" onClick={handlePrivacy} />
                <MenuItem icon="gavel" label="Terms of Service" onClick={handleTerms} />
                <div className="menu-sep" />
                <MenuItem
                  icon="keyboard"
                  label="Keyboard shortcuts"
                  shortcut="Ctrl+/"
                  onClick={handleShortcuts}
                />
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
          <AccountArea />
        </div>
      </header>

      <div className="docs-toolbar">
        <div className="toolbar-group">
          <button className="icon" onClick={handleSearch} title="Search">
            <span className="material-symbols-outlined">search</span>
          </button>
          <button
            className="icon"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().chain().focus().undo().run()}
            title="Undo"
          >
            <span className="material-symbols-outlined">undo</span>
          </button>
          <button
            className="icon"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().chain().focus().redo().run()}
            title="Redo"
          >
            <span className="material-symbols-outlined">redo</span>
          </button>
          <button className="icon" onClick={() => window.print()} title="Print">
            <span className="material-symbols-outlined">print</span>
          </button>
          <button
            className="icon"
            onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
            title="Clear formatting"
          >
            <span className="material-symbols-outlined">format_clear</span>
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
          <div className="heading-select">
            <button
              className="pill select heading-button"
              onClick={() => setHeadingMenuOpen((prev) => !prev)}
            >
              {headingLabel}
              <span className="material-symbols-outlined">arrow_drop_down</span>
            </button>
            {headingMenuOpen && (
              <div className="heading-menu">
                {[
                  { key: 'normal', label: 'Normal text', className: 'normal' },
                  { key: 'title', label: 'Title', className: 'title' },
                  { key: 'subtitle', label: 'Subtitle', className: 'subtitle' },
                  { key: 'h1', label: 'Heading 1', className: 'h1' },
                  { key: 'h2', label: 'Heading 2', className: 'h2' },
                  { key: 'h3', label: 'Heading 3', className: 'h3' },
                ].map((item) => (
                  <button
                    key={item.key}
                    className={`heading-menu-item ${item.className} ${
                      headingKey === item.key ? 'active' : ''
                    }`}
                    onClick={() => applyHeading(item.key)}
                  >
                    <span className="heading-check">
                      {headingKey === item.key && (
                        <span className="material-symbols-outlined">check</span>
                      )}
                    </span>
                    <span className="heading-label">{item.label}</span>
                    <span className="heading-arrow">
                      <span className="material-symbols-outlined">chevron_right</span>
                    </span>
                  </button>
                ))}
                <div className="menu-sep" />
                <button className="heading-menu-item options" onClick={() => window.alert('Options')}>
                  <span className="heading-check" />
                  <span className="heading-label">Options</span>
                  <span className="heading-arrow">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </span>
                </button>
              </div>
            )}
          </div>
          <div className="font-select">
            <button
              className="pill select font-button"
              onClick={() => setFontMenuOpen((prev) => !prev)}
            >
              {fontFamily}
              <span className="material-symbols-outlined">arrow_drop_down</span>
            </button>
            {fontMenuOpen && (
              <div className="font-menu">
                <button
                  className="font-menu-item more"
                  onClick={() => window.alert('More fonts (demo).')}
                >
                  <span className="material-symbols-outlined">text_fields</span>
                  More fonts
                </button>
                <div className="menu-sep" />
                <div className="font-menu-list">
                  {FONTS.map((font) => (
                    <button
                      key={font}
                      className={`font-menu-item ${fontFamily === font ? 'active' : ''}`}
                      onClick={() => {
                        handleFontFamilyChange(font);
                        setFontMenuOpen(false);
                      }}
                    >
                      <span className="font-check">
                        {fontFamily === font && (
                          <span className="material-symbols-outlined">check</span>
                        )}
                      </span>
                      <span className="font-name" style={{ fontFamily: `'${font}', sans-serif` }}>
                        {font}
                      </span>
                      <span className="font-arrow">
                        <span className="material-symbols-outlined">chevron_right</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
            <span className="material-symbols-outlined">highlight</span>
          </button>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <button className="icon" onClick={setLink} title="Link">
            <span className="material-symbols-outlined">link</span>
          </button>
          <button className="icon" onClick={addManualComment} title="Comment">
            <span className="material-symbols-outlined">comment</span>
          </button>
          <button className="icon" onClick={handleInsertImage} title="Insert image">
            <span className="material-symbols-outlined">image</span>
          </button>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <button
            className={`icon ${editor?.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          >
            <span className="material-symbols-outlined">format_align_left</span>
          </button>
          <button
            className={`icon ${editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          >
            <span className="material-symbols-outlined">format_align_center</span>
          </button>
          <button
            className={`icon ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          >
            <span className="material-symbols-outlined">format_align_right</span>
          </button>
          <button
            className={`icon ${editor?.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
          >
            <span className="material-symbols-outlined">format_align_justify</span>
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
            <span className="material-symbols-outlined">checklist</span>
          </button>
          <button
            className={`icon ${editor?.isActive('bulletList') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <span className="material-symbols-outlined">format_list_bulleted</span>
          </button>
          <button
            className={`icon ${editor?.isActive('orderedList') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <span className="material-symbols-outlined">format_list_numbered</span>
          </button>
          <button className="icon" onClick={handleOutdent} title="Outdent">
            <span className="material-symbols-outlined">format_indent_decrease</span>
          </button>
          <button className="icon" onClick={handleIndent} title="Indent">
            <span className="material-symbols-outlined">format_indent_increase</span>
          </button>
          <button
            className={`icon ${editor?.isActive('codeBlock') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          >
            <span className="material-symbols-outlined">code</span>
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
                <div
                  key={tab.id}
                  className={`tab-row ${tab.id === activeTabId ? 'active' : ''} ${
                    tab.parentId ? 'subtab' : ''
                  }`}
                >
                  <button
                    className={`tab doc-tab ${tab.id === activeTabId ? 'active' : ''}`}
                    onClick={() => handleSelectTab(tab.id)}
                  >
                    <span className="tab-dot" />
                    {tab.emoji && <span className="tab-emoji">{tab.emoji}</span>}
                    {tab.title}
                  </button>
                  <button
                    className="tab-kebab"
                    onClick={(event) => {
                      event.stopPropagation();
                      setTabMenuOpenId((prev) => (prev === tab.id ? null : tab.id));
                    }}
                  >
                    ⋮
                  </button>
                  {tabMenuOpenId === tab.id && (
                    <div className="tab-menu" onClick={(event) => event.stopPropagation()}>
                      <button
                        className="menu-item"
                        onClick={() => handleAddSubtab(tab.id)}
                      >
                        + Add subtab
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => handleDeleteTabById(tab.id)}
                      >
                        Delete
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => handleDuplicateTabById(tab.id)}
                      >
                        Duplicate
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => handleRenameTab(tab.id)}
                      >
                        Rename
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => handleChooseEmoji(tab.id)}
                      >
                        Choose emoji
                      </button>
                      <div className="menu-sep" />
                      <button
                        className="menu-item"
                        onClick={() => handleCopyTabLink(tab.id)}
                      >
                        Copy link
                      </button>
                      <button className="menu-item" onClick={handleShowOutline}>
                        Show outline
                      </button>
                      <div className="menu-sep" />
                      <button
                        className="menu-item"
                        onClick={() => handleMoveTabDown(tab.id)}
                      >
                        Move down
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => handleMoveInto(tab.id)}
                      >
                        Move into
                      </button>
                    </div>
                  )}
                </div>
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
              <div className="chip-wrap">
                <button
                  className="chip chip-button"
                  onClick={() => insertTemplate('meeting')}
                >
                  <span className="material-symbols-outlined">description</span>
                  Meeting notes
                </button>
              </div>

              <div
                className="chip-wrap"
                onMouseEnter={() => setTemplateMenu('email')}
                onMouseLeave={() => setTemplateMenu(null)}
              >
                <button
                  className="chip chip-button"
                  onClick={() =>
                    setTemplateMenu((prev) => (prev === 'email' ? null : 'email'))
                  }
                >
                  <span className="material-symbols-outlined">mail</span>
                  Email draft
                </button>
                {templateMenu === 'email' && (
                  <div className="template-menu">
                    <div className="template-menu-title">Email draft</div>
                    <p>Insert a quick email draft template.</p>
                    <button
                      className="template-menu-action"
                      onClick={() => insertTemplate('email')}
                    >
                      Insert
                    </button>
                  </div>
                )}
              </div>

              <div
                className="chip-wrap"
                onMouseEnter={() => setTemplateMenu('more')}
                onMouseLeave={() => setTemplateMenu(null)}
              >
                <button
                  className="chip chip-button"
                  onClick={() =>
                    setTemplateMenu((prev) => (prev === 'more' ? null : 'more'))
                  }
                >
                  <span className="material-symbols-outlined">note_add</span>
                  More
                </button>
                {templateMenu === 'more' && (
                  <div className="template-menu">
                    <button
                      className="template-menu-item"
                      onClick={() => insertTemplate('status')}
                    >
                      <span className="material-symbols-outlined">checklist</span>
                      Status update
                    </button>
                    <button
                      className="template-menu-item"
                      onClick={() => insertTemplate('meeting')}
                    >
                      <span className="material-symbols-outlined">description</span>
                      Meeting notes
                    </button>
                    <button
                      className="template-menu-item"
                      onClick={() => insertTemplate('email')}
                    >
                      <span className="material-symbols-outlined">mail</span>
                      Email draft
                    </button>
                  </div>
                )}
              </div>
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
                  <span className="material-symbols-outlined">notifications</span>
                </button>
                <button
                  className="icon ghost"
                  title="Close"
                  onClick={() => setShowComments(false)}
                >
                  <span className="material-symbols-outlined">close</span>
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

        </>
      )}

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
