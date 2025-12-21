# Section.Type Data Flow Diagram

## Current Problem

```
love_lockdown.json (STORAGE)
│
└─ "type": "verse-1"  ← WRONG FORMAT (old data)
   "number": 1
│
└─ HTTP GET /api/songs/love_lockdown
   │
   └─ Returns as-is: { type: "verse-1", number: 1 }
      │
      ├─→ App.jsx: setSong(data)
      │   │
      │   └─→ LyricsEditor receives data with type="verse-1"
      │       │
      │       ├─ buildDisplayText() tries to format:
      │       │  │ section.type = "verse-1"
      │       │  │ section.number = 1
      │       │  │
      │       │  └─ Result: "[Verse-1 1]" ✗ WRONG (shows double number)
      │       │
      │       └─ LineEditor.jsx displays dropdown options:
      │          ❌ "verse-1" is NOT in the options
      │          ✓ Only has: "verse", "chorus", "pre-chorus", etc.
      │
      └─ Never fixes the data in memory
```

## What Should Happen

```
love_lockdown.json (STORAGE)
│
└─ "type": "verse"  ← CORRECT FORMAT (new design)
   "number": 1
│
└─ HTTP GET /api/songs/love_lockdown
   │
   └─ Returns: { type: "verse", number: 1 }
      │
      ├─→ App.jsx: setSong(data)
      │   │
      │   └─→ LyricsEditor receives correct data
      │       │
      │       ├─ buildDisplayText() formats correctly:
      │       │  │ section.type = "verse"
      │       │  │ section.number = 1
      │       │  │
      │       │  └─ Result: "[Verse 1]" ✓ CORRECT
      │       │
      │       └─ LineEditor.jsx dropdown shows:
      │          ✓ "verse" is in the options
      │          ✓ User can edit it properly
      │
      └─ Data stays correct
```

## Edit Path (How New Data Gets Created - Correctly)

```
User edits raw text in LEFT panel
│
└─→ handleLeftPanelChange() + debouncedParse()
    │
    └─→ POST /api/parse (raw text)
        │
        └─→ server.js parseSection()
            │
            ├─ Regex match: "[Verse 1]"
            │
            ├─ Extracts: type="verse", number=1
            │
            └─ Creates: { type: "verse", number: 1 } ✓ CORRECT
                │
                └─→ Returns to client
                    │
                    └─→ setSong({ ...prev, lyrics: data.lines })
                        │
                        └─→ Replaces entire array with correct format
                            │
                            └─→ All new lines have correct format ✓
```

## Save Path (What Gets Written to Disk)

```
User clicks Save button
│
└─→ App.jsx: handleSaveSong()
    │
    ├─ Reads: song.lyrics (mixed format)
    │  ├─ Lines loaded from old data: { type: "verse-1", number: 1 } ✗
    │  └─ Lines edited by user: { type: "verse", number: 1 } ✓
    │
    └─→ POST /api/songs/love_lockdown
        │
        └─→ server.js saves req.body AS-IS (no transformation)
            │
            ├─ Writes exactly what was sent
            │
            └─→ Disk now has MIXED data:
                ├─ Old lines: { type: "verse-1", number: 1 } ✗
                └─ New lines: { type: "verse", number: 1 } ✓
```

## The Problem in Sequence

### Step 1: File Loads (Bad Data Persists)
```
disk: { type: "verse-1", number: 1 }
 ↓
server.js GET returns it as-is
 ↓
memory: { type: "verse-1", number: 1 }
```

### Step 2: User Edits Line via UI (Good Data Created)
```
memory: { type: "verse-1", number: 1 }  ← Old
  ↓ [User changes via LineEditor dropdown from "verse-1" to "verse"]
  ↓
memory: { type: "verse", number: 1 }  ← New! ✓
```

### Step 3: User Parses Raw Text (Good Data Created)
```
memory: (whatever was there before)
  ↓ [User types/pastes raw text like "[Verse 1]\nLine content"]
  ↓
server.js /api/parse creates:
  { type: "verse", number: 1 }  ← Always correct! ✓
  ↓
replaces entire lyrics array
  ↓
memory: All lines now have { type: "verse", number: 1 }  ✓
```

### Step 4: File Saves (Mixed or Good)
```
memory: (depends on edit path)
  ↓
server.js POST saves AS-IS
  ↓
disk: (whatever was in memory)

If edited via UI only:
  disk might have mix of "verse-1" (old) and "verse" (new)
  
If parsed via raw text:
  disk has all "verse"  ✓
```

## Why It Looks Like It Works

The `buildDisplayText()` function is **forgiving**:
```javascript
const sectionName = formatSectionName(section.type);
// formatSectionName("verse-1") returns "Verse-1"
// Then: `[${sectionName} ${section.number}]`
// Result: "[Verse-1 1]"  ← Looks close to right, but has double number!
```

The system doesn't **crash**, but it **displays wrong** when old data is loaded.

## The Fix Needed

### Critical Issue:
`love_lockdown.json` has **all lines** with `type: "verse-1"` instead of `type: "verse"`

### Solution:
1. **On Load (Defensive)**: Normalize the data if it has old format
2. **On Disk (Permanent)**: Migrate all existing files to new format
3. **On Save (Preventive)**: Never allow new files to be saved with old format

All three together ensure complete data integrity.
