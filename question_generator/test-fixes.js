#!/usr/bin/env node

/**
 * DIAGNOSTIC TEST SCRIPT
 * Verifies that all fixes are working correctly
 * Run from: node test-fixes.js
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(70));
console.log('COMPREHENSIVE FIX VERIFICATION');
console.log('='.repeat(70));

// Test 1: Check file modifications
console.log('\n✓ Checking file modifications...\n');

const checks = [
  {
    file: 'server.js',
    path: './server.js',
    patterns: [
      { name: 'normalizeSectionFormat enhanced', pattern: /CRITICAL: Always ensure type is lowercase/ },
      { name: 'validateSectionFormat function', pattern: /const validateSectionFormat = / },
      { name: 'GET endpoint validation', pattern: /validateSectionFormat\(data.lyrics\)/ },
      { name: 'Parse endpoint validation', pattern: /validateSectionFormat\(normalizedLines\)/ }
    ]
  },
  {
    file: 'RawTextEditor.jsx',
    path: './client/src/components/RawTextEditor.jsx',
    patterns: [
      { name: 'SECTION_TYPE_COLORS object', pattern: /const SECTION_TYPE_COLORS = \{/ },
      { name: 'getColorForSectionType function', pattern: /const getColorForSectionType = / },
      { name: 'Simplified createDecorations', pattern: /let currentSectionType = null;/ }
    ]
  },
  {
    file: 'LyricsEditor.jsx',
    path: './client/src/components/LyricsEditor.jsx',
    patterns: [
      { name: 'normalizeSectionInPlace function', pattern: /const normalizeSectionInPlace = useCallback/ },
      { name: 'Safe formatSectionName', pattern: /DEFENSIVE: Handle old format/ },
      { name: 'groupLinesBySection normalization', pattern: /const normalizedSection = normalizeSectionInPlace/ }
    ]
  }
];

let allChecks = true;

checks.forEach(check => {
  console.log(`Checking ${check.file}:`);
  
  if (!fs.existsSync(check.path)) {
    console.log(`  ❌ File not found: ${check.path}`);
    allChecks = false;
    return;
  }
  
  const content = fs.readFileSync(check.path, 'utf-8');
  
  check.patterns.forEach(pattern => {
    if (pattern.pattern.test(content)) {
      console.log(`  ✅ ${pattern.name}`);
    } else {
      console.log(`  ❌ ${pattern.name}`);
      allChecks = false;
    }
  });
});

console.log('\n' + '='.repeat(70));
if (allChecks) {
  console.log('✓ ALL FILE MODIFICATIONS VERIFIED');
} else {
  console.log('❌ SOME MODIFICATIONS MISSING');
}
console.log('='.repeat(70));

// Test 2: Verify data format
console.log('\n✓ Checking data format in love_lockdown.json...\n');

try {
  const lyricsPath = path.join(__dirname, 'lyrics', 'love_lockdown.json');
  if (fs.existsSync(lyricsPath)) {
    const data = JSON.parse(fs.readFileSync(lyricsPath, 'utf-8'));
    
    if (data.lyrics && data.lyrics.length > 0) {
      const sample = data.lyrics[0];
      console.log(`Sample line: "${sample.content}"`);
      console.log(`Section type: "${sample.section?.type}" (should be "verse", not "verse-1")`);
      console.log(`Section number: ${sample.section?.number} (should be a number)`);
      
      // Check if corrupted format exists
      const hasCorruptFormat = data.lyrics.some(line => 
        line.section?.type && /\d/.test(line.section.type)
      );
      
      if (hasCorruptFormat) {
        console.log('❌ WARNING: Some lines still have corrupted format (type contains number)');
      } else {
        console.log('✅ All lines have canonical format (type without numbers)');
      }
    }
  } else {
    console.log('ℹ️  love_lockdown.json not found (might be normal if different song loaded)');
  }
} catch (err) {
  console.log(`⚠️  Could not verify data format: ${err.message}`);
}

console.log('\n' + '='.repeat(70));
console.log('NEXT STEPS:');
console.log('='.repeat(70));
console.log('1. Start the backend: cd server && npm start');
console.log('2. Start the frontend: cd client && npm run dev');
console.log('3. Load "love_lockdown" from the song dropdown');
console.log('4. Verify:');
console.log('   - Right panel shows "Verse 1", "Verse 2" (NOT "Verse-1 1")');
console.log('   - Raw text shows verses in BLUE, choruses in ORANGE');
console.log('   - Console has no errors about corrupted formats');
console.log('5. Try pasting new lyrics with [Verse 1], [Chorus 1] headers');
console.log('6. Verify colors appear correctly');
console.log('\nConsole debugging:');
console.log('- [RawTextEditor] logs show color assignments');
console.log('- [LyricsEditor] logs show corrupted format fixes');
console.log('='.repeat(70));
