/**
 * Artist From Lyric Generator
 * 
 * Generates "who rapped/sang this line?" questions.
 * Particularly useful for songs with featured artists where different
 * voices perform different sections.
 */

import {
  INPUT_MODES,
  createQuestionId,
  createQuestion
} from '../utils/question-schema.js';
import { buildTagSet } from '../utils/tag-builder.js';
import { resolveOrCreateEntity } from '../utils/alias-resolver.js';
import { shuffle } from '../utils/wrong-answer-generator.js';

const GENERATOR_TYPE = 'artist-from-lyric';
const VERSION = '1.0.0';

const MIN_LINE_LENGTH = 15;
const MIN_WORD_COUNT = 3;

/**
 * Generate artist-from-lyric questions for all songs
 * @param {object[]} songs - Array of normalized song objects
 * @param {object} config - Generator configuration
 * @returns {object[]} - Array of questions
 */
export function generate(songs, config = {}) {
  const {
    inputModeWeights = { 'free-text': 40, 'multiple-choice': 50, 'true-false': 10 },
    wrongAnswerCount = 3,
    trueFalseCorrectProbability = 0.5,
    onlyFeaturedSongs = false,  // Only generate for songs with features
    linesPerVoice = null  // Limit lines per voice per song
  } = config;
  
  const questions = [];
  
  // Collect all artists for wrong answer pool
  const allArtists = collectAllArtists(songs);
  
  for (const song of songs) {
    const songQuestions = generateForSong(song, allArtists, {
      inputModeWeights,
      wrongAnswerCount,
      trueFalseCorrectProbability,
      onlyFeaturedSongs,
      linesPerVoice
    });
    questions.push(...songQuestions);
  }
  
  console.log(`[${GENERATOR_TYPE}] Generated ${questions.length} questions`);
  return questions;
}

/**
 * Collect all unique artists from all songs
 */
function collectAllArtists(songs) {
  const artists = new Set();
  
  for (const song of songs) {
    if (song.artist) artists.add(song.artist);
    if (song.artists) song.artists.forEach(a => artists.add(a));
    if (song.features) song.features.forEach(f => artists.add(f));
    
    // Also collect from line voices
    for (const line of (song.lyrics || [])) {
      if (line.voices) {
        line.voices.forEach(v => {
          if (v.display) artists.add(v.display);
        });
      }
    }
  }
  
  return [...artists];
}

/**
 * Generate questions for a single song
 */
function generateForSong(song, allArtists, config) {
  const questions = [];
  const { inputModeWeights, wrongAnswerCount, trueFalseCorrectProbability, onlyFeaturedSongs, linesPerVoice } = config;
  
  // Skip songs without features if onlyFeaturedSongs is true
  if (onlyFeaturedSongs && (!song.features || song.features.length === 0)) {
    return questions;
  }
  
  // Group lines by voice
  const linesByVoice = new Map();
  
  for (const line of (song.lyrics || [])) {
    // The loader normalizes voice data to line.voice (string) and line.voiceId
    // Skip lines without voice attribution
    if (!line.voice) continue;
    if (line.content.length < MIN_LINE_LENGTH) continue;
    if (line.content.split(/\s+/).length < MIN_WORD_COUNT) continue;
    
    // voice is already a string (display name) from the loader
    const voiceDisplay = line.voice;
    const voiceKey = voiceDisplay.toLowerCase();
    if (!linesByVoice.has(voiceKey)) {
      linesByVoice.set(voiceKey, { voice: voiceDisplay, lines: [] });
    }
    linesByVoice.get(voiceKey).lines.push(line);
  }
  
  // Only generate if we have at least 2 different voices
  if (linesByVoice.size < 2) {
    return questions;
  }
  
  const modes = Object.entries(inputModeWeights).filter(([_, weight]) => weight > 0);
  const songArtists = getSongArtists(song);
  
  for (const [voiceKey, { voice, lines }] of linesByVoice) {
    // Optionally limit lines per voice
    let candidateLines = lines;
    if (linesPerVoice && lines.length > linesPerVoice) {
      candidateLines = shuffle(lines).slice(0, linesPerVoice);
    }
    
    // Get wrong answers - other artists on this song, then other artists in general
    const wrongArtistPool = getWrongArtistAnswers(voice, songArtists, allArtists, 10);
    
    for (const line of candidateLines) {
      for (const [inputMode, _] of modes) {
        const question = createQuestionForMode(
          song, line, voice, wrongArtistPool,
          inputMode, { wrongAnswerCount, trueFalseCorrectProbability }
        );
        if (question) questions.push(question);
      }
    }
  }
  
  return questions;
}

