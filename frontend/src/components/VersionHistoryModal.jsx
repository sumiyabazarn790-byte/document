import { useI18n } from '../i18n/i18n';

const stripHtml = (value = '') =>
  String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getDiffPreview = (selected = '', current = '', labels = {}) => {
  const emptyLabel = labels.empty || '(empty)';
  const noChangeLabel = labels.noChange || '(no change)';
  const left = stripHtml(selected);
  const right = stripHtml(current);

  if (!left && !right) {
    return {
      selected: emptyLabel,
      current: emptyLabel,
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

  const selectedDiff = left.slice(prefix, leftSuffix + 1).trim() || noChangeLabel;
  const currentDiff = right.slice(prefix, rightSuffix + 1).trim() || noChangeLabel;

  return {
    selected: selectedDiff,
    current: currentDiff,
  };
};

function VersionHistoryModal({ title, versions, currentContent, onClose, onRestore }) {
  const { t } = useI18n();
  const diffLabels = {
    empty: t('version_empty'),
    noChange: t('version_no_change'),
  };
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal versions-modal">
        <div className="share-modal-copy">
          <h2>{t('version_history_title')}</h2>
          <p>{t('version_history_desc', { title: title || t('version_history_this_document') })}</p>
        </div>

        <div className="versions-list">
          {!versions.length && (
            <p className="sidebar-hint">{t('version_history_empty')}</p>
          )}
          {versions.map((version) => (
            <div key={version.id} className="version-card">
              <div className="version-copy">
                <strong>{version.title}</strong>
                <span>{version.createdBy}</span>
                <span>{new Date(version.createdAt).toLocaleString()}</span>
                <div className="version-diff">
                  <div className="version-diff-block">
                    <small>{t('version_snapshot')}</small>
                    <p>{getDiffPreview(version.content, currentContent, diffLabels).selected}</p>
                  </div>
                  <div className="version-diff-block">
                    <small>{t('version_current')}</small>
                    <p>{getDiffPreview(version.content, currentContent, diffLabels).current}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="ghost restore"
                onClick={() => onRestore?.(version.id)}
              >
                {t('version_restore')}
              </button>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost auth-secondary" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VersionHistoryModal;
