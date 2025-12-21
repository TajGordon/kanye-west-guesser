/**
 * Question Filter Expression Parser & Evaluator
 * 
 * Parses and evaluates boolean expressions for filtering questions by tags.
 * Uses set operations to efficiently filter large question collections.
 * 
 * Syntax:
 * - tag              → Questions with this tag
 * - !tag             → Questions WITHOUT this tag (complement)
 * - tag1 & tag2      → Questions with BOTH tags (intersection)
 * - tag1 | tag2      → Questions with EITHER tag (union)
 * - (expr)           → Grouping for precedence
 * - *                → All questions (wildcard)
 * 
 * Examples:
 * - "easy"                         → Easy questions only
 * - "lyrics & graduation"          → Lyrics from Graduation album
 * - "(easy | medium) & !artist"    → Easy or medium, but not artist questions
 * - "!hard"                        → Everything except hard questions
 */

import { 
    getQuestionIdsForTag, 
    getAllQuestionIdSet, 
    questionSetOps 
} from './questionStore.js';

// ============================================================================
// Tokenizer
// ============================================================================

const TOKEN_TYPES = {
    TAG: 'TAG',
    NOT: 'NOT',
    AND: 'AND',
    OR: 'OR',
    LPAREN: 'LPAREN',
    RPAREN: 'RPAREN',
    WILDCARD: 'WILDCARD',
    EOF: 'EOF'
};

/**
 * Tokenize an expression string into tokens
 * @param {string} expr - The expression string
 * @returns {Array} Array of tokens
 */
function tokenize(expr) {
    const tokens = [];
    let i = 0;
    const len = expr.length;
    
    while (i < len) {
        const char = expr[i];
        
        // Skip whitespace
        if (/\s/.test(char)) {
            i++;
            continue;
        }
        
        // Operators and special chars
        if (char === '!') {
            tokens.push({ type: TOKEN_TYPES.NOT, value: '!' });
            i++;
        } else if (char === '&') {
            tokens.push({ type: TOKEN_TYPES.AND, value: '&' });
            i++;
        } else if (char === '|') {
            tokens.push({ type: TOKEN_TYPES.OR, value: '|' });
            i++;
        } else if (char === '(') {
            tokens.push({ type: TOKEN_TYPES.LPAREN, value: '(' });
            i++;
        } else if (char === ')') {
            tokens.push({ type: TOKEN_TYPES.RPAREN, value: ')' });
            i++;
        } else if (char === '*') {
            tokens.push({ type: TOKEN_TYPES.WILDCARD, value: '*' });
            i++;
        } else if (/[a-zA-Z0-9_:-]/.test(char)) {
            // Tag name (allow letters, numbers, underscores, hyphens, colons)
            let tag = '';
            while (i < len && /[a-zA-Z0-9_:-]/.test(expr[i])) {
                tag += expr[i];
                i++;
            }
            tokens.push({ type: TOKEN_TYPES.TAG, value: tag.toLowerCase() });
        } else {
            throw new Error(`Unexpected character: ${char} at position ${i}`);
        }
    }
    
    tokens.push({ type: TOKEN_TYPES.EOF });
    return tokens;
}

// ============================================================================
// Recursive Descent Parser
// ============================================================================

