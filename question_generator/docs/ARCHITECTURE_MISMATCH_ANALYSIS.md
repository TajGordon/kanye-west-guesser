# Architecture Analysis: Load vs Parse Data Flow Mismatch

## The Problem

User reports:
1. **Load song works**: Colors correct, format correct, no blank lines
2. **Parse/paste doesn't work**: Blank lines appear, colors might be off
3. **Structured view shows gray verses** (should be blue)

## Root Cause Analysis

### The Two Data Paths

#### PATH 1: Load Song (WORKS ✓)
```
User clicks dropdown → Select "love_lockdown"
       ↓
GET /api/songs/love_lockdown
       ↓
Server:
  1. Loads love_lockdown.json from disk
  2. Data has: lyrics[] with proper formatting
  3. No blank line entries (they're never stored)
  4. normalizeSectionFormat() applied
  5. validateSectionFormat() applied
  6. Return full song object: {
       title, artist, release, lyrics: [...]
     }
       ↓
Frontend:
  App.jsx receives: data (full song object)
  Sets: setSong(data)
  data.lyrics is stored as-is
       ↓
LyricsEditor renders:
  groupLinesBySection() receives clean lyrics[]
  Filters out blank lines in display (not in data)
  Colors applied correctly
  Result: ✓ CLEAN DISPLAY
```

#### PATH 2: Parse/Paste (BROKEN ✗)
```
User pastes raw text with headers → Click "Re-process Raw Text"
       ↓
POST /api/parse (with raw text)
       ↓
Server:
  1. parseSection() detects headers → creates section objects
  2. For each lyric line: creates line object with section
  3. Does NOT filter blank lines at server level
     (Could be intentional - wants to preserve structure)
  4. Returns: {
       lines: [...],    ← PARSED LINES (may include blanks!)
       allLines: [...]  ← ALL LINES (headers + lyrics + blanks)
     }
       ↓
Frontend LyricsEditor.jsx:
  const handleReprocessRawText = async (e) => {
    ...
    setSong(prev => ({
      ...prev,
      lyrics: data.lines || []  ← DIRECTLY SETS parsed lines
    }));
  
  Problem: data.lines might contain blank line entries!
           (Blank lines were parsed as lyric lines)
       ↓
groupLinesBySection():
  Receives lyrics[] with blank line entries
  Creates groups with those entries
  Displays them in structured view
  Result: ✗ BLANK LINES VISIBLE
```

### Why Blank Lines Appear in Parse but Not Load

**In Load path**: 
- JSON file never had blank line entries (they're not lyrics)
- Data from server is already clean
- `groupLinesBySection()` filters blanks in display only

**In Parse path**:
- Raw text parser treats empty lines as content
- Blank line becomes: `{ content: "", section: {...}, ... }`
- These get stored in `song.lyrics`
- `groupLinesBySection()` can't filter what's in the data
- Result: Blank lines visible in structured view

### Why Verse Colors Are Gray in Structured View

The right panel uses `getLineColor()` function. Let me check this:

```javascript
// In LyricsEditor.jsx
const getLineColor = (section) => {
  if (colorMode === 'artist') {
    // Uses ARTIST_COLORS
    return ARTIST_COLORS[section?.voice?.id] || '#888888';
  } else {
    // Uses section type colors
    // BUT: Where are these colors defined?
    // Look for section-based color mapping...
  }
}
```

The issue is likely:
- Section color mode doesn't have a proper color map
- Defaulting to gray (#888888)
- Raw text view works because RawTextEditor has `SECTION_TYPE_COLORS`
- But LyricsEditor doesn't have the same mapping for the right panel

## The Fix Needed

### Problem 1: Parse Endpoint Returns Blank Lines
**Solution**: Filter blank lines before returning from parse endpoint

**Current Code**:
```javascript
// In POST /api/parse
const parsed = [];
lines.forEach(line => {
  const section = parseSection(line);
  if (section) {
    // ... handle header
    continue;
  }
  
  // Problem: Adds ALL lines, including blank ones
  parsed.push({
    line_number: ++lineNum,
    content: line,    ← Could be ""
    section: { ...currentSection },
    ...
  });
});

return { lines: normalizedLines };
```

**Fixed Code**:
```javascript
parsed.push({
  line_number: ++lineNum,
  content: line.trim(),  ← Trim whitespace
  section: { ...currentSection },
  ...
});

// OR better: Skip blank lines entirely
if (line.trim()) {  ← Add this check
  parsed.push({...});
}
```

### Problem 2: Verse Colors Are Gray
The LyricsEditor needs the same `SECTION_TYPE_COLORS` that RawTextEditor has.

**Current Code**:
```javascript
const ARTIST_COLORS = {
  'kanye-west': '#5eb3ff',      // Blue
  'tyler-the-creator': '#ff5252', // Red
  // ... etc
};

// In groupLinesBySection():
const getLineColor = (section) => {
  if (colorMode === 'artist') {
    return ARTIST_COLORS[...];
  } else {
    // No section colors defined!
    return ''; // Falls back to default
  }
}
```

**Fixed Code**:
```javascript
const SECTION_TYPE_COLORS = {
  'verse': '#5eb3ff',
  'chorus': '#ffb74d',
  'bridge': '#52ffb8',
  // ... etc (same as RawTextEditor)
};

const getLineColor = (section) => {
  if (colorMode === 'artist') {
    return ARTIST_COLORS[section?.voice?.id] || '#888888';
  } else {
    // Use section type colors
    return SECTION_TYPE_COLORS[section?.type] || '#888888';
  }
}
```

## Data Flow Fix Summary

### Before (Broken)
```
LOAD:   Clean data → Clean display ✓
PARSE:  Messy data → Messy display ✗
```

### After (Fixed)
```
LOAD:   Clean data → Clean display ✓
PARSE:  Messy data → CLEANED → Clean display ✓
```

## Implementation Checklist

- [ ] Filter blank lines in POST /api/parse endpoint
- [ ] Add SECTION_TYPE_COLORS to LyricsEditor.jsx
- [ ] Update getLineColor() to use SECTION_TYPE_COLORS for section mode
- [ ] Test paste flow produces clean data
- [ ] Test colors match between raw and structured views
- [ ] Update documentation in docs/ folder

---

## Why This Matters

The current architecture has a critical flaw: it treats data from different sources differently.

- **GET endpoint** returns data from disk (already clean)
- **Parse endpoint** returns freshly parsed data (contains artifacts)

The frontend assumes all incoming `lyrics` data is clean, but that's only true for one endpoint.

### Solution Principle: Normalize at Source
Don't expect the frontend to fix server-side parsing issues. The server should return clean data regardless of source.

**Good Architecture**:
```
Server: Always return clean, validated data
Frontend: Trust the data is clean
```

**Bad Architecture**:
```
Server: Return whatever (maybe clean, maybe not)
Frontend: Try to clean data in display layer
```

The current system falls into the bad category for the parse endpoint.
