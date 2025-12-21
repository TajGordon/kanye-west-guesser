import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

/**
 * Numeric Input Component
 * Used for questions requiring a number answer (year, count, etc.)
 * Supports proximity scoring (closer = more points)
 */
const NumericInput = forwardRef(function NumericInput({
  question = null,
  min = 1900,
  max = 2100,
  step = 1,
  defaultValue = null,
  onSubmit,
  disabled = false,
  hasSubmitted = false,
  submittedValue = null,
  revealResults = false,
  correctAnswer = null,
  placeholder = 'Enter a number...'
}, ref) {
  const inputRef = useRef(null);
  const [value, setValue] = useState(defaultValue ?? '');

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus()
  }));

  // Focus input when enabled
  useEffect(() => {
    if (!disabled && !hasSubmitted && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled, hasSubmitted]);

  // Reset value when question changes
  useEffect(() => {
    setValue(defaultValue ?? '');
  }, [question?.id, defaultValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value === '' || hasSubmitted || disabled) return;
    
    const numericValue = Number(value);
    if (isNaN(numericValue)) return;
    
    onSubmit(numericValue);
  };

  const handleChange = (e) => {
    const rawValue = e.target.value;
    
    // Allow empty string for clearing
    if (rawValue === '' || rawValue === '-') {
      setValue(rawValue);
      return;
    }
    
    // Validate it's a valid number
    const num = Number(rawValue);
    if (!isNaN(num)) {
      setValue(rawValue);
    }
  };

  // Calculate proximity feedback when results revealed
  const getProximityFeedback = () => {
    if (!revealResults || correctAnswer == null || submittedValue == null) return null;
    
    const diff = Math.abs(submittedValue - correctAnswer);
    if (diff === 0) return { message: 'Exact!', className: 'exact' };
    if (diff <= 1) return { message: `Off by ${diff}`, className: 'very-close' };
    if (diff <= 5) return { message: `Off by ${diff}`, className: 'close' };
    if (diff <= 10) return { message: `Off by ${diff}`, className: 'near' };
    return { message: `Off by ${diff}`, className: 'far' };
  };

  const proximity = getProximityFeedback();
  const displayValue = hasSubmitted ? submittedValue : value;

  const formClass = ['numeric-input-form'];
  if (hasSubmitted) formClass.push('submitted');
  if (proximity) formClass.push(`proximity-${proximity.className}`);

  return (
    <div className="numeric-input-container">
      {/* Show bounds hint */}
      <div className="numeric-bounds">
        Range: {min} - {max}
      </div>

      <form className={formClass.join(' ')} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="number"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled || hasSubmitted}
          min={min}
          max={max}
          step={step}
        />
        <button 
          className="secondary-btn" 
          type="submit" 
          disabled={disabled || hasSubmitted || value === ''}
        >
          {hasSubmitted ? 'Submitted' : 'Submit'}
        </button>
      </form>

      {/* Proximity feedback when results revealed */}
      {proximity && (
        <div className={`numeric-feedback ${proximity.className}`}>
          {proximity.message}
          {correctAnswer != null && (
            <span className="correct-answer"> • Correct: {correctAnswer}</span>
          )}
        </div>
      )}
    </div>
  );
});

export default NumericInput;
