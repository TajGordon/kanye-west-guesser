import React, { useState, useCallback } from 'react';
import LyricsEditor from './components/LyricsEditor';
import SongLoader from './components/SongLoader';
import './App.css';

export default function App() {
  const [song, setSong] = useState(null);
  const [songName, setSongName] = useState('');

  // Generate smart filename from song metadata
  const generateFilename = useCallback((songData) => {
    if (!songData) return '';
    const base = (songData.title || 'song')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    
    if (songData.release?.status === 'leaked') {
      // For leaked songs, add version suffix
      return `${base}_leaked`;
    }
    return base;
  }, []);

  const handleLoadSong = useCallback(async (name, preloadedData) => {
    try {
      // If data is already loaded by SongLoader, use it; otherwise fetch
      const data = preloadedData || (() => {
        throw new Error('No data provided');
      })();
      
      setSong(data);
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
      artist: 'Kanye West',
      release: {
        formats: ['single'],
        status: 'official',
        project: '',
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
