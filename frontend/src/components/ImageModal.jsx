import { useI18n } from '../i18n/i18n';

function ImageModal({ value, onChange, onClose, onConfirm }) {
  const { t } = useI18n();

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal image-modal">
        <div className="image-copy">
          <h2>{t('image_title')}</h2>
          <p>{t('image_desc')}</p>
        </div>

        <label className="auth-field">
          {t('image_label')}
          <input
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={t('image_placeholder')}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="primary auth-primary" onClick={onConfirm}>
            {t('image_insert')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImageModal;
