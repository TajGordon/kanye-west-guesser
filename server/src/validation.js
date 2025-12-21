/**
 * Input Validation Utilities
 * 
 * All validation happens server-side. These utilities ensure data integrity
 * and protect against malformed or malicious input.
 */

import {
    QUESTION_TYPES,
    QUESTION_TYPE_CONFIG,
    isValidQuestionType,
    getQuestionTypeConfig,
    TRUE_FALSE_CHOICES
} from './questionTypes.js';

// ============================================================================
// Constants
// ============================================================================

const MAX_ANSWER_LENGTH = 500;
const MAX_CHOICE_ID_LENGTH = 50;
const MAX_QUESTION_TITLE_LENGTH = 500;
const MAX_QUESTION_TEXT_LENGTH = 2000;
const MAX_CHOICE_TEXT_LENGTH = 200;
const MAX_CHOICES = 10;

// ============================================================================
// Text Sanitization
// ============================================================================

/**
 * Sanitize a text string for safe storage and display
 * @param {any} value 
 * @param {number} maxLength 
 * @returns {string}
 */
export function sanitizeText(value, maxLength = MAX_ANSWER_LENGTH) {
    if (value == null) return '';
    const str = String(value).trim();
    if (str.length > maxLength) {
        return str.slice(0, maxLength);
    }
    return str;
}

/**
 * Normalize text for comparison (lowercase, trimmed)
 * @param {string} value 
 * @returns {string}
 */
export function normalizeText(value) {
    return sanitizeText(value).toLowerCase();
}

// ============================================================================
// Submission Validation
// ============================================================================

/**
 * Validate a free-text answer submission
 * @param {object} payload - { answer: string }
 * @returns {{ valid: boolean, error?: string, sanitized?: { answerText: string } }}
 */
export function validateFreeTextSubmission(payload) {
    if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Invalid submission payload' };
    }

    const answerText = sanitizeText(payload.answer, MAX_ANSWER_LENGTH);
    
    if (!answerText) {
        return { valid: false, error: 'Answer cannot be empty' };
    }

    return {
        valid: true,
        sanitized: { answerText }
    };
}

/**
 * Validate a choice-based submission (multiple choice or true/false)
 * @param {object} payload - { choiceId: string }
 * @param {object} question - The question being answered
 * @returns {{ valid: boolean, error?: string, sanitized?: { choiceId: string } }}
 */
export function validateChoiceSubmission(payload, question) {
    if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Invalid submission payload' };
    }

    if (!question) {
        return { valid: false, error: 'Question not found' };
    }

    const choiceId = sanitizeText(payload.choiceId, MAX_CHOICE_ID_LENGTH);
    
    if (!choiceId) {
        return { valid: false, error: 'Choice ID cannot be empty' };
    }

    // Get valid choice IDs for this question
    const validChoiceIds = getValidChoiceIds(question);
    
    if (!validChoiceIds.includes(choiceId)) {
        return { valid: false, error: 'Invalid choice ID' };
    }

    return {
        valid: true,
        sanitized: { choiceId }
    };
}

/**
 * Get valid choice IDs for a question
 * @param {object} question 
 * @returns {string[]}
 */
export function getValidChoiceIds(question) {
    if (!question) return [];

    const type = question.type || QUESTION_TYPES.FREE_TEXT;

    if (type === QUESTION_TYPES.TRUE_FALSE) {
        return TRUE_FALSE_CHOICES.map(c => c.id);
    }

    if (type === QUESTION_TYPES.MULTIPLE_CHOICE && Array.isArray(question.choices)) {
        return question.choices.map(c => c.id).filter(Boolean);
    }

    return [];
}

/**
 * Unified submission validation - routes to the correct validator based on question type
 * @param {string} questionType 
 * @param {object} payload 
 * @param {object} question 
 * @returns {{ valid: boolean, error?: string, sanitized?: object }}
 */
export function validateSubmission(questionType, payload, question) {
    if (!isValidQuestionType(questionType)) {
        return { valid: false, error: `Unknown question type: ${questionType}` };
    }

    const config = getQuestionTypeConfig(questionType);
    
    if (questionType === QUESTION_TYPES.FREE_TEXT) {
        return validateFreeTextSubmission(payload);
    }

    // Multiple choice and true/false both use choice-based submission
    return validateChoiceSubmission(payload, question);
}

