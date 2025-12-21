/**
 * Game Manager
 * 
 * Handles round lifecycle and answer submission for all question types.
 * This is the core game logic module.
 */

import { 
    getRandomQuestion, 
    evaluateAnswer, 
    evaluateChoiceAnswer,
    formatQuestionForClient,
    formatQuestionForReveal 
} from './questionStore.js'
import {
    QUESTION_TYPES,
    getQuestionTypeConfig,
    typeAllowsRetry,
    typeRevealsOnSubmit,
    typeEndsOnAllSubmitted,
    typeEndsOnAllCorrect
} from './questionTypes.js'
import {
    validateSubmission,
    canPlayerSubmit
} from './validation.js'

const roundsByLobbyId = new Map()

const DEFAULT_ROUND_DURATION_MS = 20000

const FALLBACK_QUESTION = {
    id: 'fallback',
    type: QUESTION_TYPES.FREE_TEXT,
    title: 'Who is the artist of the song "Stronger"?',
    content: { type: 'text', text: 'Stronger' },
    answers: [
        {
            id: 'fallback-answer',
            display: 'Kanye West',
            aliases: ['kanye west'],
            normalizedAliases: ['kanye west']
        }
    ],
    acceptedAliasMap: new Map([['kanye west', { display: 'Kanye West' }]]),
    primaryAnswer: 'Kanye West',
    tags: ['fallback']
}

function pickRandomQuestion() {
    return getRandomQuestion() || FALLBACK_QUESTION
}

// ============================================================================
// Round Lifecycle
// ============================================================================

export function startNewRound(lobbyId, durationMs = DEFAULT_ROUND_DURATION_MS) {
    const question = pickRandomQuestion()
    const startedAt = Date.now()
    const questionType = question.type || QUESTION_TYPES.FREE_TEXT
    
    const round = {
        lobbyId,
        question,
        questionType,
        startedAt,
        durationMs,
        endsAt: startedAt + durationMs,
        isActive: true,
        // Unified answer tracking:
        // key: playerId
        // value: { 
        //   playerId, answerText|choiceId, isCorrect, hasSubmitted, 
        //   submittedAt, matchedAnswerDisplay|matchedChoice 
        // }
        submissions: new Map(),
        // Legacy compatibility alias
        get answers() { return this.submissions }
    }
    
    roundsByLobbyId.set(lobbyId, round)
    return round
}

export function getActiveRound(lobbyId) {
    const round = roundsByLobbyId.get(lobbyId)
    if (!round || !round.isActive) {
        return null
    }
    return round
}

export function getRound(lobbyId) {
    return roundsByLobbyId.get(lobbyId) || null
}

export function buildRoundPayload(round) {
    if (!round) return null
    const formattedQuestion = formatQuestionForClient(round.question)
    return {
        lobbyId: round.lobbyId,
        question: formattedQuestion,
        questionType: round.questionType,
        startedAt: round.startedAt,
        durationMs: round.durationMs,
        endsAt: round.endsAt
    }
}

// ============================================================================
// Answer Submission (Unified for all question types)
// ============================================================================

/**
 * Submit an answer to the current round
 * Works for all question types - routes to appropriate handler
 * 
 * @param {object} params
 * @param {string} params.lobbyId
 * @param {string} params.playerId
 * @param {string} [params.answerText] - For free-text questions
 * @param {string} [params.choiceId] - For choice-based questions
 * @param {string} [params.guess] - For multi-entry questions (single guess)
 * @param {number} [params.numericValue] - For numeric/slider questions
 * @param {string[]} [params.orderedIds] - For ordered-list questions
 * @returns {object} Submission result
 */
