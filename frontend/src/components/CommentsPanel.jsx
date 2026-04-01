import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n';

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
  onClearHistory,
  onCopyCommentLink,
  onClose,
}) {
  const { t } = useI18n();
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showAllComments, setShowAllComments] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setShowAllComments(false);
  }, [commentTab, commentQuery, commentTypeFilter, commentTabFilter]);

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

  const visibleComments = showAllComments ? comments : comments.slice(0, 3);
  const hasMoreComments = comments.length > 3;

  return (
    <aside className="comments-panel">
      <div className="comments-top">
        <div className="comments-title">{t('comments_title')}</div>
        <div className="comments-actions">
          <button
            className={`icon ghost ${notificationsActive ? 'active' : ''}`}
            title={t('notifications')}
            onClick={onToggleNotifications}
          >
            {t('notifications')}
            {notificationCount > 0 && (
              <span className="comments-notification-badge">{notificationCount}</span>
            )}
          </button>
          <button className="icon ghost" title={t('close')} onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
      <div className="comments-tabs">
        <div className="comments-tab-row">
          <button
            className={`tab-button ${commentTab === 'all' ? 'active' : ''}`}
            onClick={() => onChangeTab('all')}
          >
            {t('all_comments')}
          </button>
          <button
            className={`tab-button ${commentTab === 'forYou' ? 'active' : ''}`}
            onClick={() => onChangeTab('forYou')}
          >
            {t('for_you')}
          </button>
        </div>
        <div className="comments-search">
          <input
            value={commentQuery}
            onChange={(event) => onChangeQuery(event.target.value)}
            placeholder={t('search_placeholder')}
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
            <option value="all">{t('all_types')}</option>
            <option value="comment">{t('comments_label')}</option>
            <option value="history">{t('history_label')}</option>
          </select>
          <select
            className="pill select"
            value={commentTabFilter}
            onChange={(event) => onChangeTabFilter(event.target.value)}
          >
            <option value="all">{t('all_tabs')}</option>
            {tabOptions?.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.title}
              </option>
            ))}
          </select>
        </div>
        <div className="comments-action-row">
          <button className="pill" onClick={onAddComment}>
            {t('add')}
          </button>
          <button
            className="pill ghost"
            onClick={onClearHistory}
            disabled={!comments.length}
          >
            {t('clear_all')}
          </button>
        </div>
      </div>
      <div className="comments-list">
        {comments.length === 0 && (
          <p className="sidebar-hint">{t('no_comments')}</p>
        )}
        {visibleComments.map((comment) => {
          const normalizedCurrentEmail = String(currentUser?.email || '').trim().toLowerCase();
          const normalizedAuthorEmail = String(comment.authorEmail || '').trim().toLowerCase();
          const canDelete =
            comment.type === 'history' ||
            (normalizedCurrentEmail
              ? normalizedCurrentEmail === normalizedAuthorEmail
              : currentUser?.name === comment.author);

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
                  title={t('comment_actions')}
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
                      {t('copy_link')}
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
                        {t('delete')}
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
                {t('restore_version')}
              </button>
            )}
            </div>
          );
        })}
        {hasMoreComments && (
          <div className="comments-list-toggle">
            {!showAllComments && (
              <button
                type="button"
                className="pill ghost"
                onClick={() => setShowAllComments(true)}
              >
                {t('comments_view_all', { count: comments.length })}
              </button>
            )}
            {showAllComments && (
              <button
                type="button"
                className="pill ghost"
                onClick={() => setShowAllComments(false)}
              >
                {t('comments_hide')}
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export default CommentsPanel;
