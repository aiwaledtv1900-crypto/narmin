'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { run } = require('../src/interpreter/interpreter');

function exec(src) {
  return run(src).output;
}

test('اطبع رقم', () => {
  assert.deepStrictEqual(exec('اطبع 42'), ['42']);
});

test('اطبع نص', () => {
  assert.deepStrictEqual(exec('اطبع "مرحباً يا DEV"'), ['مرحباً يا DEV']);
});

test('اطبع تعبير حسابي', () => {
  assert.deepStrictEqual(exec('اطبع 2 + 3 * 4'), ['14']);
});

test('متغير + طباعة', () => {
  assert.deepStrictEqual(exec(`
متغير س = 10
اطبع س
`), ['10']);
});

test('تعديل متغير', () => {
  assert.deepStrictEqual(exec(`
متغير س = 1
س = س + 5
اطبع س
`), ['6']);
});

test('ثابت لا يُعدَّل', () => {
  assert.throws(() => exec(`
ثابت π = 3.14
π = 4
`), /لا يمكن تعديل الثابت/);
});

test('if صحيح', () => {
  assert.deepStrictEqual(exec(`
اذا صحيح {
  اطبع "نعم"
}
`), ['نعم']);
});

test('if خطأ مع والا', () => {
  assert.deepStrictEqual(exec(`
اذا خطأ {
  اطبع "نعم"
} والا {
  اطبع "لا"
}
`), ['لا']);
});

test('while يعد حتى 3', () => {
  assert.deepStrictEqual(exec(`
متغير ع = 0
طالما ع < 3 {
  اطبع ع
  ع = ع + 1
}
`), ['0', '1', '2']);
});

test('while مع اكسر', () => {
  assert.deepStrictEqual(exec(`
متغير ع = 0
طالما صحيح {
  اذا ع >= 3 { اكسر }
  اطبع ع
  ع = ع + 1
}
`), ['0', '1', '2']);
});

test('دالة ترجع قيمة', () => {
  assert.deepStrictEqual(exec(`
دالة جمع(ا، ب) {
  ارجع ا + ب
}
اطبع جمع(3، 4)
`), ['7']);
});

test('دالة استدعاء متداخل', () => {
  assert.deepStrictEqual(exec(`
دالة ضعف(س) { ارجع س * 2 }
دالة جمع(ا، ب) { ارجع ا + ب }
اطبع ضعف(جمع(1، 2))
`), ['6']);
});

test('for مع مصفوفة', () => {
  assert.deepStrictEqual(exec(`
لكل س في [10، 20، 30] {
  اطبع س
}
`), ['10', '20', '30']);
});

test('مصفوفة + طول', () => {
  assert.deepStrictEqual(exec(`
متغير ق = [1، 2، 3]
اطبع طول(ق)
`), ['3']);
});

test('نوع()', () => {
  assert.deepStrictEqual(exec(`
اطبع نوع(42)
اطبع نوع("نص")
اطبع نوع(صحيح)
اطبع نوع([1،2])
`), ['رقم', 'نص', 'منطقي', 'مصفوفة']);
});

test('ناقل |> مع دالة', () => {
  assert.deepStrictEqual(exec(`
دالة ضعف(س) { ارجع س * 2 }
متغير نتيجة = 5 |> ضعف |> ضعف
اطبع نتيجة
`), ['20']);
});

test('خريطة على مصفوفة', () => {
  assert.deepStrictEqual(exec(`
دالة ضعف(س) { ارجع س * 2 }
متغير ن = [1، 2، 3].خريطة(ضعف)
اطبع ن
`), ['[2، 4، 6]']);
});

test('صفي على مصفوفة', () => {
  assert.deepStrictEqual(exec(`
دالة زوجي(س) { ارجع س % 2 == 0 }
اطبع [1، 2، 3، 4، 5].صفي(زوجي)
`), ['[2، 4]']);
});

test('مدى()', () => {
  assert.deepStrictEqual(exec('اطبع مدى(5)'), ['[0، 1، 2، 3، 4]']);
  assert.deepStrictEqual(exec('اطبع مدى(2، 5)'), ['[2، 3، 4]']);
});

test('نطاق البيئة معزول', () => {
  assert.throws(() => exec(`
اذا صحيح {
  متغير داخل = 5
}
اطبع داخل
`), /غير معرّف/);
});

test('القسمة على صفر', () => {
  assert.throws(() => exec('اطبع 1 / 0'), /القسمة على صفر/);
});

test('عدد معاملات خاطئ', () => {
  assert.throws(() => exec(`
دالة جمع(ا، ب) { ارجع ا + ب }
جمع(1)
`), /تتوقع 2 معامل/);
});
