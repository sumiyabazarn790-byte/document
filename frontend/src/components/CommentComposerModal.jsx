function CommentComposerModal({
  profile,
  initialValue = '',
  onClose,
  onSubmit,
}) {
  const initial = profile?.name?.charAt(0)?.toUpperCase() || '?';

  const handleSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const comment = String(form.get('comment') || '').trim();
    if (!comment) {
      return;
    }
    onSubmit(comment);
  };

  return (
    <div className="comment-composer-card">
      <div className="comment-composer-header">
        <div className={`comment-composer-avatar ${profile?.picture ? 'has-photo' : ''}`}>
          {profile?.picture ? (
            <img src={profile.picture} alt={profile.name} className="comment-composer-avatar-image" />
          ) : (
            initial
          )}
        </div>
        <div className="comment-composer-name">{profile?.name || 'Guest user'}</div>
      </div>

      <form onSubmit={handleSubmit} className="comment-composer-form">
        <input
          name="comment"
          defaultValue={initialValue}
          placeholder="Comment or add others with @"
          className="comment-composer-input"
          autoFocus
        />

        <div className="comment-composer-actions">
          <button type="button" className="comment-composer-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="comment-composer-submit">
            Comment
          </button>
        </div>
      </form>
    </div>
  );
}

export default CommentComposerModal;
