import { LANGUAGES, useI18n } from '../i18n/i18n';

function LanguageModal({ onClose }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal language-modal">
        <div className="language-copy">
          <h2>{t('language_title')}</h2>
          <p>{t('language_desc')}</p>
        </div>

        <div className="language-options" role="listbox" aria-label={t('language_title')}>
          {LANGUAGES.map((option) => (
            <button
              key={option.code}
              type="button"
              className={`language-option ${lang === option.code ? 'active' : ''}`}
              onClick={() => setLang(option.code)}
            >
              <span className="language-name">{option.label}</span>
              {lang === option.code && <span className="language-check">{t('ok')}</span>}
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="primary auth-primary" onClick={onClose}>
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LanguageModal;
