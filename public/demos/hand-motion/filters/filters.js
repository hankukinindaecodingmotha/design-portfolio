import { GestureTracker } from "../hand-tracking.js";

const video = document.getElementById("filter-video");
const canvas = document.getElementById("filter-canvas");
const ctx = canvas.getContext("2d");
const source = document.createElement("canvas");
const sourceCtx = source.getContext("2d");
const startBtn = document.getElementById("camera-toggle");
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

/** 양손 게이트 전용 효과 (메인 필터와 다른 룩) */
const GATE_FX = [
  { name: "GATE GLITCH", type: "glitch" },
  { name: "MIRROR KALEIDO", type: "kaleido" },
  { name: "PIXEL MELT", type: "pixel" },
  { name: "CHROMA PORTAL", type: "chroma" },
  { name: "SCAN WAVE", type: "scan" },
  { name: "INK NEGATIVE", type: "ink" },
];

const GUIDE_IDLE = "눈 깜빡임 = 다음 필터 · 글리치에서 엄지·검지 터치 = 새 게이트 효과";

let W = 1;
let H = 1;
let tracker;
let last = performance.now();
let active = false;
let filterIndex = 0;
let gateFxIndex = 0;
let cameraStarting = false;
let pointer = { x: 0.5, y: 0.5 };
let previousGesture = "neutral";
let pinchArmedUntil = 0;
let fistArmedUntil = 0;
let fistChangeCooldownUntil = 0;
let wasGatePinching = false;
let gatePinchCooldownUntil = 0;
let latestHands = [];
let lastGate = null;

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

function isGatePinching(hands) {
  if (!hands?.length) return false;
  return hands.some((hand) => (
    hand.pose === "pinch" || (typeof hand.pinchRatio === "number" && hand.pinchRatio < 0.48)
  ));
}

function nextGateFx() {
  gateFxIndex = (gateFxIndex + 1) % GATE_FX.length;
  if (filters[filterIndex].type === "glitch") {
    nameEl.textContent = GATE_FX[gateFxIndex].name;
    indexEl.textContent = `GATE 0${gateFxIndex + 1}`;
  }
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
  const current = filters[filterIndex];
  if (active && current.type === "glitch") {
    indexEl.textContent = `GATE 0${gateFxIndex + 1}`;
    nameEl.textContent = GATE_FX[gateFxIndex].name;
  } else {
    indexEl.textContent = active ? `FILTER 0${filterIndex + 1}` : "FILTER 00";
    nameEl.textContent = active ? current.name : "CAMERA READY";
  }
}

function nextFilter() {
  setFilter(active ? filterIndex + 1 : filterIndex, true);
}

/** 양손 엄지·검지 끝으로 만든 사각형 (정규화 → 픽셀) */
function dualFingerGate(hands, minAreaScale = 0.004) {
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

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  area = Math.abs(area) * 0.5;
  if (area < Math.min(W, H) * Math.min(W, H) * minAreaScale) return null;

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

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.22;
  ctx.drawImage(source, 6, 0, W, H);
  ctx.globalAlpha = 0.16;
  ctx.drawImage(source, -5, 1, W, H);
  ctx.restore();
}

/** 4면 미러 카레이도 */
function renderKaleidoInGate(now, gate) {
  const { cx, cy } = gate;
  const pulse = 1 + Math.sin(now * 0.003) * 0.04;
  ctx.save();
  pathGate(gate);
  ctx.clip();
  ctx.drawImage(source, 0, 0, W, H);

  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((Math.PI / 2) * i + now * 0.00025);
    ctx.scale(i % 2 ? -pulse : pulse, pulse);
    ctx.globalAlpha = 0.42;
    ctx.drawImage(source, -cx, -cy, W, H);
    ctx.restore();
  }
  ctx.restore();
}

