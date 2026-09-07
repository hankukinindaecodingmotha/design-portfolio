#!/bin/bash
# 맥북 더블클릭 → Safari에서 웹 버전 자동 실행
set -e
cd "$(dirname "$0")/web"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

PORT=8080
URL="http://localhost:${PORT}"

echo "======================================"
echo "  Hand Motion — 웹 버전 (Safari)"
echo "======================================"
echo ""
echo "서버: $URL"
echo "종료: 이 창에서 Ctrl+C"
echo ""

# Safari 자동 열기 (맥 전용)
if [[ "$(uname)" == "Darwin" ]]; then
  (sleep 1 && open -a Safari "$URL") &
fi

python3 -m http.server "$PORT"
