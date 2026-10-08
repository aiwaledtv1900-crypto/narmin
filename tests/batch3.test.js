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
test('ويب — WebView', () => {
  const n = firstUI(`شاشة "ت"\n  ويب "https://example.com"\nنهاية`, 'UIWebView');
  assert.ok(n);
  assert.strictEqual(n.url.value, 'https://example.com');
});
test('فيديو', () => {
  const n = firstUI(`شاشة "ت"\n  فيديو "https://v.mp4"\nنهاية`, 'UIVideo');
  assert.ok(n);
});
test('صوت', () => {
  const n = firstUI(`شاشة "ت"\n  صوت "https://a.mp3"\nنهاية`, 'UIAudio');
  assert.ok(n);
});
