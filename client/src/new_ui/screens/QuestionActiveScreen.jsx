import React from 'react';
import QuestionDisplay from '../components/QuestionDisplay';
import { QUESTION_TYPES } from '../../questionTypes';
import OrderedListInput from '../../components/answers/OrderedListInput';

export default function QuestionActiveScreen({ 
  question, 
  questionType, 
  onSelectOption, 
  selectedOptionId,
  hasSubmittedChoice,
  // Multi-entry props
  foundAnswers = [],
  wrongGuesses = [],
  multiEntryComplete = false,
  // Ordered-list props
  onSubmitOrder,
  hasSubmittedOrder = false,
  submittedOrder = null
}) {
  const isMultiEntry = questionType === QUESTION_TYPES.MULTI_ENTRY;
  const isOrderedList = questionType === QUESTION_TYPES.ORDERED_LIST;
  const totalAnswers = question?.totalAnswers || 0;
  const maxGuesses = question?.maxGuesses || 15;
  const guessesUsed = foundAnswers.length + wrongGuesses.length;
  const guessesRemaining = maxGuesses - guessesUsed;
  
  return (
    <div className="question-active-screen">
      <QuestionDisplay
        question={question}
        questionType={questionType}
        onSelectOption={onSelectOption}
        selectedOptionId={selectedOptionId}
        hasSubmittedChoice={hasSubmittedChoice}
        showAnswer={false}
      />
      
      {/* Multi-entry progress display */}
      {isMultiEntry && (foundAnswers.length > 0 || wrongGuesses.length > 0) && (
        <div className="multi-entry-section">
          <div className="multi-entry-status">
            {multiEntryComplete 
              ? (foundAnswers.length >= totalAnswers ? '🎉 You found them all!' : 'Out of guesses!')
              : `${foundAnswers.length}/${totalAnswers} found • ${guessesRemaining} guesses left`
            }
          </div>
          <div className="multi-entry-guesses">
            {foundAnswers.map((answer, i) => (
              <div key={`found-${i}`} className="multi-entry-guess found">
                <span className="guess-icon">✓</span>
                <span className="guess-text">{answer}</span>
              </div>
            ))}
            {wrongGuesses.map((guess, i) => (
              <div key={`wrong-${i}`} className="multi-entry-guess wrong">
                <span className="guess-icon">✗</span>
                <span className="guess-text">{guess}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Ordered-list input */}
      {isOrderedList && question?.items && (
        <div className="ordered-list-section">
          <OrderedListInput
            question={question}
            items={question.items}
            onSubmit={onSubmitOrder}
            disabled={false}
            hasSubmitted={hasSubmittedOrder}
            submittedOrder={submittedOrder}
            revealResults={false}
            correctOrder={null}
          />
        </div>
      )}
    </div>
  );
}
