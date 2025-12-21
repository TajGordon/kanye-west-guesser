/**
 * Features On Song Generator
 * 
 * Generates "name all the featured artists on this song" questions.
 * Uses multi-entry input mode where players guess one feature at a time.
 */

import {
  INPUT_MODES,
  createQuestionId,
  createQuestion
} from '../utils/question-schema.js';
import { buildTagSet } from '../utils/tag-builder.js';
import { resolveOrCreateEntity } from '../utils/alias-resolver.js';

const GENERATOR_TYPE = 'features-on-song';
const VERSION = '1.0.0';

const MIN_FEATURES = 2;  // Only generate for songs with at least 2 features

/**
 * Generate features-on-song questions for all songs
 * @param {object[]} songs - Array of normalized song objects
 * @param {object} config - Generator configuration
 * @returns {object[]} - Array of questions
 */
export function generate(songs, config = {}) {
  const {
    promptVariants = ['by-title', 'by-lyric'],
    minFeatures = MIN_FEATURES,
    maxGuessesMultiplier = 2,  // maxGuesses = features.length * multiplier
    baseMaxGuesses = 3  // Minimum max guesses
  } = config;
  
  const questions = [];
  
  for (const song of songs) {
    if (!song.features || song.features.length < minFeatures) continue;
    
    const songQuestions = generateForSong(song, {
      promptVariants,
      maxGuessesMultiplier,
      baseMaxGuesses
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
  const { promptVariants, maxGuessesMultiplier, baseMaxGuesses } = config;
  
  for (const promptVariant of promptVariants) {
    // For 'by-lyric' variant, pick a representative line
    if (promptVariant === 'by-lyric') {
      const representativeLine = pickRepresentativeLine(song);
      if (!representativeLine) continue;
      
      const question = createQuestion_internal(song, representativeLine, promptVariant, config);
      if (question) questions.push(question);
    } else {
      // 'by-title' variant
      const question = createQuestion_internal(song, null, promptVariant, config);
      if (question) questions.push(question);
    }
  }
  
  return questions;
}

/**
 * Pick a representative line (preferably from a featured verse)
 */
function pickRepresentativeLine(song) {
  if (!song.lyrics || song.lyrics.length === 0) return null;
  
  // Prefer lines from featured artists
  const featuredLines = song.lyrics.filter(line => {
    if (!line.voices || line.voices.length === 0) return false;
    const voice = line.voices[0].display?.toLowerCase() || '';
    const mainArtist = (song.artist || '').toLowerCase();
    return voice !== mainArtist && line.content.length >= 20;
  });
  
  if (featuredLines.length > 0) {
    return featuredLines[Math.floor(Math.random() * featuredLines.length)];
  }
  
  // Fallback to any decent line
  const decentLines = song.lyrics.filter(line => line.content.length >= 20);
  if (decentLines.length > 0) {
    return decentLines[Math.floor(Math.random() * decentLines.length)];
  }
  
  return null;
}

/**
 * Create a multi-entry question
 */
function createQuestion_internal(song, line, promptVariant, config) {
  const { maxGuessesMultiplier, baseMaxGuesses } = config;
  
  const subjectId = line 
    ? `${song.slug}-l${line.lineNumber}`
    : song.slug;
  
  // Build title
  let title;
  let content;
  
  if (promptVariant === 'by-lyric') {
    title = 'Name all the featured artists on this song';
    const displayLine = line.content.length > 60 
      ? line.content.slice(0, 57) + '...' 
      : line.content;
    content = { type: 'text', text: `"${displayLine}"` };
  } else {
    title = `Name all the featured artists on "${song.title}"`;
    content = null;
  }
  
  // Build answers - each feature is a separate answer
  const answers = song.features.map(feature => {
    const entity = resolveOrCreateEntity('artist', feature);
    return {
      display: entity.display,
      aliases: entity.aliases || [feature.toLowerCase()]
    };
  });
  
  // Calculate max guesses
  const maxGuesses = Math.max(
    baseMaxGuesses,
    Math.ceil(song.features.length * maxGuessesMultiplier)
  );
  
  // Build tags
  const tags = buildTagSet({
    generatorType: GENERATOR_TYPE,
    inputMode: 'multi-entry',
    promptVariant,
    song: song.title,
    album: song.album,
    artist: song.artist,
    artists: song.artists,
    features: song.features,
    year: song.year,
    difficulty: estimateDifficulty(song.features.length),
    extraTags: ['features', 'multi-entry', promptVariant === 'by-title' ? 'reveals-song' : null].filter(Boolean)
  });
  
  // Source tracking
  const source = {
    song: song.slug,
    lineNumber: line?.lineNumber || null,
    features: song.features
  };
  
  const questionId = createQuestionId(GENERATOR_TYPE, subjectId, 'multi-entry', promptVariant);
  
  return createQuestion({
    id: questionId,
    type: 'multi-entry',
    generatorType: GENERATOR_TYPE,
    title,
    content,
    answers,  // Multi-entry has multiple answers
    maxGuesses,
    scoringMode: 'multi-entry',
    tags,
    source
  });
}

/**
 * Estimate difficulty based on number of features
 */
function estimateDifficulty(featureCount) {
  if (featureCount <= 2) return 'easy';
  if (featureCount <= 4) return 'medium';
  return 'hard';
}

export const meta = {
  type: GENERATOR_TYPE,
  version: VERSION,
  description: 'Generates "name all the featured artists" questions (multi-entry)'
};
