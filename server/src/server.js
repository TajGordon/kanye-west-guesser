import express from 'express'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import fs from 'fs'

import {
    joinLobby,
    getLobbyPlayer,
    getLobby,
    isLobbyHost,
    removePlayerFromLobby,
    markLobbyActive,
    setLobbyPhase,
    listLobbies,
    destroyLobby,
    getLobbyPhases,
    resetLobbyRoundGuesses,
    getLobbySettings,
    updateLobbySettings,
    resetLobbyGameState
} from './lobbyManager.js'
import { connectPlayer, disconnectSocket, getPlayerBySocket, listPlayers } from "./playerManager.js"
import { 
    startNewRound, 
    getActiveRound, 
    submitAnswerToRound, 
    buildRoundPayload, 
    finalizeRound, 
    clearRoundState,
    shouldRoundEnd 
} from './gameManager.js'
import { initializeQuestionStore } from './questionStore.js'
import { QUESTION_TYPES, typeRevealsOnSubmit } from './questionTypes.js'

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: { origin: '*' } // for local dev
});

try {
    initializeQuestionStore()
} catch (error) {
    console.error('Failed to load questions data. Exiting...', error)
    process.exit(1)
}

const PORT = 3000;
const roundTimers = new Map();
const summaryTimers = new Map();
const LOBBY_DESTROY_GRACE_MS = 60_000;
const LOBBY_CLEANUP_INTERVAL_MS = 30_000;
const MAX_GUESS_PREVIEW_LENGTH = 40;
const MAX_CORRECT_POINTS = 10;
const MIN_CORRECT_POINTS = 1;
const SUMMARY_DURATION_MS = 4_000;

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.join(__dirname, '../../client/dist');
const mediaAssetsPath = path.join(__dirname, '../public/media');

if (fs.existsSync(mediaAssetsPath)) {
    app.use('/media', express.static(mediaAssetsPath));
}

if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get(/.*/, (req, res, next) => {
        if (req.path.startsWith('/socket.io')) {
            return next();
        }
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('client build not found yet');
    });
}

function sanitizeGuessPreview(value = '') {
    const text = (value ?? '').toString().trim();
    if (!text) return '';
    if (text.length <= MAX_GUESS_PREVIEW_LENGTH) return text;
    return `${text.slice(0, MAX_GUESS_PREVIEW_LENGTH - 3)}...`;
}

function broadcastLobbySettings(lobbyId) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return;
    const settings = getLobbySettings(lobbyId);
    io.to(lobbyId).emit('lobbySettingsUpdate', { lobbyId, settings });
}

function announceLobbyWin(lobbyId, winPayload) {
    io.to(lobbyId).emit('lobbyWin', winPayload);
}

function ensureLobbyRuntimeDefaults(lobby) {
    if (!lobby) return;
    if (typeof lobby.isAutoPlayActive !== 'boolean') {
        lobby.isAutoPlayActive = false;
    }
}

function broadcastLobbyRoster(lobbyId) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return;
    ensureLobbyRuntimeDefaults(lobby);
    markLobbyActive(lobbyId);

    const payload = {
        lobbyId,
        hostPlayerId: lobby.hostPlayerId,
        players: lobby.players.map(({ playerId, name, score, roundGuessStatus, lastGuessText, correctElapsedMs }) => ({
            playerId,
            name,
            score,
            roundGuessStatus,
            lastGuessText,
            correctElapsedMs
        }))
    };

    io.to(lobbyId).emit('lobbyRosterUpdate', payload);
}

function emitLobbyPhase(lobbyId) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return;
    ensureLobbyRuntimeDefaults(lobby);
    markLobbyActive(lobbyId);
    const payload = {
        lobbyId,
        phase: lobby.phase,
        phaseData: lobby.phaseData,
        lastRoundSummary: lobby.lastRoundSummary
    };
    io.to(lobbyId).emit('lobbyPhaseUpdate', payload);
}

