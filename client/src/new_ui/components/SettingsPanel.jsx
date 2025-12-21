import React from 'react';
import { theme } from '../theme';

export default function SettingsPanel({ settings, onUpdateSettings, isHost }) {
  const style = {
    padding: theme.spacing.md,
    height: '100%',
    overflowY: 'auto',
    backgroundColor: theme.colors.surface,
  };

  const sectionStyle = {
    marginBottom: theme.spacing.lg,
  };

  const labelStyle = {
    display: 'block',
    marginBottom: theme.spacing.sm,
    fontWeight: theme.typography.fontWeight.bold,
  };

  const inputStyle = {
    width: '100%',
    padding: theme.spacing.sm,
    border: theme.borders.thin,
    marginBottom: theme.spacing.sm,
  };

  const handleChange = (key, value) => {
    if (!isHost) return;
    onUpdateSettings({ ...settings, [key]: value });
  };

  return (
    <div style={style}>
      <h2 style={{ marginBottom: theme.spacing.lg }}>Lobby Settings</h2>
      
      <div style={sectionStyle}>
        <label style={labelStyle}>Round Duration (seconds)</label>
        <input
          type="number"
          value={settings.roundDurationMs / 1000}
          onChange={(e) => handleChange('roundDurationMs', parseInt(e.target.value) * 1000)}
          disabled={!isHost}
          style={inputStyle}
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Points to Win</label>
        <input
          type="number"
          value={settings.pointsToWin}
          onChange={(e) => handleChange('pointsToWin', parseInt(e.target.value))}
          disabled={!isHost}
          style={inputStyle}
        />
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Question Pack</label>
        <select
          value={settings.questionPackId}
          onChange={(e) => handleChange('questionPackId', e.target.value)}
          disabled={!isHost}
          style={inputStyle}
        >
          <option value="kanye-classic">Kanye Classic</option>
          <option value="kanye-advanced">Kanye Advanced</option>
          {/* Add more packs dynamically if available */}
        </select>
      </div>

      {!isHost && (
        <div style={{ color: theme.colors.secondary, fontStyle: 'italic' }}>
          Only the host can change settings.
        </div>
      )}
    </div>
  );
}
