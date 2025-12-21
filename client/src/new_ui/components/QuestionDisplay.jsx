import React from 'react';
import { QUESTION_TYPES } from '../../questionTypes';

export default function QuestionDisplay({ 
  question, 
  questionType, 
  onSelectOption, 
  selectedOptionId, 
  showAnswer, 
  correctAnswer,
  correctChoiceId,
  hasSubmittedChoice
}) {
  // Handle null/undefined question
  if (!question) {
    return (
      <div className="w-full max-w-[800px] p-8 text-center">
        <div className="text-2xl text-gray-400">Loading question...</div>
      </div>
    );
  }

  const isChoiceBased = [QUESTION_TYPES.MULTIPLE_CHOICE, QUESTION_TYPES.TRUE_FALSE].includes(questionType);
  
  // Get question title - server sends 'title' 
  const questionTitle = question.title || question.text || question.prompt || '';
  
  // Get question body from content object
  // Content can be: { type: 'text', text: '...' } or { type: 'image', url: '...' } or { type: 'audio', url: '...' }
  const content = question.content;
  const contentText = content?.type === 'text' ? content.text : null;
  const imageUrl = content?.type === 'image' ? content.url : (question.imageUrl || null);
  const audioUrl = content?.type === 'audio' ? content.url : null;
  
  // Get options - server sends 'choices'
  const options = question.choices || question.options || [];
  
  // Determine correct choice ID for reveal
  const revealCorrectId = correctChoiceId || question.correctChoiceId || 
    options.find(o => o.correct)?.id;

  const getOptionClasses = (optionId, optionData) => {
    let baseClasses = "p-6 border-2 text-lg font-bold transition-all duration-200 rounded";
    
    const isCorrectOption = optionId === revealCorrectId || optionData?.correct === true;
    
    if (showAnswer) {
      // Reveal mode - show correct/incorrect
      if (isCorrectOption) {
        return `${baseClasses} bg-success text-white border-success cursor-default`;
      } else if (optionId === selectedOptionId) {
        // User selected this wrong answer
        return `${baseClasses} bg-error text-white border-error cursor-default`;
      }
      return `${baseClasses} bg-surface text-black border-black opacity-60 cursor-default`;
    } else {
      // Active round mode
      if (optionId === selectedOptionId) {
        return `${baseClasses} bg-accent text-white border-accent cursor-default`;
      }
      if (hasSubmittedChoice) {
        // Already submitted, can't change
        return `${baseClasses} bg-surface text-black border-black cursor-default opacity-60`;
      }
      return `${baseClasses} bg-surface text-black border-black hover:bg-highlight cursor-pointer`;
    }
  };

  return (
    <div className="w-full max-w-[800px] p-8 text-center mx-auto">
      {/* Question Title/Header */}
      <h2 className="text-2xl font-bold mb-4 text-black">
        {questionTitle}
      </h2>

      {/* Question Content Body */}
      {contentText && (
        <div className="text-xl mb-6 p-4 bg-secondary rounded border border-black">
          {contentText}
        </div>
      )}

      {/* Image content */}
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt="Question" 
          className="max-w-full max-h-[400px] mb-6 border border-black mx-auto rounded" 
        />
      )}

      {/* Audio content */}
      {audioUrl && (
        <div className="mb-6">
          <audio controls src={audioUrl} className="w-full max-w-[400px] mx-auto">
            Your browser does not support audio.
          </audio>
        </div>
      )}

      {/* Multiple Choice Options */}
      {isChoiceBased && options.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {options.map(option => (
            <button
              key={option.id}
              className={getOptionClasses(option.id, option)}
              onClick={() => !showAnswer && !hasSubmittedChoice && onSelectOption && onSelectOption(option.id)}
              disabled={showAnswer || hasSubmittedChoice}
            >
              {option.text}
            </button>
          ))}
        </div>
      )}
      
      {/* Show correct answer for non-choice-based questions on reveal */}
      {showAnswer && !isChoiceBased && (
        <div className="mt-8 p-6 bg-secondary rounded border border-black">
          <h3 className="text-lg text-gray-600 mb-2">Correct Answer:</h3>
          <div className="text-2xl text-success font-bold">
            {correctAnswer || question.primaryAnswer || 'Unknown'}
          </div>
          {/* Show all accepted answers if available */}
          {question.answers && question.answers.length > 1 && (
            <div className="mt-2 text-sm text-gray-500">
              Also accepted: {question.answers.slice(1).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
