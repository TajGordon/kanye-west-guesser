# Complete Findings: section.type Storage Issue

## Quick Summary

✅ **The code is correct.**
❌ **The data file is wrong.**

The `love_lockdown.json` file contains **old data format** where `section.type = "verse-1"` (with number embedded). The codebase expects `section.type = "verse"` with a separate `number` field.

---

## Answers to Your 5 Tasks

### 1. ✅ Pattern in love_lockdown.json

**EVERY line has the old format:**
- All lines have: `"type": "verse-1"`, `"type": "chorus-1"`, etc.
- All lines have: `"number": 1`, `"number": 2`, etc.

**This is inconsistent**: the number appears in BOTH places:
- `type` field contains: "verse-1" (baked in)
- `number` field contains: 1 (separate)

This is definitely old data that wasn't migrated.

---

### 2. ✅ Full Data Flow Traced

#### **Load via /api/songs/love_lockdown**
```
1. server.js line 72: fs.readFileSync() reads file
2. Returns JSON as-is: { "type": "verse-1", "number": 1, ... }
3. App.jsx line 29: setSong(data)
4. LyricsEditor receives data with type="verse-1"
```

**ISSUE**: No normalization happens on load. Old format stays in memory.

#### **App.jsx When setSong(data) Called**
```javascript
const handleLoadSong = useCallback(async (name, preloadedData) => {
  const data = preloadedData || ...;
  setSong(data);  // ← Stores data exactly as received
  setSongName(name);
}, []);
```

**Finding**: App.jsx just stores the data directly. No transformation.

#### **LyricsEditor Rendering with section**
```javascript
// Receives line.section = { type: "verse-1", number: 1 }

// buildDisplayText() runs (line 75):
const sectionName = formatSectionName(section.type);  
// formatSectionName("verse-1") → "Verse-1"
// Then: `[${sectionName} ${section.number}]`
// Result: "[Verse-1 1]"  ← DISPLAYS WRONG!

// LineEditor dropdown (line 27):
// Shows options: "verse", "chorus", "pre-chorus"
// Does NOT show: "verse-1"
// So "verse-1" doesn't match any option! ✗
```

**Finding**: Display is wrong when old data is loaded. UI can't edit because type isn't in dropdown.

#### **buildDisplayText() Output**
For old data: `"[Verse-1 1]\n[Verse-1 1]\n..."`  ← Has double number
For new data: `"[Verse 1]\n[Verse 1]\n..."`     ← Correct

#### **User Hits Save**
```javascript
// App.jsx line 48:
const res = await fetch(`/api/songs/${filename}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(song)  // ← Sends exactly what's in memory
});
```

**server.js line 101:**
```javascript
fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
// ← No transformation, saves AS-IS
```

**Finding**: If data in memory is mixed format (some old, some new), file will be saved mixed.

---

### 3. ✅ Data Transformation Issues Found

**No transformation is happening** — that's the problem!

When old data loads, it should be normalized but isn't:

| Location | Should Normalize? | Does It? | Status |
|----------|------------------|----------|--------|
| server.js GET /api/songs/:name | ✓ YES | ✗ NO | **BUG** |
| App.jsx setSong() | ✓ YES | ✗ NO | **BUG** |
| LyricsEditor.jsx render | ✓ YES | ✗ NO | **BUG** |
| server.js POST /api/songs/:name | ✓ YES | ✗ NO | **BUG** |

The code **assumes** the format is correct but **doesn't validate it**.

---

### 4. ✅ Section Object Creation Issues

#### **How Sections Are Created**

**A) When loaded from disk:**
```javascript
// love_lockdown.json has:
{
  "section": {
    "type": "verse-1",        // ← WRONG
    "number": 1,
    "originalText": "[Verse 1]"
  }
}
```

**B) When created by parser (server.js line 143):**
```javascript
const section = {
  type: type,           // e.g., "verse" ← CORRECT
  number: num ? parseInt(num) : 1,  // e.g., 1 ← CORRECT
  originalText: headerLine
};
```

**C) When created by bulk edit (LyricsEditor.jsx line 342):**
```javascript
onClick: () => handleBulkEdit('section', {
  type: 'verse',        // ← CORRECT (without number)
  number: 1
})
```

**D) When user edits in LineEditor (LineEditor.jsx line 19):**
```javascript
onChange={(e) => onChange({
  ...line,
  section: { ...line.section, type: e.target.value }  // e.g., "verse" ← CORRECT
})}
```

**Finding**: When NEW sections are created via UI/parser, they're created CORRECTLY. The problem is ONLY with old data that was never migrated.

---

### 5. ✅ Code Doing Type Corruption

**FOUND THE CULPRIT: There is NO code doing this.**

The problem is **not** that code is corrupting the data.
The problem is **that old data exists** and **isn't being normalized**.

However, there IS code that could have created it initially (no longer exists in current codebase), or the file was created with an older version of the app.

---

## Summary: What's Actually Stored vs. Expected

### In love_lockdown.json

```json
{
  "line_number": 1,
  "section": {
    "type": "verse-1",          // ACTUAL (WRONG - old format)
    "number": 1,                // ACTUAL (exists but redundant)
    "originalText": "[Verse 1]" // ACTUAL
  }
}
```

### What Code Expects

```json
{
  "line_number": 1,
  "section": {
    "type": "verse",            // EXPECTED (CORRECT - new format)
    "number": 1,                // EXPECTED (sole source of number)
    "originalText": "[Verse 1]" // EXPECTED
  }
}
```

### When User Edits via UI

```json
{
  "line_number": 1,
  "section": {
    "type": "verse",    // ← Gets corrected by LineEditor
    "number": 1,
    "originalText": "[Verse 1]"
  }
}
```

### When User Edits via Raw Text Parse

```json
{
  "line_number": 1,
  "section": {
    "type": "verse",    // ← Always correct from parser
    "number": 1,
    "originalText": "[Verse 1]"
  }
}
```

---

## Root Cause Conclusion

### Parser is Correct ✓
- Creates: `{ type: "verse", number: 1 }`
- Always correct

### UI is Correct ✓
- Expects: `{ type: "verse", number: 1 }`
- Always creates correct format when editing

### Save is Correct ✓
- Writes whatever is in memory (no transformation needed)

### Load is WRONG ✗
- Reads old format from disk
- **Does not normalize it**
- Returns it as-is

### Data File is WRONG ✗
- Contains: `{ type: "verse-1", number: 1 }`
- Needs migration

---

## Code Locations for Fix

| File | Line(s) | Issue | Fix |
|------|---------|-------|-----|
| **server.js** | 72-87 | GET endpoint doesn't normalize | Add normalization logic |
| **server.js** | 101-107 | POST endpoint doesn't validate | Add validation before save |
| **love_lockdown.json** | ALL | Data has old format | Run migration script |

---

## Type: Data Migration Problem

This is **NOT a code bug**.
This is a **data migration problem**.

The data file was created with an old schema where `type` included the number.
The code has evolved to separate these into two fields.
The old data was never migrated to the new format.

**Fix**: Either migrate the old data, or add normalization code that fixes it on load.

---

## Verification

To verify the problem:

1. Open `love_lockdown.json`
2. Search for `"type":`
3. You'll see: `"verse-1"`, `"chorus-1"`, etc. (100% of the file)
4. This is the old format that needs migration

All new edits via the UI will create correct format: `"verse"`, `"chorus"`, etc.

