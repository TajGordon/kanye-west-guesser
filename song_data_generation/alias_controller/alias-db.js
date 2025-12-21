/**
 * Alias Database Manager
 * 
 * Core module for reading, writing, and querying the alias database.
 * This is the programmatic interface - the CLI and application scripts use this.
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ALIASES_PATH = join(__dirname, 'aliases.json');

// ============================================================================
// Database Loading/Saving
// ============================================================================

let aliasDb = null;
let isDirty = false;

/**
 * Load the alias database from disk
 * @returns {Promise<object>}
 */
export async function loadAliasDatabase() {
    const content = await readFile(ALIASES_PATH, 'utf-8');
    aliasDb = JSON.parse(content);
    isDirty = false;
    return aliasDb;
}

/**
 * Save the alias database to disk
 * @returns {Promise<void>}
 */
export async function saveAliasDatabase() {
    if (!aliasDb) {
        throw new Error('No database loaded');
    }
    aliasDb.meta.updatedAt = new Date().toISOString();
    const content = JSON.stringify(aliasDb, null, 2);
    await writeFile(ALIASES_PATH, content, 'utf-8');
    isDirty = false;
    console.log(`✓ Saved alias database (${new Date().toLocaleTimeString()})`);
}

/**
 * Get the current database (load if not loaded)
 * @returns {Promise<object>}
 */
export async function getDatabase() {
    if (!aliasDb) {
        await loadAliasDatabase();
    }
    return aliasDb;
}

/**
 * Check if there are unsaved changes
 * @returns {boolean}
 */
export function hasUnsavedChanges() {
    return isDirty;
}

// ============================================================================
// Entity Types
// ============================================================================

export const ENTITY_TYPES = {
    ARTIST: 'artists',
    ALBUM: 'albums',
    SONG: 'songs',
    YEAR: 'years'
};

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all entities of a type
 * @param {string} type - One of ENTITY_TYPES
 * @returns {Promise<object>}
 */
export async function getEntities(type) {
    const db = await getDatabase();
    return db[type] || {};
}

/**
 * Get a specific entity by ID
 * @param {string} type 
 * @param {string} id 
 * @returns {Promise<object|null>}
 */
export async function getEntity(type, id) {
    const db = await getDatabase();
    return db[type]?.[id] || null;
}

/**
 * Search for entities by name or alias
 * @param {string} query - Search term
 * @param {string} [type] - Optional type filter
 * @returns {Promise<Array<{type: string, id: string, entity: object, matchedOn: string}>>}
 */
export async function searchEntities(query, type = null) {
    const db = await getDatabase();
    const results = [];
    const normalizedQuery = query.toLowerCase().trim();
    
    const typesToSearch = type ? [type] : Object.values(ENTITY_TYPES);
    
    for (const entityType of typesToSearch) {
        const entities = db[entityType];
        if (!entities || typeof entities !== 'object') continue;
        
        // Skip metadata fields
        if (entities._note) continue;
        
        for (const [id, entity] of Object.entries(entities)) {
            if (id.startsWith('_')) continue; // Skip metadata
            
            // Check display name
            if (entity.display?.toLowerCase().includes(normalizedQuery)) {
                results.push({ type: entityType, id, entity, matchedOn: 'display' });
                continue;
            }
            
            // Check aliases
            if (Array.isArray(entity.aliases)) {
                const matchedAlias = entity.aliases.find(a => 
                    a.toLowerCase().includes(normalizedQuery)
                );
                if (matchedAlias) {
                    results.push({ type: entityType, id, entity, matchedOn: `alias: ${matchedAlias}` });
                    continue;
                }
            }
            
            // Check ID
            if (id.includes(normalizedQuery)) {
                results.push({ type: entityType, id, entity, matchedOn: 'id' });
            }
        }
    }
    
    return results;
}

/**
 * Find entity by exact match (for answer resolution)
 * @param {string} answer - The answer text
 * @param {string} [type] - Optional type filter
 * @returns {Promise<{type: string, id: string, entity: object}|null>}
 */
export async function resolveAnswer(answer, type = null) {
    const db = await getDatabase();
    const normalized = answer.toLowerCase().trim();
    
    const typesToSearch = type ? [type] : Object.values(ENTITY_TYPES);
    
    for (const entityType of typesToSearch) {
        const entities = db[entityType];
        if (!entities || typeof entities !== 'object') continue;
        
        for (const [id, entity] of Object.entries(entities)) {
            if (id.startsWith('_')) continue;
            
            // Exact match on display
            if (entity.display?.toLowerCase() === normalized) {
                return { type: entityType, id, entity };
            }
            
            // Exact match on alias
            if (Array.isArray(entity.aliases)) {
                if (entity.aliases.some(a => a.toLowerCase() === normalized)) {
                    return { type: entityType, id, entity };
                }
            }
        }
    }
    
    return null;
}

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Add or update an entity
 * @param {string} type 
 * @param {string} id 
 * @param {object} data - { display, aliases, ...other }
 * @returns {Promise<void>}
 */
