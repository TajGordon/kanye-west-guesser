import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

/**
 * Multi-Entry Input Component
 * Wordle-style input where users enter multiple answers one at a time
 * Shows ✓ for found answers, ✗ for wrong guesses
 */
const MultiEntryInput = forwardRef(function MultiEntryInput({
  question = null,
  foundAnswers = [],           // Array of correctly found answers
  wrongGuesses = [],           // Array of incorrect guesses
  totalAnswers = 0,            // Total number of answers to find
  maxGuesses = 15,             // Maximum allowed guesses
  onSubmitGuess,               // Callback when user submits a guess
  disabled = false,
  isComplete = false           // True when all answers found or max guesses reached
}, ref) {
  const inputRef = useRef(null);
  const [currentGuess, setCurrentGuess] = useState('');

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus()
  }));

  // Focus input when enabled and not complete
  useEffect(() => {
    if (!disabled && !isComplete && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled, isComplete]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!currentGuess.trim() || isComplete || disabled) return;
    
    onSubmitGuess(currentGuess.trim());
    setCurrentGuess('');
  };

  const guessesUsed = foundAnswers.length + wrongGuesses.length;
  const guessesRemaining = maxGuesses - guessesUsed;
  const allFound = foundAnswers.length >= totalAnswers;

  // Get status message
  const getStatusMessage = () => {
    if (allFound) return '🎉 You found them all!';
    if (guessesRemaining <= 0) return 'Out of guesses!';
    return `${foundAnswers.length}/${totalAnswers} found • ${guessesRemaining} guesses left`;
  };

  // Get placeholder text
  const getPlaceholder = () => {
    if (allFound) return 'All answers found!';
    if (guessesRemaining <= 0) return 'No guesses remaining';
    if (disabled) return 'Waiting...';
    return 'Type an answer and press Enter...';
  };

  const formClass = ['multi-entry-form'];
  if (allFound) formClass.push('complete');
  if (guessesRemaining <= 0 && !allFound) formClass.push('failed');

  return (
    <div className="multi-entry-container">
      {/* Status bar */}
      <div className="multi-entry-status">
        {getStatusMessage()}
      </div>

      {/* List of guesses */}
      <div className="multi-entry-guesses">
        {/* Show found answers */}
        {foundAnswers.map((answer, i) => (
          <div key={`found-${i}`} className="multi-entry-guess found">
            <span className="guess-icon">✓</span>
            <span className="guess-text">{answer}</span>
          </div>
        ))}
        
        {/* Show wrong guesses */}
        {wrongGuesses.map((guess, i) => (
          <div key={`wrong-${i}`} className="multi-entry-guess wrong">
            <span className="guess-icon">✗</span>
            <span className="guess-text">{guess}</span>
          </div>
        ))}
      </div>

      {/* Input form */}
      <form className={formClass.join(' ')} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={currentGuess}
          onChange={(e) => setCurrentGuess(e.target.value)}
          placeholder={getPlaceholder()}
          disabled={disabled || isComplete}
        />
        <button 
          className="secondary-btn" 
          type="submit" 
          disabled={disabled || isComplete || !currentGuess.trim()}
        >
          Guess
        </button>
      </form>
    </div>
  );
});

export default MultiEntryInput;
