import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import {
    QUESTION_TYPES,
    isValidQuestionType,
    getDefaultQuestionType,
    getQuestionTypeConfig,
    TRUE_FALSE_CHOICES
} from './questionTypes.js'
import { validateQuestionData } from './validation.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_DATA_PATH = path.join(__dirname, '../data/questions.json')
const MEDIA_PUBLIC_BASE = '/media'
const MEDIA_FS_BASE = path.join(__dirname, '../public/media')
const QUESTION_MEDIA_SUBDIR = 'questions'
const QUESTION_MEDIA_FS_BASE = path.join(MEDIA_FS_BASE, QUESTION_MEDIA_SUBDIR)
const QUESTION_MEDIA_URL_BASE = `${MEDIA_PUBLIC_BASE}/${QUESTION_MEDIA_SUBDIR}`
const FLAGS_DATA_PATH = path.join(__dirname, '../data/flagged-questions.json')

let questionList = []
let questionMap = new Map()
let tagIndex = new Map()
let allQuestionIds = new Set()
let flaggedQuestions = new Map() // questionId -> { flags: [{ playerId, playerName, reason, timestamp, lobbyId }] }

function cloneSet(input) {
    if (!input) return new Set()
    if (input instanceof Set) {
        return new Set(input)
    }
    return new Set(Array.from(input))
}

function setUnion(a = new Set(), b = new Set()) {
    const result = cloneSet(a)
    if (!b) return result
    b.forEach((value) => result.add(value))
    return result
}

function setIntersection(a = new Set(), b = new Set()) {
    if (!a?.size || !b?.size) return new Set()
    const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a]
    const result = new Set()
    smaller.forEach((value) => {
        if (larger.has(value)) {
            result.add(value)
        }
    })
    return result
}

function setDifference(a = new Set(), b = new Set()) {
    if (!a?.size) return new Set()
    if (!b?.size) return cloneSet(a)
    const result = new Set()
    a.forEach((value) => {
        if (!b.has(value)) {
            result.add(value)
        }
    })
    return result
}

function setComplement(target = new Set()) {
    const result = new Set()
    allQuestionIds.forEach((value) => {
        if (!target.has(value)) {
            result.add(value)
        }
    })
    return result
}

function normalizeAnswerText(value = '') {
    return value
        .toString()
        .trim()
        .toLowerCase()
}

function ensureArray(value) {
    if (!value) return []
    if (Array.isArray(value)) return value
    return [value]
}

function normalizeContent(rawContent = {}, questionId = 'unknown') {
    if (!rawContent || typeof rawContent !== 'object') {
        return { type: 'text', text: '' }
    }

    const type = rawContent.type || 'text'

    if (type === 'image') {
        const source = rawContent.source || 'url'
        if (source === 'media') {
            const fileName = rawContent.file?.toString().trim()
            if (!fileName) {
                console.warn(`[questionStore] Missing media file name for question ${questionId}`)
                return { ...rawContent, type: 'image', url: null }
            }
            const fsPath = path.join(QUESTION_MEDIA_FS_BASE, fileName)
            if (!fs.existsSync(fsPath)) {
                console.warn(`[questionStore] Media file not found for question ${questionId}: ${fsPath}`)
            }
            const urlPath = `${QUESTION_MEDIA_URL_BASE}/${fileName}`.replaceAll('\\', '/')
            return {
                type: 'image',
                source: 'media',
                file: fileName,
                url: urlPath,
                alt: rawContent.alt || null,
                display: rawContent.display || null,
                width: rawContent.width || null,
                height: rawContent.height || null
            }
        }
        return {
            type: 'image',
            source,
            url: rawContent.url || null,
            alt: rawContent.alt || null,
            display: rawContent.display || null,
            width: rawContent.width || null,
            height: rawContent.height || null
        }
    }

    // default text/plain content
    return {
        type: 'text',
        text: rawContent.text?.toString() || ''
    }
}

