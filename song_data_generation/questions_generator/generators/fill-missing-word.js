/**
 * Fill Missing Word Generator
 * 
 * Generates "what is the missing word?" questions for each word in each line.
 * Creates separate questions for each input mode (free-text, MC, T/F)
 * and prompt variant (standard, with-song-title).
 */

import {
  INPUT_MODES,
  createQuestionId,
  createQuestion
} from '../utils/question-schema.js';
import { buildTagSet } from '../utils/tag-builder.js';
import { getWrongWordAnswers, shuffle } from '../utils/wrong-answer-generator.js';

// Words to skip (too common / not interesting)
const COMMON_WORDS = new Set([
  'i', 'me', 'my', 'you', 'your', 'he', 'she', 'it', 'we', 'they',
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'am',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'could', 'should',
  'can', 'may', 'might', 'must', 'shall',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'if', 'then', 'so', 'as', 'by', 'from', 'up', 'down', 'out',
  'all', 'no', 'not', 'just', 'like', 'get', 'got', 'im', "i'm",
  'oh', 'yeah', 'uh', 'ah', 'ooh', 'ayy', 'ay', 'la', 'na', 'da'
]);

const GENERATOR_TYPE = 'fill-missing-word';
const VERSION = '1.0.0';

/**
 * Generate fill-missing-word questions for all songs
 * @param {object[]} songs - Array of normalized song objects
 * @param {object} config - Generator configuration
 * @returns {object[]} - Array of questions
 */
export function generate(songs, config = {}) {
  const {
    inputModeWeights = { 'free-text': 50, 'multiple-choice': 40, 'true-false': 10 },
    promptVariants = ['standard', 'with-song-title'],
    minWordLength = 3,
    excludeCommonWords = true,
    minWrongAnswers = 10,
    wrongAnswerCount = 3,
    trueFalseCorrectProbability = 0.5
  } = config;
  
  const questions = [];
  
  for (const song of songs) {
    const songQuestions = generateForSong(song, {
      inputModeWeights,
      promptVariants,
      minWordLength,
      excludeCommonWords,
      minWrongAnswers,
      wrongAnswerCount,
      trueFalseCorrectProbability
    });
    questions.push(...songQuestions);
  }
  
  console.log(`[${GENERATOR_TYPE}] Generated ${questions.length} questions`);
  return questions;
}

/**
 * Generate questions for a single song
 */
function generateForSong(song, config) {
  const questions = [];
  
  for (const line of song.lyrics) {
    const words = extractQuestionableWords(line.content, config);
    
    for (const wordInfo of words) {
      const lineQuestions = generateForWord(song, line, wordInfo, config);
      questions.push(...lineQuestions);
    }
  }
  
  return questions;
}

/**
 * Extract words that are good candidates for questions
 */
function extractQuestionableWords(lineContent, config) {
  const words = [];
  const tokens = lineContent.split(/\s+/);
  
  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9'-]/g, '');
    
    if (cleaned.length < config.minWordLength) continue;
    if (config.excludeCommonWords && COMMON_WORDS.has(cleaned)) continue;
    
    words.push({
      word: cleaned,
      originalWord: raw,
      wordIndex: i,
      tokens: tokens,
      maskedLine: createMaskedLine(tokens, i)
    });
  }
  
  return words;
}

/**
 * Create a line with one word replaced by blanks
 */
function createMaskedLine(tokens, maskIndex) {
  return tokens.map((t, i) => i === maskIndex ? '____' : t).join(' ');
}

/**
 * Generate all question variants for a single word
 */
