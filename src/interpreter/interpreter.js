'use strict';

const { NodeType: N, AST } = require('../ast/nodes');
const { Environment } = require('./environment');
const {
  stringify, isTruthy, equals, typeName,
  makeFunction,
} = require('./values');
const {
  ReturnSignal, BreakSignal, ContinueSignal, NarminError, ThrowSignal,
} = require('./signals');

class Interpreter {
  constructor(options = {}) {
    this.global = new Environment();
    this.output = options.output || ((text) => process.stdout.write(text + '\n'));
    this.installBuiltins();
  }

  installBuiltins() {
    const { makeNative } = require('./values');
    const self = this;

    // اطبع كدالة أيضاً (للاستخدام داخل التعابير)
    this.global.defineLocal('اطبع', makeNative('اطبع', (args) => {
      self.output(args.map(stringify).join(' '));
      return null;
    }));

    this.global.defineLocal('طول', makeNative('طول', (args) => {
      const v = args[0];
      if (typeof v === 'string') return v.length;
      if (Array.isArray(v)) return v.length;
      throw new Error(`طول() يتوقع نصاً أو مصفوفة، استلم ${typeName(v)}`);
    }));

    this.global.defineLocal('نوع', makeNative('نوع', (args) => typeName(args[0])));

    this.global.defineLocal('رقم', makeNative('رقم', (args) => {
      const n = Number(args[0]);
      if (Number.isNaN(n)) throw new Error(`لا يمكن تحويل '${args[0]}' إلى رقم`);
      return n;
    }));

    this.global.defineLocal('نص', makeNative('نص', (args) => stringify(args[0])));

    this.global.defineLocal('مدى', makeNative('مدى', (args) => {
      const start = args.length === 1 ? 0 : args[0];
      const end = args.length === 1 ? args[0] : args[1];
      const step = args[2] || 1;
      const result = [];
      if (step > 0) for (let i = start; i < end; i += step) result.push(i);
      else if (step < 0) for (let i = start; i > end; i += step) result.push(i);
      return result;
    }));

    // يبدأ_بـ
    this.global.defineLocal('يبدأ_بـ', makeNative('يبدأ_بـ', (args) => {
      const [s, prefix] = args;
      return String(s).startsWith(String(prefix));
    }));

    // استبعد: يزيل العناصر التي تحقّق شرطاً (دالة)
    this.global.defineLocal('استبعد', makeNative('استبعد', (args) => {
      const [arr, predicate] = args;
      if (!Array.isArray(arr)) throw new Error('استبعد() يتوقع مصفوفة');
      const self = this;
      const toRemove = arr.filter((v) => isTruthy(self.callFn(predicate, [v])));
      for (const item of toRemove) {
        const idx = arr.indexOf(item);
        if (idx >= 0) arr.splice(idx, 1);
      }
      return arr;
    }));

    // احذف_من
    this.global.defineLocal('احذف_من', makeNative('احذف_من', (args) => {
      const [arr, item] = args;
      if (!Array.isArray(arr)) throw new Error('احذف_من() يتوقع مصفوفة');
      const idx = arr.indexOf(item);
      if (idx >= 0) arr.splice(idx, 1);
      return arr;
    }));

    // تنسيق الأرقام
    this.global.defineLocal('نسّق', makeNative('نسّق', (args) => {
      const n = args[0];
      if (typeof n !== 'number') return String(n);
      if (Number.isInteger(n)) return String(n);
      // للأرقام العشرية: حتى 6 منازل مع إزالة الأصفار
      return n.toFixed(6).replace(/\.?0+$/, '');
    }));

    // دوال المصفوفات
    this.global.defineLocal('أضف', makeNative('أضف', (args) => {
      const [arr, v] = args;
      if (!Array.isArray(arr)) throw new Error('أضف() يتوقع مصفوفة');
      arr.push(v);
      return arr;
    }));

    // تخزين محلي (JSON file)
    const storagePath = path.join(os.homedir(), '.narmin_storage.json');
    this.storagePath = storagePath;
    this._storage = {};
    if (fs.existsSync(storagePath)) {
      try { this._storage = JSON.parse(fs.readFileSync(storagePath, 'utf8')); }
      catch (_) { this._storage = {}; }
    }
    const saveStorage = () => {
      try {
        fs.writeFileSync(this.storagePath, JSON.stringify(this._storage, null, 2), 'utf8');
      } catch (_) {}
    };
    this._saveStorage = saveStorage;

    this.global.defineLocal('خزّن', makeNative('خزّن', (args) => {
      this._storage[String(args[0])] = args[1];
      this._saveStorage();
      return true;
    }));

    this.global.defineLocal('اقرأ_مخزناً', makeNative('اقرأ_مخزناً', (args) => {
      const key = String(args[0]);
      if (key in this._storage) return this._storage[key];
      return args.length > 1 ? args[1] : null;
    }));

    this.global.defineLocal('امسح_مخزناً', makeNative('امسح_مخزناً', () => {
      this._storage = {};
      this._saveStorage();
      return true;
    }));

    // وحدة Termux
    const termux = require('../stdlib/termux');
    termux.install(this.global);

    // وحدة APK
    const apk = require('../stdlib/apk');
    apk.install(this.global);

    // وحدة Android
    const android = require('../stdlib/android');
    android.install(this.global);
  }

