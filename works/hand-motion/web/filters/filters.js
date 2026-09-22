import { GestureTracker } from "../hand-tracking.js";

const video = document.getElementById("filter-video");
const canvas = document.getElementById("filter-canvas");
const ctx = canvas.getContext("2d");
const source = document.createElement("canvas");
const sourceCtx = source.getContext("2d");
const startBtn = document.getElementById("camera-start");
const nameEl = document.getElementById("filter-name");
const indexEl = document.getElementById("filter-index");
const gestureEl = document.getElementById("gesture-status");
const errorEl = document.getElementById("filter-error");

const filters = [
  { name: "LENS DISTORTION", type: "lens" },
  { name: "FOCUS BLOOM", type: "bloom" },
  { name: "COMPRESSION GLITCH", type: "glitch" },
  { name: "SWIRL FOLD", type: "swirl" },
];

const GUIDE_IDLE = "눈 깜빡임 = 다음 필터 · 양손 쥐었다 펴기 = 다음 필터 · 엄지·검지 공간 = 글리치";

let W = 1;
let H = 1;
let tracker;
let last = performance.now();
let active = false;
let filterIndex = 0;
let cameraStarting = false;
let retries = 0;
let pointer = { x: 0.5, y: 0.5 };
let previousGesture = "neutral";
let pinchArmedUntil = 0;
let fistArmedUntil = 0;
let fistChangeCooldownUntil = 0;
let latestHands = [];

function handsClosed(hands) {
  return hands.length >= 2 && hands.every((hand) => (
    hand.pose === "fist" || (hand.openness < 0.4 && hand.fingerCount <= 2)
  ));
}

function handsOpened(hands) {
  return hands.length >= 2 && hands.every((hand) => (
    hand.pose === "open" || (hand.openness > 0.5 && hand.fingerCount >= 3)
  ));
}

function resize() {
  W = innerWidth;
  H = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  source.width = W;
  source.height = H;
}

function drawSource() {
  if (video.readyState < 2) {
    sourceCtx.fillStyle = "#050609";
    sourceCtx.fillRect(0, 0, W, H);
    return;
  }
  const ratio = Math.max(W / video.videoWidth, H / video.videoHeight);
  const dw = video.videoWidth * ratio;
  const dh = video.videoHeight * ratio;
  sourceCtx.save();
  sourceCtx.clearRect(0, 0, W, H);
  sourceCtx.translate(W, 0);
  sourceCtx.scale(-1, 1);
  sourceCtx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  sourceCtx.restore();
}

function setFilter(next, enabled = true) {
  filterIndex = (next + filters.length) % filters.length;
  active = enabled;
  indexEl.textContent = active ? `FILTER 0${filterIndex + 1}` : "FILTER 00";
  nameEl.textContent = active ? filters[filterIndex].name : "CAMERA READY";
}

function nextFilter() {
  setFilter(active ? filterIndex + 1 : filterIndex, true);
}

/** 양손 엄지·검지 끝으로 만든 사각형 (정규화 → 픽셀) */
function dualFingerGate(hands) {
  if (!hands || hands.length < 2) return null;
  const ordered = [...hands].sort((a, b) => a.x - b.x);
  const [left, right] = ordered;
  if (!left?.thumbTip || !left?.indexTip || !right?.thumbTip || !right?.indexTip) return null;

  const points = [
    { x: left.thumbTip.x * W, y: left.thumbTip.y * H },
    { x: left.indexTip.x * W, y: left.indexTip.y * H },
    { x: right.indexTip.x * W, y: right.indexTip.y * H },
    { x: right.thumbTip.x * W, y: right.thumbTip.y * H },
  ];

  // 너무 작거나  degenerate 한 공간은 무시
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  area = Math.abs(area) * 0.5;
  if (area < Math.min(W, H) * Math.min(W, H) * 0.004) return null;

  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { points, cx, cy, area };
}

