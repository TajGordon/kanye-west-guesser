# 📊 Visual Architecture Guide

## One-Way Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LyricsEditor Component                       │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
        ┌───────────────────────┐    ┌──────────────────────┐
        │   LEFT PANEL          │    │   RIGHT PANEL        │
        │  (Raw Lyrics)         │    │ (Structured Data)    │
        │                       │    │                      │
        │  rawText state        │    │  lyrics array        │
        │  (from song.rawText)  │    │  (from song.lyrics)  │
        └───────────────────────┘    └──────────────────────┘
                    │                             │
                    │                             │
              [USER EDITS]                  [USER EDITS]
                    │                             │
                    ▼                             ▼
         ┌──────────────────┐          ┌──────────────────┐
         │handleLeftPanel   │          │handleBulkEdit    │
         │Change()          │          │deleteLines()     │
         │                  │          │duplicateLines()  │
         │ - Set new text   │          │LineEditor.onChange│
         └────────┬─────────┘          └────────┬─────────┘
                  │                             │
                  ▼                             │
        ┌─────────────────────┐                │
        │ debouncedParse()    │                │
        │ (300ms debounce)    │                │
        │                     │                │
        │ Sends to /api/parse │                │
        └──────────┬──────────┘                │
                   │                           │
                   ▼                           │
        ┌──────────────────────┐               │
        │ Receives parsed      │               │
        │ lyrics array         │               │
        └──────────┬───────────┘               │
                   │                           │
                   └─────────┬─────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  setSong({       │
                    │    rawText: ..., │
                    │    lyrics: [...]│
                    │  })              │
                    └──────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
         ┌─────────────────┐    ┌────────────────────┐
         │ Update song     │    │ Update song        │
         │ state in props  │    │ state in props     │
         │                 │    │                    │
         │ Triggers re-    │    │ Triggers re-render │
         │ render of       │    │ of RIGHT panel     │
         │ LEFT panel      │    │ only               │
         └─────────────────┘    └────────────────────┘
```

---

## State Management Flow

```
SONG STATE (global/parent)
│
├─ rawText: string                    ← Single source for LEFT panel
│  (never regenerated, never modified except by left panel edits)
│
├─ lyrics: Array<{                    ← Derived from rawText parsing
│    content: string
│    section: { type, number }
│    voice: { id, display }
│    ...
│  }>
│
├─ title: string
└─ other metadata...

LOCAL UI STATE (component only)
├─ selectedLines: Set<index>          ← Which lines are selected
├─ syncScroll: boolean                ← Scroll sync toggle
├─ contextMenu: {x, y, actions}       ← Right-click menu
├─ parseError: string                 ← Error message from parser
└─ isParsingDebounced: boolean        ← "Parsing..." indicator
```

---

## Data Flow: When User Edits Left Panel

```
1. User types in left textarea
   ↓
2. onChange event fires
   ↓
3. handleLeftPanelChange() called
   │
   └─ const newText = e.target.value
      └─ debouncedParse(newText)
   ↓
4. Debounce 300ms (prevents spamming API)
   ↓
5. Call API: POST /api/parse
   │
   └─ body: { text: "..." }
   ↓
6. Parse API response
   │
   └─ Extract: { lines: [...] }
   ↓
7. setSong(prev => ({
      ...prev,
      rawText: text,          ← Keep exact user input
      lyrics: data.lines      ← Parsed structure
   }))
   ↓
8. Component re-renders:
   
   LEFT panel:
   └─ Reads song.rawText
      └─ Shows user's exact input
      └─ Highlights "Parsing..." indicator during debounce
      
   RIGHT panel:
   └─ Reads song.lyrics
      └─ Shows newly parsed lines with sections/voices
      └─ Automatically updates without user action
   
   ✅ Both panels now synchronized
```

---

## Data Flow: When User Edits Right Panel

```
1. User clicks line in right panel
   ↓
2. LineEditor component renders
   ↓
3. User changes:
   - Voice dropdown
   - Section type dropdown
   - Content text
   ↓
4. LineEditor.onChange() fires
   │
   └─ Passes updated line object
   ↓
5. LyricsEditor's onChange handler:
   
   setSong(prev => {
      const updatedLyrics = 
        (prev.lyrics || []).map((l, idx) => 
          idx === lineIndex ? updated : l
        );
      
      return {
         ...prev,
         lyrics: updatedLyrics
         // NOTE: rawText is NOT modified
      };
   })
   ↓
