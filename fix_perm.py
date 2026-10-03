import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/stdlib/android.js'
s = open(p, encoding='utf-8').read()

# احذف hasHttp القديم (الذي أُضيف في المكان الخطأ)
old_block_pattern = r"\n  // فحص استخدام HTTP → إضافة INTERNET\n[\s\S]*?\n  if \(hasHttp && !permissions\.includes\('android\.permission\.INTERNET'\)\) \{\n    permissions\.push\('android\.permission\.INTERNET'\);\n  \}\n"
s = re.sub(old_block_pattern, "\n", s)

# الآن نضيفه بعد تعريف permissions (وهو يأتي بعد find screens loop)
anchor = """  if (screens.length === 0) {
    throw new Error('لا توجد "شاشة" في ملف نارمين');
  }"""

if anchor not in s:
    raise SystemExit("⚠ anchor screens.length")

add = anchor + """

  // فحص استخدام HTTP → إضافة INTERNET
  const hasHttp = (function scan(items) {
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      if (it.type === 'HttpGet') return true;
      if (it.type === 'CallExpr' && it.callee && it.callee.name === 'جلب') return true;
      for (const k of Object.keys(it)) {
        const v = it[k];
        if (Array.isArray(v) && scan(v)) return true;
        if (v && typeof v === 'object' && v.type && scan([v])) return true;
      }
    }
    return false;
  })(screens.flatMap(sc => sc.children));
  if (hasHttp && !permissions.includes('android.permission.INTERNET')) {
    permissions.push('android.permission.INTERNET');
  }"""

s = s.replace(anchor, add, 1)

open(p, 'w', encoding='utf-8').write(s)
print("✅ ترتيب صحيح")