  run(program) {
    for (const stmt of program.body) {
      this.exec(stmt, this.global);
    }
  }

  // ═══════ الجمل ═══════
  exec(node, env) {
    switch (node.type) {
      case N.PRINT: return this.execPrint(node, env);
      case N.EXPR_STMT: return this.eval(node.expr, env);
      case N.ASSIGN: return this.execAssign(node, env);
      case N.LET: return this.execLet(node, env, false);
      case N.CONST: return this.execLet(node, env, true);
      case N.IF: return this.execIf(node, env);
      case N.WHILE: return this.execWhile(node, env);
      case N.FOR: return this.execFor(node, env);
      case N.FUNCTION: return this.execFunction(node, env);
      case N.RETURN: return this.execReturn(node, env);
      case N.TRY: return this.execTry(node, env);
      case N.IMPORT: return this.execImport(node, env);
      case N.THROW: return this.execThrow(node, env);
      case N.BREAK: throw new BreakSignal();
      case N.CONTINUE: throw new ContinueSignal();
      case N.BLOCK: return this.execBlock(node, env);
      case N.PROGRAM: return this.run(node);

      // عقد تُعالَج في Codegen — لا في التنفيذ
      case N.STATE_DECL:
      case N.KOTLIN_RAW:
      case N.KOTLIN_IMPORT:
      case N.GRADLE_DEP:
      case N.ANDROID_PERMISSION:
      case N.NAVIGATE:
      case N.TOAST:
      case N.ALERT:
      case N.BACK:
      case N.UI_LIST:
      case N.REMOVE_FROM:
      case N.UI_DONE:
      case N.UI_TOPBAR:
      case N.APP_ICON:
        return;
      case N.STYLE_DECL:
        this._styles = this._styles || new Map();
        this._styles.set(node.name, node.value);
        return;
      case N.STYLE_SET:
        this._styles = this._styles || new Map();
        this._styles.set(node.name, node.value);
        return;

      // عقد واجهات أندرويد — تُعالَج في Codegen، لا في التنفيذ
      case N.SCREEN: return this.execScreen(node, env);
      case N.UI_HEADING:
      case N.UI_TEXT:
      case N.UI_BUTTON:
      case N.UI_CARD:
        return; // لا تفعل شيئاً — للـ codegen فقط
      default:
        throw new NarminError(`عقدة غير معروفة: ${node.type}`);
    }
  }

