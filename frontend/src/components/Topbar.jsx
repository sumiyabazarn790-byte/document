import { useEffect, useMemo, useRef, useState } from 'react';
import commentsIcon from '../assets/mess.jpg';
import docsIcon from '../assets/docs.jpg';

const MenuItem = ({ icon, label, shortcut, onClick, submenu }) => (
  <button className="menu-item" onClick={onClick}>
    {icon && <span className="menu-icon">{icon}</span>}
    <span className="menu-label">{label}</span>
    {shortcut && <span className="menu-shortcut">{shortcut}</span>}
    {submenu && <span className="menu-arrow">{'>'}</span>}
  </button>
);

const Menu = ({ id, label, menu, setMenu, children }) => (
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

function Topbar({
  docTitle,
  menu,
  setMenu,
  status,
  users,
  members,
  hasSharedDocument,
  profile,
  onLogout,
  onLogin,
  onShare,
  onRename,
  onNewDoc,
  onOpenTab,
  onDuplicateTab,
  onMoveTab,
  onDeleteTab,
  onWordCount,
  onFullscreen,
  onEmail,
  onExportPdf,
  onDetails,
  onOffline,
  onVersionHistory,
  onClearFormatting,
  onInsertLink,
  onAddComment,
  onToggleSidebar,
  onToggleRuler,
  onToggleComments,
  showSidebar,
  showRuler,
  showComments,
  onLanguage,
  onPageSetup,
  onNotify,
  onOpenLauncher,
  showTopbar,
}) {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [titleDraft, setTitleDraft] = useState(docTitle || '');
  const accountMenuRef = useRef(null);
  const withClose = useMemo(
    () => (action) => () => {
      action?.();
      setMenu(null);
    },
    [setMenu]
  );

  useEffect(() => {
    setTitleDraft(docTitle || '');
  }, [docTitle]);

  useEffect(() => {
    if (!showAccountMenu) return undefined;

    const handleOutsideClick = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) {
        setShowAccountMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showAccountMenu]);

  const initial = profile?.name?.charAt(0)?.toUpperCase() || '?';
  const normalizedProfileEmail = String(profile?.email || '').trim().toLowerCase();
  const activeUsersByEmail = useMemo(
    () =>
      new Map(
        (users || [])
          .filter((item) => item?.email)
          .map((item) => [String(item.email).trim().toLowerCase(), item])
      ),
    [users]
  );
  const collaboratorUsers = useMemo(
    () =>
      (members || [])
        .filter((member) => {
          if (!member?.email) {
            return false;
          }

          return String(member.email).trim().toLowerCase() !== normalizedProfileEmail;
        })
        .map((member) => {
          const normalizedEmail = String(member.email || '').trim().toLowerCase();
          const activeUser = activeUsersByEmail.get(normalizedEmail);

          return {
            ...member,
            active: Boolean(activeUser?.active),
            color: activeUser?.color || member.color || '#1a73e8',
            picture: activeUser?.picture || member.picture || null,
          };
        }),
    [members, normalizedProfileEmail, activeUsersByEmail]
  );
  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === docTitle) {
      setTitleDraft(docTitle || '');
      return;
    }
    onRename?.(trimmed);
  };

  return (
    <header className={`topbar ${showTopbar ? '' : 'hidden'}`}>
      <div className="topbar-left">
        <button type="button" className="doc-icon" onClick={onOpenLauncher} title="Open Docs home">
          <img src={docsIcon} alt="" className="doc-icon-image" />
        </button>
        <div>
          <input
            className="doc-title-input"
            value={titleDraft}
            placeholder="Untitled document"
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setTitleDraft(docTitle || '');
                event.currentTarget.blur();
              }
            }}
          />
          <div className="doc-actions">
            <Menu id="file" label="File" menu={menu} setMenu={setMenu}>
              <MenuItem icon={'\u{1F4C4}'} label="New" onClick={withClose(onNewDoc)} submenu />
              <MenuItem icon={'\u{1F4C1}'} label="Open" onClick={withClose(onOpenTab)} submenu />
              <MenuItem icon={'\u{2934}'} label="Rename" onClick={withClose(onRename)} />
              <MenuItem icon={'\u{1F4D1}'} label="Make a copy" onClick={withClose(onDuplicateTab)} />
              <MenuItem icon={'\u{2B07}'} label="Move to" onClick={withClose(onMoveTab)} submenu />
              <MenuItem icon={'\u{1F5D1}'} label="Move to bin" onClick={withClose(onDeleteTab)} />
              <div className="menu-sep" />
              <MenuItem icon={'\u{1F464}'} label="Share" onClick={withClose(onShare)} submenu />
              <MenuItem icon={'\u2709'} label="Email" onClick={withClose(onEmail)} submenu />
              <MenuItem icon={'\u{2B07}'} label="Export PDF" onClick={withClose(onExportPdf)} submenu />
              <div className="menu-sep" />
              <MenuItem icon={'\u2699'} label="Settings" onClick={withClose(onDetails)} />
            </Menu>

            <Menu id="edit" label="Edit" menu={menu} setMenu={setMenu}>
              <MenuItem icon={'\u238C'} label="Undo" onClick={withClose(() => document.execCommand('undo'))} />
              <MenuItem icon={'\u21BB'} label="Redo" onClick={withClose(() => document.execCommand('redo'))} />
              <MenuItem icon={'\u2702'} label="Cut" onClick={withClose(() => document.execCommand('cut'))} />
              <MenuItem icon={'\u29C9'} label="Copy" onClick={withClose(() => document.execCommand('copy'))} />
              <MenuItem icon={'\u{1F4CB}'} label="Paste" onClick={withClose(() => document.execCommand('paste'))} />
              <div className="menu-sep" />
              <MenuItem icon={'\u{1F50E}'} label="Find" onClick={withClose(() => window.find(''))} />
            </Menu>

            <Menu id="view" label="View" menu={menu} setMenu={setMenu}>
              <MenuItem
                icon={'\u{1F9ED}'}
                label={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                onClick={withClose(onToggleSidebar)}
              />
              <MenuItem
                icon={'\u{1F4CF}'}
                label={showRuler ? 'Hide ruler' : 'Show ruler'}
                onClick={withClose(onToggleRuler)}
              />
              <MenuItem
                icon={'\u{1F4AC}'}
                label={showComments ? 'Hide comments' : 'Show comments'}
                onClick={withClose(onToggleComments)}
              />
              <div className="menu-sep" />
              <MenuItem icon={'\u26F6'} label="Fullscreen" onClick={withClose(onFullscreen)} />
            </Menu>

            <Menu id="insert" label="Insert" menu={menu} setMenu={setMenu}>
              <MenuItem icon={'\u{1F517}'} label="Link" onClick={withClose(onInsertLink)} />
              <MenuItem icon={'\u{1F4AC}'} label="Comment" onClick={withClose(onAddComment)} />
            </Menu>

            <Menu id="format" label="Format" menu={menu} setMenu={setMenu}>
              <button
                className="menu-item"
                onClick={withClose(onClearFormatting)}
              >
                Clear formatting
              </button>
            </Menu>

            <Menu id="tools" label="Tools" menu={menu} setMenu={setMenu}>
              <button className="menu-item" onClick={withClose(onWordCount)}>
                Word count
              </button>
              <button className="menu-item" onClick={withClose(onAddComment)}>
                Add comment
              </button>
              <button className="menu-item" onClick={withClose(onVersionHistory)}>
                Version history
              </button>
            </Menu>

            <Menu id="extensions" label="Extensions" menu={menu} setMenu={setMenu}>
              <button
                className="menu-item"
                onClick={withClose(() =>
                  onNotify?.({
                    type: 'info',
                    title: 'Extensions',
                    message: 'Extensions panel coming soon.',
                  })
                )}
              >
                Manage extensions
              </button>
            </Menu>

            <Menu id="help" label="Help" menu={menu} setMenu={setMenu}>
              <button
                className="menu-item"
                onClick={withClose(() =>
                  onNotify?.({
                    type: 'info',
                    title: 'Keyboard shortcuts',
                    message: 'Ctrl+B bold, Ctrl+I italic, Ctrl+U underline',
                  })
                )}
              >
                Keyboard shortcuts
              </button>
            </Menu>

            <Menu id="more" label="More" menu={menu} setMenu={setMenu}>
              <MenuItem icon={'\u{1F310}'} label="Language" onClick={withClose(onLanguage)} submenu />
              <MenuItem icon={'\u{1F4C4}'} label="Page setup" onClick={withClose(onPageSetup)} submenu />
              <MenuItem icon={'\u{1F5A8}'} label="Export PDF" onClick={withClose(onExportPdf)} />
              <MenuItem icon={'\u{1F4F4}'} label="Offline" onClick={withClose(onOffline)} />
              <MenuItem icon={'\u2139'} label="Document details" onClick={withClose(onDetails)} />
            </Menu>
          </div>
        </div>
      </div>
      <div className="topbar-right">
        {hasSharedDocument && collaboratorUsers.length > 0 && (
          <div className="collaborator-stack" title="Collaborators in this document">
            {collaboratorUsers.slice(0, 3).map((member) => (
              <div
                key={`${member.name}-${member.color || 'default'}`}
                className={`collaborator-avatar ${member.active ? 'active' : ''}`}
                style={{
                  '--avatar-fill': member.color || '#1a73e8',
                }}
              >
                {member.picture ? (
                  <img src={member.picture} alt={member.name} className="collaborator-avatar-image" />
                ) : (
                  <span>{member.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
            ))}
            {collaboratorUsers.length > 3 && (
              <span className="collaborator-count">+{collaboratorUsers.length - 3}</span>
            )}
          </div>
        )}
        <button
          className={`comment-trigger ${showComments ? 'active' : ''}`}
          onClick={onToggleComments}
          title={showComments ? 'Hide comments' : 'Show comments'}
        >
          <img src={commentsIcon} alt="" className="comment-trigger-image" />
        </button>
        <button
          className="share"
          onClick={() => (profile ? onShare?.() : onLogin())}
        >
          Share
        </button>
        {profile ? (
          <div className="account-menu" ref={accountMenuRef}>
            <button
              className={`avatar ${profile.picture ? 'has-photo' : ''}`}
              onClick={() => setShowAccountMenu((prev) => !prev)}
              title="Open account menu"
            >
              {profile.picture ? (
                <img src={profile.picture} alt={profile.name} className="avatar-image" />
              ) : (
                initial
              )}
            </button>

            {showAccountMenu && (
              <div className="account-dropdown">
                <div className="account-summary">
                  <div className={`account-avatar ${profile.picture ? 'has-photo' : ''}`}>
                    {profile.picture ? (
                      <img src={profile.picture} alt={profile.name} className="account-avatar-image" />
                    ) : (
                      initial
                    )}
                  </div>
                  <div className="account-copy">
                    <strong>{profile.name}</strong>
                    <span>{profile.email || 'Signed in'}</span>
                  </div>
                </div>

                <div className="account-actions-row">
                  <button
                    className="account-action account-tile"
                    onClick={() => {
                      setShowAccountMenu(false);
                      onLogin();
                    }}
                  >
                    <span className="account-action-icon plus" aria-hidden="true">+</span>
                    <span>Add account</span>
                  </button>
                  <button
                    className="account-action account-tile danger"
                    onClick={() => {
                      setShowAccountMenu(false);
                      onLogout();
                    }}
                  >
                    <span className="account-action-icon" aria-hidden="true">{'\u21AA'}</span>
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button className="login" onClick={onLogin}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}

export default Topbar;
