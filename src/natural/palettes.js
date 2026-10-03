'use strict';

// ═══ 30 لون أساسي (Hex جاهز) ═══
const BASE_COLORS = {
  'أحمر':      '#F44336', 'احمر':    '#F44336',
  'أزرق':      '#1976D2', 'ازرق':    '#1976D2',
  'أخضر':      '#4CAF50', 'اخضر':    '#4CAF50',
  'أصفر':      '#FFEB3B', 'اصفر':    '#FFEB3B',
  'برتقالي':   '#FF9800',
  'بنفسجي':    '#9C27B0',
  'وردي':      '#E91E63',
  'تركوازي':   '#00BCD4', 'فيروزي': '#00BCD4',
  'سماوي':     '#03A9F4',
  'ليموني':    '#CDDC39',
  'ذهبي':      '#FFC107', 'ذهبي_غامق': '#B8860B',
  'فضي':       '#BDBDBD',
  'برونزي':    '#CD7F32',
  'نحاسي':     '#B87333',
  'ياقوتي':    '#9B111E',
  'زمردي':     '#50C878',
  'كحلي':      '#1A237E',
  'نيلي':      '#3F51B5',
  'خمري':      '#880E4F',
  'فحمي':      '#37474F',
  'عاجي':      '#FFFFF0',
  'لبني':      '#E3F2FD',
  'بني':       '#795548',
  'بني_غامق':  '#3E2723',
  'رمادي':     '#9E9E9E',
  'أسود':      '#000000', 'اسود':   '#000000',
  'أبيض':      '#FFFFFF', 'ابيض':   '#FFFFFF',
  'بيج':       '#F5F5DC',
  'كريمي':     '#FFFDD0',
  'زيتي':      '#808000',
  'مرجاني':    '#FF7F50',
  'عنابي':     '#800000',
  'كافي':      '#6F4E37',
  'شوكولاتي':  '#5D4037',
  'زعفراني':   '#F4C430',
  'قرمزي':     '#DC143C',
  'بنفسج_غامق':'#4A148C',
  'أرجواني':   '#DA70D6', 'ارجواني':'#DA70D6',
  'خزامي':     '#967BB6',
  'نعناعي':    '#98FF98',
  'بحري':      '#006994',
  'قصديري':    '#738678',
  'تيتانيوم':  '#878681',
};

// ═══ 15 معدّل درجة (HSL modifiers) ═══
// كل معدّل يغيّر Luminosity و/أو Saturation
const MODIFIERS = {
  // فاتحون
  'فاتح':       { dL: +25, dS:  0 },
  'فاتح_جداً':  { dL: +40, dS: -10 },
  'بودرة':      { dL: +35, dS: -25 },
  'مائي':       { dL: +30, dS: -15 },
  'حليبي':      { dL: +45, dS: -35 },
  'باهت':       { dL: +15, dS: -40 },
  'عاجي_فاتح':  { dL: +42, dS: -30 },
  // متوسطون
  'متوسط':      { dL:   0, dS:   0 },
  'زاهي':       { dL:  +5, dS: +30 },
  'حيوي':       { dL:  +5, dS: +20 },
  'كلاسيكي':    { dL:   0, dS: -10 },
  // غامقون
  'غامق':       { dL: -20, dS:   0 },
  'داكن':       { dL: -20, dS:   0 },
  'غامق_جداً':  { dL: -35, dS: -10 },
  'داكن_جداً':  { dL: -35, dS: -10 },
  'عميق':       { dL: -25, dS: +10 },
  'ترابي':      { dL: -15, dS: -35 },
  'فحمي_فاتح':  { dL: -30, dS: -20 },
};

// ═══ HEX إلى HSL ═══
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

// ═══ المولّد ═══
function generateColor(baseName, modName) {
  const base = BASE_COLORS[baseName];
  if (!base) return null;
  if (!modName || modName === 'افتراضي' || modName === 'عادي') return base;
  const mod = MODIFIERS[modName];
  if (!mod) return null;
  const hsl = hexToHsl(base);
  const newL = Math.max(5, Math.min(95, hsl.l + mod.dL));
  const newS = Math.max(0, Math.min(100, hsl.s + mod.dS));
  return hslToHex(hsl.h, newS, newL);
}

