const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../src/parser/parser.js');

function firstUI(src) {
  const ast = parse(src);
  // ابحث عن أول عقدة UI في الشجرة
  function find(nodes) {
    for (const n of nodes || []) {
      if (n.type && (n.type.startsWith('UI') || n.type === 'UIDropdown' || n.type === 'UIDate' || n.type === 'UITime')) return n;
      if (n.children) { const r = find(n.children); if (r) return r; }
      if (n.body) { const r = find(n.body); if (r) return r; }
    }
    return null;
  }
  return find(ast.body);
}

test('قائمة منسدلة — كامل', () => {
  const src = `شاشة "ت"\n  قائمة_منسدلة "اختر" كـ مدينة من ["القاهرة"، "الرياض"]\nنهاية`;
  const dd = firstUI(src);
  assert.strictEqual(dd.type, 'UIDropdown');
  assert.strictEqual(dd.hint.value, 'اختر');
  assert.strictEqual(dd.varName, 'مدينة');
  assert.strictEqual(dd.items.length, 2);
  assert.strictEqual(dd.items[0], 'القاهرة');
});

test('تاريخ — مع متغير', () => {
  const src = `شاشة "ت"\n  تاريخ "اختر تاريخ" كـ د\nنهاية`;
  const n = firstUI(src);
  assert.strictEqual(n.type, 'UIDate');
  assert.strictEqual(n.hint.value, 'اختر تاريخ');
  assert.strictEqual(n.varName, 'د');
});

test('وقت — بدون متغير', () => {
  const src = `شاشة "ت"\n  وقت "اختر وقت"\nنهاية`;
  const n = firstUI(src);
  assert.strictEqual(n.type, 'UITime');
  assert.strictEqual(n.hint.value, 'اختر وقت');
  assert.strictEqual(n.varName, null);
});
