p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

# 1) global للأنماط
old = "let BUTTON_TEXT_COLOR = '#FFFFFF';"
new = "let BUTTON_TEXT_COLOR = '#FFFFFF';\nlet STYLES = new Map();\nlet _colorResolver = null;"
if old in s and 'let STYLES' not in s:
    s = s.replace(old, new, 1)
    print("✅ STYLES global")

# 2) حلّل الألوان في generateMultiProject
old2 = "  THEME = extra.palette || THEME;"
if old2 not in s:
    print("⚠ THEME anchor")
else:
    new2 = """  THEME = extra.palette || THEME;
  STYLES = extra.styles || new Map();
  try {
    const pal = require('../natural/palettes');
    _colorResolver = pal.resolveColorSmart || null;
  } catch (_) { _colorResolver = null; }"""
    s = s.replace(old2, new2, 1)
    print("✅ resolveColor")

# 3) دالة resolveRef — تُترجم اسم نمط إلى hex
anchor3 = "function escapeXml(s) {"
if anchor3 in s and 'function resolveStyleColor' not in s:
    add = """function resolveStyleColor(ref) {
  if (!ref) return null;
  // لو موجود في STYLES → احصل على القيمة
  if (STYLES && STYLES.has(ref)) {
    ref = STYLES.get(ref);
  }
  // حوّل الاسم إلى hex
  if (_colorResolver) {
    const hex = _colorResolver(ref);
    if (hex) return hex;
  }
  // لو هو hex مباشر
  if (/^#[0-9A-Fa-f]{6}$/.test(ref)) return ref;
  return null;
}

function escapeXml(s) {"""
    s = s.replace(anchor3, add, 1)
    print("✅ resolveStyleColor")

open(p, 'w', encoding='utf-8').write(s)
