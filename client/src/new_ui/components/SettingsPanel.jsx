import React, { useState, useEffect } from 'react';
import TagExpressionInput from './TagExpressionInput';

const DEFAULT_SETTINGS = {
  roundDurationMs: 20000,
  pointsToWin: 50,
  questionFilter: '*'
};

export default function SettingsPanel({ settings = {}, onUpdateSettings, isHost }) {
  // Merge with defaults
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
  
  // Local state for text inputs to allow free editing
  const [roundDurationInput, setRoundDurationInput] = useState(
    String((mergedSettings.roundDurationMs || 20000) / 1000)
  );
  const [pointsToWinInput, setPointsToWinInput] = useState(
    String(mergedSettings.pointsToWin ?? 50)
  );
  
  // Sync local state when settings change from server
  useEffect(() => {
    setRoundDurationInput(String((mergedSettings.roundDurationMs || 20000) / 1000));
  }, [mergedSettings.roundDurationMs]);
  
  useEffect(() => {
    setPointsToWinInput(String(mergedSettings.pointsToWin ?? 50));
  }, [mergedSettings.pointsToWin]);
  
  const handleChange = (key, value) => {
    if (!isHost) return;
    onUpdateSettings({ ...mergedSettings, [key]: value });
  };
  
  // Handle blur - apply value if valid, reset if not
  const handleRoundDurationBlur = () => {
    const parsed = parseInt(roundDurationInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      handleChange('roundDurationMs', parsed * 1000);
    } else {
      // Reset to current value
      setRoundDurationInput(String((mergedSettings.roundDurationMs || 20000) / 1000));
    }
  };
  
  const handlePointsToWinBlur = () => {
    const parsed = parseInt(pointsToWinInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      handleChange('pointsToWin', parsed);
    } else {
      // Reset to current value
      setPointsToWinInput(String(mergedSettings.pointsToWin ?? 50));
    }
  };

  return (
    <div className="p-4 h-full overflow-y-auto bg-surface">
      <h2 className="mb-6 text-xl font-bold">Lobby Settings</h2>
      
      <div className="mb-6">
        <label className="block mb-2 font-bold">Round Duration (seconds)</label>
        <input
          type="number"
          value={roundDurationInput}
          onChange={(e) => setRoundDurationInput(e.target.value)}
          onBlur={handleRoundDurationBlur}
          disabled={!isHost}
          min="1"
          className="w-full p-2 border border-black mb-2"
        />
      </div>

      <div className="mb-6">
        <label className="block mb-2 font-bold">Points to Win</label>
        <input
          type="number"
          value={pointsToWinInput}
          onChange={(e) => setPointsToWinInput(e.target.value)}
          onBlur={handlePointsToWinBlur}
          disabled={!isHost}
          min="1"
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
