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
 * @returns {object} Submission result
 */
export function submitAnswerToRound({ lobbyId, playerId, answerText, choiceId }) {
    const round = roundsByLobbyId.get(lobbyId)
    if (!round) {
        return { status: 'no-round' }
    }

    if (!round.isActive) {
        return { status: 'round-ended', round }
    }

    const questionType = round.questionType || QUESTION_TYPES.FREE_TEXT
    const previousEntry = round.submissions.get(playerId)
    
    // Check if player can submit
    const canSubmit = canPlayerSubmit(round, playerId, previousEntry)
    if (!canSubmit.allowed) {
        return { status: canSubmit.reason, round }
    }

    // Route to appropriate submission handler
    if (questionType === QUESTION_TYPES.FREE_TEXT) {
        return submitFreeTextAnswer(round, playerId, answerText, previousEntry)
    } else {
        return submitChoiceAnswer(round, playerId, choiceId)
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
            submittedAt: entry.submittedAt,
            matchedAnswerDisplay: entry.matchedAnswerDisplay || entry.matchedChoice?.text || null,
            elapsedMs: typeof round.startedAt === 'number' ? entry.submittedAt - round.startedAt : null
        }))

    const correctAnswer = round.question?.primaryAnswer || 'Unknown'
    
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
