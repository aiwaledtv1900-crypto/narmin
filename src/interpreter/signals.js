'use strict';

// إشارات داخلية للتحكم في التدفق عبر الشجرة
class ReturnSignal {
  constructor(value) { this.value = value; }
}

// إشارة ارم (throw)
class ThrowSignal {
  constructor(value) { this.value = value; }
}

class BreakSignal {}
class ContinueSignal {}

// خطأ نارمين مع معلومات السطر
class NarminError extends Error {
  constructor(message, line, col) {
    super(message);
    this.name = 'NarminError';
    this.line = line;
    this.col = col;
  }
}

module.exports = { ReturnSignal, BreakSignal, ContinueSignal, NarminError, ThrowSignal };
