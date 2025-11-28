import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const MAX_LOG_LINES = 80;
const DEFAULT_LOBBY_SETTINGS = {
  roundDurationMs: 20000,
  questionPackId: 'kanye-classic',
  pointsToWin: 50
};

function formatCompactNameList(names, limit = 2) {
  if (!names.length) return '';
  const visible = names.slice(0, limit);
  const remaining = names.length - visible.length;
  const base = visible.join(', ');
  return remaining > 0 ? `${base} +${remaining} more` : base;
}

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
  const [summaryEndsAt, setSummaryEndsAt] = useState(null);
  const [summaryCountdownText, setSummaryCountdownText] = useState('--');
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
      setSummaryEndsAt(null);
      setSummaryCountdownText('--');
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
      if (joinedPhase === 'summary') {
        setSummaryEndsAt(payload.phaseData?.revealEndsAt || null);
      } else {
        setSummaryEndsAt(null);
        setSummaryCountdownText('--');
      }
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
        setHasRoundRun(false);
        setRoundEndsAt(null);
        setCountdownText('--');
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
      if (nextPhase === 'summary') {
        setSummaryEndsAt(payload.phaseData?.revealEndsAt || null);
      } else {
        setSummaryEndsAt(null);
        setSummaryCountdownText('--');
      }
      if (nextPhase === 'seating') {
        setRoundStatus('Waiting for host');
        setRoundActive(false);
        setHasAnsweredCorrectly(false);
        setHasRoundRun(false);
        setRoundEndsAt(null);
        setCountdownText('--');
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
      setSummaryEndsAt(null);
      setSummaryCountdownText('--');
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
      setSummaryCountdownText('--');
      setSummaryEndsAt(payload.revealEndsAt || null);

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
      setSummaryEndsAt(null);
      setSummaryCountdownText('--');
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
      const shouldShowZero = hasRoundRun && phase !== 'seating';
      setCountdownText(shouldShowZero ? '0.0s' : '--');
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(roundEndsAt - Date.now(), 0);
      setCountdownText(`${(remaining / 1000).toFixed(1)}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);
    return () => clearInterval(interval);
  }, [roundActive, roundEndsAt, hasRoundRun, phase]);

  useEffect(() => {
    if (!summaryEndsAt) {
      setSummaryCountdownText('--');
      return undefined;
    }

    const updateSummaryCountdown = () => {
      const remaining = Math.max(summaryEndsAt - Date.now(), 0);
      setSummaryCountdownText(`${(remaining / 1000).toFixed(1)}s`);
    };

    updateSummaryCountdown();
    const interval = setInterval(updateSummaryCountdown, 100);
    return () => clearInterval(interval);
  }, [summaryEndsAt]);

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

  function handleStartGame() {
    if (!isHost || phase !== 'seating') return;
    emit('startGameRequest');
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
  const showHeroHostButton = isHost && (phase === 'seating' || isWinPhase);
  const heroHostButtonLabel = phase === 'seating' ? 'Start Game' : 'Return to Lobby';
  const heroHostButtonAction = phase === 'seating' ? handleStartGame : handleResetGame;
  const canAcceptAnswer = isRoundPhase && !hasAnsweredCorrectly && !isWinPhase;
  const summaryToDisplay = !isRoundPhase && !isWinPhase ? (roundResults || lastRoundSummary) : null;
  const roomUrl = useMemo(() => {
    return routeLobbyId ? `${window.location.origin}/room/${routeLobbyId}` : window.location.origin;
  }, [routeLobbyId]);
  const waitingMessage = isWinPhase
    ? 'Game complete! Waiting for host to start a new game...'
    : isSummaryPhase
      ? 'Revealing the answer... next round loads automatically.'
      : 'Host will start the game soon.';
  const answeredMessage = 'You got the answer correct! Waiting for everyone else...';
  const summaryNames = summaryToDisplay?.correctResponders?.map((entry) => entry.name || 'Player') ?? [];
  const summarySolvedLine = summaryToDisplay
    ? (summaryNames.length ? `Solved by ${formatCompactNameList(summaryNames)}` : 'No correct answers this round.')
    : '';
  let heroHeadline = '';
  let heroSupportingText = '';
  let heroMetaRight = '';
  if (isRoundPhase) {
    heroHeadline = question?.prompt || 'Question incoming...';
    heroSupportingText = hasAnsweredCorrectly ? answeredMessage : 'Round live';
    heroMetaRight = `Time left: ${countdownText}`;
  } else if (summaryToDisplay) {
    heroHeadline = summaryToDisplay.correctAnswer
      ? `Correct answer: ${summaryToDisplay.correctAnswer}`
      : 'Round complete';
    heroSupportingText = summarySolvedLine;
    heroMetaRight = isSummaryPhase && summaryEndsAt ? `Next round in ${summaryCountdownText}` : '';
  } else if (!isWinPhase) {
    heroHeadline = 'Waiting for host to start the first question...';
    heroSupportingText = waitingMessage;
    heroMetaRight = '';
  }
  if (!heroHeadline && !isWinPhase) {
    heroHeadline = waitingMessage;
  }
  if (!heroSupportingText && !isWinPhase) {
    heroSupportingText = waitingMessage;
  }
  const answerInputDisplayValue = hasAnsweredCorrectly ? 'You got the answer correct!' : answer;
  const answerPlaceholder = hasAnsweredCorrectly ? 'You got the answer correct!' : (canAcceptAnswer ? 'Type your guess...' : waitingMessage);
  const answerFormClass = ['answer-bar-form'];
  if (hasAnsweredCorrectly) {
    answerFormClass.push('answered');
  }
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

  useEffect(() => {
    if (!canAcceptAnswer) return undefined;
    const handleGlobalTyping = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }
      const input = answerInputRef.current;
      if (!input) return;
      if (event.key.length === 1) {
        event.preventDefault();
        input.focus();
        setAnswer((prev) => prev + event.key);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        input.focus();
        setAnswer((prev) => prev.slice(0, -1));
        return;
      }
      if (event.key === 'Enter') {
        input.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalTyping);
    return () => window.removeEventListener('keydown', handleGlobalTyping);
  }, [canAcceptAnswer]);

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
      <div className="content-shell">
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
              {showHeroHostButton && (
                <button
                  className="host-button"
                  type="button"
                  onClick={heroHostButtonAction}
                >
                  {heroHostButtonLabel}
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
                <p className="question-prompt">{heroHeadline}</p>
                <div className="hero-meta">
                  <span>{heroSupportingText}</span>
                  {heroMetaRight && <span>{heroMetaRight}</span>}
                </div>
              </div>
            )}
          </section>
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
        <form className={answerFormClass.join(' ')} onSubmit={handleAnswerSubmit}>
          <input
            ref={answerInputRef}
            value={answerInputDisplayValue}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={answerPlaceholder}
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
