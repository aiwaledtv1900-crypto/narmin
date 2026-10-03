p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

# ابحث عن بداية generateMultiProject
idx = s.find('function generateMultiProject')
if idx == -1:
    raise SystemExit("⚠ لم أجد generateMultiProject")

# ابحث عن أول idCounter = 0 بعدها
start = s.find('idCounter = 0;', idx)
if start == -1:
    raise SystemExit("⚠ لم أجد idCounter")

# ابحث عن "// ولّد كل شاشة" — نقطة البناء
build_anchor = s.find('// ولّد كل شاشة', start)
if build_anchor == -1:
    raise SystemExit("⚠ لم أجد // ولّد كل شاشة")

# نُدرج قبل build_anchor
insert = """  // اضبط الأنماط والألوان
  STYLES = extra.styles || new Map();
  try {
    const pal = require('../natural/palettes');
    _colorResolver = pal.resolveColorSmart || null;
  } catch (_) { _colorResolver = null; }

"""

s = s[:build_anchor] + insert + s[build_anchor:]

open(p, 'w', encoding='utf-8').write(s)
print("✅ STYLES مضبوط في generateMultiProject")
