/**
 * Year From Song Generator
 * 
 * Generates "what year was this song released?" questions.
 * Supports free-text, multiple-choice, true-false, and numeric input modes.
 */

import {
  INPUT_MODES,
  createQuestionId,
  createQuestion
} from '../utils/question-schema.js';
import { buildTagSet } from '../utils/tag-builder.js';
import { resolveOrCreateEntity } from '../utils/alias-resolver.js';
import { shuffle } from '../utils/wrong-answer-generator.js';

const GENERATOR_TYPE = 'year-from-song';
const VERSION = '1.0.0';

/**
 * Generate year-from-song questions for all songs
 * @param {object[]} songs - Array of normalized song objects
 * @param {object} config - Generator configuration
 * @returns {object[]} - Array of questions
 */
export function generate(songs, config = {}) {
  const {
    inputModeWeights = { 'free-text': 30, 'multiple-choice': 40, 'true-false': 10, 'numeric': 20 },
    promptVariants = ['by-title', 'by-lyric'],
    wrongAnswerCount = 3,
    trueFalseCorrectProbability = 0.5,
    yearRange = { min: 1990, max: 2030 }
  } = config;
  
  const questions = [];
  
  // Collect all years for wrong answer generation
  const allYears = [...new Set(songs.map(s => s.year).filter(Boolean))].sort();
  
  for (const song of songs) {
    if (!song.year) continue;  // Skip songs without year data
    
    const songQuestions = generateForSong(song, allYears, {
      inputModeWeights,
      promptVariants,
      wrongAnswerCount,
      trueFalseCorrectProbability,
      yearRange
    });
    questions.push(...songQuestions);
  }
  
  console.log(`[${GENERATOR_TYPE}] Generated ${questions.length} questions`);
  return questions;
}

/**
 * Generate questions for a single song
 */
function generateForSong(song, allYears, config) {
  const questions = [];
  const { inputModeWeights, promptVariants, wrongAnswerCount, trueFalseCorrectProbability, yearRange } = config;
  
  const modes = Object.entries(inputModeWeights).filter(([_, weight]) => weight > 0);
  
  // Get wrong year answers
  const wrongYearPool = getWrongYearAnswers(song.year, allYears, 10);
  
  for (const [inputMode, _] of modes) {
    for (const promptVariant of promptVariants) {
      // For 'by-lyric' variant, we need lyrics
      if (promptVariant === 'by-lyric') {
        // Pick a representative lyric
        const representativeLine = pickRepresentativeLine(song);
        if (!representativeLine) continue;
        
        const question = createQuestionForMode(
          song, representativeLine, wrongYearPool,
          inputMode, promptVariant,
          { wrongAnswerCount, trueFalseCorrectProbability, yearRange }
        );
        if (question) questions.push(question);
      } else {
        // 'by-title' variant
        const question = createQuestionForMode(
          song, null, wrongYearPool,
          inputMode, promptVariant,
          { wrongAnswerCount, trueFalseCorrectProbability, yearRange }
        );
        if (question) questions.push(question);
      }
    }
  }
  
  return questions;
}

/**
 * Pick a representative/memorable line from a song
 */
function pickRepresentativeLine(song) {
  if (!song.lyrics || song.lyrics.length === 0) return null;
  
  // Prefer lines from verse or chorus, at least 20 chars, at least 4 words
  const goodLines = song.lyrics.filter(line => {
    if (line.content.length < 20) return false;
    if (line.content.split(/\s+/).length < 4) return false;
    const section = line.section?.type?.toLowerCase() || '';
    return ['verse', 'chorus', 'hook'].includes(section);
  });
  
  if (goodLines.length > 0) {
    return goodLines[Math.floor(Math.random() * goodLines.length)];
  }
  
  // Fallback to any decent line
  const decentLines = song.lyrics.filter(line => line.content.length >= 15);
  if (decentLines.length > 0) {
    return decentLines[Math.floor(Math.random() * decentLines.length)];
  }
  
  return song.lyrics[0];
}

