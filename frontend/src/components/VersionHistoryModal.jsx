const stripHtml = (value = '') =>
  String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getDiffPreview = (selected = '', current = '') => {
  const left = stripHtml(selected);
  const right = stripHtml(current);

  if (!left && !right) {
    return {
      selected: '(empty)',
      current: '(empty)',
    };
  }

  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) {
    prefix += 1;
  }

  let leftSuffix = left.length - 1;
  let rightSuffix = right.length - 1;
  while (
    leftSuffix >= prefix &&
    rightSuffix >= prefix &&
    left[leftSuffix] === right[rightSuffix]
  ) {
    leftSuffix -= 1;
    rightSuffix -= 1;
  }

  const selectedDiff = left.slice(prefix, leftSuffix + 1).trim() || '(no change)';
  const currentDiff = right.slice(prefix, rightSuffix + 1).trim() || '(no change)';

  return {
    selected: selectedDiff,
    current: currentDiff,
  };
};

function VersionHistoryModal({ title, versions, currentContent, onClose, onRestore }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal versions-modal">
        <div className="share-modal-copy">
          <h2>Version history</h2>
          <p>Server snapshots for {title || 'this document'}.</p>
        </div>

        <div className="versions-list">
          {!versions.length && (
            <p className="sidebar-hint">No saved snapshots yet.</p>
          )}
          {versions.map((version) => (
            <div key={version.id} className="version-card">
              <div className="version-copy">
                <strong>{version.title}</strong>
                <span>{version.createdBy}</span>
                <span>{new Date(version.createdAt).toLocaleString()}</span>
                <div className="version-diff">
                  <div className="version-diff-block">
                    <small>Snapshot</small>
                    <p>{getDiffPreview(version.content, currentContent).selected}</p>
                  </div>
                  <div className="version-diff-block">
                    <small>Current</small>
                    <p>{getDiffPreview(version.content, currentContent).current}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="ghost restore"
                onClick={() => onRestore?.(version.id)}
              >
                Restore
              </button>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default VersionHistoryModal;
