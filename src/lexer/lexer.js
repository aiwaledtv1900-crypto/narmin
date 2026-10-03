'use strict';

const { TokenType } = require('./token');
const { KEYWORDS, isKeyword } = require('./keywords');

class Lexer {
  constructor(source) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
  }

  peek(offset = 0) {
    return this.source[this.pos + offset] || '';
  }

  advance() {
    const ch = this.source[this.pos++];
    if (ch === '\n') { this.line++; this.col = 1; }
    else { this.col++; }
    return ch;
  }

  isDigit(ch) {
    if (!ch) return false;
    return /\p{Nd}/u.test(ch);
  }

  // نستعمل Unicode Property Escapes:
  // \p{L} = أي حرف في أي لغة (عربي، لاتيني، يوناني، صيني، ...)
  // \p{M} = علامات التشكيل (فتحة، ضمة، شدة، ...) — مهم للعربية
  isAlpha(ch) {
    if (!ch) return false;
    return /[\p{L}\p{M}_]/u.test(ch);
  }

  isAlphaNum(ch) {
    if (!ch) return false;
    return /[\p{L}\p{M}\p{Nd}_]/u.test(ch);
  }

  skipWhitespace() {
    while (this.pos < this.source.length) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r') { this.advance(); }
      else if (ch === '#') {
        while (this.pos < this.source.length && this.peek() !== '\n') this.advance();
      } else { break; }
    }
  }

  readNumber() {
    const start = this.pos;
    while (this.isDigit(this.peek())) this.advance();
    if (this.peek() === '.' && this.isDigit(this.peek(1))) {
      this.advance();
      while (this.isDigit(this.peek())) this.advance();
    }
    const text = this.source.slice(start, this.pos);
    return { type: TokenType.NUMBER, value: Number(text) };
  }

  readString(quote) {
    this.advance();
    let value = '';
    while (this.pos < this.source.length && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        const esc = this.advance();
        const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" };
        value += map[esc] || esc;
      } else { value += this.advance(); }
    }
    if (this.peek() !== quote) {
      throw new Error(`نص غير مغلق في السطر ${this.line}، العمود ${this.col}`);
    }
    this.advance();
    return { type: TokenType.STRING, value };
  }

  readIdent() {
    const start = this.pos;
    while (this.isAlphaNum(this.peek())) this.advance();
    const text = this.source.slice(start, this.pos);
    if (isKeyword(text)) {
      return { type: TokenType.KEYWORD, value: text, canonical: KEYWORDS[text] };
    }
    return { type: TokenType.IDENT, value: text };
  }

  tokenize() {
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const ch = this.peek();
      const line = this.line;
      const col = this.col;

      if (ch === '\n') {
        this.advance();
        this.tokens.push({ type: TokenType.NEWLINE, line, col });
        continue;
      }

      if (this.isDigit(ch)) {
        const t = this.readNumber();
        this.tokens.push({ ...t, line, col });
        continue;
      }

      if (ch === '"' || ch === "'") {
        const t = this.readString(ch);
        this.tokens.push({ ...t, line, col });
        continue;
      }

      if (this.isAlpha(ch)) {
        const t = this.readIdent();
        this.tokens.push({ ...t, line, col });
        continue;
      }

      const two = ch + this.peek(1);
      const ops2 = {
        '==': TokenType.EQ, '!=': TokenType.NEQ,
        '<=': TokenType.LTE, '>=': TokenType.GTE,
        '->': TokenType.ARROW, '=>': TokenType.FAT_ARROW,
        '|>': TokenType.PIPE, '&&': TokenType.AND, '||': TokenType.OR,
      };
      if (ops2[two]) {
        this.advance(); this.advance();
        this.tokens.push({ type: ops2[two], line, col });
        continue;
      }

      const ops1 = {
        '+': TokenType.PLUS, '-': TokenType.MINUS, '*': TokenType.STAR,
        '/': TokenType.SLASH, '%': TokenType.PERCENT, '=': TokenType.ASSIGN,
        '<': TokenType.LT, '>': TokenType.GT, '!': TokenType.NOT,
        '.': TokenType.DOT,
        ',': TokenType.COMMA,
        '،': TokenType.COMMA,   // الفاصلة العربية
        ':': TokenType.COLON,
        ';': TokenType.SEMICOLON,
        '(': TokenType.LPAREN, ')': TokenType.RPAREN,
        '{': TokenType.LBRACE, '}': TokenType.RBRACE,
        '[': TokenType.LBRACKET, ']': TokenType.RBRACKET,
      };
      if (ops1[ch]) {
        this.advance();
        this.tokens.push({ type: ops1[ch], line, col });
        continue;
      }

      throw new Error(`رمز غير معروف '${ch}' في السطر ${line}، العمود ${col}`);
    }

    this.tokens.push({ type: TokenType.EOF, line: this.line, col: this.col });
    return this.tokens;
  }
}

function tokenize(source) {
  return new Lexer(source).tokenize();
}

module.exports = { Lexer, tokenize };
