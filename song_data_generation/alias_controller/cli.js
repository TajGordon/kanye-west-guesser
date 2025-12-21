#!/usr/bin/env node

/**
 * Alias Editor CLI
 * 
 * Interactive command-line tool for managing the alias database.
 * 
 * Commands:
 *   node cli.js                    - Interactive mode
 *   node cli.js search <query>     - Search for entities
 *   node cli.js add <type> <id>    - Add a new entity
 *   node cli.js alias <type> <id> <aliases...> - Add aliases to entity
 *   node cli.js show <type> [id]   - Show entity/entities
 *   node cli.js stats              - Show database statistics
 */

import readline from 'readline';
import {
    loadAliasDatabase,
    saveAliasDatabase,
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

// ============================================================================
// CLI Helpers
// ============================================================================

const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function color(text, c) {
    return `${COLORS[c] || ''}${text}${COLORS.reset}`;
}

function log(text = '') {
    console.log(text);
}

function logSuccess(text) {
    console.log(color('✓ ' + text, 'green'));
}

function logError(text) {
    console.log(color('✗ ' + text, 'red'));
}

function logInfo(text) {
    console.log(color('→ ' + text, 'cyan'));
}

function logHeader(text) {
    console.log('\n' + color(text, 'bright'));
    console.log(color('─'.repeat(text.length), 'dim'));
}

// ============================================================================
// Command Handlers
// ============================================================================

async function cmdSearch(query) {
    if (!query) {
        logError('Usage: search <query>');
        return;
    }
    
    const results = await searchEntities(query);
    
    if (results.length === 0) {
        log(color(`No results for "${query}"`, 'dim'));
        return;
    }
    
    logHeader(`Search results for "${query}" (${results.length} found)`);
    
    for (const { type, id, entity, matchedOn } of results) {
        const typeLabel = type.slice(0, -1); // remove 's'
        log(`  ${color(typeLabel, 'cyan')}: ${color(entity.display, 'bright')} ${color(`(${id})`, 'dim')}`);
        log(`    matched on: ${matchedOn}`);
        if (entity.aliases?.length > 0) {
            log(`    aliases: ${entity.aliases.join(', ')}`);
        }
    }
}

async function cmdShow(type, id) {
    if (!type) {
        // Show all types with counts
        logHeader('Entity Types');
        const stats = await getStats();
        log(`  artists: ${stats.artists}`);
        log(`  albums:  ${stats.albums}`);
        log(`  songs:   ${stats.songs}`);
        log(`\nUse: show <type> [id]`);
        return;
    }
    
    // Normalize type
    const normalizedType = type.endsWith('s') ? type : type + 's';
    
    if (!Object.values(ENTITY_TYPES).includes(normalizedType)) {
        logError(`Unknown type: ${type}. Valid types: artists, albums, songs, years`);
        return;
    }
    
    if (id) {
        // Show specific entity
        const entity = await getEntity(normalizedType, id);
        if (!entity) {
            logError(`No ${type} found with id: ${id}`);
            return;
        }
        
        logHeader(`${normalizedType.slice(0, -1)}: ${entity.display}`);
        log(`  id: ${id}`);
        log(`  display: ${entity.display}`);
        log(`  aliases: ${entity.aliases?.join(', ') || '(none)'}`);
        if (entity.year) log(`  year: ${entity.year}`);
        if (entity.notes) log(`  notes: ${entity.notes}`);
    } else {
        // List all of type
        const entities = await getEntities(normalizedType);
        const ids = Object.keys(entities).filter(k => !k.startsWith('_'));
        
        logHeader(`${normalizedType} (${ids.length})`);
        for (const entityId of ids.sort()) {
            const e = entities[entityId];
            log(`  ${color(entityId, 'cyan')}: ${e.display} ${color(`(${e.aliases?.length || 0} aliases)`, 'dim')}`);
        }
    }
}

async function cmdAdd(type, displayName) {
    if (!type || !displayName) {
        logError('Usage: add <type> <display name>');
        return;
    }
    
    const normalizedType = type.endsWith('s') ? type : type + 's';
    
    if (!Object.values(ENTITY_TYPES).includes(normalizedType)) {
        logError(`Unknown type: ${type}. Valid types: artists, albums, songs, years`);
        return;
    }
    
    const id = generateId(displayName);
    const existing = await getEntity(normalizedType, id);
    
    if (existing) {
        logError(`Entity already exists: ${id}`);
        log(`  display: ${existing.display}`);
        return;
    }
    
    await setEntity(normalizedType, id, {
        display: displayName,
        aliases: []
    });
    
    logSuccess(`Added ${normalizedType.slice(0, -1)}: ${displayName} (${id})`);
    logInfo('Don\'t forget to save!');
}

async function cmdAlias(type, id, ...aliases) {
    if (!type || !id || aliases.length === 0) {
        logError('Usage: alias <type> <id> <alias1> [alias2] [alias3]...');
        return;
    }
    
    const normalizedType = type.endsWith('s') ? type : type + 's';
    const entity = await getEntity(normalizedType, id);
    
    if (!entity) {
        logError(`No ${type} found with id: ${id}`);
        return;
    }
    
    const success = await addAliases(normalizedType, id, aliases);
    
    if (success) {
        logSuccess(`Added ${aliases.length} alias(es) to ${entity.display}`);
        log(`  aliases now: ${(await getEntity(normalizedType, id)).aliases.join(', ')}`);
        logInfo('Don\'t forget to save!');
    } else {
        logError('Failed to add aliases');
    }
}

async function cmdRemoveAlias(type, id, ...aliases) {
    if (!type || !id || aliases.length === 0) {
        logError('Usage: remove-alias <type> <id> <alias1> [alias2]...');
        return;
    }
    
    const normalizedType = type.endsWith('s') ? type : type + 's';
    const entity = await getEntity(normalizedType, id);
    
    if (!entity) {
        logError(`No ${type} found with id: ${id}`);
        return;
    }
    
    const success = await removeAliases(normalizedType, id, aliases);
    
    if (success) {
        logSuccess(`Removed alias(es) from ${entity.display}`);
        log(`  aliases now: ${(await getEntity(normalizedType, id)).aliases.join(', ') || '(none)'}`);
        logInfo('Don\'t forget to save!');
    }
}

async function cmdDelete(type, id) {
    if (!type || !id) {
        logError('Usage: delete <type> <id>');
        return;
    }
    
    const normalizedType = type.endsWith('s') ? type : type + 's';
    const entity = await getEntity(normalizedType, id);
    
    if (!entity) {
        logError(`No ${type} found with id: ${id}`);
        return;
    }
    
    const success = await deleteEntity(normalizedType, id);
    
    if (success) {
        logSuccess(`Deleted: ${entity.display}`);
        logInfo('Don\'t forget to save!');
    }
}

async function cmdStats() {
    const stats = await getStats();
    
    logHeader('Alias Database Statistics');
    log(`  Artists: ${stats.artists}`);
    log(`  Albums:  ${stats.albums}`);
    log(`  Total aliases: ${stats.totalAliases}`);
    log(`  Average aliases per entity: ${stats.averageAliases}`);
    log();
    log(`  Unsaved changes: ${hasUnsavedChanges() ? color('Yes', 'yellow') : color('No', 'green')}`);
}

async function cmdSave() {
    await saveAliasDatabase();
}

async function cmdReload() {
    await loadAliasDatabase();
    logSuccess('Reloaded alias database from disk');
}

function cmdHelp() {
    logHeader('Alias Editor Commands');
    log(`
  ${color('Viewing:', 'bright')}
    search <query>              - Search for entities by name/alias
    show                        - Show entity type counts
    show <type>                 - List all entities of type
    show <type> <id>            - Show specific entity details
    stats                       - Show database statistics
  
  ${color('Editing:', 'bright')}
    add <type> <display name>   - Add a new entity
    alias <type> <id> <alias>   - Add alias(es) to entity
    remove-alias <type> <id> <alias> - Remove alias from entity
    delete <type> <id>          - Delete an entity
  
  ${color('Database:', 'bright')}
    save                        - Save changes to disk
    reload                      - Reload database from disk (discard changes)
  
  ${color('Other:', 'bright')}
    help, ?                     - Show this help
    exit, quit, q               - Exit (warns if unsaved changes)
  
  ${color('Types:', 'dim')} artists, albums, songs, years
`);
}

// ============================================================================
// Interactive Mode
// ============================================================================

async function runInteractive() {
    log(color('\n╔═══════════════════════════════════════╗', 'cyan'));
    log(color('║       Alias Database Editor           ║', 'cyan'));
    log(color('╚═══════════════════════════════════════╝', 'cyan'));
    
    await loadAliasDatabase();
    const stats = await getStats();
    logInfo(`Loaded: ${stats.artists} artists, ${stats.albums} albums, ${stats.totalAliases} aliases`);
    log('Type "help" for commands\n');
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const prompt = () => {
        const dirty = hasUnsavedChanges() ? color('*', 'yellow') : '';
        rl.question(`${dirty}alias> `, async (input) => {
            const args = input.trim().split(/\s+/);
            const cmd = args[0]?.toLowerCase();
            
            try {
                switch (cmd) {
                    case 'search':
                    case 's':
                        await cmdSearch(args.slice(1).join(' '));
                        break;
                    case 'show':
                    case 'ls':
                    case 'list':
                        await cmdShow(args[1], args[2]);
                        break;
                    case 'add':
                        await cmdAdd(args[1], args.slice(2).join(' '));
                        break;
                    case 'alias':
                    case 'a':
                        await cmdAlias(args[1], args[2], ...args.slice(3));
                        break;
                    case 'remove-alias':
                    case 'ra':
                        await cmdRemoveAlias(args[1], args[2], ...args.slice(3));
                        break;
                    case 'delete':
                    case 'del':
                    case 'rm':
                        await cmdDelete(args[1], args[2]);
                        break;
                    case 'stats':
                        await cmdStats();
                        break;
                    case 'save':
                        await cmdSave();
                        break;
                    case 'reload':
                        await cmdReload();
                        break;
                    case 'help':
                    case '?':
                        cmdHelp();
                        break;
                    case 'exit':
                    case 'quit':
                    case 'q':
                        if (hasUnsavedChanges()) {
                            log(color('You have unsaved changes!', 'yellow'));
                            log('Use "save" to save or Ctrl+C to force exit');
                        } else {
                            log('Goodbye!');
                            rl.close();
                            process.exit(0);
                        }
                        break;
                    case '':
                    case undefined:
                        break;
                    default:
                        log(color(`Unknown command: ${cmd}. Type "help" for commands.`, 'dim'));
                }
            } catch (err) {
                logError(`Error: ${err.message}`);
            }
            
            prompt();
        });
    };
    
    prompt();
}

// ============================================================================
// Direct Command Mode
// ============================================================================

async function runCommand(args) {
    await loadAliasDatabase();
    
    const cmd = args[0]?.toLowerCase();
    
    switch (cmd) {
        case 'search':
            await cmdSearch(args.slice(1).join(' '));
            break;
        case 'show':
            await cmdShow(args[1], args[2]);
            break;
        case 'add':
            await cmdAdd(args[1], args.slice(2).join(' '));
            if (hasUnsavedChanges()) await saveAliasDatabase();
            break;
        case 'alias':
            await cmdAlias(args[1], args[2], ...args.slice(3));
            if (hasUnsavedChanges()) await saveAliasDatabase();
            break;
        case 'stats':
            await cmdStats();
            break;
        case 'help':
        case '--help':
        case '-h':
            cmdHelp();
            break;
        default:
            if (cmd) {
                logError(`Unknown command: ${cmd}`);
            }
            cmdHelp();
    }
}

// ============================================================================
// Entry Point
// ============================================================================

const args = process.argv.slice(2);

if (args.length === 0) {
    runInteractive();
} else {
    runCommand(args).catch(err => {
        logError(err.message);
        process.exit(1);
    });
}
