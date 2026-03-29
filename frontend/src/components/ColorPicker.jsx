import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function ColorPicker({ value, onChange, palette }) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event) => {
      if (!event.target.closest('.color-picker') && !event.target.closest('.color-panel')) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 8;
    const left = rect.left + window.scrollX;
    setPanelPos({ top, left });
  }, [open]);

  return (
    <div className="color-picker">
      <button
        className="color-trigger"
        onClick={() => setOpen((prev) => !prev)}
        title="Text color"
        type="button"
        ref={triggerRef}
      >
        <span className="color-swatch" style={{ background: value }} />
        <span className="color-caret">?</span>
      </button>
      {open &&
        createPortal(
          <div
            className="color-panel"
            role="dialog"
            aria-label="Text color"
            style={{ top: panelPos.top, left: panelPos.left }}
          >
            <div className="color-grid">
              {palette.map((row, rowIndex) => (
                <div className="color-row" key={`row-${rowIndex}`}>
                  {row.map((color) => (
                    <button
                      key={color}
                      className={`color-dot ${
                        color.toLowerCase() === value.toLowerCase() ? 'active' : ''
                      }`}
                      style={{ background: color }}
                      onClick={() => onChange(color)}
                      title={color}
                      type="button"
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="color-custom">
              <div className="color-custom-label">Custom</div>
              <label className="color-custom-input">
                <span className="color-custom-plus">+</span>
                <input
                  type="color"
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                  aria-label="Custom color"
                />
              </label>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default ColorPicker;
