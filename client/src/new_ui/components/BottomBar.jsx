import React from 'react';
import TimerBar from './TimerBar';

export default function BottomBar({ 
  inputValue, 
  onInputChange, 
  onSubmit, 
  isEnabled, 
  placeholder,
  timerProgress 
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isEnabled) {
      onSubmit();
    }
  };

  return (
    <div className="w-full border-t-2 border-black bg-surface flex flex-col">
      {timerProgress !== null && <TimerBar progress={timerProgress} />}
      <div className="p-4 flex justify-center">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Type your answer..."}
          disabled={!isEnabled}
          className={`
            w-full max-w-[600px] p-4 text-lg border border-black text-center outline-none
            ${isEnabled ? 'bg-white cursor-text' : 'bg-secondary cursor-not-allowed'}
          `}
          autoFocus={isEnabled}
        />
      </div>
    </div>
  );
}
