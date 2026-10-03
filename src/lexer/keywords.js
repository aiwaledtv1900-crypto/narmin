'use strict';

const KEYWORDS = {
  'اطبع': 'PRINT', 'print': 'PRINT',
  'اذا': 'IF', 'if': 'IF',
  'والا': 'ELSE', 'else': 'ELSE',
  'طالما': 'WHILE', 'while': 'WHILE',
  'لكل': 'FOR', 'for': 'FOR',
  'في': 'IN', 'in': 'IN',
  'استمر': 'CONTINUE', 'continue': 'CONTINUE',
  'اكسر': 'BREAK', 'break': 'BREAK',
  'دالة': 'FUNCTION', 'function': 'FUNCTION',
  'ارجع': 'RETURN', 'return': 'RETURN',
  'انتظر': 'AWAIT', 'await': 'AWAIT',
  'ثابت': 'CONST', 'const': 'CONST',
  'متغير': 'LET', 'let': 'LET',
  'صحيح': 'TRUE', 'true': 'TRUE',
  'خطأ': 'FALSE', 'false': 'FALSE',
  'عدم': 'NULL', 'null': 'NULL',
  'و': 'AND_KW', 'and': 'AND_KW',
  'او': 'OR_KW', 'or': 'OR_KW',
  'ليس': 'NOT_KW', 'not': 'NOT_KW',
  'استورد': 'IMPORT', 'import': 'IMPORT',
  'من': 'FROM', 'from': 'FROM',
  'كـ': 'AS', 'as': 'AS',
  'جرب': 'TRY', 'try': 'TRY',
  'التقط': 'CATCH', 'catch': 'CATCH',
  'اخيرا': 'FINALLY', 'finally': 'FINALLY',
  'ارم': 'THROW', 'throw': 'THROW',
};

function isKeyword(text) {
  return Object.prototype.hasOwnProperty.call(KEYWORDS, text);
}

module.exports = { KEYWORDS, isKeyword };
