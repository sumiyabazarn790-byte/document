import { useMemo, useState } from 'react';

import docsIcon from '../assets/docs.jpg';

const TEMPLATE_CARDS = [
  { id: 'blank', title: 'Blank document', subtitle: 'Start fresh', accent: 'blank' },
  { id: 'resume', title: 'Resume', subtitle: 'Serif', accent: 'resume' },
  { id: 'letter', title: 'Letter', subtitle: 'Spearmint', accent: 'letter' },
  { id: 'proposal', title: 'Project proposal', subtitle: 'Topic', accent: 'proposal' },
  { id: 'brochure', title: 'Brochure', subtitle: 'Geometric', accent: 'brochure' },
];

function DocLauncherPanel({
  folders,
  recentDocuments,
  onClose,
  onCreateBlank,
  onOpenFolderDocument,
  onOpenRecent,
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const filteredTemplates = useMemo(() => {
    if (!normalizedQuery) {
      return TEMPLATE_CARDS;
    }

    return TEMPLATE_CARDS.filter((template) =>
      `${template.title} ${template.subtitle}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const filteredRecents = useMemo(() => {
    if (!normalizedQuery) {
      return recentDocuments;
    }

    return recentDocuments.filter((document) =>
      `${document.title} ${document.subtitle} ${document.preview || ''}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, recentDocuments]);

  const filteredFolders = useMemo(() => {
    const folderList = (folders || []).filter((folder) => {
      if (!normalizedQuery) {
        return true;
      }

      const searchable = [
        folder.name,
        ...(folder.documents || []).map((document) => `${document.title} ${document.subtitle || ''}`),
      ].join(' ');

      return searchable.toLowerCase().includes(normalizedQuery);
    });

    return folderList;
  }, [folders, normalizedQuery]);

  return (
    <div className="launcher-backdrop" onClick={onClose} role="presentation">
      <div className="launcher-shell" onClick={(event) => event.stopPropagation()}>
        <div className="launcher-topbar">
          <div className="launcher-brand">
            <img src={docsIcon} alt="" className="launcher-doc-icon" />
            <span>Docs</span>
          </div>
          <label className="launcher-search">
            <span aria-hidden="true">{'\u{1F50D}'}</span>
            <input
              type="text"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </label>
          <button type="button" className="launcher-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="launcher-section launcher-section-hero">
          <div className="launcher-section-header">
            <h3>Start a new document</h3>
          </div>
          <div className="launcher-templates">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`launcher-template-card ${template.accent}`}
                onClick={onCreateBlank}
              >
                <div className="launcher-template-preview">
                  <span className="launcher-plus">+</span>
                </div>
                <strong>{template.title}</strong>
                <span>{template.subtitle}</span>
              </button>
            ))}
            {filteredTemplates.length === 0 && (
              <p className="launcher-empty">No templates match your search.</p>
            )}
          </div>
        </div>

        <div className="launcher-section">
          <div className="launcher-section-header">
            <h3>Folders</h3>
          </div>
          <div className="launcher-folders">
            {filteredFolders.length === 0 && (
              <p className="launcher-empty">
                {normalizedQuery
                  ? 'No folders match your search.'
                  : 'Your folders will appear here.'}
              </p>
            )}
            {filteredFolders.map((folder) => (
              <div key={folder.id} className="launcher-folder-card">
                <div className="launcher-folder-head">
                  <strong>{folder.name}</strong>
                  <span>{folder.documents?.length || 0} docs</span>
                </div>
                <div className="launcher-folder-items">
                  {(folder.documents || []).length === 0 ? (
                    <span className="launcher-folder-empty">No documents yet</span>
                  ) : (
                    folder.documents.slice(0, 4).map((document) => (
                      <button
                        key={`${folder.id}-${document.id}`}
                        type="button"
                        className="launcher-folder-item"
                        onClick={() => onOpenFolderDocument(document)}
                      >
                        <strong>{document.title}</strong>
                        <span>{document.subtitle}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="launcher-section">
          <div className="launcher-section-header">
            <h3>Recent documents</h3>
          </div>
          <div className="launcher-recents">
            {filteredRecents.length === 0 && (
              <p className="launcher-empty">
                {normalizedQuery
                  ? 'No recent documents match your search.'
                  : 'Your recent documents will appear here.'}
              </p>
            )}
            {filteredRecents.map((document) => (
              <button
                key={document.id}
                type="button"
                className="launcher-recent-card"
                onClick={() => onOpenRecent(document)}
              >
                <div className="launcher-recent-preview">
                  <div className="launcher-recent-text">{document.preview}</div>
                </div>
                <strong>{document.title}</strong>
                <span>{document.subtitle}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocLauncherPanel;
