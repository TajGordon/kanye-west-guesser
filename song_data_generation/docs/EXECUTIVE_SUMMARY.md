# Executive Summary: section.type Analysis

## The Issue in One Sentence
**Data file `love_lockdown.json` has old format where `section.type = "verse-1"` instead of new format `section.type = "verse"`.**

---

## Key Findings

### 1. EVERY Line in love_lockdown.json Has the Wrong Format
✗ Current: `{ "type": "verse-1", "number": 1 }`  
✓ Expected: `{ "type": "verse", "number": 1 }`

The number is currently embedded in the type field AND exists as a separate field (redundant/conflicting).

---

### 2. Full Data Flow Traced

```
LOAD:    Old file → server.js → (NO FIX) → memory (still wrong)
PARSE:   Raw text → server.js → CORRECT FORMAT → memory (correct)
EDIT:    UI select → LineEditor → CORRECT FORMAT → memory (correct)  
SAVE:    Memory → server.js → (NO VALIDATION) → disk (mixed if edit-only)
```

| Step | What Happens | Status |
|------|--------------|--------|
| Load from disk | Returns `{ type: "verse-1", ... }` | ✗ BROKEN - no normalization |
| Parse raw text | Creates `{ type: "verse", ... }` | ✓ CORRECT |
| User edits UI | Creates `{ type: "verse", ... }` | ✓ CORRECT |
| Save to disk | Writes whatever is in memory | ⚠️ RISKY - no validation |

---

### 3. Where the Corruption Appears

| Component | Role | Status |
|-----------|------|--------|
| `love_lockdown.json` | Data source | ✗ Has old format |
| `server.js GET` | Load endpoint | ✗ Doesn't normalize |
| `App.jsx` | State management | ✓ Just stores what it gets |
| `LyricsEditor.jsx` | Display/edit UI | ⚠️ Works but shows wrong output when old data loads |
| `LineEditor.jsx` | Form fields | ✓ Dropdown has correct values only |
| `server.js POST` | Save endpoint | ⚠️ Doesn't validate before saving |

---

### 4. Data Creation Issue: There Is None

The code never creates the wrong format (`verse-1`). Instead:

- **Parser creates correct format**: `parseSection()` always produces `{ type: "verse", number: 1 }`
- **UI creates correct format**: LineEditor, bulk edit actions always produce `{ type: "verse", number: 1 }`
- **Old data exists**: `love_lockdown.json` has embedded numbers that were never migrated

**Conclusion**: No code is doing the corruption. The wrong data just exists in the file and isn't being normalized on load.

---

### 5. Root Cause

This is a **DATA MIGRATION PROBLEM**, not a code bug:

1. File was created with old schema (number embedded in type)
2. Code was refactored to separate type and number into different fields
3. Old data was never migrated
4. System doesn't validate/normalize on load, so old format persists

---

## The Three Fixes Needed

### 1. Load-Time Fix (Immediate, Defensive)
**Add to `server.js` GET endpoint**: Normalize section types when loading
- Takes 5 minutes
- Fixes the problem immediately for all existing files
- Prevents any issues from old data

### 2. Save-Time Fix (Immediate, Preventive)
**Add to `server.js` POST endpoint**: Validate section types before saving
- Takes 5 minutes
- Prevents any corrupted data from being written
- Safety net against future problems

### 3. Data Migration (Permanent)
**Run migration script**: Fix all files on disk to new format
- Takes 1 minute to run
- Permanent solution
- Combined with fix #1 and #2, makes the system bulletproof

---

## Impact Assessment

### Current Behavior
- ✓ Parsing raw text works (creates correct format)
- ✓ Editing via UI works (creates correct format)
- ✗ Loading old files shows wrong display (`[Verse-1 1]` instead of `[Verse 1]`)
- ✗ Saving after UI edit creates mixed format file
- ✗ UI dropdown can't match loaded data

### After Fixes
- ✓ Everything works correctly
- ✓ Old files automatically normalized on load
- ✓ All new files validated before save
- ✓ All existing files permanently migrated
- ✓ Display always shows correct format
- ✓ UI dropdown always matches data

---

## Code Locations

### Files That Need Changes
1. [server.js](server.js#L72-L87) - GET endpoint (add normalization)
2. [server.js](server.js#L101-107) - POST endpoint (add validation)
3. [love_lockdown.json](love_lockdown.json) - Data file (run migration)

### Files That Are Correct
- ✓ [LineEditor.jsx](client/src/components/LineEditor.jsx) - UI is correct
- ✓ [LyricsEditor.jsx](client/src/components/LyricsEditor.jsx) - Display logic is correct
- ✓ [App.jsx](client/src/components/App.jsx) - State management is correct
- ✓ Parser in server.js - Creates correct format

---

## Verification

The problem is verifiable in `love_lockdown.json`:

```bash
# Check for old format:
grep '"type": "verse-[0-9]' love_lockdown.json
# Should show many results like: "type": "verse-1"

# After fix:
grep '"type": "verse-[0-9]' love_lockdown.json
# Should show NO results
```

---

## Recommendation

**Implement all three fixes**:
1. Copy normalization function to GET endpoint
2. Copy validation function to POST endpoint  
3. Run migration script on all .json files

**Time**: ~15 minutes
**Risk**: Minimal (no logic changes, just data fixes)
**Benefit**: Complete data integrity, prevents future issues

**Priority**: MEDIUM - Doesn't break core functionality, but data consistency is important.

---

## Documents Created

1. **DATA_CORRUPTION_ANALYSIS.md** - Detailed technical analysis
2. **DATA_FLOW_DIAGRAM.md** - Visual representation of data flow
3. **FINDINGS_SUMMARY.md** - Complete answers to all 5 task items
4. **FIX_IMPLEMENTATION_GUIDE.md** - Exact code to implement fixes
5. **This file** - Executive summary

All documents are in `/question_generator/` directory.
