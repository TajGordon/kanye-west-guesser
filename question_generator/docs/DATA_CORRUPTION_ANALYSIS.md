# Data Corruption Analysis: section.type Storage Issue

## Executive Summary
**The system is working correctly.** The stored format `"verse-1"` in `love_lockdown.json` is NOT a corruption—it is an **old data format** that needs to be migrated to the new format where `type` and `number` are separate fields.

---

## 1. Current Storage Format in love_lockdown.json

✅ **VERIFIED**: The file currently stores:
```json
{
  "line_number": 1,
  "content": "I'm not loving you way I wanted to",
  "section": {
    "type": "verse-1",
    "number": 1,
    "originalText": "[Verse 1]"
  },
  ...
}
```

**Pattern**: EVERY line in the file has `type` as `"verse-1"`, `"chorus-1"`, etc. (combined type+number)

---

## 2. Expected New Format (What the Code Expects)

The codebase is designed to use:
```json
{
  "section": {
    "type": "verse",
    "number": 1,
    "originalText": "[Verse 1]"
  }
}
```

**Code locations expecting this format:**
- [LineEditor.jsx](client/src/components/LineEditor.jsx#L27-L35): Select dropdown only has `"verse"`, `"chorus"`, `"pre-chorus"`, etc. (WITHOUT numbers)
- [LyricsEditor.jsx](client/src/components/LyricsEditor.jsx#L101-L107): `buildDisplayText()` constructs labels using `section.type` + `section.number` separately
- [LyricsEditor.jsx](client/src/components/LyricsEditor.jsx#L342-L350): Bulk section change sets `{ type: 'verse', number: 1 }` (separate fields)
- [server.js](server.js#L143-L150): Parser creates sections with separated `type` and `number`

---

## 3. Data Flow Analysis

### A. LOADING FLOW (Correct Path)
```
GET /api/songs/love_lockdown
  ↓
server.js loads love_lockdown.json AS-IS (with "type": "verse-1")
  ↓
App.jsx: setSong(data)
  ↓
LyricsEditor renders with data
  ↓
buildDisplayText() tries to use: section.type + section.number
  ✗ PROBLEM: section.type = "verse-1" (already has number in it!)
```

### B. EDITING FLOW (The Real Problem)
```
User edits line in LineEditor.jsx
  ↓
onChange handler calls: { ...line, section: { ...line.section, type: e.target.value } }
  ✓ Sets type = "verse" (correct, without number)
  ✓ Keeps number = 1 (already there)
  ↓
Line now has CORRECT format: { type: "verse", number: 1 }
  ↓
User clicks Save in App.jsx
  ↓
POST /api/songs/love_lockdown with updated song
  ↓
server.js saves it AS-IS
  ✓ CORRECT: Lines edited by user get saved with proper format
```

### C. PARSE FLOW (Creates Correct Format)
```
User edits raw text in left panel
  ↓
handleLeftPanelChange() → debouncedParse()
  ↓
POST /api/parse with raw text
  ↓
server.js parseSection() creates: { type: "verse", number: 1 } ✓
  ↓
setSong(prev => ({ ...prev, lyrics: data.lines })) 
  ✓ Replaces entire lyrics array with correct format
```

---

## 4. Why The Old Format Exists

This is a **data migration issue**, not a bug:

1. **Old data format**: The original `love_lockdown.json` has `type: "verse-1"` (baked together)
2. **New code design**: All UI components expect `type: "verse"` + separate `number`
3. **What happens**: 
   - File loads with old format ✗
   - UI tries to parse `"verse-1"` as a section type
   - UI doesn't find it in the select dropdown
   - User editing creates correct format ✓
   - File saves mixed data (old lines keep old format, edited lines get new format)

---

## 5. Why It Seems To Work But Is Wrong

**Apparent behavior**: Lines seem to display fine even though the data is wrong

**Why**: The `buildDisplayText()` function in [LyricsEditor.jsx](client/src/components/LyricsEditor.jsx#L75) doesn't validate the format:

```javascript
const sectionName = formatSectionName(section.type);  // Takes "verse-1", tries to format it
const label = `[${sectionName} ${section.number}]`;   // Produces [Verse-1 1] ← WRONG!
```

When `section.type = "verse-1"` and `section.number = 1`:
- Produces: `[Verse-1 1]` instead of `[Verse 1]`

---

## 6. Specific Code Locations That Need Fixes

### Problem Areas:

1. **[server.js](server.js#L143-L170)** - Parser creates correct format ✓
   - No changes needed, this is correct

2. **[love_lockdown.json](love_lockdown.json)** - Data migration needed ✗
   - **NEEDS MIGRATION**: Change all `"type": "verse-1"` to `"type": "verse"` (remove the number)
   - The `number` field already exists, just needs the `type` cleaned up

3. **[LineEditor.jsx](client/src/components/LineEditor.jsx#L27-L35)** - UI is correct ✓
   - Dropdown options are correct (no numbers)
   - onChange correctly updates just the `type` field

4. **[LyricsEditor.jsx](client/src/components/LyricsEditor.jsx#L101-L107)** - Display construction is correct ✓
   - `buildDisplayText()` correctly concatenates `type + number`
   - But assumes `type` doesn't already contain a number

5. **[App.jsx](client/src/components/App.jsx)** - Save is correct ✓
   - Saves whatever is in the `song` object as-is
   - No transformation happening here

---

## 7. Migration Strategy

### Option 1: One-Time Data Fix (RECOMMENDED)
```javascript
// In server.js, add a migration endpoint:
app.post('/api/migrate/fix-section-types', (req, res) => {
  try {
    const files = fs.readdirSync(LYRICS_DIR)
      .filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      const filePath = path.join(LYRICS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      let changed = false;
      if (data.lyrics) {
        data.lyrics.forEach(line => {
          const section = line.section;
          if (section && section.type && section.type.includes('-')) {
            // Type contains number, e.g., "verse-1"
            const match = section.type.match(/^(.+?)-(\d+)$/);
            if (match) {
              section.type = match[1];  // "verse"
              section.number = parseInt(match[2]) || 1;  // 1
              changed = true;
            }
          }
        });
      }
      
      if (changed) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Migrated: ${file}`);
      }
    }
    
    res.json({ success: true, message: 'All files migrated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Option 2: Sanitize on Load (Defensive)
Add validation in [server.js](server.js#L72) GET endpoint:
```javascript
// After loading the file, normalize section types:
if (data.lyrics) {
  data.lyrics.forEach(line => {
    const section = line.section;
    if (section.type && section.type.includes('-')) {
      const match = section.type.match(/^(.+?)-(\d+)$/);
      if (match) {
        section.type = match[1];
        if (!section.number) section.number = parseInt(match[2]) || 1;
      }
    }
  });
}
```

### Option 3: Sanitize on Save (Defensive)
Add validation before saving in [server.js](server.js#L101):
```javascript
// Normalize before saving
if (req.body.lyrics) {
  req.body.lyrics.forEach(line => {
    const section = line.section;
    if (section.type && section.type.includes('-')) {
      const match = section.type.match(/^(.+?)-(\d+)$/);
      if (match) {
        section.type = match[1];
        if (!section.number) section.number = parseInt(match[2]) || 1;
      }
    }
  });
}
```

---

## 8. Summary: What's Actually Happening

| Component | Status | Issue |
|-----------|--------|-------|
| **love_lockdown.json** | ✗ Broken | Has old format: `type: "verse-1"` instead of `type: "verse"` |
| **Server Parser** | ✓ Correct | Creates proper `{ type: "verse", number: 1 }` |
| **LineEditor UI** | ✓ Correct | Select dropdown has only type names, not numbers |
| **LyricsEditor Display** | ⚠️ Works but fragile | Assumes `type` is just the type name, fails if number is included |
| **Save Logic** | ✓ Correct | Saves whatever is in memory, doesn't corrupt further |
| **Load Logic** | ✗ Broken | Loads old format without fixing it |

---

## 9. Root Cause

The `love_lockdown.json` file was created with an **old data format** where the section number was baked into the type field. The code has since evolved to use separate fields, but the old data was never migrated.

**This is a DATA MIGRATION ISSUE, not a code bug.**

---

## 10. Recommended Fix Order

1. **Immediate**: Add normalization in server.js GET endpoint (defensive, fixes on load)
2. **Short-term**: Run migration script to fix all existing JSON files
3. **Long-term**: Add validation in save endpoint to prevent new files from being created in old format
