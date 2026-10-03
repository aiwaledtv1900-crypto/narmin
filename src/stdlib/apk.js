'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { makeNative } = require('../interpreter/values');

const HOME = os.homedir();
const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';

// ═══════════════════════════════════════════════════════════
//  كشف الأدوات
// ═══════════════════════════════════════════════════════════

const SEARCH_DIRS = [
  path.join(HOME, 'DEV/tools/bin'),
  path.join(HOME, 'DEV/tools/jars'),
  path.join(HOME, 'DEV/tools'),
  path.join(PREFIX, 'bin'),
  path.join(PREFIX, 'share/apktool'),
];

// ابحث عن أول jar اسمه يبدأ بـ prefix
function findJar(prefix) {
  for (const dir of SEARCH_DIRS) {
    if (!fs.existsSync(dir)) continue;
    try {
      for (const f of fs.readdirSync(dir)) {
        const lower = f.toLowerCase();
        if (lower.startsWith(prefix.toLowerCase()) && lower.endsWith('.jar')) {
          return path.join(dir, f);
        }
      }
    } catch (_) {}
  }
  return null;
}

// ابحث عن executable في PATH و SEARCH_DIRS
function findExecutable(names) {
  const paths = (process.env.PATH || '').split(':').filter(Boolean);
  const allDirs = [...paths, ...SEARCH_DIRS];
  for (const name of names) {
    for (const dir of allDirs) {
      const full = path.join(dir, name);
      try {
        if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
      } catch (_) {}
    }
  }
  return null;
}

