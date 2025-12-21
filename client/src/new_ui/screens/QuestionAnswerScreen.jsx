import React from 'react';
import { theme } from '../theme';
import QuestionDisplay from '../components/QuestionDisplay';

export default function QuestionAnswerScreen({ 
  question, 
  questionType, 
  correctAnswer, 
  roundResults 
}) {
  // roundResults: { [playerId]: { correct: boolean, points: number, timeTaken: number } }

  const summaryStyle = {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderTop: theme.borders.thin,
    width: '100%',
    maxWidth: '600px',
  };

  const correctPlayers = Object.entries(roundResults || {})
    .filter(([_, result]) => result.correct)
    .map(([playerId, result]) => ({ playerId, ...result }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <QuestionDisplay
        question={question}
        questionType={questionType}
        correctAnswer={correctAnswer}
        showAnswer={true}
      />
      
      <div style={summaryStyle}>
        <h3>Round Results</h3>
        {correctPlayers.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {correctPlayers.map(({ playerId, points, timeTaken }) => (
              <li key={playerId} style={{ marginBottom: theme.spacing.sm }}>
                <span style={{ fontWeight: 'bold' }}>Player {playerId}</span>: +{points} pts ({timeTaken?.toFixed(2)}s)
              </li>
            ))}
          </ul>
        ) : (
          <p>No one got it right!</p>
        )}
      </div>
    </div>
  );
}