function didAllPlayersAnswerCorrect(lobbyId) {
    const lobby = getLobby(lobbyId);
    const round = getActiveRound(lobbyId);
    if (!lobby || !round) return false;
    if (!lobby.players.length) return false;

    // Use the new shouldRoundEnd logic which handles all question types
    const playerIds = lobby.players.map(p => p.playerId);
    const endCheck = shouldRoundEnd(round, playerIds);
    return endCheck.shouldEnd;
}

/**
 * Get the reason why round should end (for logging/events)
 */
function getRoundEndReason(lobbyId) {
    const lobby = getLobby(lobbyId);
    const round = getActiveRound(lobbyId);
    if (!lobby || !round) return null;
    
    const playerIds = lobby.players.map(p => p.playerId);
    const endCheck = shouldRoundEnd(round, playerIds);
    return endCheck.reason || null;
}

function scheduleRoundTimer(lobbyId, round) {
    clearRoundTimer(lobbyId);
    const delay = Math.max(round.endsAt - Date.now(), 0);
    const timer = setTimeout(() => {
        roundTimers.delete(lobbyId);
        finalizeRoundAndBroadcast(lobbyId, 'timer');
    }, delay);
    roundTimers.set(lobbyId, timer);
}

function clearRoundTimer(lobbyId) {
    const timer = roundTimers.get(lobbyId);
    if (timer) {
        clearTimeout(timer);
        roundTimers.delete(lobbyId);
    }
}

function clearSummaryTimer(lobbyId) {
    const timer = summaryTimers.get(lobbyId);
    if (timer) {
        clearTimeout(timer);
        summaryTimers.delete(lobbyId);
    }
}

function getRevealDurationMs(lobbyId) {
    const lobby = getLobby(lobbyId);
    if (lobby?.settings?.revealDurationMs && Number.isFinite(lobby.settings.revealDurationMs)) {
        return lobby.settings.revealDurationMs;
    }
    return SUMMARY_DURATION_MS;
}

function scheduleSummaryAdvance(lobbyId) {
    const lobby = getLobby(lobbyId);
    ensureLobbyRuntimeDefaults(lobby);
    if (!lobby?.isAutoPlayActive) return;
    if (lobby.phase !== getLobbyPhases().SUMMARY) return;

    const duration = getRevealDurationMs(lobbyId);
    clearSummaryTimer(lobbyId);
    const timer = setTimeout(() => {
        summaryTimers.delete(lobbyId);
        const latestLobby = getLobby(lobbyId);
        ensureLobbyRuntimeDefaults(latestLobby);
        if (!latestLobby?.isAutoPlayActive) return;
        if (latestLobby.phase !== getLobbyPhases().SUMMARY) return;
        beginRoundForLobby(lobbyId, 'auto');
    }, duration);
    summaryTimers.set(lobbyId, timer);
}

function finalizeRoundAndBroadcast(lobbyId, reason = 'manual') {
    clearRoundTimer(lobbyId);
    const result = finalizeRound(lobbyId, reason);
    if (!result) return null;

    const { summary } = result;
    const payload = buildRoundEndPayload(summary, reason);
    const lobby = getLobby(lobbyId);
    ensureLobbyRuntimeDefaults(lobby);
    const revealDurationMs = getRevealDurationMs(lobbyId);
    const revealEndsAt = Date.now() + revealDurationMs;
    const autoAdvanceEnabled = Boolean(lobby?.isAutoPlayActive);
    payload.revealDurationMs = revealDurationMs;
    if (autoAdvanceEnabled) {
        payload.revealEndsAt = revealEndsAt;
    } else {
        payload.revealEndsAt = null;
    }
    const phaseData = autoAdvanceEnabled ? { summary: payload, revealEndsAt } : { summary: payload };
    setLobbyPhase(lobbyId, getLobbyPhases().SUMMARY, phaseData);
    io.to(lobbyId).emit('roundEnded', payload);
    broadcastLobbyRoster(lobbyId);
    emitLobbyPhase(lobbyId);
    scheduleSummaryAdvance(lobbyId);
    return payload;
}

