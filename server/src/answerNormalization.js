/**
 * Answer Normalization Module
 * 
 * Handles answer normalization with configurable strictness levels.
 * Used for comparing user input against correct answers.
 */

// ============================================================================
// Match Modes - How strictly to compare answers
// ============================================================================

export const MATCH_MODES = Object.freeze({
    /**
     * LOOSE: Most forgiving matching
     * - Case insensitive
     * - Strips ALL punctuation (apostrophes, hyphens, quotes, periods, etc.)
     * - Normalizes whitespace (multiple spaces → single space)
     * - Good for: lyrics, casual text where punctuation is inconsistent
     */
    LOOSE: 'loose',
    
    /**
     * NORMAL: Balanced matching (DEFAULT)
     * - Case insensitive
     * - Keeps significant punctuation (&, numbers, etc.)
     * - Strips minor punctuation (apostrophes, quotes)
     * - Normalizes whitespace
     * - Good for: song titles, album names, most general answers
     */
    NORMAL: 'normal',
    
    /**
     * STRICT: Exact matching
     * - Case insensitive (we always ignore case - too punishing otherwise)
     * - Keeps ALL punctuation
     * - Trims whitespace only
     * - Good for: specific phrases, proper nouns where punctuation matters
     */
    STRICT: 'strict',
    
    /**
     * EXACT: Fully exact matching
     * - Case SENSITIVE
     * - Keeps ALL punctuation
     * - Trims whitespace only
     * - Good for: rare cases where exact match is required
     */
    EXACT: 'exact'
});

// Default match mode
export const DEFAULT_MATCH_MODE = MATCH_MODES.NORMAL;

// ============================================================================
// Punctuation Categories
// ============================================================================

// Punctuation that is almost always insignificant
const MINOR_PUNCTUATION = /[''"`.,!?;:]/g;

// Punctuation to strip in LOOSE mode (everything except alphanumeric and spaces)
const ALL_PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

// Whitespace normalization
const MULTIPLE_SPACES = /\s+/g;

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Normalize an answer for comparison
 * @param {string} text - The text to normalize
 * @param {string} matchMode - One of MATCH_MODES values
 * @returns {string} - Normalized text
 */
export function normalizeForComparison(text, matchMode = DEFAULT_MATCH_MODE) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    // Validate matchMode, fallback to default if invalid
    if (!isValidMatchMode(matchMode)) {
        console.warn(`Invalid matchMode "${matchMode}", falling back to "${DEFAULT_MATCH_MODE}"`);
        matchMode = DEFAULT_MATCH_MODE;
    }
    
    let normalized = text.trim();
    
    switch (matchMode) {
        case MATCH_MODES.EXACT:
            // Only trim whitespace, keep everything else
            return normalized;
            
        case MATCH_MODES.STRICT:
            // Case insensitive, keep all punctuation
            return normalized.toLowerCase();
            
        case MATCH_MODES.LOOSE:
            // Strip all punctuation, normalize whitespace
            return normalized
                .toLowerCase()
                .replace(ALL_PUNCTUATION, '')
                .replace(MULTIPLE_SPACES, ' ')
                .trim();
            
        case MATCH_MODES.NORMAL:
        default:
            // Strip minor punctuation, keep significant ones
            return normalized
                .toLowerCase()
                .replace(MINOR_PUNCTUATION, '')
                .replace(MULTIPLE_SPACES, ' ')
                .trim();
    }
}

/**
 * Check if two answers match given a match mode
 * @param {string} userAnswer - The user's input
 * @param {string} correctAnswer - The correct answer
 * @param {string} matchMode - Match mode to use
 * @returns {boolean}
 */
export function answersMatch(userAnswer, correctAnswer, matchMode = DEFAULT_MATCH_MODE) {
    const normalizedUser = normalizeForComparison(userAnswer, matchMode);
    const normalizedCorrect = normalizeForComparison(correctAnswer, matchMode);
    
    return normalizedUser === normalizedCorrect;
}

/**
 * Check if user answer matches any of the accepted answers
 * @param {string} userAnswer - The user's input
 * @param {string[]} acceptedAnswers - Array of accepted answers
 * @param {string} matchMode - Match mode to use
 * @returns {{ matches: boolean, matchedAnswer: string|null }}
 */
export function findMatchingAnswer(userAnswer, acceptedAnswers, matchMode = DEFAULT_MATCH_MODE) {
    if (!userAnswer || !acceptedAnswers || !Array.isArray(acceptedAnswers)) {
        return { matches: false, matchedAnswer: null };
    }
    
    const normalizedUser = normalizeForComparison(userAnswer, matchMode);
    
    for (const answer of acceptedAnswers) {
        const normalizedAnswer = normalizeForComparison(answer, matchMode);
        if (normalizedUser === normalizedAnswer) {
            return { matches: true, matchedAnswer: answer };
        }
    }
    
    return { matches: false, matchedAnswer: null };
}

/**
 * Build a normalized alias map for fast lookup
 * @param {string[]} answers - Array of accepted answers
 * @param {string} matchMode - Match mode to use
 * @returns {Map<string, string>} - Map from normalized → original answer
 */
export function buildAliasMap(answers, matchMode = DEFAULT_MATCH_MODE) {
    const map = new Map();
    
    for (const answer of answers) {
        const normalized = normalizeForComparison(answer, matchMode);
        if (normalized && !map.has(normalized)) {
            map.set(normalized, answer);
        }
    }
    
    return map;
}

/**
 * Get the recommended match mode for a generator type
 * @param {string} generatorType 
 * @returns {string}
 */
export function getRecommendedMatchMode(generatorType) {
    // Lyrics-based generators should use loose matching
    const looseGenerators = [
        'fill-missing-word',
        'next-line'
    ];
    
    // These need more precise matching
    const strictGenerators = [
        // None currently
    ];
    
    if (looseGenerators.includes(generatorType)) {
        return MATCH_MODES.LOOSE;
    }
    
    if (strictGenerators.includes(generatorType)) {
        return MATCH_MODES.STRICT;
    }
    
    // Default to normal for most things (songs, albums, artists, years)
    return MATCH_MODES.NORMAL;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a match mode is valid
 * @param {string} mode 
 * @returns {boolean}
 */
export function isValidMatchMode(mode) {
    return Object.values(MATCH_MODES).includes(mode);
}

/**
 * Get description of a match mode
 * @param {string} mode 
 * @returns {string}
 */
export function getMatchModeDescription(mode) {
    const descriptions = {
        [MATCH_MODES.LOOSE]: 'Ignores case and all punctuation',
        [MATCH_MODES.NORMAL]: 'Ignores case and minor punctuation',
        [MATCH_MODES.STRICT]: 'Ignores case only',
        [MATCH_MODES.EXACT]: 'Exact match required'
    };
    return descriptions[mode] || descriptions[MATCH_MODES.NORMAL];
}

export default {
    MATCH_MODES,
    DEFAULT_MATCH_MODE,
    normalizeForComparison,
    answersMatch,
    findMatchingAnswer,
    buildAliasMap,
    getRecommendedMatchMode,
    isValidMatchMode,
    getMatchModeDescription
};
