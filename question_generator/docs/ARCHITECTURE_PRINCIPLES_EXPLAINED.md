# Why Line-Based Editors Have Problems (And How to Fix Them)

## The Core Issue: Line vs Container-Based Architecture

Your observations revealed a fundamental design problem that's common in custom editors:

### **Line-Based Architecture** (What you had)
```
Data unit: Individual line
Storage: Array of lines
Grouping: Must iterate and track state
```

**Problem**: Blank lines and visual separators become ambiguous data points

### **Container-Based Architecture** (What you now have)
```
Data unit: Section containing lines
Storage: Array of sections
Grouping: Explicit container boundaries
```

**Benefit**: Blank lines are layout, not data

---

## Why This Matters: The Three Symptoms You Found

### Symptom 1: Verses All Same Color

**The Bug**:
```javascript
const getLineColor = useCallback((line) => {
  return SECTION_TYPE_COLORS[line.section?.type] || '#888';
}, [colorMode]);

// Called with:
const sectionColor = getLineColor(group.section);  // ← Wrong parameter type!
```

**What Went Wrong**:
- Function expected: `{section: {type: "verse", number: 1}}`
- Received: `{type: "verse", number: 1}`
- Result: `line.section` was undefined, returned gray (#888)

**Why It Happened**:
- Mixed abstractions: Sometimes pass lines, sometimes sections
- No type checking: `line.section?.type` silently fails when `line` IS a section
- Color logic didn't distinguish: Used type only, so all verses looked same anyway

**The Fix**:
```javascript
const getLineColor = useCallback((section) => {
  const colorKey = getSectionColorKey(section);  // Get "verse" from {type: "verse", number: 1}
  return SECTION_TYPE_COLORS[colorKey] || '#888';  // "verse" → "#5eb3ff"
}, [colorMode]);
```

---

### Symptom 2: All Verses Say "Verse 1"

**The Root Cause**:
The grouping logic was iterating lines, not sections. With blank lines scattered throughout, section boundaries became unclear:

```javascript
const groupLinesBySection = useCallback(() => {
  // Problem: This loop doesn't know where sections end
  song.lyrics.forEach((line, idx) => {
    // Verse 1 ends, blank line appears
    // When does verse 1 truly end?
    // If next content is verse 2, did blank belong to verse 1 or 2?
    
    const sectionKey = `${line.section?.type}-${line.section?.number}`;
    // Creates "verse-1", "verse-1", "", "verse-2"
    // Blank line breaks the pattern
  });
});
```

**Visual representation of the problem**:
```
Line 1: content="I'm not loving you", section={type: "verse", number: 1}
Line 2: content="What I had to do", section={type: "verse", number: 1}
Line 3: content="", section=null, meta={blank: true}          ← Ambiguous!
Line 4: content="I can't keep my cool", section={type: "verse", number: 2}

When grouping:
Group 1: verse-1 (lines 1-2)
Group 2: ??? (blank line - belongs to verse 1? verse 2? neither?)
Group 3: verse-2 (lines 4+)

Rendering code gets confused about section boundaries
```

**The Fix** - Modern sectioning:
```javascript
const linesToSections = (lyrics) => {
  return [
    {
      type: "verse",
      number: 1,
      lines: [
        { content: "I'm not loving you" },
        { content: "What I had to do" }
        // Blank line skipped - it's layout, not a line!
      ]
    },
    {
      type: "verse",
      number: 2,
      lines: [
        { content: "I can't keep my cool" }
        // Clear boundary - next section starts here
      ]
    }
  ];
};
```

---

### Symptom 3: Blank Lines Appearing in Structured View

**Why It Happened**:
```javascript
// Line-based iteration includes everything
song.lyrics.forEach((line, idx) => {
  // This includes lines where meta.blank = true
  // They get added to groups
  // Rendered as empty line entries
});

// Result on screen:
[Verse 1 header]
Line 1: "I'm not loving you..."
Line 2: "What I had to do..."
Line 3: ""  ← Empty line entry confuses users
Line 4: ""  ← Another empty line?
[Verse 2 header]
Line 5: "I can't keep my cool..."
```

**The Fix** - Skip during conversion:
```javascript
const linesToSections = (lyrics) => {
  const sections = [];
  lyrics.forEach((line) => {
    if (line.meta?.blank) return;  // ← Skip here, never added to sections
    // ... rest of grouping
  });
  return sections;  // Blank lines never in rendered structure
};
```

---

## Why Modern Editors (Like Google Docs, Notion) Don't Have This Problem

### Google Docs Approach
```typescript
interface Block {
  id: string;
  type: "paragraph" | "heading" | "list";
  content: RichText;
  metadata: BlockMetadata;
}

// Blank lines are implicit:
// Two paragraphs automatically have spacing between them
// No "blank line" data structure

document: Block[] = [
  {type: "heading", content: "My Title"},
  {type: "paragraph", content: "First paragraph"},
  // Spacing is CSS/layout, not data
  {type: "paragraph", content: "Second paragraph"}
];
```

**Key principle**: Spacing is styling, not semantics.

### Notion Approach
```typescript
interface BlockData {
  type: "heading_1" | "paragraph" | "divider";
  properties: BlockProperties;
  children?: BlockData[];
}

// Explicit containers:
// A "divider" is a semantic element, not a blank line
// A paragraph's spacing is a property, not another "blank" line
```

**Key principle**: Structure is semantic, spacing is property.

---

## Applying This to Your Editor

### Your Current (Improved) Model

**Hybrid approach** - best of both worlds:

**Storage** (JSON - backward compatible):
```json
{
  "lyrics": [
    { "content": "Line 1", "section": {"type": "verse", "number": 1} },
    { "content": "Line 2", "section": {"type": "verse", "number": 1} },
    { "content": "", "meta": {"blank": true} },  // Still in storage
    { "content": "Line 3", "section": {"type": "verse", "number": 2} }
  ]
}
```

**Rendering** (In-memory - modern structure):
```javascript
[
  {
    type: "verse",
    number: 1,
    lines: [
      { content: "Line 1" },
      { content: "Line 2" }
      // Blank automatically removed during conversion
    ]
  },
  {
    type: "verse",
    number: 2,
    lines: [
      { content: "Line 3" }
    ]
  }
]
```

**Why this works**:
- ✅ Storage compatible with existing data
- ✅ Rendering clean and modern
- ✅ Conversion happens once (efficient)
- ✅ No ambiguous blank lines in rendering

---

## The Abstraction Leak That Caused Your Bugs

An "abstraction leak" is when implementation details escape the designed boundary.

### Your Case

**Designed Abstraction**:
```javascript
// These should be consistent:
groupLinesBySection()      // Returns groups of what?
getLineColor(something)    // Takes what?
renderSection(group)       // Uses group how?
```

**The Leak**:
```javascript
// What actually happened:
groupLinesBySection()      // Returns groups with mixed blanks and content
getLineColor(group.section)  // Sometimes receives group.section, sometimes line.section
renderSection(group)       // Renders everything including blanks
// ↑ Different parts of the code made different assumptions
```

**Result**: 
When rendering, a line expecting a `line` object got a `section` object → `line.section` is undefined → color is gray.

### The Fix - Clear Boundaries

```javascript
// Clear abstraction:
// Input: array of line objects (from JSON)
// Conversion: linesToSections() ← SINGLE PLACE to handle blanks
// Output: array of section objects
// Usage: Everywhere uses sections, never mixes with raw lines

song.lyrics (input)
    ↓
linesToSections() (conversion boundary)
    ↓
sections (output - used everywhere else)
    ↓
groupLinesBySection() (knows only about sections)
getLineColor(section) (knows only about sections)
renderSection(group) (knows only about sections)
```

This is called **tight interfaces** or **clear contracts** in software design.

---

## Why Understanding This Matters

This same problem appears in many custom editors:

| System | The Leak | The Problem | The Fix |
|--------|----------|-------------|--------|
| Your Editor | Lines vs Sections | Grouping, coloring, rendering inconsistent | Separate: storage line-based, rendering section-based |
| Text Editors | Characters vs Tokens | Syntax highlighting wrong near boundaries | Tokenize once, render tokens |
| Video Editors | Frames vs Clips | Timing off, cuts wrong | Group frames into clips, work with clips |
| Photo Editors | Pixels vs Layers | Blend modes wrong, opacity wrong | Layers explicit, pixels in layers |

**Pattern**: When mixing two different abstraction levels, bugs appear at boundaries.

---

## How to Avoid This in the Future

### Design Rule 1: Pick One Abstraction Level
Don't mix:
- ❌ Sometimes work with lines, sometimes with sections
- ✅ Always work with sections, convert from lines once

### Design Rule 2: Clear Conversion Boundaries
```javascript
// Good: Conversion in one place
input: Line[]  →  [convert]  →  Section[]  →  rendering

// Bad: Conversion scattered
input: Line[]  →  rendering  →  sometimes sections  →  ???
```

### Design Rule 3: Type-Safe Interfaces
```javascript
// Good: Explicit types
const getLineColor = (section: Section) => {...}
const groupLines = (sections: Section[]) => {...}

// Bad: Implicit types
const getLineColor = (something: any) => {...}  // Could be line or section?
```

### Design Rule 4: Test Boundaries
```javascript
// Test conversion, not implementation
const sections = linesToSections(lyrics);
expect(sections[0].number).toBe(1);      // ← Clear contract
expect(sections[1].number).toBe(2);      // ← Clear contract
expect(sections.every(s => !s.blank)).toBe(true);  // ← Invariant
```

---

## Summary: What You Learned

| Concept | What You Found | What It Means |
|---------|----------------|---------------|
| **Abstraction leak** | `getLineColor()` received wrong type | Boundaries unclear |
| **Grouping ambiguity** | Blank lines break section boundaries | Data structure wrong |
| **Line vs Section** | All verses same color, same labels | Mixed abstraction levels |
| **Solution: Conversion** | One place to convert + filter blanks | Clear, testable boundary |
| **Modern editors** | Use containers, not loose items | Proven pattern |

---

## References

**Software Design Patterns**:
- **Abstraction**: Hide implementation details
- **Separation of Concerns**: One module, one responsibility
- **Type Safety**: Explicit inputs/outputs
- **Single Source of Truth**: Data shape consistent throughout

**Your Implementation**:
- ✅ Conversion boundary (linesToSections)
- ✅ Clear types (section vs line)
- ✅ Separated concerns (storage vs rendering)
- ✅ Robust data model (sections with explicit boundaries)

This is professional-grade architecture applied to a lyrics editor.