function normalizeQuestion(raw) {
    const title = raw.title?.toString().trim() || 'Untitled Question'
    const tags = Array.from(new Set(ensureArray(raw.tags).map(tag => tag.toString().trim().toLowerCase()).filter(Boolean)))
    
    // Determine and validate question type
    const rawType = raw.type?.toString().trim().toLowerCase()
    const questionType = isValidQuestionType(rawType) ? rawType : getDefaultQuestionType()
    
    // Normalize answers for free-text questions
    const answers = ensureArray(raw.answers).map((entry, index) => {
        const display = entry?.display?.toString().trim() || entry?.aliases?.[0] || `Answer ${index + 1}`
        const aliasSet = new Set()
        aliasSet.add(display)
        ensureArray(entry?.aliases).forEach(alias => {
            if (alias) aliasSet.add(alias)
        })
        const normalizedAliases = Array.from(aliasSet)
            .map(normalizeAnswerText)
            .filter(Boolean)
        return {
            id: entry?.id || `${raw.id || 'unknown'}-answer-${index}`,
            display,
            aliases: Array.from(aliasSet),
            normalizedAliases
        }
    })

    const acceptedAliasMap = new Map()
    answers.forEach(answer => {
        answer.normalizedAliases.forEach(alias => {
            if (!acceptedAliasMap.has(alias)) {
                acceptedAliasMap.set(alias, answer)
            }
        })
    })

    const normalizedContent = normalizeContent(raw.content, raw.id)
    
    // Build base question object
    const question = {
        id: raw.id?.toString() || crypto.randomUUID?.() || `question-${Date.now()}`,
        type: questionType,
        title,
        content: normalizedContent || { type: 'text', text: title },
        tags,
        meta: raw.meta || null
    }

    // Add type-specific fields
    if (questionType === QUESTION_TYPES.FREE_TEXT) {
        question.answers = answers
        question.acceptedAliasMap = acceptedAliasMap
        question.primaryAnswer = answers[0]?.display || 'Unknown'
    } else if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
        question.choices = normalizeChoices(raw.choices, raw.id)
        question.correctChoiceId = findCorrectChoiceId(question.choices)
        question.primaryAnswer = question.choices.find(c => c.correct)?.text || 'Unknown'
    } else if (questionType === QUESTION_TYPES.TRUE_FALSE) {
        question.choices = TRUE_FALSE_CHOICES
        question.correctAnswer = raw.correctAnswer === true
        question.correctChoiceId = raw.correctAnswer === true ? 'true' : 'false'
        question.primaryAnswer = raw.correctAnswer === true ? 'True' : 'False'
    }

    return question
}

/**
 * Normalize choices array for multiple-choice questions
 */
function normalizeChoices(rawChoices, questionId) {
    if (!Array.isArray(rawChoices)) return []
    
    return rawChoices.map((choice, index) => {
        const id = choice?.id?.toString().trim() || `${questionId}-choice-${index}`
        const text = choice?.text?.toString().trim() || `Choice ${index + 1}`
        const correct = choice?.correct === true
        
        return { id, text, correct }
    })
}

/**
 * Find the correct choice ID from a choices array
 */
function findCorrectChoiceId(choices) {
    const correct = choices.find(c => c.correct === true)
    return correct?.id || null
}

export function initializeQuestionStore({ filePath } = {}) {
    const resolvedPath = filePath || DEFAULT_DATA_PATH
    let rawJson
    try {
        rawJson = fs.readFileSync(resolvedPath, 'utf-8')
    } catch (err) {
        console.error(`[questionStore] Failed to read questions file at ${resolvedPath}`, err)
        throw err
    }

    let parsed
    try {
        parsed = JSON.parse(rawJson)
    } catch (err) {
        console.error('[questionStore] Failed to parse questions JSON', err)
        throw err
    }

    const questions = Array.isArray(parsed) ? parsed : parsed?.questions
    if (!Array.isArray(questions) || !questions.length) {
        throw new Error('[questionStore] No questions found in data file')
    }

    questionList = questions.map(normalizeQuestion)
    questionMap = new Map(questionList.map(q => [q.id, q]))
    allQuestionIds = new Set(questionList.map(q => q.id))
    tagIndex = new Map()
    questionList.forEach((question) => {
        question.tags.forEach((tag) => {
            if (!tagIndex.has(tag)) {
                tagIndex.set(tag, new Set())
            }
            tagIndex.get(tag).add(question.id)
        })
    })

    console.log(`[questionStore] Loaded ${questionList.length} questions from ${resolvedPath}`)
}

