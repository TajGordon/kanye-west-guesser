import React from 'react';
import { theme } from '../theme';

export default function PregameScreen({ isHost, onStartGame, playerCount }) {
  const containerStyle = {
    textAlign: 'center',
    padding: theme.spacing.xl,
  };

  const titleStyle = {
    fontSize: theme.typography.fontSize.xxl,
    marginBottom: theme.spacing.lg,
  };

  const buttonStyle = {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    fontSize: theme.typography.fontSize.lg,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    marginTop: theme.spacing.xl,
  };

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Waiting for game to start...</h1>
      <p>Players joined: {playerCount}</p>
      
      {isHost ? (
        <button style={buttonStyle} onClick={onStartGame}>
          Start Game
        </button>
      ) : (
        <p style={{ marginTop: theme.spacing.lg, fontStyle: 'italic' }}>
          Waiting for host to start...
        </p>
      )}
    </div>
  );
}
