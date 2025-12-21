# Lyrics Editor - Feature Requirements & Impact Analysis

## Feature List (Derived from User Comments)

### 1. **Auto-Populate Year from Project**
**User Intent:** "It should automatically assume the year the project was released"

**Current State:**
- Year field is manually entered
- No connection between project selection and year metadata
- Each song can have independent year despite project having canonical release date

**Requested Behavior:**
- When a project is selected, auto-fill the year field with the project's release year
- Allow manual override if song was released differently than project
- Handle "Create new..." project case gracefully

**Impact:**
- **Data Quality:** Medium - Reduces inconsistency; ensures songs from same project have matching years by default
- **UX Complexity:** Low - Add simple lookup in project database
- **Storage Impact:** None - year still stored per-song, allows flexibility
- **Workflow Change:** Reduces manual data entry; "New Song" → select project → year auto-fills

---

### 2. **Format Cascading from Project (with Override)**
**User Intent:** "When assigned to a project it should assume the format of the project, which can be overridden"

**Clarification:** "formats" = release medium (album, single, EP, mixtape, etc.)

**Current State:**
- Format is hardcoded or manually selected per-song
- No project-to-format relationship
- No mechanism for different songs in same project to have different formats

**Requested Behavior:**
- Store format metadata at project level (e.g., "808s & Heartbreak" → ["album"])
- When song assigned to project, inherit project's format(s)
- Allow song to override if needed (rare case: bonus track on album vs single version)
- Default for new projects: ["album"]

**Impact:**
- **Data Model:** Medium - Need to expand project metadata beyond just name/year
- **Database Schema:** Add `projects.json` or similar with `{ name, year, formats }`
- **UX Complexity:** Medium - Requires conditional dropdown logic
- **Backward Compatibility:** Important - existing projects have no format data
- **Workflow Change:** Select project → formats auto-load → can click override button

---

### 3. **Left Panel Text Becomes Editable**
**User Intent:** "The text on the left panel should be editable"

**Current State:**
- Left panel is read-only display of original lyrics + section headers
- Used for reference while editing right panel
- Shows credit lines and section headers grayed out

**Requested Behavior:**
- Make lyric text in left panel clickable/editable inline
- Section headers also editable (to fix auto-detected errors)
- Changes to left panel should sync to right panel lyrics
- Maintain scroll sync between panels during edits

**Impact:**
- **Complexity:** High
  - Need to handle bidirectional data flow (left↔right)
  - Potential for conflicting edits if user types in both panels
  - Sync scrolling becomes more important
  
- **UX Risk:** Confusion about what panels control
  - Left vs Right: which is source of truth?
  - Solution: Make left panel "source", right panel "editor" → left changes cascade to right
  
- **Performance:** Low impact if done naively; high if not debounced
  - Edits could trigger re-renders on both sides
  
- **Workflow Change:** Can now fix lyrics directly from original text side; no need to switch focus

---

### 4. **Smart Section Header Parsing**
**User Intent:** "It shouldn't assume that it will just say 'verse 2'... it might say 'chorus: Kanye West, Mr. Hudson & Kid Cudi'"

**Current State:**
- Parser uses regex: `/^\[(\w+)\s*(\d*)\]$/i`
- Only captures `[Type Number]` format
- Ignores complex headers with artist names, colons, commas, special info
- Returns only type + number to section metadata

**Failing Cases:**
- `[Chorus: Kanye West, Mr. Hudson & Kid Cudi]` → not matched, treated as lyric line
- `[Verse 1 - Intro]` → partial match or not matched
- `[Bridge - Transition]` → not matched
- `[Interlude: Skit]` → not matched

**Requested Behavior:**
- Parse complex header formats
- Extract: type, number, artists/collaborators, notes
- Store full original header text for reference
- Provide UI to edit/split headers if auto-detect fails

**Impact:**
- **Parsing Complexity:** High
  - Need flexible regex or state machine approach
  - Decide: extract artists separately or keep in one field?
  - Handle ambiguous cases (is "Kanye" part of header or next line?)
  
- **Data Model:** Medium
  - Expand section schema: `{ type, number, artists: [], notes: "", originalText: "" }`
  - Current: `{ type, number, label }`
  
- **UX Complexity:** Medium-High
  - Show extracted artists in bulk edit dropdown
  - Header editor modal for manual fixes
  - Visual feedback when parse succeeds/fails
  
- **Quality:** High - This is the biggest pain point visible in love_lockdown.json
  - Lines 29-37 show garbage data (ticket promotions, "related songs")
  - Lines 38-41+ repeat chorus but with wrong artists
  - Need better section boundary detection

---

### 5. **Fix Load Song Endpoint** (Lower Priority)
**User Intent:** "The load song isn't really working but that isn't the main priority"

**Current State:**
- `/api/songs/:name` endpoint exists and returns JSON
- Frontend `SongLoader` component fetches file list
- `handleLoadSong` tries to fetch song by name

**Known Issues:**
- Unknown failure mode (likely):
  - File names don't match dropdown display
  - Filenames have sanitization issues
  - Songs list shows but click → 404
  
**Requested Fix:**
- Debug why click → no load
- Probably filename mismatch between display and file system
- Lower priority than other features

**Impact:**
- **UX:** Blocks save/load workflow; users can only create new songs
- **Severity:** Medium (workaround: manually edit JSON files)
- **Debugging:** Need to add console logging to identify exact failure

---

## Summary Table

| Feature | Complexity | Data Model Impact | UX Impact | Priority |
|---------|-----------|-------------------|-----------|----------|
| Auto-populate year from project | Low | Low | Low | High |
| Format cascading | Medium | Medium | Medium | High |
| Left panel editable | High | Low | High | Medium |
| Smart header parsing | High | Medium | Medium | High |
| Fix load endpoint | Low | None | Medium | Low |

---

## Implementation Order Recommendation

1. **Auto-populate year** (quick win, unblocks project workflow)
2. **Format cascading** (closely related to year; same data flow)
3. **Fix load endpoint** (restores save/load workflow)
4. **Smart header parsing** (highest quality impact; complex but isolated)
5. **Left panel editable** (most complex; lowest user impact; can be deferred)

---

## Data Model Changes Required

### Current Project Model (implicit)
```javascript
{
  name: string  // e.g., "808s & Heartbreak"
}
```

### New Project Model (required)
```javascript
{
  name: string,           // "808s & Heartbreak"
  year: number,           // 2008
  formats: string[],      // ["album"]
  released: Date?,        // optional official release date
  artists: string[]       // ["Kanye West"] for completeness
}
```

### Current Section Model
```javascript
{
  type: string,           // "verse", "chorus"
  number: number,         // 1, 2, 3
  label?: string          // "[Verse 1]" if present
}
```

### New Section Model (post-smart-parsing)
```javascript
{
  type: string,           // "verse", "chorus"
  number: number,         // 1, 2, 3
  artists?: string[],     // ["Kanye West", "Kid Cudi"]
  notes?: string,         // "Transition", "Intro"
  originalText: string    // "[Verse 1 - Intro]"
}
```

---

## Risk Assessment

### High Risk
- **Bidirectional editing (left panel)** - Can cause conflicting state if not carefully managed
- **Smart header parsing** - Complex regex/logic prone to missing edge cases

### Medium Risk
- **Format cascading** - Need project database migration for backward compatibility
- **Year auto-fill** - Requires new project metadata structure

### Low Risk
- **Load endpoint fix** - Likely simple filename matching issue
- **Auto-populate year** - Doesn't change existing data; just pre-fills field

