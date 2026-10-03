p = '/data/data/com.termux/files/home/DEV/apps_building/narmin/src/ast/nodes.js'
s = open(p, encoding='utf-8').read()
ok = []

if 'STYLE_DECL' not in s:
    s = s.replace("  ANDROID_PERMISSION: 'AndroidPermission',",
                  "  ANDROID_PERMISSION: 'AndroidPermission',\n  STYLE_DECL: 'StyleDecl',\n  STYLE_SET: 'StyleSet',", 1)
    ok.append('types')

if 'StyleDecl:' not in s:
    s = s.replace("  AndroidPermission: (name) => ({ type: NodeType.ANDROID_PERMISSION, name }),",
                  "  AndroidPermission: (name) => ({ type: NodeType.ANDROID_PERMISSION, name }),\n  StyleDecl: (name, value) => ({ type: NodeType.STYLE_DECL, name, value }),\n  StyleSet: (name, value) => ({ type: NodeType.STYLE_SET, name, value }),", 1)
    ok.append('helpers')

# UIHeading/UIText/UIButton — أضف colorRef
s = s.replace("UIHeading: (text) => ({ type: NodeType.UI_HEADING, text }),",
              "UIHeading: (text, colorRef = null) => ({ type: NodeType.UI_HEADING, text, colorRef }),")
s = s.replace("UIText: (expr) => ({ type: NodeType.UI_TEXT, expr }),",
              "UIText: (expr, colorRef = null) => ({ type: NodeType.UI_TEXT, expr, colorRef }),")
s = s.replace("UIButton: (text, handler) => ({ type: NodeType.UI_BUTTON, text, handler }),",
              "UIButton: (text, handler, colorRef = null) => ({ type: NodeType.UI_BUTTON, text, handler, colorRef }),")
ok.append('colorRef')

open(p, 'w', encoding='utf-8').write(s)
print("✅", ok)
