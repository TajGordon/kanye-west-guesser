const playersBySocketId = new Map();
const playersById = new Map();

export function connectPlayer(socket, { name, lobbyId, playerId }) {
    let player = playersById.get(playerId);
    if (!player) {
        player = {
            playerId,
            name,
            lobbyId,
            socketIds: new Set()
        };
        playersById.set(playerId, player);
    } else {
        player.name = name || player.name;
        player.lobbyId = lobbyId || player.lobbyId;
    }

    player.socketIds.add(socket.id);
    playersBySocketId.set(socket.id, player);
    return player;
}

export function disconnectSocket(socket) {
    const player = playersBySocketId.get(socket.id);
    if (!player) return null;

    playersBySocketId.delete(socket.id);
    player.socketIds.delete(socket.id);

    const fullyDisconnected = player.socketIds.size === 0;
    if (fullyDisconnected) {
        playersById.delete(player.playerId);
    }

    return { player, fullyDisconnected };
}

export function getPlayerBySocket(socket) {
    return playersBySocketId.get(socket.id) || null;
}

export function listPlayers() {
    return Array.from(playersBySocketId.values());
}

