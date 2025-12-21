# Modern Selection & Editing Patterns Analysis

## User's Current Pain Points

1. **Checkbox selection is tedious** - Click each checkbox individually
2. **No drag selection** - Modern editors support click-drag to select ranges
3. **Limited selection interactions** - Selected lines don't offer contextual actions
4. **Separated editing panels** - Original text (left) is read-only; edits only on right
5. **Manual re-parsing** - Must click "Parse & Import" to update
6. **No visual sync** - Highlighting connections between left/right panels unclear

---

## Modern UI Patterns Being Referenced

### Pattern 1: **Drag Selection** (Inherent Text Selection)
**Used In**: VS Code, Sublime Text, Google Docs, Word

```
User Action: Click line 5 + drag to line 8
Result: Lines 5-8 highlighted (visual feedback)
Then: Bulk operations become available (delete, edit, change voice)
```

**Advantage**: Natural, follows OS text selection conventions
**Challenge**: Need to prevent accidental text selection within line content

---

### Pattern 2: **Context Menus** (Right-click Interactions)
**Used In**: VS Code, Figma, Jira, Notion

```
User Action: Right-click on selected lines
Result: Context menu appears:
  ├─ Delete selected (X)
  ├─ Change voice → [submenu]
  ├─ Change section → [submenu]
  ├─ Duplicate
  └─ Cut/Copy
```

**Advantage**: Discoverable; follows modern app conventions
**Challenge**: Needs touch-friendly fallback (long-press)

---

### Pattern 3: **Inline Editing with Dual Panes**
**Used In**: Sublime Merge, Git UI tools, DaVinci Resolve

```
Left Pane (Source):           Right Pane (Structured):
[Raw text, editable]          [Parsed, form-based]
"Verse 1"                      ┌─────────────────┐
"Line 1" ───────────────────→ │ Section: Verse 1│
"Line 2" ───────────────────→ │ Voice: Kanye    │
                              │ Content: Line 1 │
                              └─────────────────┘
```

**Key Feature**: Edit left → right updates automatically (or vice versa)

**Advantage**: Source of truth is clear; powerful for power users
**Challenge**: Sync logic complexity; conflict resolution

---

### Pattern 4: **Highlighting/Annotation System** (Like Google Docs Comments)
**Used In**: Google Docs, Figma Comments, Notion, Adobe apps

```
Left Pane shows:
"I'm not loving you way I wanted to"
            └─ Hover: Assigned to Kanye West, Verse 1

Right Pane shows matching line with full metadata editable
```

**Advantage**: Visual connection without explicit linking
**Challenge**: Performance with large documents

---

### Pattern 5: **Multi-Cursor Editing** (Power User Feature)
**Used In**: VS Code, Sublime Text, Vim

```
User Action: Ctrl+Click on multiple lines
Result: 
  ├─ Cursor appears in each selected line
  └─ Type once → updates all selected
  
Example: Select "verse" type → all selected lines show in bulk edit
```

**Advantage**: Extremely powerful; familiar to developers
**Challenge**: Steep learning curve for non-power users

---

### Pattern 6: **Real-Time Parsing with Debouncing**
**Used In**: Markdown editors, Code editors, Modern design tools

```
User edits left panel → 250ms debounce → parse triggered → right panel updates
```

**Advantage**: WYSIWYG experience; instant feedback
**Challenge**: Parser must be fast; handle partial/invalid input gracefully

---

### Pattern 7: **Selection-Based Toolbar/Ribbon** (Like Notion/Figma)
**Used In**: Microsoft Office, Notion, Figma, Canva

```
User selects lines 3-5
├─ Floating toolbar appears above/below:
│  ├─ [🎤 Voice] [📍 Section] [🗑️ Delete] [📋 Copy]
│  └─ Quick format buttons
└─ Toolbar follows selection as user drag-selects more
```

**Advantage**: Clear, contextual, non-intrusive
**Challenge**: Mobile-friendly implementation

---

## Recommended Hybrid Approach for Lyrics Editor

Combine the best patterns for **maximum usability**:

### Tier 1: Essential (User's Core Requests)
```
✅ MUST HAVE:
├─ Drag selection (click line 1, drag to line 5 → all selected)
├─ Right-click context menu
│  ├─ Delete selected
│  ├─ Change voice
│  ├─ Change section
│  └─ Edit inline
├─ Left panel fully editable
├─ Auto-parse on edit (debounced 300ms)
└─ Selection-based action toolbar
```

