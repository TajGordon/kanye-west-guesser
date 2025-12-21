/**
 * Question Instantiator
 * 
 * Converts stored question templates into playable questions at runtime.
 * Handles:
 * - Selecting random wrong answers from wrongAnswerPool
 * - Selecting random lyrics from lyricPool
 * - Interpolating title/content templates
 * - Flipping true/false for T/F questions
 */

import { QUESTION_TYPES, TRUE_FALSE_CHOICES } from './questionTypes.js';

/**
 * Shuffle an array (Fisher-Yates)
 */
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Pick random items from an array
 */
function pickRandom(array, count) {
    return shuffle(array).slice(0, count);
}

/**
 * Interpolate template strings
 * Supports: {shownAnswer}, {lyric}, {subject.display}
 */
function interpolate(template, context) {
    if (!template) return template;
    
    return template.replace(/\{(\w+(?:\.\w+)?)\}/g, (match, key) => {
        const parts = key.split('.');
        let value = context;
        
        for (const part of parts) {
            if (value == null) return match;
            value = value[part];
        }
        
        return value != null ? String(value) : match;
    });
}

/**
 * Check if a question uses the new template format
 * (has wrongAnswerPool, lyricPool, or titleTemplate)
 */
export function isTemplateQuestion(question) {
    return !!(
        question.wrongAnswerPool ||
        question.lyricPool ||
        question.titleTemplate ||
        question.contentTemplate
    );
}

/**
 * Instantiate a question template into a playable question
 * 
 * @param {object} question - The stored question (may be template or legacy)
 * @returns {object} - Playable question with all runtime selections made
 */
export function instantiateQuestion(question) {
    // If not a template question, return as-is (legacy format)
    if (!isTemplateQuestion(question)) {
        return question;
    }
    
    const questionType = question.type || QUESTION_TYPES.FREE_TEXT;
    
    // Start with a copy of the question
    const instance = {
        ...question,
        _instantiated: true,
        _instanceId: `${question.id}:${Date.now()}`
    };
    
    // Context for interpolation
    const context = {
        subject: question.subject || {}
    };
    
    // Handle lyric pool selection
    if (question.lyricPool && question.lyricPool.length > 0) {
        const selectedLyric = question.lyricPool[Math.floor(Math.random() * question.lyricPool.length)];
        context.lyric = selectedLyric.text;
        instance._selectedLyric = selectedLyric;
        
        // Interpolate content if there's a template
        if (question.contentTemplate) {
            instance.content = {
                type: 'text',
                text: interpolate(question.contentTemplate, context)
            };
        }
    }
    
    // Handle wrong answer pool for MC/TF
    if (question.wrongAnswerPool && question.wrongAnswerPool.length > 0) {
        const wrongCount = question.wrongAnswerCount || 3;
        const selectedWrongs = pickRandom(question.wrongAnswerPool, wrongCount);
        instance._selectedWrongAnswers = selectedWrongs;
        
        if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
            // Build choices array with correct answer + wrong answers
            const correctChoice = {
                id: 'correct',
                text: question.answer?.display || 'Unknown',
                correct: true
            };
            
            const wrongChoices = selectedWrongs.map((wrong, i) => ({
                id: `wrong-${i}`,
                text: wrong.display,
                correct: false
            }));
            
            instance.choices = shuffle([correctChoice, ...wrongChoices]);
            instance.correctChoiceId = 'correct';
            
            // Set shownAnswer for MC questions (used in title interpolation)
            context.shownAnswer = question.answer?.display || 'Unknown';
        }
        
        if (questionType === QUESTION_TYPES.TRUE_FALSE) {
            // Flip coin to decide if we show correct or wrong answer
            const correctProbability = question.trueFalseConfig?.correctProbability ?? 0.5;
            const showCorrect = Math.random() < correctProbability;
            
            let shownAnswer;
            if (showCorrect) {
                shownAnswer = question.answer?.display || 'Unknown';
                instance.correctChoiceId = 'true';
                instance.correctAnswer = true;
            } else {
                // Pick a random wrong answer
                const wrongAnswer = selectedWrongs[0];
                shownAnswer = wrongAnswer?.display || 'Unknown';
                instance.correctChoiceId = 'false';
                instance.correctAnswer = false;
            }
            
            context.shownAnswer = shownAnswer;
            instance._shownAnswer = shownAnswer;
            instance.choices = TRUE_FALSE_CHOICES;
        }
    }
    
    // Set shownAnswer for FREE_TEXT questions (the correct answer)
    if (questionType === QUESTION_TYPES.FREE_TEXT) {
        context.shownAnswer = question.answer?.display || question.answers?.[0]?.display || 'Unknown';
    }
    
    // Interpolate title template for ALL question types
    if (question.titleTemplate) {
        instance.title = interpolate(question.titleTemplate, context);
    }
    
    // Build acceptedAliasMap for free-text questions
    if (questionType === QUESTION_TYPES.FREE_TEXT) {
        const acceptedAliasMap = new Map();
        
        if (question.answers) {
            // Multi-answer question
            for (const answer of question.answers) {
                // Add the primary display value first
                if (answer.display) {
                    const normalizedDisplay = answer.display.toLowerCase().trim();
                    if (!acceptedAliasMap.has(normalizedDisplay)) {
                        acceptedAliasMap.set(normalizedDisplay, answer);
                    }
                }
                // Then add all aliases
                for (const alias of answer.aliases || []) {
                    const normalized = alias.toLowerCase().trim();
                    if (!acceptedAliasMap.has(normalized)) {
                        acceptedAliasMap.set(normalized, answer);
                    }
                }
            }
        } else if (question.answer) {
            // Single answer question - add primary display value first
            if (question.answer.display) {
                const normalizedDisplay = question.answer.display.toLowerCase().trim();
                if (!acceptedAliasMap.has(normalizedDisplay)) {
                    acceptedAliasMap.set(normalizedDisplay, question.answer);
                }
            }
            // Then add all aliases
            for (const alias of question.answer.aliases || []) {
                const normalized = alias.toLowerCase().trim();
                if (!acceptedAliasMap.has(normalized)) {
                    acceptedAliasMap.set(normalized, question.answer);
                }
            }
        }
        
        instance.acceptedAliasMap = acceptedAliasMap;
        instance.primaryAnswer = question.answer?.display || question.answers?.[0]?.display || 'Unknown';
    }
    
    // For MC questions, set primaryAnswer
    if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
        instance.primaryAnswer = question.answer?.display || 'Unknown';
    }
    
    // For T/F questions, set primaryAnswer
    if (questionType === QUESTION_TYPES.TRUE_FALSE) {
        instance.primaryAnswer = instance.correctAnswer ? 'True' : 'False';
    }
    
    return instance;
}

