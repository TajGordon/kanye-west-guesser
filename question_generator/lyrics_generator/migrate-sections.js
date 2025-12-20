#!/usr/bin/env node

/**
 * Migration script to fix section format in all song JSON files
 * Converts old format: {type: "verse-1"} -> new format: {type: "verse", number: 1}
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LYRICS_DIR = path.join(__dirname, '../lyrics');

// Normalize section format: "verse-1" -> {type: "verse", number: 1}
const normalizeSectionFormat = (lyrics) => {
  if (!Array.isArray(lyrics)) return lyrics;
  
  return lyrics.map((line, idx) => {
    if (!line.section) return line;
    
    const section = { ...line.section };
    let wasModified = false;
    
    // Check if type contains a number (old format: "verse-1")
    if (typeof section.type === 'string' && section.type.includes('-')) {
      const parts = section.type.split('-');
      const lastPart = parts[parts.length - 1];
      
      // If last part is a number, extract it
      if (/^\d+$/.test(lastPart)) {
        const typeWithoutNum = parts.slice(0, -1).join('-');
        const extractedNum = parseInt(lastPart);
        console.log(`  Line ${idx}: Fixed type "${section.type}" -> type: "${typeWithoutNum}", number: ${extractedNum}`);
        section.type = typeWithoutNum;
        section.number = extractedNum;
        wasModified = true;
      }
    }
    
    // Ensure number is always an integer
    if (section.number && typeof section.number !== 'number') {
      console.log(`  Line ${idx}: Fixed number type from ${typeof section.number} to number`);
      section.number = parseInt(section.number) || 1;
      wasModified = true;
    }
    
    if (!Number.isInteger(section.number)) {
      console.log(`  Line ${idx}: Fixed non-integer number ${section.number} -> ${Math.floor(section.number)}`);
      section.number = Math.floor(section.number) || 1;
      wasModified = true;
    }
    
    return {
      ...line,
      section
    };
  });
};

console.log('🔄 Starting section format migration...\n');

try {
  const files = fs.readdirSync(LYRICS_DIR).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.log('❌ No JSON files found in lyrics directory');
    process.exit(1);
  }
  
  console.log(`Found ${files.length} song files to check:\n`);
  
  let filesModified = 0;
  let totalLinesFixed = 0;
  
  for (const file of files) {
    const filePath = path.join(LYRICS_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (!data.lyrics || !Array.isArray(data.lyrics)) {
      console.log(`⏭️  ${file}: No lyrics array found, skipping`);
      continue;
    }
    
    console.log(`📝 Processing ${file}...`);
    const originalLyricsCount = data.lyrics.length;
    
    // Normalize sections
    const normalizedLyrics = normalizeSectionFormat(data.lyrics);
    
    // Check if anything changed
    const hasChanges = JSON.stringify(data.lyrics) !== JSON.stringify(normalizedLyrics);
    
    if (hasChanges) {
      data.lyrics = normalizedLyrics;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      filesModified++;
      totalLinesFixed += originalLyricsCount;
      console.log(`   ✅ Saved ${file}\n`);
    } else {
      console.log(`   ✅ Already in correct format\n`);
    }
  }
  
  console.log('\n✨ Migration complete!');
  console.log(`   Files modified: ${filesModified}/${files.length}`);
  console.log(`   Lines processed: ${totalLinesFixed}`);
  
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
}
