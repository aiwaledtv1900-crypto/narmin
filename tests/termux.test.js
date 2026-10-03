'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { run } = require('../src/interpreter/interpreter');
const fs = require('fs');
const os = require('os');
const path = require('path');

function exec(src) {
  return run(src).output;
}

test('معلومات() تُرجع كائن النظام', () => {
  const [out] = exec('متغير م = معلومات()\nاطبع م.نظام');
  assert.ok(out.includes('linux') || out.includes('android') || out.length > 0);
});

test('مسار_الرئيسية()', () => {
  const [out] = exec('اطبع مسار_الرئيسية()');
  assert.ok(out.startsWith('/'));
});

test('مسار_الحالي()', () => {
  const [out] = exec('اطبع مسار_الحالي()');
  assert.ok(out.startsWith('/'));
});

test('ضم() يجمع مسارين', () => {
  const [out] = exec('اطبع ضم("ا"، "ب"، "ج")');
  assert.strictEqual(out, 'ا/ب/ج');
});

test('اسم_الملف()', () => {
  const [out] = exec('اطبع اسم_الملف("/أ/ب/ملف.txt")');
  assert.strictEqual(out, 'ملف.txt');
});

test('امتداد()', () => {
  const [out] = exec('اطبع امتداد("ملف.narm")');
  assert.strictEqual(out, '.narm');
});

test('موجود() على مسار حقيقي', () => {
  const [out] = exec('اطبع موجود("/data")');
  assert.strictEqual(out, 'صحيح');
});

test('موجود() على مسار وهمي', () => {
  const [out] = exec('اطبع موجود("/مسارات/وهمية/جدا")');
  assert.strictEqual(out, 'خطأ');
});

test('اقرأ + اكتب ملف مؤقت', () => {
  const tmp = path.join(os.tmpdir(), `narmin_test_${Date.now()}.txt`);
  try {
    const src = `
اكتب("${tmp}"، "مرحباً نارمين")
متغير محتوى = اقرأ("${tmp}")
اطبع محتوى
`;
    const [out] = exec(src);
    assert.strictEqual(out, 'مرحباً نارمين');
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
});

test('شغل() ينفذ echo', () => {
  const [out] = exec(`
متغير ن = شغل("echo"، ["مرحبا من النظام"])
اطبع ن.خرج
`);
  assert.strictEqual(out, 'مرحبا من النظام');
});

test('شغل() يُرجع نجح=صحيح عند النجاح', () => {
  const [out] = exec(`
متغير ن = شغل("true")
اطبع ن.نجح
`);
  assert.strictEqual(out, 'صحيح');
});

test('شغل() يُرجع نجح=خطأ عند الفشل', () => {
  const [out] = exec(`
متغير ن = شغل("false")
اطبع ن.نجح
اطبع ن.كود
`);
  assert.strictEqual(out.split('\n')[0], 'خطأ');
});

test('شغل() مع أمر غير موجود', () => {
  const [out] = exec(`
متغير ن = شغل("amr_ghayr_mawjud_xyz")
اطبع ن.نجح
`);
  assert.strictEqual(out, 'خطأ');
});

test('مجلد + احذف', () => {
  const tmp = path.join(os.tmpdir(), `narmin_dir_${Date.now()}`);
  try {
    const src = `
مجلد("${tmp}")
اطبع موجود("${tmp}")
احذف("${tmp}")
اطبع موجود("${tmp}")
`;
    const [out1, out2] = exec(src);
    assert.strictEqual(out1, 'صحيح');
    assert.strictEqual(out2, 'خطأ');
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
});

test('اقرأ_مجلد يُرجع مصفوفة', () => {
  const [out] = exec(`اطبع نوع(اقرأ_مجلد("${os.homedir()}"))`);
  assert.strictEqual(out, 'مصفوفة');
});

test('اقرأ_json + اكتب_json', () => {
  const tmp = path.join(os.tmpdir(), `narmin_json_${Date.now()}.json`);
  try {
    const src = `
اكتب_json("${tmp}"، { اسم: "DEV"، عمر: 30 })
متغير ب = اقرأ_json("${tmp}")
اطبع ب.اسم
اطبع ب.عمر
`;
    const [out1, out2] = exec(src);
    assert.strictEqual(out1, 'DEV');
    assert.strictEqual(out2, '30');
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
});

test('دمج: شغل + اقرأ', () => {
  const [out] = exec(`
متغير ن = شغل("echo"، ["hello"])
متغير نتيجة = ن.خرج
اطبع نتيجة
`);
  assert.strictEqual(out, 'hello');
});

test('كائن في نارمين', () => {
  const [out1, out2] = exec(`
متغير شخص = { اسم: "DEV"، عمر: 30، نشط: صحيح }
اطبع شخص.اسم
اطبع شخص.نشط
`);
  assert.strictEqual(out1, 'DEV');
  assert.strictEqual(out2, 'صحيح');
});

test('كائن متداخل', () => {
  const [out] = exec(`
متغير إعدادات = {
  خادم: { مضيف: "localhost"، منفذ: 8080 }،
  مميز: صحيح
}
اطبع إعدادات.خادم.مضيف
`);
  assert.strictEqual(out, 'localhost');
});

test('مصفوفة من كائنات', () => {
  const [out] = exec(`
متغير قائمة = [
  { اسم: "أحمد"، عمر: 25 }،
  { اسم: "سارة"، عمر: 30 }
]
اطبع قائمة[0].اسم
اطبع قائمة[1].اسم
`);
  // out is only first element
  assert.strictEqual(out, 'أحمد');
});
