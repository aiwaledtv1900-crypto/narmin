'use strict';

const fs = require('fs');
const path = require('path');

/*
 * مولد أندرويد للغة نارمين
 * يحول AST إلى مشروع Android قابل للبناء.
 */

function generateAndroidCode(ast) {
  return `// كود كوتلن مُولد بواسطة نارمين
package com.narmin.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
    }
}
`;
}

function literal(node, fallback = '') {
  if (node == null) return fallback;

  if (
    typeof node === 'string' ||
    typeof node === 'number' ||
    typeof node === 'boolean'
  ) {
    return String(node);
  }

  if (node.value !== undefined) return String(node.value);
  if (node.name !== undefined) return String(node.name);

  return fallback;
}

function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function kotlinEscape(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function valueOf(node) {
  return literal(node);
}

function prop(node, name, fallback = null) {
  if (!node || !node.props) return fallback;
  if (node.props[name] !== undefined) return node.props[name];
  return fallback;
}

function textView(text, extra = '') {
  return `<TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:text="${xmlEscape(text)}" android:padding="8dp"${extra} />`;
}

function generateElement(child, index, handlers, imports) {
  if (!child) return '';

  const type = child.type;

  switch (type) {
    case 'UIHeading':
      return textView(
        valueOf(child.text),
        ' android:textSize="26sp" android:textStyle="bold"'
      );

    case 'UIText':
      return textView(valueOf(child.expr));

    case 'UIButton': {
      const id = `button_${index}`;
      handlers.push(
        `findViewById<android.widget.Button>(R.id.${id}).setOnClickListener { ${handlerCode(child.handler)} }`
      );

      return `<Button android:id="@+id/${id}" android:layout_width="match_parent" android:layout_height="wrap_content" android:text="${xmlEscape(valueOf(child.text))}" android:layout_marginTop="8dp" />`;
    }

    case 'UITextField':
      return `<EditText android:layout_width="match_parent" android:layout_height="wrap_content" android:hint="${xmlEscape(valueOf(child.hint))}" android:padding="8dp" />`;

    case 'UICheckBox':
      return `<CheckBox android:layout_width="match_parent" android:layout_height="wrap_content" android:text="${xmlEscape(valueOf(child.text))}" />`;

    case 'UISwitch':
      return `<Switch android:layout_width="match_parent" android:layout_height="wrap_content" android:text="${xmlEscape(valueOf(child.text))}" />`;

    case 'UIProgress':
      return `<ProgressBar android:layout_width="match_parent" android:layout_height="wrap_content" android:max="100" android:progress="${xmlEscape(valueOf(child.value))}" style="?android:attr/progressBarStyleHorizontal" />`;

    case 'UISpacer':
      return `<Space android:layout_width="match_parent" android:layout_height="${toAndroidDim(xmlEscape(valueOf(child.size) || '16dp'), "16dp")}" />`;

    case 'UIDivider':
      return '<View android:layout_width="match_parent" android:layout_height="1dp" android:background="#DDDDDD" android:layout_marginVertical="8dp" />';

    case 'UIDropdown':
      return `<Spinner android:layout_width="match_parent" android:layout_height="wrap_content" android:contentDescription="${xmlEscape(valueOf(child.hint))}" />`;

    case 'UIDate':
      imports.add('import android.app.DatePickerDialog');
      return `<Button android:id="@+id/date_${index}" android:layout_width="match_parent" android:layout_height="wrap_content" android:text="${xmlEscape(valueOf(child.hint) || 'اختيار التاريخ')}" />`;

    case 'UITime':
      imports.add('import android.app.TimePickerDialog');
      return `<Button android:id="@+id/time_${index}" android:layout_width="match_parent" android:layout_height="wrap_content" android:text="${xmlEscape(valueOf(child.hint) || 'اختيار الوقت')}" />`;

    case 'UIImage':
      return textView(`🖼 ${valueOf(child.name)}`);

    case 'UICard': {
      const children = (child.children || [])
        .map((x, i) => generateElement(x, `${index}_${i}`, handlers, imports))
        .join('');
      return `<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical" android:padding="12dp" android:background="#EEEEEE">${textView(valueOf(child.title))}${children}</LinearLayout>`;
    }

    case 'UIRow': {
      const children = (child.children || [])
        .map((x, i) => generateElement(x, `${index}_${i}`, handlers, imports))
        .join('');
      return `<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal">${children}</LinearLayout>`;
    }

    case 'UIList':
      return `<ListView android:layout_width="match_parent" android:layout_height="wrap_content" />`;

    case 'UIWebView':
      imports.add('import android.webkit.WebView');
      imports.add('import android.webkit.WebViewClient');
      return `<WebView android:id="@+id/web_${index}" android:layout_width="match_parent" android:layout_height="400dp" />`;

    case 'UIVideo':
      imports.add('import android.widget.VideoView');
      return `<VideoView android:id="@+id/video_${index}" android:layout_width="match_parent" android:layout_height="240dp" />`;

    case 'UIAudio':
      imports.add('import android.widget.MediaController');
      return textView(`🔊 ${valueOf(child.src)}`);

    case 'UIMap':
      return textView(
        `🗺 ${valueOf(child.lat)}, ${valueOf(child.lng)}`
      );

    case 'UIChart':
      return textView(
        `📊 ${valueOf(child.chartType) || 'رسم بياني'}`
      );

    case 'UIDateDialog':
      return `<Button android:layout_width="match_parent" android:layout_height="wrap_content" android:text="اختيار التاريخ" />`;

    case 'UIColorDialog':
      return `<Button android:layout_width="match_parent" android:layout_height="wrap_content" android:text="اختيار اللون" />`;

    case 'UIBar':
      return textView('شريط');

    case 'UIDrawer':
      return `<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="vertical">${textView(valueOf(child.title))}${(child.children || []).map((x, i) => generateElement(x, `${index}_${i}`, handlers, imports)).join('')}</LinearLayout>`;

    case 'UITabBar':
      return `<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal">${(child.tabs || []).map(x => `<Button android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:text="${xmlEscape(valueOf(x))}" />`).join('')}</LinearLayout>`;

    case 'UITopBar':
      return textView('نارمين');

    default:
      return textView('عنصر نارمين');
  }
}

function handlerCode(handler) {
  if (!handler) return '';

  if (typeof handler === 'string') {
    return `/* ${kotlinEscape(handler)} */`;
  }

  if (handler.type === 'Block' && Array.isArray(handler.body)) {
    return handler.body.map(statementCode).filter(Boolean).join('\n');
  }

  return '';
}

function statementCode(node) {
  if (!node) return '';

  switch (node.type) {
    case 'Toast':
      return `android.widget.Toast.makeText(this, "${kotlinEscape(valueOf(node.text))}", android.widget.Toast.LENGTH_SHORT).show()`;

    case 'Back':
      return 'finish()';

    case 'OpenUrl':
      return `startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("${kotlinEscape(valueOf(node.url))}")))`;

    case 'Dial':
      return `startActivity(android.content.Intent(android.content.Intent.ACTION_DIAL, android.net.Uri.parse("tel:${kotlinEscape(valueOf(node.phone))}")))`;

    case 'ClipCopy':
      return `(getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager).setPrimaryClip(android.content.ClipData.newPlainText("نارمين", "${kotlinEscape(valueOf(node.text))}"))`;

    case 'Navigate':
      return `/* navigate: ${kotlinEscape(valueOf(node.target))} */`;

    case 'Print':
      return `android.util.Log.d("NARMIN", "${kotlinEscape(valueOf(node.arg))}")`;

    default:
      return '';
  }
}

function collectScreens(screens) {
  if (!Array.isArray(screens)) return [];
  return screens.filter(Boolean);
}

function generateMultiProject(screens, projectName, projectPath, options = {}) {
  screens = collectScreens(screens);

  if (!screens.length) {
    screens = [{ name: projectName, children: [] }];
  }

  const packageName =
    options.packageName ||
    (
      'com.narmin.' +
      String(projectName)
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase()
    ) ||
    'com.narmin.myapp';

  const javaPackage = packageName.replace(/[^a-zA-Z0-9_.]/g, '');

  const activityDir = path.join(
    projectPath,
    'app/src/main/java',
    javaPackage.replace(/\./g, '/')
  );

  const resLayout = path.join(
    projectPath,
    'app/src/main/res/layout'
  );

  const manifestPath = path.join(
    projectPath,
    'app/src/main/AndroidManifest.xml'
  );

  fs.mkdirSync(activityDir, { recursive: true });
  fs.mkdirSync(resLayout, { recursive: true });

  const first = screens[0];
  const views = [];
  const handlers = [];
  const imports = new Set();

  for (let i = 0; i < (first.children || []).length; i++) {
    views.push(
      generateElement(
        first.children[i],
        i,
        handlers,
        imports
      )
    );
  }

  if (!views.length) {
    views.push(
      textView(
        first.name || projectName,
        ' android:textSize="24sp" android:textStyle="bold" android:gravity="center"'
      )
    );
  }

  const layout =
`<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:padding="24dp">

        ${views.join('\n        ')}

    </LinearLayout>
</ScrollView>
`;

  fs.writeFileSync(
    path.join(resLayout, 'activity_main.xml'),
    layout,
    'utf8'
  );

  const importText = Array.from(imports).join('\n');

  const activity =
`package ${javaPackage}

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
${importText}

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        ${handlers.join('\n        ')}
    }
}
`;

  fs.writeFileSync(
    path.join(activityDir, 'MainActivity.kt'),
    activity,
    'utf8'
  );

  if (options.permissions && options.permissions.length) {
    let manifest = fs.readFileSync(manifestPath, 'utf8');

    const permissions = options.permissions
      .map(
        x =>
          `    <uses-permission android:name="${xmlEscape(x)}" />`
      )
      .join('\n');

    manifest = manifest.replace(
      /(<manifest[^>]*>)/,
      `$1\n${permissions}`
    );

    fs.writeFileSync(
      manifestPath,
      manifest,
      'utf8'
    );
  }

  return {
    نجح: true,
    حزمة: packageName,
    screens: screens.map(s => s.name),
    مسار: projectPath
  };
}


// ═══ تحويل قيمة إلى وحدة Android صحيحة ═══
function toAndroidDim(value, fallback = 'wrap_content') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return value + 'dp';
  const s = String(value).trim();
  if (!s) return fallback;
  // إذا كان رقماً فقط
  if (/^\d+(\.\d+)?$/.test(s)) return s + 'dp';
  // إذا كان له وحدة أصلاً
  if (/^\d+(\.\d+)?(dp|dip|px|sp|pt|in|mm)$/i.test(s)) return s;
  // قيم خاصة
  if (s === 'wrap_content' || s === 'match_parent' || s === 'fill_parent') return s;
  if (s === 'كامل') return 'match_parent';
  if (s === 'تلقائي') return 'wrap_content';
  // افتراضي: أضف dp
  return s + 'dp';
}

module.exports = {
  generateAndroidCode,
  generateMultiProject
};
