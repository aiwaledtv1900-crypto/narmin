'use strict';

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { NaturalSession } = require('./session');

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', magenta: '\x1b[35m',
};

function startNaturalRepl() {
  const session = new NaturalSession();

  console.log('');
  console.log(`${C.cyan}${C.bold}  ╭─────────────────────────────────────╮${C.reset}`);
  console.log(`${C.cyan}${C.bold}  │   نارمين — الوضع الطبيعي v0.6      │${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ╰─────────────────────────────────────╯${C.reset}`);
  console.log('');
  console.log(`${C.dim}  اكتب أوامرك بالعربية. "مساعدة" للأوامر.${C.reset}`);
  console.log(`${C.dim}  مثال: انشئ تطبيق "مذكرتي"${C.reset}`);
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${C.green}${C.bold}نارمين${C.reset} ${C.dim}»${C.reset} `,
    terminal: true,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) { rl.prompt(); return; }

    let result;
    try {
      result = session.parse(text);
    } catch (e) {
      console.log(`${C.red}✗ ${e.message}${C.reset}`);
      rl.prompt();
      return;
    }

    if (result === null) { rl.prompt(); return; }

    if (typeof result === 'string') {
      console.log(result);
      rl.prompt();
      return;
    }

    if (result.action === 'quit') {
      console.log(`${C.dim}وداعاً يا DEV${C.reset}`);
      process.exit(0);
    }

    if (result.action === 'build' || result.action === 'build_and_run') {
      await buildApp(session, result.action === 'build_and_run');
      rl.prompt();
      return;
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(`\n${C.dim}وداعاً يا DEV${C.reset}`);
    process.exit(0);
  });
}

async function buildApp(session, install) {
  console.log(`${C.dim}▶ توليد الكود...${C.reset}`);

  const code = session.generateNarmCode();
  const tmpFile = path.join(os.homedir(), '.narmin_natural.narm');
  fs.writeFileSync(tmpFile, code, 'utf8');

  const projectName = (session.appName || 'NarminApp').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '') || 'NarminApp';
  const cleanName = 'Narmin' + Date.now().toString(36).slice(-4);

  console.log(`${C.dim}▶ المشروع: ${cleanName}${C.reset}`);

  try {
    const { Interpreter } = require('../interpreter/interpreter');
    const interp = new Interpreter();
    // كتم مخرجات Android (gradle طويلة)
    interp.output = () => {};

    // 1) ولّد المشروع
    const gen = interp.callFn(interp.global.get('android_من_نارمين'), [tmpFile, cleanName]);
    console.log(`${C.green}✓${C.reset} المشروع في: ${gen.مسار}`);

    // 2) ابنِ
    console.log(`${C.dim}▶ البناء (يستغرق 15-40 ثانية)...${C.reset}`);
    const buildResult = interp.callFn(interp.global.get('android_بناء'), [gen.مسار]);

    if (!buildResult.نجح) {
      console.log(`${C.red}✗ فشل البناء${C.reset}`);
      if (buildResult.خطأ) console.log(buildResult.خطأ.slice(0, 500));
      return;
    }
    console.log(`${C.green}✓${C.reset} تم البناء`);

    if (!install) return;

    // 3) ثبّت
    console.log(`${C.dim}▶ التثبيت...${C.reset}`);
    const inst = interp.callFn(interp.global.get('android_ثبّت'), [buildResult.apk]);

    if (!inst.نجح) {
      console.log(`${C.red}✗ فشل التثبيت${C.reset}`);
      console.log(inst.خطأ.slice(0, 300));
      return;
    }
    console.log(`${C.green}✓${C.reset} تم التثبيت`);

    // 4) شغّل
    interp.callFn(interp.global.get('android_شغّل'), [gen.حزمة, '.Screen1Activity']);
    console.log(`${C.green}✓${C.reset} ${C.bold}التطبيق يعمل على هاتفك${C.reset}`);
    console.log('');
  } catch (e) {
    console.log(`${C.red}✗ ${e.message}${C.reset}`);
  }
}

function runBatch(file) {
  if (!fs.existsSync(file)) {
    console.error(`✗ الملف غير موجود: ${file}`);
    process.exit(1);
  }
  const session = new NaturalSession();
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let pendingBuild = null;

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    console.log(`${C.dim}>${C.reset} ${t}`);
    const r = session.parse(t);
    if (typeof r === 'string') { console.log(r); continue; }
    if (r && r.action === 'quit') break;
    if (r && (r.action === 'build' || r.action === 'build_and_run')) {
      pendingBuild = r.action === 'build_and_run';
    }
  }

  if (pendingBuild !== null) {
    buildApp(session, pendingBuild).then(() => process.exit(0));
  } else {
    console.log('');
    console.log(session.renderState());
  }
}

module.exports = { startNaturalRepl, runBatch };
