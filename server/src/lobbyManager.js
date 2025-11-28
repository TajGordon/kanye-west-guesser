const lobbies = new Map();

export function getLobby(lobbyId) {
    return lobbies.get(lobbyId) || null;
}

export function createLobbyIfMissing(lobbyId) {
    if (!lobbies.has(lobbyId)) {
        lobbies.set(lobbyId, {
            id: lobbyId,
            players: []
        });
    }
    return lobbies.get(lobbyId);
}

export function joinLobby(socket, { name, lobbyId, playerId }) {
    const lobby = createLobbyIfMissing(lobbyId);

    let lobbyPlayer = lobby.players.find(p => p.playerId === playerId);
    if (!lobbyPlayer) { 
        lobbyPlayer = {
            playerId,
            name,
            score: 0
        };
        lobby.players.push(lobbyPlayer);
    } else {
        lobbyPlayer.name = name || lobbyPlayer.name;
    }

    socket.join(lobbyId);
    return { lobby, lobbyPlayer };
}

export function getLobbyPlayer(lobbyId, playerId) {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return null;
    return lobby.players.find(p => p.playerId == playerId) || null;
}