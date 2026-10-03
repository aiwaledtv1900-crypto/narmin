p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/lexer/keywords.js'
s = open(p, encoding='utf-8').read()
adds = []
if "'صلاحية':" not in s:
    adds.append("  'صلاحية': 'ANDROID_PERMISSION',")
if "'لون':" not in s:
    adds.append("  'لون': 'STYLE_SET', 'color': 'STYLE_SET',")
if "'بلون':" not in s:
    adds.append("  'بلون': 'WITH_COLOR', 'withcolor': 'WITH_COLOR',")
if adds:
    idx = s.find("function isKeyword")
    idx_close = s.rfind("};", 0, idx)
    s = s[:idx_close] + "\n".join(adds) + "\n" + s[idx_close:]
    open(p, 'w', encoding='utf-8').write(s)
    print("✅", len(adds), "كلمات")
else:
    print("ℹ موجودة")
