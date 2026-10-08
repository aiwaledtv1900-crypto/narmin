'use strict';

const { tokenize } = require('../lexer/lexer');
const { TokenType: T } = require('../lexer/token');
const { AST } = require('../ast/nodes');

class Parser {
  constructor(tokens, source = '') {
    this.tokens = tokens;
    this.pos = 0;
    this.source = source;
  }

  peek(offset = 0) { return this.tokens[this.pos + offset] || this.tokens[this.tokens.length - 1]; }
  current() { return this.tokens[this.pos]; }
  advance() { return this.tokens[this.pos++]; }

  check(type) { return this.current().type === type; }
  checkKw(canonical) {
    const t = this.current();
    return t.type === T.KEYWORD && t.canonical === canonical;
  }

  match(...types) {
    if (types.includes(this.current().type)) { this.advance(); return true; }
    return false;
  }
  matchKw(...canonicals) {
    const t = this.current();
    if (t.type === T.KEYWORD && canonicals.includes(t.canonical)) { this.advance(); return true; }
    return false;
  }

  expect(type, msg) {
    if (!this.check(type)) this.error(msg || `متوقع ${type}`);
    return this.advance();
  }
  expectKw(canonical, msg) {
    if (!this.checkKw(canonical)) this.error(msg || `متوقع '${canonical}'`);
    return this.advance();
  }

  error(msg) {
    const t = this.current();
    throw new Error(`${msg} — السطر ${t.line}، العمود ${t.col} (وجدنا ${t.type}${t.value ? ` "${t.value}"` : ''})`);
  }

  skipNewlines() {
    while (this.check(T.NEWLINE) || this.check(T.SEMICOLON)) this.advance();
  }

  parseProgram() {
    const body = [];
    this.skipNewlines();
    while (!this.check(T.EOF)) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    return AST.Program(body);
  }

  // ═══ الجمل ═══
  parseStatement() {
    if (this.checkKw('PRINT')) return this.parsePrint();
    if (this.checkKw('LET')) return this.parseLet(false);
    if (this.checkKw('CONST')) return this.parseLet(true);
    if (this.checkKw('IF')) return this.parseIf();
    if (this.checkKw('WHILE')) return this.parseWhile();
    if (this.checkKw('FOR')) return this.parseFor();
    if (this.checkKw('FUNCTION')) return this.parseFunction();
    if (this.checkKw('SCREEN')) return this.parseScreen();
    if (this.checkKw('IMPORT')) return this.parseImport();
    if (this.checkKw('KOTLIN_IMPORT')) {
      this.advance();
      return AST.KotlinImport(this.expect(T.STRING, 'متوقع مسار import').value);
    }
    if (this.checkKw('GRADLE_DEP')) {
      this.advance();
      return AST.GradleDep(this.expect(T.STRING, 'متوقع مواصفة مكتبة').value);
    }
    if (this.checkKw('ANDROID_PERMISSION')) {
      this.advance();
      return AST.AndroidPermission(this.expect(T.STRING, 'متوقع اسم الصلاحية').value);
    }
    if (this.checkKw('STYLE_SET')) {
      this.advance();
      // لون 'اسم' "قيمة"
      let name;
      if (this.check(T.STRING)) name = this.advance().value;
      else name = this.expect(T.IDENT, 'متوقع اسم النمط').value;
      const value = this.expect(T.STRING, 'متوقع قيمة اللون').value;
      return AST.StyleSet(name, value);
    }
    // نص1 "اسود" — IDENT يتبعه STRING
    if (this.check(T.IDENT) && this.peek(1) && this.peek(1).type === T.STRING) {
      const name = this.advance().value;
      const value = this.advance().value;
      return AST.StyleDecl(name, value);
    }
    if (this.checkKw('KOTLIN_RAW')) {
      this.advance();
      return AST.KotlinRaw(this.expect(T.STRING, 'متوقع كود Kotlin').value);
    }
    if (this.checkKw('APP_ICON')) return this.parseAppIcon();
    if (this.checkKw('NAVIGATE')) {
      this.advance();
      return AST.Navigate(this.expect(T.STRING, 'متوقع اسم الشاشة').value);
    }
    if (this.checkKw('TOAST')) {
      this.advance();
      return AST.Toast(this.parseExpression());
    }
    if (this.checkKw('ALERT')) {
      this.advance();
      const title = this.parseExpression();
      const message = this.parseExpression();
      let handler = null;
      if (this.checkKw('ON_CLICK')) {
        this.advance();
        handler = this.parseBlock();
      }
      return AST.Alert(title, message, handler);
    }
    if (this.checkKw('BACK')) {
      this.advance();
      return AST.Back();
    }
    if (this.checkKw('SNACKBAR')) {
      this.advance();
      return AST.Snackbar(this.parseExpression());
    }
    if (this.checkKw('OPEN_URL')) {
      this.advance();
      return AST.OpenUrl(this.parseExpression());
    }
    if (this.checkKw('SHARE_TEXT')) {
      this.advance();
      return AST.ShareText(this.parseExpression());
    }
    if (this.checkKw('DIAL')) {
      this.advance();
      return AST.Dial(this.parseExpression());
    }
    if (this.checkKw('CLIP_COPY')) {
      this.advance();
      return AST.ClipCopy(this.parseExpression());
    }
    if (this.checkKw('SEND_NOTIFICATION')) {
      this.advance();
      const title = this.parseExpression();
      const body = this.parseExpression();
      return AST.SendNotification(title, body);
    }
    if (this.checkKw('TRY')) return this.parseTry();
    if (this.checkKw('THROW')) return this.parseThrow();
    if (this.checkKw('RETURN')) return this.parseReturn();
    if (this.checkKw('BREAK')) { this.advance(); return AST.Break(); }
    if (this.checkKw('CONTINUE')) { this.advance(); return AST.Continue(); }
    if (this.check(T.LBRACE)) return this.parseBlock();

    return this.parseAssignOrExpr();
  }