/** 큰 픽셀이 녹아내리듯 어긋남 */
function renderPixelInGate(now, gate) {
  const minX = Math.min(...gate.points.map((p) => p.x));
  const maxX = Math.max(...gate.points.map((p) => p.x));
  const minY = Math.min(...gate.points.map((p) => p.y));
  const maxY = Math.max(...gate.points.map((p) => p.y));
  const block = Math.max(10, Math.floor(Math.sqrt(gate.area) / 14));

  ctx.save();
  pathGate(gate);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;

  for (let y = minY; y < maxY; y += block) {
    const drift = Math.sin(now * 0.004 + y * 0.05) * block * 1.6;
    for (let x = minX; x < maxX; x += block) {
      const sx = Math.max(0, Math.min(W - 1, x + drift));
      const sy = Math.max(0, Math.min(H - 1, y + Math.cos(now * 0.003 + x * 0.04) * 4));
      ctx.drawImage(source, sx, sy, block, block, x, y, block + 1, block + 1);
    }
  }

  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "rgba(120,255,210,.35)";
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  ctx.restore();
}

/** 중심에서 RGB가 갈라지는 포털 */
function renderChromaInGate(now, gate) {
  const { cx, cy } = gate;
  const spread = 8 + Math.sin(now * 0.005) * 6;
  ctx.save();
  pathGate(gate);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.85;

  ctx.save();
  ctx.translate(spread, 0);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(source, 0, 0, W, H);
  ctx.fillStyle = "rgba(255,40,80,.22)";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.save();
  ctx.translate(-spread, 0);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(source, 0, 0, W, H);
  ctx.fillStyle = "rgba(40,220,255,.22)";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.55;
  ctx.translate(cx, cy);
  ctx.scale(1.08 + Math.sin(now * 0.004) * 0.04, 1.08);
  ctx.drawImage(source, -cx, -cy, W, H);
  ctx.restore();
}

/** CRT 스캔라인 + 물결 왜곡 */
function renderScanInGate(now, gate) {
  const minY = Math.min(...gate.points.map((p) => p.y));
  const maxY = Math.max(...gate.points.map((p) => p.y));
  const span = Math.max(20, maxY - minY);

  ctx.save();
  pathGate(gate);
  ctx.clip();

  for (let i = 0; i < Math.ceil(span / 3); i++) {
    const y = minY + i * 3;
    const wave = Math.sin(now * 0.008 + i * 0.35) * 14;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, 3);
    ctx.clip();
    ctx.drawImage(source, wave, Math.sin(now * 0.002 + i) * 2, W, H);
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(0,0,0,.22)";
      ctx.fillRect(0, y, W, 1);
    }
    ctx.restore();
  }

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = `rgba(80,255,180,${0.15 + Math.sin(now * 0.01) * 0.08})`;
  ctx.fillRect(0, minY + ((now * 0.12) % span), W, 10);
  ctx.restore();
}

/** 잉크 네거티브 / 포스터 대비 */
function renderInkInGate(now, gate) {
  ctx.save();
  pathGate(gate);
  ctx.clip();
  ctx.filter = "invert(1) contrast(1.35) saturate(0.2) brightness(1.05)";
  ctx.drawImage(source, 0, 0, W, H);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = `rgba(255, ${90 + Math.sin(now * 0.004) * 40}, 160, .85)`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.2;
  ctx.drawImage(source, Math.sin(now * 0.006) * 4, 0, W, H);
  ctx.restore();
}

function renderGateEffect(now, gate) {
  const fx = GATE_FX[gateFxIndex].type;
  if (fx === "glitch") renderGlitchInGate(now, gate);
  else if (fx === "kaleido") renderKaleidoInGate(now, gate);
  else if (fx === "pixel") renderPixelInGate(now, gate);
  else if (fx === "chroma") renderChromaInGate(now, gate);
  else if (fx === "scan") renderScanInGate(now, gate);
  else if (fx === "ink") renderInkInGate(now, gate);
  drawGateOutline(gate, now);
}

