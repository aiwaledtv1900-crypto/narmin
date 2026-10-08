'use strict';

// ═══ قواعد المساحة الآمنة (Android Adaptive Icon) ═══
// الـ viewport 108dp لكن المنطقة المرئية 72×72 (من 18 إلى 90)
// لهذا نضع كل المحتوى داخل [22, 86]
const SAFE = { min: 22, max: 86, center: 54 };
const SAFE_W = SAFE.max - SAFE.min; // 64

// ═══ تخطيط الأحرف ═══
function layoutLetters(letters) {
  const n = letters.length;
  if (n === 0) return [];

  // حجم الحرف حسب العدد
  let cols, rows, letterScale;
  if (n === 1) { cols = 1; rows = 1; letterScale = 0.62; }
  else if (n === 2) { cols = 2; rows = 1; letterScale = 0.55; }
  else if (n === 3) { cols = 3; rows = 1; letterScale = 0.45; }
  else if (n === 4) { cols = 2; rows = 2; letterScale = 0.48; }
  else if (n <= 6) { cols = 3; rows = 2; letterScale = 0.38; }
  else { cols = 3; rows = 3; letterScale = 0.30; }

  const colSpacing = SAFE_W / (cols + 0.5);
  const rowSpacing = SAFE_W / (rows + 0.5);

  return letters.map((ch, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = SAFE.center + (c - (cols - 1) / 2) * colSpacing;
    const y = SAFE.center + (r - (rows - 1) / 2) * rowSpacing;
    return { char: ch, x, y, scale: letterScale };
  });
}

// ═══ تخطيط الأشكال المتعددة (count > 1) ═══
function layoutShapes(name, count, position) {
  const result = [];
  if (count <= 0) count = 1;

  // للموضع corner → تجميع في الركن
  if (position === 'corner') {
    for (let i = 0; i < count; i++) {
      result.push({
        name,
        x: 70 + (i % 2) * 8,
        y: 34 + Math.floor(i / 2) * 8,
        scale: 0.18,
      });
    }
    return result;
  }

  // للموضع beside → جنب المركز
  if (position === 'beside') {
    for (let i = 0; i < count; i++) {
      result.push({
        name,
        x: 70 + (i % 2) * 10,
        y: 54 + (i - (count - 1) / 2) * 12,
        scale: 0.22,
      });
    }
    return result;
  }

  // للموضع top / bottom / right / left
  if (['top', 'bottom', 'right', 'left'].includes(position)) {
    const coords = {
      top:    { x: 54, y: 30 },
      bottom: { x: 54, y: 78 },
      right:  { x: 78, y: 54 },
      left:   { x: 30, y: 54 },
    };
    const base = coords[position];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = count > 1 ? 10 : 0;
      result.push({
        name,
        x: base.x + Math.cos(angle) * radius,
        y: base.y + Math.sin(angle) * radius,
        scale: count > 1 ? 0.20 : 0.42,
      });
    }
    return result;
  }

  // center → شبكة صغيرة
  if (count === 1) {
    result.push({ name, x: 54, y: 54, scale: 0.42 });
    return result;
  }
  const cols = count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const spacing = 28;
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    result.push({
      name,
      x: 54 + (c - (cols - 1) / 2) * spacing,
      y: 54 + (r - (rows - 1) / 2) * spacing,
      scale: count <= 4 ? 0.28 : 0.22,
    });
  }
  return result;
}

// ═══ المخطط الرئيسي ═══
/**
 * الإدخال: { canvas, elements } من parseNLP
 * الإخراج: خطة رسم كاملة تحتوي:
 *   - canvasShape: اسم شكل الخلفية
 *   - canvasBg: لون الخلفية
 *   - items: قائمة العناصر المُرتَّبة
 */
function layout(spec) {
  const { canvas, elements } = spec;
  const plan = {
    canvasShape: canvas.shape,
    canvasBg: canvas.bg,
    defaultFg: canvas.defaultFg,
    items: [],
  };

  // ═══ فصل العناصر ═══
  const letters = [];
  const shapes = [];

  for (const el of elements) {
    if (el.type === 'letter') {
      letters.push(el);
    } else if (el.type === 'shape') {
      shapes.push(el);
    }
  }

  // ═══ 1) الحروف → شبكة ═══
  if (letters.length > 0) {
    const letterChars = letters.map(l => l.char);
    const positioned = layoutLetters(letterChars);

    for (let i = 0; i < positioned.length; i++) {
      const p = positioned[i];
      plan.items.push({
        type: 'letter',
        char: p.char,
        x: p.x,
        y: p.y,
        scale: p.scale,
        color: letters[i].color || canvas.defaultFg,
        zIndex: 10 + i, // فوق الأشكال الأخرى
      });
    }
  }

  // ═══ 2) الأشكال → تخطيط كل شكل ═══
  let shapeZ = 5;
  for (const sh of shapes) {
    // في حال وجود حروف وأشكال معاً → صغّر الأشكال وحرّكها
    const hasLetters = letters.length > 0;
    let effectivePos = sh.position;
    let effectiveScaleMult = 1;

    if (hasLetters) {
      // حرّك الشكل خارج منطقة الحروف
      if (sh.position === 'center') {
        effectivePos = 'corner';
      }
      effectiveScaleMult = 0.6;
    }

    const placed = layoutShapes(sh.name, sh.count || 1, effectivePos);
    for (const p of placed) {
      plan.items.push({
        type: 'shape',
        name: p.name,
        x: p.x,
        y: p.y,
        scale: p.scale * effectiveScaleMult,
        color: sh.color || canvas.defaultFg,
        zIndex: shapeZ++,
      });
    }
  }

  return plan;
}

// ═══ مساعدة: لو العنصر داخل الـ safe zone ═══
function clampToSafe(x, y, scale = 0.5) {
  // الحد الأدنى والأقصى للحواف مع مراعاة scale
  const margin = 54 * scale * 0.5;
  return {
    x: Math.max(SAFE.min + margin, Math.min(SAFE.max - margin, x)),
    y: Math.max(SAFE.min + margin, Math.min(SAFE.max - margin, y)),
  };
}

module.exports = {
  layout,
  layoutLetters,
  layoutShapes,
  clampToSafe,
  SAFE,
};
