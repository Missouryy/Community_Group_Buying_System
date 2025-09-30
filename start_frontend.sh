#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

FRONT_PORT=${FRONT_PORT:-8080}

# Pretty output (colors + emojis)
if [ -t 1 ]; then
  RESET="\033[0m"; BOLD="\033[1m"; DIM="\033[2m";
  RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; BLUE="\033[34m"; CYAN="\033[36m";
else
  RESET=""; BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; CYAN="";
fi
info()  { echo -e "${CYAN}🧰 $*${RESET}"; }
ok()    { echo -e "${GREEN}✅ $*${RESET}"; }
warn()  { echo -e "${YELLOW}⚠️  $*${RESET}"; }
err()   { echo -e "${RED}❌ $*${RESET}"; }

echo -e "${BOLD}🚀 启动前端静态服务器${RESET}"

# 选择可用端口（若被占用则向上找空闲端口，最多尝试 +20）
find_free_port() {
  local base_port=$1
  local max_port=$2
  local port=$base_port
  while lsof -i :${port} -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port+1))
    if [ ${port} -gt ${max_port} ]; then
      return 1
    fi
  done
  echo -n ${port}
}

ORIG_FRONT_PORT=${FRONT_PORT}
FRONT_PORT=$(find_free_port ${FRONT_PORT} $((ORIG_FRONT_PORT+20))) || {
  err "未找到可用的端口（从 ${ORIG_FRONT_PORT} 起最多尝试 +20）"
  exit 1
}
[ "${FRONT_PORT}" != "${ORIG_FRONT_PORT}" ] && warn "端口被占用，已改用 ${FRONT_PORT}"

cleanup() {
  info "停止前端静态服务器"
}
trap cleanup EXIT INT TERM

echo -e "${BOLD}🌐 前端地址:${RESET} http://127.0.0.1:${FRONT_PORT}/login.html"
exec python3 -m http.server ${FRONT_PORT} -d frontend
