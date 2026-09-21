export interface UsState {
  name: string;
  abbreviation: string;
}

/**
 * The 50 U.S. states plus the District of Columbia.
 *
 * Held locally on purpose: this list does not change, and calling a paid
 * geocoding service to autocomplete fifty fixed strings would add a network
 * dependency, a key to protect and a failure mode for no benefit.
 */
export const US_STATES: UsState[] = [
  { name: 'Alabama', abbreviation: 'AL' },
  { name: 'Alaska', abbreviation: 'AK' },
  { name: 'Arizona', abbreviation: 'AZ' },
  { name: 'Arkansas', abbreviation: 'AR' },
  { name: 'California', abbreviation: 'CA' },
  { name: 'Colorado', abbreviation: 'CO' },
  { name: 'Connecticut', abbreviation: 'CT' },
  { name: 'Delaware', abbreviation: 'DE' },
  { name: 'District of Columbia', abbreviation: 'DC' },
  { name: 'Florida', abbreviation: 'FL' },
  { name: 'Georgia', abbreviation: 'GA' },
  { name: 'Hawaii', abbreviation: 'HI' },
  { name: 'Idaho', abbreviation: 'ID' },
  { name: 'Illinois', abbreviation: 'IL' },
  { name: 'Indiana', abbreviation: 'IN' },
  { name: 'Iowa', abbreviation: 'IA' },
  { name: 'Kansas', abbreviation: 'KS' },
  { name: 'Kentucky', abbreviation: 'KY' },
  { name: 'Louisiana', abbreviation: 'LA' },
  { name: 'Maine', abbreviation: 'ME' },
  { name: 'Maryland', abbreviation: 'MD' },
  { name: 'Massachusetts', abbreviation: 'MA' },
  { name: 'Michigan', abbreviation: 'MI' },
  { name: 'Minnesota', abbreviation: 'MN' },
  { name: 'Mississippi', abbreviation: 'MS' },
  { name: 'Missouri', abbreviation: 'MO' },
  { name: 'Montana', abbreviation: 'MT' },
  { name: 'Nebraska', abbreviation: 'NE' },
  { name: 'Nevada', abbreviation: 'NV' },
  { name: 'New Hampshire', abbreviation: 'NH' },
  { name: 'New Jersey', abbreviation: 'NJ' },
  { name: 'New Mexico', abbreviation: 'NM' },
  { name: 'New York', abbreviation: 'NY' },
  { name: 'North Carolina', abbreviation: 'NC' },
  { name: 'North Dakota', abbreviation: 'ND' },
  { name: 'Ohio', abbreviation: 'OH' },
  { name: 'Oklahoma', abbreviation: 'OK' },
  { name: 'Oregon', abbreviation: 'OR' },
  { name: 'Pennsylvania', abbreviation: 'PA' },
  { name: 'Rhode Island', abbreviation: 'RI' },
  { name: 'South Carolina', abbreviation: 'SC' },
  { name: 'South Dakota', abbreviation: 'SD' },
  { name: 'Tennessee', abbreviation: 'TN' },
  { name: 'Texas', abbreviation: 'TX' },
  { name: 'Utah', abbreviation: 'UT' },
  { name: 'Vermont', abbreviation: 'VT' },
  { name: 'Virginia', abbreviation: 'VA' },
  { name: 'Washington', abbreviation: 'WA' },
  { name: 'West Virginia', abbreviation: 'WV' },
  { name: 'Wisconsin', abbreviation: 'WI' },
  { name: 'Wyoming', abbreviation: 'WY' },
];

export interface StateMatch extends UsState {
  /** Length of the matched prefix, so the input's text can be highlighted. */
  matchLength: number;
  /** Whether the match was on the two-letter abbreviation. */
  viaAbbreviation: boolean;
}

/**
 * Prefix search over state names and abbreviations.
 *
 * Prefix rather than substring, so typing "new" offers New Hampshire, New
 * Jersey, New Mexico and New York rather than every state containing "new".
 * A word-start match is also allowed, so "carolina" finds both Carolinas.
 */
export function searchStates(query: string, limit = 6): StateMatch[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const startsWith: StateMatch[] = [];
  const wordStart: StateMatch[] = [];

  for (const state of US_STATES) {
    const name = state.name.toLowerCase();
    if (name.startsWith(trimmed)) {
      startsWith.push({ ...state, matchLength: trimmed.length, viaAbbreviation: false });
      continue;
    }
    if (state.abbreviation.toLowerCase() === trimmed) {
      startsWith.push({ ...state, matchLength: 0, viaAbbreviation: true });
      continue;
    }
    // "carolina" → North/South Carolina, "hampshire" → New Hampshire.
    const words = name.split(' ');
    if (words.slice(1).some(word => word.startsWith(trimmed))) {
      wordStart.push({ ...state, matchLength: 0, viaAbbreviation: false });
    }
  }

  return [...startsWith, ...wordStart].slice(0, limit);
}

/** Exact resolution, used to validate what is finally submitted. */
export function resolveState(value: string): UsState | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return (
    US_STATES.find(state => state.name.toLowerCase() === trimmed)
    ?? US_STATES.find(state => state.abbreviation.toLowerCase() === trimmed)
    ?? null
  );
}
