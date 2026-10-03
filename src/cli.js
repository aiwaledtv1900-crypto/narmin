#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { tokenize } = require('./lexer/lexer');
const { run } = require('./interpreter/interpreter');

const args = process.argv.slice(2);
const cmd = args[0];

function showHelp() {
  console.log('نارمين — Narmin v0.1.0');
  console.log('');
  console.log('الاستخدام:');
  console.log('  narmin                     تشغيل REPL التفاعلي');
  console.log('  narmin repl                تشغيل REPL التفاعلي');
  console.log('  narmin run <file.narm>     تشغيل ملف');
  console.log('  narmin run --code "..."    تشغيل كود مباشر');
  console.log('  narmin lex <file.narm>     عرض الرموز');
  console.log('  narmin lex --string "..."  رموز نص');
  console.log('  narmin --help              هذه المساعدة');
  console.log('');
  console.log('أمثلة:');
  console.log('  narmin');
  console.log('  narmin run examples/hello.narm');
  console.log('  narmin run --code "اطبع 2 + 3"');
}

// اختصار: narm file.narm == narmin run file.narm
if (cmd && cmd.endsWith('.narm')) {
  const { run } = require('./interpreter/interpreter');
  const fs = require('fs');
  const file = require('path').resolve(cmd);
  if (!fs.existsSync(file)) {
    console.error(`خطأ: الملف غير موجود: ${file}`);
    process.exit(1);
  }
  try {
    run(fs.readFileSync(file, 'utf8'), { output: (t) => console.log(t) });
  } catch (e) {
    console.error(`خطأ: ${e.message}`);
    process.exit(1);
  }
  process.exit(0);
}

if (!cmd || cmd === 'repl') {
  const { startRepl } = require('./repl');
  startRepl();
  return;
}

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  showHelp();
  process.exit(0);
}

if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
  console.log('نارمين v0.1.0');
  process.exit(0);
}

if (cmd === 'run') {
  let source;
  let origin = '(مباشر)';

  if (args[1] === '--code') {
    source = args.slice(2).join(' ');
  } else if (args[1]) {
    const file = path.resolve(args[1]);
    if (!fs.existsSync(file)) {
      console.error(`خطأ: الملف غير موجود: ${file}`);
      process.exit(1);
    }
    source = fs.readFileSync(file, 'utf8');
    origin = path.basename(file);
  } else {
    console.error('خطأ: لم يُعطَ ملف أو كود');
    process.exit(1);
  }

  try {
    run(source, { output: (text) => console.log(text) });
  } catch (e) {
    console.error(`خطأ: ${e.message}`);
    process.exit(1);
  }
  process.exit(0);
}

if (cmd === 'lex') {
  let source;
  let origin = '(نص مباشر)';

  if (args[1] === '--string') {
    source = args.slice(2).join(' ');
  } else if (args[1]) {
    const file = path.resolve(args[1]);
    if (!fs.existsSync(file)) {
      console.error(`خطأ: الملف غير موجود: ${file}`);
      process.exit(1);
    }
    source = fs.readFileSync(file, 'utf8');
    origin = path.basename(file);
  } else {
    console.error('خطأ: لم يُعطَ ملف أو نص');
    process.exit(1);
  }

  console.log(`# ملف: ${origin}`);
  console.log(`# الطول: ${source.length} حرف`);
  console.log('');

  try {
    const tokens = tokenize(source);
    for (const t of tokens) {
      const val = t.value !== undefined ? ` "${t.value}"` : '';
      const can = t.canonical ? ` → ${t.canonical}` : '';
      const loc = `@${t.line}:${t.col}`;
      console.log(`${loc.padEnd(9)} ${t.type}${val}${can}`);
    }
    console.log('');
    console.log(`# الإجمالي: ${tokens.length - 1} رمز (+EOF)`);
  } catch (e) {
    console.error(`خطأ: ${e.message}`);
    process.exit(1);
  }
  process.exit(0);
}

console.error(`أمر غير معروف: ${cmd}`);
showHelp();
process.exit(1);
