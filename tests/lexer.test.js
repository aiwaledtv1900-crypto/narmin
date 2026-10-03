'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { tokenize } = require('../src/lexer/lexer');
const { TokenType } = require('../src/lexer/token');

test('نص عربي بسيط', () => {
  const tokens = tokenize('"مرحباً"');
  assert.strictEqual(tokens[0].type, TokenType.STRING);
  assert.strictEqual(tokens[0].value, 'مرحباً');
  assert.strictEqual(tokens[1].type, TokenType.EOF);
});

test('أرقام صحيحة وعشرية', () => {
  const tokens = tokenize('42 3.14');
  assert.strictEqual(tokens[0].value, 42);
  assert.strictEqual(tokens[1].value, 3.14);
});

test('كلمة مفتاحية عربية اطبع', () => {
  const tokens = tokenize('اطبع');
  assert.strictEqual(tokens[0].type, TokenType.KEYWORD);
  assert.strictEqual(tokens[0].canonical, 'PRINT');
});

test('كلمة مفتاحية إنجليزية print', () => {
  const tokens = tokenize('print');
  assert.strictEqual(tokens[0].canonical, 'PRINT');
});

test('ملف hello.narm', () => {
  const tokens = tokenize('اطبع "مرحباً يا DEV"');
  assert.strictEqual(tokens[0].canonical, 'PRINT');
  assert.strictEqual(tokens[1].type, TokenType.STRING);
  assert.strictEqual(tokens[1].value, 'مرحباً يا DEV');
});

test('عمليات حسابية', () => {
  const tokens = tokenize('1 + 2 * 3');
  const types = tokens.map(t => t.type);
  assert.deepStrictEqual(types, [
    TokenType.NUMBER, TokenType.PLUS, TokenType.NUMBER,
    TokenType.STAR, TokenType.NUMBER, TokenType.EOF
  ]);
});

test('ناقل الأنابيب |>', () => {
  const tokens = tokenize('x |> f');
  assert.strictEqual(tokens[1].type, TokenType.PIPE);
});

test('التعليقات تُتجاهل', () => {
  const tokens = tokenize('# تعليق\n42');
  assert.strictEqual(tokens[0].type, TokenType.NEWLINE);
  assert.strictEqual(tokens[1].type, TokenType.NUMBER);
});

test('نص غير مغلق يرمي خطأ', () => {
  assert.throws(() => tokenize('"abc'), /نص غير مغلق/);
});

test('رمز غير معروف يرمي خطأ', () => {
  assert.throws(() => tokenize('@'), /رمز غير معروف/);
});
