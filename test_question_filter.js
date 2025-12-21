/**
 * Test script for question filter expression parser and evaluator
 */

import { initializeQuestionStore } from './server/src/questionStore.js';
import { 
    parseExpression, 
    evaluateExpression, 
    filterQuestionsByExpression,
    validateExpression,
    getFilterStatistics
} from './server/src/questionFilter.js';

try {
    console.log('Initializing question store...\n');
    initializeQuestionStore();
    
    console.log('Testing Question Filter Expressions\n');
    console.log('=' .repeat(60));
    
    const tests = [
        { expr: '*', desc: 'All questions (wildcard)' },
        { expr: 'easy', desc: 'Easy questions only' },
        { expr: 'hard', desc: 'Hard questions only' },
        { expr: '!hard', desc: 'Everything except hard' },
        { expr: 'easy | medium', desc: 'Easy OR medium' },
        { expr: 'lyrics & easy', desc: 'Lyrics AND easy' },
        { expr: '(easy | medium) & lyrics', desc: 'Complex: (easy OR medium) AND lyrics' },
        { expr: 'input:free-text', desc: 'Free-text questions' },
        { expr: 'input:multiple-choice', desc: 'Multiple choice questions' },
        { expr: 'input:true-false', desc: 'True/false questions' },
        { expr: 'input:multi-entry', desc: 'Multi-entry questions' },
        { expr: 'gen:artist-from-lyric & !hard', desc: 'Artist from lyric, not hard' },
        { expr: '!(hard | input:true-false)', desc: 'NOT (hard OR true-false)' }
    ];
    
    for (const test of tests) {
        console.log(`\n${test.desc}`);
        console.log(`  Expression: "${test.expr}"`);
        
        // Validate
        const validation = validateExpression(test.expr);
        if (!validation.valid) {
            console.log(`  ❌ Invalid: ${validation.error}`);
            continue;
        }
        
        // Parse
        const ast = parseExpression(test.expr);
        console.log(`  ✓ Parsed: ${JSON.stringify(ast, null, 2).replace(/\n/g, '\n    ')}`);
        
        // Get statistics
        const stats = getFilterStatistics(test.expr);
        console.log(`  ✓ Matched: ${stats.total.toLocaleString()} questions`);
        
        // Sample a few questions
        const filteredIds = filterQuestionsByExpression(test.expr);
        const sampleSize = Math.min(3, filteredIds.size);
        if (sampleSize > 0) {
            console.log(`  Sample questions (${sampleSize}):`);
            let count = 0;
            for (const id of filteredIds) {
                if (count >= sampleSize) break;
                console.log(`    - ${id}`);
                count++;
            }
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✓ All tests completed successfully!');
    
    // Test some invalid expressions
    console.log('\n\nTesting Invalid Expressions:');
    console.log('=' .repeat(60));
    
    const invalidTests = [
        { expr: '(easy & medium', desc: 'Unbalanced parentheses' },
        { expr: 'easy &', desc: 'Incomplete expression' },
        { expr: '& easy', desc: 'Leading operator' }
    ];
    
    for (const test of invalidTests) {
        console.log(`\n${test.desc}`);
        console.log(`  Expression: "${test.expr}"`);
        const validation = validateExpression(test.expr);
        if (validation.valid) {
            console.log(`  ⚠ Unexpectedly valid!`);
        } else {
            console.log(`  ✓ Correctly rejected: ${validation.error}`);
        }
    }
    
} catch (error) {
    console.error('Error:', error);
    console.error(error.stack);
    process.exit(1);
}
