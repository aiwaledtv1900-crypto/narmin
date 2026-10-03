import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/lexer/keywords.js'
s = open(p, encoding='utf-8').read()

# احذف السطور المكسورة بعد module.exports
# ابحث عن آخر "};" في KEYWORDS (يأتي قبل isKeyword)
# نظّف الملف: احذف أي شيء بعد "module.exports = { KEYWORDS, isKeyword };" إن وُجدت سطور غريبة

# نظّف أولاً: احذف سطور 'نهاية' و 'تعليق' في المكان الخطأ
s = re.sub(r"\n\s*'نهاية':[^\n]+\n", "", s)
s = re.sub(r"\n\s*'تعليق':[^\n]+\n", "", s)

# تأكد أن module.exports سليم
s = re.sub(r"module\.exports = \{ KEYWORDS, isKeyword \};\s*$", "module.exports = { KEYWORDS, isKeyword };\n", s)

open(p, 'w', encoding='utf-8').write(s)
print("✅ تنظيف")
print("--- آخر 5 أسطر ---")
print("\n".join(s.split("\n")[-5:]))
