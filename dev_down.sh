#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# Pretty output (colors + emojis)
if [ -t 1 ]; then
  RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m";
  RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; BLUE="\033[34m"; CYAN="\033[36m";
else
  RESET=""; BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; CYAN="";
fi
info()  { echo -e "${CYAN}🧹 $*${RESET}"; }
ok()    { echo -e "${GREEN}✅ $*${RESET}"; }
warn()  { echo -e "${YELLOW}⚠️  $*${RESET}"; }

echo -e "${BOLD}🛑 停止本地服务${RESET}"

# Gracefully stop by process signatures
pkill -f "backend/manage.py runserver" || true
pkill -f "celery .* worker" || pkill -f "celery -A core worker" || true
pkill -f "celery .* beat" || pkill -f "celery -A core beat" || true
# Kill any Python http.server serving our frontend directory on any port
pkill -f "-m http.server .* -d frontend" || true

ok "所有相关进程已停止"