  // جملة إسناد أو تعبير عادي
  parseAssignOrExpr() {
    const expr = this.parseExpression();

    if (this.check(T.ASSIGN)) {
      // الهدف يجب أن يكون identifier أو member أو index
      if (expr.type !== 'Identifier' && expr.type !== 'MemberExpr' && expr.type !== 'IndexExpr') {
        this.error('هدف الإسناد يجب أن يكون متغيراً أو خاصية');
      }
      this.advance(); // =
      const value = this.parseExpression();
      return AST.Assign(expr, value);
    }

    return AST.ExprStmt(expr);
  }

  parsePrint() {
    this.advance();
    const arg = this.parseExpression();
    return AST.Print(arg);
  }

  parseLet(isConst) {
    this.advance();

    // أسماء المتغيرات يمكن أن تطابق كلمة محجوزة،
    // مثل: حالة، قائمة — عندما تظهر في موضع اسم المتغير.
    let name;
    if (this.check(T.IDENT) || this.check(T.KEYWORD)) {
      name = this.advance().value;
    } else {
      this.error('متوقع اسم المتغير');
    }

    let init = null;
    if (this.match(T.ASSIGN)) init = this.parseExpression();
    return isConst ? AST.Const(name, init) : AST.Let(name, init, true);
  }

  parseIf() {
    this.advance();
    const test = this.parseExpression();
    const consequent = AST.Block(this.parseMixedBody(() => this.parseStatement(), ['ELSE']));
    let alternate = null;
    this.skipNewlines();
    if (this.checkKw('ELSE')) {
      this.advance();
      alternate = this.checkKw('IF') ? this.parseIf() : AST.Block(this.parseMixedBody(() => this.parseStatement()));
    }
    return AST.If(test, consequent, alternate);
  }

  parseWhile() {
    this.advance();
    const test = this.parseExpression();
    const body = AST.Block(this.parseMixedBody(() => this.parseStatement()));
    return AST.While(test, body);
  }

  parseFor() {
    this.advance();
    const variable = this.expect(T.IDENT, 'متوقع اسم متغير في for').value;
    this.expectKw('IN', "متوقع 'في' أو 'in'").value;
    const iterable = this.parseExpression();
    const body = AST.Block(this.parseMixedBody(() => this.parseStatement()));
    return AST.For(variable, iterable, body);
  }

  parseFunction() {
    this.advance();
    let name;
    if (this.check(T.IDENT)) name = this.advance().value;
    else if (this.check(T.KEYWORD)) name = this.advance().value;
    else this.error('متوقع اسم الدالة');
    this.expect(T.LPAREN, "متوقع '('");
    this.skipNewlines();
    const params = [];
    while (!this.check(T.RPAREN) && !this.check(T.EOF)) {
      params.push(this.expect(T.IDENT, 'متوقع اسم معامل').value);
      this.skipNewlines();
      if (!this.match(T.COMMA)) break;
      this.skipNewlines();
    }
    this.expect(T.RPAREN, "متوقع ')'");
    const body = AST.Block(this.parseMixedBody(() => this.parseStatement()));
    return AST.Function(name, params, body);
  }

