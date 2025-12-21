import React from 'react';
import TagExpressionInput from './TagExpressionInput';

const DEFAULT_SETTINGS = {
  roundDurationMs: 20000,
  pointsToWin: 50,
  questionFilter: '*'
};

export default function SettingsPanel({ settings = {}, onUpdateSettings, isHost }) {
  // Merge with defaults
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
  
  const handleChange = (key, value) => {
    if (!isHost) return;
    onUpdateSettings({ ...mergedSettings, [key]: value });
  };

  return (
    <div className="p-4 h-full overflow-y-auto bg-surface">
      <h2 className="mb-6 text-xl font-bold">Lobby Settings</h2>
      
      <div className="mb-6">
        <label className="block mb-2 font-bold">Round Duration (seconds)</label>
        <input
          type="number"
          value={(mergedSettings.roundDurationMs || 20000) / 1000}
          onChange={(e) => handleChange('roundDurationMs', parseInt(e.target.value) * 1000)}
          disabled={!isHost}
          className="w-full p-2 border border-black mb-2"
        />
      </div>

      <div className="mb-6">
        <label className="block mb-2 font-bold">Points to Win</label>
        <input
          type="number"
          value={mergedSettings.pointsToWin || 50}
          onChange={(e) => handleChange('pointsToWin', parseInt(e.target.value))}
          disabled={!isHost}
          className="w-full p-2 border border-black mb-2"
        />
      </div>

      <div className="mb-6">
        <TagExpressionInput
          value={mergedSettings.questionFilter || '*'}
          onChange={(value) => handleChange('questionFilter', value)}
          disabled={!isHost}
        />
      </div>

      {!isHost && (
        <div className="text-gray-500 italic">
          Only the host can change settings.
        </div>
      )}
    </div>
  );
}
