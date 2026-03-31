import { useI18n } from '../i18n/i18n';

function RenameModal({ value, onChange, onClose, onConfirm }) {
  const { t } = useI18n();
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal rename-modal">
        <div className="rename-copy">
          <h2>{t('rename_title')}</h2>
          <p>{t('rename_desc')}</p>
        </div>

        <label className="auth-field">
          {t('rename_label')}
          <input
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={t('untitled_document')}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="primary auth-primary" onClick={onConfirm}>
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RenameModal;
