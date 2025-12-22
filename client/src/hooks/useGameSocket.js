import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { QUESTION_TYPES, isChoiceBasedQuestion } from '../questionTypes';

const MAX_LOG_LINES = 80;

const DEFAULT_LOBBY_SETTINGS = {
  roundDurationMs: 20000,
  questionPackId: 'kanye-classic',
  pointsToWin: 50
};

/**
 * Custom hook to manage game socket connection and state
 * Extracts socket logic from App.jsx for better separation of concerns
 */
export function useGameSocket({ playerId, lobbyId, playerName }) {
  const socketRef = useRef(null);
  const nameRef = useRef(playerName);
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  
  // Lobby state
  const [lobbyData, setLobbyData] = useState({
    id: '—',
    hostPlayerId: null,
    players: [],
    isHost: false,
    settings: DEFAULT_LOBBY_SETTINGS
  });
  
  // Phase state
  const [phase, setPhase] = useState('seating');
  const [phaseData, setPhaseData] = useState(null);
  const [winDetails, setWinDetails] = useState(null);
  
  // Round state
  const [roundState, setRoundState] = useState({
    isActive: false,
    hasRun: false,
    question: null,
    questionType: QUESTION_TYPES.FREE_TEXT,
    startedAt: null,
    durationMs: null,
    endsAt: null
  });
  
  // Player answer state
  const [answerState, setAnswerState] = useState({
    hasAnsweredCorrectly: false,
    hasSubmittedChoice: false,
    selectedChoiceId: null,
    lastResult: null,
    // Multi-entry state
    foundAnswers: [],
    wrongGuesses: [],
    remainingGuesses: null,
    multiEntryComplete: false,
    // Ordered-list state
    submittedOrder: null,
    hasSubmittedOrder: false,
    // Numeric state
    hasSubmittedNumeric: false,
    submittedNumericValue: null
  });
  
  // Summary state
  const [summaryState, setSummaryState] = useState({
    current: null,
    last: null,
    endsAt: null
  });
  
  // Player's own score
  const [score, setScore] = useState(0);
  
  // Log lines for debugging
  const [logLines, setLogLines] = useState([]);

  // Update name ref when prop changes
  useEffect(() => {
    nameRef.current = playerName;
  }, [playerName]);

  const pushLog = useCallback((message, data) => {
    setLogLines((prev) => {
      const entry = `${new Date().toLocaleTimeString()} • ${message}${data ? `: ${JSON.stringify(data)}` : ''}`;
      return [entry, ...prev].slice(0, MAX_LOG_LINES);
    });
  }, []);

  // Emit helper
  const emit = useCallback((event, payload) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit(event, payload);
  }, []);

  // Reset answer state for new round
  const resetAnswerState = useCallback(() => {
    setAnswerState({
      hasAnsweredCorrectly: false,
      hasSubmittedChoice: false,
      selectedChoiceId: null,
      lastResult: null,
      foundAnswers: [],
      wrongGuesses: [],
      remainingGuesses: null,
      multiEntryComplete: false,
      submittedOrder: null,
      hasSubmittedOrder: false,
      hasSubmittedNumeric: false,
      submittedNumericValue: null
    });
  }, []);

  // Socket connection and event handlers
  useEffect(() => {
    if (!lobbyId) return;
    
    const socket = io();
    socketRef.current = socket;

    const joinLobby = () => {
      const safeName = (nameRef.current || '').trim() || 'anon';
      socket.emit('joinLobby', { name: safeName, lobbyId, playerId });
    };

    socket.on('connect', () => {
      setIsConnected(true);
      pushLog('Connected', socket.id);
      joinLobby();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      pushLog('Disconnected');
      setRoundState(prev => ({ ...prev, isActive: false, endsAt: null }));
      setSummaryState(prev => ({ ...prev, endsAt: null }));
    });

    socket.on('joinLobbyResult', (payload) => {
      pushLog('Joined lobby', payload.lobby?.id);
      setScore(payload.score ?? 0);
      setLobbyData({
        id: payload.lobby?.id ?? lobbyId ?? '—',
        hostPlayerId: payload.lobby?.hostPlayerId ?? null,
        players: payload.lobby?.players ?? [],
        isHost: Boolean(payload.isHost),
        settings: { ...DEFAULT_LOBBY_SETTINGS, ...payload.settings }
      });
      
      const joinedPhase = payload.phase || 'seating';
      setPhase(joinedPhase);
      setPhaseData(payload.phaseData || null);
      setSummaryState(prev => ({
        ...prev,
        last: payload.lastRoundSummary || null,
        endsAt: joinedPhase === 'summary' ? payload.phaseData?.revealEndsAt || null : null
      }));
      
      if (joinedPhase === 'win') {
        setWinDetails(payload.phaseData?.win || null);
      } else {
        setWinDetails(null);
      }
      
      if (joinedPhase === 'round') {
        setRoundState(prev => ({ ...prev, isActive: true }));
      } else if (joinedPhase === 'seating') {
        setRoundState({
          isActive: false,
          hasRun: false,
          question: null,
          questionType: QUESTION_TYPES.FREE_TEXT,
          startedAt: null,
          durationMs: null,
          endsAt: null
        });
        resetAnswerState();
      }
    });

    socket.on('lobbyRosterUpdate', (payload) => {
      setLobbyData(prev => ({
        ...prev,
        players: payload.players ?? prev.players,
        hostPlayerId: payload.hostPlayerId ?? prev.hostPlayerId
      }));
      
      // Update own score from roster
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
      setPhaseData(payload.phaseData || null);
      setSummaryState(prev => ({
        ...prev,
        last: payload.lastRoundSummary || prev.last,
        endsAt: nextPhase === 'summary' ? payload.phaseData?.revealEndsAt || null : null
      }));
      
      if (nextPhase === 'win') {
        setWinDetails(payload.phaseData?.win || null);
        setRoundState(prev => ({ ...prev, isActive: false, endsAt: null }));
      } else if (nextPhase === 'seating') {
        setWinDetails(null);
        setRoundState({
          isActive: false,
          hasRun: false,
          question: null,
          questionType: QUESTION_TYPES.FREE_TEXT,
          startedAt: null,
          durationMs: null,
          endsAt: null
        });
        resetAnswerState();
      }
    });

    socket.on('lobbySettingsUpdate', (payload) => {
      if (payload?.settings) {
        setLobbyData(prev => ({
          ...prev,
          settings: { ...DEFAULT_LOBBY_SETTINGS, ...payload.settings }
        }));
      }
    });

    socket.on('roundStarted', (payload) => {
      pushLog('Round started', payload.question?.title || payload.question?.prompt);
      setWinDetails(null);
      const qType = payload.question?.type || payload.questionType || QUESTION_TYPES.FREE_TEXT;
      
      setRoundState({
        isActive: true,
        hasRun: true,
        question: payload.question || null,
        questionType: qType,
        startedAt: payload.startedAt || Date.now(),
        durationMs: payload.durationMs || null,
        endsAt: payload.endsAt ?? (payload.startedAt + (payload.durationMs || 0))
      });
      
      resetAnswerState();
      setSummaryState(prev => ({ ...prev, current: null, endsAt: null }));
      setPhase('round');
    });

    socket.on('roundEnded', (payload) => {
      pushLog('Round ended', payload.reason);
      setRoundState(prev => ({
        ...prev,
        isActive: false,
        endsAt: null
      }));
      setSummaryState({
        current: payload,
        last: payload,
        endsAt: payload.revealEndsAt || null
      });
      setPhase('summary');
    });

    socket.on('answerResult', (payload) => {
      console.log('[useGameSocket] answerResult received:', JSON.stringify(payload));
      pushLog('Answer result', payload.status ?? (payload.result ? 'correct' : 'incorrect'));
      
      // Handle error responses
      if (payload.status === 'error') {
        console.error('[useGameSocket] answerResult error:', payload.message);
        return;
      }
      
      if (typeof payload.score === 'number') {
        setScore(payload.score);
      }
      
      setAnswerState(prev => {
        const updated = { ...prev, lastResult: payload };
        
        // For free-text: result is revealed immediately
        if (payload.status === 'correct' || payload.result === true) {
          console.log('[useGameSocket] marking hasAnsweredCorrectly = true');
          updated.hasAnsweredCorrectly = true;
        }
        
        // For choice-based: mark as submitted
        if (payload.submitted === true || payload.status === 'submitted') {
          updated.hasSubmittedChoice = true;
        }
        
        // For multi-entry: update found answers and wrong guesses
        if (payload.multiEntry) {
          console.log('[useGameSocket] multi-entry result:', payload.multiEntry);
          updated.foundAnswers = payload.multiEntry.foundAnswers || [];
          updated.wrongGuesses = payload.multiEntry.wrongGuesses || [];
          updated.remainingGuesses = payload.multiEntry.remainingGuesses;
          updated.multiEntryComplete = payload.multiEntry.isComplete || false;
          
          // Mark as correct if all answers found
          if (payload.multiEntry.foundCount >= payload.multiEntry.totalAnswers) {
            updated.hasAnsweredCorrectly = true;
          }
        }
        
        // For ordered-list: mark as submitted
        if (payload.orderedIds) {
          updated.submittedOrder = payload.orderedIds;
          updated.hasSubmittedOrder = true;
          updated.hasSubmittedChoice = true; // Use same flag for "submitted" state
        }
        
        // For numeric: mark as submitted
        if (payload.numericValue != null) {
          updated.submittedNumericValue = payload.numericValue;
          updated.hasSubmittedNumeric = true;
          updated.hasSubmittedChoice = true; // Use same flag for "submitted" state
        }
        
        console.log('[useGameSocket] updated answerState:', updated);
        return updated;
      });
    });

    socket.on('roundStartDenied', (payload) => {
      pushLog('Round start denied', payload?.reason);
    });

    socket.on('lobbyWin', (payload) => {
      setWinDetails(payload);
      setPhase('win');
      setRoundState(prev => ({
        ...prev,
        isActive: false,
        endsAt: null
      }));
      setSummaryState(prev => ({ ...prev, current: null, endsAt: null }));
    });

    return () => {
      socket.disconnect();
    };
  }, [lobbyId, playerId, pushLog, resetAnswerState]);

  // Actions
  const actions = useMemo(() => ({
    joinLobby: () => {
      const safeName = (nameRef.current || '').trim() || 'anon';
      emit('joinLobby', { name: safeName, lobbyId, playerId });
    },
    
    submitTextAnswer: (text) => {
      if (!text?.trim() || answerState.hasAnsweredCorrectly) return;
      emit('submitAnswer', { answer: text.trim() });
    },
    
    submitChoice: (choiceId) => {
      if (answerState.hasSubmittedChoice || !roundState.isActive) return;
      setAnswerState(prev => ({ ...prev, selectedChoiceId: choiceId }));
      emit('submitAnswer', { choiceId });
    },
    
    requestStartGame: () => {
      emit('startGameRequest');
    },
    
    requestStartRound: () => {
      emit('startRoundRequest');
    },
    
    requestResetGame: () => {
      emit('resetGameRequest');
    },
    
    updateSettings: (settings) => {
      emit('updateLobbySettings', settings);
    }
  }), [emit, lobbyId, playerId, answerState.hasAnsweredCorrectly, answerState.hasSubmittedChoice, roundState.isActive]);

  // Computed state
  const computed = useMemo(() => {
    const isChoiceBased = isChoiceBasedQuestion(roundState.questionType);
    const isRoundPhase = phase === 'round';
    const isSummaryPhase = phase === 'summary';
    const isWinPhase = phase === 'win';
    
    return {
      isRoundPhase,
      isSummaryPhase,
      isWinPhase,
      isSeatingPhase: phase === 'seating',
      isChoiceBased,
      canAcceptAnswer: isChoiceBased 
        ? (isRoundPhase && !answerState.hasSubmittedChoice && !isWinPhase)
        : (isRoundPhase && !answerState.hasAnsweredCorrectly && !isWinPhase),
      summaryToDisplay: (!isRoundPhase && !isWinPhase) 
        ? (summaryState.current || summaryState.last) 
        : null
    };
  }, [phase, roundState.questionType, answerState.hasAnsweredCorrectly, answerState.hasSubmittedChoice, summaryState]);

  return {
    // Connection
    isConnected,
    
    // Lobby
    lobbyData,
    
    // Phase
    phase,
    phaseData,
    winDetails,
    
    // Round
    roundState,
    
    // Answers
    answerState,
    
    // Summary
    summaryState,
    
    // Score
    score,
    
    // Logs
    logLines,
    
    // Computed
    computed,
    
    // Actions
    actions,
    
    // Utilities
    emit,
    pushLog
  };
}