class ExpressionParser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
        this.current = tokens[0];
    }
    
    advance() {
        this.pos++;
        this.current = this.tokens[this.pos];
    }
    
    expect(type) {
        if (this.current.type !== type) {
            throw new Error(`Expected ${type}, got ${this.current.type}`);
        }
        const token = this.current;
        this.advance();
        return token;
    }
    
    // expr → orExpr
    parseExpression() {
        return this.parseOrExpr();
    }
    
    // orExpr → andExpr ('|' andExpr)*
    parseOrExpr() {
        let left = this.parseAndExpr();
        
        while (this.current.type === TOKEN_TYPES.OR) {
            this.advance();
            const right = this.parseAndExpr();
            left = { type: 'OR', left, right };
        }
        
        return left;
    }
    
    // andExpr → notExpr ('&' notExpr)*
    parseAndExpr() {
        let left = this.parseNotExpr();
        
        while (this.current.type === TOKEN_TYPES.AND) {
            this.advance();
            const right = this.parseNotExpr();
            left = { type: 'AND', left, right };
        }
        
        return left;
    }
    
    // notExpr → '!' notExpr | primary
    parseNotExpr() {
        if (this.current.type === TOKEN_TYPES.NOT) {
            this.advance();
            const operand = this.parseNotExpr();
            return { type: 'NOT', operand };
        }
        
        return this.parsePrimary();
    }
    
    // primary → '(' expr ')' | TAG | WILDCARD
    parsePrimary() {
        if (this.current.type === TOKEN_TYPES.LPAREN) {
            this.advance();
            const expr = this.parseExpression();
            this.expect(TOKEN_TYPES.RPAREN);
            return expr;
        }
        
        if (this.current.type === TOKEN_TYPES.TAG) {
            const token = this.current;
            this.advance();
            return { type: 'TAG', value: token.value };
        }
        
        if (this.current.type === TOKEN_TYPES.WILDCARD) {
            this.advance();
            return { type: 'WILDCARD' };
        }
        
        throw new Error(`Unexpected token: ${this.current.type}`);
    }
}

/**
 * Parse an expression string into an AST
 * @param {string} expr - The expression string
 * @returns {object} Abstract Syntax Tree
 */
export function parseExpression(expr) {
    if (!expr || expr.trim() === '') {
        return { type: 'WILDCARD' };
    }
    
    const trimmed = expr.trim();
    if (trimmed === '*') {
        return { type: 'WILDCARD' };
    }
    
    const tokens = tokenize(trimmed);
    const parser = new ExpressionParser(tokens);
    const ast = parser.parseExpression();
    parser.expect(TOKEN_TYPES.EOF);
    return ast;
}

// ============================================================================
// Evaluator (AST → Question ID Set)
// ============================================================================

/**
 * Evaluate an AST node to produce a set of question IDs
 * @param {object} node - AST node
 * @returns {Set} Set of question IDs that match the expression
 */
export function evaluateExpression(node) {
    if (!node) {
        return getAllQuestionIdSet();
    }
    
    switch (node.type) {
        case 'WILDCARD':
            return getAllQuestionIdSet();
        
        case 'TAG': {
            const tagSet = getQuestionIdsForTag(node.value);
            return tagSet || new Set();
        }
        
        case 'NOT': {
            const operandSet = evaluateExpression(node.operand);
            return questionSetOps.complement(operandSet);
        }
        
        case 'AND': {
            const leftSet = evaluateExpression(node.left);
            const rightSet = evaluateExpression(node.right);
            return questionSetOps.intersection(leftSet, rightSet);
        }
        
        case 'OR': {
            const leftSet = evaluateExpression(node.left);
            const rightSet = evaluateExpression(node.right);
            return questionSetOps.union(leftSet, rightSet);
        }
        
        default:
            console.error('[questionFilter] Unknown node type:', node.type);
            return getAllQuestionIdSet();
    }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Filter questions using a tag expression
 * @param {string} expression - Boolean expression using tags
 * @returns {Set} Set of question IDs matching the filter
 */
export function filterQuestionsByExpression(expression) {
    try {
        const ast = parseExpression(expression);
        return evaluateExpression(ast);
    } catch (error) {
        console.error('[questionFilter] Error filtering questions:', error.message);
        // Return all questions on error to avoid blocking the game
        return getAllQuestionIdSet();
    }
}

/**
 * Validate an expression (check syntax)
 * @param {string} expression - Expression to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateExpression(expression) {
    if (!expression || expression.trim() === '' || expression.trim() === '*') {
        return { valid: true };
    }
    
    try {
        parseExpression(expression);
        return { valid: true };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

/**
 * Get statistics about filtered questions
 * @param {string} expression - Filter expression
 * @returns {{ total: number, expression: string }}
 */
export function getFilterStatistics(expression) {
    const filteredIds = filterQuestionsByExpression(expression);
    return {
        total: filteredIds.size,
        expression
    };
}
