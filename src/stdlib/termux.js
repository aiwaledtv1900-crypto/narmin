'use strict';

const { execFile, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { makeNative, stringify } = require('../interpreter/values');

// ═══════════════════════════════════════════════════════════
//  وحدة Termux — تنفيذ أوامر النظام بأمان
// ═══════════════════════════════════════════════════════════

// تنفيذ متزامن — يُرجع كائناً غنياً
function execSync(cmd, args = [], options = {}) {
  const cwd = options.cwd || process.cwd();
  const timeout = options.timeout || 30000;

  try {
    const stdout = execFileSync(cmd, args, {
      cwd,
      timeout,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { نجح: true, كود: 0, خرج: stdout.trimEnd(), خطأ: '' };
  } catch (e) {
    return {
      نجح: false,
      كود: e.status || 1,
      خرج: (e.stdout || '').toString().trimEnd(),
      خطأ: (e.stderr || e.message || '').toString().trimEnd(),
    };
  }
}

// تنفيذ غير متزامن — Promise
function execAsync(cmd, args = [], options = {}) {
  return new Promise((resolve) => {
    const cwd = options.cwd || process.cwd();
    const timeout = options.timeout || 30000;

    execFile(cmd, args, {
      cwd,
      timeout,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          نجح: false,
          كود: err.code === 'ETIMEDOUT' ? 124 : (err.status || 1),
          خرج: (stdout || '').trimEnd(),
          خطأ: (stderr || err.message || '').trimEnd(),
        });
      } else {
        resolve({ نجح: true, كود: 0, خرج: (stdout || '').trimEnd(), خطأ: '' });
      }
    });
  });
}

// واجهة عربية مبسّطة لتنفيذ أوامر
function شغل(cmd, args = []) {
  if (typeof cmd !== 'string' || !cmd.trim()) {
    throw new Error('شغل() يتوقع نص الأمر');
  }
  if (!Array.isArray(args)) args = [];
  return execSync(cmd, args.map(String));
}

function شغل_في(cwd, cmd, args = []) {
  return execSync(cmd, args.map(String), { cwd });
}

// دوال الملفات
function اقرأ(مسار) {
  try {
    return fs.readFileSync(مسار, 'utf8');
  } catch (e) {
    throw new Error(`لا يمكن قراءة '${مسار}': ${e.message}`);
  }
}

function اكتب(مسار, محتوى) {
  try {
    fs.writeFileSync(مسار, String(محتوى), 'utf8');
    return true;
  } catch (e) {
    throw new Error(`لا يمكن كتابة '${مسار}': ${e.message}`);
  }
}

function أضف(مسار, محتوى) {
  try {
    fs.appendFileSync(مسار, String(محتوى), 'utf8');
    return true;
  } catch (e) {
    throw new Error(`لا يمكن الإضافة إلى '${مسار}': ${e.message}`);
  }
}

function موجود(مسار) {
  return fs.existsSync(مسار);
}

function احذف(مسار) {
  try {
    if (fs.statSync(مسار).isDirectory()) {
      fs.rmSync(مسار, { recursive: true, force: true });
    } else {
      fs.unlinkSync(مسار);
    }
    return true;
  } catch (e) {
    throw new Error(`لا يمكن حذف '${مسار}': ${e.message}`);
  }
}

function انسخ(من, إلى) {
  try {
    fs.cpSync(من, إلى, { recursive: true });
    return true;
  } catch (e) {
    throw new Error(`لا يمكن النسخ: ${e.message}`);
  }
}

function انقل(من, إلى) {
  try {
    fs.renameSync(من, إلى);
    return true;
  } catch (e) {
    throw new Error(`لا يمكن النقل: ${e.message}`);
  }
}

function مجلد(مسار) {
  try {
    fs.mkdirSync(مسار, { recursive: true });
    return true;
  } catch (e) {
    throw new Error(`لا يمكن إنشاء المجلد: ${e.message}`);
  }
}

function اقرأ_مجلد(مسار) {
  try {
    return fs.readdirSync(مسار);
  } catch (e) {
    throw new Error(`لا يمكن قراءة المجلد: ${e.message}`);
  }
}

