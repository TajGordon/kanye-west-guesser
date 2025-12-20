/**
 * Modern Data Model Utilities
 * 
 * Converts between line-based storage format (JSON) and section-based
 * rendering format (in-memory), allowing clean separation of concerns:
 * - Storage: Line-based for backward compatibility and import/export
 * - Rendering: Section-based for proper grouping and styling
 */

/**
 * Convert line-based lyrics to section-based structure
 * 
 * Line-based (storage):
 *   [{content, section: {type, number}, voice, meta: {blank?}}]
 * 
 * Section-based (rendering):
 *   [{type, number, lines: [{content, voice, meta}]}]
 * 
 * Benefits:
 * - Blank lines automatically skipped (meta.blank = true)
 * - Clear section boundaries
 * - Proper grouping by type AND number
 * - Better color consistency (type determines color, number just labels)
 */
export function linesToSections(lyrics) {
  if (!lyrics || !Array.isArray(lyrics)) return [];

  const sections = [];
  let currentSection = null;

  lyrics.forEach((line) => {
    // Skip blank lines - they're visual separators, not content
    if (line.meta?.blank) return;

    // Require valid section for non-blank lines
    if (!line.section) return;

    const { type, number } = line.section;
    const sectionKey = `${type}-${number}`;

    // Start new section when type or number changes
    if (!currentSection || currentSection.key !== sectionKey) {
      currentSection = {
        key: sectionKey,
        type,
        number,
        lines: [],
      };
      sections.push(currentSection);
    }

    // Add line to current section (preserve original line structure including section)
    currentSection.lines.push({
      line_number: line.line_number,
      content: line.content,
      voice: line.voice,
      meta: line.meta,
      section: line.section,  // ← PRESERVE section property so form inputs work
    });
  });

  return sections;
}

/**
 * Convert section-based structure back to raw text
 * Useful for reconstructing raw text view from structured editor
 */
export function sectionsToRawText(sections, blankLinesBetween = 2) {
  if (!sections || !Array.isArray(sections)) return '';

  const formatted = sections.map((section) => {
    // Format section header: "[Verse 1]", "[Chorus 1]", etc.
    const typeFormatted = section.type.charAt(0).toUpperCase() + section.type.slice(1);
    const header = `[${typeFormatted} ${section.number}]`;

    // Join lines in section
    const lineContent = section.lines.map((line) => line.content).join('\n');

    return `${header}\n${lineContent}`;
  });

  // Join sections with blank lines
  return formatted.join('\n'.repeat(blankLinesBetween));
}

/**
 * Normalize section data to ensure type and number are always present
 */
export function normalizeSection(section) {
  if (!section) return null;

  return {
    type: String(section.type || '').toLowerCase().trim() || 'unknown',
    number: parseInt(section.number, 10) || 1,
    originalText: section.originalText || null,
  };
}

/**
 * Create a color key for consistent styling
 * Only uses type (not number), since all verses should be same color
 */
export function getSectionColorKey(section) {
  if (!section || !section.type) return 'unknown';
  return String(section.type).toLowerCase();
}

/**
 * Group lines with metadata about the grouping
 * Returns detailed grouping info for debugging and analysis
 */
export function analyzeLineStructure(lyrics) {
  if (!lyrics || !Array.isArray(lyrics)) return { sections: [], stats: {} };

  const sections = linesToSections(lyrics);
  const stats = {
    totalLines: lyrics.length,
    blankLines: lyrics.filter((l) => l.meta?.blank).length,
    contentLines: lyrics.filter((l) => !l.meta?.blank).length,
    sectionCount: sections.length,
    sectionBreakdown: {},
  };

  // Count lines per section
  sections.forEach((section) => {
    const key = `${section.type}-${section.number}`;
    stats.sectionBreakdown[key] = section.lines.length;
  });

  return { sections, stats };
}

/**
 * Detect if there are any structural issues in the lyrics
 */
export function validateLyricStructure(lyrics) {
  const issues = [];

  if (!lyrics || !Array.isArray(lyrics)) {
    issues.push('Lyrics must be an array');
    return issues;
  }

  let lastSectionKey = null;

  lyrics.forEach((line, idx) => {
    // Skip blank lines for section analysis
    if (line.meta?.blank) return;

    if (!line.section) {
      issues.push(`Line ${idx}: Missing section data`);
      return;
    }

    const { type, number } = line.section;

    if (!type) {
      issues.push(`Line ${idx}: Missing section type`);
    }

    if (number === undefined || number === null) {
      issues.push(`Line ${idx}: Missing section number`);
    }

    const sectionKey = `${type}-${number}`;

    // Warn if sections are out of order (not grouped)
    if (lastSectionKey && lastSectionKey !== sectionKey) {
      // This is expected - sections can interleave (verse/chorus/verse pattern)
      // Only warn if we see the exact same section again
      // (which suggests data corruption or parsing error)
    }

    lastSectionKey = sectionKey;
  });

  return issues;
}

export default {
  linesToSections,
  sectionsToRawText,
  normalizeSection,
  getSectionColorKey,
  analyzeLineStructure,
  validateLyricStructure,
};