  execScreen(node, env) {
    this.output(`[شاشة: ${node.name}]`);
    // 1) عرّف كل الأنماط والحالات أولاً
    this._styles = this._styles || new Map();
    for (const child of node.children) {
      if (child.type === N.STYLE_DECL) {
        this._styles.set(child.name, child.value);
        this.output(`  🎨 نمط: ${child.name} = "${child.value}"`);
      } else if (child.type === N.STYLE_SET) {
        this._styles.set(child.name, child.value);
        this.output(`  🎨 تحديث: ${child.name} = "${child.value}"`);
      } else if (child.type === N.STATE_DECL) {
        this.execScreenElement(child, env, 1);
      }
    }
    // 2) الآن اعرض باقي العناصر
    for (const child of node.children) {
      if (child.type !== N.STATE_DECL &&
          child.type !== N.STYLE_DECL &&
          child.type !== N.STYLE_SET) {
        this.execScreenElement(child, env, 1);
      }
    }
  }

  execScreenElement(node, env, depth) {
    const pad = '  '.repeat(depth);
    if (node.type === N.UI_HEADING) {
      this.output(`${pad}▸ عنوان: ${stringify(this.eval(node.text, env))}`);
    } else if (node.type === N.UI_TEXT) {
      this.output(`${pad}  كتابة: ${stringify(this.eval(node.expr, env))}`);
    } else if (node.type === N.UI_BUTTON) {
      this.output(`${pad}  🔘 زر: ${stringify(this.eval(node.text, env))}`);
    } else if (node.type === N.UI_TEXTFIELD) {
      this.output(`${pad}  ✏️  حقل: ${stringify(this.eval(node.hint, env))}`);
    } else if (node.type === N.UI_IMAGE) {
      this.output(`${pad}  🖼  صورة: ${stringify(this.eval(node.name, env))}`);
    } else if (node.type === N.UI_CHECKBOX) {
      this.output(`${pad}  ☑ اختيار: ${stringify(this.eval(node.text, env))}`);
    } else if (node.type === N.UI_SWITCH) {
      this.output(`${pad}  ⚙ مفتاح: ${stringify(this.eval(node.text, env))}`);
    } else if (node.type === N.UI_PROGRESS) {
      this.output(`${pad}  📊 تقدم: ${stringify(this.eval(node.value, env))}`);
    } else if (node.type === N.UI_SPACER) {
      const s = node.size ? stringify(this.eval(node.size, env)) : 'افتراضي';
      this.output(`${pad}  ▭ مسافة: ${s}`);
    } else if (node.type === N.UI_DIVIDER) {
      this.output(`${pad}  ─ فاصل`);
    } else if (node.type === N.UI_CARD) {
      this.output(`${pad}  ┌ بطاقة: ${stringify(this.eval(node.title, env))}`);
      for (const child of node.children) {
        this.execScreenElement(child, env, depth + 2);
      }
      this.output(`${pad}  └`);
    } else if (node.type === N.UI_ROW) {
      this.output(`${pad}  ▶ صف:`);
      for (const child of node.children) {
        this.execScreenElement(child, env, depth + 2);
      }
    } else if (node.type === N.KOTLIN_RAW) {
      this.output(`${pad}  ⚡ كوتلن: ${node.code.slice(0, 40)}`);
    } else if (node.type === N.NAVIGATE) {
      this.output(`${pad}  → انتقل إلى: ${node.target}`);
    } else if (node.type === N.TOAST) {
      this.output(`${pad}  💬 تنبيه: ${this.eval(node.text, env)}`);
    } else if (node.type === N.ALERT) {
      this.output(`${pad}  ⚠ حوار: ${this.eval(node.title, env)}`);
    } else if (node.type === N.BACK) {
      this.output(`${pad}  ← رجوع`);
    } else if (node.type === N.UI_DROPDOWN) {
      const hint = this.eval(node.hint, env);
      this.output(`${pad}  🔽 قائمة منسدلة: "${hint}" [${node.items.length} عنصر]`);
      if (node.varName) env.defineLocal(node.varName, node.items[0] || '');
    } else if (node.type === N.UI_DATE) {
      const hint = this.eval(node.hint, env);
      this.output(`${pad}  📅 تاريخ: "${hint}"`);
      if (node.varName) env.defineLocal(node.varName, '');
    } else if (node.type === N.UI_TIME) {
      const hint = this.eval(node.hint, env);
      this.output(`${pad}  ⏰ وقت: "${hint}"`);
      if (node.varName) env.defineLocal(node.varName, '');
    } else if (node.type === N.UI_DRAWER) {
      const title = this.eval(node.title, env);
      this.output(`${pad}  📂 شريط جانبي: "${title}"`);
      for (const child of node.children || []) this.execScreenElement(child, env, depth + 2);
    } else if (node.type === N.UI_TABBAR) {
      this.output(`${pad}  🗂 شريط تبويب: ${node.tabs.length} تبويب`);
      for (const child of node.children || []) this.execScreenElement(child, env, depth + 2);
    } else if (node.type === N.UI_WEBVIEW) {
      const url = this.eval(node.url, env);
      this.output(`${pad}  🌐 ويب: ${url}`);
    } else if (node.type === N.UI_VIDEO) {
      const src = this.eval(node.src, env);
      this.output(`${pad}  🎬 فيديو: ${src}`);
    } else if (node.type === N.UI_AUDIO) {
      const src = this.eval(node.src, env);
      this.output(`${pad}  🎵 صوت: ${src}`);
    } else if (node.type === N.UI_MAP) {
      const lat = this.eval(node.lat, env);
      const lng = this.eval(node.lng, env);
      this.output(`${pad}  🗺 خريطة: (${lat}, ${lng})`);
    } else if (node.type === N.UI_CHART) {
      const t = this.eval(node.chartType, env);
      const vals = this.eval(node.values, env);
      const count = Array.isArray(vals) ? vals.length : 0;
      this.output(`${pad}  📊 رسم بياني (${t}): ${count} قيمة`);
    } else if (node.type === N.UI_DATE_DLG) {
      this.output(`${pad}  📅 حوار تاريخ${node.varName ? ' ← ' + node.varName : ''}`);
      if (node.varName) env.defineLocal(node.varName, '');
    } else if (node.type === N.UI_COLOR_DLG) {
      this.output(`${pad}  🎨 حوار لون${node.varName ? ' ← ' + node.varName : ''}`);
      if (node.varName) env.defineLocal(node.varName, '#000000');
    } else if (node.type === N.UI_LIST) {
      const list = env.get(node.source);
      if (Array.isArray(list)) {
        this.output(`${pad}  📋 قائمة "${node.source}" (${list.length} عنصر):`);
        if (list.length > 0) {
          const itemEnv = env.child();
          itemEnv.defineLocal('العنصر', list[0]);
          this.output(`${pad}    ${'─'.repeat(30)}`);
          for (const child of node.template) {
            this.execScreenElement(child, itemEnv, depth + 2);
          }
        }
      }
    } else if (node.type === N.SNACKBAR) {
      this.output(`${pad}  🍫 سنيكر: ${this.eval(node.text, env)}`);
    } else if (node.type === N.BOTTOM_SHEET) {
      this.output(`${pad}  📋 ورقة: ${this.eval(node.title, env)}`);
    } else if (node.type === N.TAB_LAYOUT) {
      this.output(`${pad}  📑 تبويبات: ${node.tabs.length}`);
    } else if (node.type === N.UI_TOPBAR) {
      const props = node.props || {};
      const text = props.text ? this.eval(props.text, env) : '';
      const color = props.color ? this.eval(props.color, env) : 'افتراضي';
      const size = props.size ? this.eval(props.size, env) : 60;
      this.output(`${pad}  ⬛ شريط علوي: "${text}" [لون: ${color}، حجم: ${size}]`);
    } else if (node.type === N.STATE_DECL) {
      // لو محفوظة: اقرأ من التخزين أولاً
      let value;
      if (node.persistent) {
        const stored = this._storage[node.name];
        value = (stored !== undefined) ? stored : this.eval(node.init, env);
      } else {
        value = this.eval(node.init, env);
      }
      env.defineLocal(node.name, value);
      if (node.persistent) {
        if (!this._persistentVars) this._persistentVars = new Set();
        this._persistentVars.add(node.name);
      }
      const tag = node.persistent ? '💾 محفوظ' : '📦 حالة';
      this.output(`${pad}  ${tag}: ${node.name} = ${stringify(value)}`);
    }
  }

