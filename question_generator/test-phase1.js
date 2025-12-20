/**
 * Test: Song Name Generation
 * Verifies that song titles are converted to safe filenames
 */

const generateFilename = (songData) => {
  if (!songData) return '';
  
  // Convert title to safe filename
  const filename = (songData.title || 'song')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')       // Spaces to dashes
    .replace(/-+/g, '-')        // Multiple dashes to single
    .trim();
  
  return filename || 'song';
};

const testCases = [
  {
    title: 'Paranoid (CDQ)',
    expected: 'paranoid-cdq'
  },
  {
    title: 'Love Lockdown',
    expected: 'love-lockdown'
  },
  {
    title: 'New Song',
    expected: 'new-song'
  },
  {
    title: 'Bound 2 (Remix)',
    expected: 'bound-2-remix'
  },
  {
    title: 'POWER',
    expected: 'power'
  },
  {
    title: 'All of the Lights (Interlude)',
    expected: 'all-of-the-lights-interlude'
  },
  {
    title: 'Good Morning!!!',
    expected: 'good-morning'
  },
  {
    title: 'Lost in the World / Who Will Survive in America',
    expected: 'lost-in-the-world-who-will-survive-in-america'
  },
  {
    title: '',
    expected: 'song'  // Default
  }
];

console.log('\n=== PHASE 1: SONG NAME GENERATION TEST ===\n');

let passed = 0;
let failed = 0;

testCases.forEach(test => {
  const result = generateFilename({ title: test.title });
  const success = result === test.expected;
  
  if (success) {
    console.log(`✓ "${test.title}" → "${result}"`);
    passed++;
  } else {
    console.log(`✗ "${test.title}" → "${result}" (expected: "${test.expected}")`);
    failed++;
  }
});

console.log(`\n=== RESULTS ===\n`);
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

if (failed === 0) {
  console.log('\n✅ ALL TESTS PASSED - FILENAME GENERATION WORKING!\n');
} else {
  console.log('\n❌ SOME TESTS FAILED\n');
  process.exit(1);
}
