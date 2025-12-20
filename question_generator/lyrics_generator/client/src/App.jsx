import React, { useState, useCallback, useEffect } from 'react';
import LyricsEditor from './components/LyricsEditor';
import SongLoader from './components/SongLoader';
import './App.css';

export default function App() {
  const [song, setSong] = useState(null);
  const [songName, setSongName] = useState('');

  // Generate smart filename from song metadata
  const generateFilename = useCallback((songData) => {
    if (!songData) return '';
    
    // Convert title to safe filename: "Paranoid (CDQ)" → "paranoid-cdq"
    const filename = (songData.title || 'song')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')  // Remove special chars except dash, keep alphanumeric and dash
      .replace(/\s+/g, '-')       // Replace spaces with dashes
      .replace(/-+/g, '-')        // Replace multiple dashes with single dash
      .trim();
    
    return filename || 'song';
  }, []);

  // Auto-update filename when song title changes (but only after initial load)
  useEffect(() => {
    if (!song) return;
    
    // Don't auto-update if it's the initial 'new-song' and title hasn't been customized
    if (songName === 'new-song' && song.title === 'New Song') {
      return;
    }
    
    // Generate new filename from current title
    const newFilename = generateFilename(song);
    
    // Only update if it's different and not just the default
    if (newFilename && newFilename !== songName && song.title !== 'New Song') {
      setSongName(newFilename);
      console.log(`[App] Auto-updated filename: ${newFilename} (from title: "${song.title}")`);
    }
  }, [song?.title, generateFilename, songName, song]);

  const handleLoadSong = useCallback(async (name, preloadedData) => {
    try {
      // If data is already loaded by SongLoader, use it; otherwise fetch
      const data = preloadedData || (() => {
        throw new Error('No data provided');
      })();
      
      const CURRENT_SCHEMA_VERSION = 3;

      // Back-compat + versioned migration:
      // schemaVersion 2 means:
      // - artists: publisher/primary artist(s)
      // - features: performers beyond the primary
      const normalized = { ...data };

      const legacyArtistsList = Array.isArray(normalized.artists) ? normalized.artists : [];
      const primary = (typeof normalized.artist === 'string' && normalized.artist.trim())
        ? normalized.artist.trim()
        : (legacyArtistsList[0] ? String(legacyArtistsList[0]).trim() : 'Kanye West');

      const current = Number.isInteger(normalized.schemaVersion) ? normalized.schemaVersion : 0;
      if (current < CURRENT_SCHEMA_VERSION) {
        if (!Array.isArray(normalized.features)) {
          normalized.features = legacyArtistsList
            .map(a => String(a).trim())
            .filter(Boolean)
            .filter(a => a.toLowerCase() !== primary.toLowerCase());
        }
        normalized.artists = [primary];
        normalized.artist = primary;
        normalized.schemaVersion = CURRENT_SCHEMA_VERSION;
      }

      // v3: release.edition
      if (!normalized.release || typeof normalized.release !== 'object') normalized.release = {};
      if (!normalized.release.edition || typeof normalized.release.edition !== 'string') {
        normalized.release.edition = 'standard';
      }
      normalized.release.edition = normalized.release.edition.trim() || 'standard';

      if (!Array.isArray(normalized.artists) || normalized.artists.length === 0) {
        normalized.artists = [primary || 'Kanye West'];
      }
      normalized.artist = normalized.artists[0] || 'Kanye West';
      if (!Array.isArray(normalized.features)) normalized.features = [];
      if (!Number.isInteger(normalized.schemaVersion)) normalized.schemaVersion = CURRENT_SCHEMA_VERSION;

      // Back-compat: normalize per-line voices (multi-voice candidates)
      if (Array.isArray(normalized.lyrics)) {
        normalized.lyrics = normalized.lyrics.map((line) => {
          if (!line || typeof line !== 'object') return line;

          const fromSection = Array.isArray(line?.section?.artists) ? line.section.artists : [];
          const performers = [...(normalized.artists || []), ...(normalized.features || [])];
          const preferred = fromSection.length > 0 ? fromSection : performers;

          let voices = Array.isArray(line.voices) ? line.voices : null;
          if (!voices || voices.length === 0) {
            if (line.voice && typeof line.voice === 'object' && line.voice.id) {
              voices = [line.voice];
            } else {
              voices = (preferred || []).map((name) => ({
                id: String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                display: String(name)
              }));
            }
          }

          const primary = voices[0] || line.voice || { id: 'kanye-west', display: 'Kanye West' };
          return { ...line, voices, voice: primary };
        });
      }

      // Back-compat: normalize song-level producers
      {
        const input = Array.isArray(normalized.producers)
          ? normalized.producers
          : (typeof normalized.producers === 'string' ? [normalized.producers] : []);
        const seen = new Set();
        const producers = input
          .flatMap(p => String(p).split(','))
          .map(p => p.trim())
          .filter(p => p.length > 0)
          .filter(p => {
            const key = p.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        normalized.producers = producers.length > 0 ? producers : ['Kanye West'];
      }

      setSong(normalized);
      setSongName(name);
      console.log(`Loaded song: ${name}`);
    } catch (err) {
      console.error(`Error loading song ${name}:`, err);
      alert(`Error loading song: ${err.message}`);
    }
  }, []);

  const handleSaveSong = useCallback(async () => {
    if (!song) {
      alert('No song loaded');
      return;
    }
    const filename = songName || generateFilename(song);
    if (!filename) {
      alert('Unable to generate filename');
      return;
    }
    try {
      const res = await fetch(`/api/songs/${filename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song)
      });
      if (!res.ok) throw new Error('Save failed');
      setSongName(filename);
      alert(`Saved ${filename}.json`);
    } catch (err) {
      alert(`Error saving: ${err.message}`);
    }
  }, [song, songName, generateFilename]);

  const handleNewSong = useCallback(() => {
    setSong({
      title: 'New Song',
      schemaVersion: 3,
      artists: ['Kanye West'],
      artist: 'Kanye West',
      features: [],
      producers: ['Kanye West'],
      release: {
        formats: ['single'],
        status: 'official',
        project: '',
        edition: 'standard',
        year: new Date().getFullYear()
      },
      lyrics: []
    });
    setSongName('new-song');
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Lyrics Editor</h1>
        <div className="header-actions">
          <button onClick={handleNewSong}>New Song</button>
          <SongLoader onLoad={handleLoadSong} />
          {song && (
            <>
              <span className="filename-display" title="Current filename">
                {songName || '(unsaved)'}
              </span>
              <button onClick={handleSaveSong} className="save-btn">Save</button>
            </>
          )}
        </div>
      </header>
      {song ? (
        <LyricsEditor song={song} setSong={setSong} />
      ) : (
        <div className="empty-state">
          <p>Create a new song or load an existing one to begin editing.</p>
        </div>
      )}
    </div>
  );
}
