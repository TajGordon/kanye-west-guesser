import React from 'react';
import { theme } from '../theme';

export default function WinScreen({ winner, onReturnToLobby, isHost }) {
  const containerStyle = {
    textAlign: 'center',
    padding: theme.spacing.xl,
  };

  const winnerStyle = {
    fontSize: '3rem',
    fontWeight: 'bold',
    color: theme.colors.success,
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
      <h1>Game Over!</h1>
      <div style={winnerStyle}>
        {winner ? `${winner.name} Wins!` : 'No Winner?'}
      </div>
      <p>Score: {winner?.score}</p>
      
      {isHost && (
        <button style={buttonStyle} onClick={onReturnToLobby}>
          Return to Lobby
        </button>
      )}
    </div>
  );
}
