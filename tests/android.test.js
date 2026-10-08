'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const android = require('../src/stdlib/android');

function tempDir(name) {
  return path.join(os.tmpdir(), `narmin_android_${name}_${Date.now()}_${Math.random().toString(16).slice(2)}`);
}

test('android module يصدّر الدوال الأساسية', () => {
  for (const name of [
    'android_أنشئ',
    'android_بناء',
    'android_ثبّت',
    'android_شغّل',
    'android_أجهزة',
    'android_بيئة',
    'android_من_نارمين',
  ]) {
    assert.strictEqual(typeof android[name], 'function', name);
  }
});

test('android_أنشئ يرفض الاسم الفارغ', () => {
  assert.throws(
    () => android.android_أنشئ(''),
    /يتوقع اسم المشروع/
  );
});

test('android_أنشئ يرفض الاسم غير النصي', () => {
  assert.throws(
    () => android.android_أنشئ(123),
    /يتوقع اسم المشروع/
  );
});

test('android_أنشئ ينشئ مشروعاً كاملاً', () => {
  const dir = tempDir('create');

  try {
    const result = android.android_أنشئ('تطبيق تجريبي', {
      مسار: dir,
    });

    assert.strictEqual(result.نجح, true);
    assert.strictEqual(result.اسم, 'تطبيق تجريبي');
    assert.ok(result.حزمة.startsWith('com.narmin.'));
    assert.ok(result.فئة);
    assert.ok(result.ملفات > 0);

    assert.ok(fs.existsSync(path.join(dir, 'settings.gradle')));
    assert.ok(fs.existsSync(path.join(dir, 'build.gradle')));
    assert.ok(fs.existsSync(path.join(dir, 'gradle.properties')));
    assert.ok(fs.existsSync(path.join(dir, 'app/build.gradle')));
    assert.ok(fs.existsSync(path.join(dir, 'app/src/main/AndroidManifest.xml')));
    assert.ok(fs.existsSync(path.join(dir, 'app/src/main/res/layout/activity_main.xml')));
    assert.ok(fs.existsSync(path.join(dir, 'app/src/main/res/values/strings.xml')));
    assert.ok(fs.existsSync(path.join(dir, 'app/src/main/res/values/themes.xml')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('android_أنشئ يرفض مجلداً موجوداً', () => {
  const dir = tempDir('exists');
  fs.mkdirSync(dir, { recursive: true });

  try {
    assert.throws(
      () => android.android_أنشئ('مشروع', { مسار: dir }),
      /المجلد موجود مسبقاً/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('android_أنشئ يحترم الحزمة المخصصة', () => {
  const dir = tempDir('package');

  try {
    const result = android.android_أنشئ('My App', {
      مسار: dir,
      حزمة: 'com.test.narmin',
    });

    assert.strictEqual(result.حزمة, 'com.test.narmin');

    const gradle = fs.readFileSync(
      path.join(dir, 'app/build.gradle'),
      'utf8'
    );

    assert.match(gradle, /com\.test\.narmin/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('android_بناء يرفض المجلد غير الموجود', () => {
  assert.throws(
    () => android.android_بناء('/path/does/not/exist'),
    /المجلد غير موجود/
  );
});

test('android_بناء يرفض gradlew غير الموجود', () => {
  const dir = tempDir('build');
  fs.mkdirSync(dir, { recursive: true });

  try {
    assert.throws(
      () => android.android_بناء(dir),
      /gradlew غير موجود/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('android_ثبّت يرفض APK غير موجود', () => {
  assert.throws(
    () => android.android_ثبّت('/path/does/not/exist.apk'),
    /APK غير موجود/
  );
});

test('android_بيئة ترجع معلومات البيئة', () => {
  const env = android.android_بيئة();

  assert.ok(env);
  assert.ok('sdk' in env);
  assert.ok('adb' in env);
  assert.ok('gradle_wrapper_jar' in env);
  assert.ok('java_home' in env);
  assert.ok('java' in env);
  assert.ok('gradle_cache' in env);
});

test('install يسجل دوال Android في البيئة', () => {
  const values = new Map();

  const env = {
    defineLocal(name, value) {
      values.set(name, value);
    },
  };

  android.install(env);

  for (const name of [
    'android_أنشئ',
    'android_من_نارمين',
    'android_بناء',
    'android_ثبّت',
    'android_شغّل',
    'android_أجهزة',
    'android_بيئة',
    'android',
  ]) {
    assert.ok(values.has(name), `مفقود: ${name}`);
  }

  assert.strictEqual(values.get('android').__narmin_native__, undefined);
  assert.strictEqual(typeof values.get('android').أنشئ, 'function');
  assert.strictEqual(typeof values.get('android').بيئة, 'function');
});

test('android_من_نارمين يولّد مشروعاً من ملف نارمين', () => {
  const root = tempDir('from_narmin');
  const source = path.join(root, 'app.narm');
  const project = path.join(root, 'GeneratedApp');

  fs.mkdirSync(root, { recursive: true });

  fs.writeFileSync(source, `#@النمط: ذهبية
#@الزر: أزرق
#@النص: أبيض

شاشة "الرئيسية"
  نص "مرحبا DEV"
  زر "ابدأ" عند_الضغط
    اطبع "تم"
  نهاية
نهاية
`, 'utf8');

  try {
    const result = android.android_من_نارمين(source, 'GeneratedApp', {
      مسار: project,
    });

    assert.strictEqual(result.نجح, true);
    assert.strictEqual(result.مسار, project);
    assert.strictEqual(result.عدد_الشاشات, 1);
    assert.ok(result.حزمة);
    assert.ok(result.gradle_wrapper);

    assert.ok(fs.existsSync(project));
    assert.ok(fs.existsSync(path.join(project, 'settings.gradle')));
    assert.ok(fs.existsSync(path.join(project, 'build.gradle')));
    assert.ok(fs.existsSync(path.join(project, 'app/build.gradle')));
    assert.ok(fs.existsSync(path.join(project, 'app/src/main/AndroidManifest.xml')));

    const javaDir = path.join(project, 'app/src/main/java');
    assert.ok(fs.existsSync(javaDir));

    const drawable = path.join(
      project,
      'app/src/main/res/drawable/ic_launcher.xml'
    );

    const mipmap = path.join(
      project,
      'app/src/main/res/mipmap/ic_launcher.xml'
    );

    assert.ok(fs.existsSync(drawable));
    assert.ok(fs.existsSync(mipmap));

    const manifest = fs.readFileSync(
      path.join(project, 'app/src/main/AndroidManifest.xml'),
      'utf8'
    );

    assert.match(manifest, /android\.permission|manifest/);

    const icon = fs.readFileSync(drawable, 'utf8');
    assert.match(icon, /vector|shape|path/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('android_من_نارمين يرفض ملف نارمين غير موجود', () => {
  assert.throws(
    () => android.android_من_نارمين(
      '/path/does/not/exist.narm',
      'MissingApp',
      { مسار: tempDir('missing') }
    ),
    /ملف نارمين غير موجود/
  );
});

test('android_من_نارمين يرفض ملفاً بلا شاشة', () => {
  const root = tempDir('no_screen');
  const source = path.join(root, 'empty.narm');

  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(source, 'متغير اسم = "DEV"\n', 'utf8');

  try {
    assert.throws(
      () => android.android_من_نارمين(source, 'NoScreen', {
        مسار: path.join(root, 'project'),
      }),
      /لا توجد "شاشة"/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

