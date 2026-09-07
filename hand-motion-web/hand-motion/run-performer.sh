#!/bin/bash
set -e
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ ! -d ".venv" ]; then
  echo "처음 실행 — 설치 중..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install --upgrade pip -q
  pip install -r requirements.txt
  python3 download_model.py hand
else
  source .venv/bin/activate
fi

exec python3 performer.py
