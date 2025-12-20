# QUICK START: Testing the Fixes

## Before You Start

Make sure both backend and frontend are running:

```bash
# Terminal 1 - Backend
cd question_generator/lyrics_generator/server
npm start

# Terminal 2 - Frontend  
cd question_generator/lyrics_generator/client
npm run dev
```

Then open: http://localhost:5173/

---

## Test Case 1: Load Existing Song (easiest)

**Goal**: Verify "Verse-2 1" bug is fixed AND colors work

**Steps**:
1. In the song dropdown, select "love_lockdown"
2. Look at the RIGHT PANEL (structured view)

**Expected Results**:
- [ ] Section titles show "Verse 1", "Verse 2", "Verse 3" (NOT "Verse-2 1")
- [ ] All verses grouped together with BLUE background
- [ ] All choruses grouped together with ORANGE background
- [ ] Bridge (if present) with CYAN background

**What to look for**:
- Headers like `[Verse 1]`, `[Verse 2]` in top-right
- NO text that looks like "Verse-2 1" or "Verse-1"
- Colors should be VIBRANT (not washed out gray)

**Console Check** (press F12):
- Should see: `[RawTextEditor] Section header: type="verse", color="#5eb3ff"`
- Should NOT see any `[LyricsEditor] Fixed corrupted section format` warnings
- Should NOT see errors about invalid section types

---

## Test Case 2: Check Raw Text Colors

**Goal**: Verify raw text view has correct section-type colors

**Steps**:
1. Keep "love_lockdown" loaded from Test Case 1
2. Look at the LEFT PANEL (raw text editor)

**Expected Results**:
- [ ] Section header `[Verse 1]` has BLUE background
- [ ] All verse lyrics under it have subtle BLUE tint
- [ ] Section header `[Chorus 1]` has ORANGE background  
- [ ] All chorus lyrics have subtle ORANGE tint
- [ ] Bridge (if exists) has CYAN background

**What NOT to see**:
- All sections should NOT be the same gray color
- Verses should NOT be orange or cyan
- Choruses should NOT be blue

**Console Check**:
- Multiple lines like: `[RawTextEditor] Section header: type="verse", color="#5eb3ff"`
- Colors should match expectations (blue for verse, orange for chorus, etc.)

---

## Test Case 3: Paste New Lyrics

**Goal**: Test that parsing new content works with correct colors/format

**Steps**:
1. Click "New Song" button at top
2. In the LEFT PANEL (raw text), clear everything and paste:

```
[Verse 1]
First verse here
With multiple lines
Of sample lyrics

[Chorus 1]
This is the chorus
Repeat after me
Yeah yeah yeah

[Verse 2]
Second verse starts
Different content here
More lyrics added

[Bridge]
Bridge section
Short and sweet

[Chorus 2]
Second chorus
Same melody
But different words
```

3. You should see a blue "Re-process Raw Text" button appear
4. Click it

**Expected Results**:
- [ ] RIGHT PANEL shows sections correctly organized:
  - "Verse 1" (blue group)
  - "Chorus 1" (orange group)
  - "Verse 2" (blue group)
  - "Bridge" (cyan group)
  - "Chorus 2" (orange group)
  
- [ ] Section titles display as "Verse 1", "Chorus 1", "Bridge" (correct format)
- [ ] LEFT PANEL colors update to match types

**What NOT to see**:
- No section should display as "Verse-1" or "Chorus-1"
- No section should be gray (indicates parsing failed)

**Console Check**:
- Should see section header logs with correct type and color
- Should NOT see any validation errors

---

## Test Case 4: Edit and Save

**Goal**: Verify that save → load preserves format and colors

**Steps**:
1. Keep the song from Test Case 3
2. Edit one line in the RIGHT PANEL (click a lyric line, change text)
3. Click "Save" button (top right)
4. Give it a filename when prompted
5. Close the editor (click "New Song" or just reload page)
6. Open the dropdown and select your saved song

**Expected Results**:
- [ ] Song loads back
- [ ] All section names are STILL correct (no "Verse-1")
- [ ] Colors are STILL correct (verses blue, etc.)
- [ ] All your edited text is preserved

**Console Check**:
- Should NOT see validation errors when loading
- Color logs should appear when painting sections

---

## Test Case 5: Edge Case - Mixed Format Data

**Goal**: Verify defensive normalization works

**If you have old data with mixed formats**:

**Expected Behavior**:
- [ ] Frontend normalizes silently
- [ ] Console shows: `[LyricsEditor] Fixed corrupted section format: "verse-2" → type="verse", number=2`
- [ ] Display still shows correct format "Verse 2"
- [ ] Colors still work correctly

**What this means**:
Even if old data somehow has format bugs, the system auto-corrects them before display.

---

## Quick Color Reference

Use this to verify colors are correct:

| Section Type | Expected Color | Hex Code | Appearance |
|---|---|---|---|
| Verse | Bright Blue | #5eb3ff | Like sky blue |
| Chorus | Bright Orange | #ffb74d | Like sunset orange |
| Pre-Chorus | Bright Purple | #b47dff | Like neon purple |
| Bridge | Bright Cyan | #52ffb8 | Like turquoise |
| Intro | Bright Yellow | #ffff52 | Like neon yellow |
| Outro | Bright Pink | #ff52a1 | Like neon pink |
| Interlude | Light Cyan | #52ffff | Like bright cyan |

If all sections look gray or the same color → Something wrong
If each section type has a distinct vibrant color → Working! ✓

---

## Troubleshooting

### Problem: Raw text colors still monochrome

**Check**:
1. Did you reload the page after the fix? (Browser cache)
2. Is backend restarted? (Changes to server.js need npm start restart)
3. Check console (F12) for errors

**Solution**:
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Restart both backend and frontend
- Check browser console for error messages

### Problem: Still seeing "Verse-2 1"

**Check**:
1. Did you reload the page?
2. Is the right panel showing or did you scroll?
3. Check console for validation errors

**Solution**:
- Hard refresh the page
- Check if there are any console errors about validation
- Try loading a different song and switching back

### Problem: Colors are washed out / faint

**Check**:
1. Is your display brightness normal?
2. Are you looking at the right view? (left = raw text, right = structured)
3. Are section headers showing? (no headers = no color)

**Solution**:
- Make sure you're looking at LEFT PANEL (raw text editor) not right panel
- Look for section headers like `[Verse 1]` - they should have solid color background
- Increase display brightness if needed

---

## Success Indicators

You'll know everything is working when:

✓ Right panel shows section names like "Verse 2" (not "Verse-2 1")
✓ Left panel (raw text) has colorful section highlighting
✓ Each section type has consistent color (all verses = blue, all choruses = orange)
✓ Colors are vibrant, not gray or washed out
✓ Console has no errors or validation warnings
✓ Save → Load preserves everything perfectly

---

## Questions or Issues?

Check these documents for more details:
- [COMPREHENSIVE_FIX_SUMMARY.md](./COMPREHENSIVE_FIX_SUMMARY.md) - What was fixed and why
- [ARCHITECTURE_DEEP_DIVE.md](./ARCHITECTURE_DEEP_DIVE.md) - Technical deep dive of changes
