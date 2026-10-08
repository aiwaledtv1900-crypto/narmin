const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../src/parser/parser.js');
function firstUI(src, type) {
  const ast = parse(src);
  function find(nodes) {
    for (const n of nodes || []) {
      if (n.type === type) return n;
      if (n.children) { const r = find(n.children); if (r) return r; }
    }
    return null;
  }
  return find(ast.body);
}
test('خريطة — خط عرض وخط طول', () => {
  const src = `شاشة "ت"\n  خريطة 30.0444، 31.2357، 15\nنهاية`;
  const n = firstUI(src, 'UIMap');
  assert.ok(n, 'UIMap not found');
  assert.strictEqual(n.lat.value, 30.0444);
  assert.strictEqual(n.lng.value, 31.2357);
});
test('رسم_بياني — أعمدة', () => {
  const src = `شاشة "ت"\n  رسم_بياني "أعمدة" [10، 20، 30]، ["أ"، "ب"، "ج"]\nنهاية`;
  const n = firstUI(src, 'UIChart');
  assert.ok(n, 'UIChart not found');
  assert.strictEqual(n.values.elements.length, 3);
});
