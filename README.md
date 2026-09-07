# Design Portfolio

디자이너 포트폴리오 사이트 (React + Vite).

## 구조

```
src/                 # 포트폴리오 사이트
public/models/       # 히어로 3D (GLB)
works/               # 작품 소스 (사이트와 분리)
  hand-motion/       # 인터랙티브 손 모션 데모
  hteng-website/     # HTeng 기업 웹 프로젝트
```

## 페이지

- `/`: 3D 히어로 + 대표 작업 + About + Contact
- `/work`: 전체 프로젝트 아카이브 (필터)
- `/work/:slug`: 프로젝트 상세

## 실행

```bash
npm install
npm run dev
```

## 작품 데이터

`src/data/portfolio.js`에서 프로젝트 목록을 관리합니다. 실제 소스는 `works/` 아래입니다.

## 빌드

```bash
npm run build
npm run preview
```
