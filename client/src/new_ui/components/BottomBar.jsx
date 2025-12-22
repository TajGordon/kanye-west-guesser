import React, { useRef, useEffect } from 'react';
import TimerBar from './TimerBar';

export default function BottomBar({ 
  inputValue, 
  onInputChange, 
  onSubmit, 
  isEnabled, 
  placeholder,
  timerProgress,
  lastResult,
  hasAnsweredCorrectly,
  hasSubmittedNumeric = false,
  submittedNumericValue = null,
  shouldFocus,
  // Multi-entry props
  foundAnswers = [],
  wrongGuesses = [],
  totalAnswers = 0,
  maxGuesses = 15
}) {
  const inputRef = useRef(null);

  // Auto-focus the input when enabled and shouldFocus is true
  useEffect(() => {
    if (isEnabled && shouldFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEnabled, shouldFocus]);

  // Capture any keystrokes when input should be focused
  useEffect(() => {
    if (!isEnabled || !shouldFocus) return;

    const handleGlobalKeyDown = (e) => {
      // Ignore if already focused on input or if modifier keys are pressed
      if (document.activeElement === inputRef.current) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      
      // Ignore special keys
      const ignoredKeys = ['Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 
                          'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
                          'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete',
                          'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
      if (ignoredKeys.includes(e.key)) return;
      
      // Focus the input and let the key be typed
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isEnabled, shouldFocus]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isEnabled && inputValue.trim()) {
      onSubmit();
    }
  };

  // Determine feedback message and color based on last result
  let feedbackMessage = null;
  let feedbackClass = '';
  
  if (hasAnsweredCorrectly) {
    feedbackMessage = '✓ Correct!';
    feedbackClass = 'text-success font-bold';
  } else if (hasSubmittedNumeric) {
    feedbackMessage = `✓ Submitted: ${submittedNumericValue}`;
    feedbackClass = 'text-success font-bold';
  } else if (lastResult) {
    if (lastResult.status === 'incorrect' || lastResult.result === false) {
      feedbackMessage = '✗ Incorrect, try again!';
      feedbackClass = 'text-error font-bold';
    } else if (lastResult.status === 'found') {
      feedbackMessage = `✓ Found: ${lastResult.foundAnswer}`;
      feedbackClass = 'text-success font-bold';
    } else if (lastResult.status === 'not-found') {
      feedbackMessage = '✗ Not a match';
      feedbackClass = 'text-error';
    }
  }

  return (
    <div className="w-full border-t-2 border-black bg-surface flex flex-col">
      {/* Timer bar at top */}
      <TimerBar progress={timerProgress} />
      
      {/* Feedback message */}
      {feedbackMessage && (
        <div className={`text-center py-2 text-lg ${feedbackClass}`}>
          {feedbackMessage}
        </div>
      )}
      
      {/* Input area */}
      <div className="p-4 flex justify-center gap-4">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Type your answer..."}
          disabled={!isEnabled}
          className={`
            flex-1 max-w-[500px] p-4 text-lg border-2 border-black text-center outline-none rounded
            ${isEnabled ? 'bg-white cursor-text focus:border-accent' : 'bg-secondary cursor-not-allowed text-gray-400'}
          `}
        />
        <button
          onClick={onSubmit}
          disabled={!isEnabled || !inputValue.trim()}
          className={`
            px-6 py-4 text-lg font-bold border-2 border-black rounded transition-colors
            ${isEnabled && inputValue.trim() 
              ? 'bg-accent text-white hover:bg-blue-600 cursor-pointer' 
              : 'bg-secondary text-gray-400 cursor-not-allowed'}
          `}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
