import { useEffect, useMemo, useRef, useState } from 'react';

const LETTERS = ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const DROPDOWN_MARGIN = 16;

function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function firstLetterBucket(text) {
  const char = normalize(text).trim()[0] || '';
  return /[a-z]/.test(char) ? char.toUpperCase() : '#';
}

export default function Autocomplete({ id, options, value, onChange, placeholder, matchText = (option) => option, showLetterBar = false }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [letterFilter, setLetterFilter] = useState(null);
  const [maxHeight, setMaxHeight] = useState(280);
  const rootRef = useRef(null);

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
    const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_MARGIN;
    setMaxHeight(Math.max(0, spaceBelow));
  }

  useEffect(() => {
    if (!open) return;
    recalculateLayout();
    window.addEventListener('resize', recalculateLayout);
    return () => window.removeEventListener('resize', recalculateLayout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const matchesByQuery = useMemo(() => {
    const query = normalize(value.trim());
    return query ? options.filter((option) => normalize(matchText(option)).includes(query)) : options;
  }, [options, value, matchText]);

  const availableLetters = useMemo(() => {
    return new Set(matchesByQuery.map((option) => firstLetterBucket(option)));
  }, [matchesByQuery]);

  const matches = useMemo(() => {
    if (!letterFilter) return matchesByQuery;
    return matchesByQuery.filter((option) => firstLetterBucket(option) === letterFilter);
  }, [matchesByQuery, letterFilter]);

  function selectOption(option) {
    onChange(option);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (highlighted >= 0 && matches[highlighted]) {
        e.preventDefault();
        selectOption(matches[highlighted]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlighted(-1);
    }
  }

  return (
    <div className="autocomplete" ref={rootRef}>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(-1);
          setLetterFilter(null);
        }}
        onKeyDown={handleKeyDown}
      />
      {open && (matches.length > 0 || showLetterBar) && (
        <div className="autocomplete-panel" style={{ maxHeight }}>
          {showLetterBar && (
            <div className="autocomplete-letterbar" role="tablist" aria-label="Filtrar por letra">
              {LETTERS.map((letter) => {
                const available = availableLetters.has(letter);
                const active = letterFilter === letter;
                return (
                  <button
                    key={letter}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={!available}
                    className={`autocomplete-letter${active ? ' is-active' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setLetterFilter(active ? null : letter);
                      setHighlighted(-1);
                    }}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          )}
          <ul className="autocomplete-list" role="listbox">
            {matches.map((option, i) => (
              <li
                key={option}
                role="option"
                aria-selected={i === highlighted}
                className={`autocomplete-option${i === highlighted ? ' is-highlighted' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(option);
                }}
                onMouseEnter={() => setHighlighted(i)}
              >
                {option}
              </li>
            ))}
            {matches.length === 0 && <li className="autocomplete-empty">Nenhum resultado para esta letra.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
