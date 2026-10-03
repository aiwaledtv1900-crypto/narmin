p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/parser/parser.js'
s = open(p, encoding='utf-8').read()
ok = []

# HEADING
old = """    if (this.checkKw('HEADING')) {
      this.advance();
      return AST.UIHeading(this.parseExpression());
    }"""
new = """    if (this.checkKw('HEADING')) {
      this.advance();
      const text = this.parseExpression();
      const colorRef = this.parseColorModifier();
      return AST.UIHeading(text, colorRef);
    }"""
if old in s:
    s = s.replace(old, new, 1)
    ok.append('HEADING')

# UI_TEXT
old2 = """    if (this.checkKw('UI_TEXT')) {
      this.advance();
      return AST.UIText(this.parseExpression());
    }"""
new2 = """    if (this.checkKw('UI_TEXT')) {
      this.advance();
      const expr = this.parseExpression();
      const colorRef = this.parseColorModifier();
      return AST.UIText(expr, colorRef);
    }"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    ok.append('UI_TEXT')

# UI_BUTTON
old3 = """    if (this.checkKw('UI_BUTTON')) {
      this.advance();
      const text = this.parseExpression();
      this.expectKw('ON_CLICK', "متوقع 'عند_الضغط' بعد نص الزر");
      const handler = AST.Block(this.parseMixedBody(() => this.parseStatement()));
      return AST.UIButton(text, handler);
    }"""
new3 = """    if (this.checkKw('UI_BUTTON')) {
      this.advance();
      const text = this.parseExpression();
      const colorRef = this.parseColorModifier();
      this.expectKw('ON_CLICK', "متوقع 'عند_الضغط' بعد نص الزر");
      const handler = AST.Block(this.parseMixedBody(() => this.parseStatement()));
      return AST.UIButton(text, handler, colorRef);
    }"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    ok.append('UI_BUTTON')

open(p, 'w', encoding='utf-8').write(s)
print("✅", ok)
