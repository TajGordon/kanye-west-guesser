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
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
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
    const filePath = path.join(LYRICS_DIR, `${req.params.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    res.json({ success: true, name: req.params.name });
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

    // Parse section headers with complex formats
    const parseSection = (headerLine) => {
      // Try square bracket format: [Type Number: Artists] or [Type Number - Notes]
      const squareMatch = headerLine.match(/^\[(\w+(?:\s+\w+)?)\s*(\d*)\s*(?:[-:](.+))?\]$/i);
      if (squareMatch) {
        const [, typeStr, num, extra] = squareMatch;
        let type = typeStr.trim().toLowerCase().replace(/\s+/g, '-');
        // Normalize "pre chorus" to "pre-chorus"
        type = type === 'pre-chorus' || type === 'prechorus' ? 'pre-chorus' : type;
        
        const section = {
          type: type,
          number: num ? parseInt(num) : 1,
          originalText: headerLine
        };
        
        if (extra) {
          const extraTrim = extra.trim();
          // Simple heuristic: if it has commas or known artists, likely artists; otherwise notes
          const hasComma = extraTrim.includes(',');
          const hasAnd = extraTrim.includes('&');
          const hasKnownArtist = /kanye|west|tyler|thug|cudi|hudson|pusha|scott|dolla|sign/i.test(extraTrim);
          
          if (hasComma || hasAnd || hasKnownArtist) {
            section.artists = extraTrim.split(/,|&/).map(s => s.trim()).filter(Boolean);
          } else {
            section.notes = extraTrim;
          }
        }
        
        return section;
      }
      
      // Try parentheses format: (Type Number)
      const parenMatch = headerLine.match(/^\((\w+(?:\s+\w+)?)\s*(\d*)\)$/i);
      if (parenMatch) {
        const [, typeStr, num] = parenMatch;
        let type = typeStr.trim().toLowerCase().replace(/\s+/g, '-');
        type = type === 'pre-chorus' || type === 'prechorus' ? 'pre-chorus' : type;
        
        return {
          type: type,
          number: num ? parseInt(num) : 1,
          originalText: headerLine
        };
      }
      
      // Try colon format: Type Number: or Type Number -
      const colonMatch = headerLine.match(/^(\w+(?:\s+\w+)?)\s*(\d*)\s*(?:[-:](.+))?$/i);
      if (colonMatch && (headerLine.includes(':') || headerLine.includes('-'))) {
        const [, typeStr, num, extra] = colonMatch;
        let type = typeStr.trim().toLowerCase().replace(/\s+/g, '-');
        type = type === 'pre-chorus' || type === 'prechorus' ? 'pre-chorus' : type;
        
        // Only accept if type is recognized
        const validTypes = ['verse', 'chorus', 'pre-chorus', 'bridge', 'intro', 'outro', 'interlude', 'break'];
        if (validTypes.includes(type)) {
          const section = {
            type: type,
            number: num ? parseInt(num) : 1,
            originalText: headerLine
          };
          
          if (extra) {
            const extraTrim = extra.trim();
            const hasComma = extraTrim.includes(',');
            const hasAnd = extraTrim.includes('&');
            const hasKnownArtist = /kanye|west|tyler|thug|cudi|hudson|pusha|scott|dolla|sign/i.test(extraTrim);
            
            if (hasComma || hasAnd || hasKnownArtist) {
              section.artists = extraTrim.split(/,|&/).map(s => s.trim()).filter(Boolean);
            } else {
              section.notes = extraTrim;
            }
          }
          
          return section;
        }
      }
      
      return null;
    };

    const parsed = [];
    let currentSection = { type: 'verse', number: 1, originalText: '[Verse 1]' };
    let lineNum = 0;
    const allLines = []; // Keep track of all lines for display

    for (const line of lines) {
      // Handle blank lines - preserve them for spacing
      if (line === '') {
        allLines.push({ type: 'blank', content: '' });
        // Still add blank lines to parsed output for structure preservation
        parsed.push({
          line_number: ++lineNum,
          content: '',
          section: { ...currentSection },
          voice: { id: 'kanye-west', display: 'Kanye West' },
          meta: { blank: true }
        });
        continue;
      }

      // Try to detect section headers
      const section = parseSection(line);
      if (section) {
        currentSection = section;
        allLines.push({ type: 'header', content: line, section: currentSection });
        continue;
      }

      // Track all lines (for display)
      allLines.push({ type: isCreditLine(line) ? 'credit' : 'lyric', content: line });

      // Skip credit lines from editable list
      if (!isCreditLine(line)) {
        parsed.push({
          line_number: ++lineNum,
          content: line,
          section: { ...currentSection },
          voice: { id: 'kanye-west', display: 'Kanye West' },
          meta: {}
        });
      }
    }

    res.json({ lines: parsed, allLines });
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