  // ═══ استورد ═══
  execImport(node, env) {
    const fs = require('fs');
    const path = require('path');

    const filePath = node.from;
    if (!fs.existsSync(filePath)) {
      throw new NarminError(`ملف الاستيراد غير موجود: ${filePath}`);
    }

    // اقرأ الملف
    const source = fs.readFileSync(filePath, 'utf8');

    // حفظ السياق
    const prevFile = this._currentFile;
    this._currentFile = filePath;

    // حلّل
    const { parse } = require('../parser/parser');
    const ast = parse(source);

    // بيئة معزولة
    const importEnv = this.global.child();

    // حفظ عدد المتغيرات قبل
    const beforeVars = new Set(importEnv.values.keys());

    // نفّذ
    try {
      for (const stmt of ast.body) {
        this.exec(stmt, importEnv);
      }
    } catch (e) {
      this._currentFile = prevFile;
      throw e;
    }
    this._currentFile = prevFile;

    // اجمع القيم المُصدَّرة
    const exported = {};
    for (const [name, value] of importEnv.values) {
      exported[name] = value;
    }

    // أسند للاسم المستعار
    if (node.alias) {
      // غلّف الكائن ليتصرف كعضو
      const namespace = {};
      for (const [name, value] of Object.entries(exported)) {
        namespace[name] = value;
      }
      env.defineLocal(node.alias, namespace);
    } else {
      // بلا alias — أضف كل القيم مباشرة للبيئة الحالية
      for (const [name, value] of Object.entries(exported)) {
        if (!env.has(name)) {
          env.defineLocal(name, value);
        }
      }
    }
  }

