const roundsByLobbyId = new Map();

const DEFAULT_ROUND_DURATION_MS = 20000;

const sampleQuestions = [
    {
        id: 'q1',
        type: 'guessArtist',
        prompt: 'Who is the artist of the song "Stronger"?',
        answer: 'Kanye West'
    },
    {
        id: 'q2',
        type: 'guessSongFromLine',
        prompt: 'Which Kanye song contains the line "Work it harder, make it better"?',
        answer: 'Stronger'
    },
    {
        id: 'q3',
        type: 'finishLyric',
        prompt: 'Finish the lyric: "I miss the old ____"',
        answer: 'Kanye'
    }
];

function pickRandomQuestion() {
    if (!sampleQuestions.length) {
        return {
            id: 'fallback',
            type: 'guessArtist',
            prompt: 'Who is Kanye West?',
            answer: 'Kanye West'
        };
    }
    const idx = Math.floor(Math.random() * sampleQuestions.length);
    return sampleQuestions[idx];
}

function normalizeText(value = '') {
    return value.trim().toLowerCase();
}

export function startNewRound(lobbyId, durationMs = DEFAULT_ROUND_DURATION_MS) {
    const question = pickRandomQuestion();
    const startedAt = Date.now();
    const round = {
        lobbyId,
        question,
        startedAt,
        durationMs,
        endsAt: startedAt + durationMs,
        isActive: true,
        answers: new Map() // key: playerId, value: { answerText, isCorrect, submittedAt }
    };
    roundsByLobbyId.set(lobbyId, round);
    return round;
}

export function getActiveRound(lobbyId) {
    const round = roundsByLobbyId.get(lobbyId);
    if (!round || !round.isActive) {
        return null;
    }
    return round;
}

export function buildRoundPayload(round) {
    if (!round) return null;
    return {
        lobbyId: round.lobbyId,
        question: {
            id: round.question.id,
            type: round.question.type,
            prompt: round.question.prompt
        },
        startedAt: round.startedAt,
        durationMs: round.durationMs,
        endsAt: round.endsAt
    };
}

export function submitAnswerToRound({ lobbyId, playerId, answerText }) {
    const round = roundsByLobbyId.get(lobbyId);
    if (!round) {
        return { status: 'no-round' };
    }

    if (!round.isActive) {
        return { status: 'round-complete', round };
    }

    const previousEntry = round.answers.get(playerId);
    if (previousEntry?.isCorrect) {
        return { status: 'already-correct', round };
    }

    const normalizedAnswer = normalizeText(answerText);
    const normalizedCorrect = normalizeText(round.question.answer);
    const isCorrect = normalizedAnswer === normalizedCorrect;

    const entry = {
        playerId,
        answerText,
        isCorrect,
        submittedAt: Date.now()
    };

    round.answers.set(playerId, entry);

    return { status: isCorrect ? 'correct' : 'incorrect', round, entry };
}

export function finalizeRound(lobbyId, reason = 'manual') {
    const round = roundsByLobbyId.get(lobbyId);
    if (!round || !round.isActive) return null;

    round.isActive = false;
    round.endedAt = Date.now();

    return {
        round,
        reason,
        summary: buildRoundSummary(round)
    };
}

export function clearRoundState(lobbyId) {
    roundsByLobbyId.delete(lobbyId);
}

function buildRoundSummary(round) {
    const answers = Array.from(round.answers.values());
    const correctResponders = answers
        .filter(a => a.isCorrect)
        .sort((a, b) => a.submittedAt - b.submittedAt)
        .map(({ playerId, answerText, submittedAt }) => ({
            playerId,
            answerText,
            submittedAt
        }));

    return {
        lobbyId: round.lobbyId,
        question: {
            id: round.question.id,
            prompt: round.question.prompt,
            type: round.question.type
        },
        correctAnswer: round.question.answer,
        correctResponders,
        startedAt: round.startedAt,
        endedAt: round.endedAt
    };
}
