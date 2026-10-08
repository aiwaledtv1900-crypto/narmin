const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../src/parser/parser.js');

function firstUI(src) {
  const ast = parse(src);
  function find(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'UIDrawer' || n.type === 'UITabBar') return n;
      if (n.children) { const r = find(n.children); if (r) return r; }
    }
    return null;
  }
  return find(ast.body);
}

test('شريط_جانب', () => {
  const n = firstUI(`شاشة "ت"\n  شريط_جانب "قائمتي"\n  نهاية\nنهاية`);
  assert.strictEqual(n.type, 'UIDrawer');
});

test('شريط_تبويب — مع تبويبات', () => {
  const src = `شاشة "ت"\n  شريط_تبويب ["أ"، "ب"، "ج"]\n  نهاية\nنهاية`;
  const n = firstUI(src);
  assert.strictEqual(n.type, 'UITabBar');
  assert.strictEqual(n.tabs.length, 3);
});
