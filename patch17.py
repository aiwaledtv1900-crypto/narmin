import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

# 1) في IF: إذا كان الاختبار MEMBER → اكتب == true
old = """    } else if (stmt.type === N.IF) {
      let test = exprToKotlin(stmt.test, stateVars, LOCAL_VARS);
      // إذا الاختبار MAP access → غلّفه بـ ?: false
      if (test.includes('["')) {
        test = `(${test} as? Boolean ?: false)`;
      }
      lines.push(`${indent}if (${test}) {`);"""

new = """    } else if (stmt.type === N.IF) {
      let test = exprToKotlin(stmt.test, stateVars, LOCAL_VARS);
      // إذا كان الاختبار MEMBER (وصول لخريطة) → قارنه بـ true
      if (stmt.test.type === N.MEMBER || test.includes('["')) {
        test = `(${test} == true)`;
      }
      lines.push(`${indent}if (${test}) {`);"""

if old in s:
    s = s.replace(old, new, 1)
    print("✅ patch17: IF يقارن بـ true")
else:
    print("⚠ لم أطابق IF block")
    # نسخة بديلة: ابحث عن أي نمط
    m = re.search(r"(} else if \(stmt\.type === N\.IF\) \{[\s\S]*?lines\.push\(`\$\{indent\}if \(\$\{test\}\) \{`\);)", s)
    if m:
        old2 = m.group(1)
        new2 = """} else if (stmt.type === N.IF) {
      let test = exprToKotlin(stmt.test, stateVars, LOCAL_VARS);
      if (stmt.test.type === N.MEMBER) {
        test = `(${test} == true)`;
      }
      lines.push(`${indent}if (${test}) {`);"""
        s = s.replace(old2, new2, 1)
        print("✅ patch17-alt")
    else:
        print("⚠ لم أطابق أبداً")

open(p, 'w', encoding='utf-8').write(s)
