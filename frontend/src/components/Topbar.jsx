import { useEffect, useMemo, useRef, useState } from 'react';
import commentsIcon from '../assets/mess.jpg';
import docsIcon from '../assets/docs.jpg';
import { useI18n } from '../i18n/i18n';

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
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onFind,
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
  const { t } = useI18n();
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
        <button type="button" className="doc-icon" onClick={onOpenLauncher} title={t('topbar_open_home')}>
          <img src={docsIcon} alt="" className="doc-icon-image" />
        </button>
        <div>
          <input
            className="doc-title-input"
            value={titleDraft}
            placeholder={t('untitled_document')}
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
            <Menu id="file" label={t('menu_file')} menu={menu} setMenu={setMenu}>
              <MenuItem icon={'\u{1F4C4}'} label={t('file_new')} onClick={withClose(onNewDoc)} submenu />
              <MenuItem icon={'\u{1F4C1}'} label={t('file_open')} onClick={withClose(onOpenTab)} submenu />
              <MenuItem icon={'\u{2934}'} label={t('file_rename')} onClick={withClose(onRename)} />
              <MenuItem icon={'\u{1F4D1}'} label={t('file_make_copy')} onClick={withClose(onDuplicateTab)} />
              <MenuItem icon={'\u{2B07}'} label={t('file_move_to')} onClick={withClose(onMoveTab)} submenu />
              <MenuItem icon={'\u{1F5D1}'} label={t('file_move_to_bin')} onClick={withClose(onDeleteTab)} />
              <div className="menu-sep" />
              <MenuItem icon={'\u{1F464}'} label={t('file_share')} onClick={withClose(onShare)} submenu />
              <MenuItem icon={'\u2709'} label={t('file_email')} onClick={withClose(onEmail)} submenu />
              <MenuItem icon={'\u{2B07}'} label={t('file_export_pdf')} onClick={withClose(onExportPdf)} submenu />
              <div className="menu-sep" />
              <MenuItem icon={'\u2699'} label={t('file_settings')} onClick={withClose(onDetails)} />
            </Menu>

            <Menu id="edit" label={t('menu_edit')} menu={menu} setMenu={setMenu}>
              <MenuItem icon={'\u238C'} label={t('edit_undo')} onClick={withClose(onUndo)} />
              <MenuItem icon={'\u21BB'} label={t('edit_redo')} onClick={withClose(onRedo)} />
              <MenuItem icon={'\u2702'} label={t('edit_cut')} onClick={withClose(onCut)} />
              <MenuItem icon={'\u29C9'} label={t('edit_copy')} onClick={withClose(onCopy)} />
              <MenuItem icon={'\u{1F4CB}'} label={t('edit_paste')} onClick={withClose(onPaste)} />
              <div className="menu-sep" />
              <MenuItem icon={'\u{1F50E}'} label={t('edit_find')} onClick={withClose(onFind)} />
            </Menu>

            <Menu id="view" label={t('menu_view')} menu={menu} setMenu={setMenu}>
              <MenuItem
                icon={'\u{1F9ED}'}
                label={showSidebar ? t('view_hide_sidebar') : t('view_show_sidebar')}
                onClick={withClose(onToggleSidebar)}
              />
              <MenuItem
                icon={'\u{1F4CF}'}
                label={showRuler ? t('view_hide_ruler') : t('view_show_ruler')}
                onClick={withClose(onToggleRuler)}
              />
              <MenuItem
                icon={'\u{1F4AC}'}
                label={showComments ? t('view_hide_comments') : t('view_show_comments')}
                onClick={withClose(onToggleComments)}
              />
              <div className="menu-sep" />
              <MenuItem icon={'\u26F6'} label={t('view_fullscreen')} onClick={withClose(onFullscreen)} />
            </Menu>

            <Menu id="insert" label={t('menu_insert')} menu={menu} setMenu={setMenu}>
              <MenuItem icon={'\u{1F517}'} label={t('insert_link')} onClick={withClose(onInsertLink)} />
              <MenuItem icon={'\u{1F4AC}'} label={t('insert_comment')} onClick={withClose(onAddComment)} />
            </Menu>

            <Menu id="format" label={t('menu_format')} menu={menu} setMenu={setMenu}>
              <button
                className="menu-item"
                onClick={withClose(onClearFormatting)}
              >
                {t('format_clear')}
              </button>
            </Menu>

            <Menu id="tools" label={t('menu_tools')} menu={menu} setMenu={setMenu}>
              <button className="menu-item" onClick={withClose(onWordCount)}>
                {t('tools_word_count')}
              </button>
              <button className="menu-item" onClick={withClose(onAddComment)}>
                {t('tools_add_comment')}
              </button>
              <button className="menu-item" onClick={withClose(onVersionHistory)}>
                {t('tools_version_history')}
              </button>
            </Menu>

            <Menu id="extensions" label={t('menu_extensions')} menu={menu} setMenu={setMenu}>
              <button
                className="menu-item"
                onClick={withClose(() =>
                  onNotify?.({
                    type: 'info',
                    title: t('menu_extensions'),
                    message: t('extensions_coming_soon'),
                  })
                )}
              >
                {t('extensions_manage')}
              </button>
            </Menu>

            <Menu id="help" label={t('menu_help')} menu={menu} setMenu={setMenu}>
              <button
                className="menu-item"
                onClick={withClose(() =>
                  onNotify?.({
                    type: 'info',
                    title: t('help_shortcuts'),
                    message: t('shortcuts_hint'),
                  })
                )}
              >
                {t('help_shortcuts')}
              </button>
            </Menu>

            <Menu id="more" label={t('menu_more')} menu={menu} setMenu={setMenu}>
              <MenuItem icon={'\u{1F310}'} label={t('more_language')} onClick={withClose(onLanguage)} submenu />
              <MenuItem icon={'\u{1F4C4}'} label={t('more_page_setup')} onClick={withClose(onPageSetup)} submenu />
              <MenuItem icon={'\u{1F5A8}'} label={t('more_export_pdf')} onClick={withClose(onExportPdf)} />
              <MenuItem icon={'\u{1F4F4}'} label={t('more_offline')} onClick={withClose(onOffline)} />
              <MenuItem icon={'\u2139'} label={t('more_details')} onClick={withClose(onDetails)} />
            </Menu>
          </div>
        </div>
      </div>
      <div className="topbar-right">
        {hasSharedDocument && collaboratorUsers.length > 0 && (
          <div className="collaborator-stack" title={t('collaborators_title')}>
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
          title={showComments ? t('view_hide_comments') : t('view_show_comments')}
        >
          <img src={commentsIcon} alt="" className="comment-trigger-image" />
        </button>
        <button
          className="share"
          onClick={() => (profile ? onShare?.() : onLogin())}
        >
          {t('share_button')}
        </button>
        {profile ? (
          <div className="account-menu" ref={accountMenuRef}>
            <button
              className={`avatar ${profile.picture ? 'has-photo' : ''}`}
              onClick={() => setShowAccountMenu((prev) => !prev)}
              title={t('account_menu')}
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
                    <span>{profile.email || t('signed_in')}</span>
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
                    <span>{t('add_account')}</span>
                  </button>
                  <button
                    className="account-action account-tile danger"
                    onClick={() => {
                      setShowAccountMenu(false);
                      onLogout();
                    }}
                  >
                    <span className="account-action-icon" aria-hidden="true">{'\u21AA'}</span>
                    <span>{t('sign_out')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button className="login" onClick={onLogin}>
            {t('sign_in')}
          </button>
        )}
      </div>
    </header>
  );
}

export default Topbar;
