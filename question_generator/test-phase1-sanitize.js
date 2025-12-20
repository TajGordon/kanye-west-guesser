/**
 * Test: Server-Side Filename Sanitization
 * Verifies that the server sanitizes filenames to prevent path traversal
 */

const sanitizeFilename = (name) => {
  const sanitized = String(name)
    .replace(/[^\w-]/g, '')  // Only allow alphanumeric and dash
    .trim();
  
  return sanitized && sanitized.length > 0 ? sanitized : null;
};

const testCases = [
  {
    input: 'paranoid-cdq',
    expected: 'paranoid-cdq',
    description: 'Normal filename'
  },
  {
    input: 'Love Lockdown',
    expected: null,  // Invalid - spaces removed, then dashes aren't alphanumeric
    description: 'Filename with spaces (should fail)'
  },
  {
    input: 'paranoid',
    expected: 'paranoid',
    description: 'Simple filename'
  },
  {
    input: '../../../etc/passwd',
    expected: null,  // Path traversal blocked
    description: 'Path traversal attempt (BLOCKED)'
  },
  {
    input: 'song-name-123',
    expected: 'song-name-123',
    description: 'Filename with dashes and numbers'
  },
  {
    input: '../../secret',
    expected: null,  // Path traversal blocked
    description: 'Relative path (BLOCKED)'
  },
  {
    input: '/etc/passwd',
    expected: null,  // Absolute path blocked
    description: 'Absolute path (BLOCKED)'
  },
  {
    input: 'song$(whoami)',
    expected: 'songwhoami',  // Command injection stripped
    description: 'Command injection attempt (STRIPPED)'
  },
  {
    input: '',
    expected: null,  // Empty not allowed
    description: 'Empty string (BLOCKED)'
  },
  {
    input: ';;;',
    expected: null,  // Invalid characters only
    description: 'Invalid characters only (BLOCKED)'
  },
  {
    input: 'PARANOID-CDQ',
    expected: 'PARANOID-CDQ',  // Keeps case
    description: 'Uppercase filename'
  }
];

console.log('\n=== PHASE 1: SERVER-SIDE SANITIZATION TEST ===\n');

let passed = 0;
let failed = 0;

testCases.forEach(test => {
  const result = sanitizeFilename(test.input);
  const success = result === test.expected;
  
  const status = success ? '✓' : '✗';
  const details = success ? '' : ` (got: "${result}", expected: "${test.expected}")`;
  
  console.log(`${status} ${test.description}: "${test.input}"${details}`);
  
  if (success) {
    passed++;
  } else {
    failed++;
  }
});

console.log(`\n=== RESULTS ===\n`);
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

if (failed === 0) {
  console.log('\n✅ ALL TESTS PASSED - SANITIZATION WORKING!\n');
  console.log('Security notes:');
  console.log('  ✓ Path traversal blocked (../)');
  console.log('  ✓ Absolute paths blocked (/)');
  console.log('  ✓ Command injection characters removed');
  console.log('  ✓ Only alphanumeric and dashes allowed\n');
} else {
  console.log('\n❌ SOME TESTS FAILED\n');
  process.exit(1);
}
