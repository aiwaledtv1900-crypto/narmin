p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

# اطبع ترتيب التمرير
import re

# 1) اين يوجد STYLES = extra.styles
idx1 = s.find('STYLES = extra.styles')
print("=== STYLES = extra.styles عند:", idx1)

# 2) اين يوجد const xmlChildren = buildXml
matches = [m.start() for m in re.finditer(r'const xmlChildren = buildXml', s)]
print("=== buildXml calls:", matches)

# 3) اين يوجد // ولّد كل شاشة
idx3 = s.find('// ولّد كل شاشة')
print("=== // ولّد كل شاشة عند:", idx3)

# 4) اين يوجد function generateMultiProject
idx4 = s.find('function generateMultiProject')
print("=== generateMultiProject عند:", idx4)

# 5) اين يوجد THEME = extra.palette
idx5 = s.find('THEME = extra.palette')
print("=== THEME = extra.palette عند:", idx5)

# 6) اطبع كتلة generateMultiProject من البداية حتى buildXml
if idx4 > 0 and matches:
    end = matches[0] + 500
    print("\n=== بداية generateMultiProject ===")
    print(s[idx4:end])
