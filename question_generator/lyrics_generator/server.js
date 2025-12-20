import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseSectionHeader, DEFAULT_VALID_TYPES } from './shared/sectionHeader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LYRICS_DIR = path.join(__dirname, '../lyrics');
const PROJECTS_FILE = path.join(__dirname, '../projects.json');

const CURRENT_SCHEMA_VERSION = 2;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const normalizeSongArtists = (data) => {
  if (!data || typeof data !== 'object') return data;

  // Only apply to lyrics-editor style songs
  const looksLikeLyricsEditorSong =
    typeof data.title === 'string' ||
    Array.isArray(data.lyrics) ||
    typeof data.artist === 'string' ||
    Array.isArray(data.artists);
  if (!looksLikeLyricsEditorSong) return data;

  // Versioned migration: schemaVersion 2 introduces
  // - artists: publisher/primary artist(s)
  // - features: performers beyond the primary
  const current = Number.isInteger(data.schemaVersion) ? data.schemaVersion : 0;

  // Determine primary/publisher
  const legacyArtistsList = Array.isArray(data.artists) ? data.artists : [];
  const primary = (
    (typeof data.artist === 'string' && data.artist.trim())
      ? data.artist.trim()
      : (legacyArtistsList[0] ? String(legacyArtistsList[0]).trim() : 'Kanye West')
  );

  // Migrate old meaning of artists (sometimes used as "all performers")
  if (current < CURRENT_SCHEMA_VERSION) {
    if (!Array.isArray(data.features)) {
      const inferred = legacyArtistsList
        .map(a => String(a).trim())
        .filter(Boolean)
        .filter(a => a.toLowerCase() !== primary.toLowerCase());
      data.features = inferred;
    }
    data.artists = [primary];
    data.artist = primary;
    data.schemaVersion = CURRENT_SCHEMA_VERSION;
  }

  // Normalize publisher artists
  let artists = Array.isArray(data.artists) ? data.artists : null;
  if (!artists || artists.length === 0) {
    artists = [primary || 'Kanye West'];
  }

  const seen = new Set();
  data.artists = artists
    .map(a => String(a).trim())
    .filter(a => a.length > 0)
    .filter(a => {
      const key = a.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // Ensure artist string (legacy primary)
  data.artist = String(data.artists[0] || 'Kanye West');

  // Normalize features (performers)
  const featureInput = Array.isArray(data.features)
    ? data.features
    : (typeof data.features === 'string' ? [data.features] : []);
  const fSeen = new Set();
  data.features = featureInput
    .flatMap(v => String(v).split(','))
    .map(v => v.trim())
    .filter(v => v.length > 0)
    .filter(v => v.toLowerCase() !== data.artist.toLowerCase())
    .filter(v => {
      const key = v.toLowerCase();
      if (fSeen.has(key)) return false;
      fSeen.add(key);
      return true;
    });

  if (!Number.isInteger(data.schemaVersion)) {
    data.schemaVersion = CURRENT_SCHEMA_VERSION;
  }

  return data;
};

const normalizeSongProducers = (data) => {
  if (!data || typeof data !== 'object') return data;

  const input = Array.isArray(data.producers)
    ? data.producers
    : (typeof data.producers === 'string' ? [data.producers] : []);

  const seen = new Set();
  data.producers = input
    .flatMap(p => String(p).split(','))
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .filter(p => {
      const key = p.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return data;
};

const normalizeLineVoices = (song) => {
  if (!song || typeof song !== 'object') return song;
  if (!Array.isArray(song.lyrics)) return song;

  // Performers = publisher artists + features
  const publisher = Array.isArray(song.artists) ? song.artists : (song.artist ? [song.artist] : ['Kanye West']);
  const features = Array.isArray(song.features) ? song.features : [];
  const fallbackPerformers = [...publisher, ...features];

  song.lyrics = song.lyrics.map((line) => {
    if (!line || typeof line !== 'object') return line;

    const fromSection = Array.isArray(line?.section?.artists) ? line.section.artists : [];
    const preferred = fromSection.length > 0 ? fromSection : fallbackPerformers;

    // Back-compat: if voices missing, derive from voice or fallback lists
    let voices = Array.isArray(line.voices) ? line.voices : null;
    if (!voices || voices.length === 0) {
      if (line.voice && typeof line.voice === 'object' && line.voice.id) {
        voices = [line.voice];
      } else {
        voices = preferred.map((name) => ({
          id: String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          display: String(name)
        }));
      }
    }

    // Ensure `voice` stays in sync (primary voice)
    const primaryVoice = voices[0] || line.voice || { id: 'kanye-west', display: 'Kanye West' };

    return {
      ...line,
      voices,
      voice: primaryVoice
    };
  });

  return song;
};

// Load or initialize projects database
const loadProjects = () => {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading projects:', err);
  }
  return {};
};

const saveProjects = (projects) => {
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
  } catch (err) {
    console.error('Error saving projects:', err);
  }
};

// Rebuild projects database from all songs
const rebuildProjectsFromSongs = () => {
  try {
    const projects = {};
    const files = fs.readdirSync(LYRICS_DIR).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(LYRICS_DIR, file), 'utf-8'));
      if (data.release?.project) {
        const projName = data.release.project;
        if (!projects[projName]) {
          projects[projName] = {
            name: projName,
            year: data.release?.year || new Date().getFullYear(),
            formats: data.release?.formats || ['album'],
            artists: ['Kanye West']
          };
        }
      }
    }
    
    return projects;
  } catch (err) {
    console.error('Error rebuilding projects:', err);
    return {};
  }
};