function pathGate(gate) {
  ctx.beginPath();
  gate.points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

function drawGateOutline(gate, now) {
  ctx.save();
  pathGate(gate);
  ctx.strokeStyle = `rgba(255, 120, 210, ${0.45 + Math.sin(now * 0.006) * 0.15})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const point of gate.points) {
    ctx.fillStyle = "rgba(255, 210, 245, 0.9)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderGlitchInGate(now, gate) {
  ctx.save();
  pathGate(gate);
  ctx.clip();

  // 게이트 안만 글리치 슬라이스
  const minY = Math.min(...gate.points.map((p) => p.y));
  const maxY = Math.max(...gate.points.map((p) => p.y));
  const span = Math.max(24, maxY - minY);
  const slices = Math.max(10, Math.floor(span / 10));

  for (let i = 0; i < slices; i++) {
    const sy = minY + ((i / slices) * span + now * 0.05) % span;
    const sh = 5 + (i % 4) * 4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, sy, W, sh);
    ctx.clip();
    ctx.globalAlpha = 0.78;
    ctx.drawImage(source, Math.sin(now * 0.01 + i) * 28, Math.cos(now * 0.008 + i) * 4, W, H);
    ctx.fillStyle = i % 2 ? "rgba(0,255,230,.18)" : "rgba(255,30,140,.16)";
    ctx.fillRect(0, sy, W, sh);
    ctx.restore();
  }

  // 약간의 RGB 분리
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.22;
  ctx.drawImage(source, 6, 0, W, H);
  ctx.globalAlpha = 0.16;
  ctx.drawImage(source, -5, 1, W, H);
  ctx.restore();

  drawGateOutline(gate, now);
}

function renderFilter(now) {
  drawSource();
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(source, 0, 0, W, H);

  const gate = dualFingerGate(latestHands);
  const { type } = filters[filterIndex];
  const x = pointer.x * W;
  const y = pointer.y * H;

  // 글리치: 양손 엄지·검지 게이트 공간에만 적용
  if (type === "glitch") {
    if (gate) renderGlitchInGate(now, gate);
    return;
  }

  if (!active) {
    if (gate) drawGateOutline(gate, now);
    return;
  }

  if (type === "lens") {
    const r = Math.min(W, H) * 0.18;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = "saturate(1.35) contrast(1.08)";
    ctx.translate(x, y);
    ctx.scale(1.32, 1.32);
    ctx.drawImage(source, -x, -y, W, H);
    ctx.restore();
    ctx.strokeStyle = "rgba(190,255,247,.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r + Math.sin(now * 0.004) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (type === "bloom") {
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.filter = "blur(18px) brightness(1.55) saturate(1.7)";
    ctx.drawImage(source, -10, -10, W + 20, H + 20);
    ctx.restore();
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.min(W, H) * 0.38);
    g.addColorStop(0, "rgba(255,244,254,.35)");
    g.addColorStop(0.45, "rgba(255,110,210,.13)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (type === "swirl") {
    const max = Math.min(W, H) * 0.42;
    for (let r = max; r > 24; r -= 24) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(now * 0.0015 + r * 0.02) * 0.045 * (1 - r / max));
      ctx.translate(-x, -y);
      ctx.drawImage(source, 0, 0, W, H);
      ctx.restore();
    }
  }
}

function handleGesture(code, hands, now, blink = false) {
  latestHands = hands || [];
  if (hands.length) {
    pointer = {
      x: hands.reduce((s, h) => s + h.x, 0) / hands.length,
      y: hands.reduce((s, h) => s + h.y, 0) / hands.length,
    };
  }

  if (blink) {
    nextFilter();
    gestureEl.textContent = `깜빡임 → ${filters[filterIndex].name}`;
  }

  // 양손 쥐기 → 펴기 (pose 코드뿐 아니라 openness로도 감지)
  if (code === "2F" || handsClosed(hands)) fistArmedUntil = now + 4200;
  if (code === "1P") pinchArmedUntil = now + 2600;

  const dualOpen = !blink
    && (code === "2O" || handsOpened(hands))
    && fistArmedUntil > now
    && now >= fistChangeCooldownUntil;
  if (dualOpen) {
    nextFilter();
    fistArmedUntil = 0;
    fistChangeCooldownUntil = now + 900;
    gestureEl.textContent = `양손 펼침 → ${filters[filterIndex].name}`;
  } else if (!blink && code === "1O" && pinchArmedUntil > now) {
    setFilter(filterIndex, !active);
    pinchArmedUntil = 0;
  }

  if (code !== previousGesture) {
    if (code === "2F" || handsClosed(hands)) gestureEl.textContent = "양손 주먹 감지 · 펼치면 필터 변경";
    else if (code === "neutral") gestureEl.textContent = GUIDE_IDLE;
    else if (!dualOpen) gestureEl.textContent = `${code} 감지`;
    previousGesture = code;
  }
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  if (tracker) {
    try {
      const result = tracker.update(now, dt);
      if (result) handleGesture(result.gesture, result.hands, now, result.blink);
    } catch (error) {
      errorEl.textContent = error.message || String(error);
    }
  }
  renderFilter(now);
}

async function start() {
  if (cameraStarting || tracker) return;
  cameraStarting = true;
  startBtn.hidden = true;
  startBtn.disabled = true;
  errorEl.textContent = "";
  try {
    tracker = new GestureTracker(video);
    await tracker.start();
    cameraStarting = false;
  } catch (error) {
    cameraStarting = false;
    tracker?.stop();
    tracker = null;
    errorEl.textContent = `카메라를 시작할 수 없습니다. ${error.message || error}`;
    startBtn.disabled = false;
    if (error.name !== "NotAllowedError" && retries < 1) {
      retries += 1;
      setTimeout(start, 1800);
    } else {
      startBtn.hidden = false;
      startBtn.textContent = "RETRY CAMERA";
    }
  }
}

canvas.addEventListener("pointermove", (event) => {
  pointer = { x: event.clientX / W, y: event.clientY / H };
});
canvas.addEventListener("click", () => {
  if (!active) setFilter(filterIndex, true);
  else nextFilter();
});
addEventListener("wheel", (event) => {
  setFilter(filterIndex + (event.deltaY > 0 ? 1 : -1), true);
}, { passive: true });
addEventListener("resize", resize);
startBtn.addEventListener("click", start);
resize();
gestureEl.textContent = GUIDE_IDLE;
requestAnimationFrame(loop);
start();
