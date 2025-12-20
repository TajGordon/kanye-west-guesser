import React, { useState, useRef, useCallback, useMemo } from 'react';
import LineEditor from './LineEditor';
import MetadataEditor from './MetadataEditor';
import ContextMenu from './ContextMenu';
import RawTextEditor from './RawTextEditor';
import { linesToSections, getSectionColorKey, validateLyricStructure } from '../utils/dataModel';
import './LyricsEditor.css';

// Artist color palette - maps artist IDs to colors (bright, vibrant)
const ARTIST_COLORS = {
  'kanye-west': '#5eb3ff',      // Bright Blue
  'tyler-the-creator': '#ff5252', // Bright Red
  'kid-cudi': '#b47dff',        // Bright Purple
  'pusha-t': '#ffb74d',         // Bright Orange
  'ty-dolla-sign': '#52ffb8',   // Bright Cyan
  'mr-hudson': '#ffff52',       // Bright Yellow
  'travis-scott': '#ff52a1',    // Bright Pink
  'young-thug': '#52ffff'       // Bright Light Cyan
};

// Section type color palette - maps section type to colors (matches RawTextEditor)
const SECTION_TYPE_COLORS = {
  'verse': '#5eb3ff',        // Bright Blue
  'chorus': '#ffb74d',       // Bright Orange
  'pre-chorus': '#b47dff',   // Bright Purple
  'bridge': '#52ffb8',       // Bright Cyan/Green
  'intro': '#ffff52',        // Bright Yellow
  'outro': '#ff52a1',        // Bright Pink
  'interlude': '#52ffff',    // Bright Light Cyan
  'hook': '#ff7f7f'          // Light Red
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

  const structureIssues = useMemo(() => {
    return validateLyricStructure(song?.lyrics || []);
  }, [song?.lyrics]);

  // Sync tracking (prevents stale parse responses from overwriting newer raw edits)
  const [rawTextVersion, setRawTextVersion] = useState(0);
  const [lastAppliedParseVersion, setLastAppliedParseVersion] = useState(0);
  const latestRawTextVersionRef = useRef(0);

  // Refs
  const parseTimeoutRef = useRef(null);
  const leftPanelRef = useRef(null);
  const rightPanelRef = useRef(null);
  const selectionStartRef = useRef(null);

  // DEFENSIVE NORMALIZATION: Ensure all section data is in canonical format
  // Canonical format: { type: "verse", number: 1 } NOT { type: "verse-1" }
  const normalizeSectionInPlace = useCallback((section) => {
    if (!section) return section;
    
    // If type contains a dash and the last part is a number, extract it
    if (typeof section.type === 'string' && section.type.includes('-')) {
      const parts = section.type.split('-');
      const lastPart = parts[parts.length - 1];
      
      if (/^\d+$/.test(lastPart)) {
        // Old format detected: "verse-2" → "verse", number 2
        section.type = parts.slice(0, -1).join('-').toLowerCase();
        section.number = parseInt(lastPart);
        console.warn(`[LyricsEditor] Fixed corrupted section format: "${parts.join('-')}" → type="${section.type}", number=${section.number}`);
      }
    }
    
    // Ensure type is lowercase
    if (section.type) {
      section.type = section.type.toLowerCase();
    }
    
    // Ensure number is always present and valid
    if (!section.number || section.number < 1) {
      section.number = 1;
      console.warn(`[LyricsEditor] Fixed invalid section number, set to 1`);
    }
    
    return section;
  }, []);

  // Helper: Format section names safely (handles both "verse" and corrupted formats)
  const formatSectionName = useCallback((sectionType) => {
    if (!sectionType) return '';
    
    // DEFENSIVE: Handle old format like "verse-2" by splitting only on first dash
    let displayName = sectionType;
    if (sectionType.includes('-')) {
      const parts = sectionType.split('-');
      // Only use the first part (the actual type name)
      displayName = parts[0];
    }
    
    return displayName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-');
  }, []);

  // Build display text from lyrics array (reconstructed from data, not stored)
  const buildDisplayText = useCallback(() => {
    const lines = [];
    let lastSection = null;

    (song?.lyrics || []).forEach((line, idx) => {
      const section = line.section;
      const sectionChanged = !lastSection ||
        lastSection.type !== section.type ||
        lastSection.number !== section.number;

      if (sectionChanged) {
        // Add blank line before section header (except for first section)
        if (lastSection !== null && lines.length > 0) {
          lines.push('');
        }
        
        // Format section name: "pre-chorus" → "Pre-Chorus", "verse" → "Verse", etc.
        const sectionName = formatSectionName(section.type);
        const artists = Array.isArray(section.artists) ? section.artists : [];
        const artistPart = artists.length > 0 ? `: ${artists.join(', ')}` : '';
        const label = `[${sectionName} ${section.number}${artistPart}]`;
        lines.push(label);
        lastSection = section;
      }

      // Always add the content (including blank lines)
      lines.push(line.content);
    });

    return lines.join('\n');
  }, [song?.lyrics]);

  const displayedRawText = useMemo(() => {
    return rawTextInput !== null ? rawTextInput : buildDisplayText();
  }, [rawTextInput, buildDisplayText]);

  const isStructuredStale = useMemo(() => {
    // When rawTextInput is non-null, user is editing a draft that may not yet be parsed into song.lyrics.
    // We consider structured "stale" until the latest raw version has been applied.
    return rawTextInput !== null && lastAppliedParseVersion !== rawTextVersion;
  }, [rawTextInput, lastAppliedParseVersion, rawTextVersion]);

  const parseAndApply = useCallback(async (text, version) => {
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) throw new Error('Parse failed');
      const data = await res.json();

      if (!data.lines || !Array.isArray(data.lines)) {
        throw new Error('Invalid response: missing lines array');
      }

      // Ignore stale responses (user typed more since this request was issued)
      if (version !== latestRawTextVersionRef.current) {
        console.log(`[Parse] Ignored stale response for v${version} (latest is v${latestRawTextVersionRef.current})`);
        return;
      }

      setSong(prev => {
        const publisherArtists = Array.isArray(prev.artists) ? prev.artists : (prev.artist ? [prev.artist] : ['Kanye West']);
        const existingFeatures = Array.isArray(prev.features) ? prev.features : [];
        const detectedArtists = new Set();
        for (const line of data.lines) {
          const artists = Array.isArray(line?.section?.artists) ? line.section.artists : [];
          for (const a of artists) {
            const s = String(a).trim();
            if (s) detectedArtists.add(s);
          }
        }
        const mergedFeatures = Array.from(new Map(
          [...existingFeatures, ...Array.from(detectedArtists)]
            .map(a => String(a).trim())
            .filter(a => a.length > 0)
            .filter(a => !publisherArtists.some(p => String(p).toLowerCase() === String(a).toLowerCase()))
            .map(a => [a.toLowerCase(), a])
        ).values());

        const performers = Array.from(new Map(
          [...publisherArtists, ...mergedFeatures]
            .map(a => String(a).trim())
            .filter(a => a.length > 0)
            .map(a => [a.toLowerCase(), a])
        ).values());

        const toVoiceId = (name) => {
          const n = String(name || '').trim();
          if (!n) return '';
          return n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        };

        const withVoices = (data.lines || []).map((line) => {
          const sectionArtists = Array.isArray(line?.section?.artists) ? line.section.artists : [];
          const preferred = sectionArtists.length > 0 ? sectionArtists : performers;
          const voices = (preferred || [])
            .map((display) => ({ id: toVoiceId(display), display: String(display) }))
            .filter(v => v.id);
          const primary = voices[0] || line.voice || { id: 'kanye-west', display: 'Kanye West' };
          return { ...line, voices, voice: primary };
        });

        const nextSong = {
          ...prev,
          lyrics: withVoices
        };

        // Keep publisher artists stable; merge detected header artists into features (performers)
        nextSong.artists = publisherArtists;
        nextSong.artist = String(publisherArtists[0] || prev.artist || 'Kanye West');
        nextSong.features = mergedFeatures;
        if (!Number.isInteger(nextSong.schemaVersion)) nextSong.schemaVersion = 2;

        // Optional: producers[] extracted from credit lines like [Produced by ...]
        if (data?.meta?.producers && Array.isArray(data.meta.producers)) {
          const existing = Array.isArray(prev.producers) ? prev.producers : [];
          const mergedProducers = Array.from(new Map(
            [...existing, ...data.meta.producers]
              .map(p => String(p).trim())
              .filter(p => p.length > 0)
              .map(p => [p.toLowerCase(), p])
          ).values());
          nextSong.producers = mergedProducers;
        }
        console.log(`[Parse] Applied v${version}: ${nextSong.lyrics.length} lines`);
        return nextSong;
      });
      setLastAppliedParseVersion(version);
      setIsParsingDebounced(false);
      setParseError(null);
    } catch (err) {
      console.error('Parse error:', err);
      // Only surface error if this parse is still the latest
      if (version === latestRawTextVersionRef.current) {
        setParseError(err.message);
        setIsParsingDebounced(false);
      }
    }
  }, [setSong]);

  // Debounced parse scheduling (for typing)
  const scheduleParse = useCallback((text, version) => {
    setIsParsingDebounced(true);
    setParseError(null);

    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current);
    }

    parseTimeoutRef.current = setTimeout(() => {
      parseAndApply(text, version);
    }, 300);
  }, [parseAndApply]);

  // Manual refresh: parse the currently displayed raw text and overwrite structured lyrics
  const handleRefreshStructuredFromRaw = useCallback(() => {
    const textToParse = displayedRawText;

    // Treat this as the latest version (even if rawTextInput is null, this refresh is explicit)
    setIsParsingDebounced(true);
    setParseError(null);

    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current);
    }

    // If user isn't in raw draft mode, bump version so this response can be gated consistently
    setRawTextVersion(prev => {
      const next = prev + 1;
      latestRawTextVersionRef.current = next;
      parseAndApply(textToParse, next);
      return next;
    });
  }, [displayedRawText, parseAndApply]);

  const handleResetRawToStructured = useCallback(() => {
    setRawTextInput(null);
    // Consider it "in sync" because raw view is now derived from structured.
    setLastAppliedParseVersion(rawTextVersion);
  }, [rawTextVersion]);

  // Reset textarea local state when song is loaded (reload from data)
  React.useEffect(() => {
    setRawTextInput(null);
  }, [song?.title]); // Reset when song changes

  // Left panel change handler: update local state immediately, parse in background
  const handleLeftPanelChange = useCallback((e) => {
    const newText = e.target.value;
    // Update local state immediately for responsive typing
    setRawTextInput(newText);
    // Bump raw version and schedule parse; stale responses will be ignored
    setRawTextVersion(prev => {
      const next = prev + 1;
      latestRawTextVersionRef.current = next;
      scheduleParse(newText, next);
      return next;
    });
  }, [scheduleParse]);

  // Handle paste events in the raw text editor - trigger immediate parsing
  const handleLeftPanelPaste = useCallback((e) => {
    // Allow the paste to complete first
    setTimeout(() => {
      if (e.target && e.target.value) {
        const pastedText = e.target.value;
        setRawTextInput(pastedText);
        // Treat paste as a raw edit (versioned) and parse promptly
        setRawTextVersion(prev => {
          const next = prev + 1;
          latestRawTextVersionRef.current = next;
          scheduleParse(pastedText, next);
          return next;
        });
      }
    }, 0);
  }, [scheduleParse]);

  // Left panel text selection handler
  const handleLeftPanelSelection = useCallback((selection) => {
    if (!selection || selection.ranges.length === 0) {
      setSelectedIndices(new Set());
      return;
    }

    // Get the text from the current display (raw draft if present, otherwise rebuilt from lyrics)
    const displayText = displayedRawText;
    const selectedText = displayText.slice(selection.ranges[0].from, selection.ranges[0].to);
    
    // Map selected text back to lyrics indices
    const newIndices = new Set();
    let currentPos = 0;
    let currentLyricIdx = 0;
    let lastSection = null;

    // Reconstruct the display and track positions
    (song?.lyrics || []).forEach((line, idx) => {
      const section = line.section;
      const sectionChanged = !lastSection ||
        lastSection.type !== section.type ||
        lastSection.number !== section.number;

      if (sectionChanged) {
        // Add blank line before section header (except first section)
        if (lastSection !== null && idx > 0) {
          currentPos += 1; // blank line
        }
        
        // Format section name
        const sectionName = section.type.includes('-') 
          ? section.type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-')
          : section.type.charAt(0).toUpperCase() + section.type.slice(1);
        const label = `[${sectionName} ${section.number}]`;
        currentPos += label.length + 1; // +1 for newline
        lastSection = section;
      }

      // Skip blank lines
      if (line.content !== '' || !line.meta?.blank) {
        const lineStart = currentPos;
        const lineEnd = currentPos + line.content.length;
        
        // Check if this line overlaps with selection
        if (lineStart < selection.ranges[0].to && lineEnd > selection.ranges[0].from) {
          newIndices.add(idx);
        }
        
        currentPos = lineEnd + 1; // +1 for newline
      }
    });

    setSelectedIndices(newIndices);
  }, [song?.lyrics, displayedRawText, buildDisplayText]);

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
          { label: 'Interlude', onClick: () => handleBulkEdit('section', { type: 'interlude', number: 1 }) },
          { label: 'Break', onClick: () => handleBulkEdit('section', { type: 'break', number: 1 }) },
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
    // Sync right panel scroll
    if (!syncScroll || !leftPanelRef.current || !rightPanelRef.current) return;
    // Note: CodeMirror scroll sync handled by passing the viewport
    if (rightPanelRef.current) {
      rightPanelRef.current.scrollTop = leftPanelRef.current?.scrollTop || 0;
    }
  }, [syncScroll]);

  const handleRightScroll = useCallback(() => {
    if (!syncScroll || !leftPanelRef.current || !rightPanelRef.current) return;
    leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop;
  }, [syncScroll]);

  const getLineColor = useCallback((section) => {
    if (!section) return '#888';
    
    if (colorMode === 'artist') {
      // For artist mode, we need the voice info - not available here
      // Return neutral color, actual coloring done per-line
      return '#888';
    } else {
      // Section-based coloring: color by type (verse, chorus, etc.)
      const colorKey = getSectionColorKey(section);
      return SECTION_TYPE_COLORS[colorKey] || '#888';
    }
  }, [colorMode]);

  // Helper: Group lines by section using modern section-based model
  const groupLinesBySection = useCallback(() => {
    if (!song?.lyrics) return [];
    
    // Convert line-based storage to section-based rendering format
    // This automatically skips blank lines and groups by type + number
    const sections = linesToSections(song.lyrics);
    
    console.log(`[groupLinesBySection] Total sections: ${sections.length}`);
    sections.slice(0, 3).forEach(s => {
      console.log(`  - ${s.type}-${s.number}: ${s.lines.length} lines`);
    });
    
    // Convert to internal grouping format for backward compatibility with existing code
    return sections.map((section) => ({
      sectionKey: `${section.type}-${section.number}`,
      section: {
        ...(section.lines?.[0]?.section || { type: section.type, number: section.number })
      },
      lines: section.lines.map((line, idx) => {
        // Find original index in full lyrics array for reference
        const originalIndex = song.lyrics.findIndex(
          (l) => l.line_number === line.line_number && l.content === line.content
        );
        return {
          line,
          index: originalIndex >= 0 ? originalIndex : idx
        };
      }),
      startIndex: section.lines[0]?.line_number || 0
    }));
  }, [song?.lyrics]);

  return (
    <div className="lyrics-editor">
      <div className="editor-sidebar">
        <MetadataEditor song={song} setSong={setSong} />
        {structureIssues.length > 0 && (
          <div className="bulk-actions" role="status" aria-live="polite">
            <h3>Validation</h3>
            <div style={{ fontSize: 12, color: '#d32f2f', marginBottom: 8 }}>
              {structureIssues.length} issue{structureIssues.length !== 1 ? 's' : ''} detected
            </div>
            <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.4 }}>
              {structureIssues.slice(0, 6).map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
              {structureIssues.length > 6 && (
                <div style={{ opacity: 0.8, marginTop: 6 }}>
                  (+{structureIssues.length - 6} more)
                </div>
              )}
            </div>
          </div>
        )}
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
        <div className="editor-controls">
          <button onClick={handleRefreshStructuredFromRaw} className="reprocess-btn" title="Parse the Raw Text view and overwrite the Structured Data view">
            🔄 Refresh Structured from Raw
          </button>
          {rawTextInput !== null && (
            <button onClick={handleResetRawToStructured} className="reprocess-btn" title="Discard the raw draft and rebuild Raw Text from Structured Data">
              ↩ Reset Raw to Structured
            </button>
          )}
          <div style={{ marginLeft: 12, fontSize: 12, opacity: 0.85 }}>
            {isParsingDebounced
              ? 'Parsing…'
              : isStructuredStale
                ? 'Structured view is stale (raw edits not applied)'
                : 'Structured view is up-to-date'}
          </div>
        </div>
        <div className="split-panels">
          <div className="left-panel-container">
            <div className="panel-label">Raw Text View</div>
            <RawTextEditor
              ref={leftPanelRef}
              value={rawTextInput !== null ? rawTextInput : buildDisplayText()}
              onChange={handleLeftPanelChange}
              onSelection={handleLeftPanelSelection}
              onPaste={handleLeftPanelPaste}
              song={song}
              colorMode={colorMode}
              onScroll={handleLeftScroll}
              syncScroll={syncScroll}
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
                console.log(`[Rendering] Section: ${group.section?.type}-${group.section?.number}, ${group.lines.length} lines`);
                return (
                  <div key={group.sectionKey} className="section-group-container">
                    {/* Visual section header */}
                    <div 
                      className="section-header-visual"
                      style={{ borderLeftColor: sectionColor, backgroundColor: `${sectionColor}20` }}
                    >
                      <div className="section-title">
                        {group.section?.label
                          ? group.section.label
                          : `${formatSectionName(group.section?.type)} ${group.section?.number}`}
                      </div>
                      {Array.isArray(group.section?.artists) && group.section.artists.length > 0 && (
                        <div className="section-artists" style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
                          {group.section.artists.join(' • ')}
                        </div>
                      )}
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
                            songArtists={Array.isArray(song?.artists)
                              ? [...song.artists, ...(Array.isArray(song?.features) ? song.features : [])]
                              : (song?.artist ? [song.artist, ...(Array.isArray(song?.features) ? song.features : [])] : (Array.isArray(song?.features) ? song.features : []))}
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
