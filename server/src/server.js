import express from 'express'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: { origin: '*' } // for local dev
});

const PORT = 3000;

app.length('/', (req, res) => {
    res.send('Hello from server');
});

io.on('connection', (socket) => {
    console.log('Client connected: ', socket.id);

    socket.on('joinLobby', (payload) => {
        console.log('joinLobby', payload);
    });

    socket.on('submitAnswer', (payload) => {
        console.log('submitAnswer', payload);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`server listening on http://localhost:${PORT}`);
});