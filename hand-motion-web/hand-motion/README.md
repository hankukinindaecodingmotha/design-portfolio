# Hand Motion Demo (Mac + Web)

맥북·브라우저 웹캠으로 **손 움직임에 반응하는 인터랙티브 아트**입니다.

## 맥북에서 바로 실행 (추천)

### 방법 A — 더블클릭 (가장 쉬움)

1. 코드 받기:
   ```bash
   git checkout cursor/hand-motion-mac-demo-3d01
   ```
2. Finder에서 `hand-motion` 폴더 열기
3. **`run-performer.command`** 더블클릭
   - 처음 실행 시 Python 패키지·AI 모델 자동 설치 (1~2분)
   - **별도 창**이 뜨며 손 인식 + 비주얼 시작
4. 종료: 창에서 `Q` 또는 `ESC`

> `.command` 파일이 안 열리면: 파일 우클릭 → **연결 프로그램** → **터미널**

### 방법 B — 터미널 한 줄

```bash
cd hand-motion
./run-performer.sh
```

### 방법 C — 웹 (Safari/Chrome)

`run-web.command` 더블클릭 → 브라우저에서 `http://localhost:8080`

---

## 앱 3종

| 앱 | 실행 | 설명 |
|----|------|------|
| **web/** | 브라우저 | 링크 공유 가능 — 카메라 허용 후 바로 체험 |
| **performer.py** | `python performer.py` | TouchDesigner 스타일 AV 퍼포먼스 (맥 로컬) |
| **app.py** | `python app.py` | 간단한 손 추적·제스처 데모 |

---

## 웹 버전 (링크로 공유)

### 로컬에서 테스트

```bash
cd hand-motion/web
python3 -m http.server 8080
```

브라우저에서 **http://localhost:8080** 접속 → 「카메라 허용하고 시작」

### Vercel 배포 (링크 만들기)

1. [vercel.com](https://vercel.com) 로그인
2. New Project → GitHub 레포 연결
3. **Root Directory**를 `hand-motion/web`으로 설정
4. Deploy

배포 후 `https://your-project.vercel.app` 링크를 공유하면 다른 사람도 브라우저에서 체험할 수 있습니다.

### 웹 조작법

| 동작 | 반응 |
|------|------|
| 손 이동 | 빛 오브 + 색상 |
| 핀치 (엄지+검지) | 파티클 폭발 + 소리 |
| 좌/우 스와이프 | 색상(Hue) 변경 |
| ✕ 버튼 | 종료 |

영상은 **브라우저 안에서만** 처리되며 서버로 전송되지 않습니다.

---

## Python 버전 (맥북 로컬)

```bash
cd hand-motion
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python performer.py   # VJ 퍼포먼스
python app.py         # 간단 데모
```

### performer.py 조작법

| 손 동작 | 반응 |
|---------|------|
| 손 위치 이동 | 오로라 오브 위치·색상 |
| 손 펼치기 | 오브 크기 + 톤 |
| 핀치 | 비트 + 파티클 |
| 좌/우 스와이프 | 씬 전환 (Aurora / Particles / Grid) |

## macOS 카메라 권한 (Python)

**시스템 설정 → 개인정보 및 보호 → 카메라** → 터미널/Python 허용

## 프로젝트 구조

```
hand-motion/
├── web/                # 브라우저 버전 (배포용)
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── vercel.json
├── performer.py
├── app.py
├── hand_utils.py
├── visual_engine.py
├── audio_engine.py
└── download_model.py
```