export function submitAnswerToRound({ lobbyId, playerId, answerText, choiceId, guess, numericValue, orderedIds }) {
    const round = roundsByLobbyId.get(lobbyId)
    if (!round) {
        return { status: 'no-round' }
    }

    if (!round.isActive) {
        return { status: 'round-ended', round }
    }

    const questionType = round.questionType || QUESTION_TYPES.FREE_TEXT
    const previousEntry = round.submissions.get(playerId)
    
    // Check if player can submit (for most types)
    // Multi-entry has special handling
    if (questionType !== QUESTION_TYPES.MULTI_ENTRY) {
        const canSubmit = canPlayerSubmit(round, playerId, previousEntry)
        if (!canSubmit.allowed) {
            return { status: canSubmit.reason, round }
        }
    }

    // Route to appropriate submission handler
    switch (questionType) {
        case QUESTION_TYPES.FREE_TEXT:
            return submitFreeTextAnswer(round, playerId, answerText, previousEntry)
        
        case QUESTION_TYPES.MULTIPLE_CHOICE:
        case QUESTION_TYPES.TRUE_FALSE:
            return submitChoiceAnswer(round, playerId, choiceId)
        
        case QUESTION_TYPES.MULTI_ENTRY:
            return submitMultiEntryGuess(round, playerId, guess, previousEntry)
        
        case QUESTION_TYPES.NUMERIC:
            return submitNumericAnswer(round, playerId, numericValue)
        
        case QUESTION_TYPES.ORDERED_LIST:
            return submitOrderedListAnswer(round, playerId, orderedIds)
        
        default:
            return submitFreeTextAnswer(round, playerId, answerText, previousEntry)
    }
}

/**
 * Handle free-text answer submission (allows retry)
 */
function submitFreeTextAnswer(round, playerId, answerText, previousEntry) {
    if (!answerText || typeof answerText !== 'string') {
        return { status: 'invalid-input', round }
    }

    const trimmed = answerText.trim()
    if (!trimmed) {
        return { status: 'empty-answer', round }
    }

    // Evaluate against accepted answers
    const { isCorrect, matchedAnswer } = evaluateAnswer(round.question, trimmed)

    const entry = {
        playerId,
        answerText: trimmed,
        isCorrect,
        hasSubmitted: true,
        submittedAt: Date.now(),
        matchedAnswerDisplay: matchedAnswer?.display || null,
        // Track attempt count for analytics
        attemptCount: (previousEntry?.attemptCount || 0) + 1
    }

    round.submissions.set(playerId, entry)

    return { 
        status: isCorrect ? 'correct' : 'incorrect', 
        round, 
        entry,
        // For free-text, reveal result immediately
        revealResult: true
    }
}

/**
 * Handle choice-based answer submission (single attempt)
 */
function submitChoiceAnswer(round, playerId, choiceId) {
    if (!choiceId || typeof choiceId !== 'string') {
        return { status: 'invalid-input', round }
    }

    const trimmed = choiceId.trim()
    if (!trimmed) {
        return { status: 'empty-choice', round }
    }

    // Validate choice exists
    const validChoices = getValidChoiceIdsForQuestion(round.question)
    if (!validChoices.includes(trimmed)) {
        return { status: 'invalid-choice', round }
    }

    // Evaluate the choice
    const { isCorrect, matchedChoice } = evaluateChoiceAnswer(round.question, trimmed)

    const entry = {
        playerId,
        choiceId: trimmed,
        isCorrect,
        hasSubmitted: true,
        submittedAt: Date.now(),
        matchedChoice: matchedChoice || null,
        attemptCount: 1 // Choice-based always single attempt
    }

    round.submissions.set(playerId, entry)

    // For choice-based, don't reveal result until round ends
    return { 
        status: 'submitted', 
        round, 
        entry,
        revealResult: false,
        // Include isCorrect for server-side scoring, but client shouldn't show it
        _isCorrect: isCorrect
    }
}

/**
 * Handle multi-entry guess submission (Wordle-style, multiple guesses allowed)
 */
