/**
 * Question Type System
 * 
 * Defines all supported question types and their behavioral configuration.
 * This is the single source of truth for question type behavior across the system.
 */

export const QUESTION_TYPES = Object.freeze({
    FREE_TEXT: 'free-text',
    MULTIPLE_CHOICE: 'multiple-choice',
    TRUE_FALSE: 'true-false'
});

/**
 * Configuration for each question type's behavior
 * 
 * @property {boolean} allowsRetry - Can player submit multiple attempts?
 * @property {boolean} revealOnSubmit - Does player see if they're correct immediately?
 * @property {boolean} requiresChoices - Must question have a `choices` array?
 * @property {boolean} endOnAllCorrect - End round when all players answer correctly?
 * @property {boolean} endOnAllSubmitted - End round when all players have submitted (regardless of correctness)?
 * @property {number} maxChoices - Maximum number of choices (for MC questions)
 * @property {number} minChoices - Minimum number of choices (for MC questions)
 */
export const QUESTION_TYPE_CONFIG = Object.freeze({
    [QUESTION_TYPES.FREE_TEXT]: {
        allowsRetry: true,
        revealOnSubmit: true,
        requiresChoices: false,
        endOnAllCorrect: true,
        endOnAllSubmitted: false,
        maxChoices: 0,
        minChoices: 0
    },
    [QUESTION_TYPES.MULTIPLE_CHOICE]: {
        allowsRetry: false,
        revealOnSubmit: false,
        requiresChoices: true,
        endOnAllCorrect: false,
        endOnAllSubmitted: true,
        maxChoices: 6,
        minChoices: 2
    },
    [QUESTION_TYPES.TRUE_FALSE]: {
        allowsRetry: false,
        revealOnSubmit: false,
        requiresChoices: false, // Uses built-in true/false choices
        endOnAllCorrect: false,
        endOnAllSubmitted: true,
        maxChoices: 2,
        minChoices: 2
    }
});

/**
 * Built-in choices for true/false questions
 */
export const TRUE_FALSE_CHOICES = Object.freeze([
    { id: 'true', text: 'True' },
    { id: 'false', text: 'False' }
]);

/**
 * Check if a question type is valid
 * @param {string} type 
 * @returns {boolean}
 */
export function isValidQuestionType(type) {
    return Object.values(QUESTION_TYPES).includes(type);
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
