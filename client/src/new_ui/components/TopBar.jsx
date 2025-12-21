import React from 'react';
import { theme } from '../theme';

export default function TopBar({ lobbyCode, onToggleSettings, isSettingsOpen, phase }) {
  const style = {
    height: '60px',
    borderBottom: theme.borders.thick,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${theme.spacing.md}`,
    backgroundColor: theme.colors.surface,
  };

  const buttonStyle = {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: isSettingsOpen ? theme.colors.secondary : 'transparent',
    color: theme.colors.text,
    border: theme.borders.thin,
    cursor: 'pointer',
    fontWeight: theme.typography.fontWeight.bold,
  };

  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
        <button style={buttonStyle} onClick={onToggleSettings}>
          {isSettingsOpen ? 'Close Settings' : 'Settings'}
        </button>
        <span style={{ fontWeight: theme.typography.fontWeight.bold }}>
          Lobby: {lobbyCode}
        </span>
      </div>
      
      <div>
        <span>Status: {phase}</span>
      </div>
    </div>
  );
}
