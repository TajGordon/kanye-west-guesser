import React from 'react';
import './LineEditor.css';

export default function LineEditor({ index, line, isSelected, onChange }) {
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
        <select
          value={line.voice?.id || ''}
          onChange={(e) => {
            const voiceMap = {
              'kanye-west': 'Kanye West',
              'ty-dolla-sign': 'Ty Dolla $ign',
              'pusha-t': 'Pusha T',
              'kid-cudi': 'Kid Cudi',
              'mr-hudson': 'Mr Hudson',
              'travis-scott': 'Travis Scott',
              'young-thug': 'Young Thug'
            };
            onChange({
              ...line,
              voice: { id: e.target.value, display: voiceMap[e.target.value] || e.target.value }
            });
          }}
          title="Voice/artist"
          className="voice-select"
        >
          <option value="kanye-west">Kanye West</option>
          <option value="ty-dolla-sign">Ty Dolla $ign</option>
          <option value="pusha-t">Pusha T</option>
          <option value="kid-cudi">Kid Cudi</option>
          <option value="mr-hudson">Mr Hudson</option>
          <option value="travis-scott">Travis Scott</option>
          <option value="young-thug">Young Thug</option>
        </select>
      </div>
    </div>
  );
}
