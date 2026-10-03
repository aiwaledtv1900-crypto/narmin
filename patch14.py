p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

old = """case N.MEMBER: {
      const obj = node.object;
      if (obj.type === N.IDENTIFIER && obj.name === 'build') {
        return BUILD_MAP[node.property] || `Build.${node.property}`;
      }
      // إذا الكائن نداء جلب(...) → استخدم ["..."]
      if (obj.type === N.CALL && obj.callee.type === N.IDENTIFIER && obj.callee.name === 'جلب') {
        return `(${exprToKotlin(obj, stateVars)})["${node.property}"]`;
      }
      return `${exprToKotlin(obj, stateVars)}.${node.property}`;
    }"""

if old not in s:
    print("⚠ لم أطابق بالضبط — نحاول نسخة مختلفة")
    # نسخة بديلة بلا تعليق
    old = """case N.MEMBER: {
      const obj = node.object;
      if (obj.type === N.IDENTIFIER && obj.name === 'build') {
        return BUILD_MAP[node.property] || `Build.${node.property}`;
      }
      if (obj.type === N.CALL && obj.callee.type === N.IDENTIFIER && obj.callee.name === 'جلب') {
        return `(${exprToKotlin(obj, stateVars)})["${node.property}"]`;
      }
      return `${exprToKotlin(obj, stateVars)}.${node.property}`;
    }"""

if old not in s:
    raise SystemExit("❌ لم أطابق MEMBER أبداً")

new = """case N.MEMBER: {
      const obj = node.object;
      if (obj.type === N.IDENTIFIER && obj.name === 'build') {
        return BUILD_MAP[node.property] || `Build.${node.property}`;
      }
      if (obj.type === N.CALL && obj.callee.type === N.IDENTIFIER && obj.callee.name === 'جلب') {
        return `(${exprToKotlin(obj, stateVars, localVars)})["${node.property}"]`;
      }
      if (obj.type === N.IDENTIFIER && localVars && localVars.get(obj.name) === 'http') {
        return `((${obj.name}) as MutableMap<String, Any>)["${node.property}"]`;
      }
      if (obj.type === N.IDENTIFIER && stateVars && stateVars.has(obj.name)) {
        return `STATE_${obj.name}.${node.property}`;
      }
      if (obj.type === N.IDENTIFIER) {
        return `((${obj.name}) as MutableMap<String, Any>)["${node.property}"]`;
      }
      return `${exprToKotlin(obj, stateVars, localVars)}.${node.property}`;
    }"""

s = s.replace(old, new, 1)
open(p, 'w', encoding='utf-8').write(s)
print("✅ patch14: MEMBER محدّث")
