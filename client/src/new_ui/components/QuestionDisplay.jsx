import React from 'react';
import { QUESTION_TYPES } from '../../questionTypes';

export default function QuestionDisplay({ 
  question, 
  questionType, 
  onSelectOption, 
  selectedOptionId, 
  showAnswer, 
  correctAnswer 
}) {
  // Handle null/undefined question
  if (!question) {
    return (
      <div className="w-full max-w-[800px] p-8 text-center">
        <div className="text-2xl text-gray-400">Loading question...</div>
      </div>
    );
  }

  const getOptionClasses = (optionId) => {
    let baseClasses = "p-6 border-2 cursor-pointer text-lg font-bold transition-all duration-200";
    
    if (showAnswer) {
      if (optionId === correctAnswer) {
        return `${baseClasses} bg-success text-white border-success cursor-default`;
      } else if (optionId === selectedOptionId) {
        return `${baseClasses} bg-error text-white border-error cursor-default`;
      }
      return `${baseClasses} bg-surface text-black border-black cursor-default`;
    } else {
      if (optionId === selectedOptionId) {
        return `${baseClasses} bg-accent text-white border-accent`;
      }
      return `${baseClasses} bg-surface text-black border-black hover:bg-highlight`;
    }
  };

  const isChoiceBased = [QUESTION_TYPES.MULTIPLE_CHOICE, QUESTION_TYPES.TRUE_FALSE].includes(questionType);
  
  // Get question text - server sends 'title' or 'prompt', UI expects 'text'
  const questionText = question.text || question.title || question.prompt || '';
  
  // Get options - server sends 'choices', UI expects 'options'
  const options = question.options || question.choices || [];
  
  // Get image URL - handle different content structures
  const imageUrl = question.imageUrl || (question.content?.type === 'image' ? question.content.url : null);

  return (
    <div className="w-full max-w-[800px] p-8 text-center">
      {imageUrl && (
        <img src={imageUrl} alt="Question" className="max-w-full max-h-[400px] mb-6 border border-black mx-auto" />
      )}
      
      <div className="text-2xl font-bold mb-8">
        {questionText}
      </div>

      {isChoiceBased && options.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4 mt-6">
          {options.map(option => (
            <button
              key={option.id}
              className={getOptionClasses(option.id)}
              onClick={() => !showAnswer && onSelectOption && onSelectOption(option.id)}
              disabled={showAnswer}
            >
              {option.text}
            </button>
          ))}
        </div>
      )}
      
      {showAnswer && !isChoiceBased && (
        <div className="mt-8">
          <h3 className="text-gray-500">Correct Answer:</h3>
          <div className="text-xl text-success font-bold">
            {correctAnswer}
          </div>
        </div>
      )}
    </div>
  );
}
