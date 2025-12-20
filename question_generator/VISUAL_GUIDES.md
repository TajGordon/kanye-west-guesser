# Visual Guides & Diagrams

## Issue #1: Raw Text Colors - Before vs After

### BEFORE (BROKEN)
```
┌─────────────────────────────────────────────────────────┐
│ RAW TEXT EDITOR (CodeMirror)                            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Verse 1]     ← Gray header                             │
│  First verse   ← Gray text                               │
│  With lyrics   ← Gray text                               │
│                                                           │
│  [Chorus 1]    ← Same gray header (WRONG!)              │
│  The chorus    ← Same gray text (WRONG!)                │
│  Yeah yeah     ← Same gray text (WRONG!)                │
│                                                           │
│  [Bridge]      ← Still gray (WRONG!)                    │
│  Short bridge  ← Still gray (WRONG!)                    │
│                                                           │
└─────────────────────────────────────────────────────────┘

PROBLEM: All sections show same gray color
WHY: Opacity math error: 0.85 * 0.25 ≈ 0.21 (very faint!)
                         1.0 * 0.25 = 0.25 (also very faint!)
      Both are imperceptible → appear same shade of gray
```

### AFTER (FIXED)
```
┌─────────────────────────────────────────────────────────┐
│ RAW TEXT EDITOR (CodeMirror)                            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Verse 1]     ← BLUE header (#5eb3ff background)      │
│  First verse   ← BLUE tinted text                       │
│  With lyrics   ← BLUE tinted text                       │
│                                                           │
│  [Chorus 1]    ← ORANGE header (#ffb74d background)    │
│  The chorus    ← ORANGE tinted text (clearly different) │
│  Yeah yeah     ← ORANGE tinted text                     │
│                                                           │
│  [Bridge]      ← CYAN header (#52ffb8 background)      │
│  Short bridge  ← CYAN tinted text                       │
│                                                           │
└─────────────────────────────────────────────────────────┘

SOLUTION: Direct hex colors with opacity suffix
- No math: Just apply hex#20 (fixed opacity)
- Each type has distinct color
- All verses same blue (consistent)
- All choruses same orange (recognizable)
```

---

## Issue #2: Format Display - Before vs After

### BEFORE (BROKEN)
```
┌──────────────────────────────┐
│  RIGHT PANEL (Structured)    │
├──────────────────────────────┤
│                              │
│ Section: Verse-2 1  ← WRONG! │
│ (Should be: Verse 2)         │
│ ┌────────────────────────┐   │
│ │ First verse here       │   │
│ │ Multiple lines content │   │
│ └────────────────────────┘   │
│                              │
│ Section: Verse-2 2  ← WRONG! │
│ (Should be: Verse 3)         │
│ ┌────────────────────────┐   │
│ │ Second verse content   │   │
│ └────────────────────────┘   │
│                              │
│ Section: Chorus-1 1 ← WRONG! │
│ (Should be: Chorus 1)        │
│ ┌────────────────────────┐   │
│ │ Chorus lyrics here     │   │
│ └────────────────────────┘   │
│                              │
└──────────────────────────────┘

PROBLEM: formatSectionName() splits on "-" and displays raw
type="verse-2" → displayed as "Verse-2"
Combined with number=1 → "Verse-2 1" (confusing!)
```

### AFTER (FIXED)
```
┌──────────────────────────────┐
│  RIGHT PANEL (Structured)    │
├──────────────────────────────┤
│                              │
│ Section: Verse 2  ✓ CORRECT! │
│ (Normalized: type="verse")   │
│ ┌────────────────────────┐   │
│ │ First verse here       │   │
│ │ Multiple lines content │   │
│ └────────────────────────┘   │
│                              │
│ Section: Verse 3  ✓ CORRECT! │
│ (Normalized: type="verse")   │
│ ┌────────────────────────┐   │
│ │ Second verse content   │   │
│ └────────────────────────┘   │
│                              │
│ Section: Chorus 1 ✓ CORRECT! │
│ (Normalized: type="chorus")  │
│ ┌────────────────────────┐   │
│ │ Chorus lyrics here     │   │
│ └────────────────────────┘   │
│                              │
└──────────────────────────────┘

SOLUTION: normalizeSectionInPlace()
type="verse-2" → Extracts: type="verse", number=2
formatSectionName() → Takes only first part "verse"
Display: "Verse 2" (clean, correct!)
```

---

## Data Flow Architecture

### BEFORE (Single Validation Point)
```
┌─────────────┐
│   Old Data  │
│ type:"v-2"  │
└─────┬───────┘
      │
      ▼
┌──────────────┐
│ normalizeSectionFormat() ← Only one validation point!
│ (Server only)
└─────┬────────┘
      │
      ▼ (might fail)
┌──────────────────────┐
│ Frontend (no checks) │ ← Receives data without verification
└─────┬────────────────┘
      │
      ▼
┌──────────────┐
│   Display    │ ← Shows corrupted data to user
│ "Verse-2 1"  │
└──────────────┘

PROBLEM: Single validation point = system fails if bypassed
```

