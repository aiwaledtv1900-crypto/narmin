import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()
changed = []

# 1) جلب في exprToKotlin
if "node.callee.name === 'جلب'" not in s:
    # ابحث عن أي مكان به node.callee.name === 'نص' أو 'نسّق'
    anchor = re.search(r"(if \(node\.callee\.name === 'نسّق'\) \{[\s\S]*?return `formatNumber\(\$\{exprToKotlin\(node\.args\[0\], stateVars\)\}\)`;\s*\n        \})", s)
    if anchor:
        add = anchor.group(1) + "\n        if (node.callee.name === 'جلب') {\n          return `httpGet(${exprToKotlin(node.args[0], stateVars)}.toString())`;\n        }"
        s = s.replace(anchor.group(1), add, 1)
        changed.append('1-jalb')
    else:
        # fallback — ابحث عن أي 'نص' كمرساة
        anchor2 = re.search(r"(if \(node\.callee\.name === 'نص'\) \{[\s\S]*?\n        \})", s)
        if anchor2:
            add = anchor2.group(1) + "\n        if (node.callee.name === 'جلب') {\n          return `httpGet(${exprToKotlin(node.args[0], stateVars)}.toString())`;\n        }"
            s = s.replace(anchor2.group(1), add, 1)
            changed.append('1-jalb-alt')

# 3) MEMBER
if "obj.callee.name === 'جلب'" not in s:
    m = re.search(r"(case N\.MEMBER: \{[\s\S]*?\n    \})", s)
    if m:
        old = m.group(1)
        # نبني الجديد
        new = """case N.MEMBER: {
      const obj = node.object;
      if (obj.type === N.IDENTIFIER && obj.name === 'build') {
        return BUILD_MAP[node.property] || `Build.${node.property}`;
      }
      if (obj.type === N.CALL && obj.callee.type === N.IDENTIFIER && obj.callee.name === 'جلب') {
        return `(${exprToKotlin(obj, stateVars)})["${node.property}"]`;
      }
      return `${exprToKotlin(obj, stateVars)}.${node.property}`;
    }"""
        s = s.replace(old, new, 1)
        changed.append('3-member')

open(p, 'w', encoding='utf-8').write(s)
print("✅ تغييرات:", changed)
