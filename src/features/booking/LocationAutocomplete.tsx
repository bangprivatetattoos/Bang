import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { LocationIcon } from '../video-feed/ui/icons';
import { searchStates, type UsState } from './usStates';

interface Props {
  /** The currently confirmed state, if one has been chosen. */
  value: UsState | null;
  onChange: (state: UsState | null) => void;
  city: string;
  onCityChange: (city: string) => void;
  /** Shown when the visitor tries to continue without a valid state. */
  error?: string;
}

const MAX_SUGGESTIONS = 6;

/**
 * U.S. state picker with an optional city or area.
 *
 * A custom combobox rather than a native datalist, so the suggestions carry
 * the sheet's own surface, borders and spacing instead of the operating
 * system's. Bookings are taken across the United States, so this resolves to
 * a real state: typing "London" or "Toronto" cannot pass as a supported
 * location. A city is invited but never required — the studio needs enough to
 * judge artist availability, not a street address.
 */
export default function LocationAutocomplete({ value, onChange, city, onCityChange, error }: Props) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const stateInputId = useId();
  const cityInputId = useId();
  const errorId = useId();

  const suggestions = useMemo(
    () => (open && !value ? searchStates(query, MAX_SUGGESTIONS) : []),
    [open, query, value],
  );

  useEffect(() => { setHighlighted(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const select = (state: UsState) => {
    onChange(state);
    setQuery(state.name);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) {
      if (event.key === 'Escape') setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted(index => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted(index => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(suggestions[highlighted]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-3">
      <div className="relative">
        <label htmlFor={stateInputId} className="text-[#626262] text-[9px] uppercase tracking-[0.26em] block mb-2">
          U.S. state
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#858585] pointer-events-none">
            <LocationIcon />
          </span>
          <input
            id={stateInputId}
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={suggestions.length ? `${listId}-${highlighted}` : undefined}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            placeholder="Search state"
            onChange={event => {
              setQuery(event.target.value);
              // Editing after a pick invalidates it until another is confirmed.
              if (value) onChange(null);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className="w-full pl-10 pr-3.5 py-3.5 min-h-11"
            style={{ borderColor: value ? 'rgba(244,243,239,0.55)' : undefined }}
          />
          {value && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#626262] text-[11px] tracking-widest pointer-events-none">
              {value.abbreviation}
            </span>
          )}
        </div>

        {suggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching U.S. states"
            className="feed-suggestions feed-scroll absolute left-0 right-0 top-full mt-2 z-20"
            style={{ boxShadow: '0 16px 40px rgba(0,0,0,0.55)' }}
          >
            {suggestions.map((state, index) => (
              <li
                key={state.abbreviation}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === highlighted}
                className="feed-suggestion"
              >
                <button
                  type="button"
                  // Pointer-down rather than click: the input's blur would
                  // otherwise close the list before the click registered.
                  onPointerDown={event => { event.preventDefault(); select(state); }}
                  onMouseEnter={() => setHighlighted(index)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 min-h-11 text-left hover:bg-[#1e1e1e] transition-colors"
                >
                  <span className="text-[#626262] flex-shrink-0"><LocationIcon /></span>
                  <span className="flex-1 min-w-0 text-[14px]">
                    {state.matchLength > 0 ? (
                      <>
                        <span className="text-[#f4f3ef] font-semibold">{state.name.slice(0, state.matchLength)}</span>
                        <span className="text-[#b5b5b2]">{state.name.slice(state.matchLength)}</span>
                      </>
                    ) : (
                      <span className="text-[#f4f3ef]">{state.name}</span>
                    )}
                  </span>
                  <span className="text-[#626262] text-[11px] tracking-widest flex-shrink-0">{state.abbreviation}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p id={errorId} aria-live="polite" className="text-[#d7cec1] text-[12px]">{error}</p>}

      <div>
        <label htmlFor={cityInputId} className="text-[#626262] text-[9px] uppercase tracking-[0.26em] block mb-2">
          City / area <span className="text-[#3a3a3a] normal-case tracking-normal">· optional</span>
        </label>
        <input
          id={cityInputId}
          value={city}
          onChange={event => onCityChange(event.target.value)}
          maxLength={80}
          autoComplete="address-level2"
          placeholder={value ? `e.g. a city in ${value.name}` : 'e.g. Miami'}
          className="w-full px-3.5 py-3.5 min-h-11"
        />
      </div>
    </div>
  );
}
