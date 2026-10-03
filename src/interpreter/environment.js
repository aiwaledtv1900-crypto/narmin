'use strict';

// بيئة تنفيذ — سلسلة نطاقات (Scopes)
class Environment {
  constructor(parent = null) {
    this.parent = parent;
    this.values = new Map();
    this.consts = new Set();
  }

  define(name, value, isConst = false) {
    if (this.values.has(name)) {
      throw new Error(`المتغير '${name}' مُعرَّف مسبقاً في هذا النطاق`);
    }
    this.values.set(name, value);
    if (isConst) this.consts.add(name);
    return value;
  }

  // تعريف مع تجاوز (للمعاملات)
  defineLocal(name, value) {
    this.values.set(name, value);
    return value;
  }

  get(name) {
    if (this.values.has(name)) return this.values.get(name);
    if (this.parent) return this.parent.get(name);
    throw new Error(`المتغير '${name}' غير معرّف`);
  }

  has(name) {
    if (this.values.has(name)) return true;
    if (this.parent) return this.parent.has(name);
    return false;
  }

  set(name, value) {
    if (this.values.has(name)) {
      if (this.consts.has(name)) {
        throw new Error(`لا يمكن تعديل الثابت '${name}'`);
      }
      this.values.set(name, value);
      return value;
    }
    if (this.parent) return this.parent.set(name, value);
    throw new Error(`المتغير '${name}' غير معرّف`);
  }

  child() {
    return new Environment(this);
  }
}

module.exports = { Environment };
