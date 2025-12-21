/**
 * Test script to verify question type distribution
 * Run this to confirm that the weighted selection is working correctly
 */

import { initializeQuestionStore, getRandomQuestion } from './server/src/questionStore.js';
import { QUESTION_TYPES } from './server/src/questionTypes.js';

try {
    initializeQuestionStore();
    
    console.log('Testing question type distribution...\n');
    console.log('Expected distribution:');
    console.log('  - true-false: 5%');
    console.log('  - numeric: 5%');
    console.log('  - free-text: 25% (part of 50% typing)');
    console.log('  - multi-entry: 25% (part of 50% typing)');
    console.log('  - multiple-choice: 20%');
    console.log('  - ordered-list: 20%\n');
    
    const sampleSize = 10000;
    const counts = {};
    
    // Initialize counters
    for (const type of Object.values(QUESTION_TYPES)) {
        counts[type] = 0;
    }
    
    // Sample questions
    for (let i = 0; i < sampleSize; i++) {
        const question = getRandomQuestion();
        if (question && question.type) {
            counts[question.type]++;
        }
    }
    
    // Display results
    console.log(`Actual distribution (${sampleSize} samples):`);
    const sortedTypes = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    for (const [type, count] of sortedTypes) {
        const percentage = ((count / sampleSize) * 100).toFixed(2);
        console.log(`  - ${type}: ${percentage}% (${count} questions)`);
    }
    
    // Verify typing questions total
    const typingTotal = counts[QUESTION_TYPES.FREE_TEXT] + counts[QUESTION_TYPES.MULTI_ENTRY];
    const typingPercentage = ((typingTotal / sampleSize) * 100).toFixed(2);
    console.log(`\nTyping questions total (free-text + multi-entry): ${typingPercentage}%`);
    
    // Check if distribution is close to expected
    const expectations = {
        [QUESTION_TYPES.TRUE_FALSE]: 5,
        [QUESTION_TYPES.NUMERIC]: 5,
        [QUESTION_TYPES.FREE_TEXT]: 25,
        [QUESTION_TYPES.MULTI_ENTRY]: 25,
        [QUESTION_TYPES.MULTIPLE_CHOICE]: 20,
        [QUESTION_TYPES.ORDERED_LIST]: 20
    };
    
    console.log('\nDeviation from expected:');
    let allGood = true;
    for (const [type, expected] of Object.entries(expectations)) {
        const actual = ((counts[type] / sampleSize) * 100);
        const deviation = Math.abs(actual - expected);
        const status = deviation < 2 ? '✓' : '⚠';
        console.log(`  ${status} ${type}: ${deviation.toFixed(2)}% deviation`);
        if (deviation >= 2) allGood = false;
    }
    
    console.log(allGood ? '\n✓ All question types are within acceptable range!' : '\n⚠ Some question types deviate significantly from expected distribution');
    
} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}