export async function setEntity(type, id, data) {
    const db = await getDatabase();
    
    if (!db[type]) {
        db[type] = {};
    }
    
    db[type][id] = {
        ...db[type][id],
        ...data
    };
    
    isDirty = true;
}

/**
 * Delete an entity
 * @param {string} type 
 * @param {string} id 
 * @returns {Promise<boolean>}
 */
export async function deleteEntity(type, id) {
    const db = await getDatabase();
    
    if (db[type]?.[id]) {
        delete db[type][id];
        isDirty = true;
        return true;
    }
    
    return false;
}

/**
 * Add aliases to an existing entity
 * @param {string} type 
 * @param {string} id 
 * @param {string[]} aliases 
 * @returns {Promise<boolean>}
 */
export async function addAliases(type, id, aliases) {
    const db = await getDatabase();
    const entity = db[type]?.[id];
    
    if (!entity) {
        return false;
    }
    
    if (!Array.isArray(entity.aliases)) {
        entity.aliases = [];
    }
    
    // Add new aliases (deduplicated, case-insensitive)
    const existingLower = new Set(entity.aliases.map(a => a.toLowerCase()));
    for (const alias of aliases) {
        const normalized = alias.trim();
        if (normalized && !existingLower.has(normalized.toLowerCase())) {
            entity.aliases.push(normalized);
            existingLower.add(normalized.toLowerCase());
        }
    }
    
    isDirty = true;
    return true;
}

/**
 * Remove aliases from an entity
 * @param {string} type 
 * @param {string} id 
 * @param {string[]} aliases 
 * @returns {Promise<boolean>}
 */
export async function removeAliases(type, id, aliases) {
    const db = await getDatabase();
    const entity = db[type]?.[id];
    
    if (!entity || !Array.isArray(entity.aliases)) {
        return false;
    }
    
    const toRemove = new Set(aliases.map(a => a.toLowerCase()));
    entity.aliases = entity.aliases.filter(a => !toRemove.has(a.toLowerCase()));
    
    isDirty = true;
    return true;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a slug ID from a display name
 * @param {string} name 
 * @returns {string}
 */
export function generateId(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

/**
 * Get statistics about the alias database
 * @returns {Promise<object>}
 */
export async function getStats() {
    const db = await getDatabase();
    
    const stats = {
        artists: 0,
        albums: 0,
        songs: 0,
        totalAliases: 0,
        averageAliases: 0
    };
    
    for (const type of ['artists', 'albums']) {
        const entities = db[type];
        if (!entities) continue;
        
        for (const [id, entity] of Object.entries(entities)) {
            if (id.startsWith('_')) continue;
            stats[type]++;
            if (Array.isArray(entity.aliases)) {
                stats.totalAliases += entity.aliases.length;
            }
        }
    }
    
    const totalEntities = stats.artists + stats.albums + stats.songs;
    stats.averageAliases = totalEntities > 0 
        ? (stats.totalAliases / totalEntities).toFixed(1)
        : 0;
    
    return stats;
}

/**
 * Build a lookup map from the database for fast answer resolution
 * @returns {Promise<Map<string, {type: string, id: string, display: string}>>}
 */
export async function buildLookupMap() {
    const db = await getDatabase();
    const map = new Map();
    
    for (const type of ['artists', 'albums']) {
        const entities = db[type];
        if (!entities) continue;
        
        for (const [id, entity] of Object.entries(entities)) {
            if (id.startsWith('_')) continue;
            
            const entry = { type, id, display: entity.display };
            
            // Add display name
            if (entity.display) {
                map.set(entity.display.toLowerCase(), entry);
            }
            
            // Add all aliases
            if (Array.isArray(entity.aliases)) {
                for (const alias of entity.aliases) {
                    const key = alias.toLowerCase();
                    if (!map.has(key)) {
                        map.set(key, entry);
                    }
                }
            }
        }
    }
    
    return map;
}

export default {
    loadAliasDatabase,
    saveAliasDatabase,
    getDatabase,
    hasUnsavedChanges,
    ENTITY_TYPES,
    getEntities,
    getEntity,
    searchEntities,
    resolveAnswer,
    setEntity,
    deleteEntity,
    addAliases,
    removeAliases,
    generateId,
    getStats,
    buildLookupMap
};
