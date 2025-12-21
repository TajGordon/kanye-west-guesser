# Architecture Analysis: Left/Right Panel Disconnect

## The Problem

```
User loads "love_lockdown" song
  ↓
Left panel shows: Raw lyrics from love_lockdown.txt
Right panel shows: Parsed lyrics from love_lockdown.json
  ↓
❌ MISMATCH: They don't match!
  ↓
Questions:
- Which is source of truth?
- If user edits left, what happens to right?
- If user edits right, what happens to left?
- How do they stay in sync?
- What gets saved?
```

### Why This Happens

1. **Two separate files**: `.txt` (raw) and `.json` (structured)
2. **Two separate load paths**: Server loads both independently
3. **No sync mechanism**: No code ensures they match
4. **No clear ownership**: Which one is "the real data"?

This is a classic "dual source of truth" anti-pattern in software.

---

## Current System (Problematic)

```
love_lockdown.txt          love_lockdown.json
(raw lyrics)               (parsed lyrics + metadata)
     ↓                            ↓
Left Panel ←→ Right Panel
(read from .txt)           (read from .json)
     ↓                            ↓
Independent edits          Independent edits
     ↓                            ↓
Save to .txt               Save to .json
     ↓                            ↓
❌ OUT OF SYNC
```

---

## Best Practice Solutions

### SOLUTION #1: Left Panel is Source of Truth (Simplest)

**Concept**: Right panel is just a UI for editing the left panel text. Everything derives from left.

```
love_lockdown.txt (SINGLE SOURCE OF TRUTH)
     ↓
Parse on load
     ↓
Left Panel (editable)  →  Auto-parse on change  →  Right Panel (editable UI)
     ↓
Save back to .txt
     ↓
✅ Always in sync
```

**How it works**:
1. Load `.txt` file
2. Display raw text in left panel
3. Parse it → show structured view in right panel
4. **User edits EITHER side**:
   - Edit left → auto-parse → update right
   - Edit right → serialize back → update left
5. Save .txt file (derive JSON from TXT on demand)

**Pros**:
- ✅ Simple mental model (one source)
- ✅ Eliminates sync issues
- ✅ Undo/redo easier (track text changes)
- ✅ Git-friendly (text-based)

**Cons**:
- ❌ Right panel edits must serialize back to text format
- ❌ Parsing must be reversible
- ❌ Metadata-only fields (like release info) need separate handling

**Mainstream use**: Git (text is source), VS Code (file is source)

**Effort to implement**: Medium (1-2 hours)

---

### SOLUTION #2: JSON is Source, Always Regenerate Right Panel (Best for Rich Data)

**Concept**: JSON contains everything. Right panel is always regenerated from JSON on load.

```
love_lockdown.json (SINGLE SOURCE OF TRUTH)
{
  rawText: "[Verse 1]\nI'm not loving you...",
  lyrics: [{ content: "I'm not loving you...", section: {...} }],
  metadata: { title, artist, release: {...} }
}
     ↓
Left Panel: Display rawText as editable textarea
Right Panel: Display parsed lyrics (generated from rawText)
     ↓
User edits left
     ↓
debouncedParse(rawText) → regenerate lyrics array
     ↓
Save to JSON (rawText + regenerated lyrics)
     ↓
✅ Always in sync
```

**How it works**:
1. Single `.json` file with both `rawText` and `lyrics`
2. Left = JSON.rawText (editable)
3. Right = regenerated from rawText on each edit
4. When saving, only need to save JSON
5. No separate `.txt` file needed

**Pros**:
- ✅ Single file format (easier deployment)
- ✅ Metadata stays with lyrics
- ✅ Clear single source of truth
- ✅ No file sync issues
- ✅ Easy to track full history

