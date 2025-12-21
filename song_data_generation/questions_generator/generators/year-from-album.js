/**
 * Year From Album Generator
 * 
 * Generates "what year was this album released?" questions.
 * Uses projects.json data for album information.
 * 
 * Supports free-text, multiple-choice, true-false, and numeric input modes.
 */

import {
  INPUT_MODES,
  createQuestionId,
  createQuestion
} from '../utils/question-schema.js';
import { buildTagSet } from '../utils/tag-builder.js';
import { shuffle } from '../utils/wrong-answer-generator.js';
import { getProjects } from '../utils/lyrics-loader.js';

const GENERATOR_TYPE = 'year-from-album';
const VERSION = '1.0.0';

/**
 * Generate year-from-album questions
 * @param {object[]} songs - Array of normalized song objects (used to derive albums)
 * @param {object} config - Generator configuration
 * @returns {object[]} - Array of questions
 */
export function generate(songs, config = {}) {
  const {
    inputModeWeights = { 'free-text': 30, 'multiple-choice': 40, 'true-false': 10, 'numeric': 20 },
    wrongAnswerCount = 3,
    trueFalseCorrectProbability = 0.5,
    yearRange = { min: 1990, max: 2030 },
    yearProximityRange = 5  // For wrong answers, years within this range
  } = config;
  
  const questions = [];
  
  // Get album data from projects
  const projectsData = getProjects();
  
  // Build album list from projects.json AND from songs
  const albums = buildAlbumList(songs, projectsData);
  
  if (albums.length === 0) {
    console.log(`[${GENERATOR_TYPE}] No albums with year data found`);
    return questions;
  }
  
  // Collect all years for wrong answer generation
  const allYears = [...new Set(albums.map(a => a.year))].sort((a, b) => a - b);
  
  for (const album of albums) {
    const albumQuestions = generateForAlbum(album, allYears, {
      inputModeWeights,
      wrongAnswerCount,
      trueFalseCorrectProbability,
      yearRange,
      yearProximityRange
    });
    questions.push(...albumQuestions);
  }
  
  console.log(`[${GENERATOR_TYPE}] Generated ${questions.length} questions`);
  return questions;
}

/**
 * Build list of unique albums with year data
 */
function buildAlbumList(songs, projectsData) {
  const albumMap = new Map();
  
  // First, add from projects.json (authoritative source)
  if (projectsData) {
    for (const [albumName, data] of Object.entries(projectsData)) {
      if (data.year) {
        albumMap.set(albumName.toLowerCase(), {
          name: albumName,
          year: data.year,
          artist: data.artist || 'Kanye West',
          type: data.type || 'album',
          source: 'projects'
        });
      }
    }
  }
  
  // Then supplement with data from songs (for any albums not in projects)
  for (const song of songs) {
    if (song.album && song.year) {
      const key = song.album.toLowerCase();
      if (!albumMap.has(key)) {
        albumMap.set(key, {
          name: song.album,
          year: song.year,
          artist: song.artist || 'Kanye West',
          type: 'album',
          source: 'songs'
        });
      }
    }
  }
  
  return [...albumMap.values()];
}

/**
 * Generate questions for a single album
 */
