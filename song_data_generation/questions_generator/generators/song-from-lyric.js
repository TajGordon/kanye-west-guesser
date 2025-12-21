/**
 * Song From Lyric Generator
 * 
 * Generates "what song is this lyric from?" questions.
 * Creates separate questions for each input mode (free-text, MC, T/F).
 */

import {
  INPUT_MODES,
  createQuestionId,
  createQuestion
} from '../utils/question-schema.js';
import { buildTagSet } from '../utils/tag-builder.js';
import { resolveOrCreateEntity } from '../utils/alias-resolver.js';
import { getWrongSongAnswers, shuffle } from '../utils/wrong-answer-generator.js';

const GENERATOR_TYPE = 'song-from-lyric';
const VERSION = '1.0.0';

// Lines that are too short or generic to be useful
const MIN_LINE_LENGTH = 20;
const MIN_WORD_COUNT = 4;

/**
 * Generate song-from-lyric questions for all songs
 * @param {object[]} songs - Array of normalized song objects
 * @param {object} config - Generator configuration
 * @returns {object[]} - Array of questions
 */
export function generate(songs, config = {}) {
  const {
    inputModeWeights = { 'free-text': 50, 'multiple-choice': 40, 'true-false': 10 },
    minWrongAnswers = 10,
    wrongAnswerCount = 3,
    trueFalseCorrectProbability = 0.5,
    linesPerSong = null,  // null = all lines, or a number to limit
    skipGenericLines = true
  } = config;
  
  const questions = [];
  
  for (const song of songs) {
    const songQuestions = generateForSong(song, songs, {
      inputModeWeights,
      minWrongAnswers,
      wrongAnswerCount,
      trueFalseCorrectProbability,
      linesPerSong,
      skipGenericLines
    });
    questions.push(...songQuestions);
  }
  
  console.log(`[${GENERATOR_TYPE}] Generated ${questions.length} questions`);
  return questions;
}

/**
 * Generate questions for a single song
 */
function generateForSong(song, allSongs, config) {
  const questions = [];
  const { linesPerSong, skipGenericLines, inputModeWeights } = config;
  
  // Filter to good candidate lines
  let candidateLines = song.lyrics.filter(line => {
    if (line.content.length < MIN_LINE_LENGTH) return false;
    if (line.content.split(/\s+/).length < MIN_WORD_COUNT) return false;
    if (skipGenericLines && isGenericLine(line.content)) return false;
    return true;
  });
  
  // Optionally limit lines per song
  if (linesPerSong && candidateLines.length > linesPerSong) {
    candidateLines = shuffle(candidateLines).slice(0, linesPerSong);
  }
  
  // Get answer entity
  const answer = resolveOrCreateEntity('song', song.title);
  
  // Get wrong answers (once per song, reused for all lines)
  const wrongAnswerPool = getWrongSongAnswers(song, config.minWrongAnswers);
  
  for (const line of candidateLines) {
    const lineQuestions = generateForLine(song, line, answer, wrongAnswerPool, config);
    questions.push(...lineQuestions);
  }
  
  return questions;
}

/**
 * Check if a line is too generic to be a good question
 */
function isGenericLine(content) {
  const lower = content.toLowerCase();
  
  // Lines that are just repeated words
  const words = lower.split(/\s+/);
  const uniqueWords = new Set(words);
  if (uniqueWords.size <= 2) return true;
  
  // Lines that are common song filler
  const genericPatterns = [
    /^(yeah|oh|uh|ah|la|na|da|ay)+/i,
    /^(hey|yo|come on|let's go)/i
  ];
  
  for (const pattern of genericPatterns) {
    if (pattern.test(lower)) return true;
  }
  
  return false;
}

/**
 * Generate questions for a single line
 */
function generateForLine(song, line, answer, wrongAnswerPool, config) {
  const questions = [];
  const { inputModeWeights, wrongAnswerCount, trueFalseCorrectProbability } = config;
  
  const subjectId = `${song.slug}-l${line.lineNumber}`;
  const modes = Object.entries(inputModeWeights).filter(([_, weight]) => weight > 0);
  
  for (const [inputMode, _] of modes) {
    const question = createQuestionForMode(
      song, line, answer, wrongAnswerPool,
      inputMode, subjectId, { wrongAnswerCount, trueFalseCorrectProbability }
    );
    
    if (question) {
      questions.push(question);
    }
  }
  
  return questions;
}

/**
 * Create a question for a specific input mode
 */
function createQuestionForMode(song, line, answer, wrongAnswerPool, inputMode, subjectId, config) {
  const { wrongAnswerCount, trueFalseCorrectProbability } = config;
  
  // Build title
  let title;
  if (inputMode === INPUT_MODES.TRUE_FALSE) {
    title = `This lyric is from "{shownAnswer}"`;
  } else {
    title = 'What song is this lyric from?';
  }
  
  // Content is the lyric
  const content = {
    type: 'text',
    text: `"${line.content}"`
  };
  
  // Build tags
  const tags = buildTagSet({
    generatorType: GENERATOR_TYPE,
    inputMode,
    promptVariant: 'standard',
    song: song.title,
    album: song.album,
    artist: song.artist,
    artists: song.artists,
    year: song.year,
    section: line.section,
    voice: line.voice,
    difficulty: estimateDifficulty(song, line)
  });
  
  // Source tracking
  const source = {
    song: song.slug,
    lineNumber: line.lineNumber,
    originalLine: line.content
  };
  
  const questionId = createQuestionId(GENERATOR_TYPE, subjectId, inputMode);
  
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
    questionData.titleTemplate = title;
    questionData.trueFalseConfig = {
      correctProbability: trueFalseCorrectProbability
    };
  }
  
  return createQuestion(questionData);
}

/**
 * Estimate difficulty
 */
function estimateDifficulty(song, line) {
  // Chorus lines are generally more recognizable
  if (line.section === 'chorus') return 'easy';
  
  // Intro/outro might be less known
  if (line.section === 'intro' || line.section === 'outro') return 'hard';
  
  // Later verses are harder
  if (line.sectionNumber > 2) return 'hard';
  
  return 'medium';
}

export const meta = {
  type: GENERATOR_TYPE,
  version: VERSION,
  description: 'Generates "what song is this lyric from?" questions'
};
