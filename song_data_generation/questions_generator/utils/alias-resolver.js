/**
 * Alias Resolver
 * 
 * Resolves entity references to their display names and aliases
 * from the central aliases.json dictionary.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let aliasData = null;
let entityIndex = new Map();

/**
 * Load the alias dictionary
 */
export function loadAliases(aliasPath = null) {
  const resolvedPath = aliasPath || path.join(__dirname, '../aliases.json');
  
  try {
    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    aliasData = JSON.parse(raw);
    
    // Build index
    entityIndex.clear();
    for (const [entityRef, data] of Object.entries(aliasData.entities || {})) {
      entityIndex.set(entityRef, {
        ref: entityRef,
        type: data.type,
        display: data.display,
        aliases: data.aliases || [data.display.toLowerCase()]
      });
    }
    
    console.log(`[AliasResolver] Loaded ${entityIndex.size} entities from aliases.json`);
    return true;
  } catch (err) {
    console.error(`[AliasResolver] Failed to load aliases: ${err.message}`);
    return false;
  }
}

/**
 * Get entity by reference
 * @param {string} entityRef - e.g., "artist:kanye-west"
 * @returns {object|null}
 */
export function getEntity(entityRef) {
  return entityIndex.get(entityRef) || null;
}

/**
 * Create an entity reference from type and name
 * @param {string} type - "artist", "album", "song"
 * @param {string} name - Display name
 * @returns {string}
 */
export function createEntityRef(type, name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${type}:${slug}`;
}

/**
 * Resolve or create an entity with aliases
 * If entity exists in dictionary, use those aliases.
 * Otherwise, create a minimal alias set from the display name.
 * 
 * @param {string} type - "artist", "album", "song", "word"
 * @param {string} displayName - The display name
 * @returns {object} - { entityRef, display, aliases }
 */
export function resolveOrCreateEntity(type, displayName) {
  const entityRef = createEntityRef(type, displayName);
  const existing = entityIndex.get(entityRef);
  
  if (existing) {
    return {
      entityRef: existing.ref,
      display: existing.display,
      aliases: [...existing.aliases]
    };
  }
  
  // Create minimal alias set
  const normalizedName = displayName.toLowerCase().trim();
  const aliases = [normalizedName];
  
  // Add display name if different from normalized
  if (displayName.trim() !== normalizedName) {
    aliases.unshift(displayName.trim());
  }
  
  return {
    entityRef,
    display: displayName.trim(),
    aliases
  };
}

/**
 * Get all entities of a given type
 * @param {string} type - "artist", "album", etc.
 * @returns {Array}
 */
export function getEntitiesByType(type) {
  const results = [];
  for (const [ref, data] of entityIndex) {
    if (data.type === type) {
      results.push(data);
    }
  }
  return results;
}

/**
 * Check if an entity exists
 * @param {string} entityRef 
 * @returns {boolean}
 */
export function hasEntity(entityRef) {
  return entityIndex.has(entityRef);
}

// Export the raw data for inspection
export function getAliasData() {
  return aliasData;
}
