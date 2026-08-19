import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FilterIcon } from '../icons.jsx';

const PANEL_MARGIN = 16;

function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function ColumnFilterPanel({ fields, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState(fields[0].key);
  const [search, setSearch] = useState('');
  const [layoutHeight, setLayoutHeight] = useState(280);
  const [panelStyle, setPanelStyle] = useState({ width: 440, left: 0 });
  const rootRef = useRef(null);
  const footerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function recalculateLayout() {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const footerHeight = footerRef.current ? footerRef.current.offsetHeight : 0;
    const spaceBelow = window.innerHeight - rect.bottom - PANEL_MARGIN - footerHeight;
    setLayoutHeight(Math.max(0, Math.min(280, spaceBelow)));

    const width = Math.min(440, window.innerWidth - PANEL_MARGIN * 2);
    const overflowRight = rect.left + width - (window.innerWidth - PANEL_MARGIN);
    const left = overflowRight > 0 ? Math.max(-overflowRight, PANEL_MARGIN - rect.left) : 0;
    setPanelStyle({ width, left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    recalculateLayout();
    window.addEventListener('resize', recalculateLayout);
    return () => window.removeEventListener('resize', recalculateLayout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const allEmpty = fields.every((f) => value[f.key].length === 0);
    if (allEmpty) {
      setSearch('');
      setActiveField(fields[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const activeConfig = fields.find((f) => f.key === activeField);
  const activeSelected = value[activeField];

  const visibleOptions = useMemo(() => {
    const query = normalize(search.trim());
    return query ? activeConfig.options.filter((o) => normalize(o).includes(query)) : activeConfig.options;
  }, [activeConfig, search]);

  function toggleOption(option) {
    const selected = value[activeField];
    const next = selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option];
    onChange({ ...value, [activeField]: next });
  }

  function clearField(key) {
    onChange({ ...value, [key]: [] });
    setSearch('');
  }

  function clearAll() {
    const cleared = {};
    fields.forEach((f) => {
      cleared[f.key] = [];
    });
    onChange(cleared);
    setSearch('');
  }

  const totalActive = fields.reduce((sum, f) => sum + value[f.key].length, 0);

  return (
    <div className="column-filter" ref={rootRef}>
      <button
        type="button"
        className={`column-filter-trigger${totalActive > 0 ? ' has-active' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <FilterIcon />
        Filtros
        {totalActive > 0 && <span className="column-filter-badge">{totalActive}</span>}
      </button>

      {open && (
        <div className="column-filter-panel" style={{ width: panelStyle.width, left: panelStyle.left }}>
          <div className="column-filter-layout" style={{ height: layoutHeight }}>
            <div className="column-filter-tabs">
              {fields.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`column-filter-tab${f.key === activeField ? ' is-active' : ''}`}
                  onClick={() => {
                    setActiveField(f.key);
                    setSearch('');
                  }}
                >
                  {f.label}
                  {value[f.key].length > 0 && <span className="column-filter-tab-count">{value[f.key].length}</span>}
                </button>
              ))}
            </div>

            <div className="column-filter-body">
              <input
                className="column-filter-search"
                placeholder={`Buscar em ${activeConfig.label}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <ul className="column-filter-options">
                {visibleOptions.map((option) => (
                  <li key={option}>
                    <label className="column-filter-option">
                      <input
                        type="checkbox"
                        checked={activeSelected.includes(option)}
                        onChange={() => toggleOption(option)}
                      />
                      {option}
                    </label>
                  </li>
                ))}
                {visibleOptions.length === 0 && <li className="column-filter-empty">Nenhum valor encontrado.</li>}
              </ul>
            </div>
          </div>

          <div className="column-filter-footer" ref={footerRef}>
            <button type="button" className="column-filter-link" onClick={() => clearField(activeField)}>
              Limpar {activeConfig.label}
            </button>
            <button type="button" className="column-filter-link" onClick={clearAll}>
              Limpar tudo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
