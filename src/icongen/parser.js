'use strict';

const { listShapes } = require('./shapes');

// ═══ خريطة الألوان (1500+ مصدر، هنا 50 لوناً أساسياً) ═══
const COLORS = {
  // أساسية
  'أحمر': '#E53935', 'احمر': '#E53935', 'red': '#E53935',
  'أزرق': '#1E88E5', 'ازرق': '#1E88E5', 'blue': '#1E88E5',
  'أخضر': '#43A047', 'اخضر': '#43A047', 'green': '#43A047',
  'أصفر': '#FDD835', 'اصفر': '#FDD835', 'yellow': '#FDD835',
  'برتقالي': '#FB8C00', 'orange': '#FB8C00',
  'بنفسجي': '#8E24AA', 'purple': '#8E24AA',
  'وردي': '#EC407A', 'pink': '#EC407A',
  'بني': '#6D4C41', 'brown': '#6D4C41',
  'رمادي': '#757575', 'gray': '#757575',
  'أسود': '#000000', 'اسود': '#000000', 'black': '#000000',
  'أبيض': '#FFFFFF', 'ابيض': '#FFFFFF', 'white': '#FFFFFF',
  'ذهبي': '#FFD700', 'gold': '#FFD700',
  'فضي': '#C0C0C0', 'silver': '#C0C0C0',
  'فيروزي': '#00BCD4', 'turquoise': '#00BCD4',
  'تركوازي': '#00BCD4',
  'كحلي': '#1A237E', 'navy': '#1A237E',
  'خمري': '#880E4F',
  'زيتي': '#827717',
  'زيتوني': '#827717',
  'سماوي': '#4FC3F7',
  'ليموني': '#CDDC39',
  'نحاسي': '#B87333',
  'ياقوتي': '#E0115F',
  'زمردي': '#50C878',
  'مرجاني': '#FF7F50',
  'عنابي': '#7B1FA2',
  'فحمي': '#37474F',
  'عاجي': '#FFFFF0',
  'لبني': '#E3F2FD',
  'كريمي': '#FFF8E1',
  'بيج': '#F5F5DC',
  'برونزي': '#CD7F32',
  'نيلي': '#3F51B5',
  'حيوي': '#00E676',
  'زاهي': '#FF1744',
  'فاتح': '#F5F5F5',
  'غامق': '#212121',
  'داكن': '#263238',
  'عميق': '#1A237E',
  // ═══ مرادفات مؤنث/جمع ═══
  'حمرا': '#E53935', 'حمراء': '#E53935', 'الحمرا': '#E53935',
  'زرقا': '#1E88E5', 'زرقاء': '#1E88E5', 'الزرقا': '#1E88E5',
  'خضرا': '#43A047', 'خضراء': '#43A047', 'الخضرا': '#43A047',
  'صفرا': '#FDD835', 'صفراء': '#FDD835',
  'برتقانيا': '#FB8C00', 'برتقالية': '#FB8C00',
  'بنفسجيا': '#8E24AA', 'بنفسجية': '#8E24AA',
  'ورديا': '#EC407A', 'وردية': '#EC407A',
  'بيضا': '#FFFFFF', 'بيضاء': '#FFFFFF',
  'سودا': '#000000', 'سوداء': '#000000',
  'سمائية': '#4FC3F7', 'سماوية': '#4FC3F7',
  'ذهبية': '#FFD700',
  'فضية': '#C0C0C0',
  'وردية': '#EC407A',
};

// ═══ معدلات الدرجة ═══
const MODIFIERS = [
  { words: ['فاتح جداً', 'فاتح جدا', 'بودرة', 'حليبي'], factor: 0.3 },
  { words: ['فاتح', 'مائي', 'باهت'], factor: 0.5 },
  { words: ['زاهي', 'حيوي'], factor: 1.0 },
  { words: ['غامق', 'داكن جداً', 'داكن جدا', 'عميق'], factor: -0.4 },
  { words: ['داكن', 'ترابي'], factor: -0.25 },
];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
function rgbToHex(r, g, b) {
  const f = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}
function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255-r)*amount, g + (255-g)*amount, b + (255-b)*amount);
}
function darken(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1-amount), g * (1-amount), b * (1-amount));
}

