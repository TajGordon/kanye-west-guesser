# Implementation Plan: Song Naming, Header Parsing & Voice Assignment

## Overview
This plan addresses four interconnected features:
1. **Song Naming** - Save songs with their actual title, not "new-song.json"
2. **Enhanced Header Parsing** - Support headers with artist names like "[Verse: Kanye West]"
3. **Section Labeling** - Create unique labels for duplicate sections based on artists
4. **Voice Auto-Assignment** - Extract artist names from headers and populate voice field

---

## Issue 1: Song Naming (Save with correct filename)

### Current Problem
- All songs save as `new-song.json` regardless of title
- User changes title in MetadataEditor but filename doesn't update
- No way to distinguish between multiple songs being edited

### Root Cause
- `App.jsx` line 77: `setSongName('new-song')` hardcoded
- `handleSaveSong()` uses `songName` variable which defaults to 'new-song'
- No automatic update of `songName` when `song.title` changes

### Solution

#### Client-Side (App.jsx)
```javascript
// Change 1: Auto-update filename when title changes
useEffect(() => {
  if (song?.title && song.title !== 'New Song') {
    // Convert title to safe filename: "Paranoid (CDQ)" → "paranoid-cdq"
    const filename = song.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')  // Remove special chars except dash
      .replace(/\s+/g, '-')       // Spaces to dashes
      .replace(/-+/g, '-')        // Multiple dashes to single
      .trim();
    
    if (filename && filename !== songName) {
      setSongName(filename);
      console.log(`[App] Title changed, filename updated to: ${filename}`);
    }
  }
}, [song?.title, songName]);

// Change 2: Update new song handler
const handleNewSong = useCallback(() => {
  const newSong = {
    title: 'New Song',
    artist: 'Kanye West',
    release: {
      formats: ['single'],
      status: 'official',
      project: '',
      year: new Date().getFullYear()
    },
    lyrics: []
  };
  setSong(newSong);
  setSongName('new-song');  // Keep default until user changes title
}, []);

// Change 3: Manual filename override in UI (optional)
// Add input field so user can override auto-generated filename
const [manualFilename, setManualFilename] = useState('');

// In header actions:
{song && (
  <>
    <input
      type="text"
      placeholder="Custom filename..."
      value={manualFilename}
      onChange={(e) => setManualFilename(e.target.value)}
      className="filename-input"
    />
    <button onClick={() => {
      const name = manualFilename || songName;
      setSongName(name);
    }}>
      Set Filename
    </button>
  </>
)}
```

#### Server-Side (server.js)
```javascript
// Change: Sanitize filename to prevent path traversal
app.post('/api/songs/:name', (req, res) => {
  try {
    // Sanitize filename
    const sanitized = req.params.name
      .replace(/[^\w-]/g, '')  // Only alphanumeric, dash
      .trim();
    
    if (!sanitized) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(LYRICS_DIR, `${sanitized}.json`);
    // ... rest of save logic
```

---

## Issue 2: Enhanced Header Parsing (With Artist Names)

### Current Problem
Headers like `[Verse: Kanye West]` or `[Chorus: Kid Cudi, Travis Scott]` fail to parse
- Regex requires a number: `\s+(\d+)`
- Headers without explicit numbers aren't recognized
- Artists in headers are extracted but not used for section labeling

### Examples to Support
```
[Intro: Kanye West]              → type: intro, number: 1, voice: Kanye West
[Verse: Kanye West]              → type: verse, number: ?, voice: Kanye West
[Verse: Kid Cudi]                → type: verse, number: ?, voice: Kid Cudi
[Chorus]                         → type: chorus, number: ?, voice: None
[Chorus: Kid Cudi, Travis Scott] → type: chorus, number: ?, voice: multiple
[Pre-Chorus: Kanye West]         → type: pre-chorus, number: ?, voice: Kanye West
```

### Root Cause
- Current regex requires digit after type
- No auto-numbering for sections without explicit numbers
- No deduplication logic for identical sections with different artists

### Solution

#### Create Header Parser Enhancement (server.js)

