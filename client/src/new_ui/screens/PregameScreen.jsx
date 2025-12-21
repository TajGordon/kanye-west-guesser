import React from 'react';

export default function PregameScreen({ isHost, onStartGame, playerCount }) {
  return (
    <div className="text-center p-8">
      <h1 className="text-4xl mb-6">Waiting for game to start...</h1>
      <p>Players joined: {playerCount}</p>
      
      {isHost ? (
        <button 
          className="px-8 py-4 text-lg bg-primary text-white border-none cursor-pointer mt-8 font-bold hover:opacity-90"
          onClick={onStartGame}
        >
          Start Game
        </button>
      ) : (
        <p className="mt-6 italic">
          Waiting for host to start...
        </p>
      )}
    </div>
  );
}