function resolveColor(name) {
  if (!name) return null;
  if (/^#[0-9A-Fa-f]{6}$/.test(name)) return name;
  const n = String(name).trim();
  if (COLORS[n]) return COLORS[n];

  // جرّب معدلات
  for (const m of MODIFIERS) {
    for (const w of m.words) {
      if (n.includes(w)) {
        const base = n.replace(w, '').trim();
        const baseHex = COLORS[base];
        if (baseHex) {
          return m.factor > 0 ? lighten(baseHex, m.factor) : darken(baseHex, -m.factor);
        }
      }
    }
  }
  return null;
}

// ═══ تحليل الوصف العربي ═══
/**
 * الإدخال مثال:
 *   "ايقونة حمرا مكتوب عليها حرف E وحرف S وخلفية لمبة في الخلف"
 *   "دائرة زرقاء عليها حرف A"
 *   "أيقونة خضراء شكل قلب وحرف M"
 *
 * المخرجات:
 * {
 *   bgColor: '#E53935',       // لون الخلفية
 *   fgColor: '#FFFFFF',       // لون الرموز
 *   shape: 'لمبة',            // شكل SVG (اختياري)
 *   letters: ['E', 'S'],      // حروف
 *   position: 'overlay',      // ترتيب الطبقات
 * }
 */
function parseIconDescription(desc) {
  if (!desc) return null;
  const d = String(desc).trim();

  const result = {
    bgColor: null,
    fgColor: null,
    shape: null,
    letters: [],
    raw: d,
  };

  // ═══ 1) ابحث عن الحروف: "حرف E" أو "حرفين E,S" أو "حروف E,S,A" ═══
  const letterRegex = /(?:حروف|حرفين|حرف)\s+((?:(?:و\s*)?[A-Za-z0-9]\s*[،,\s]?\s*)+)/g;
  let m;
  while ((m = letterRegex.exec(d)) !== null) {
    const chunk = m[1];
    const found = chunk.match(/[A-Za-z0-9]/g);
    if (found) result.letters.push(...found.map(x => x.toUpperCase()));
  }
  // مثال بديل: "مكتوب عليها E وS"
  if (result.letters.length === 0) {
    const alt = d.match(/(?:مكتوب|مكتوب عليها|مكتوب عليه|يحمل|عليه)\s+(?:حرف\s+)?([A-Za-z0-9](?:\s*[و،,]\s*[A-Za-z0-9])*)/);
    if (alt) {
      const found = alt[1].match(/[A-Za-z0-9]/g);
      if (found) result.letters.push(...found.map(x => x.toUpperCase()));
    }
  }
  // مثال: "أرقام 1، 2، 3"
  // ═══ ابحث دائماً عن الأرقام ═══
  {
    const numbersRe = /(?:وأرقام|وارقام|أرقام|ارقام|رقم|أعداد|اعداد)\s+((?:(?:و\s*)?[0-9]+\s*[،,\s]?\s*)+)/;
    const nr = d.match(numbersRe);
    if (nr) {
      const found = nr[1].match(/[0-9]/g);
      if (found) result.letters.push(...found);
    }
  }
  // مثال مبسط: "ES" مباشرة؟ (احتياط)
  if (result.letters.length === 0) {
    const simple = d.match(/\b([A-Z]{1,3})\b/);
    if (simple) result.letters.push(...simple[1].split(''));
  }

  // ═══ 2) ابحث عن الشكل ═══
  for (const shapeName of listShapes()) {
    if (d.includes(shapeName)) {
      result.shape = shapeName;
      break;
    }
  }
  // أشكال بديلة (بصيغة المؤنث)
  if (!result.shape) {
    const shapeAliases = {
      'لمبة': ['لمبه', 'مصباح'],
      'قلب': ['قلبيه', 'قلبي'],
      'نجمة': ['نجمه', 'ستار'],
      'صاعقة': ['صاعقه', 'برق'],
      'سحابة': ['سحابه', 'غيمة', 'غيمه'],
      'قفل': ['قفلة', 'مقفل'],
      'بيت': ['منزل', 'بيتاً', 'منزلاً'],
    };
    for (const [canon, alts] of Object.entries(shapeAliases)) {
      if (alts.some(a => d.includes(a))) {
        result.shape = canon;
        break;
      }
    }
  }

  // ═══ 3) ابحث عن الألوان ═══
  const colorMatches = [];
  for (const colorName of Object.keys(COLORS)) {
    if (d.includes(colorName)) {
      // تحقق أنه لون خلفية
      const re = new RegExp('(?:خلفية|خلفية|لون|بلون)?\\s*' + colorName);
      if (re.test(d)) {
        colorMatches.push({ name: colorName, hex: COLORS[colorName] });
      }
    }
  }
  // ═══ إزالة التكرار ═══
  result.letters = [...new Set(result.letters)];

  if (colorMatches.length > 0) {
    result.bgColor = colorMatches[0].hex;
  }

  // ═══ 4) لو ما وجدنا خلفية صريحة، حاول أي لون ═══
  if (!result.bgColor) {
    for (const colorName of Object.keys(COLORS)) {
      if (d.includes(colorName)) {
        result.bgColor = COLORS[colorName];
        break;
      }
    }
  }

  // ═══ 5) اللون الافتراضي ═══
  if (!result.bgColor) result.bgColor = '#1A237E';
  if (!result.fgColor) result.fgColor = '#FFFFFF';
  if (!result.shape) result.shape = 'دايري';

  return result;
}

module.exports = { parseIconDescription, resolveColor, COLORS, lighten, darken };
