'use strict';

const { COLORS, lighten, darken } = require('./parser');
const { listShapes } = require('./shapes');

const POSITIONS = {
  'المنتصف': 'center', 'منتصف': 'center', 'وسط': 'center',
  'فوق': 'top', 'أعلى': 'top', 'اعلى': 'top',
  'تحت': 'bottom', 'أسفل': 'bottom', 'اسفل': 'bottom',
  'يمين': 'right', 'اليمين': 'right',
  'يسار': 'left', 'شمال': 'left', 'اليسار': 'left',
  'ركن': 'corner', 'زاوية': 'corner', 'زوايا': 'corner',
  'خلف': 'behind', 'خلفه': 'behind', 'خلفها': 'behind', 'خلفية': 'behind', 'خلفهم': 'behind',
  'جنب': 'beside', 'جنبه': 'beside', 'جنبها': 'beside', 'بجانب': 'beside',
};

const PLURALS = {
  'قلوب': 'قلب', 'قلبين': 'قلب',
  'نجوم': 'نجمة', 'نجمتين': 'نجمة',
  'لمبات': 'لمبة', 'لمب': 'لمبة', 'مصابيح': 'لمبة',
  'بيوت': 'بيت', 'منازل': 'بيت',
  'دوار': 'دايري', 'دوائر': 'دايري',
  'صواعق': 'صاعقة', 'بروق': 'صاعقة',
  'أقمار': 'قمر', 'قمور': 'قمر',
  'شمس': 'شمس',
  'صحون': 'صحن', 'أوراق': 'ورقة', 'كتب': 'كتاب', 'أقلام': 'قلم',
  'ساعات': 'ساعة', 'أجراس': 'جرس',
  'زهور': 'زهرة', 'أزهار': 'زهرة',
  'أشجار': 'شجرة', 'شجر': 'شجرة',
  'مفاتيح': 'مفتاح', 'أقفال': 'قفل',
  'أسهم': 'سهم', 'سهوم': 'سهم',
  'غيوم': 'سحابة', 'سحائب': 'سحابة',
};

const SYNONYMS = {
  'مصباح': 'لمبة', 'bulb': 'لمبة',
  'قلبي': 'قلب', 'قلبية': 'قلب', 'heart': 'قلب',
  'نجمي': 'نجمة', 'ستار': 'نجمة', 'star': 'نجمة',
  'برق': 'صاعقة', 'bolt': 'صاعقة',
  'غيمة': 'سحابة', 'غيمه': 'سحابة', 'cloud': 'سحابة',
  'منزل': 'بيت', 'house': 'بيت',
  'دائري': 'دايري', 'دائرة': 'دايري', 'circle': 'دايري',
  'ساعه': 'ساعة', 'clock': 'ساعة',
  'قفلة': 'قفل', 'lock': 'قفل',
  'زهره': 'زهرة', 'flower': 'زهرة',
  'شجره': 'شجرة', 'tree': 'شجرة',
};

const COLOR_MODS = [
  { words: ['فاتح جداً', 'فاتح جدا'], fn: h => lighten(h, 0.6) },
  { words: ['فاتح', 'مائي', 'باهت', 'بودرة'], fn: h => lighten(h, 0.4) },
  { words: ['غامق', 'داكن جداً', 'داكن جدا', 'عميق'], fn: h => darken(h, 0.4) },
  { words: ['داكن', 'ترابي'], fn: h => darken(h, 0.25) },
];

const LETTER_KW = ['حرف', 'حرفين', 'حروف'];
const LETTER_KW_ATTACHED = ['وحرف', 'وحرفين', 'وحروف'];
const NUMBER_KW = ['أرقام', 'ارقام', 'رقم', 'أعداد', 'اعداد'];
const NUMBER_KW_ATTACHED = ['وأرقام', 'وارقام', 'وأعداد', 'واعداد'];