  parseReturn() {
    this.advance();
    let arg = null;
    if (!this.check(T.NEWLINE) && !this.check(T.SEMICOLON) && !this.check(T.RBRACE) && !this.check(T.EOF)) {
      arg = this.parseExpression();
    }
    return AST.Return(arg);
  }

  // ═══ واجهات أندرويد ═══
  parseScreen() {
    this.advance(); // شاشة
    const name = this.expect(T.STRING, 'متوقع اسم الشاشة').value;
    const children = this.parseMixedBody(() => {
      if (this.checkKw('STATE') || this.checkKw('SAVED_STATE')) {
        return this.parseStateDecl();
      }
      if (this.checkKw('STYLE_SET')) {
        return this.parseStatement();
      }
      if (this.check(T.IDENT) && this.peek(1) && this.peek(1).type === T.STRING) {
        return this.parseStatement();
      }
      return this.parseUIElement();
    });
    return AST.Screen(name, children);
  }

  parseUIElement() {
    if (this.checkKw('HEADING')) {
      this.advance();
      const text = this.parseExpression();
      const colorRef = this.parseColorModifier();
      const props = this.parseProps();
      return AST.UIHeading(text, colorRef, props);
    }
    if (this.checkKw('UI_TEXT')) {
      this.advance();
      const expr = this.parseExpression();
      const colorRef = this.parseColorModifier();
      const props = this.parseProps();
      return AST.UIText(expr, colorRef, props);
    }
    if (this.checkKw('UI_BUTTON')) {
      this.advance();
      const text = this.parseExpression();
      const colorRef = this.parseColorModifier();
      const props = this.parseProps();
      this.expectKw('ON_CLICK', "متوقع 'عند_الضغط' بعد نص الزر");
      const handler = AST.Block(this.parseMixedBody(() => this.parseStatement()));
      return AST.UIButton(text, handler, colorRef, props);
    }
    if (this.checkKw('UI_CARD')) {
      this.advance();
      const title = this.parseExpression();
      const props = this.parseProps();
      const children = this.parseMixedBody(() => this.parseUIElement());
      return AST.UICard(title, children, props);
    }
    if (this.checkKw('UI_TEXTFIELD')) {
      this.advance();
      const hint = this.parseExpression();
      let binding = null;
      if (this.checkKw('AS')) {
        this.advance();
        binding = this.expect(T.IDENT, 'متوقع اسم المتغير').value;
      }
      const props = this.parseProps();
      return AST.UITextField(hint, binding, props);
    }
    if (this.checkKw('UI_IMAGE')) {
      this.advance();
      return AST.UIImage(this.parseExpression());
    }
    if (this.checkKw('UI_CHECKBOX')) {
      this.advance();
      return AST.UICheckBox(this.parseExpression());
    }
    if (this.checkKw('UI_SWITCH')) {
      this.advance();
      return AST.UISwitch(this.parseExpression());
    }
    if (this.checkKw('UI_DROPDOWN')) {
      this.advance();
      const hint = this.parseExpression();
      let varName = null;
      if (this.checkKw('AS')) { this.advance(); varName = this.expect(T.IDENT, 'متوقع اسم المتغير').value; }
      let items = [];
      if (this.checkKw('FROM')) {
        this.advance();
        const arr = this.parseExpression();
        if (arr && arr.elements) items = arr.elements.map(e => (e && e.value !== undefined) ? String(e.value) : '');
      }
      const props = this.parseProps();
      return AST.UIDropdown(hint, varName, items, props);
    }
    if (this.checkKw('UI_DATE')) {
      this.advance();
      const hint = this.parseExpression();
      let varName = null;
      if (this.checkKw('AS')) { this.advance(); varName = this.expect(T.IDENT, 'متوقع اسم المتغير').value; }
      const props = this.parseProps();
      return AST.UIDate(hint, varName, props);
    }
    if (this.checkKw('UI_TIME')) {
      this.advance();
      const hint = this.parseExpression();
      let varName = null;
      if (this.checkKw('AS')) { this.advance(); varName = this.expect(T.IDENT, 'متوقع اسم المتغير').value; }
      const props = this.parseProps();
      return AST.UITime(hint, varName, props);
    }
    if (this.checkKw('UI_DRAWER')) {
      this.advance();
      const title = this.parseExpression();
      const children = this.parseMixedBody(() => this.parseUIElement());
      return AST.UIDrawer(title, children);
    }
    if (this.checkKw('UI_TABBAR')) {
      this.advance();
      let tabs = [];
      if (this.check('LBRACKET')) {
        this.advance();
        tabs.push(this.parseExpression());
        while (this.check('COMMA')) { this.advance(); tabs.push(this.parseExpression()); }
        if (this.check('RBRACKET')) this.advance();
      }
      const children = this.parseMixedBody(() => this.parseUIElement());
      return AST.UITabBar(tabs, children);
    }
    if (this.checkKw('UI_WEBVIEW')) {
      this.advance();
      const url = this.parseExpression();
      const props = this.parseProps();
      return AST.UIWebView(url, props);
    }
    if (this.checkKw('UI_VIDEO')) {
      this.advance();
      const src = this.parseExpression();
      const props = this.parseProps();
      return AST.UIVideo(src, props);
    }
    if (this.checkKw('UI_AUDIO')) {
      this.advance();
      const src = this.parseExpression();
      const props = this.parseProps();
      return AST.UIAudio(src, props);
    }
    if (this.checkKw('UI_MAP')) {
      this.advance();
      const lat = this.parseExpression();
      this.expect(T.COMMA, 'متوقع , بعد خط العرض');
      const lng = this.parseExpression();
      let zoom = null;
      if (this.check(T.COMMA)) { this.advance(); zoom = this.parseExpression(); }
      const props = this.parseProps();
      return AST.UIMap(lat, lng, zoom, props);
    }
    if (this.checkKw('UI_CHART')) {
      this.advance();
      // اقرأ نوع الرسم كـ STRING مباشر (لتجنّب التباس الفهرس x[...])
      let chartType;
      if (this.check('STRING')) {
        const tok = this.advance();
        chartType = { type: 'StringLiteral', value: tok.value };
      } else {
        chartType = this.parseExpression();
      }
      const values = this.parseExpression();
      let labels = null;
      if (this.check('COMMA')) { this.advance(); labels = this.parseExpression(); }
      const props = this.parseProps();
      return AST.UIChart(values, labels, chartType, props);
    }
    if (this.checkKw('UI_DATE_DLG')) {
      this.advance();
      let varName = null;
      if (this.checkKw('AS')) { this.advance(); varName = this.expect(T.IDENT, 'متوقع اسم المتغير').value; }
      const props = this.parseProps();
      return AST.UIDateDialog(varName, props);
    }
    if (this.checkKw('UI_COLOR_DLG')) {
      this.advance();
      let varName = null;
      if (this.checkKw('AS')) { this.advance(); varName = this.expect(T.IDENT, 'متوقع اسم المتغير').value; }
      const props = this.parseProps();
      return AST.UIColorDialog(varName, props);
    }
    if (this.checkKw('UI_PROGRESS')) {
      this.advance();
      return AST.UIProgress(this.parseExpression());
    }
    if (this.checkKw('UI_ROW')) {
      this.advance();
      const children = this.parseMixedBody(() => this.parseUIElement());
      return AST.UIRow(children);
    }
    if (this.checkKw('UI_SPACER')) {
      this.advance();
      let size = null;
      if (!this.check(T.NEWLINE) && !this.check(T.RBRACE) && !this.check(T.SEMICOLON) && !this.check(T.EOF)) {
        size = this.parseExpression();
      }
      return AST.UISpacer(size);
    }
    if (this.checkKw('UI_DIVIDER')) {
      this.advance();
      return AST.UIDivider();
    }
    if (this.checkKw('KOTLIN_RAW')) {
      this.advance();
      return AST.KotlinRaw(this.expect(T.STRING, 'متوقع كود Kotlin').value);
    }
    if (this.checkKw('NAVIGATE')) {
      this.advance();
      return AST.Navigate(this.expect(T.STRING, 'متوقع اسم الشاشة').value);
    }
    if (this.checkKw('TOAST')) {
      this.advance();
      return AST.Toast(this.parseExpression());
    }
    if (this.checkKw('ALERT')) {
      this.advance();
      const title = this.parseExpression();
      const message = this.parseExpression();
      let handler = null;
      if (this.checkKw('ON_CLICK')) {
        this.advance();
        handler = this.parseBlock();
      }
      return AST.Alert(title, message, handler);
    }
    if (this.checkKw('BACK')) {
      this.advance();
      return AST.Back();
    }
    if (this.checkKw('UI_DONE')) {
      this.advance();
      return AST.UIDone();
    }
    if (this.checkKw('UI_TOPBAR')) {
      return this.parseTopBar();
    }
    if (this.checkKw('BOTTOM_SHEET')) {
      this.advance();
      const title = this.parseExpression();
      this.expect(T.LBRACE, "متوقع '{'");
      const items = [];
      this.skipNewlines();
      while (!this.check(T.RBRACE) && !this.check(T.EOF)) {
        items.push(this.parseExpression());
        this.skipNewlines();
        if (!this.match(T.COMMA)) break;
        this.skipNewlines();
      }
      this.expect(T.RBRACE, "متوقع '}'");
      return AST.BottomSheet(title, items);
    }
    if (this.checkKw('TAB_LAYOUT')) {
      this.advance();
      this.expect(T.LBRACE, "متوقع '{'");
      const tabs = [];
      this.skipNewlines();
      while (!this.check(T.RBRACE) && !this.check(T.EOF)) {
        tabs.push(this.parseExpression());
        this.skipNewlines();
        if (!this.match(T.COMMA)) break;
        this.skipNewlines();
      }
      this.expect(T.RBRACE, "متوقع '}'");
      return AST.TabLayout(tabs);
    }
    if (this.checkKw('UI_LIST')) {
      this.advance();
      const source = this.expect(T.IDENT, 'متوقع اسم المصفوفة').value;
      const template = this.parseMixedBody(() => this.parseUIElement());
      return AST.UIList(source, template);
    }
    this.error('متوقع عنصر واجهة');
  }

