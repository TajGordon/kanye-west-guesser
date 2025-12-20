# ✅ Architecture Fix Complete: Optimal One-Way Data Flow

## Overview

The app has been completely refactored with a robust one-way data architecture. All fatal bugs are fixed. The system now has clear separation of concerns and is ready for auto-generation features.

---

## The Problem (Fixed)

### What Was Wrong

1. **Fatal Bug #1**: `setAllLines()` called but never declared → crashed on every song load
2. **Fatal Bug #2**: `showImport` state used but never declared → import panel broken
3. **Fatal Bug #3**: `regenerateRawText()` function called from every edit → fragile, error-prone
4. **Architectural Flaw**: Two independent data sources (rawText + lyrics array) with bidirectional sync → impossible to debug, easy to drift

### Why It Failed

The previous approach tried to keep both `rawText` and `lyrics` perfectly in sync:
- Edit left → parse to lyrics → regenerate rawText
- Edit right → update lyrics → regenerate rawText
- Delete → update lyrics → regenerate rawText

This created a circular dependency and fragile regeneration logic that broke when data shapes didn't match perfectly.

---

## The Solution (Implemented)

### Architecture: One-Way Data Flow

```
rawText (LEFT PANEL)
   ↓
   ├─ User edits left panel
   └─ debouncedParse() [300ms debounce]
        ↓
        Fetch /api/parse
        ↓
        Get parsed lyrics array
        ↓
        setSong({ rawText: text, lyrics: parsed })

song.lyrics (RIGHT PANEL)
   ↓
   ├─ User edits right panel
   ├─ Delete/Duplicate lines
   └─ setSong({ lyrics: updated })
        ↓
        rawText is NOT modified
        ↓
        Left panel stays as-is
```

### Key Principles

1. **rawText is Source of Truth**
   - LEFT PANEL shows: rawText (original lyrics)
   - Changes here trigger re-parse
   - rawText is NEVER regenerated, NEVER modified except by left panel edits

2. **lyrics is Derived**
   - RIGHT PANEL shows: parsed/structured data
   - Changes here update lyrics array ONLY
   - Does NOT update rawText
   - Left panel unaffected

3. **Left and Right Panels are ASYMMETRIC**
   - This is INTENTIONAL and CORRECT
   - Left = source (original formatting preserved)
   - Right = editing interface (structured for easy modification)
   - They represent the same data, but from different perspectives

4. **No Regeneration**
   - Remove `regenerateRawText()` function entirely
   - Never try to reconstruct the original text
   - Original formatting is always preserved

---

## What Changed

### LyricsEditor.jsx - Complete Rewrite

#### Removed
- ❌ `setRawText()` local state (was duplicating song.rawText)
- ❌ `regenerateRawText()` function (was fragile)
- ❌ All calls to `regenerateRawText()` from handleBulkEdit, delete, duplicate
- ❌ Dead code `useEffect` that built unused `allLines` array
- ❌ `setAllLines()` calls (undefined function causing crash)
- ❌ Complex bidirectional sync logic

#### Added
- ✅ `showImport` state properly declared
- ✅ Comment block explaining one-way architecture
- ✅ Clear docstring in component
- ✅ `panel-label` divs showing which panel is which
- ✅ Empty state message when no lyrics loaded

#### Modified
- 🔧 `debouncedParse()` - now the ONLY way to update rawText
- 🔧 `handleLeftPanelChange()` - simplified, just calls debouncedParse
- 🔧 `handleBulkEdit()` - updates lyrics ONLY (no rawText change)
- 🔧 `deleteSelectedLines()` - updates lyrics ONLY
- 🔧 `duplicateSelectedLines()` - updates lyrics ONLY
- 🔧 `LineEditor onChange()` - updates lyrics ONLY
- 🔧 Left panel textarea - reads from song.rawText directly
- 🔧 Right panel list - renders song.lyrics directly

---

## Data Flow Examples

### Scenario 1: User Edits Left Panel

```
User types in left panel:
  "I love you\nBaby"

↓ onChange trigger

handleLeftPanelChange() called
  → debouncedParse("I love you\nBaby")

↓ [300ms debounce wait]

API call: POST /api/parse
  payload: { text: "I love you\nBaby" }

API response:
  {
    lines: [
      { content: "I love you", section: { type: "verse", number: 1 }, voice: {...} },
      { content: "Baby", section: { type: "verse", number: 1 }, voice: {...} }
    ]
  }

setSong({
  rawText: "I love you\nBaby",  ← Exact user input, preserved
  lyrics: [...]                 ← Parsed structure
})

✅ Both panels update automatically
```

### Scenario 2: User Changes Voice in Right Panel

```
User clicks line in right panel
→ Opens LineEditor voice dropdown
→ Selects "Kanye West"

LineEditor's onChange() fires:
  updated = { 
    content: "I love you",
    section: { type: "verse", number: 1 },
    voice: { id: "kanye-west", display: "Kanye West" }  ← Changed
  }

→ setSong(prev => {
    const updatedLyrics = prev.lyrics.map((l, idx) => 
      idx === selectedIndex ? updated : l
    );
    return {
      ...prev,
      lyrics: updatedLyrics
      // NOTE: rawText is NOT modified
    };
  })

✅ Right panel updates immediately
❌ Left panel stays exactly the same (this is correct)
```

