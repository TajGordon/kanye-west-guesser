import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_DATA_PATH = path.join(__dirname, '../data/questions.json')
const MEDIA_PUBLIC_BASE = '/media'
const MEDIA_FS_BASE = path.join(__dirname, '../public/media')
const QUESTION_MEDIA_SUBDIR = 'questions'
const QUESTION_MEDIA_FS_BASE = path.join(MEDIA_FS_BASE, QUESTION_MEDIA_SUBDIR)
const QUESTION_MEDIA_URL_BASE = `${MEDIA_PUBLIC_BASE}/${QUESTION_MEDIA_SUBDIR}`

let questionList = []
let questionMap = new Map()
let tagIndex = new Map()
let allQuestionIds = new Set()

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

    return {
        id: raw.id?.toString() || crypto.randomUUID?.() || `question-${Date.now()}`,
        title,
        content: normalizedContent || { type: 'text', text: title },
        answers,
        tags,
        acceptedAliasMap,
        primaryAnswer: answers[0]?.display || 'Unknown',
        meta: raw.meta || null
    }
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
    const normalized = normalizeAnswerText(answerText)
    if (!normalized) {
        return { isCorrect: false }
    }
    const matchedAnswer = question.acceptedAliasMap.get(normalized)
    if (matchedAnswer) {
        return { isCorrect: true, matchedAnswer }
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
    return {
        id: question.id,
        title: question.title,
        prompt: question.title,
        content: question.content,
        tags: question.tags
    }
}
