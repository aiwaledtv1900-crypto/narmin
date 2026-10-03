'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../src/parser/parser');
const { NodeType: N } = require('../src/ast/nodes');

test('برنامج فارغ', () => {
  const ast = parse('');
  assert.strictEqual(ast.type, N.PROGRAM);
  assert.strictEqual(ast.body.length, 0);
});

test('اطبع "مرحبا"', () => {
  const ast = parse('اطبع "مرحبا"');
  assert.strictEqual(ast.body[0].type, N.PRINT);
  assert.strictEqual(ast.body[0].arg.type, N.STRING);
  assert.strictEqual(ast.body[0].arg.value, 'مرحبا');
});

test('متغير بسيط', () => {
  const ast = parse('متغير س = 42');
  const stmt = ast.body[0];
  assert.strictEqual(stmt.type, N.LET);
  assert.strictEqual(stmt.name, 'س');
  assert.strictEqual(stmt.init.type, N.NUMBER);
  assert.strictEqual(stmt.init.value, 42);
});

test('ثابت', () => {
  const ast = parse('ثابت π = 3.14');
  assert.strictEqual(ast.body[0].type, N.CONST);
  assert.strictEqual(ast.body[0].name, 'π');
});

test('تعبير حسابي بأسبقية صحيحة', () => {
  const ast = parse('1 + 2 * 3');
  const e = ast.body[0].expr;
  assert.strictEqual(e.op, '+');
  assert.strictEqual(e.left.value, 1);
  assert.strictEqual(e.right.op, '*');
});

test('أقواس تغير الأسبقية', () => {
  const ast = parse('(1 + 2) * 3');
  const e = ast.body[0].expr;
  assert.strictEqual(e.op, '*');
  assert.strictEqual(e.left.op, '+');
});

test('جملة if مع else', () => {
  const ast = parse(`اذا صحيح {
  اطبع "نعم"
} والا {
  اطبع "لا"
}`);
  const stmt = ast.body[0];
  assert.strictEqual(stmt.type, N.IF);
  assert.strictEqual(stmt.test.type, N.BOOLEAN);
  assert.strictEqual(stmt.test.value, true);
  assert.strictEqual(stmt.consequent.type, N.BLOCK);
  assert.strictEqual(stmt.alternate.type, N.BLOCK);
});

test('جملة while', () => {
  const ast = parse(`طالما صحيح {
  اكسر
}`);
  const stmt = ast.body[0];
  assert.strictEqual(stmt.type, N.WHILE);
  assert.strictEqual(stmt.body.body[0].type, N.BREAK);
});

test('دالة مع معاملات', () => {
  const ast = parse(`دالة جمع(ا، ب) {
  ارجع ا + ب
}`);
  const fn = ast.body[0];
  assert.strictEqual(fn.type, N.FUNCTION);
  assert.strictEqual(fn.name, 'جمع');
  assert.deepStrictEqual(fn.params, ['ا', 'ب']);
  assert.strictEqual(fn.body.type, N.BLOCK);
  assert.strictEqual(fn.body.body[0].type, N.RETURN);
});

test('اطبع مع استدعاء دالة داخلي', () => {
  const ast = parse('اطبع(جمع(1، 2))');
  const printStmt = ast.body[0];
  assert.strictEqual(printStmt.type, N.PRINT);

  const innerCall = printStmt.arg;
  assert.strictEqual(innerCall.type, N.CALL);
  assert.strictEqual(innerCall.callee.name, 'جمع');
  assert.strictEqual(innerCall.args.length, 2);
  assert.strictEqual(innerCall.args[0].value, 1);
  assert.strictEqual(innerCall.args[1].value, 2);
});

test('استدعاء دالة مباشر كتعبير', () => {
  const ast = parse('جمع(1، 2)');
  const call = ast.body[0].expr;
  assert.strictEqual(call.type, N.CALL);
  assert.strictEqual(call.callee.name, 'جمع');
  assert.strictEqual(call.args.length, 2);
});

test('استدعاء متداخل', () => {
  const ast = parse('ضرب(جمع(1، 2)، 3)');
  const call = ast.body[0].expr;
  assert.strictEqual(call.type, N.CALL);
  assert.strictEqual(call.callee.name, 'ضرب');
  assert.strictEqual(call.args[0].type, N.CALL);
  assert.strictEqual(call.args[0].callee.name, 'جمع');
});

test('وصول لعضو', () => {
  const ast = parse('config.port');
  const e = ast.body[0].expr;
  assert.strictEqual(e.type, N.MEMBER);
  assert.strictEqual(e.object.name, 'config');
  assert.strictEqual(e.property, 'port');
});

test('ناقل الأنابيب |>', () => {
  const ast = parse('بيانات |> تصفية |> ترتيب');
  const e = ast.body[0].expr;
  assert.strictEqual(e.type, N.PIPE);
  assert.strictEqual(e.left.type, N.PIPE);
  assert.strictEqual(e.right.name, 'ترتيب');
});

test('مصفوفة', () => {
  const ast = parse('[1، 2، 3]');
  const e = ast.body[0].expr;
  assert.strictEqual(e.type, N.ARRAY);
  assert.strictEqual(e.elements.length, 3);
});

test('for مع in', () => {
  const ast = parse(`لكل س في [1، 2] {
  اطبع س
}`);
  const stmt = ast.body[0];
  assert.strictEqual(stmt.type, N.FOR);
  assert.strictEqual(stmt.variable, 'س');
  assert.strictEqual(stmt.iterable.type, N.ARRAY);
});

test('عامل ثلاثي المستوى ==', () => {
  const ast = parse('اذا ا == 5 { اطبع "خمسة" }');
  const test = ast.body[0].test;
  assert.strictEqual(test.type, N.BINARY);
  assert.strictEqual(test.op, '==');
});

test('خطأ: قوس مفقود', () => {
  assert.throws(() => parse('اطبع (1 + 2'), /متوقع/);
});

test('خطأ: كتلة غير مغلقة', () => {
  assert.throws(() => parse('اذا صحيح { اطبع "نعم"'), /متوقع/);
});
