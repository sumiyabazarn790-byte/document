import { useI18n } from '../i18n/i18n';

function ClearAllModal({ onClose, onConfirm }) {
  const { t } = useI18n();

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal clear-all-modal">
        <div className="clear-all-copy">
          <h2>{t('clear_all_title')}</h2>
          <p>{t('clear_all_desc')}</p>
        </div>
        <div className="clear-all-note">
          {t('clear_all_note')}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="primary auth-primary danger" onClick={onConfirm}>
            {t('clear_all_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClearAllModal;
