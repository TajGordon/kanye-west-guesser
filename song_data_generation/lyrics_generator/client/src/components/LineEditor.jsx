import React from 'react';
import './LineEditor.css';

const toVoiceId = (name) => {
  const n = String(name || '').trim();
  if (!n) return '';
  return n
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

export default function LineEditor({ index, line, isSelected, onChange, songArtists = [] }) {
  const detected = Array.isArray(line?.meta?.detectedVoices) ? line.meta.detectedVoices : [];
  const fromSection = Array.isArray(line?.section?.artists) ? line.section.artists : [];
  const combined = Array.from(new Map(
    [...songArtists, ...fromSection, ...detected]
      .map(a => String(a).trim())
      .filter(a => a.length > 0)
      .map(a => [a.toLowerCase(), a])
  ).values());

  const voiceOptions = combined.map(display => ({
    id: toVoiceId(display),
    display
  })).filter(v => v.id);

  const selectedVoices = (() => {
    if (Array.isArray(line?.voices) && line.voices.length > 0) return line.voices;
    if (line?.voice?.id) return [line.voice];

    // If nothing stored yet, default to the section's detected artists (or song artists)
    const preferred = fromSection.length > 0 ? fromSection : songArtists;
    return (preferred || [])
      .map(display => ({ id: toVoiceId(display), display: String(display) }))
      .filter(v => v.id);
  })();

  const selectedIds = new Set(selectedVoices.map(v => v?.id).filter(Boolean));

  const toggleVoice = (voice) => {
    const next = voiceOptions
      .filter(v => {
        if (v.id === voice.id) return !selectedIds.has(v.id);
        return selectedIds.has(v.id);
      })
      .map(v => ({ id: v.id, display: v.display }));

    // If the user unchecks everything, keep it empty (unknown/ambiguous)
    const primary = next[0] || null;
    onChange({
      ...line,
      voices: next,
      voice: primary || line.voice
    });
  };

  return (
    <div 
      className={`line-editor ${isSelected ? 'selected' : ''}`}
      data-section-type={line.section?.type}
    >
      <div className="line-content">
        <input
          type="text"
          value={line.content}
          onChange={(e) => onChange({ ...line, content: e.target.value })}
          className="line-text-input"
          placeholder="Line content"
        />
      </div>
      <div className="line-metadata-compact">
        <div className="section-group">
          <select
            value={line.section?.type || ''}
            onChange={(e) => onChange({
              ...line,
              section: { ...line.section, type: e.target.value }
            })}
            title="Section type"
            className="section-type-select"
          >
            <option value="verse">Verse</option>
            <option value="chorus">Chorus</option>
            <option value="pre-chorus">Pre-Chorus</option>
            <option value="bridge">Bridge</option>
            <option value="interlude">Interlude</option>
            <option value="break">Break</option>
            <option value="outro">Outro</option>
            <option value="intro">Intro</option>
          </select>
          <input
            type="number"
            value={line.section?.number || 1}
            onChange={(e) => onChange({
              ...line,
              section: { ...line.section, number: parseInt(e.target.value) || 1 }
            })}
            min="1"
            max="10"
            className="section-num"
            title="Section number"
            placeholder="#"
          />
        </div>
        <details className="voices-details">
          <summary className="voices-summary" title="Possible voices for this line">
            <span className="voices-summary-label">Voices</span>
            <span className="voices-summary-chips">
              {selectedVoices.slice(0, 3).map(v => (
                <span key={v.id} className="voice-chip">{v.display}</span>
              ))}
              {selectedVoices.length > 3 && (
                <span className="voices-more">+{selectedVoices.length - 3}</span>
              )}
              {selectedVoices.length === 0 && (
                <span className="voices-empty">(none)</span>
              )}
            </span>
          </summary>
          <div className="voices-panel">
            <div className="voices-selected">
              {(selectedVoices.length > 0 ? selectedVoices : []).map(v => (
                <span key={v.id} className="voice-chip">{v.display}</span>
              ))}
              {selectedVoices.length === 0 && (
                <span className="voices-empty">(none selected)</span>
              )}
            </div>
            <div className="voices-options">
              {(voiceOptions.length === 0
                ? [{ id: 'kanye-west', display: 'Kanye West' }]
                : voiceOptions
              ).map(v => (
                <label key={v.id} className="voice-option">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(v.id)}
                    onChange={() => toggleVoice(v)}
                  />
                  <span>{v.display}</span>
                </label>
              ))}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
