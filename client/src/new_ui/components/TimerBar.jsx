import React from 'react';
import { theme } from '../theme';

export default function TimerBar({ progress, totalDuration }) {
  // progress is 0 to 1, or we can calculate it from time remaining
  
  const style = {
    width: '100%',
    height: '8px',
    backgroundColor: theme.colors.secondary,
    position: 'relative',
  };

  const fillStyle = {
    width: `${Math.max(0, Math.min(100, progress * 100))}%`,
    height: '100%',
    backgroundColor: theme.colors.timerBar,
    transition: 'width 0.1s linear',
  };

  return (
    <div style={style}>
      <div style={fillStyle} />
    </div>
  );
}
