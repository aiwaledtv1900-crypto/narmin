'use strict';

const fs = require('fs');
const path = require('path');
const { NodeType: N } = require('../ast/nodes');

const BUILD_MAP = {
  'إصدار': 'Build.VERSION.RELEASE',
  'رقم': 'Build.VERSION.SDK_INT.toString()',
  'موديل': 'Build.MODEL',
  'مصنّع': 'Build.MANUFACTURER',
  'علامة': 'Build.BRAND',
};

function escapeKotlin(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
let THEME = { primary: '#1A237E', accent: '#FFC107', background: '#F5F7FA', heading: '#1A237E', onPrimary: '#FFFFFF' };
let BUTTON_COLOR = null;
let TEXT_COLOR = null;
let BUTTON_TEXT_COLOR = '#FFFFFF';
let STYLES = new Map();
let _colorResolver = null;

function resolveStyleColor(ref) {
  if (!ref) return null;
  // لو موجود في STYLES → احصل على القيمة
  if (STYLES && STYLES.has(ref)) {
    ref = STYLES.get(ref);
  }
  // حوّل الاسم إلى hex
  if (_colorResolver) {
    const hex = _colorResolver(ref);
    if (hex) return hex;
  }
  // لو هو hex مباشر
  if (/^#[0-9A-Fa-f]{6}$/.test(ref)) return ref;
  return null;
}

function cornersToRadius(value, width = null, height = null) {
  if (!value) return '8';
  const v = String(value).trim();
  if (v === 'مربع' || v === 'square') return '0';
  if (v === 'دايري' || v === 'circle') {
    // نصف قطر دائري
    if (width && height) {
      const w = parseInt(width), h = parseInt(height);
      if (!isNaN(w) && !isNaN(h)) return String(Math.round(Math.min(w, h) / 2));
    }
    return '999';
  }
  if (v === 'بيضاوي' || v === 'oval') return '24';
  if (v === 'متوسط' || v === 'medium') return '12';
  if (/^\d+$/.test(v)) return v;
  return '8';
}

function sizeToLayout(value, fallback = 'match_parent') {
  if (!value) return fallback;
  const v = String(value).trim();
  if (v === 'كامل' || v === 'full') return 'match_parent';
  if (v === 'تلقائي' || v === 'auto') return 'wrap_content';
  if (/^\d+$/.test(v)) return v + 'dp';
  return fallback;
}

function propsVal(props, key) {
  if (!props || !props[key]) return null;
  return props[key];
}

function propsColor(props, key) {
  if (!props || !props[key]) return null;
  const val = props[key];
  // إذا كان Identifier → ابحث في STYLES
  if (val.type === 'Identifier' || val.type === 'StringLiteral') {
    return resolveStyleColor(val.value || val.name);
  }
  return resolveStyleColor(staticString(val));
}

function propsSize(props, key, fallback = null) {
  if (!props || !props[key]) return fallback;
  return sizeToLayout(staticString(props[key]), fallback);
}

function propsCorners(props) {
  if (!props || !props.corners) return null;
  return cornersToRadius(staticString(props.corners));
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ═══ جمع الحالة ═══
function collectState(children, state = new Map()) {
  // جمع كل الـ bindings المُعرَّفة
  function collectBindings(items) {
    const bindings = [];
    for (const c of items) {
      if (c.type === N.UI_TEXTFIELD && c.binding) bindings.push(c.binding);
      if (c.children) bindings.push(...collectBindings(c.children));
      if (c.template) bindings.push(...collectBindings(c.template));
      if (c.handler) bindings.push(...collectBindings(c.handler.body || []));
    }
    return bindings;
  }
  const bindingNames = new Set(collectBindings(children));

  // هل هذا المتغير يُستخدم في عملية حسابية؟
  function usedArithmetically(items, name) {
    if (!items) return false;
    if (!Array.isArray(items)) items = [items];
    for (const c of items) {
      if (!c || typeof c !== 'object') continue;
      // هل هي عملية حسابية تستخدم الاسم؟
      if (c.type === N.BINARY && ['+', '-', '*', '/', '%'].includes(c.op)) {
        const leftIsName = c.left && c.left.type === N.IDENTIFIER && c.left.name === name;
        const rightIsName = c.right && c.right.type === N.IDENTIFIER && c.right.name === name;
        if (leftIsName || rightIsName) {
          const other = leftIsName ? c.right : c.left;
          if (other && other.type === N.NUMBER) return true;
          if (other && other.type === N.IDENTIFIER && state.has(other.name)) {
            const ot = state.get(other.name).type;
            if (ot === 'Double') return true;
          }
        }
      }
      // walk كل الحقول
      for (const key of Object.keys(c)) {
        const v = c[key];
        if (Array.isArray(v)) {
          if (usedArithmetically(v, name)) return true;
        } else if (v && typeof v === 'object' && v.type) {
          if (usedArithmetically([v], name)) return true;
        }
      }
    }
    return false;
  }

  for (const child of children) {
    if (child.type === N.STATE_DECL) {
      let type = 'String', init = '""', isList = false;
      if (child.init.type === N.NUMBER) {
        type = 'Double';
        init = String(child.init.value) + '.0';
      } else if (child.init.type === N.STRING) {
        type = 'String';
        init = '"' + child.init.value.replace(/"/g, '\\"') + '"';
      } else if (child.init.type === N.BOOLEAN) {
        type = 'Boolean';
        init = child.init.value ? 'true' : 'false';
      } else if (child.init.type === N.ARRAY) {
        type = 'MutableList<String>';
        isList = true;
        const elems = child.init.elements.map((e) =>
          e.type === N.STRING ? '"' + e.value.replace(/"/g, '\\"') + '"' :
          e.type === N.NUMBER ? String(e.value) : '""'
        ).join(', ');
        init = `mutableListOf(${elems})`;
      }
      state.set(child.name, { type, init, persistent: !!child.persistent, isList });
    }
    if (child.type === N.UI_TEXTFIELD && child.binding) {
      if (!state.has(child.binding)) {
        // كشف النوع من السياق
        const isNum = usedArithmetically(children, child.binding);
        if (isNum) {
          state.set(child.binding, { type: 'Double', init: '0.0', persistent: false });
        } else {
          state.set(child.binding, { type: 'String', init: '""', persistent: false });
        }
      }
    }
    if (child.children) collectState(child.children, state);
  }
  return state;
}

function hasStateRef(node, stateVars) {
  if (!node) return false;
  if (node.type === N.IDENTIFIER) return stateVars.has(node.name);
  if (node.type === N.BINARY) return hasStateRef(node.left, stateVars) || hasStateRef(node.right, stateVars);
  if (node.type === N.CALL) return node.args.some((a) => hasStateRef(a, stateVars));
  if (node.type === N.MEMBER) return hasStateRef(node.object, stateVars);
  return false;
}

// ═══ تعبير → Kotlin (مع وعي بالحالة) ═══
function exprToKotlin(node, stateVars, localVars = null) {
  if (!node) return '""';
  switch (node.type) {
    case N.STRING: return '"' + escapeKotlin(node.value) + '"';
    case N.NUMBER: return String(node.value);
    case N.BOOLEAN: return node.value ? 'true' : 'false';
    case N.NULL: return 'null';
    case N.IDENTIFIER:
      if (stateVars && stateVars.has(node.name)) return 'STATE_' + node.name;
      return node.name;
    case N.BINARY: {
      const L = exprToKotlin(node.left, stateVars);
      const R = exprToKotlin(node.right, stateVars);
      return `(${L} ${node.op} ${R})`;
    }
    case N.MEMBER: {
      const obj = node.object;
      if (obj.type === N.IDENTIFIER && obj.name === 'build') {
        return BUILD_MAP[node.property] || `Build.${node.property}`;
      }
      if (obj.type === N.CALL && obj.callee.type === N.IDENTIFIER && obj.callee.name === 'جلب') {
        return `(${exprToKotlin(obj, stateVars, localVars)})["${node.property}"] as? Boolean ?: (${exprToKotlin(obj, stateVars, localVars)})["${node.property}"]`;
      }
      if (obj.type === N.IDENTIFIER && localVars && localVars.get(obj.name) === 'http') {
        return `((${obj.name}) as MutableMap<String, Any>)["${node.property}"]`;
      }
      if (obj.type === N.IDENTIFIER && stateVars && stateVars.has(obj.name)) {
        return `STATE_${obj.name}.${node.property}`;
      }
      if (obj.type === N.IDENTIFIER) {
        return `((${obj.name}) as MutableMap<String, Any>)["${node.property}"]`;
      }
      return `${exprToKotlin(obj, stateVars, localVars)}.${node.property}`;
    }
    case N.INDEX: {
      const obj = node.object;
      const idx = node.index;
      // رد["نجح"] → (رد as MutableMap<String, Any>)["نجح"]
      if (obj.type === N.IDENTIFIER && idx.type === N.STRING) {
        return `((${obj.name}) as MutableMap<String, Any>)["${idx.value}"]`;
      }
      return `${exprToKotlin(obj, stateVars, localVars)}[${exprToKotlin(idx, stateVars, localVars)}]`;
    }
    case N.CALL: {
      if (node.callee.type === N.IDENTIFIER && node.callee.name === 'جلب') {
        const url = exprToKotlin(node.args[0], stateVars);
        return `httpGet((${url}).toString())`;
      }
      if (node.callee.type === N.IDENTIFIER && node.callee.name === 'نص') {
        return `(${exprToKotlin(node.args[0], stateVars)}).toString()`;
      }
      if (node.callee.type === N.IDENTIFIER && node.callee.name === 'نسّق') {
        return `formatNumber(${exprToKotlin(node.args[0], stateVars)})`;
      }
if (node.callee.name === 'طول') {
          return `${exprToKotlin(node.args[0], stateVars)}.size`;
        }
        if (node.callee.name === 'استبعد') {
          const list = exprToKotlin(node.args[0], stateVars);
          const pred = node.args[1];
          if (pred && pred.type === N.FUNCTION) {
            const param = pred.params[0] || 'س';
            const body = pred.body.body;
            if (body.length > 0 && body[0].type === N.RETURN) {
              const ret = body[0].arg;
              if (ret && ret.type === N.CALL && ret.callee.name === 'يبدأ_بـ') {
                const inner = exprToKotlin(ret.args[0], stateVars);
                const prefix = exprToKotlin(ret.args[1], stateVars);
                return `${list}.removeAll { ${param} -> ${inner}.startsWith(${prefix}) }`;
              }
            }
          }
          return `${list}`;
        }
        if (node.callee.name === 'يبدأ_بـ') {
          return `${exprToKotlin(node.args[0], stateVars)}.startsWith(${exprToKotlin(node.args[1], stateVars)})`;
        }
              if (node.callee.type === N.IDENTIFIER && node.callee.name === 'أضف') {
        return `${exprToKotlin(node.args[0], stateVars)}.add(${exprToKotlin(node.args[1], stateVars)})`;
      }
      if (node.callee.type === N.IDENTIFIER && node.callee.name === 'احذف_من') {
        return `${exprToKotlin(node.args[0], stateVars)}.remove(${exprToKotlin(node.args[1], stateVars)})`;
      }
      const args = node.args.map((a) => exprToKotlin(a, stateVars)).join(', ');
      return `${exprToKotlin(node.callee, stateVars)}(${args})`;
    }
    case N.IF_EXPR: {
      const test = exprToKotlin(node.test, stateVars);
      const cons = node.consequent.body.length
        ? exprToKotlin(node.consequent.body[node.consequent.body.length - 1].expr, stateVars)
        : '""';
      const alt = node.alternate && node.alternate.body.length
        ? exprToKotlin(node.alternate.body[node.alternate.body.length - 1].expr, stateVars)
        : '""';
      return `(if (${test}) ${cons} else ${alt})`;
    }
    default: return `"" /* ${node.type} */`;
  }
}

function staticString(node) {
  if (!node) return '';
  if (node.type === N.STRING) return node.value;
  if (node.type === N.NUMBER) return String(node.value);
  if (node.type === N.BOOLEAN) return node.value ? 'true' : 'false';
  if (node.type === N.BINARY && node.op === '+') {
    return staticString(node.left) + staticString(node.right);
  }
  return '';
}

// ═══ معالج الحدث ═══
function handlerToKotlin(block, indent, stateVars, parentLocalVars = null) {
  const lines = [];
  // متتبّع المتغيرات المحلية: اسم → نوع
  const LOCAL_VARS = parentLocalVars || new Map();
  for (const stmt of block.body) {
    if (stmt.type === N.KOTLIN_RAW) {
      lines.push(`${indent}${stmt.code}`);
    } else if (stmt.type === N.PRINT) {
      lines.push(`${indent}android.util.Log.d("narmin", ${exprToKotlin(stmt.arg, stateVars, LOCAL_VARS)})`);
    } else if (stmt.type === N.ASSIGN) {
      if (stmt.target.type === N.IDENTIFIER && stateVars.has(stmt.target.name)) {
        const info = stateVars.get(stmt.target.name);
        const t = info.type;
        let value = exprToKotlin(stmt.value, stateVars, LOCAL_VARS);
        if (t === 'Double') value = `(${value}).toDouble()`;
        else if (t === 'String') value = `(${value}).toString()`;
        else if (t === 'Boolean') value = `(${value}) as Boolean`;
        lines.push(`${indent}STATE_${stmt.target.name} = ${value}`);
        if (info.persistent) {
          lines.push(`${indent}savePref("${stmt.target.name}", STATE_${stmt.target.name})`);
        }
      } else {
        lines.push(`${indent}${exprToKotlin(stmt.target, stateVars, LOCAL_VARS)} = ${exprToKotlin(stmt.value, stateVars, LOCAL_VARS)}`);
      }
    } else if (stmt.type === N.LET || stmt.type === N.CONST) {
      // متغير محلي داخل المعالج
      const keyword = stmt.type === N.CONST ? 'val' : 'var';
      if (stmt.init) {
        // إذا كان httpGet → احفظ النوع
        if (stmt.init.type === N.CALL && stmt.init.callee.type === N.IDENTIFIER && stmt.init.callee.name === 'جلب') {
          LOCAL_VARS.set(stmt.name, 'http');
          lines.push(`${indent}${keyword} ${stmt.name} = httpGet((${exprToKotlin(stmt.init.args[0], stateVars, LOCAL_VARS)}).toString())`);
        } else {
          const value = exprToKotlin(stmt.init, stateVars, LOCAL_VARS);
          lines.push(`${indent}${keyword} ${stmt.name} = ${value}`);
        }
      } else {
        lines.push(`${indent}${keyword} ${stmt.name}: Any? = null`);
      }
    } else if (stmt.type === N.EXPR_STMT) {
      lines.push(`${indent}${exprToKotlin(stmt.expr, stateVars, LOCAL_VARS)}`);
    } else if (stmt.type === N.IF) {
      let test = exprToKotlin(stmt.test, stateVars, LOCAL_VARS);
      // إذا كان الاختبار MEMBER (وصول لخريطة) → قارنه بـ true
      if (stmt.test.type === N.MEMBER || test.includes('["')) {
        test = `(${test} == true)`;
      }
      lines.push(`${indent}if (${test}) {`);
      lines.push(handlerToKotlin(stmt.consequent, indent + '    ', stateVars, LOCAL_VARS));
      if (stmt.alternate) {
        lines.push(`${indent}} else {`);
        lines.push(handlerToKotlin(stmt.alternate, indent + '    ', stateVars, LOCAL_VARS));
      }
      lines.push(`${indent}}`);
    } else if (stmt.type === N.NAVIGATE) {
      const target = stmt.target;
      const info = CURRENT_SCREEN_MAP && CURRENT_SCREEN_MAP.get(target);
      const cls = info ? info.cls : (target.replace(/[^a-zA-Z0-9]/g, '') || 'Screen') + 'Activity';
      lines.push(`${indent}startActivity(android.content.Intent(this, ${cls}::class.java))`);
    } else if (stmt.type === N.TOAST) {
      lines.push(`${indent}android.widget.Toast.makeText(this, ${exprToKotlin(stmt.text, stateVars, LOCAL_VARS)}.toString(), android.widget.Toast.LENGTH_SHORT).show()`);
    } else if (stmt.type === N.ALERT) {
      lines.push(`${indent}androidx.appcompat.app.AlertDialog.Builder(this)`);
      lines.push(`${indent}    .setTitle(${exprToKotlin(stmt.title, stateVars, LOCAL_VARS)}.toString())`);
      lines.push(`${indent}    .setMessage(${exprToKotlin(stmt.message, stateVars, LOCAL_VARS)}.toString())`);
      lines.push(`${indent}    .setPositiveButton("حسناً") { _, _ ->`);
      if (stmt.handler) {
        lines.push(handlerToKotlin(stmt.handler, indent + '        ', stateVars));
      }
      lines.push(`${indent}    }`);
      lines.push(`${indent}    .setNegativeButton("إلغاء", null)`);
      lines.push(`${indent}    .show()`);
    } else if (stmt.type === N.BACK) {
      lines.push(`${indent}finish()`);
    } else if (stmt.type === N.SNACKBAR) {
      const text = exprToKotlin(stmt.text, stateVars, LOCAL_VARS);
      lines.push(`${indent}com.google.android.material.snackbar.Snackbar.make(findViewById(android.R.id.content), ${text}.toString(), com.google.android.material.snackbar.Snackbar.LENGTH_SHORT).show()`);
    } else if (stmt.type === N.OPEN_URL) {
      const url = exprToKotlin(stmt.url, stateVars, LOCAL_VARS);
      lines.push(`${indent}startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(${url}.toString())))`);
    } else if (stmt.type === N.SHARE_TEXT) {
      const text = exprToKotlin(stmt.text, stateVars, LOCAL_VARS);
      lines.push(`${indent}run {`);
      lines.push(`${indent}    val sendIntent = android.content.Intent().apply {`);
      lines.push(`${indent}        action = android.content.Intent.ACTION_SEND`);
      lines.push(`${indent}        putExtra(android.content.Intent.EXTRA_TEXT, ${text}.toString())`);
      lines.push(`${indent}        type = "text/plain"`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}    startActivity(android.content.Intent.createChooser(sendIntent, "شارك عبر"))`);
      lines.push(`${indent}}`);
    } else if (stmt.type === N.DIAL) {
      const phone = exprToKotlin(stmt.phone, stateVars, LOCAL_VARS);
      lines.push(`${indent}startActivity(android.content.Intent(android.content.Intent.ACTION_DIAL, android.net.Uri.parse("tel:" + ${phone}.toString())))`);
    } else if (stmt.type === N.CLIP_COPY) {
      const text = exprToKotlin(stmt.text, stateVars, LOCAL_VARS);
      lines.push(`${indent}run {`);
      lines.push(`${indent}    val clipboard = getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager`);
      lines.push(`${indent}    clipboard.setPrimaryClip(android.content.ClipData.newPlainText("narmin", ${text}.toString()))`);
      lines.push(`${indent}    android.widget.Toast.makeText(this, "تم النسخ", android.widget.Toast.LENGTH_SHORT).show()`);
      lines.push(`${indent}}`);
    } else if (stmt.type === N.SEND_NOTIFICATION) {
      const title = exprToKotlin(stmt.title, stateVars, LOCAL_VARS);
      const body = exprToKotlin(stmt.body, stateVars, LOCAL_VARS);
      lines.push(`${indent}run {`);
      lines.push(`${indent}    val nm = getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager`);
      lines.push(`${indent}    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {`);
      lines.push(`${indent}        val ch = android.app.NotificationChannel("narmin_ch", "Narmin", android.app.NotificationManager.IMPORTANCE_DEFAULT)`);
      lines.push(`${indent}        nm.createNotificationChannel(ch)`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}    val notif = androidx.core.app.NotificationCompat.Builder(this, "narmin_ch")`);
      lines.push(`${indent}        .setSmallIcon(android.R.drawable.ic_dialog_info)`);
      lines.push(`${indent}        .setContentTitle(${title}.toString())`);
      lines.push(`${indent}        .setContentText(${body}.toString())`);
      lines.push(`${indent}        .setPriority(androidx.core.app.NotificationCompat.PRIORITY_DEFAULT)`);
      lines.push(`${indent}        .build()`);
      lines.push(`${indent}    if (android.os.Build.VERSION.SDK_INT >= 33) {`);
      lines.push(`${indent}        if (androidx.core.app.ActivityCompat.checkSelfPermission(this, "android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {`);
      lines.push(`${indent}            androidx.core.app.ActivityCompat.requestPermissions(this, arrayOf("android.permission.POST_NOTIFICATIONS"), 1)`);
      lines.push(`${indent}        } else { nm.notify(1, notif) }`);
      lines.push(`${indent}    } else { nm.notify(1, notif) }`);
      lines.push(`${indent}}`);
    }
  }
  lines.push(`${indent}updateUI()`);
  return lines.join('\n');
}

// ═══ XML ═══
let idCounter = 0;
let CURRENT_SCREEN_MAP = null; // خريطة اسم عربي → اسم فئة
let BINDING_TYPES = null; // خريطة اسم حالة → معلوماتها
function nextId() { idCounter++; return `view_${idCounter}`; }

function buildXml(children, indent = '        ') {
  const lines = [];
  for (const child of children) {
    if (child.type === N.STATE_DECL) continue;
    if (child.type === N.UI_HEADING) {
      const id = nextId();
      const customColor = resolveStyleColor(child.colorRef);
      const textColor = customColor || TEXT_COLOR || THEME.heading;
      lines.push(`${indent}<TextView`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="wrap_content"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:text="${escapeXml(staticString(child.text))}"`);
      lines.push(`${indent}    android:textColor="${textColor}"`);
      lines.push(`${indent}    android:textSize="32sp"`);
      lines.push(`${indent}    android:textStyle="bold"`);
      lines.push(`${indent}    android:layout_marginTop="8dp"`);
      lines.push(`${indent}    android:layout_marginBottom="16dp" />`);
      child._id = id;
    } else if (child.type === N.UI_TEXT) {
      const id = nextId();
      const customColor = resolveStyleColor(child.colorRef);
      const textColor = customColor || TEXT_COLOR || THEME.onSurface || '#212121';
      lines.push(`${indent}<TextView`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:text="${escapeXml(staticString(child.expr))}"`);
      lines.push(`${indent}    android:textColor="${textColor}"`);
      lines.push(`${indent}    android:textSize="16sp"`);
      lines.push(`${indent}    android:layout_marginTop="8dp"`);
      lines.push(`${indent}    android:layout_marginBottom="8dp" />`);
      child._id = id;
    } else if (child.type === N.UI_BUTTON) {
      const id = nextId();
      const customColor = propsColor(child.props, 'color') || resolveStyleColor(child.colorRef);
      const btnBg = customColor || BUTTON_COLOR || THEME.primary;
      const corners = propsCorners(child.props) || '8';
      const width = propsSize(child.props, 'width', 'match_parent');
      const height = propsSize(child.props, 'height', '56dp');
      lines.push(`${indent}<com.google.android.material.button.MaterialButton`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="${width}"`);
      lines.push(`${indent}    android:layout_height="${height}"`);
      lines.push(`${indent}    android:text="${escapeXml(staticString(child.text))}"`);
      lines.push(`${indent}    android:textSize="16sp"`);
      lines.push(`${indent}    android:textColor="${BUTTON_TEXT_COLOR}"`);
      lines.push(`${indent}    android:layout_marginTop="16dp"`);
      lines.push(`${indent}    app:backgroundTint="${btnBg}"`);
      lines.push(`${indent}    app:cornerRadius="${corners}dp" />`);
      child._id = id;
    } else if (child.type === N.UI_CARD) {
      const title = staticString(child.title);
      const customColor = propsColor(child.props, 'color');
      const cardBg = customColor || '#FFFFFF';
      const corners = propsCorners(child.props) || '12';
      const width = propsSize(child.props, 'width', 'match_parent');
      lines.push(`${indent}<com.google.android.material.card.MaterialCardView`);
      lines.push(`${indent}    android:layout_width="${width}"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:layout_marginTop="16dp"`);
      lines.push(`${indent}    app:cardCornerRadius="${corners}dp"`);
      lines.push(`${indent}    app:cardElevation="2dp">`);
      lines.push('');
      lines.push(`${indent}    <LinearLayout`);
      lines.push(`${indent}        android:layout_width="match_parent"`);
      lines.push(`${indent}        android:layout_height="wrap_content"`);
      lines.push(`${indent}        android:orientation="vertical"`);
      lines.push(`${indent}        android:padding="16dp">`);
      lines.push('');
      if (title) {
        lines.push(`${indent}        <TextView`);
        lines.push(`${indent}            android:layout_width="wrap_content"`);
        lines.push(`${indent}            android:layout_height="wrap_content"`);
        lines.push(`${indent}            android:text="${escapeXml(title)}"`);
        lines.push(`${indent}            android:textColor="${TEXT_COLOR || THEME.heading}"`);
        lines.push(`${indent}            android:textSize="18sp"`);
        lines.push(`${indent}            android:textStyle="bold" />`);
        lines.push('');
      }
      lines.push(buildXml(child.children, indent + '        '));
      lines.push(`${indent}    </LinearLayout>`);
      lines.push(`${indent}</com.google.android.material.card.MaterialCardView>`);
      child._id = nextId();
    } else if (child.type === N.UI_TEXTFIELD) {
      const id = nextId();
      const customColor = propsColor(child.props, 'color');
      const strokeColor = customColor || THEME.primary;
      const corners = propsCorners(child.props) || '8';
      const width = propsSize(child.props, 'width', 'match_parent');
      let inputType = 'text';
      if (child.binding && BINDING_TYPES && BINDING_TYPES.has(child.binding)) {
        const t = BINDING_TYPES.get(child.binding).type;
        if (t === 'Double') inputType = 'numberDecimal';
      }
      lines.push(`${indent}<com.google.android.material.textfield.TextInputLayout`);
      lines.push(`${indent}    android:layout_width="${width}"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:hint="${escapeXml(staticString(child.hint))}"`);
      lines.push(`${indent}    android:layout_marginTop="12dp"`);
      lines.push(`${indent}    app:boxStrokeColor="${strokeColor}"`);
      lines.push(`${indent}    app:boxStrokeWidth="2dp"`);
      lines.push(`${indent}    app:boxCornerRadiusTopStart="${corners}dp"`);
      lines.push(`${indent}    app:boxCornerRadiusTopEnd="${corners}dp"`);
      lines.push(`${indent}    app:boxCornerRadiusBottomStart="${corners}dp"`);
      lines.push(`${indent}    app:boxCornerRadiusBottomEnd="${corners}dp">`);
      lines.push('');
      lines.push(`${indent}    <com.google.android.material.textfield.TextInputEditText`);
      lines.push(`${indent}        android:id="@+id/${id}"`);
      lines.push(`${indent}        android:layout_width="match_parent"`);
      lines.push(`${indent}        android:layout_height="wrap_content"`);
      lines.push(`${indent}        android:textSize="16sp"`);
      lines.push(`${indent}        android:inputType="${inputType}" />`);
      lines.push(`${indent}</com.google.android.material.textfield.TextInputLayout>`);
      child._id = id;
    } else if (child.type === N.UI_IMAGE) {
      const id = nextId();
      const name = staticString(child.name) || 'ic_menu_info_details';
      const srcAttr = name.startsWith('@') ? name : `@android:drawable/${name}`;
      lines.push(`${indent}<ImageView`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="80dp"`);
      lines.push(`${indent}    android:layout_height="80dp"`);
      lines.push(`${indent}    android:src="${escapeXml(srcAttr)}"`);
      lines.push(`${indent}    android:layout_gravity="center_horizontal"`);
      lines.push(`${indent}    android:layout_marginTop="16dp"`);
      lines.push(`${indent}    android:layout_marginBottom="16dp"`);
      lines.push(`${indent}    android:contentDescription="${escapeXml(name)}" />`);
      child._id = id;
    } else if (child.type === N.UI_CHECKBOX) {
      const id = nextId();
      lines.push(`${indent}<com.google.android.material.checkbox.MaterialCheckBox`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:text="${escapeXml(staticString(child.text))}"`);
      lines.push(`${indent}    android:textSize="16sp"`);
      lines.push(`${indent}    android:textColor="${TEXT_COLOR || THEME.onSurface || '#212121'}"`);
      lines.push(`${indent}    android:layout_marginTop="8dp"`);
      lines.push(`${indent}    android:buttonTint="${THEME.primary}" />`);
      child._id = id;
    } else if (child.type === N.UI_SWITCH) {
      const id = nextId();
      lines.push(`${indent}<com.google.android.material.materialswitch.MaterialSwitch`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:text="${escapeXml(staticString(child.text))}"`);
      lines.push(`${indent}    android:textSize="16sp"`);
      lines.push(`${indent}    android:textColor="${TEXT_COLOR || THEME.onSurface || '#212121'}"`);
      lines.push(`${indent}    android:layout_marginTop="8dp" />`);
      child._id = id;
    } else if (child.type === N.UI_PROGRESS) {
      const id = nextId();
      lines.push(`${indent}<ProgressBar`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    style="?android:attr/progressBarStyleHorizontal"`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:max="100"`);
      lines.push(`${indent}    android:progress="${escapeXml(staticString(child.value) || '0')}"`);
      lines.push(`${indent}    android:progressTint="${THEME.primary}"`);
      lines.push(`${indent}    android:layout_marginTop="16dp"`);
      lines.push(`${indent}    android:layout_marginBottom="16dp" />`);
      child._id = id;
    } else if (child.type === N.UI_SPACER) {
      const size = staticString(child.size) || '16';
      lines.push(`${indent}<Space`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="${escapeXml(size)}dp" />`);
    } else if (child.type === N.UI_DIVIDER) {
      lines.push(`${indent}<View`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="1dp"`);
      lines.push(`${indent}    android:background="#E0E0E0"`);
      lines.push(`${indent}    android:layout_marginTop="12dp"`);
      lines.push(`${indent}    android:layout_marginBottom="12dp" />`);
    } else if (child.type === N.UI_TOPBAR) {
      const id = nextId();
      const bgColor = (child.props.color ? resolveStyleColor(staticString(child.props.color)) : null) || THEME.primary;
      const txtColor = '#FFFFFF';
      const sizeNum = child.props.size ? staticString(child.props.size) : '60';
      const textVal = child.props.text ? staticString(child.props.text) : '';
      lines.push(`${indent}<LinearLayout`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="${sizeNum}dp"`);
      lines.push(`${indent}    android:background="${bgColor}"`);
      lines.push(`${indent}    android:gravity="center_vertical|start"`);
      lines.push(`${indent}    android:paddingHorizontal="16dp"`);
      lines.push(`${indent}    android:layout_marginBottom="12dp">`);
      lines.push('');
      lines.push(`${indent}    <TextView`);
      lines.push(`${indent}        android:layout_width="wrap_content"`);
      lines.push(`${indent}        android:layout_height="wrap_content"`);
      lines.push(`${indent}        android:text="${escapeXml(textVal)}"`);
      lines.push(`${indent}        android:textColor="${txtColor}"`);
      lines.push(`${indent}        android:textSize="20sp"`);
      lines.push(`${indent}        android:textStyle="bold" />`);
      lines.push(`${indent}</LinearLayout>`);
    } else if (child.type === N.UI_ROW) {
      lines.push(`${indent}<LinearLayout`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:orientation="horizontal"`);
      lines.push(`${indent}    android:layout_marginTop="8dp">`);
      lines.push('');
      lines.push(buildXml(child.children, indent + '    '));
      lines.push(`${indent}</LinearLayout>`);
    } else if (child.type === N.UI_LIST) {
      const id = nextId();
      lines.push(`${indent}<LinearLayout`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:orientation="vertical"`);
      lines.push(`${indent}    android:layout_marginTop="8dp" />`);
      child._id = id;
    } else if (child.type === N.TAB_LAYOUT) {
      const id = nextId();
      lines.push(`${indent}<com.google.android.material.tabs.TabLayout`);
      lines.push(`${indent}    android:id="@+id/${id}"`);
      lines.push(`${indent}    android:layout_width="match_parent"`);
      lines.push(`${indent}    android:layout_height="wrap_content"`);
      lines.push(`${indent}    android:layout_marginTop="8dp"`);
      lines.push(`${indent}    android:layout_marginBottom="8dp"`);
      lines.push(`${indent}    app:tabIndicatorColor="${THEME.primary}"`);
      lines.push(`${indent}    app:tabSelectedTextColor="${THEME.primary}"`);
      lines.push(`${indent}    app:tabTextColor="#757575" />`);
      child._id = id;
    }
  }
  return lines.join('\n');
}

// ═══ Kotlin Body ═══
function buildKotlinBody(children, indent, stateVars) {
  const lines = [];
  for (const child of children) {
    if (child.type === N.STATE_DECL) continue;
    if (child.type === N.UI_BUTTON) {
      lines.push(`${indent}findViewById<com.google.android.material.button.MaterialButton>(R.id.${child._id}).setOnClickListener {`);
      lines.push(handlerToKotlin(child.handler, indent + '    ', stateVars));
      lines.push(`${indent}}`);
    } else if (child.type === N.UI_TEXTFIELD && child.binding) {
      const info = stateVars.get(child.binding);
      const t = info.type;
      let convert;
      if (t === 'Double') convert = `(s?.toString()?.toDoubleOrNull() ?: 0.0)`;
      else if (t === 'Boolean') convert = `(s?.toString()?.toBoolean() ?: false)`;
      else convert = `(s?.toString() ?: "")`;
      lines.push(`${indent}findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.${child._id}).addTextChangedListener(object : android.text.TextWatcher {`);
      lines.push(`${indent}    override fun afterTextChanged(s: android.text.Editable?) {`);
      lines.push(`${indent}        STATE_${child.binding} = ${convert}`);
      if (info.persistent) {
        lines.push(`${indent}        savePref("${child.binding}", STATE_${child.binding})`);
      }
      lines.push(`${indent}        updateUI()`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}    override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}`);
      lines.push(`${indent}    override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) {}`);
      lines.push(`${indent}})`);
    } else if (child.type === N.UI_CARD || child.type === N.UI_ROW) {
      const inner = buildKotlinBody(child.children, indent, stateVars);
      if (inner) lines.push(inner);
    } else if (child.type === N.KOTLIN_RAW) {
      lines.push(`${indent}${child.code}`);
    } else if (child.type === N.TAB_LAYOUT) {
      lines.push(`${indent}run {`);
      lines.push(`${indent}    val tabLayout = findViewById<com.google.android.material.tabs.TabLayout>(R.id.${child._id})`);
      for (const tab of child.tabs) {
        const tabText = staticString(tab) || 'تبويب';
        lines.push(`${indent}    tabLayout.addTab(tabLayout.newTab().setText("${escapeXml(tabText)}"))`);
      }
      lines.push(`${indent}}`);
    }
  }
  return lines.filter(Boolean).join('\n');
}

// ═══ بناء عناصر القائمة ديناميكياً ═══
function buildListItemKotlin(template, stateVars, itemVar = 'العنصر', indent = '            ') {
  // نبني Kotlin يُنشئ Views لعنصر واحد داخل linearLayout
  const lines = [];
  for (const child of template) {
    if (child.type === N.UI_TEXT || child.type === N.UI_HEADING) {
      const expr = child.type === N.UI_HEADING ? child.text : child.expr;
      const kt = exprToKotlin(expr, stateVars);
      lines.push(`${indent}val ${'tv_' + Math.random().toString(36).slice(2, 8)} = android.widget.TextView(this).apply {`);
      lines.push(`${indent}    text = ${kt}`);
      lines.push(`${indent}    textSize = 16f`);
      lines.push(`${indent}    setTextColor(android.graphics.Color.parseColor("#212121"))`);
      lines.push(`${indent}    setPadding(16, 16, 16, 16)`);
      lines.push(`${indent}}`);
      // استخرجنا الاسم من closure — نحتاج نحفظه
      // الأسطر السابقة بنت متغيراً بدون حفظ الاسم. نُبسّط: نستخدم الأسلوب المباشر
    }
  }
  return lines;
}

// نسخة أنظف: نبني العنصر كاملاً كسلسلة Kotlin
function buildListItemBody(template, stateVars, itemVarName, indent = '                ') {
  const lines = [];
  const hasText = template.some(c => c.type === N.UI_TEXT || c.type === N.UI_HEADING);
  const hasButton = template.some(c => c.type === N.UI_BUTTON);
  const asRow = hasText && hasButton;

  // بطاقة لكل عنصر
  lines.push(`${indent}val card = com.google.android.material.card.MaterialCardView(this)`);
  lines.push(`${indent}val cardLp = android.widget.LinearLayout.LayoutParams(`);
  lines.push(`${indent}    android.widget.LinearLayout.LayoutParams.MATCH_PARENT,`);
  lines.push(`${indent}    android.widget.LinearLayout.LayoutParams.WRAP_CONTENT`);
  lines.push(`${indent})`);
  lines.push(`${indent}cardLp.setMargins(0, 6, 0, 6)`);
  lines.push(`${indent}card.layoutParams = cardLp`);
  lines.push(`${indent}card.radius = 24f`);
  lines.push(`${indent}card.cardElevation = 4f`);
  lines.push(`${indent}card.setCardBackgroundColor(android.graphics.Color.WHITE)`);

  // الحاوية الداخلية
  lines.push(`${indent}val inner = android.widget.LinearLayout(this).apply {`);
  if (asRow) {
    lines.push(`${indent}    orientation = android.widget.LinearLayout.HORIZONTAL`);
  } else {
    lines.push(`${indent}    orientation = android.widget.LinearLayout.VERTICAL`);
  }
  lines.push(`${indent}    setPadding(40, 40, 40, 40)`);
  lines.push(`${indent}    gravity = android.view.Gravity.CENTER_VERTICAL`);
  lines.push(`${indent}}`);

  for (const child of template) {
    if (child.type === N.UI_DONE) {
      // CheckBox للإتمام
      lines.push(`${indent}val cbItem = com.google.android.material.checkbox.MaterialCheckBox(this).apply {`);
      lines.push(`${indent}    isChecked = ${itemVarName}.startsWith("✓ ")`);
      lines.push(`${indent}    setOnCheckedChangeListener { _, checked ->`);
      lines.push(`${indent}        val idx = STATE_مهام.indexOf(${itemVarName})`);
      lines.push(`${indent}        if (idx >= 0) {`);
      lines.push(`${indent}            if (checked && !${itemVarName}.startsWith("✓ ")) {`);
      lines.push(`${indent}                STATE_مهام[idx] = "✓ " + ${itemVarName}`);
      lines.push(`${indent}            } else if (!checked && ${itemVarName}.startsWith("✓ ")) {`);
      lines.push(`${indent}                STATE_مهام[idx] = ${itemVarName}.substring(2)`);
      lines.push(`${indent}            }`);
      lines.push(`${indent}            savePref("مهام", STATE_مهام)`);
      lines.push(`${indent}            updateUI()`);
      lines.push(`${indent}        }`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}}`);
      lines.push(`${indent}inner.addView(cbItem)`);
    } else if (child.type === N.UI_TEXT || child.type === N.UI_HEADING) {
      const kt = exprToKotlin(child.expr || child.text, stateVars);
      lines.push(`${indent}val tvItem = android.widget.TextView(this).apply {`);
      lines.push(`${indent}    text = ${kt}.replace("✓ ", "")`);
      lines.push(`${indent}    textSize = 17f`);
      lines.push(`${indent}    setTextColor(android.graphics.Color.parseColor("#212121"))`);
      lines.push(`${indent}    if (${itemVarName}.startsWith("✓ ")) {`);
      lines.push(`${indent}        paintFlags = paintFlags or android.graphics.Paint.STRIKE_THRU_TEXT_FLAG`);
      lines.push(`${indent}        setTextColor(android.graphics.Color.parseColor("#9E9E9E"))`);
      lines.push(`${indent}    }`);
      if (asRow) {
        lines.push(`${indent}    layoutParams = android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f)`);
      }
      lines.push(`${indent}}`);
      lines.push(`${indent}inner.addView(tvItem)`);
    } else if (child.type === N.UI_BUTTON) {
      const ktText = exprToKotlin(child.text, stateVars);
      lines.push(`${indent}val btnItem = com.google.android.material.button.MaterialButton(this).apply {`);
      lines.push(`${indent}    text = ${ktText}`);
      lines.push(`${indent}    textSize = 14f`);
      lines.push(`${indent}    setTextColor(android.graphics.Color.WHITE)`);
      lines.push(`${indent}    setBackgroundColor(android.graphics.Color.parseColor("#E53935"))`);
      lines.push(`${indent}    setPadding(30, 0, 30, 0)`);
      lines.push(`${indent}}`);
      lines.push(`${indent}btnItem.setOnClickListener {`);
      for (const stmt of child.handler.body) {
        if (stmt.type === N.KOTLIN_RAW) {
          lines.push(`${indent}    ${stmt.code}`);
        } else if (stmt.type === N.EXPR_STMT && stmt.expr.type === N.CALL) {
          if (stmt.expr.callee.name === 'احذف_من') {
            const listName = exprToKotlin(stmt.expr.args[0], stateVars);
            lines.push(`${indent}    ${listName}.remove(${itemVarName})`);
          }
        } else if (stmt.type === N.TOAST) {
          lines.push(`${indent}    android.widget.Toast.makeText(this, ${exprToKotlin(stmt.text, stateVars)}, android.widget.Toast.LENGTH_SHORT).show()`);
        }
      }
      lines.push(`${indent}    updateUI()`);
      lines.push(`${indent}}`);
      lines.push(`${indent}inner.addView(btnItem)`);
    }
  }

  lines.push(`${indent}card.addView(inner)`);
  lines.push(`${indent}container.addView(card)`);
  return lines;
}

// ═══ updateUI ═══
function buildUpdateUI(children, stateVars) {
  const lines = [];
  for (const child of children) {
    if (child.type === N.STATE_DECL) continue;
    if (child.type === N.UI_HEADING || child.type === N.UI_TEXT) {
      const expr = child.type === N.UI_HEADING ? child.text : child.expr;
      if (hasStateRef(expr, stateVars)) {
        lines.push(`        findViewById<android.widget.TextView>(R.id.${child._id}).text = ${exprToKotlin(expr, stateVars)}`);
      }
    }
    if (child.type === N.UI_CARD || child.type === N.UI_ROW) {
      const inner = buildUpdateUI(child.children, stateVars);
      if (inner) lines.push(inner);
    }
    if (child.type === N.UI_LIST) {
      // امسح العناصر القديمة
      lines.push(`        run {`);
      lines.push(`            val container = findViewById<android.widget.LinearLayout>(R.id.${child._id})`);
      lines.push(`            container.removeAllViews()`);
      lines.push(`            val sourceList = STATE_${child.source}`);
      lines.push(`            if (sourceList.isEmpty()) {`);
      lines.push(`                val empty = android.widget.TextView(this).apply {`);
      lines.push(`                    text = "لا توجد مهام — أضف واحدة من الأعلى"`);
      lines.push(`                    textSize = 15f`);
      lines.push(`                    setTextColor(android.graphics.Color.parseColor("#9E9E9E"))`);
      lines.push(`                    gravity = android.view.Gravity.CENTER`);
      lines.push(`                    setPadding(0, 60, 0, 60)`);
      lines.push(`                }`);
      lines.push(`                container.addView(empty)`);
      lines.push(`            }`);
      lines.push(`            for (العنصر in sourceList) {`);
      // ابنِ عناصر القائمة
      const itemBody = buildListItemBody(child.template, stateVars, 'العنصر', '                ');
      if (itemBody.length) {
        lines.push(itemBody.join('\n'));
      }
      lines.push(`            }`);
      lines.push(`        }`);
    }
  }
  return lines.join('\n');
}

// ═══ توليد المشروع ═══
function toPackage(name) {
  const clean = String(name).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'app';
  return 'com.narmin.' + clean;
}
function toClassName(name) {
  const clean = String(name).replace(/[^a-zA-Z0-9]/g, '');
  return (clean || 'App') + 'Activity';
}

function generateProject(screenNode, projectName, targetDir, extra = {}) {
  idCounter = 0;
  THEME = extra.palette || THEME;
  STYLES = extra.styles || new Map();
  try {
    const pal = require('../natural/palettes');
    _colorResolver = pal.resolveColorSmart || null;
  } catch (_) { _colorResolver = null; }
  BUTTON_COLOR = extra.buttonColor || null;
  TEXT_COLOR = extra.textColor || null;
  BUTTON_TEXT_COLOR = '#FFFFFF';
  if (extra.buttonColor && extra.buttonColor !== 'MIXED') {
    // حساب لون متباين مع خلفية الزر
    const btnHex = extra.buttonColor;
    if (/^#[0-9A-Fa-f]{6}$/.test(btnHex)) {
      const r = parseInt(btnHex.slice(1,3),16), g = parseInt(btnHex.slice(3,5),16), b = parseInt(btnHex.slice(5,7),16);
      const lum = 0.299*r + 0.587*g + 0.114*b;
      BUTTON_TEXT_COLOR = lum > 150 ? '#000000' : '#FFFFFF';
    }
  } else if (extra.textColor && /^#[0-9A-Fa-f]{6}$/.test(extra.textColor)) {
    // لو المستخدم محدد نص، استخدمه لكن اعكس لو الزر فاتح
    BUTTON_TEXT_COLOR = '#FFFFFF';
  }
  // خريطة افتراضية لشاشة واحدة
  CURRENT_SCREEN_MAP = new Map();
  CURRENT_SCREEN_MAP.set(screenNode.name, { cls: toClassName(projectName), index: 0 });
  const حزمة = toPackage(projectName);
  const فئة = toClassName(projectName);
  const packagePath = حزمة.replace(/\./g, '/');
  const stateVars = collectState(screenNode.children);
  BINDING_TYPES = stateVars;

  // XML
  const xmlChildren = buildXml(screenNode.children);
  
  // Kotlin
  const ktBody = buildKotlinBody(screenNode.children, '        ', stateVars) || '        // لا شيء';
  const updateUIBody = buildUpdateUI(screenNode.children, stateVars) || '        // لا شيء ديناميكي';

  const importsList = (extra.imports || []).map((p) => `import ${p}`).join('\n');
  const importsSection = importsList ? '\n' + importsList : '';

  const stateDecls = Array.from(stateVars.entries())
    .map(([name, info]) => `    private var STATE_${name}: ${info.type} = ${info.init}`)
    .join('\n');
  const stateBlock = stateDecls ? '\n' + stateDecls + '\n' : '';

  const mainKt = `package ${حزمة}

import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity${importsSection}

class ${فئة} : AppCompatActivity() {
${stateBlock}
    private fun httpGet(url: String): MutableMap<String, Any> {
        android.util.Log.d("narmin-http", "start: " + url)
        var result: MutableMap<String, Any> = mutableMapOf("نجح" to false, "جسم" to "", "كود" to 0, "خطأ" to "initial")
        val thread = Thread {
            try {
                val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Narmin)")
                val code = conn.responseCode
                android.util.Log.d("narmin-http", "code: " + code.toString())
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
                result = mutableMapOf("نجح" to (code in 200..299), "جسم" to body, "كود" to code, "خطأ" to (if (code in 200..299) "" else "HTTP " + code.toString()))
            } catch (e: Exception) {
                android.util.Log.e("narmin-http", "ERR: " + e.javaClass.simpleName + ": " + (e.message ?: ""))
                result = mutableMapOf("نجح" to false, "جسم" to "", "كود" to 0, "خطأ" to (e.javaClass.simpleName + ": " + (e.message ?: "")))
            }
        }
        thread.start()
        thread.join(20000)
        android.util.Log.d("narmin-http", "done")
        return result
    }

    private fun formatNumber(n: Double): String {
        return if (n == n.toLong().toDouble()) n.toLong().toString()
               else String.format("%.6f", n).trimEnd('0').trimEnd('.')
    }

    private fun updateUI() {
${updateUIBody}
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

${ktBody}

        updateUI()
    }
}
`;

  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:allowBackup="true"\n        android:icon="@mipmap/ic_launcher"
        android:label="${escapeXml(screenNode.name)}"
        android:supportsRtl="true"
        android:theme="@style/Theme.App">
        <activity
            android:name=".${فئة}"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;

  const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${escapeXml(screenNode.name)}</string>
</resources>
`;

  const themesXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.App" parent="Theme.Material3.Light.NoActionBar">
        <item name="colorPrimary">#1A237E</item>
        <item name="colorOnPrimary">#FFFFFF</item>
        <item name="android:statusBarColor">#1A237E</item>
    </style>
</resources>
`;

  const dirs = [
    `app/src/main/java/${packagePath}`,
    'app/src/main/res/layout',
    'app/src/main/res/values',
  ];
  for (const d of dirs) fs.mkdirSync(path.join(targetDir, d), { recursive: true });

  fs.writeFileSync(path.join(targetDir, 'app/src/main/res/layout/activity_main.xml'), activityXml, 'utf8');
  fs.writeFileSync(path.join(targetDir, `app/src/main/java/${packagePath}/${فئة}.kt`), mainKt, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'app/src/main/AndroidManifest.xml'), manifest, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'app/src/main/res/values/strings.xml'), stringsXml, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'app/src/main/res/values/themes.xml'), themesXml, 'utf8');

  // أيقونة التطبيق (mipmap)
  const mipDir = path.join(targetDir, 'app/src/main/res/mipmap');
  fs.mkdirSync(mipDir, { recursive: true });
  fs.writeFileSync(path.join(mipDir, 'ic_launcher.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n' +
    '    android:width="108dp"\n' +
    '    android:height="108dp"\n' +
    '    android:viewportWidth="108"\n' +
    '    android:viewportHeight="108">\n' +
    '    <path android:fillColor="#1A237E" android:pathData="M0,0h108v108h-108z" />\n' +
    '    <path android:strokeColor="#FFC107" android:strokeWidth="3" android:pathData="M54,8 L54,100" />\n' +
    '    <path android:fillColor="#FFFFFF" android:pathData="M28,30 L28,80 L38,80 L38,50 L64,80 L74,80 L74,30 L64,30 L64,60 L38,30 Z" />\n' +
    '</vector>\n',
    'utf8');



  // أيقونة التطبيق
  const drawableDir = path.join(targetDir, 'app/src/main/res/drawable');
  fs.mkdirSync(drawableDir, { recursive: true });
  const iconXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:fillColor="#1A237E" android:pathData="M0,0h108v108h-108z" />
    <path android:strokeColor="#FFC107" android:strokeWidth="3" android:pathData="M54,8 L54,100" />
    <path android:fillColor="#FFFFFF" android:pathData="M28,30 L28,80 L38,80 L38,50 L64,80 L74,80 L74,30 L64,30 L64,60 L38,30 Z" />
</vector>
`;
  fs.writeFileSync(path.join(drawableDir, 'ic_launcher.xml'), iconXml, 'utf8');

  return { حزمة, فئة };
}

// ═══ توليد مشروع متعدد الشاشات ═══
function generateMultiProject(screens, projectName, targetDir, extra = {}) {
  const حزمة = toPackage(projectName);
  const packagePath = حزمة.replace(/\./g, '/');

  // اسمح بتسمية: نستخدم "Screen1Activity", "Screen2Activity", ...
  const screenMap = new Map(); // اسم العرض → { class, index }
  screens.forEach((screen, i) => {
    const cls = 'Screen' + (i + 1) + 'Activity';
    screenMap.set(screen.name, { cls, index: i });
  });
  // اجعل الخريطة متاحة لـ handlerToKotlin
  CURRENT_SCREEN_MAP = screenMap;

  const dirs = [
    `app/src/main/java/${packagePath}`,
    'app/src/main/res/layout',
    'app/src/main/res/values',
  ];
  for (const d of dirs) fs.mkdirSync(path.join(targetDir, d), { recursive: true });

  // اضبط الألوان
  THEME = extra.palette || THEME;
  BUTTON_COLOR = extra.buttonColor || null;
  TEXT_COLOR = extra.textColor || null;

  // ولّد كل شاشة
  for (const screen of screens) {
    const info = screenMap.get(screen.name);
    idCounter = 0;
    const stateVars = collectState(screen.children);
    BINDING_TYPES = stateVars;

    // XML
    // اضبط الأنماط
    STYLES = extra.styles || new Map();
    try {
      const pal = require('../natural/palettes');
      _colorResolver = pal.resolveColorSmart || null;
    } catch (_) { _colorResolver = null; }

    const topBarNode = screen.children.find(c => c.type === N.UI_TOPBAR);
    const mainChildren = screen.children.filter(c => c.type !== N.UI_TOPBAR);

    let topBarXml = '';
    if (topBarNode) {
      const props = topBarNode.props || {};
      const bgColor = props.color ? (resolveStyleColor(staticString(props.color)) || THEME.primary) : THEME.primary;
      const txtColor = '#FFFFFF';
      const sizeNum = props.size ? String(staticString(props.size)) : '60';
      const textVal = props.text ? staticString(props.text) : screen.name;
      topBarXml = `    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="${sizeNum}dp"
        android:background="${bgColor}"
        android:gravity="center_vertical|start"
        android:paddingHorizontal="20dp"
        android:layoutDirection="rtl">

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="${escapeXml(textVal)}"
            android:textColor="${txtColor}"
            android:textSize="20sp"
            android:textStyle="bold" />
    </LinearLayout>
`;
    }

    const xmlChildrenMain = buildXml(mainChildren);

    const activityXml = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="${THEME.background}"
    android:layoutDirection="rtl">

${topBarXml}
    <ScrollView
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:fillViewport="true">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:padding="16dp"
            android:fontFamily="sans-serif">

${xmlChildrenMain}

        </LinearLayout>
    </ScrollView>
</LinearLayout>
`;
    
        const layoutName = 'activity_' + info.cls.replace('Activity', '').toLowerCase();
    fs.writeFileSync(path.join(targetDir, `app/src/main/res/layout/${layoutName}.xml`), activityXml, 'utf8');

    // Kotlin
    const ktBody = buildKotlinBody(screen.children, '        ', stateVars) || '        // لا شيء';
    const updateUIBody = buildUpdateUI(screen.children, stateVars) || '        // لا شيء ديناميكي';

    const stateDecls = Array.from(stateVars.entries())
      .map(([name, sinfo]) => `    private var STATE_${name}: ${sinfo.type} = ${sinfo.init}`)
      .join('\n');
    const stateBlock = stateDecls ? '\n' + stateDecls + '\n' : '';

    // سطور تحميل القيم المحفوظة
    const loadLines = Array.from(stateVars.entries())
      .filter(([_, sinfo]) => sinfo.persistent)
      .map(([name, sinfo]) => {
        if (sinfo.isList) {
          return `        STATE_${name} = try {
            val arr = org.json.JSONArray(prefs.getString("${name}", "[]") ?: "[]")
            val list = mutableListOf<String>()
            for (i in 0 until arr.length()) list.add(arr.getString(i))
            list
        } catch (e: Exception) { mutableListOf() }`;
        }
        const dflt = sinfo.type === 'Double' ? '0.0'
                   : sinfo.type === 'Boolean' ? 'false'
                   : '""';
        if (sinfo.type === 'Double') {
          return `        STATE_${name} = (prefs.getString("${name}", "${dflt}") ?: "${dflt}").toDoubleOrNull() ?: ${dflt}`;
        } else if (sinfo.type === 'Boolean') {
          return `        STATE_${name} = (prefs.getString("${name}", "false") ?: "false").toBoolean()`;
        } else {
          return `        STATE_${name} = prefs.getString("${name}", ${sinfo.init}) ?: ${sinfo.init}`;
        }
      })
      .join('\n');
    const loadBlock = loadLines ? '\n' + loadLines + '\n' : '';

    const importsList = (extra.imports || []).map((p) => `import ${p}`).join('\n');
    const importsSection = importsList ? '\n' + importsList : '';

    const mainKt = `package ${حزمة}

import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity${importsSection}

class ${info.cls} : AppCompatActivity() {
${stateBlock}
    private fun httpGet(url: String): MutableMap<String, Any> {
        android.util.Log.d("narmin-http", "start: " + url)
        var result: MutableMap<String, Any> = mutableMapOf("نجح" to false, "جسم" to "", "كود" to 0, "خطأ" to "initial")
        val thread = Thread {
            try {
                val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Narmin)")
                val code = conn.responseCode
                android.util.Log.d("narmin-http", "code: " + code.toString())
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
                result = mutableMapOf("نجح" to (code in 200..299), "جسم" to body, "كود" to code, "خطأ" to (if (code in 200..299) "" else "HTTP " + code.toString()))
            } catch (e: Exception) {
                android.util.Log.e("narmin-http", "ERR: " + e.javaClass.simpleName + ": " + (e.message ?: ""))
                result = mutableMapOf("نجح" to false, "جسم" to "", "كود" to 0, "خطأ" to (e.javaClass.simpleName + ": " + (e.message ?: "")))
            }
        }
        thread.start()
        thread.join(20000)
        android.util.Log.d("narmin-http", "done")
        return result
    }

    private fun formatNumber(n: Double): String {
        return if (n == n.toLong().toDouble()) n.toLong().toString()
               else String.format("%.6f", n).trimEnd('0').trimEnd('.')
    }

    private fun savePref(key: String, value: Any?) {
        val str = when (value) {
            is List<*> -> {
                val arr = org.json.JSONArray()
                for (v in value) arr.put(v)
                arr.toString()
            }
            else -> value?.toString() ?: ""
        }
        getSharedPreferences("narmin_prefs", MODE_PRIVATE).edit().putString(key, str).apply()
    }

    private fun updateUI() {
${updateUIBody}
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.${layoutName})

        val prefs = getSharedPreferences("narmin_prefs", MODE_PRIVATE)
${loadBlock}
${ktBody}

        updateUI()
    }
}
`;
    fs.writeFileSync(path.join(targetDir, `app/src/main/java/${packagePath}/${info.cls}.kt`), mainKt, 'utf8');
  }

  // Manifest
  const activitiesXml = screens.map((screen) => {
    const info = screenMap.get(screen.name);
    const isFirst = info.index === 0;
    return `        <activity
            android:name=".${info.cls}"
            android:exported="${isFirst ? 'true' : 'false'}"${isFirst ? '>' : ' />'}
${isFirst ? `            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>` : ''}`;
  }).join('\n');

  const permissionsBlock = (extra.permissions || []).map((p) => `    <uses-permission android:name="${p}" />`).join('\n');

  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
${permissionsBlock}
    <application
        android:allowBackup="true"\n        android:icon="@mipmap/ic_launcher"
        android:label="${escapeXml(screens[0].name)}"
        android:supportsRtl="true"
        android:theme="@style/Theme.App">
${activitiesXml}
    </application>
</manifest>
`;

  const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${escapeXml(screens[0].name)}</string>
</resources>
`;

  const themesXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.App" parent="Theme.Material3.Light.NoActionBar">
        <item name="colorPrimary">#1A237E</item>
        <item name="colorOnPrimary">#FFFFFF</item>
        <item name="android:statusBarColor">#1A237E</item>
    </style>
</resources>
`;

  fs.writeFileSync(path.join(targetDir, 'app/src/main/AndroidManifest.xml'), manifest, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'app/src/main/res/values/strings.xml'), stringsXml, 'utf8');
  fs.writeFileSync(path.join(targetDir, 'app/src/main/res/values/themes.xml'), themesXml, 'utf8');  return { حزمة, screens: screens.map((s) => ({ name: s.name, cls: screenMap.get(s.name).cls })) };
}

module.exports = { generateProject, generateMultiProject };
