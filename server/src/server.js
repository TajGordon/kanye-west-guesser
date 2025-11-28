import express from 'express'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'

import { joinLobby, getLobbyPlayer, getLobby } from './lobbyManager.js'
import { connectPlayer, disconnectSocket, getPlayerBySocket, listPlayers } from "./playerManager.js"

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: { origin: '*' } // for local dev
});

const PORT = 3000;

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../../client')));

app.get('/', (req, res) => {
    res.send('ehllo from server')
})

function broadcastLobbyRoster(lobbyId) {
    const lobby = getLobby(lobbyId);
    if (!lobby) return;

    const payload = {
        lobbyId,
        players: lobby.players.map(({ playerId, name, score }) => ({
            playerId,
            name,
            score
        }))
    };

    io.to(lobbyId).emit('lobbyRosterUpdate', payload);
}

io.on('connection', (socket) => {
    console.log('Client connected: ', socket.id);

    socket.on('joinLobby', (payload) => {
        console.log('joinLobby', payload);
        const { name, lobbyId, playerId } = payload;
        const player = connectPlayer(socket, { name, lobbyId, playerId });

        const { lobby, lobbyPlayer } = joinLobby(socket, { name, lobbyId, playerId });

        // success, idk if it can fail but to justify the name
        const res = true;

        socket.emit('joinLobbyResult', {
            res, 
            lobby: lobby, 
            score: lobbyPlayer.score 
        });

        console.log('Lobby after join:', lobby);
        console.log('All players:', listPlayers());

        broadcastLobbyRoster(lobbyId);
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

        const result = true;
        if (result) {
            lobbyPlayer.score = (lobbyPlayer.score || 0) + 1;
        }

        socket.emit('answerResult', { result, score: lobbyPlayer.score });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        disconnectSocket(socket);
    });
});

server.listen(PORT, () => {
    console.log(`server listening on http://localhost:${PORT}`);
});