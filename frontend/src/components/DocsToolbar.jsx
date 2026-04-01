import { useEffect, useRef, useState } from 'react';

import ColorPicker from './ColorPicker';
import centerIcon from '../assets/1.jpg';
import rightIcon from '../assets/2.jpg';
import justifyIcon from '../assets/3.jpg';
import { useI18n } from '../i18n/i18n';

function DocsToolbar({
  editor,
  zoom,
  headingValue,
  fontFamily,
  fontSize,
  lineHeight,
  textColor,
  fonts,
  fontSizes,
  zoomLevels,
  colorPalette,
  onZoomChange,
  onFontFamilyChange,
  onFontSizeChange,
  onLineHeightChange,
  onTextColorChange,
  onSearch,
  onExportPdf,
  onInsertImage,
  onSetLink,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
  onIndent,
  onOutdent,
  onToggleTopbar,
  showTopbar,
}) {
  const { t } = useI18n();
  const [showSearchField, setShowSearchField] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (showSearchField) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, [showSearchField]);

  const canResizeImage = Boolean(editor?.isActive('image'));
  const imageAttributes = editor?.getAttributes('image') || {};
  const imageWidth = imageAttributes.width || 'auto';

  return (
    <div className={`docs-toolbar ${showTopbar ? '' : 'topbar-collapsed'}`}>
      <div className="toolbar-contents">
        <div className="toolbar-group">
          <button
            className={`icon ${showSearchField ? 'active' : ''}`}
            onClick={() => setShowSearchField((prev) => !prev)}
            title={t('toolbar_search')}
          >
            {'\u{1F50D}'}
          </button>
          {showSearchField && (
            <div className="toolbar-search-inline">
              <input
                ref={searchInputRef}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onSearch?.(searchValue);
                  }
                  if (event.key === 'Escape') {
                    setShowSearchField(false);
                    setSearchValue('');
                  }
                }}
                placeholder={t('toolbar_search_placeholder')}
              />
              <button
                type="button"
                className="icon"
                onClick={() => onSearch?.(searchValue)}
                title={t('toolbar_find_next')}
              >
                {'\u21B5'}
              </button>
            </div>
          )}
          <button
            className="icon"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().chain().focus().undo().run()}
            title={t('edit_undo')}
          >
            {'\u21B6'}
          </button>
          <button
            className="icon"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().chain().focus().redo().run()}
            title={t('edit_redo')}
          >
            {'\u21B7'}
          </button>
          <button className="icon" onClick={onExportPdf} title={t('file_export_pdf')}>
            {'\u{1F5A8}'}
          </button>
          <button
            className="icon"
            onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
            title={t('format_clear')}
          >
            A
          </button>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <button
            className="icon"
            onClick={() => onZoomChange(Math.max(50, zoom - 10))}
          >
            -
          </button>
          <select
            className="pill select"
            value={zoom}
            onChange={(event) => onZoomChange(event.target.value)}
          >
            {zoomLevels.map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
          <button
            className="icon"
            onClick={() => onZoomChange(Math.min(200, zoom + 10))}
          >
            +
          </button>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <select
            className="pill select"
            value={headingValue}
            onChange={(event) => {
              const value = event.target.value;
              if (!editor) return;
              if (value === 'paragraph') {
                editor.chain().focus().setParagraph().run();
              } else if (value === 'h1') {
                editor.chain().focus().toggleHeading({ level: 1 }).run();
              } else if (value === 'h2') {
                editor.chain().focus().toggleHeading({ level: 2 }).run();
              } else if (value === 'h3') {
                editor.chain().focus().toggleHeading({ level: 3 }).run();
              } else if (value === 'h4') {
                editor.chain().focus().toggleHeading({ level: 4 }).run();
              } else if (value === 'h5') {
                editor.chain().focus().toggleHeading({ level: 5 }).run();
              } else if (value === 'h6') {
                editor.chain().focus().toggleHeading({ level: 6 }).run();
              } else if (value === 'blockquote') {
                editor.chain().focus().toggleBlockquote().run();
              }
            }}
          >
            <option value="paragraph">{t('text_normal')}</option>
            <option value="h1">{t('heading_1')}</option>
            <option value="h2">{t('heading_2')}</option>
            <option value="h3">{t('heading_3')}</option>
            <option value="h4">{t('heading_4')}</option>
            <option value="h5">{t('heading_5')}</option>
            <option value="h6">{t('heading_6')}</option>
            <option value="blockquote">{t('quote')}</option>
          </select>
          <select
            className="pill select font-family-select"
            value={fontFamily}
            onChange={(event) => onFontFamilyChange(event.target.value)}
            title={fontFamily}
          >
            {fonts.map((font) => (
              <option key={font} value={font} style={{ fontFamily: `'${font}', 'Plus Jakarta Sans', sans-serif` }}>
                {font}
              </option>
            ))}
          </select>
          <div className="font-size">
            <button className="icon" onClick={() => onFontSizeChange(fontSize - 1)}>
              -
            </button>
            <select
              className="pill select"
              value={fontSize}
              onChange={(event) => onFontSizeChange(event.target.value)}
            >
              {fontSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <button className="icon" onClick={() => onFontSizeChange(fontSize + 1)}>
              +
            </button>
          </div>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <button
            className={`icon ${editor?.isActive('bold') ? 'active' : ''}`}
            onClick={onToggleBold || (() => editor?.chain().focus().toggleBold().run())}
          >
            <strong>B</strong>
          </button>
          <button
            className={`icon ${editor?.isActive('italic') ? 'active' : ''}`}
            onClick={onToggleItalic || (() => editor?.chain().focus().toggleItalic().run())}
          >
            <em>I</em>
          </button>
          <button
            className={`icon ${editor?.isActive('underline') ? 'active' : ''}`}
            onClick={onToggleUnderline || (() => editor?.chain().focus().toggleUnderline().run())}
          >
            <span className="underline">U</span>
          </button>
          <ColorPicker
            value={textColor}
            onChange={onTextColorChange}
            palette={colorPalette}
          />
          <button
            className={`icon ${editor?.isActive('highlight') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleHighlight({ color: '#ffe082' }).run()}
          >
            {'\u270E'}
          </button>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <button className="icon" onClick={onSetLink} title={t('insert_link')}>
            {'\u{1F517}'}
          </button>
          <button className="icon" onClick={onInsertImage} title={t('image_title')}>
            {'\u{1F5BC}'}
          </button>
          {canResizeImage && (
            <select
              className="pill select image-size-select"
              value={imageWidth}
              onChange={(event) => {
                const value = event.target.value;
                editor
                  ?.chain()
                  .focus()
                  .updateAttributes('image', {
                    width: value === 'auto' ? null : value,
                  })
                  .run();
              }}
              title={t('image_size_label')}
            >
              <option value="auto">{t('auto')}</option>
              <option value="25%">25%</option>
              <option value="50%">50%</option>
              <option value="75%">75%</option>
              <option value="100%">100%</option>
              <option value="125%">125%</option>
            </select>
          )}
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <button
            className={`icon ${editor?.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
          >
            {'\u2B1A'}
          </button>
          <button
            className={`icon ${editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          >
            <img src={centerIcon} alt="" className="toolbar-image-icon" />
          </button>
          <button
            className={`icon ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          >
            <img src={rightIcon} alt="" className="toolbar-image-icon" />
          </button>
          <button
            className={`icon ${editor?.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
          >
            <img src={justifyIcon} alt="" className="toolbar-image-icon" />
          </button>
        </div>
        <div className="divider" />
        <div className="toolbar-group">
          <select
            className="pill select"
            value={lineHeight}
            onChange={(event) => onLineHeightChange(event.target.value)}
          >
            <option value="1.2">1.2</option>
            <option value="1.4">1.4</option>
            <option value="1.6">1.6</option>
            <option value="1.8">1.8</option>
            <option value="2">2.0</option>
          </select>
          <button
            className={`icon ${editor?.isActive('taskList') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
          >
            {'\u2611'}
          </button>
          <button
            className={`icon ${editor?.isActive('bulletList') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            {'\u2022'}
          </button>
          <button
            className={`icon ${editor?.isActive('orderedList') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            1.
          </button>
          <button className="icon" onClick={onOutdent} title={t('toolbar_outdent')}>
            {'\u21E4'}
          </button>
          <button className="icon" onClick={onIndent} title={t('toolbar_indent')}>
            {'\u21E5'}
          </button>
          <button
            className={`icon ${editor?.isActive('codeBlock') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          >
            {'</>'}
          </button>
        </div>
      </div>
      <button
        className={`toolbar-toggle ${showTopbar ? '' : 'collapsed'}`}
        onClick={onToggleTopbar}
        title={showTopbar ? t('toolbar_hide_topbar') : t('toolbar_show_topbar')}
      >
        {showTopbar ? '\u25B4' : '\u25BE'}
      </button>
    </div>
  );
}

export default DocsToolbar;