export function getRandomQuestion() {
    if (!questionList.length) {
        return null
    }
    const idx = Math.floor(Math.random() * questionList.length)
    return questionList[idx]
}

export function getQuestionById(id) {
    return questionMap.get(id) || null
}

export function getAllQuestionIds() {
    return Array.from(allQuestionIds)
}

export function getTagIndexSnapshot() {
    const snapshot = {}
    tagIndex.forEach((set, tag) => {
        snapshot[tag] = set.size
    })
    return snapshot
}

export function evaluateAnswer(question, answerText) {
    if (!question || !answerText) {
        return { isCorrect: false }
    }
    
    const questionType = question.type || QUESTION_TYPES.FREE_TEXT
    
    // Free-text: match against acceptedAliasMap
    if (questionType === QUESTION_TYPES.FREE_TEXT) {
        const normalized = normalizeAnswerText(answerText)
        if (!normalized) {
            return { isCorrect: false }
        }
        const matchedAnswer = question.acceptedAliasMap?.get(normalized)
        if (matchedAnswer) {
            return { isCorrect: true, matchedAnswer }
        }
        return { isCorrect: false }
    }
    
    // For choice-based questions, answerText is actually the choiceId
    return evaluateChoiceAnswer(question, answerText)
}

/**
 * Evaluate a choice-based answer (multiple choice or true/false)
 * @param {object} question 
 * @param {string} choiceId 
 * @returns {{ isCorrect: boolean, matchedChoice?: object }}
 */
export function evaluateChoiceAnswer(question, choiceId) {
    if (!question || !choiceId) {
        return { isCorrect: false }
    }
    
    const questionType = question.type || QUESTION_TYPES.FREE_TEXT
    
    if (questionType === QUESTION_TYPES.TRUE_FALSE) {
        const isCorrect = choiceId === question.correctChoiceId
        const matchedChoice = TRUE_FALSE_CHOICES.find(c => c.id === choiceId)
        return { isCorrect, matchedChoice }
    }
    
    if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE) {
        const selectedChoice = question.choices?.find(c => c.id === choiceId)
        if (!selectedChoice) {
            return { isCorrect: false }
        }
        const isCorrect = selectedChoice.correct === true
        return { isCorrect, matchedChoice: selectedChoice }
    }
    
    return { isCorrect: false }
}

export function getQuestionIdsForTag(tag) {
    if (!tag) return new Set()
    const normalized = tag.toString().trim().toLowerCase()
    return cloneSet(tagIndex.get(normalized))
}

export function getAllQuestionIdSet() {
    return cloneSet(allQuestionIds)
}

export const questionSetOps = {
    union: setUnion,
    intersection: setIntersection,
    difference: setDifference,
    complement: setComplement,
    nand: (a, b) => setComplement(setIntersection(a, b)),
    nor: (a, b) => setComplement(setUnion(a, b))
}

export function formatQuestionForClient(question) {
    if (!question) return null
    
    const questionType = question.type || QUESTION_TYPES.FREE_TEXT
    
    const clientQuestion = {
        id: question.id,
        type: questionType,
        title: question.title,
        prompt: question.title,
        content: question.content,
        tags: question.tags
    }
    
    // Add choices for choice-based questions (without correct answer flags!)
    if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE && question.choices) {
        clientQuestion.choices = question.choices.map(c => ({
            id: c.id,
            text: c.text
            // NOTE: We intentionally omit 'correct' field to prevent cheating
        }))
    }
    
    if (questionType === QUESTION_TYPES.TRUE_FALSE) {
        clientQuestion.choices = TRUE_FALSE_CHOICES.map(c => ({
            id: c.id,
            text: c.text
        }))
    }
    
    return clientQuestion
}

