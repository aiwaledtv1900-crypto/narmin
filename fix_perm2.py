import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/stdlib/android.js'
s = open(p, encoding='utf-8').read()

# ابحث عن الكتلة التي تُعرّف screens/imports/deps/permissions
m = re.search(r"(const screens = \[\];[\s\S]*?const permissions = \[\];)", s)
if m:
    print("=== كتلة التعريف ===")
    print(m.group(1))
    print("=== نهاية ===")
else:
    print("⚠ لم أجد كتلة التعريف")
    # ابحث عن permissions وحده
    for i, line in enumerate(s.split('\n'), 1):
        if 'permissions' in line:
            print(f"{i}: {line}")
