const socket = io();

function log(message, data) { 
    const el = document.getElementById('log');
    el.textContent += message + (data ? ' ' + JSON.stringify(data) : '') + '\n';
}

socket.on('connect', () => {
    log('Connected with id:', socket.id);
});

socket.on('disconnect', () => {
    log('disconnected');
});

socket.on('answerResult', (payload) => {
    log('answer result:', { payload });
});

const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const answerInput = document.getElementById('answerInput');
const answerBtn = document.getElementById('answerBtn');

joinBtn.addEventListener('click', () => {
    const name = nameInput.value || 'anon';
    socket.emit('joinLobby', { name });
    log('sent joinLobby', { name });
});

answerBtn.addEventListener('click', () => {
    const answer = answerInput.value;
    socket.emit('submitAnswer', { answer });
    log('Sent submitAnswer', { answer });
});