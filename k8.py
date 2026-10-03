p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/interpreter/interpreter.js'
s = open(p, encoding='utf-8').read()

# استبدل الكتلة الصحيحة: `case N.UI_DONE:\n        return;`
old = """      case N.UI_DONE:
        return;"""

new = """      case N.UI_DONE:
        return;
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
    open(p, 'w', encoding='utf-8').write(s)
    print("✅ STYLE_DECL + STYLE_SET مُضافان")
else:
    print("⚠ لم أطابق N.UI_DONE")
