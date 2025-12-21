/**
 * Question Types - Client-side constants
 * Must match server/src/questionTypes.js
 */

export const QUESTION_TYPES = Object.freeze({
  FREE_TEXT: 'free-text',
  MULTIPLE_CHOICE: 'multiple-choice',
  TRUE_FALSE: 'true-false'
});

/**
 * Configuration for UI behavior based on question type
 */
export const QUESTION_TYPE_UI_CONFIG = Object.freeze({
  [QUESTION_TYPES.FREE_TEXT]: {
    inputType: 'text',
    showResultImmediately: true,
    canRetry: true,
    label: 'Type your answer'
  },
  [QUESTION_TYPES.MULTIPLE_CHOICE]: {
    inputType: 'choice',
    showResultImmediately: false,
    canRetry: false,
    label: 'Select an answer'
  },
  [QUESTION_TYPES.TRUE_FALSE]: {
    inputType: 'choice',
    showResultImmediately: false,
    canRetry: false,
    label: 'True or False?'
  }
});

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
