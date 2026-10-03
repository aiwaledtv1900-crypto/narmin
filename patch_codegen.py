import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()
changed = []

# 1) جلب في exprToKotlin
if "node.callee.name === 'جلب'" not in s:
    m = re.search(r"(if \(node\.callee\.name === 'احذف_من'\) \{[\s\S]*?\n        \})", s)
    if m:
        s = s.replace(m.group(1), m.group(1) + "\n        if (node.callee.name === 'جلب') {\n          return `httpGet(${exprToKotlin(node.args[0], stateVars)}.toString())`;\n        }", 1)
        changed.append('1-jalb')

# 2) httpGet
if 'fun httpGet(' not in s:
    a = "    private fun formatNumber(n: Double): String {"
    if a in s:
        add = '    private fun httpGet(url: String): MutableMap<String, Any> {\n        return try {\n            val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection\n            conn.requestMethod = "GET"\n            conn.connectTimeout = 15000\n            conn.readTimeout = 15000\n            val code = conn.responseCode\n            val stream = if (code in 200..299) conn.inputStream else conn.errorStream\n            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""\n            mutableMapOf("نجح" to (code in 200..299), "جسم" to body, "كود" to code, "خطأ" to (if (code in 200..299) "" else "HTTP $code"))\n        } catch (e: Exception) {\n            mutableMapOf("نجح" to false, "جسم" to "", "كود" to 0, "خطأ" to (e.message ?: "فشل"))\n        }\n    }\n\n' + a
        s = s.replace(a, add, 1)
        changed.append('2-httpGet')

# 3) MEMBER
if "obj.callee.name === 'جلب'" not in s:
    m = re.search(r"(case N\.MEMBER: \{[\s\S]*?return `\$\{exprToKotlin\(obj, stateVars\)\}\.\$\{node\.property\}`;\s*\n    \})", s)
    if m:
        old = m.group(1)
        new = 'case N.MEMBER: {\n      const obj = node.object;\n      if (obj.type === N.IDENTIFIER && obj.name === \'build\') {\n        return BUILD_MAP[node.property] || `Build.${node.property}`;\n      }\n      if (obj.type === N.CALL && obj.callee.type === N.IDENTIFIER && obj.callee.name === \'جلب\') {\n        return `(${exprToKotlin(obj, stateVars)})["${node.property}"]`;\n      }\n      return `${exprToKotlin(obj, stateVars)}.${node.property}`;\n    }'
        s = s.replace(old, new, 1)
        changed.append('3-member')

open(p, 'w', encoding='utf-8').write(s)
print("✅ تغييرات:", changed)