function submitMultiEntryGuess(round, playerId, guess, previousEntry) {
    if (!guess || typeof guess !== 'string') {
        return { status: 'invalid-input', round }
    }

    const trimmed = guess.trim().toLowerCase()
    if (!trimmed) {
        return { status: 'empty-guess', round }
    }

    // Get or create multi-entry state for this player
    const entry = previousEntry || {
        playerId,
        foundAnswers: [],
        wrongGuesses: [],
        guessCount: 0,
        hasSubmitted: false,
        isCorrect: false,
        submittedAt: null
    }

    const maxGuesses = round.question.maxGuesses || 15
    const totalAnswers = round.question.answers?.length || 0

    // Check if already at max guesses
    if (entry.guessCount >= maxGuesses) {
        return { status: 'max-guesses-reached', round, entry }
    }

    // Check if this guess matches any remaining answers
    const { isMatch, matchedAnswer } = evaluateMultiEntryGuess(round.question, trimmed, entry.foundAnswers)

    entry.guessCount++
    entry.submittedAt = Date.now()

    if (isMatch && matchedAnswer) {
        entry.foundAnswers.push(matchedAnswer.display || matchedAnswer)
        
        // Check if all answers found
        if (entry.foundAnswers.length >= totalAnswers) {
            entry.isCorrect = true
            entry.hasSubmitted = true
        }
    } else {
        // Check if already guessed (duplicate)
        const normalizedGuess = trimmed
        const alreadyGuessed = entry.wrongGuesses.some(g => g.toLowerCase() === normalizedGuess) ||
                               entry.foundAnswers.some(f => f.toLowerCase() === normalizedGuess)
        
        if (!alreadyGuessed) {
            entry.wrongGuesses.push(guess.trim()) // Keep original casing for display
        }
    }

    // Mark as submitted if out of guesses
    if (entry.guessCount >= maxGuesses) {
        entry.hasSubmitted = true
    }

    round.submissions.set(playerId, entry)

    return {
        status: isMatch ? 'found' : 'not-found',
        round,
        entry,
        revealResult: true,
        foundAnswer: isMatch ? (matchedAnswer?.display || matchedAnswer) : null,
        remainingGuesses: maxGuesses - entry.guessCount,
        foundCount: entry.foundAnswers.length,
        totalAnswers
    }
}

/**
 * Evaluate a single guess against remaining multi-entry answers
 */
function evaluateMultiEntryGuess(question, guess, alreadyFound) {
    if (!question?.answers) return { isMatch: false }

    const normalizedGuess = guess.toLowerCase().trim()
    const foundNormalized = alreadyFound.map(f => f.toLowerCase())

    for (const answer of question.answers) {
        // Skip already found answers
        const answerDisplay = answer.display || answer
        if (foundNormalized.includes(answerDisplay.toLowerCase())) continue

        // Check primary answer
        const primaryNormalized = (answer.display || answer).toLowerCase()
        if (primaryNormalized === normalizedGuess) {
            return { isMatch: true, matchedAnswer: answer }
        }

        // Check aliases
        const aliases = answer.aliases || question.aliases?.[answerDisplay] || []
        for (const alias of aliases) {
            if (alias.toLowerCase() === normalizedGuess) {
                return { isMatch: true, matchedAnswer: answer }
            }
        }
    }

    return { isMatch: false }
}

/**
 * Handle numeric/slider answer submission
 */
function submitNumericAnswer(round, playerId, numericValue) {
    if (numericValue == null || typeof numericValue !== 'number' || isNaN(numericValue)) {
        return { status: 'invalid-input', round }
    }

    const correctAnswer = round.question.correctAnswer
    const isExact = numericValue === correctAnswer
    const difference = Math.abs(numericValue - correctAnswer)

    const entry = {
        playerId,
        numericValue,
        isCorrect: isExact,
        hasSubmitted: true,
        submittedAt: Date.now(),
        difference,
        attemptCount: 1
    }

    round.submissions.set(playerId, entry)

    // Don't reveal result until round ends (for proximity scoring fairness)
    return {
        status: 'submitted',
        round,
        entry,
        revealResult: false,
        _isCorrect: isExact,
        _difference: difference
    }
}

/**
 * Handle ordered-list answer submission
 */
