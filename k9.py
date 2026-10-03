p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/stdlib/android.js'
s = open(p, encoding='utf-8').read()

# 1) بعد جمع الشاشات، اجمع الصلاحيات والمكتبات والأنماط
anchor = "  if (screens.length === 0) {\n    throw new Error('لا توجد \"شاشة\" في ملف نارمين');\n  }"
if anchor not in s:
    print("⚠ anchor")
else:
    add = anchor + """

  // جمع الصلاحيات والمكتبات والأنماط
  const styles = new Map();
  for (const stmt of ast.body) {
    if (stmt.type === 'AndroidPermission') {
      let perm = stmt.name;
      // ترجمة الأسماء العربية إلى Android permissions
      const permMap = {
        'انترنت': 'android.permission.INTERNET',
        'إشعارات': 'android.permission.POST_NOTIFICATIONS',
        'اشعارات': 'android.permission.POST_NOTIFICATIONS',
        'موقع': 'android.permission.ACCESS_FINE_LOCATION',
        'كاميرا': 'android.permission.CAMERA',
        'ميكروفون': 'android.permission.RECORD_AUDIO',
        'مخزن': 'android.permission.READ_EXTERNAL_STORAGE',
        'اهتزاز': 'android.permission.VIBRATE',
        'شبكة': 'android.permission.ACCESS_NETWORK_STATE',
        'مكالمات': 'android.permission.CALL_PHONE',
        'جهات': 'android.permission.READ_CONTACTS',
        'بلوتوث': 'android.permission.BLUETOOTH',
        'بصمة': 'android.permission.USE_BIOMETRIC',
      };
      perm = permMap[perm] || (perm.startsWith('android.') ? perm : 'android.permission.' + perm);
      if (!permissions.includes(perm)) permissions.push(perm);
    } else if (stmt.type === 'GradleDep') {
      if (!deps.includes(stmt.spec)) deps.push(stmt.spec);
    } else if (stmt.type === 'StyleDecl' || stmt.type === 'StyleSet') {
      styles.set(stmt.name, stmt.value);
    }
  }"""

    s = s.replace(anchor, add, 1)
    print("✅ جمع الصلاحيات/المكتبات/الأنماط")

# 2) مرّر styles لـ generateMultiProject
old = "const gen = generateMultiProject(screens, اسم_مشروع, مسار, { imports: [], deps: [], permissions: [], palette, buttonColor, textColor });"
new = "const gen = generateMultiProject(screens, اسم_مشروع, مسار, { imports: [], deps, permissions, palette, buttonColor, textColor, styles });"
if old in s:
    s = s.replace(old, new, 1)
    print("✅ مرّر styles")

open(p, 'w', encoding='utf-8').write(s)
