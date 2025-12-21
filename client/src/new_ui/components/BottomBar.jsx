import React, { useState, useEffect } from 'react';
import { theme } from '../theme';
import TimerBar from './TimerBar';

export default function BottomBar({ 
  inputValue, 
  onInputChange, 
  onSubmit, 
  isEnabled, 
  placeholder,
  timerProgress 
}) {
  const containerStyle = {
    width: '100%',
    borderTop: theme.borders.thick,
    backgroundColor: theme.colors.surface,
    display: 'flex',
    flexDirection: 'column',
  };

  const inputContainerStyle = {
    padding: theme.spacing.md,
    display: 'flex',
    justifyContent: 'center',
  };

  const inputStyle = {
    width: '100%',
    maxWidth: '600px',
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.lg,
    border: theme.borders.thin,
    textAlign: 'center',
    outline: 'none',
    backgroundColor: isEnabled ? '#fff' : theme.colors.secondary,
    cursor: isEnabled ? 'text' : 'not-allowed',
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isEnabled) {
      onSubmit();
    }
  };

  return (
    <div style={containerStyle}>
      {timerProgress !== null && <TimerBar progress={timerProgress} />}
      <div style={inputContainerStyle}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Type your answer..."}
          disabled={!isEnabled}
          style={inputStyle}
          autoFocus={isEnabled}
        />
      </div>
    </div>
  );
}
