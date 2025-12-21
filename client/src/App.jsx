import React, { useState, useMemo } from 'react';
import { GameProvider } from './new_ui/context/GameContext';
import GameInterface from './new_ui/GameInterface';
import JoinScreen from './new_ui/screens/JoinScreen';

function usePersistentPlayerId() {
  return useMemo(() => {
    let stored = localStorage.getItem('playerId');
    if (!stored) {
      stored = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      localStorage.setItem('playerId', stored);
    }
    return stored;
  }, []);
}

export default function App() {
  const playerId = usePersistentPlayerId();
  
  // Check URL for lobby ID
  const routeMatch = window.location.pathname.match(/^\/room\/([A-Za-z0-9-]+)/i);
  const initialLobbyId = routeMatch ? routeMatch[1].toUpperCase() : '';
  
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
  const [lobbyId, setLobbyId] = useState(initialLobbyId);
  const [hasJoined, setHasJoined] = useState(false);

  const handleJoin = (name, code) => {
    localStorage.setItem('playerName', name);
    setPlayerName(name);
    setLobbyId(code);
    setHasJoined(true);
    
    // Update URL without reload if needed
    if (code !== initialLobbyId) {
      window.history.pushState({}, '', `/room/${code}`);
    }
  };

  if (!hasJoined) {
    return (
      <JoinScreen 
        onJoin={handleJoin} 
        initialName={playerName} 
        initialLobby={lobbyId} 
      />
    );
  }

  return (
    <GameProvider 
      playerId={playerId} 
      lobbyId={lobbyId} 
      playerName={playerName}
    >
      <GameInterface />
    </GameProvider>
  );
}
