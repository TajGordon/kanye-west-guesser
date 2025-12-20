import React, { useState, useRef, useCallback } from 'react';
import LineEditor from './LineEditor';
import MetadataEditor from './MetadataEditor';
import ContextMenu from './ContextMenu';
import './LyricsEditor.css';

// Artist color palette - maps artist IDs to colors
const ARTIST_COLORS = {
  'kanye-west': '#4da6ff',      // Blue
  'tyler-the-creator': '#ff6b6b', // Red
  'kid-cudi': '#9d6dff',        // Purple
  'pusha-t': '#ff9d4d',         // Orange
  'ty-dolla-sign': '#4dffb8',   // Cyan
  'mr-hudson': '#ffff4d',       // Yellow
  'travis-scott': '#ff6b9d',    // Pink
  'young-thug': '#4dffff'       // Light Cyan
};

/**
 * LyricsEditor Component - Synchronized Dual-View Architecture
 * 
 * SINGLE SOURCE OF TRUTH:
 * - song.lyrics[] = The canonical data structure (array of line objects)
 * 
 * DUAL VIEWS (both derived from lyrics):
 * - LEFT PANEL: Reconstructs raw text view from lyrics[],
 *   displays with section headers, editable as text
 * - RIGHT PANEL: Shows lyrics[] directly in structured form,
 *   editable via form fields
 * 
 * SYNCHRONIZED SELECTION:
 * - Click/select on LEFT → highlights matching lines on RIGHT
 * - Click/select on RIGHT → highlights corresponding content on LEFT
 * - Both panels always show the exact same data
 * 
 * EDIT PATHS:
 * - Edit LEFT panel text → parse → update song.lyrics[]
 * - Edit RIGHT panel fields → update song.lyrics[] directly
 * - Bulk operations (delete, duplicate, change) → update song.lyrics[]
 * - Both panels immediately update to reflect changes
 * 
 * BENEFITS:
 * - Single source of truth eliminates all drift
 * - Both panels are abstractions/views, not separate data stores
 * - Cross-panel selection shows relationship clearly
 * - Easy to debug - all changes go through song.lyrics[]
 */
