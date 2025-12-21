/**
 * Question Type System
 * 
 * Defines all supported question/input types and their behavioral configuration.
 * This is the single source of truth for question type behavior across the system.
 */

// ============================================================================
// Input Modes - How players interact with the question
// ============================================================================

export const QUESTION_TYPES = Object.freeze({
    // Classic types
    FREE_TEXT: 'free-text',
    MULTIPLE_CHOICE: 'multiple-choice',
    TRUE_FALSE: 'true-false',
    
    // New types
    MULTI_ENTRY: 'multi-entry',      // Wordle-style: enter multiple answers one at a time
    NUMERIC: 'numeric',               // Number input (for year guessing, etc.)

    ORDERED_LIST: 'ordered-list'      // Arrange items in correct order
});

// ============================================================================
// Scoring Modes - How answers are evaluated and scored
// ============================================================================

export const SCORING_MODES = Object.freeze({
    STANDARD: 'standard',             // Correct = points, wrong = 0, speed bonus
    PROXIMITY: 'proximity',           // Closer to correct = more points (for numeric)
    MULTI_ENTRY: 'multi-entry',       // Points per correct entry
    FIRST_ONLY: 'first-only',         // Only first correct answer gets points
    RANKED: 'ranked'                  // Points based on order of correct answers
});

// ============================================================================
// Configuration for each question type's behavior
// ============================================================================

/**
 * @property {boolean} allowsRetry - Can player submit multiple attempts?
 * @property {boolean} revealOnSubmit - Does player see if they're correct immediately?
 * @property {boolean} requiresChoices - Must question have a `choices` array?
 * @property {boolean} endOnAllCorrect - End round when all players answer correctly?
 * @property {boolean} endOnAllSubmitted - End round when all players have submitted?
 * @property {number} maxChoices - Maximum number of choices (for MC questions)
 * @property {number} minChoices - Minimum number of choices (for MC questions)
 * @property {string} inputType - UI input type: 'text', 'choice', 'multi-entry', 'number', 'slider', 'order'
 * @property {string} defaultScoringMode - Default scoring mode for this type
 * @property {boolean} supportsPartialCredit - Can give partial points?
 * @property {number} maxEntries - Max entries for multi-entry (0 = unlimited)
 */
export const QUESTION_TYPE_CONFIG = Object.freeze({
    [QUESTION_TYPES.FREE_TEXT]: {
        allowsRetry: true,
        revealOnSubmit: true,
        requiresChoices: false,
        endOnAllCorrect: true,
        endOnAllSubmitted: false,
        maxChoices: 0,
        minChoices: 0,
        inputType: 'text',
        defaultScoringMode: SCORING_MODES.STANDARD,
        supportsPartialCredit: false,
        maxEntries: 0
    },
    [QUESTION_TYPES.MULTIPLE_CHOICE]: {
        allowsRetry: false,
        revealOnSubmit: false,
        requiresChoices: true,
        endOnAllCorrect: false,
        endOnAllSubmitted: true,
        maxChoices: 6,
        minChoices: 2,
        inputType: 'choice',
        defaultScoringMode: SCORING_MODES.STANDARD,
        supportsPartialCredit: false,
        maxEntries: 0
    },
    [QUESTION_TYPES.TRUE_FALSE]: {
        allowsRetry: false,
        revealOnSubmit: false,
        requiresChoices: false, // Uses built-in true/false choices
        endOnAllCorrect: false,
        endOnAllSubmitted: true,
        maxChoices: 2,
        minChoices: 2,
        inputType: 'choice',
        defaultScoringMode: SCORING_MODES.STANDARD,
        supportsPartialCredit: false,
        maxEntries: 0
    },
    [QUESTION_TYPES.MULTI_ENTRY]: {
        allowsRetry: false,           // Each entry is final, but can add more
        revealOnSubmit: true,         // Shows ✓/✗ per entry immediately
        requiresChoices: false,
        endOnAllCorrect: false,       // Ends when all found OR max guesses OR timer
        endOnAllSubmitted: false,
        maxChoices: 0,
        minChoices: 0,
        inputType: 'multi-entry',
        defaultScoringMode: SCORING_MODES.MULTI_ENTRY,
        supportsPartialCredit: true,
        maxEntries: 10                // Default max guesses
    },
    [QUESTION_TYPES.NUMERIC]: {
        allowsRetry: false,
        revealOnSubmit: false,        // Wait for all players, then rank
        requiresChoices: false,
        endOnAllCorrect: false,
        endOnAllSubmitted: true,
        maxChoices: 0,
        minChoices: 0,
        inputType: 'number',
        defaultScoringMode: SCORING_MODES.PROXIMITY,
        supportsPartialCredit: true,
        maxEntries: 0,
        // Numeric-specific defaults
        minValue: 1900,
        maxValue: 2030,
        step: 1
    },
    [QUESTION_TYPES.SLIDER]: {
        allowsRetry: false,
        revealOnSubmit: false,
        requiresChoices: false,
        endOnAllCorrect: false,
        endOnAllSubmitted: true,
        maxChoices: 0,
        minChoices: 0,
        inputType: 'slider',
        defaultScoringMode: SCORING_MODES.PROXIMITY,
        supportsPartialCredit: true,
        maxEntries: 0,
        minValue: 0,
        maxValue: 100,
        step: 1
    },
    [QUESTION_TYPES.ORDERED_LIST]: {
        allowsRetry: false,
        revealOnSubmit: false,
        requiresChoices: true,        // Items to order
        endOnAllCorrect: false,
        endOnAllSubmitted: true,
        maxChoices: 10,
        minChoices: 2,
        inputType: 'order',
        defaultScoringMode: SCORING_MODES.STANDARD,
        supportsPartialCredit: true,
        maxEntries: 0
    }
});

