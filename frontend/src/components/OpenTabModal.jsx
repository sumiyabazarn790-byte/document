import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/i18n';

function OpenTabModal({ tabs, activeTabId, onClose, onSelect }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  useEffect(() => {
    setQuery('');
  }, [tabs]);

  const entries = useMemo(
    () => tabs.map((tab, index) => ({ tab, index })),
    [tabs]
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return entries;
    return entries.filter(({ tab }) =>
      String(tab.title || '')
        .toLowerCase()
        .includes(normalized)
    );
  }, [entries, query]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!filtered.length) return;
    onSelect(filtered[0].tab.id);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal open-tab-modal">
        <div className="open-tab-copy">
          <h2>{t('open_tab_title')}</h2>
          <p>{t('open_tab_desc')}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="auth-field">
            {t('open_tab_search')}
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('open_tab_placeholder')}
            />
          </label>

          <div className="open-tab-list" role="list">
            {filtered.length ? (
              filtered.map(({ tab, index }) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`open-tab-button ${tab.id === activeTabId ? 'active' : ''}`}
                  onClick={() => onSelect(tab.id)}
                >
                  <span className="open-tab-index">{index + 1}</span>
                  <span className="open-tab-title">
                    {tab.title || t('tab_label', { index: index + 1 })}
                  </span>
                </button>
              ))
            ) : (
              <div className="open-tab-empty">{t('open_tab_empty')}</div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="ghost auth-secondary" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="primary auth-primary" disabled={!filtered.length}>
              {t('open_tab_confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OpenTabModal;