function تفاصيل(مسار) {
  try {
    const s = fs.statSync(مسار);
    return {
      نوع: s.isDirectory() ? 'مجلد' : 'ملف',
      حجم: s.size,
      تعديل: s.mtime.toISOString(),
      إنشاء: s.birthtime.toISOString(),
      قابل_للقراءة: true,
    };
  } catch (e) {
    throw new Error(`لا يمكن قراءة التفاصيل: ${e.message}`);
  }
}

// المسارات
function مسار_الرئيسية() {
  return os.homedir();
}

function مسار_الحالي() {
  return process.cwd();
}

function غيّر_مجلد(مسار) {
  try {
    process.chdir(مسار);
    return process.cwd();
  } catch (e) {
    throw new Error(`لا يمكن تغيير المجلد: ${e.message}`);
  }
}

// دمج المسارات
function ضم(...أجزاء) {
  return path.join(...أجزاء);
}

function اسم_الملف(مسار) {
  return path.basename(مسار);
}

function امتداد(مسار) {
  return path.extname(مسار);
}

// معلومات النظام
function معلومات() {
  return {
    نظام: process.platform,
    معمارية: process.arch,
    إصدار_node: process.version,
    ذاكرة_حرة: Math.round(os.freemem() / 1024 / 1024),
    ذاكرة_كلية: Math.round(os.totalmem() / 1024 / 1024),
    المعالجات: os.cpus().length,
    الرئيسية: os.homedir(),
    مؤقت: os.tmpdir(),
    وقت: new Date().toISOString(),
  };
}

// قراءة JSON
function اقرأ_json(مسار) {
  try {
    return JSON.parse(fs.readFileSync(مسار, 'utf8'));
  } catch (e) {
    throw new Error(`JSON غير صالح: ${e.message}`);
  }
}

function اكتب_json(مسار, كائن) {
  try {
    fs.writeFileSync(مسار, JSON.stringify(كائن, null, 2), 'utf8');
    return true;
  } catch (e) {
    throw new Error(`لا يمكن كتابة JSON: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════
//  تثبيت الوحدة في البيئة
// ═══════════════════════════════════════════════════════════

function install(env) {
  const natives = {
    شغل: (args) => شغل(args[0], args[1] || []),
    شغل_في: (args) => شغل_في(args[0], args[1], args[2] || []),

    اقرأ: (args) => اقرأ(args[0]),
    اكتب: (args) => اكتب(args[0], args[1]),
    أضف: (args) => أضف(args[0], args[1]),
    موجود: (args) => موجود(args[0]),
    احذف: (args) => احذف(args[0]),
    انسخ: (args) => انسخ(args[0], args[1]),
    انقل: (args) => انقل(args[0], args[1]),
    مجلد: (args) => مجلد(args[0]),
    اقرأ_مجلد: (args) => اقرأ_مجلد(args[0]),
    تفاصيل: (args) => تفاصيل(args[0]),

    مسار_الرئيسية: () => مسار_الرئيسية(),
    مسار_الحالي: () => مسار_الحالي(),
    غيّر_مجلد: (args) => غيّر_مجلد(args[0]),
    ضم: (args) => ضم(...args),
    اسم_الملف: (args) => اسم_الملف(args[0]),
    امتداد: (args) => امتداد(args[0]),

    معلومات: () => معلومات(),
    اقرأ_json: (args) => اقرأ_json(args[0]),
    اكتب_json: (args) => اكتب_json(args[0], args[1]),
  };

  for (const [name, fn] of Object.entries(natives)) {
    env.defineLocal(name, makeNative(name, fn));
  }

  // كائن termux مجمّع
  const termuxNamespace = {
    شغل, شغل_في,
    اقرأ, اكتب, أضف, موجود, احذف, انسخ, انقل, مجلد, اقرأ_مجلد, تفاصيل,
    مسار_الرئيسية, مسار_الحالي, غيّر_مجلد, ضم, اسم_الملف, امتداد,
    معلومات, اقرأ_json, اكتب_json,
  };
  // غلّفه ليتصرف ككائن نارمين
  env.defineLocal('termux', termuxNamespace);
}

module.exports = {
  install,
  شغل, شغل_في,
  اقرأ, اكتب, أضف, موجود, احذف, انسخ, انقل, مجلد, اقرأ_مجلد, تفاصيل,
  مسار_الرئيسية, مسار_الحالي, غيّر_مجلد, ضم, اسم_الملف, امتداد,
  معلومات, اقرأ_json, اكتب_json,
};
