function FolderDialog({
  mode,
  value,
  folderName,
  onChange,
  onClose,
  onConfirm,
}) {
  const isDelete = mode === 'delete';
  const title = isDelete
    ? 'Delete folder'
    : mode === 'rename'
      ? 'Rename folder'
      : 'Create folder';
  const description = isDelete
    ? `"${folderName}" will be removed and its documents will move to Unfiled.`
    : mode === 'rename'
      ? 'Give this folder a clearer name.'
      : 'Create a folder to organize your documents.';

  return (
    <div className="modal-backdrop">
      <div className="modal folder-dialog">
        <div className="folder-dialog-copy">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        {!isDelete && (
          <label className="auth-field">
            Folder name
            <input
              autoFocus
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Enter folder name"
            />
          </label>
        )}

        {isDelete && (
          <div className="folder-delete-note">
            Documents inside this folder will stay safe and appear under `Unfiled`.
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`primary auth-primary ${isDelete ? 'danger' : ''}`}
            onClick={onConfirm}
          >
            {isDelete ? 'Delete' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FolderDialog;
