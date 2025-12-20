# Modern Editor Architecture: Separating Content from Layout

## The Current Problem

Your observations reveal a fundamental architectural issue:

### 1. **All Lines Have Same Color (Not By Section)**
```
Expected: Verse 1 = Blue, Verse 2 = Blue (different groups)
Actual: All verses shown in same single color regardless of number
```

### 2. **All Lines Labeled as "Verse 1"**
```
Expected: Section header shows "Verse 1", next section shows "Verse 2"
Actual: Every section header shows the first section's number
```

### 3. **Blank Lines in JSON but Visual-Only**
```
Current: Blank lines stored as line entries with meta.blank = true
Problem: They cause grouping issues, add complexity, contaminate data
Better: Blank lines should be layout metadata, not data entries
```

---

## Root Cause: Line-Based vs Section-Based Architecture

### Current Architecture (Line-Based)
```javascript
{
  lyrics: [
    { line_number: 1, content: "Line 1", section: {type, number} },
    { line_number: 2, content: "Line 2", section: {type, number} },
    { line_number: 3, content: "", section: {type, number}, meta: {blank: true} },  // ← Problematic
    { line_number: 4, content: "Line 4", section: {type, number} }
  ]
}
```

**Problems**:
- Blank lines are mixed with content lines
- Section assignment replicated on EVERY line
- Hard to know when a section ends
- Grouping logic must iterate entire array
- Section headers not explicit

### Modern Architecture (Section-Based)
```javascript
{
  sections: [
    {
      type: "verse",
      number: 1,
      lines: [
        { content: "Line 1" },
        { content: "Line 2" }
        // Blank after verse is implicit layout, not data
      ]
    },
    {
      type: "chorus", 
      number: 1,
      lines: [
        { content: "Chorus line" }
      ]
    },
    {
      type: "verse",
      number: 2,
      lines: [
        { content: "Line 4" }
      ]
    }
  ]
}
```

**Benefits**:
- Section is explicit container, not repeated metadata
- Lines are just content strings (or {content, voice, meta})
- Blank lines handled via layout serialization
- Grouping is implicit (loops sections, not lines)
- Clear section boundaries

---

## Why You're Seeing Problems

### Problem 1: Color Assignment Bug
In `groupLinesBySection()`:
```javascript
const sectionKey = `${normalizedSection?.type}-${normalizedSection?.number}`;
```

This SHOULD create different keys for "verse-1" and "verse-2", but they're both getting the same color. **Hypothesis**: The color function might be looking at `type` only, not `type + number`.

### Problem 2: Header Display
The section header shows:
```javascript
{formatSectionName(group.section?.type)} {group.section?.number}
```

This should show "Verse 1", "Verse 2", etc. But if it's showing the same number, either:
- Grouping is combining different verses into one group
- The section.number is being overwritten

### Problem 3: Blank Line Complexity
```json
{
  "line_number": 18,
  "content": "",
  "section": {...},
  "meta": {"blank": true}
}
```

This blank line entry:
- Takes up data space
- Requires grouping logic to handle
- Can accidentally get included/excluded based on filters
- Makes verse color ambiguous (which section does it belong to?)

---

## Modern Solutions by Approach

### Option A: Keep Line-Based, Fix Grouping (Quick Fix)

**Effort**: Low (1 hour)
**Risk**: Low

**Changes**:
1. Skip blank lines in grouping (check `meta.blank`)
2. Fix color function to use `type-number` composite key
3. Ensure section headers show correct number

```javascript
// In groupLinesBySection():
const visibleLines = song.lyrics.filter(line => !line.meta?.blank);

// In getLineColor():
const sectionKey = `${line.section?.type}-${line.section?.number}`;
return SECTION_TYPE_COLORS[sectionKey] || '#888';  // Use composite key
```

**Result**: Current system works, blank lines invisible to rendering

---

### Option B: Hybrid Model (Best Balance)

**Effort**: Medium (3-4 hours)
**Risk**: Medium (requires data migration)

**Concept**: Keep raw storage flexible, convert to section model for rendering

