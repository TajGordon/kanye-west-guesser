import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const MAX_LOG_LINES = 80;
const DEFAULT_LOBBY_SETTINGS = {
  roundDurationMs: 20000,
  questionPackId: 'kanye-classic',
  pointsToWin: 50
};

function usePersistentPlayerId() {
  return useMemo(() => {
    let stored = localStorage.getItem('playerId');
    if (!stored) {
      stored = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      localStorage.setItem('playerId', stored);
    }
    return stored;
  }, []);
}

export default function App() {
  const playerId = usePersistentPlayerId();
  const socketRef = useRef(null);
  const routeMatch = window.location.pathname.match(/^\/room\/([A-Za-z0-9-]+)/i);
  const routeLobbyId = routeMatch ? routeMatch[1].toUpperCase() : '';
  const inRoomContext = Boolean(routeLobbyId);

  const [displayName, setDisplayName] = useState(() => localStorage.getItem('playerName') || '');
  const [homeLobbyCode, setHomeLobbyCode] = useState('');
  const [players, setPlayers] = useState([]);
  const [hostPlayerId, setHostPlayerId] = useState(null);
  const [logLines, setLogLines] = useState([]);
  const [score, setScore] = useState(0);
  const [lobbyId, setLobbyId] = useState('—');
  const [isHost, setIsHost] = useState(false);
  const [answer, setAnswer] = useState('');
  const [roundActive, setRoundActive] = useState(false);
  const [hasRoundRun, setHasRoundRun] = useState(false);
  const [question, setQuestion] = useState(null);
  const [roundStatus, setRoundStatus] = useState('Round idle');
  const [roundResults, setRoundResults] = useState(null);
  const [countdownText, setCountdownText] = useState('--');
  const [roundEndsAt, setRoundEndsAt] = useState(null);
  const [phase, setPhase] = useState('seating');
  const [lastRoundSummary, setLastRoundSummary] = useState(null);
  const [roundTiming, setRoundTiming] = useState({ startedAt: null, durationMs: null });
  const [progressKey, setProgressKey] = useState(0);
  const [hasAnsweredCorrectly, setHasAnsweredCorrectly] = useState(false);
  const [lobbySettings, setLobbySettings] = useState(DEFAULT_LOBBY_SETTINGS);
  const [roundDurationInput, setRoundDurationInput] = useState(String(DEFAULT_LOBBY_SETTINGS.roundDurationMs / 1000));
  const [isEditingRoundDuration, setIsEditingRoundDuration] = useState(false);
  const [pointsToWinInput, setPointsToWinInput] = useState(String(DEFAULT_LOBBY_SETTINGS.pointsToWin));
  const [isEditingPointsToWin, setIsEditingPointsToWin] = useState(false);
  const [winDetails, setWinDetails] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  const nameRef = useRef(displayName);
  const answerInputRef = useRef(null);
  useEffect(() => {
    nameRef.current = displayName;
    localStorage.setItem('playerName', displayName);
  }, [displayName]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    const autoJoinRoom = () => {
      if (!routeLobbyId) return;
      const safeName = (nameRef.current || '').trim() || 'anon';
      socket.emit('joinLobby', { name: safeName, lobbyId: routeLobbyId, playerId });
    };

    socket.on('connect', () => {
      pushLog('Connected', socket.id);
      autoJoinRoom();
    });

    socket.on('disconnect', () => {
      pushLog('Disconnected');
      setRoundActive(false);
      setCountdownText('--');
    });

    socket.on('answerResult', (payload) => {
      pushLog('Answer result', payload.status ?? (payload.result ? 'correct' : 'incorrect'));
      if (typeof payload.score === 'number') {
        setScore(payload.score);
      }
      if (payload.status === 'correct' || payload.result === true) {
        setHasAnsweredCorrectly(true);
      }
    });

    socket.on('joinLobbyResult', (payload) => {
      pushLog('Joined lobby', payload.lobby?.id);
      setScore(payload.score ?? 0);
      setLobbyId(payload.lobby?.id ?? routeLobbyId ?? '—');
      setPlayers(payload.lobby?.players ?? []);
      setIsHost(Boolean(payload.isHost));
      setHostPlayerId(payload.lobby?.hostPlayerId ?? null);
      const joinedPhase = payload.phase || 'seating';
      setPhase(joinedPhase);
      setLastRoundSummary(payload.lastRoundSummary || null);
      if (payload.settings) {
        setLobbySettings({ ...DEFAULT_LOBBY_SETTINGS, ...payload.settings });
      }
      const joinedWinDetails = joinedPhase === 'win' ? payload.phaseData?.win || null : null;
      setWinDetails(joinedWinDetails);
      if (joinedPhase === 'round') {
        setRoundStatus('Round in progress');
        setRoundActive(true);
      } else if (joinedPhase === 'summary') {
        setRoundStatus('Round complete');
        setRoundActive(false);
      } else if (joinedPhase === 'win') {
        setRoundStatus('Game complete - awaiting reset');
        setRoundActive(false);
        setRoundResults(null);
        setCountdownText('--');
        setHasAnsweredCorrectly(false);
      } else {
        setRoundStatus('Waiting for host');
        setRoundActive(false);
      }
    });
    socket.on('lobbyRosterUpdate', (payload) => {
      setPlayers(payload.players ?? []);
      if (payload.hostPlayerId) {
        setHostPlayerId(payload.hostPlayerId);
      }
      if (payload.players?.length) {
        const selfEntry = payload.players.find((p) => p.playerId === playerId);
        if (selfEntry && typeof selfEntry.score === 'number') {
          setScore(selfEntry.score);
        }
      }
    });

    socket.on('lobbyPhaseUpdate', (payload) => {
      const nextPhase = payload.phase || 'seating';
      setPhase(nextPhase);
      setLastRoundSummary(payload.lastRoundSummary || null);
      const nextWinDetails = nextPhase === 'win' ? payload.phaseData?.win || null : null;
      setWinDetails(nextWinDetails);
      if (nextPhase === 'seating') {
        setRoundStatus('Waiting for host');
        setRoundActive(false);
        setHasAnsweredCorrectly(false);
      } else if (nextPhase === 'summary') {
        setRoundStatus('Round complete');
        setRoundActive(false);
        setHasAnsweredCorrectly(false);
      } else if (nextPhase === 'win') {
        setRoundStatus('Game complete - awaiting reset');
        setRoundActive(false);
        setRoundResults(null);
        setCountdownText('--');
        setHasAnsweredCorrectly(false);
      }
    });

    socket.on('lobbySettingsUpdate', (payload) => {
      if (payload?.settings) {
        setLobbySettings({ ...DEFAULT_LOBBY_SETTINGS, ...payload.settings });
      }
    });

    socket.on('roundStarted', (payload) => {
      pushLog('Round started', payload.question?.prompt);
      setWinDetails(null);
      setQuestion(payload.question || null);
      setRoundStatus('Round in progress');
      setRoundActive(true);
      setHasRoundRun(true);
      setRoundResults(null);
      setAnswer('');
      setHasAnsweredCorrectly(false);
      const endsAt = payload.endsAt ?? (payload.startedAt + (payload.durationMs || 0));
      setRoundEndsAt(endsAt);
      setRoundTiming({ startedAt: payload.startedAt || Date.now(), durationMs: payload.durationMs || null });
      setProgressKey((key) => key + 1);
      setPhase('round');
      requestAnimationFrame(() => {
        answerInputRef.current?.focus();
      });
    });

    socket.on('roundEnded', (payload) => {
      pushLog('Round ended', payload.reason);
      setRoundActive(false);
      setRoundEndsAt(null);
      setCountdownText('0.0s');
      setRoundTiming({ startedAt: null, durationMs: null });
      setProgressKey((key) => key + 1);
      setRoundResults(payload);
      setLastRoundSummary(payload);
      setPhase('summary');
      setHasAnsweredCorrectly(false);

      const fastest = payload?.correctResponders?.[0];
      if (fastest) {
        setRoundStatus(`${fastest.name || 'Player'} was fastest!`);
      } else if (payload?.reason === 'all-correct') {
        setRoundStatus('Everyone answered correctly!');
      } else if (payload?.reason === 'timer') {
        setRoundStatus('Time is up!');
      } else {
        setRoundStatus('Round ended');
      }
    });

    socket.on('roundStartDenied', (payload) => {
      pushLog('Round start denied', payload?.reason);
    });

    socket.on('lobbyWin', (payload) => {
      setWinDetails(payload);
      setPhase('win');
      setRoundStatus('Game complete - awaiting reset');
      setRoundActive(false);
      setRoundEndsAt(null);
      setCountdownText('--');
      setRoundTiming({ startedAt: null, durationMs: null });
      setProgressKey((key) => key + 1);
      setRoundResults(null);
      setHasAnsweredCorrectly(false);
    });

    if (socket.connected && routeLobbyId) {
      autoJoinRoom();
    }

    return () => {
      socket.disconnect();
    };
  }, [playerId, routeLobbyId]);

  useEffect(() => {
    if (!roundActive || !roundEndsAt) {
      setCountdownText(hasRoundRun ? '0.0s' : '--');
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(roundEndsAt - Date.now(), 0);
      setCountdownText(`${(remaining / 1000).toFixed(1)}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);
    return () => clearInterval(interval);
  }, [roundActive, roundEndsAt, hasRoundRun]);

  function pushLog(message, data) {
    setLogLines((prev) => {
      const next = [`${new Date().toLocaleTimeString()} • ${message}${data ? `: ${JSON.stringify(data)}` : ''}`, ...prev];
      return next.slice(0, MAX_LOG_LINES);
    });
  }

  function emit(event, payload) {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit(event, payload);
  }

  function requestLobbyJoin(targetLobbyId = routeLobbyId) {
    if (!targetLobbyId || !inRoomContext) return;
    const safeName = (nameRef.current || '').trim() || 'anon';
    emit('joinLobby', { name: safeName, lobbyId: targetLobbyId, playerId });
  }

  function handleHomeJoin(e) {
    e.preventDefault();
    if (!homeLobbyCode.trim()) {
      pushLog('Join failed', 'Missing room code');
      return;
    }
    const target = homeLobbyCode.trim().toUpperCase();
    window.location.assign(`/room/${target}`);
  }

  function handleCreateRoom() {
    const randomId = Math.random().toString(36).slice(2, 6).toUpperCase();
    window.location.assign(`/room/${randomId}`);
  }

  function handleAnswerSubmit(e) {
    e.preventDefault();
    if (!answer.trim() || hasAnsweredCorrectly) return;
    emit('submitAnswer', { answer: answer.trim() });
    setAnswer('');
  }

  function handleStartRound() {
    if (phase === 'win') return;
    emit('startRoundRequest');
  }

  function handleApplyDisplayName() {
    if (!inRoomContext) return;
    requestLobbyJoin();
  }

  function handleLeaveRoom() {
    window.location.assign('/');
  }

  function handleResetGame() {
    emit('resetGameRequest');
  }

  const isRoundPhase = phase === 'round';
  const isSummaryPhase = phase === 'summary';
  const isWinPhase = phase === 'win';
  const canStartRound = isHost && !isRoundPhase && !isWinPhase;
  const startButtonLabel = hasRoundRun ? 'Next Question' : 'Start Round';
  const canAcceptAnswer = isRoundPhase && !hasAnsweredCorrectly && !isWinPhase;
  const questionPrompt = isRoundPhase
    ? (question?.prompt || 'Question incoming...')
    : isWinPhase
      ? ((winDetails?.winner?.name || 'A player') + ' wins the game!')
      : isSummaryPhase
        ? 'Round complete. Summary below.'
        : 'Waiting for host to start the first question...';

  const summaryToDisplay = !isRoundPhase && !isWinPhase ? (roundResults || lastRoundSummary) : null;
  const roomUrl = useMemo(() => {
    return routeLobbyId ? `${window.location.origin}/room/${routeLobbyId}` : window.location.origin;
  }, [routeLobbyId]);
  const waitingMessage = isWinPhase
    ? 'Game complete! Waiting for host to start a new game...'
    : isSummaryPhase
      ? 'Waiting for host to start the next question...'
      : 'Host will start the first round soon.';
  const answeredMessage = 'You already answered correctly! Waiting for everyone else...';
  const progressAnimationDelay = useMemo(() => {
    if (!roundTiming.startedAt || !roundTiming.durationMs) return '0ms';
    const elapsed = Date.now() - roundTiming.startedAt;
    const clamped = Math.min(Math.max(elapsed, 0), roundTiming.durationMs);
    return `-${clamped}ms`;
  }, [roundTiming.startedAt, roundTiming.durationMs]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [players]);

  const roundDurationSeconds = useMemo(() => {
    return Math.round((lobbySettings.roundDurationMs ?? DEFAULT_LOBBY_SETTINGS.roundDurationMs) / 1000);
  }, [lobbySettings.roundDurationMs]);

  useEffect(() => {
    if (isEditingRoundDuration) return;
    setRoundDurationInput(String(roundDurationSeconds));
  }, [roundDurationSeconds, isEditingRoundDuration]);

  useEffect(() => {
    if (isEditingPointsToWin) return;
    const currentPoints = lobbySettings.pointsToWin ?? DEFAULT_LOBBY_SETTINGS.pointsToWin;
    setPointsToWinInput(String(currentPoints));
  }, [lobbySettings.pointsToWin, isEditingPointsToWin]);

  const isSettingsEditable = isHost;

  const applyRoundDurationValue = (seconds) => {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 1) return;
    const ms = Math.round(value * 1000);
    setLobbySettings((prev) => ({ ...prev, roundDurationMs: ms }));
    if (isSettingsEditable) {
      emit('updateLobbySettings', { roundDurationMs: ms });
    }
  };

  const handleRoundDurationBlur = () => {
    setIsEditingRoundDuration(false);
    const numericValue = Number(roundDurationInput);
    if (!Number.isFinite(numericValue) || numericValue < 1) {
      setRoundDurationInput(String(roundDurationSeconds));
      return;
    }
    applyRoundDurationValue(numericValue);
  };

  const applyPointsToWinValue = (points) => {
    const value = Number(points);
    if (!Number.isFinite(value) || value < 1) return;
    const normalized = Math.max(1, Math.round(value));
    setLobbySettings((prev) => ({ ...prev, pointsToWin: normalized }));
    if (isSettingsEditable) {
      emit('updateLobbySettings', { pointsToWin: normalized });
    }
  };

  const handlePointsToWinBlur = () => {
    setIsEditingPointsToWin(false);
    const numericValue = Number(pointsToWinInput);
    if (!Number.isFinite(numericValue) || numericValue < 1) {
      const fallback = lobbySettings.pointsToWin ?? DEFAULT_LOBBY_SETTINGS.pointsToWin;
      setPointsToWinInput(String(fallback));
      return;
    }
    applyPointsToWinValue(numericValue);
  };

  const handleQuestionPackChange = (nextId) => {
    setLobbySettings((prev) => ({ ...prev, questionPackId: nextId }));
    if (isSettingsEditable) {
      emit('updateLobbySettings', { questionPackId: nextId });
    }
  };

  const questionSetOptions = useMemo(() => ([
    { id: 'kanye-classic', label: 'Classic Kanye' },
    { id: 'kanye-deepcuts', label: 'Deep Cuts' },
    { id: 'all-packs', label: 'All Packs' }
  ]), []);

  const winTargetScore = winDetails?.targetScore ?? lobbySettings.pointsToWin ?? DEFAULT_LOBBY_SETTINGS.pointsToWin;
  const winWinnerName = winDetails?.winner?.name || 'Winner';
  const winWinnerScore = winDetails?.winner?.score ?? null;
  const isWinnerSelf = Boolean(winDetails?.winner && winDetails.winner.playerId === playerId);

  const formatElapsedSeconds = (ms) => {
    if (typeof ms !== 'number' || Number.isNaN(ms)) return null;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPlayerGuessMeta = (player) => {
    if (player.roundGuessStatus === 'correct') {
      const elapsed = formatElapsedSeconds(player.correctElapsedMs);
      return {
        text: elapsed || 'Solved',
        status: 'correct'
      };
    }

    if (player.roundGuessStatus === 'incorrect' && player.lastGuessText) {
      return {
        text: `"${player.lastGuessText}"`,
        status: 'incorrect'
      };
    }

    if (player.roundGuessStatus === 'incorrect') {
      return {
        text: 'Incorrect guess',
        status: 'incorrect'
      };
    }

    return {
      text: 'No guess yet',
      status: 'idle'
    };
  };

  if (!inRoomContext) {
    return (
      <div className="home-shell">
        <section className="home-card">
          <div className="home-card-header">
            <h1>Kanye Guesser</h1>
            <p>Drop your name, punch in a four-letter room, and start guessing faster than everyone else.</p>
          </div>
          <form className="home-form" onSubmit={handleHomeJoin}>
            <label className="home-input">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. YeezyFan"
              />
            </label>
            <label className="home-input">
              <span>Room code</span>
              <input
                value={homeLobbyCode}
                onChange={(e) => setHomeLobbyCode(e.target.value)}
                placeholder="4-letter code"
              />
            </label>
            <div className="home-actions">
              <button className="primary-btn" type="submit" disabled={!homeLobbyCode.trim()}>
                Go to room
              </button>
              <button className="secondary-btn" type="button" onClick={handleCreateRoom}>
                Create random room
              </button>
            </div>
          </form>
        </section>

        <section className="home-log">
          <div className="home-log-header">
            <h2>Activity</h2>
            <span>{logLines.length} events</span>
          </div>
          <ul>
            {logLines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  const utilityPanelsOpen = isSettingsOpen || isLogOpen;
  const utilityStackClass = ['utility-stack'];
  if (isSettingsOpen && isLogOpen) utilityStackClass.push('dual');
  const contentShellClass = ['content-shell'];
  if (utilityPanelsOpen) contentShellClass.push('with-utility');

  return (
    <div className={`app-frame ${utilityPanelsOpen ? 'utility-open' : ''}`}>
      <header className="top-bar">
        <div className="brand-block">
          <h1>Kanye Guesser</h1>
          <span className="room-pill">Room {routeLobbyId || lobbyId}</span>
        </div>
        <div className="top-bar-field">
          <label>Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={handleApplyDisplayName}
            placeholder="e.g. YeezyFan"
          />
        </div>
        <div className="top-bar-field">
          <label>Share link</label>
          <input value={roomUrl} readOnly onFocus={(e) => e.target.select()} />
        </div>
        <div className="top-bar-actions">
          <button type="button" onClick={() => setIsSettingsOpen((prev) => !prev)}>
            {isSettingsOpen ? 'Hide settings' : 'Show settings'}
          </button>
          <button type="button" onClick={() => setIsLogOpen((prev) => !prev)}>
            {isLogOpen ? 'Hide log' : 'Show log'}
          </button>
          <button type="button" onClick={handleLeaveRoom}>
            Leave room
          </button>
        </div>
      </header>
      <div className={contentShellClass.join(' ')}>
        {utilityPanelsOpen && (
          <aside className={utilityStackClass.join(' ')}>
            {isSettingsOpen && (
              <section className="utility-panel settings-panel">
                <div className="rail-header">
                  <h2>Settings</h2>
                </div>
                <div className="settings-grid">
                  <label className="settings-control">
                    <span>Round duration (seconds)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={roundDurationInput}
                      onChange={(e) => setRoundDurationInput(e.target.value)}
                      onFocus={() => setIsEditingRoundDuration(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      onBlur={handleRoundDurationBlur}
                      disabled={!isSettingsEditable}
                    />
                  </label>

                  <label className="settings-control">
                    <span>Question set</span>
                    <select
                      value={lobbySettings.questionPackId}
                      onChange={(e) => handleQuestionPackChange(e.target.value)}
                      disabled={!isSettingsEditable}
                    >
                      {questionSetOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="settings-control">
                    <span>Points to win</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={pointsToWinInput}
                      onChange={(e) => setPointsToWinInput(e.target.value)}
                      onFocus={() => setIsEditingPointsToWin(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      onBlur={handlePointsToWinBlur}
                      disabled={!isSettingsEditable}
                    />
                  </label>

                  {isHost && (
                    <button className="secondary-btn" type="button" onClick={handleResetGame}>
                      Reset game
                    </button>
                  )}
                  {!isSettingsEditable && (
                    <p className="settings-hint">Only the host can change these.</p>
                  )}
                </div>
              </section>
            )}

            {isLogOpen && (
              <section className="utility-panel log-panel-card">
                <div className="rail-header">
                  <h2>Event log</h2>
                </div>
                <ul className="log-panel-list">
                  {logLines.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        )}

        <main className="center-stage">
          <section className={`question-hero ${isWinPhase ? 'win' : ''}`}>
            <div className="hero-ribbon">
              <span>{isWinPhase ? 'Winner' : roundStatus}</span>
              {isHost && !isWinPhase && (
                <button
                  className="host-button"
                  type="button"
                  onClick={handleStartRound}
                  disabled={!canStartRound}
                >
                  {startButtonLabel}
                </button>
              )}
            </div>
            {isRoundPhase && roundTiming.durationMs && !hasAnsweredCorrectly && (
              <div className="hero-progress">
                <div
                  key={`${progressKey}`}
                  className="hero-progress-fill"
                  style={{
                    animationDuration: `${roundTiming.durationMs}ms`,
                    animationDelay: progressAnimationDelay
                  }}
                />
              </div>
            )}

            {isWinPhase ? (
              <div className="hero-body">
                <div className="winner-name">
                  {winWinnerName}
                  {isWinnerSelf ? ' (You)' : ''}
                </div>
                <p className="win-score-line">
                  {winWinnerScore != null ? `${winWinnerScore} pts total` : 'Target reached'}
                </p>
                <p className="win-target-line">Target: {winTargetScore} pts</p>
                {!isHost && <p className="win-hint">Waiting for host to start a new game...</p>}
              </div>
            ) : (
              <div className="hero-body">
                <p className="question-prompt">{questionPrompt}</p>
                <div className="hero-meta">
                  <span>{isRoundPhase ? 'Round live' : waitingMessage}</span>
                  <span>Time left: {isRoundPhase ? '' : countdownText}</span>
                </div>
              </div>
            )}
          </section>

          {!isWinPhase && summaryToDisplay && (
            <section className="summary-panel">
              {summaryToDisplay.correctAnswer && (
                <div className="round-results-answer">
                  Correct answer: <strong>{summaryToDisplay.correctAnswer}</strong>
                </div>
              )}
              <div className="round-results-label">Correct players:</div>
              {summaryToDisplay.correctResponders?.length ? (
                <ul>
                  {summaryToDisplay.correctResponders.map((entry, index) => {
                    const elapsedMs = entry.submittedAt && summaryToDisplay.startedAt
                      ? entry.submittedAt - summaryToDisplay.startedAt
                      : null;
                    const timeText = elapsedMs != null ? `${(elapsedMs / 1000).toFixed(2)}s` : '—';
                    return (
                      <li key={entry.playerId + index}>
                        #{index + 1} {entry.name || 'Player'} ({timeText})
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="round-summary-empty">No correct answers this round.</div>
              )}
            </section>
          )}
        </main>

        <aside className="player-rail">
          <h2>Players</h2>
          <div className="player-list-scroll">
            <ul className="players-list">
              {sortedPlayers.map((p) => {
                const isHostPlayer = p.playerId === hostPlayerId;
                const isSelf = p.playerId === playerId;
                const guessMeta = getPlayerGuessMeta(p);
                return (
                  <li key={p.playerId} className={`player-chip ${isHostPlayer ? 'host-chip' : ''}`}>
                    <div className="player-main-row">
                      <span className={`player-name ${isHostPlayer ? 'host-name' : ''}`}>
                        {p.name || 'Player'}
                        {isHostPlayer ? ' • Host' : ''}
                        {isSelf ? ' • You' : ''}
                      </span>
                      <strong className="player-score-value">{p.score ?? 0}</strong>
                    </div>
                    <div className={`player-guess ${guessMeta.status}`}>
                      {guessMeta.text}
                    </div>
                  </li>
                );
              })}
              {!players.length && <li className="player-chip">No players yet</li>}
            </ul>
          </div>
        </aside>
      </div>

      <div className="answer-bar">
        <form onSubmit={handleAnswerSubmit}>
          <input
            ref={answerInputRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={canAcceptAnswer ? 'Type your guess...' : waitingMessage}
            disabled={!canAcceptAnswer}
          />
          <button className="secondary-btn" type="submit" disabled={!canAcceptAnswer || !answer.trim()}>
            Submit
          </button>
        </form>
      </div>

    </div>
  );
}
