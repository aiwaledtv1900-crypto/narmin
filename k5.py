p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/interpreter/interpreter.js'
s = open(p, encoding='utf-8').read()
ok = []

# 1) تجاهل العقد الجديدة
old = "      case N.STATE_DECL:\n        return; // للـ codegen فقط"
new = "      case N.STATE_DECL:\n      case N.STYLE_DECL:\n      case N.STYLE_SET:\n        return; // للـ codegen فقط"
if old in s:
    s = s.replace(old, new, 1)
    ok.append('exec-ignore')

# 2) execScreen — اجمع الأنماط
old2 = """  execScreen(node, env) {
    // عند التنفيذ المباشر: اطبع ملخص الشاشة
    this.output(`[شاشة: ${node.name}]`);
    // 1) عرّف كل الحالات أولاً (STATE_DECL) لتصبح معروفة قبل العنوان وغيره
    for (const child of node.children) {
      if (child.type === N.STATE_DECL) {
        this.execScreenElement(child, env, 1);
      }
    }
    // 2) الآن اعرض باقي العناصر
    for (const child of node.children) {
      if (child.type !== N.STATE_DECL) {
        this.execScreenElement(child, env, 1);
      }
    }
  }"""
new2 = """  execScreen(node, env) {
    this.output(`[شاشة: ${node.name}]`);
    // 1) عرّف كل الأنماط والحالات أولاً
    this._styles = this._styles || new Map();
    for (const child of node.children) {
      if (child.type === N.STYLE_DECL) {
        this._styles.set(child.name, child.value);
        this.output(`  🎨 نمط: ${child.name} = "${child.value}"`);
      } else if (child.type === N.STYLE_SET) {
        this._styles.set(child.name, child.value);
        this.output(`  🎨 تحديث: ${child.name} = "${child.value}"`);
      } else if (child.type === N.STATE_DECL) {
        this.execScreenElement(child, env, 1);
      }
    }
    // 2) الآن اعرض باقي العناصر
    for (const child of node.children) {
      if (child.type !== N.STATE_DECL &&
          child.type !== N.STYLE_DECL &&
          child.type !== N.STYLE_SET) {
        this.execScreenElement(child, env, 1);
      }
    }
  }"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    ok.append('execScreen-styles')
else:
    ok.append('SKIP-execScreen')

open(p, 'w', encoding='utf-8').write(s)
print("✅", ok)
