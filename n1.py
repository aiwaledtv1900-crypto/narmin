p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/lexer/keywords.js'
s = open(p, encoding='utf-8').read()
adds = []
if "'نهاية':" not in s: adds.append("  'نهاية': 'END', 'end': 'END',")
if "'تعليق':" not in s: adds.append("  'تعليق': 'COMMENT', 'comment': 'COMMENT',")
if adds:
    idx = s.rfind("};")
    s = s[:idx] + "\n".join(adds) + "\n" + s[idx:]
    open(p, 'w', encoding='utf-8').write(s)
    print("✅ keywords:", len(adds))
else:
    print("ℹ موجودة")
