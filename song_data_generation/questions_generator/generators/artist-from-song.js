/**
 * Artist From Song Generator
 * 
 * Generates "who released/made this song?" questions.
 * This is about the MAIN ARTIST who released the song, not who performed
 * a specific line (that's artist-from-lyric which identifies voices).
 * 
 * Supports both by-title and by-lyric prompt variants.
 */

import {
  INPUT_MODES,
  createQuestionId,
  createQuestion
} from '../utils/question-schema.js';
import { buildTagSet } from '../utils/tag-builder.js';
import { resolveOrCreateEntity } from '../utils/alias-resolver.js';
import { shuffle } from '../utils/wrong-answer-generator.js';

const GENERATOR_TYPE = 'artist-from-song';
const VERSION = '1.0.0';

/**
 * Generate artist-from-song questions for all songs
 * @param {object[]} songs - Array of normalized song objects
 * @param {object} config - Generator configuration
 * @returns {object[]} - Array of questions
 */
export function generate(songs, config = {}) {
  const {
    inputModeWeights = { 'free-text': 50, 'multiple-choice': 40, 'true-false': 10 },
    promptVariants = ['by-title', 'by-lyric'],
    wrongAnswerCount = 3,
    trueFalseCorrectProbability = 0.5,
    lyricPoolSize = 5
  } = config;
  
  const questions = [];
  
  // Collect all unique artists for wrong answer pool
  const allArtists = collectAllArtists(songs);
  
  // Only useful if we have multiple artists to distinguish
  if (allArtists.length < 4) {
    console.log(`[${GENERATOR_TYPE}] Not enough artists (${allArtists.length}) to generate meaningful questions`);
    return questions;
  }
  
  for (const song of songs) {
    const songQuestions = generateForSong(song, allArtists, {
      inputModeWeights,
      promptVariants,
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
 * Collect all unique main artists from songs
 */
function collectAllArtists(songs) {
  const artists = new Set();
  
  for (const song of songs) {
    if (song.artist) {
      artists.add(song.artist);
    }
    // Also add from artists array if present
    if (song.artists) {
      song.artists.forEach(a => artists.add(a));
    }
  }
  
  return [...artists];
}

/**
 * Generate questions for a single song
 */
function generateForSong(song, allArtists, config) {
  const questions = [];
  const { inputModeWeights, promptVariants, wrongAnswerCount, trueFalseCorrectProbability, lyricPoolSize } = config;
  
  // Must have an artist
  if (!song.artist) return questions;
  
  // Get answer entity
  const answer = resolveOrCreateEntity('artist', song.artist);
  
  // Get wrong answers (other artists, not on this song)
  const wrongAnswerPool = getWrongArtistAnswers(song.artist, song.artists || [], allArtists);
  
  if (wrongAnswerPool.length < wrongAnswerCount) {
    return questions; // Not enough wrong answers
  }
  
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
 * Get wrong artist answers
 */
function getWrongArtistAnswers(correctArtist, songArtists, allArtists) {
  const correctLower = correctArtist.toLowerCase();
  const songArtistLower = new Set((songArtists || []).map(a => a.toLowerCase()));
  
  // Filter out correct answer and any co-artists on this song
  return allArtists.filter(artist => {
    const lower = artist.toLowerCase();
    return lower !== correctLower && !songArtistLower.has(lower);
  });
}

/**
 * Build a pool of good lyrics for the by-lyric variant
 */
function buildLyricPool(song, poolSize) {
  const candidates = (song.lyrics || []).filter(line => {
    if (!line.content || line.content.length < 20) return false;
    if (line.content.split(/\s+/).length < 4) return false;
    // Skip lines that are too generic
    if (/^(yeah|oh|uh|hey|la la|na na)/i.test(line.content)) return false;
    return true;
  });
  
  return shuffle(candidates).slice(0, poolSize);
}

/**
 * Create a question for a specific input mode
 */
function createQuestionForMode(song, answer, wrongAnswerPool, lyricPool, inputMode, promptVariant, config) {
  const { wrongAnswerCount, trueFalseCorrectProbability } = config;
  
  // Build content based on prompt variant
  let content, questionText;
  
  if (promptVariant === 'by-title') {
    questionText = `Who released the song "${song.title}"?`;
    content = null;
  } else if (promptVariant === 'by-lyric') {
    if (lyricPool.length === 0) return null;
    const lyric = lyricPool[Math.floor(Math.random() * lyricPool.length)];
    questionText = 'Who released the song with this lyric?';
    content = `"${lyric.content}"`;
  }
  
  // Build tags
  const tags = buildTagSet({
    generator: GENERATOR_TYPE,
    inputMode,
    promptVariant,
    artist: song.artist,
    album: song.album,
    year: song.year,
    song: song.title
  });
  
  // Create base question data
  const baseData = {
    generator: GENERATOR_TYPE,
    version: VERSION,
    sourceFile: song.filename,
    song: song.title,
    artist: song.artist,
    album: song.album,
    year: song.year,
    promptVariant,
    tags
  };
  
  // Handle different input modes
  if (inputMode === INPUT_MODES.FREE_TEXT) {
    const id = createQuestionId(GENERATOR_TYPE, inputMode, song.slug, promptVariant);
    
    return createQuestion({
      id,
      type: 'free-text',
      title: questionText,
      content,
      answers: [answer.canonical, ...(answer.aliases || [])],
      ...baseData
    });
    
  } else if (inputMode === INPUT_MODES.MULTIPLE_CHOICE) {
    const id = createQuestionId(GENERATOR_TYPE, inputMode, song.slug, promptVariant);
    
    // Select wrong answers
    const wrongAnswers = shuffle(wrongAnswerPool).slice(0, wrongAnswerCount);
    const choices = shuffle([
      { id: 'correct', text: answer.canonical, isCorrect: true },
      ...wrongAnswers.map((wrong, i) => ({ id: `wrong-${i}`, text: wrong, isCorrect: false }))
    ]);
    
    return createQuestion({
      id,
      type: 'multiple-choice',
      title: questionText,
      content,
      choices,
      answer: answer.canonical,
      ...baseData
    });
    
  } else if (inputMode === INPUT_MODES.TRUE_FALSE) {
    const isCorrectStatement = Math.random() < trueFalseCorrectProbability;
    const id = createQuestionId(GENERATOR_TYPE, inputMode, song.slug, promptVariant, isCorrectStatement ? 'true' : 'false');
    
    let statement, correctAnswer;
    
    if (isCorrectStatement) {
      if (promptVariant === 'by-title') {
        statement = `"${song.title}" was released by ${answer.canonical}.`;
      } else {
        if (lyricPool.length === 0) return null;
        const lyric = lyricPool[Math.floor(Math.random() * lyricPool.length)];
        statement = `The lyric "${lyric.content}" is from a song by ${answer.canonical}.`;
      }
      correctAnswer = 'true';
    } else {
      // Use a wrong artist
      const wrongArtist = wrongAnswerPool[Math.floor(Math.random() * wrongAnswerPool.length)];
      if (!wrongArtist) return null;
      
      if (promptVariant === 'by-title') {
        statement = `"${song.title}" was released by ${wrongArtist}.`;
      } else {
        if (lyricPool.length === 0) return null;
        const lyric = lyricPool[Math.floor(Math.random() * lyricPool.length)];
        statement = `The lyric "${lyric.content}" is from a song by ${wrongArtist}.`;
      }
      correctAnswer = 'false';
    }
    
    return createQuestion({
      id,
      type: 'true-false',
      title: 'True or False?',
      content: statement,
      answer: correctAnswer,
      ...baseData
    });
  }
  
  return null;
}

export default { generate, type: GENERATOR_TYPE, version: VERSION };
