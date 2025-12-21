/**
 * Lyrics Loader
 * 
 * Loads and indexes all lyrics JSON files from the lyrics directory.
 * Provides utilities for accessing song data and building cross-references.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let songsData = [];
let songsByTitle = new Map();
let songsByAlbum = new Map();
let songsByArtist = new Map();
let songsByYear = new Map();
let allAlbums = new Set();
let allArtists = new Set();
let allYears = new Set();
let projectsData = null;

/**
 * Load all lyrics files from the lyrics directory
 * @param {string} lyricsDir - Path to lyrics directory
 * @param {string} projectsPath - Path to projects.json
 */
export function loadLyrics(lyricsDir = null, projectsPath = null) {
  const resolvedLyricsDir = lyricsDir || path.join(__dirname, '../../lyrics');
  const resolvedProjectsPath = projectsPath || path.join(__dirname, '../../projects.json');
  
  // Load projects first
  try {
    const raw = fs.readFileSync(resolvedProjectsPath, 'utf-8');
    projectsData = JSON.parse(raw);
    console.log(`[LyricsLoader] Loaded ${Object.keys(projectsData).length} projects`);
  } catch (err) {
    console.warn(`[LyricsLoader] Could not load projects.json: ${err.message}`);
    projectsData = {};
  }
  
  // Reset indexes
  songsData = [];
  songsByTitle.clear();
  songsByAlbum.clear();
  songsByArtist.clear();
  songsByYear.clear();
  allAlbums.clear();
  allArtists.clear();
  allYears.clear();
  
  // Load all JSON files
  const files = fs.readdirSync(resolvedLyricsDir)
    .filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const filePath = path.join(resolvedLyricsDir, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const song = JSON.parse(raw);
      
      // Ensure required fields
      if (!song.title || !song.lyrics || !Array.isArray(song.lyrics)) {
        console.warn(`[LyricsLoader] Skipping ${file}: missing title or lyrics`);
        continue;
      }
      
      // Normalize and enrich song data
      const normalized = normalizeSong(song, file);
      songsData.push(normalized);
      
      // Index by title
      const titleKey = normalized.title.toLowerCase();
      songsByTitle.set(titleKey, normalized);
      
      // Index by album
      if (normalized.album) {
        const albumKey = normalized.album.toLowerCase();
        if (!songsByAlbum.has(albumKey)) {
          songsByAlbum.set(albumKey, []);
        }
        songsByAlbum.get(albumKey).push(normalized);
        allAlbums.add(normalized.album);
      }
      
      // Index by artist(s)
      for (const artist of normalized.artists) {
        const artistKey = artist.toLowerCase();
        if (!songsByArtist.has(artistKey)) {
          songsByArtist.set(artistKey, []);
        }
        songsByArtist.get(artistKey).push(normalized);
        allArtists.add(artist);
      }
      
      // Index by year
      if (normalized.year) {
        if (!songsByYear.has(normalized.year)) {
          songsByYear.set(normalized.year, []);
        }
        songsByYear.get(normalized.year).push(normalized);
        allYears.add(normalized.year);
      }
      
    } catch (err) {
      console.warn(`[LyricsLoader] Error loading ${file}: ${err.message}`);
    }
  }
  
  console.log(`[LyricsLoader] Loaded ${songsData.length} songs`);
  console.log(`[LyricsLoader] Albums: ${allAlbums.size}, Artists: ${allArtists.size}, Years: ${allYears.size}`);
  
  return songsData;
}

/**
 * Normalize a song object
 */
function normalizeSong(song, filename) {
  const album = song.release?.project || null;
  const year = song.release?.year || null;
  
  // Get artists - combine main artist, artists array, and features
  const artists = new Set();
  if (song.artist) artists.add(song.artist);
  if (song.artists) song.artists.forEach(a => artists.add(a));
  
  // Get features separately
  const features = song.features || [];
  
  // Get album info from projects.json if available
  let albumInfo = null;
  if (album && projectsData && projectsData[album]) {
    albumInfo = projectsData[album];
  }
  
  return {
    // Core metadata
    title: song.title,
    filename,
    slug: filename.replace('.json', ''),
    
    // Artists and features
    artist: song.artist || Array.from(artists)[0] || 'Unknown',
    artists: Array.from(artists),
    features,
    allVoices: [...artists, ...features],
    
    // Release info
    album,
    year,
    albumInfo,
    
    // Lyrics with line data
    lyrics: song.lyrics.map(line => ({
      lineNumber: line.line_number,
      content: line.content,
      section: line.section?.type || 'unknown',
      sectionNumber: line.section?.number || 1,
      sectionLabel: line.section?.label || '',
      voice: line.voice?.display || song.artist || 'Unknown',
      voiceId: line.voice?.id || null
    })),
    
    // Raw data for access
    raw: song
  };
}

/**
 * Get all loaded songs
 */
export function getAllSongs() {
  return songsData;
}

/**
 * Get a song by title
 */
export function getSongByTitle(title) {
  return songsByTitle.get(title.toLowerCase()) || null;
}

/**
 * Get all songs from an album
 */
export function getSongsByAlbum(album) {
  return songsByAlbum.get(album.toLowerCase()) || [];
}

/**
 * Get all songs by an artist
 */
export function getSongsByArtist(artist) {
  return songsByArtist.get(artist.toLowerCase()) || [];
}

/**
 * Get all songs from a year
 */
export function getSongsByYear(year) {
  return songsByYear.get(year) || [];
}

/**
 * Get all albums
 */
export function getAllAlbums() {
  return Array.from(allAlbums);
}

/**
 * Get all artists
 */
export function getAllArtists() {
  return Array.from(allArtists);
}

/**
 * Get all years
 */
export function getAllYears() {
  return Array.from(allYears).sort((a, b) => a - b);
}

/**
 * Get other songs on the same album (excluding the given song)
 */
export function getOtherSongsOnAlbum(song) {
  if (!song.album) return [];
  return getSongsByAlbum(song.album).filter(s => s.title !== song.title);
}

/**
 * Get other songs by the same artist (excluding the given song)
 */
export function getOtherSongsByArtist(song) {
  const results = [];
  const seen = new Set();
  seen.add(song.title.toLowerCase());
  
  for (const artist of song.artists) {
    for (const s of getSongsByArtist(artist)) {
      const key = s.title.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        results.push(s);
      }
    }
  }
  
  return results;
}

/**
 * Get other albums by the same artist
 */
export function getOtherAlbumsByArtist(song) {
  const albums = new Set();
  
  for (const artist of song.artists) {
    for (const s of getSongsByArtist(artist)) {
      if (s.album && s.album !== song.album) {
        albums.add(s.album);
      }
    }
  }
  
  return Array.from(albums);
}

/**
 * Get projects data
 */
export function getProjects() {
  return projectsData || {};
}