// Normalize section format: "verse-1" -> {type: "verse", number: 1}
const normalizeSectionFormat = (lyrics) => {
  if (!Array.isArray(lyrics)) return lyrics;
  
  return lyrics.map(line => {
    if (!line.section) return line;
    
    const section = { ...line.section };
    
    // CRITICAL: Always ensure type is lowercase and doesn't contain numbers
    if (typeof section.type === 'string') {
      section.type = section.type.toLowerCase().trim();
      
      // Check if type contains a number (old format: "verse-1")
      if (section.type.includes('-')) {
        const parts = section.type.split('-');
        const lastPart = parts[parts.length - 1];
        
        // If last part is a number, extract it
        if (/^\d+$/.test(lastPart)) {
          const typeWithoutNum = parts.slice(0, -1).join('-');
          section.type = typeWithoutNum;
          section.number = parseInt(lastPart);
        }
      }
    }
    
    // CRITICAL: Ensure number is ALWAYS present and is an integer
    if (!section.number || typeof section.number !== 'number') {
      section.number = parseInt(section.number) || 1;
    } else {
      section.number = parseInt(section.number);
    }
    
    return {
      ...line,
      section
    };
  });
};

// Validate section format - throws error if invalid
const validateSectionFormat = (lyrics) => {
  if (!Array.isArray(lyrics)) return;
  
  const validTypes = ['verse', 'chorus', 'pre-chorus', 'bridge', 'intro', 'outro', 'interlude', 'break'];
  
  lyrics.forEach((line, idx) => {
    if (!line.section) {
      throw new Error(`Line ${idx} missing section`);
    }
    
    const { type, number } = line.section;
    
    // Check that type is valid
    if (!validTypes.includes(type)) {
      throw new Error(`Line ${idx} has invalid section type: "${type}". Must be one of: ${validTypes.join(', ')}`);
    }
    
    // Check that number is valid
    if (typeof number !== 'number' || number < 1 || !Number.isInteger(number)) {
      throw new Error(`Line ${idx} has invalid section number: ${number}. Must be a positive integer.`);
    }
    
    // Check that type does NOT contain a number
    if (/\d/.test(type)) {
      throw new Error(`Line ${idx} has number in type "${type}". Type must not contain numbers.`);
    }
  });
};

