import React, { useState, useEffect } from 'react';
import { useGame } from './context/GameContext';
import GameLayout from './layouts/GameLayout';
import TopBar from './components/TopBar';
import BottomBar from './components/BottomBar';
import PlayerList from './components/PlayerList';
import SettingsPanel from './components/SettingsPanel';
import PregameScreen from './screens/PregameScreen';
import QuestionActiveScreen from './screens/QuestionActiveScreen';
import QuestionAnswerScreen from './screens/QuestionAnswerScreen';
import WinScreen from './screens/WinScreen';
import { QUESTION_TYPES } from '../questionTypes';

export default function GameInterface() {
  const gameState = useGame();
  
  // Destructure with defaults for safety
  const {
    isConnected = false,
    lobbyData = { id: '—', isHost: false, players: [], settings: {} },
    phase = 'seating',
    roundState = { question: null, questionType: QUESTION_TYPES.FREE_TEXT },
    answerState = { hasAnsweredCorrectly: false, hasSubmittedChoice: false, selectedChoiceId: null },
    summaryState = { last: null },
    emit,
    actions
  } = gameState || {};

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [timerProgress, setTimerProgress] = useState(0);

  // Timer logic
  useEffect(() => {
    let animationFrame;
    const updateTimer = () => {
      if (phase === 'round' && roundState?.endsAt) {
        const now = Date.now();
        const total = roundState.durationMs || 20000;
        const remaining = roundState.endsAt - now;
        const progress = Math.max(0, Math.min(1, remaining / total));
        setTimerProgress(progress);
        animationFrame = requestAnimationFrame(updateTimer);
      } else {
        setTimerProgress(0);
      }
    };
    updateTimer();
    return () => cancelAnimationFrame(animationFrame);
  }, [phase, roundState?.endsAt, roundState?.durationMs]);

  // Reset input on new round
  useEffect(() => {
    if (phase === 'round') {
      setInputValue('');
    }
  }, [phase, roundState?.question?.id]);

  const handleStartGame = () => {
    console.log('[GameInterface] handleStartGame called, isConnected:', isConnected);
    if (isConnected && emit) {
      console.log('[GameInterface] Emitting startGameRequest');
      emit('startGameRequest');
    } else if (actions?.requestStartGame) {
      console.log('[GameInterface] Using actions.requestStartGame');
      actions.requestStartGame();
    }
  };

  const handleUpdateSettings = (newSettings) => {
    if (isConnected && emit) {
      emit('updateLobbySettings', newSettings);
    } else if (actions?.updateSettings) {
      actions.updateSettings(newSettings);
    }
  };

  const handleSubmitAnswer = () => {
    if (!inputValue.trim()) return;
    console.log('[GameInterface] Submitting answer:', inputValue);
    if (emit) {
      emit('submitAnswer', { answer: inputValue });
    } else if (actions?.submitTextAnswer) {
      actions.submitTextAnswer(inputValue);
    }
    setInputValue('');
  };

  const handleSelectOption = (optionId) => {
    if (answerState?.hasSubmittedChoice) return;
    console.log('[GameInterface] Selecting option:', optionId);
    if (emit) {
      emit('submitAnswer', { choiceId: optionId });
    } else if (actions?.submitChoice) {
      actions.submitChoice(optionId);
    }
  };

  const handleReturnToLobby = () => {
    if (emit) {
      emit('resetGameRequest');
    } else if (actions?.requestResetGame) {
      actions.requestResetGame();
    }
  };

  // Determine which screen to show
  let MainContent;
  
  if (!isConnected) {
    MainContent = (
      <div className="text-center p-8">
        <div className="text-2xl text-gray-400 mb-4">Connecting to server...</div>
        <div className="text-sm text-gray-500">Please wait</div>
      </div>
    );
  } else if (phase === 'seating') {
    MainContent = (
      <PregameScreen 
        isHost={lobbyData?.isHost || false} 
        onStartGame={handleStartGame} 
        playerCount={lobbyData?.players?.length || 0} 
      />
    );
  } else if (phase === 'round') {
    MainContent = (
      <QuestionActiveScreen
        question={roundState?.question}
        questionType={roundState?.questionType || QUESTION_TYPES.FREE_TEXT}
        onSelectOption={handleSelectOption}
        selectedOptionId={answerState?.selectedChoiceId}
      />
    );
  } else if (phase === 'summary') {
    MainContent = (
      <QuestionAnswerScreen
        question={summaryState?.last?.question || roundState?.question}
        questionType={summaryState?.last?.questionType || roundState?.questionType}
        correctAnswer={summaryState?.last?.answer || summaryState?.last?.primaryAnswer}
        roundResults={summaryState?.last?.results}
      />
    );
  } else if (phase === 'win') {
    const players = lobbyData?.players || [];
    const winner = players.length > 0 
      ? players.reduce((prev, current) => (prev.score > current.score) ? prev : current, players[0])
      : null;

    MainContent = (
      <WinScreen 
        winner={winner} 
        onReturnToLobby={handleReturnToLobby}
        isHost={lobbyData?.isHost || false}
      />
    );
  } else {
    MainContent = (
      <div className="text-center p-8">
        <div className="text-2xl text-gray-400">Loading...</div>
        <div className="text-sm text-gray-500 mt-2">Phase: {phase}</div>
      </div>
    );
  }

  const isTypingMode = [QUESTION_TYPES.FREE_TEXT, QUESTION_TYPES.MULTI_ENTRY, QUESTION_TYPES.NUMERIC]
    .includes(roundState?.questionType);

  return (
    <GameLayout
      isSettingsOpen={isSettingsOpen}
      topBar={
        <TopBar 
          lobbyCode={lobbyData?.id || '—'} 
          onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)} 
          isSettingsOpen={isSettingsOpen}
          phase={phase}
        />
      }
      leftSidebar={
        <SettingsPanel 
          settings={lobbyData?.settings || {}} 
          onUpdateSettings={handleUpdateSettings} 
          isHost={lobbyData?.isHost || false} 
        />
      }
      rightSidebar={
        <PlayerList 
          players={lobbyData?.players || []} 
          isTypingMode={isTypingMode} 
        />
      }
      bottomBar={
        <BottomBar 
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSubmit={handleSubmitAnswer}
          isEnabled={phase === 'round' && isTypingMode && !answerState?.hasAnsweredCorrectly}
          timerProgress={timerProgress}
          placeholder={
            answerState?.hasAnsweredCorrectly ? "Correct! Waiting for others..." : 
            "Type your answer..."
          }
        />
      }
    >
      {MainContent}
    </GameLayout>
  );
}
