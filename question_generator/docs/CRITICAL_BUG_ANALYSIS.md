# 🔴 Critical Bug Analysis: Why Screen Goes Blank

## Root Causes Identified

### 🐛 BUG #1: `setAllLines()` Undefined (FATAL)
**Location**: Line 327 in LyricsEditor.jsx
```javascript
useEffect(() => {
  try {
    if (!song?.lyrics || song.lyrics.length === 0) {
      setAllLines([]);  // ❌ UNDEFINED - This state var doesn't exist!
      return;
    }
    // ... code that builds rebuilt array
    setAllLines(rebuilt);  // ❌ Again tries to call undefined function
```

**Why It Breaks**: 
- `setAllLines` is never declared with `useState()`
- Was removed in our refactoring
- Calling undefined function throws error → component crashes
- Screen goes blank

**Impact**: Component crashes on every song load
**Severity**: 🔴 CRITICAL - Prevents ANY song from loading

---

### 🐛 BUG #2: Unused `allLines` State
**Location**: Line 305-309
```javascript
useEffect(() => {
  try {
    if (!song?.lyrics || song.lyrics.length === 0) {
      setAllLines([]);  // ❌ This whole useEffect is orphaned
      return;
    }
    // ... builds rebuilt array but never uses it
```

**Why It's Wrong**:
- The `rebuilt` array is created but never rendered
- It's not used anywhere in the component
- This entire useEffect is dead code

**Impact**: Wasted computation, confusing code structure
**Severity**: 🟡 HIGH - Dead code causes confusion

---

### 🐛 BUG #3: Conflicting `showImport` State
**Location**: Line 368
```javascript
{showImport && (
  <div className="import-panel-wrapper">
```

**Why It's Wrong**:
- Uses `showImport` state variable
- But `showImport` is never declared with `useState()`
- Should be local UI state for import panel toggle

**Impact**: Import panel toggle doesn't work, may cause errors
**Severity**: 🟡 HIGH - Feature broken

---

### 🐛 BUG #4: Missing `handleImportText` Function
**Location**: Line 384
```javascript
<button onClick={handleImportText}>Parse & Import</button>
```

**Why It's Wrong**:
- Calls `handleImportText()` function
- Function is never defined anywhere
- Button will error on click

**Impact**: Import functionality broken
**Severity**: 🟡 MEDIUM - Optional feature broken

---

## Architectural Problem: Conflicting Data Sources

### The Real Issue

Your clarification is key:
> "right panel is only to edit the song data, and the left panel represents the raw lyrics. so both are just interfaces for the underlying data."

**Our Implementation Got It Wrong**:

We created a situation where:
1. `rawText` is stored as editable state in song object
2. `lyrics` array is also stored in song object
3. We try to keep both in sync via `regenerateRawText()`

**The Problem**:
- If `rawText` is "the raw lyrics" (source of truth), it should NEVER be regenerated
- If `lyrics` array is the source of truth, `rawText` should be read-only/display-only
- By making both mutable and auto-syncing, we created a bidirectional coupling that's fragile

### What Should Happen Instead

**Architecture Option A: JSON (lyrics array) is Source of Truth**
```
User Input → Component Logic → song.lyrics (stored)
                            → song.rawText (DERIVED, regenerated on display)

Flow:
- Edit left panel text → parse to song.lyrics
- Edit right panel data → update song.lyrics directly
- Both panels update from song.lyrics
- rawText is computed view, never stored in database
```

**Architecture Option B: Raw Text is Source of Truth**
```
User Input → Component Logic → song.rawText (stored)
                            → song.lyrics (DERIVED, parsed on load)

Flow:
- Edit left panel text → update song.rawText
- Edit right panel data → NO DIRECT UPDATE, parse rawText instead
- Right panel is read-only OR complex two-way binding
- rawText is the immutable source
```

**Current Broken Architecture**:
```
Edit Left → song.rawText, then parse → song.lyrics
Edit Right → song.lyrics, then regenerate → song.rawText
Problem: Both are mutable, both are synced, either can be out of sync
Result: Fragile, error-prone, causes regenerateRawText to be called everywhere
```

---

## Why regenerateRawText is Problematic

```javascript
const regenerateRawText = useCallback((lyrics) => {
  const lines = [];
  let lastSection = null;

  (lyrics || []).forEach(line => {
    const section = line.section;
    // Assumes section always has type and number
    const sectionChanged = !lastSection || 
      lastSection.type !== section.type || 
      lastSection.number !== section.number;
    
    if (sectionChanged) {
      // Assumes section.type exists and is a string
      const sectionLabel = `[${section.type.charAt(0).toUpperCase() + section.type.slice(1)} ${section.number}]`;
      lines.push(sectionLabel);
      lastSection = section;
    }
    lines.push(line.content);
  });

  return lines.join('\n');
});
```

