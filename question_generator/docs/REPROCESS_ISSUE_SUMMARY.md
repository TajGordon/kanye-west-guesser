# Re-Process & Section Numbering: Issue Summary and Fix Strategy

## Three Critical Issues Identified

### Issue 1: Re-Process Button Has No Effect ❌

**What happens:**
- Change "[Verse 1]" to "[Verse 3]" in raw text
- Click "Re-process Raw Text" button
- Nothing happens:
  - Structured view doesn't update
  - JSON doesn't change
  - No error messages

**Why this is bad:**
- Users can't correct their lyrics
- Parse/edit flow is completely broken
- Can't make section changes after loading

**Root causes (one or more):**
1. Button doesn't call parse endpoint
2. Parse endpoint returns wrong format
3. Component doesn't update state properly
4. Component doesn't re-render even if state updates

---

### Issue 2: All Sections Show as "Verse 1" ❌

**What happens:**
```
[Verse 1 header]
Line 1
Line 2

[Verse 2 header]  ← But shows as "Verse 1" in structured view!
Line 3
Line 4

[Chorus 1 header]
Line 5
```

In structured view:
```
Verse 1          ← Correct
└─ Line 1
└─ Line 2

Verse 1          ← WRONG! Should be "Verse 2"
└─ Line 3
└─ Line 4

Verse 1          ← WRONG! Should be "Chorus 1"
└─ Line 5
```

**Why this is bad:**
- Sections are visually indistinguishable
- User thinks all are same section
- Can't navigate/edit specific sections
- Data corruption: JSON has type:verse, number:1 for everything

**Root causes (one or more):**
1. Parser doesn't extract section numbers (all default to 1)
2. Component receives all numbers as 1 from server
3. Display logic ignores section numbers
4. linesToSections grouping doesn't work

---

### Issue 3: Raw Text Doesn't Differentiate Verse Numbers by Color ❌

**What happens:**
```
[Verse 1]     ← Blue
Line 1
Line 2

[Verse 2]     ← Also blue (not visually different)
Line 3
Line 4
```

**Why this is bad:**
- No visual distinction between verse 1, 2, 3
- Harder to edit and navigate
- Inconsistent with structured view if fixed

