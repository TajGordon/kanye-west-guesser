/**
 * Question Validator
 * 
 * Validates generated questions for consistency, correctness, and quality.
 * Catches common issues before questions are saved.
 */

// ============================================================================
// Validation Rules
// ============================================================================

const REQUIRED_FIELDS = ['id', 'type', 'title'];

const VALID_TYPES = [
  'free-text',
  'multiple-choice',
  'true-false',
  'multi-entry',
  'numeric',
  'ordered-list'
];

const VALID_MATCH_MODES = [
  'loose',   // Strips all punctuation, case insensitive
  'normal',  // Strips minor punctuation, case insensitive (default)
  'strict',  // Keeps punctuation, case insensitive
  'exact'    // Keeps punctuation, case sensitive
];

const TYPE_REQUIRED_FIELDS = {
  'free-text': [],  // answers OR answer required, checked in validateFreeText
  'multiple-choice': [],  // choices OR wrongAnswerPool, checked in validateMultipleChoice
  'true-false': [],  // answer OR trueFalseAnswer, checked in validateTrueFalse
  'multi-entry': [],  // answers OR correctEntries, checked in validateMultiEntry
  'numeric': ['answer'],
  'ordered-list': ['correctOrder']
};

// ============================================================================
// Validation Statistics
// ============================================================================

class ValidationStats {
  constructor() {
    this.reset();
  }
  
  reset() {
    this.total = 0;
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.errors = [];
    this.warningMessages = [];
    this.byType = {};
    this.byGenerator = {};
  }
  
  recordPass(question) {
    this.total++;
    this.passed++;
    this.trackByType(question.type, 'passed');
    this.trackByGenerator(question.generator, 'passed');
  }
  
  recordFail(question, error) {
    this.total++;
    this.failed++;
    this.errors.push({ id: question?.id || 'unknown', error });
    this.trackByType(question?.type, 'failed');
    this.trackByGenerator(question?.generator, 'failed');
  }
  
  recordWarning(question, warning) {
    this.warnings++;
    this.warningMessages.push({ id: question?.id || 'unknown', warning });
    this.trackByType(question?.type, 'warnings');
    this.trackByGenerator(question?.generator, 'warnings');
  }
  
  trackByType(type, status) {
    if (!type) return;
    if (!this.byType[type]) {
      this.byType[type] = { passed: 0, failed: 0, warnings: 0 };
    }
    this.byType[type][status]++;
  }
  
  trackByGenerator(generator, status) {
    if (!generator) return;
    if (!this.byGenerator[generator]) {
      this.byGenerator[generator] = { passed: 0, failed: 0, warnings: 0 };
    }
    this.byGenerator[generator][status]++;
  }
  
  getSummary() {
    return {
      total: this.total,
      passed: this.passed,
      failed: this.failed,
      warnings: this.warnings,
      passRate: this.total > 0 ? ((this.passed / this.total) * 100).toFixed(2) + '%' : 'N/A',
      byType: this.byType,
      byGenerator: this.byGenerator,
      sampleErrors: this.errors.slice(0, 10),
      sampleWarnings: this.warningMessages.slice(0, 10)
    };
  }
}

// ============================================================================
// Core Validation Functions
// ============================================================================

/**
 * Validate a single question
 * @param {object} question - Question to validate
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateQuestion(question) {
  const errors = [];
  const warnings = [];
  
  // Check it's an object
  if (!question || typeof question !== 'object') {
    return { valid: false, errors: ['Question is not an object'], warnings: [] };
  }
  
  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!question[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Check type is valid
  if (question.type && !VALID_TYPES.includes(question.type)) {
    errors.push(`Invalid question type: ${question.type}`);
  }
  
  // Check type-specific required fields
  if (question.type && TYPE_REQUIRED_FIELDS[question.type]) {
    for (const field of TYPE_REQUIRED_FIELDS[question.type]) {
      if (!question[field] && question[field] !== 0) {
        errors.push(`Type "${question.type}" requires field: ${field}`);
      }
    }
  }
  
  // Type-specific validation
  if (question.type === 'multiple-choice') {
    validateMultipleChoice(question, errors, warnings);
  } else if (question.type === 'true-false') {
    validateTrueFalse(question, errors, warnings);
  } else if (question.type === 'free-text') {
    validateFreeText(question, errors, warnings);
  } else if (question.type === 'multi-entry') {
    validateMultiEntry(question, errors, warnings);
  } else if (question.type === 'numeric') {
    validateNumeric(question, errors, warnings);
  }
  
  // Quality checks (warnings)
  validateQuality(question, warnings);
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate multiple choice questions
 */
