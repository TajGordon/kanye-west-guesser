import React from 'react';
import { theme } from '../theme';
import { QUESTION_TYPES } from '../../questionTypes';

export default function QuestionDisplay({ 
  question, 
  questionType, 
  onSelectOption, 
  selectedOptionId, 
  showAnswer, 
  correctAnswer 
}) {
  const containerStyle = {
    maxWidth: '800px',
    width: '100%',
    padding: theme.spacing.xl,
    textAlign: 'center',
  };

  const textStyle = {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xl,
  };

  const imageStyle = {
    maxWidth: '100%',
    maxHeight: '400px',
    marginBottom: theme.spacing.lg,
    border: theme.borders.thin,
  };

  const optionsContainerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  };

  const getOptionStyle = (optionId) => {
    let backgroundColor = theme.colors.surface;
    let color = theme.colors.text;
    let borderColor = theme.colors.border;

    if (showAnswer) {
      if (optionId === correctAnswer) {
        backgroundColor = theme.colors.success;
        color = '#fff';
        borderColor = theme.colors.success;
      } else if (optionId === selectedOptionId) {
        backgroundColor = theme.colors.error;
        color = '#fff';
        borderColor = theme.colors.error;
      }
    } else {
      if (optionId === selectedOptionId) {
        backgroundColor = theme.colors.accent;
        color = '#fff';
        borderColor = theme.colors.accent;
      }
    }

    return {
      padding: theme.spacing.lg,
      border: `2px solid ${borderColor}`,
      backgroundColor,
      color,
      cursor: showAnswer ? 'default' : 'pointer',
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      transition: 'all 0.2s ease',
    };
  };

  const isChoiceBased = [QUESTION_TYPES.MULTIPLE_CHOICE, QUESTION_TYPES.TRUE_FALSE].includes(questionType);

  return (
    <div style={containerStyle}>
      {question.imageUrl && (
        <img src={question.imageUrl} alt="Question" style={imageStyle} />
      )}
      
      <div style={textStyle}>
        {question.text}
      </div>

      {isChoiceBased && question.options && (
        <div style={optionsContainerStyle}>
          {question.options.map(option => (
            <button
              key={option.id}
              style={getOptionStyle(option.id)}
              onClick={() => !showAnswer && onSelectOption && onSelectOption(option.id)}
              disabled={showAnswer}
            >
              {option.text}
            </button>
          ))}
        </div>
      )}
      
      {showAnswer && !isChoiceBased && (
        <div style={{ marginTop: theme.spacing.xl }}>
          <h3 style={{ color: theme.colors.secondary }}>Correct Answer:</h3>
          <div style={{ fontSize: theme.typography.fontSize.xl, color: theme.colors.success, fontWeight: 'bold' }}>
            {correctAnswer}
          </div>
        </div>
      )}
    </div>
  );
}
