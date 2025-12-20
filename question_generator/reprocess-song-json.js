#!/usr/bin/env node
/**
 * Reprocess an existing saved song JSON (question_generator/lyrics/*.json)
 * to rebuild per-line section metadata based on bracket headers embedded
 * in `lyrics[].content`.
 *
 * This fixes files like paranoid.json where headers exist as lines but
 * every line is still tagged as Verse 1.
 *
 * Usage:
 *   node question_generator/reprocess-song-json.js paranoid
 *   node question_generator/reprocess-song-json.js question_generator/lyrics/paranoid.json
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const lyricsDir = path.join(__dirname, 'lyrics');

const normalizeType = (typeStr) => {
  const normalized = String(typeStr)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/prechorus/, 'pre-chorus');

  // Synonyms used in real-world lyric sources (e.g. Genius)
  if (normalized === 'refrain') return 'chorus';
  if (normalized === 'hook') return 'chorus';
  if (normalized === 'post-chorus') return 'chorus';

  return normalized;
};

const parseArtists = (artistString) => {
  if (!artistString) return [];

  const protectedNames = [
    'Tyler, The Creator'
  ];

  let working = String(artistString).trim();

  for (const name of protectedNames) {
    const token = name.replace(/,/g, '__COMMA__');
    working = working.split(name).join(token);
  }

  working = working
    .replace(/\s*&\s*/g, ',')
    .replace(/\s+and\s+/gi, ',');

  return working
    .split(/\s*,\s*/)
    .map(a => a.replace(/__COMMA__/g, ',').trim())
    .filter(a => a.length > 0);
};

const generateSectionLabel = (section) => {
  const typeLabel = String(section.type || '')
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-');

  const artistPart = section.artists && section.artists.length > 0
    ? ` (${section.artists.join(', ')})`
    : '';

  const numberPart = section.number > 1 ? ` ${section.number}` : '';

  return `${typeLabel}${numberPart}${artistPart}`;
};

const parseSection = (headerLine, previousSections = []) => {
  const validTypes = ['verse', 'chorus', 'pre-chorus', 'bridge', 'intro', 'outro', 'interlude', 'break'];

  // Format 1: [Type Number: Artists]
  const squareMatch = headerLine.match(/^\[([a-z](?:[a-z\s-]*[a-z])?)\s+(\d+)\s*(?:[-:](.+))?\]$/i);
  if (squareMatch) {
    const [, typeStr, num, extra] = squareMatch;
    const type = normalizeType(typeStr);

    if (validTypes.includes(type)) {
      const section = {
        type,
        number: parseInt(num, 10) || 1,
        originalText: headerLine,
        artists: parseArtists(extra)
      };
      section.label = generateSectionLabel(section);
      return section;
    }
  }

  // Format 2: [Type: Artists] or [Type]
  const namedMatch = headerLine.match(/^\[([a-z](?:[a-z\s-]*[a-z])?)(?::\s*(.+))?\]$/i);
  if (namedMatch) {
    const [, typeStr, extra] = namedMatch;
    const type = normalizeType(typeStr);

    if (validTypes.includes(type)) {
      const sameTypeSections = previousSections.filter(s => s.type === type);
      const nextNumber = sameTypeSections.length + 1;

      const section = {
        type,
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

const resolveInputPath = (arg) => {
  if (!arg) return null;
  const candidate = arg.trim();

  // If it's already a .json path, resolve relative to repo root.
  if (candidate.toLowerCase().endsWith('.json')) {
    return path.isAbsolute(candidate) ? candidate : path.resolve(repoRoot, candidate);
  }

  // Otherwise treat it as a song name in lyrics/
  return path.join(lyricsDir, `${candidate}.json`);
};

const main = () => {
  const inputArg = process.argv[2];
  const inputPath = resolveInputPath(inputArg);

  if (!inputPath) {
    console.error('Missing input. Example: node question_generator/reprocess-song-json.js paranoid');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const song = JSON.parse(raw);

  if (!Array.isArray(song.lyrics)) {
    console.error('Expected song JSON to have a "lyrics" array.');
    process.exit(1);
  }

  const collectedSections = [];
  let currentSection = { type: 'verse', number: 1, originalText: '[Verse 1]' };

  const outLyrics = [];
  let lineNum = 0;

  for (const entry of song.lyrics) {
    const content = (entry && typeof entry.content === 'string') ? entry.content.trim() : '';

    // Treat bracket section headers as structure, not lyric lines
    const section = parseSection(content, collectedSections);
    if (section) {
      currentSection = section;
      collectedSections.push(section);
      continue;
    }

    if (content.length === 0) {
      // Skip empty lines in saved JSON
      continue;
    }

    const next = {
      ...entry,
      line_number: ++lineNum,
      content,
      section: { ...currentSection }
    };

    // Preserve existing voice if present; otherwise default to song artist
    if (!next.voice || !next.voice.id) {
      const defaultArtist = (song.artist || 'Kanye West').trim();
      next.voice = { id: defaultArtist.toLowerCase().replace(/\s+/g, '-'), display: defaultArtist };
    }

    outLyrics.push(next);
  }

  const backupPath = `${inputPath}.bak`;
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, raw, 'utf8');
  }

  const updatedSong = {
    ...song,
    lyrics: outLyrics
  };

  fs.writeFileSync(inputPath, JSON.stringify(updatedSong, null, 2) + '\n', 'utf8');

  console.log(`Reprocessed: ${path.relative(repoRoot, inputPath)}`);
  console.log(`Backup:      ${path.relative(repoRoot, backupPath)}`);
  console.log(`Lines:       ${song.lyrics.length} -> ${outLyrics.length}`);
  console.log(`Sections:    ${collectedSections.length}`);
};

main();