function validateMultipleChoice(question, errors, warnings) {
  const choices = question.choices;
  
  // Template questions use wrongAnswerPool instead of pre-built choices
  const isTemplateQuestion = !!question.wrongAnswerPool;
  
  if (isTemplateQuestion) {
    // Validate wrongAnswerPool instead
    if (!Array.isArray(question.wrongAnswerPool)) {
      errors.push('wrongAnswerPool must be an array');
      return;
    }
    if (question.wrongAnswerPool.length < (question.wrongAnswerCount || 3)) {
      warnings.push('wrongAnswerPool has fewer items than wrongAnswerCount');
    }
    // Need an answer for template questions
    if (!question.answer) {
      errors.push('Template question must have answer field');
    }
    return;  // Template questions are valid
  }
  
  // Non-template: validate choices
  if (!Array.isArray(choices)) {
    errors.push('choices must be an array');
    return;
  }
  
  if (choices.length < 2) {
    errors.push('Multiple choice must have at least 2 choices');
  }
  
  if (choices.length > 6) {
    warnings.push('More than 6 choices may overwhelm players');
  }
  
  // Check for exactly one correct answer
  const correctChoices = choices.filter(c => c.isCorrect);
  if (correctChoices.length === 0) {
    errors.push('Multiple choice has no correct answer marked');
  } else if (correctChoices.length > 1) {
    errors.push(`Multiple choice has ${correctChoices.length} correct answers marked`);
  }
  
  // Check for duplicate choice texts
  const texts = choices.map(c => c.text?.toLowerCase().trim());
  const uniqueTexts = new Set(texts);
  if (texts.length !== uniqueTexts.size) {
    errors.push('Multiple choice has duplicate choice texts');
  }
  
  // Check all choices have required fields
  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i];
    if (!choice.id) {
      errors.push(`Choice ${i} missing id`);
    }
    if (!choice.text && choice.text !== '') {
      errors.push(`Choice ${i} missing text`);
    }
    if (typeof choice.isCorrect !== 'boolean') {
      warnings.push(`Choice ${i} missing isCorrect boolean`);
    }
  }
}

/**
 * Validate true/false questions
 */
function validateTrueFalse(question, errors, warnings) {
  // For true/false generated by our generators, the answer is stored separately
  // The trueFalseAnswer field or answer field contains 'true' or 'false'
  let tfAnswer = question.trueFalseAnswer || question.correctAnswer;
  
  // If answer is a string 'true' or 'false'
  if (typeof question.answer === 'string') {
    tfAnswer = question.answer;
  }
  
  // The question might store the content/statement separately and have separate T/F answer
  // For our format, the question.answer might be the word being tested (for fill-in-blank TF)
  // and question.trueFalseAnswer or question.correctAnswer has the true/false value
  
  if (tfAnswer) {
    const normalized = String(tfAnswer).toLowerCase();
    if (normalized !== 'true' && normalized !== 'false') {
      errors.push(`True/false answer must be "true" or "false", got: ${tfAnswer}`);
    }
  } else {
    // For our generators, some T/F questions use 'answer' as the correct answer
    // but the T/F is determined by whether the statement matches
    // This is valid, just warn if there's no clear true/false indicator
    warnings.push('True/false question may need explicit correctAnswer field');
  }
}

/**
 * Validate free text questions
 */
function validateFreeText(question, errors, warnings) {
  // Can have either:
  // - answers: string[] of valid answers
  // - answer: object with { display, aliases } or string
  
  const hasAnswers = question.answers && Array.isArray(question.answers);
  const hasAnswerObject = question.answer && typeof question.answer === 'object' && question.answer.display;
  const hasAnswerString = question.answer && typeof question.answer === 'string';
  
  if (!hasAnswers && !hasAnswerObject && !hasAnswerString) {
    errors.push('Free text must have answers array or answer field');
    return;
  }
  
  // If using answers array, validate it
  if (hasAnswers) {
    if (question.answers.length === 0) {
      errors.push('Free text must have at least one valid answer');
    }
    
    // Check for empty answers
    const emptyAnswers = question.answers.filter(a => !a || (typeof a === 'string' && a.trim() === ''));
    if (emptyAnswers.length > 0) {
      errors.push(`Free text has ${emptyAnswers.length} empty answer(s)`);
    }
  }
  
  // If using answer object, validate display exists
  if (hasAnswerObject && !question.answer.display) {
    errors.push('Free text answer object must have display field');
  }
}

