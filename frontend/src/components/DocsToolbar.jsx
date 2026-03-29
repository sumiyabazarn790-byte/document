import { useEffect, useRef, useState } from 'react';

import ColorPicker from './ColorPicker';

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
  onIndent,
  onOutdent,
  onToggleTopbar,
  showTopbar,
}) {
  const [showSearchField, setShowSearchField] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (showSearchField) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, [showSearchField]);

  return (
    <div className={`docs-toolbar ${showTopbar ? '' : 'topbar-collapsed'}`}>
      <div className="toolbar-contents">
        <div className="toolbar-group">
          <button
            className={`icon ${showSearchField ? 'active' : ''}`}
            onClick={() => setShowSearchField((prev) => !prev)}
            title="Search"
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
                placeholder="Search in document"
              />
              <button
                type="button"
                className="icon"
                onClick={() => onSearch?.(searchValue)}
                title="Find next"
              >
                {'\u21B5'}
              </button>
            </div>
          )}
          <button
            className="icon"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().chain().focus().undo().run()}
            title="Undo"
          >
            {'\u21B6'}
          </button>
          <button
            className="icon"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().chain().focus().redo().run()}
            title="Redo"
          >
            {'\u21B7'}
          </button>
          <button className="icon" onClick={onExportPdf} title="Export PDF">
            {'\u{1F5A8}'}
          </button>
          <button
            className="icon"
            onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
            title="Clear formatting"
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
              }
            }}
          >
            <option value="paragraph">Normal text</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>
          <select
            className="pill select"
            value={fontFamily}
            onChange={(event) => onFontFamilyChange(event.target.value)}
          >
            {fonts.map((font) => (
              <option key={font} value={font}>
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
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </button>
          <button
            className={`icon ${editor?.isActive('italic') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </button>
          <button
            className={`icon ${editor?.isActive('underline') ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
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
          <button className="icon" onClick={onSetLink} title="Link">
            {'\u{1F517}'}
          </button>
          <button className="icon" onClick={onInsertImage} title="Insert image">
            {'\u{1F5BC}'}
          </button>
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
            {'\u25A4'}
          </button>
          <button
            className={`icon ${editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
          >
            {'\u25A3'}
          </button>
          <button
            className={`icon ${editor?.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
            onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
          >
            {'\u2630'}
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
          <button className="icon" onClick={onOutdent} title="Outdent">
            {'\u21E4'}
          </button>
          <button className="icon" onClick={onIndent} title="Indent">
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
        title={showTopbar ? 'Hide top bar' : 'Show top bar'}
      >
        {showTopbar ? '\u25B4' : '\u25BE'}
      </button>
    </div>
  );
}

export default DocsToolbar;
