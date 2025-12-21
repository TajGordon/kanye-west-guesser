import React from 'react';

export default function TimerBar({ progress }) {
  return (
    <div className="w-full h-2 bg-secondary relative">
      <div 
        className="h-full bg-timerBar transition-[width] duration-100 ease-linear"
        style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
      />
    </div>
  );
}
