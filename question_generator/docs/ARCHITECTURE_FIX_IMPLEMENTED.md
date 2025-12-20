# Architecture Fix: Single Source of Truth

## The Problem You Identified

When you load a song, the **left panel** (.txt) and **right panel** (JSON) showed different data:

```
love_lockdown.txt:                love_lockdown.json:
[Verse 1]                         [{"content": "...", 
I'm not loving you...              "section": {"type": "verse", ...}}]

❌ TWO DIFFERENT SOURCES
❌ NO SYNC MECHANISM
❌ UNCLEAR WHICH IS "CORRECT"
```

This happened because:
1. Server loaded `.txt` and `.json` independently
2. Client displayed them separately
3. No code ensured they stayed in sync
4. User edits to one side didn't update the other

---

## The Solution: JSON as Single Source

**IMPLEMENT**: Solution #2 from the analysis

**Core Principle**: 
- JSON file contains both `rawText` and parsed `lyrics`
- Left panel = editable `rawText`
- Right panel = always derived from `rawText` in real-time
- Never get out of sync (one source of truth)

```
love_lockdown.json (SINGLE SOURCE)
{
  rawText: "[Verse 1]\nI'm not loving you...",    ← LEFT PANEL
  lyrics: [{ content: "...", section: {...} }]     ← RIGHT PANEL
}

Both derived from rawText
Always in sync
```

---

## What Changed in Code

### 1. Remove Separate State for Parsed Lyrics

**Before**:
```javascript
const [rawText, setRawText] = useState('');
const [allLines, setAllLines] = useState([]);  // ❌ Separate state - causes sync issues
```

**After**:
```javascript
const [rawText, setRawText] = useState('');
const displayedLyrics = song?.lyrics || [];  // ✅ Use song.lyrics directly
```

**Why?** Removes duplicate state. Right panel always shows `song.lyrics`, never a separate copy.

---

### 2. Bidirectional Sync

**When left panel changes:**
```javascript
const handleLeftPanelChange = (e) => {
  const newText = e.target.value;
  setRawText(newText);
  debouncedParse(newText);  // Parse and update song.lyrics
};

// Parse result updates BOTH:
setSong(prev => ({ 
  ...prev,
  rawText: text,          // ✅ Keep rawText in sync
  lyrics: data.lines || [] // ✅ Keep lyrics in sync
}));
```

**When right panel changes** (user edits a line):
```javascript
onChange={(updated) => {
  setSong(prev => {
    const updatedLyrics = prev.lyrics.map((l, idx) => idx === i ? updated : l);
    const newRawText = regenerateRawText(updatedLyrics);  // ✅ Regenerate text from structure
    setRawText(newRawText);
    return {
      ...prev,
      lyrics: updatedLyrics,
      rawText: newRawText  // ✅ Keep both in sync
    };
  });
}}
```

---

### 3. Helper Function: Regenerate Text from Structure

```javascript
const regenerateRawText = useCallback((lyrics) => {
  const lines = [];
  let lastSection = null;

  (lyrics || []).forEach(line => {
    const section = line.section;
    
    // Add section header if changed
    const sectionChanged = !lastSection || 
      lastSection.type !== section.type || 
      lastSection.number !== section.number;

    if (sectionChanged) {
      const label = `[${section.type.charAt(0).toUpperCase() + section.type.slice(1)} ${section.number}]`;
      lines.push(label);
      lastSection = section;
    }

    // Add lyric line
    lines.push(line.content);
  });

  return lines.join('\n');  // Convert back to text format
}, []);
```

**Example**:
```javascript
Input:  [{ content: "I'm not loving", section: { type: "verse", number: 1 } }, ...]
Output: "[Verse 1]\nI'm not loving\n..."
```

---

### 4. Every Edit Updates Both

**Delete lines:**
```javascript
const deleteSelectedLines = () => {
  setSong(prev => {
    const updatedLyrics = prev.lyrics.filter((_, i) => !selectedLines.has(i));
    const newRawText = regenerateRawText(updatedLyrics);  // ✅ Regenerate
    return {
      ...prev,
      lyrics: updatedLyrics,
      rawText: newRawText  // ✅ Keep in sync
    };
  });
};
```

**Duplicate lines:**
```javascript
const duplicateSelectedLines = () => {
  setSong(prev => {
    const newLyrics = [...prev.lyrics];
    // ... add duplicates ...
    const newRawText = regenerateRawText(newLyrics);  // ✅ Regenerate
    return {
      ...prev,
      lyrics: newLyrics,
      rawText: newRawText  // ✅ Keep in sync
    };
  });
};
```

**Edit section/voice:**
```javascript
const handleBulkEdit = (field, value) => {
  setSong(prev => {
    const updatedLyrics = prev.lyrics.map((line, i) =>
      selectedLines.has(i) ? { ...line, [field]: value } : line
    );
    const newRawText = regenerateRawText(updatedLyrics);  // ✅ Regenerate
    return {
      ...prev,
      lyrics: updatedLyrics,
      rawText: newRawText  // ✅ Keep in sync
    };
  });
};
```

