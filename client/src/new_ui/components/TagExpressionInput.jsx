import React, { useState, useRef, useEffect } from 'react';

/**
 * Tag Expression Input Component
 * 
 * Allows users to create boolean filter expressions for question selection.
 * 
 * Syntax:
 * - tag         - Include questions with this tag
 * - !tag        - Exclude questions with this tag  
 * - tag1 & tag2 - Questions must have BOTH tags (AND)
 * - tag1 | tag2 - Questions can have EITHER tag (OR)
 * - (...)       - Grouping for complex expressions
 * - *           - Match all questions
 * 
 * Examples:
 * - "easy"                     → Only easy questions
 * - "lyrics & graduation"      → Lyrics questions from Graduation
 * - "(easy | medium) & !artist"→ Easy or medium, but not artist questions
 */

// Standard tag categories (can be expanded)
const TAG_CATEGORIES = {
  difficulty: ['easy', 'medium', 'hard'],
  type: ['lyrics', 'artist', 'album', 'song', 'fill-in', 'cover-art', 'producer', 'feature'],
  album: ['graduation', 'dropout', 'mbdtf', 'yeezus', 'tlop', 'ye', 'donda', '808s', 'wtt', 'ksg'],
  era: ['early', 'mid', 'late', 'current']
};

const OPERATORS = [
  { symbol: '&', name: 'AND', description: 'Both conditions must match' },
  { symbol: '|', name: 'OR', description: 'Either condition can match' },
  { symbol: '!', name: 'NOT', description: 'Exclude matching questions' },
  { symbol: '(', name: '(', description: 'Open group' },
  { symbol: ')', name: ')', description: 'Close group' },
];

export default function TagExpressionInput({ 
  value = '', 
  onChange, 
  disabled = false,
  availableTags = [] 
}) {
  const [showHelp, setShowHelp] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef(null);

  // Combine available tags with standard categories
  const allTags = React.useMemo(() => {
    const tagSet = new Set(availableTags);
    Object.values(TAG_CATEGORIES).flat().forEach(tag => tagSet.add(tag));
    return Array.from(tagSet).sort();
  }, [availableTags]);

  // Get the current word being typed (for autocomplete)
  const getCurrentWord = () => {
    const beforeCursor = value.slice(0, cursorPosition);
    const match = beforeCursor.match(/[a-zA-Z0-9_-]+$/);
    return match ? match[0] : '';
  };

  // Filter suggestions based on current word
  const suggestions = React.useMemo(() => {
    const currentWord = getCurrentWord();
    if (!currentWord) return [];
    const lowerWord = currentWord.toLowerCase();
    return allTags
      .filter(tag => tag.toLowerCase().startsWith(lowerWord) && tag.toLowerCase() !== lowerWord)
      .slice(0, 8);
  }, [value, cursorPosition, allTags]);

  // Insert a tag or operator at cursor position
  const insertAtCursor = (text, addSpace = true) => {
    const currentWord = getCurrentWord();
    const beforeWord = value.slice(0, cursorPosition - currentWord.length);
    const afterCursor = value.slice(cursorPosition);
    const suffix = addSpace ? ' ' : '';
    const newValue = beforeWord + text + suffix + afterCursor;
    onChange(newValue);
    setShowSuggestions(false);
    
    // Focus back on input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = beforeWord.length + text.length + suffix.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // Validate expression syntax (basic validation)
  const validateExpression = (expr) => {
    if (!expr || expr.trim() === '' || expr.trim() === '*') {
      return { valid: true, message: 'All questions' };
    }
    
    // Check balanced parentheses
    let depth = 0;
    for (const char of expr) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (depth < 0) return { valid: false, message: 'Unbalanced parentheses' };
    }
    if (depth !== 0) return { valid: false, message: 'Unbalanced parentheses' };
    
    // Check for empty groups
    if (/\(\s*\)/.test(expr)) {
      return { valid: false, message: 'Empty group ()' };
    }
    
    // Check for consecutive operators
    if (/[&|]{2,}/.test(expr.replace(/\s/g, ''))) {
      return { valid: false, message: 'Consecutive operators' };
    }
    
    return { valid: true, message: 'Valid expression' };
  };

  const validation = validateExpression(value);

  const handleKeyDown = (e) => {
    if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      insertAtCursor(suggestions[0]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block font-bold">Question Filter</label>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          {showHelp ? 'Hide Help' : 'Show Help'}
        </button>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="p-3 bg-gray-100 border border-gray-300 rounded text-sm space-y-3">
          <div>
            <h4 className="font-bold mb-1">Operators</h4>
            <div className="grid grid-cols-2 gap-1">
              {OPERATORS.map(op => (
                <div key={op.symbol} className="flex items-center gap-2">
                  <code className="bg-gray-200 px-1 rounded">{op.symbol}</code>
                  <span className="text-gray-600">{op.description}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-1">Examples</h4>
            <div className="space-y-1 text-gray-600">
              <div><code className="bg-gray-200 px-1 rounded">easy</code> → Easy questions only</div>
              <div><code className="bg-gray-200 px-1 rounded">lyrics & graduation</code> → Lyrics from Graduation</div>
              <div><code className="bg-gray-200 px-1 rounded">(easy | medium) & !artist</code> → Easy/medium, no artist Qs</div>
              <div><code className="bg-gray-200 px-1 rounded">*</code> → All questions</div>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-1">Available Tags</h4>
            <div className="flex flex-wrap gap-1">
              {Object.entries(TAG_CATEGORIES).map(([category, tags]) => (
                <div key={category} className="w-full">
                  <span className="text-gray-500 text-xs uppercase">{category}:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertAtCursor(tag)}
                        disabled={disabled}
                        className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200 disabled:opacity-50"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCursorPosition(e.target.selectionStart || 0);
            setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onClick={(e) => setCursorPosition(e.target.selectionStart || 0)}
          disabled={disabled}
          placeholder="e.g., easy | (lyrics & graduation)"
          className={`w-full p-2 border font-mono text-sm ${
            validation.valid ? 'border-gray-400' : 'border-red-500'
          } ${disabled ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}
        />
        
        {/* Autocomplete Suggestions */}
        {showSuggestions && suggestions.length > 0 && !disabled && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-y-auto">
            {suggestions.map((tag, index) => (
              <button
                key={tag}
                type="button"
                onClick={() => insertAtCursor(tag)}
                className={`w-full text-left px-3 py-1 text-sm hover:bg-blue-100 ${
                  index === 0 ? 'bg-blue-50' : ''
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Operator Buttons */}
      <div className="flex gap-1">
        {OPERATORS.map(op => (
          <button
            key={op.symbol}
            type="button"
            onClick={() => insertAtCursor(op.symbol, op.symbol !== '(' && op.symbol !== ')')}
            disabled={disabled}
            title={op.description}
            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-mono disabled:opacity-50"
          >
            {op.symbol}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange('*')}
          disabled={disabled}
          title="Match all questions"
          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm font-mono disabled:opacity-50"
        >
          *
        </button>
      </div>

      {/* Validation Message */}
      <div className={`text-xs ${validation.valid ? 'text-gray-500' : 'text-red-600'}`}>
        {validation.message}
      </div>
    </div>
  );
}
