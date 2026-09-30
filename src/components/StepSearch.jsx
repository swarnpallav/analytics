import { useEffect, useMemo, useRef, useState } from 'react';

// Long lists (thousands of pages) are cut off; typing narrows them down.
const MAX_OPTIONS = 100;
const GROUP_LABELS = { event: 'Events', page: 'Pages / screens' };

// Typeahead for adding funnel steps: type to filter events and pages, then click or press Enter to add.
export default function StepSearch({ events, pages, selected, onAdd }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const taken = new Set(selected.map(s => `${s.type}:${s.value}`));
    return [
      ...events.map(value => ({ type: 'event', value })),
      ...pages.map(value => ({ type: 'page', value })),
    ].filter(o => !taken.has(`${o.type}:${o.value}`) && (!q || o.value.toLowerCase().includes(q)));
  }, [events, pages, selected, query]);

  const shown = matches.slice(0, MAX_OPTIONS);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const add = (option) => {
    if (!option) return;
    onAdd(option);
    setQuery('');
    setActive(0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive(i => Math.min(i + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open) add(shown[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="step-search">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="step-search-list"
        aria-activedescendant={open && shown[active] ? `step-option-${active}` : undefined}
        value={query}
        placeholder="Search events or pages to add a step…"
        onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="step-search-list" id="step-search-list" role="listbox" ref={listRef}>
          {shown.length === 0 && <li className="step-search-empty">No matching events or pages</li>}
          {shown.map((o, i) => (
            <li key={`${o.type}:${o.value}`} role="presentation">
              {(i === 0 || shown[i - 1].type !== o.type) && <div className="step-search-group">{GROUP_LABELS[o.type]}</div>}
              <div
                id={`step-option-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                className={`step-search-option ${i === active ? 'active' : ''}`}
                // mousedown, not click: click would fire after the input's blur has already closed the list
                onMouseDown={e => { e.preventDefault(); add(o); }}
                onMouseEnter={() => setActive(i)}
              >
                {o.value}
              </div>
            </li>
          ))}
          {matches.length > shown.length && (
            <li className="step-search-empty">{matches.length - shown.length} more; keep typing to narrow down</li>
          )}
        </ul>
      )}
    </div>
  );
}
