'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];

// ═══ هل النص مسار صورة؟ ═══
function isImagePath(str) {
  if (!str) return false;
  const s = String(str).trim();
  if (s.length < 4) return false;
  const lower = s.toLowerCase();
  return IMAGE_EXTS.some(ext => lower.endsWith(ext));
}

// ═══ حل المسار (Termux/Android) ═══
function resolveImagePath(p) {
  if (!p) return null;
  let s = String(p).trim();
  if (s.startsWith('file://')) s = s.slice(7);
  if (s.startsWith('/sdcard/')) s = '/storage/emulated/0/' + s.slice(8);
  if (s.startsWith('~/')) s = (process.env.HOME || '') + '/' + s.slice(2);
  return s;
}

// ═══ هل ImageMagick متاح؟ ═══
let _hasConvert = null;
function hasImagemagick() {
  if (_hasConvert !== null) return _hasConvert;
  try {
    execSync('which convert', { stdio: 'ignore' });
    _hasConvert = true;
  } catch (_) {
    _hasConvert = false;
  }
  return _hasConvert;
}

// ═══ معالجة الصورة: نسخ + ضبط الأبعاد ═══
function processImage(sourcePath, destPath) {
  const resolved = resolveImagePath(sourcePath);

  if (!fs.existsSync(resolved)) {
    return { success: false, error: `الملف غير موجود: ${resolved}` };
  }

  const stat = fs.statSync(resolved);
  if (stat.size > 20 * 1024 * 1024) {
    return {
      success: false,
      error: `الصورة كبيرة جداً (${(stat.size / 1024 / 1024).toFixed(1)} MB). الحد 20 MB.`,
    };
  }

  const srcExt = path.extname(resolved).toLowerCase();

  // ═══ مع ImageMagick: ضبط الأبعاد لقناع دائري ═══
  if (hasImagemagick()) {
    const outPng = destPath + '.png';
    try {
      // قصّ مركزي إلى مربع 192×192
      execSync(
        `convert ${JSON.stringify(resolved)} -resize 192x192^ -gravity center -extent 192x192 -quality 95 ${JSON.stringify(outPng)}`,
        { stdio: 'pipe', timeout: 30000 }
      );
      return {
        success: true,
        outputPath: outPng,
        ext: '.png',
        method: 'imagemagick-resize',
      };
    } catch (e) {
      // fallback: نسخ
    }
  }

  // ═══ بلا ImageMagick: نسخ فقط ═══
  const outPath = destPath + srcExt;
  try {
    fs.copyFileSync(resolved, outPath);
    return {
      success: true,
      outputPath: outPath,
      ext: srcExt,
      method: 'copy',
      warning: 'ImageMagick غير مثبت — الصورة ستُنسخ بدون ضبط الأبعاد.\n   للتثبيت: pkg install imagemagick',
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  isImagePath,
  resolveImagePath,
  processImage,
  hasImagemagick,
  IMAGE_EXTS,
};
