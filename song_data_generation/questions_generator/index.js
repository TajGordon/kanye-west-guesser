#!/usr/bin/env node
/**
 * Question Generator - Main Orchestrator
 * 
 * Loads lyrics, runs configured generators, and outputs question files.
 * 
 * Usage:
 *   node index.js                    # Run all enabled generators
 *   node index.js --type=fill-missing-word  # Run specific generator
 *   node index.js --dry-run          # Preview without writing files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadLyrics, getAllSongs } from './utils/lyrics-loader.js';
import { loadAliases } from './utils/alias-resolver.js';
import { createOutputFile } from './utils/question-schema.js';
import { validateQuestions, checkDuplicateIds, printValidationReport } from './utils/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Available generators
const GENERATORS = {
  'fill-missing-word': () => import('./generators/fill-missing-word.js'),
  'song-from-lyric': () => import('./generators/song-from-lyric.js'),
  'album-from-song': () => import('./generators/album-from-song.js'),
  'year-from-song': () => import('./generators/year-from-song.js'),
  'year-from-album': () => import('./generators/year-from-album.js'),
  'artist-from-lyric': () => import('./generators/artist-from-lyric.js'),
  'artist-from-song': () => import('./generators/artist-from-song.js'),
  'next-line': () => import('./generators/next-line.js'),
  'features-on-song': () => import('./generators/features-on-song.js')
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    types: [],
    dryRun: false,
    verbose: false,
    validate: true,       // Run validation by default
    strict: false         // Treat warnings as errors
  };
  
  for (const arg of args) {
    if (arg.startsWith('--type=')) {
      options.types.push(arg.slice(7));
    } else if (arg.startsWith('--generators=')) {
      options.types.push(...arg.slice(13).split(','));
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--no-validate') {
      options.validate = false;
    } else if (arg === '--strict') {
      options.strict = true;
    }
  }
  
  return options;
}

/**
 * Load configuration
 */
function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to load config.json: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Ensure output directory exists
 */
function ensureOutputDir(outputPath) {
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
    console.log(`Created output directory: ${outputPath}`);
  }
}

/**
 * Write questions to file
 */
function writeOutput(outputPath, generatorType, outputData) {
  const fileName = `${generatorType}.json`;
  const filePath = path.join(outputPath, fileName);
  
  const json = JSON.stringify(outputData, null, 2);
  fs.writeFileSync(filePath, json, 'utf-8');
  
  console.log(`Wrote ${outputData.questions.length} questions to ${filePath}`);
}

/**
 * Main entry point
 */
