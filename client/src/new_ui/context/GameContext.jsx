import React, { createContext, useContext } from 'react';
import { useGameSocket } from '../../hooks/useGameSocket';

const GameContext = createContext(null);

export function GameProvider({ children, playerId, lobbyId, playerName }) {
  const gameState = useGameSocket({ playerId, lobbyId, playerName });

  return (
    <GameContext.Provider value={gameState}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
