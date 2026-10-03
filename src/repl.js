'use strict';

const readline = require('readline');
const { parse } = require('./parser/parser');
const { Interpreter } = require('./interpreter/interpreter');
const { stringify } = require('./interpreter/values');
const { ReturnSignal, BreakSignal, ContinueSignal, NarminError } = require('./interpreter/signals');

// ألوان ANSI بسيطة
const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const PROMPT = `${C.cyan}${C.bold}نارمين${C.reset} ${C.green}»${C.reset} `;
const CONT_PROMPT = `${C.dim}   ...${C.reset} `;

function printBanner() {
  console.log('');
  console.log(`${C.cyan}${C.bold}  نارمين  •  Narmin v0.1.0${C.reset}`);
  console.log(`${C.dim}  لغة برمجة عربية-إنجليزية${C.reset}`);
  console.log('');
  console.log(`${C.dim}  اكتب ${C.reset}${C.yellow}.مساعدة${C.reset}${C.dim} للمساعدة،${C.reset} ${C.yellow}.خروج${C.reset}${C.dim} للخروج${C.reset}`);
  console.log(`${C.dim}  Ctrl+D للخروج السريع${C.reset}`);
  console.log('');
}

function printHelp() {
  console.log('');
  console.log(`${C.bold}أوامر REPL:${C.reset}`);
  console.log(`  ${C.yellow}.مساعدة${C.reset}   عرض هذه المساعدة`);
  console.log(`  ${C.yellow}.خروج${C.reset}     الخروج من REPL`);
  console.log(`  ${C.yellow}.مسح${C.reset}      مسح الشاشة`);
  console.log(`  ${C.yellow}.متغيرات${C.reset}  عرض كل المتغيرات الحالية`);
  console.log(`  ${C.yellow}.مصفوفة${C.reset}   مسح كل المتغيرات`);
  console.log('');
  console.log(`${C.bold}أمثلة:${C.reset}`);
  console.log(`  ${C.dim}>${C.reset} اطبع "مرحباً"`);
  console.log(`  ${C.dim}>${C.reset} متغير س = 42`);
  console.log(`  ${C.dim}>${C.reset} س * 2`);
  console.log(`  ${C.dim}>${C.reset} دالة جمع(ا، ب) { ارجع ا + ب }`);
  console.log(`  ${C.dim}>${C.reset} جمع(3، 4)`);
  console.log('');
}

// هل السطر ينتهي بـ كتلة غير مغلقة؟
function isIncomplete(source) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
    if (ch === '#') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    if (ch === '}' || ch === ')' || ch === ']') depth--;
  }
  return depth > 0;
}

function startRepl() {
  const interp = new Interpreter();
  // في REPL نطبع القيم المُرجَعة تلقائياً (كما يفعل Node)
  let lastExprValue = null;
  let printLast = false;

  // غلاف على output
  const originalOutput = interp.output;
  interp.output = (text) => originalOutput(text);

  printBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: PROMPT,
    terminal: true,
  });

  let buffer = '';
  let multiline = false;

  rl.prompt();

  rl.on('line', (line) => {
    // أوامر REPL تبدأ بنقطة
    if (!multiline && line.startsWith('.')) {
      const cmd = line.trim();
      if (cmd === '.خروج' || cmd === '.exit' || cmd === '.quit') {
        console.log(`${C.dim}وداعاً يا DEV${C.reset}`);
        process.exit(0);
      }
      if (cmd === '.مساعدة' || cmd === '.help') {
        printHelp();
        rl.prompt();
        return;
      }
      if (cmd === '.مسح' || cmd === '.clear') {
        console.clear();
        rl.prompt();
        return;
      }
      if (cmd === '.متغيرات' || cmd === '.vars') {
        const vars = interp.global.values;
        if (vars.size === 0) {
          console.log(`${C.dim}(لا متغيرات)${C.reset}`);
        } else {
          for (const [name, value] of vars) {
            const constMark = interp.global.consts.has(name) ? `${C.yellow}ثابت${C.reset} ` : '';
            console.log(`  ${constMark}${C.cyan}${name}${C.reset} = ${stringify(value)}`);
          }
        }
        rl.prompt();
        return;
      }
      if (cmd === '.مصفوفة' || cmd === '.reset') {
        interp.global.values.clear();
        interp.global.consts.clear();
        interp.installBuiltins();
        console.log(`${C.green}✓ تم مسح البيئة${C.reset}`);
        rl.prompt();
        return;
      }
      console.log(`${C.red}أمر غير معروف: ${cmd}${C.reset}`);
      rl.prompt();
      return;
    }

    buffer += (buffer ? '\n' : '') + line;

    if (isIncomplete(buffer)) {
      multiline = true;
      rl.setPrompt(CONT_PROMPT);
      rl.prompt();
      return;
    }

    multiline = false;
    rl.setPrompt(PROMPT);

    const source = buffer.trim();
    buffer = '';

    if (!source) { rl.prompt(); return; }

    try {
      const ast = parse(source);

      // هل هو تعبير واحد فقط؟ اعرض قيمته
      const isSingleExpr = ast.body.length === 1 && ast.body[0].type === 'ExprStmt';

      // اعتراض output للطباعة
      let printed = false;
      const realOutput = interp.output;
      interp.output = (text) => { printed = true; realOutput(text); };

      if (isSingleExpr) {
        // قيّم التعبير مباشرة واطبع قيمته
        const value = interp.eval(ast.body[0].expr, interp.global);
        if (value !== null && value !== undefined) {
          console.log(`${C.dim}→${C.reset} ${C.magenta}${stringify(value)}${C.reset}`);
        }
      } else {
        for (const stmt of ast.body) {
          interp.exec(stmt, interp.global);
        }
      }

      interp.output = realOutput;
    } catch (e) {
      if (e instanceof ReturnSignal || e instanceof BreakSignal || e instanceof ContinueSignal) {
        console.log(`${C.red}خطأ: ${e.constructor.name} في السياق العام${C.reset}`);
      } else if (e instanceof NarminError) {
        const loc = e.line ? ` [سطر ${e.line}]` : '';
        console.log(`${C.red}خطأ${loc}: ${e.message}${C.reset}`);
      } else {
        console.log(`${C.red}خطأ: ${e.message}${C.reset}`);
      }
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(`\n${C.dim}وداعاً يا DEV${C.reset}`);
    process.exit(0);
  });
}

module.exports = { startRepl };
