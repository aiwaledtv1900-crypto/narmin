p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()
ok = []

# UI_HEADING — أضف colorRef
old = """    if (child.type === N.UI_HEADING) {
      const id = nextId();
      lines.push(`${indent}<TextView`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="wrap_content"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:text="${escapeXml(staticString(child.text))}"`);
      lines.push(`${indent}    android:textColor="${TEXT_COLOR || THEME.heading}"`);"""
new = """    if (child.type === N.UI_HEADING) {
      const id = nextId();
      const customColor = resolveStyleColor(child.colorRef);
      const textColor = customColor || TEXT_COLOR || THEME.heading;
      lines.push(`${indent}<TextView`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="wrap_content"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:text="${escapeXml(staticString(child.text))}"`);
      lines.push(`${indent}    android:textColor="${textColor}"`);"""
if old in s:
    s = s.replace(old, new, 1)
    ok.append('HEADING')

# UI_TEXT
old2 = """    } else if (child.type === N.UI_TEXT) {
      const id = nextId();
      lines.push(`${indent}<TextView`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:text="${escapeXml(staticString(child.expr))}"`);
      lines.push(`${indent}    android:textColor="${TEXT_COLOR || THEME.onSurface || '#212121'}"`);"""
new2 = """    } else if (child.type === N.UI_TEXT) {
      const id = nextId();
      const customColor = resolveStyleColor(child.colorRef);
      const textColor = customColor || TEXT_COLOR || THEME.onSurface || '#212121';
      lines.push(`${indent}<TextView`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:text="${escapeXml(staticString(child.expr))}"`);
      lines.push(`${indent}    android:textColor="${textColor}"`);"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    ok.append('UI_TEXT')

# UI_BUTTON — backgroundTint من colorRef
old3 = """    } else if (child.type === N.UI_BUTTON) {
      const id = nextId();
      lines.push(`${indent}<com.google.android.material.button.MaterialButton`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="56dp"`);
      lines.push(`${indent}    android:text="${escapeXml(staticString(child.text))}"`);
      lines.push(`${indent}    android:textSize="16sp"`);
      lines.push(`${indent}    android:textColor="${BUTTON_TEXT_COLOR}"`);
      lines.push(`${indent}    android:layout_marginTop="16dp"`);
      lines.push(`${indent}    app:backgroundTint="${BUTTON_COLOR || THEME.primary}"`);"""
new3 = """    } else if (child.type === N.UI_BUTTON) {
      const id = nextId();
      const customColor = resolveStyleColor(child.colorRef);
      const btnBg = customColor || BUTTON_COLOR || THEME.primary;
      lines.push(`${indent}<com.google.android.material.button.MaterialButton`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="56dp"`);
      lines.push(`${indent}    android:text="${escapeXml(staticString(child.text))}"`);
      lines.push(`${indent}    android:textSize="16sp"`);
      lines.push(`${indent}    android:textColor="${BUTTON_TEXT_COLOR}"`);
      lines.push(`${indent}    android:layout_marginTop="16dp"`);
      lines.push(`${indent}    app:backgroundTint="${btnBg}"`);"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    ok.append('UI_BUTTON')

open(p, 'w', encoding='utf-8').write(s)
print("✅", ok)