  // دالة كتعبير (lambda)
  parseFunctionExpr() {
    this.advance(); // دالة
    this.expect(T.LPAREN, "متوقع '('");
    this.skipNewlines();
    const params = [];
    while (!this.check(T.RPAREN) && !this.check(T.EOF)) {
      params.push(this.expect(T.IDENT, 'متوقع اسم معامل').value);
      this.skipNewlines();
      if (!this.match(T.COMMA)) break;
      this.skipNewlines();
    }
    this.expect(T.RPAREN, "متوقع ')'");
    const body = this.parseBlock();
    return AST.Function('', params, body);
  }

  parseStateDecl() {
    const isSaved = this.checkKw('SAVED_STATE');
    this.advance(); // حالة / محفوظ
    const name = this.expect(T.IDENT, 'متوقع اسم الحالة').value;
    this.expect(T.ASSIGN, "متوقع '=' بعد اسم الحالة");
    const init = this.parseExpression();
    return AST.StateDecl(name, init, isSaved);
  }

  // ═══ تحليل جسم كتلة — يقبل { ... } أو ... نهاية ═══
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

  // يقرأ "بلون 'اسم'" إن وُجد ويُرجع اسم النمط
  parseColorModifier() {
    if (this.checkKw('WITH_COLOR')) {
      this.advance();
      let name;
      if (this.check(T.STRING)) name = this.advance().value;
      else name = this.expect(T.IDENT, 'متوقع اسم النمط').value;
      return name;
    }
    return null;
  }

