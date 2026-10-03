p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/interpreter/interpreter.js'
s = open(p, encoding='utf-8').read()

# أضف STYLE_DECL, STYLE_SET في exec — تُجمع في _styles
old = """      case N.STATE_DECL:
      case N.STYLE_DECL:
      case N.STYLE_SET:
        return; // للـ codegen فقط"""

new = """      case N.STATE_DECL:
      case N.ANDROID_PERMISSION:
      case N.GRADLE_DEP:
      case N.KOTLIN_IMPORT:
      case N.KOTLIN_RAW:
      case N.HTTP_GET:
      case N.JSON_PARSE:
        return; // للـ codegen فقط
      case N.STYLE_DECL:
        this._styles = this._styles || new Map();
        this._styles.set(node.name, node.value);
        return;
      case N.STYLE_SET:
        this._styles = this._styles || new Map();
        this._styles.set(node.name, node.value);
        return;"""

if old in s:
    s = s.replace(old, new, 1)
    print("✅ exec: STYLE_DECL + STYLE_SET")
else:
    # ابحث عن أي نمط
    old2 = "      case N.STATE_DECL:\n        return; // للـ codegen فقط"
    if old2 in s:
        new2 = """      case N.STATE_DECL:
      case N.STYLE_DECL:
      case N.STYLE_SET:
        this._styles = this._styles || new Map();
        if (node.type === N.STYLE_DECL || node.type === N.STYLE_SET) {
          this._styles.set(node.name, node.value);
        }
        return; // للـ codegen فقط"""
        s = s.replace(old2, new2, 1)
        print("✅ exec: STYLE_DECL + STYLE_SET (alt)")
    else:
        print("⚠ لم أطابق exec")

open(p, 'w', encoding='utf-8').write(s)
