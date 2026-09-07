#!/bin/bash
# 맥북 더블클릭 실행 — Finder에서 이 파일 더블클릭
set -e
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "======================================"
echo "  Hand Performer — 맥북 네이티브 실행"
echo "======================================"
echo ""

if ! command -v python3 &>/dev/null; then
  echo "❌ Python3가 없습니다."
  echo "   https://www.python.org/downloads/ 에서 설치해 주세요."
  read -n 1 -s -r -p "아무 키나 누르면 종료..."
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "📦 처음 실행 — 패키지 설치 중 (1~2분)..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install --upgrade pip -q
  pip install -r requirements.txt
  echo "📥 AI 모델 다운로드..."
  python3 download_model.py hand
  echo "✅ 설치 완료!"
  echo ""
else
  source .venv/bin/activate
fi

echo "🎥 카메라 창을 여는 중..."
echo "   (카메라 권한 팝업이 뜨면 허용해 주세요)"
echo ""

python3 performer.py
EXIT=$?

echo ""
if [ $EXIT -eq 0 ]; then
  echo "종료되었습니다."
else
  echo "오류로 종료되었습니다 (코드: $EXIT)"
  echo "카메라 권한: 시스템 설정 → 개인정보 → 카메라 → 터미널/Python 허용"
fi
read -n 1 -s -r -p "아무 키나 누르면 창을 닫습니다..."
