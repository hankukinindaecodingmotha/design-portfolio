# 맥북 실행 가이드

## 1분 시작

```bash
git pull origin cursor/hand-motion-mac-demo-3d01
```

Finder → `hand-motion` → **`run-performer.command`** 더블클릭

---

## 실행 파일

| 파일 | 용도 |
|------|------|
| `run-performer.command` | **네이티브 앱** (별도 창, 추천) |
| `run-web.command` | Safari 웹 버전 자동 실행 |
| `run-performer.sh` | 터미널용 |

---

## 처음 실행 시

1. 패키지 설치 (1~2분)
2. AI 모델 다운로드
3. **카메라 권한 허용** 팝업 → 허용
4. `Hand Performer` 창 표시

---

## 조작

| 동작 | 결과 |
|------|------|
| 손 이동 | 빛·색상 |
| 손 펼치기 | 톤 |
| 핀치 | 비트 + 파티클 |
| 좌/우 스와이프 | 씬 전환 |
| 스페이스 | 씬 수동 전환 |
| Q / ESC | 종료 |

---

## 문제 해결

| 문제 | 해결 |
|------|------|
| `.command` 안 열림 | 우클릭 → 연결 프로그램 → 터미널 |
| 카메라 안 됨 | 시스템 설정 → 카메라 → 터미널/Python 허용 |
| Python 없음 | python.org 에서 Python 3.10+ 설치 |
| 손 인식 안 됨 | 조명 밝게, 손 30cm~1m |
