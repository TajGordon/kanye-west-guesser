import React from 'react';
import { theme } from '../theme';

function PlayerCard({ player, isTypingMode }) {
  const isCorrect = player.roundStatus === 'correct';
  const hasGuessed = player.roundStatus === 'guessed' || isCorrect;
  
  const cardStyle = {
    padding: theme.spacing.md,
    borderBottom: theme.borders.thin,
    backgroundColor: isCorrect ? theme.colors.success : theme.colors.surface,
    color: isCorrect ? '#fff' : theme.colors.text,
    transition: 'background-color 0.3s ease',
  };

  const nameStyle = {
    fontWeight: theme.typography.fontWeight.bold,
    fontSize: theme.typography.fontSize.base,
    display: 'flex',
    justifyContent: 'space-between',
  };

  const statsStyle = {
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs,
    opacity: 0.9,
  };

  const incorrectGuessesStyle = {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.fontSize.sm,
    color: isCorrect ? '#eee' : theme.colors.error,
    fontStyle: 'italic',
  };

  return (
    <div style={cardStyle}>
      <div style={nameStyle}>
        <span>{player.name}</span>
        <span>{player.score} pts</span>
      </div>
      
      {hasGuessed && (
        <div style={statsStyle}>
          {isCorrect ? 'Correct!' : 'Guessed'} 
          {player.timeTaken && ` (${player.timeTaken.toFixed(2)}s)`}
        </div>
      )}

      {isTypingMode && player.incorrectGuesses && player.incorrectGuesses.length > 0 && (
        <div style={incorrectGuessesStyle}>
          {player.incorrectGuesses.join(', ')}
        </div>
      )}
    </div>
  );
}

export default function PlayerList({ players, isTypingMode }) {
  const style = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle = {
    padding: theme.spacing.md,
    borderBottom: theme.borders.thick,
    fontWeight: theme.typography.fontWeight.bold,
    backgroundColor: theme.colors.secondary,
  };

  return (
    <div style={style}>
      <div style={headerStyle}>
        Players ({players.length})
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {players
          .sort((a, b) => b.score - a.score)
          .map(player => (
            <PlayerCard 
              key={player.id} 
              player={player} 
              isTypingMode={isTypingMode} 
            />
        ))}
      </div>
    </div>
  );
}
