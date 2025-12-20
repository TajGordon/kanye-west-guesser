// Shared section header parsing for both server (/api/parse) and client RawTextEditor.
// ESM module.

export const DEFAULT_VALID_TYPES = [
  'verse',
  'chorus',
  'pre-chorus',
  'bridge',
  'intro',
  'outro',
  'interlude',
  'break'
];

export const normalizeHeaderType = (typeStr) => {
  const normalized = String(typeStr || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/prechorus/, 'pre-chorus');

  // Synonyms used in real-world lyric sources (e.g. Genius)
  if (normalized === 'refrain') return 'chorus';
  if (normalized === 'hook') return 'chorus';
  if (normalized === 'post-chorus') return 'chorus';

  return normalized;
};

export const parseArtists = (artistString) => {
  if (!artistString) return [];

  const protectedNames = [
    'Tyler, The Creator'
  ];

  let working = String(artistString).trim();

  for (const name of protectedNames) {
    const token = name.replace(/,/g, '__COMMA__');
    working = working.split(name).join(token);
  }

  working = working
    .replace(/\s*&\s*/g, ',')
    .replace(/\s+and\s+/gi, ',');

  return working
    .split(/\s*,\s*/)
    .map(a => a.replace(/__COMMA__/g, ',').trim())
    .filter(a => a.length > 0);
};

export const generateSectionLabel = (section) => {
  const typeLabel = String(section.type || '')
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-');

  const artistPart = section.artists && section.artists.length > 0
    ? ` (${section.artists.join(', ')})`
    : '';

  const numberPart = section.number > 1 ? ` ${section.number}` : '';

  return `${typeLabel}${numberPart}${artistPart}`;
};

/**
 * Parse a single bracket header line into a canonical section object.
 *
 * Supports:
 * - [Verse 1]
 * - [Verse 1: Kanye West]
 * - [Intro: Kanye West]
 * - [Chorus: Mr. Hudson & Kid Cudi]
 *
 * Options:
 * - strictTypes: if true, returns null unless normalized type is in validTypes
 * - validTypes: list of canonical types
 * - autoNumber: if true, uses previousSections to assign section.number when missing
 */
export const parseSectionHeader = (line, previousSections = [], options = {}) => {
  const {
    strictTypes = false,
    validTypes = DEFAULT_VALID_TYPES,
    autoNumber = true
  } = options;

  const rawLine = String(line || '');

  // Unified header detector (same shape the RawTextEditor highlight expects)
  const match = rawLine.match(/^\[\s*([a-z](?:[a-z\s-]*[a-z])?)\s*(?:\s+(\d+))?\s*(?:[:\-]\s*(.+))?\s*\]$/i);
  if (!match) return null;

  const [, typeStr, numStr, extra] = match;
  const type = normalizeHeaderType(typeStr);

  if (strictTypes && !validTypes.includes(type)) {
    return null;
  }

  let number;
  let autoNumbered = false;

  if (numStr && /^\d+$/.test(numStr)) {
    number = parseInt(numStr, 10) || 1;
  } else if (autoNumber) {
    const sameTypeSections = previousSections.filter(s => s.type === type);
    number = sameTypeSections.length + 1;
    autoNumbered = true;
  } else {
    number = 1;
  }

  const section = {
    type,
    number,
    originalText: rawLine,
    artists: parseArtists(extra),
    ...(autoNumbered ? { autoNumbered: true } : {})
  };

  section.label = generateSectionLabel(section);
  return section;
};