// ═══ فصل "و" الملتصقة بأشكال/أرقام معروفة ═══
function smartTokenize(text) {
  const shapes = listShapes();
  const shapeWords = [...shapes, ...Object.keys(SYNONYMS), ...Object.keys(PLURALS)];

  const raw = String(text).trim().split(/\s+/);
  const result = [];

  for (const tok of raw) {
    // "ونجمة" → "و" + "نجمة"
    if (tok.length > 2 && tok[0] === 'و') {
      const rest = tok.slice(1);
      if (shapeWords.includes(rest)) {
        result.push('و', rest);
        continue;
      }
    }
    // "وأرقام" → "و" + "أرقام"
    if (tok === 'وأرقام' || tok === 'وارقام') {
      result.push('و', 'أرقام');
      continue;
    }
    // "وحرف" → "و" + "حرف"
    if (tok === 'وحرف' || tok === 'وحروف' || tok === 'وحرفين') {
      result.push('و', 'حرف');
      continue;
    }
    result.push(tok);
  }
  return result;
}

// ═══ تقطيع ذكي — يفهم سياق "و" ═══
function segment(text) {
  const tokens = smartTokenize(text);
  const segments = [];
  let current = [];
  let mode = null; // null | 'letters' | 'numbers'

  function isSingleChar(t) {
    return /^[A-Za-z\u0621-\u064A0-9]$/.test(t);
  }

  function flush() {
    if (current.length) segments.push(current.join(' ').trim());
    current = [];
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // كلمة مفتاحية للحروف
    if (LETTER_KW.includes(t)) {
      mode = 'letters';
      current.push(t);
      continue;
    }
    if (LETTER_KW_ATTACHED.includes(t)) {
      flush();
      current.push('حرف');
      mode = 'letters';
      continue;
    }
    if (NUMBER_KW.includes(t)) {
      mode = 'numbers';
      current.push(t);
      continue;
    }
    if (NUMBER_KW_ATTACHED.includes(t)) {
      flush();
      current.push('أرقام');
      mode = 'numbers';
      continue;
    }

    // فواصل صريحة
    if (['،', ',', '+', 'ثم', 'أو', 'او'].includes(t)) {
      flush();
      mode = null;
      continue;
    }

    // "و" عاطفة
    if (t === 'و') {
      const next = tokens[i + 1];
      // داخل نمط حروف/أرقام، والتالي حرف/رقم مفرد → عطف
      if (mode && next && isSingleChar(next.replace(/[،,]/g, ''))) {
        current.push('و');
        continue;
      }
      // وإلا → فاصل
      flush();
      mode = null;
      continue;
    }

    // كلمة عادية
    current.push(t);
  }
  flush();
  return segments.filter(Boolean);
}

function extractShape(seg) {
  const s = String(seg);
  // 1) الجمع أولاً (أطول كلمة أولاً)
  for (const [plural, singular] of Object.entries(PLURALS).sort((a, b) => b[0].length - a[0].length)) {
    if (s.includes(plural)) return singular;
  }
  // 2) المرادفات
  for (const [syn, canonical] of Object.entries(SYNONYMS).sort((a, b) => b[0].length - a[0].length)) {
    if (s.includes(syn)) return canonical;
  }
  // 3) الأشكال الرسمية
  const shapes = listShapes();
  for (const name of shapes.sort((a, b) => b.length - a.length)) {
    if (s.includes(name)) return name;
  }
  return null;
}

function hasContentWord(s) {
  return /(?:مكتوب|عليه|عليها|يحمل|داخله|داخلها|فيها|فيه|فوقه|فوقها|تحته|تحتها)\s/.test(s);
}

