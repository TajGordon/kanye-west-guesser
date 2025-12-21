import { forwardRef } from 'react';
import { QUESTION_TYPES, isChoiceBasedQuestion } from '../../questionTypes';
import FreeTextInput from './FreeTextInput';
import ChoiceSelector from './ChoiceSelector';

/**
 * Answer Input Renderer
 * Dispatches to the appropriate input component based on question type
 */
const AnswerInputRenderer = forwardRef(function AnswerInputRenderer({
  questionType = QUESTION_TYPES.FREE_TEXT,
  question = null,
  // Free-text props
  textValue = '',
  onTextChange,
  onTextSubmit,
  hasAnsweredCorrectly = false,
  // Choice props
  selectedChoiceId = null,
  onSelectChoice,
  hasSubmitted = false,
  // Common props
  disabled = false,
  revealResults = false,
  correctChoiceId = null
}, ref) {
  // If no question or not in round, show disabled free-text input
  if (!question) {
    return (
      <div className="answer-bar">
        <FreeTextInput
          value=""
          onChange={() => {}}
          onSubmit={() => {}}
          disabled={true}
          placeholder="Waiting for round to start..."
        />
      </div>
    );
  }

  const isChoiceBased = isChoiceBasedQuestion(questionType);

  if (isChoiceBased) {
    // Choice-based input for MC and T/F questions
    return (
      <div className="answer-bar answer-bar-choices">
        <ChoiceSelector
          choices={question.choices || []}
          selectedChoiceId={selectedChoiceId}
          onSelectChoice={onSelectChoice}
          disabled={disabled}
          hasSubmitted={hasSubmitted}
          revealResults={revealResults}
          correctChoiceId={correctChoiceId}
        />
      </div>
    );
  }

  // Free-text input for text-based questions
  return (
    <div className="answer-bar">
      <FreeTextInput
        ref={ref}
        value={textValue}
        onChange={onTextChange}
        onSubmit={onTextSubmit}
        disabled={disabled}
        hasAnsweredCorrectly={hasAnsweredCorrectly}
      />
    </div>
  );
});

export default AnswerInputRenderer;
