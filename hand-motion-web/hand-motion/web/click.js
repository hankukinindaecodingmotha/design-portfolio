/**
 * 클릭 실험 — 검지 끝 = 커서, 엄지+검지 핀치 = 클릭
 */
import {
  FilesetResolver,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
import { mountPagesNav } from "./pages-nav.js";

mountPagesNav();

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const INDEX_TIP = 8;
const THUMB_TIP = 4;
const PINCH_ON = 0.05;
const PINCH_OFF = 0.075;

const video = document.getElementById("camera");
const canvas = document.getElementById("visual-canvas");
const ctx = canvas.getContext("2d");
const startScreen = document.getElementById("start-screen");
const stage = document.getElementById("stage");
const startBtn = document.getElementById("start-btn");
const demoBtn = document.getElementById("demo-btn");
const stopBtn = document.getElementById("stop-btn");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error-msg");

let landmarker = null;
let mediaStream = null;
let rafId = 0;
let demoRaf = 0;
let lastVideoTime = -1;
let frameTs = 0;
let demoMode = false;

const state = {
  cursor: null,
  pinched: false,
  wasPinched: false,
  hoverId: null,
  clicks: [],
  score: 0,
  targets: [],
};

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function showError(text) {
  if (!errorEl) return;
  errorEl.hidden = !text;
  errorEl.textContent = text || "";
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);

function mirrorX(x) {
  return 1 - x;
}

function hsv(h, s, v, a = 1) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  return `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},${a})`;
}

function spawnTargets() {
  const w = canvas.width;
  const h = canvas.height;
  const labels = ["✦", "●", "▲", "■", "◆"];
  state.targets = [];
  for (let i = 0; i < 5; i++) {
    state.targets.push({
      id: `t${i}-${Date.now()}`,
      x: w * (0.2 + Math.random() * 0.6),
      y: h * (0.25 + Math.random() * 0.5),
      r: 28 + Math.random() * 18,
      label: labels[i % labels.length],
      hit: false,
      hue: (i * 0.17 + 0.55) % 1,
    });
  }
}

function hitTest(x, y) {
  for (const t of state.targets) {
    if (t.hit) continue;
    if (Math.hypot(x - t.x, y - t.y) <= t.r + 10) return t;
  }
  return null;
}

function fireClick(x, y) {
  state.clicks.push({ x, y, life: 1 });
  const t = hitTest(x, y);
  if (t) {
    t.hit = true;
    state.score += 1;
    setStatus(`클릭 성공! 점수 ${state.score}`);
    const w = canvas.width;
    const h = canvas.height;
    state.targets.push({
      id: `t${Date.now()}`,
      x: w * (0.18 + Math.random() * 0.64),
      y: h * (0.22 + Math.random() * 0.55),
      r: 26 + Math.random() * 20,
      label: ["✦", "●", "▲", "■", "◆"][(Math.random() * 5) | 0],
      hit: false,
      hue: Math.random(),
    });
  } else {
    setStatus("클릭 (빈 공간)");
  }
}

function drawFrame() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(8,10,20,0.4)";
  ctx.fillRect(16, 16, 240, 74);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "600 13px sans-serif";
  ctx.fillText("검지 = 커서 · 핀치 = 클릭", 28, 44);
  ctx.fillStyle = "rgba(232,184,106,0.95)";
  ctx.fillText(`SCORE  ${state.score}`, 28, 70);

  for (const t of state.targets) {
    if (t.hit) continue;
    const hover = state.hoverId === t.id;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * (hover ? 1.12 : 1), 0, Math.PI * 2);
    ctx.fillStyle = hsv(t.hue, 0.55, 1, hover ? 0.55 : 0.28);
    ctx.fill();
    ctx.strokeStyle = hsv(t.hue, 0.7, 1, hover ? 0.95 : 0.65);
    ctx.lineWidth = hover ? 2.4 : 1.4;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.label, t.x, t.y);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  state.clicks = state.clicks.filter((c) => c.life > 0.02);
  for (const c of state.clicks) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, (1 - c.life) * 52, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,220,140,${c.life})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    c.life -= 0.045;
  }

  if (state.cursor) {
    const { x, y } = state.cursor;
    ctx.beginPath();
    ctx.arc(x, y, state.pinched ? 9 : 14, 0, Math.PI * 2);
    ctx.strokeStyle = state.pinched ? "rgba(255,200,80,0.95)" : "rgba(180,220,255,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.moveTo(x - 22, y);
    ctx.lineTo(x + 22, y);
    ctx.moveTo(x, y - 22);
    ctx.lineTo(x, y + 22);
    ctx.stroke();
  }
}

