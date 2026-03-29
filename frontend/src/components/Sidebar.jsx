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
  onSelectHeading,
  onOpenSharedDocument,
  collapsedFolderIds,
  onToggleFolder,
}) {
  const folderGroups = [
    { id: 'unfiled', name: 'Unfiled', documents: [] },
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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span>Document tabs</span>
        <button className="icon" onClick={onAddTab}>
          +
        </button>
      </div>

      <div className="folder-toolbar">
        <button className="pill folder-create" onClick={onCreateFolder}>
          New folder
        </button>
        {activeDocumentId && activeAccessRole === 'owner' ? (
          (folders || []).length > 0 ? (
            <select
              className="pill select folder-select"
              value={currentFolderId || ''}
              onChange={(event) => onMoveActiveDocument?.(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Unfiled</option>
              {(folders || []).map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="sidebar-hint">
              Create a folder first, then move this document into it.
            </p>
          )
        ) : activeDocumentId ? (
          <p className="sidebar-hint">
            Only the document owner can organize shared documents into folders.
          </p>
        ) : (
          <p className="sidebar-hint">
            Local drafts stay outside folders. Share or open a saved document to organize it.
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
                    title="Rename folder"
                    onClick={() => onRenameFolder?.(folder)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="folder-action-button danger"
                    title="Delete folder"
                    onClick={() => onDeleteFolder?.(folder)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            {!(collapsedFolderIds || []).includes(String(folder.id)) &&
              (folder.documents.length === 0 ? (
                <p className="sidebar-hint compact">No documents here yet.</p>
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
                      >
                        <span className="tab-dot" />
                        <span className="tab-text">{item.title}</span>
                        {!item.documentId && <span className="draft-pill">Draft</span>}
                      </button>
                    )
                  )}
                </div>
              ))}
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
          onClick={() => onSelectHeading(heading.pos)}
        >
          {heading.text}
        </button>
      ))}
    </aside>
  );
}

export default Sidebar;
