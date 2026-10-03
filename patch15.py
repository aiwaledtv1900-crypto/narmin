import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

# ابحث عن كتلة MEMBER الأخيرة (patch14)
m = re.search(r"case N\.MEMBER: \{[\s\S]*?\n    \}", s)
if not m:
    raise SystemExit("⚠ MEMBER")

new = """case N.MEMBER: {
      const obj = node.object;
      if (obj.type === N.IDENTIFIER && obj.name === 'build') {
        return BUILD_MAP[node.property] || `Build.${node.property}`;
      }
      if (obj.type === N.CALL && obj.callee.type === N.IDENTIFIER && obj.callee.name === 'جلب') {
        return `(${exprToKotlin(obj, stateVars, localVars)})["${node.property}"] as? Boolean ?: (${exprToKotlin(obj, stateVars, localVars)})["${node.property}"]`;
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

s = s.replace(m.group(0), new, 1)
open(p, 'w', encoding='utf-8').write(s)
print("✅ patch15")
