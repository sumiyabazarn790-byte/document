import { useI18n } from '../i18n/i18n';

function InviteModal({ invite, profile, onClose, onAccept, onLogin }) {
  const { t } = useI18n();
  if (!invite) return null;

  const needsMatchingAccount = profile?.email && profile.email.toLowerCase() !== invite.email.toLowerCase();
  const documentTitle = invite.document?.title || t('invite_document_fallback');

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal invite-modal">
        <div className="invite-copy">
          <h2>{t('invite_title')}</h2>
          <p>
            <strong>{invite.invitedBy?.name || invite.invitedBy?.email}</strong>{' '}
            {t('invite_shared_with', { title: documentTitle })}
          </p>
        </div>

        <div className="invite-summary">
          <div>
            <span className="invite-label">{t('invite_to_label')}</span>
            <strong>{invite.email}</strong>
          </div>
          <div>
            <span className="invite-label">{t('invite_access_label')}</span>
            <strong>{invite.role === 'view' ? t('invite_can_view') : t('invite_can_edit')}</strong>
          </div>
        </div>

        {profile ? (
          needsMatchingAccount ? (
            <p className="invite-warning">
              {t('invite_sign_in_match', { email: invite.email })}
            </p>
          ) : (
            <p className="invite-hint">{t('invite_accept_hint')}</p>
          )
        ) : (
          <p className="invite-hint">{t('invite_sign_in_hint', { email: invite.email })}</p>
        )}

        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            {t('invite_later')}
          </button>
          {profile ? (
            needsMatchingAccount ? (
              <button type="button" className="primary auth-primary" onClick={onLogin}>
                {t('invite_switch_account')}
              </button>
            ) : (
              <button type="button" className="primary auth-primary" onClick={onAccept}>
                {t('invite_accept')}
              </button>
            )
          ) : (
            <button type="button" className="primary auth-primary" onClick={onLogin}>
              {t('invite_sign_in_accept')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default InviteModal;
