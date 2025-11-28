const socket = io();

let isHostUser = false;
let roundActive = false;
let hasStartedRound = false;
// Legacy placeholder. The client UI now lives in the React app under src/.
console.warn('Legacy client script is no longer used. Run the React client instead.');
    scoreDisplay.textContent = payload.score;
    lobbyIdDisplay.textContent = payload.lobby.id;
    if (payload.lobby && Array.isArray(payload.lobby.players)) {
        renderPlayers(payload.lobby.players);
    // Legacy client entry removed; the React app in src/ now handles all UI logic.
});

// answering
answerBtn.addEventListener('click', () => {
    const answer = answerInput.value;
    socket.emit('submitAnswer', { answer });
    log('Sent submitAnswer', { answer });
});

if (startRoundBtn) {
    startRoundBtn.addEventListener('click', () => {
        socket.emit('startRoundRequest');
        log('Requested round start');
    });
}