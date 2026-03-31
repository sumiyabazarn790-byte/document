import { useI18n } from '../i18n/i18n';

function FolderDialog({
  mode,
  value,
  folderName,
  onChange,
  onClose,
  onConfirm,
}) {
  const { t } = useI18n();
  const isDelete = mode === 'delete';
  const title = isDelete
    ? t('folder_delete_title')
    : mode === 'rename'
      ? t('folder_rename_title')
      : t('folder_create_title');
  const description = isDelete
    ? t('folder_delete_desc', { name: folderName, unfiled: t('sidebar_unfiled') })
    : mode === 'rename'
      ? t('folder_rename_desc')
      : t('folder_create_desc');

  return (
    <div className="modal-backdrop">
      <div className="modal folder-dialog">
        <div className="folder-dialog-copy">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        {!isDelete && (
          <label className="auth-field">
            {t('folder_name_label')}
            <input
              autoFocus
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={t('folder_name_placeholder')}
            />
          </label>
        )}

        {isDelete && (
          <div className="folder-delete-note">
            {t('folder_delete_note', { unfiled: t('sidebar_unfiled') })}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={`primary auth-primary ${isDelete ? 'danger' : ''}`}
            onClick={onConfirm}
          >
            {isDelete ? t('delete') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FolderDialog;
