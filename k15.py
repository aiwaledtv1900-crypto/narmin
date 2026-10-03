p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/lexer/keywords.js'
s = open(p, encoding='utf-8').read()

# ابحث عن آخر "};" لكائن KEYWORDS
idx_close = s.find("};")
if idx_close == -1:
    raise SystemExit("⚠ لم أجد };")

# احتفظ فقط بالجزء قبل أول }; + الـ };
s = s[:idx_close+2]

# أضف الذيل النظيف
tail = """

// ═══ تطبيع الأحرف الفارسية ═══
function normalizeArabic(text) {
  return String(text)
    .replace(/\\u06A9/g, '\\u0643')
    .replace(/\\u06CC/g, '\\u064A');
}

function isKeyword(text) {
  return Object.prototype.hasOwnProperty.call(KEYWORDS, text);
}

function isKeywordNormalized(text) {
  if (isKeyword(text)) return text;
  const normalized = normalizeArabic(text);
  if (isKeyword(normalized)) return normalized;
  return null;
}

module.exports = { KEYWORDS, isKeyword, isKeywordNormalized, normalizeArabic };
"""

s = s + tail
open(p, 'w', encoding='utf-8').write(s)
print("✅ إصلاح")
print("عدد الكلمات:", s.count("':"))
print("آخر 3 أسطر:")
print("\n".join(s.split("\n")[-4:]))