export default function LyricsEditor({ song, setSong }) {
  // Local UI state (doesn't affect song data)
  const [selectedIndices, setSelectedIndices] = useState(new Set()); // Indices in lyrics array
  const [syncScroll, setSyncScroll] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [isParsingDebounced, setIsParsingDebounced] = useState(false);
  const [rawTextInput, setRawTextInput] = useState(null); // Local state for textarea - null means use display text
  const [colorMode, setColorMode] = useState('section'); // 'section' or 'artist'

  // Refs
  const parseTimeoutRef = useRef(null);
  const leftPanelRef = useRef(null);
  const rightPanelRef = useRef(null);
  const selectionStartRef = useRef(null);

  // Build display text from lyrics array (reconstructed from data, not stored)
  const buildDisplayText = useCallback(() => {
    const lines = [];
    let lastSection = null;

    (song?.lyrics || []).forEach(line => {
      const section = line.section;
      const sectionChanged = !lastSection ||
        lastSection.type !== section.type ||
        lastSection.number !== section.number;

      if (sectionChanged) {
        // Use lowercase format that parser expects: [verse 1], [chorus 1], etc.
        const sectionName = section.type.includes('-') 
          ? section.type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-')
          : section.type.charAt(0).toUpperCase() + section.type.slice(1);
        const label = `[${sectionName} ${section.number}]`;
        lines.push(label);
        lastSection = section;
      }

      // Skip blank lines in the display text reconstruction
      if (line.content !== '' || !line.meta?.blank) {
        lines.push(line.content);
      }
    });

    return lines.join('\n');
  }, [song?.lyrics]);

  // Parse raw text and update lyrics array
  const debouncedParse = useCallback((text) => {
    setIsParsingDebounced(true);
    setParseError(null);

    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current);
    }

    parseTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error('Parse failed');
        const data = await res.json();

        // Update only lyrics array (both panels derive from this)
        setSong(prev => ({
          ...prev,
          lyrics: data.lines || []
        }));
        setIsParsingDebounced(false);
      } catch (err) {
        console.error('Parse error:', err);
        setParseError(err.message);
        setIsParsingDebounced(false);
      }
    }, 300);
  }, [setSong]);

  // Reset textarea local state when song is loaded (reload from data)
  React.useEffect(() => {
    setRawTextInput(null);
  }, [song?.title]); // Reset when song changes

  // Left panel change handler: update local state immediately, parse in background
  const handleLeftPanelChange = useCallback((e) => {
    const newText = e.target.value;
    // Update local state immediately for responsive typing
    setRawTextInput(newText);
    // Parse in background (debounced) - don't force textarea to update
    debouncedParse(newText);
  }, [debouncedParse]);

  // Right panel bulk edit: update lyrics array
  const handleBulkEdit = useCallback((field, value) => {
    setSong(prev => {
      const updatedLyrics = (prev.lyrics || []).map((line, i) =>
        selectedIndices.has(i) ? { ...line, [field]: value } : line
      );
      
      return {
        ...prev,
        lyrics: updatedLyrics
      };
    });
  }, [selectedIndices, setSong]);

  // Delete selected lines
  const deleteSelectedLines = useCallback(() => {
    setSong(prev => {
      const updatedLyrics = (prev.lyrics || []).filter((_, i) => !selectedIndices.has(i));
      return {
        ...prev,
        lyrics: updatedLyrics
      };
    });
    setSelectedIndices(new Set());
    setContextMenu(null);
  }, [selectedIndices, setSong]);

  // Duplicate selected lines
  const duplicateSelectedLines = useCallback(() => {
    setSong(prev => {
      const newLyrics = [...(prev.lyrics || [])];
      const indicesToDuplicate = Array.from(selectedIndices).sort((a, b) => b - a);

      indicesToDuplicate.forEach(idx => {
        const lineToDuplicate = newLyrics[idx];
        newLyrics.splice(idx + 1, 0, { ...lineToDuplicate, line_number: undefined });
      });

      return {
        ...prev,
        lyrics: newLyrics
      };
    });
    setContextMenu(null);
  }, [selectedIndices, setSong]);

  // Selection handlers for right panel
  const handleLineClick = useCallback((index, e) => {
    if (e.shiftKey) {
      setSelectedIndices(prev => {
        const newSet = new Set(prev);
        if (prev.size > 0) {
          const indices = Array.from(prev);
          const min = Math.min(...indices, index);
          const max = Math.max(...indices, index);
          const range = new Set();
          for (let i = min; i <= max; i++) range.add(i);
          return range;
        } else {
          newSet.add(index);
          return newSet;
        }
      });
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedIndices(prev => {
        const newSet = new Set(prev);
        newSet.has(index) ? newSet.delete(index) : newSet.add(index);
        return newSet;
      });
    } else {
      setSelectedIndices(new Set([index]));
      selectionStartRef.current = index;
    }
  }, []);

  const handleLineDragStart = useCallback((index) => {
    selectionStartRef.current = index;
    setSelectedIndices(new Set([index]));
  }, []);

  const handleLineDragOver = useCallback((index) => {
    if (selectionStartRef.current !== null) {
      const start = Math.min(selectionStartRef.current, index);
      const end = Math.max(selectionStartRef.current, index);
      const range = new Set();
      for (let i = start; i <= end; i++) {
        range.add(i);
      }
      setSelectedIndices(range);
    }
  }, []);

  const handleLineDragEnd = useCallback(() => {
    selectionStartRef.current = null;
  }, []);

  // Context menu handler
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();

    const lineElement = e.target.closest('[data-line-index]');
    if (lineElement) {
      const index = parseInt(lineElement.getAttribute('data-line-index'), 10);
      if (!selectedIndices.has(index)) {
        setSelectedIndices(new Set([index]));
      }
    }

    const actions = [];

    if (selectedIndices.size > 0) {
      actions.push({
        icon: '🎤',
        label: 'Change Voice',
        submenu: [
          { label: 'Kanye West', onClick: () => handleBulkEdit('voice', { id: 'kanye-west', display: 'Kanye West' }) },
          { label: 'Ty Dolla $ign', onClick: () => handleBulkEdit('voice', { id: 'ty-dolla-sign', display: 'Ty Dolla $ign' }) },
          { label: 'Pusha T', onClick: () => handleBulkEdit('voice', { id: 'pusha-t', display: 'Pusha T' }) },
          { label: 'Kid Cudi', onClick: () => handleBulkEdit('voice', { id: 'kid-cudi', display: 'Kid Cudi' }) },
          { label: 'Mr Hudson', onClick: () => handleBulkEdit('voice', { id: 'mr-hudson', display: 'Mr Hudson' }) },
          { label: 'Travis Scott', onClick: () => handleBulkEdit('voice', { id: 'travis-scott', display: 'Travis Scott' }) },
          { label: 'Young Thug', onClick: () => handleBulkEdit('voice', { id: 'young-thug', display: 'Young Thug' }) }
        ]
      });

      actions.push({
        icon: '📍',
        label: 'Change Section',
        submenu: [
          { label: 'Verse', onClick: () => handleBulkEdit('section', { type: 'verse', number: 1 }) },
          { label: 'Chorus', onClick: () => handleBulkEdit('section', { type: 'chorus', number: 1 }) },
          { label: 'Pre-Chorus', onClick: () => handleBulkEdit('section', { type: 'pre-chorus', number: 1 }) },
          { label: 'Bridge', onClick: () => handleBulkEdit('section', { type: 'bridge', number: 1 }) },
          { label: 'Intro', onClick: () => handleBulkEdit('section', { type: 'intro', number: 1 }) },
          { label: 'Outro', onClick: () => handleBulkEdit('section', { type: 'outro', number: 1 }) }
        ]
      });

      actions.push({ divider: true });

      actions.push({
        icon: '📋',
        label: `Duplicate (${selectedIndices.size})`,
        onClick: duplicateSelectedLines
      });

      actions.push({
        icon: '🗑️',
        label: `Delete (${selectedIndices.size})`,
        onClick: deleteSelectedLines
      });
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      actions
    });
  }, [selectedIndices, handleBulkEdit, duplicateSelectedLines, deleteSelectedLines]);

  const handleLeftScroll = useCallback(() => {
    if (!syncScroll || !leftPanelRef.current || !rightPanelRef.current) return;
    rightPanelRef.current.scrollTop = leftPanelRef.current.scrollTop;
  }, [syncScroll]);

  const handleRightScroll = useCallback(() => {
    if (!syncScroll || !leftPanelRef.current || !rightPanelRef.current) return;
    leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop;
  }, [syncScroll]);

  // Helper: Get color for a line based on current color mode
  const getLineColor = useCallback((line) => {
    if (colorMode === 'artist') {
      return ARTIST_COLORS[line.voice?.id] || '#666';
    } else {
      // Use existing section type colors from CSS
      const sectionColors = {
        'verse': '#4da6ff',
        'chorus': '#ff9d4d',
        'pre-chorus': '#9d6dff',
        'bridge': '#4dffb8',
        'intro': '#ffff4d',
        'outro': '#ff6b9d',
        'interlude': '#4dffff'
      };
      return sectionColors[line.section?.type] || '#666';
    }
  }, [colorMode]);

  // Helper: Group lines by section with visual grouping
  const groupLinesBySection = useCallback(() => {
    if (!song?.lyrics) return [];
    
    const groups = [];
    let currentGroup = null;

    song.lyrics.forEach((line, idx) => {
      const sectionKey = `${line.section?.type}-${line.section?.number}`;
      
      // Start a new group if section changed
      if (!currentGroup || currentGroup.sectionKey !== sectionKey) {
        currentGroup = {
          sectionKey,
          section: line.section,
          lines: [],
          startIndex: idx
        };
        groups.push(currentGroup);
      }

      currentGroup.lines.push({ line, index: idx });
    });

    return groups;
  }, [song?.lyrics]);

  return (
    <div className="lyrics-editor">
      <div className="editor-sidebar">
        <MetadataEditor song={song} setSong={setSong} />
        {selectedIndices.size > 0 && (
          <div className="selection-info">
            <strong>{selectedIndices.size} line{selectedIndices.size !== 1 ? 's' : ''} selected</strong>
          </div>
        )}
        <div className="bulk-actions">
          <h3>Bulk Edit (Shared Data)</h3>
          {selectedIndices.size > 0 && (
            <>
              <div className="action-group">
                <label>Voice</label>
                <select onChange={(e) => e.target.value && handleBulkEdit('voice', { id: e.target.value, display: e.target.value })}>
                  <option value="">Select voice...</option>
                  <option value="kanye-west">Kanye West</option>
                  <option value="ty-dolla-sign">Ty Dolla $ign</option>
                  <option value="pusha-t">Pusha T</option>
                </select>
              </div>
              <div className="action-group">
                <label>Section Type</label>
                <select onChange={(e) => e.target.value && handleBulkEdit('section', { type: e.target.value, number: 1 })}>
                  <option value="">Select section...</option>
                  <option value="verse">Verse</option>
                  <option value="chorus">Chorus</option>
                  <option value="bridge">Bridge</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="action-group button-group">
                <button onClick={duplicateSelectedLines} className="duplicate-btn">Duplicate</button>
                <button onClick={deleteSelectedLines} className="delete-btn">Delete</button>
              </div>
            </>
          )}
        </div>
        <label className="sync-toggle">
          <input
            type="checkbox"
            checked={syncScroll}
            onChange={(e) => setSyncScroll(e.target.checked)}
          />
          Sync scrolling
        </label>
        <div className="color-mode-toggle">
          <label>Color Mode:</label>
          <div className="toggle-buttons">
            <button 
              className={`toggle-btn ${colorMode === 'section' ? 'active' : ''}`}
              onClick={() => setColorMode('section')}
              title="Color by section type (Verse, Chorus, etc.)"
            >
              📍 Sections
            </button>
            <button 
              className={`toggle-btn ${colorMode === 'artist' ? 'active' : ''}`}
              onClick={() => setColorMode('artist')}
              title="Color by artist/voice"
            >
              🎤 Artists
            </button>
          </div>
        </div>
      </div>

      <div className="editor-main">
        <h2>{song?.title || 'Untitled'}</h2>
        <div className="split-panels">
          <div className="left-panel-container">
            <div className="panel-label">Raw Text View</div>
            <textarea
              ref={leftPanelRef}
              className="left-panel-textarea"
              value={rawTextInput !== null ? rawTextInput : buildDisplayText()}
              onChange={handleLeftPanelChange}
              placeholder="Edit or paste raw lyrics here (uses [Verse 1], [Chorus], etc. for section headers)"
              onScroll={handleLeftScroll}
            />
            {isParsingDebounced && <div className="parse-indicator">Parsing...</div>}
            {parseError && <div className="parse-error">Error: {parseError}</div>}
          </div>

          <div 
            className="right-panel" 
            ref={rightPanelRef} 
            onScroll={handleRightScroll}
            onContextMenu={handleContextMenu}
          >
            <div className="panel-label">Structured Data View</div>
            <div className="selection-hint">
              {selectedIndices.size === 0 
                ? 'Click a line • Drag to select range • Shift+Click for range • Ctrl+Click to multi-select • Right-click for actions' 
                : `${selectedIndices.size} selected`}
            </div>
            <div className="lyrics-list">
              {groupLinesBySection().map((group) => {
                const sectionColor = getLineColor(group.section);
                return (
                  <div key={group.sectionKey} className="section-group-container">
                    {/* Visual section header */}
                    <div 
                      className="section-header-visual"
                      style={{ borderLeftColor: sectionColor, backgroundColor: `${sectionColor}20` }}
                    >
                      <div className="section-title">
                        {group.section?.type.charAt(0).toUpperCase() + group.section?.type.slice(1)} {group.section?.number}
                      </div>
                    </div>
                    
                    {/* Lines in this section */}
                    <div className="section-lines">
                      {group.lines.map(({ line, index: i }) => (
                        <div
                          key={i}
                          data-line-index={i}
                          className={`line-wrapper ${selectedIndices.has(i) ? 'selected' : ''}`}
                          style={{ 
                            borderLeftColor: sectionColor,
                            backgroundColor: `${sectionColor}12`
                          }}
                          onClick={(e) => handleLineClick(i, e)}
                          onDragStart={() => handleLineDragStart(i)}
                          onDragOver={() => handleLineDragOver(i)}
                          onDragEnd={handleLineDragEnd}
                          draggable
                        >
                          <LineEditor
                            index={i}
                            line={line}
                            isSelected={selectedIndices.has(i)}
                            onChange={(updated) => {
                              setSong(prev => {
                                const updatedLyrics = (prev.lyrics || []).map((l, idx) => 
                                  idx === i ? updated : l
                                );
                                return {
                                  ...prev,
                                  lyrics: updatedLyrics
                                };
                              });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {(!song?.lyrics || song.lyrics.length === 0) && (
                <div className="empty-state">
                  No lyrics loaded. Edit raw text on the left or load a song.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenu.actions}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