```javascript
// Keep JSON compatible (line-based)
{
  lyrics: [
    { line_number: 1, content: "Line 1", section: {type: "verse", number: 1} },
    { line_number: 2, content: "Line 2", section: {type: "verse", number: 1} },
    { line_number: 3, content: "", section: null, meta: {blank: true} },
    { line_number: 4, content: "Line 3", section: {type: "verse", number: 2} }
  ]
}

// Convert to section model for rendering
function linesToSections(lyrics) {
  const sections = [];
  let currentSection = null;
  
  lyrics.forEach(line => {
    if (line.meta?.blank) return;  // Skip blanks
    
    const key = `${line.section.type}-${line.section.number}`;
    if (!currentSection || currentSection.key !== key) {
      currentSection = {
        key,
        type: line.section.type,
        number: line.section.number,
        lines: []
      };
      sections.push(currentSection);
    }
    
    currentSection.lines.push({ content: line.content, voice: line.voice });
  });
  
  return sections;
}
```

**Result**: Cleaner rendering, compatible with current storage

---

### Option C: Pure Section-Based (Modern Best Practice)

**Effort**: High (6-8 hours)
**Risk**: High (major refactor, must migrate all data)

**When**: If you're building v2.0 or willing to do full migration

**Structure**:
```javascript
{
  metadata: {
    title: "Love Lockdown",
    artist: "Kanye West"
  },
  sections: [
    {
      type: "verse",
      number: 1,
      voice: "kanye-west",
      lines: [
        { content: "I'm not loving you way I wanted to" },
        { content: "What I had to do, had to run from you" }
      ]
    },
    {
      type: "chorus",
      number: 1,
      voice: "kanye-west",
      lines: [
        { content: "So keep your love lockdown" }
      ]
    },
    // ... more sections
  ],
  // Serialization: How to convert back to raw text with blank lines
  layout: {
    blanksBetweenSections: 2,
    blanksBetweenVersesAndChorus: 1
  }
}
```

**Benefits**:
- Explicit section boundaries
- No ambiguous blank lines
- Rendering trivial (just loop sections)
- Colors guaranteed to be different per section
- Modern, follows standard music notation tools

**Drawbacks**:
- Full data migration required
- API changes needed
- UI changes required

---

## Why Blank Lines Matter More Than They Seem

### The Subtle Problem
```javascript
song.lyrics = [
  { content: "Line 1", section: {type: "verse", number: 1} },
  { content: "", section: null, meta: {blank: true} },  // ← Which verse's blank?
  { content: "Line 2", section: {type: "verse", number: 2} }
];

// When grouping:
// Is the blank line part of verse 1? Or verse 2? Or neither?
// This causes uncertain section boundaries
```

### The Modern Answer
In section-based models, **blank lines are not data, they're styling**:
```javascript
sections: [
  { type: "verse", number: 1, lines: [...] },
  // (implicit spacing here)
  { type: "verse", number: 2, lines: [...] }
]

// When rendering raw text:
// Verse 1 lines
// \n\n (add spacing based on layout)
// Verse 2 lines
```

---

## Recommended Path: Hybrid Approach (Option B)

**Why**:
1. **Minimal disruption**: Current JSON format unchanged
2. **Immediate fixes**: Colors and grouping work perfectly
3. **Future-proof**: Can migrate to Option C later
4. **Clean rendering**: Section model only used in-memory

**Implementation**:

### Step 1: Keep Data As-Is
No JSON changes, data remains line-based with `meta.blank` flags.

### Step 2: Add Conversion Function
```javascript
// utils/dataModel.js
export function linesToSections(lyrics) {
  const sections = [];
  let currentSection = null;
  
  lyrics.forEach(line => {
    // Skip blank lines - they're visual, not semantic
    if (line.meta?.blank) return;
    
    const sectionKey = `${line.section.type}-${line.section.number}`;
    
    // Start new section when type or number changes
    if (!currentSection || currentSection.key !== sectionKey) {
      currentSection = {
        key: sectionKey,
        type: line.section.type,
        number: line.section.number,
        lines: [],
        voice: line.voice  // All lines in section share same voice? Or collect unique?
      };
      sections.push(currentSection);
    }
    
    currentSection.lines.push(line);
  });
  
  return sections;
}
```

