/**
 * Question Types - Client-side constants
 * Must match server/src/questionTypes.js
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
// Configuration for UI behavior based on question type
// ============================================================================

export const QUESTION_TYPE_UI_CONFIG = Object.freeze({
  [QUESTION_TYPES.FREE_TEXT]: {
    inputType: 'text',
    showResultImmediately: true,
    canRetry: true,
    label: 'Type your answer',
    placeholder: 'Type your guess...'
  },
  [QUESTION_TYPES.MULTIPLE_CHOICE]: {
    inputType: 'choice',
    showResultImmediately: false,
    canRetry: false,
    label: 'Select an answer',
    placeholder: null
  },
  [QUESTION_TYPES.TRUE_FALSE]: {
    inputType: 'choice',
    showResultImmediately: false,
    canRetry: false,
    label: 'True or False?',
    placeholder: null
  },
  [QUESTION_TYPES.MULTI_ENTRY]: {
    inputType: 'multi-entry',
    showResultImmediately: true,     // Each entry shows result
    canRetry: false,                 // But can add more entries
    label: 'Enter all answers',
    placeholder: 'Type an answer and press Enter...'
  },
  [QUESTION_TYPES.NUMERIC]: {
    inputType: 'number',
    showResultImmediately: false,    // Wait for all players
    canRetry: false,
    label: 'Enter a number',
    placeholder: 'Enter your guess...'
  },
  [QUESTION_TYPES.ORDERED_LIST]: {
    inputType: 'order',
    showResultImmediately: false,
    canRetry: false,
    label: 'Arrange in correct order',
    placeholder: null
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get UI config for a question type
 */
export function getQuestionUIConfig(type) {
  return QUESTION_TYPE_UI_CONFIG[type] || QUESTION_TYPE_UI_CONFIG[QUESTION_TYPES.FREE_TEXT];
}

/**
 * Check if question type uses choice-based input
 */
export function isChoiceBasedQuestion(type) {
  const config = getQuestionUIConfig(type);
  return config.inputType === 'choice';
}

/**
 * Check if result is shown immediately after submission
 */
export function showsResultImmediately(type) {
  const config = getQuestionUIConfig(type);
  return config.showResultImmediately;
}

/**
 * Get the input type for a question type
 */
export function getInputType(type) {
  const config = getQuestionUIConfig(type);
  return config.inputType;
}

/**
 * Check if type supports multiple entries
 */
export function isMultiEntryQuestion(type) {
  return type === QUESTION_TYPES.MULTI_ENTRY;
}

/**
 * Check if type uses numeric input
 */
export function isNumericQuestion(type) {
  return type === QUESTION_TYPES.NUMERIC;
}

/**
 * Check if type uses ordered list input
 */
export function isOrderedListQuestion(type) {
  return type === QUESTION_TYPES.ORDERED_LIST;
}

/**
 * Get placeholder text for input
 */
export function getPlaceholder(type) {
  const config = getQuestionUIConfig(type);
  return config.placeholder || 'Type your answer...';
}

/**
 * Get label for input
 */
export function getInputLabel(type) {
  const config = getQuestionUIConfig(type);
  return config.label || 'Your answer';
}
