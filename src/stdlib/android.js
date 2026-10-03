'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { makeNative } = require('../interpreter/values');

const HOME = os.homedir();
const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';

// ═══════════════════════════════════════════════════════════
//  كشف البيئة
// ═══════════════════════════════════════════════════════════

function findExecutable(names) {
  const paths = (process.env.PATH || '').split(':').filter(Boolean);
  const extra = [
    path.join(HOME, 'DEV/tools/bin'),
    path.join(HOME, 'android-sdk/cmdline-tools/latest/bin'),
    path.join(HOME, 'android-sdk/platform-tools'),
  ];
  for (const name of names) {
    for (const dir of [...paths, ...extra]) {
      const full = path.join(dir, name);
      try { if (fs.existsSync(full)) return full; } catch (_) {}
    }
  }
  return null;
}

function findAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(HOME, 'android-sdk'),
    path.join(HOME, 'Android/Sdk'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.existsSync(path.join(c, 'platform-tools'))) return c;
  }
  return null;
}

function findGradleWrapperJar() {
  // ابحث عن wrapper jar في مشاريع موجودة
  const candidates = [
    path.join(HOME, 'DEV/apps_building'),
    path.join(HOME, 'DEV/gradle_tools'),
  ];
  for (const base of candidates) {
    if (!fs.existsSync(base)) continue;
    try {
      const dirs = fs.readdirSync(base);
      for (const d of dirs) {
        const jar = path.join(base, d, 'gradle/wrapper/gradle-wrapper.jar');
        if (fs.existsSync(jar)) return jar;
      }
    } catch (_) {}
  }
  return null;
}