function submitOrderedListAnswer(round, playerId, orderedIds) {
    if (!Array.isArray(orderedIds)) {
        return { status: 'invalid-input', round }
    }

    const correctOrder = round.question.correctOrder || []
    
    // Calculate score (number of items in correct position)
    let correctPositions = 0
    for (let i = 0; i < Math.min(orderedIds.length, correctOrder.length); i++) {
        if (orderedIds[i] === correctOrder[i]) {
            correctPositions++
        }
    }

    const isFullyCorrect = correctPositions === correctOrder.length && 
                           orderedIds.length === correctOrder.length

    const entry = {
        playerId,
        orderedIds,
        isCorrect: isFullyCorrect,
        hasSubmitted: true,
        submittedAt: Date.now(),
        correctPositions,
        totalPositions: correctOrder.length,
        attemptCount: 1
    }

    round.submissions.set(playerId, entry)

    return {
        status: 'submitted',
        round,
        entry,
        revealResult: false,
        _isCorrect: isFullyCorrect,
        _correctPositions: correctPositions
    }
}

/**
 * Get valid choice IDs for a question
 */
function getValidChoiceIdsForQuestion(question) {
    if (!question) return []
    
    const type = question.type || QUESTION_TYPES.FREE_TEXT
    
    if (type === QUESTION_TYPES.TRUE_FALSE) {
        return ['true', 'false']
    }
    
    if (type === QUESTION_TYPES.MULTIPLE_CHOICE && Array.isArray(question.choices)) {
        return question.choices.map(c => c.id).filter(Boolean)
    }
    
    return []
}

// ============================================================================
// Round Finalization
// ============================================================================

export function finalizeRound(lobbyId, reason = 'manual') {
    const round = roundsByLobbyId.get(lobbyId)
    if (!round || !round.isActive) return null

    round.isActive = false
    round.endedAt = Date.now()

    return {
        round,
        reason,
        summary: buildRoundSummary(round)
    }
}

export function clearRoundState(lobbyId) {
    roundsByLobbyId.delete(lobbyId)
}

// ============================================================================
// Round State Queries
// ============================================================================

/**
 * Check if all players have submitted (for choice-based question end condition)
 */
export function haveAllPlayersSubmitted(round, playerIds) {
    if (!round || !playerIds?.length) return false
    
    return playerIds.every(playerId => {
        const entry = round.submissions.get(playerId)
        return entry?.hasSubmitted === true
    })
}

/**
 * Check if all players answered correctly (for free-text question end condition)
 */
export function haveAllPlayersAnsweredCorrectly(round, playerIds) {
    if (!round || !playerIds?.length) return false
    
    return playerIds.every(playerId => {
        const entry = round.submissions.get(playerId)
        return entry?.isCorrect === true
    })
}

/**
 * Determine if round should end based on question type and submissions
 */
export function shouldRoundEnd(round, playerIds) {
    if (!round || !round.isActive) return { shouldEnd: false }
    
    const questionType = round.questionType || QUESTION_TYPES.FREE_TEXT
    
    if (typeEndsOnAllCorrect(questionType)) {
        if (haveAllPlayersAnsweredCorrectly(round, playerIds)) {
            return { shouldEnd: true, reason: 'all-correct' }
        }
    }
    
    if (typeEndsOnAllSubmitted(questionType)) {
        if (haveAllPlayersSubmitted(round, playerIds)) {
            return { shouldEnd: true, reason: 'all-submitted' }
        }
    }
    
    return { shouldEnd: false }
}

// ============================================================================
// Round Summary
// ============================================================================