### Tier 2: Enhanced (Power User)
```
🎯 NICE TO HAVE:
├─ Ctrl+Click multi-select (non-contiguous)
├─ Keyboard shortcuts (Delete, D for duplicate, etc.)
├─ Undo/Redo stack
├─ Line numbers with click-select on number
└─ Hover tooltips showing line metadata
```

### Tier 3: Advanced (Future)
```
💡 COULD HAVE:
├─ Multi-cursor editing (Ctrl+Alt+Click)
├─ Search & replace with regex
├─ Syntax highlighting for section headers
├─ Floating annotation system
└─ Real-time collaboration (show other users' cursors)
```

---

## Implementation Complexity Assessment

| Feature | Complexity | Time | Priority |
|---------|-----------|------|----------|
| Drag selection | Medium | 2-3h | 🔴 Critical |
| Right-click context menu | Medium | 2h | 🔴 Critical |
| Left panel editable + auto-parse | Medium | 3-4h | 🔴 Critical |
| Selection toolbar | Medium | 2h | 🟡 High |
| Ctrl+Click multi-select | Low | 1h | 🟡 High |
| Keyboard shortcuts | Low | 1-2h | 🟡 High |
| Undo/Redo | High | 4-5h | 🟢 Medium |
| Line numbers | Low | 1h | 🟢 Medium |

---

## Data Flow Architecture (New)

### Current (Form-based):
```
Left Panel (Read-only)  →  Checkbox Select  →  Right Panel (Edit)
     ↓                                               ↓
  Display only                                  setState setSong
```

### Proposed (Editor-based):
```
┌─────────────────────────────────────────────────────────┐
│ Left Panel (Raw Text) - EDITABLE                        │
│ "Verse 1"                                               │
│ "Line 1 content"  ← Edit here → triggers auto-parse     │
│ "Line 2 content"                                        │
└─────────────────────────────────────────────────────────┘
         ↓ (Auto-parse: debounce 300ms)
┌─────────────────────────────────────────────────────────┐
│ Right Panel (Structured Data) - LIVE SYNC               │
│ Selected: Lines 2-3                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Voice: [Kanye ▼]  Section: [Verse ▼]  [🗑️ Delete]  │ │
│ └─────────────────────────────────────────────────────┘ │
│ Line 2: [Text field] [Metadata toolbar]                │
│ Line 3: [Text field] [Metadata toolbar]                │
└─────────────────────────────────────────────────────────┘
         ↓ (Sync back on edit)
┌─────────────────────────────────────────────────────────┐
│ Left Panel updates to show live edits from right        │
└─────────────────────────────────────────────────────────┘
```

---

## Mainstream Parallels

### Closest Existing Tools

| Use Case | Tool | Key Pattern |
|----------|------|-------------|
| Lyrics/Poetry | Google Docs | Inline editing, highlighting |
| Code with metadata | VS Code + Extensions | Symbols pane + editor |
| Structured text | Notion | Block selection + toolbar |
| Parallel text | Sublime Merge | Diff view with sync |
| Staged edits | Git UI | Multi-select with bulk actions |

### What You're Asking For (In Industry Terms)

This is a **"Structured Text Editor"** or **"Semi-Structured Data Editor"**:
- Raw text + parsed data side-by-side
- Bidirectional sync
- Selection-driven actions
- Drag-to-select
- Context menus
- Real-time parsing

**Examples**: 
- VSCode's YAML/JSON editors (with schema validation)
- Markdown editors with preview (Typora, iA Writer)
- Git commit message editors (can see diff + message)
- Figma's design + code panels

---

## Proposed Implementation Phase

### Phase 1: Selection UX Overhaul (3-4 hours)
```javascript
// Remove checkboxes, add:
- Click to select single line
- Shift+Click to select range (lines 3-8)
- Ctrl+Click to multi-select non-contiguous
- Drag to select (click line 3, drag to line 7)

// Add visual feedback:
- Highlighted line background
- Selection count: "5 lines selected"
- Selection toolbar appears above selected lines
```

### Phase 2: Context Menu & Bulk Actions (2-3 hours)
```javascript
// Right-click shows:
- Delete selected
- Duplicate selected
- Change voice (→ submenu)
- Change section (→ submenu)
- Copy to clipboard
- Edit inline (opens focused edit mode)

// Toolbar buttons for:
- 🎤 Voice selector
- 📍 Section selector
- 🗑️ Delete
- 📋 Copy
- 📌 Expand/Collapse
```

