p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/parser/parser.js'
s = open(p, encoding='utf-8').read()

if 'parseMixedBody' in s:
    print("ℹ موجودة")
else:
    anchor = "  parseBlock() {"
    if anchor not in s:
        raise SystemExit("⚠ anchor parseBlock")
    
    add = """  // ═══ تحليل جسم كتلة — يقبل { ... } أو ... نهاية ═══
  parseMixedBody(parseInner, stopKws = []) {
    // النمط القديم: { ... }
    if (this.check(T.LBRACE)) {
      this.advance();
      const body = [];
      this.skipNewlines();
      while (!this.check(T.RBRACE) && !this.check(T.EOF)) {
        body.push(parseInner());
        this.skipNewlines();
      }
      this.expect(T.RBRACE, "متوقع '}'");
      return body;
    }
    // النمط الجديد: ... نهاية (أو حتى كلمة توقف)
    const body = [];
    this.skipNewlines();
    while (!this.checkKw('END') && !this.check(T.EOF)) {
      let stop = false;
      for (const kw of stopKws) {
        if (this.checkKw(kw)) { stop = true; break; }
      }
      if (stop) break;
      body.push(parseInner());
      this.skipNewlines();
    }
    // اقبل نهاية إن كانت متوقعة (فقط لو لا يوجد stopKws متطابق)
    if (stopKws.length === 0 || !stopKws.some(kw => this.checkKw(kw))) {
      if (!this.checkKw('END')) {
        this.error("متوقع 'نهاية' أو '{'");
      }
      this.advance();
    }
    return body;
  }

  parseBlock() {"""
    
    s = s.replace(anchor, add, 1)
    open(p, 'w', encoding='utf-8').write(s)
    print("✅ parseMixedBody")
