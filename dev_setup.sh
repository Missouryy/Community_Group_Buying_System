#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

VENV=.venv
PY=${VENV}/bin/python
PIP=${VENV}/bin/pip

if [ ! -f backend/requirements.txt ]; then
  echo "[dev_setup] backend/requirements.txt 不存在" >&2
  exit 1
fi

if [ ! -d "$VENV" ]; then
  python3 -m venv "$VENV"
fi

"$PIP" install -U pip
"$PIP" install -r backend/requirements.txt

if [ ! -f .env ]; then
  cat > .env <<EOF
DB_ENGINE=mysql
DB_NAME=community_group_buying
DB_USER=root
DB_PASSWORD=12345678
DB_HOST=127.0.0.1
DB_PORT=3306
EOF
fi

"$PY" backend/scripts/create_mysql_db.py || true
"$PY" backend/manage.py makemigrations api || true
"$PY" backend/manage.py migrate

echo "[dev_setup] done. 现在可运行 ./dev_up.sh 启动服务。"


