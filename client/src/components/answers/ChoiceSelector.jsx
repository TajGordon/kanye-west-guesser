import { QUESTION_TYPES, isChoiceBasedQuestion } from '../../questionTypes';

/**
 * Choice Selector Component
 * Used for multiple-choice and true-false questions
 */
export default function ChoiceSelector({
  choices = [],
  selectedChoiceId = null,
  onSelectChoice,
  disabled = false,
  hasSubmitted = false,
  revealResults = false,
  correctChoiceId = null
}) {
  const handleClick = (choiceId) => {
    if (disabled || hasSubmitted) return;
    onSelectChoice(choiceId);
  };

  return (
    <div className="choice-selector">
      {choices.map((choice) => {
        const isSelected = selectedChoiceId === choice.id;
        const isCorrect = revealResults && choice.id === correctChoiceId;
        const isWrong = revealResults && isSelected && choice.id !== correctChoiceId;
        
        const classes = ['choice-option'];
        if (isSelected) classes.push('selected');
        if (hasSubmitted) classes.push('submitted');
        if (isCorrect) classes.push('correct');
        if (isWrong) classes.push('wrong');
        if (disabled) classes.push('disabled');

        return (
          <button
            key={choice.id}
            type="button"
            className={classes.join(' ')}
            onClick={() => handleClick(choice.id)}
            disabled={disabled || hasSubmitted}
            aria-pressed={isSelected}
          >
            <span className="choice-id">{choice.id.toUpperCase()}</span>
            <span className="choice-text">{choice.text}</span>
            {revealResults && isCorrect && <span className="choice-indicator">✓</span>}
            {revealResults && isWrong && <span className="choice-indicator">✗</span>}
          </button>
        );
      })}
    </div>
  );
}