/**
 * Get wrong year answers
 */
function getWrongYearAnswers(correctYear, allYears, count) {
  const wrongYears = [];
  
  // Add years from the dataset (excluding correct)
  for (const year of allYears) {
    if (year !== correctYear) {
      wrongYears.push(year);
    }
  }
  
  // Add some nearby years if not enough
  for (let offset = 1; wrongYears.length < count && offset <= 10; offset++) {
    if (!wrongYears.includes(correctYear - offset) && correctYear - offset >= 1990) {
      wrongYears.push(correctYear - offset);
    }
    if (!wrongYears.includes(correctYear + offset) && correctYear + offset <= 2030) {
      wrongYears.push(correctYear + offset);
    }
  }
  
  return shuffle(wrongYears).slice(0, count);
}

/**
 * Create a question for a specific input mode
 */
function createQuestionForMode(song, line, wrongYearPool, inputMode, promptVariant, config) {
  const { wrongAnswerCount, trueFalseCorrectProbability, yearRange } = config;
  
  const subjectId = line 
    ? `${song.slug}-l${line.lineNumber}` 
    : `${song.slug}`;
  
  // Build title based on prompt variant and input mode
  let title;
  let content;
  
  if (inputMode === 'numeric') {
    if (promptVariant === 'by-lyric') {
      title = 'What year is this song from?';
      content = { type: 'text', text: `"${truncateLine(line.content)}"` };
    } else {
      title = `What year was "${song.title}" released?`;
      content = null;
    }
  } else if (inputMode === INPUT_MODES.TRUE_FALSE) {
    if (promptVariant === 'by-lyric') {
      title = `This lyric is from a song released in {shownAnswer}`;
      content = { type: 'text', text: `"${truncateLine(line.content)}"` };
    } else {
      title = `"${song.title}" was released in {shownAnswer}`;
      content = null;
    }
  } else {
    if (promptVariant === 'by-lyric') {
      title = 'What year is this song from?';
      content = { type: 'text', text: `"${truncateLine(line.content)}"` };
    } else {
      title = `What year was "${song.title}" released?`;
      content = null;
    }
  }
  
  // Build answer
  const answer = {
    entityRef: null,
    display: String(song.year),
    aliases: [String(song.year)]
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
    section: line?.section,
    difficulty: 'medium',
    extraTags: promptVariant === 'by-title' ? ['reveals-song'] : []
  });
  
  // Source tracking
  const source = {
    song: song.slug,
    lineNumber: line?.lineNumber || null,
    originalLine: line?.content || null
  };
  
  // Create question ID
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
  
  // Mode-specific fields
  if (inputMode === INPUT_MODES.MULTIPLE_CHOICE) {
    questionData.wrongAnswerPool = wrongYearPool.map(y => ({
      display: String(y),
      aliases: [String(y)]
    }));
    questionData.wrongAnswerCount = wrongAnswerCount;
  }
  
  if (inputMode === INPUT_MODES.TRUE_FALSE) {
    questionData.titleTemplate = title;
    questionData.wrongAnswerPool = wrongYearPool.map(y => ({
      display: String(y),
      aliases: [String(y)]
    }));
    questionData.trueFalseConfig = {
      correctProbability: trueFalseCorrectProbability
    };
  }
  
  if (inputMode === 'numeric') {
    questionData.type = 'numeric';
    questionData.correctAnswer = song.year;
    questionData.min = yearRange.min;
    questionData.max = yearRange.max;
    questionData.scoringMode = 'proximity';
  }
  
  return createQuestion(questionData);
}

/**
 * Truncate line for display if too long
 */
function truncateLine(content, maxLength = 60) {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength - 3) + '...';
}

export const meta = {
  type: GENERATOR_TYPE,
  version: VERSION,
  description: 'Generates "what year was this song released?" questions'
};
