# 🧪 Testing Guide: Left/Right Panel Sync

## Overview

All changes have been implemented and deployed. The system now uses bidirectional sync to keep left and right panels always in sync.

**Key Principle**: Edit either side → both update automatically

---

## Test Suite

### TEST 1: Load Song & Verify Sync ⏱️ 1 min

**Setup**: Open http://localhost:3000

**Steps**:
1. Click "Load a song..." dropdown
2. Select "love_lockdown"
3. Wait for panels to load

**Verify**:
- [ ] Left panel shows raw lyrics starting with "[Verse 1]"
- [ ] Right panel shows structured data (content, section, voice)
- [ ] Count matching sections in both panels
- [ ] Both panels show same lyrics (just different format)

**Expected Result**: ✅ Left and right match perfectly

---

### TEST 2: Edit Left Panel, Watch Right Update ⏱️ 2 min

**Steps**:
1. Click in left panel
2. Find a line like "I'm not loving you"
3. Change it to "I'm in love with you"
4. Wait for "Parsing..." indicator to finish

**Verify**:
- [ ] Right panel updates (content changed)
- [ ] Section headers stay correct
- [ ] Voice assignments unchanged
- [ ] Both panels show new text

**Expected Result**: ✅ Right panel updates within 300ms

---

### TEST 3: Edit Right Panel, Watch Left Update ⏱️ 2 min

**Steps**:
1. Click on a line in right panel
2. Click the section type dropdown
3. Change from "Verse" to "Chorus"
4. Wait 1 second

**Verify**:
- [ ] Left panel section header changes "[Verse 1]" → "[Chorus 1]"
- [ ] Lines under new header stay together
- [ ] Content unchanged (only structure changed)

**Expected Result**: ✅ Left panel updates immediately

---

### TEST 4: Delete Lines & Verify Sync ⏱️ 2 min

**Steps**:
1. Select 3 lines in right panel (click, then shift+click)
2. Right-click → Delete
3. Wait 1 second

**Verify**:
- [ ] Lines disappear from right panel
- [ ] Corresponding lines + header removed from left panel
- [ ] Remaining lyrics still show correct sections
- [ ] Count matches (if had 14 lines, now has 11)

**Expected Result**: ✅ Both panels show 3 fewer lines

---

### TEST 5: Duplicate Lines & Verify Sync ⏱️ 2 min

**Steps**:
1. Select 2 lines in right panel
2. Right-click → Duplicate
3. Wait 1 second

**Verify**:
- [ ] 2 new lines appear in right panel (duplicates)
- [ ] 2 new lines appear in left panel (same content)
- [ ] Section headers correct (e.g., still under Verse 1)
- [ ] Count matches (if had 14 lines, now has 16)

**Expected Result**: ✅ Both panels show duplicated content

---

### TEST 6: Change Voice & Verify Sync ⏱️ 2 min

**Steps**:
1. Select 3 lines (all in same section)
2. Right-click → Change Voice → Kanye West

**Verify**:
- [ ] Right panel shows voice dropdown changed to "Kanye West"
- [ ] Left panel text unchanged (voices not shown in text)
- [ ] Section headers correct
- [ ] Content preserved

**Expected Result**: ✅ Right panel shows voice update

---

### TEST 7: Change Section & Verify Sync ⏱️ 2 min

**Steps**:
1. Select 2 lines from Verse
2. Right-click → Change Section → Bridge
3. Wait 1 second

**Verify**:
- [ ] Right panel shows "Bridge 1" section
- [ ] Left panel shows "[Bridge 1]" header for those lines
- [ ] Other sections unchanged
- [ ] Verse/Chorus sections still intact

**Expected Result**: ✅ Both panels show section change

---

### TEST 8: Edit Multiple Fields & Verify Sync ⏱️ 3 min

**Steps**:
1. Select a line
2. Change content: "I love you" → "I need you"
3. Change section: Verse → Pre-Chorus
4. Change voice: Kanye → Kid Cudi
5. Wait 1 second

**Verify**:
- [ ] Right panel shows all changes
- [ ] Left panel shows updated content with "[Pre-Chorus 1]" header
- [ ] All properties synced correctly
- [ ] No errors in console

**Expected Result**: ✅ All changes reflected in both panels

---

### TEST 9: Save & Reload & Verify Sync ⏱️ 2 min

**Steps**:
1. Make a change (e.g., edit left panel)
2. Click Save button
3. See "Saved love_lockdown.json" alert
4. Click "Load a song..." → love_lockdown again
5. Wait for load

**Verify**:
- [ ] Left panel shows same edited content
- [ ] Right panel shows same parsed structure
- [ ] Changes persisted
- [ ] Both panels still synced

**Expected Result**: ✅ Data persists and syncs correctly

---

### TEST 10: Complex Workflow ⏱️ 5 min

**Steps**:
1. Load "love_lockdown"
2. Edit left panel (change "I'm not loving" to "I am loving")
3. Select verse lines in right panel
4. Change voice to "Ty Dolla $ign"
5. Delete last 2 lines
6. Duplicate first line
7. Save

**Verify**:
- [ ] All changes appear in both panels
- [ ] Panels stay synced throughout
- [ ] Save completes
- [ ] Reload shows all changes

**Expected Result**: ✅ Complex workflow works seamlessly

---

## Debug Checklist

If something doesn't work:

### Check Browser Console
```
✅ No red error messages
✅ No TypeError
✅ No "Cannot read property" warnings
```

### Check Network Tab
```
✅ POST /api/parse returns 200
✅ POST /api/songs/:name returns 200
✅ No failed requests
```

### Check Application State
Open DevTools → Application tab:
```javascript
// In console, you can inspect:
song.rawText        // Should show left panel content
song.lyrics         // Should show right panel data
song.lyrics.length  // Should match line count
```

### Manual Verification
```
1. Edit left panel
2. Check song.rawText in console (should update)
3. Check song.lyrics in console (should update)
4. Both should match visually
```

---

## Expected Timing

| Action | Time |
|--------|------|
| Load song | ~500ms |
| Edit left + parse | ~300ms (debounce) |
| Edit right + sync | <50ms (immediate) |
| Delete 10 lines | <50ms |
| Save | ~200ms |
| Reload | ~500ms |

---

## Success Criteria

✅ **All tests pass if**:
- Left and right panels always show matching content (different formats)
- Editing either side updates the other
- Deleting/duplicating affects both panels
- Sections stay organized correctly
- No console errors
- Save/reload preserves all changes

❌ **Failure cases** (report if):
- Left and right show different data
- Editing left doesn't update right
- Editing right doesn't update left
- Sections get mangled
- Console shows errors
- Changes don't persist on save

---

## Sample Test Data

**love_lockdown.json structure**:
```
Verse 1: 8 lines
Chorus: 4 lines
Verse 2: 8 lines
Chorus: 4 lines
Bridge: 4 lines
Outro: 2 lines
Total: 30 lines
```

When you delete 3 lines or duplicate, counts should change accordingly.

---

## Quick Verification Command

In browser console:
```javascript
// Verify rawText and lyrics match
console.log('rawText lines:', song.rawText.split('\n').length);
console.log('lyrics items:', song.lyrics.length);
console.log('They should be close (rawText includes headers)');
```

---

**Status**: Ready for Testing
**Expected Result**: All tests pass ✅
**Next Action**: Run tests and report results
