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
import { startNewRound, getActiveRound, submitAnswerToRound, buildRoundPayload, finalizeRound, clearRoundState } from './gameManager.js'

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: { origin: '*' } // for local dev
});

const PORT = 3000;
const roundTimers = new Map();
const LOBBY_DESTROY_GRACE_MS = 60_000;
const LOBBY_CLEANUP_INTERVAL_MS = 30_000;
const MAX_GUESS_PREVIEW_LENGTH = 40;
const MAX_CORRECT_POINTS = 10;
const MIN_CORRECT_POINTS = 1;

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.join(__dirname, '../../client/dist');

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

function broadcastLobbyRoster(lobbyId) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return;
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

    return lobby.players.every(player => {
        const entry = round.answers.get(player.playerId);
        return entry?.isCorrect;
    });
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

function finalizeRoundAndBroadcast(lobbyId, reason = 'manual') {
    clearRoundTimer(lobbyId);
    const result = finalizeRound(lobbyId, reason);
    if (!result) return null;

    const { summary } = result;
    const payload = buildRoundEndPayload(summary, reason);
    setLobbyPhase(lobbyId, getLobbyPhases().SUMMARY, { summary: payload });
    io.to(lobbyId).emit('roundEnded', payload);
    broadcastLobbyRoster(lobbyId);
    emitLobbyPhase(lobbyId);
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

        const submission = submitAnswerToRound({
            lobbyId: player.lobbyId,
            playerId: player.playerId,
            answerText: payload.answer
        });

        if (!submission) {
            socket.emit('answerResult', { result: false, score: lobbyPlayer.score, status: 'error' });
            return;
        }

        const { status, entry, round } = submission;
        let shouldBroadcastRoster = false;

        if (status === 'incorrect' && entry) {
            lobbyPlayer.roundGuessStatus = 'incorrect';
            lobbyPlayer.lastGuessText = sanitizeGuessPreview(entry.answerText);
            lobbyPlayer.correctElapsedMs = null;
            shouldBroadcastRoster = true;
        }

        let winTriggered = false;

        if (status === 'correct') {
            lobbyPlayer.roundGuessStatus = 'correct';
            lobbyPlayer.lastGuessText = null;
            const elapsedMs = entry && round ? Math.max(0, entry.submittedAt - round.startedAt) : null;
            lobbyPlayer.correctElapsedMs = elapsedMs;

            const correctCount = Array.from(round.answers.values()).filter((answer) => answer.isCorrect).length;
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

        socket.emit('answerResult', {
            result: status === 'correct',
            score: lobbyPlayer.score,
            status
        });

        if (status === 'correct' && !winTriggered && didAllPlayersAnswerCorrect(player.lobbyId)) {
            finalizeRoundAndBroadcast(player.lobbyId, 'all-correct');
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

        const activeRound = getActiveRound(lobbyId);
        if (activeRound) {
            socket.emit('roundStartDenied', { reason: 'round-active' });
            return;
        }

        const lobby = getLobby(lobbyId);
        if (lobby?.phase === getLobbyPhases().WIN) {
            socket.emit('roundStartDenied', { reason: 'game-complete' });
            return;
        }
        const settings = lobby?.settings || getLobbySettings(lobbyId);
        const roundDurationMs = settings?.roundDurationMs;
        const round = startNewRound(lobbyId, roundDurationMs);
        resetLobbyRoundGuesses(lobbyId);
        const payload = buildRoundPayload(round);
        if (payload) {
            setLobbyPhase(lobbyId, getLobbyPhases().ROUND, { round: payload });
            io.to(lobbyId).emit('roundStarted', payload);
        }
        broadcastLobbyRoster(lobbyId);
        scheduleRoundTimer(lobbyId, round);
        emitLobbyPhase(lobbyId);
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
        clearRoundState(lobby.id);
        destroyLobby(lobby.id);
    });
}

setInterval(cleanupStaleLobbies, LOBBY_CLEANUP_INTERVAL_MS);

server.listen(PORT, () => {
    console.log(`server listening on http://localhost:${PORT}`);
});