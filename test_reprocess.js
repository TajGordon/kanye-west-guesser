const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const testLyrics = `[Verse 1]
This is the first verse
With some lyrics

[Chorus]
This is the chorus
Let's sing it now

[Verse 2]
This is the second verse
Different from the first

[Verse 3]
And now the third verse
Three verses total

[Bridge]
A bridge section here
Breaking it up

[Verse 4]
Fourth verse appears
Near the end`;

async function testParser() {
  console.log('Testing parser with multiple verses...\n');
  console.log('Input text:');
  console.log(testLyrics);
  console.log('\n---\n');
  
  try {
    const response = await fetch('http://localhost:3001/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testLyrics })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('Parser output:');
    console.log(`Total lines: ${data.lines.length}\n`);
    
    // Group by section
    const sections = {};
    data.lines.forEach((line, idx) => {
      if (line.section) {
        const key = `${line.section.type}-${line.section.number}`;
        if (!sections[key]) {
          sections[key] = [];
        }
        sections[key].push(line);
      }
    });
    
    console.log('Sections found:');
    Object.entries(sections).forEach(([key, lines]) => {
      console.log(`  ${key}: ${lines.length} lines`);
      lines.slice(0, 2).forEach(line => {
        console.log(`    - "${line.content.substring(0, 40)}"`);
      });
    });
    
    console.log('\n✅ Test complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testParser();