function renderFilter(now) {
  drawSource();
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(source, 0, 0, W, H);

  const pinching = isGatePinching(latestHands);
  // 핀치 중에는 면적 임계를 낮춰 게이트가 바로 사라지지 않게
  const gate = dualFingerGate(latestHands, pinching ? 0.0012 : 0.004) || (pinching ? lastGate : null);
  if (gate) lastGate = gate;
  else if (!pinching) lastGate = null;

  const { type } = filters[filterIndex];
  const x = pointer.x * W;
  const y = pointer.y * H;

  // 글리치 모드 = 게이트 플레이그라운드 (핀치로 게이트 효과 순환)
  if (type === "glitch") {
    if (gate) renderGateEffect(now, gate);
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

  const onGlitch = filters[filterIndex].type === "glitch";
  const pinching = isGatePinching(hands);

  // 글리치(게이트) 모드에서 엄지·검지 닿으면 게이트 안 효과 변경
  if (onGlitch && pinching && !wasGatePinching && now >= gatePinchCooldownUntil) {
    nextGateFx();
    gatePinchCooldownUntil = now + 650;
    gestureEl.textContent = `게이트 효과 → ${GATE_FX[gateFxIndex].name}`;
  }
  wasGatePinching = pinching;

  if (blink) {
    nextFilter();
    gestureEl.textContent = `깜빡임 → ${filters[filterIndex].name}`;
  }

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
  } else if (!blink && !onGlitch && code === "1O" && pinchArmedUntil > now) {
    setFilter(filterIndex, !active);
    pinchArmedUntil = 0;
  }

  if (code !== previousGesture) {
    if (code === "2F" || handsClosed(hands)) gestureEl.textContent = "양손 주먹 감지 · 펼치면 필터 변경";
    else if (code === "neutral" && !pinching) gestureEl.textContent = GUIDE_IDLE;
    else if (!dualOpen && !(onGlitch && pinching)) gestureEl.textContent = `${code} 감지`;
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

function setCameraUi(on, busy = false) {
  startBtn.classList.toggle("is-busy", busy);
  startBtn.setAttribute("aria-pressed", on ? "true" : "false");
  startBtn.setAttribute("aria-busy", busy ? "true" : "false");
  if (busy) startBtn.textContent = on ? "끄는 중…" : "권한 요청 중…";
  else startBtn.textContent = on ? "카메라 끄기" : "카메라 켜기";
}

function stopCamera() {
  cameraStarting = false;
  tracker?.stop();
  tracker = null;
  video.srcObject = null;
  latestHands = [];
  lastGate = null;
  wasGatePinching = false;
  errorEl.textContent = "";
  gestureEl.textContent = "카메라가 꺼져 있습니다. 분홍 버튼으로 다시 켤 수 있어요.";
  nameEl.textContent = "CAMERA OFF";
  indexEl.textContent = "FILTER 00";
  setCameraUi(false);
}

async function start() {
  if (cameraStarting) return;
  if (tracker) {
    stopCamera();
    return;
  }
  cameraStarting = true;
  setCameraUi(false, true);
  errorEl.textContent = "";
  gestureEl.textContent = "브라우저 카메라 권한을 허용해 주세요…";
  const pending = new GestureTracker(video);
  try {
    await pending.start();
    if (!cameraStarting) {
      // 로딩 중 사용자가 취소함
      pending.stop();
      return;
    }
    tracker = pending;
    cameraStarting = false;
    gestureEl.textContent = GUIDE_IDLE;
    setFilter(filterIndex, active);
    setCameraUi(true);
  } catch (error) {
    cameraStarting = false;
    pending.stop();
    tracker = null;
    video.srcObject = null;
    const denied = error.name === "NotAllowedError" || error.name === "PermissionDeniedError";
    errorEl.textContent = denied
      ? "카메라 권한이 거부되었습니다. 주소창 카메라 아이콘에서 허용 후 다시 눌러 주세요."
      : `카메라를 시작할 수 없습니다. ${error.message || error}`;
    gestureEl.textContent = "카메라 켜기 버튼을 다시 눌러 주세요.";
    setCameraUi(false);
  }
}

function toggleCamera() {
  if (tracker || cameraStarting) {
    stopCamera();
    return;
  }
  start();
}

canvas.addEventListener("pointermove", (event) => {
  pointer = { x: event.clientX / W, y: event.clientY / H };
});
canvas.addEventListener("click", () => {
  if (!tracker) return;
  if (!active) setFilter(filterIndex, true);
  else nextFilter();
});
addEventListener("wheel", (event) => {
  if (!tracker) return;
  setFilter(filterIndex + (event.deltaY > 0 ? 1 : -1), true);
}, { passive: true });
addEventListener("resize", resize);
startBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleCamera();
});
resize();
gestureEl.textContent = "오른쪽 아래 분홍 버튼으로 카메라를 켜 주세요.";
nameEl.textContent = "CAMERA OFF";
setCameraUi(false);
requestAnimationFrame(loop);
