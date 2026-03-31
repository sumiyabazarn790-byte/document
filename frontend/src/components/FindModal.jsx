import { useI18n } from '../i18n/i18n';

function FindModal({ value, onChange, onClose, onConfirm }) {
  const { t } = useI18n();
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal find-modal">
        <div className="find-copy">
          <h2>{t('find_title')}</h2>
          <p>{t('find_desc')}</p>
        </div>

        <label className="auth-field">
          {t('find_label')}
          <input
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={t('find_placeholder')}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="primary auth-primary" onClick={onConfirm}>
            {t('find_title')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FindModal;