  // ═══ الشريط العلوي ═══
  parseTopBar() {
    this.advance();
    const props = this.parseProps();
    return AST.UITopBar(props);
  }

  // ═══ قراءة الخصائص — ( لون X حجم Y حواف Z ) ═══
  parseProps() {
    const props = {};
    if (!this.check(T.LPAREN)) return props;

    this.advance();
    this.skipNewlines();

    // ترجمة المفاتيح — عربي أو إنجليزي، IDENT أو KEYWORD
    const KEY_MAP = {
      'لون': 'color', 'color': 'color',
      'حجم': 'size', 'size': 'size',
      'نص': 'text', 'text': 'text',
      'حواف': 'corners', 'corners': 'corners',
      'العرض': 'width', 'width': 'width',
      'الطول': 'height', 'height': 'height',
      'نوع': 'kind', 'kind': 'kind',
      'شكل': 'shape', 'shape': 'shape',
    };
    // مفاتيح بوصفها كلمات مفتاحية
    const KW_MAP = {
      'STYLE_SET': 'color',
      'STYLE_SIZE': 'size',
      'UI_TEXT': 'text',
      'STYLE_CORNERS': 'corners',
      'STYLE_WIDTH': 'width',
      'STYLE_HEIGHT': 'height',
      'STYLE_KIND': 'kind',
      'STYLE_SHAPE': 'shape',
    };

    while (!this.check(T.RPAREN) && !this.check(T.EOF)) {
      this.skipNewlines();
      if (this.check(T.RPAREN)) break;

      const keyTok = this.current();
      let key = null;

      if (keyTok.type === T.IDENT) {
        const raw = keyTok.value;
        key = KEY_MAP[raw] || null;
        if (key) this.advance();
      } else if (keyTok.type === T.KEYWORD) {
        // جرب الكلمة المفتاحية
        if (KW_MAP[keyTok.canonical]) {
          key = KW_MAP[keyTok.canonical];
          this.advance();
        } else if (KEY_MAP[keyTok.value]) {
          key = KEY_MAP[keyTok.value];
          this.advance();
        }
      }

      if (!key) break;
      this.skipNewlines();
      if (this.check(T.RPAREN) || this.check(T.EOF)) break;

      const value = this.parseExpression();
      props[key] = value;
      this.skipNewlines();
    }

    if (this.check(T.RPAREN)) this.advance();
    return props;
  }