// ═══ Resolver الذكي ═══
// "أزرق داكن" | "أحمر زاهي" | "ذهبي" | "#FF0000"
function resolveColorSmart(input) {
  if (!input) return null;
  const raw = String(input).trim()
    .replace(/^["'«»]+|["'«»]+$/g, '')
    .replace(/\s+/g, ' ');

  // Hex مباشر
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9A-Fa-f]{3}$/.test(raw)) {
    return '#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
  }

  // لون أساسي مباشر
  if (BASE_COLORS[raw]) return BASE_COLORS[raw];

  // "أساسي معدل" — بمسافة أو _ أو -
  const parts = raw.split(/[\s_\-]+/).filter(Boolean);

  // حالة "أحمر داكن"
  if (parts.length === 2) {
    // محاولة كل الاحتمالات:
    // 1) parts[0] أساسي + parts[1] معدل
    let c = generateColor(parts[0], parts[1]);
    if (c) return c;
    // 2) parts[0]+"_"+parts[1] لون مدمج
    const combined = parts[0] + '_' + parts[1];
    if (BASE_COLORS[combined]) return BASE_COLORS[combined];
    // 3) محاولة مع "ال" تعريف
    c = generateColor('ال' + parts[0], parts[1]);
    if (c) return c;
    c = generateColor(parts[0].replace(/^ال/, ''), parts[1]);
    if (c) return c;
  }

  // حالة "أزرق فاتح جداً" (3 كلمات)
  if (parts.length >= 3) {
    const base = parts[0];
    const mod = parts.slice(1).join('_');
    let c = generateColor(base, mod);
    if (c) return c;
    // محاولة دمج آخر كلمتين
    c = generateColor(base + '_' + parts[1], parts.slice(2).join('_'));
    if (c) return c;
  }

  // حالة "ال" تعريف على معدّل: "فاتح الأزرق"
  return null;
}

// ═══ Palette الكامل (الخلفية + الأزرار + النص) ═══
function resolvePalette(themeName) {
  const bg = resolveColorSmart(themeName);
  if (!bg) return null;
  // نستنتج من الخلفية:
  const hsl = hexToHsl(bg);
  const primary = hslToHex(hsl.h, Math.min(100, hsl.s + 20), Math.max(15, hsl.l - 30));
  const heading = hslToHex(hsl.h, Math.min(100, hsl.s + 10), Math.max(10, hsl.l - 40));
  const onPrimary = hsl.l > 60 ? '#000000' : '#FFFFFF';
  return {
    primary,
    accent: '#FFC107',
    background: bg,
    heading,
    onPrimary,
    onSurface: '#212121',
  };
}

// ═══ قائمة كل الألوان (للتوليد) ═══
function listAllColors() {
  const out = [];
  for (const baseName of Object.keys(BASE_COLORS)) {
    out.push(baseName);
    for (const modName of Object.keys(MODIFIERS)) {
      out.push(`${baseName} ${modName}`);
    }
  }
  return out;
}

function listPalettes() {
  return listAllColors();
}

function listButtonColors() {
  return listAllColors().concat(['مختلط', 'افتراضي']);
}

// ═══ توليد 1500 لون ═══
function generate1500() {
  const list = [];
  // 1) الأساسية
  for (const [n, h] of Object.entries(BASE_COLORS)) {
    list.push({ name: n, hex: h });
  }
  // 2) المزيج
  for (const baseName of Object.keys(BASE_COLORS)) {
    if (baseName.includes('_')) continue;
    for (const modName of Object.keys(MODIFIERS)) {
      const hex = generateColor(baseName, modName);
      if (hex) list.push({ name: `${baseName} ${modName}`, hex });
    }
  }
  return list;
}

// ═══ ألوان أزرار مخصصة للمختلط ═══
const MIXED_COLORS = [
  '#E53935', '#D81B60', '#8E24AA', '#5E35B1', '#3949AB',
  '#1E88E5', '#039BE5', '#00ACC1', '#00897B', '#43A047',
  '#7CB342', '#C0CA33', '#FDD835', '#FFB300', '#FB8C00',
  '#F4511E', '#6D4C41', '#546E7A', '#757575', '#212121',
];

// ═══ توافق خلفي ═══
function resolveButtonColor(name) {
  if (!name) return null;
  const t = String(name).trim();
  if (t === 'مختلط' || t === 'متنوع' || t === 'mixed') return 'MIXED';
  if (t === 'افتراضي' || t === 'default' || t === 'تلقائي' || t === 'تلقائى') return null;
  return resolveColorSmart(t);
}

const PALETTES = BASE_COLORS;
const BUTTON_COLORS = BASE_COLORS;

module.exports = {
  BASE_COLORS,
  MODIFIERS,
  PALETTES,
  BUTTON_COLORS,
  MIXED_COLORS,
  resolveColorSmart,
  resolvePalette,
  resolveButtonColor,
  hexToHsl,
  hslToHex,
  listPalettes,
  listButtonColors,
  listAllColors,
  generate1500,
};