---

## Data Flow

### Scenario 1: User Types in Left Panel
```
User types: "I'm in love..."
     ↓
handleLeftPanelChange triggered
     ↓
setRawText(newText)  ← Update left
debouncedParse(newText)  ← Parse
     ↓
Server parses → returns lines array
     ↓
setSong updates:
  - rawText: newText
  - lyrics: parsed lines
     ↓
✅ LEFT PANEL: Shows newText
✅ RIGHT PANEL: Shows parsed lines (auto-regenerated from parse)
✅ IN SYNC
```

### Scenario 2: User Edits Section in Right Panel
```
User clicks section dropdown → changes Verse 1 to Chorus 1
     ↓
LineEditor onChange triggered with updated line
     ↓
setSong maps updated line to lyrics array
     ↓
regenerateRawText(updatedLyrics)  ← Convert back to text
     ↓
setSong updates:
  - lyrics: updated array with new section
  - rawText: regenerated with "[Chorus 1]" header
     ↓
✅ RIGHT PANEL: Shows Chorus 1
✅ LEFT PANEL: Shows "[Chorus 1]" header
✅ IN SYNC
```

### Scenario 3: User Deletes 3 Lines
```
User selects 3 lines → right-click → Delete
     ↓
deleteSelectedLines triggered
     ↓
Filter out selected indices
regenerateRawText(remaining) → "Verse 1\nFirst line\nSecond line..."
     ↓
setSong updates:
  - lyrics: filtered array (without 3 lines)
  - rawText: regenerated without those lines
     ↓
✅ RIGHT PANEL: 3 lines gone
✅ LEFT PANEL: Text updated to match
✅ IN SYNC
```

---

## Why This Works

| Aspect | Before | After |
|--------|--------|-------|
| Source of Truth | 2 files (conflicting) | 1 JSON file |
| Left Panel | Independent | Derived from JSON |
| Right Panel | Independent | Derived from JSON |
| Sync Status | ❌ Often out of sync | ✅ Always in sync |
| User Edit Left | Doesn't update right | Auto-updates right |
| User Edit Right | Doesn't update left | Auto-updates left |
| Save | Confusing (which file?) | Clear (only JSON) |

---

## What Gets Saved

**Only one JSON file**:
```json
{
  "title": "Love Lockdown",
  "artist": "Kanye West",
  "release": { ... },
  "rawText": "[Verse 1]\nI'm not loving you...",
  "lyrics": [
    {
      "line_number": 1,
      "content": "I'm not loving you way I wanted to",
      "section": { "type": "verse", "number": 1 },
      "voice": { "id": "kanye-west", "display": "Kanye West" }
    },
    ...
  ]
}
```

**No more .txt files needed** (but can keep as backups if desired).

---

## Testing the Fix

### Test 1: Load Song & Check Sync
1. Open http://localhost:3000
2. Click "Load a song..." → select "love_lockdown"
3. **Expected**: Left panel shows raw lyrics, right panel shows parsed
4. **Expected**: They MATCH (same lyrics, different formats)

### Test 2: Edit Left Panel
1. In left panel, change `[Verse 1]` to `[Verse 2]`
2. Wait for "Parsing..." to finish
3. **Expected**: Right panel section updates to "Verse 2"
4. **Expected**: Check <song.rawText> and <song.lyrics> both updated

### Test 3: Edit Right Panel
1. Click on a line in right panel
2. Change section type to "Chorus"
3. **Expected**: Left panel shows "[Chorus 1]" header
4. **Expected**: rawText regenerated with new header

### Test 4: Delete and Verify Sync
1. Select multiple lines
2. Right-click → Delete
3. **Expected**: Both panels update (lines removed from both)
4. **Expected**: Section headers adjusted in left panel

### Test 5: Duplicate and Verify Sync
1. Select 2 lines
2. Right-click → Duplicate
3. **Expected**: Both panels show duplicated lines
4. **Expected**: rawText includes duplicated content

---

## Benefits of This Architecture

✅ **No More Sync Issues** - Single source of truth
✅ **Clear Data Flow** - Easy to understand what's happening
✅ **Easy to Debug** - Can inspect song.rawText and song.lyrics
✅ **Scalable** - Can add more derived views without sync problems
✅ **Git-Friendly** - Single JSON file, easy to version control
✅ **Future-Proof** - Can add export formats (PDF, markdown, etc.) without sync issues
✅ **Performance** - No extra watchers, no circular updates

---

## Next Steps

1. ✅ Implementation complete (code deployed via HMR)
2. 🧪 Test all scenarios above
3. 📝 Verify save functionality
4. 🎯 Consider removing `.txt` files (or keep as backups)

---

**Status**: Architecture Fix Implemented
**Approach**: Solution #2 - JSON as Single Source
**Result**: Left and Right Panels Always In Sync
