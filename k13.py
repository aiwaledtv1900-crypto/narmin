p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/lexer/lexer.js'
s = open(p, encoding='utf-8').read()

# استبدل استدعاء isKeyword في readIdent
old = """  readIdent() {
    const start = this.pos;
    while (this.isAlphaNum(this.peek())) this.advance();
    const text = this.source.slice(start, this.pos);
    if (isKeyword(text)) {
      return { type: TokenType.KEYWORD, value: text, canonical: KEYWORDS[text] };
    }
    return { type: TokenType.IDENT, value: text };
  }"""

new = """  readIdent() {
    const start = this.pos;
    while (this.isAlphaNum(this.peek())) this.advance();
    let text = this.source.slice(start, this.pos);
    // جرّب النص كما هو
    if (isKeyword(text)) {
      return { type: TokenType.KEYWORD, value: text, canonical: KEYWORDS[text] };
    }
    // جرّب بعد تطبيع الأحرف الفارسية
    const normalized = normalizeArabic(text);
    if (normalized !== text && isKeyword(normalized)) {
      return { type: TokenType.KEYWORD, value: normalized, canonical: KEYWORDS[normalized] };
    }
    // معرّف — نُخزّن النص الأصلي
    return { type: TokenType.IDENT, value: text };
  }"""

if old in s:
    s = s.replace(old, new, 1)
    # تأكد من import
    if 'normalizeArabic' not in s.split('class Lexer')[0]:
        s = s.replace(
            "const { KEYWORDS, isKeyword } = require('./keywords');",
            "const { KEYWORDS, isKeyword, normalizeArabic } = require('./keywords');",
            1
        )
    open(p, 'w', encoding='utf-8').write(s)
    print("✅ readIdent محدّث")
else:
    print("⚠ لم أطابق readIdent")