```javascript
/**
 * Enhanced section parser supporting multiple header formats
 */
const parseSection = (headerLine, previousSections = []) => {
  // Known valid types
  const validTypes = ['verse', 'chorus', 'pre-chorus', 'bridge', 'intro', 'outro', 'interlude', 'break'];
  
  // Try format 1: [Type Number: Artists] (existing)
  const squareMatch = headerLine.match(/^\[([a-z](?:[a-z\s-]*[a-z])?)\s+(\d+)\s*(?:[-:](.+))?\]$/i);
  if (squareMatch) {
    const [, typeStr, num, extra] = squareMatch;
    let type = normalizeType(typeStr);
    if (validTypes.includes(type)) {
      return {
        type,
        number: parseInt(num) || 1,
        originalText: headerLine,
        artists: parseArtists(extra)
      };
    }
  }
  
  // Try format 2: [Type: Artists] (NEW - no number, infer from previous)
  const namedMatch = headerLine.match(/^\[([a-z](?:[a-z\s-]*[a-z])?)(?::\s*(.+))?\]$/i);
  if (namedMatch) {
    const [, typeStr, extra] = namedMatch;
    let type = normalizeType(typeStr);
    
    if (validTypes.includes(type)) {
      // Auto-number: count how many sections of this type exist
      const sameTypeSections = previousSections.filter(s => s.type === type);
      const nextNumber = sameTypeSections.length + 1;
      
      return {
        type,
        number: nextNumber,
        originalText: headerLine,
        artists: parseArtists(extra),
        autoNumbered: true  // Flag to indicate auto-number
      };
    }
  }
  
  // Try format 3: Type: Artists (no brackets, rare)
  const colonMatch = headerLine.match(/^([a-z](?:[a-z\s-]*[a-z])?)(?::\s*(.+))?$/i);
  if (colonMatch && (headerLine.includes(':') || !headerLine.includes('['))) {
    const [, typeStr, extra] = colonMatch;
    let type = normalizeType(typeStr);
    
    if (validTypes.includes(type)) {
      const sameTypeSections = previousSections.filter(s => s.type === type);
      const nextNumber = sameTypeSections.length + 1;
      
      return {
        type,
        number: nextNumber,
        originalText: headerLine,
        artists: parseArtists(extra),
        autoNumbered: true
      };
    }
  }
  
  return null;
};

// Helper: Normalize type string
function normalizeType(typeStr) {
  return typeStr
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/prechorus/, 'pre-chorus');
}

// Helper: Extract and parse artist names
function parseArtists(artistString) {
  if (!artistString) return [];
  
  // Split by comma or ampersand, clean up
  const artists = artistString
    .split(/[,&]+/)
    .map(a => a.trim())
    .filter(a => a.length > 0);
  
  return artists;
}
```

#### Update Parser Loop (server.js)

```javascript
// In parseSection loop, track previousSections
const parsed = [];
let currentSection = { type: 'verse', number: 1, originalText: '[Verse 1]' };
const collectedSections = [];  // ← NEW: Track for auto-numbering

for (const line of lines) {
  if (line.trim() === '') {
    allLines.push({ type: 'blank', content: '' });
    continue;
  }

  // Try to detect section headers
  const sectionMatch = parseSection(line, collectedSections);  // ← PASS previousSections
  
  if (sectionMatch) {
    currentSection = sectionMatch;
    collectedSections.push(sectionMatch);  // ← TRACK for next iteration
    
    // ... rest of logic
  }
}
```

---

## Issue 3: Section Labeling (Unique Labels for Duplicates)

### Current Problem
- Two identical chorus sections with same artists get saved identically
- No way to distinguish them in the UI
- Can't tell if it's a repeat or different version

### Examples
```json
[
  { "type": "verse", "number": 1, "artists": ["Kanye West"] },
  { "type": "verse", "number": 2, "artists": ["Kid Cudi"] },
  { "type": "verse", "number": 3, "artists": ["Kanye West"] }
]

// Rendered in UI as:
- Verse (Kanye West)
- Verse (Kid Cudi)
- Verse (Kanye West)  ← Can distinguish by artist!

// But if artists are same:
[
  { "type": "chorus", "number": 1, "artists": ["Kid Cudi"] },
  { "type": "chorus", "number": 2, "artists": ["Kid Cudi"] },
  { "type": "chorus", "number": 3, "artists": ["Kid Cudi"] }
]

// Still need numbers to distinguish:
- Chorus 1 (Kid Cudi)
- Chorus 2 (Kid Cudi)
- Chorus 3 (Kid Cudi)
```

### Solution

#### Create Section Label Generator (server.js)

```javascript
/**
 * Generate display labels for sections
 * Combines type, number, and artist info
 */
function generateSectionLabel(section) {
  const typeLabel = section.type.charAt(0).toUpperCase() + section.type.slice(1);
  
  // Build artist part
  const artistPart = section.artists && section.artists.length > 0
    ? ` (${section.artists.join(', ')})`
    : '';
  
  // Include number for clarity
  const numberPart = section.number > 1 ? ` ${section.number}` : '';
  
  return `${typeLabel}${numberPart}${artistPart}`;
}

// Example outputs:
// { type: 'verse', number: 1, artists: ['Kanye West'] } 
//   → "Verse (Kanye West)"
//
// { type: 'verse', number: 2, artists: ['Kid Cudi'] }
//   → "Verse 2 (Kid Cudi)"
//
// { type: 'chorus', number: 1, artists: [] }
//   → "Chorus"
//
// { type: 'pre-chorus', number: 1, artists: ['Kanye West'] }
//   → "Pre-Chorus (Kanye West)"
```