// تشغيل أمر بأمان
function run(cmd, args, options = {}) {
  const cwd = options.cwd || process.cwd();
  const timeout = options.timeout || 300000;
  try {
    const out = execFileSync(cmd, args, {
      cwd, timeout, encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
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

// تشغيل apktool — من JAR مباشرة
function runApktool(args, options = {}) {
  const jar = findJar('apktool');
  if (jar) {
    return run('java', ['-jar', jar, ...args], options);
  }
  return run('apktool', args, options);
}

function validateApk(file) {
  if (!fs.existsSync(file)) throw new Error(`الملف غير موجود: ${file}`);
  if (!file.toLowerCase().endsWith('.apk')) {
    throw new Error(`ليس ملف APK: ${file}`);
  }
}

// ═══════════════════════════════════════════════════════════
//  الوظائف
// ═══════════════════════════════════════════════════════════

function apk_معلومات(مسار) {
  validateApk(مسار);
  const size = fs.statSync(مسار).size;

  const aapt2 = findExecutable(['aapt2']);
  if (aapt2) {
    const r = run(aapt2, ['dump', 'badging', مسار]);
    if (r.نجح) {
      const info = { المسار: مسار, الحجم: size, خام: r.خرج };
      for (const line of r.خرج.split('\n')) {
        if (line.startsWith('package:')) {
          const nameM = line.match(/name='([^']+)'/);
          const verM = line.match(/versionName='([^']+)'/);
          const codeM = line.match(/versionCode='([^']+)'/);
          if (nameM) info.حزمة = nameM[1];
          if (verM) info.إصدار = verM[1];
          if (codeM) info.كود = Number(codeM[1]);
        } else if (line.startsWith('application-label:')) {
          info.اسم = line.replace('application-label:', '').replace(/'/g, '').trim();
        } else if (line.startsWith('launchable-activity:')) {
          const m = line.match(/name='([^']+)'/);
          if (m) info.نشاط_الرئيسي = m[1];
        } else if (line.startsWith('sdkVersion:')) {
          info.أدنى_sdk = Number(line.split(':')[1].trim());
        } else if (line.startsWith('targetSdkVersion:')) {
          info.هدف_sdk = Number(line.split(':')[1].trim());
        }
      }
      return info;
    }
  }

  const apkInfo = findExecutable(['apk-info']);
  if (apkInfo) {
    const r = run(apkInfo, [مسار]);
    if (r.نجح) return { المسار: مسار, الحجم: size, خام: r.خرج };
  }

  return { المسار: مسار, الحجم: size, ملاحظة: 'لم تُتِح أي أداة قراءة التفاصيل' };
}

function apk_فك(مسار, مجلد_الخرج, خيارات = {}) {
  validateApk(مسار);
  const out = مجلد_الخرج || path.join(
    path.dirname(مسار),
    path.basename(مسار, '.apk') + '_decoded'
  );
  const args = ['d', مسار, '-o', out, '-f'];
  if (خيارات.بلا_موارد) args.push('-r');
  if (خيارات.بلا_سمالي) args.push('-s');

  const r = runApktool(args);
  if (!r.نجح) throw new Error(`فك APK فشل: ${r.خطأ}`);
  return { نجح: true, مجلد: out, خرج: r.خرج };
}

function apk_أعد_بناء(مجلد, مخرج, خيارات = {}) {
  if (!fs.existsSync(مجلد)) throw new Error(`المجلد غير موجود: ${مجلد}`);
  const args = ['b', مجلد];
  if (مخرج) args.push('-o', مخرج);
  if (خيارات.بلا_موارد) args.push('-r');

  const r = runApktool(args);
  if (!r.نجح) throw new Error(`إعادة البناء فشلت: ${r.خطأ}`);

  const defaultPath = path.join(مجلد, 'dist', path.basename(مجلد) + '.apk');
  const finalPath = مخرج || defaultPath;
  return { نجح: true, مسار: finalPath, خرج: r.خرج };
}

function apk_محاذاة(مدخل, مخرج) {
  validateApk(مدخل);
  const out = مخرج || مدخل.replace(/\.apk$/, '_aligned.apk');
  if (fs.existsSync(out) && out !== مدخل) fs.unlinkSync(out);
  const zipalign = findExecutable(['zipalign']);
  if (!zipalign) throw new Error('zipalign غير متوفر');
  const r = run(zipalign, ['-p', '-f', '4', مدخل, out]);
  if (!r.نجح) throw new Error(`zipalign فشل: ${r.خطأ}`);
  return { نجح: true, مسار: out, خرج: r.خرج };
}

function apk_وقّع(مسار, خيارات = {}) {
  validateApk(مسار);

  // 1) uber-apk-signer
  const signer = findExecutable(['uber-apk-signer', 'signer']);
  if (signer) {
    const args = ['-a', مسار];
    if (خيارات.keystore) {
      args.push('--ks', خيارات.keystore);
      if (خيارات.اسم_مستخدم) args.push('--ksAlias', خيارات.اسم_مستخدم);
      if (خيارات.كلمة_سر) args.push('--ksPass', خيارات.كلمة_سر);
      if (خيارات.كلمة_مفتاح) args.push('--ksKeyPass', خيارات.كلمة_مفتاح);
    }
    const r = run(signer, args);
    if (r.نجح) {
      const dir = path.dirname(مسار);
      const base = path.basename(مسار, '.apk');
      const candidates = [
        path.join(dir, base + '-aligned-signed.apk'),
        path.join(dir, base + '-signed.apk'),
        path.join(dir, base + '-aligned-debugSigned.apk'),
        path.join(dir, base + '-debugSigned.apk'),
      ];
      const signed = candidates.find((f) => fs.existsSync(f));
      return { نجح: true, مسار: signed || مسار, خرج: r.خرج, موقّع: true };
    }
  }

  // 2) signer.jar عبر java
  const signerJar = findJar('signer') || findJar('uber-apk-signer');
  if (signerJar) {
    const args = ['-jar', signerJar, '-a', مسار];
    if (خيارات.keystore) args.push('--ks', خيارات.keystore);
    const r = run('java', args);
    if (r.نجح) {
      const dir = path.dirname(مسار);
      const base = path.basename(مسار, '.apk');
      const signed = [
        path.join(dir, base + '-aligned-signed.apk'),
        path.join(dir, base + '-signed.apk'),
      ].find((f) => fs.existsSync(f));
      return { نجح: true, مسار: signed || مسار, خرج: r.خرج, موقّع: true };
    }
  }

  // 3) apk-sign script
  const apkSign = findExecutable(['apk-sign']);
  if (apkSign) {
    const r = run(apkSign, [مسار]);
    if (r.نجح) return { نجح: true, مسار, خرج: r.خرج, موقّع: true };
  }

  // 4) apksigner مباشرة
  const apksigner = findExecutable(['apksigner']);
  if (apksigner && خيارات.keystore) {
    const args = ['sign', '--ks', خيارات.keystore];
    if (خيارات.اسم_مستخدم) args.push('--ks-key-alias', خيارات.اسم_مستخدم);
    if (خيارات.كلمة_سر) args.push('--ks-pass', 'pass:' + خيارات.كلمة_سر);
    args.push(مسار);
    const r = run(apksigner, args);
    if (r.نجح) return { نجح: true, مسار, خرج: r.خرج, موقّع: true };
  }

  throw new Error('لا توجد أداة توقيع متاحة');
}

function apk_استخرج(مسار, مجلد_الخرج) {
  validateApk(مسار);
  const out = مجلد_الخرج || path.join(
    path.dirname(مسار),
    path.basename(مسار, '.apk') + '_extracted'
  );
  if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });
  const r = run('unzip', ['-o', مسار, '-d', out]);
  if (!r.نجح) throw new Error(`الاستخراج فشل: ${r.خطأ}`);
  return { نجح: true, مجلد: out };
}

