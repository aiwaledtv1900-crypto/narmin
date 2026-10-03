import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

idx = s.find('function generateMultiProject')
if idx == -1:
    raise SystemExit("⚠ لم أجد generateMultiProject")

# ابحث عن "for (const screen of screens)" بعد idx
start = s.find('for (const screen of screens)', idx)
if start == -1:
    raise SystemExit("⚠ لم أجد for screen")

# ابحث عن "const dirs = [" قبل start
dirs_idx = s.find('const dirs = [', idx)

# ابحث عن "const xmlChildren = buildXml(screen.children)" في الحلقة
xml_idx = s.find('const xmlChildren = buildXml', start)
if xml_idx == -1:
    raise SystemExit("⚠ لم أجد buildXml في الحلقة")

# نُدرج قبل السطر مباشرة
line_start = s.rfind('\n', 0, xml_idx) + 1
insert = """    // اضبط الأنماط
    STYLES = extra.styles || new Map();
    try {
      const pal = require('../natural/palettes');
      _colorResolver = pal.resolveColorSmart || null;
    } catch (_) { _colorResolver = null; }

"""
s = s[:line_start] + insert + s[line_start:]
open(p, 'w', encoding='utf-8').write(s)
print("✅ STYLES مضبوط داخل الحلقة")
