import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/stdlib/android.js'
s = open(p, encoding='utf-8').read()

# نتحقق من وجود hasHttp
if 'hasHttp' in s:
    print("ℹ hasHttp موجود — لكن يحتاج فحص")
    # اطبع السياق
    idx = s.find('hasHttp')
    print(s[max(0,idx-500):idx+500])
else:
    print("⚠ hasHttp مفقود")
