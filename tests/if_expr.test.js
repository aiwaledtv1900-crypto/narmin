'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { run } = require('../src/interpreter/interpreter');

function exec(src) {
  return run(src).output;
}

test('if-expr: صحيح', () => {
  const [out] = exec('اطبع اذا صحيح { "نعم" } والا { "لا" }');
  assert.strictEqual(out, 'نعم');
});

test('if-expr: خطأ', () => {
  const [out] = exec('اطبع اذا خطأ { "نعم" } والا { "لا" }');
  assert.strictEqual(out, 'لا');
});

test('if-expr: داخل متغير', () => {
  const [out] = exec(`
متغير عمر = 25
متغير حالة = اذا عمر >= 18 { "بالغ" } والا { "قاصر" }
اطبع حالة
`);
  assert.strictEqual(out, 'بالغ');
});

test('if-expr: قاصر', () => {
  const [out] = exec(`
متغير عمر = 15
متغير حالة = اذا عمر >= 18 { "بالغ" } والا { "قاصر" }
اطبع حالة
`);
  assert.strictEqual(out, 'قاصر');
});

test('if-expr: بدون والا → عدم', () => {
  const [out] = exec('اطبع اذا خطأ { "نعم" }');
  assert.strictEqual(out, 'عدم');
});

test('if-expr: مع حساب', () => {
  const [out] = exec(`
متغير درجة = 85
متغير نتيج = اذا درجة >= 90 { "A" } والا { اذا درجة >= 80 { "B" } والا { "C" } }
اطبع نتيج
`);
  assert.strictEqual(out, 'B');
});

test('if-expr: داخل دالة', () => {
  const [out] = exec(`
دالة تصنيف(س) {
  ارجع اذا س > 0 { "موجب" } والا { "سالب أو صفر" }
}
اطبع تصنيف(5)
اطبع تصنيف(-1)
`);
  assert.strictEqual(out, 'موجب');
});

test('if-expr: داخل سلسلة', () => {
  const [out] = exec(`
متغير س = 5
اطبع "القيمة: " + اذا س > 3 { "كبيرة" } والا { "صغيرة" }
`);
  assert.strictEqual(out, 'القيمة: كبيرة');
});

test('if-expr: متداخل', () => {
  const [out] = exec(`
دالة فئة(س) {
  ارجع اذا س > 100 { "ضخم" } والا { اذا س > 10 { "كبير" } والا { "صغير" } }
}
اطبع فئة(50)
`);
  assert.strictEqual(out, 'كبير');
});

test('if-expr: كتلة متعددة الجمل', () => {
  const [out] = exec(`
متغير نتيجة = اذا صحيح {
  متغير x = 10
  متغير y = 20
  x + y
} والا {
  0
}
اطبع نتيجة
`);
  assert.strictEqual(out, '30');
});
