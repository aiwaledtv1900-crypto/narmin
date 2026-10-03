import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/parser/parser.js'
s = open(p, encoding='utf-8').read()
ok = []

# ═══ parseBlock ═══
old = """  parseBlock() {
    this.skipNewlines();
    this.expect(T.LBRACE, "متوقع '{'");
    const body = [];
    this.skipNewlines();
    while (!this.check(T.RBRACE) && !this.check(T.EOF)) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    this.expect(T.RBRACE, "متوقع '}'");
    return AST.Block(body);
  }"""
new = """  parseBlock() {
    const body = this.parseMixedBody(() => this.parseStatement());
    return AST.Block(body);
  }"""
if old in s:
    s = s.replace(old, new, 1)
    ok.append('parseBlock')

# ═══ parseScreen ═══
old2 = """    this.expect(T.LBRACE, "متوقع '{'");
    const children = [];
    this.skipNewlines();
    while (!this.check(T.RBRACE) && !this.check(T.EOF)) {
      if (this.checkKw('STATE') || this.checkKw('SAVED_STATE')) {
        children.push(this.parseStateDecl());
      } else {
        children.push(this.parseUIElement());
      }
      this.skipNewlines();
    }
    this.expect(T.RBRACE, "متوقع '}'");
    return AST.Screen(name, children);"""
new2 = """    const children = this.parseMixedBody(() => {
      if (this.checkKw('STATE') || this.checkKw('SAVED_STATE')) {
        return this.parseStateDecl();
      }
      return this.parseUIElement();
    });
    return AST.Screen(name, children);"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    ok.append('parseScreen')

# ═══ parseFunction ═══
old3 = """    this.expect(T.RPAREN, "متوقع ')'");
    const body = this.parseBlock();
    return AST.Function(name, params, body);"""
new3 = """    this.expect(T.RPAREN, "متوقع ')'");
    const body = AST.Block(this.parseMixedBody(() => this.parseStatement()));
    return AST.Function(name, params, body);"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    ok.append('parseFunction')

# ═══ parseIf ═══
old4 = """    this.advance();
    const test = this.parseExpression();
    const consequent = this.parseBlock();
    let alternate = null;
    this.skipNewlines();
    if (this.checkKw('ELSE')) {
      this.advance();
      alternate = this.checkKw('IF') ? this.parseIf() : this.parseBlock();
    }
    return AST.If(test, consequent, alternate);"""
new4 = """    this.advance();
    const test = this.parseExpression();
    const consequent = AST.Block(this.parseMixedBody(() => this.parseStatement(), ['ELSE']));
    let alternate = null;
    this.skipNewlines();
    if (this.checkKw('ELSE')) {
      this.advance();
      alternate = this.checkKw('IF') ? this.parseIf() : AST.Block(this.parseMixedBody(() => this.parseStatement()));
    }
    return AST.If(test, consequent, alternate);"""
if old4 in s:
    s = s.replace(old4, new4, 1)
    ok.append('parseIf')

# ═══ parseWhile ═══
old5 = """    this.advance();
    const test = this.parseExpression();
    const body = this.parseBlock();
    return AST.While(test, body);"""
new5 = """    this.advance();
    const test = this.parseExpression();
    const body = AST.Block(this.parseMixedBody(() => this.parseStatement()));
    return AST.While(test, body);"""
if old5 in s:
    s = s.replace(old5, new5, 1)
    ok.append('parseWhile')

# ═══ parseFor ═══
old6 = """    const iterable = this.parseExpression();
    const body = this.parseBlock();
    return AST.For(variable, iterable, body);"""
new6 = """    const iterable = this.parseExpression();
    const body = AST.Block(this.parseMixedBody(() => this.parseStatement()));
    return AST.For(variable, iterable, body);"""
if old6 in s:
    s = s.replace(old6, new6, 1)
    ok.append('parseFor')

# ═══ UI_BUTTON handler ═══
old7 = """      const text = this.parseExpression();
      this.expectKw('ON_CLICK', "متوقع 'عند_الضغط' بعد نص الزر");
      const handler = this.parseBlock();
      return AST.UIButton(text, handler);"""
new7 = """      const text = this.parseExpression();
      this.expectKw('ON_CLICK', "متوقع 'عند_الضغط' بعد نص الزر");
      const handler = AST.Block(this.parseMixedBody(() => this.parseStatement()));
      return AST.UIButton(text, handler);"""
if old7 in s:
    s = s.replace(old7, new7, 1)
    ok.append('UI_BUTTON')

# ═══ UI_CARD ═══
old8 = """    if (this.checkKw('UI_CARD')) {
      this.advance();
      const title = this.parseExpression();
      this.expect(T.LBRACE, "متوقع '{'");
      const children = [];
      this.skipNewlines();
      while (!this.check(T.RBRACE) && !this.check(T.EOF)) {
        children.push(this.parseUIElement());
        this.skipNewlines();
      }
      this.expect(T.RBRACE, "متوقع '}'");
      return AST.UICard(title, children);
    }"""
new8 = """    if (this.checkKw('UI_CARD')) {
      this.advance();
      const title = this.parseExpression();
      const children = this.parseMixedBody(() => this.parseUIElement());
      return AST.UICard(title, children);
    }"""
if old8 in s:
    s = s.replace(old8, new8, 1)
    ok.append('UI_CARD')

# ═══ UI_ROW ═══
old9 = """    if (this.checkKw('UI_ROW')) {
      this.advance();
      this.expect(T.LBRACE, "متوقع '{'");
      const children = [];
      this.skipNewlines();
      while (!this.check(T.RBRACE) && !this.check(T.EOF)) {
        children.push(this.parseUIElement());
        this.skipNewlines();
      }
      this.expect(T.RBRACE, "متوقع '}'");
      return AST.UIRow(children);
    }"""
new9 = """    if (this.checkKw('UI_ROW')) {
      this.advance();
      const children = this.parseMixedBody(() => this.parseUIElement());
      return AST.UIRow(children);
    }"""
if old9 in s:
    s = s.replace(old9, new9, 1)
    ok.append('UI_ROW')

# ═══ UI_LIST ═══
old10 = """    if (this.checkKw('UI_LIST')) {
      this.advance();
      const source = this.expect(T.IDENT, 'متوقع اسم المصفوفة').value;
      this.expect(T.LBRACE, "متوقع '{'");
      const template = [];
      this.skipNewlines();
      while (!this.check(T.RBRACE) && !this.check(T.EOF)) {
        template.push(this.parseUIElement());
        this.skipNewlines();
      }
      this.expect(T.RBRACE, "متوقع '}'");
      return AST.UIList(source, template);
    }"""
new10 = """    if (this.checkKw('UI_LIST')) {
      this.advance();
      const source = this.expect(T.IDENT, 'متوقع اسم المصفوفة').value;
      const template = this.parseMixedBody(() => this.parseUIElement());
      return AST.UIList(source, template);
    }"""
if old10 in s:
    s = s.replace(old10, new10, 1)
    ok.append('UI_LIST')

open(p, 'w', encoding='utf-8').write(s)
print("✅", ok)
