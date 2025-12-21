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
  const {
    isConnected,
    lobbyData,
    phase,
    roundState,
    answerState,
    summaryState,
    emit,
    resetAnswerState
  } = useGame();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [timerProgress, setTimerProgress] = useState(0);

  // Timer logic
  useEffect(() => {
    let animationFrame;
    const updateTimer = () => {
      if (phase === 'round-active' && roundState.endsAt) {
        const now = Date.now();
        const total = roundState.durationMs;
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
  }, [phase, roundState]);

  // Reset input on new round
  useEffect(() => {
    if (phase === 'round-active') {
      setInputValue('');
    }
  }, [phase, roundState.question?.id]);

  const handleStartGame = () => {
    if (isConnected) {
      emit('startGameRequest');
    }
  };

  const handleUpdateSettings = (newSettings) => {
    if (isConnected) {
      emit('updateLobbySettings', newSettings);
    }
  };

  const handleSubmitAnswer = () => {
    if (!inputValue.trim() || !isConnected) return;
    emit('submitAnswer', { answer: inputValue });
    setInputValue(''); // Clear immediately? Or wait for feedback?
    // For now clear immediately as per typical UX, but maybe keep if retry allowed?
    // The user said "shows all their incorrect guesses", so maybe we keep it or clear it.
    // Usually clear it so they can type again.
  };

  const handleSelectOption = (optionId) => {
    if (answerState.hasSubmittedChoice || !isConnected) return;
    emit('submitAnswer', { answer: optionId });
  };

  const handleReturnToLobby = () => {
    if (isConnected) {
      emit('resetGameRequest');
    }
  };

  // Determine which screen to show
  let MainContent;
  if (phase === 'seating') {
    MainContent = (
      <PregameScreen 
        isHost={lobbyData.isHost} 
        onStartGame={handleStartGame} 
        playerCount={lobbyData.players.length} 
      />
    );
  } else if (phase === 'round-active') {
    MainContent = (
      <QuestionActiveScreen
        question={roundState.question}
        questionType={roundState.questionType}
        onSelectOption={handleSelectOption}
        selectedOptionId={answerState.selectedChoiceId}
      />
    );
  } else if (phase === 'round-summary') {
    MainContent = (
      <QuestionAnswerScreen
        question={summaryState.last?.question || roundState.question}
        questionType={summaryState.last?.questionType || roundState.questionType}
        correctAnswer={summaryState.last?.answer}
        roundResults={summaryState.last?.results} // Need to verify structure
      />
    );
  } else if (phase === 'game-summary') {
    // Win screen
    // Need to find winner from players or winDetails
    const winner = lobbyData.players.reduce((prev, current) => 
      (prev.score > current.score) ? prev : current
    , lobbyData.players[0]);

    MainContent = (
      <WinScreen 
        winner={winner} 
        onReturnToLobby={handleReturnToLobby}
        isHost={lobbyData.isHost}
      />
    );
  } else {
    MainContent = <div>Loading...</div>;
  }

  const isTypingMode = roundState.questionType === QUESTION_TYPES.FREE_TEXT || 
                       roundState.questionType === QUESTION_TYPES.MULTI_ENTRY ||
                       roundState.questionType === QUESTION_TYPES.NUMERIC;

  return (
    <GameLayout
      isSettingsOpen={isSettingsOpen}
      topBar={
        <TopBar 
          lobbyCode={lobbyData.id} 
          onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)} 
          isSettingsOpen={isSettingsOpen}
          phase={phase}
        />
      }
      leftSidebar={
        <SettingsPanel 
          settings={lobbyData.settings} 
          onUpdateSettings={handleUpdateSettings} 
          isHost={lobbyData.isHost} 
        />
      }
      rightSidebar={
        <PlayerList 
          players={lobbyData.players} 
          isTypingMode={isTypingMode} 
        />
      }
      bottomBar={
        <BottomBar 
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSubmit={handleSubmitAnswer}
          isEnabled={phase === 'round-active' && isTypingMode && !answerState.hasAnsweredCorrectly}
          timerProgress={timerProgress}
          placeholder={
            answerState.hasAnsweredCorrectly ? "Correct! Waiting for others..." : 
            "Type your answer..."
          }
        />
      }
    >
      {MainContent}
    </GameLayout>
  );
}