  // ═══ جرب / التقط / اخيرا ═══
  execTry(node, env) {
    let caught = null;
    let caughtError = null;

    try {
      this.exec(node.tryBlock, env);
    } catch (e) {
      // ReturnSignal/BreakSignal/ContinueSignal تمر مباشرة
      if (e instanceof ReturnSignal || e instanceof BreakSignal || e instanceof ContinueSignal) {
        // لكن اخيرا يجب أن تنفذ
        if (node.finallyBlock) {
          try { this.exec(node.finallyBlock, env); } catch (_) {}
        }
        throw e;
      }
      // استثناء حقيقي — نلتقطه
      caught = true;
      if (e instanceof ThrowSignal) {
        caughtError = e.value;
      } else {
        caughtError = e.message || String(e);
      }
    }

    // نفّذ التقط
    if (caught && node.catchBlock) {
      const catchEnv = env.child();
      if (node.catchParam) {
        catchEnv.defineLocal(node.catchParam, caughtError);
      }
      try {
        this.exec(node.catchBlock, catchEnv);
      } catch (e2) {
        // أخطاء داخل التقط — نفّذ اخيرا ثم ارم
        if (node.finallyBlock) {
          try { this.exec(node.finallyBlock, env); } catch (_) {}
        }
        throw e2;
      }
    }

    // نفّذ اخيرا دائماً
    if (node.finallyBlock) {
      this.exec(node.finallyBlock, env);
    }
  }

  // ═══ ارم (throw) ═══
  execThrow(node, env) {
    const value = node.arg ? this.eval(node.arg, env) : null;
    throw new ThrowSignal(value);
  }

  execBlock(node, env) {
    const local = env.child();
    for (const stmt of node.body) this.exec(stmt, local);
  }

  execPrint(node, env) {
    const value = this.eval(node.arg, env);
    this.output(stringify(value));
  }

