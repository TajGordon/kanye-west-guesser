import React from 'react';

export default function TimerBar({ progress }) {
  // Progress should be 1.0 at start, 0.0 at end
  const percentage = Math.max(0, Math.min(100, (progress || 0) * 100));
  
  // Color transitions from green -> yellow -> red as time runs out
  let bgColor = 'bg-success'; // green when lots of time
  if (progress < 0.5) {
    bgColor = 'bg-warning'; // yellow halfway
  }
  if (progress < 0.25) {
    bgColor = 'bg-error'; // red when low
  }
  
  return (
    <div className="w-full h-3 bg-secondary relative overflow-hidden">
      <div 
        className={`h-full ${bgColor} transition-all duration-100 ease-linear`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
