p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

if s.count('private fun httpGet') >= 1:
    print(f"ℹ httpGet موجود ({s.count('private fun httpGet')} نسخة)")
else:
    # نبحث عن القالب الرئيسي في generateMultiProject (وليس generateProject)
    # القالب يحتوي على 'private fun formatNumber'
    import re
    # نستبدل كل occurrence
    pattern = "    private fun formatNumber(n: Double): String {"
    matches = [m.start() for m in re.finditer(re.escape(pattern), s)]
    print(f"عدد formatNumber: {len(matches)}")
    
    if not matches:
        raise SystemExit("⚠ لم أجد formatNumber")
    
    http_fn = """    private fun httpGet(url: String): MutableMap<String, Any> {
        return try {
            val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            mutableMapOf("نجح" to (code in 200..299), "جسم" to body, "كود" to code, "خطأ" to (if (code in 200..299) "" else "HTTP $code"))
        } catch (e: Exception) {
            mutableMapOf("نجح" to false, "جسم" to "", "كود" to 0, "خطأ" to (e.message ?: "فشل"))
        }
    }

"""
    # أضف قبل كل formatNumber
    s = s.replace(pattern, http_fn + pattern)
    
    open(p, 'w', encoding='utf-8').write(s)
    print(f"✅ أضفت httpGet {len(matches)} مرة")
