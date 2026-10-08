'use strict';

const { getShape } = require('./shapes');
const { getLetter } = require('./letters');
const { layout } = require('./layout');

// ═══ تحويل نقطة: من (54,54) إلى (tx,ty) مع scale ═══
function transformPathToPosition(pathData, tx, ty, scale) {
  const tokens = pathData.match(/[MLHVCASQZmlhvcasqz]|-?\d+\.?\d*/g) || [];
  const out = [];
  let i = 0;
  let curCmd = '';

  function readN() { return parseFloat(tokens[i++]); }
  function pt(x, y) {
    const nx = (x - 54) * scale + tx;
    const ny = (y - 54) * scale + ty;
    return nx.toFixed(2) + ' ' + ny.toFixed(2);
  }

  while (i < tokens.length) {
    const tok = tokens[i];
    if (/^[MLHVCASQZmlhvcasqz]$/.test(tok)) {
      curCmd = tok;
      i++;
    }
    const c = curCmd.toUpperCase();

    if (c === 'M' || c === 'L') {
      const x = readN(), y = readN();
      out.push(c + pt(x, y));
    } else if (c === 'H') {
      const x = readN();
      // H يعني خط أفقي إلى x مع y الحالي — نحتاج y معروف
      // سنستخدم y=54 كافتراض (يُشفى لاحقاً)
      out.push('L' + pt(x, 54));
    } else if (c === 'V') {
      const y = readN();
      out.push('L' + pt(54, y));
    } else if (c === 'C') {
      const x1 = readN(), y1 = readN(), x2 = readN(), y2 = readN(), x = readN(), y = readN();
      out.push('C' + pt(x1, y1) + ' ' + pt(x2, y2) + ' ' + pt(x, y));
    } else if (c === 'A') {
      const rx = readN(), ry = readN(), rot = readN(), laf = readN(), sf = readN(), x = readN(), y = readN();
      out.push(`A${(rx * scale).toFixed(2)} ${(ry * scale).toFixed(2)} ${rot} ${laf} ${sf} ${pt(x, y)}`);
    } else if (c === 'Z') {
      out.push('Z');
    } else {
      i++;
    }
  }
  return out.join(' ');
}

// ═══ تحويل path كامل لـ background (بدون ترجمة، فقط scale من المركز) ═══
function scaleBackgroundPath(pathData, scale = 1) {
  return transformPathToPosition(pathData, 54, 54, scale);
}

// ═══ رسم خطة layout كاملة إلى XML ═══
function renderPlan(plan) {
  const lines = [];
  const header = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">`;
  lines.push(header);

  // ═══ 1) الخلفية ═══
  const bgShape = getShape(plan.canvasShape);
  if (bgShape) {
    lines.push(`    <path
        android:fillColor="${plan.canvasBg}"
        android:fillType="nonZero"
        android:pathData="${bgShape.path}" />`);
  } else {
    // دائرة افتراضية
    lines.push(`    <path
        android:fillColor="${plan.canvasBg}"
        android:fillType="nonZero"
        android:pathData="M54,4 A50,50 0 1,0 54,104 A50,50 0 1,0 54,4 Z" />`);
  }

  // ═══ 2) رتب العناصر حسب zIndex ═══
  const items = [...plan.items].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  for (const item of items) {
    if (item.type === 'letter') {
      const path = getLetter(item.char);
      if (!path) continue;
      const transformed = transformPathToPosition(path, item.x, item.y, item.scale);
      lines.push(`    <path
        android:fillColor="${item.color}"
        android:fillType="nonZero"
        android:pathData="${transformed}" />`);
    } else if (item.type === 'shape') {
      const sh = getShape(item.name);
      if (!sh) continue;
      const transformed = transformPathToPosition(sh.path, item.x, item.y, item.scale);
      lines.push(`    <path
        android:fillColor="${item.color}"
        android:fillType="nonZero"
        android:pathData="${transformed}" />`);
    }
  }

  lines.push('</vector>');
  return lines.join('\n') + '\n';
}

// ═══ الواجهة الرئيسية: spec من NLP → XML ═══
function renderFromSpec(spec) {
  const plan = layout(spec);
  return {
    xml: renderPlan(plan),
    plan,
    spec,
  };
}

module.exports = {
  renderPlan,
  renderFromSpec,
  transformPathToPosition,
  scaleBackgroundPath,
};