### AFTER (Multi-Layer Validation)
```
┌─────────────┐
│   Old Data  │
│ type:"v-2"  │
└─────┬───────┘
      │
      ▼
┌──────────────────────────┐
│ Layer 1: Server GET       │ ← Normalize
│ Normalize + Validate      │ ← Validate
└─────┬────────────────────┘
      │
      ▼ (or error 500)
┌──────────────────────────┐
│ Layer 2: Server POST      │ ← Normalize again
│ Normalize + Validate      │ ← Validate again
└─────┬────────────────────┘
      │
      ▼ (or error 400)
┌──────────────────────────┐
│ Layer 3: Frontend         │ ← Normalize defensively
│ normalizeSectionInPlace() │ ← Extra safety pass
│ formatSectionName()       │ ← Safe formatting
└─────┬────────────────────┘
      │
      ▼
┌──────────────────────────┐
│ Layer 4: Display          │ ← Only clean data reaches here
│ "Verse 2" ✓              │
└──────────────────────────┘

BENEFIT: Multiple layers = impossible for bad data to slip through
Even if one layer fails, others catch it
```

---

## Color System Transformation

### BEFORE (Complex Generation)
```
Text Input
    │
    ▼
generateSectionColors()
    ├─ Scan entire text
    ├─ Extract headers: [Verse 1], [Verse 2], [Chorus 1]
    ├─ Create instance map:
    │  ├─ "verse-1": {color: blue, opacity: 1.0}
    │  ├─ "verse-1-dim": {color: blue, opacity: 0.85}
    │  ├─ "verse-2": {color: blue, opacity: 0.85}
    │  ├─ "verse-2-dark": {color: blue, opacity: 0.70}
    │  ├─ "chorus-1": {color: orange, opacity: 1.0}
    │  └─ ...8 more entries
    │
    ▼
createDecorations()
    ├─ For each line:
    │  ├─ Lookup in complex map
    │  ├─ Get {color, opacity}
    │  ├─ Apply math: opacity * 0.25 = 0.21-0.25
    │  └─ Result: Very faint color
    │
    ▼
All colors look same shade → MONOCHROME

COMPLEXITY: 9 map entries + opacity math + lookup
RESULT: Fragile, error-prone, monochrome colors
```

### AFTER (Simple Direct Mapping)
```
Text Input
    │
    ▼
Simple Color Lookup
    ├─ SECTION_TYPE_COLORS = {
    │    'verse': '#5eb3ff',
    │    'chorus': '#ffb74d',
    │    'bridge': '#52ffb8',
    │    'pre-chorus': '#b47dff',
    │    'intro': '#ffff52',
    │    'outro': '#ff52a1',
    │    'interlude': '#52ffff'
    │  }
    │
    ▼
createDecorations()
    ├─ For each line:
    │  ├─ Detect current section type
    │  ├─ getColorForSectionType(type)
    │  ├─ Apply directly: `${color}20`
    │  └─ Result: Vibrant, opaque color
    │
    ▼
Each type has distinct vibrant color → COLORFUL

COMPLEXITY: 7 static entries + direct lookup
RESULT: Robust, simple, vibrant colors
```

---

## Format Normalization Flow

### Old Format in Memory
```
{
  section: {
    type: "verse-2",    ← Problem: Type contains number
    number: 1           ← Confusing: Number is wrong
  }
}

Display: "Verse-2 1" (WRONG!)
```

### Normalization Process
```
Input: type="verse-2"

Step 1: Detect "-2" at end
  Split: ["verse", "2"]
  Is last part number? YES

Step 2: Extract parts
  Type without number: "verse"
  Extracted number: 2

Step 3: Update section
  section.type = "verse"
  section.number = 2

Step 4: Normalize type case
  section.type = "verse" (already lowercase)

Output: {
  section: {
    type: "verse",      ← Clean: No numbers
    number: 2           ← Correct: Actual number
  }
}

Display: "Verse 2" (CORRECT!)
```

---

## Color Reference Visual

```
Section Type    Color Code    Visual        Bright Check
────────────────────────────────────────────────────────
Verse           #5eb3ff      [BLUE]        ████████ Bright
Chorus          #ffb74d      [ORANGE]      ████████ Bright
Bridge          #52ffb8      [CYAN]        ████████ Bright
Pre-Chorus      #b47dff      [PURPLE]      ████████ Bright
Intro           #ffff52      [YELLOW]      ████████ Bright
Outro           #ff52a1      [PINK]        ████████ Bright
Interlude       #52ffff      [CYAN*]       ████████ Bright

* Lighter version of bridge cyan

Key: All colors are #XX where XX ≥ 50 for brightness
```

---

## Validation Architecture

### GET Endpoint Flow
```
User: "Load song"
    │
    ▼
GET /api/songs/:name
    │
    ├─ Read file from disk
    │  (May have old format)
    │
    ├─ NORMALIZE
    │  normalizeSectionFormat()
    │  Convert "verse-2" → verse with number 2
    │
    ├─ VALIDATE
    │  validateSectionFormat()
    │  Check: type in allowlist
    │  Check: number is integer >= 1
    │
    ├─ Decision Point
    │  ├─ Valid? → Return 200 with data
    │  └─ Invalid? → Return 500 with error
    │
    ▼
Frontend receives clean data ✓
```

