import { forwardRef } from 'react';
import { 
  QUESTION_TYPES, 
  isChoiceBasedQuestion, 
  isMultiEntryQuestion,
  isOrderedListQuestion,
  getInputType
} from '../../questionTypes';
import FreeTextInput from './FreeTextInput';
import ChoiceSelector from './ChoiceSelector';
import MultiEntryInput from './MultiEntryInput';
import NumericInput from './NumericInput';
import OrderedListInput from './OrderedListInput';

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
  
  // Multi-entry props
  foundAnswers = [],
  wrongGuesses = [],
  onSubmitGuess,
  
  // Numeric/slider props
  numericValue = null,
  onNumericSubmit,
  submittedValue = null,
  
  // Ordered list props
  orderedItems = null,
  onOrderSubmit,
  submittedOrder = null,
  
  // Common props
  disabled = false,
  revealResults = false,
  correctChoiceId = null,
  correctAnswer = null,
  correctOrder = null
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

  const inputType = getInputType(questionType);

  // Multi-entry input (Wordle-style)
  if (isMultiEntryQuestion(questionType)) {
    // Use question.totalAnswers (answers array not sent to client for security)
    const totalAnswers = question.totalAnswers || 0;
    const maxGuesses = question.maxGuesses || 15;
    const isComplete = foundAnswers.length >= totalAnswers || 
                       (foundAnswers.length + wrongGuesses.length) >= maxGuesses;
    
    return (
      <div className="answer-bar answer-bar-multi-entry">
        <MultiEntryInput
          ref={ref}
          question={question}
          foundAnswers={foundAnswers}
          wrongGuesses={wrongGuesses}
          totalAnswers={totalAnswers}
          maxGuesses={maxGuesses}
          onSubmitGuess={onSubmitGuess}
          disabled={disabled}
          isComplete={isComplete || revealResults}
        />
      </div>
    );
  }

  // Numeric input (year guessing, etc.)
  if (questionType === QUESTION_TYPES.NUMERIC) {
    return (
      <div className="answer-bar answer-bar-numeric">
        <NumericInput
          ref={ref}
          question={question}
          min={question.min ?? 1900}
          max={question.max ?? 2100}
          step={question.step ?? 1}
          onSubmit={onNumericSubmit}
          disabled={disabled}
          hasSubmitted={hasSubmitted}
          submittedValue={submittedValue}
          revealResults={revealResults}
          correctAnswer={correctAnswer}
        />
      </div>
    );
  }

  // Ordered list input
  if (isOrderedListQuestion(questionType)) {
    const items = orderedItems || question.items || [];
    
    return (
      <div className="answer-bar answer-bar-ordered">
        <OrderedListInput
          ref={ref}
          question={question}
          items={items}
          onSubmit={onOrderSubmit}
          disabled={disabled}
          hasSubmitted={hasSubmitted}
          submittedOrder={submittedOrder}
          revealResults={revealResults}
          correctOrder={correctOrder || question.correctOrder}
        />
      </div>
    );
  }

  // Choice-based input for MC and T/F questions
  if (isChoiceBasedQuestion(questionType)) {
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

  // Free-text input for text-based questions (default)
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