/**
 * Format an instantiated question for sending to clients
 * (Hides correct answers and internal fields)
 */
export function formatInstantiatedQuestionForClient(question) {
    const questionType = question.type || QUESTION_TYPES.FREE_TEXT;
    
    const clientQuestion = {
        id: question._instanceId || question.id,
        type: questionType,
        title: question.title,
        prompt: question.title,
        content: question.content,
        tags: question.tags
    };
    
    // Add choices without correct answer flags
    if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE && question.choices) {
        clientQuestion.choices = question.choices.map(c => ({
            id: c.id,
            text: c.text
            // Intentionally omit 'correct' field
        }));
    }
    
    if (questionType === QUESTION_TYPES.TRUE_FALSE) {
        clientQuestion.choices = TRUE_FALSE_CHOICES.map(c => ({
            id: c.id,
            text: c.text
        }));
    }
    
    return clientQuestion;
}

/**
 * Format an instantiated question for round-end reveal
 */
export function formatInstantiatedQuestionForReveal(question) {
    const questionType = question.type || QUESTION_TYPES.FREE_TEXT;
    
    const revealQuestion = {
        id: question._instanceId || question.id,
        type: questionType,
        title: question.title,
        content: question.content,
        primaryAnswer: question.primaryAnswer
    };
    
    if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE && question.choices) {
        revealQuestion.choices = question.choices.map(c => ({
            id: c.id,
            text: c.text,
            correct: c.correct === true
        }));
        revealQuestion.correctChoiceId = question.correctChoiceId;
    }
    
    if (questionType === QUESTION_TYPES.TRUE_FALSE) {
        revealQuestion.correctChoiceId = question.correctChoiceId;
        revealQuestion.correctAnswer = question.correctAnswer;
    }
    
    if (questionType === QUESTION_TYPES.FREE_TEXT) {
        if (question.answers) {
            revealQuestion.answers = question.answers.map(a => a.display);
        } else if (question.answer) {
            revealQuestion.answers = [question.answer.display];
        }
    }
    
    return revealQuestion;
}