async function main() {
  console.log('=== Question Generator ===\n');
  
  const options = parseArgs();
  const config = loadConfig();
  
  // Resolve paths
  const lyricsPath = path.resolve(__dirname, config.inputPaths.lyrics);
  const projectsPath = path.resolve(__dirname, config.inputPaths.projects);
  const aliasesPath = path.resolve(__dirname, config.inputPaths.aliases);
  const outputPath = path.resolve(__dirname, config.outputPath);
  
  // Load data
  console.log('Loading data...');
  loadAliases(aliasesPath);
  loadLyrics(lyricsPath, projectsPath);
  
  const songs = getAllSongs();
  console.log(`\nReady to generate questions from ${songs.length} songs\n`);
  
  // Determine which generators to run
  let generatorsToRun = [];
  
  if (options.types.length > 0) {
    // Run specific generators
    for (const type of options.types) {
      if (!GENERATORS[type]) {
        console.error(`Unknown generator type: ${type}`);
        console.error(`Available types: ${Object.keys(GENERATORS).join(', ')}`);
        process.exit(1);
      }
      if (config.generators[type]?.enabled !== false) {
        generatorsToRun.push(type);
      } else {
        console.warn(`Generator ${type} is disabled in config`);
      }
    }
  } else {
    // Run all enabled generators
    for (const [type, genConfig] of Object.entries(config.generators)) {
      if (genConfig.enabled !== false && GENERATORS[type]) {
        generatorsToRun.push(type);
      }
    }
  }
  
  if (generatorsToRun.length === 0) {
    console.log('No generators to run.');
    return;
  }
  
  console.log(`Running generators: ${generatorsToRun.join(', ')}\n`);
  
  // Ensure output directory
  if (!options.dryRun) {
    ensureOutputDir(outputPath);
  }
  
  // Run each generator
  const results = {};
  let allValidationStats = [];

  for (const generatorType of generatorsToRun) {
    console.log(`\n--- ${generatorType} ---`);
    
    try {
      // Dynamic import
      const generatorModule = await GENERATORS[generatorType]();
      
      // Merge config
      const generatorConfig = {
        ...config.defaults,
        ...config.generators[generatorType]
      };
      
      // Generate questions
      let questions = generatorModule.generate(songs, generatorConfig);
      
      // Validate questions
      let validationStats = null;
      if (options.validate && questions.length > 0) {
        const validation = validateQuestions(questions, {
          strict: options.strict,
          removeInvalid: true,
          verbose: options.verbose
        });
        
        questions = validation.valid;
        validationStats = validation.stats;
        allValidationStats.push({ generator: generatorType, stats: validationStats });
        
        if (validation.invalid.length > 0) {
          console.log(`[Validator] Removed ${validation.invalid.length} invalid questions`);
        }
        if (validationStats.warnings > 0) {
          console.log(`[Validator] ${validationStats.warnings} warnings`);
        }
      }
      
      // Check for duplicate IDs
      const dupCheck = checkDuplicateIds(questions);
      if (dupCheck.hasDuplicates) {
        console.warn(`[Warning] Found ${dupCheck.duplicates.size} duplicate question IDs`);
        if (options.verbose) {
          for (const [id, count] of dupCheck.duplicates) {
            console.warn(`  - "${id}" appears ${count} times`);
          }
        }
      }
      
      // Create output file
      const version = generatorModule.meta?.version || '1.0.0';
      const outputData = createOutputFile(generatorType, version, questions);
      
      results[generatorType] = {
        count: questions.length,
        version,
        validation: validationStats
      };
      
      // Write output
      if (!options.dryRun) {
        writeOutput(outputPath, generatorType, outputData);
      } else {
        console.log(`[DRY RUN] Would write ${questions.length} questions`);
      }
      
    } catch (err) {
      console.error(`Error in generator ${generatorType}:`, err);
      results[generatorType] = { error: err.message };
    }
  }
  
  // Summary
  console.log('\n=== Summary ===');
  let totalQuestions = 0;
  let totalWarnings = 0;
  let totalFailed = 0;
  
  for (const [type, result] of Object.entries(results)) {
    if (result.error) {
      console.log(`  ${type}: ERROR - ${result.error}`);
    } else {
      let suffix = '';
      if (result.validation) {
        if (result.validation.failed > 0) {
          suffix += `, ${result.validation.failed} failed validation`;
          totalFailed += result.validation.failed;
        }
        if (result.validation.warnings > 0) {
          suffix += `, ${result.validation.warnings} warnings`;
          totalWarnings += result.validation.warnings;
        }
      }
      console.log(`  ${type}: ${result.count} questions (v${result.version})${suffix}`);
      totalQuestions += result.count;
    }
  }
  
  console.log(`\nTotal: ${totalQuestions} questions`);
  if (totalFailed > 0) {
    console.log(`  Validation failures: ${totalFailed} (removed)`);
  }
  if (totalWarnings > 0) {
    console.log(`  Validation warnings: ${totalWarnings}`);
  }
  
  // Print detailed validation report if verbose
  if (options.verbose && allValidationStats.length > 0) {
    console.log('\n=== Detailed Validation Report ===');
    for (const { generator, stats } of allValidationStats) {
      console.log(`\n[${generator}]`);
      printValidationReport(stats, true);
    }
  }
  
  if (options.dryRun) {
    console.log('\n[DRY RUN] No files were written.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
