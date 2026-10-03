import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

# في IF: نُغلّف الاختبار بـ "== true" إذا كان غير Boolean
old = """    } else if (stmt.type === N.IF) {
      const test = exprToKotlin(stmt.test, stateVars, LOCAL_VARS);
      lines.push(`${indent}if (${test}) {`);"""

new = """    } else if (stmt.type === N.IF) {
      let test = exprToKotlin(stmt.test, stateVars, LOCAL_VARS);
      // إذا الاختبار MAP access → غلّفه بـ ?: false
      if (test.includes('["')) {
        test = `(${test} as? Boolean ?: false)`;
      }
      lines.push(`${indent}if (${test}) {`);"""

if old in s:
    s = s.replace(old, new, 1)
    print("✅ patch16: IF يتحقق من النوع")
else:
    print("⚠ لم أطابق IF")

open(p, 'w', encoding='utf-8').write(s)
