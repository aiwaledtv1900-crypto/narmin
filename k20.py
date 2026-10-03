import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

idx = s.find('function generateMultiProject')
print("generateMultiProject عند:", idx)

# اطبع كل التعليقات من idx إلى idx+2000
end = idx + 2000
chunk = s[idx:end]
for i, line in enumerate(chunk.split('\n')):
    stripped = line.strip()
    if stripped.startswith('//') or 'const dirs' in line or 'idCounter' in line or 'buildXml' in line or 'for (const screen' in line:
        print(f"{idx + sum(len(l)+1 for l in chunk.split(chr(10))[:i])}: {stripped}")
