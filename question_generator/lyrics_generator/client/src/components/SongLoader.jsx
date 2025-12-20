import React, { useState, useEffect } from 'react';

export default function SongLoader({ onLoad }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/songs')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setSongs(data.songs || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading songs list:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleLoad = async (songName) => {
    if (!songName) return;
    
    try {
      console.log(`Loading song: ${songName}`);
      const res = await fetch(`/api/songs/${songName}`);
      
      if (!res.ok) {
        throw new Error(`Failed to load: HTTP ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Song loaded:', data);
      onLoad(songName, data);
    } catch (err) {
      console.error(`Error loading song ${songName}:`, err);
      alert(`Error loading song: ${err.message}`);
    }
  };

  return (
    <div className="song-loader">
      {error && <small style={{ color: '#ff6b6b' }}>Error: {error}</small>}
      <select 
        onChange={(e) => handleLoad(e.target.value)} 
        defaultValue=""
        disabled={loading}
      >
        <option value="">{loading ? 'Loading...' : 'Load a song...'}</option>
        {songs.map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
    </div>
  );
}
