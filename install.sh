#!/data/data/com.termux/files/usr/bin/bash
# ═══════════════════════════════════════════════
#  نارمين — Narmin Installer
#  تثبيت كامل على Termux
# ═══════════════════════════════════════════════

set -e

C_RESET='\033[0m'
C_BOLD='\033[1m'
C_GREEN='\033[32m'
C_YELLOW='\033[33m'
C_RED='\033[31m'
C_CYAN='\033[36m'

echo ""
echo -e "${C_CYAN}${C_BOLD}  ╭──────────────────────────────────────╮${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}  │   نارمين — Narmin Installer v2.1    │${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}  │   لغة برمجة عربية → تطبيقات Android  │${C_RESET}"
echo -e "${C_CYAN}${C_BOLD}  ╰──────────────────────────────────────╯${C_RESET}"
echo ""

# ═══ 1) تحقق من Termux ═══
if [ ! -d "/data/data/com.termux" ]; then
    echo -e "${C_RED}✗ هذا السكربت مصمّم لـ Termux فقط${C_RESET}"
    exit 1
fi
echo -e "${C_GREEN}✓${C_RESET} بيئة Termux"

# ═══ 2) تحديث الحزم ═══
echo ""
echo -e "${C_YELLOW}▶ تحديث قوائم الحزم...${C_RESET}"
pkg update -y >/dev/null 2>&1 || true
echo -e "${C_GREEN}✓${C_RESET} تم"

# ═══ 3) تثبيت متطلبات نارمين ═══
echo ""
echo -e "${C_YELLOW}▶ تثبيت Node.js...${C_RESET}"
pkg install -y nodejs git >/dev/null 2>&1
node --version | sed 's/^/  Node.js: /'

echo ""
echo -e "${C_YELLOW}▶ تثبيت Java 17 (لبناء APK)...${C_RESET}"
pkg install -y openjdk-17 >/dev/null 2>&1 || \
    echo -e "${C_YELLOW}  ⚠ قد تحتاج تشغيل: pkg install openjdk-17${C_RESET}"

echo ""
echo -e "${C_YELLOW}▶ تثبيت أدوات Android (aapt2, zipalign, apksigner)...${C_RESET}"
pkg install -y aapt2 zipalign apksigner >/dev/null 2>&1 || \
    echo -e "${C_YELLOW}  ⚠ بعض الأدوات قد لا تُثبَّت — يمكن تثبيتها لاحقاً${C_RESET}"

echo ""
echo -e "${C_YELLOW}▶ تثبيت أدوات مساعدة (curl, unzip)...${C_RESET}"
pkg install -y curl unzip >/dev/null 2>&1
echo -e "${C_GREEN}✓${C_RESET} الأدوات الأساسية جاهزة"

# ═══ 4) تحقق من الموقع ═══
echo ""
if [ ! -d "$HOME/DEV/apps_building/narmin" ]; then
    echo -e "${C_RED}✗ مجلد نارمين غير موجود${C_RESET}"
    echo ""
    echo "شغّل هذا أولاً:"
    echo "  cd ~/DEV/apps_building"
    echo "  git clone https://github.com/USERNAME/narmin.git"
    exit 1
fi

cd "$HOME/DEV/apps_building/narmin"
echo -e "${C_GREEN}✓${C_RESET} مجلد المشروع: $(pwd)"

# ═══ 5) npm link ═══
echo ""
echo -e "${C_YELLOW}▶ ربط نارمين بالأوامر العالمية...${C_RESET}"
npm link >/dev/null 2>&1
echo -e "${C_GREEN}✓${C_RESET} الأوامر: narm، narmin"

# ═══ 6) اختبار ═══
echo ""
echo -e "${C_YELLOW}▶ اختبار سريع...${C_RESET}"
if narm --version >/dev/null 2>&1; then
    echo -e "${C_GREEN}✓${C_RESET} narm يعمل: $(narm --version)"
else
    echo -e "${C_RED}✗ فشل الاختبار — راجع الأخطاء أعلاه${C_RESET}"
    exit 1
fi

echo ""
echo -e "${C_GREEN}${C_BOLD}═══════════════════════════════════════════${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}  ✓✓✓ اكتمل التثبيت ✓✓✓${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}═══════════════════════════════════════════${C_RESET}"
echo ""
echo -e "${C_BOLD}للاستخدام:${C_RESET}"
echo ""
echo -e "  ${C_CYAN}narm${C_RESET}                     ← الوضع الطبيعي (عربية)"
echo -e "  ${C_CYAN}narm repl${C_RESET}                ← REPL البرمجة"
echo -e "  ${C_CYAN}narm run file.narm${C_RESET}       ← تشغيل ملف"
echo -e "  ${C_CYAN}narm --help${C_RESET}              ← المساعدة"
echo ""
echo -e "${C_BOLD}مثال:${C_RESET}"
echo -e "  ${C_CYAN}narm${C_RESET}"
echo -e "  نارمين » انشئ تطبيق \"مذكرتي\""
echo -e "  نارمين » أضف زر \"حفظ\""
echo -e "  نارمين » شغّل"
echo ""