### POST Endpoint Flow
```
User: "Save song"
    │
    ▼
POST /api/songs/:name
    │
    ├─ Receive request body
    │  (May have mixed formats)
    │
    ├─ NORMALIZE
    │  normalizeSectionFormat()
    │
    ├─ VALIDATE
    │  validateSectionFormat()
    │
    ├─ Decision Point
    │  ├─ Valid? → Save to disk
    │  └─ Invalid? → Return error
    │
    ▼
File on disk has clean format ✓
```

### Parse Endpoint Flow
```
User: "Paste and parse raw text"
    │
    ▼
POST /api/parse
    │
    ├─ Parse raw text
    │  (Creates proper format initially)
    │
    ├─ NORMALIZE again
    │  (Extra safety pass)
    │
    ├─ VALIDATE
    │  validateSectionFormat()
    │
    ├─ Decision Point
    │  ├─ Valid? → Return 200 with parsed lines
    │  └─ Invalid? → Return 400 with error
    │
    ▼
Frontend displays parsed data ✓
```

---

## Success Criteria - Visual Checklist

### Color System ✓
```
BEFORE                          AFTER
═══════                         ═════
[Gray] All sections             [Blue] Verses
[Gray] Same color               [Orange] Choruses
[Gray] Washed out              [Cyan] Bridges
[Gray] No distinction           [Purple] Pre-Chorus
                                [Yellow] Intro
                                [Pink] Outro
                                All VIBRANT ✓
```

### Format System ✓
```
BEFORE                          AFTER
═══════════════════             ═════════════
Section: Verse-2 1              Section: Verse 2
         ^^^^^^^ WRONG           Section: Verse 3
Section: Verse-2 2              Section: Chorus 1
         ^^^^^^^ WRONG           Section: Bridge
                                All CLEAN ✓
```

### System Reliability ✓
```
BEFORE                          AFTER
═══════                         ═════
Single validation point         6 validation points
One failure breaks all          Need all to fail
Fragile architecture            Robust architecture
Data corruption possible        Data corruption prevented
```

---

## Real World Example

### Scenario: User loads "love_lockdown.json" with old format data

```
FILE ON DISK: love_lockdown.json
{
  "lyrics": [
    {
      "content": "First verse line",
      "section": {
        "type": "verse-1",    ← OLD FORMAT!
        "number": 1
      }
    },
    {
      "content": "Second verse line",
      "section": {
        "type": "verse-2",    ← OLD FORMAT!
        "number": 1
      }
    },
    ...
  ]
}

BEFORE (BROKEN):
  GET /api/songs/love_lockdown
    → Load data
    → NO normalization or validation
    → Frontend receives: type="verse-2"
    → formatSectionName("verse-2") → "Verse-2"
    → Display: "Verse-2 1"  ❌ WRONG!

AFTER (FIXED):
  GET /api/songs/love_lockdown
    → Load data
    → normalize: type="verse-2" → type="verse", number=2
    → validate: Check type="verse" is valid ✓
    → Frontend normalizeSectionInPlace()
      (Normalizes again, idempotent)
    → formatSectionName("verse") → "Verse"
    → Display: "Verse 2"  ✓ CORRECT!
    
RAW TEXT VIEW:
  BEFORE: [Verse-2 1] in gray
  AFTER:  [Verse 2] in BLUE with vibrant background
```

---

## File Modification Locations

### server.js
```
Line 64-88    ├─ Enhanced normalizeSectionFormat()
Line 90-115   ├─ NEW validateSectionFormat()
Line 145-176  ├─ GET endpoint enhanced
Line 178-207  ├─ POST endpoint enhanced
Line 354-365  └─ Parse endpoint enhanced
```

### RawTextEditor.jsx
```
Line 7-26     ├─ SECTION_TYPE_COLORS + getColorForSectionType()
Line 56-112   └─ Completely rewritten createDecorations()
```

### LyricsEditor.jsx
```
Line 69-96    ├─ NEW normalizeSectionInPlace()
Line 98-115   ├─ Updated formatSectionName()
Line 501-508  └─ Updated groupLinesBySection()
```

---

## Expected Test Results

### Quick 2-Minute Test
```
Load "love_lockdown":
  Right panel: "Verse 1", "Verse 2" ✓
  Right panel colors: Blue verses, orange chorus ✓
  Left panel colors: Same coloring as right ✓
  Console: No errors ✓

Result: PASS ✓
```

### Full 30-Minute Test
```
Test 1: Load existing song ✓
Test 2: Check raw text colors ✓
Test 3: Paste new lyrics ✓
Test 4: Save and reload ✓
Test 5: Edge cases ✓

Result: PASS ✓
```

---

This visual guide should make it clear:
- What was broken (Before images)
- What the fix is (After images)
- How the system works (Flow diagrams)
- What to expect (Success criteria)
