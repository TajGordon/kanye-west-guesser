import React from 'react';

function PlayerCard({ player, isTypingMode }) {
  // Handle different property names from server
  const roundStatus = player.roundStatus || player.roundGuessStatus || 'idle';
  const isCorrect = roundStatus === 'correct';
  const hasGuessed = roundStatus === 'guessed' || roundStatus === 'submitted' || roundStatus === 'incorrect' || isCorrect;
  const playerName = player.name || player.displayName || 'Unknown';
  const playerScore = player.score || 0;
  const timeTaken = player.timeTaken || player.correctElapsedMs ? (player.correctElapsedMs / 1000) : null;
  const incorrectGuesses = player.incorrectGuesses || [];
  
  return (
    <div 
      className={`
        p-4 border-b border-black transition-colors duration-300
        ${isCorrect ? 'bg-success text-white' : 'bg-surface text-black'}
      `}
    >
      <div className="flex justify-between font-bold text-base">
        <span>{playerName}</span>
        <span>{playerScore} pts</span>
      </div>
      
      {hasGuessed && (
        <div className="text-sm mt-1 opacity-90">
          {isCorrect ? 'Correct!' : 'Guessed'} 
          {timeTaken && ` (${timeTaken.toFixed(2)}s)`}
        </div>
      )}

      {isTypingMode && incorrectGuesses.length > 0 && (
        <div 
          className={`
            mt-2 text-sm italic
            ${isCorrect ? 'text-gray-200' : 'text-error'}
          `}
        >
          {incorrectGuesses.join(', ')}
        </div>
      )}
    </div>
  );
}

export default function PlayerList({ players = [], isTypingMode }) {
  // Sort by score descending
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b-2 border-black font-bold bg-secondary">
        Players ({players.length})
      </div>
      <div className="flex-1 overflow-y-auto">
        {sortedPlayers.length > 0 ? (
          sortedPlayers.map(player => (
            <PlayerCard 
              key={player.id || player.playerId} 
              player={player} 
              isTypingMode={isTypingMode} 
            />
          ))
        ) : (
          <div className="p-4 text-gray-500 italic">No players yet</div>
        )}
      </div>
    </div>
  );
}
