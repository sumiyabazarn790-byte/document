function InviteModal({ invite, profile, onClose, onAccept, onLogin }) {
  if (!invite) return null;

  const needsMatchingAccount = profile?.email && profile.email.toLowerCase() !== invite.email.toLowerCase();

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal invite-modal">
        <div className="invite-copy">
          <h2>Invitation</h2>
          <p>
            <strong>{invite.invitedBy?.name || invite.invitedBy?.email}</strong> shared{' '}
            <strong>{invite.document?.title || 'a document'}</strong> with you.
          </p>
        </div>

        <div className="invite-summary">
          <div>
            <span className="invite-label">To</span>
            <strong>{invite.email}</strong>
          </div>
          <div>
            <span className="invite-label">Access</span>
            <strong>{invite.role === 'view' ? 'Can view' : 'Can edit'}</strong>
          </div>
        </div>

        {profile ? (
          needsMatchingAccount ? (
            <p className="invite-warning">
              Sign in with <strong>{invite.email}</strong> to accept this invitation.
            </p>
          ) : (
            <p className="invite-hint">Accept this request to become a member of the document.</p>
          )
        ) : (
          <p className="invite-hint">Sign in with {invite.email} to accept this invitation.</p>
        )}

        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            Later
          </button>
          {profile ? (
            needsMatchingAccount ? (
              <button type="button" className="primary auth-primary" onClick={onLogin}>
                Switch account
              </button>
            ) : (
              <button type="button" className="primary auth-primary" onClick={onAccept}>
                Accept invitation
              </button>
            )
          ) : (
            <button type="button" className="primary auth-primary" onClick={onLogin}>
              Sign in to accept
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default InviteModal;
