import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n';

function Sidebar({
  tabs,
  activeTabId,
  headings,
  folders,
  sharedDocuments,
  activeDocumentId,
  currentFolderId,
  activeAccessRole,
  onAddTab,
  onCreateFolder,
  onDeleteFolder,
  onDragDocument,
  onDropDocument,
  onRenameFolder,
  onMoveActiveDocument,
  onSelectTab,
  onRenameTab,
  onDeleteTab,
  onDuplicateTab,
  onSelectHeading,
  onOpenSharedDocument,
  collapsedFolderIds,
  onToggleFolder,
}) {
  const { t } = useI18n();
  const [contextMenu, setContextMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!contextMenu) return undefined;

    const handleClose = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setContextMenu(null);
      }
    };

    window.addEventListener('mousedown', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [contextMenu]);
  const folderGroups = [
    { id: 'unfiled', name: t('sidebar_unfiled'), documents: [] },
    ...(folders || []).map((folder) => ({ ...folder, documents: [] })),
  ];

  const folderMap = new Map(folderGroups.map((folder) => [String(folder.id), folder]));
  const assignToFolder = (item) => {
    const key = item.folderId ? String(item.folderId) : 'unfiled';
    const target = folderMap.get(key) || folderMap.get('unfiled');
    target.documents.push(item);
  };

  tabs.forEach((tab) => assignToFolder({ ...tab, itemType: 'tab' }));
  (sharedDocuments || []).forEach((document) =>
    assignToFolder({ ...document, itemType: 'shared' })
  );

  const openContextMenu = (event, tab) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      tab,
    });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span>{t('sidebar_tabs_title')}</span>
        <button className="icon" onClick={onAddTab}>
          +
        </button>
      </div>

      <div className="folder-toolbar">
        <button className="pill folder-create" onClick={onCreateFolder}>
          {t('sidebar_new_folder')}
        </button>
        {activeDocumentId && activeAccessRole === 'owner' ? (
          (folders || []).length > 0 ? (
            <select
              className="pill select folder-select"
              value={currentFolderId || ''}
              onChange={(event) => onMoveActiveDocument?.(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">{t('sidebar_unfiled')}</option>
              {(folders || []).map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="sidebar-hint">
              {t('sidebar_create_folder_hint')}
            </p>
          )
        ) : activeDocumentId ? (
          <p className="sidebar-hint">
            {t('sidebar_owner_only_hint')}
          </p>
        ) : (
          <p className="sidebar-hint">
            {t('sidebar_local_drafts_hint')}
          </p>
        )}
      </div>

      <div className="folder-list">
        {folderGroups.map((folder) => (
          <div
            key={folder.id}
            className="folder-group"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDropDocument?.(folder.id === 'unfiled' ? null : Number(folder.id))}
          >
            <div className="folder-group-head">
              <button
                type="button"
                className="folder-group-title folder-toggle"
                onClick={() => onToggleFolder?.(String(folder.id))}
              >
                <span className={`folder-caret ${(collapsedFolderIds || []).includes(String(folder.id)) ? 'collapsed' : ''}`}>
                  ▾
                </span>
                <span>{folder.name}</span>
                <span className="folder-doc-count">{folder.documents.length}</span>
              </button>
              {folder.id !== 'unfiled' && (
                <div className="folder-group-actions">
                  <button
                    type="button"
                    className="folder-action-button"
                    title={t('sidebar_rename_folder_title')}
                    onClick={() => onRenameFolder?.(folder)}
                  >
                    {t('sidebar_rename_folder')}
                  </button>
                  <button
                    type="button"
                    className="folder-action-button danger"
                    title={t('sidebar_delete_folder_title')}
                    onClick={() => onDeleteFolder?.(folder)}
                  >
                    {t('sidebar_delete_folder')}
                  </button>
                </div>
              )}
            </div>
            {!(collapsedFolderIds || []).includes(String(folder.id)) &&
              (folder.documents.length === 0 ? (
                <p className="sidebar-hint compact">{t('sidebar_no_documents')}</p>
              ) : (
                <div className="tabs-list">
                  {folder.documents.map((item) =>
                    item.itemType === 'shared' ? (
                      <button
                        key={`shared-${item.id}`}
                        className={`tab doc-tab ${item.id === activeDocumentId ? 'active' : ''}`}
                        draggable={item.accessRole === 'owner'}
                        onDragStart={() => onDragDocument?.(item)}
                        onClick={() => onOpenSharedDocument(item.id)}
                      >
                        <span className="tab-dot shared" />
                        <span className="tab-text">{item.title}</span>
                        <span className={`role-pill ${item.accessRole}`}>{item.accessRole}</span>
                      </button>
                    ) : (
                      <button
                        key={item.id}
                        className={`tab doc-tab ${item.id === activeTabId ? 'active' : ''}`}
                        draggable={Boolean(item.documentId)}
                        onDragStart={() => item.documentId && onDragDocument?.(item)}
                        onClick={() => onSelectTab(item.id)}
                        onContextMenu={(event) => openContextMenu(event, item)}
                      >
                        <span className="tab-dot" />
                        <span className="tab-text">{item.title}</span>
                        {!item.documentId && <span className="draft-pill">{t('sidebar_draft')}</span>}
                      </button>
                    )
                  )}
                </div>
              ))}
          </div>
        ))}
      </div>
      {contextMenu && contextMenu.tab?.itemType === 'tab' && (
        <div
          className="context-menu"
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
        >
          <button
            type="button"
            className="context-item"
            onClick={() => {
              onSelectTab?.(contextMenu.tab.id);
              setContextMenu(null);
            }}
          >
            {t('file_open')}
          </button>
          <button
            type="button"
            className="context-item"
            onClick={() => {
              onRenameTab?.(contextMenu.tab.id);
              setContextMenu(null);
            }}
          >
            {t('file_rename')}
          </button>
          <button
            type="button"
            className="context-item"
            onClick={() => {
              onDuplicateTab?.(contextMenu.tab.id);
              setContextMenu(null);
            }}
          >
            {t('file_make_copy')}
          </button>
          <button
            type="button"
            className="context-item danger"
            onClick={() => {
              onDeleteTab?.(contextMenu.tab.id);
              setContextMenu(null);
            }}
          >
            {t('file_move_to_bin')}
          </button>
        </div>
      )}
      <div className="sidebar-divider" />
      <div className="sidebar-header">
        <span>{t('sidebar_outline_title')}</span>
      </div>
      {headings.length === 0 && (
        <p className="sidebar-hint">
          {t('sidebar_outline_hint')}
        </p>
      )}
      {headings.map((heading) => (
        <button
          key={heading.id}
          className={`tab heading level-${heading.level}`}
          onClick={() => onSelectHeading(heading.pos)}
        >
          {heading.text}
        </button>
      ))}
    </aside>
  );
}

export default Sidebar;