function run(cmd, args, options = {}) {
  const cwd = options.cwd || process.cwd();
  const timeout = options.timeout || 600000;
  const env = options.env ? { ...process.env, ...options.env } : process.env;
  try {
    const out = execFileSync(cmd, args, {
      cwd, timeout, encoding: 'utf8', env,
      maxBuffer: 100 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { نجح: true, كود: 0, خرج: (out || '').trimEnd(), خطأ: '' };
  } catch (e) {
    return {
      نجح: false,
      كود: e.status || 1,
      خرج: (e.stdout || '').toString().trimEnd(),
      خطأ: (e.stderr || e.message || '').toString().trimEnd(),
    };
  }
}

function runStreaming(cmd, args, options = {}) {
  // طباعة مباشرة للشاشة أثناء التنفيذ
  const { spawnSync } = require('child_process');
  const cwd = options.cwd || process.cwd();
  const env = options.env ? { ...process.env, ...options.env } : process.env;

  process.stdout.write(`\n${'═'.repeat(60)}\n`);
  process.stdout.write(`▶ ${cmd} ${args.join(' ')}\n`);
  process.stdout.write(`${'═'.repeat(60)}\n\n`);

  const result = spawnSync(cmd, args, {
    cwd, env,
    stdio: 'inherit',  // ← الطباعة المباشرة
    timeout: 900000,
  });

  process.stdout.write(`\n${'═'.repeat(60)}\n`);
  process.stdout.write(`■ انتهى (كود ${result.status || 0})\n`);
  process.stdout.write(`${'═'.repeat(60)}\n\n`);

  return {
    نجح: result.status === 0,
    كود: result.status || 1,
    خرج: '(انظر الشاشة أعلاه)',
    خطأ: result.status !== 0 ? '(انظر الشاشة أعلاه)' : '',
  };
}

// ═══════════════════════════════════════════════════════════
//  توليد مشروع أندرويد كامل
// ═══════════════════════════════════════════════════════════

function toPackage(اسم) {
  // نحوّل الاسم إلى حزمة صالحة: مثال "تطبيقي" → "com.narmin.tatbiqi"
  const latin = اسم
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase() || 'myapp';
  return `com.narmin.${latin}`;
}

function toClassName(اسم) {
  // نحوّل الاسم إلى اسم class: "my app" → "MyApp"
  const parts = اسم.split(/[\s_-]+/).filter(Boolean);
  const clean = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return (clean || 'MyApp').replace(/[^a-zA-Z0-9]/g, '') || 'MyApp';
}

const TEMPLATES = {
  'settings.gradle': (ctx) => `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
        maven { url 'https://jitpack.io' }
    }
}
rootProject.name = "${ctx.اسم}"
include ':app'
`,

  'build.gradle': () => `plugins {
    id 'com.android.application' version '8.5.2' apply false
    id 'org.jetbrains.kotlin.android' version '1.9.24' apply false
}
`,

  'gradle.properties': () => `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.daemon=true
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official

# Termux: aapt2 الأصلي (لأن نسخة Maven x86_64 لا تعمل على ARM)
android.aapt2FromMavenOverride=/data/data/com.termux/files/usr/bin/aapt2
`,

  'app/build.gradle': (ctx) => `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace '${ctx.حزمة}'
    compileSdk 34

    defaultConfig {
        applicationId "${ctx.حزمة}"
        minSdk 23
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
}
`,

  'app/src/main/AndroidManifest.xml': (ctx) => `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.App">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`,

  'app/src/main/java/PACKAGE/MainActivity.kt': (ctx) => `package ${ctx.حزمة}

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val textView = findViewById<TextView>(R.id.main_text)
        textView.text = "مرحباً من ${ctx.اسم}"
    }
}
`,

  'app/src/main/res/layout/activity_main.xml': (ctx) => `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:padding="24dp">

    <TextView
        android:id="@+id/main_text"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="@string/app_name"
        android:textSize="24sp"
        android:textStyle="bold"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>
`,

  'app/src/main/res/values/strings.xml': (ctx) => `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${ctx.اسم}</string>
</resources>
`,

  'app/src/main/res/values/themes.xml': (ctx) => `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.${ctx.فئة}" parent="Theme.Material3.Light.NoActionBar">
        <item name="colorPrimary">#1A237E</item>
        <item name="colorPrimaryVariant">#0D47A1</item>
        <item name="colorOnPrimary">#FFFFFF</item>
        <item name="android:statusBarColor">#1A237E</item>
    </style>
</resources>
`,

  'app/proguard-rules.pro': () => `# قواعد ProGuard
`,
};

function android_أنشئ(اسم, خيارات = {}) {
  if (!اسم || typeof اسم !== 'string') {
    throw new Error('android_أنشئ() يتوقع اسم المشروع');
  }

  const مسار = خيارات.مسار || path.join(HOME, 'DEV/apps_building', اسم);
  const حزمة = خيارات.حزمة || toPackage(اسم);
  const فئة = toClassName(اسم);

  if (fs.existsSync(مسار)) {
    throw new Error(`المجلد موجود مسبقاً: ${مسار}`);
  }

  const ctx = { اسم, حزمة, فئة, مسار };

  // أنشئ الهيكل
  const dirs = [
    'app/src/main/java/' + حزمة.replace(/\./g, '/'),
    'app/src/main/res/layout',
    'app/src/main/res/values',
    'gradle/wrapper',
  ];
  for (const d of dirs) {
    fs.mkdirSync(path.join(مسار, d), { recursive: true });
  }

  // اكتب الملفات
  for (const [rel, gen] of Object.entries(TEMPLATES)) {
    let target = rel;
    if (rel.includes('PACKAGE')) {
      target = rel.replace('PACKAGE', حزمة.replace(/\./g, '/'));
    }
    const fullPath = path.join(مسار, target);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, gen(ctx), 'utf8');
  }

  // انسخ gradle-wrapper.jar إن وُجد
  const wrapperSrc = findGradleWrapperJar();
  if (wrapperSrc) {
    fs.copyFileSync(wrapperSrc, path.join(مسار, 'gradle/wrapper/gradle-wrapper.jar'));
  }

  // انسخ gradlew و gradlew.bat إن وُجدا
  if (wrapperSrc) {
    const wrapperDir = path.dirname(wrapperSrc);
    const projectRoot = path.dirname(path.dirname(wrapperDir));
    const gradlewSrc = path.join(projectRoot, 'gradlew');
    const gradlewBatSrc = path.join(projectRoot, 'gradlew.bat');
    if (fs.existsSync(gradlewSrc)) {
      fs.copyFileSync(gradlewSrc, path.join(مسار, 'gradlew'));
      fs.chmodSync(path.join(مسار, 'gradlew'), 0o755);
    }
    if (fs.existsSync(gradlewBatSrc)) {
      fs.copyFileSync(gradlewBatSrc, path.join(مسار, 'gradlew.bat'));
    }
    // انسخ gradle-wrapper.properties
    const propSrc = path.join(wrapperDir, 'gradle-wrapper.properties');
    if (fs.existsSync(propSrc)) {
      fs.copyFileSync(propSrc, path.join(مسار, 'gradle/wrapper/gradle-wrapper.properties'));
    } else {
      // اكتب واحداً افتراضياً
      fs.writeFileSync(
        path.join(مسار, 'gradle/wrapper/gradle-wrapper.properties'),
        'distributionBase=GRADLE_USER_HOME\ndistributionPath=wrapper/dists\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-8.7-bin.zip\nzipStoreBase=GRADLE_USER_HOME\nzipStorePath=wrapper/dists\n',
        'utf8'
      );
    }
  } else {
    fs.writeFileSync(
      path.join(مسار, 'gradle/wrapper/gradle-wrapper.properties'),
      'distributionBase=GRADLE_USER_HOME\ndistributionPath=wrapper/dists\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-8.7-bin.zip\nzipStoreBase=GRADLE_USER_HOME\nzipStorePath=wrapper/dists\n',
      'utf8'
    );
  }

  // local.properties — مسار SDK
  const sdk = findAndroidSdk();
  if (sdk) {
    fs.writeFileSync(path.join(مسار, 'local.properties'), `sdk.dir=${sdk}\n`, 'utf8');
  }

  return {
    نجح: true,
    مسار,
    حزمة,
    فئة,
    اسم,
    ملفات: Object.keys(TEMPLATES).length,
    gradle_wrapper: !!wrapperSrc,
    sdk: sdk || 'غير موجود',
  };
}

// ═══════════════════════════════════════════════════════════
//  البناء والتثبيت
// ═══════════════════════════════════════════════════════════

function android_بناء(مسار, خيارات = {}) {
  if (!fs.existsSync(مسار)) throw new Error(`المجلد غير موجود: ${مسار}`);
  const gradlew = path.join(مسار, 'gradlew');
  if (!fs.existsSync(gradlew)) throw new Error(`gradlew غير موجود في: ${مسار}`);

  const task = خيارات.نسخة === 'release' ? 'assembleRelease' : 'assembleDebug';
  const args = [task];
  if (خيارات.بلا_اختبارات !== false) args.push('-x', 'lint', '-x', 'test');
  if (خيارات.offline) args.push('--offline');
  if (خيارات.مكدس) args.push('--stacktrace');

  const sdk = findAndroidSdk();
  const javaHome = process.env.JAVA_HOME || '/data/data/com.termux/files/usr/lib/jvm/java-17-openjdk';
  const env = { ANDROID_HOME: sdk || '', ANDROID_SDK_ROOT: sdk || '', JAVA_HOME: javaHome };

  const r = runStreaming(gradlew, args, { cwd: مسار, env });

  // اكتشف APK الناتج
  const variantDir = خيارات.نسخة === 'release' ? 'release' : 'debug';
  const apkDir = path.join(مسار, 'app/build/outputs/apk', variantDir);
  let apkPath = null;
  if (fs.existsSync(apkDir)) {
    const apks = fs.readdirSync(apkDir).filter((f) => f.endsWith('.apk'));
    if (apks.length) apkPath = path.join(apkDir, apks[0]);
  }

  return {
    نجح: r.نجح,
    كود: r.كود,
    apk: apkPath,
    خرج: r.خرج.split('\n').slice(-30).join('\n'),
    خطأ: r.خطأ.split('\n').slice(-30).join('\n'),
  };
}

function android_ثبّت(apk) {
  if (!fs.existsSync(apk)) throw new Error(`APK غير موجود: ${apk}`);
  const adb = findExecutable(['adb']);
  if (!adb) throw new Error('adb غير موجود');
  const r = run(adb, ['install', '-r', apk]);
  return { نجح: r.نجح, خرج: r.خرج, خطأ: r.خطأ };
}

function android_شغّل(حزمة, نشاط = '.MainActivity') {
  const adb = findExecutable(['adb']);
  if (!adb) throw new Error('adb غير موجود');
  const r = run(adb, ['shell', 'am', 'start', '-n', `${حزمة}/${نشاط}`]);
  return { نجح: r.نجح, خرج: r.خرج, خطأ: r.خطأ };
}

function android_أجهزة() {
  const adb = findExecutable(['adb']);
  if (!adb) throw new Error('adb غير موجود');
  const r = run(adb, ['devices', '-l']);
  return { نجح: r.نجح, خرج: r.خرج };
}

function android_بيئة() {
  const sdk = findAndroidSdk();
  const adb = findExecutable(['adb']);
  const gradlewJar = findGradleWrapperJar();
  const javaHome = process.env.JAVA_HOME || '/data/data/com.termux/files/usr/lib/jvm/java-17-openjdk';
  return {
    sdk: sdk || 'غير موجود',
    adb: adb || 'غير موجود',
    gradle_wrapper_jar: gradlewJar || 'غير موجود',
    java_home: javaHome,
    java: findExecutable(['java']) || 'غير موجود',
    gradle_cache: fs.existsSync(path.join(HOME, '.gradle/caches/modules-2')) ? 'موجود' : 'غير موجود',
  };
}

// ═══════════════════════════════════════════════════════════
//  تطبيق من ملف نارمين
// ═══════════════════════════════════════════════════════════

function android_من_نارمين(ملف_narmin, اسم_مشروع, خيارات = {}) {
  if (!fs.existsSync(ملف_narmin)) {
    throw new Error(`ملف نارمين غير موجود: ${ملف_narmin}`);
  }

  // 1) اقرأ وحلل
  const { parse } = require('../parser/parser');
  const { NodeType } = require('../ast/nodes');
  const source = fs.readFileSync(ملف_narmin, 'utf8');
  const ast = parse(source);

  // ابحث عن كل الشاشات
  const screens = [];
  const imports = [];
  const deps = [];
  const permissions = [];
  for (const stmt of ast.body) {
    if (stmt.type === NodeType.SCREEN) screens.push(stmt);
  }
  if (screens.length === 0) {
    throw new Error('لا توجد "شاشة" في ملف نارمين');
  }

  // فحص استخدام HTTP → إضافة INTERNET
  const hasHttp = (function scan(items) {
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      if (it.type === 'HttpGet') return true;
      if (it.type === 'CallExpr' && it.callee && it.callee.name === 'جلب') return true;
      for (const k of Object.keys(it)) {
        const v = it[k];
        if (Array.isArray(v) && scan(v)) return true;
        if (v && typeof v === 'object' && v.type && scan([v])) return true;
      }
    }
    return false;
  })(screens.flatMap(sc => sc.children));
  if (hasHttp && !permissions.includes('android.permission.INTERNET')) {
    permissions.push('android.permission.INTERNET');
  }

  // 2) اسم المشروع
  اسم_مشروع = اسم_مشروع || screens[0].name.replace(/[^a-zA-Z0-9]/g, '') || 'NarminApp';

  // 3) أنشئ المشروع الأساسي (gradle, wrapper, SDK)
  const مسار = خيارات.مسار || path.join(HOME, 'DEV/apps_building', اسم_مشروع);

  // احذف المجلد القديم بالكامل لإعادة توليد نظيف
  if (fs.existsSync(مسار)) {
    fs.rmSync(مسار, { recursive: true, force: true });
  }

  const baseResult = android_أنشئ(اسم_مشروع, { مسار });

  // 4) احذف MainActivity.kt الافتراضي (نارمين تولّد ملفاتها)
  const defaultPkg = toPackage(اسم_مشروع).replace(/\./g, '/');
  const defaultKt = path.join(مسار, 'app/src/main/java', defaultPkg, toClassName(اسم_مشروع).replace('Activity', '') + 'Activity.kt');
  // الاسم الافتراضي في android_أنشئ: {فئة} = toClassName(اسم) → "NarminAppActivity"؟ لا، toClassName في android.js يُرجع MyApp، ونضيف Activity
  // نبسّط: نمسح كل ملفات .kt في مجلد الحزمة
  const ktDir = path.join(مسار, 'app/src/main/java', defaultPkg);
  if (fs.existsSync(ktDir)) {
    for (const f of fs.readdirSync(ktDir)) {
      if (f.endsWith('.kt')) {
        fs.unlinkSync(path.join(ktDir, f));
      }
    }
  }

  // 5) ولّد الملفات من AST نارمين
  // فحص استخدام التنبيهات → إضافة الإذن تلقائياً
  const hasNotification = (function scan(items) {
    for (const it of items) {
      if (it.type === 'SendNotification') return true;
      if (it.children && scan(it.children)) return true;
      if (it.handler && it.handler.body && scan(it.handler.body)) return true;
      if (it.template && scan(it.template)) return true;
    }
    return false;
  })(screens.flatMap(sc => sc.children));
  if (hasNotification && !permissions.includes('android.permission.POST_NOTIFICATIONS')) {
    permissions.push('android.permission.POST_NOTIFICATIONS');
  }


  const { generateMultiProject } = require('../codegen/android');
  const gen = generateMultiProject(screens, اسم_مشروع, مسار, { imports: [], deps: [], permissions: [] });

  // أيقونة التطبيق — نضمن وجودها بعد كل التوليد
  const mipDir = path.join(مسار, 'app/src/main/res/mipmap');
  fs.mkdirSync(mipDir, { recursive: true });
  fs.writeFileSync(path.join(mipDir, 'ic_launcher.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n' +
    '    android:width="108dp"\n' +
    '    android:height="108dp"\n' +
    '    android:viewportWidth="108"\n' +
    '    android:viewportHeight="108">\n' +
    '    <path android:fillColor="#1A237E" android:pathData="M0,0h108v108h-108z" />\n' +
    '    <path android:strokeColor="#FFC107" android:strokeWidth="3" android:pathData="M54,8 L54,100" />\n' +
    '    <path android:fillColor="#FFFFFF" android:pathData="M28,30 L28,80 L38,80 L38,50 L64,80 L74,80 L74,30 L64,30 L64,60 L38,30 Z" />\n' +
    '</vector>\n',
    'utf8');

  return {
    نجح: true,
    مسار,
    حزمة: gen.حزمة,
    الشاشات: gen.screens,
    عدد_الشاشات: screens.length,

    gradle_wrapper: baseResult.gradle_wrapper,
  };
}

// ═══════════════════════════════════════════════════════════
//  التثبيت
// ═══════════════════════════════════════════════════════════

function install(env) {
  const natives = {
    android_أنشئ: (args) => android_أنشئ(args[0], args[1] || {}),
    android_من_نارمين: (args) => android_من_نارمين(args[0], args[1], args[2] || {}),
    android_بناء: (args) => android_بناء(args[0], args[1] || {}),
    android_ثبّت: (args) => android_ثبّت(args[0]),
    android_شغّل: (args) => android_شغّل(args[0], args[1]),
    android_أجهزة: () => android_أجهزة(),
    android_بيئة: () => android_بيئة(),
  };

  for (const [name, fn] of Object.entries(natives)) {
    env.defineLocal(name, makeNative(name, fn));
  }

  env.defineLocal('android', {
    أنشئ: android_أنشئ,
    من_نارمين: android_من_نارمين,
    بناء: android_بناء,
    ثبّت: android_ثبّت,
    شغّل: android_شغّل,
    أجهزة: android_أجهزة,
    بيئة: android_بيئة,
  });
}

module.exports = {
  install,
  android_أنشئ, android_بناء, android_ثبّت, android_شغّل,
  android_أجهزة, android_بيئة, android_من_نارمين,
};
