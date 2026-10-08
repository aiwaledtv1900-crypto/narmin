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
    this.lastFailed = null;    // آخر أمر فاشل
    this.lastSuggestion = null; // آخر اقتراح
    this.icon = null;
    this.permissions = [];
    this.libraries = [];
    this.topBar = null;
    this.variables = [];
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
    // الكلمات المركبة أولاً — لا تقسّمها
    const compound = [
      'اعرض الأجهزة', 'اعرض الاجهزة', 'اعرض البيئة',
      'أعرض الأجهزة', 'أعرض الاجهزة', 'أعرض البيئة'
    ];
    
    for (const phrase of compound) {
      if (text.includes(phrase)) {
        return [text]; // لا تقسّم
      }
    }
    
    const keywords = [
      'انشئ', 'انشي', 'انش', 'أضف', 'اضف',
      'اريد', 'أريد', 'اعرض', 'شغّل', 'شغل',
      'ابن', 'ابنِ', 'تراجع', 'خروج',
      'ارني', 'أرني',
      'واجهة', 'واجهه', 'خلفية', 'نمط',
      'ازرار', 'أزرار', 'الازرار', 'الأزرار',
      'لون', 'ألوان', 'الوان',
      'قائمة منسدلة', 'قائمة_منسدلة',
      'تاريخ', 'وقت',
      'شريط جانبي', 'شريط_جانب',
      'شريط تبويب', 'شريط_تبويب',
      'ويب', 'فيديو', 'صوت',
      'خريطة', 'رسم بياني', 'رسم_بياني',
      'حوار تاريخ', 'حوار_تاريخ',
      'حوار لون', 'حوار_لون'
    ];
    const marker = '\u0001\u0001';
    let work = text;
    for (const kw of keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    
    // ═══ أوامر اعرض المبكرة ═══
    if (/^(?:اعرض|أعرض)\s+(?:الأجهزة|الاجهزة|أجهزة|اجهزة)\s*$/.test(t)) {
      return { action: 'devices' };
    }
    if (/^(?:اعرض|أعرض)\s+(?:البيئة|بيئة)\s*$/.test(t)) {
      return { action: 'environment' };
    }

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
      let rest = m[1].trim();
      let bind = null;
      // استخرج "كـ X" من النهاية
      const bindM = rest.match(/\s+(?:كـ|ك|as)\s+(\S+)\s*$/);
      if (bindM) {
        bind = bindM[1].trim();
        rest = rest.replace(/\s+(?:كـ|ك|as)\s+\S+\s*$/, '');
      }
      // أزل الاقتباسات
      rest = rest.replace(/^["'«»]+|["'«»]+$/g, '').trim();
      // ارفض إن كان فارغاً (بدون تلميح)
      if (!rest) {
        this.lastFailed = t;
        const sug = 'أضف حقل "اكتب هنا"';
        this.lastSuggestion = sug;
        return `⚠ حقل بدون تلميح\n\n💡 مثال: ${sug}\n   اكتب: تعديل ${sug}`;
      }
      const hintText = rest;
      if (bind && !this.stateVars.has(bind)) {
        this.stateVars.set(bind, { type: 'String', init: '""' });
      }
      this.elements.push({ type: 'textfield', hint: hintText, binding: bind });
      return `✓ حقل: "${hintText}"${bind ? ' ← ' + bind : ''}`;
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


    // ═══════════════════════════════════════════════════════
    // ═══ حزمة UI+ (v2.2) — أوامر الوضع الطبيعي ═══
    // ═══════════════════════════════════════════════════════

    // ═══ قائمة منسدلة ═══
    m = t.match(/^(?:أضف|اضف|ضع)?\s*(?:قائمة_منسدلة|قائمة منسدلة|dropdown)\s*["'«»]([^"'«»]+)["'«»](?:\s+كـ\s+(\S+))?(?:\s+من\s+\[([^\]]+)\])?/);
    if (m) {
      const hint = m[1];
      const varName = m[2] || null;
      const itemsRaw = m[3] || '';
      const items = itemsRaw.split(/[,،]/).map(s => s.trim()).filter(Boolean);
      if (varName && !this.stateVars.has(varName)) {
        this.stateVars.set(varName, { type: 'String', init: '"' + (items[0] || '') + '"' });
      }
      this.elements.push({ type: 'dropdown', hint, varName, items });
      return `✓ قائمة منسدلة: "${hint}"${varName ? ' ← ' + varName : ''} [${items.length} عنصر]`;
    }

    // ═══ تاريخ ═══
    m = t.match(/^(?:أضف|اضف|ضع)?\s*(?:تاريخ|datepicker)\s*["'«»]([^"'«»]+)["'«»](?:\s+كـ\s+(\S+))?/);
    if (m) {
      const hint = m[1];
      const varName = m[2] || null;
      if (varName && !this.stateVars.has(varName)) {
        this.stateVars.set(varName, { type: 'String', init: '""' });
      }
      this.elements.push({ type: 'datepicker', hint, varName });
      return `✓ منتقي تاريخ: "${hint}"${varName ? ' ← ' + varName : ''}`;
    }

    // ═══ وقت ═══
    m = t.match(/^(?:أضف|اضف|ضع)?\s*(?:وقت|timepicker)\s*["'«»]([^"'«»]+)["'«»](?:\s+كـ\s+(\S+))?/);
    if (m) {
      const hint = m[1];
      const varName = m[2] || null;
      if (varName && !this.stateVars.has(varName)) {
        this.stateVars.set(varName, { type: 'String', init: '""' });
      }
      this.elements.push({ type: 'timepicker', hint, varName });
      return `✓ منتقي وقت: "${hint}"${varName ? ' ← ' + varName : ''}`;
    }

    // ═══ شريط جانبي ═══
    m = t.match(/^(?:أضف|اضف|ضع)?\s*(?:شريط_جانب|شريط جانبي|drawer)\s*["'«»]([^"'«»]+)["'«»]/);
    if (m) {
      this.elements.push({ type: 'drawer', title: m[1] });
      return `✓ شريط جانبي: "${m[1]}"`;
    }

    // ═══ شريط تبويب ═══
    m = t.match(/^(?:أضف|اضف|ضع)?\s*(?:شريط_تبويب|شريط تبويب|tabbar)\s*\[([^\]]+)\]/);
    if (m) {
      const tabs = m[1].split(/[,،]/).map(s => s.trim().replace(/^["'«»]|["'«»]$/g, '')).filter(Boolean);
      this.elements.push({ type: 'tabbar', tabs });
      return `✓ شريط تبويب: ${tabs.length} تبويب`;
    }

    // ═══ ويب ═══
    m = t.match(/^(?:أضف|اضف|ضع)?\s*(?:ويب|webview)\s*["'«»]([^"'«»]+)["'«»]/);
    if (m) {
      this.elements.push({ type: 'webview', url: m[1] });
      return `✓ ويب: ${m[1]}`;
    }

    // ═══ فيديو ═══
    m = t.match(/^(?:أضف|اضف|ضع)?\s*(?:فيديو|video)\s*["'«»]([^"'«»]+)["'«»]/);
    if (m) {
      this.elements.push({ type: 'video', src: m[1] });
      return `✓ فيديو: ${m[1]}`;
    }

    // ═══ صوت ═══
    m = t.match(/^(?:أضف|اضف|ضع)?\s*(?:صوت|audio)\s*["'«»]([^"'«»]+)["'«»]/);
    if (m) {
      this.elements.push({ type: 'audio', src: m[1] });
      return `✓ صوت: ${m[1]}`;
    }

    // ═══ خريطة ═══
    m = t.match(/^(?:أضف|اضف|ضع)?\s*(?:خريطة|map)\s+([\d.]+)\s*[،,]\s*([\d.]+)(?:\s*[،,]\s*(\d+))?/);
    if (m) {
      this.elements.push({ type: 'map', lat: m[1], lng: m[2], zoom: m[3] || '15' });
      return `✓ خريطة: (${m[1]}, ${m[2]})`;
    }

    // ═══ رسم بياني ═══
    m = t.match(/^(?:أضف|اضف|ضع)?\s*(?:رسم_بياني|رسم بياني|chart)\s*["'«»]([^"'«»]+)["'«»]\s*\[([^\]]+)\](?:\s*[،,]\s*\[([^\]]+)\])?/);
    if (m) {
      const chartType = m[1];
      const values = m[2].split(/[,،]/).map(s => s.trim()).filter(Boolean);
      const labels = m[3] ? m[3].split(/[,،]/).map(s => s.trim().replace(/^["'«»]|["'«»]$/g, '')).filter(Boolean) : [];
      this.elements.push({ type: 'chart', chartType, values, labels });
      return `✓ رسم بياني (${chartType}): ${values.length} قيمة`;
    }

    // ═══ حوار تاريخ ═══
    m = t.match(/^(?:أضف|اضف|ضع)?\s*(?:حوار_تاريخ|حوار تاريخ|datedialog)(?:\s+كـ\s+(\S+))?/);
    if (m) {
      const varName = m[1] || null;
      if (varName && !this.stateVars.has(varName)) {
        this.stateVars.set(varName, { type: 'String', init: '""' });
      }
      this.elements.push({ type: 'datedialog', varName });
      return `✓ حوار تاريخ${varName ? ' ← ' + varName : ''}`;
    }

    // ═══ حوار لون ═══
    m = t.match(/^(?:أضف|اضف|ضع)?\s*(?:حوار_لون|حوار لون|colordialog)(?:\s+كـ\s+(\S+))?/);
    if (m) {
      const varName = m[1] || null;
      if (varName && !this.stateVars.has(varName)) {
        this.stateVars.set(varName, { type: 'String', init: '"#000000"' });
      }
      this.elements.push({ type: 'colordialog', varName });
      return `✓ حوار لون${varName ? ' ← ' + varName : ''}`;
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

    // ═══ تعديل: أعد محاولة آخر أمر مع تصحيح ═══
    m = t.match(/^(?:تعديل|عدّل|عدل|صحّح|صحح)\s+(.+)$/);
    if (m) {
      const fix = m[1].trim();
      if (!this.lastFailed) {
        return `⚠ لا يوجد أمر فاشل للتعديل. اكتب الأمر أولاً.`;
      }
      const old = this.lastFailed;
      this.lastFailed = null;
      this.lastSuggestion = null;
      // أعد التحليل مع الأمر الجديد
      const retry = this.parseOne(fix);
      if (typeof retry === 'string') {
        return `✎ عدّلت "${old}" → "${fix}"\n${retry}`;
      }
      return retry;
    }

    // ═══ نعم: اقبل الاقتراح الأخير ═══
    if (/^(?:نعم|صح|اجل|موافق|yes|y)$/.test(t)) {
      if (!this.lastSuggestion) {
        return `⚠ لا يوجد اقتراح مقبول.`;
      }
      const suggestion = this.lastSuggestion;
      this.lastSuggestion = null;
      this.lastFailed = null;
      const retry = this.parseOne(suggestion);
      if (typeof retry === 'string') {
        return `✓ نفّذت الاقتراح: ${suggestion}\n${retry}`;
      }
      return retry;
    }

    // ═══ لا: ارفض الاقتراح ═══
    if (/^(?:لا|خطأ|خطا|no|n)$/.test(t)) {
      this.lastSuggestion = null;
      this.lastFailed = null;
      return `✓ أُلغي`;
    }

    // PARSEICON_MARKER
    let mI = t.match(/^(?:ايقونة|أيقونة|icon)\s+(.+)$/);
    if (mI) {
      const rest = mI[1].trim();
      let props = {};
      // ═══ الوصف الحرّ — إن وُجد نص بين علامتي اقتباس ═══
      const textM = rest.match(/["'«»]([^"'«»]+)["'«»]/);
      const colorM = rest.match(/لون\s+["'«»]([^"'«»]+)["'«»]/);
      const shapeM = rest.match(/شكل\s+["'«»]([^"'«»]+)["'«»]/);

      // احفظ الوصف الحرّ إن كان غنياً (كلمات مفتاحية أو كلمات متعددة)
      const richKeywords = ['لمبة','لمبه','قلب','نجمة','نجمه','صاعقة','ساعقه','سحابة','سحابه',
        'قفل','مفتاح','بيت','منزل','شمس','قمر','مثلث','معيّن','سداسي','خمسي',
        'حرف','حروف','حرفين','أرقام','ارقام','رقم','مكتوب','خلفية','عليها','عليه','يحمل'];
      if (textM) {
        const rawText = textM[1];
        const isRich = richKeywords.some(k => rawText.includes(k)) || rawText.split(/\s+/).length >= 3;
        if (isRich) {
          props.description = rawText;
        }
        props.text = rawText;
      }
      if (colorM) props.color = colorM[1];
      if (shapeM) props.shape = shapeM[1];
      if (!props.text) props.text = this.appName;
      if (!props.color) props.color = 'بنفسجي عميق';
      if (!props.shape) props.shape = 'مربع_مع_حواف';
      this.icon = props;
      return '✓ أيقونة: "' + props.text + '" [' + props.color + ']';
    }

    // PARSEPERM_MARKER
    let mP = t.match(/^(?:صلاحية|صلاحيات|permission)\s+["'«»]([^"'«»]+)["'«»]/);
    if (mP) {
      const perm = mP[1].trim();
      if (!this.permissions.includes(perm)) this.permissions.push(perm);
      return '✓ صلاحية: "' + perm + '"';
    }

    // PARSELIB_MARKER
    let mL = t.match(/^(?:مكتبة|library)\s+["'«»]([^"'«»]+)["'«»]/);
    if (mL) {
      const lib = mL[1].trim();
      if (!this.libraries.includes(lib)) this.libraries.push(lib);
      return '✓ مكتبة: "' + lib + '"';
    }

    // PARSEBAR_MARKER
    let mB = t.match(/^(?:شريط_علوي|شريط علوي|topbar)\s+(.+)$/);
    if (mB) {
      const rest = mB[1].trim();
      let props = { text: '', color: 'بنفسجي عميق', size: '70' };
      const textM = rest.match(/["'«»]([^"'«»]+)["'«»]/);
      const colorM = rest.match(/لون\s+["'«»]([^"'«»]+)["'«»]/);
      const sizeM = rest.match(/حجم\s+(\d+)/);
      if (textM) props.text = textM[1];
      if (colorM) props.color = colorM[1];
      if (sizeM) props.size = sizeM[1];
      if (!props.text) props.text = this.appName;
      this.topBar = props;
      return '✓ شريط علوي: "' + props.text + '" [' + props.color + ']';
    }

    // PARSEVAR_MARKER
    let mV = t.match(/^(?:محفوظ|حالة|state|saved)\s+(\S+)(?:\s*=\s*(.+))?$/);
    if (mV) {
      const name = mV[1].trim();
      const value = mV[2] ? mV[2].trim() : '';
      const existing = this.variables.find(v => v.name === name);
      if (existing) existing.value = value;
      else this.variables.push({ name, value, persistent: true });
      return '✓ محفوظ: ' + name;
    }

    // ═══ اعرض الأجهزة / البيئة ═══
    if (/^(?:اعرض|أعرض)\s+(?:الأجهزة|الاجهزة|أجهزة|اجهزة)\s*$/.test(t)) {
      return { action: 'devices' };
    }

    if (/^(?:اعرض|أعرض)\s+(?:البيئة|بيئة)\s*$/.test(t)) {
      return { action: 'environment' };
    }

    // ═══ اعرض ═══
    if (/^(?:اعرض|عرض|حالة|الكود|ارني|أرني|what)$/.test(t)) {
      return this.renderState();
    }

    if (/^(?:اعرض|أعرض)\s+(?:الأجهزة|الاجهزة|أجهزة|اجهزة)$/.test(t)) {
      return { action: 'devices' };
    }

    if (/^(?:اعرض|أعرض)\s+(?:البيئة|بيئة)$/.test(t)) {
      return { action: 'environment' };
    }

    // ═══ شغّل ═══
    if (/^(?:شغّل|شغل|شغله|شغلي|شغّل\s+التطبيق|شغل\s+التطبيق|ثبت|ثبّت|ثبّت\s+التطبيق|ثبت\s+التطبيق|جربه|جرب|ابن[يِ]\s+وشغّل(?:\s+التطبيق)?|ابن[يِ]\s+وثبت(?:\s+التطبيق)?)$/.test(t)) {
      return { action: 'build_and_run' };
    }

    // ═══ ابنِ ═══
    if (/^(?:ابن[يِ]|ابنِ|ابني|بناء|ابن[يِ]\s+فقط|ابنِ\s+التطبيق|ابني\s+التطبيق|بناء\s+التطبيق|ترجم)$/.test(t)) {
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

    // اقترح حلاً
    const suggestion = this.suggestFix(t);
    this.lastFailed = t;
    if (suggestion) {
      this.lastSuggestion = suggestion;
      return `⚠ لم أفهم: "${t}"\n\n💡 الأقرب: ${suggestion}\n   اكتب: تعديل ${suggestion}\n   أو: نعم (لقبول الاقتراح)`;
    }
    this.lastSuggestion = null;
    return `⚠ لم أفهم: "${t}"\n   اكتب "مساعدة" للأوامر المتاحة`;
  }

  // ═══ 5) parse يدعم أوامر متعددة ═══
  parse(text) {
    const trimmed = String(text).trim();
    // DONT_SPLIT — لا تقسّم هذه الأوامر
    if (/^(?:اعرض\s+(?:الأجهزة|الاجهزة|أجهزة|اجهزة|البيئة|بيئة|الكود|الحالة|الواجهة)|ايقونة|أيقونة|icon|صلاحية|صلاحيات|permission|مكتبة|library|شريط_علوي|شريط علوي|topbar|محفوظ|حالة|state|تعديل|عدّل|عدل|صحّح|صحح|نعم|صح|اجل|موافق|yes|y|لا|خطأ|خطا|no|n)(?:\s|$)/i.test(trimmed) || /^(?:نعم|لا|yes|no)$/i.test(trimmed)) {
      return this.parseOne(trimmed);
    }
    if (/^(?:تعديل|عدّل|عدل|صحّح|صحح)\s+/.test(trimmed)) {
      return this.parseOne(trimmed);
    }
    // افحص "نعم" و"لا" أيضاً — لا تقسّم
    if (/^(?:نعم|صح|اجل|موافق|yes|y|لا|خطأ|خطا|no|n)$/.test(trimmed)) {
      return this.parseOne(trimmed);
    }
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

    // ═══ اقتراح ذكي بالأقرب ═══
  suggestFix(input) {
    const t = String(input).trim();
    
    // بنك الأوامر الصحيحة
    const cmds = [
      'انشئ تطبيق "اسم"',
      'أضف عنوان "نص"',
      'أضف كتابة "نص"',
      'أضف حقل "تلميح"',
      'أضف حقل "تلميح" كـ متغير',
      'أضف زر "نص" عند_الضغط',
      'أضف قائمة اسم_القائمة',
      'أضف اختيار "نص"',
      'أضف مفتاح "نص"',
      'أضف مسافة 16',
      'أضف فاصل',
      'الشريط_العلوي ( لون "..." حجم 70 نص "..." )',
      'واجهه "لون"',
      'ازرار "لون"',
      'نص "لون"',
      'حالة اسم = قيمة',
      'محفوظ اسم = قيمة',
      'اعرض',
      'شغّل',
      'ابنِ',
      'تراجع',
      'امسح الكل',
      'مساعدة',
      'خروج',
    ];
    
    // احسب المسافة
    function lev(a, b) {
      const m = a.length, n = b.length;
      const dp = Array.from({ length: m+1 }, () => new Array(n+1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1];
          else dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
        }
      }
      return dp[m][n];
    }
    
    // اقترح الأقرب
    let best = null, bestScore = Infinity;
    for (const cmd of cmds) {
      const score = lev(t, cmd);
      if (score < bestScore) { bestScore = score; best = cmd; }
    }
    
    // اقترح فقط إن كان قريباً
    if (bestScore <= 5 || bestScore < t.length) {
      return best;
    }
    return null;
  }

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
    const lines = [];

    // 1) التوجيهات (#@)
    const header = [];
    if (this.theme) header.push(`#@النمط: ${this.theme}`);
    if (this.buttonColor) header.push(`#@الزر: ${this.buttonColor}`);
    if (this.textColor) header.push(`#@النص: ${this.textColor}`);
    if (header.length) {
      lines.push(header.join('\n'));
      lines.push('');
    }

    // 2) الأيقونة
    if (this.icon) {
      if (this.icon.description) {
        // الوصف الحرّ (صيغة جديدة)
        lines.push(`ايقونة "${this.icon.description}"`);
      } else {
        // الصيغة القديمة
        lines.push(`ايقونة ( نص "${this.icon.text}" لون "${this.icon.color}" شكل "${this.icon.shape}" )`);
      }
      lines.push('');
    }

    // 3) الصلاحيات
    if (this.permissions.length > 0) {
      for (const perm of this.permissions) {
        lines.push(`صلاحية "${perm}"`);
      }
      lines.push('');
    }

    // 4) المكتبات
    if (this.libraries.length > 0) {
      for (const lib of this.libraries) {
        lines.push(`مكتبة "${lib}"`);
      }
      lines.push('');
    }

    // 5) الأنماط المخصصة
    if (this.stateVars.size > 0) {
      for (const [name, info] of this.stateVars) {
        if (info.type === 'String' && info.init) {
          // حالة نصية — قد تكون نمط
        }
      }
    }

    // 6) الشاشة
    lines.push(`شاشة "${this.appName}"`);

    // 7) الشريط العلوي
    if (this.topBar) {
      lines.push(`  الشريط_العلوي ( لون "${this.topBar.color}" حجم ${this.topBar.size} نص "${this.topBar.text}" )`);
      lines.push('');
    }

    // 8) المتغيرات المحفوظة
    for (const v of this.variables) {
      const val = v.value || '""';
      lines.push(`  محفوظ ${v.name} = ${val}`);
    }

    // 9) الحالات من stateVars
    for (const [name, info] of this.stateVars) {
      if (!this.variables.find(v => v.name === name)) {
        let init = '""';
        if (info.type === 'Double') init = '0';
        else if (info.type === 'Boolean') init = 'خطأ';
        else if (info.type === 'MutableList') init = '[]';
        lines.push(`  محفوظ ${name} = ${init}`);
      }
    }

    if (this.variables.length > 0 || this.stateVars.size > 0) {
      lines.push('  مسافة 8');
    }

    // 10) العناصر
    for (const el of this.elements) {
      if (el.type === 'heading') {
        const colorRef = el.colorRef ? ` ( لون "${el.colorRef}" )` : '';
        lines.push(`  عنوان "${el.text}"${colorRef}`);
      }
      else if (el.type === 'text') {
        const colorRef = el.colorRef ? ` ( لون "${el.colorRef}" )` : '';
        lines.push(`  كتابة "${el.text}"${colorRef}`);
      }
      else if (el.type === 'textfield') {
        const binding = el.binding ? ` كـ ${el.binding}` : '';
        lines.push(`  حقل "${el.hint}"${binding}`);
      }
      else if (el.type === 'button') {
        lines.push(`  زر "${el.text}" عند_الضغط`);
        lines.push(`    تنبيه "ضغطت: ${el.text}"`);
        lines.push(`  نهاية`);
      }
      else if (el.type === 'list') {
        lines.push(`  قائمة ${el.source}`);
        lines.push(`    كتابة العنصر`);
        lines.push(`  نهاية`);
      }
      else if (el.type === 'checkbox') {
        lines.push(`  اختيار "${el.text}"`);
      }
      else if (el.type === 'switch') {
        lines.push(`  مفتاح "${el.text}"`);
      }
      else if (el.type === 'spacer') {
        lines.push(`  مسافة ${el.size}`);
      }
      else if (el.type === 'divider') {
        lines.push(`  فاصل`);
      }
    }

    lines.push('نهاية');
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
