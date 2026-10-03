const { resolvePalette, resolveButtonColor, resolveColorSmart, listPalettes, listButtonColors } = require('./palettes');
'use strict';

class NaturalSession {
  constructor() {
    this.appName = 'تطبيقي';
    this.stateVars = new Map();
    this.elements = [];
    this.rawCode = null;
    this.lastHint = '';
    this.theme = null;
    this.buttonColor = null;
    this.textColor = null;
  }

  // ═══ 1) تطبيع الحروف ═══
  normalize(text) {
    return text
      .replace(/انشي/g, 'انشئ')
      .replace(/انشاء/g, 'انشئ')
      .replace(/انشا/g, 'انشئ')
      .replace(/اضف/g, 'أضف')
      .replace(/اضافه/g, 'أضف')
      .replace(/إضف/g, 'أضف')
      .replace(/زرر/g, 'زر')
      .replace(/حقلل/g, 'حقل')
      .replace(/شغل\s+التطبيق/g, 'شغّل');
  }

  // ═══ 2) استخراج الوسيط (يقبل 3 أشكال) ═══
  // الإرجاع: { value, hint }
  extractArg(text, knownKeyword = null) {
    let hint = '';

    // أولاً: هل هناك اقتباسات حول كلمة أمر؟ "أضف حقل" → نظّفها
    const beforeClean = text;
    text = text.replace(
      /[""«»']((?:أضف|انشئ|شغّل|شغل|ابن[يِ]?|اعرض|اريد|أريد|تراجع|خروج|قائمة|حقل|زر|كتابة|عنوان|اختيار|مفتاح|مسافة|فاصل)[^""«»']*)[""«»']/g,
      '$1'
    );
    if (text !== beforeClean) {
      hint = 'تلميح: الاقتباس يكون حول النص، لا حول الأمر';
    }

    // المحاولة 1: بين علامتي اقتباس
    let m = text.match(/[""«»]([^""«»]+)[""«»]/);
    if (m) return { value: m[1].trim(), hint };

    // المحاولة 2: بدون اقتباس — كل ما بعد الكلمة المفتاحية
    if (knownKeyword) {
      const re = new RegExp('^\\s*' + knownKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(.+)$');
      m = text.match(re);
      if (m) {
        let v = m[1].trim();
        // نظّف "كـ X" من النهاية
        v = v.replace(/\s+(?:كـ|ك|as)\s+\S+\s*$/, '').trim();
        // نظّف أقواس متبقية
        v = v.replace(/^["'«»]+|["'«»]+$/g, '').trim();
        if (v) return { value: v, hint };
      }
    }

    // المحاولة 3: أي شيء
    m = text.match(/^\S+\s+(.+)$/);
    if (m) return { value: m[1].trim().replace(/^["'«»]+|["'«»]+$/g, ''), hint };

    return { value: '', hint };
  }

  // ═══ 3) تقسيم سطر بأوامر متعددة ═══
  splitCommands(text) {
    const keywords = ['انشئ', 'انشي', 'انش', 'أضف', 'اضف',
      'اريد', 'أريد', 'اعرض', 'شغّل', 'شغل',
      'ابن', 'ابنِ', 'تراجع', 'خروج',
      'ارني', 'أرني',
      'واجهة', 'واجهه', 'خلفية', 'نمط',
      'ازرار', 'أزرار', 'الازرار', 'الأزرار',
      'لون', 'ألوان', 'الوان',
      'نص', 'النص'];
    const marker = '\u0001\u0001';
    let work = text;
    for (const kw of keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // لا يسبق الكلمة حرف عربي، ويليها فراغ أو نهاية
      const re = new RegExp('(?<![\\u0600-\\u06FF])(?=' + escaped + '(?:\\s|$))', 'g');
      work = work.replace(re, marker);
    }
    const parts = work.split(marker).map(function(x) { return x.trim(); }).filter(Boolean);
    return parts.length > 1 ? parts : [text];
  }

  // ═══ 4) تحليل أمر واحد ═══
  parseOne(raw) {
    let t = this.normalize(raw.trim());
    // نظّف رموز prompt
    t = t.replace(/^[»>›››»»»]+\s*/, '').trim();
    if (!t || t.startsWith('#')) return null;

    // ═══ إنشاء تطبيق ═══
    let m = t.match(/^(?:انشئ|انشي|انش|ابني|ابن[يِ]|اعمل|اصنع)\s+(?:تطبيق|تطبيقاً|برنامج|لي)\s*(.*)$/);
    if (m) {
      let rest = m[1];
      // اقتطع عند أول ذكر للون/واجهة
      const cutMatch = rest.match(/^(.*?)\s+(?=واجهة|واجهه|النمط|نمط|لون\s+(?:الازرار|الأزرار|الزر|التطبيق))/);
      if (cutMatch) {
        rest = cutMatch[1];
      }
      const { value, hint } = this.extractArg('X ' + rest);
      const name = value || 'تطبيقي';
      this.appName = name;
      this.elements = [];
      this.stateVars.clear();
      this.rawCode = null;
      this.theme = null;
      this.buttonColor = null;
      let out = `✓ أنشأت تطبيق "${name}"`;
      if (hint) out += `\n  ${hint}`;
      return out;
    }

    // ═══ القوالب ═══
    const tpl = t.match(/(?:اريد|أريد|انشئ|أنشئ|قالب)\s+(?:تطبيق\s+)?(مهام|مهمات|تسوق|حاسبة|آلة\s+حاسبة|مذكرة|مذكرات|ملاحظات|طقس|الطقس)$/);
    if (tpl) {
      this.applyTemplate(tpl[1]);
      return `✓ أنشأت قالب: ${tpl[1]}`;
    }

    // ═══ عناوين ═══
    m = t.match(/^(?:أضف|اضف|ضع|حط)\s+(?:عنوان|رأس|title)\s*(.*)$/);
    if (m) {
      const { value, hint } = this.extractArg('أضف عنوان ' + m[1], 'أضف عنوان');
      if (!value) return `⚠ عنوان بدون نص`;
      this.elements.push({ type: 'heading', text: value });
      return `✓ عنوان: "${value}"${hint ? '\n  ' + hint : ''}`;
    }

    // ═══ كتابة ═══
    m = t.match(/^(?:أضف|اضف|ضع)\s+(?:كتابة|نص|text)\s*(.*)$/);
    if (m) {
      const { value, hint } = this.extractArg('أضف كتابة ' + m[1], 'أضف كتابة');
      if (!value) return `⚠ كتابة بدون نص`;
      this.elements.push({ type: 'text', text: value });
      return `✓ كتابة: "${value}"${hint ? '\n  ' + hint : ''}`;
    }

    // ═══ حقل ═══
    m = t.match(/^(?:أضف|اضف|ضع)\s+(?:حقل|إدخال|مدخل|input|field)\s*(.*)$/);
    if (m) {
      let rest = m[1];
      let bind = null;
      // استخرج "كـ X" من النهاية
      const bindM = rest.match(/\s+(?:كـ|ك|as)\s+(\S+)\s*$/);
      if (bindM) {
        bind = bindM[1].trim();
        rest = rest.replace(/\s+(?:كـ|ك|as)\s+\S+\s*$/, '');
      }
      const { value, hint } = this.extractArg('أضف حقل ' + rest, 'أضف حقل');
      const hintText = value || 'أدخل نصاً';
      if (bind && !this.stateVars.has(bind)) {
        this.stateVars.set(bind, { type: 'String', init: '""' });
      }
      this.elements.push({ type: 'textfield', hint: hintText, binding: bind });
      return `✓ حقل: "${hintText}"${bind ? ' ← ' + bind : ''}${hint ? '\n  ' + hint : ''}`;
    }

    // ═══ زر ═══
    m = t.match(/^(?:أضف|اضف|ضع)\s+(?:زر|button)\s*(.*)$/);
    if (m) {
      const { value, hint } = this.extractArg('أضف زر ' + m[1], 'أضف زر');
      if (!value) return `⚠ زر بدون نص`;
      this.elements.push({ type: 'button', text: value });
      return `✓ زر: "${value}"${hint ? '\n  ' + hint : ''}`;
    }

    // ═══ قائمة ═══
    m = t.match(/^(?:أضف|اضف|ضع)\s+(?:قائمة|list)\s*(.*)$/);
    if (m) {
      const { value, hint } = this.extractArg('أضف قائمة ' + m[1], 'أضف قائمة');
      if (!value) return `⚠ قائمة بدون اسم`;
      if (!this.stateVars.has(value)) {
        this.stateVars.set(value, { type: 'MutableList', init: 'mutableListOf()' });
      }
      this.elements.push({ type: 'list', source: value });
      return `✓ قائمة: "${value}"${hint ? '\n  ' + hint : ''}`;
    }

    // ═══ اختيار ═══
    m = t.match(/^(?:أضف|اضف|ضع)\s+(?:اختيار|خيار|checkbox)\s*(.*)$/);
    if (m) {
      const { value, hint } = this.extractArg('أضف اختيار ' + m[1], 'أضف اختيار');
      if (!value) return `⚠ اختيار بدون نص`;
      this.elements.push({ type: 'checkbox', text: value });
      return `✓ اختيار: "${value}"${hint ? '\n  ' + hint : ''}`;
    }

    // ═══ مفتاح ═══
    m = t.match(/^(?:أضف|اضف|ضع)\s+(?:مفتاح|switch)\s*(.*)$/);
    if (m) {
      const { value, hint } = this.extractArg('أضف مفتاح ' + m[1], 'أضف مفتاح');
      if (!value) return `⚠ مفتاح بدون نص`;
      this.elements.push({ type: 'switch', text: value });
      return `✓ مفتاح: "${value}"${hint ? '\n  ' + hint : ''}`;
    }

    // ═══ مسافة ═══
    m = t.match(/^(?:أضف|اضف|ضع)\s+(?:مسافة|فراغ)\s+(\d+)/);
    if (m) {
      this.elements.push({ type: 'spacer', size: m[1] });
      return `✓ مسافة: ${m[1]}`;
    }

    // ═══ فاصل ═══
    if (/^(?:أضف|اضف|ضع)\s+(?:فاصل|خط)/.test(t)) {
      this.elements.push({ type: 'divider' });
      return `✓ فاصل`;
    }

    // ═══ الألوان ═══
    let handled = [];
    let matched = false;

    // استخراج كل الأزواج من النص: (كلمة مفتاحية + قيمة)
    // الصيغة: واجهه "X" أو واجهه X أو "واجهه" X
    // أو: ازرار "X" | نص "X"

    // 1) الخلفية / الواجهة
    let m2 = t.match(/(?:واجهة|واجهه|خلفية|نمط|theme|style)\s+(?:التطبيق\s+)?["'«»]([^"'«»]+)["'«»]/);
    if (!m2) m2 = t.match(/(?:واجهة|واجهه|خلفية|نمط|theme|style)\s+(?:التطبيق\s+)?([^\s"'«»]+)/);
    if (m2) {
      const palName = m2[1].trim();
      const pal = resolvePalette(palName);
      if (pal) {
        this.theme = palName;
        handled.push(`✓ الخلفية: "${palName}" → ${pal.background}`);
        matched = true;
      } else {
        handled.push(`⚠ لون غير معروف: "${palName}"`);
        matched = true;
      }
    }

    // 2) الأزرار
    let b2 = t.match(/(?:ازرار|أزرار|الازرار|الأزرار|زر|لون\s+(?:الازرار|الأزرار|الزر))\s+["'«»]([^"'«»]+)["'«»]/);
    if (!b2) b2 = t.match(/(?:ازرار|أزرار|الازرار|الأزرار|زر|لون\s+(?:الازرار|الأزرار|الزر))\s+([^\s"'«»]+)/);
    if (b2) {
      const btnName = b2[1].trim();
      const col = resolveButtonColor(btnName);
      if (col === 'MIXED') {
        this.buttonColor = 'مختلط';
        handled.push(`✓ الأزرار: مختلط`);
        matched = true;
      } else if (col) {
        this.buttonColor = btnName;
        handled.push(`✓ الأزرار: "${btnName}" → ${col}`);
        matched = true;
      } else {
        handled.push(`⚠ لون أزرار غير معروف: "${btnName}"`);
        matched = true;
      }
    }

    // 3) النص
    let n2 = t.match(/(?:نص|النص|لون\s+النص|لون\s+الكتابة|text)\s+["'«»]([^"'«»]+)["'«»]/);
    if (!n2) n2 = t.match(/(?:نص|النص|لون\s+النص|لون\s+الكتابة|text)\s+([^\s"'«»]+)/);
    if (n2) {
      const txtName = n2[1].trim();
      const col = resolveColorSmart(txtName);
      if (col) {
        this.textColor = txtName;
        handled.push(`✓ النص: "${txtName}" → ${col}`);
        matched = true;
      } else {
        handled.push(`⚠ لون نص غير معروف: "${txtName}"`);
        matched = true;
      }
    }

    if (matched) return handled.join('\n');

    // ═══ اعرض ═══
    if (/^(?:اعرض|عرض|حالة|الكود|ارني|أرني|what)$/.test(t)) {
      return this.renderState();
    }

    // ═══ شغّل ═══
    if (/^(?:شغّل|شغل|شغله|شغلي|شغل\s+التطبيق|ثبت|ثبّت|جربه|جرب|ابن[يِ]\s+وشغّل|ابن[يِ]\s+وثبت)$/.test(t)) {
      return { action: 'build_and_run' };
    }

    // ═══ ابنِ ═══
    if (/^(?:ابن[يِ]|بناء|ابن[يِ]\s+فقط|ترجم)$/.test(t)) {
      return { action: 'build' };
    }

    // ═══ تراجع ═══
    if (/^(?:تراجع|الغاء|الغي|امسح\s+الاخير|احذف\s+الاخير)$/.test(t)) {
      const r = this.elements.pop();
      return r ? `✓ حذفت: ${r.type}` : `⚠ لا يوجد شيء للحذف`;
    }

    // ═══ امسح الكل ═══
    if (/^(?:امسح\s+الكل|ابدأ\s+من\s+جديد|فارغ|جديد|مسح)$/.test(t)) {
      this.elements = [];
      this.stateVars.clear();
      this.rawCode = null;
      return `✓ مسح كامل`;
    }

    // ═══ خروج ═══
    if (/^(?:خروج|اخرج|باي|وداعا|quit|exit|q)$/.test(t)) {
      return { action: 'quit' };
    }

    // ═══ مساعدة ═══
    if (/^(?:مساعدة|ساعدني|help|\?)$/.test(t)) {
      return this.renderHelp();
    }

    return `⚠ لم أفهم: "${t}"\n   اكتب "مساعدة" للأوامر المتاحة`;
  }

  // ═══ 5) parse يدعم أوامر متعددة ═══
  parse(text) {
    const parts = this.splitCommands(text);
    const results = [];
    let buildAction = null;
    let quit = false;

    for (const part of parts) {
      const r = this.parseOne(part);
      if (r === null) continue;
      if (typeof r === 'string') {
        results.push(r);
      } else if (r.action === 'quit') {
        quit = true;
      } else if (r.action === 'build' || r.action === 'build_and_run') {
        buildAction = r.action;
      }
    }

    if (quit) return { action: 'quit' };
    if (buildAction) return { action: buildAction };
    if (results.length === 0) return null;
    return results.join('\n');
  }

  // ═══ القوالب ═══
  applyTemplate(kind) {
    if (kind === 'مهام' || kind === 'مهمات') {
      this.appName = 'مهامي';
      this.rawCode = `شاشة "مهامي" {
  عنوان "قائمة المهام"
  محفوظ مهام = []
  حقل "مهمة جديدة" كـ جديدة
  زر "أضف" عند_الضغط {
    اذا جديدة != "" {
      أضف(مهام، جديدة)
    }
  }
  مسافة 16
  قائمة مهام {
    تمّ
    كتابة العنصر
    زر "احذف" عند_الضغط {
      احذف_من(مهام، العنصر)
    }
  }
}`;
    } else if (kind === 'تسوق') {
      this.appName = 'تسوقي';
      this.rawCode = `شاشة "تسوقي" {
  عنوان "قائمة التسوق"
  محفوظ عناصر = []
  حقل "منتج" كـ منتج
  حقل "السعر" كـ سعر
  زر "أضف" عند_الضغط {
    اذا منتج != "" {
      أضف(عناصر، منتج + " - " + نسّق(سعر))
    }
  }
  مسافة 16
  قائمة عناصر {
    كتابة العنصر
    زر "احذف" عند_الضغط {
      احذف_من(عناصر، العنصر)
    }
  }
}`;
    } else if (kind === 'حاسبة' || kind === 'آلة حاسبة') {
      this.appName = 'حاسبة';
      this.rawCode = `شاشة "حاسبة" {
  عنوان "احسب"
  حالة نتيجة = 0
  حقل "الرقم الأول" كـ أ
  حقل "الرقم الثاني" كـ ب
  مسافة 8
  كتابة "النتيجة: " + نسّق(نتيجة)
  مسافة 16
  زر "اجمع" عند_الضغط {
    نتيجة = أ + ب
  }
}`;
    } else if (kind === 'مذكرة' || kind === 'مذكرات' || kind === 'ملاحظات') {
      this.appName = 'مذكرتي';
      this.rawCode = `شاشة "مذكرتي" {
  عنوان "مذكراتي"
  محفوظ مذكرة = ""
  حقل "اكتب هنا" كـ مذكرة
  مسافة 16
  زر "حفظ" عند_الضغط {
    تنبيه "تم الحفظ"
  }
  مسافة 8
  كتابة "المذكرة:"
  كتابة مذكرة
}`;
    } else if (kind === 'طقس' || kind === 'الطقس') {
      this.appName = 'طقسي';
      this.rawCode = `شاشة "طقسي" {
  عنوان "الطقس"
  كتابة "اضغط الزر"
  مسافة 16
  زر "اجلب الطقس" عند_الضغط {
    متغير رد = جلب("https://api.github.com/zen")
    اذا رد["نجح"] {
      حوار "الرد" رد["جسم"]
    } والا {
      حوار "خطأ" رد["خطأ"]
    }
  }
}`;
    }
  }

  // ═══ توليد الكود ═══
  generateNarmCode() {
    const header = [];
    if (this.theme) header.push(`#@النمط: ${this.theme}`);
    if (this.buttonColor) header.push(`#@الزر: ${this.buttonColor}`);
    if (this.textColor) header.push(`#@النص: ${this.textColor}`);
    const headerStr = header.length ? header.join('\n') + '\n\n' : '';

    if (this.rawCode) return headerStr + this.rawCode;

    const lines = [];
    if (headerStr) lines.push(headerStr.trim());
    lines.push(`شاشة "${this.appName}" {`);
    lines.push(`  عنوان "${this.appName}"`);

    for (const [name, info] of this.stateVars) {
      let init = '""';
      if (info.type === 'Double') init = '0';
      else if (info.type === 'Boolean') init = 'خطأ';
      else if (info.type === 'MutableList') init = '[]';
      lines.push(`  محفوظ ${name} = ${init}`);
    }

    if (this.stateVars.size > 0) lines.push(`  مسافة 8`);

    for (const el of this.elements) {
      if (el.type === 'heading') lines.push(`  عنوان "${el.text}"`);
      else if (el.type === 'text') lines.push(`  كتابة "${el.text}"`);
      else if (el.type === 'textfield') {
        lines.push(`  حقل "${el.hint}"${el.binding ? ' كـ ' + el.binding : ''}`);
      }
      else if (el.type === 'button') {
        lines.push(`  زر "${el.text}" عند_الضغط {`);
        lines.push(`    تنبيه "ضغطت: ${el.text}"`);
        lines.push(`  }`);
      }
      else if (el.type === 'list') {
        lines.push(`  قائمة ${el.source} {`);
        lines.push(`    كتابة العنصر`);
        lines.push(`  }`);
      }
      else if (el.type === 'checkbox') lines.push(`  اختيار "${el.text}"`);
      else if (el.type === 'switch') lines.push(`  مفتاح "${el.text}"`);
      else if (el.type === 'spacer') lines.push(`  مسافة ${el.size}`);
      else if (el.type === 'divider') lines.push(`  فاصل`);
    }

    lines.push(`}`);
    return lines.join('\n');
  }

  renderState() {
    const out = [];
    out.push(`📱 التطبيق: "${this.appName}"`);
    out.push(`📦 المتغيرات: ${this.stateVars.size}`);
    out.push(`🎨 العناصر: ${this.elements.length}`);
    out.push('');
    out.push('─── الكود ───');
    out.push(this.generateNarmCode());
    return out.join('\n');
  }

  renderHelp() {
    return [
      '',
      '╔════════════════════════════════════════════╗',
      '║       نارمين — الأوامر المتاحة              ║',
      '╚════════════════════════════════════════════╝',
      '',
      '▶ إنشاء تطبيق:',
      '    انشئ تطبيق "اسم التطبيق"',
      '    اريد تطبيق مهام / تسوق / حاسبة / مذكرة / طقس',
      '',
      '▶ إضافة عناصر (الأسلوب الصحيح):',
      '    أضف عنوان "..."',
      '    أضف كتابة "..."',
      '    أضف حقل "..."',
      '    أضف حقل "..." كـ متغير',
      '    أضف زر "..."',
      '    أضف قائمة اسم_القائمة',
      '    أضف اختيار "..."',
      '    أضف مفتاح "..."',
      '    أضف مسافة 16',
      '    أضف فاصل',
      '',
      '▶ التحكم:',
      '    اعرض      ← عرض الكود المُولَّد',
      '    تراجع     ← حذف آخر عنصر',
      '    شغّل      ← بناء + تثبيت + تشغيل',
      '    ابنِ      ← بناء فقط',
      '    امسح الكل ← ابدأ من جديد',
      '    خروج      ← إنهاء الجلسة',
      '',
      '💡 أساليب مقبولة:',
      '   أضف حقل "نص"         ✓ الأسلوب الصحيح',
      '   أضف حقل نص           ✓ بلا اقتباس',
      '   "أضف حقل" نص         ✓ يُصحَّح تلقائياً',
      '',
    ].join('\n');
  }
}

module.exports = { NaturalSession };