function apk_فك_سمالي(مسار, مجلد_الخرج) {
  const out = مجلد_الخرج || path.join(
    path.dirname(مسار),
    path.basename(مسار, '.dex') + '_smali'
  );
  if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

  const baksmaliExe = findExecutable(['baksmali']);
  let r;
  if (baksmaliExe) {
    r = run(baksmaliExe, ['d', مسار, '-o', out]);
  } else {
    const baksmaliJar = findJar('baksmali');
    if (!baksmaliJar) throw new Error('baksmali غير متوفر');
    r = run('java', ['-jar', baksmaliJar, 'd', مسار, '-o', out]);
  }
  if (!r.نجح) throw new Error(`فك smali فشل: ${r.خطأ}`);
  return { نجح: true, مجلد: out };
}

function apk_فك_java(مسار, مجلد_الخرج) {
  const out = مجلد_الخرج || path.join(
    path.dirname(مسار),
    path.basename(مسار, '.apk') + '_java'
  );
  const jadx = findExecutable(['jadx']);
  if (!jadx) throw new Error('jadx غير متوفر');
  const r = run(jadx, ['-d', out, مسار]);
  if (!r.نجح) throw new Error(`jadx فشل: ${r.خطأ}`);
  return { نجح: true, مجلد: out };
}

function apk_بدّل_نص(مسار_ملف, بحث, بديل) {
  if (!fs.existsSync(مسار_ملف)) throw new Error(`الملف غير موجود: ${مسار_ملف}`);
  const محتوى = fs.readFileSync(مسار_ملف, 'utf8');
  const جديد = محتوى.split(بحث).join(بديل);
  fs.writeFileSync(مسار_ملف, جديد, 'utf8');
  return {
    نجح: true,
    المسار: مسار_ملف,
    عدد_التبديلات: محتوى.split(بحث).length - 1,
  };
}

function ابحث_keystore() {
  const files = fs.readdirSync(HOME).filter((f) => f.endsWith('.keystore'));
  return files.length ? path.join(HOME, files[0]) : null;
}

function apk_بيئة() {
  return {
    apktool_jar: findJar('apktool') || 'غير موجود',
    signer_jar: findJar('signer') || 'غير موجود',
    baksmali_jar: findJar('baksmali') || 'غير موجود',
    java: findExecutable(['java']) || 'غير موجود',
    aapt2: findExecutable(['aapt2']) || 'غير موجود',
    zipalign: findExecutable(['zipalign']) || 'غير موجود',
    apksigner: findExecutable(['apksigner']) || 'غير موجود',
    uber_apk_signer: findExecutable(['uber-apk-signer', 'signer']) || 'غير موجود',
    jadx: findExecutable(['jadx']) || 'غير موجود',
    baksmali: findExecutable(['baksmali']) || 'غير موجود',
    apk_info: findExecutable(['apk-info']) || 'غير موجود',
    unzip: findExecutable(['unzip']) || 'غير موجود',
    keystore: ابحث_keystore() || 'غير موجود',
  };
}

// ═══════════════════════════════════════════════════════════
//  التثبيت
// ═══════════════════════════════════════════════════════════

function install(env) {
  const natives = {
    apk_معلومات: (args) => apk_معلومات(args[0]),
    apk_فك: (args) => apk_فك(args[0], args[1], args[2] || {}),
    apk_أعد_بناء: (args) => apk_أعد_بناء(args[0], args[1], args[2] || {}),
    apk_محاذاة: (args) => apk_محاذاة(args[0], args[1]),
    apk_وقّع: (args) => apk_وقّع(args[0], args[1] || {}),
    apk_استخرج: (args) => apk_استخرج(args[0], args[1]),
    apk_فك_سمالي: (args) => apk_فك_سمالي(args[0], args[1]),
    apk_فك_java: (args) => apk_فك_java(args[0], args[1]),
    apk_بدّل_نص: (args) => apk_بدّل_نص(args[0], args[1], args[2]),
    apk_بيئة: () => apk_بيئة(),
    ابحث_keystore: () => ابحث_keystore(),
  };

  for (const [name, fn] of Object.entries(natives)) {
    env.defineLocal(name, makeNative(name, fn));
  }

  env.defineLocal('apk', {
    معلومات: apk_معلومات,
    فك: apk_فك,
    أعد_بناء: apk_أعد_بناء,
    محاذاة: apk_محاذاة,
    وقّع: apk_وقّع,
    استخرج: apk_استخرج,
    فك_سمالي: apk_فك_سمالي,
    فك_java: apk_فك_java,
    بدّل_نص: apk_بدّل_نص,
    بيئة: apk_بيئة,
  });
}

module.exports = {
  install,
  apk_معلومات, apk_فك, apk_أعد_بناء, apk_محاذاة, apk_وقّع,
  apk_استخرج, apk_فك_سمالي, apk_فك_java, apk_بدّل_نص,
  apk_بيئة, ابحث_keystore,
  findJar, findExecutable,
};
