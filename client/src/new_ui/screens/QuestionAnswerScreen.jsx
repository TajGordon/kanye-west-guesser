import React from 'react';
import QuestionDisplay from '../components/QuestionDisplay';

export default function QuestionAnswerScreen({ 
  question, 
  questionType, 
  correctAnswer, 
  roundResults 
}) {
  const correctPlayers = Object.entries(roundResults || {})
    .filter(([_, result]) => result.correct)
    .map(([playerId, result]) => ({ playerId, ...result }));

  return (
    <div className="flex flex-col items-center w-full">
      <QuestionDisplay
        question={question}
        questionType={questionType}
        correctAnswer={correctAnswer}
        showAnswer={true}
      />
      
      <div className="mt-8 p-6 border-t border-black w-full max-w-[600px]">
        <h3 className="text-xl font-bold mb-4">Round Results</h3>
        {correctPlayers.length > 0 ? (
          <ul className="list-none p-0">
            {correctPlayers.map(({ playerId, points, timeTaken }) => (
              <li key={playerId} className="mb-2">
                <span className="font-bold">Player {playerId}</span>: +{points} pts ({timeTaken?.toFixed(2)}s)
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