**Cons**:
- ❌ Removes .txt file format (users can't easily read raw)
- ❌ Requires JSON as interchange format
- ❌ Parser must be very accurate

**Mainstream use**: Modern web apps (Notion, Figma - everything in one doc)

**Effort to implement**: Low-Medium (1 hour)

---

### SOLUTION #3: Bidirectional Sync with Priority (Flexible)

**Concept**: Both sources exist, but changes to one immediately update the other.

```
love_lockdown.txt    ←→    love_lockdown.json
     ↓                            ↓
Left Panel                    Right Panel
     ↓                            ↓
User edits left
     ↓
Auto-parse → regenerate JSON
     ↓
Save BOTH files
     ↓
User edits right
     ↓
Serialize back → regenerate TXT
     ↓
Save BOTH files
```

**How it works**:
1. Keep both files (users can use either)
2. Left edits → regenerate JSON → save both
3. Right edits → serialize text → save both
4. Server validates they match on load, warns if mismatch

**Pros**:
- ✅ Users can access raw text
- ✅ Both formats available
- ✅ Flexible editing approaches
- ✅ Good for migration scenarios

**Cons**:
- ❌ Complex sync logic
- ❌ Still possible to get out of sync
- ❌ More code to maintain

**Mainstream use**: Systems with multiple export formats

**Effort to implement**: Medium (1.5-2 hours)

---

### SOLUTION #4: Derived JSON from TXT on Load (No Storage)

**Concept**: Never store parsed JSON. Always parse from TXT when needed.

```
love_lockdown.txt (ONLY FILE)
     ↓
On load:
  - Load .txt
  - Parse to JSON in memory
  - Show left + right panels from same data
  - User edits left
  - Live regenerate right from left
  - Save to .txt
     ↓
✅ Always in sync (only one file exists)
```

**How it works**:
1. Delete `.json` files entirely
2. Keep only `.txt` with raw lyrics
3. On load: parse TXT → get lyrics array
4. Store metadata in separate JSON (optional)
5. Live parse on edit
6. Save as `.txt` + optional metadata JSON

**Pros**:
- ✅ Simplest (one file type)
- ✅ No sync possible (only one source)
- ✅ Users see what they get
- ✅ Small file sizes

**Cons**:
- ❌ Metadata harder to store
- ❌ Release info lives separately
- ❌ Requires good parser

**Mainstream use**: Markdown editors, code editors

**Effort to implement**: Low (30 min - just refactor to not load .json)

---

### SOLUTION #5: Event-Driven Sync with Conflict Resolution

**Concept**: Separate data sources, but sync via events + conflict detection.

```
love_lockdown.txt          love_lockdown.json
     ↓                            ↓
Left Panel                    Right Panel
     ↓                            ↓
User edits left
     ↓
Emit "textChanged" event
     ↓
Sync handler:
  - Update JSON
  - Check for conflicts
  - If mismatch → warn user
  - Regenerate both
     ↓
Save both files
```

**How it works**:
1. Keep both files
2. Track version/checksum for both
3. On edit → regenerate other
4. On load → compare checksums
5. If mismatch → show conflict resolution UI
6. User chooses: keep left, keep right, or merge

**Pros**:
- ✅ Handles corruption gracefully
- ✅ Good audit trail
- ✅ Users can choose which version to trust
- ✅ Good for collaborative scenarios

**Cons**:
- ❌ Complex conflict handling
- ❌ More UI (conflict dialog)
- ❌ More code

**Mainstream use**: Git, Google Docs (handles simultaneous edits)

**Effort to implement**: High (3+ hours)

---

## Comparison Matrix

| Solution | Sync | Complexity | Files | Source of Truth | Best For |
|----------|------|------------|-------|-----------------|----------|
| #1: Left is source | Auto | Low | .txt | Left (text) | Text-first workflows |
| #2: JSON is source | Auto | Low | .json | JSON (single) | Structured data |
| #3: Bidirectional | Manual | Medium | Both | Explicit priority | Flexible workflows |
| #4: Derived JSON | N/A | Very Low | .txt only | Text | Simplicity |
| #5: Event-driven | Auto | High | Both | Conflict resolution | Robustness |

---

## Recommendation: Solution #2 (Best Practice)

**Why?** Combines simplicity with robustness.

```javascript
// Single JSON file structure
{
  // Identity
  title: "Love Lockdown",
  artist: "Kanye West",
  
  // Metadata
  release: {
    project: "808s & Heartbreak",
    year: 2008,
    formats: ["album"],
    status: "official"
  },
  
  // RAW TEXT (Source of Truth for lyrics)
  rawText: "[Verse 1]\nI'm not loving you way I wanted to\n...",
  
  // PARSED LYRICS (Derived from rawText on each edit)
  lyrics: [
    {
      line_number: 1,
      content: "I'm not loving you way I wanted to",
      section: { type: "verse", number: 1 },
      voice: { id: "kanye-west", display: "Kanye West" }
    },
    // ... more lines
  ]
}
```

**Data flow**:
```
Load: JSON → split into left (rawText) + right (lyrics)
Edit left: re-parse rawText → regenerate lyrics
Edit right: serialize to text → update rawText  
Save: JSON (with both rawText + lyrics)
```

**Implementation**:
1. ✅ Already loading .txt into JSON as `rawText` field (GOOD!)
2. ✅ Keep parsed `lyrics` array in JSON
3. ✅ Left panel edits = update `rawText`
4. ✅ Auto-parse = regenerate `lyrics` from `rawText`
5. ✅ Save = save entire JSON
6. ✅ Delete `.txt` files (optional, or keep as backup)

---

## Secondary Recommendation: Solution #1 (Simplest)

If you want the absolute minimum complexity:

**Just trust the left panel**:
```javascript
1. Load .txt file into left panel
2. Parse on display → show in right panel
3. User edits left or right
4. Always regenerate right from left
5. Save to .txt only
6. Delete .json files
```

**Why simpler?**
- No separate .json to maintain
- Can't get out of sync (only one file)
- Users always have readable text
- Like VS Code or any text editor

---

## What NOT To Do

### ❌ Keep Current System
- Two independent files
- Two independent data sources
- No sync mechanism
→ **Will always be out of sync**

### ❌ Manually sync
- "User, please keep them in sync"
→ **User experience is bad**

### ❌ Try to merge at load time
- Load both, compare, auto-merge
→ **Impossible to know which is correct**

### ❌ Show both but claim they're synced when they're not
- Confusing UX
→ **Users get frustrated**

---

## Quick Decision Guide

**Choose Solution #1 (Left is Source)** if:
- ✅ Users want to edit raw text primarily
- ✅ You want simplicity
- ✅ Metadata is secondary

**Choose Solution #2 (JSON is Source)** if:
- ✅ Rich metadata is important
- ✅ You want single file format
- ✅ Long-term maintainability matters
- ✅ Future features might need more structure

**Choose Solution #4 (Derived Only)** if:
- ✅ Maximum simplicity
- ✅ No need for pre-parsed cache
- ✅ Parser is fast enough

**Choose Solution #3 or #5** only if:
- ✅ You need both formats in production
- ✅ Users edit both simultaneously
- ✅ You have resources for complexity

---

## Next Steps

1. **Pick a solution** (I recommend #2)
2. **Implement it** (refactor data flow)
3. **Update UI** (clarify what's editable)
4. **Add validation** (ensure left/right match)
5. **Test sync** (edit both sides, verify sync)

---

**Status**: Analysis Complete - Ready for Implementation
