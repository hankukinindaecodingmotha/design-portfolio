# Design Portfolio

디자이너 포트폴리오 사이트 (React + Vite).

## 페이지

- `/`: Spline 3D 히어로 배너 + 대표 작업 + About + Contact
- `/work`: 전체 프로젝트 아카이브 (필터)
- `/work/:slug`: 프로젝트 상세

## 실행

```bash
npm install
npm run dev
```

## Spline 배너 연결

`src/data/portfolio.js`의 `splineSceneUrl`에 Spline에서 Export한 URL(React/Code)을 넣으면 됩니다.

## 빌드

```bash
npm run build
npm run preview
```