  execAssign(node, env) {
    const value = this.eval(node.value, env);
    const target = node.target;

    if (target.type === N.IDENTIFIER) {
      env.set(target.name, value);
      // لو الحالة محفوظة — خزّن تلقائياً
      if (this._persistentVars && this._persistentVars.has(target.name)) {
        this._storage[target.name] = value;
        this._saveStorage();
      }
      return value;
    }

    if (target.type === N.MEMBER) {
      const obj = this.eval(target.object, env);
      if (obj === null || obj === undefined) {
        throw new NarminError(`لا يمكن الإسناد لخاصية على عدم`);
      }
      obj[target.property] = value;
      return value;
    }

    if (target.type === N.INDEX) {
      const obj = this.eval(target.object, env);
      const idx = this.eval(target.index, env);
      obj[idx] = value;
      return value;
    }

    throw new NarminError('هدف إسناد غير صالح');
  }

  execLet(node, env, isConst) {
    const value = node.init ? this.eval(node.init, env) : null;
    env.define(node.name, value, isConst);
  }

  execIf(node, env) {
    const test = this.eval(node.test, env);
    if (isTruthy(test)) {
      this.exec(node.consequent, env);
    } else if (node.alternate) {
      this.exec(node.alternate, env);
    }
  }

  execWhile(node, env) {
    while (isTruthy(this.eval(node.test, env))) {
      try {
        this.exec(node.body, env);
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
  }

  execFor(node, env) {
    const iterable = this.eval(node.iterable, env);
    let items;
    if (Array.isArray(iterable)) items = iterable;
    else if (typeof iterable === 'string') items = [...iterable];
    else throw new NarminError(`for يتوقع مصفوفة أو نصاً، استلم ${typeName(iterable)}`);

    for (const item of items) {
      const loopEnv = env.child();
      loopEnv.defineLocal(node.variable, item);
      try {
        this.exec(node.body, loopEnv);
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
      }
    }
  }

  execFunction(node, env) {
    const fn = makeFunction(node.name, node.params, node.body, env);
    env.define(node.name, fn);
  }

  execReturn(node, env) {
    const value = node.arg ? this.eval(node.arg, env) : null;
    throw new ReturnSignal(value);
  }

  // ═══════ التعابير ═══════
  eval(node, env) {
    switch (node.type) {
      case N.NUMBER: return node.value;
      case N.STRING: return node.value;
      case N.BOOLEAN: return node.value;
      case N.NULL: return null;
      case N.IDENTIFIER: return env.get(node.name);
      case N.BINARY: return this.evalBinary(node, env);
      case N.UNARY: return this.evalUnary(node, env);
      case N.CALL: return this.evalCall(node, env);
      case N.MEMBER: return this.evalMember(node, env);
      case N.INDEX: return this.evalIndex(node, env);
      case N.PIPE: return this.evalPipe(node, env);
      case N.ARRAY: return node.elements.map((e) => this.eval(e, env));
      case N.OBJECT: return this.evalObject(node, env);
      case N.IF_EXPR: return this.evalIfExpr(node, env);
      default:
        throw new NarminError(`تعبير غير معروف: ${node.type}`);
    }
  }

  evalBinary(node, env) {
    const l = this.eval(node.left, env);

    // short-circuit
    if (node.op === '&&') return isTruthy(l) ? this.eval(node.right, env) : l;
    if (node.op === '||') return isTruthy(l) ? l : this.eval(node.right, env);

    const r = this.eval(node.right, env);

    switch (node.op) {
      case '+': return l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/':
        if (r === 0) throw new NarminError('القسمة على صفر');
        return l / r;
      case '%': return l % r;
      case '==': return equals(l, r);
      case '!=': return !equals(l, r);
      case '<': return l < r;
      case '>': return l > r;
      case '<=': return l <= r;
      case '>=': return l >= r;
      default:
        throw new NarminError(`عامل غير معروف: ${node.op}`);
    }
  }

  evalUnary(node, env) {
    const v = this.eval(node.arg, env);
    if (node.op === '-') return -v;
    if (node.op === '!') return !isTruthy(v);
    throw new NarminError(`عامل أحادي غير معروف: ${node.op}`);
  }

  evalCall(node, env) {
    // جلب(url) — تنفيذ HTTP GET متزامن
    if (node.callee.type === N.IDENTIFIER && node.callee.name === 'جلب') {
      const url = this.eval(node.args[0], env);
      return this.httpGetSync(String(url));
    }

    const callee = this.eval(node.callee, env);
    const args = node.args.map((a) => this.eval(a, env));

    // دالة أصلية
    if (callee && callee.__narmin_native__) {
      return callee.fn(args);
    }

    // دالة نارمين
    if (callee && callee.__narmin_fn__) {
      if (args.length !== callee.params.length) {
        throw new NarminError(
          `الدالة '${callee.name}' تتوقع ${callee.params.length} معامل، استلمت ${args.length}`
        );
      }
      const fnEnv = callee.closure.child();
      callee.params.forEach((p, i) => fnEnv.defineLocal(p, args[i]));
      try {
        this.exec(callee.body, fnEnv);
        return null;
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value;
        throw e;
      }
    }

    throw new NarminError(`'${stringify(callee)}' ليست دالة قابلة للاستدعاء`);
  }

  evalMember(node, env) {
    const obj = this.eval(node.object, env);
    if (obj === null || obj === undefined) {
      throw new NarminError(`لا يمكن الوصول لخاصية '${node.property}' من عدم`);
    }

    // دعم الخصائص الخاصة للمصفوفات والنصوص
    if (Array.isArray(obj) && node.property === 'طول') return obj.length;
    if (typeof obj === 'string' && node.property === 'طول') return obj.length;

    // دوال المصفوفات الأصلية (تُرجع native functions مربوطة)
    if (Array.isArray(obj)) {
      const { makeNative } = require('./values');
      const methods = {
        أضف: (args) => { obj.push(args[0]); return obj; },
        حذف: (args) => { obj.splice(args[0], 1); return obj; },
        خريطة: (args) => obj.map((v) => this.callFn(args[0], [v])),
        صفي: (args) => obj.filter((v) => isTruthy(this.callFn(args[0], [v]))),
        جد: (args) => obj.find((v) => isTruthy(this.callFn(args[0], [v]))) ?? null,
        رتب: (args) => [...obj].sort((a, b) => {
          if (args[0]) return this.callFn(args[0], [a, b]);
          return a < b ? -1 : a > b ? 1 : 0;
        }),
        اعكس: () => [...obj].reverse(),
        ضم: (args) => obj.join(args[0] ?? ''), 
        جزئي: (args) => obj.slice(args[0], args[1]),
      };
      if (methods[node.property]) {
        return makeNative(node.property, methods[node.property]);
      }
    }

    if (typeof obj === 'string') {
      const { makeNative } = require('./values');
      const methods = {
        جزئي: (args) => obj.slice(args[0], args[1]),
        كبير: () => obj.toUpperCase(),
        صغير: () => obj.toLowerCase(),
        قص: () => obj.trim(),
        يحتوي: (args) => obj.includes(args[0]),
        قسم: (args) => obj.split(args[0]),
      };
      if (methods[node.property]) {
        return makeNative(node.property, methods[node.property]);
      }
    }

    if (typeof obj === 'object' && node.property in obj) {
      return obj[node.property];
    }

    throw new NarminError(`لا توجد خاصية '${node.property}' على ${typeName(obj)}`);
  }

  evalIndex(node, env) {
    const obj = this.eval(node.object, env);
    const idx = this.eval(node.index, env);
    if (Array.isArray(obj) || typeof obj === 'string') return obj[idx];
    if (typeof obj === 'object' && obj !== null) return obj[idx];
    throw new NarminError(`لا يمكن الفهرسة على ${typeName(obj)}`);
  }

  evalPipe(node, env) {
    const left = this.eval(node.left, env);
    // اليمين عادةً اسم دالة أو استدعاء دالة
    if (node.right.type === N.IDENTIFIER) {
      const fn = env.get(node.right.name);
      return this.callFn(fn, [left]);
    }
    if (node.right.type === N.CALL) {
      const fn = this.eval(node.right.callee, env);
      const extraArgs = node.right.args.map((a) => this.eval(a, env));
      return this.callFn(fn, [left, ...extraArgs]);
    }
    throw new NarminError('الجانب الأيمن من |> يجب أن يكون دالة');
  }

  // if كتعبير — يُرجع قيمة آخر تعبير في الكتلة المُختارة
  evalIfExpr(node, env) {
    const test = this.eval(node.test, env);
    const chosen = isTruthy(test) ? node.consequent : node.alternate;
    if (!chosen) return null;
    return this.evalBlockAsValue(chosen, env);
  }

  // تنفذ كتلة وترجع قيمة: آخر تعبير أو قيمة إرجاع
  evalBlockAsValue(block, env) {
    const local = env.child();
    let lastValue = null;
    for (let i = 0; i < block.body.length; i++) {
      const stmt = block.body[i];
      const isLast = i === block.body.length - 1;

      if (isLast) {
        // آخر جملة: نحاول استخراج قيمة منها
        lastValue = this.stmtAsValue(stmt, local);
      } else {
        this.exec(stmt, local);
      }
    }
    return lastValue;
  }

  // يحوّل جملة إلى قيمة إن أمكن
  stmtAsValue(stmt, env) {
    // تعبير صريح → قيّمه
    if (stmt.type === N.EXPR_STMT) {
      return this.eval(stmt.expr, env);
    }

    // if-statement كقيمة → نختار الفرع ونستخرج قيمته
    if (stmt.type === N.IF) {
      const test = this.eval(stmt.test, env);
      const chosen = isTruthy(test) ? stmt.consequent : stmt.alternate;
      if (!chosen) return null;
      // الفرع كتلة → استخرج قيمة
      if (chosen.type === N.BLOCK) {
        return this.evalBlockAsValue(chosen, env);
      }
      // والا اذا (IF متداخل)
      if (chosen.type === N.IF) {
        return this.stmtAsValue(chosen, env);
      }
      return null;
    }

    // أي جملة أخرى → نفّذها كـ statement ولا قيمة
    this.exec(stmt, env);
    return null;
  }

  httpGetSync(url) {
    try {
      const { execFileSync } = require('child_process');
      const out = execFileSync('curl', ['-s', '-L', '--max-time', '30', url], {
        encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
      });
      return { نجح: true, جسم: out, كود: 200, خطأ: '' };
    } catch (e) {
      return { نجح: false, جسم: '', كود: e.status || 0, خطأ: e.message || 'فشل الطلب' };
    }
  }

  evalObject(node, env) {
    const obj = {};
    for (const p of node.properties) {
      obj[p.key] = this.eval(p.value, env);
    }
    return obj;
  }

  // مساعد لاستدعاء أي دالة
  callFn(fn, args) {
    if (fn && fn.__narmin_native__) return fn.fn(args);
    if (fn && fn.__narmin_fn__) {
      const fnEnv = fn.closure.child();
      fn.params.forEach((p, i) => fnEnv.defineLocal(p, args[i]));
      try {
        this.exec(fn.body, fnEnv);
        return null;
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value;
        throw e;
      }
    }
    throw new NarminError(`'${stringify(fn)}' ليست دالة`);
  }
}

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parse } = require('../parser/parser');

function run(source, options = {}) {
  const ast = parse(source);
  const interp = new Interpreter(options);
  const output = [];
  if (!options.output) {
    interp.output = (text) => output.push(text);
  }
  interp.run(ast);
  return { interpreter: interp, output };
}

module.exports = { Interpreter, run };
