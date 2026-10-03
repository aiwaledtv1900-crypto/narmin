p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/codegen/android.js'
s = open(p, encoding='utf-8').read()

if "stmt.type === N.LET" in s and "HANDLER_LOCAL" in s:
    print("ℹ موجود")
else:
    # أضف LetStmt في handlerToKotlin
    anchor = """    } else if (stmt.type === N.EXPR_STMT) {
      lines.push(`${indent}${exprToKotlin(stmt.expr, stateVars)}`);
    } else if (stmt.type === N.IF) {"""

    if anchor not in s:
        raise SystemExit("⚠ anchor EXPR_STMT")

    add = """    } else if (stmt.type === N.LET || stmt.type === N.CONST) {
      // متغير محلي داخل المعالج — استخدم var/val Kotlin
      const keyword = stmt.type === N.CONST ? 'val' : 'var';
      if (stmt.init) {
        const value = exprToKotlin(stmt.init, stateVars);
        lines.push(`${indent}${keyword} ${stmt.name} = ${value}`);
      } else {
        lines.push(`${indent}${keyword} ${stmt.name}: Any? = null`);
      }
    } else if (stmt.type === N.EXPR_STMT) {
      lines.push(`${indent}${exprToKotlin(stmt.expr, stateVars)}`);
    } else if (stmt.type === N.IF) {"""

    s = s.replace(anchor, add, 1)

    # أيضاً في exprToKotlin عند MEMBER — إذا كان الكائن متغير محلي (ليس STATE) نحتاج عدم تحويله لـ STATE_
    # نحن نفحص: إذا كان في stateVars → STATE_، وإلا يبقى كما هو
    # لكن MEMBER يستخدم exprToKotlin(obj) — يُديرها تلقائياً

    open(p, 'w', encoding='utf-8').write(s)
    print("✅ handlerToKotlin: LetStmt")