**Root cause:**
- RawTextEditor colors by type only ("verse" → blue)
- Ignores the number part (doesn't distinguish verse 1 vs 2)

---

## The Investigation Path

I've created two detailed documents for you:

### 1. **REPROCESS_DIAGNOSTIC_PLAN.md** (Read This First)
Contains:
- **Investigation steps** to identify exact root cause
- **Code locations** to check
- **Console logging** to add for diagnostics
- **Expected outputs** for each test
- **What each result means**

**This is the detective work** - finding out where exactly things break.

### 2. **REPROCESS_IMPLEMENTATION_GUIDE.md** (Read After Diagnostics)
Contains:
- **Exact code fixes** for each identified problem
- **File locations** and line numbers
- **Before/after code** for each change
- **Why each fix works**
- **Testing procedures** to verify fixes work

**This is the surgery** - exactly how to fix it once you know the problem.

---

## How the Issues Are Connected

```
Issue 1: Re-process doesn't work
    ↓
Issue 2: All sections show as "Verse 1"
    ↓
Issue 3: Raw text colors same for all verses
    ↓
Dependency: 1 and 2 are coupled (both depend on parsing)
Dependency: 3 is somewhat independent (could fix separately)
```

**Fixing order**:
1. Fix parser (if broken) → Fixes issues 1 & 2
2. Fix component state → Fixes issue 1 & 2
3. Fix display logic → Fixes issue 2
4. Fix colors → Fixes issue 3

---

## Quick Summary of Likely Fixes

Based on the code I reviewed:

### Parser Issue (Probable - 40% likelihood)
```javascript
// Current regex (too permissive):
const squareMatch = headerLine.match(/^\[(\w+(?:\s+\w+)?)\s*(\d*)\s*(?:[-:](.+))?\]$/i);

// Problem: \s* (\d*) = optional space and optional digits
// Result: "[Verse3]" → type="Verse3", number="" → defaults to 1

// Fix: Make it strict
const squareMatch = headerLine.match(/^\[(\w+(?:\s+\w+)?)\s+(\d+)\s*(?:[-:](.+))?\]$/i);
// Now: \s+ (\d+) = required space and required digits
// Result: "[Verse 3]" → type="Verse", number="3" ✓
```

### Component Update Issue (Probable - 35% likelihood)
```javascript
// Component might not update state properly
// Fix: Ensure setSong creates new object reference

setSong(prev => ({
  ...prev,
  lyrics: [...data.lines]  // ← Force new array reference
}));
```

### Display Logic Issue (Possible - 25% likelihood)
```javascript
// Check that rendering actually uses section numbers
<div className="section-title">
  {formatSectionName(group.section?.type)} {group.section?.number}
</div>
// If number not showing, might be undefined in group object
```

### Color System Issue (Certain - 0% to fix, only enhance)
Raw text uses type-only coloring (by design). Could add number-based colors if desired.

---

## What You Need To Do

### Step 1: Read Documents
- **5 min**: Read this summary
- **15 min**: Read REPROCESS_DIAGNOSTIC_PLAN.md
- **5 min**: Understand the investigation steps

### Step 2: Add Diagnostics
- **5 min**: Add 3 console.log statements to code
- **2 min**: Test with "bad news"

### Step 3: Check Console Output
- **2 min**: Look at console logs
- **2 min**: Determine which issue is failing
- **2 min**: Circle the corresponding section in REPROCESS_IMPLEMENTATION_GUIDE.md

### Step 4: Implement Fix
- **10 min**: Apply the code changes
- **5 min**: Test

### Total Time: ~50 minutes

---

## Architecture Recap

**The system has three layers:**

```
Layer 1: RAW TEXT (Left panel)
├─ User edits here
└─ Must be parsed into structured format

Layer 2: DATA (JSON/State)
├─ song.lyrics = [line1, line2, ...]
├─ Each line has section={type, number}
└─ This is the single source of truth

Layer 3: STRUCTURED VIEW (Right panel)
├─ Shows data grouped by sections
├─ Displays section headers with numbers
└─ Must reflect Layer 2 accurately
```

**The flow when user clicks Re-process:**
```
User edits raw text [Verse 3]
  ↓
Click "Re-process" button
  ↓
Parse endpoint processes text
  ↓ MUST extract number=3
  ↓
Returns {lines: [{section: {type: "verse", number: 3}, ...}]}
  ↓
Component receives and updates song.lyrics
  ↓ MUST update state
  ↓
Component re-renders
  ↓ MUST call groupLinesBySection
  ↓
Groups by {type, number} = "verse-3"
  ↓
Renders section header: "Verse 3"
  ↓
Display shows correct number
```

Any break in this chain → Issues 1 or 2 occur.

---

## Key Files Involved

| File | Role | Likely Issue? |
|------|------|---------------|
| `server.js` line 215-330 | Parse endpoint | ✓ HIGH (regex) |
| `LyricsEditor.jsx` line 160-215 | State update | ✓ MEDIUM (setSong) |
| `LyricsEditor.jsx` line 507-535 | Grouping logic | ✓ LOW (should work) |
| `LyricsEditor.jsx` line 630-680 | Rendering | ✓ LOW (should work) |
| `RawTextEditor.jsx` line 60-100 | Raw text colors | ✗ NONE (design) |
| `dataModel.js` | Conversion utility | ✓ LOW (new, working) |

---

## Before You Start

### Prerequisites
- Access to browser console (F12)
- Ability to reload server (npm run dev)
- "Bad News" song or test data loaded

### What To Avoid
- ✗ Don't guess which issue it is
- ✗ Don't apply all fixes at once
- ✗ Don't skip the diagnostic phase
- ✗ Don't edit multiple files simultaneously

### What To Do
- ✓ Run diagnostics first (15 minutes)
- ✓ Apply one fix at a time
- ✓ Test after each fix
- ✓ Check console output carefully

---

## Next Steps

1. **Open**: `REPROCESS_DIAGNOSTIC_PLAN.md`
2. **Understand**: The three investigation stages
3. **Add**: Console logs to three files
4. **Run**: Test with "bad news" song
5. **Check**: Console output in order
6. **Refer**: Back to this document for what output means
7. **Read**: `REPROCESS_IMPLEMENTATION_GUIDE.md` for the fix
8. **Implement**: The specific fix needed
9. **Test**: Verify all three issues resolved

---

## Success = When This Works

```javascript
// Load song
const song = await fetch('/api/songs/bad_news').then(r => r.json());

// Edit raw text
rawText = "[Verse 3]\nHey ho\n[Chorus 1]\nLalala";

// Click Re-process
fetch('/api/parse', {method: 'POST', body: JSON.stringify({text: rawText})})
  .then(r => r.json())
  .then(data => setSong({...song, lyrics: data.lines}));

// Verify structured view
// ✓ Shows "Verse 3" with 2 lines
// ✓ Shows "Chorus 1" with 1 line
// ✓ Numbers correct in JSON

// Verify raw text colors (bonus)
// ✓ Both verses have same blue color (or different if enhanced)
```

---

**You have everything you need. The diagnostic plan will tell you exactly what's broken. The implementation guide will tell you exactly how to fix it.**
