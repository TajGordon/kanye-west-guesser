/**
 * Next Line Generator
 * 
 * Generates "what comes after this line?" questions.
 * Tests knowledge of song flow and memorization.
 */

import {
  INPUT_MODES,
  createQuestionId,
  createQuestion
} from '../utils/question-schema.js';
import { buildTagSet } from '../utils/tag-builder.js';
import { shuffle } from '../utils/wrong-answer-generator.js';

const GENERATOR_TYPE = 'next-line';
const VERSION = '1.0.0';

const MIN_LINE_LENGTH = 15;
const MIN_WORD_COUNT = 3;

/**
 * Generate next-line questions for all songs
 * @param {object[]} songs - Array of normalized song objects
 * @param {object} config - Generator configuration
 * @returns {object[]} - Array of questions
 */
export function generate(songs, config = {}) {
  const {
    inputModeWeights = { 'free-text': 60, 'multiple-choice': 40 },
    promptVariants = ['standard', 'with-song-title'],
    wrongAnswerCount = 3,
    skipSectionBoundaries = true,  // Don't ask for line after section ends
    linesPerSong = null  // null = all valid lines
  } = config;
  
  const questions = [];
  
  for (const song of songs) {
    const songQuestions = generateForSong(song, songs, {
      inputModeWeights,
      promptVariants,
      wrongAnswerCount,
      skipSectionBoundaries,
      linesPerSong
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
  const { inputModeWeights, promptVariants, wrongAnswerCount, skipSectionBoundaries, linesPerSong } = config;
  
  const lyrics = song.lyrics || [];
  if (lyrics.length < 2) return questions;
  
  // Find valid line pairs (line + next line)
  const validPairs = [];
  
  for (let i = 0; i < lyrics.length - 1; i++) {
    const currentLine = lyrics[i];
    const nextLine = lyrics[i + 1];
    
    // Skip if either line is too short
    if (currentLine.content.length < MIN_LINE_LENGTH) continue;
    if (nextLine.content.length < MIN_LINE_LENGTH) continue;
    if (currentLine.content.split(/\s+/).length < MIN_WORD_COUNT) continue;
    if (nextLine.content.split(/\s+/).length < MIN_WORD_COUNT) continue;
    
    // Optionally skip section boundaries
    if (skipSectionBoundaries) {
      const currentSection = currentLine.section?.type;
      const nextSection = nextLine.section?.type;
      if (currentSection && nextSection && currentSection !== nextSection) continue;
    }
    
    // Skip if lines are identical (repeated lines)
    if (currentLine.content.toLowerCase() === nextLine.content.toLowerCase()) continue;
    
    validPairs.push({ current: currentLine, next: nextLine, index: i });
  }
  
  // Optionally limit
  let candidatePairs = validPairs;
  if (linesPerSong && validPairs.length > linesPerSong) {
    candidatePairs = shuffle(validPairs).slice(0, linesPerSong);
  }
  
  const modes = Object.entries(inputModeWeights).filter(([_, weight]) => weight > 0);
  
  // Get wrong answer pool (other lines from same song and other songs)
  const wrongLinePool = getWrongLineAnswers(song, allSongs, 15);
  
  for (const pair of candidatePairs) {
    for (const [inputMode, _] of modes) {
      for (const promptVariant of promptVariants) {
        const question = createQuestionForMode(
          song, pair, wrongLinePool,
          inputMode, promptVariant,
          { wrongAnswerCount }
        );
        if (question) questions.push(question);
      }
    }
  }
  
  return questions;
}

/**
 * Get wrong line answers from same song and other songs
 */
function getWrongLineAnswers(song, allSongs, count) {
  const wrongLines = [];
  
  // Add lines from same song first (more confusing)
  for (const line of (song.lyrics || [])) {
    if (line.content.length >= MIN_LINE_LENGTH) {
      wrongLines.push({
        text: line.content,
        song: song.title
      });
    }
  }
  
  // Add lines from other songs
  for (const otherSong of allSongs) {
    if (otherSong.slug === song.slug) continue;
    
    for (const line of (otherSong.lyrics || [])) {
      if (wrongLines.length >= count * 2) break;
      if (line.content.length >= MIN_LINE_LENGTH) {
        wrongLines.push({
          text: line.content,
          song: otherSong.title
        });
      }
    }
    
    if (wrongLines.length >= count * 2) break;
  }
  
  return shuffle(wrongLines);
}

/**
 * Create a question for a specific input mode
 */
function createQuestionForMode(song, pair, wrongLinePool, inputMode, promptVariant, config) {
  const { wrongAnswerCount } = config;
  
  const subjectId = `${song.slug}-l${pair.current.lineNumber}`;
  
  // Build title
  let title;
  if (promptVariant === 'with-song-title') {
    title = `In "${song.title}", what comes after this line?`;
  } else {
    title = 'What comes after this line?';
  }
  
  // Truncate for display
  const displayLine = pair.current.content.length > 70 
    ? pair.current.content.slice(0, 67) + '...'
    : pair.current.content;
  
  const content = {
    type: 'text',
    text: `"${displayLine}"`
  };
  
  // The answer is the next line
  const nextLineDisplay = pair.next.content.length > 60
    ? pair.next.content.slice(0, 57) + '...'
    : pair.next.content;
  
  const answer = {
    entityRef: null,
    display: nextLineDisplay,
    aliases: [pair.next.content.toLowerCase()]
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
    section: pair.current.section,
    difficulty: 'hard',  // Next line questions are generally harder
    extraTags: promptVariant === 'with-song-title' ? ['reveals-song'] : []
  });
  
  // Source tracking
  const source = {
    song: song.slug,
    lineNumber: pair.current.lineNumber,
    nextLineNumber: pair.next.lineNumber,
    originalLine: pair.current.content,
    nextLine: pair.next.content
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
  
  // Mode-specific fields
  if (inputMode === INPUT_MODES.MULTIPLE_CHOICE) {
    // Filter out the correct answer from wrong pool
    const filteredWrong = wrongLinePool.filter(w => 
      w.text.toLowerCase() !== pair.next.content.toLowerCase()
    );
    
    questionData.wrongAnswerPool = filteredWrong.slice(0, wrongAnswerCount * 2).map(w => ({
      display: w.text.length > 60 ? w.text.slice(0, 57) + '...' : w.text,
      aliases: [w.text.toLowerCase()]
    }));
    questionData.wrongAnswerCount = wrongAnswerCount;
  }
  
  return createQuestion(questionData);
}

export const meta = {
  type: GENERATOR_TYPE,
  version: VERSION,
  description: 'Generates "what comes after this line?" questions'
};
