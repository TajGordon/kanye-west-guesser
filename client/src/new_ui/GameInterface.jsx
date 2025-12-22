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
    answerState = { hasAnsweredCorrectly: false, hasSubmittedChoice: false, selectedChoiceId: null, lastResult: null },
    summaryState = { last: null, current: null },
    emit,
    actions
  } = gameState || {};

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [timerProgress, setTimerProgress] = useState(0);

  // Timer logic - calculates progress from 1.0 down to 0.0
  useEffect(() => {
    let animationFrame;
    const updateTimer = () => {
      if (phase === 'round' && roundState?.endsAt) {
        const now = Date.now();
        const total = roundState.durationMs || 20000;
        const remaining = roundState.endsAt - now;
        const progress = Math.max(0, Math.min(1, remaining / total));
        setTimerProgress(progress);
        if (remaining > 0) {
          animationFrame = requestAnimationFrame(updateTimer);
        }
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
    if (isConnected && emit) {
      emit('startGameRequest');
    } else if (actions?.requestStartGame) {
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
    const trimmedValue = (inputValue || '').trim();
    if (!trimmedValue) {
      console.log('[GameInterface] handleSubmitAnswer: empty input, skipping');
      return;
    }
    
    console.log('[GameInterface] handleSubmitAnswer: questionType =', questionType, 
      'isNumeric =', isNumeric, 'isMultiEntry =', isMultiEntry, 'value =', trimmedValue);
    
    // For numeric questions, send numericValue
    if (isNumeric) {
      const numVal = parseFloat(trimmedValue);
      if (!isNaN(numVal) && emit) {
        console.log('[GameInterface] submitting numeric:', numVal);
        emit('submitAnswer', { numericValue: numVal });
      } else {
        console.log('[GameInterface] invalid numeric value:', trimmedValue);
      }
    } else if (isMultiEntry) {
      // Multi-entry uses 'guess' field on server
      if (emit) {
        console.log('[GameInterface] submitting multi-entry guess:', trimmedValue);
        emit('submitAnswer', { guess: trimmedValue });
      }
    } else if (emit) {
      console.log('[GameInterface] submitting free-text answer:', trimmedValue);
      emit('submitAnswer', { answer: trimmedValue });
    } else if (actions?.submitTextAnswer) {
      actions.submitTextAnswer(trimmedValue);
    }
    setInputValue('');
  };

  const handleSelectOption = (optionId) => {
    if (answerState?.hasSubmittedChoice) return;
    if (emit) {
      emit('submitAnswer', { choiceId: optionId });
    } else if (actions?.submitChoice) {
      actions.submitChoice(optionId);
    }
  };

  const handleSubmitOrder = (orderedIds) => {
    if (answerState?.hasSubmittedOrder) return;
    if (emit) {
      emit('submitAnswer', { orderedIds });
    }
  };

  const handleReturnToLobby = () => {
    if (emit) {
      emit('resetGameRequest');
    } else if (actions?.requestResetGame) {
      actions.requestResetGame();
    }
  };

  const handleLeaveLobby = () => {
    if (emit) {
      emit('leaveLobby');
      // Redirect to home/join page by clearing lobby state
      window.location.href = '/';
    }
  };

  // Get summary data
  const currentSummary = summaryState?.current || summaryState?.last;
  
  // Determine question type and if it's a typing mode
  const questionType = roundState?.questionType || QUESTION_TYPES.FREE_TEXT;
  const isNumeric = questionType === QUESTION_TYPES.NUMERIC;
  const isMultiEntry = questionType === QUESTION_TYPES.MULTI_ENTRY;
  const isTypingMode = [QUESTION_TYPES.FREE_TEXT, QUESTION_TYPES.MULTI_ENTRY, QUESTION_TYPES.NUMERIC]
    .includes(questionType);
  
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
        questionType={questionType}
        onSelectOption={handleSelectOption}
        selectedOptionId={answerState?.selectedChoiceId}
        hasSubmittedChoice={answerState?.hasSubmittedChoice}
        // Multi-entry props
        foundAnswers={answerState?.foundAnswers || []}
        wrongGuesses={answerState?.wrongGuesses || []}
        multiEntryComplete={answerState?.multiEntryComplete || answerState?.hasAnsweredCorrectly}
        // Ordered-list props
        onSubmitOrder={handleSubmitOrder}
        hasSubmittedOrder={answerState?.hasSubmittedOrder || false}
        submittedOrder={answerState?.submittedOrder}
      />
    );
  } else if (phase === 'summary') {
    // Use the summary's question (which includes correct answers) or fall back to roundState
    const summaryQuestion = currentSummary?.question || roundState?.question;
    const summaryQuestionType = currentSummary?.questionType || questionType;
    
    MainContent = (
      <QuestionAnswerScreen
        question={summaryQuestion}
        questionType={summaryQuestionType}
        correctAnswer={currentSummary?.correctAnswer}
        correctChoiceId={summaryQuestion?.correctChoiceId}
        selectedOptionId={answerState?.selectedChoiceId}
        roundSummary={currentSummary}
        players={lobbyData?.players || []}
      />
    );
  } else if (phase === 'win') {
    const players = lobbyData?.players || [];
    const winner = players.length > 0 
      ? players.reduce((prev, current) => ((prev.score || 0) > (current.score || 0)) ? prev : current, players[0])
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

  return (
    <GameLayout
      isSettingsOpen={isSettingsOpen}
      topBar={
        <TopBar 
          lobbyCode={lobbyData?.id || '—'} 
          onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)} 
          isSettingsOpen={isSettingsOpen}
          phase={phase}
          onLeaveLobby={handleLeaveLobby}
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
          phase={phase}
          correctResponders={currentSummary?.correctResponders || []}
        />
      }
      bottomBar={
        <BottomBar 
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSubmit={handleSubmitAnswer}
          isEnabled={
            phase === 'round' && 
            isTypingMode && 
            !answerState?.hasAnsweredCorrectly && 
            !answerState?.multiEntryComplete &&
            !answerState?.hasSubmittedNumeric
          }
          timerProgress={timerProgress}
          lastResult={answerState?.lastResult}
          hasAnsweredCorrectly={answerState?.hasAnsweredCorrectly}
          hasSubmittedNumeric={answerState?.hasSubmittedNumeric}
          submittedNumericValue={answerState?.submittedNumericValue}
          shouldFocus={phase === 'round' && isTypingMode && !answerState?.hasSubmittedNumeric}
          placeholder={
            answerState?.hasAnsweredCorrectly ? "Correct! Waiting for others..." : 
            answerState?.hasSubmittedNumeric ? `Submitted: ${answerState?.submittedNumericValue}` :
            answerState?.multiEntryComplete ? "Out of guesses!" :
            isNumeric ? "Enter a number..." :
            isMultiEntry ? "Guess a name..." :
            "Type your answer..."
          }
          // Multi-entry props
          foundAnswers={answerState?.foundAnswers || []}
          wrongGuesses={answerState?.wrongGuesses || []}
          totalAnswers={roundState?.question?.totalAnswers || 0}
          maxGuesses={roundState?.question?.maxGuesses || 15}
        />
      }
    >
      {MainContent}
    </GameLayout>
  );
}
