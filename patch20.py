import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

if "case N.INDEX:" in s:
    print("ℹ INDEX موجود")
else:
    # ابحث عن case N.MEMBER كمرساة
    m = re.search(r"(case N\.MEMBER: \{[\s\S]*?\n    \})", s)
    if not m:
        raise SystemExit("⚠ MEMBER")
    anchor = m.group(1)
    new_block = anchor + """
    case N.INDEX: {
      const obj = node.object;
      const idx = node.index;
      // رد["نجح"] → (رد as MutableMap<String, Any>)["نجح"]
      if (obj.type === N.IDENTIFIER && idx.type === N.STRING) {
        return `((${obj.name}) as MutableMap<String, Any>)["${idx.value}"]`;
      }
      return `${exprToKotlin(obj, stateVars, localVars)}[${exprToKotlin(idx, stateVars, localVars)}]`;
    }"""
    s = s.replace(anchor, new_block, 1)
    open(p, 'w', encoding='utf-8').write(s)
    print("✅ patch20: INDEX")
