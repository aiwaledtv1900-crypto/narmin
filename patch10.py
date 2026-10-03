import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

# 1) handlerToKotlin يجب أن يقبل LOCAL_VARS من الأعلى
old = """function handlerToKotlin(block, indent, stateVars) {
  const lines = [];
  // متتبّع المتغيرات المحلية: اسم → نوع (مثلاً 'http')
  const LOCAL_VARS = new Map();"""

new = """function handlerToKotlin(block, indent, stateVars, parentLocalVars = null) {
  const lines = [];
  // متتبّع المتغيرات المحلية: اسم → نوع
  const LOCAL_VARS = parentLocalVars || new Map();"""

if old not in s:
    raise SystemExit("⚠ handlerToKotlin")
s = s.replace(old, new, 1)

# 2) IF: مرر LOCAL_VARS
old2 = """    } else if (stmt.type === N.IF) {
      const test = exprToKotlin(stmt.test, stateVars, LOCAL_VARS);
      lines.push(`${indent}if (${test}) {`);
      lines.push(handlerToKotlin(stmt.consequent, indent + '    ', stateVars));
      if (stmt.alternate) {
        lines.push(`${indent}} else {`);
        lines.push(handlerToKotlin(stmt.alternate, indent + '    ', stateVars));
      }
      lines.push(`${indent}}`);
    }"""

new2 = """    } else if (stmt.type === N.IF) {
      const test = exprToKotlin(stmt.test, stateVars, LOCAL_VARS);
      lines.push(`${indent}if (${test}) {`);
      lines.push(handlerToKotlin(stmt.consequent, indent + '    ', stateVars, LOCAL_VARS));
      if (stmt.alternate) {
        lines.push(`${indent}} else {`);
        lines.push(handlerToKotlin(stmt.alternate, indent + '    ', stateVars, LOCAL_VARS));
      }
      lines.push(`${indent}}`);
    }"""

if old2 not in s:
    raise SystemExit("⚠ IF block")
s = s.replace(old2, new2, 1)

open(p, 'w', encoding='utf-8').write(s)
print("✅ patch10: LOCAL_VARS مشترك بين IF والكتل")
