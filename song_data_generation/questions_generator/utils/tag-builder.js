/**
 * Tag Builder
 * 
 * Consistent tag generation for questions.
 * All tags use namespace prefixes for clean filtering.
 */

/**
 * Create a namespaced tag
 * @param {string} namespace 
 * @param {string} value 
 * @returns {string}
 */
export function tag(namespace, value) {
  const slug = String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${namespace}:${slug}`;
}

/**
 * Generator type tag
 */
export function genTag(generatorType) {
  return tag('gen', generatorType);
}

/**
 * Input mode tag
 */
export function inputTag(inputMode) {
  return tag('input', inputMode);
}

/**
 * Prompt variant tag
 */
export function promptTag(variant) {
  return tag('prompt', variant);
}

/**
 * Song tag
 */
export function songTag(songTitle) {
  return tag('song', songTitle);
}

/**
 * Album tag
 */
export function albumTag(albumName) {
  return tag('album', albumName);
}

/**
 * Artist tag
 */
export function artistTag(artistName) {
  return tag('artist', artistName);
}

/**
 * Year tag
 */
export function yearTag(year) {
  return tag('year', String(year));
}

/**
 * Section type tag (verse, chorus, etc.)
 */
export function sectionTag(sectionType) {
  return tag('section', sectionType);
}

/**
 * Voice/singer tag
 */
export function voiceTag(voiceName) {
  return tag('voice', voiceName);
}

/**
 * Difficulty tag
 */
export function difficultyTag(level) {
  return tag('difficulty', level);
}

/**
 * Build a complete tag set for a question
 * @param {object} options
 * @returns {string[]}
 */
export function buildTagSet({
  generatorType,
  inputMode,
  promptVariant,
  song,
  album,
  artist,
  artists = [],
  year,
  section,
  voice,
  difficulty,
  extraTags = []
}) {
  const tags = [];
  
  if (generatorType) tags.push(genTag(generatorType));
  if (inputMode) tags.push(inputTag(inputMode));
  if (promptVariant) tags.push(promptTag(promptVariant));
  if (song) tags.push(songTag(song));
  if (album) tags.push(albumTag(album));
  if (artist) tags.push(artistTag(artist));
  
  // Multiple artists
  for (const a of artists) {
    const t = artistTag(a);
    if (!tags.includes(t)) tags.push(t);
  }
  
  if (year) tags.push(yearTag(year));
  if (section) tags.push(sectionTag(section));
  if (voice) tags.push(voiceTag(voice));
  if (difficulty) tags.push(difficultyTag(difficulty));
  
  // Extra custom tags
  for (const t of extraTags) {
    if (t && !tags.includes(t)) tags.push(t);
  }
  
  return tags;
}

/**
 * Parse a tag into namespace and value
 * @param {string} tagStr 
 * @returns {{ namespace: string, value: string } | null}
 */
export function parseTag(tagStr) {
  const idx = tagStr.indexOf(':');
  if (idx === -1) return null;
  return {
    namespace: tagStr.slice(0, idx),
    value: tagStr.slice(idx + 1)
  };
}
