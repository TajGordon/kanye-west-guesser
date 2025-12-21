# Quick Start Guide - Modern Lyrics Editor

## Access
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## Create Your First Song

### Step 1: Create New Song
Click **"New Song"** button in top-left
- Initializes with default metadata
- Ready for editing

### Step 2: Fill Metadata (Optional)
In **left sidebar**:
- Title: Change "New Song" to actual song name
- Project: Select from dropdown (e.g., "808s & Heartbreak")
- Year, formats auto-populate based on project
- Status: Official/Leaked/Unofficial

### Step 3: Paste Lyrics in Left Panel
In the **left textarea**:
```
[Verse 1]
I'm not loving you way I wanted to
What I had to do, had to run from you

[Chorus]
So keep your love lockdown, your love lockdown
```

**Watch**: Right panel auto-updates as you type (after 300ms pause)

### Step 4: Select & Bulk Edit Lines
In **right panel**:

#### Option A: Single Click
- Click any line → highlights in blue

#### Option B: Drag Select
- Click line 3
- Hold + drag to line 7
- All 6 lines highlight

#### Option C: Shift+Click Range
- Click line 2
- Hold Shift + Click line 8
- Lines 2-8 selected

#### Option D: Ctrl+Click Multi-Select
- Click line 2 → selected
- Ctrl+Click line 5 → both 2 and 5 selected
- Ctrl+Click line 3 → all three selected

### Step 5: Bulk Edit Selected Lines
**Option 1: Use Right-Click Context Menu**
1. Right-click on any selected line
2. Menu appears with:
   - 🎤 Change Voice
   - 📍 Change Section
   - 📋 Duplicate (X lines)
   - 🗑️ Delete (X lines)
3. Click action → applied instantly

**Option 2: Use Sidebar Buttons**
When lines selected, left sidebar shows:
1. Voice dropdown → select voice → applies to all
2. Section dropdown → select type → applies to all
3. [Duplicate] button → clones selected lines
4. [Delete] button → removes selected lines

### Step 6: Edit Individual Lines
In **right panel**, each line has:
- **Text field** - Edit content
- **Section dropdown** - Verse/Chorus/Bridge/Outro
- **Number field** - Section number (1, 2, 3...)
- **Voice dropdown** - Kanye/Ty Dolla/Pusha T/Kid Cudi/Mr Hudson

### Step 7: Save
Click **"Save"** button in top-right
- Saves as `song-title.json` in data directory
- Shows filename when saved

---

## Tips & Tricks

### Visual Feedback
- **Blue box in sidebar**: Shows "X lines selected"
- **Blue highlight on lines**: Current selection
- **"Parsing..." indicator**: Right side of left panel while auto-parsing
- **Error message**: If parse fails (invalid header format)

### Keyboard Shortcuts
| Action | Keys |
|--------|------|
| Close context menu | ESC |
| Select range | Shift + Click |
| Multi-select | Ctrl/Cmd + Click |
| Delete selected | Right-click → Delete |
| Duplicate | Right-click → Duplicate |

### Auto-Parse Examples
These headers are correctly parsed:

✅ `[Verse 1]`
✅ `[Verse 1: Kanye West]`
✅ `[Verse 1 - Intro]`
✅ `[Chorus: Kanye, Mr. Hudson]`
✅ `[Bridge - Transition]`

These are filtered out (won't appear in editable lyrics):
❌ `[Produced by Kanye West]`
❌ `[See Kanye West Live]`
❌ `[Get tickets as low as...]`

### Left Panel Editing Tips
- Type or paste raw lyrics
- Use `[Section Name]` format for headers
- Press Enter for new lines
- Auto-parse runs 300ms after you stop typing
- Right panel updates automatically

### Selection Tips
- **Quick delete**: Select lines → right-click → Delete
- **Bulk voice change**: Select lines → right-click → Change Voice
- **Copy workflow**: Select → Right-click → (future: Copy to clipboard)
- **Non-contiguous**: Ctrl+click multiple separate lines for bulk operations

---

## Common Tasks

### Task: Import a Song from Text
1. Click **"Import Text"** (if available)
2. Paste raw lyrics
3. Click **"Parse & Import"**
4. OR: Paste directly in left textarea (auto-parses)

### Task: Change All Verse Lines to a Different Voice
1. Click line 5 (first verse line)
2. Shift+Click last verse line → all selected
3. Right-click → "Change Voice" → Select voice
4. All selected lines updated instantly

### Task: Delete Duplicate Lines
1. Identify the duplicates (e.g., lines 10-15 are repeats of 5-9)
2. Click line 10
3. Drag to line 15
4. Right-click → "Delete (6)"
5. Lines removed

### Task: Add New Lines
1. Edit in right panel directly, OR:
2. Edit left textarea to add lines
3. Auto-parse detects them
4. Right panel updates

### Task: Fix Section Headers
1. Left textarea shows raw text
2. If header parsing failed, edit it directly
3. Example: Change `[Verse1]` to `[Verse 1]`
4. Auto-parse triggers (300ms)
5. Right panel re-syncs

---

## Troubleshooting

### Problem: Right panel doesn't update after left panel edit
**Solution**: 
- Wait 300ms (debounce delay)
- Check browser console for parse errors
- Verify header format is valid: `[Type Number]`

### Problem: Selection lost after editing
**Solution**: 
- Selections are best-effort (map by content)
- If structure changes dramatically, selection resets
- This is normal behavior

### Problem: Can't select multiple non-contiguous lines
**Solution**: 
- Use Ctrl+Click (or Cmd+Click on Mac)
- Each Ctrl+Click toggles a line

### Problem: Context menu doesn't appear
**Solution**: 
- Right-click on a line (not empty space)
- Make sure at least one line is selected
- Try different browser if issue persists

### Problem: Parse error message shown
**Solution**: 
- Check left panel for invalid header format
- Valid format: `[Section Number]` (e.g., `[Verse 1]`)
- Optional: `[Verse 1: Artist Name]` or `[Verse 1 - Notes]`

---

## API Endpoints (For Reference)

### GET /api/songs
Returns list of all saved songs
```json
{ "songs": ["love_lockdown", "heartless", ...] }
```

### GET /api/songs/:name
Load a specific song
```json
{
  "title": "Love Lockdown",
  "artist": "Kanye West",
  "release": {...},
  "lyrics": [...]
}
```

### POST /api/songs/:name
Save a song
```json
{
  "title": "Song Title",
  "lyrics": [...],
  ...
}
```

### POST /api/parse
Parse raw text into structured lyrics
```json
{
  "text": "[Verse 1]\nLine 1\nLine 2"
}
→ Returns: { "lines": [...], "allLines": [...] }
```

### GET /api/projects
Get all projects with metadata
```json
{
  "projects": [
    {
      "name": "808s & Heartbreak",
      "year": 2008,
      "formats": ["album"],
      "artists": ["Kanye West"]
    }
  ]
}
```

---

## Server Status

Check server health:
```
curl http://localhost:3001/api/projects
```

Should return projects list. If error, check:
1. Server running: `npm run dev:all`
2. Port 3001 available
3. `projects.json` file exists in root directory

---

## Next Steps

1. **Test all selection methods** (click, drag, shift+click, ctrl+click)
2. **Try context menu** (right-click selections)
3. **Edit left panel** (watch auto-parse update right)
4. **Bulk edit** (select lines, change voice/section)
5. **Save song** (verify JSON file created)
6. **Load song** (use dropdown to test)

Happy editing! 🎵