// List all song files
app.get('/api/songs', (req, res) => {
  try {
    const files = fs.readdirSync(LYRICS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
    res.json({ songs: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Load a song (with raw text if available)
app.get('/api/songs/:name', (req, res) => {
  try {
    const filePath = path.join(LYRICS_DIR, `${req.params.name}.json`);
    const txtPath = path.join(LYRICS_DIR, `${req.params.name}.txt`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    let data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    data = normalizeSongArtists(data);
    data = normalizeSongProducers(data);
    
    // CRITICAL: Normalize section format (fixes old data format where type="verse-1")
    if (data.lyrics) {
      data.lyrics = normalizeSectionFormat(data.lyrics);
      // Validate the normalized data
      try {
        validateSectionFormat(data.lyrics);
      } catch (validationErr) {
        console.error(`Validation error in ${req.params.name}:`, validationErr.message);
        return res.status(500).json({ error: `Data validation failed: ${validationErr.message}` });
      }
    }

    // Back-compat: ensure every line has voices[] (multi-voice candidates)
    data = normalizeLineVoices(data);
    
    // Load raw lyrics text if available
    if (fs.existsSync(txtPath)) {
      const rawText = fs.readFileSync(txtPath, 'utf-8');
      data.rawText = rawText;
    }
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save a song
app.post('/api/songs/:name', (req, res) => {
  try {
    // Sanitize filename to prevent path traversal and invalid characters
    const sanitized = String(req.params.name)
      .replace(/[^\w-]/g, '')  // Only allow alphanumeric and dash
      .trim();
    
    if (!sanitized || sanitized.length === 0) {
      return res.status(400).json({ error: 'Invalid filename - must contain alphanumeric characters' });
    }
    
    const filePath = path.join(LYRICS_DIR, `${sanitized}.json`);
    let data = normalizeSongArtists(req.body);
    data = normalizeSongProducers(data);
    
    // Normalize and validate section format before saving
    if (data.lyrics) {
      data.lyrics = normalizeSectionFormat(data.lyrics);
      
      // Validate that all sections have correct format
      const validSectionTypes = ['verse', 'chorus', 'pre-chorus', 'bridge', 'intro', 'outro', 'interlude', 'break'];
      data.lyrics.forEach((line, idx) => {
        if (line.section) {
          if (!validSectionTypes.includes(line.section.type)) {
            console.warn(`Line ${idx}: Invalid section type "${line.section.type}"`);
          }
          if (!Number.isInteger(line.section.number)) {
            console.warn(`Line ${idx}: Section number is not an integer: ${line.section.number}`);
            line.section.number = parseInt(line.section.number) || 1;
          }
        }
      });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json({ success: true, name: sanitized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Parse raw lyrics text into lines (auto-detect sections, filter credits)
app.post('/api/parse', (req, res) => {
  try {
    const { text } = req.body;
    // Split by newlines but keep blank lines - they're important for structure
    const allTextLines = text.split('\n');
    const lines = allTextLines.map(line => line.trim()); // Keep empty strings for blank lines
    
    // Credit/non-lyric patterns to skip
    const skipPatterns = [
      /^\[(produced|engineered|written|mixed|mastered|arranged|directed|filmed|conceptualized)\s+by/i,
      /^\[(beat|instrumental|sample|interpolation)/i,
      /^\[.*(?:credit|note|info).*\]$/i,
      /^see\s+kanye/i,
      /^get\s+tickets/i,
      /^you\s+might\s+also\s+like/i,
      /^(heartless|say\s+you\s+will|like\s+that)/i
    ];

    const isCreditLine = (line) => skipPatterns.some(pat => pat.test(line));

    // Shared header parser (strict mode for canonical section types)
    const parseSection = (headerLine, previousSections = []) => {
      return parseSectionHeader(headerLine, previousSections, {
        strictTypes: true,
        validTypes: DEFAULT_VALID_TYPES,
        autoNumber: true
      });
    };

    const parsed = [];
    let currentSection = { type: 'verse', number: 1, originalText: '[Verse 1]' };

    const parseProducedByLine = (rawLine) => {
      const m = String(rawLine || '').match(/^\[(produced\s+by)\s+(.+)\]$/i);
      if (!m) return [];
      const body = m[2] || '';
      return body
        .replace(/\s*&\s*/g, ', ')
        .replace(/\s+and\s+/gi, ', ')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    };

    const producersSet = new Set();
    const artistNameToVoiceId = (name) => {
      const n = String(name || '').trim().toLowerCase();
      if (!n) return null;

      const known = {
        'kanye west': 'kanye-west',
        'kid cudi': 'kid-cudi',
        'mr. hudson': 'mr-hudson',
        'mr hudson': 'mr-hudson',
        'travis scott': 'travis-scott',
        'pusha t': 'pusha-t',
        'ty dolla $ign': 'ty-dolla-sign',
        'ty dolla sign': 'ty-dolla-sign',
        'young thug': 'young-thug'
      };

      return known[n] || n.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    };

    const defaultVoiceForSection = (section) => {
      const artists = section && Array.isArray(section.artists) ? section.artists : [];
      if (artists.length === 0) return { id: 'kanye-west', display: 'Kanye West' };

      const primary = artists[0];
      const id = artistNameToVoiceId(primary) || 'kanye-west';
      return { id, display: String(primary) };
    };

    const voicesForSection = (section) => {
      const artists = section && Array.isArray(section.artists) ? section.artists : [];
      if (artists.length === 0) return [];
      return artists.map((name) => ({
        id: artistNameToVoiceId(name) || 'kanye-west',
        display: String(name)
      }));
    };
    let lineNum = 0;
    const allLines = []; // Keep track of all lines for display
    const collectedSections = [];  // Track sections for auto-numbering

    for (const line of lines) {
      // Skip blank lines and whitespace-only lines - they're just visual separators, not lyric data
      if (line.trim() === '') {
        allLines.push({ type: 'blank', content: '' });
        continue;
      }

      // Try to detect section headers (pass collectedSections for auto-numbering)
      // Capture producer credits like: [Produced by Mike Dean & Kanye West]
      const producedBy = parseProducedByLine(line);
      if (producedBy.length > 0) {
        for (const p of producedBy) producersSet.add(p);
        allLines.push({ type: 'credit', content: line });
        continue;
      }

      const section = parseSection(line, collectedSections);
      if (section) {
        currentSection = section;
        collectedSections.push(section);  // Track for next iteration
        allLines.push({ type: 'header', content: line, section: currentSection });
        continue;
      }

      // Track all lines (for display)
      allLines.push({ type: isCreditLine(line) ? 'credit' : 'lyric', content: line });

      // Skip credit lines from editable list
      if (!isCreditLine(line)) {
        const voices = voicesForSection(currentSection);
        parsed.push({
          line_number: ++lineNum,
          content: line.trim(),  // Trim whitespace from content
          section: { ...currentSection },
          voices,
          voice: voices[0] || defaultVoiceForSection(currentSection),
          meta: {
            detectedVoices: Array.isArray(currentSection?.artists) ? [...currentSection.artists] : []
          }
        });
      }
    }

    // Normalize the parsed results before returning
    const normalizedLines = normalizeSectionFormat(parsed);
    
    // CRITICAL: Validate the normalized data
    try {
      validateSectionFormat(normalizedLines);
    } catch (validationErr) {
      console.error('Parse validation error:', validationErr.message);
      return res.status(400).json({ error: `Invalid lyrics format: ${validationErr.message}` });
    }

    res.json({
      lines: normalizedLines,
      allLines,
      meta: {
        producers: Array.from(producersSet)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get list of projects with metadata
app.get('/api/projects', (req, res) => {
  try {
    let projects = loadProjects();
    
    // If projects file is empty, rebuild from songs
    if (Object.keys(projects).length === 0) {
      projects = rebuildProjectsFromSongs();
      saveProjects(projects);
    }
    
    res.json({ 
      projects: Object.values(projects).sort((a, b) => a.name.localeCompare(b.name))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific project metadata
app.get('/api/projects/:name', (req, res) => {
  try {
    const projects = loadProjects();
    const project = projects[req.params.name];
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save or update project metadata
app.post('/api/projects/:name', (req, res) => {
  try {
    const projects = loadProjects();
    const { year, formats, artists } = req.body;
    
    projects[req.params.name] = {
      name: req.params.name,
      year: year || new Date().getFullYear(),
      formats: formats || ['album'],
      artists: artists || ['Kanye West']
    };
    
    saveProjects(projects);
    res.json({ success: true, project: projects[req.params.name] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[lyrics-editor] Server running on http://localhost:${PORT}`);
});
