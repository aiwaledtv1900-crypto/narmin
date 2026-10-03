p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

if "node.callee.name === 'جلب'" in s:
    print("ℹ موجود")
else:
    # السطر 147 هو: if (node.callee.type === N.IDENTIFIER && node.callee.name === 'نص') {
    anchor = "      if (node.callee.type === N.IDENTIFIER && node.callee.name === 'نص') {"
    if anchor not in s:
        raise SystemExit("⚠ anchor نص")
    add = """      if (node.callee.type === N.IDENTIFIER && node.callee.name === 'جلب') {
        const url = exprToKotlin(node.args[0], stateVars);
        return `httpGet((${url}).toString())`;
      }
""" + anchor
    s = s.replace(anchor, add, 1)
    open(p, 'w', encoding='utf-8').write(s)
    print("✅ جلب في exprToKotlin")