/**
 * Format question for round-end reveal (includes correct answer info)
 */
export function formatQuestionForReveal(question) {
    if (!question) return null
    
    const questionType = question.type || QUESTION_TYPES.FREE_TEXT
    
    const revealQuestion = {
        id: question.id,
        type: questionType,
        title: question.title,
        content: question.content,
        primaryAnswer: question.primaryAnswer
    }
    
    if (questionType === QUESTION_TYPES.MULTIPLE_CHOICE && question.choices) {
        revealQuestion.choices = question.choices.map(c => ({
            id: c.id,
            text: c.text,
            correct: c.correct === true
        }))
        revealQuestion.correctChoiceId = question.correctChoiceId
    }
    
    if (questionType === QUESTION_TYPES.TRUE_FALSE) {
        revealQuestion.correctChoiceId = question.correctChoiceId
        revealQuestion.correctAnswer = question.correctAnswer
    }
    
    if (questionType === QUESTION_TYPES.FREE_TEXT && question.answers) {
        revealQuestion.answers = question.answers.map(a => a.display)
    }
    
    return revealQuestion
}

// ============================================================================
// Question Flagging
// ============================================================================

/**
 * Load flagged questions from disk
 */
function loadFlaggedQuestions() {
    try {
        if (fs.existsSync(FLAGS_DATA_PATH)) {
            const raw = fs.readFileSync(FLAGS_DATA_PATH, 'utf-8')
            const data = JSON.parse(raw)
            flaggedQuestions = new Map(Object.entries(data))
            console.log(`Loaded ${flaggedQuestions.size} flagged questions`)
        }
    } catch (error) {
        console.error('Failed to load flagged questions:', error.message)
    }
}

/**
 * Save flagged questions to disk
 */
function saveFlaggedQuestions() {
    try {
        const data = Object.fromEntries(flaggedQuestions)
        fs.writeFileSync(FLAGS_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
        console.error('Failed to save flagged questions:', error.message)
    }
}

/**
 * Flag a question for review
 * @param {string} questionId 
 * @param {object} flagInfo - { playerId, playerName, reason, lobbyId }
 * @returns {{ success: boolean, flagCount: number, error?: string }}
 */
export function flagQuestion(questionId, flagInfo = {}) {
    if (!questionId || typeof questionId !== 'string') {
        return { success: false, flagCount: 0, error: 'Invalid question ID' }
    }

    const question = questionMap.get(questionId)
    if (!question) {
        return { success: false, flagCount: 0, error: 'Question not found' }
    }

    const existing = flaggedQuestions.get(questionId) || { flags: [], question: { id: question.id, title: question.title } }
    
    // Check if this player already flagged this question
    const alreadyFlagged = existing.flags.some(f => f.playerId === flagInfo.playerId)
    if (alreadyFlagged) {
        return { success: false, flagCount: existing.flags.length, error: 'Already flagged by this player' }
    }

    existing.flags.push({
        playerId: flagInfo.playerId || 'unknown',
        playerName: flagInfo.playerName || 'Unknown',
        reason: flagInfo.reason || 'No reason provided',
        lobbyId: flagInfo.lobbyId || null,
        timestamp: Date.now()
    })

    flaggedQuestions.set(questionId, existing)
    saveFlaggedQuestions()

    console.log(`Question "${question.title}" flagged (total: ${existing.flags.length} flags)`)
    return { success: true, flagCount: existing.flags.length }
}

/**
 * Get all flagged questions
 * @returns {Array} Array of flagged question records
 */
export function getFlaggedQuestions() {
    return Array.from(flaggedQuestions.entries()).map(([id, data]) => ({
        questionId: id,
        ...data
    }))
}

/**
 * Clear flags for a question (after manual review)
 * @param {string} questionId 
 */
export function clearQuestionFlags(questionId) {
    if (flaggedQuestions.has(questionId)) {
        flaggedQuestions.delete(questionId)
        saveFlaggedQuestions()
        return true
    }
    return false
}

// Load flags on module init
loadFlaggedQuestions()
