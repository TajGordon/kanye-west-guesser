import React from 'react';
import QuestionDisplay from '../components/QuestionDisplay';

export default function QuestionActiveScreen({ 
  question, 
  questionType, 
  onSelectOption, 
  selectedOptionId,
  hasSubmittedChoice
}) {
  return (
    <QuestionDisplay
      question={question}
      questionType={questionType}
      onSelectOption={onSelectOption}
      selectedOptionId={selectedOptionId}
      hasSubmittedChoice={hasSubmittedChoice}
      showAnswer={false}
    />
  );
}
