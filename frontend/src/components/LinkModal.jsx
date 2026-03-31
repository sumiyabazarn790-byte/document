import { useI18n } from '../i18n/i18n';

function LinkModal({ value, previous, onChange, onClose, onConfirm, onRemove }) {
  const { t } = useI18n();
  const hasExisting = Boolean(previous);

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal link-modal">
        <div className="link-copy">
          <h2>{t('link_title')}</h2>
          <p>{t('link_desc')}</p>
        </div>

        <label className="auth-field">
          {t('link_label')}
          <input
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={t('link_placeholder')}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          {hasExisting && (
            <button type="button" className="ghost auth-secondary danger" onClick={onRemove}>
              {t('link_remove')}
            </button>
          )}
          <button type="button" className="primary auth-primary" onClick={onConfirm}>
            {t('link_save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LinkModal;
