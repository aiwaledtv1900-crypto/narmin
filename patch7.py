import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

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

# ابحث عن كل formatNumber في القالب (داخل template strings)
# نستبدل كل "    private fun formatNumber" بـ http_fn + "    private fun formatNumber"
# لكن نتحقق أن httpGet ليس قبلها مباشرة في نفس القالب

# الطريقة الأبسط: استبدل كل ظهور لـ formatNumber
count = s.count("    private fun formatNumber(n: Double): String {")
print(f"formatNumber occurrences: {count}")

# اطبع السياق حول كل واحدة
for i, m in enumerate(re.finditer(re.escape("    private fun formatNumber(n: Double): String {"), s)):
    before = s[max(0, m.start()-2000):m.start()]
    has_http = 'private fun httpGet' in before[-1000:] if len(before) > 1000 else 'private fun httpGet' in before
    print(f"  #{i+1} at pos {m.start()}: httpGet before = {has_http}")

# استبدل كل واحدة بـ http_fn + formatNumber إذا لم يكن httpGet قبلها
result = []
last = 0
for m in re.finditer(re.escape("    private fun formatNumber(n: Double): String {"), s):
    before = s[max(0, m.start()-2000):m.start()]
    has_http = 'private fun httpGet' in before
    result.append(s[last:m.start()])
    if not has_http:
        result.append(http_fn)
    result.append("    private fun formatNumber(n: Double): String {")
    last = m.end()
result.append(s[last:])
s = ''.join(result)

open(p, 'w', encoding='utf-8').write(s)
print(f"✅ الآن httpGet: {s.count('private fun httpGet')} نسخة")
