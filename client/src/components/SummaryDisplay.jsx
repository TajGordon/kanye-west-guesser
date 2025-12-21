import { useMemo } from 'react';
import { QUESTION_TYPES, isChoiceBasedQuestion } from '../questionTypes';
import { QuestionSummaryHeader } from './QuestionRenderer';

/**
 * Format elapsed time as seconds
 */
function formatElapsedSeconds(ms) {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return null;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format a compact list of names with overflow
 */
function formatCompactNameList(names, limit = 2) {
  if (!names?.length) return '';
  const visible = names.slice(0, limit);
  const remaining = names.length - visible.length;
  const base = visible.join(', ');
  return remaining > 0 ? `${base} +${remaining} more` : base;
}

/**
 * Display choice distribution bar chart for MC/TF questions
 */
function ChoiceDistributionChart({ distribution, totalPlayers }) {
  if (!distribution?.length) return null;

  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  return (
    <div className="choice-distribution">
      <div className="distribution-header">
        <span>Answer distribution</span>
        <span>{totalPlayers} {totalPlayers === 1 ? 'player' : 'players'}</span>
      </div>
      <div className="distribution-bars">
        {distribution.map((choice) => {
          const percentage = totalPlayers > 0 ? Math.round((choice.count / totalPlayers) * 100) : 0;
          const barWidth = totalPlayers > 0 ? Math.max((choice.count / totalPlayers) * 100, 0) : 0;
          
          return (
            <div 
              key={choice.choiceId} 
              className={`distribution-row ${choice.correct ? 'correct' : ''}`}
            >
              <div className="distribution-label">
                <span className="choice-letter">{choice.choiceId.toUpperCase()}</span>
                <span className="choice-text">{choice.text}</span>
                {choice.correct && <span className="correct-badge">✓</span>}
              </div>
              <div className="distribution-bar-container">
                <div 
                  className="distribution-bar-fill"
                  style={{ width: `${barWidth}%` }}
                />
                <span className="distribution-count">
                  {choice.count} ({percentage}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Display list of correct responders with timing
 */
function CorrectRespondersList({ responders }) {
  if (!responders?.length) {
    return (
      <div className="no-correct-answers">
        <p>No correct answers this round.</p>
      </div>
    );
  }

  return (
    <div className="summary-correct-card">
      <div className="summary-correct-header">
        <span>Correct answers</span>
        <span>{responders.length}</span>
      </div>
      <ul className="summary-correct-list">
        {responders.map((entry) => {
          const key = entry.playerId || `${entry.name}-${entry.submittedAt}`;
          const rawAnswer = entry.answerText?.trim() || '';
          const canonicalAnswer = entry.matchedAnswerDisplay?.trim() || '';
          const normalizedRaw = rawAnswer.toLowerCase();
          const normalizedCanonical = canonicalAnswer.toLowerCase();
          const showAlias = canonicalAnswer && normalizedRaw !== normalizedCanonical;
          const elapsedLabel = formatElapsedSeconds(entry.elapsedMs);
          
          // For choice-based, show the choice ID
          const displayedAnswer = rawAnswer || (entry.choiceId ? entry.choiceId.toUpperCase() : '—');
          
          return (
            <li key={key} className="summary-correct-item">
              <div className="summary-correct-row">
                <span className="summary-correct-name">{entry.name || 'Player'}</span>
                {elapsedLabel && <span className="summary-correct-time">{elapsedLabel}</span>}
              </div>
              <div className="summary-correct-answer">
                {displayedAnswer ? `"${displayedAnswer}"` : '—'}
                {showAlias && (
                  <span className="summary-correct-alias">{' → '}{canonicalAnswer}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * SummaryDisplay Component
 * 
 * Shows round summary with support for all question types.
 * Displays choice distribution for MC/TF, responder list for all.
 */
export default function SummaryDisplay({
  summary,
  className = ''
}) {
  if (!summary) return null;

  const {
    question,
    questionType,
    correctAnswer,
    correctResponders = [],
    choiceDistribution,
    totalSubmissions = 0,
    correctCount = 0
  } = summary;

  const type = questionType || question?.type || QUESTION_TYPES.FREE_TEXT;
  const isChoice = isChoiceBasedQuestion(type);

  const summaryNames = useMemo(() => 
    correctResponders.map((entry) => entry.name || 'Player'),
    [correctResponders]
  );

  const solvedByLine = useMemo(() => {
    if (!correctResponders.length) return 'No correct answers this round.';
    return `Solved by ${formatCompactNameList(summaryNames)}`;
  }, [summaryNames, correctResponders.length]);

  return (
    <div className={`summary-display summary-type-${type} ${className}`.trim()}>
      <QuestionSummaryHeader 
        question={question}
        questionType={type}
        correctAnswer={correctAnswer}
      />

      {/* Show choice distribution for MC/TF questions */}
      {isChoice && choiceDistribution && (
        <ChoiceDistributionChart 
          distribution={choiceDistribution}
          totalPlayers={totalSubmissions}
        />
      )}

      {/* Always show correct responders list */}
      <CorrectRespondersList responders={correctResponders} />

      {/* Quick stats footer */}
      <div className="summary-stats">
        <span>{solvedByLine}</span>
        {totalSubmissions > 0 && (
          <span className="stats-ratio">
            {correctCount}/{totalSubmissions} correct
          </span>
        )}
      </div>
    </div>
  );
}

export { ChoiceDistributionChart, CorrectRespondersList, formatElapsedSeconds, formatCompactNameList };
