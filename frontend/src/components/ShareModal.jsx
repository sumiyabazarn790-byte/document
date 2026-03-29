import { useMemo, useState } from 'react';

const parseEmails = (value) =>
  value
    .split(/[\n,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

function ShareModal({ title, initialRole = 'edit', onClose, onSubmit }) {
  const [emailsValue, setEmailsValue] = useState('');
  const invalidEmails = useMemo(
    () => parseEmails(emailsValue).filter((email) => !email.endsWith('@gmail.com')),
    [emailsValue]
  );

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal share-modal">
        <div className="share-modal-copy">
          <h2>Share Document</h2>
          <p>Name your document and send Gmail invitations. Members are added after they accept.</p>
        </div>

        <form onSubmit={onSubmit}>
          <label className="auth-field">
            <span>Document name</span>
            <input
              name="title"
              type="text"
              required
              defaultValue={title}
              placeholder="Untitled document"
            />
          </label>

          <label className="auth-field">
            <span>People</span>
            <textarea
              name="emails"
              required
              rows="3"
              className={`share-textarea ${invalidEmails.length ? 'invalid' : ''}`}
              placeholder="member1@gmail.com, member2@gmail.com"
              value={emailsValue}
              onChange={(event) => setEmailsValue(event.target.value)}
            />
            {invalidEmails.length > 0 && (
              <span className="field-error">
                Only Gmail addresses are allowed. Fix: {invalidEmails.join(', ')}
              </span>
            )}
          </label>

          <label className="auth-field">
            <span>Access</span>
            <select name="role" defaultValue={initialRole} className="share-select">
              <option value="edit">Can edit</option>
              <option value="view">Can view</option>
            </select>
          </label>

          <div className="modal-actions">
            <button type="button" className="ghost auth-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary auth-primary">
              Share
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ShareModal;
