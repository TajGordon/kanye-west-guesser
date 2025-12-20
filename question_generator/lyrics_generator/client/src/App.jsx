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
