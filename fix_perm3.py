import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/stdlib/android.js'
s = open(p, encoding='utf-8').read()

# ابحث عن "const screens = [];" وضَع بعدها التعريفات الناقصة
anchor = "const screens = [];"

if anchor not in s:
    raise SystemExit("⚠ لم أجد screens")

# ابحث عن السطر الذي يليه مباشرة
idx = s.find(anchor)
line_end = s.find('\n', idx)

# افحص ما بعدها
after = s[line_end:line_end+500]
print("=== ما بعد screens ===")
print(after)
print("=== نهاية ===")

# نُضيف imports, deps, permissions إن لم تكن موجودة
to_add = ""
if "const imports = []" not in s and "const imports=[]" not in s:
    to_add += "\n  const imports = [];"
if "const deps = []" not in s and "const deps=[]" not in s:
    to_add += "\n  const deps = [];"
if "const permissions = []" not in s and "const permissions=[]" not in s:
    to_add += "\n  const permissions = [];"

if to_add:
    # نُضيفها بعد سطر screens
    s = s[:line_end+1] + "  const imports = [];\n  const deps = [];\n  const permissions = [];\n" + s[line_end+1:]
    open(p, 'w', encoding='utf-8').write(s)
    print(f"✅ أُضيفت التعريفات الناقصة")
else:
    print("ℹ التعريفات موجودة")