/**
 * Get all artists associated with a song
 */
function getSongArtists(song) {
  const artists = new Set();
  if (song.artist) artists.add(song.artist);
  if (song.artists) song.artists.forEach(a => artists.add(a));
  if (song.features) song.features.forEach(f => artists.add(f));
  return [...artists];
}

/**
 * Get wrong artist answers
 */
function getWrongArtistAnswers(correctArtist, songArtists, allArtists, count) {
  const wrong = [];
  
  // First, add other artists from the same song (more confusing)
  for (const artist of songArtists) {
    if (artist.toLowerCase() !== correctArtist.toLowerCase()) {
      wrong.push(artist);
    }
  }
  
  // Then add other artists from the dataset
  for (const artist of allArtists) {
    if (wrong.length >= count) break;
    if (artist.toLowerCase() !== correctArtist.toLowerCase() && !wrong.includes(artist)) {
      wrong.push(artist);
    }
  }
  
  return shuffle(wrong).slice(0, count);
}

/**
 * Create a question for a specific input mode
 */
function createQuestionForMode(song, line, voice, wrongArtistPool, inputMode, config) {
  const { wrongAnswerCount, trueFalseCorrectProbability } = config;
  
  const subjectId = `${song.slug}-l${line.lineNumber}`;
  
  // Build title
  let title;
  if (inputMode === INPUT_MODES.TRUE_FALSE) {
    title = `{shownAnswer} rapped/sang this line`;
  } else {
    title = 'Who rapped/sang this line?';
  }
  
  // Content is the lyric (truncated for display)
  const displayLine = line.content.length > 80 
    ? line.content.slice(0, 77) + '...' 
    : line.content;
  
  const content = {
    type: 'text',
    text: `"${displayLine}"`
  };
  
  // Build answer
  const answer = resolveOrCreateEntity('artist', voice);
  
  // Build tags
  const tags = buildTagSet({
    generatorType: GENERATOR_TYPE,
    inputMode,
    promptVariant: 'standard',
    song: song.title,
    album: song.album,
    artist: song.artist,
    artists: song.artists,
    features: song.features,
    year: song.year,
    section: line.section,
    voice: { display: voice },
    difficulty: estimateDifficulty(song, voice),
    extraTags: ['features', 'voice-identification']
  });
  
  // Source tracking
  const source = {
    song: song.slug,
    lineNumber: line.lineNumber,
    originalLine: line.content,
    voice
  };
  
  const questionId = createQuestionId(GENERATOR_TYPE, subjectId, inputMode, 'standard');
  
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
    questionData.wrongAnswerPool = wrongArtistPool.map(a => 
      resolveOrCreateEntity('artist', a)
    );
    questionData.wrongAnswerCount = wrongAnswerCount;
  }
  
  if (inputMode === INPUT_MODES.TRUE_FALSE) {
    questionData.titleTemplate = title;
    questionData.wrongAnswerPool = wrongArtistPool.map(a => 
      resolveOrCreateEntity('artist', a)
    );
    questionData.trueFalseConfig = {
      correctProbability: trueFalseCorrectProbability
    };
  }
  
  return createQuestion(questionData);
}

/**
 * Estimate difficulty based on how recognizable the voice is
 */
function estimateDifficulty(song, voice) {
  // Main artist is usually easier to identify
  if (song.artist && voice.toLowerCase() === song.artist.toLowerCase()) {
    return 'easy';
  }
  
  // Well-known features might be medium
  const wellKnownArtists = ['jay-z', 'nicki minaj', 'rick ross', 'kid cudi', 'pusha t'];
  if (wellKnownArtists.some(a => voice.toLowerCase().includes(a))) {
    return 'medium';
  }
  
  return 'hard';
}

export const meta = {
  type: GENERATOR_TYPE,
  version: VERSION,
  description: 'Generates "who rapped/sang this line?" questions'
};
