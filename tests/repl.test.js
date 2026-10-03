'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'src', 'cli.js');

function runRepl(inputs, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [CLI, 'repl'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr });
    }, timeout);

    proc.on('close', () => {
      clearTimeout(timer);
      resolve({ stdout, stderr });
    });

    let i = 0;
    function sendNext() {
      if (i < inputs.length) {
        proc.stdin.write(inputs[i++] + '\n');
        setTimeout(sendNext, 80);
      } else {
        setTimeout(() => proc.stdin.end(), 100);
      }
    }
    setTimeout(sendNext, 150);
  });
}

test('REPL: طباعة سطر', async () => {
  const { stdout } = await runRepl(['اطبع "مرحباً"', '.خروج']);
  assert.match(stdout, /مرحباً/);
});

test('REPL: حفظ المتغيرات بين الأسطر', async () => {
  const { stdout } = await runRepl([
    'متغير س = 42',
    'اطبع س',
    '.خروج',
  ]);
  assert.match(stdout, /42/);
});

test('REPL: قيمة تعبير تُطبع تلقائياً', async () => {
  const { stdout } = await runRepl(['2 + 3', '.خروج']);
  assert.match(stdout, /5/);
});

test('REPL: دالة ثم استدعاء', async () => {
  const { stdout } = await runRepl([
    'دالة ضعف(س) { ارجع س * 2 }',
    'اطبع ضعف(21)',
    '.خروج',
  ]);
  assert.match(stdout, /42/);
});

test('REPL: خطأ لا ينهي الجلسة', async () => {
  const { stdout } = await runRepl([
    'اطبع 1 / 0',
    'اطبع "نجوت"',
    '.خروج',
  ]);
  assert.match(stdout, /القسمة على صفر/);
  assert.match(stdout, /نجوت/);
});

test('REPL: كتلة متعددة الأسطر', async () => {
  const { stdout } = await runRepl([
    'اذا صحيح {',
    '  اطبع "داخل"',
    '}',
    '.خروج',
  ]);
  assert.match(stdout, /داخل/);
});

test('REPL: أمر .متغيرات', async () => {
  const { stdout } = await runRepl([
    'متغير س = 1',
    'متغير ص = 2',
    '.متغيرات',
    '.خروج',
  ]);
  assert.match(stdout, /س/);
  assert.match(stdout, /ص/);
});