/**
 * Built-in choices for true/false questions
 */
export const TRUE_FALSE_CHOICES = Object.freeze([
    { id: 'true', text: 'True' },
    { id: 'false', text: 'False' }
]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a question type is valid
 * @param {string} type 
 * @returns {boolean}
 */
export function isValidQuestionType(type) {
    return Object.values(QUESTION_TYPES).includes(type);
}

/**
 * Check if a scoring mode is valid
 * @param {string} mode 
 * @returns {boolean}
 */
export function isValidScoringMode(mode) {
    return Object.values(SCORING_MODES).includes(mode);
}

/**
 * Get configuration for a question type
 * @param {string} type 
 * @returns {object|null}
 */
export function getQuestionTypeConfig(type) {
    return QUESTION_TYPE_CONFIG[type] || null;
}

/**
 * Get the default question type (for backwards compatibility)
 * @returns {string}
 */
export function getDefaultQuestionType() {
    return QUESTION_TYPES.FREE_TEXT;
}

/**
 * Get the default scoring mode for a question type
 * @param {string} type 
 * @returns {string}
 */
export function getDefaultScoringMode(type) {
    const config = getQuestionTypeConfig(type);
    return config?.defaultScoringMode || SCORING_MODES.STANDARD;
}

/**
 * Determine if a question type allows retry after wrong answer
 * @param {string} type 
 * @returns {boolean}
 */
export function typeAllowsRetry(type) {
    const config = getQuestionTypeConfig(type);
    return config?.allowsRetry ?? false;
}

/**
 * Determine if answers are revealed immediately on submit
 * @param {string} type 
 * @returns {boolean}
 */
export function typeRevealsOnSubmit(type) {
    const config = getQuestionTypeConfig(type);
    return config?.revealOnSubmit ?? false;
}

/**
 * Determine if round should end when all players have submitted
 * @param {string} type 
 * @returns {boolean}
 */
export function typeEndsOnAllSubmitted(type) {
    const config = getQuestionTypeConfig(type);
    return config?.endOnAllSubmitted ?? false;
}

/**
 * Determine if round should end when all players answered correctly
 * @param {string} type 
 * @returns {boolean}
 */
export function typeEndsOnAllCorrect(type) {
    const config = getQuestionTypeConfig(type);
    return config?.endOnAllCorrect ?? false;
}

/**
 * Get the input type for UI rendering
 * @param {string} type 
 * @returns {string}
 */
export function getInputType(type) {
    const config = getQuestionTypeConfig(type);
    return config?.inputType || 'text';
}

/**
 * Check if type supports partial credit
 * @param {string} type 
 * @returns {boolean}
 */
export function typeSupportsPartialCredit(type) {
    const config = getQuestionTypeConfig(type);
    return config?.supportsPartialCredit ?? false;
}

/**
 * Get max entries for multi-entry questions
 * @param {string} type 
 * @returns {number}
 */
export function getMaxEntries(type) {
    const config = getQuestionTypeConfig(type);
    return config?.maxEntries ?? 0;
}
