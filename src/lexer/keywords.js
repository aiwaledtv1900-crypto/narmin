'use strict';

const KEYWORDS = {
  // التحكم
  'اطبع': 'PRINT', 'print': 'PRINT',
  'اذا': 'IF', 'if': 'IF',
  'والا': 'ELSE', 'else': 'ELSE',
  'طالما': 'WHILE', 'while': 'WHILE',
  'لكل': 'FOR', 'for': 'FOR',
  'في': 'IN', 'in': 'IN',
  'استمر': 'CONTINUE', 'continue': 'CONTINUE',
  'اكسر': 'BREAK', 'break': 'BREAK',
  'نهاية': 'END', 'end': 'END',
  'تعليق': 'COMMENT', 'comment': 'COMMENT',

  // الدوال
  'دالة': 'FUNCTION', 'function': 'FUNCTION',
  'ارجع': 'RETURN', 'return': 'RETURN',
  'انتظر': 'AWAIT', 'await': 'AWAIT',

  // المتغيرات
  'ثابت': 'CONST', 'const': 'CONST',
  'متغير': 'LET', 'let': 'LET',

  // القيم
  'صحيح': 'TRUE', 'true': 'TRUE',
  'خطأ': 'FALSE', 'false': 'FALSE',
  'عدم': 'NULL', 'null': 'NULL',

  // المنطق
  'و': 'AND_KW', 'and': 'AND_KW',
  'او': 'OR_KW', 'or': 'OR_KW',
  'ليس': 'NOT_KW', 'not': 'NOT_KW',

  // الوحدات
  'استورد': 'IMPORT', 'import': 'IMPORT',
  'من': 'FROM', 'from': 'FROM',
  'كـ': 'AS', 'as': 'AS',

  // الأخطاء
  'جرب': 'TRY', 'try': 'TRY',
  'التقط': 'CATCH', 'catch': 'CATCH',
  'اخيرا': 'FINALLY', 'finally': 'FINALLY',
  'ارم': 'THROW', 'throw': 'THROW',

  // واجهات أندرويد
  'شاشة': 'SCREEN', 'screen': 'SCREEN',
  'حالة': 'STATE', 'state': 'STATE',
  'محفوظ': 'SAVED_STATE', 'saved': 'SAVED_STATE',
  'عنوان': 'HEADING', 'heading': 'HEADING',
  'كتابة': 'UI_TEXT', 'uitext': 'UI_TEXT',
  'زر': 'UI_BUTTON', 'button': 'UI_BUTTON',
  'عند_الضغط': 'ON_CLICK', 'onclick': 'ON_CLICK',
  'بطاقة': 'UI_CARD', 'card': 'UI_CARD',
  'حقل': 'UI_TEXTFIELD', 'textfield': 'UI_TEXTFIELD',
  'صورة': 'UI_IMAGE', 'image': 'UI_IMAGE',
  'اختيار': 'UI_CHECKBOX', 'checkbox': 'UI_CHECKBOX',
  'مفتاح': 'UI_SWITCH', 'switch': 'UI_SWITCH',
  'تقدم': 'UI_PROGRESS', 'progress': 'UI_PROGRESS',
  'صف': 'UI_ROW', 'row': 'UI_ROW',
  'مسافة': 'UI_SPACER', 'spacer': 'UI_SPACER',
  'فاصل': 'UI_DIVIDER', 'divider': 'UI_DIVIDER',
  'تمّ': 'UI_DONE', 'done': 'UI_DONE',

  // قوائم
  'قائمة': 'UI_LIST', 'uilist': 'UI_LIST',
  'العنصر': 'ITEM', 'item': 'ITEM',
  'احذف_من': 'REMOVE_FROM', 'removefrom': 'REMOVE_FROM',
  'تبويب': 'TAB_LAYOUT', 'tablayout': 'TAB_LAYOUT',

  // مخرج كوتلن
  'كوتلن': 'KOTLIN_RAW', 'kotlin': 'KOTLIN_RAW',
  'استيراد_كوتلن': 'KOTLIN_IMPORT', 'kotlinimport': 'KOTLIN_IMPORT',
  'مكتبة': 'GRADLE_DEP', 'library': 'GRADLE_DEP',
  'اذن': 'ANDROID_PERMISSION', 'permission': 'ANDROID_PERMISSION',

  // تفاعل Android
  'سنيكر': 'SNACKBAR', 'snackbar': 'SNACKBAR',
  'ورقة': 'BOTTOM_SHEET', 'bottomsheet': 'BOTTOM_SHEET',
  'رابط': 'OPEN_URL', 'openurl': 'OPEN_URL',
  'شارك': 'SHARE_TEXT', 'sharetext': 'SHARE_TEXT',
  'اتصل': 'DIAL', 'dial': 'DIAL',
  'انسخ': 'CLIP_COPY', 'clipcopy': 'CLIP_COPY',
  'أرسل_تنبيه': 'SEND_NOTIFICATION', 'notify': 'SEND_NOTIFICATION',

  // شبكة
  'جلب': 'HTTP_GET', 'fetch': 'HTTP_GET',
  'json': 'JSON_PARSE', 'json_parse': 'JSON_PARSE',
  'صلاحية': 'ANDROID_PERMISSION',
  'لون': 'STYLE_SET', 'color': 'STYLE_SET',
  'بلون': 'WITH_COLOR', 'withcolor': 'WITH_COLOR',
  'الشريط_العلوي': 'UI_TOPBAR', 'topbar': 'UI_TOPBAR',
  'شريط_علوي': 'UI_TOPBAR',
  'حجم': 'STYLE_SIZE', 'size': 'STYLE_SIZE',
  'حواف': 'STYLE_CORNERS',
  'العرض': 'STYLE_WIDTH',
  'الطول': 'STYLE_HEIGHT',
  'نوع': 'STYLE_KIND',
  'كامل': 'FULL_W',
  'تلقائي': 'AUTO_W',
  'مربع': 'SQUARE',
  'دايري': 'CIRCLE',
  'بيضاوي': 'OVAL',
};

// ═══ تطبيع الأحرف الفارسية ═══
function normalizeArabic(text) {
  return String(text)
    .replace(/\u06A9/g, '\u0643')
    .replace(/\u06CC/g, '\u064A');
}

function isKeyword(text) {
  return Object.prototype.hasOwnProperty.call(KEYWORDS, text);
}

function isKeywordNormalized(text) {
  if (isKeyword(text)) return text;
  const normalized = normalizeArabic(text);
  if (isKeyword(normalized)) return normalized;
  return null;
}

module.exports = { KEYWORDS, isKeyword, isKeywordNormalized, normalizeArabic };