/**
 * Validate multi-entry questions
 */
function validateMultiEntry(question, errors, warnings) {
  // Can use either correctEntries or answers
  const entries = question.correctEntries || question.answers;
  
  if (!entries) {
    errors.push('Multi-entry must have correctEntries or answers array');
    return;
  }
  
  if (!Array.isArray(entries)) {
    errors.push('correctEntries/answers must be an array');
    return;
  }
  
  if (entries.length < 2) {
    warnings.push('Multi-entry should have at least 2 correct entries');
  }
  
  // Check max guesses is reasonable
  if (question.maxGuesses && question.maxGuesses < entries.length) {
    warnings.push('maxGuesses is less than number of correct entries');
  }
}

/**
 * Validate numeric questions
 */
function validateNumeric(question, errors, warnings) {
  let answer = question.answer;
  
  // Handle answer object with display (like year questions)
  if (answer && typeof answer === 'object' && answer.display !== undefined) {
    answer = answer.display;
    // Try to parse as number
    const parsed = Number(answer);
    if (!isNaN(parsed)) {
      answer = parsed;
    }
  }
  
  if (typeof answer !== 'number' && typeof answer !== 'string') {
    errors.push(`Numeric answer must be a number or numeric string, got: ${typeof question.answer}`);
    return;
  }
  
  // If string, check it's actually numeric
  if (typeof answer === 'string') {
    const parsed = Number(answer);
    if (isNaN(parsed)) {
      errors.push(`Numeric answer string "${answer}" is not a valid number`);
      return;
    }
    answer = parsed;
  }
  
  // Check for reasonable year if it looks like a year question
  if (question.generator?.includes('year') || question.generatorType?.includes('year')) {
    if (answer < 1900 || answer > 2100) {
      warnings.push(`Year ${answer} seems out of expected range`);
    }
  }
}

/**
 * Quality validation checks (warnings only)
 */