  parseAppIcon() {
    this.advance();
    const props = {};

    // ═══ الصيغة 1: ايقونة ( نص "..." لون "..." شكل "..." ) ═══
    if (this.check(T.LPAREN)) {
      Object.assign(props, this.parseProps());
      return AST.AppIcon(props);
    }

    // ═══ الصيغة 2: ايقونة "نص حر" ═══
    if (this.check(T.STRING)) {
      const tok = this.advance();
      const rawText = String(tok.value || '');

      // ═══ هل هو مسار صورة؟ (.png/.jpg/.jpeg/.webp/.gif/.bmp) ═══
      if (/\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(rawText.trim())) {
        props.imagePath = rawText.trim();
        // خصائص إضافية
        const extra = this.parseProps();
        Object.assign(props, extra);
        return AST.AppIcon(props);
      }

      // اكتشف إن كان وصفاً غنيّاً (فيه كلمات مفتاحية للرسم الذكي)
      const richKeywords = ['لمبة','لمبه','قلب','نجمة','نجمه','صاعقة','صاعقه',
        'سحابة','سحابه','قفل','مفتاح','بيت','منزل','شمس','قمر','مثلث','معيّن',
        'سداسي','خمسي','صح','x','سهم','حرف','حروف','حرفين','أرقام','ارقام',
        'رقم','مكتوب','خلفية','عليها','عليه','يحمل'];
      const isRich = richKeywords.some(k => rawText.includes(k)) || rawText.split(/\s+/).length >= 3;

      if (isRich) {
        props.description = rawText;
        props.text = rawText; // fallback
      } else {
        props.text = tok.value;
      }

      // خصائص إضافية بعد النص
      const extra = this.parseProps();
      Object.assign(props, extra);
      return AST.AppIcon(props);
    }

    return AST.AppIcon(props);
  }

  // ═══ استورد "file" كـ alias ═══
  parseImport() {
    this.advance(); // استورد
    const path = this.expect(T.STRING, 'متوقع مسار الملف').value;
    let alias = null;
    // كـ اسم (اختياري)
    if (this.checkKw('AS')) {
      this.advance();
      if (this.check(T.IDENT)) alias = this.advance().value;
      else if (this.check(T.KEYWORD)) alias = this.advance().value;
    }
    return AST.Import(null, path, alias);
  }

  // ═══ جرب / التقط / اخيرا ═══
  parseTry() {
    this.advance(); // جرب

    // استخدم parseMixedBody مع stop keywords
    const tryBody = this.parseMixedBody(() => this.parseStatement(), ['CATCH', 'FINALLY']);
    const tryBlock = AST.Block(tryBody);

    let catchParam = null;
    let catchBlock = null;
    let finallyBlock = null;

    this.skipNewlines();
    if (this.checkKw('CATCH')) {
      this.advance();
      if (this.check(T.IDENT)) {
        catchParam = this.advance().value;
      } else if (this.check(T.KEYWORD)) {
        catchParam = this.advance().value;
      } else if (this.check(T.STRING)) {
        catchParam = this.advance().value;
      }
      const catchBody = this.parseMixedBody(() => this.parseStatement(), ['FINALLY']);
      catchBlock = AST.Block(catchBody);
      this.skipNewlines();
    }

    if (this.checkKw('FINALLY')) {
      this.advance();
      const finallyBody = this.parseMixedBody(() => this.parseStatement());
      finallyBlock = AST.Block(finallyBody);
    }

    return AST.Try(tryBlock, catchParam, catchBlock, finallyBlock);
  }

  // ═══ ارم (throw) ═══
  parseThrow() {
    this.advance();
    let arg = null;
    if (!this.check(T.NEWLINE) && !this.check(T.SEMICOLON) &&
        !this.check(T.RBRACE) && !this.check(T.EOF)) {
      arg = this.parseExpression();
    }
    return AST.Throw(arg);
  }

