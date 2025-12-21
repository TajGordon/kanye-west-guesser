/**
 * Wrong Answer Generator
 * 
 * Utilities for generating plausible wrong answers for MC/TF questions.
 */

import {
  getSongsByAlbum,
  getSongsByArtist,
  getSongsByYear,
  getAllAlbums,
  getAllArtists,
  getAllYears,
  getOtherSongsOnAlbum,
  getOtherSongsByArtist,
  getOtherAlbumsByArtist
} from './lyrics-loader.js';
import { resolveOrCreateEntity } from './alias-resolver.js';

/**
 * Get wrong song answers for a "which song" question
 * Strategy: prefer same album, then same artist, then same year
 * 
 * @param {object} correctSong - The song that's the correct answer
 * @param {number} minCount - Minimum wrong answers to generate
 * @returns {object[]} - Array of { entityRef, display, aliases }
 */
export function getWrongSongAnswers(correctSong, minCount = 10) {
  const wrongs = [];
  const seen = new Set();
  seen.add(correctSong.title.toLowerCase());
  
  const addSong = (song) => {
    const key = song.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    wrongs.push(resolveOrCreateEntity('song', song.title));
  };
  
  // Priority 1: Same album (50% of pool if possible)
  const sameAlbum = getOtherSongsOnAlbum(correctSong);
  const albumTarget = Math.min(sameAlbum.length, Math.ceil(minCount * 0.5));
  shuffle(sameAlbum).slice(0, albumTarget).forEach(addSong);
  
  // Priority 2: Same artist, different album
  const sameArtist = getOtherSongsByArtist(correctSong)
    .filter(s => s.album !== correctSong.album);
  const artistTarget = Math.min(sameArtist.length, Math.ceil(minCount * 0.3));
  shuffle(sameArtist).slice(0, artistTarget).forEach(addSong);
  
  // Priority 3: Same year, different artist
  if (correctSong.year && wrongs.length < minCount) {
    const sameYear = getSongsByYear(correctSong.year)
      .filter(s => !correctSong.artists.some(a => s.artists.includes(a)));
    shuffle(sameYear).slice(0, minCount - wrongs.length).forEach(addSong);
  }
  
  // Priority 4: Nearby years if still not enough
  if (wrongs.length < minCount) {
    const years = getAllYears();
    const nearby = years.filter(y => Math.abs(y - correctSong.year) <= 3 && y !== correctSong.year);
    for (const year of nearby) {
      if (wrongs.length >= minCount) break;
      const songs = getSongsByYear(year);
      shuffle(songs).slice(0, minCount - wrongs.length).forEach(addSong);
    }
  }
  
  return wrongs;
}

/**
 * Get wrong album answers for a "which album" question
 * Strategy: prefer same artist, then same year
 * 
 * @param {object} correctSong - Song with the correct album
 * @param {number} minCount - Minimum wrong answers
 * @returns {object[]}
 */
export function getWrongAlbumAnswers(correctSong, minCount = 10) {
  const wrongs = [];
  const seen = new Set();
  
  if (correctSong.album) {
    seen.add(correctSong.album.toLowerCase());
  }
  
  const addAlbum = (albumName) => {
    const key = albumName.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    wrongs.push(resolveOrCreateEntity('album', albumName));
  };
  
  // Priority 1: Same artist's other albums
  const sameArtistAlbums = getOtherAlbumsByArtist(correctSong);
  shuffle(sameArtistAlbums).forEach(addAlbum);
  
  // Priority 2: All other albums if needed
  if (wrongs.length < minCount) {
    const allAlbums = getAllAlbums();
    shuffle(allAlbums).slice(0, minCount - wrongs.length).forEach(addAlbum);
  }
  
  return wrongs;
}

/**
 * Get wrong year answers for a "which year" question
 * Strategy: nearby years, avoiding the correct one
 * 
 * @param {number} correctYear 
 * @param {number} minCount 
 * @returns {object[]}
 */
export function getWrongYearAnswers(correctYear, minCount = 10) {
  const wrongs = [];
  const seen = new Set();
  seen.add(correctYear);
  
  // Generate nearby years
  const range = 10;
  for (let offset = 1; offset <= range && wrongs.length < minCount; offset++) {
    const before = correctYear - offset;
    const after = correctYear + offset;
    
    if (before >= 2000 && !seen.has(before)) {
      seen.add(before);
      wrongs.push({
        entityRef: `year:${before}`,
        display: String(before),
        aliases: [String(before)]
      });
    }
    
    if (after <= new Date().getFullYear() && !seen.has(after)) {
      seen.add(after);
      wrongs.push({
        entityRef: `year:${after}`,
        display: String(after),
        aliases: [String(after)]
      });
    }
  }
  
  return shuffle(wrongs).slice(0, minCount);
}

/**
 * Get wrong word answers for a "missing word" question
 * Strategy: words from the same song/section, or common words
 * 
 * @param {string} correctWord 
 * @param {object} song 
 * @param {number} lineNumber 
 * @param {number} minCount 
 * @returns {object[]}
 */
export function getWrongWordAnswers(correctWord, song, lineNumber, minCount = 10) {
  const wrongs = [];
  const seen = new Set();
  seen.add(correctWord.toLowerCase());
  
  const addWord = (word) => {
    const key = word.toLowerCase();
    if (seen.has(key) || key.length < 2) return;
    seen.add(key);
    wrongs.push({
      entityRef: null,  // Words don't have entity refs
      display: word.toLowerCase(),
      aliases: [word.toLowerCase()]
    });
  };
  
  // Get words from nearby lines in the same song
  const nearbyRange = 5;
  for (const line of song.lyrics) {
    if (Math.abs(line.lineNumber - lineNumber) <= nearbyRange) {
      const words = extractWords(line.content);
      words.forEach(addWord);
    }
  }
  
  // If still not enough, get words from the whole song
  if (wrongs.length < minCount) {
    for (const line of song.lyrics) {
      const words = extractWords(line.content);
      words.forEach(addWord);
      if (wrongs.length >= minCount * 2) break;  // Get extra for variety
    }
  }
  
  return shuffle(wrongs).slice(0, minCount);
}

/**
 * Extract words from a line of text
 */
function extractWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2);
}

/**
 * Fisher-Yates shuffle
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export { shuffle };
