/**
 * Test: Phase 2 - Enhanced Header Parsing with Artists
 * Tests all new header formats and auto-numbering logic
 */

// Helper functions (copied from server.js)
const normalizeType = (typeStr) => {
  return typeStr
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/prechorus/, 'pre-chorus');
};

const parseArtists = (artistString) => {
  if (!artistString) return [];
  
  const artists = artistString
    .split(/[,&]+/)
    .map(a => a.trim())
    .filter(a => a.length > 0);
  
  return artists;
};

const generateSectionLabel = (section) => {
  const typeLabel = section.type.charAt(0).toUpperCase() + section.type.slice(1);
  const artistPart = section.artists && section.artists.length > 0
    ? ` (${section.artists.join(', ')})`
    : '';
  const numberPart = section.number > 1 ? ` ${section.number}` : '';
  return `${typeLabel}${numberPart}${artistPart}`;
};

const parseSection = (headerLine, previousSections = []) => {
  const validTypes = ['verse', 'chorus', 'pre-chorus', 'bridge', 'intro', 'outro', 'interlude', 'break'];
  
  // Format 1: [Type Number: Artists] (with explicit number)
  const squareMatch = headerLine.match(/^\[([a-z](?:[a-z\s-]*[a-z])?)\s+(\d+)\s*(?:[-:](.+))?\]$/i);
  if (squareMatch) {
    const [, typeStr, num, extra] = squareMatch;
    let type = normalizeType(typeStr);
    
    if (validTypes.includes(type)) {
      const section = {
        type: type,
        number: parseInt(num) || 1,
        originalText: headerLine,
        artists: parseArtists(extra)
      };
      
      section.label = generateSectionLabel(section);
      return section;
    }
  }
  
  // Format 2: [Type: Artists] (no explicit number, auto-number)
  const namedMatch = headerLine.match(/^\[([a-z](?:[a-z\s-]*[a-z])?)(?::\s*(.+))?\]$/i);
  if (namedMatch) {
    const [, typeStr, extra] = namedMatch;
    let type = normalizeType(typeStr);
    
    if (validTypes.includes(type)) {
      const sameTypeSections = previousSections.filter(s => s.type === type);
      const nextNumber = sameTypeSections.length + 1;
      
      const section = {
        type: type,
        number: nextNumber,
        originalText: headerLine,
        artists: parseArtists(extra),
        autoNumbered: true
      };
      
      section.label = generateSectionLabel(section);
      return section;
    }
  }
  
  // Format 3: Type: Artists (bare format)
  const bareMatch = headerLine.match(/^([a-z](?:[a-z\s-]*[a-z])?)(?::\s*(.+))?$/i);
  if (bareMatch && !headerLine.startsWith('[') && (headerLine.includes(':') || !headerLine.match(/[a-z]/i))) {
    const [, typeStr, extra] = bareMatch;
    let type = normalizeType(typeStr);
    
    if (validTypes.includes(type)) {
      const sameTypeSections = previousSections.filter(s => s.type === type);
      const nextNumber = sameTypeSections.length + 1;
      
      const section = {
        type: type,
        number: nextNumber,
        originalText: headerLine,
        artists: parseArtists(extra),
        autoNumbered: true
      };
      
      section.label = generateSectionLabel(section);
      return section;
    }
  }
  
  return null;
};

