# Implementation Guide: Fixing Re-Process & Section Numbering

Based on the diagnostic plan, this document contains the exact code changes needed to fix all three issues.

---

## Quick Reference: Which Issue to Fix

Run diagnostics first (see `REPROCESS_DIAGNOSTIC_PLAN.md`). Then:

**If console shows**:
- ✓ Parser numbers correct
- ✓ Component receives correct data
- ✓ linesToSections groups correctly
- ✗ Structured view shows all "Verse 1"

→ **Problem**: Rendering/display logic
→ **Fix Location**: LyricsEditor.jsx rendering code

---

**If console shows**:
- ✓ Parser extracts numbers
- ✗ Component receives number=1 for all
- ✗ linesToSections groups as verse-1 only

→ **Problem**: Data not propagating to component
→ **Fix Location**: Check setSong, component state

---

**If console shows**:
- ✗ Parser shows number=1 for all sections
- ✗ Component receives number=1 for all
- ✗ linesToSections groups as verse-1 only

→ **Problem**: Parser not extracting numbers
→ **Fix Location**: server.js parseSection function

---

## Fix 1: Parser Section Number Extraction

**File**: `question_generator/lyrics_generator/server.js`

**Issue**: Regex might not correctly extract numbers from headers like "[Verse 3]"

### Change 1.1: Fix Square Bracket Pattern (Line ~241)

```javascript
// BEFORE (line 241):
const squareMatch = headerLine.match(/^\[(\w+(?:\s+\w+)?)\s*(\d*)\s*(?:[-:](.+))?\]$/i);

// AFTER:
const squareMatch = headerLine.match(/^\[(\w+(?:\s+\w+)?)\s+(\d+)\s*(?:[-:](.+))?\]$/i);
//                                                          ↑ Changed \s* (\d*) to \s+ (\d+)
//                                                          ↑ Requires space and at least one digit
```

**Why**: 
- `\s*` (optional space) + `\d*` (optional digits) too permissive
- `[Verse3]` would match as type="Verse3", num=""
- `\s+` (required space) + `\d+` (required digits) ensures "[Verse 3]" → type="Verse", num="3"

### Change 1.2: Fix Colon Pattern (Line ~285)

```javascript
// BEFORE (line 285):
const colonMatch = headerLine.match(/^(\w+(?:\s+\w+)?)\s*(\d*)\s*(?:[-:](.+))?$/i);
if (colonMatch && (headerLine.includes(':') || headerLine.includes('-'))) {
  const [, typeStr, num, extra] = colonMatch;

// AFTER:
const colonMatch = headerLine.match(/^(\w+(?:\s+\w+)?)\s+(\d+)\s*[-:](.+)$/i);
if (colonMatch) {
  const [, typeStr, num, extra] = colonMatch;
//    Pattern requires: space, digits, and colon/dash
```

**Why**: Make patterns consistent and strict.

### Change 1.3: Add Section Number Validation

Around line 320, after parsing each section:

```javascript
// Add this validation:
if (!section.number || section.number < 1) {
  section.number = 1;  // Default to 1 if missing
}
```

### Verification
After changes, test with:
```
Input: "[Verse 3]"
Expected: {type: "verse", number: 3}

Input: "[Pre-Chorus 2]"  
Expected: {type: "pre-chorus", number: 2}

Input: "[Verse]" (no number)
Expected: {type: "verse", number: 1}
```

---

## Fix 2: Component State Update & Re-Rendering

**File**: `question_generator/lyrics_generator/client/src/components/LyricsEditor.jsx`

**Issue**: Component may not be re-rendering when song.lyrics updates

### Change 2.1: Ensure State Update Triggers Re-render

Around line 200-215, `handleReprocessRawText`:

