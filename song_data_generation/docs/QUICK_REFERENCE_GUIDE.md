# Quick Reference: section.type Issues & Fixes

## Problem At a Glance

```
❌ Stored in love_lockdown.json:
   { "type": "verse-1", "number": 1 }

✅ Code expects:
   { "type": "verse", "number": 1 }

🔧 Not fixed on load:
   Data loaded with wrong format persists in memory
```

---

## What Each Code Location Does

### Server Load Endpoint (GET /api/songs/:name)
```javascript
// CURRENT: Returns data as-is
app.get('/api/songs/:name', (req, res) => {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  res.json(data);  // ← Returns old format unchanged!
});

// FIXED: Normalizes before returning
const normalizeSectionTypes = (data) => {
  if (data.lyrics) {
    data.lyrics.forEach(line => {
      if (line.section?.type?.match(/^(.+?)-(\d+)$/)) {
        const [, type, num] = line.section.type.match(/^(.+?)-(\d+)$/);
        line.section.type = type;  // "verse-1" → "verse"
        line.section.number = parseInt(num);
      }
    });
  }
  return data;
};
app.get('/api/songs/:name', (req, res) => {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  res.json(normalizeSectionTypes(data));  // ← Fixed!
});
```

### UI: Line Editor (LineEditor.jsx)
```jsx
// CORRECT: Dropdown only shows type names
<select
  value={line.section?.type || ''}
  onChange={(e) => onChange({
    ...line,
    section: { ...line.section, type: e.target.value }
  })}
>
  <option value="verse">Verse</option>        // Not "verse-1"
  <option value="chorus">Chorus</option>      // Not "chorus-1"
  <option value="pre-chorus">Pre-Chorus</option>
  // etc.
</select>
```

### Display Builder (LyricsEditor.jsx buildDisplayText)
```javascript
// Current code that LOOKS correct but shows wrong output:
const sectionName = formatSectionName(section.type);
// When type="verse-1", formatSectionName returns "Verse-1"
const label = `[${sectionName} ${section.number}]`;
// Result: "[Verse-1 1]" ← Shows double number!

// What it SHOULD produce:
// type="verse" → "[Verse 1]" ✓
```

### Server Save Endpoint (POST /api/songs/:name)
```javascript
// CURRENT: No validation, just saves whatever you send
app.post('/api/songs/:name', (req, res) => {
  fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
  // ← If data has mixed format (some old, some new), saves it that way!
});

// FIXED: Validates before saving
const validateSectionTypes = (data) => {
  if (data.lyrics) {
    data.lyrics.forEach(line => {
      if (line.section?.type?.match(/\d+$/)) {
        // Type ends with digit (old format)
        const [, type, num] = line.section.type.match(/^(.+?)-(\d+)$/);
        line.section.type = type;
        line.section.number = parseInt(num);
      }
    });
  }
  return data;
};
app.post('/api/songs/:name', (req, res) => {
  const validated = validateSectionTypes(req.body);
  fs.writeFileSync(filePath, JSON.stringify(validated, null, 2));
});
```

### Data Parser (server.js parseSection)
```javascript
// CORRECT: Always creates proper format
const parseSection = (headerLine) => {
  const squareMatch = headerLine.match(/^\[(\w+(?:\s+\w+)?)\s*(\d*)\s*(?:[-:](.+))?\]$/i);
  if (squareMatch) {
    const [, typeStr, num] = squareMatch;
    let type = typeStr.trim().toLowerCase().replace(/\s+/g, '-');
    
    return {
      type: type,              // "verse" (just the type!)
      number: num ? parseInt(num) : 1,  // 1 (separate field)
      originalText: headerLine
    };
  }
};
```

---

## Data States in Different Scenarios

### Scenario 1: Load Old File + Save Without Editing
```
Disk (old):          { type: "verse-1", number: 1 }
         ↓
Load (no fix):       { type: "verse-1", number: 1 } ← WRONG
         ↓
Memory:              { type: "verse-1", number: 1 } ← WRONG
         ↓
Save (no change):    { type: "verse-1", number: 1 } ← WRONG
         ↓
Disk (after save):   { type: "verse-1", number: 1 } ← WRONG PERSISTS
```

