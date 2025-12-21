# Fix Implementation Guide

## Problem
`love_lockdown.json` and potentially other song files have old data format where `section.type = "verse-1"` (number embedded) instead of the new format `section.type = "verse"` with separate `number` field.

---

## Three-Part Fix Strategy

### PART 1: Normalize on Load (Defensive - Immediate Fix)

**File**: `server.js` (GET endpoint for `/api/songs/:name`)

**Location**: After line 87 (after data is loaded from file)

**Add this code**:
```javascript
// Normalize section types (migration from old format where number was in type)
const normalizeSectionTypes = (data) => {
  if (data.lyrics && Array.isArray(data.lyrics)) {
    data.lyrics.forEach(line => {
      const section = line.section;
      if (section && section.type && typeof section.type === 'string') {
        // Check if type contains embedded number (old format: "verse-1", "chorus-2")
        const match = section.type.match(/^(.+?)-(\d+)$/);
        if (match) {
          // Extract type and number from old format
          section.type = match[1];  // "verse-1" → "verse"
          section.number = parseInt(match[2]) || section.number || 1;
        }
      }
    });
  }
  return data;
};
```

**Then modify the GET endpoint**:
```javascript
// Load a song (with raw text if available)
app.get('/api/songs/:name', (req, res) => {
  try {
    const filePath = path.join(LYRICS_DIR, `${req.params.name}.json`);
    const txtPath = path.join(LYRICS_DIR, `${req.params.name}.txt`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    let data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // ← ADD THIS LINE:
    data = normalizeSectionTypes(data);  // Fix old data format on load
    
    // Load raw lyrics text if available
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

**What this does**: Automatically fixes old data when it's loaded, so the rest of the app sees correct format.

---

### PART 2: Validate on Save (Preventive - Immediate Fix)

**File**: `server.js` (POST endpoint for `/api/songs/:name`)

**Location**: Before line 102 (before saving to disk)

**Modify the save endpoint**:
```javascript
// Save a song
app.post('/api/songs/:name', (req, res) => {
  try {
    // Validate and normalize section types before saving
    const validateSectionTypes = (data) => {
      if (data.lyrics && Array.isArray(data.lyrics)) {
        data.lyrics.forEach(line => {
          const section = line.section;
          if (section && section.type) {
            // Ensure type doesn't contain number (should be separate field)
            if (section.type.match(/\d+$/)) {  // Ends with digit
              const match = section.type.match(/^(.+?)-(\d+)$/);
              if (match) {
                console.warn(`Fixing section type on save: "${section.type}" → "${match[1]}"`);
                section.type = match[1];
                section.number = parseInt(match[2]) || section.number || 1;
              }
            }
            
            // Ensure type is valid
            const validTypes = ['verse', 'chorus', 'pre-chorus', 'bridge', 'intro', 'outro', 'interlude', 'break'];
            if (!validTypes.includes(section.type)) {
              console.warn(`Invalid section type: "${section.type}", defaulting to "verse"`);
              section.type = 'verse';
            }
            
            // Ensure number is a positive integer
            if (!section.number || typeof section.number !== 'number' || section.number < 1) {
              section.number = 1;
            }
          }
        });
      }
      return data;
    };
    
    const body = validateSectionTypes(req.body);
    const filePath = path.join(LYRICS_DIR, `${req.params.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2));
    res.json({ success: true, name: req.params.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**What this does**: Ensures that even if the UI accidentally sends old format, it gets normalized before saving to disk.

---

### PART 3: One-Time Data Migration (Permanent Fix)

**Option A: Manual Fix (Easy)**

Edit `love_lockdown.json` directly:
1. Find all instances of: `"type": "verse-1"`
2. Replace with: `"type": "verse"`
3. Find all instances of: `"type": "chorus-1"`
4. Replace with: `"type": "chorus"`
5. Repeat for all other section types

The `"number"` field already exists and has the right value, so you just need to remove the number from the type string.

**Option B: Script-Based Fix (Recommended)**

Create a new file: `scripts/migrate-section-types.js`

```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LYRICS_DIR = path.join(__dirname, '../lyrics');

console.log('Starting migration of section types...\n');

const files = fs.readdirSync(LYRICS_DIR).filter(f => f.endsWith('.json'));
let migratedCount = 0;
let lineCount = 0;

for (const file of files) {
  const filePath = path.join(LYRICS_DIR, file);
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let fileChanged = false;
    
    if (data.lyrics && Array.isArray(data.lyrics)) {
      for (const line of data.lyrics) {
        const section = line.section;
        if (section && section.type && section.type.match(/^(.+?)-(\d+)$/)) {
          const match = section.type.match(/^(.+?)-(\d+)$/);
          const oldType = section.type;
          section.type = match[1];
          section.number = parseInt(match[2]) || 1;
          
          console.log(`  ${file}: "${oldType}" → "${section.type}"`);
          fileChanged = true;
          lineCount++;
        }
      }
    }
    
    if (fileChanged) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      migratedCount++;
      console.log(`✓ Saved ${file}\n`);
    }
  } catch (err) {
    console.error(`✗ Error processing ${file}:`, err.message);
  }
}

console.log(`\n=== Migration Complete ===`);
console.log(`Files migrated: ${migratedCount}`);
console.log(`Lines fixed: ${lineCount}`);
```

**Run it with**:
```bash
cd question_generator/lyrics_generator
node ../../scripts/migrate-section-types.js
```

**Option C: HTTP Endpoint (Most Convenient)**

Add to `server.js`:

```javascript
// Endpoint to migrate all section types in all song files
app.post('/api/admin/migrate-section-types', (req, res) => {
  try {
    console.log('Starting migration...');
    const files = fs.readdirSync(LYRICS_DIR).filter(f => f.endsWith('.json'));
    let migratedCount = 0;
    let lineCount = 0;

    for (const file of files) {
      const filePath = path.join(LYRICS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      let fileChanged = false;

      if (data.lyrics && Array.isArray(data.lyrics)) {
        for (const line of data.lyrics) {
          const section = line.section;
          if (section && section.type && section.type.match(/^(.+?)-(\d+)$/)) {
            const match = section.type.match(/^(.+?)-(\d+)$/);
            section.type = match[1];
            section.number = parseInt(match[2]) || 1;
            fileChanged = true;
            lineCount++;
          }
        }
      }

      if (fileChanged) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        migratedCount++;
      }
    }

    res.json({
      success: true,
      filesModified: migratedCount,
      linesFixed: lineCount,
      message: `Migration complete. Fixed ${lineCount} lines in ${migratedCount} files.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

Then call it:
```
POST http://localhost:3001/api/admin/migrate-section-types
```

---

## Implementation Order (Recommended)

### Immediate (Today)
1. Add `normalizeSectionTypes()` function to server.js
2. Call it in the GET endpoint (Part 1)
3. This fixes the issue immediately without changing any files

### Short-term (This Week)
1. Add validation to POST endpoint (Part 2)
2. Prevents new corrupted data from being created

### Long-term (This Week)
1. Run migration script once (Part 3)
2. Permanently fixes all existing files to new format
3. After migration, the normalization code becomes a safety net (rarely triggered)

---

## Testing the Fix

### Before Fix:
```
GET /api/songs/love_lockdown
→ Returns: { type: "verse-1", number: 1 }  ✗
→ Display shows: [Verse-1 1]  ✗
→ UI dropdown doesn't match
```

### After Part 1 Fix:
```
GET /api/songs/love_lockdown
→ Returns: { type: "verse", number: 1 }  ✓
→ Display shows: [Verse 1]  ✓
→ UI dropdown matches
```

### After Part 3 Fix:
```
File on disk: { type: "verse", number: 1 }  ✓
Load returns: { type: "verse", number: 1 }  ✓
Display shows: [Verse 1]  ✓
```

---

## Code Changes Summary

| Component | Change | Impact | Effort |
|-----------|--------|--------|--------|
| server.js GET | Add normalization | Fixes on load | 5 mins |
| server.js POST | Add validation | Prevents new bugs | 5 mins |
| love_lockdown.json | Run migration | Permanent fix | 1 min |
| Other .json files | Run migration | Prevent future issues | 1 min |

**Total time**: ~15 minutes
**Risk**: Minimal (old code just fixes things, doesn't change logic)
**Benefit**: Complete data integrity

---

## Verification Script

After implementing fixes, verify with this test:

```javascript
// In server.js or as a test endpoint
app.get('/api/debug/check-section-types', (req, res) => {
  try {
    const files = fs.readdirSync(LYRICS_DIR).filter(f => f.endsWith('.json'));
    const issues = [];

    for (const file of files) {
      const filePath = path.join(LYRICS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      if (data.lyrics) {
        for (let i = 0; i < data.lyrics.length; i++) {
          const section = data.lyrics[i].section;
          
          // Check 1: Type should not contain numbers
          if (section.type && section.type.match(/\d/)) {
            issues.push(`${file} line ${i}: type "${section.type}" contains digits`);
          }
          
          // Check 2: Type should be in valid list
          const validTypes = ['verse', 'chorus', 'pre-chorus', 'bridge', 'intro', 'outro', 'interlude', 'break'];
          if (!validTypes.includes(section.type)) {
            issues.push(`${file} line ${i}: type "${section.type}" not in valid list`);
          }
          
          // Check 3: Number should be integer >= 1
          if (!Number.isInteger(section.number) || section.number < 1) {
            issues.push(`${file} line ${i}: number "${section.number}" is invalid`);
          }
        }
      }
    }

    res.json({
      filesChecked: files.length,
      issuesFound: issues.length,
      issues: issues.length > 0 ? issues.slice(0, 10) : []  // Show first 10
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

Call it:
```
GET http://localhost:3001/api/debug/check-section-types
```

Should return:
```json
{
  "filesChecked": 2,
  "issuesFound": 0,
  "issues": []
}
```

