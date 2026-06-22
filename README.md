# Design Portfolio

디자이너 포트폴리오 사이트 (React + Vite).

## 페이지

- `/`: HLS 영상 배너 + 대표 작업 + About + Contact
- `/work`: 전체 프로젝트 아카이브 (필터)
- `/work/:slug`: 프로젝트 상세

## 실행

```bash
npm install
npm run dev
```

## 영상 배너 (HLS)

`public/videos/` 폴더에 `.m3u8` 파일과 함께 세그먼트 파일(`.ts`, 하위 `.m3u8`)을 모두 넣으세요.

`src/data/portfolio.js`의 `heroVideoUrl`로 경로를 지정할 수 있습니다.

```js
heroVideoUrl: '/videos/hero.m3u8',
```

## 빌드

```bash
npm run build
npm run preview
```
