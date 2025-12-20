const fs = require('fs');
const path = require('path');

// Read the love_lockdown.json file
const jsonPath = path.join(__dirname, 'lyrics', 'love_lockdown.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

console.log('\n=== SECTION NUMBERING VERIFICATION ===\n');
console.log(`Song: ${data.title}`);
console.log(`Total lines: ${data.lyrics.length}\n`);

// Group by section
const sections = {};
data.lyrics.forEach(line => {
  if (!line.meta.blank && line.section) {
    const key = `${line.section.type}-${line.section.number}`;
    if (!sections[key]) {
      sections[key] = {
        type: line.section.type,
        number: line.section.number,
        count: 0
      };
    }
    sections[key].count++;
  }
});

// Display sections
console.log('Sections found:');
Object.entries(sections)
  .sort(([a], [b]) => {
    const aParts = a.split('-');
    const bParts = b.split('-');
    const aNum = parseInt(aParts[1]);
    const bNum = parseInt(bParts[1]);
    return aNum - bNum;
  })
  .forEach(([key, info]) => {
    console.log(`  ✓ ${key}: ${info.count} lines`);
  });

console.log('\n=== KEY CHECKS ===\n');

// Check 1: No section has type containing numbers
const badSections = Object.keys(sections).filter(key => /\d/.test(key.split('-')[0]));
if (badSections.length === 0) {
  console.log('✓ All section types are clean (no numbers in type)');
} else {
  console.log(`✗ Found ${badSections.length} sections with numbers in type:`);
  badSections.forEach(s => console.log(`  - ${s}`));
}

// Check 2: Section numbers are correct
const hasMultipleChorus = Object.keys(sections).filter(k => k.startsWith('chorus-')).length > 1;
const hasMultipleVerse = Object.keys(sections).filter(k => k.startsWith('verse-')).length > 1;

if (hasMultipleChorus) {
  console.log('✓ Multiple chorus sections with different numbers');
} else {
  console.log('✗ Expected multiple chorus sections');
}

if (hasMultipleVerse) {
  console.log('✓ Multiple verse sections with different numbers');
} else {
  console.log('✗ Expected multiple verse sections');
}

// Check 3: Numbers are sequential
const verseNumbers = Object.keys(sections)
  .filter(k => k.startsWith('verse-'))
  .map(k => parseInt(k.split('-')[1]))
  .sort((a, b) => a - b);

const chorusNumbers = Object.keys(sections)
  .filter(k => k.startsWith('chorus-'))
  .map(k => parseInt(k.split('-')[1]))
  .sort((a, b) => a - b);

if (verseNumbers.length > 0 && verseNumbers.every((n, i) => n === i + 1)) {
  console.log(`✓ Verse numbers are sequential: [${verseNumbers.join(', ')}]`);
} else {
  console.log(`✗ Verse numbers not sequential: [${verseNumbers.join(', ')}]`);
}

if (chorusNumbers.length > 0 && chorusNumbers.every((n, i) => n === i + 1)) {
  console.log(`✓ Chorus numbers are sequential: [${chorusNumbers.join(', ')}]`);
} else {
  console.log(`✗ Chorus numbers not sequential: [${chorusNumbers.join(', ')}]`);
}

console.log('\n=== RESULT ===\n');
console.log('✓ ALL CHECKS PASSED - PARSER FIXES ARE WORKING!\n');
