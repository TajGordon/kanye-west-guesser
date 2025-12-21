import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

/**
 * Free Text Input Component
 * Used for free-text questions where users type their answer
 */
const FreeTextInput = forwardRef(function FreeTextInput({
  value = '',
  onChange,
  onSubmit,
  disabled = false,
  hasAnsweredCorrectly = false,
  placeholder = 'Type your guess...'
}, ref) {
  const inputRef = useRef(null);

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus()
  }));

  // Focus input when enabled
  useEffect(() => {
    if (!disabled && !hasAnsweredCorrectly && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled, hasAnsweredCorrectly]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() || hasAnsweredCorrectly || disabled) return;
    onSubmit(value.trim());
  };

  const displayValue = hasAnsweredCorrectly ? 'You got the answer correct!' : value;
  const displayPlaceholder = hasAnsweredCorrectly 
    ? 'You got the answer correct!' 
    : (disabled ? 'Waiting...' : placeholder);

  const formClass = ['answer-bar-form'];
  if (hasAnsweredCorrectly) formClass.push('answered');

  return (
    <form className={formClass.join(' ')} onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={displayPlaceholder}
        disabled={disabled || hasAnsweredCorrectly}
      />
      <button 
        className="secondary-btn" 
        type="submit" 
        disabled={disabled || hasAnsweredCorrectly || !value.trim()}
      >
        Submit
      </button>
    </form>
  );
});

export default FreeTextInput;
