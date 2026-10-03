import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

# ابحث عن httpGet المكسور
pattern = r"private fun httpGet\(url: String\): MutableMap<String, Any> \{[\s\S]*?\n    \}"

new_fn = '''private fun httpGet(url: String): MutableMap<String, Any> {
        android.util.Log.d("narmin-http", "start: " + url)
        var result: MutableMap<String, Any> = mutableMapOf("نجح" to false, "جسم" to "", "كود" to 0, "خطأ" to "initial")
        val thread = Thread {
            try {
                val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Narmin)")
                val code = conn.responseCode
                android.util.Log.d("narmin-http", "code: " + code.toString())
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
                result = mutableMapOf("نجح" to (code in 200..299), "جسم" to body, "كود" to code, "خطأ" to (if (code in 200..299) "" else "HTTP " + code.toString()))
            } catch (e: Exception) {
                android.util.Log.e("narmin-http", "ERR: " + e.javaClass.simpleName + ": " + (e.message ?: ""))
                result = mutableMapOf("نجح" to false, "جسم" to "", "كود" to 0, "خطأ" to (e.javaClass.simpleName + ": " + (e.message ?: "")))
            }
        }
        thread.start()
        thread.join(20000)
        android.util.Log.d("narmin-http", "done")
        return result
    }'''

count = len(re.findall(pattern, s))
s = re.sub(pattern, new_fn, s)
open(p, 'w', encoding='utf-8').write(s)
print(f"✅ استبدلت {count} نسخة بـ escape")