```javascript
// BEFORE:
const handleReprocessRawText = useCallback(() => {
  const textToParse = rawTextInput !== null ? rawTextInput : buildDisplayText();
  // ... fetch and setSong

// AFTER (add key to force re-render):
const handleReprocessRawText = useCallback(() => {
  const textToParse = rawTextInput !== null ? rawTextInput : buildDisplayText();
  
  fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: textToParse })
  })
  .then(res => {
    if (!res.ok) throw new Error('Parse failed');
    return res.json();
  })
  .then(data => {
    // Add validation
    if (!data.lines || !Array.isArray(data.lines)) {
      throw new Error('Invalid response: missing lines');
    }
    
    // Force new object reference
    setSong(prev => {
      const newSong = {
        ...prev,
        lyrics: [...data.lines]  // ← Force new array reference
      };
      console.log(`[Re-process] Updated song with ${newSong.lyrics.length} lines`);
      return newSong;
    });
    setIsParsingDebounced(false);
  })
  .catch(err => {
    console.error('Parse error:', err);
    setParseError(err.message);
    setIsParsingDebounced(false);
  });
}, [rawTextInput, buildDisplayText, setSong]);
```

### Change 2.2: Verify Parse Callback (Lines 160-190)

Make sure `debouncedParse` has same pattern:

```javascript
const debouncedParse = useCallback((text) => {
  setIsParsingDebounced(true);
  setParseError(null);

  if (parseTimeoutRef.current) {
    clearTimeout(parseTimeoutRef.current);
  }

  parseTimeoutRef.current = setTimeout(async () => {
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) throw new Error('Parse failed');
      const data = await res.json();

      // Add validation
      if (!data.lines || !Array.isArray(data.lines)) {
        throw new Error('Invalid response: missing lines');
      }

      setSong(prev => ({
        ...prev,
        lyrics: [...data.lines]  // ← Force new array reference
      }));
      setIsParsingDebounced(false);
    } catch (err) {
      console.error('Parse error:', err);
      setParseError(err.message);
      setIsParsingDebounced(false);
    }
  }, 300);
}, [setSong]);
```

---

## Fix 3: Rendering & Display Logic

**File**: `question_generator/lyrics_generator/client/src/components/LyricsEditor.jsx`

**Issue**: Section numbers might not be displaying even if data is correct

### Change 3.1: Verify groupLinesBySection (Around line 507)

```javascript
// Current (should work):
const groupLinesBySection = useCallback(() => {
  if (!song?.lyrics) return [];
  
  const sections = linesToSections(song.lyrics);
  
  return sections.map((section) => ({
    sectionKey: `${section.type}-${section.number}`,
    section: {
      type: section.type,
      number: section.number
    },
    lines: section.lines.map((line, idx) => {
      const originalIndex = song.lyrics.findIndex(
        (l) => l.line_number === line.line_number && l.content === line.content
      );
      return {
        line,
        index: originalIndex >= 0 ? originalIndex : idx
      };
    }),
    startIndex: section.lines[0]?.line_number || 0
  }));
}, [song?.lyrics]);
```

This looks correct. If it's not working, check that `linesToSections` is working:

### Change 3.2: Verify Section Header Rendering (Around line 635)

Look for section header rendering:

```javascript
{groupLinesBySection().map((group) => {
  const sectionColor = getLineColor(group.section);
  return (
    <div key={group.sectionKey} className="section-group-container">
      <div className="section-header-visual"
        style={{ borderLeftColor: sectionColor, backgroundColor: `${sectionColor}20` }}>
        <div className="section-title">
          {formatSectionName(group.section?.type)} {group.section?.number}
          {/* ↑ This should display correct number */}
        </div>
      </div>
      {/* Lines rendered below */}
    </div>
  );
})}
```

**If numbers aren't showing**: Check that `group.section.number` is defined.

Add debug logging:

```javascript
{groupLinesBySection().map((group) => {
  console.log(`Rendering section: ${group.section?.type}-${group.section?.number}, ${group.lines.length} lines`);
  // ... rest of code
})}
```

---

## Fix 4: Raw Text Color System (Optional)

**File**: `question_generator/lyrics_generator/client/src/components/RawTextEditor.jsx`

