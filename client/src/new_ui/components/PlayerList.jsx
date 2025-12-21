import React from 'react';
import { QUESTION_TYPES } from '../../questionTypes';

function PlayerCard({ player, isTypingMode, isRevealPhase, correctPlayerIds }) {
  // Server sends: roundGuessStatus ('idle' | 'incorrect' | 'submitted' | 'correct')
  // lastGuessText: string | null
  // correctElapsedMs: number | null
  const status = player.roundGuessStatus || 'idle';
  const playerName = player.name || player.displayName || 'Unknown';
  const playerScore = player.score ?? 0;
  const lastGuess = player.lastGuessText;
  const correctTimeMs = player.correctElapsedMs;
  
  // For choice-based questions, status may be 'submitted' even if correct
  // We need to check correctPlayerIds during reveal phase
  const wasActuallyCorrect = correctPlayerIds?.has(player.playerId);
  
  // Determine actual state
  const isCorrect = status === 'correct' || (isRevealPhase && wasActuallyCorrect);
  const isIncorrect = status === 'incorrect';
  const hasSubmitted = status === 'submitted';
  
  // For typing mode: show result immediately
  // For choice mode: only show result during reveal phase
  const shouldShowCorrect = isCorrect && (isTypingMode || isRevealPhase);
  const shouldShowIncorrect = isRevealPhase && hasSubmitted && !wasActuallyCorrect;
  
  // Background color based on status and phase
  let bgClass = 'bg-surface';
  let textClass = 'text-black';
  
  if (shouldShowCorrect) {
    bgClass = 'bg-success';
    textClass = 'text-white';
  } else if (shouldShowIncorrect) {
    bgClass = 'bg-red-100';
    textClass = 'text-black';
  }
  
  return (
    <div className={`p-4 border-b border-black transition-colors duration-300 ${bgClass} ${textClass}`}>
      <div className="flex justify-between font-bold text-base">
        <span>{playerName}</span>
        <span>{playerScore} pts</span>
      </div>
      
      {/* For typing mode: show checkmark with time */}
      {isTypingMode && isCorrect && (
        <div className="text-sm mt-1 text-green-100">
          ✓ {correctTimeMs ? `${(correctTimeMs / 1000).toFixed(2)}s` : ''}
        </div>
      )}
      
      {/* For choice mode during round: show "Submitted" */}
      {!isTypingMode && hasSubmitted && !isRevealPhase && (
        <div className="text-sm mt-1 text-gray-600">
          Submitted
        </div>
      )}
      
      {/* For choice mode during reveal: show checkmark with time */}
      {!isTypingMode && isRevealPhase && shouldShowCorrect && (
        <div className="text-sm mt-1 text-green-100">
          ✓ {correctTimeMs ? `${(correctTimeMs / 1000).toFixed(2)}s` : ''}
        </div>
      )}
      
      {/* For choice mode during reveal: show X */}
      {!isTypingMode && isRevealPhase && shouldShowIncorrect && (
        <div className="text-sm mt-1 text-error font-medium">
          ✗
        </div>
      )}
      
      {/* Show incorrect guess in red for typing mode (always visible) */}
      {isTypingMode && isIncorrect && lastGuess && (
        <div className="mt-1 text-sm font-medium text-error">
          ✗ "{lastGuess}"
        </div>
      )}
    </div>
  );
}

export default function PlayerList({ players = [], isTypingMode, phase, correctResponders = [] }) {
  // Build a set of correct player IDs for quick lookup
  const correctPlayerIds = new Set(correctResponders.map(r => r.playerId));
  
  // Sort by score descending, then by correct time for same score
  const sortedPlayers = [...players].sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    // If same score, sort by correctElapsedMs (faster first)
    const aTime = a.correctElapsedMs ?? Infinity;
    const bTime = b.correctElapsedMs ?? Infinity;
    return aTime - bTime;
  });
  
  const isRevealPhase = phase === 'summary';
  
  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="p-4 border-b-2 border-black font-bold bg-secondary text-black">
        Players ({players.length})
      </div>
      <div className="flex-1 overflow-y-auto">
        {sortedPlayers.length > 0 ? (
          sortedPlayers.map(player => (
            <PlayerCard 
              key={player.playerId || player.id} 
              player={player} 
              isTypingMode={isTypingMode}
              isRevealPhase={isRevealPhase}
              correctPlayerIds={correctPlayerIds}
            />
          ))
        ) : (
          <div className="p-4 text-gray-500 italic">No players yet</div>
        )}
      </div>
    </div>
  );
}
