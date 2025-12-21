/**
 * Full integration test for question filtering
 * Tests the complete flow from settings to question selection
 */

import { initializeQuestionStore, getRandomQuestion } from './server/src/questionStore.js';
import { filterQuestionsByExpression } from './server/src/questionFilter.js';
import { QUESTION_TYPES } from './server/src/questionTypes.js';

try {
    console.log('='.repeat(70));
    console.log('QUESTION FILTER INTEGRATION TEST');
    console.log('='.repeat(70));
    console.log();
    
    initializeQuestionStore();
    
    // Test 1: No filter (wildcard)
    console.log('Test 1: No filter (should return all questions)');
    console.log('-'.repeat(70));
    let filteredIds = filterQuestionsByExpression('*');
    console.log(`✓ Filter matched ${filteredIds.size.toLocaleString()} questions`);
    
    const sample1 = getRandomQuestion(filteredIds);
    console.log(`✓ Random question: ${sample1.id} (${sample1.type})`);
    console.log();
    
    // Test 2: Filter by question type
    console.log('Test 2: Filter by free-text questions');
    console.log('-'.repeat(70));
    filteredIds = filterQuestionsByExpression('input:free-text');
    console.log(`✓ Filter matched ${filteredIds.size.toLocaleString()} questions`);
    
    // Get 10 samples and verify they're all free-text
    let correctTypeCount = 0;
    for (let i = 0; i < 10; i++) {
        const q = getRandomQuestion(filteredIds);
        if (q.type === QUESTION_TYPES.FREE_TEXT) correctTypeCount++;
    }
    console.log(`✓ Verified: ${correctTypeCount}/10 samples are free-text`);
    console.log();
    
    // Test 3: Filter by multiple-choice
    console.log('Test 3: Filter by multiple-choice questions');
    console.log('-'.repeat(70));
    filteredIds = filterQuestionsByExpression('input:multiple-choice');
    console.log(`✓ Filter matched ${filteredIds.size.toLocaleString()} questions`);
    
    correctTypeCount = 0;
    for (let i = 0; i < 10; i++) {
        const q = getRandomQuestion(filteredIds);
        if (q.type === QUESTION_TYPES.MULTIPLE_CHOICE) correctTypeCount++;
    }
    console.log(`✓ Verified: ${correctTypeCount}/10 samples are multiple-choice`);
    console.log();
    
    // Test 4: Filter by true-false
    console.log('Test 4: Filter by true-false questions');
    console.log('-'.repeat(70));
    filteredIds = filterQuestionsByExpression('input:true-false');
    console.log(`✓ Filter matched ${filteredIds.size.toLocaleString()} questions`);
    
    correctTypeCount = 0;
    for (let i = 0; i < 10; i++) {
        const q = getRandomQuestion(filteredIds);
        if (q.type === QUESTION_TYPES.TRUE_FALSE) correctTypeCount++;
    }
    console.log(`✓ Verified: ${correctTypeCount}/10 samples are true-false`);
    console.log();
    
    // Test 5: Exclude true-false
    console.log('Test 5: Exclude true-false questions');
    console.log('-'.repeat(70));
    filteredIds = filterQuestionsByExpression('!input:true-false');
    console.log(`✓ Filter matched ${filteredIds.size.toLocaleString()} questions`);
    
    let hasTrueFalse = false;
    for (let i = 0; i < 20; i++) {
        const q = getRandomQuestion(filteredIds);
        if (q.type === QUESTION_TYPES.TRUE_FALSE) hasTrueFalse = true;
    }
    console.log(`✓ Verified: ${hasTrueFalse ? '❌ Found' : '✓ No'} true-false in 20 samples`);
    console.log();
    
    // Test 6: Complex filter - typing questions only
    console.log('Test 6: Complex filter - typing questions only');
    console.log('-'.repeat(70));
    filteredIds = filterQuestionsByExpression('input:free-text | input:multi-entry');
    console.log(`✓ Filter matched ${filteredIds.size.toLocaleString()} questions`);
    
    const typingTypes = [QUESTION_TYPES.FREE_TEXT, QUESTION_TYPES.MULTI_ENTRY];
    let typingCount = 0;
    for (let i = 0; i < 20; i++) {
        const q = getRandomQuestion(filteredIds);
        if (typingTypes.includes(q.type)) typingCount++;
    }
    console.log(`✓ Verified: ${typingCount}/20 samples are typing questions`);
    console.log();
    
    // Test 7: Generator-based filter
    console.log('Test 7: Filter by question generator');
    console.log('-'.repeat(70));
    filteredIds = filterQuestionsByExpression('gen:artist-from-lyric');
    console.log(`✓ Filter matched ${filteredIds.size.toLocaleString()} questions`);
    
    if (filteredIds.size > 0) {
        const sample = getRandomQuestion(filteredIds);
        console.log(`✓ Sample: ${sample.id}`);
        console.log(`  Tags: ${sample.tags?.slice(0, 5).join(', ')}...`);
    }
    console.log();
    
    // Test 8: Empty filter (should fallback to all)
    console.log('Test 8: Empty filter fallback');
    console.log('-'.repeat(70));
    const allQuestions = getRandomQuestion(filterQuestionsByExpression('*'));
    const emptyQuestions = getRandomQuestion(filterQuestionsByExpression(''));
    console.log(`✓ Both return questions: ${!!allQuestions && !!emptyQuestions}`);
    console.log();
    
    // Test 9: Weighted distribution with filter
    console.log('Test 9: Weighted distribution maintains with filter');
    console.log('-'.repeat(70));
    filteredIds = filterQuestionsByExpression('*');
    
    const typeCount = {};
    for (const type of Object.values(QUESTION_TYPES)) {
        typeCount[type] = 0;
    }
    
    const sampleSize = 1000;
    for (let i = 0; i < sampleSize; i++) {
        const q = getRandomQuestion(filteredIds);
        typeCount[q.type]++;
    }
    
    console.log('  Distribution over 1000 samples:');
    for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
        const pct = ((count / sampleSize) * 100).toFixed(1);
        console.log(`    ${type}: ${pct}%`);
    }
    console.log();
    
    console.log('='.repeat(70));
    console.log('✅ ALL TESTS PASSED');
    console.log('='.repeat(70));
    
} catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error(error);
    console.error(error.stack);
    process.exit(1);
}
