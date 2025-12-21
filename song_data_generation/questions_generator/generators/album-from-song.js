/**
 * Album From Song Generator
 * 
 * Generates "what album is this song from?" questions.
 * Supports both by-title and by-lyric prompt variants.
 */

import {
  INPUT_MODES,
  createQuestionId,
  createQuestion
} from '../utils/question-schema.js';
import { buildTagSet } from '../utils/tag-builder.js';
import { resolveOrCreateEntity } from '../utils/alias-resolver.js';
import { getWrongAlbumAnswers, shuffle } from '../utils/wrong-answer-generator.js';

const GENERATOR_TYPE = 'album-from-song';
const VERSION = '1.0.0';

/**
 * Generate album-from-song questions for all songs
 * @param {object[]} songs - Array of normalized song objects
 * @param {object} config - Generator configuration
 * @returns {object[]} - Array of questions
 */
export function generate(songs, config = {}) {
  const {
    inputModeWeights = { 'free-text': 50, 'multiple-choice': 40, 'true-false': 10 },
    promptVariants = ['by-title', 'by-lyric'],
    minWrongAnswers = 10,
    wrongAnswerCount = 3,
    trueFalseCorrectProbability = 0.5,
    lyricPoolSize = 5
  } = config;
  
  const questions = [];
  
  // Only process songs that have an album
  const songsWithAlbum = songs.filter(s => s.album);
  
  for (const song of songsWithAlbum) {
    const songQuestions = generateForSong(song, {
      inputModeWeights,
      promptVariants,
      minWrongAnswers,
      wrongAnswerCount,
      trueFalseCorrectProbability,
      lyricPoolSize
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
  const { inputModeWeights, promptVariants, minWrongAnswers, wrongAnswerCount, trueFalseCorrectProbability, lyricPoolSize } = config;
  
  // Get answer entity
  const answer = resolveOrCreateEntity('album', song.album);
  
  // Get wrong answers
  const wrongAnswerPool = getWrongAlbumAnswers(song, minWrongAnswers);
  
  // Build lyric pool for by-lyric variant
  const lyricPool = buildLyricPool(song, lyricPoolSize);
  
  const modes = Object.entries(inputModeWeights).filter(([_, weight]) => weight > 0);
  
  for (const [inputMode, _] of modes) {
    for (const promptVariant of promptVariants) {
      // Skip by-lyric if no good lyrics
      if (promptVariant === 'by-lyric' && lyricPool.length === 0) continue;
      
      const question = createQuestionForMode(
        song, answer, wrongAnswerPool, lyricPool,
        inputMode, promptVariant,
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
 * Build a pool of good lyrics for the by-lyric variant
 */
function buildLyricPool(song, poolSize) {
  const candidates = song.lyrics.filter(line => {
    if (line.content.length < 20) return false;
    if (line.content.split(/\s+/).length < 4) return false;
    // Prefer chorus and memorable lines
    return true;
  });
  
  // Prioritize chorus lines
  const chorusLines = candidates.filter(l => l.section === 'chorus');
  const otherLines = candidates.filter(l => l.section !== 'chorus');
  
  const pool = [];
  
  // Add chorus lines first (up to half the pool)
  for (const line of shuffle(chorusLines).slice(0, Math.ceil(poolSize / 2))) {
    pool.push({
      lineNumber: line.lineNumber,
      text: line.content,
      section: line.section
    });
  }
  
  // Fill with other lines
  for (const line of shuffle(otherLines).slice(0, poolSize - pool.length)) {
    pool.push({
      lineNumber: line.lineNumber,
      text: line.content,
      section: line.section
    });
  }
  
  return pool;
}

/**
 * Create a question for a specific input mode and prompt variant
 */
function createQuestionForMode(song, answer, wrongAnswerPool, lyricPool, inputMode, promptVariant, config) {
  const { wrongAnswerCount, trueFalseCorrectProbability } = config;
  
  const subjectId = `${song.slug}`;
  
  // Build title and content based on prompt variant
  let title, content, contentTemplate;
  
  if (promptVariant === 'by-lyric') {
    if (inputMode === INPUT_MODES.TRUE_FALSE) {
      title = `This song is from the album "{shownAnswer}"`;
    } else {
      title = 'What album is this song from?';
    }
    
    // Use first lyric as default, with pool for runtime selection
    content = {
      type: 'text',
      text: lyricPool.length > 0 ? `"${lyricPool[0].text}"` : ''
    };
    contentTemplate = '"{lyric}"';
  } else {
    // by-title
    if (inputMode === INPUT_MODES.TRUE_FALSE) {
      title = `"${song.title}" is from the album "{shownAnswer}"`;
    } else {
      title = `What album is "${song.title}" from?`;
    }
    
    content = { type: 'text', text: '' };
  }
  
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
    difficulty: 'medium',
    extraTags: promptVariant === 'by-title' ? ['reveals-song'] : []
  });
  
  // Source tracking
  const source = {
    song: song.slug,
    album: song.album
  };
  
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
  
  // Add lyric pool for by-lyric variant
  if (promptVariant === 'by-lyric' && lyricPool.length > 0) {
    questionData.lyricPool = lyricPool;
    questionData.contentTemplate = contentTemplate;
  }
  
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

export const meta = {
  type: GENERATOR_TYPE,
  version: VERSION,
  description: 'Generates "what album is this song from?" questions'
};
