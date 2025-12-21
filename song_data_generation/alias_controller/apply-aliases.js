#!/usr/bin/env node

/**
 * Apply Aliases Script
 * 
 * Reads the central alias database and applies aliases to all questions
 * in server/data/questions/. This ensures all questions have consistent,
 * up-to-date alias information.
 * 
 * Usage:
 *   node apply-aliases.js              - Apply to all question files
 *   node apply-aliases.js --dry-run    - Preview changes without writing
 *   node apply-aliases.js --stats      - Show statistics only
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildLookupMap, getStats, loadAliasDatabase } from './alias-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const QUESTIONS_DIR = join(__dirname, '../../server/data/questions');

// ============================================================================
// Helpers
// ============================================================================

const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

function color(text, c) {
    return `${COLORS[c] || ''}${text}${COLORS.reset}`;
}

function log(text = '') {
    console.log(text);
}

// ============================================================================
// Alias Application Logic
// ============================================================================

/**
 * Determine what type of entity an answer represents based on question context
 */
function inferAnswerType(question) {
    const generator = question.generatorType || question.generator || '';
    const title = (question.title || '').toLowerCase();
    
    if (generator.includes('album') || title.includes('album')) {
        return 'albums';
    }
    if (generator.includes('artist') || title.includes('who') || title.includes('artist')) {
        return 'artists';
    }
    if (generator.includes('song') || title.includes('song')) {
        return null; // Songs aren't in our alias DB yet
    }
    if (generator.includes('year') || title.includes('year') || title.includes('when')) {
        return null; // Years don't need aliases
    }
    
    return null;
}

/**
 * Apply aliases to a single answer object
 */
function applyAliasesToAnswer(answer, lookupMap, entityType) {
    if (!answer || !answer.display) {
        return { updated: false, answer };
    }
    
    const key = answer.display.toLowerCase();
    const match = lookupMap.get(key);
    
    if (!match || (entityType && match.type !== entityType)) {
        return { updated: false, answer };
    }
    
    // Get the entity from the lookup to find all aliases
    // The match only contains { type, id, display }
    // We need to look up all aliases from the original database
    return { 
        updated: true, 
        answer,
        entityRef: `${match.type.slice(0, -1)}:${match.id}`
    };
}

/**
 * Process a single question file
 */
