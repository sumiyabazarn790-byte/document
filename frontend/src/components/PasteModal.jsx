import { useI18n } from '../i18n/i18n';

function PasteModal({ value, onChange, onClose, onConfirm }) {
  const { t } = useI18n();
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal paste-modal">
        <div className="paste-copy">
          <h2>{t('paste_title')}</h2>
          <p>{t('paste_desc')}</p>
        </div>

        <label className="auth-field">
          {t('paste_label')}
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={t('paste_placeholder')}
            rows={6}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="primary auth-primary" onClick={onConfirm}>
            {t('paste_insert')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PasteModal;