function validateQuality(question, warnings) {
  // Check title length
  if (question.title && question.title.length > 200) {
    warnings.push('Question title is very long (>200 chars)');
  }
  
  if (question.title && question.title.length < 10) {
    warnings.push('Question title is very short (<10 chars)');
  }
  
  // Check for placeholder text (only for string content)
  const contentStr = typeof question.content === 'string' ? question.content : '';
  
  if (question.title?.includes('undefined') || contentStr.includes('undefined')) {
    warnings.push('Question contains "undefined" - possible template issue');
  }
  
  if (question.title?.includes('null') || contentStr.includes('null')) {
    warnings.push('Question contains "null" - possible data issue');
  }
  
  // Check for empty content where expected (only for string content)
  if (contentStr === '' || contentStr === '""') {
    // This is fine - not all questions need content
  }
  
  // Check ID format (allow alphanumeric, dashes, colons, underscores)
  if (question.id && !question.id.match(/^[a-z0-9:_-]+$/i)) {
    warnings.push('Question ID contains non-standard characters');
  }
  
  // Check for duplicate data in title/content (only for string content)
  if (question.title && typeof question.content === 'string' && question.title === question.content) {
    warnings.push('Title and content are identical');
  }
  
  // Validate matchMode if present
  if (question.matchMode !== undefined) {
    if (typeof question.matchMode !== 'string') {
      warnings.push('matchMode must be a string');
    } else if (!VALID_MATCH_MODES.includes(question.matchMode)) {
      warnings.push(`Invalid matchMode "${question.matchMode}". Valid modes: ${VALID_MATCH_MODES.join(', ')}`);
    }
  }
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validate an array of questions
 * @param {object[]} questions - Questions to validate
 * @param {object} options - Validation options
 * @returns {{ valid: object[], invalid: object[], stats: object }}
 */
export function validateQuestions(questions, options = {}) {
  const { 
    strict = false,        // Treat warnings as errors
    removeInvalid = true,  // Remove invalid questions from output
    verbose = false        // Log each validation
  } = options;
  
  const stats = new ValidationStats();
  const valid = [];
  const invalid = [];
  
  for (const question of questions) {
    const result = validateQuestion(question);
    
    if (verbose && (result.errors.length > 0 || result.warnings.length > 0)) {
      console.log(`[Validator] ${question?.id || 'unknown'}:`, {
        errors: result.errors,
        warnings: result.warnings
      });
    }
    
    // Record warnings
    for (const warning of result.warnings) {
      stats.recordWarning(question, warning);
    }
    
    // Check validity
    const isValid = strict 
      ? result.errors.length === 0 && result.warnings.length === 0
      : result.errors.length === 0;
    
    if (isValid) {
      stats.recordPass(question);
      valid.push(question);
    } else {
      // Record the question as failed (only once per question)
      stats.recordFail(question, result.errors.join('; '));
      invalid.push({ question, errors: result.errors, warnings: result.warnings });
    }
  }
  
  return {
    valid: removeInvalid ? valid : questions,
    invalid,
    stats: stats.getSummary()
  };
}

/**
 * Check for duplicate question IDs
 * @param {object[]} questions 
 * @returns {{ duplicates: Map<string, number>, hasDuplicates: boolean }}
 */
export function checkDuplicateIds(questions) {
  const idCounts = new Map();
  
  for (const q of questions) {
    if (q.id) {
      idCounts.set(q.id, (idCounts.get(q.id) || 0) + 1);
    }
  }
  
  const duplicates = new Map();
  for (const [id, count] of idCounts) {
    if (count > 1) {
      duplicates.set(id, count);
    }
  }
  
  return {
    duplicates,
    hasDuplicates: duplicates.size > 0
  };
}

/**
 * Check answer quality across questions
 * @param {object[]} questions 
 * @returns {object} Quality report
 */
export function checkAnswerQuality(questions) {
  const issues = [];
  
  // Check for questions with same answer
  const answerToQuestions = new Map();
  
  for (const q of questions) {
    let answer;
    if (q.type === 'free-text' && q.answers?.[0]) {
      answer = q.answers[0].toLowerCase();
    } else if (q.answer) {
      answer = String(q.answer).toLowerCase();
    }
    
    if (answer) {
      if (!answerToQuestions.has(answer)) {
        answerToQuestions.set(answer, []);
      }
      answerToQuestions.get(answer).push(q.id);
    }
  }
  
  // Flag very common answers
  for (const [answer, questionIds] of answerToQuestions) {
    if (questionIds.length > 50) {
      issues.push({
        type: 'common-answer',
        answer,
        count: questionIds.length,
        sample: questionIds.slice(0, 5)
      });
    }
  }
  
  return { issues };
}

// ============================================================================
// Validation Report
// ============================================================================

/**
 * Print a validation report to console
 */
export function printValidationReport(stats, verbose = false) {
  console.log('\n=== Validation Report ===\n');
  console.log(`Total Questions: ${stats.total}`);
  console.log(`  Passed: ${stats.passed} (${stats.passRate})`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Warnings: ${stats.warnings}`);
  
  if (Object.keys(stats.byGenerator).length > 0) {
    console.log('\nBy Generator:');
    for (const [gen, counts] of Object.entries(stats.byGenerator)) {
      console.log(`  ${gen}: ${counts.passed} passed, ${counts.failed} failed, ${counts.warnings} warnings`);
    }
  }
  
  if (Object.keys(stats.byType).length > 0) {
    console.log('\nBy Type:');
    for (const [type, counts] of Object.entries(stats.byType)) {
      console.log(`  ${type}: ${counts.passed} passed, ${counts.failed} failed`);
    }
  }
  
  if (stats.sampleErrors.length > 0 && verbose) {
    console.log('\nSample Errors:');
    for (const { id, error } of stats.sampleErrors) {
      console.log(`  - [${id}] ${error}`);
    }
  }
  
  if (stats.sampleWarnings.length > 0 && verbose) {
    console.log('\nSample Warnings:');
    for (const { id, warning } of stats.sampleWarnings) {
      console.log(`  - [${id}] ${warning}`);
    }
  }
  
  console.log('');
}

export default {
  validateQuestion,
  validateQuestions,
  checkDuplicateIds,
  checkAnswerQuality,
  printValidationReport
};