function extractLetters(seg) {
  const s = String(seg);
  const tokens = s.split(/\s+/);
  const letters = [];
  const STOP = ['مكتوب', 'بلون', 'باللون', 'فوق', 'تحت', 'داخل', 'جنب', 'جانب', 'بجانب',
    'في', 'على', 'خلف', 'أمام', 'وراء', 'صغير', 'كبير', 'وسط', 'المنتصف', 'أعلى', 'أسفل'];

  let mode = null;
  let buffer = [];

  const isLetter = t => /^[\u0621-\u064A]$/.test(t) && t !== 'و';
  const isLatin = t => /^[A-Za-z]$/.test(t);
  const isDigit = t => /^[0-9]$/.test(t);
  const isValid = t => isLetter(t) || isLatin(t) || isDigit(t);

  function flush() {
    for (const t of buffer) {
      if (isLetter(t)) letters.push(t);
      else if (isLatin(t)) letters.push(t.toUpperCase());
      else if (isDigit(t)) letters.push(t);
    }
    buffer = [];
  }

  for (let i = 0; i < tokens.length; i++) {
    let t = tokens[i].replace(/[،,]/g, '');
    if (!t) continue;

    // كلمات مفتاحية
    if (LETTER_KW.includes(t)) { flush(); mode = 'letters'; continue; }
    if (t === 'وحرف' || t === 'وحرفين' || t === 'وحروف') { flush(); mode = 'letters'; continue; }
    if (NUMBER_KW.includes(t)) { flush(); mode = 'numbers'; continue; }
    if (NUMBER_KW_ATTACHED.includes(t)) { flush(); mode = 'numbers'; continue; }

    if (mode) {
      if (isValid(t)) { buffer.push(t); continue; }
      if (t === 'و') {
        const next = (tokens[i + 1] || '').replace(/[،,]/g, '');
        if (isValid(next)) continue; // عطف
      }
      if (STOP.includes(t)) { flush(); mode = null; continue; }
      flush(); mode = null;
    }
  }
  flush();
  return [...new Set(letters)];
}

function extractCount(seg) {
  const s = String(seg);
  const m = s.match(/(\d+)\s+(?:نجوم|نجمات|قلوب|حروف|أرقام|ارقام|نجمة|نجم|قلب|دوائر|دائرة)/);
  if (m) return parseInt(m[1]);
  if (s.includes('نجمتان') || s.includes('قلبان')) return 2;
  if (s.includes('نجوم') || s.includes('قلوب')) return 3;
  return 1;
}

function extractColor(seg) {
  const s = String(seg);
  for (const mod of COLOR_MODS) {
    for (const word of mod.words) {
      if (s.includes(word)) {
        const base = s.replace(word, '').trim();
        const names = Object.keys(COLORS).sort((a, b) => b.length - a.length);
        for (const cname of names) {
          if (base.includes(cname)) return mod.fn(COLORS[cname]);
        }
      }
    }
  }
  const names = Object.keys(COLORS).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (s.includes(name)) return COLORS[name];
  }
  return null;
}

function extractPosition(seg) {
  const s = String(seg);
  for (const [ar, pos] of Object.entries(POSITIONS)) {
    if (s.includes(ar)) return pos;
  }
  return null;
}

