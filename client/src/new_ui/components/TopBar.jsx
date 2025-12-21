import React from 'react';

export default function TopBar({ lobbyCode, onToggleSettings, isSettingsOpen, phase }) {
  return (
    <div className="h-[60px] border-b-2 border-black flex items-center justify-between px-4 bg-surface">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleSettings}
          className={`
            px-4 py-2 border border-black cursor-pointer font-bold
            ${isSettingsOpen ? 'bg-secondary' : 'bg-transparent'}
          `}
        >
          {isSettingsOpen ? 'Close Settings' : 'Settings'}
        </button>
        <span className="font-bold">
          Lobby: {lobbyCode}
        </span>
      </div>
      
      <div>
        <span>Status: {phase}</span>
      </div>
    </div>
  );
}