**Current**: All verses same color (probably your requirement)

**If you want different colors per number**:

### Change 4.1: Create Extended Color Palette

```javascript
// Add near top of file (after imports):
const SECTION_COLORS_EXTENDED = {
  'verse': ['#5eb3ff', '#4a9edc', '#3589c4'],       // Blues
  'chorus': ['#ffb74d', '#ff9500', '#e67e00'],      // Oranges
  'pre-chorus': ['#b47dff', '#9d6ae6', '#8661d9'], // Purples
  'bridge': ['#52ffb8', '#1ef5d0', '#00d4a8'],      // Cyans
};

const getColorForSection = (sectionType, number) => {
  const colors = SECTION_COLORS_EXTENDED[sectionType.toLowerCase()];
  if (!colors) return '#888888';
  
  // Cycle through colors or pick by number
  const colorIndex = (number - 1) % colors.length;
  return colors[colorIndex];
};
```

### Change 4.2: Update Decorator Logic

```javascript
// Around line 66, where section is detected:
const sectionMatch = line.match(/^\[(\w+(?:\s+\w+)?)\s+(\d+)\]$/i);

if (sectionMatch) {
  const [, typeStr, num] = sectionMatch;
  currentSectionType = typeStr.toLowerCase().replace(/\s+/g, '-');
  // currentColor = getColorForSectionType(currentSectionType);  // OLD
  currentColor = getColorForSection(currentSectionType, parseInt(num));  // NEW
```

**Recommendation**: Keep current system (same color per type). The extended colors add complexity and can make lyrics harder to read.

---

## Testing After Fixes

### Test Case 1: Basic Re-process

1. Open "bad news" (or any song)
2. Change first section header to "[Verse 5]"
3. Click "Re-process" button
4. Verify:
   - ✓ Structured view updates
   - ✓ Section shows "Verse 5" (not "Verse 1")
   - ✓ All lines in that section have number: 5

### Test Case 2: Multiple Sections

1. Load "love_lockdown"
2. Verify structured view shows:
   - ✓ "Verse 1" with 12 lines
   - ✓ "Chorus 1" with 4 lines
   - ✓ "Verse 2" with 12 lines
   - ✓ "Verse 3" with 12 lines
   - (NOT all showing "Verse 1")

### Test Case 3: Edit and Re-process

1. Load song
2. Edit raw text: change "Verse 2" to "Verse 7"
3. Click Re-process
4. Verify:
   - ✓ Structured view shows "Verse 7"
   - ✓ Line count correct for that section
   - ✓ No data loss

### Test Case 4: Console Check

With diagnostic logs in place:
```
[PARSE] sections found: 7
[linesToSections] Found sections: ["verse-1", "chorus-1", "verse-2", ...]
Rendering section: verse-1, 12 lines
Rendering section: verse-2, 12 lines
```

All showing correct numbers (not all 1).

---

## Rollback Plan

If fixes break anything:

1. **Revert server.js regex changes**
   - Go back to original patterns
   - Unlikely to break things (patterns are more strict)

2. **Revert LyricsEditor changes**
   - Comment out setSong update
   - Restore original debouncedParse

3. **Check dataModel.js**
   - Should not need changes (working correctly)

Most likely issue: Parser regex changes. If reverted, all should work again.

---

## Success Indicators

After all fixes:

| Feature | Before | After |
|---------|--------|-------|
| Re-process button | No effect | Updates structured view |
| Section headers | All "Verse 1" | Correct numbers |
| Section grouping | All grouped as verse-1 | Correct groups |
| JSON section.number | All 1 | Correct per section |
| Raw text colors | (same color by type) | (same, unless extended) |

---

## Priority

**Must Fix** (blocking use):
1. Fix 1: Parser section number extraction
2. Fix 2: Component state update
3. Fix 3: Display logic verification

**Should Fix** (improves UX):
4. Fix 4: Raw text colors (optional)

Estimated time: 30 minutes for all fixes + 10 minutes testing.