// ═══ المحلل الرئيسي ═══
function parseNLP(description) {
  const desc = String(description).trim();
  const segs = segment(desc);

  const canvas = { bg: null, shape: null };
  const elements = [];

  for (const s of segs) {
    const shape = extractShape(s);
    const color = extractColor(s);
    const pos = extractPosition(s);
    const letters = extractLetters(s);
    const count = extractCount(s);
    const hasContent = hasContentWord(s);
    const isBehind = pos === 'behind';

    // ═══ 1) خلفها + شكل → canvas ═══
    if (isBehind && shape) {
      canvas.shape = canvas.shape || shape;
      canvas.bg = canvas.bg || color;
      for (const ch of letters) elements.push({ type: 'letter', char: ch, color: null, position: 'center', size: 'medium' });
      continue;
    }

    // ═══ 2) "X داخل Y" ═══
    if (s.includes('داخل')) {
      const parts = s.split(/\s*داخل(?:ها|ه|هم)?\s+/);
      if (parts.length === 2) {
        const innerShape = extractShape(parts[1]);
        const outerShape = extractShape(parts[0]);
        if (innerShape && outerShape && innerShape !== outerShape) {
          canvas.shape = canvas.shape || innerShape;
          canvas.bg = canvas.bg || extractColor(parts[1]);
          elements.push({
            type: 'shape', name: outerShape,
            color: extractColor(parts[0]) || null,
            count: extractCount(parts[0]) || 1,
            position: 'center', size: 'medium'
          });
          for (const ch of letters) elements.push({ type: 'letter', char: ch, color: null, position: 'center', size: 'medium' });
          continue;
        }
      }
    }

    // ═══ 2b) "X عليها/داخلها Y" (شكلان مختلفان) ═══
    if (hasContent && shape) {
      const m = s.match(/^(.+?)\s+(?:عليه[ا]?|داخله[ا]?|يحمل|فوقه[ا]?|تحته[ا]?|فيها?)\s+(.+)$/);
      if (m) {
        const firstShape = extractShape(m[1]);
        const afterShape = extractShape(m[2]);
        if (firstShape && afterShape) {
          // الشكل الأول → canvas
          if (!canvas.shape && !canvas.bg) {
            canvas.shape = firstShape;
            canvas.bg = extractColor(m[1]);
          }
          // الشكل الثاني → عنصر
          const afterCount = extractCount(m[2]);
          elements.push({
            type: 'shape', name: afterShape,
            color: extractColor(m[2]) || null,
            count: afterCount,
            position: 'center',
            size: afterCount > 1 ? 'small' : 'medium'
          });
          // حروف
          for (const ch of letters) {
            elements.push({ type: 'letter', char: ch, color: null, position: 'center', size: 'medium' });
          }
          continue;
        }
      }
    }

    // ═══ 3) N × شكل (count > 1) → عنصر دائماً ═══
    if (shape && count > 1) {
      // لو لم توجد canvas بعد، خصّص دايري افتراضية
      if (!canvas.shape && !canvas.bg) {
        canvas.shape = 'دايري';
        canvas.bg = '#1A237E';
      }
      elements.push({
        type: 'shape', name: shape,
        color: color || null,
        count,
        position: pos || 'center',
        size: 'small'
      });
      for (const ch of letters) elements.push({ type: 'letter', char: ch, color: null, position: 'center', size: 'medium' });
      continue;
    }

    // ═══ 4) شكل + كلمة مفتاحية (مكتوب عليها/داخلها) ═══
    if (shape && hasContent) {
      // الشكل الأول يصبح canvas
      if (!canvas.shape && !canvas.bg) {
        canvas.shape = shape;
        canvas.bg = color || null;
      }
      for (const ch of letters) elements.push({ type: 'letter', char: ch, color: null, position: 'center', size: 'medium' });

      // محتوى إضافي بعد الكلمة المفتاحية
      const m = s.match(/(?:مكتوب\s+عليه[ا]?|عليه[ا]?|يحمل|داخله[ا]?|فيها?|فوقه[ا]?|تحته[ا]?)\s+(.+)/);
      if (m) {
        const after = m[1];
        const altShape = extractShape(after);
        if (altShape && altShape !== shape) {
          const altCount = extractCount(after);
          elements.push({
            type: 'shape', name: altShape,
            color: extractColor(after) || null,
            count: altCount,
            position: 'center',
            size: altCount > 1 ? 'small' : 'medium'
          });
        }
      }
      continue;
    }

    // ═══ 5) شكل مفرد (count = 1) ═══
    if (shape) {
      // أول شكل → canvas
      if (!canvas.shape && !canvas.bg && elements.length === 0) {
        canvas.shape = shape;
        canvas.bg = color || null;
      } else {
        elements.push({
          type: 'shape', name: shape,
          color: color || null,
          count: 1,
          position: pos || 'center',
          size: 'medium'
        });
      }
      for (const ch of letters) elements.push({ type: 'letter', char: ch, color: null, position: 'center', size: 'medium' });
      continue;
    }

    // ═══ 6) لون فقط ═══
    if (color && !canvas.bg && !canvas.shape && elements.length === 0) {
      canvas.bg = color;
    }

    // حروف بلا سياق
    for (const ch of letters) elements.push({ type: 'letter', char: ch, color: null, position: 'center', size: 'medium' });
  }

  if (!canvas.shape) canvas.shape = 'دايري';
  if (!canvas.bg) canvas.bg = '#1A237E';

  const rgb = hexToRgb(canvas.bg);
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  canvas.defaultFg = lum > 0.5 ? '#000000' : '#FFFFFF';

  return { canvas, elements, raw: desc };
}

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

module.exports = { parseNLP, segment, smartTokenize, extractShape, extractLetters, extractColor, extractPosition, extractCount, PLURALS, SYNONYMS };
