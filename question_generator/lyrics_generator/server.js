import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LYRICS_DIR = path.join(__dirname, '../lyrics');
const PROJECTS_FILE = path.join(__dirname, '../projects.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
    const data = req.body;
    
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

    // Helper: Normalize section type string
    const normalizeType = (typeStr) => {
      return typeStr
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/prechorus/, 'pre-chorus');
    };

    // Helper: Extract and parse artist names from string
    const parseArtists = (artistString) => {
      if (!artistString) return [];
      
      // Split by comma or ampersand, clean up
      const artists = artistString
        .split(/[,&]+/)
        .map(a => a.trim())
        .filter(a => a.length > 0);
      
      return artists;
    };

    // Helper: Generate display label for a section
    const generateSectionLabel = (section) => {
      const typeLabel = section.type.charAt(0).toUpperCase() + section.type.slice(1);
      
      // Build artist part
      const artistPart = section.artists && section.artists.length > 0
        ? ` (${section.artists.join(', ')})`
        : '';
      
      // Include number for clarity (skip if number is 1 and no artists)
      const numberPart = section.number > 1 ? ` ${section.number}` : '';
      
      return `${typeLabel}${numberPart}${artistPart}`;
    };

    // Parse section headers with complex formats
    const parseSection = (headerLine, previousSections = []) => {
      const validTypes = ['verse', 'chorus', 'pre-chorus', 'bridge', 'intro', 'outro', 'interlude', 'break'];
      
      // Format 1: [Type Number: Artists] (existing - with explicit number)
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
          
          // Add label combining type, number, and artists
          section.label = generateSectionLabel(section);
          return section;
        }
      }
      
      // Format 2: [Type: Artists] (NEW - no explicit number, auto-number)
      const namedMatch = headerLine.match(/^\[([a-z](?:[a-z\s-]*[a-z])?)(?::\s*(.+))?\]$/i);
      if (namedMatch) {
        const [, typeStr, extra] = namedMatch;
        let type = normalizeType(typeStr);
        
        if (validTypes.includes(type)) {
          // Auto-number: count how many sections of this type exist
          const sameTypeSections = previousSections.filter(s => s.type === type);
          const nextNumber = sameTypeSections.length + 1;
          
          const section = {
            type: type,
            number: nextNumber,
            originalText: headerLine,
            artists: parseArtists(extra),
            autoNumbered: true  // Flag to indicate auto-numbered
          };
          
          section.label = generateSectionLabel(section);
          return section;
        }
      }
      
      // Format 3: Type: Artists (no brackets - bare format)
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

    const parsed = [];
    let currentSection = { type: 'verse', number: 1, originalText: '[Verse 1]' };
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
        parsed.push({
          line_number: ++lineNum,
          content: line.trim(),  // Trim whitespace from content
          section: { ...currentSection },
          voice: { id: 'kanye-west', display: 'Kanye West' },
          meta: {}
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

    res.json({ lines: normalizedLines, allLines });
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
