import re
p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

# ابحث عن كل الاستدعاءات في handlerToKotlin فقط
# نطبع موقع handlerToKotlin
start = s.find('function handlerToKotlin(')
end = s.find('\nfunction ', start + 10)
handler = s[start:end]

# عوّض exprToKotlin(X, stateVars) بـ exprToKotlin(X, stateVars, LOCAL_VARS)
# لكن ليس داخل LOCAL_VARS
new_handler = re.sub(r'exprToKotlin\(([^)]+), stateVars\)', r'exprToKotlin(\1, stateVars, LOCAL_VARS)', handler)

s = s[:start] + new_handler + s[end:]
open(p, 'w', encoding='utf-8').write(s)
print("✅ patch9: LOCAL_VARS مُمرَّر")
