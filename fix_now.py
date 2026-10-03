p = '/data/data/com.termux/files/home/DEV/apps_building/NarminNet3/app/src/main/AndroidManifest.xml'
s = open(p, encoding='utf-8').read()
if 'INTERNET' not in s:
    s = s.replace(
        '<application',
        '    <uses-permission android:name="android.permission.INTERNET" />\n\n    <application',
        1
    )
    open(p, 'w', encoding='utf-8').write(s)
    print("✅ INTERNET added")
else:
    print("ℹ موجود")