### Scenario 2: Load Old File + Parse Raw Text + Save
```
Disk (old):          { type: "verse-1", number: 1 }
         ↓
Load (no fix):       { type: "verse-1", number: 1 } ← WRONG
         ↓
Parse raw text:      { type: "verse", number: 1 }   ← CORRECT
         ↓
Replace entire array with parsed data
         ↓
Memory:              { type: "verse", number: 1 }   ← CORRECT
         ↓
Save:                { type: "verse", number: 1 }   ← CORRECT
         ↓
Disk (after save):   { type: "verse", number: 1 }   ✓ FIXED!
```

### Scenario 3: After All Fixes
```
Disk (old):          { type: "verse-1", number: 1 }
         ↓
Load (WITH FIX):     { type: "verse", number: 1 }   ✓ FIXED!
         ↓
Memory:              { type: "verse", number: 1 }   ✓ CORRECT
         ↓
Save (WITH FIX):     { type: "verse", number: 1 }   ✓ CORRECT
         ↓
Disk (after save):   { type: "verse", number: 1 }   ✓ CORRECT
```

---

## Before vs After

### Before Fixes
| Action | Result |
|--------|--------|
| Load song | `"verse-1"` appears in memory |
| Display | Shows `[Verse-1 1]` (wrong) |
| Edit in UI | LineEditor shows no matching option |
| Save without edit | Old format persists |
| Parse raw text | Works correctly, replaces old data |

### After Fixes
| Action | Result |
|--------|--------|
| Load song | `"verse"` appears in memory (normalized) |
| Display | Shows `[Verse 1]` (correct) |
| Edit in UI | LineEditor shows matching option |
| Save after edit | Correct format validated & saved |
| Parse raw text | Works as before, always correct |

---

## Lines That Need to Change

### server.js
```javascript
// BEFORE (lines 72-87): GET endpoint
app.get('/api/songs/:name', (req, res) => {
  try {
    const filePath = path.join(LYRICS_DIR, `${req.params.name}.json`);
    const txtPath = path.join(LYRICS_DIR, `${req.params.name}.txt`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (fs.existsSync(txtPath)) {
      const rawText = fs.readFileSync(txtPath, 'utf-8');
      data.rawText = rawText;
    }
    
    res.json(data);  // ← ADD NORMALIZATION BEFORE THIS
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AFTER: Add one line before res.json()
app.get('/api/songs/:name', (req, res) => {
  try {
    // ... same code ...
    let data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // ← ADD THIS:
    // Normalize section types from old format (type: "verse-1") to new (type: "verse", separate number)
    if (data.lyrics) {
      data.lyrics.forEach(line => {
        if (line.section?.type?.match(/^(.+?)-(\d+)$/)) {
          const match = line.section.type.match(/^(.+?)-(\d+)$/);
          line.section.type = match[1];
          line.section.number = parseInt(match[2]) || 1;
        }
      });
    }
    
    if (fs.existsSync(txtPath)) {
      const rawText = fs.readFileSync(txtPath, 'utf-8');
      data.rawText = rawText;
    }
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### love_lockdown.json
```json
// BEFORE (throughout file)
{
  "section": {
    "type": "verse-1",      // ✗ Wrong
    "number": 1,
    "originalText": "[Verse 1]"
  }
}

// AFTER (throughout file)
{
  "section": {
    "type": "verse",        // ✓ Fixed
    "number": 1,
    "originalText": "[Verse 1]"
  }
}
```

---

## Verification Commands

```bash
# Check for problem (should show many lines with numbers in type)
grep -n '"type": ".*-[0-9]' love_lockdown.json

# After fix (should show nothing)
grep -n '"type": ".*-[0-9]' love_lockdown.json  # ← Should be empty!
```

---

## Impact on Each File Type

| File | Impact | Fix Required |
|------|--------|--------------|
| love_lockdown.json | ✗ Has old format | Migrate |
| bad_news.json | Unknown | Check & migrate if needed |
| Other .json files | Unknown | Check all files |

---

## Testing Checklist

After applying fixes:

- [ ] Load `love_lockdown.json` via `/api/songs/love_lockdown`
- [ ] Verify returned data has `type: "verse"` (not `type: "verse-1"`)
- [ ] Display shows `[Verse 1]` (not `[Verse-1 1]`)
- [ ] LineEditor dropdown shows matching option
- [ ] Edit a line, verify save creates correct format
- [ ] Parse raw text, verify it works
- [ ] Load bad_news.json, verify it's also normalized
- [ ] Check all .json files for old format patterns
