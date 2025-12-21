/**
 * Question Schema
 * 
 * Defines the question structure and provides validation/creation utilities.
 * This is the canonical format for generated questions.
 */

/**
 * Input modes supported by the game
 */
export const INPUT_MODES = Object.freeze({
  FREE_TEXT: 'free-text',
  MULTIPLE_CHOICE: 'multiple-choice',
  TRUE_FALSE: 'true-false',
  MULTI_ENTRY: 'multi-entry',
  NUMERIC: 'numeric'
});

/**
 * Scoring modes
 */
export const SCORING_MODES = Object.freeze({
  STANDARD: 'standard',
  PROXIMITY: 'proximity',
  MULTI_ENTRY: 'multi-entry'
});

/**
 * Create a question ID
 * @param {string} generatorType 
 * @param {string} subject - Unique identifier for what's being asked about
 * @param {string} inputMode 
 * @param {string} promptVariant 
 * @returns {string}
 */
export function createQuestionId(generatorType, subject, inputMode, promptVariant = 'standard') {
  const parts = [generatorType, subject, inputMode];
  if (promptVariant && promptVariant !== 'standard') {
    parts.push(promptVariant);
  }
  return parts.join(':');
}

/**
 * Create a complete question object
 * @param {object} options
 * @returns {object}
 */
export function createQuestion({
  id,
  type,  // INPUT_MODES value
  generatorType,
  scoringMode = SCORING_MODES.STANDARD,
  
  title,
  content = null,
  titleTemplate = null,  // For T/F interpolation
  contentTemplate = null,  // For lyric pool interpolation
  
  // Answer data
  answer,  // { entityRef, display, aliases }
  answers = null,  // For multi-entry: array of answer objects
  
  // For static MC: pre-built choices
  choices = null,
  
  // For template MC/TF: pool of wrong answers
  wrongAnswerPool = null,
  wrongAnswerCount = 3,
  
  // For T/F
  trueFalseConfig = null,
  
  // For lyric-based prompts
  lyricPool = null,
  
  // For proximity scoring
  proximityConfig = null,
  
  // For numeric
  numericConfig = null,
  
  // Tags for filtering
  tags,
  
  // Source tracking
  source = null
}) {
  const question = {
    id,
    type,
    generatorType,
    scoringMode,
    title,
    content: content || { type: 'text', text: '' },
    tags
  };
  
  // Add template strings if present
  if (titleTemplate) question.titleTemplate = titleTemplate;
  if (contentTemplate) question.contentTemplate = contentTemplate;
  
  // Add answer(s)
  if (answers) {
    question.answers = answers;
  } else if (answer) {
    question.answer = answer;
  }
  
  // Add pre-built choices for static MC
  if (choices && choices.length > 0) {
    question.choices = choices;
  }
  
  // Add wrong answer pool for template MC/TF
  if (wrongAnswerPool && wrongAnswerPool.length > 0) {
    question.wrongAnswerPool = wrongAnswerPool;
    question.wrongAnswerCount = wrongAnswerCount;
  }
  
  // Add T/F config
  if (trueFalseConfig) {
    question.trueFalseConfig = trueFalseConfig;
  }
  
  // Add lyric pool for lyric-based prompts
  if (lyricPool && lyricPool.length > 0) {
    question.lyricPool = lyricPool;
  }
  
  // Add proximity config
  if (proximityConfig) {
    question.proximityConfig = proximityConfig;
  }
  
  // Add numeric config
  if (numericConfig) {
    question.numericConfig = numericConfig;
  }
  
  // Add source tracking
  if (source) {
    question.source = source;
  }
  
  return question;
}

/**
 * Validate a question object
 * @param {object} question 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateQuestion(question) {
  const errors = [];
  
  if (!question.id) {
    errors.push('Missing id');
  }
  
  if (!question.type || !Object.values(INPUT_MODES).includes(question.type)) {
    errors.push(`Invalid type: ${question.type}`);
  }
  
  if (!question.title) {
    errors.push('Missing title');
  }
  
  if (!question.tags || !Array.isArray(question.tags) || question.tags.length === 0) {
    errors.push('Missing or empty tags');
  }
  
  // Type-specific validation
  if (question.type === INPUT_MODES.FREE_TEXT) {
    if (!question.answer && !question.answers) {
      errors.push('Free-text question must have answer or answers');
    }
  }
  
  if (question.type === INPUT_MODES.MULTIPLE_CHOICE) {
    if (!question.wrongAnswerPool || question.wrongAnswerPool.length < 1) {
      errors.push('Multiple-choice question must have wrongAnswerPool');
    }
  }
  
  if (question.type === INPUT_MODES.TRUE_FALSE) {
    if (!question.wrongAnswerPool || question.wrongAnswerPool.length < 1) {
      errors.push('True-false question must have wrongAnswerPool');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a file output wrapper
 * @param {string} generatorType 
 * @param {string} version 
 * @param {object[]} questions 
 * @returns {object}
 */
export function createOutputFile(generatorType, version, questions) {
  return {
    meta: {
      generatorType,
      generatorVersion: version,
      generatedAt: new Date().toISOString(),
      questionCount: questions.length,
      stats: computeStats(questions)
    },
    questions
  };
}

/**
 * Compute statistics for a question set
 */
function computeStats(questions) {
  const byType = {};
  const byDifficulty = {};
  
  for (const q of questions) {
    // By input type
    byType[q.type] = (byType[q.type] || 0) + 1;
    
    // By difficulty (extract from tags)
    const diffTag = q.tags.find(t => t.startsWith('difficulty:'));
    if (diffTag) {
      const diff = diffTag.split(':')[1];
      byDifficulty[diff] = (byDifficulty[diff] || 0) + 1;
    }
  }
  
  return { byType, byDifficulty };
}
