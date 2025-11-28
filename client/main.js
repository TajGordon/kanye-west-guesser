const socket = io();

function getOrCreatePlayerId() {
    let pid = localStorage.getItem('playerId');
    if (!pid) {
        pid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        localStorage.setItem('playerId', pid);
    }
    return pid;
}

const playerId = getOrCreatePlayerId();

function log(message, data) { 
    const el = document.getElementById('log');
    el.textContent += message + (data ? ' ' + JSON.stringify(data) : '') + '\n';
}

socket.on('connect', () => {
    log('Connected with socket id:', socket.id);
    log('Using playerId:', playerId);
});

socket.on('disconnect', () => {
    log('disconnected');
});

socket.on('answerResult', (payload) => {
    log('answer result:', { payload });
    scoreDisplay.textContent = payload.score;
});

socket.on('joinLobbyResult', (payload) => {
    log('join lobby result:', { payload });
    scoreDisplay.textContent = payload.score;
    lobbyIdDisplay.textContent = payload.lobby.id;
    if (payload.lobby && Array.isArray(payload.lobby.players)) {
        renderPlayers(payload.lobby.players);
    }
});

socket.on('lobbyRosterUpdate', (payload) => {
    log('lobby roster update:', payload);
    if (Array.isArray(payload.players)) {
        renderPlayers(payload.players);
    }
});

const nameInput = document.getElementById('nameInput');
const lobbyIdInput = document.getElementById('lobbyIdInput');
const joinBtn = document.getElementById('joinBtn');
const answerInput = document.getElementById('answerInput');
const answerBtn = document.getElementById('answerBtn');
const scoreDisplay = document.getElementById('scoreDisplay');
const lobbyIdDisplay = document.getElementById('lobbyIdDisplay');
const playersList = document.getElementById('playersList');

function renderPlayers(players) {
    if (!playersList) return;
    playersList.innerHTML = '';
    players.forEach((player) => {
        const li = document.createElement('li');
        li.textContent = `${player.name || '??'} (${player.score ?? 0})`;
        playersList.appendChild(li);
    });
}

// name input / joining
joinBtn.addEventListener('click', () => {
    const name = nameInput.value || 'anon';
    const lobbyId = lobbyIdInput.value || 'None';
    if (lobbyId == 'None') {
        log('Invalid lobby Id');
        return;
    }
    socket.emit('joinLobby', { name, lobbyId, playerId });
    log('sent joinLobby', { name, lobbyId, playerId });
});

// answering
answerBtn.addEventListener('click', () => {
    const answer = answerInput.value;
    socket.emit('submitAnswer', { answer });
    log('Sent submitAnswer', { answer });
});