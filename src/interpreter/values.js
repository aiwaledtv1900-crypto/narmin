'use strict';

// أنواع القيم وقت التشغيل في نارمين
const ValueType = {
  NUMBER: 'number',
  STRING: 'string',
  BOOLEAN: 'boolean',
  NULL: 'null',
  ARRAY: 'array',
  OBJECT: 'object',
  FUNCTION: 'function',
  NATIVE: 'native',
};

function typeOf(value) {
  if (value === null || value === undefined) return ValueType.NULL;
  if (typeof value === 'number') return ValueType.NUMBER;
  if (typeof value === 'string') return ValueType.STRING;
  if (typeof value === 'boolean') return ValueType.BOOLEAN;
  if (Array.isArray(value)) return ValueType.ARRAY;
  if (value && value.__narmin_fn__) return ValueType.FUNCTION;
  if (value && value.__narmin_native__) return ValueType.NATIVE;
  if (typeof value === 'object') return ValueType.OBJECT;
  return ValueType.NULL;
}

function typeName(value) {
  const t = typeOf(value);
  const map = {
    number: 'رقم', string: 'نص', boolean: 'منطقي',
    null: 'عدم', array: 'مصفوفة', object: 'كائن',
    function: 'دالة', native: 'دالة أصلية',
  };
  return map[t] || t;
}

// تمثيل القيم عند الطباعة
function stringify(value) {
  if (value === null || value === undefined) return 'عدم';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'صحيح' : 'خطأ';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return '[' + value.map(stringify).join('، ') + ']';
  if (value && value.__narmin_fn__) return `<دالة ${value.name || 'مجهولة'}>`;
  if (value && value.__narmin_native__) return `<دالة أصلية ${value.name}>`;
  if (typeof value === 'object') {
    const pairs = Object.entries(value).map(([k, v]) => `${k}: ${stringify(v)}`);
    return '{' + pairs.join('، ') + '}';
  }
  return String(value);
}

function isTruthy(value) {
  if (value === null || value === undefined) return false;
  if (value === false) return false;
  if (value === 0) return false;
  if (value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

// المساواة العميقة
function equals(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => equals(v, b[i]));
  }
  return false;
}

function makeFunction(name, params, body, closure) {
  return {
    __narmin_fn__: true,
    name,
    params,
    body,
    closure,
  };
}

function makeNative(name, fn) {
  return {
    __narmin_native__: true,
    name,
    fn,
  };
}

module.exports = {
  ValueType,
  typeOf,
  typeName,
  stringify,
  isTruthy,
  equals,
  makeFunction,
  makeNative,
};
