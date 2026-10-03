import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/parser/parser.js'
s = open(p, encoding='utf-8').read()
ok = []

# 1) parseStatement: أضف صلاحية + لون + StyleDecl
old = """    if (this.checkKw('ANDROID_PERMISSION')) {
      this.advance();
      return AST.AndroidPermission(this.expect(T.STRING, 'متوقع اسم الصلاحية').value);
    }"""
new = """    if (this.checkKw('ANDROID_PERMISSION')) {
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
    }"""
if old in s:
    s = s.replace(old, new, 1)
    ok.append('parseStatement-styles')
else:
    ok.append('SKIP-parseStatement')

# 2) داخل parseScreen: اعرض StyleDecl
old2 = """    const children = this.parseMixedBody(() => {
      if (this.checkKw('STATE') || this.checkKw('SAVED_STATE')) {
        return this.parseStateDecl();
      }
      return this.parseUIElement();
    });
    return AST.Screen(name, children);"""
new2 = """    const children = this.parseMixedBody(() => {
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
    return AST.Screen(name, children);"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    ok.append('parseScreen-styles')

# 3) parseUIElement — بعد كل عنصر، افحص "بلون 'X'"
# نضيف دالة مساعدة: parseColorModifier
anchor = "  parseBlock() {"
add_helper = """  // يقرأ "بلون 'اسم'" إن وُجد ويُرجع اسم النمط
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

  parseBlock() {"""
if anchor in s and 'parseColorModifier' not in s:
    s = s.replace(anchor, add_helper, 1)
    ok.append('parseColorModifier')

open(p, 'w', encoding='utf-8').write(s)
print("✅", ok)
