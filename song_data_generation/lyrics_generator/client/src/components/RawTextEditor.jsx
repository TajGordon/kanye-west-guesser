import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, Decoration, WidgetType } from '@codemirror/view';
import { StateField } from '@codemirror/state';
import { parseSectionHeader } from '../../../shared/sectionHeader.js';
import './RawTextEditor.css';

/**
 * SIMPLIFIED COLOR SYSTEM
 * Maps section TYPE to a distinct vibrant color
 * Not instance-dependent (all verses same blue, all choruses same orange, etc)
 * This ensures consistent, recognizable coloring
 */
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

// Get color for a section type (simple lookup, no complexity)
const getColorForSectionType = (sectionType) => {
  let type = (sectionType || '').toLowerCase().replace(/\s+/g, '-');
  // Keep this aligned with server normalization for common synonyms.
  if (type === 'refrain') type = 'chorus';
  if (type === 'hook') type = 'chorus';
  if (type === 'post-chorus') type = 'chorus';
  return SECTION_TYPE_COLORS[type] || '#888888'; // Default gray if unknown type
};

// Widget for visual spacing before headers
class SpacerWidget extends WidgetType {
  toDOM() {
    const spacer = document.createElement('div');
    spacer.style.height = '8px';
    spacer.style.backgroundColor = 'transparent';
    spacer.style.pointerEvents = 'none';
    return spacer;
  }

  ignoreEvent() {
    return false;
  }
}

// Helper to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [100, 100, 100];
}

// Create decorations for section highlighting and spacing
const createDecorations = (text) => {
  const decorations = [];
  const lines = text.split('\n');
  let pos = 0;
  let currentSectionType = null;
  let currentColor = '#888888'; // Default gray

  lines.forEach((line, idx) => {
    const lineStart = pos;
    const lineEnd = pos + line.length;

    // Detect section header using the shared parser (loose mode).
    const header = parseSectionHeader(line, [], { strictTypes: false, autoNumber: false });

    if (header) {
      currentSectionType = header.type;
      currentColor = getColorForSectionType(currentSectionType);
      console.log(`[RawTextEditor] Section header: type="${currentSectionType}", color="${currentColor}"`);

      // Add spacing widget before header (if not first line and previous line wasn't blank)
      if (idx > 0 && lines[idx - 1].trim() !== '') {
        const spacerWidget = new SpacerWidget();
        const spacerDeco = Decoration.widget({
          widget: spacerWidget,
          block: true
        }).range(lineStart);
        decorations.push(spacerDeco);
      }

      // Color the header line
      const headerDeco = Decoration.line({
        attributes: {
          style: `background: ${currentColor}40; border-bottom: 3px solid ${currentColor}; font-weight: bold; color: ${currentColor};`
        }
      }).range(lineStart);
      decorations.push(headerDeco);
    } else if (line.trim() !== '') {
      // Regular lyric line - use the current section's color with reduced opacity
      const headerDeco = Decoration.line({
        attributes: {
          style: `background: ${currentColor}20; border-left: 3px solid ${currentColor};`
        }
      }).range(lineStart);
      decorations.push(headerDeco);
    }

    pos = lineEnd + 1; // +1 for newline character
  });

  return Decoration.set(decorations, true);
};

// Create the highlighting extension
const highlightingExtension = StateField.define({
  create(state) {
    return createDecorations(state.doc.toString());
  },
  update(value, tr) {
    if (tr.docChanged) {
      return createDecorations(tr.state.doc.toString());
    }
    return value;
  },
  provide: f => EditorView.decorations.from(f)
});

const RawTextEditor = React.forwardRef(({
  value,
  onChange,
  song,
  colorMode,
  onScroll,
  onSelection,
  onPaste,
  syncScroll
}, ref) => {
  const editorViewRef = useRef(null);

  const handleChange = useCallback((newValue) => {
    onChange({ target: { value: newValue } });
  }, [onChange]);

  const handleScroll = useCallback(() => {
    onScroll?.();
  }, [onScroll]);

  // Create selection tracking extension
  const selectionExtension = useMemo(() => {
    return EditorView.updateListener.of((update) => {
      if (update.selectionSet) {
        // Get the selection from the update
        const selection = update.state.selection;
        onSelection?.(selection);
      }
    });
  }, [onSelection]);

  // Create paste detection extension
  const pasteDetectionExtension = useMemo(() => {
    return EditorView.domEventHandlers({
      paste(event) {
        // Trigger paste handler after paste completes
        setTimeout(() => {
          onPaste?.();
        }, 0);
        return false;
      }
    });
  }, [onPaste]);

  const extensions = useMemo(() => {
    return [highlightingExtension, selectionExtension, pasteDetectionExtension];
  }, [selectionExtension, pasteDetectionExtension]);

  return (
    <div className="raw-text-editor-container" ref={ref}>
      <CodeMirror
        ref={editorViewRef}
        value={value}
        onChange={handleChange}
        height="100%"
        width="100%"
        extensions={extensions}
        theme="dark"
        className="raw-text-editor"
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLineGutter: false,
          searchKeymap: false
        }}
        indentUnit={2}
        onScroll={handleScroll}
      />
    </div>
  );
});

RawTextEditor.displayName = 'RawTextEditor';

export default RawTextEditor;


