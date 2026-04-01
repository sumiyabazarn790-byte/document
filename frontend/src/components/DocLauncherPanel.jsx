import { useMemo, useState } from 'react';

import docsIcon from '../assets/docs.jpg';
import { useI18n } from '../i18n/i18n';

function DocLauncherPanel({
  folders,
  recentDocuments,
  onClose,
  onCreateBlank,
  onOpenFolderDocument,
  onOpenRecent,
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const templateCards = useMemo(
    () => [
      { id: 'blank', title: t('template_blank_title'), subtitle: t('template_blank_subtitle'), accent: 'blank' },
      { id: 'resume', title: t('template_resume_title'), subtitle: t('template_resume_subtitle'), accent: 'resume' },
      { id: 'letter', title: t('template_letter_title'), subtitle: t('template_letter_subtitle'), accent: 'letter' },
      { id: 'proposal', title: t('template_proposal_title'), subtitle: t('template_proposal_subtitle'), accent: 'proposal' },
      { id: 'brochure', title: t('template_brochure_title'), subtitle: t('template_brochure_subtitle'), accent: 'brochure' },
    ],
    [t]
  );

  const filteredTemplates = useMemo(() => {
    if (!normalizedQuery) {
      return templateCards;
    }

    return templateCards.filter((template) =>
      `${template.title} ${template.subtitle}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, templateCards]);

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
            <span>{t('launcher_docs')}</span>
          </div>
          <label className="launcher-search">
            <span aria-hidden="true">{'\u{1F50D}'}</span>
            <input
              type="text"
              placeholder={t('launcher_search_placeholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </label>
          <div className="launcher-actions">
            <button type="button" className="launcher-close" onClick={onClose}>
              {t('close')}
            </button>
          </div>
        </div>

        <div className="launcher-section launcher-section-hero">
          <div className="launcher-section-header">
            <h3>{t('launcher_new_doc_title')}</h3>
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
              <p className="launcher-empty">{t('launcher_no_templates')}</p>
            )}
          </div>
        </div>

        <div className="launcher-section">
          <div className="launcher-section-header">
            <h3>{t('launcher_folders_title')}</h3>
          </div>
          <div className="launcher-folders">
            {filteredFolders.length === 0 && (
              <p className="launcher-empty">
                {normalizedQuery
                  ? t('launcher_no_folders_match')
                  : t('launcher_folders_empty')}
              </p>
            )}
            {filteredFolders.map((folder) => (
              <div key={folder.id} className="launcher-folder-card">
                <div className="launcher-folder-head">
                  <strong>{folder.name}</strong>
                  <span>
                    {t('launcher_folder_docs_count', { count: folder.documents?.length || 0 })}
                  </span>
                </div>
                <div className="launcher-folder-items">
                  {(folder.documents || []).length === 0 ? (
                    <span className="launcher-folder-empty">{t('launcher_no_documents')}</span>
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
            <h3>{t('launcher_recents_title')}</h3>
          </div>
          <div className="launcher-recents">
            {filteredRecents.length === 0 && (
              <p className="launcher-empty">
                {normalizedQuery
                  ? t('launcher_no_recents_match')
                  : t('launcher_recents_empty')}
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
