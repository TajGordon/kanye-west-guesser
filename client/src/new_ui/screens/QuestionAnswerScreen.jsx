import React from 'react';
import QuestionDisplay from '../components/QuestionDisplay';
import { QUESTION_TYPES } from '../../questionTypes';

export default function QuestionAnswerScreen({ 
  question, 
  questionType, 
  correctAnswer,
  correctChoiceId,
  selectedOptionId,
  roundSummary,
  players = []
}) {
  // Build list of correct responders from summary
  const correctResponders = roundSummary?.correctResponders || [];
  const proximityRanking = roundSummary?.proximityRanking || [];
  const isNumeric = questionType === QUESTION_TYPES.NUMERIC;
  
  // Create a map of playerId -> playerName from players array
  const playerNameMap = new Map();
  players.forEach(p => {
    playerNameMap.set(p.playerId, p.name || p.displayName || 'Unknown');
  });

  // Get player name helper
  const getPlayerName = (playerId) => {
    return playerNameMap.get(playerId) || 'Unknown';
  };

  // Determine if this is a choice-based question
  const isChoiceBased = [QUESTION_TYPES.MULTIPLE_CHOICE, QUESTION_TYPES.TRUE_FALSE].includes(questionType);

  // Build all players' submissions for display
  // For choice-based: show what each player chose
  // For numeric: skip this (we use proximityRanking instead)
  // For text-based: show correct responders
  const allSubmissions = [];
  
  if (isNumeric) {
    // For numeric questions, we show the proximity ranking separately
    // Don't populate allSubmissions - we'll show the ranking table instead
  } else if (isChoiceBased && roundSummary?.choiceDistribution) {
    // For choice-based, we need to show who picked what
    // The correctResponders already has the correct ones
    // We can show from players' current state
    players.forEach(player => {
      const responder = correctResponders.find(r => r.playerId === player.playerId);
      if (responder) {
        allSubmissions.push({
          playerId: player.playerId,
          name: player.name || 'Unknown',
          isCorrect: true,
          elapsedMs: responder.elapsedMs,
          choiceId: responder.choiceId
        });
      } else if (player.roundGuessStatus === 'submitted' || player.roundGuessStatus === 'incorrect') {
        // Player submitted but was wrong
        allSubmissions.push({
          playerId: player.playerId,
          name: player.name || 'Unknown',
          isCorrect: false,
          elapsedMs: null,
          choiceId: null
        });
      }
    });
  } else {
    // For text-based, show all correct responders
    correctResponders.forEach(responder => {
      allSubmissions.push({
        playerId: responder.playerId,
        name: responder.name || getPlayerName(responder.playerId),
        isCorrect: true,
        elapsedMs: responder.elapsedMs,
        answerText: responder.answerText || responder.matchedAnswerDisplay
      });
    });
  }

  // Sort by elapsed time (fastest first)
  allSubmissions.sort((a, b) => (a.elapsedMs || Infinity) - (b.elapsedMs || Infinity));

  return (
    <div className="flex flex-col items-center w-full">
      <QuestionDisplay
        question={question}
        questionType={questionType}
        correctAnswer={correctAnswer}
        correctChoiceId={correctChoiceId}
        selectedOptionId={selectedOptionId}
        showAnswer={true}
      />
      
      {/* Round Results */}
      <div className="mt-8 p-6 border-t-2 border-black w-full max-w-[600px]">
        <h3 className="text-xl font-bold mb-4 text-black">Round Results</h3>
        
        {/* For non-numeric questions, show the traditional responders list */}
        {!isNumeric && allSubmissions.length > 0 && (
          <ul className="list-none p-0 space-y-2">
            {allSubmissions.map((submission, index) => (
              <li 
                key={submission.playerId || index} 
                className={`flex items-center gap-2 p-2 rounded ${
                  submission.isCorrect ? 'bg-green-100' : 'bg-red-100'
                }`}
              >
                <span className={`font-bold ${submission.isCorrect ? 'text-success' : 'text-error'}`}>
                  {submission.isCorrect ? '✓' : '✗'}
                </span>
                <span className="font-bold text-black">{submission.name}</span>
                {submission.elapsedMs && (
                  <span className={`${submission.isCorrect ? 'text-success' : 'text-gray-500'}`}>
                    ({(submission.elapsedMs / 1000).toFixed(2)}s)
                  </span>
                )}
                {submission.answerText && (
                  <span className="text-gray-600 italic">"{submission.answerText}"</span>
                )}
              </li>
            ))}
          </ul>
        )}
        
        {/* Show "no one answered" for non-numeric when no submissions */}
        {!isNumeric && allSubmissions.length === 0 && proximityRanking.length === 0 && (
          <p className="text-gray-500 italic">No one answered!</p>
        )}
        
        {/* Show choice distribution for multiple choice */}
        {roundSummary?.choiceDistribution && (
          <div className="mt-6">
            <h4 className="text-lg font-bold mb-2 text-black">Answer Distribution</h4>
            <div className="space-y-2">
              {roundSummary.choiceDistribution.map(choice => (
                <div 
                  key={choice.choiceId}
                  className={`flex justify-between p-3 rounded border-2 ${
                    choice.correct 
                      ? 'bg-success text-white border-success' 
                      : 'bg-surface text-black border-black'
                  }`}
                >
                  <span>{choice.text}</span>
                  <span className="font-bold">{choice.count} votes</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Show proximity ranking for numeric questions */}
        {isNumeric && proximityRanking.length > 0 && (
          <div className="mt-6">
            <h4 className="text-lg font-bold mb-2 text-black">All Guesses (Closest First)</h4>
            <div className="text-center mb-3 p-2 bg-secondary rounded">
              <span className="text-gray-600">Correct Answer: </span>
              <span className="font-bold text-success text-xl">{correctAnswer || question?.correctAnswer}</span>
            </div>
            <div className="space-y-2">
              {proximityRanking.map((entry, index) => {
                const isExact = entry.difference === 0;
                const isClose = entry.difference <= 5;
                const rankColors = index === 0 ? 'bg-yellow-100 border-yellow-500' :
                                   index === 1 ? 'bg-gray-100 border-gray-400' :
                                   index === 2 ? 'bg-orange-100 border-orange-400' :
                                   'bg-surface border-black';
                const rankLabel = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
                
                return (
                  <div 
                    key={entry.playerId}
                    className={`flex items-center justify-between p-3 rounded border-2 ${rankColors}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{rankLabel}</span>
                      <span className="font-bold text-black">{entry.name || getPlayerName(entry.playerId)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-lg ${isExact ? 'text-success' : isClose ? 'text-yellow-600' : 'text-black'}`}>
                        {entry.value}
                      </span>
                      {!isExact && (
                        <span className="text-gray-500 text-sm">
                          ({entry.difference > 0 ? '+' : ''}{entry.value - (correctAnswer || question?.correctAnswer)} off)
                        </span>
                      )}
                      {isExact && (
                        <span className="text-success font-bold">✓ Exact!</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
