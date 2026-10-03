p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/lexer/lexer.js'
s = open(p, encoding='utf-8').read()

old = """      if (this.isAlpha(ch)) {
        const t = this.readIdent();
        this.tokens.push({ ...t, line, col });
        continue;
      }"""

new = """      if (this.isAlpha(ch)) {
        const t = this.readIdent();
        // تعليق: تخطَّ حتى نهاية السطر
        if (t.type === TokenType.KEYWORD && t.canonical === 'COMMENT') {
          while (this.pos < this.source.length && this.peek() !== '\\n') {
            this.advance();
          }
          continue;
        }
        this.tokens.push({ ...t, line, col });
        continue;
      }"""

if old in s:
    s = s.replace(old, new, 1)
    open(p, 'w', encoding='utf-8').write(s)
    print("✅ تعليق يُتخطى")
else:
    print("⚠ لم أطابق")
