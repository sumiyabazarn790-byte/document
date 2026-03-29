import { useEffect, useRef, useState } from 'react';

function CommentsPanel({
  commentTab,
  commentQuery,
  commentTypeFilter,
  commentTabFilter,
  comments,
  notificationCount,
  notificationsActive,
  tabOptions,
  currentUser,
  onChangeTab,
  onChangeQuery,
  onChangeTypeFilter,
  onChangeTabFilter,
  onToggleNotifications,
  onAddComment,
  onRestoreSnapshot,
  onDeleteComment,
  onCopyCommentLink,
  onClose,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!openMenuId) return undefined;

    const handleOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openMenuId]);

  return (
    <aside className="comments-panel">
      <div className="comments-top">
        <div className="comments-title">Comments</div>
        <div className="comments-actions">
          <button
            className={`icon ghost ${notificationsActive ? 'active' : ''}`}
            title="Notifications"
            onClick={onToggleNotifications}
          >
            Notifications
            {notificationCount > 0 && (
              <span className="comments-notification-badge">{notificationCount}</span>
            )}
          </button>
          <button className="icon ghost" title="Close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="comments-tabs">
        <button
          className={`tab-button ${commentTab === 'all' ? 'active' : ''}`}
          onClick={() => onChangeTab('all')}
        >
          All comments
        </button>
        <button
          className={`tab-button ${commentTab === 'forYou' ? 'active' : ''}`}
          onClick={() => onChangeTab('forYou')}
        >
          For you
        </button>
        <div className="comments-search">
          <input
            value={commentQuery}
            onChange={(event) => onChangeQuery(event.target.value)}
            placeholder="Search"
          />
        </div>
      </div>
      <div className="comments-filters">
        <div className="comments-filter-row">
          <select
            className="pill select"
            value={commentTypeFilter}
            onChange={(event) => onChangeTypeFilter(event.target.value)}
          >
            <option value="all">All types</option>
            <option value="comment">Comments</option>
            <option value="history">History</option>
          </select>
          <select
            className="pill select"
            value={commentTabFilter}
            onChange={(event) => onChangeTabFilter(event.target.value)}
          >
            <option value="all">All tabs</option>
            {tabOptions?.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.title}
              </option>
            ))}
          </select>
        </div>
        <div className="comments-action-row">
          <button className="pill" onClick={onAddComment}>
            Add
          </button>
        </div>
      </div>
      <div className="comments-list">
        {comments.length === 0 && (
          <p className="sidebar-hint">No comments yet.</p>
        )}
        {comments.map((comment) => {
          const normalizedCurrentEmail = String(currentUser?.email || '').trim().toLowerCase();
          const normalizedAuthorEmail = String(comment.authorEmail || '').trim().toLowerCase();
          const canDelete = normalizedCurrentEmail
            ? normalizedCurrentEmail === normalizedAuthorEmail
            : currentUser?.name === comment.author;

          return (
            <div key={comment.id} id={`comment-${comment.id}`} className="comment-card">
            <div className="comment-meta">
              <strong>{comment.author}</strong>
              <div className="comment-meta-actions" ref={openMenuId === comment.id ? menuRef : null}>
                <span>
                  {comment.tabTitle ? `${comment.tabTitle} · ` : ''}
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  className="comment-menu-trigger"
                  onClick={() => setOpenMenuId((prev) => (prev === comment.id ? null : comment.id))}
                  title="Comment actions"
                >
                  ...
                </button>
                {openMenuId === comment.id && (
                  <div className="comment-menu">
                    <button
                      type="button"
                      className="comment-menu-item"
                      onClick={() => {
                        onCopyCommentLink?.(comment.id);
                        setOpenMenuId(null);
                      }}
                    >
                      Copy link
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        className="comment-menu-item danger"
                        onClick={() => {
                          onDeleteComment?.(comment.id);
                          setOpenMenuId(null);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="comment-text">{comment.preview}</p>
            {comment.type === 'history' && comment.snapshot && (
              <button
                className="ghost restore"
                onClick={() => onRestoreSnapshot(comment.snapshot)}
              >
                Restore version
              </button>
            )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default CommentsPanel;
