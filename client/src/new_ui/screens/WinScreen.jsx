import React from 'react';

export default function WinScreen({ winner, onReturnToLobby, isHost }) {
  return (
    <div className="text-center p-8">
      <h1 className="text-4xl mb-6">Game Over!</h1>
      <div className="text-5xl font-bold text-success mb-6">
        {winner ? `${winner.name} Wins!` : 'No Winner?'}
      </div>
      <p className="text-xl">Score: {winner?.score}</p>
      
      {isHost && (
        <button 
          className="px-8 py-4 text-lg bg-primary text-white border-none cursor-pointer mt-8 font-bold hover:opacity-90"
          onClick={onReturnToLobby}
        >
          Return to Lobby
        </button>
      )}
    </div>
  );
}