### Step 3: Use in LyricsEditor
```javascript
// In LyricsEditor.jsx
const groupLinesBySection = useCallback(() => {
  if (!song?.lyrics) return [];
  return linesToSections(song.lyrics);  // Use conversion function
}, [song?.lyrics]);

// In rendering:
{groupLinesBySection().map((group) => {
  const sectionColor = SECTION_TYPE_COLORS[group.type];  // Type only, consistent
  return (
    <div className="section-group-container">
      <div className="section-header-visual">
        {formatSectionName(group.type)} {group.number}  // Will now show correct number!
      </div>
      <div className="section-lines">
        {group.lines.map(line => (
          // Render each line...
        ))}
      </div>
    </div>
  );
})}
```

### Step 4: Raw Text Reconstruction
```javascript
// When reconstructing raw text from structured:
function sectionsToRawText(sections) {
  return sections
    .map((section, idx) => {
      const header = `[${section.type.charAt(0).toUpperCase() + section.type.slice(1)} ${section.number}]`;
      const lines = section.lines.map(l => l.content).join('\n');
      return `${header}\n${lines}`;
    })
    .join('\n\n');  // Two newlines between sections = visual blank line
}
```

---

## Immediate Action Items

### Diagnosis (15 minutes)
1. Check if section.number is correct in loaded JSON
2. Check if getLineColor is using composite key
3. Check groupLinesBySection grouping logic

### Quick Fix (30 minutes)
```javascript
// Fix 1: Color by type, not type-number
const sectionColor = SECTION_TYPE_COLORS[group.section.type];

// Fix 2: Skip blank lines in grouping
const visibleLines = group.lines.filter(l => !l.meta?.blank);

// Fix 3: Verify section number displays
// {group.section.number} should show correct number
```

### Medium Fix (2-3 hours)
Implement Option B (Hybrid model with linesToSections conversion).

### Long-Term (Next phase)
Migrate to pure section-based model (Option C) for cleaner architecture.

---

## Summary Table

| Aspect | Current (Line-Based) | Hybrid (Converted) | Modern (Section-Based) |
|--------|---------------------|-------------------|----------------------|
| Blank lines | In JSON as data | In JSON, skipped in render | Not in JSON |
| Color consistency | ❌ Grouped wrong | ✅ Perfect grouping | ✅ Perfect grouping |
| Section headers | ❌ Can be wrong | ✅ Always correct | ✅ Always correct |
| Data size | Large (blanks included) | Large (blanks included) | Smaller (blanks implicit) |
| Migration effort | — | Low | High |
| Rendering complexity | Medium | Low | Very Low |

---

## Recommended Next Step

**Run Quick Diagnostics** (15 min):

1. Load "love_lockdown"
2. Open browser console
3. Run:
```javascript
// Check if verse 2 has number: 2
window.logSongStructure = () => {
  const groups = [];
  const sections = new Map();
  
  // Simulating groupLinesBySection logic
  window.currentSong?.lyrics?.forEach(line => {
    if (line.meta?.blank) return;
    const key = `${line.section.type}-${line.section.number}`;
    if (!sections.has(key)) {
      sections.set(key, {section: line.section, count: 0});
    }
    sections.get(key).count++;
  });
  
  console.table(Array.from(sections.values()));
}

window.logSongStructure();
```

This will show you:
- Is section.number correct in data? (If verse 2 shows number: 1, that's the bug)
- Are blank lines being skipped? (Check count)
- Are sections properly separated?

---

## References: Modern Editors Using This Pattern

**Section-Based Architecture** (what you should move toward):
- **Notion**: Blocks as sections
- **Google Docs**: Paragraphs with explicit structure
- **Sheet music software** (Finale, MuseScore): Measures as explicit containers
- **Video editors** (Premiere, Final Cut): Clips as containers

**What They All Have in Common**:
1. Content is grouped into semantic containers (sections, blocks, measures, clips)
2. Blank space is layout, not content
3. Styling/metadata attached to containers, not individual items
4. Hierarchical structure matches domain model (verse → lines → words)

Your system should follow this pattern for robustness and intuitiveness.