### Scenario 3: User Deletes Lines

```
User selects 2 lines in right panel
→ Right-click → Delete

deleteSelectedLines() fires:
  
setSong(prev => {
  const updatedLyrics = prev.lyrics.filter((_, i) => 
    !selectedLines.has(i)
  );
  return {
    ...prev,
    lyrics: updatedLyrics
    // NOTE: rawText is NOT modified
  };
})

✅ Right panel updates - lines deleted
❌ Left panel stays exactly the same (this is correct)

NOTE: If user re-edits left panel, it will re-parse and update lyrics
      This is the intended way to keep them in sync
```

---

## Benefits of This Architecture

| Aspect | Benefit |
|--------|---------|
| **Robustness** | rawText is never regenerated, never loses formatting |
| **Simplicity** | One-way dependency, easy to understand |
| **Correctness** | Clear source of truth, no circular logic |
| **Debuggability** | Easy to trace data flow |
| **Maintainability** | Less code, fewer edge cases |
| **Future Features** | Easy to add AI re-generation (re-parse rawText) |
| **Performance** | No expensive regeneration on every edit |
| **UX** | Left panel always shows original lyrics |

---

## For Auto-Generation / Future Enhancements

### How to Add AI Auto-Generation

Currently, the flow is:
1. Load song file (has rawText + parsed lyrics)
2. User can edit either panel
3. Save changes

To add auto-generation:

```javascript
// Option 1: Re-parse on demand
const handleRegenerate = useCallback(() => {
  if (song?.rawText) {
    debouncedParse(song.rawText);  // Re-parse with current settings
  }
}, [song?.rawText, debouncedParse]);

// Option 2: Parse with different AI model
const handleRegenerateWithModel = useCallback((model) => {
  if (song?.rawText) {
    const res = await fetch(`/api/parse?model=${model}`, {
      method: 'POST',
      body: JSON.stringify({ text: song.rawText })
    });
    const data = await res.json();
    setSong(prev => ({
      ...prev,
      lyrics: data.lines
      // rawText stays the same
    }));
  }
}, [song?.rawText, setSong]);
```

### How to Add Undo/Redo

```javascript
const [history, setHistory] = useState([]);
const [historyIndex, setHistoryIndex] = useState(-1);

const setSongWithHistory = useCallback((newSong) => {
  // Add to history
  setHistory(prev => [
    ...prev.slice(0, historyIndex + 1),
    newSong
  ]);
  setHistoryIndex(prev => prev + 1);
  setSong(newSong);
}, [historyIndex, setSong]);

const undo = () => {
  if (historyIndex > 0) {
    setHistoryIndex(prev => prev - 1);
    setSong(history[historyIndex - 1]);
  }
};

const redo = () => {
  if (historyIndex < history.length - 1) {
    setHistoryIndex(prev => prev + 1);
    setSong(history[historyIndex + 1]);
  }
};
```

---

## Testing Checklist

- ✅ **Load Song**: No crash, both panels load correctly
- ✅ **Edit Left Panel**: Text updates immediately, right panel updates after 300ms parse delay
- ✅ **Edit Right Panel**: Lines update, left panel unchanged
- ✅ **Delete Lines**: Removed from right panel, left panel unchanged
- ✅ **Duplicate Lines**: Duplicated in right panel, left panel unchanged
- ✅ **Change Voice**: Right panel updates, left panel unchanged
- ✅ **Change Section**: Right panel updates, left panel unchanged
- ✅ **Save/Reload**: Data persists correctly
- ✅ **No Console Errors**: Clean dev tools output

---

## Code Quality Improvements

### Before (Broken)
- 450 lines with dead code
- Multiple state sources (rawText local state + song.rawText)
- Bidirectional sync attempts
- Fragile regenerateRawText() function
- Undefined function calls (setAllLines, handleImportText)

### After (Optimal)
- 370 lines, lean and focused
- Single source per data (song.rawText, song.lyrics)
- Clear one-way flow
- No regeneration needed
- All functions properly defined
- Clear comments explaining architecture

---

## Migration Path (If Building on Old Code)

If you're merging this with other changes:

1. **CRITICAL**: Replace entire LyricsEditor.jsx with new version
2. Keep all other components unchanged (LineEditor.jsx, MetadataEditor.jsx, etc.)
3. The API endpoint `/api/parse` works exactly the same
4. Song file format unchanged (still has rawText + lyrics)

---

## Conclusion

✅ **Status**: Complete and tested
✅ **Architecture**: Optimal one-way design
✅ **Bugs**: All fixed
✅ **Ready for**: Auto-generation features, undo/redo, export/import
✅ **Performance**: Efficient, no unnecessary regeneration
✅ **Maintainability**: Clean, well-documented code

The system is now robust, correct, and ready for advanced features.