function generateForAlbum(album, allYears, config) {
  const questions = [];
  const { inputModeWeights, wrongAnswerCount, trueFalseCorrectProbability, yearRange, yearProximityRange } = config;
  
  const modes = Object.entries(inputModeWeights).filter(([_, weight]) => weight > 0);
  
  for (const [inputMode, _] of modes) {
    const question = createQuestionForMode(
      album, allYears,
      inputMode,
      { wrongAnswerCount, trueFalseCorrectProbability, yearRange, yearProximityRange }
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
function createQuestionForMode(album, allYears, inputMode, config) {
  const { wrongAnswerCount, trueFalseCorrectProbability, yearRange, yearProximityRange } = config;
  
  const questionText = `What year was "${album.name}" released?`;
  const correctYear = album.year;
  const slug = album.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  
  // Build tags
  const tags = buildTagSet({
    generator: GENERATOR_TYPE,
    inputMode,
    artist: album.artist,
    album: album.name,
    year: album.year
  });
  
  // Create base question data
  const baseData = {
    generator: GENERATOR_TYPE,
    version: VERSION,
    album: album.name,
    artist: album.artist,
    year: album.year,
    tags
  };
  
  // Handle different input modes
  if (inputMode === INPUT_MODES.FREE_TEXT) {
    const id = createQuestionId(GENERATOR_TYPE, inputMode, slug);
    
    return createQuestion({
      id,
      type: 'free-text',
      title: questionText,
      answers: [String(correctYear)],
      ...baseData
    });
    
  } else if (inputMode === INPUT_MODES.MULTIPLE_CHOICE) {
    const id = createQuestionId(GENERATOR_TYPE, inputMode, slug);
    
    // Get wrong years (prefer nearby years for difficulty)
    const wrongYears = getWrongYears(correctYear, allYears, yearProximityRange, wrongAnswerCount);
    
    if (wrongYears.length < wrongAnswerCount) {
      // Not enough wrong years, generate some
      const generated = generateNearbyYears(correctYear, wrongAnswerCount, yearRange);
      wrongYears.push(...generated);
    }
    
    const choices = shuffle([
      { id: 'correct', text: String(correctYear), isCorrect: true },
      ...wrongYears.slice(0, wrongAnswerCount).map((year, i) => ({
        id: `wrong-${i}`,
        text: String(year),
        isCorrect: false
      }))
    ]);
    
    return createQuestion({
      id,
      type: 'multiple-choice',
      title: questionText,
      choices,
      answer: String(correctYear),
      ...baseData
    });
    
  } else if (inputMode === INPUT_MODES.TRUE_FALSE) {
    const isCorrectStatement = Math.random() < trueFalseCorrectProbability;
    const id = createQuestionId(GENERATOR_TYPE, inputMode, slug, isCorrectStatement ? 'true' : 'false');
    
    let statement, correctAnswer;
    
    if (isCorrectStatement) {
      statement = `"${album.name}" was released in ${correctYear}.`;
      correctAnswer = 'true';
    } else {
      // Pick a wrong year
      const wrongYear = getRandomWrongYear(correctYear, allYears, yearRange);
      statement = `"${album.name}" was released in ${wrongYear}.`;
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
    
  } else if (inputMode === INPUT_MODES.NUMERIC) {
    const id = createQuestionId(GENERATOR_TYPE, inputMode, slug);
    
    return createQuestion({
      id,
      type: 'numeric',
      title: questionText,
      answer: correctYear,
      scoringMode: 'proximity',
      numericConfig: {
        exactPoints: 100,
        closePoints: 50,
        closeRange: 2,  // Within 2 years = partial credit
        farPoints: 0
      },
      ...baseData
    });
  }
  
  return null;
}

/**
 * Get wrong years from existing data (preferring nearby years)
 */
function getWrongYears(correctYear, allYears, proximityRange, count) {
  const nearbyYears = allYears.filter(y =>
    y !== correctYear &&
    Math.abs(y - correctYear) <= proximityRange
  );
  
  const shuffled = shuffle(nearbyYears);
  return shuffled.slice(0, count);
}

/**
 * Generate nearby years when not enough exist in data
 */
function generateNearbyYears(correctYear, count, yearRange) {
  const years = [];
  const offsets = [-3, -2, -1, 1, 2, 3, -4, 4, -5, 5];
  
  for (const offset of offsets) {
    const year = correctYear + offset;
    if (year >= yearRange.min && year <= yearRange.max && year !== correctYear) {
      years.push(year);
    }
    if (years.length >= count) break;
  }
  
  return shuffle(years);
}

/**
 * Get a random wrong year
 */
function getRandomWrongYear(correctYear, allYears, yearRange) {
  // First try to use a year from the data
  const otherYears = allYears.filter(y => y !== correctYear);
  if (otherYears.length > 0) {
    return otherYears[Math.floor(Math.random() * otherYears.length)];
  }
  
  // Otherwise generate one
  let wrongYear;
  do {
    const offset = Math.floor(Math.random() * 10) - 5;
    wrongYear = correctYear + (offset === 0 ? 1 : offset);
  } while (wrongYear === correctYear || wrongYear < yearRange.min || wrongYear > yearRange.max);
  
  return wrongYear;
}

export default { generate, type: GENERATOR_TYPE, version: VERSION };