#### Store in JSON

```javascript
// When saving, add displayLabel to each section
data.lyrics.forEach((line) => {
  if (line.section) {
    line.section.label = generateSectionLabel(line.section);
  }
});
```

---

## Issue 4: Voice Auto-Assignment from Headers

### Current Problem
- Artists extracted from headers but not used to populate voice field
- Voice field remains empty even when artist name is in header
- User must manually set voices

### Solution

#### During Parsing (server.js)

```javascript
// In the line parsing loop, use section artists for voice
const parseSection = (headerLine, previousSections = []) => {
  // ... parse section ...
  return {
    type,
    number,
    originalText: headerLine,
    artists: parseArtists(extra),
    primaryArtist: parseArtists(extra)?.[0] || null  // ← First artist as primary
  };
};

// When creating lyrics lines
for (const line of lines) {
  // ... skip blank, detect header ...
  
  if (sectionMatch) {
    currentSection = sectionMatch;
  } else if (!line.trim().startsWith('[')) {
    // It's a lyric line
    
    // Auto-assign voice from section's primary artist
    const voice = currentSection.primaryArtist 
      ? {
          id: sanitizeVoiceId(currentSection.primaryArtist),
          display: currentSection.primaryArtist
        }
      : { id: '', display: '' };
    
    allLines.push({
      line_number: lineNum++,
      content: line,
      section: {
        type: currentSection.type,
        number: currentSection.number,
        artists: currentSection.artists,
        label: generateSectionLabel(currentSection)
      },
      voice,
      meta: { blank: false }
    });
  }
}

// Helper: Convert artist name to voice ID
function sanitizeVoiceId(artistName) {
  const map = {
    'Kanye West': 'kanye-west',
    'Ty Dolla $ign': 'ty-dolla-sign',
    'Pusha T': 'pusha-t',
    'Kid Cudi': 'kid-cudi',
    'Mr Hudson': 'mr-hudson',
    'Travis Scott': 'travis-scott',
    'Young Thug': 'young-thug'
  };
  
  return map[artistName] || artistName.toLowerCase().replace(/\s+/g, '-');
}
```

---

## Implementation Order

1. **Phase 1: Song Naming** (1-2 hours)
   - [ ] Add auto-filename generation in App.jsx
   - [ ] Add filename sanitization in server.js
   - [ ] Test with different song titles

2. **Phase 2: Enhanced Header Parsing** (2-3 hours)
   - [ ] Implement namedMatch regex in parseSection
   - [ ] Add auto-numbering logic
   - [ ] Add parseArtists helper
   - [ ] Update parser loop to track previousSections
   - [ ] Test with headers like "[Verse: Kanye West]"

3. **Phase 3: Section Labeling** (1 hour)
   - [ ] Add generateSectionLabel function
   - [ ] Store label in JSON during parse
   - [ ] Display in UI (show in section headers)

4. **Phase 4: Voice Auto-Assignment** (1-2 hours)
   - [ ] Add primaryArtist to section parsing
   - [ ] Create sanitizeVoiceId helper
   - [ ] Auto-populate voice during line creation
   - [ ] Test that voices are correctly assigned

---

## Testing Scenarios

### Test 1: Song Naming
```
1. Create new song
2. Change title to "Paranoid (CDQ)"
3. Save
4. Verify filename is "paranoid-cdq.json"
```

### Test 2: Header Parsing Without Numbers
```
Input raw text:
[Verse: Kanye West]
First verse line

[Verse: Kid Cudi]
Second verse line

Expected:
- verse-1 (Kanye West)
- verse-2 (Kid Cudi)
```

### Test 3: Artist-Based Labeling
```
Input:
[Chorus: Kid Cudi]
Chorus line 1

[Chorus: Kid Cudi]
Chorus line 2 (same artist, different content)

Expected:
- chorus-1 (Kid Cudi)
- chorus-2 (Kid Cudi)  ← Still numbered to distinguish
```

### Test 4: Voice Auto-Assignment
```
Input:
[Verse: Kanye West]
Some lyrics

Expected in voice field:
- ID: kanye-west
- Display: Kanye West
```

---

## Edge Cases to Handle

1. **Unknown artists in headers**
   - Not in predefined voice list
   - Solution: Store as-is, allow user to edit

2. **Multiple artists in one header**
   - `[Verse: Kanye West, Kid Cudi]`
   - Solution: Store all in `artists` array, use first as `primaryArtist`

3. **Mixed formats**
   - Some headers have numbers, some don't
   - Solution: Auto-number only those without explicit numbers

4. **Case sensitivity**
   - `[VERSE: KANYE WEST]` vs `[Verse: Kanye West]`
   - Solution: Normalize to lowercase for type, preserve case for artist names

5. **Identical sections with same artist appearing twice**
   - Can't rely on content/artist combo for uniqueness
   - Solution: Always number all sections sequentially
