import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/i18n';

const parseEmails = (value) =>
  value
    .split(/[\n,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

function ShareModal({ title, initialRole = 'edit', onClose, onSubmit }) {
  const { t } = useI18n();
  const [emailsValue, setEmailsValue] = useState('');
  const invalidEmails = useMemo(
    () => parseEmails(emailsValue).filter((email) => !email.endsWith('@gmail.com')),
    [emailsValue]
  );

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal share-modal">
        <div className="share-modal-copy">
          <h2>{t('share_title')}</h2>
          <p>{t('share_desc')}</p>
        </div>

        <form onSubmit={onSubmit}>
          <label className="auth-field">
            <span>{t('share_doc_name')}</span>
            <input
              name="title"
              type="text"
              required
              defaultValue={title}
              placeholder={t('untitled_document')}
            />
          </label>

          <label className="auth-field">
            <span>{t('share_people')}</span>
            <textarea
              name="emails"
              required
              rows="3"
              className={`share-textarea ${invalidEmails.length ? 'invalid' : ''}`}
              placeholder={t('share_placeholder')}
              value={emailsValue}
              onChange={(event) => setEmailsValue(event.target.value)}
            />
            {invalidEmails.length > 0 && (
              <span className="field-error">
                {t('share_gmail_only', { emails: invalidEmails.join(', ') })}
              </span>
            )}
          </label>

          <label className="auth-field">
            <span>{t('share_access')}</span>
            <select name="role" defaultValue={initialRole} className="share-select">
              <option value="edit">{t('share_can_edit')}</option>
              <option value="view">{t('share_can_view')}</option>
            </select>
          </label>

          <div className="modal-actions">
            <button type="button" className="ghost auth-secondary" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="primary auth-primary">
              {t('share_button')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ShareModal;
