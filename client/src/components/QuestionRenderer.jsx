import { QUESTION_TYPES, isChoiceBasedQuestion } from '../questionTypes';

/**
 * Renders question content based on type
 * Handles image, text, and other content blocks
 */
function QuestionContentBlock({ content }) {
  if (!content) return null;
  
  if (content.type === 'image' && content.url) {
    const style = {};
    const display = content.display || {};
    
    if (display.maxWidth) {
      style.maxWidth = typeof display.maxWidth === 'number'
        ? `${display.maxWidth}px`
        : display.maxWidth;
    }
    if (content.width && !style.maxWidth) {
      style.maxWidth = `${content.width}px`;
    }
    
    const aspectValue = display.aspectRatio || content.aspectRatio;
    if (aspectValue && typeof aspectValue === 'number') {
      style.aspectRatio = aspectValue;
    }
    
    return (
      <div className="question-content-block question-content-image" style={style}>
        <img src={content.url} alt={content.alt || 'Question media'} />
      </div>
    );
  }

  if (content.type === 'text' && content.text) {
    return (
      <div className="question-content-block question-content-text">
        <p>{content.text}</p>
      </div>
    );
  }

  if (content.type === 'audio' && content.url) {
    return (
      <div className="question-content-block question-content-audio">
        <audio controls src={content.url}>
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  }

  return null;
}

/**
 * QuestionRenderer Component
 * 
 * Displays questions based on their type with appropriate formatting.
 * Handles free-text, multiple-choice, and true-false questions.
 */
export default function QuestionRenderer({
  question,
  questionType = QUESTION_TYPES.FREE_TEXT,
  showPrompt = true,
  className = ''
}) {
  if (!question) {
    return (
      <div className={`question-renderer question-renderer-empty ${className}`.trim()}>
        <p className="question-prompt">Waiting for question...</p>
      </div>
    );
  }

  const title = question.title || question.prompt;
  const content = question.content;
  const type = questionType || question.type || QUESTION_TYPES.FREE_TEXT;
  const isChoice = isChoiceBasedQuestion(type);

  return (
    <div className={`question-renderer question-type-${type} ${className}`.trim()}>
      {showPrompt && title && (
        <p className="question-prompt">{title}</p>
      )}
      
      {content && <QuestionContentBlock content={content} />}
      
      {/* Type-specific hints */}
      {type === QUESTION_TYPES.FREE_TEXT && (
        <div className="question-type-hint">
          <span className="hint-badge">Type your answer</span>
        </div>
      )}
      
      {type === QUESTION_TYPES.MULTIPLE_CHOICE && (
        <div className="question-type-hint">
          <span className="hint-badge">Select one answer</span>
        </div>
      )}
      
      {type === QUESTION_TYPES.TRUE_FALSE && (
        <div className="question-type-hint">
          <span className="hint-badge">True or False?</span>
        </div>
      )}
    </div>
  );
}

/**
 * Minimal question display for summary mode
 */
export function QuestionSummaryHeader({ question, questionType, correctAnswer }) {
  const title = question?.title || question?.prompt;
  const type = questionType || question?.type || QUESTION_TYPES.FREE_TEXT;
  
  return (
    <div className="question-summary-header">
      {title && <p className="question-prompt">{title}</p>}
      
      {question?.content && (
        <QuestionContentBlock content={question.content} />
      )}
      
      {correctAnswer && (
        <div className="correct-answer-reveal">
          <span className="reveal-label">Correct answer:</span>
          <span className="reveal-value">{correctAnswer}</span>
        </div>
      )}
    </div>
  );
}

export { QuestionContentBlock };
