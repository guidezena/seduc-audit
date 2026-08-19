import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_RESULTS = 50;

function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function Autocomplete({ id, options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
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

  const matches = useMemo(() => {
    const query = normalize(value.trim());
    const filtered = query ? options.filter((option) => normalize(option).includes(query)) : options;
    return filtered.slice(0, MAX_RESULTS);
  }, [options, value]);

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
        }}
        onKeyDown={handleKeyDown}
      />
      {open && matches.length > 0 && (
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
        </ul>
      )}
    </div>
  );
}
