# Detailed Diagnostic and Fix Plan: Re-Process Flow & Section Numbering Issues

## Executive Summary

You've identified three interconnected failures in the parse-and-render flow:

1. **Re-process button doesn't update anything** - Clicking doesn't change structured view or JSON
2. **All lines show as "Verse 1"** - Every line in structured view shows type:verse, number:1
3. **Raw text colors don't distinguish numbers** - All verses appear same color (should vary by verse number)

**Root Causes Identified**:
- Parse endpoint returns `data.lines` but component expects normalized structure
- Section numbers not being extracted correctly from headers
- Color system uses type only, not type+number composite

---

## Stage 1: Investigating the Parse Flow

### Current Flow Analysis

```
User edits raw text "Verse 3"
    ↓
Click "Re-process" button
    ↓
handleReprocessRawText() called
    ↓
fetch('/api/parse') with raw text
    ↓
Server parses and returns {lines: [...], allLines: [...]}
    ↓
setSong(prev => ({...prev, lyrics: data.lines}))
    ↓
Component re-renders
    ↓
But structured view still shows "Verse 1"
    ↓
??? Something isn't working
```

### Issue Investigation

**Question 1**: Is the parse endpoint correctly extracting section numbers?

Let me check what the parser returns:

```javascript
// From server.js line 215-330
const parseSection = (headerLine) => {
  // Patterns match: [Verse 1], [Verse 2], etc.
  const squareMatch = headerLine.match(/^\[(\w+(?:\s+\w+)?)\s*(\d*)\s*(?:[-:](.+))?\]$/i);
  
  if (squareMatch) {
    const [, typeStr, num, extra] = squareMatch;
    return {
      type: typeStr.toLowerCase(),
      number: num ? parseInt(num) : 1,  // ← Should extract "1", "2", "3"
      originalText: headerLine
    };
  }
  // ... other patterns
};
```

**Hypothesis**: Parser probably works correctly (it extracts numbers).

**Question 2**: Is the component receiving the parsed data correctly?

```javascript
// From LyricsEditor.jsx line 170-185
const res = await fetch('/api/parse', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text })
});
const data = await res.json();

setSong(prev => ({
  ...prev,
  lyrics: data.lines || []
}));
```

**Hypothesis**: If `data.lines` contains correct numbers, they should appear. But they don't.

**Question 3**: Why doesn't structured view update?

Let me trace the rendering:

```javascript
// groupLinesBySection uses linesToSections
const groupLinesBySection = useCallback(() => {
  const sections = linesToSections(song.lyrics);  // Should produce [{type, number, lines}]
  return sections.map((section) => ({
    sectionKey: `${section.type}-${section.number}`,
    section: { type: section.type, number: section.number },
    // ...
  }));
}, [song?.lyrics]);
```

**Hypothesis**: If linesToSections is working, and song.lyrics has correct numbers, it should display correctly. So either:
1. Parser isn't extracting numbers (unlikely)
2. Song state isn't updating (possible)
3. Component isn't re-rendering (possible)
4. linesToSections is broken (likely)

---

## Stage 2: Deep Dive - The Actual Problems

### Problem A: Parser Numbers Not Being Extracted

**Diagnostic**: Check what the server actually returns

Add console logging to parser:

```javascript
// server.js around line 260
for (const line of lines) {
  const section = parseSection(line);
  if (section) {
    console.log(`[PARSE] Found section: type="${section.type}", number=${section.number}, originalText="${section.originalText}"`);
    currentSection = section;
    continue;
  }
}
```

**Expected Output** (for "Verse 1", "Verse 2", "Verse 3"):
```
[PARSE] Found section: type="verse", number=1, originalText="[Verse 1]"
[PARSE] Found section: type="verse", number=2, originalText="[Verse 2]"
[PARSE] Found section: type="verse", number=3, originalText="[Verse 3]"
```

**If you see number=1 for all**: The regex isn't extracting numbers correctly.

### Problem B: Component Not Receiving Updated Data

**Diagnostic**: Add logging to parse callback:

```javascript
// LyricsEditor.jsx around line 180
.then(data => {
  console.log(`[PARSE] Received ${data.lines?.length} lines`);
  console.log(`[PARSE] First line section:`, data.lines?.[0]?.section);
  setSong(prev => ({
    ...prev,
    lyrics: data.lines || []
  }));
})
```