async function processQuestionFile(filePath, lookupMap, aliasDb, dryRun = false) {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // Handle both formats: { meta, questions: [] } or just []
    let questions;
    let wrapper = null;
    
    if (Array.isArray(data)) {
        questions = data;
    } else if (data.questions && Array.isArray(data.questions)) {
        questions = data.questions;
        wrapper = data;
    } else {
        return { file: filePath, processed: 0, updated: 0, skipped: true };
    }
    
    let updated = 0;
    
    for (const question of questions) {
        const entityType = inferAnswerType(question);
        
        // Process single 'answer' field
        if (question.answer?.display) {
            const key = question.answer.display.toLowerCase();
            const match = lookupMap.get(key);
            
            if (match && (!entityType || match.type === entityType)) {
                // Get full alias list from database
                const entity = aliasDb[match.type]?.[match.id];
                
                if (entity && entity.aliases) {
                    // Build complete alias list
                    const allAliases = new Set([entity.display]);
                    entity.aliases.forEach(a => allAliases.add(a));
                    
                    // Add existing aliases too (preserve any manual ones)
                    if (question.answer.aliases) {
                        question.answer.aliases.forEach(a => allAliases.add(a));
                    }
                    
                    const newAliases = Array.from(allAliases);
                    
                    // Check if we're actually adding new aliases
                    const oldAliases = question.answer.aliases || [];
                    if (newAliases.length > oldAliases.length) {
                        question.answer.aliases = newAliases;
                        question.answer.entityRef = `${match.type.slice(0, -1)}:${match.id}`;
                        updated++;
                    }
                }
            }
        }
        
        // Process 'answers' array (legacy format)
        if (Array.isArray(question.answers)) {
            for (const answer of question.answers) {
                if (!answer.display) continue;
                
                const key = answer.display.toLowerCase();
                const match = lookupMap.get(key);
                
                if (match && (!entityType || match.type === entityType)) {
                    const entity = aliasDb[match.type]?.[match.id];
                    
                    if (entity && entity.aliases) {
                        const allAliases = new Set([entity.display]);
                        entity.aliases.forEach(a => allAliases.add(a));
                        if (answer.aliases) {
                            answer.aliases.forEach(a => allAliases.add(a));
                        }
                        
                        const newAliases = Array.from(allAliases);
                        const oldAliases = answer.aliases || [];
                        
                        if (newAliases.length > oldAliases.length) {
                            answer.aliases = newAliases;
                            answer.entityRef = `${match.type.slice(0, -1)}:${match.id}`;
                            updated++;
                        }
                    }
                }
            }
        }
        
        // Process wrongAnswerPool
        if (Array.isArray(question.wrongAnswerPool)) {
            for (const item of question.wrongAnswerPool) {
                if (!item.display) continue;
                
                const key = item.display.toLowerCase();
                const match = lookupMap.get(key);
                
                if (match) {
                    const entity = aliasDb[match.type]?.[match.id];
                    
                    if (entity) {
                        // For wrong answers, just add entityRef - don't need full aliases
                        if (!item.entityRef) {
                            item.entityRef = `${match.type.slice(0, -1)}:${match.id}`;
                        }
                    }
                }
            }
        }
    }
    
    // Write back if changes were made
    if (updated > 0 && !dryRun) {
        // Write back in original format (with or without wrapper)
        const output = wrapper ? wrapper : questions;
        await writeFile(filePath, JSON.stringify(output, null, 2), 'utf-8');
    }
    
    return { 
        file: filePath, 
        processed: questions.length, 
        updated, 
        skipped: false 
    };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const statsOnly = args.includes('--stats');
    
    log(color('\n╔═══════════════════════════════════════╗', 'cyan'));
    log(color('║         Apply Aliases Script          ║', 'cyan'));
    log(color('╚═══════════════════════════════════════╝', 'cyan'));
    
    if (dryRun) {
        log(color('\n⚠ DRY RUN MODE - No files will be modified\n', 'yellow'));
    }
    
    // Load alias database
    log(color('→ Loading alias database...', 'dim'));
    const aliasDb = await loadAliasDatabase();
    const lookupMap = await buildLookupMap();
    const stats = await getStats();
    
    log(`  ${stats.artists} artists, ${stats.albums} albums, ${stats.totalAliases} aliases loaded`);
    
    if (statsOnly) {
        log('\nAlias Database Statistics:');
        log(`  Artists: ${stats.artists}`);
        log(`  Albums: ${stats.albums}`);
        log(`  Total aliases: ${stats.totalAliases}`);
        log(`  Average aliases per entity: ${stats.averageAliases}`);
        return;
    }
    
    // Find all question files
    log(color('\n→ Scanning question files...', 'dim'));
    const files = await readdir(QUESTIONS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('_'));
    
    log(`  Found ${jsonFiles.length} question files\n`);
    
    // Process each file
    let totalProcessed = 0;
    let totalUpdated = 0;
    
    for (const file of jsonFiles) {
        const filePath = join(QUESTIONS_DIR, file);
        const result = await processQuestionFile(filePath, lookupMap, aliasDb, dryRun);
        
        totalProcessed += result.processed;
        totalUpdated += result.updated;
        
        if (result.skipped) {
            log(`  ${color('SKIP', 'dim')} ${file}`);
        } else if (result.updated > 0) {
            log(`  ${color('✓', 'green')} ${file}: ${result.updated} answers updated`);
        } else {
            log(`  ${color('-', 'dim')} ${file}: no changes needed`);
        }
    }
    
    // Summary
    log(color('\n═══════════════════════════════════════', 'dim'));
    log(`Questions processed: ${totalProcessed}`);
    log(`Answers updated: ${totalUpdated}`);
    
    if (dryRun && totalUpdated > 0) {
        log(color('\nRun without --dry-run to apply changes', 'yellow'));
    } else if (totalUpdated > 0) {
        log(color('\n✓ All changes saved', 'green'));
    }
}

main().catch(err => {
    console.error(color(`Error: ${err.message}`, 'red'));
    process.exit(1);
});