function generateForWord(song, line, wordInfo, config) {
  const questions = [];
  const { inputModeWeights, promptVariants, minWrongAnswers, wrongAnswerCount, trueFalseCorrectProbability } = config;
  
  // Base subject ID
  const subjectId = `${song.slug}-l${line.lineNumber}-w${wordInfo.wordIndex}`;
  
  // Get wrong answers for MC/TF
  const wrongAnswerPool = getWrongWordAnswers(
    wordInfo.word,
    song,
    line.lineNumber,
    minWrongAnswers
  );
  
  // Answer object
  const answer = {
    entityRef: null,  // Words don't have entity refs in alias dictionary
    display: wordInfo.word,
    aliases: [wordInfo.word]
  };
  
  // Generate for each input mode that's enabled
  const modes = Object.entries(inputModeWeights).filter(([_, weight]) => weight > 0);
  
  for (const [inputMode, _] of modes) {
    // Generate for each prompt variant
    for (const promptVariant of promptVariants) {
      const question = createQuestionForMode(
        song, line, wordInfo, answer, wrongAnswerPool,
        inputMode, promptVariant, subjectId,
        { wrongAnswerCount, trueFalseCorrectProbability }
      );
      
      if (question) {
        questions.push(question);
      }
    }
  }
  
  return questions;
}

/**
 * Create a question for a specific input mode and prompt variant
 */
function createQuestionForMode(
  song, line, wordInfo, answer, wrongAnswerPool,
  inputMode, promptVariant, subjectId, config
) {
  const { wrongAnswerCount, trueFalseCorrectProbability } = config;
  
  // Build title based on prompt variant
  let title;
  if (promptVariant === 'with-song-title') {
    title = `What is the missing word in "${song.title}"?`;
  } else {
    title = 'What is the missing word?';
  }
  
  // For T/F, modify title to be an assertion
  if (inputMode === INPUT_MODES.TRUE_FALSE) {
    title = `The missing word is "{shownAnswer}"`;
  }
  
  // Build content
  const content = {
    type: 'text',
    text: wordInfo.maskedLine
  };
  
  // Build tags
  const tags = buildTagSet({
    generatorType: GENERATOR_TYPE,
    inputMode,
    promptVariant,
    song: song.title,
    album: song.album,
    artist: song.artist,
    artists: song.artists,
    year: song.year,
    section: line.section,
    voice: line.voice,
    difficulty: estimateDifficulty(wordInfo.word, line.content),
    extraTags: promptVariant === 'with-song-title' ? ['reveals-song'] : []
  });
  
  // Source tracking
  const source = {
    song: song.slug,
    lineNumber: line.lineNumber,
    wordIndex: wordInfo.wordIndex,
    originalLine: line.content
  };
  
  // Create base question
  const questionId = createQuestionId(GENERATOR_TYPE, subjectId, inputMode, promptVariant);
  
  const questionData = {
    id: questionId,
    type: inputMode,
    generatorType: GENERATOR_TYPE,
    title,
    content,
    answer,
    tags,
    source
  };
  
  // Add mode-specific fields
  if (inputMode === INPUT_MODES.MULTIPLE_CHOICE || inputMode === INPUT_MODES.TRUE_FALSE) {
    questionData.wrongAnswerPool = wrongAnswerPool;
    questionData.wrongAnswerCount = wrongAnswerCount;
  }
  
  if (inputMode === INPUT_MODES.TRUE_FALSE) {
    questionData.titleTemplate = title;  // Has {shownAnswer} placeholder
    questionData.trueFalseConfig = {
      correctProbability: trueFalseCorrectProbability
    };
  }
  
  return createQuestion(questionData);
}

/**
 * Estimate difficulty based on word characteristics
 */
function estimateDifficulty(word, lineContent) {
  // Longer words are generally harder
  if (word.length >= 8) return 'hard';
  
  // Very short lines are harder (less context)
  const wordCount = lineContent.split(/\s+/).length;
  if (wordCount <= 4) return 'hard';
  
  // Short common-ish words with context are easier
  if (word.length <= 4 && wordCount >= 6) return 'easy';
  
  return 'medium';
}

export const meta = {
  type: GENERATOR_TYPE,
  version: VERSION,
  description: 'Generates "what is the missing word?" questions'
};
