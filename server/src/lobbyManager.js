const LOBBY_PHASES = {
    SEATING: 'seating',
    ROUND: 'round',
    SUMMARY: 'summary',
    WIN: 'win'
};

const lobbies = new Map();
const DEFAULT_LOBBY_SETTINGS = {
    roundDurationMs: 20_000,
    questionPackId: 'kanye-classic',
    pointsToWin: 50
};
const MIN_ROUND_DURATION_MS = 1_000;
const MAX_ROUND_DURATION_MS = 120_000;
const MIN_POINTS_TO_WIN = 5;
const MAX_POINTS_TO_WIN = 500;

function ensurePlayerGuessState(player) {
    if (!player) return;
    if (!player.roundGuessStatus) {
        player.roundGuessStatus = 'idle';
    }
    if (typeof player.lastGuessText === 'undefined') {
        player.lastGuessText = null;
    }
    if (typeof player.correctElapsedMs === 'undefined') {
        player.correctElapsedMs = null;
    }
}

export function getLobby(lobbyId) {
    return lobbies.get(lobbyId) || null;
}

export function createLobbyIfMissing(lobbyId) {
    if (!lobbies.has(lobbyId)) {
        lobbies.set(lobbyId, {
            id: lobbyId,
            hostPlayerId: null,
            players: [],
            phase: LOBBY_PHASES.SEATING,
            phaseData: null,
            lastRoundSummary: null,
            lastActiveAt: Date.now(),
            pendingDestroyAt: null,
            lastHostPlayerId: null,
            hostReleaseAt: null,
            scoreByPlayerId: new Map(),
            settings: { ...DEFAULT_LOBBY_SETTINGS }
        });
    }

    const lobby = lobbies.get(lobbyId);
    if (lobby && !lobby.scoreByPlayerId) {
        lobby.scoreByPlayerId = new Map();
    }

    lobby?.players?.forEach(ensurePlayerGuessState);
    if (lobby && !lobby.settings) {
        lobby.settings = { ...DEFAULT_LOBBY_SETTINGS };
    }
    return lobby;
}

export function joinLobby(socket, { name, lobbyId, playerId }) {
    const lobby = createLobbyIfMissing(lobbyId);
    refreshHostAssignment(lobby);
    if (!lobby.hostPlayerId) {
        const now = Date.now();
        const withinGrace = lobby.hostReleaseAt && (now - lobby.hostReleaseAt) < 60_000;
        if (withinGrace && lobby.lastHostPlayerId === playerId) {
            lobby.hostPlayerId = playerId;
            lobby.hostReleaseAt = null;
        } else if (!withinGrace) {
            lobby.hostPlayerId = playerId;
            lobby.hostReleaseAt = null;
        }
    }

    let lobbyPlayer = lobby.players.find(p => p.playerId === playerId);
    if (!lobbyPlayer) { 
        const priorScore = lobby.scoreByPlayerId?.get(playerId) ?? 0;
        lobbyPlayer = {
            playerId,
            name,
            score: priorScore,
            roundGuessStatus: 'idle',
            lastGuessText: null,
            correctElapsedMs: null
        };
        lobby.players.push(lobbyPlayer);
    } else {
        lobbyPlayer.name = name || lobbyPlayer.name;
        ensurePlayerGuessState(lobbyPlayer);
    }

    socket.join(lobbyId);
    return { lobby, lobbyPlayer, isHost: lobby.hostPlayerId === playerId };
}

export function getLobbyPlayer(lobbyId, playerId) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return null;
    return lobby.players.find(p => p.playerId == playerId) || null;
}

export function isLobbyHost(lobbyId, playerId) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return false;
    return lobby.hostPlayerId === playerId;
}

export function removePlayerFromLobby(lobbyId, playerId) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return null;
    const idx = lobby.players.findIndex(p => p.playerId === playerId);
    if (idx === -1) return lobby;
    const [removedPlayer] = lobby.players.splice(idx, 1);
    if (removedPlayer) {
        lobby.scoreByPlayerId?.set(playerId, removedPlayer.score || 0);
    }
    if (lobby.hostPlayerId === playerId) {
        lobby.lastHostPlayerId = playerId;
        lobby.hostReleaseAt = Date.now();
        lobby.hostPlayerId = null;
    }
    if (lobby.players.length === 0) {
        lobby.pendingDestroyAt = Date.now();
    }
    return lobby;
}

