import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

# ═══ 1) في handlerToKotlin: نتتبّع المتغيرات المحلية التي تساوي httpGet ═══
old = """function handlerToKotlin(block, indent, stateVars) {
  const lines = [];"""
if old not in s:
    raise SystemExit("⚠ handlerToKotlin بداية")

new = """function handlerToKotlin(block, indent, stateVars) {
  const lines = [];
  // متتبّع المتغيرات المحلية: اسم → نوع (مثلاً 'http')
  const LOCAL_VARS = new Map();"""
s = s.replace(old, new, 1)

# ═══ 2) عند LET: احفظ النوع لو كان httpGet ═══
old2 = """    } else if (stmt.type === N.LET || stmt.type === N.CONST) {
      // متغير محلي داخل المعالج — استخدم var/val Kotlin
      const keyword = stmt.type === N.CONST ? 'val' : 'var';
      if (stmt.init) {
        const value = exprToKotlin(stmt.init, stateVars);
        lines.push(`${indent}${keyword} ${stmt.name} = ${value}`);
      } else {
        lines.push(`${indent}${keyword} ${stmt.name}: Any? = null`);
      }
    }"""

new2 = """    } else if (stmt.type === N.LET || stmt.type === N.CONST) {
      // متغير محلي داخل المعالج
      const keyword = stmt.type === N.CONST ? 'val' : 'var';
      if (stmt.init) {
        // إذا كان httpGet → احفظ النوع
        if (stmt.init.type === N.CALL && stmt.init.callee.type === N.IDENTIFIER && stmt.init.callee.name === 'جلب') {
          LOCAL_VARS.set(stmt.name, 'http');
          lines.push(`${indent}${keyword} ${stmt.name} = httpGet((${exprToKotlin(stmt.init.args[0], stateVars)}).toString())`);
        } else {
          const value = exprToKotlin(stmt.init, stateVars, LOCAL_VARS);
          lines.push(`${indent}${keyword} ${stmt.name} = ${value}`);
        }
      } else {
        lines.push(`${indent}${keyword} ${stmt.name}: Any? = null`);
      }
    }"""
s = s.replace(old2, new2, 1)

# ═══ 3) نقل LOCAL_VARS لـ exprToKotlin — نُعدّل الوظيفة لتقبل arg ═══
# ابحث عن توقيع exprToKotlin
m = re.search(r"function exprToKotlin\(node, stateVars\) \{", s)
if not m:
    raise SystemExit("⚠ exprToKotlin signature")

s = s.replace(
    "function exprToKotlin(node, stateVars) {",
    "function exprToKotlin(node, stateVars, localVars = null) {",
    1
)

# ═══ 4) في MEMBER: إذا الكائن معرّف بـ localVars كنوع 'http' → استخدم ["..."] ═══
old4 = """case N.MEMBER: {
      const obj = node.object;
      if (obj.type === N.IDENTIFIER && obj.name === 'build') {
        return BUILD_MAP[node.property] || `Build.${node.property}`;
      }
      if (obj.type === N.CALL && obj.callee.type === N.IDENTIFIER && obj.callee.name === 'جلب') {
        return `(${exprToKotlin(obj, stateVars)})["${node.property}"]`;
      }
      return `${exprToKotlin(obj, stateVars)}.${node.property}`;
    }"""

new4 = """case N.MEMBER: {
      const obj = node.object;
      if (obj.type === N.IDENTIFIER && obj.name === 'build') {
        return BUILD_MAP[node.property] || `Build.${node.property}`;
      }
      if (obj.type === N.CALL && obj.callee.type === N.IDENTIFIER && obj.callee.name === 'جلب') {
        return `(${exprToKotlin(obj, stateVars, localVars)})["${node.property}"]`;
      }
      // متغيّر محلي من نوع http
      if (obj.type === N.IDENTIFIER && localVars && localVars.get(obj.name) === 'http') {
        return `(${obj.name})["${node.property}"]`;
      }
      return `${exprToKotlin(obj, stateVars, localVars)}.${node.property}`;
    }"""
s = s.replace(old4, new4, 1)

open(p, 'w', encoding='utf-8').write(s)
print("✅ patch8 مطبَّق")
