'use strict';

const { parseNLP } = require('./nlp');
const { layout } = require('./layout');
const { renderPlan } = require('./render');
const { getShape } = require('./shapes');
const { getLetter } = require('./letters');

// ═══ الواجهة الرئيسية — تحويل وصف عربي إلى XML ═══
function generateIconXml(description, options = {}) {
  // 1) حلّل الوصف
  const spec = parseNLP(description);

  // 2) خطط التخطيط
  const plan = layout(spec);

  // 3) ارسم XML
  const xml = renderPlan(plan);

  return {
    spec,
    plan,
    xml,
    layers: plan.items,
  };
}

// ═══ واجهة متوافقة مع الكود القديم (تقبل AST Node أو string) ═══
function generateFromNodeOrString(input) {
  if (typeof input === 'string') {
    return generateIconXml(input).xml;
  }
  if (input && input.props && input.props.description) {
    return generateIconXml(input.props.description).xml;
  }
  if (input && input.props) {
    // صيغة قديمة — نحوّلها إلى وصف
    const p = input.props;
    const getV = (n) => {
      if (!n) return null;
      if (typeof n === 'string') return n;
      if (n.value !== undefined) return n.value;
      if (n.name !== undefined) return n.name;
      return null;
    };
    const color = getV(p.color);
    const shape = getV(p.shape);
    const text = getV(p.text);
    const parts = [];
    if (text) parts.push(`"${text}"`);
    if (color) parts.push(color);
    if (shape) parts.push(`شكل ${shape}`);
    return generateIconXml(parts.join(' ')).xml;
  }
  return generateIconXml('ايقونة').xml;
}

module.exports = {
  generateIconXml,
  generateFromNodeOrString,
};