// Test cases
const testCases = [
  {
    name: 'Format 1: Bracket with number and artist',
    input: '[Verse 1: Kanye West]',
    expectedType: 'verse',
    expectedNumber: 1,
    expectedArtists: ['Kanye West'],
    expectedLabel: 'Verse (Kanye West)',
    previousSections: []
  },
  {
    name: 'Format 1: Bracket with multiple artists',
    input: '[Chorus 2: Kid Cudi, Travis Scott]',
    expectedType: 'chorus',
    expectedNumber: 2,
    expectedArtists: ['Kid Cudi', 'Travis Scott'],
    expectedLabel: 'Chorus 2 (Kid Cudi, Travis Scott)',
    previousSections: []
  },
  {
    name: 'Format 2: Bracket without number, auto-numbered (first)',
    input: '[Verse: Kanye West]',
    expectedType: 'verse',
    expectedNumber: 1,
    expectedArtists: ['Kanye West'],
    expectedAutoNumbered: true,
    expectedLabel: 'Verse (Kanye West)',
    previousSections: []
  },
  {
    name: 'Format 2: Auto-numbered (second verse)',
    input: '[Verse: Kid Cudi]',
    expectedType: 'verse',
    expectedNumber: 2,
    expectedArtists: ['Kid Cudi'],
    expectedAutoNumbered: true,
    expectedLabel: 'Verse 2 (Kid Cudi)',
    previousSections: [
      { type: 'verse', number: 1, artists: ['Kanye West'] }
    ]
  },
  {
    name: 'Format 2: No artists, just bracket',
    input: '[Chorus]',
    expectedType: 'chorus',
    expectedNumber: 1,
    expectedArtists: [],
    expectedAutoNumbered: true,
    expectedLabel: 'Chorus',
    previousSections: []
  },
  {
    name: 'Format 1: Pre-Chorus with number',
    input: '[Pre-Chorus 1: Kanye West]',
    expectedType: 'pre-chorus',
    expectedNumber: 1,
    expectedArtists: ['Kanye West'],
    expectedLabel: 'Pre-Chorus (Kanye West)',
    previousSections: []
  },
  {
    name: 'Format 1: Bridge section',
    input: '[Bridge 1: Tyler, The Creator & Kanye West]',
    expectedType: 'bridge',
    expectedNumber: 1,
    expectedArtists: ['Tyler, The Creator', 'Kanye West'],
    expectedLabel: 'Bridge (Tyler, The Creator, Kanye West)',
    previousSections: []
  },
  {
    name: 'Format 2: Multiple same sections',
    input: '[Chorus: Kid Cudi]',
    expectedType: 'chorus',
    expectedNumber: 3,
    expectedAutoNumbered: true,
    expectedLabel: 'Chorus 3 (Kid Cudi)',
    previousSections: [
      { type: 'verse', number: 1, artists: ['Kanye West'] },
      { type: 'chorus', number: 1, artists: ['Kanye West'] },
      { type: 'chorus', number: 2, artists: ['Kid Cudi'] }
    ]
  },
  {
    name: 'Invalid: Non-verse type should not match',
    input: '[Random: Something]',
    expectedType: null
  }
];

console.log('\n=== PHASE 2: ENHANCED HEADER PARSING TEST ===\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, idx) => {
  const result = parseSection(test.input, test.previousSections || []);
  
  if (!result) {
    if (test.expectedType === null) {
      console.log(`✓ Test ${idx + 1}: ${test.name}`);
      passed++;
    } else {
      console.log(`✗ Test ${idx + 1}: ${test.name}`);
      console.log(`  Input: "${test.input}"`);
      console.log(`  Expected to parse, but got null`);
      failed++;
    }
    return;
  }

  let success = true;
  const issues = [];

  if (result.type !== test.expectedType) {
    success = false;
    issues.push(`type: got "${result.type}", expected "${test.expectedType}"`);
  }

  if (result.number !== test.expectedNumber) {
    success = false;
    issues.push(`number: got ${result.number}, expected ${test.expectedNumber}`);
  }

  if (JSON.stringify(result.artists || []) !== JSON.stringify(test.expectedArtists || [])) {
    success = false;
    issues.push(`artists: got [${(result.artists || []).join(', ')}], expected [${(test.expectedArtists || []).join(', ')}]`);
  }

  if (test.expectedAutoNumbered && !result.autoNumbered) {
    success = false;
    issues.push(`autoNumbered: expected true, got ${result.autoNumbered}`);
  }

  if (result.label !== test.expectedLabel) {
    success = false;
    issues.push(`label: got "${result.label}", expected "${test.expectedLabel}"`);
  }

  if (success) {
    console.log(`✓ Test ${idx + 1}: ${test.name}`);
    passed++;
  } else {
    console.log(`✗ Test ${idx + 1}: ${test.name}`);
    console.log(`  Input: "${test.input}"`);
    issues.forEach(issue => console.log(`  - ${issue}`));
    failed++;
  }
});

console.log(`\n=== RESULTS ===\n`);
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

if (failed === 0) {
  console.log('\n✅ ALL TESTS PASSED - PHASE 2 WORKING!\n');
  console.log('Features verified:');
  console.log('  ✓ Format 1: [Type Number: Artists] with explicit numbers');
  console.log('  ✓ Format 2: [Type: Artists] with auto-numbering');
  console.log('  ✓ Artist extraction with comma and ampersand separators');
  console.log('  ✓ Section label generation with type, number, and artists');
  console.log('  ✓ Auto-numbering based on previous sections\n');
} else {
  console.log('\n❌ SOME TESTS FAILED\n');
  process.exit(1);
}
