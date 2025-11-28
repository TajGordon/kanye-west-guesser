import { getRandomQuestion, evaluateAnswer, formatQuestionForClient } from './questionStore.js'

const roundsByLobbyId = new Map()

const DEFAULT_ROUND_DURATION_MS = 20000

const FALLBACK_QUESTION = {
    id: 'fallback',
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

export function startNewRound(lobbyId, durationMs = DEFAULT_ROUND_DURATION_MS) {
    const question = pickRandomQuestion()
    const startedAt = Date.now()
    const round = {
        lobbyId,
        question,
        startedAt,
        durationMs,
        endsAt: startedAt + durationMs,
        isActive: true,
        answers: new Map() // key: playerId, value: { answerText, isCorrect, submittedAt }
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

export function buildRoundPayload(round) {
    if (!round) return null
    const formattedQuestion = formatQuestionForClient(round.question)
    return {
        lobbyId: round.lobbyId,
        question: formattedQuestion,
        startedAt: round.startedAt,
        durationMs: round.durationMs,
        endsAt: round.endsAt
    }
}

export function submitAnswerToRound({ lobbyId, playerId, answerText }) {
    const round = roundsByLobbyId.get(lobbyId)
    if (!round) {
        return { status: 'no-round' }
    }

    if (!round.isActive) {
        return { status: 'round-complete', round }
    }

    const previousEntry = round.answers.get(playerId)
    if (previousEntry?.isCorrect) {
        return { status: 'already-correct', round }
    }

    const { isCorrect, matchedAnswer } = evaluateAnswer(round.question, answerText)

    const entry = {
        playerId,
        answerText,
        isCorrect,
        submittedAt: Date.now(),
        matchedAnswerDisplay: matchedAnswer?.display || null
    }

    round.answers.set(playerId, entry)

    return { status: isCorrect ? 'correct' : 'incorrect', round, entry }
}

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

function buildRoundSummary(round) {
    const answers = Array.from(round.answers.values())
    const correctResponders = answers
        .filter(a => a.isCorrect)
        .sort((a, b) => a.submittedAt - b.submittedAt)
        .map(({ playerId, answerText, submittedAt }) => ({
            playerId,
            answerText,
            submittedAt
        }))

    const correctAnswer = round.question?.primaryAnswer || round.question?.answers?.[0]?.display || 'Unknown'

    return {
        lobbyId: round.lobbyId,
        question: {
            id: round.question.id,
            title: round.question.title,
            content: round.question.content
        },
        correctAnswer,
        answers: round.question.answers?.map(({ display }) => display) || [],
        correctResponders,
        startedAt: round.startedAt,
        endedAt: round.endedAt
    }
}
