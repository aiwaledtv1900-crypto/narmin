p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/lexer/keywords.js'
s = open(p, encoding='utf-8').read()

# قبل module.exports، أضف دالة تطبيع داخلية
anchor = "function isKeyword(text) {"
add = """// ═══ تطبيع الأحرف العربية ═══
// الكاف الفارسية (ک U+06A9) → الكاف العربية (ك U+0643)
// الياء الفارسية (ی U+06CC) → الياء العربية (ي U+064A)
// ة (تاء مربوطة) → مطابقة أيضاً
function normalizeArabic(text) {
  return text
    .replace(/\\u06A9/g, '\\u0643')  // ک → ك
    .replace(/\\u06CC/g, '\\u064A')  // ی → ي
    .replace(/\\u06AF/g, '\\u06A4'); // گ → (نتركه)
}

function isKeyword(text) {
  return Object.prototype.hasOwnProperty.call(KEYWORDS, text);
}

function isKeywordNormalized(text) {
  if (isKeyword(text)) return text;
  const normalized = normalizeArabic(text);
  if (isKeyword(normalized)) return normalized;
  return null;
}"""
if anchor in s and 'normalizeArabic' not in s:
    s = s.replace(anchor, add, 1)
    s = s.replace("module.exports = { KEYWORDS, isKeyword };",
                  "module.exports = { KEYWORDS, isKeyword, isKeywordNormalized, normalizeArabic };", 1)
    open(p, 'w', encoding='utf-8').write(s)
    print("✅ normalizeArabic")
else:
    print("ℹ موجودة")