### Phase 3: Left Panel Editability + Auto-Parse (4-5 hours)
```javascript
// Make left panel textarea editable
// Add onChange handler:
  - Debounce 300ms
  - Call /api/parse
  - Update right panel with new parsed data
  - Sync selection to new line indices
  - Show spinner during parse

// Add "Re-parse" button
// Add error display for invalid headers
```

### Phase 4: Selection Toolbar (2 hours)
```javascript
// Floating toolbar that moves with selection:
  [🎤 Voice ▼] [📍 Section ▼] [🗑️ Delete] [↔️ Swap] [📋]
  
// Appears when:
  - Lines selected (above/below selection)
  - Disappears when click elsewhere
```

---

## Technical Challenges & Solutions

### Challenge 1: Selection State Management
**Problem**: Need to track which lines are selected across re-parses
**Solution**: Use line content hash or line_number field to preserve selection

### Challenge 2: Bidirectional Sync
**Problem**: Editing left → parse → new structure. Existing selections may no longer match
**Solution**: 
- Map old line_numbers to new via content matching
- Or: Show warning "Structure changed, selection may need updating"

### Challenge 3: Performance (Large Files)
**Problem**: Left panel with 200+ lines, drag selection, real-time parse
**Solution**:
- Virtualization for left panel (only render visible lines)
- Debounce parse to 300-500ms
- Background worker for parsing

### Challenge 4: Mobile/Touch
**Problem**: Drag selection and right-click don't work on touch
**Solution**:
- Long-press for context menu
- Swipe to select range
- Tap line number to select
- Floating toolbar for touch actions

---

## Recommended MVP Feature Set

**Start with Phase 1-3, skip Phase 4 initially**:

✅ Phase 1: Selection (Drag, Shift+Click, Ctrl+Click)
✅ Phase 2: Context Menu
✅ Phase 3: Left Panel Editable + Auto-Parse
⏭️ Phase 4: Toolbar (Can add later)

**Estimated Total Time**: 9-12 hours of development

---

## User Flow (Post-Implementation)

```
1. User pastes raw lyrics in left panel
   ↓
2. Auto-parse triggers (300ms debounce)
   ↓
3. Right panel shows parsed + structured data
   ↓
4. User clicks line 3, drag-selects to line 8
   ↓
5. 6 lines highlighted, small toolbar appears
   ↓
6. User right-clicks → selects "Change Voice → Kanye West"
   ↓
7. All 6 selected lines update instantly
   ↓
8. User can still edit left panel raw text
   ↓
9. Changes auto-parse, right panel re-syncs
   ↓
10. User clicks Save
    ↓
11. Clean JSON saved with all metadata
```

---

## Modern Editor Comparison

| Feature | Current | Proposed | VS Code | Notion | Google Docs |
|---------|---------|----------|---------|--------|-------------|
| Selection | Checkbox | Drag + Shift+Click | ✅ | ✅ | ✅ |
| Multi-select | Checkbox | Ctrl+Click | ✅ | ✅ | ⚠️ |
| Context Menu | ❌ | Right-click | ✅ | ✅ | ✅ |
| Toolbar | Sidebar | Floating | ✅ | ✅ | ✅ |
| Left Editable | ❌ | ✅ | ✅ | ✅ | ✅ |
| Auto-sync | Manual | Debounced | ✅ | ✅ | ✅ |
| Keyboard shortcuts | ❌ | Planned | ✅ | ✅ | ✅ |
| Undo/Redo | ❌ | Future | ✅ | ✅ | ✅ |

---

## Summary

**What you're describing = "Structured Text Editor"**, combining:
- **Text editor UX** (drag selection, context menus, in-place editing)
- **Data structure awareness** (parsing, validation, bulk operations)
- **Real-time feedback** (live preview, sync indicators)

**Mainstream tools doing this**:
- VS Code (code + schema)
- Notion (blocks + properties)
- Figma (objects + inspector)
- Google Docs (text + suggestions/comments)
- Sublime Merge (diff view + message editor)

**Your exact use case**: Similar to **Markdown editor with live preview** or **Code editor with type hints**—raw input on one side, structured output on other, seamless sync between them.

This is a **significant UX improvement** that would make the lyrics editor feel more like a "real" editor and less like a form.