function processLandmarks(landmarksList) {
  const w = canvas.width;
  const h = canvas.height;
  state.cursor = null;
  state.hoverId = null;

  if (!landmarksList?.length) {
    state.pinched = false;
    state.wasPinched = false;
    if (!demoMode) setStatus("손을 보여주세요 — 검지로 조준, 핀치로 클릭");
    return;
  }

  const lm = landmarksList[0];
  const ix = mirrorX(lm[INDEX_TIP].x) * w;
  const iy = lm[INDEX_TIP].y * h;
  const tx = mirrorX(lm[THUMB_TIP].x) * w;
  const ty = lm[THUMB_TIP].y * h;
  const dist = Math.hypot(ix - tx, iy - ty) / Math.min(w, h);

  state.cursor = { x: ix, y: iy };
  state.pinched = dist < PINCH_ON || (state.wasPinched && dist < PINCH_OFF);

  const hover = hitTest(ix, iy);
  state.hoverId = hover?.id || null;

  if (state.pinched && !state.wasPinched) fireClick(ix, iy);
  state.wasPinched = state.pinched;

  if (!state.pinched) {
    setStatus(hover ? "타겟 위 — 핀치로 클릭" : "검지로 조준 · 엄지+검지 핀치 = 클릭");
  }
}

async function initLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const make = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.22,
    minHandPresenceConfidence: 0.22,
    minTrackingConfidence: 0.22,
  });
  try {
    landmarker = await HandLandmarker.createFromOptions(vision, make("GPU"));
  } catch {
    landmarker = await HandLandmarker.createFromOptions(vision, make("CPU"));
  }
}

function createDemoStream() {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 480;
  const cctx = c.getContext("2d");
  let t = 0;
  const loop = () => {
    t += 0.03;
    cctx.fillStyle = "#101428";
    cctx.fillRect(0, 0, 640, 480);
    const x = 320 + Math.sin(t) * 140;
    const y = 240 + Math.cos(t * 0.8) * 90;
    cctx.fillStyle = "#c4a484";
    cctx.beginPath();
    cctx.arc(x, y, 36, 0, Math.PI * 2);
    cctx.fill();
    demoRaf = requestAnimationFrame(loop);
  };
  loop();
  return c.captureStream(30);
}

function tick() {
  rafId = requestAnimationFrame(tick);
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    frameTs += 33;
    try {
      const result = landmarker.detectForVideo(video, frameTs);
      processLandmarks(result.landmarks);
    } catch {
      /* skip */
    }
  }
  if (demoMode && !state.cursor) {
    const t = performance.now() / 1000;
    const x = canvas.width * (0.5 + Math.sin(t) * 0.22);
    const y = canvas.height * (0.45 + Math.cos(t * 0.85) * 0.16);
    state.cursor = { x, y };
    if (Math.sin(t * 2) > 0.92 && Math.sin((t - 0.016) * 2) <= 0.92) {
      fireClick(x, y);
    }
  }
  drawFrame();
}

async function start(useDemo = false) {
  showError("");
  startBtn.disabled = true;
  demoMode = useDemo;
  try {
    resize();
    await initLandmarker();
    if (useDemo) {
      mediaStream = createDemoStream();
      setStatus("데모 모드 — 자동 커서/클릭 미리보기");
    } else {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    }
    video.srcObject = mediaStream;
    await video.play();
    startScreen.hidden = true;
    stage.hidden = false;
    state.score = 0;
    state.clicks = [];
    spawnTargets();
    lastVideoTime = -1;
    frameTs = 0;
    tick();
  } catch (e) {
    showError(e.message || String(e));
    startBtn.disabled = false;
  }
}

function stop() {
  cancelAnimationFrame(rafId);
  cancelAnimationFrame(demoRaf);
  if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
  mediaStream = null;
  video.srcObject = null;
  stage.hidden = true;
  startScreen.hidden = false;
  startBtn.disabled = false;
  setStatus("손을 보여주세요");
}

startBtn?.addEventListener("click", () => start(false));
demoBtn?.addEventListener("click", () => start(true));
stopBtn?.addEventListener("click", stop);

window.__HAND_APP_READY__ = true;
resize();
