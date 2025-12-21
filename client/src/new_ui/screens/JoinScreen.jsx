import React, { useState } from 'react';

export default function JoinScreen({ onJoin, initialName, initialLobby }) {
  const [name, setName] = useState(initialName || '');
  const [lobbyCode, setLobbyCode] = useState(initialLobby || '');

  const generateLobbyCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateLobby = () => {
    if (!name) {
      alert('Please enter your name first');
      return;
    }
    const newCode = generateLobbyCode();
    onJoin(name, newCode);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && lobbyCode) {
      onJoin(name, lobbyCode);
    }
  };

  const handleLobbyCodeChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    setLobbyCode(val);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-background text-black">
      <h1 className="text-4xl mb-8 font-bold">Kanye West Guesser</h1>
      <div className="flex flex-col gap-4 w-[300px] p-8 border-2 border-black bg-surface">
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="p-3 border border-black text-base w-full"
          required
        />
        
        <div className="flex flex-col gap-2 border-t border-black pt-4 mt-2">
          <span className="text-sm font-bold text-center">Join Existing</span>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Lobby Code (4 Letters)"
              value={lobbyCode}
              onChange={handleLobbyCodeChange}
              className="p-3 border border-black text-base w-full text-center tracking-[2px]"
              required
              maxLength={4}
            />
            <button 
              type="submit" 
              className="p-3 bg-primary text-white border-none cursor-pointer font-bold hover:opacity-90"
            >
              Join Game
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-2 border-t border-black pt-4">
           <span className="text-sm font-bold text-center">Or Create New</span>
           <button 
             type="button" 
             onClick={handleCreateLobby} 
             className="p-3 bg-secondary text-black border border-black cursor-pointer font-bold hover:bg-gray-200"
           >
            Create Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