function buildRoundSummary(round) {
    const submissions = Array.from(round.submissions.values())
    const questionType = round.questionType || QUESTION_TYPES.FREE_TEXT
    
    // Correct responders sorted by submission time
    const correctResponders = submissions
        .filter(s => s.isCorrect)
        .sort((a, b) => a.submittedAt - b.submittedAt)
        .map(entry => ({
            playerId: entry.playerId,
            answerText: entry.answerText || null,
            choiceId: entry.choiceId || null,
            numericValue: entry.numericValue ?? null,
            orderedIds: entry.orderedIds || null,
            foundAnswers: entry.foundAnswers || null,
            submittedAt: entry.submittedAt,
            matchedAnswerDisplay: entry.matchedAnswerDisplay || entry.matchedChoice?.text || null,
            elapsedMs: typeof round.startedAt === 'number' ? entry.submittedAt - round.startedAt : null
        }))

    const correctAnswer = round.question?.primaryAnswer || 
                          round.question?.correctAnswer ||
                          'Unknown'
    
    // Use formatQuestionForReveal to include correct answer info
    const questionReveal = formatQuestionForReveal(round.question)

    const summary = {
        lobbyId: round.lobbyId,
        questionType,
        question: questionReveal,
        correctAnswer,
        correctResponders,
        startedAt: round.startedAt,
        endedAt: round.endedAt,
        totalSubmissions: submissions.length,
        correctCount: correctResponders.length
    }
    
    // Add choice distribution for choice-based questions
    if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE || questionType === QUESTION_TYPES.TRUE_FALSE) {
        summary.choiceDistribution = buildChoiceDistribution(round)
    }
    
    // Add proximity ranking for numeric questions
    if (questionType === QUESTION_TYPES.NUMERIC || questionType === QUESTION_TYPES.SLIDER) {
        summary.proximityRanking = buildProximityRanking(round)
        summary.correctAnswer = round.question.correctAnswer
    }
    
    // Add multi-entry stats
    if (questionType === QUESTION_TYPES.MULTI_ENTRY) {
        summary.multiEntryStats = buildMultiEntryStats(round)
        summary.allAnswers = round.question.answers?.map(a => a.display || a) || []
    }
    
    // Add ordered list results
    if (questionType === QUESTION_TYPES.ORDERED_LIST) {
        summary.orderedListResults = buildOrderedListResults(round)
        summary.correctOrder = round.question.correctOrder
    }
    
    // Legacy compatibility
    if (questionType === QUESTION_TYPES.FREE_TEXT) {
        summary.answers = round.question.answers?.map(a => a.display) || []
    }
    
    return summary
}

/**
 * Build distribution of choices for summary display
 */
function buildChoiceDistribution(round) {
    const distribution = {}
    const submissions = Array.from(round.submissions.values())
    
    // Initialize all choices with 0
    const choices = round.question?.choices || []
    choices.forEach(c => {
        distribution[c.id] = { 
            choiceId: c.id, 
            text: c.text, 
            count: 0,
            correct: c.correct === true || c.id === round.question.correctChoiceId
        }
    })
    
    // Count submissions
    submissions.forEach(entry => {
        if (entry.choiceId && distribution[entry.choiceId]) {
            distribution[entry.choiceId].count++
        }
    })
    
    return Object.values(distribution)
}

/**
 * Build proximity ranking for numeric questions (closest wins)
 */
function buildProximityRanking(round) {
    const submissions = Array.from(round.submissions.values())
        .filter(s => s.numericValue != null)
        .sort((a, b) => a.difference - b.difference)
    
    return submissions.map((entry, index) => ({
        rank: index + 1,
        playerId: entry.playerId,
        value: entry.numericValue,
        difference: entry.difference,
        isExact: entry.difference === 0
    }))
}

/**
 * Build multi-entry stats for summary
 */
function buildMultiEntryStats(round) {
    const submissions = Array.from(round.submissions.values())
    const totalAnswers = round.question.answers?.length || 0
    
    return submissions.map(entry => ({
        playerId: entry.playerId,
        foundCount: entry.foundAnswers?.length || 0,
        totalAnswers,
        wrongGuessCount: entry.wrongGuesses?.length || 0,
        totalGuesses: entry.guessCount || 0,
        foundAnswers: entry.foundAnswers || [],
        completedAll: (entry.foundAnswers?.length || 0) >= totalAnswers
    })).sort((a, b) => b.foundCount - a.foundCount)
}

/**
 * Build ordered list results for summary
 */
function buildOrderedListResults(round) {
    const submissions = Array.from(round.submissions.values())
        .filter(s => s.orderedIds != null)
        .sort((a, b) => b.correctPositions - a.correctPositions)
    
    return submissions.map((entry, index) => ({
        rank: index + 1,
        playerId: entry.playerId,
        orderedIds: entry.orderedIds,
        correctPositions: entry.correctPositions,
        totalPositions: entry.totalPositions,
        isFullyCorrect: entry.isCorrect
    }))
}
