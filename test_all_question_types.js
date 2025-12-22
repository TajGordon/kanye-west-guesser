/**
 * Comprehensive validation tests for all question types
 * Run with: node test_all_question_types.js
 */

import('./server/src/questionStore.js').then(async qs => {
    qs.initializeQuestionStore();
    
    let passed = 0;
    let failed = 0;
    const errors = [];
    
    function test(name, condition, errorMsg) {
        if (condition) {
            passed++;
            console.log(`  ✓ ${name}`);
        } else {
            failed++;
            errors.push(`${name}: ${errorMsg}`);
            console.log(`  ✗ ${name}: ${errorMsg}`);
        }
    }
    
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║        QUESTION TYPE VALIDATION TEST SUITE               ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    // ========================================
    // FREE-TEXT TESTS
    // ========================================
    console.log('━━━ FREE-TEXT ━━━');
    let q = qs.getQuestionById('test-free-text-1');
    let client = qs.formatQuestionForClient(q);
    let reveal = qs.formatQuestionForReveal(q);
    
    test('Question exists', !!q, 'test-free-text-1 not found');
    test('Has answers array', q?.answers?.length > 0, 'No answers');
    test('Has primaryAnswer', !!q?.primaryAnswer, 'No primaryAnswer');
    test('Client has no answers', !client.answers, 'Answers leaked to client');
    test('Reveal has answers', reveal.answers?.length > 0, 'No answers in reveal');
    test('Exact answer works', qs.evaluateAnswer(q, 'Runaway').isCorrect, 'Exact match failed');
    test('Alias works', qs.evaluateAnswer(q, 'run away').isCorrect, 'Alias match failed');
    test('Wrong answer rejected', !qs.evaluateAnswer(q, 'wrong').isCorrect, 'Wrong answer accepted');
    
    // ========================================
    // MULTIPLE-CHOICE TESTS
    // ========================================
    console.log('\n━━━ MULTIPLE-CHOICE ━━━');
    q = qs.getQuestionById('test-mc-1');
    client = qs.formatQuestionForClient(q);
    reveal = qs.formatQuestionForReveal(q);
    
    test('Question exists', !!q, 'test-mc-1 not found');
    test('Has choices', q?.choices?.length >= 2, 'Need at least 2 choices');
    test('Has correctChoiceId', !!q?.correctChoiceId, 'No correctChoiceId');
    test('Client has choices', client.choices?.length >= 2, 'No choices in client');
    test('Client has no correctChoiceId', !client.correctChoiceId, 'correctChoiceId leaked to client');
    test('Reveal has correctChoiceId', !!reveal.correctChoiceId, 'No correctChoiceId in reveal');
    test('Correct choice works', qs.evaluateChoiceAnswer(q, 'a').isCorrect, 'Correct choice failed');
    test('Wrong choice rejected', !qs.evaluateChoiceAnswer(q, 'b').isCorrect, 'Wrong choice accepted');
    
    // ========================================
    // TRUE-FALSE TESTS
    // ========================================
    console.log('\n━━━ TRUE-FALSE ━━━');
    q = qs.getQuestionById('test-tf-1');
    client = qs.formatQuestionForClient(q);
    reveal = qs.formatQuestionForReveal(q);
    
    test('Question exists', !!q, 'test-tf-1 not found');
    test('Has correctAnswer', q?.correctAnswer !== undefined, 'No correctAnswer');
    test('Client has 2 choices', client.choices?.length === 2, 'Should have exactly 2 choices');
    test('Choices are True/False', 
        client.choices?.some(c => c.text === 'True') && client.choices?.some(c => c.text === 'False'),
        'Choices should be True and False');
    test('Correct answer (true) works', qs.evaluateChoiceAnswer(q, 'true').isCorrect, 'True should be correct');
    test('Wrong answer (false) rejected', !qs.evaluateChoiceAnswer(q, 'false').isCorrect, 'False should be wrong');
    
    // ========================================
    // MULTI-ENTRY TESTS
    // ========================================
    console.log('\n━━━ MULTI-ENTRY ━━━');
    q = qs.getQuestionById('test-multi-entry-1');
    client = qs.formatQuestionForClient(q);
    reveal = qs.formatQuestionForReveal(q);
    
    test('Question exists', !!q, 'test-multi-entry-1 not found');
    test('Has answers array', q?.answers?.length > 0, 'No answers');
    test('Has totalAnswers', q?.totalAnswers > 0, 'No totalAnswers');
    test('Has maxGuesses', q?.maxGuesses > 0, 'No maxGuesses');
    test('Client has totalAnswers', client.totalAnswers > 0, 'No totalAnswers in client');
    test('Client has maxGuesses', client.maxGuesses > 0, 'No maxGuesses in client');
    test('Client has no answers', !client.answers, 'Answers leaked to client');
    test('Reveal has answers', reveal.answers?.length > 0, 'No answers in reveal');
    
    // Check aliases work
    const aliases = q.answers.flatMap(a => a.normalizedAliases);
    test('Primary answers normalized', aliases.includes('jay-z'), 'Jay-Z not in aliases');
    test('Aliases normalized', aliases.includes('hov'), 'Hov alias not found');
    test('All features included', 
        aliases.includes('rick ross') && aliases.includes('nicki minaj') && aliases.includes('bon iver'),
        'Missing some features');
    
    // ========================================
    // NUMERIC TESTS
    // ========================================
    console.log('\n━━━ NUMERIC ━━━');
    q = qs.getQuestionById('test-numeric-1');
    client = qs.formatQuestionForClient(q);
    reveal = qs.formatQuestionForReveal(q);
    
    test('Question exists', !!q, 'test-numeric-1 not found');
    test('Has correctAnswer', q?.correctAnswer !== undefined, 'No correctAnswer');
    test('Has min', q?.min !== undefined, 'No min');
    test('Has max', q?.max !== undefined, 'No max');
    test('Client has min', client.min !== undefined, 'No min in client');
    test('Client has max', client.max !== undefined, 'No max in client');
    test('Client has no correctAnswer', client.correctAnswer === undefined, 'correctAnswer leaked to client');
    test('Reveal has correctAnswer', reveal.correctAnswer !== undefined, 'No correctAnswer in reveal');
    test('correctAnswer is number', typeof q.correctAnswer === 'number', 'correctAnswer should be number');
    
    // ========================================
    // ORDERED-LIST TESTS
    // ========================================
    console.log('\n━━━ ORDERED-LIST ━━━');
    q = qs.getQuestionById('test-ordered-1');
    client = qs.formatQuestionForClient(q);
    reveal = qs.formatQuestionForReveal(q);
    
    test('Question exists', !!q, 'test-ordered-1 not found');
    test('Has items', q?.items?.length > 0, 'No items');
    test('Has correctOrder', q?.correctOrder?.length > 0, 'No correctOrder');
    test('Client has items', client.items?.length > 0, 'No items in client');
    test('Client has no correctOrder', !client.correctOrder, 'correctOrder leaked to client');
    test('Reveal has correctOrder', reveal.correctOrder?.length > 0, 'No correctOrder in reveal');
    test('Items have id and text', q.items?.every(i => i.id && i.text), 'Items missing id or text');
    test('correctOrder matches items', 
        q.correctOrder?.every(id => q.items?.some(i => i.id === id)),
        'correctOrder contains invalid item ids');
    
    // ========================================
    // SAMPLE FROM GENERATED QUESTIONS
    // ========================================
    console.log('\n━━━ GENERATED QUESTIONS SAMPLE ━━━');
    
    const allIds = qs.getAllQuestionIds();
    const generatedIds = allIds.filter(id => !id.startsWith('test-'));
    
    // Sample 5 random generated questions
    for (let i = 0; i < 5 && i < generatedIds.length; i++) {
        const idx = Math.floor(Math.random() * generatedIds.length);
        const id = generatedIds[idx];
        const gq = qs.getQuestionById(id);
        const gc = qs.formatQuestionForClient(gq);
        
        const hasContent = gc.content && (gc.content.text || gc.content.audioUrl);
        const hasType = !!gc.type;
        const hasTitle = !!gc.title;
        
        if (hasContent && hasType && hasTitle) {
            console.log(`  ✓ ${gq.type.padEnd(15)} ${id.substring(0, 50)}...`);
            passed++;
        } else {
            console.log(`  ✗ ${gq?.type?.padEnd(15) || 'unknown'} ${id}: missing ${!hasContent ? 'content ' : ''}${!hasType ? 'type ' : ''}${!hasTitle ? 'title' : ''}`);
            failed++;
        }
    }
    
    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log(`║  RESULTS: ${passed} passed, ${failed} failed`.padEnd(59) + '║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    
    if (failed > 0) {
        console.log('\nFailed tests:');
        errors.forEach(e => console.log(`  - ${e}`));
        process.exit(1);
    } else {
        console.log('\n✓ All question types validated successfully!');
        process.exit(0);
    }
});
