import React, { useState } from 'react';
import { theme } from '../theme';

export default function JoinScreen({ onJoin, initialName, initialLobby }) {
  const [name, setName] = useState(initialName || '');
  const [lobbyCode, setLobbyCode] = useState(initialLobby || '');

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  };

  const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
    width: '300px',
    padding: theme.spacing.xl,
    border: theme.borders.thick,
    backgroundColor: theme.colors.surface,
  };

  const inputStyle = {
    padding: theme.spacing.md,
    border: theme.borders.thin,
    fontSize: theme.typography.fontSize.base,
  };

  const buttonStyle = {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && lobbyCode) {
      onJoin(name, lobbyCode);
    }
  };

  return (
    <div style={containerStyle}>
      <h1 style={{ marginBottom: theme.spacing.xl }}>Kanye West Guesser</h1>
      <form style={formStyle} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          required
        />
        <input
          type="text"
          placeholder="Lobby Code"
          value={lobbyCode}
          onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
          style={inputStyle}
          required
        />
        <button type="submit" style={buttonStyle}>
          Join Game
        </button>
      </form>
    </div>
  );
}
