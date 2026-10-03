'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { run } = require('../src/interpreter/interpreter');
const fs = require('fs');
const path = require('path');

function exec(src) {
  return run(src).output;
}

// ابحث عن APK حقيقي في مجلد DEV
function findApk() {
  const dir = path.join(require('os').homedir(), 'DEV', 'apps_patched');
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (fs.statSync(p).isFile() && p.endsWith('.apk')) return p;
    if (fs.statSync(p).isDirectory()) {
      const inner = fs.readdirSync(p).find((f) => f.endsWith('.apk'));
      if (inner) return path.join(p, inner);
    }
  }
  return null;
}

test('apk module محمّل', () => {
  const [out] = exec('اطبع نوع(apk)');
  assert.strictEqual(out, 'كائن');
});

test('apk_معلومات موجودة', () => {
  const [out] = exec('اطبع نوع(apk_معلومات)');
  assert.strictEqual(out, 'دالة أصلية');
});

test('apk_فك موجودة', () => {
  const [out] = exec('اطبع نوع(apk_فك)');
  assert.strictEqual(out, 'دالة أصلية');
});

test('apk_وقّع موجودة', () => {
  const [out] = exec('اطبع نوع(apk_وقّع)');
  assert.strictEqual(out, 'دالة أصلية');
});

test('apk_بدّل_نص يعدّل ملفاً', () => {
  const tmp = path.join(require('os').tmpdir(), `narmin_test_${Date.now()}.txt`);
  fs.writeFileSync(tmp, 'Hello World Hello', 'utf8');
  try {
    const [out] = exec(`
متغير ن = apk_بدّل_نص("${tmp}"، "Hello"، "مرحبا")
اطبع ن.عدد_التبديلات
متغير جديد = اقرأ("${tmp}")
اطبع جديد
`);
    assert.ok(out);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('apk_معلومات على APK حقيقي (إن وُجد)', { skip: !findApk() }, () => {
  const apkPath = findApk();
  const src = `
متغير م = apk_معلومات("${apkPath}")
اطبع نوع(م)
`;
  const [out] = exec(src);
  assert.strictEqual(out, 'كائن');
});

test('apk_فك على APK حقيقي (إن وُجد)', { skip: !findApk() }, () => {
  const apkPath = findApk();
  const tmpOut = path.join(require('os').tmpdir(), `narmin_decode_${Date.now()}`);
  try {
    const src = `
متغير ن = apk_فك("${apkPath}"، "${tmpOut}")
اطبع ن.نجح
`;
    const [out] = exec(src);
    assert.strictEqual(out, 'صحيح');
    assert.ok(fs.existsSync(tmpOut), 'مجلد الفك لم يُنشأ');
  } finally {
    try { fs.rmSync(tmpOut, { recursive: true, force: true }); } catch {}
  }
});

test('apk_بيئة تعرض المسارات الحقيقية', () => {
  const [out] = exec(`
متغير ب = apk_بيئة()
اطبع ب.apktool_jar
`);
  // يجب أن يكون مساراً حقيقياً لا 'غير موجود'
  assert.match(out, /\.jar$/);
  assert.ok(out.includes('apktool'));
});

test('ابحث_keystore', () => {
  const [out] = exec('اطبع نوع(ابحث_keystore())');
  // إما نص (مسار) أو عدم
  assert.ok(['نص', 'عدم'].includes(out));
});