// ============================================================================
// Question Data Validation
// ============================================================================

/**
 * Validate a raw question object from JSON data
 * @param {object} raw 
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateQuestionData(raw) {
    const errors = [];
    const warnings = [];

    if (!raw || typeof raw !== 'object') {
        return { valid: false, errors: ['Question must be an object'], warnings };
    }

    // ID validation
    if (!raw.id) {
        errors.push('Question missing required field: id');
    } else if (typeof raw.id !== 'string') {
        errors.push('Question id must be a string');
    }

    // Title validation
    if (!raw.title) {
        warnings.push(`Question ${raw.id || '?'}: missing title, will use default`);
    } else if (typeof raw.title !== 'string') {
        errors.push(`Question ${raw.id || '?'}: title must be a string`);
    } else if (raw.title.length > MAX_QUESTION_TITLE_LENGTH) {
        warnings.push(`Question ${raw.id || '?'}: title exceeds max length, will be truncated`);
    }

    // Type validation
    const type = raw.type || QUESTION_TYPES.FREE_TEXT;
    if (!isValidQuestionType(type)) {
        errors.push(`Question ${raw.id || '?'}: invalid type "${type}"`);
    } else {
        // Type-specific validation
        const typeConfig = getQuestionTypeConfig(type);
        
        if (type === QUESTION_TYPES.FREE_TEXT) {
            // Must have answers array
            if (!raw.answers || !Array.isArray(raw.answers) || raw.answers.length === 0) {
                errors.push(`Question ${raw.id || '?'}: free-text question requires answers array`);
            }
        }

        if (type === QUESTION_TYPES.MULTIPLE_CHOICE) {
            // Must have choices array
            if (!raw.choices || !Array.isArray(raw.choices)) {
                errors.push(`Question ${raw.id || '?'}: multiple-choice question requires choices array`);
            } else {
                if (raw.choices.length < typeConfig.minChoices) {
                    errors.push(`Question ${raw.id || '?'}: multiple-choice needs at least ${typeConfig.minChoices} choices`);
                }
                if (raw.choices.length > typeConfig.maxChoices) {
                    warnings.push(`Question ${raw.id || '?'}: has more than ${typeConfig.maxChoices} choices`);
                }
                
                // Validate each choice
                const correctChoices = raw.choices.filter(c => c.correct === true);
                if (correctChoices.length === 0) {
                    errors.push(`Question ${raw.id || '?'}: multiple-choice must have at least one correct choice`);
                }
                if (correctChoices.length > 1) {
                    warnings.push(`Question ${raw.id || '?'}: has multiple correct choices`);
                }

                // Check for duplicate choice IDs
                const choiceIds = raw.choices.map(c => c.id).filter(Boolean);
                const uniqueIds = new Set(choiceIds);
                if (uniqueIds.size !== choiceIds.length) {
                    errors.push(`Question ${raw.id || '?'}: duplicate choice IDs detected`);
                }
            }
        }

        if (type === QUESTION_TYPES.TRUE_FALSE) {
            // Must have correctAnswer boolean
            if (typeof raw.correctAnswer !== 'boolean') {
                errors.push(`Question ${raw.id || '?'}: true-false question requires correctAnswer boolean`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

// ============================================================================
// Round State Validation
// ============================================================================

/**
 * Check if a player can submit an answer
 * @param {object} round - Current round state
 * @param {string} playerId - Player attempting to submit
 * @param {object} previousEntry - Player's previous submission if any
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canPlayerSubmit(round, playerId, previousEntry) {
    if (!round) {
        return { allowed: false, reason: 'no-round' };
    }

    if (!round.isActive) {
        return { allowed: false, reason: 'round-ended' };
    }

    if (!playerId) {
        return { allowed: false, reason: 'no-player-id' };
    }

    const questionType = round.question?.type || QUESTION_TYPES.FREE_TEXT;
    const config = getQuestionTypeConfig(questionType);

    // If player already answered correctly and type doesn't allow retry, block
    if (previousEntry?.isCorrect && !config.allowsRetry) {
        return { allowed: false, reason: 'already-correct' };
    }

    // If type doesn't allow retry and player has already submitted, block
    if (!config.allowsRetry && previousEntry?.hasSubmitted) {
        return { allowed: false, reason: 'already-submitted' };
    }

    return { allowed: true };
}