function buildRoundEndPayload(summary, reason) {
    const lobby = getLobby(summary.lobbyId);
    const nameLookup = new Map();
    if (lobby) {
        lobby.players.forEach(player => {
            nameLookup.set(player.playerId, player.name);
        });
    }

    return {
        lobbyId: summary.lobbyId,
        question: summary.question,
        correctAnswer: summary.correctAnswer,
        correctResponders: summary.correctResponders.map(entry => ({
            ...entry,
            name: nameLookup.get(entry.playerId) || 'Unknown'
        })),
        reason,
        startedAt: summary.startedAt,
        endedAt: summary.endedAt
    };
}

function buildWinPayload(lobby, winnerPlayer, targetScore) {
    return {
        lobbyId: lobby.id,
        targetScore,
        achievedAt: Date.now(),
        winner: {
            playerId: winnerPlayer.playerId,
            name: winnerPlayer.name,
            score: winnerPlayer.score
        }
    };
}

function handleLobbyWin(lobby, winnerPlayer) {
    if (!lobby || !winnerPlayer) return false;
    const targetScore = (lobby.settings?.pointsToWin) || getLobbySettings(lobby.id).pointsToWin;
    clearRoundTimer(lobby.id);
    clearRoundState(lobby.id);
    clearSummaryTimer(lobby.id);
    lobby.isAutoPlayActive = false;

    const winPayload = buildWinPayload(lobby, winnerPlayer, targetScore);
    setLobbyPhase(lobby.id, getLobbyPhases().WIN, { win: winPayload });
    announceLobbyWin(lobby.id, winPayload);
    broadcastLobbyRoster(lobby.id);
    emitLobbyPhase(lobby.id);
    return true;
}

function maybeHandleWin(lobbyId, lobbyPlayer) {
    const lobby = getLobby(lobbyId);
    if (!lobby || !lobbyPlayer) return false;
    if (lobby.phase === getLobbyPhases().WIN) {
        return true;
    }
    const targetScore = lobby.settings?.pointsToWin || getLobbySettings(lobbyId).pointsToWin;
    if ((lobbyPlayer.score || 0) < targetScore) {
        return false;
    }
    return handleLobbyWin(lobby, lobbyPlayer);
}

function beginRoundForLobby(lobbyId, reason = 'manual') {
    const lobby = getLobby(lobbyId);
    ensureLobbyRuntimeDefaults(lobby);
    if (!lobby) return null;
    if (lobby.phase === getLobbyPhases().WIN) return null;

    const activeRound = getActiveRound(lobbyId);
    if (activeRound) {
        return activeRound;
    }

    const settings = lobby?.settings || getLobbySettings(lobbyId);
    const roundDurationMs = settings?.roundDurationMs;
    const round = startNewRound(lobbyId, roundDurationMs);
    resetLobbyRoundGuesses(lobbyId);
    const payload = buildRoundPayload(round);
    if (payload) {
        setLobbyPhase(lobbyId, getLobbyPhases().ROUND, { round: payload, reason });
        io.to(lobbyId).emit('roundStarted', payload);
    }
    broadcastLobbyRoster(lobbyId);
    scheduleRoundTimer(lobbyId, round);
    clearSummaryTimer(lobbyId);
    emitLobbyPhase(lobbyId);
    return round;
}

