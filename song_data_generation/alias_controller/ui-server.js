/**
 * Alias Editor Web UI Server
 * 
 * A simple web-based UI for managing the alias database.
 * Run with: node ui-server.js
 * Then open: http://localhost:3001
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
    loadAliasDatabase,
    saveAliasDatabase,
    getDatabase,
    hasUnsavedChanges,
    ENTITY_TYPES,
    getEntities,
    getEntity,
    searchEntities,
    setEntity,
    deleteEntity,
    addAliases,
    removeAliases,
    generateId,
    getStats
} from './alias-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static(join(__dirname, 'ui')));

// ============================================================================
// API Routes
// ============================================================================

// Get database stats
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await getStats();
        stats.hasUnsavedChanges = hasUnsavedChanges();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all entities of a type
app.get('/api/entities/:type', async (req, res) => {
    try {
        const type = req.params.type;
        const entities = await getEntities(type);
        
        // Convert to array with IDs
        const result = Object.entries(entities)
            .filter(([id]) => !id.startsWith('_'))
            .map(([id, entity]) => ({ id, ...entity }))
            .sort((a, b) => a.display.localeCompare(b.display));
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single entity
app.get('/api/entities/:type/:id', async (req, res) => {
    try {
        const entity = await getEntity(req.params.type, req.params.id);
        if (!entity) {
            return res.status(404).json({ error: 'Entity not found' });
        }
        res.json({ id: req.params.id, ...entity });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Search entities
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        const type = req.query.type || null;
        const results = await searchEntities(query, type);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create or update entity
app.put('/api/entities/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const data = req.body;
        
        await setEntity(type, id, data);
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add entity (auto-generate ID)
app.post('/api/entities/:type', async (req, res) => {
    try {
        const type = req.params.type;
        const { display, aliases = [] } = req.body;
        
        if (!display) {
            return res.status(400).json({ error: 'Display name required' });
        }
        
        const id = generateId(display);
        const existing = await getEntity(type, id);
        
        if (existing) {
            return res.status(409).json({ error: 'Entity already exists', id });
        }
        
        await setEntity(type, id, { display, aliases });
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete entity
app.delete('/api/entities/:type/:id', async (req, res) => {
    try {
        const success = await deleteEntity(req.params.type, req.params.id);
        res.json({ success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add aliases to entity
app.post('/api/entities/:type/:id/aliases', async (req, res) => {
    try {
        const { aliases } = req.body;
        const success = await addAliases(req.params.type, req.params.id, aliases);
        
        if (success) {
            const entity = await getEntity(req.params.type, req.params.id);
            res.json({ success: true, aliases: entity.aliases });
        } else {
            res.status(404).json({ error: 'Entity not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove alias from entity
app.delete('/api/entities/:type/:id/aliases/:alias', async (req, res) => {
    try {
        const alias = decodeURIComponent(req.params.alias);
        const success = await removeAliases(req.params.type, req.params.id, [alias]);
        
        if (success) {
            const entity = await getEntity(req.params.type, req.params.id);
            res.json({ success: true, aliases: entity.aliases });
        } else {
            res.status(404).json({ error: 'Entity not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save database
app.post('/api/save', async (req, res) => {
    try {
        await saveAliasDatabase();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reload database
app.post('/api/reload', async (req, res) => {
    try {
        await loadAliasDatabase();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get full database (for export)
app.get('/api/database', async (req, res) => {
    try {
        const db = await getDatabase();
        res.json(db);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// Start Server
// ============================================================================

async function start() {
    await loadAliasDatabase();
    const stats = await getStats();
    
    app.listen(PORT, () => {
        console.log(`\n╔═══════════════════════════════════════╗`);
        console.log(`║       Alias Editor Web UI             ║`);
        console.log(`╚═══════════════════════════════════════╝`);
        console.log(`\n→ Loaded: ${stats.artists} artists, ${stats.albums} albums`);
        console.log(`→ Server running at: http://localhost:${PORT}`);
        console.log(`\nPress Ctrl+C to stop\n`);
    });
}

start().catch(err => {
    console.error('Failed to start:', err.message);
    process.exit(1);
});