**Issues**:
1. Assumes every line has a valid `section` object
2. If any line is missing `section.type` or `section.number`, charAt() fails
3. If `line.content` is undefined, joins meaningless values
4. Called every time right panel changes, creating performance issue
5. Makes code brittle - any data shape change breaks it

---

## The Core Design Question

**For robust automatic generation, which architecture is better?**

### Scenario 1: Auto-Generate Structured Data (Recommended)
- **Source**: `rawText` (user's original lyrics)
- **Derived**: `lyrics[]` (AI-parsed structure with sections, voices)
- **User Edits**:
  - Edit raw text → re-parse to get new structure
  - Edit structure → just update in-memory, don't update raw text
  - Save → save both (raw text + AI result)
- **For Auto-Generation**: 
  - Feed raw text to AI
  - Get back structured lyrics with voices, sections
  - Parse and set song.lyrics
  - Simple, one-way dependency

### Scenario 2: Auto-Generate Raw Text (Current Broken Attempt)
- **Source**: `lyrics[]` (structured data)
- **Derived**: `rawText` (regenerated representation)
- **User Edits**:
  - Edit structure → regenerate text
  - Edit text → parse back to structure
  - Problem: Regenerated text often looks weird/wrong
- **For Auto-Generation**:
  - Feed raw text to AI
  - Get back structured data
  - Set song.lyrics
  - Regenerate rawText... but it looks ugly/wrong
  - Problem: User edits raw text, loses formatting

---

## Recommendation: Switch to Architecture Option A

**Why**:
1. Simpler - one-way data flow
2. More robust - rawText is canonical
3. Better for auto-generation - feed text, get structure
4. Don't regenerate text from structure (it never looks as good as original)
5. Left panel is "source", right panel is "editing interface"

**Implementation**:
```javascript
// song.json structure:
{
  title: "Love Lockdown",
  artist: "Kanye West",
  rawText: "[Verse 1]\nI'm not loving you...",  // ← SOURCE
  lyrics: [                                       // ← DERIVED (parsed from rawText)
    {
      content: "I'm not loving you",
      section: { type: "verse", number: 1 },
      voice: { id: "kanye-west", display: "Kanye West" }
    },
    ...
  ]
}

// Component logic:
// Left Panel: Shows rawText
// - Edit left → update song.rawText → re-parse → update song.lyrics
// - No need for regenerateRawText()

// Right Panel: Shows song.lyrics
// - Edit right → update song.lyrics ONLY
// - Don't update song.rawText
// - Note: Left panel won't change (it's based on rawText)
// - This is CORRECT because right panel is editing the AI-parsed structure, not the original text

// Benefits:
// - If user switches to different AI parser, regenerate lyrics from same rawText
// - rawText never changes unless user explicitly edits left panel
// - Right panel is for fine-tuning AI results
// - Left panel is for raw lyrics
```

---

## Fix Strategy

### Immediate Fix (Get App Working)
1. Remove `setAllLines()` calls and the orphaned useEffect
2. Add missing `showImport` state declaration
3. Remove `regenerateRawText()` calls from right-panel edits
4. Test basic load and display

### Proper Fix (Implement Architecture A)
1. Remove `regenerateRawText()` function entirely
2. Stop calling it from right-panel edits
3. Right-panel edits only update `song.lyrics`
4. Accept that left and right panels show different things (that's OK!)
5. Document: "Left = raw lyrics, Right = AI structure for editing"

### Long-term (For Robust Auto-Generation)
1. Keep rawText as source
2. Have AI service parse rawText → return lyrics array
3. User can:
   - Edit left (rawText) → update right (re-parse)
   - Edit right (lyrics) → left stays same (it's the original)
4. Add "Regenerate from AI" button to re-parse left panel
5. Simple, clean, maintainable

---

## Summary Table

| Issue | Current | Problem | Solution |
|-------|---------|---------|----------|
| `setAllLines()` | Called but undefined | Crashes on load | Remove entire useEffect |
| `showImport` state | Not declared | Errors on toggle | Add useState |
| `regenerateRawText()` | Called everywhere | Fragile + buggy | Remove, accept asymmetry |
| Sync mechanism | Bidirectional | Complex + error-prone | One-way: rawText → lyrics |
| Data flow | Tangled | Hard to debug | Clear: left is source |
| Auto-generation | Regenerates text | Ugly results | Parse text instead |

---

## Decision Point

**Before fixing, confirm architecture:**

A. **Simple Fix**: Remove bugs, keep current attempt at sync (will still be fragile)
B. **Proper Fix**: Switch to one-way data flow (rawText → lyrics, no regenerate)
C. **Optimal Fix**: Same as B + remove goal of keeping left/right in sync (accept they're different views)

**Recommendation**: Option C is cleanest for auto-generation and future maintenance.