io.on('connection', (socket) => {
    console.log('Client connected: ', socket.id);

    socket.on('joinLobby', (payload) => {
        console.log('joinLobby', payload);
        const { name, lobbyId, playerId } = payload;
        const player = connectPlayer(socket, { name, lobbyId, playerId });

        const { lobby, lobbyPlayer, isHost } = joinLobby(socket, { name, lobbyId, playerId });
        markLobbyActive(lobbyId);

        // success, idk if it can fail but to justify the name
        const res = true;

        socket.emit('joinLobbyResult', {
            res, 
            lobby: lobby, 
            score: lobbyPlayer.score,
            isHost,
            phase: lobby.phase,
            phaseData: lobby.phaseData,
            lastRoundSummary: lobby.lastRoundSummary,
            settings: getLobbySettings(lobbyId)
        });

        console.log('Lobby after join:', lobby);
        console.log('All players:', listPlayers());

        const existingRound = getActiveRound(lobbyId);
        if (existingRound) {
            const payload = buildRoundPayload(existingRound);
            if (payload) {
                socket.emit('roundStarted', payload);
            }
        }

        broadcastLobbyRoster(lobbyId);
        emitLobbyPhase(lobbyId);
    });

    socket.on('submitAnswer', (payload) => {
        const player = getPlayerBySocket(socket);
        if (!player) return;

        console.log('submitAnswer', payload, 'by', (getPlayerBySocket(socket)).name);

        const lobbyPlayer = getLobbyPlayer(player.lobbyId, player.playerId);
        if (!lobbyPlayer) {
            console.log('no lobby player found for', player.playerId);
            return;
        }

        // Support both free-text (answer) and choice-based (choiceId) submissions
        const submission = submitAnswerToRound({
            lobbyId: player.lobbyId,
            playerId: player.playerId,
            answerText: payload.answer,
            choiceId: payload.choiceId
        });

        if (!submission) {
            socket.emit('answerResult', { result: false, score: lobbyPlayer.score, status: 'error' });
            return;
        }

        const { status, entry, round, revealResult, _isCorrect } = submission;
        let shouldBroadcastRoster = false;

        // Determine if this was actually correct (unified for both question types)
        const isCorrect = status === 'correct' || _isCorrect === true;

        // Handle incorrect guess display (free-text only shows last guess)
        if (status === 'incorrect' && entry) {
            lobbyPlayer.roundGuessStatus = 'incorrect';
            lobbyPlayer.lastGuessText = sanitizeGuessPreview(entry.answerText);
            lobbyPlayer.correctElapsedMs = null;
            shouldBroadcastRoster = true;
        }
        
        // Handle choice-based submission (don't reveal correct/incorrect yet)
        if (status === 'submitted' && entry) {
            lobbyPlayer.roundGuessStatus = 'submitted';
            lobbyPlayer.lastGuessText = null; // Don't show choice text to others
            lobbyPlayer.correctElapsedMs = null;
            shouldBroadcastRoster = true;
        }

        let winTriggered = false;

        // Handle correct answer (both revealed and deferred)
        if (isCorrect) {
            // For free-text (revealResult=true), update status immediately
            if (revealResult) {
                lobbyPlayer.roundGuessStatus = 'correct';
                lobbyPlayer.lastGuessText = null;
                const elapsedMs = entry && round ? Math.max(0, entry.submittedAt - round.startedAt) : null;
                lobbyPlayer.correctElapsedMs = elapsedMs;
            }
            // For choice-based, keep status as 'submitted' until round ends

            const correctCount = Array.from(round.submissions.values()).filter((answer) => answer.isCorrect).length;
            const pointsAwarded = Math.max(
                MIN_CORRECT_POINTS,
                MAX_CORRECT_POINTS - (correctCount - 1)
            );

            lobbyPlayer.score = (lobbyPlayer.score || 0) + pointsAwarded;
            const lobby = getLobby(player.lobbyId);
            lobby?.scoreByPlayerId?.set(lobbyPlayer.playerId, lobbyPlayer.score);
            shouldBroadcastRoster = true;

            winTriggered = maybeHandleWin(player.lobbyId, lobbyPlayer);
        }

        if (shouldBroadcastRoster) {
            broadcastLobbyRoster(player.lobbyId);
        }

        // Build response based on whether result should be revealed
        const answerResultPayload = {
            score: lobbyPlayer.score,
            status,
            submitted: entry?.hasSubmitted || false
        };
        
        // Only include correctness info if result should be revealed
        if (revealResult) {
            answerResultPayload.result = isCorrect;
        }

        socket.emit('answerResult', answerResultPayload);

        // Check if round should end (works for all question types now)
        if (!winTriggered && didAllPlayersAnswerCorrect(player.lobbyId)) {
            const endReason = getRoundEndReason(player.lobbyId) || 'all-correct';
            finalizeRoundAndBroadcast(player.lobbyId, endReason);
        }
    });

    socket.on('startRoundRequest', () => {
        const player = getPlayerBySocket(socket);
        if (!player) return;

        const lobbyId = player.lobbyId;
        if (!lobbyId) {
            socket.emit('roundStartDenied', { reason: 'no-lobby' });
            return;
        }

        if (!isLobbyHost(lobbyId, player.playerId)) {
            socket.emit('roundStartDenied', { reason: 'not-host' });
            return;
        }

        const lobby = getLobby(lobbyId);
        ensureLobbyRuntimeDefaults(lobby);
        if (lobby?.isAutoPlayActive) {
            socket.emit('roundStartDenied', { reason: 'auto-active' });
            return;
        }

        const activeRound = getActiveRound(lobbyId);
        if (activeRound) {
            socket.emit('roundStartDenied', { reason: 'round-active' });
            return;
        }

        if (lobby?.phase === getLobbyPhases().WIN) {
            socket.emit('roundStartDenied', { reason: 'game-complete' });
            return;
        }

        beginRoundForLobby(lobbyId, 'manual');
    });

    socket.on('startGameRequest', () => {
        const player = getPlayerBySocket(socket);
        if (!player) return;

        const lobbyId = player.lobbyId;
        if (!lobbyId) {
            socket.emit('roundStartDenied', { reason: 'no-lobby' });
            return;
        }

        if (!isLobbyHost(lobbyId, player.playerId)) {
            socket.emit('roundStartDenied', { reason: 'not-host' });
            return;
        }

        const lobby = getLobby(lobbyId);
        ensureLobbyRuntimeDefaults(lobby);
        if (!lobby) return;
        if (lobby.phase !== getLobbyPhases().SEATING) {
            socket.emit('roundStartDenied', { reason: 'not-seating' });
            return;
        }

        lobby.isAutoPlayActive = true;
        beginRoundForLobby(lobbyId, 'auto');
    });

    socket.on('updateLobbySettings', (payload = {}) => {
        const player = getPlayerBySocket(socket);
        if (!player) return;
        const lobbyId = player.lobbyId;
        if (!lobbyId) return;
        if (!isLobbyHost(lobbyId, player.playerId)) return;

        const updated = updateLobbySettings(lobbyId, payload);
        if (!updated) return;
        broadcastLobbySettings(lobbyId);
    });

    socket.on('resetGameRequest', () => {
        const player = getPlayerBySocket(socket);
        if (!player) return;
        const lobbyId = player.lobbyId;
        if (!lobbyId) return;
        if (!isLobbyHost(lobbyId, player.playerId)) return;

        clearRoundTimer(lobbyId);
        clearSummaryTimer(lobbyId);
        clearRoundState(lobbyId);
        const lobby = resetLobbyGameState(lobbyId);
        if (!lobby) return;
        broadcastLobbyRoster(lobbyId);
        emitLobbyPhase(lobbyId);
        broadcastLobbySettings(lobbyId);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        const result = disconnectSocket(socket);
        if (result?.fullyDisconnected) {
            const { lobbyId, playerId } = result.player;
            if (lobbyId && playerId) {
                removePlayerFromLobby(lobbyId, playerId);
                broadcastLobbyRoster(lobbyId);
                emitLobbyPhase(lobbyId);
            }
        }
    });
});

function cleanupStaleLobbies() {
    const now = Date.now();
    listLobbies().forEach((lobby) => {
        if (!lobby.pendingDestroyAt) return;
        if (now - lobby.pendingDestroyAt < LOBBY_DESTROY_GRACE_MS) return;
        console.log(`Destroying inactive lobby ${lobby.id}`);
        clearRoundTimer(lobby.id);
        clearSummaryTimer(lobby.id);
        clearRoundState(lobby.id);
        destroyLobby(lobby.id);
    });
}

setInterval(cleanupStaleLobbies, LOBBY_CLEANUP_INTERVAL_MS);

server.listen(PORT, () => {
    console.log(`server listening on http://localhost:${PORT}`);
});