export function markLobbyActive(lobbyId) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return null;
    lobby.lastActiveAt = Date.now();
    lobby.pendingDestroyAt = null;
    refreshHostAssignment(lobby);
    return lobby;
}

export function setLobbyPhase(lobbyId, phase, phaseData = null) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return null;
    lobby.phase = phase;
    lobby.phaseData = phaseData;
    if (phase === LOBBY_PHASES.SUMMARY && phaseData?.summary) {
        lobby.lastRoundSummary = phaseData.summary;
    }
    markLobbyActive(lobbyId);
    return lobby;
}

export function listLobbies() {
    return Array.from(lobbies.values());
}

export function destroyLobby(lobbyId) {
    lobbies.delete(lobbyId);
}

export function getLobbyPhases() {
    return LOBBY_PHASES;
}

export function getLobbySettings(lobbyId) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return { ...DEFAULT_LOBBY_SETTINGS };
    return { ...DEFAULT_LOBBY_SETTINGS, ...(lobby.settings || {}) };
}

function sanitizeSettingsPatch(patch = {}) {
    const next = {};
    if (typeof patch.roundDurationMs === 'number' && Number.isFinite(patch.roundDurationMs)) {
        const clamped = Math.max(MIN_ROUND_DURATION_MS, Math.min(MAX_ROUND_DURATION_MS, patch.roundDurationMs));
        next.roundDurationMs = Math.round(clamped / 1000) * 1000;
    }
    if (typeof patch.questionPackId === 'string' && patch.questionPackId.trim().length) {
        next.questionPackId = patch.questionPackId.trim();
    }
    if (typeof patch.pointsToWin === 'number' && Number.isFinite(patch.pointsToWin)) {
        const clampedPoints = Math.max(MIN_POINTS_TO_WIN, Math.min(MAX_POINTS_TO_WIN, Math.round(patch.pointsToWin)));
        next.pointsToWin = clampedPoints;
    }
    return next;
}

export function updateLobbySettings(lobbyId, patch = {}) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return null;
    if (!lobby.settings) {
        lobby.settings = { ...DEFAULT_LOBBY_SETTINGS };
    }
    const sanitized = sanitizeSettingsPatch(patch);
    if (!Object.keys(sanitized).length) {
        return lobby.settings;
    }
    lobby.settings = {
        ...lobby.settings,
        ...sanitized
    };
    return lobby.settings;
}

export function resetLobbyRoundGuesses(lobbyId) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return null;
    lobby.players.forEach((player) => {
        ensurePlayerGuessState(player);
        player.roundGuessStatus = 'idle';
        player.lastGuessText = null;
        player.correctElapsedMs = null;
    });
    return lobby;
}

function refreshHostAssignment(lobby) {
    if (!lobby) return;
    if (lobby.hostPlayerId) return;
    if (!lobby.players.length) return;
    const now = Date.now();
    const withinGrace = lobby.hostReleaseAt && (now - lobby.hostReleaseAt) < 60_000;
    if (withinGrace && lobby.lastHostPlayerId) {
        return;
    }
    lobby.hostPlayerId = lobby.players[0]?.playerId || null;
    if (lobby.hostPlayerId) {
        lobby.hostReleaseAt = null;
    }
}

export function resetLobbyGameState(lobbyId) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return null;
    lobby.players.forEach((player) => {
        player.score = 0;
        ensurePlayerGuessState(player);
        player.roundGuessStatus = 'idle';
        player.lastGuessText = null;
        player.correctElapsedMs = null;
    });
    lobby.scoreByPlayerId?.clear();
    lobby.phase = LOBBY_PHASES.SEATING;
    lobby.phaseData = null;
    lobby.lastRoundSummary = null;
    lobby.lastActiveAt = Date.now();
    lobby.pendingDestroyAt = null;
    return lobby;
}