6. Component re-renders:
   
   RIGHT panel:
   └─ Shows updated line with new voice/section
      └─ Immediate visual feedback
   
   LEFT panel:
   └─ Reads song.rawText
      └─ Shows ORIGINAL text (unchanged)
      └─ ✅ This is correct and intended
   
   💡 Why? Because right panel is an editing interface
      User can adjust the structured data without
      losing the original raw lyrics
```

---

## Data Flow: When User Deletes Lines

```
1. User selects lines in right panel
   ↓
2. Right-click → Delete
   ↓
3. deleteSelectedLines() called:
   
   setSong(prev => {
      const updatedLyrics = 
        (prev.lyrics || []).filter((_, i) => 
          !selectedLines.has(i)
        );
      
      return {
         ...prev,
         lyrics: updatedLyrics
         // rawText NOT modified
      };
   })
   ↓
4. Component re-renders:
   
   RIGHT panel:
   └─ Lines disappear from list
   
   LEFT panel:
   └─ Still shows original text
      └─ User can re-edit left to sync
   
   ✅ This is correct design
   
   NOTE: If user edits left panel after deleting,
         it will re-parse and update right panel
         keeping them synchronized
```

---

## Comparison: Before vs After

### BEFORE (Broken)

```
Edit Left → Parse → Set rawText AND regenerate lyrics
Edit Right → Regenerate rawText → Set lyrics AND rawText
Delete → Regenerate rawText → Set lyrics AND rawText

Problem: regenerateRawText() always fails on edge cases
Result: Circular dependency, data drift, crashes
```

### AFTER (Optimal)

```
Edit Left → Parse → Set rawText AND parsed lyrics (one-way)
Edit Right → Update lyrics ONLY (no rawText change)
Delete → Update lyrics ONLY (no rawText change)

Benefit: No regeneration needed, simple flow, no drift
Result: Stable, debuggable, maintainable
```

---

## Key Architectural Principles

### 1. Single Responsibility
```javascript
debouncedParse()
├─ ONLY called when left panel changes
└─ ONLY updates rawText from user input

handleBulkEdit()
├─ ONLY updates lyrics array
└─ NEVER touches rawText

deleteSelectedLines()
├─ ONLY removes from lyrics
└─ NEVER touches rawText
```

### 2. No Circular Dependencies
```javascript
// ❌ Bad (old code)
Edit Left → Update rawText → Regenerate lyrics → Update rawText
                                              ↑
                                         Circular!

// ✅ Good (new code)
Edit Left → Update rawText → Parse → Update lyrics
                                    ↓ One-way only
                             Edit Right → Update lyrics
                                        (rawText unaffected)
```

### 3. Asymmetric Panels = Feature, Not Bug
```javascript
// Left Panel = Source
// - Shows original lyrics
// - Preserved formatting
// - Re-parsing triggers right panel update

// Right Panel = Editing Interface  
// - Shows structured data
// - Easy to modify
// - Edits don't affect left

// Why both?
// Because they serve different purposes:
// Left = What the user originally provided
// Right = What the AI parsed/structured
// User can now fine-tune the AI result
```

---

## Scalability for Future Features

### Auto-Generation

Current one-way flow makes this trivial:

```javascript
const handleRegenerateFromAI = async (model) => {
  const res = await fetch(`/api/parse?model=${model}`, {
    method: 'POST',
    body: JSON.stringify({ text: song.rawText })
  });
  const data = await res.json();
  setSong(prev => ({
    ...prev,
    lyrics: data.lines  // Replace parsed result
  }));
};
```

### Undo/Redo

One-way flow makes history tracking simple:

```javascript
const [history, setHistory] = useState([]);

const saveToHistory = (newSong) => {
  setHistory(prev => [...prev, newSong]);
};

const undo = () => {
  setSong(history[history.length - 2]);
};
```

### Export

rawText is the export format:

```javascript
const handleExport = () => {
  const text = song.rawText;  // Original lyrics
  downloadFile(text, 'lyrics.txt');
};
```

---

## Conclusion

The new architecture is:
- ✅ **Simple**: One-way data flow
- ✅ **Correct**: No circular dependencies
- ✅ **Robust**: rawText never regenerated
- ✅ **Scalable**: Easy to add features
- ✅ **Maintainable**: Clear separation of concerns
- ✅ **Performant**: No wasted computation

This is production-grade architecture.