**Expected Output**:
```
[PARSE] Received 36 lines
[PARSE] First line section: {type: "verse", number: 1, ...}
```

**If section shows number:1 for all lines**: Parse endpoint is the problem.

### Problem C: linesToSections Not Grouping Correctly

**Diagnostic**: Add logging to dataModel:

```javascript
// dataModel.js linesToSections function
export function linesToSections(lyrics) {
  const groups = {};
  
  lyrics.forEach(line => {
    const key = `${line.section?.type}-${line.section?.number}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(line);
  });
  
  console.log(`[linesToSections] Found sections:`, Object.keys(groups));
  
  // Rest of function...
}
```

**Expected Output**:
```
[linesToSections] Found sections: ["verse-1", "chorus-1", "verse-2", ...]
```

**If you see only ["verse-1"]**: Numbers aren't in the data.

---

## Stage 3: The Color System Problem

### Raw Text Colors Issue

**Current**: All verses appear same color in raw text (should vary?)

**Actually**: Let me re-read the code...

Looking at `RawTextEditor.jsx`:

```javascript
const getColorForSectionType = (sectionType) => {
  const type = (sectionType || '').toLowerCase().replace(/\s+/g, '-');
  return SECTION_TYPE_COLORS[type] || '#888888';
};

// Detects:
const sectionMatch = line.match(/^\[(\w+(?:\s+\w+)?)\s+(\d+)\]$/i);
if (sectionMatch) {
  const [, typeStr, num] = sectionMatch;
  currentSectionType = typeStr.toLowerCase().replace(/\s+/g, '-');
  currentColor = getColorForSectionType(currentSectionType);
```

**Issue**: `typeStr` extracts only "Verse", not "Verse 1" or "Verse 2". The `num` is extracted but never used for coloring!

**Expected (to differentiate by number)**:
```javascript
const colorKey = `${typeStr.toLowerCase()}-${num}`;
currentColor = SECTION_COLORS[colorKey] || getColorForSectionType(typeStr);
```

---

## Comprehensive Fix Plan

### Phase 1: Diagnose (15 minutes)

**Step 1.1**: Add logging to server parser
- File: `server.js` line 280-330
- Add console.log in parseSection and loop
- Purpose: Verify numbers are being extracted

**Step 1.2**: Add logging to client parse handler  
- File: `LyricsEditor.jsx` line 170-185
- Log data.lines structure
- Purpose: Verify data received from server

**Step 1.3**: Add logging to linesToSections
- File: `dataModel.js` 
- Log section grouping
- Purpose: Verify grouping is correct

**Step 1.4**: Test with "bad news"
- Change "Verse 1" to "Verse 3" in raw text
- Click Re-process
- Open console
- Check all three logging outputs

**Expected outputs**:
```
[PARSE] Found section: type="verse", number=3
[PARSE] Received 20 lines
[PARSE] First line section: {type: "verse", number: 3}
[linesToSections] Found sections: ["verse-3", "chorus-1", ...]
```

If you see these → Problem is in rendering (Stage 2)
If you don't → Problem is in parsing (Stage 1)

---

### Phase 2: Fix Parser if Needed (10 minutes)

**If parser isn't extracting numbers:**

**Issue**: Regex might not be matching "[Verse 3]" format

**Fix**: Update parseSection regex

```javascript
// Current (line 241):
const squareMatch = headerLine.match(/^\[(\w+(?:\s+\w+)?)\s*(\d*)\s*(?:[-:](.+))?\]$/i);

// Problem: \s* between type and number means optional space
// "[Verse 3]" → type="Verse", num="3" ✓ Should work
// "[Verse3]" → type="Verse3", num="" ✗ Number not extracted

// Fix: Make space required if number follows
const squareMatch = headerLine.match(/^\[(\w+(?:\s+\w+)?)\s+(\d+)(?:\s*[-:](.+))?\]$/i);
//                                                         ↑ \s+ (required space)
//                                                         ↑ (\d+) (required digits)
```

**Also check**: The colon pattern (line 285) might have same issue.

---

### Phase 3: Fix Rendering Logic (20 minutes)

**If data is correct but rendering is wrong:**

**Issue 1**: groupLinesBySection isn't using section numbers

**Current**:
```javascript
const groupLinesBySection = useCallback(() => {
  const sections = linesToSections(song.lyrics);
  return sections.map((section) => ({
    sectionKey: `${section.type}-${section.number}`,
    section: { type: section.type, number: section.number },
    lines: section.lines.map((line, idx) => ({
      line,
      index: song.lyrics.findIndex(
        (l) => l.line_number === line.line_number && l.content === line.content
      )
    })),
    startIndex: section.lines[0]?.line_number || 0
  }));
}, [song?.lyrics]);
```

**Problem**: Uses linesToSections correctly, but rendering might override it.

**Check**: The rendering code that displays headers:

```javascript
<div className="section-title">
  {formatSectionName(group.section?.type)} {group.section?.number}
</div>
```

**If this shows correct number**: Rendering is fine.

**Issue 2**: formatSectionName might be corrupting the number

```javascript
const formatSectionName = useCallback((sectionType) => {
  // DEFENSIVE: Handle old format like "verse-2" by splitting only on first dash
  let displayName = sectionType;
  if (sectionType.includes('-')) {
    const parts = sectionType.split('-');
    // Only use the first part (the actual type name)
    displayName = parts[0];
  }
  
  return displayName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-');
}, []);
```

This looks correct. It gets `section.type` (e.g., "verse"), not the combined key.

**Issue 3**: linesToSections might be returning wrong structure

Check: Does it preserve section.number?

```javascript
export function linesToSections(lyrics) {
  const sections = [];
  let currentSection = null;

  lyrics.forEach((line) => {
    if (line.meta?.blank) return;
    if (!line.section) return;

    const sectionKey = `${line.section.type}-${line.section.number}`;
    
    if (!currentSection || currentSection.key !== sectionKey) {
      currentSection = {
        key: sectionKey,
        type: line.section.type,       // ← Gets type
        number: line.section.number,   // ← Gets number
        lines: []
      };
      sections.push(currentSection);
    }

    currentSection.lines.push({
      line_number: line.line_number,
      content: line.content,
      voice: line.voice,
      meta: line.meta
    });
  });

  return sections;
}
```

This looks correct. It should preserve numbers.

---

### Phase 4: Fix Raw Text Colors (15 minutes)

**Issue**: Raw text colors don't use section numbers

**Current** (RawTextEditor.jsx line 66-71):
```javascript
const sectionMatch = line.match(/^\[(\w+(?:\s+\w+)?)\s+(\d+)\]$/i);

if (sectionMatch) {
  const [, typeStr, num] = sectionMatch;
  currentSectionType = typeStr.toLowerCase().replace(/\s+/g, '-');
  currentColor = getColorForSectionType(currentSectionType);
  // ↑ Uses only typeStr, ignores num
```

**Fix**: Use composite color key if needed

Option A: Keep same color for all verses (current behavior)
```javascript
// Keep as is - all verses blue, all choruses orange
currentColor = getColorForSectionType(currentSectionType);
```

Option B: Different colors for different numbers (your request)
```javascript
// Would need a new color palette with 9+ entries per type
const EXTENDED_COLORS = {
  'verse-1': '#5eb3ff',    // Blue
  'verse-2': '#4a9edc',    // Darker blue
  'verse-3': '#3589c4',    // Even darker
  'chorus-1': '#ffb74d',   // Orange
  'chorus-2': '#ff9500',   // Darker orange
  // ...
};
currentColor = EXTENDED_COLORS[`${typeStr.toLowerCase()}-${num}`] || getColorForSectionType(typeStr);
```

**My Recommendation**: Keep Option A (same color per type).
- Simpler to understand
- Matches professional editors (Lyrics Master, MasterWriter)
- Different verse numbers still distinguished by headers
- Adding more colors creates visual clutter

---

## Dependency Analysis: How Stages Influence Each Other

```
Stage 1 (Parser extraction)
    ↓ MUST work for Stages 2-4 to work
    ↓
Stage 2 (Component receives data)
    ↓ MUST work for Stage 3 to work
    ↓
Stage 3 (Rendering displays numbers)
    ↓ DEPENDS on Stage 1 & 2
    ↓
Stage 4 (Raw text colors)
    ↓ INDEPENDENT of Stages 1-3 (can be fixed anytime)
```

**Critical Path**: 1 → 2 → 3

If Stage 1 fails, Stages 2 and 3 are impossible.
If Stage 2 fails, Stage 3 is impossible.
Stage 4 can work even if Stages 1-3 fail.

---

## Execution Plan

### Step 1: Add Diagnostics (5 min)
```javascript
// server.js line 280
console.log(`[PARSE] Header: "${line}" → type="${section.type}", number=${section.number}`);

// LyricsEditor.jsx line 181
console.log(`[PARSE] Got ${data.lines.length} lines, section numbers:`, 
  data.lines.map(l => `${l.section.type}-${l.section.number}`).slice(0, 5));

// dataModel.js linesToSections
console.log(`[linesToSections] Grouping:`, sections.map(s => `${s.type}-${s.number}`));
```

### Step 2: Run Test (2 min)
- Open bad news
- Change first section to "Verse 5"
- Click Re-process
- Open console
- Read all three logs

### Step 3: Based on Results

**If all logs show correct numbers**:
- Problem is in component rendering
- Check that groupLinesBySection and rendering logic match

**If parser log shows number=1**:
- Fix parser regex (Stage 2)
- Re-test

**If component doesn't receive updated data**:
- Check that setSong is working
- Verify component re-renders

### Step 4: Implement Fixes
- Apply appropriate fixes from Phase 2-4
- Remove diagnostic logs
- Test with multiple songs

### Step 5: Verify
- Load "bad news", edit sections, re-process
- Verify all three issues resolved:
  1. ✓ Structured view updates
  2. ✓ Section numbers display correctly
  3. ✓ (Optional) Raw text colors by number

---

## Expected Outcomes

### When All Fixes Applied:

**Bad News (or any song) → Change raw text:**
```
Before:
[Verse 1]
...content...

After re-process:
[Verse 1]
...content...
```

**Structured View Shows**:
```
[Verse 1 header]     ← Shows number 1
Line 1 (blue border)
Line 2 (blue border)

[Chorus 1 header]    ← Shows number 1
Line 1 (orange border)

[Verse 2 header]     ← Shows number 2 (NOT 1!)
Line 1 (blue border)
Line 2 (blue border)
```

**JSON** (`song.lyrics[0].section`):
```json
{
  "type": "verse",
  "number": 1,
  "originalText": "[Verse 1]"
}
```

---

## Gotchas & Edge Cases

### Gotcha 1: Section Number Parsing

If header is "[Verse]" (no number), parser sets number=1. ✓ Correct.

If header is "[Verse 0]", should this be valid?
- Current: Sets number=0
- Better: Set to 1 (zero doesn't make sense)
- Fix: Add validation: `number: Math.max(1, parseInt(num) || 1)`

### Gotcha 2: Mixed Formats

If song has both "[Verse 1]" and "Verse 1:" (different formats), parser needs to handle both.

Current parser handles 3 formats:
1. Square brackets: [Verse 1]
2. Parentheses: (Verse 1)
3. Colon: Verse 1: or Verse 1 -

Check these all work.

### Gotcha 3: Section Normalization

The `normalizeSectionInPlace` function might corrupt numbers:

```javascript
if (typeof section.type === 'string' && section.type.includes('-')) {
  const parts = section.type.split('-');
  const lastPart = parts[parts.length - 1];
  
  if (/^\d+$/.test(lastPart)) {
    // "verse-2" → type="verse", number=2
    section.type = parts.slice(0, -1).join('-');
    section.number = parseInt(lastPart);
  }
}
```

This is GOOD - it converts old format to new. But it should already be in new format from parser.

---

## Success Criteria

After implementing fixes:

1. **Re-process works**
   - [ ] Change "Verse 1" to "Verse 5" in raw text
   - [ ] Click Re-process
   - [ ] Structured view updates immediately
   - [ ] JSON shows number: 5

2. **Section numbers display**
   - [ ] Structured view shows "Verse 1", "Verse 2", "Verse 3" (not all "Verse 1")
   - [ ] Headers are colored correctly
   - [ ] Verse 1 and Verse 2 are distinct sections

3. **Raw text colors** (optional)
   - [ ] Raw text shows different colors for different verses
   - [ ] Or (recommended) keep same color per type

---

This plan gives you a systematic way to identify and fix each issue while understanding how they depend on each other.