  parseBlock() {
    const body = this.parseMixedBody(() => this.parseStatement());
    return AST.Block(body);
  }

  // ═══ التعابير ═══
  parseExpression() { return this.parsePipe(); }

  parsePipe() {
    let left = this.parseOr();
    while (this.match(T.PIPE)) {
      const right = this.parseOr();
      left = AST.Pipe(left, right);
    }
    return left;
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.matchKw('OR_KW') || this.match(T.OR)) {
      const right = this.parseAnd();
      left = AST.Binary('||', left, right);
    }
    return left;
  }

  parseAnd() {
    let left = this.parseEquality();
    while (this.matchKw('AND_KW') || this.match(T.AND)) {
      const right = this.parseEquality();
      left = AST.Binary('&&', left, right);
    }
    return left;
  }

  parseEquality() {
    let left = this.parseComparison();
    while (this.check(T.EQ) || this.check(T.NEQ)) {
      const op = this.advance().type === T.EQ ? '==' : '!=';
      const right = this.parseComparison();
      left = AST.Binary(op, left, right);
    }
    return left;
  }

  parseComparison() {
    let left = this.parseTerm();
    while (this.check(T.LT) || this.check(T.GT) || this.check(T.LTE) || this.check(T.GTE)) {
      const tok = this.advance();
      const map = { LT: '<', GT: '>', LTE: '<=', GTE: '>=' };
      const right = this.parseTerm();
      left = AST.Binary(map[tok.type], left, right);
    }
    return left;
  }

  parseTerm() {
    let left = this.parseFactor();
    while (this.check(T.PLUS) || this.check(T.MINUS)) {
      const op = this.advance().type === T.PLUS ? '+' : '-';
      const right = this.parseFactor();
      left = AST.Binary(op, left, right);
    }
    return left;
  }

  parseFactor() {
    let left = this.parseUnary();
    while (this.check(T.STAR) || this.check(T.SLASH) || this.check(T.PERCENT)) {
      const tok = this.advance();
      const map = { STAR: '*', SLASH: '/', PERCENT: '%' };
      const right = this.parseUnary();
      left = AST.Binary(map[tok.type], left, right);
    }
    return left;
  }

  parseUnary() {
    if (this.check(T.MINUS) || this.check(T.NOT) || this.checkKw('NOT_KW')) {
      const tok = this.advance();
      const op = tok.type === T.MINUS ? '-' : '!';
      const arg = this.parseUnary();
      return AST.Unary(op, arg, true);
    }
    return this.parseCall();
  }

  parseCall() {
    let expr = this.parsePrimary();
    const isCallable = () => {
      const t = expr.type;
      return t === 'Identifier' || t === 'MemberExpr' || t === 'CallExpr';
    };
    while (true) {
      if (this.check(T.LPAREN) && isCallable()) {
        // افحص إن كان هناك فراغ قبل ( في النص الأصلي
        const tok = this.current();
        let hasSpace = false;
        if (this.source && tok.line && tok.col) {
          // نبحث عن الحرف قبل ( في السطر
          const lines = this.source.split('\n');
          const lineText = lines[tok.line - 1] || '';
          const chBefore = lineText[tok.col - 2]; // -2 لأن col 1-based
          hasSpace = chBefore === ' ' || chBefore === '\t';
        }
        if (hasSpace) break; // مسافة → خصائص، ليست استدعاء

        this.advance();
        this.skipNewlines();
        const args = [];
        while (!this.check(T.RPAREN) && !this.check(T.EOF)) {
          args.push(this.parseExpression());
          this.skipNewlines();
          if (!this.match(T.COMMA)) break;
          this.skipNewlines();
        }
        this.expect(T.RPAREN, "متوقع ')'");
        expr = AST.Call(expr, args);
      } else if (this.check(T.DOT)) {
        this.advance();
        const tok = this.current();
        if (tok.type === T.IDENT) {
          this.advance();
          expr = AST.Member(expr, tok.value);
        } else if (tok.type === T.KEYWORD) {
          this.advance();
          expr = AST.Member(expr, tok.value);
        } else {
          this.error('متوقع اسم خاصية بعد النقطة');
        }
      } else if (this.check(T.LBRACKET)) {
        this.advance();
        const idx = this.parseExpression();
        this.expect(T.RBRACKET, "متوقع ']'");
        expr = AST.Index(expr, idx);
      } else break;
    }
    return expr;
  }

  parsePrimary() {
    const tok = this.current();

    if (tok.type === T.NUMBER) { this.advance(); return AST.Number(tok.value); }
    if (tok.type === T.STRING) { this.advance(); return AST.String(tok.value); }
    if (tok.type === T.IDENT) { this.advance(); return AST.Identifier(tok.value); }

    if (tok.type === T.KEYWORD) {
      if (tok.canonical === 'TRUE') { this.advance(); return AST.Boolean(true); }
      if (tok.canonical === 'FALSE') { this.advance(); return AST.Boolean(false); }
      if (tok.canonical === 'NULL') { this.advance(); return AST.Null(); }
      if (tok.canonical === 'HTTP_GET') {
        this.advance();
        return AST.Identifier('جلب');
      }
      // العنصر → معرّف خاص داخل القوائم
      if (tok.canonical === 'ITEM') { this.advance(); return AST.Identifier('العنصر'); }
      // احذف_من → استدعاء دالة عادي
      if (tok.canonical === 'REMOVE_FROM') { this.advance(); return AST.Identifier('احذف_من'); }
    }

    if (this.match(T.LPAREN)) {
      const expr = this.parseExpression();
      this.expect(T.RPAREN, "متوقع ')'");
      return expr;
    }

    if (this.checkKw('FUNCTION')) return this.parseFunctionExpr();
    if (this.check(T.LBRACKET)) return this.parseArray();
    if (this.check(T.LBRACE)) return this.parseObject();
    if (this.checkKw('IF')) return this.parseIfExpr();

    // كلمات مفتاحية كمعرّفات (مثل: مربع، متوسط، كامل)
    if (this.check(T.KEYWORD)) {
      const t = this.advance();
      return AST.Identifier(t.value);
    }

    this.error('تعبير غير متوقع');
  }

  // if كتعبير — يُرجع قيمة
  parseIfExpr() {
    this.advance(); // اذا
    const test = this.parseExpression();
    const consequent = this.parseValueBlock();
    this.skipNewlines();
    let alternate = null;
    if (this.checkKw('ELSE')) {
      this.advance();
      alternate = this.checkKw('IF') ? this.parseIfExpr() : this.parseValueBlock();
    }
    return AST.IfExpr(test, consequent, alternate);
  }

  // كتلة قيمة — { expr } أو { اطبع... } أو حتى { if... return... }
  // للـ if-expr: الكتلة يجب أن تكون إما { expr } واحدة أو { statements... }
  parseValueBlock() {
    this.skipNewlines();
    this.expect(T.LBRACE, "متوقع '{'");
    this.skipNewlines();

    const body = [];
    while (!this.check(T.RBRACE) && !this.check(T.EOF)) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    this.expect(T.RBRACE, "متوقع '}'");
    return AST.Block(body);
  }

  parseObject() {
    this.advance(); // {
    const properties = [];
    this.skipNewlines();
    while (!this.check(T.RBRACE) && !this.check(T.EOF)) {
      // المفتاح: ident أو نص أو كلمة مفتاحية (نسمح بكل الحالات)
      const keyTok = this.current();
      let key;
      if (keyTok.type === T.IDENT) {
        key = keyTok.value;
        this.advance();
      } else if (keyTok.type === T.STRING) {
        key = keyTok.value;
        this.advance();
      } else if (keyTok.type === T.KEYWORD) {
        // اسمح للكلمات المفتاحية كمفاتيح (مثل: نوع، قيمة)
        key = keyTok.value;
        this.advance();
      } else if (keyTok.type === T.NUMBER) {
        key = String(keyTok.value);
        this.advance();
      } else {
        this.error('متوقع اسم خاصية');
      }

      this.expect(T.COLON, "متوقع ':' بعد اسم الخاصية");
      const value = this.parseExpression();
      properties.push({ key, value });

      this.skipNewlines();
      if (!this.match(T.COMMA)) break;
      this.skipNewlines();
    }
    this.expect(T.RBRACE, "متوقع '}'");
    return AST.Object(properties);
  }

  parseArray() {
    this.advance();
    const elements = [];
    this.skipNewlines();
    while (!this.check(T.RBRACKET) && !this.check(T.EOF)) {
      elements.push(this.parseExpression());
      this.skipNewlines();
      if (!this.match(T.COMMA)) break;
      this.skipNewlines();
    }
    this.expect(T.RBRACKET, "متوقع ']'");
    return AST.Array(elements);
  }
}

function parse(source) {
  const tokens = tokenize(source);
  return new Parser(tokens, source).parseProgram();
}

module.exports = { Parser, parse };
