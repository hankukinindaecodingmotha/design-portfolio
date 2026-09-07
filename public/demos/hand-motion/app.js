import {
  FilesetResolver,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
import {
  POSES,
  POSE_LABELS,
  CLASSIC_POSE_LABELS,
  VISUAL_MODES,
  FINGER_CHAINS,
  BONE_CONNECTIONS,
  detectPose,
  detectHeart,
  analyzeJoints,
} from "./motions.js";
import { createQuintessence } from "./quintessence.js";

const INDEX_TIP = 8;
const THUMB_TIP = 4;
const WRIST = 0;
const MIDDLE_MCP = 9;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_TIP = 20;
const FINGER_TIPS = [4, 8, 12, 16, 20];

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const MIRROR_CAMERA = true;
/** classic | quintessence — HTML body[data-experience] */
const EXPERIENCE = document.body?.dataset?.experience || "quintessence";
const IS_QUINT = EXPERIENCE === "quintessence";
const IS_CLASSIC = EXPERIENCE === "classic";
const ACTIVE_POSE_LABELS = IS_CLASSIC ? CLASSIC_POSE_LABELS : POSE_LABELS;
const quint = IS_QUINT ? createQuintessence() : null;

const TOGETHER_DIST = 0.14;
const SPREAD_DIST = 0.38;
const MAX_HANDS = 4; // 2명 × 양손
const PLAYER_SPLIT_GAP = 0.22; // 화면 X 간격이 이보다 크면 다른 사람
/** P1 왼/오, P2 왼/오 */
const HAND_HUES = [0.58, 0.78, 0.12, 0.95];
const PLAYER_LABELS = ["P1", "P2"];
/** 이펙트 전체 스케일 — 너무 크면 제스처 확인이 어려움 */
const FX_SCALE = 0.36;
const fxS = (n) => n * FX_SCALE;

const startScreen = document.getElementById("start-screen");
const stage = document.getElementById("stage");
const startBtn = document.getElementById("start-btn");
const demoBtn = document.getElementById("demo-btn");
const stopBtn = document.getElementById("stop-btn");
const arBtn = document.getElementById("ar-btn");
const modeBar = document.getElementById("mode-bar");
const modeLabelEl = document.getElementById("mode-label");
const testPanel = document.getElementById("test-panel");
const hintEl = document.getElementById("hint");
const errorMsg = document.getElementById("error-msg");
const stageError = document.getElementById("stage-error");
const video = document.getElementById("camera");
const canvas = document.getElementById("visual-canvas");
const fxCanvas = document.getElementById("fx-canvas");
const statusEl = document.getElementById("status");
const ctx = canvas.getContext("2d");
let fx = null;
async function initFx() {
  if (!fxCanvas || fx) return fx;
  try {
    const mod = await Promise.race([
      import("./fx.js"),
      new Promise((_, rej) => setTimeout(() => rej(new Error("fx timeout")), 10000)),
    ]);
    const Engine = mod.EffectsEngine || mod.default;
    if (!Engine) throw new Error("EffectsEngine export missing");
    fx = new Engine(fxCanvas);
    resize();
  } catch (err) {
    console.warn("WebGL 이펙트 초기화 실패 — 2D 폴백", err);
    fx = null;
  }
  return fx;
}

let landmarker = null;
let stream = null;
let rafId = null;
let lastVideoTime = -1;
let frameTimestamp = 0;
let demoAnimId = null;

const urlParams = new URLSearchParams(location.search);
const isDemoUrl = urlParams.has("demo");
const VIEW_MODES = {
  ar: {
    id: "ar",
    label: "AR",
    camera: true,
    effects: true,
    joints: true,
    landmarkDebug: false,
    autoFx: false,
    hint: "카메라 위 오버레이 · 손 제스처 이펙트",
  },
  track: {
    id: "track",
    label: "파악",
    camera: true,
    effects: false,
    joints: true,
    landmarkDebug: true,
    autoFx: false,
    hint: "손가락·관절·포즈 라벨만 표시 (이펙트 최소화)",
  },
  art: {
    id: "art",
    label: "아트",
    camera: false,
    effects: true,
    joints: false,
    landmarkDebug: false,
    autoFx: false,
    hint: IS_QUINT ? "우주 배경 · 네 원소 + 에테르 풀 연출" : "다크 캔버스 · 전기·필터 풀 연출",
  },
  fx: {
    id: "fx",
    label: "이펙트",
    camera: false,
    effects: true,
    joints: false,
    landmarkDebug: false,
    autoFx: false,
    hint: IS_QUINT ? "우주 이펙트만 · 스켈레톤/라벨 숨김" : "이펙트만 · 스켈레톤/라벨 숨김",
  },
  test: {
    id: "test",
    label: "테스트",
    camera: false,
    effects: true,
    joints: false,
    landmarkDebug: false,
    autoFx: true,
    hint: IS_QUINT
      ? "버튼으로 중력우물·성운·파기·에테르 주입 · 우주 이펙트 확인"
      : "버튼으로 필터/전기 주입 · 이펙트 단독 확인",
  },
};
const initialViewMode = VIEW_MODES[urlParams.get("mode")] ? urlParams.get("mode") : "ar";

const state = {
  hands: [],
  handsTogether: false,
  handsSpread: false,
  togetherBlend: 0,
  spreadBlend: 0,
  wasHandsTogether: false,
  wasHandsSpread: false,
  mergePulse: 0,
  clapFlash: 0,
  vortexPhase: 0,
  gridPhase: 0,
  hue: 0.65,
  visualMode: 0,
  wasPinching: [false, false, false, false],
  wasPose: [POSES.NEUTRAL, POSES.NEUTRAL, POSES.NEUTRAL, POSES.NEUTRAL],
  trails: [[], [], [], []],
  fingerTrails: [[], [], [], []], // 검지 끝으로 그린 궤적
  filterZones: [], // {points, life, hue, style}
  filterStyleIdx: 0,
  filterImageIdx: 0,
  liveTipLinks: [], // [[x1,y1,x2,y2,hue], ...]
  liveTipHulls: [], // [{points, hue, style}]
  tipGaps: {}, // 손끝 붙임→벌림 제스처 상태
  players: [], // [{id, hands:[...], together, spread, heart, combo}]
  crossLink: null, // 두 사람 사이 상호작용
  wasCrossLink: null,
  particles: [],
  shockwaves: [],
  ripples: [],
  swipeHistory: [],
  swipeCooldown: 0,
  idlePhase: 0,
  prevHandDist: 1,
  prevPalmX: [0.5, 0.5, 0.5, 0.5],
  prevPalmY: [0.5, 0.5, 0.5, 0.5],
  digEnergy: 0,
  shake: 0,
  earthDebris: [],
  cosmosPhase: 0,
  orbitAngle: 0,
  heartActive: false,
  heartPulse: 0,
  shields: [],
  waveRings: [],
  ribbons: [],
  wasHeart: false,
  jointSparks: [],
  showJoints: true,
  viewMode: "ar",
  showEffects: true,
  landmarkDebug: false,
  autoFx: false,
  testPulse: 0,
  arMode: true, // 카메라 배경 (AR/파악)
  duoCombo: null,
  wasDuoCombo: null,
  duoPhase: 0,
  duoEnergy: 0,
  duoFlow: [],
};


function showStartError(message) {
  errorMsg.hidden = false;
  errorMsg.textContent = message;
  try { errorMsg.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch {}
}

function showStageError(message) {
  if (stageError) {
    stageError.hidden = !message;
    stageError.textContent = message || "";
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function mirrorX(x) {
  return MIRROR_CAMERA ? 1 - x : x;
}

function palmCenter(lm) {
  return {
    x: mirrorX((lm[WRIST].x + lm[MIDDLE_MCP].x) / 2),
    y: (lm[WRIST].y + lm[MIDDLE_MCP].y) / 2,
  };
}

function pinchDistance(lm) {
  return Math.hypot(lm[THUMB_TIP].x - lm[INDEX_TIP].x, lm[THUMB_TIP].y - lm[INDEX_TIP].y);
}

function handOpenness(lm) {
  const cx = mirrorX((lm[WRIST].x + lm[MIDDLE_MCP].x) / 2);
  const cy = (lm[WRIST].y + lm[MIDDLE_MCP].y) / 2;
  const tips = [4, 8, 12, 16, 20];
  const avg =
    tips.reduce((s, idx) => s + Math.hypot(mirrorX(lm[idx].x) - cx, lm[idx].y - cy), 0) /
    tips.length;
  return Math.max(0, Math.min(1, (avg - 0.08) / 0.18));
}

function tipPos(lm, idx) {
  return { x: mirrorX(lm[idx].x), y: lm[idx].y };
}

function hsvColor(h, s, v, a = 1) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  const sector = Math.floor(h * 6) % 6;
  if (sector === 0) [r, g, b] = [c, x, 0];
  else if (sector === 1) [r, g, b] = [x, c, 0];
  else if (sector === 2) [r, g, b] = [0, c, x];
  else if (sector === 3) [r, g, b] = [0, x, c];
  else if (sector === 4) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return `rgba(${(r + m) * 255 | 0},${(g + m) * 255 | 0},${(b + m) * 255 | 0},${a})`;
}

/** 점/구름형 파티클은 전기·필터 가독성을 위해 비활성 */
function spawnBurst(_x, _y, _count = 18, _speed = 6, _hue = null) {
  /* no-op: 점/파티클 제거 — 전기·필터 가독성 */
}

function spawnUpward(_x, _y, _n = 12) {
  /* no-op */
}

function spawnRainbow(_x, _y, _n = 8) {
  /* no-op */
}

/** 주먹으로 파기 → 대지 파편 + 진동 */
function spawnEarthDig(x, y, power = 1) {
  if (IS_QUINT && quint) {
    const W = canvas?.width || 1;
    const H = canvas?.height || 1;
    quint.onDig(x / W, y / H, W, H);
  }
  const n = Math.max(6, Math.min(28, Math.floor(8 + power * 16)));
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
    const spd = (2.2 + Math.random() * 5.5) * power;
    state.earthDebris.push({
      x: x + (Math.random() - 0.5) * 36,
      y: y + (Math.random() - 0.5) * 10,
      vx: Math.cos(ang) * spd * (Math.random() > 0.5 ? 1 : -1) * 0.55,
      vy: Math.sin(ang) * spd,
      life: 0.85 + Math.random() * 0.4,
      size: 2 + Math.random() * 5,
      hue: 0.06 + Math.random() * 0.07,
    });
  }
  // 지면 균열 느낌의 짧은 충격파
  state.shockwaves.push({ x, y, r: 8, life: 0.9, hue: 0.08 });
  state.shake = Math.min(1, state.shake + 0.28 * power);
  state.digEnergy = Math.min(1.2, state.digEnergy + 0.22 * power);
}

function updateEarthWorld(dt, w, h) {
  for (const p of state.earthDebris) {
    p.vy += 22 * dt;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.985;
    p.life -= dt * 0.85;
  }
  state.earthDebris = state.earthDebris.filter((p) => p.life > 0 && p.y < h + 50);
  state.shake = Math.max(0, state.shake - dt * 2.4);
  state.digEnergy = Math.max(0, state.digEnergy - dt * 0.4);
  state.cosmosPhase += dt;
}

function drawEarthWorld(w, h) {
  if (state.digEnergy > 0.02) {
    const g = ctx.createLinearGradient(0, h * 0.72, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(90, 48, 18, ${0.18 * state.digEnergy})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 갈라진 지면 라인
    ctx.save();
    ctx.strokeStyle = `rgba(210, 140, 60, ${0.35 * state.digEnergy})`;
    ctx.lineWidth = 1.2;
    const baseY = h * 0.82;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      let x = w * (0.15 + i * 0.15);
      ctx.moveTo(x, baseY);
      for (let k = 0; k < 4; k++) {
        x += (Math.random() - 0.5) * 40;
        ctx.lineTo(x, baseY - 8 - Math.random() * 28 * state.digEnergy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const p of state.earthDebris) {
    ctx.fillStyle = hsvColor(p.hue, 0.75, 0.9, Math.max(0, p.life) * 0.9);
    ctx.fillRect(p.x, p.y, p.size, p.size * 0.75);
  }
}

function drawCosmosDust(w, h) {
  // 아주 옅은 별가루 — 우주감 (가독성 해치지 않게)
  const a = 0.07 + state.digEnergy * 0.05;
  ctx.save();
  for (let i = 0; i < 28; i++) {
    const x = ((i * 97 + state.cosmosPhase * 12) % w);
    const y = ((i * 53 + Math.sin(state.cosmosPhase + i) * 20) % (h * 0.7));
    ctx.fillStyle = `rgba(220, 230, 255, ${a * (0.35 + (i % 5) * 0.1)})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  ctx.restore();
}

function addShield(x, y, hue) {
  state.shields.push({ x, y, r: 20, life: 1, hue });
}

function addWaveRing(x, y, dir = 1) {
  state.waveRings.push({ x, y, w: 10, life: 1, dir });
}

function addRibbon(x, y, vx) {
  const last = state.ribbons[state.ribbons.length - 1];
  if (last && last.life > 0.4) {
    const prev = last.points[last.points.length - 1];
    if (Math.hypot(x - prev.x, y - prev.y) < 40) {
      last.points.push({ x, y });
      return;
    }
  }
  state.ribbons.push({ x, y, vx, life: 1, points: [{ x, y }] });
}

function drawLightningBolt(x1, y1, x2, y2, hue, segments = 5) {
  ctx.strokeStyle = hsvColor(hue, 1, 1, 0.9);
  ctx.lineWidth = Math.max(1.4, fxS(2.2));
  ctx.shadowColor = hsvColor(hue, 1, 1, 0.6);
  ctx.shadowBlur = fxS(8);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const mx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 18;
    const my = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 18;
    ctx.lineTo(mx, my);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}


/** 얇은 전기 아크 (사람을 덜 가림) */
function drawElectricArc(x1, y1, x2, y2, hue, segs = 7, amp = 10) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // 코어
  ctx.strokeStyle = hsvColor(hue, 0.35, 1, 0.95);
  ctx.lineWidth = Math.max(1.1, fxS(1.6));
  ctx.shadowColor = hsvColor(hue, 0.8, 1, 0.7);
  ctx.shadowBlur = fxS(6);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const jx = (Math.random() - 0.5) * fxS(amp);
    const jy = (Math.random() - 0.5) * fxS(amp);
    ctx.lineTo(x1 + (x2 - x1) * t + jx, y1 + (y2 - y1) * t + jy);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // 외곽 글로우(얇게)
  ctx.strokeStyle = hsvColor(hue, 0.9, 1, 0.35);
  ctx.lineWidth = Math.max(1.8, fxS(3.2));
  ctx.shadowBlur = fxS(10);
  ctx.stroke();
  ctx.restore();
}

function drawElectricCorona(cx, cy, hue, rays = 6) {
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + state.idlePhase * 2;
    const len = fxS(18 + Math.random() * 14);
    drawElectricArc(
      cx, cy,
      cx + Math.cos(a) * len,
      cy + Math.sin(a) * len,
      hue + i * 0.03, 4, 6,
    );
  }
}

function polygonArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(a) * 0.5;
}

function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return len;
}

const FILTER_STYLES = ["neon", "frost", "matrix", "warm"];

/** 손끝 4꼭짓점 공간에 씌울 반투명 패턴 필터 이미지 */
const FILTER_IMAGE_SRCS = [
  "./filters/pattern-ink.png",
  "./filters/pattern-green.png",
  "./filters/pattern-topo.png",
];
const FILTER_IMAGES = FILTER_IMAGE_SRCS.map((src, i) => {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  img.dataset.idx = String(i);
  return img;
});
function nextFilterImageIdx() {
  const idx = state.filterImageIdx % FILTER_IMAGES.length;
  state.filterImageIdx = (state.filterImageIdx + 1) % FILTER_IMAGES.length;
  return idx;
}

function addFilterZone(points, hue) {
  if (!points || points.length < 8) return;
  const area = polygonArea(points);
  if (area < 2800) return; // 너무 작으면 무시
  const style = FILTER_STYLES[state.filterStyleIdx % FILTER_STYLES.length];
  state.filterStyleIdx = (state.filterStyleIdx + 1) % FILTER_STYLES.length;
  state.filterZones.push({
    points: points.map((p) => p.slice()),
    life: 1,
    hue,
    style,
  });
  playBlip(640, 0.12);
  setStatus(`🪄 영역 필터 · ${style}`);
}

function updateFingerDrawing(hand, lm, w, h, idx) {
  if (!lm) return;
  if (!state.fingerTrails[idx]) state.fingerTrails[idx] = [];
  const trail = state.fingerTrails[idx];
  const tip = tipPos(lm, INDEX_TIP);
  const tx = tip.x * w, ty = tip.y * h;

  // 검지 가리키기로 영역 그리기 / 핀치로 확정·삭제
  if (hand.pose === POSES.POINT) {
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(tx - last[0], ty - last[1]) > 4) {
      trail.push([tx, ty]);
      if (trail.length > 160) trail.shift();
    }
    // 루프 닫힘: 시작점 근처로 돌아오고 길이가 충분
    if (trail.length >= 18) {
      const first = trail[0];
      const close = Math.hypot(tx - first[0], ty - first[1]);
      const plen = pathLength(trail);
      if (close < 28 && plen > 140) {
        addFilterZone(trail, handHue(hand));
        state.fingerTrails[idx] = [];
      }
    }
  } else if (hand.pose === POSES.PINCH) {
    // 핀치: 그리는 중이면 강제 닫기, 아니면 가까운 필터 삭제
    if (trail.length >= 12) {
      trail.push([tx, ty]);
      addFilterZone(trail, handHue(hand));
      state.fingerTrails[idx] = [];
    } else if (!state.wasPinching[idx] && state.filterZones.length) {
      // 핀치 시작 시 가장 가까운 존 제거
      let best = -1, bestD = Infinity;
      state.filterZones.forEach((z, zi) => {
        const cx = z.points.reduce((s, p) => s + p[0], 0) / z.points.length;
        const cy = z.points.reduce((s, p) => s + p[1], 0) / z.points.length;
        const d = Math.hypot(tx - cx, ty - cy);
        if (d < bestD) { bestD = d; best = zi; }
      });
      if (best >= 0 && bestD < 120) {
        state.filterZones.splice(best, 1);
        setStatus("필터 영역 해제");
        playBlip(220, 0.1);
      }
    }
    if (trail.length && hand.pose !== POSES.POINT) {
      // keep
    }
  } else if (hand.pose !== POSES.POINT && trail.length) {
    // 포즈가 바뀌면 미완성 궤적은 천천히 소멸(다음 프레임에서 길이 축소)
    if (trail.length > 2) trail.splice(0, 2);
    else state.fingerTrails[idx] = [];
  }
}

function drawFingerTrails(w, h) {
  state.fingerTrails.forEach((trail, idx) => {
    if (!trail || trail.length < 2) return;
    const hue = handHue(state.hands[idx] || { index: idx });
    ctx.save();
    ctx.strokeStyle = hsvColor(hue, 0.8, 1, 0.85);
    ctx.lineWidth = Math.max(1.5, fxS(2.4));
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    trail.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    ctx.setLineDash([]);
    // 시작점 힌트
    const f = trail[0];
    ctx.strokeStyle = hsvColor(hue, 0.5, 1, 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(f[0], f[1], 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function paintFilterInside(points, hue, style, alpha, w, h) {
  const a = Math.min(0.55, alpha);
  ctx.save();
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();

  if (style === "neon") {
    ctx.fillStyle = hsvColor(hue, 0.7, 1, a * 0.28);
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = hsvColor(hue, 0.4, 1, a * 0.4);
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y + (state.idlePhase * 30) % 6);
      ctx.lineTo(w, y + (state.idlePhase * 30) % 6);
      ctx.stroke();
    }
  } else if (style === "frost") {
    ctx.fillStyle = `rgba(180,220,255,${a * 0.32})`;
    ctx.fill();
    ctx.clip();
    /* frost snow dots removed */
  } else if (style === "matrix") {
    ctx.fillStyle = `rgba(0,40,20,${a * 0.35})`;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = `rgba(80,255,140,${a * 0.5})`;
    ctx.font = "11px monospace";
    for (let x = 0; x < w; x += 18) {
      for (let y = 0; y < h; y += 16) {
        if (((x * 13 + y * 7) | 0) % 5 === 0) {
          ctx.fillText(String((x + y + (state.idlePhase * 40 | 0)) % 10), x, y);
        }
      }
    }
  } else {
    ctx.fillStyle = hsvColor((hue + 0.08) % 1, 0.85, 1, a * 0.3);
    ctx.fill();
    ctx.clip();
    const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
    const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
    const g = ctx.createRadialGradient(cx, cy, 12, cx, cy, Math.max(w, h) * 0.28);
    g.addColorStop(0, `rgba(255,200,120,${a * 0.22})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

function drawFilterZones(w, h) {
  state.filterZones = state.filterZones.filter((z) => z.life > 0.02);
  for (const z of state.filterZones) {
    z.life -= 0.0018; // ~9초
    const a = Math.min(0.55, z.life * 0.55);
    paintFilterInside(z.points, z.hue, z.style, a, w, h);

    // 테두리 전기
    ctx.save();
    ctx.beginPath();
    z.points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.strokeStyle = hsvColor(z.hue, 0.7, 1, Math.min(0.9, z.life));
    ctx.lineWidth = Math.max(1.4, fxS(2));
    ctx.stroke();
    if (Math.random() < 0.4) {
      const i = (Math.random() * z.points.length) | 0;
      const j = (i + 1) % z.points.length;
      drawElectricArc(z.points[i][0], z.points[i][1], z.points[j][0], z.points[j][1], z.hue, 5, 8);
    }
    ctx.restore();
  }
}

/** 볼록 껍질 (Andrew monotone chain) */
function convexHull(points) {
  const pts = points
    .map((p) => [p[0], p[1]])
    .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** 4점 시계/반시계 정렬 (볼록 사각형 꼭짓점) */
function orderQuadPoints(nodes) {
  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
  return nodes
    .slice()
    .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

function tipGroupKey(nodes) {
  return nodes
    .map((n) => `${n.hand}:${n.tip}`)
    .sort()
    .join("|");
}

function groupSpan(nodes) {
  let maxD = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      maxD = Math.max(maxD, Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y));
    }
  }
  return maxD;
}

/** 중심에서 가장 먼 손끝 거리 — 모음/벌림 판정에 더 안정적 */
function groupRadius(nodes) {
  if (!nodes.length) return 0;
  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
  let r = 0;
  for (const n of nodes) r = Math.max(r, Math.hypot(n.x - cx, n.y - cy));
  return r;
}

/** 이미지 UV 삼각형을 화면 삼각형에 아핀 매핑 (반투명 필터용) */
function drawTexturedTriangle(img, p0, p1, p2, u0, v0, u1, v1, u2, v2) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return;
  const x0 = u0 * w, y0 = v0 * h;
  const x1 = u1 * w, y1 = v1 * h;
  const x2 = u2 * w, y2 = v2 * h;
  const denom = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
  if (Math.abs(denom) < 1e-5) return;

  const m11 = (p0[0] * (y1 - y2) + p1[0] * (y2 - y0) + p2[0] * (y0 - y1)) / denom;
  const m12 = (p0[0] * (x2 - x1) + p1[0] * (x0 - x2) + p2[0] * (x1 - x0)) / denom;
  const m13 = (p0[0] * (x1 * y2 - x2 * y1) + p1[0] * (x2 * y0 - x0 * y2) + p2[0] * (x0 * y1 - x1 * y0)) / denom;
  const m21 = (p0[1] * (y1 - y2) + p1[1] * (y2 - y0) + p2[1] * (y0 - y1)) / denom;
  const m22 = (p0[1] * (x2 - x1) + p1[1] * (x0 - x2) + p2[1] * (x1 - x0)) / denom;
  const m23 = (p0[1] * (x1 * y2 - x2 * y1) + p1[1] * (x2 * y0 - x0 * y2) + p2[1] * (x0 * y1 - x1 * y0)) / denom;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  ctx.lineTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.closePath();
  ctx.clip();
  ctx.transform(m11, m21, m12, m22, m13, m23);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** 사각형 꼭짓점에 패턴 이미지를 반투명으로 입힘 — 카메라/배경이 비침 */
function drawImageFilterQuad(points, imageIdx, alpha = 0.48) {
  if (!points || points.length < 4) return;
  const img = FILTER_IMAGES[((imageIdx % FILTER_IMAGES.length) + FILTER_IMAGES.length) % FILTER_IMAGES.length];
  if (!img?.complete || !img.naturalWidth) return;
  const [p0, p1, p2, p3] = points;
  ctx.save();
  ctx.globalAlpha = alpha;
  // 밝은 패턴은 살짝 multiply로 뒤가 더 잘 보이게
  ctx.globalCompositeOperation = "source-over";
  drawTexturedTriangle(img, p0, p1, p2, 0, 0, 1, 0, 1, 1);
  drawTexturedTriangle(img, p0, p2, p3, 0, 0, 1, 1, 0, 1);
  ctx.restore();
  // 한 번 더 아주 옅게 multiply → 배경 실루엣 유지
  ctx.save();
  ctx.globalAlpha = Math.min(0.35, alpha * 0.55);
  ctx.globalCompositeOperation = "multiply";
  drawTexturedTriangle(img, p0, p1, p2, 0, 0, 1, 0, 1, 1);
  drawTexturedTriangle(img, p0, p2, p3, 0, 0, 1, 1, 0, 1);
  ctx.restore();
}

function collectTipNodes(landmarksList, w, h) {
  const nodes = [];
  state.hands.forEach((hand) => {
    const lm = landmarksList[hand.index];
    if (!lm) return;
    for (const tipIdx of FINGER_TIPS) {
      const p = tipPos(lm, tipIdx);
      nodes.push({
        x: p.x * w,
        y: p.y * h,
        hand: hand.index,
        tip: tipIdx,
        hue: handHue(hand),
      });
    }
  });
  return nodes;
}

/** 손끝 4개를 꼭짓점으로 하는 필터 후보 그룹 수집 */
function collectQuadGroups(nodes) {
  const groups = [];
  const byHand = new Map();
  for (const n of nodes) {
    if (!byHand.has(n.hand)) byHand.set(n.hand, []);
    byHand.get(n.hand).push(n);
  }

  // 1) 한 손 네 손가락(검지·중지·약지·소지) = 사각형 꼭짓점
  const FOUR = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];
  for (const [handId, tips] of byHand) {
    const quad = FOUR.map((tip) => tips.find((t) => t.tip === tip)).filter(Boolean);
    if (quad.length === 4) {
      groups.push({ key: `hand4:${handId}`, nodes: quad });
    }
  }

  // 2) 두 손 프레임: 각 손의 엄지+검지 → 4꼭짓점 (여러 손 쌍 = 여러 필터)
  const handIds = [...byHand.keys()].sort((a, b) => a - b);
  for (let i = 0; i < handIds.length; i++) {
    for (let j = i + 1; j < handIds.length; j++) {
      const a = byHand.get(handIds[i]);
      const b = byHand.get(handIds[j]);
      const quad = [
        a.find((t) => t.tip === THUMB_TIP),
        a.find((t) => t.tip === INDEX_TIP),
        b.find((t) => t.tip === INDEX_TIP),
        b.find((t) => t.tip === THUMB_TIP),
      ].filter(Boolean);
      if (quad.length === 4) {
        groups.push({ key: `frame:${handIds[i]}:${handIds[j]}`, nodes: quad });
      }
      // 검지+중지 쌍도 별도 필터 가능
      const midQuad = [
        a.find((t) => t.tip === INDEX_TIP),
        a.find((t) => t.tip === MIDDLE_TIP),
        b.find((t) => t.tip === MIDDLE_TIP),
        b.find((t) => t.tip === INDEX_TIP),
      ].filter(Boolean);
      if (midQuad.length === 4) {
        groups.push({ key: `midframe:${handIds[i]}:${handIds[j]}`, nodes: midQuad });
      }
    }
  }
  return groups;
}

/**
 * 손가락 4개를 붙였다가 떼면, 그 4꼭짓점 사각형 안에만 사진 필터.
 * - 모음/벌림 임계를 느슨하게 + 히스테리시스로 인식률 개선
 * - 한 번 열리면 중간 구간에서도 유지 (사라짐 방지)
 * - 손 인식이 잠깐 끊겨도 몇 프레임 유지
 */
function updateLiveTipFilters(landmarksList, w, h) {
  if (!landmarksList?.length || !state.hands.length) {
    if (!state.tipGaps?.demo) {
      // 잠깐 손을 놓쳐도 바로 초기화하지 않음
      for (const g of Object.values(state.tipGaps || {})) {
        if (!g || typeof g !== "object") continue;
        g.miss = (g.miss || 0) + 1;
      }
      const alive = Object.entries(state.tipGaps || {}).filter(([k, g]) => k === "demo" || (g?.miss || 0) < 18);
      if (!alive.length) {
        state.liveTipLinks = [];
        state.liveTipHulls = [];
        state.tipGaps = {};
      } else {
        state.tipGaps = Object.fromEntries(alive);
        // 열린 필터는 마지막 꼭짓점으로 잠시 유지
        state.liveTipHulls = alive
          .filter(([, g]) => g?.opened && g?.lastPts?.length >= 4)
          .map(([, g]) => ({
            points: g.lastPts,
            hue: g.hue ?? 0.7,
            imageIdx: g.imageIdx ?? 0,
            kind: "photo",
          }));
        state.liveTipLinks = [];
      }
    }
    return;
  }
  if (state.tipGaps?.demo) delete state.tipGaps.demo;
  state.liveTipLinks = [];
  state.liveTipHulls = [];

  const nodes = collectTipNodes(landmarksList, w, h);
  if (nodes.length < 4) return;

  const scale = Math.min(w, h);
  // 더 느슨한 모음/벌림 (반지름 기준) + 히스테리시스
  const JOIN_R = scale * 0.11;   // 이하면 "모음" (기존 span 기준보다 관대)
  const OPEN_R = scale * 0.145;  // 이상이면 "벌림" 시작
  const KEEP_MIN_R = scale * 0.09; // 열린 뒤 유지 최소
  const MAX_R = scale * 0.55;
  const MIN_AREA = scale * scale * 0.0035;
  const seen = new Set();
  const groups = collectQuadGroups(nodes);

  for (const { key, nodes: tips } of groups) {
    seen.add(key);
    const radius = groupRadius(tips);
    const span = groupSpan(tips);
    let g = state.tipGaps[key];
    if (!g) {
      g = {
        joined: false,
        opened: false,
        imageIdx: null,
        joinFrames: 0,
        openFrames: 0,
        miss: 0,
        lastPts: null,
        hue: tips.reduce((s, t) => s + t.hue, 0) / tips.length,
      };
      state.tipGaps[key] = g;
    }
    g.miss = 0;
    g.hue = tips.reduce((s, t) => s + t.hue, 0) / tips.length;

    // 모음: 몇 프레임 연속이면 joined (노이즈 완화)
    if (radius <= JOIN_R || span <= JOIN_R * 1.85) {
      g.joinFrames = (g.joinFrames || 0) + 1;
      g.openFrames = 0;
      if (g.joinFrames >= 2) {
        // 다시 모으면 다음 벌림에서 새 패턴
        if (g.opened) g.imageIdx = null;
        g.joined = true;
        g.opened = false;
      }
    } else if (g.joined && !g.opened && (radius >= OPEN_R || span >= OPEN_R * 1.7)) {
      g.openFrames = (g.openFrames || 0) + 1;
      g.joinFrames = 0;
      if (g.openFrames >= 1) {
        g.opened = true;
        if (g.imageIdx == null) g.imageIdx = nextFilterImageIdx();
        setStatus(IS_QUINT ? "🌌 에테르 베일 · 제5원소" : "🪄 손끝 사이 필터");
      }
    } else if (g.opened && radius <= MAX_R && radius >= KEEP_MIN_R) {
      // 열린 상태 유지 (JOIN~OPEN 사이 데드존에서도 유지)
      g.joinFrames = 0;
      g.openFrames = (g.openFrames || 0) + 1;
    } else if (radius > MAX_R || span > MAX_R * 2.1) {
      g.joined = false;
      g.opened = false;
      g.imageIdx = null;
      g.joinFrames = 0;
      g.openFrames = 0;
      g.lastPts = null;
    } else {
      g.joinFrames = 0;
      // openFrames는 opened일 때 유지
      if (!g.opened) g.openFrames = 0;
    }

    if (g.opened) {
      const ordered = orderQuadPoints(tips);
      const pts = ordered.map((t) => [t.x, t.y]);
      if (polygonArea(pts) >= MIN_AREA) {
        g.lastPts = pts;
        state.liveTipHulls.push({
          points: pts,
          hue: g.hue,
          imageIdx: g.imageIdx ?? 0,
          kind: "photo",
        });
        for (let i = 0; i < ordered.length; i++) {
          const a = ordered[i];
          const b = ordered[(i + 1) % ordered.length];
          state.liveTipLinks.push([a.x, a.y, b.x, b.y, g.hue]);
        }
      } else if (g.lastPts?.length >= 4) {
        state.liveTipHulls.push({
          points: g.lastPts,
          hue: g.hue,
          imageIdx: g.imageIdx ?? 0,
          kind: "photo",
        });
      }
    }
  }

  for (const key of Object.keys(state.tipGaps)) {
    if (key === "demo") continue;
    if (!seen.has(key)) {
      const g = state.tipGaps[key];
      g.miss = (g.miss || 0) + 1;
      // 잠깐 손끝이 안 잡혀도 열린 필터는 유지
      if (g.opened && g.lastPts?.length >= 4 && g.miss < 12) {
        state.liveTipHulls.push({
          points: g.lastPts,
          hue: g.hue ?? 0.7,
          imageIdx: g.imageIdx ?? 0,
          kind: "photo",
        });
      } else if (g.miss >= 12) {
        delete state.tipGaps[key];
      }
    }
  }
}

function drawLiveTipFilters(w, h) {
  for (const hull of state.liveTipHulls) {
    if (hull.kind === "photo" || hull.imageIdx != null) {
      drawImageFilterQuad(hull.points, hull.imageIdx ?? 0, 0.5);
    } else {
      paintFilterInside(hull.points, hull.hue, hull.style || FILTER_STYLES[0], 0.45, w, h);
    }
    ctx.save();
    ctx.beginPath();
    hull.points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.strokeStyle = hsvColor(hull.hue, 0.55, 1, 0.55);
    ctx.lineWidth = Math.max(1.1, fxS(1.6));
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  for (const [x1, y1, x2, y2, hue] of state.liveTipLinks) {
    drawElectricArc(x1, y1, x2, y2, hue, 4, 5);
  }
}

function drawHexShield(cx, cy, r, hue, alpha) {
  ctx.strokeStyle = hsvColor(hue, 0.55, 1, alpha);
  ctx.lineWidth = Math.max(1.3, fxS(2));
  ctx.beginPath();
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    pts.push([x, y]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  // 변을 전기로
  for (let i = 0; i < pts.length; i++) {
    if (Math.random() < 0.5) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      drawElectricArc(a[0], a[1], b[0], b[1], hue, 4, 5);
    }
  }
}

function drawHeartShape(cx, cy, size, alpha) {
  // 채움 최소화 — 윤곽 + 얇은 글로우 (사람을 덜 가림)
  const s = size;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx, cy, cx - s, cy - s * 0.2, cx - s * 0.5, cy - s * 0.55);
  ctx.bezierCurveTo(cx - s * 0.1, cy - s * 0.85, cx, cy - s * 0.55, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx, cy - s * 0.55, cx + s * 0.1, cy - s * 0.85, cx + s * 0.5, cy - s * 0.55);
  ctx.bezierCurveTo(cx + s, cy - s * 0.2, cx, cy, cx, cy + s * 0.35);
  ctx.closePath();
  ctx.fillStyle = `rgba(255,80,140,${alpha * 0.18})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(255,140,190,${alpha * 0.85})`;
  ctx.lineWidth = Math.max(1.4, fxS(2.2));
  ctx.shadowColor = "rgba(255,100,180,0.55)";
  ctx.shadowBlur = fxS(10);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function spawnVortex(_cx, _cy) {
  /* no-op: 소용돌이 점 제거 */
}

function addShockwave(x, y) {
  state.shockwaves.push({ x, y, r: 10, life: 1, hue: state.hue });
  if (fx) {
    const w = canvas.width || 1, h = canvas.height || 1;
    fx.addShockwave(x / w, y / h, state.hue);
    fx.flash(0.2);
  }
}

function addRipple(x, y) {
  state.ripples.push({ x, y, r: 5, life: 1 });
}

function detectSwipe(x, y, now) {
  if (now < state.swipeCooldown) return;
  state.swipeHistory.push({ x, y, t: now });
  if (state.swipeHistory.length > 8) state.swipeHistory.shift();
  if (state.swipeHistory.length < 6) return;

  const pts = state.swipeHistory;
  let vx = 0, vy = 0;
  for (let i = 1; i < pts.length; i++) {
    vx += (pts[i].x - pts[i - 1].x) * i;
    vy += (pts[i].y - pts[i - 1].y) * i;
  }
  const w = ((pts.length - 1) ** 2) / 2;
  vx /= w;
  vy /= w;

  if (Math.abs(vx) > Math.abs(vy) && Math.abs(vx) > 0.02) {
    state.hue = (state.hue + (vx > 0 ? 0.12 : -0.12) + 1) % 1;
    state.swipeCooldown = now + 600;
    state.swipeHistory = [];
    setStatus(vx > 0 ? "색상 →" : "← 색상");
  } else if (Math.abs(vy) > 0.025) {
    state.visualMode = (state.visualMode + (vy > 0 ? 1 : VISUAL_MODES.length - 1)) % VISUAL_MODES.length;
    state.swipeCooldown = now + 800;
    state.swipeHistory = [];
    setStatus(`모드: ${VISUAL_MODES[state.visualMode]} ${vy > 0 ? "↓" : "↑"}`);
    playBlip(330 + state.visualMode * 55, 0.15);
  }
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (fx) fx.resize(window.innerWidth, window.innerHeight);
}

function updateParticles(dt, attractX, attractY) {
  for (const p of state.particles) {
    if (p.vortex) {
      const dx = p.x - attractX;
      const dy = p.y - attractY;
      const angle = Math.atan2(dy, dx) + 0.12;
      const dist = Math.hypot(dx, dy);
      p.vx = Math.cos(angle) * (dist * 0.02 + 2);
      p.vy = Math.sin(angle) * (dist * 0.02 + 2);
    } else {
      const dx = attractX - p.x;
      const dy = attractY - p.y;
      const dist = Math.hypot(dx, dy) + 1;
      p.vx += (dx / dist) * 0.1;
      p.vy += (dy / dist) * 0.1;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= dt * 0.35;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  state.shockwaves.forEach((s) => {
    s.r += 4;
    s.life -= dt * 0.5;
  });
  state.shockwaves = state.shockwaves.filter((s) => s.life > 0);

  state.ripples.forEach((r) => {
    r.r += 3;
    r.life -= dt * 0.4;
  });
  state.ripples = state.ripples.filter((r) => r.life > 0);

  state.shields.forEach((s) => {
    s.r += 2.5;
    s.life -= dt * 0.45;
  });
  state.shields = state.shields.filter((s) => s.life > 0);

  state.waveRings.forEach((w) => {
    w.w += 8 * w.dir;
    w.life -= dt * 0.35;
  });
  state.waveRings = state.waveRings.filter((w) => w.life > 0);

  state.ribbons.forEach((rb) => {
    rb.life -= dt * 0.25;
    if (rb.points.length > 40) rb.points.shift();
  });
  state.ribbons = state.ribbons.filter((rb) => rb.life > 0);

  state.jointSparks.forEach((s) => {
    s.x += s.vx;
    s.y += s.vy;
    s.vx *= 0.96;
    s.vy *= 0.96;
    s.life -= dt * 0.7;
  });
  state.jointSparks = state.jointSparks.filter((s) => s.life > 0);
}


function lmXY(lm, idx, w, h) {
  return { x: mirrorX(lm[idx].x) * w, y: lm[idx].y * h };
}

function spawnJointSpark(_x, _y, _hue, _curl) {
  /* no-op */
}

/** 손가락 마디에 맞춰 스켈레톤·관절 글로우·에너지 라인 */
function drawJointSkeleton(lm, joints, w, h, handHue) {
  if (!lm || !joints) return;
  // 점/글로우 대신 얇은 뼈대 선만
  for (const finger of Object.values(joints.fingers)) {
    const chain = finger.chain;
    ctx.strokeStyle = hsvColor(finger.hue ?? handHue, 0.7, 1, 0.55);
    ctx.lineWidth = Math.max(1.1, fxS(1.6));
    ctx.beginPath();
    for (let i = 0; i < chain.length; i++) {
      const p = lmXY(lm, chain[i], w, h);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
}

function updateJointEffects(lm, joints, w, h) {
  if (!lm || !joints) return;
  for (const finger of Object.values(joints.fingers)) {
    const chain = finger.chain;
    finger.curls.forEach((curl, i) => {
      if (curl > 0.4 && Math.random() < curl * 0.12) {
        const idx = chain[Math.min(i + 1, chain.length - 1)];
        const p = lmXY(lm, idx, w, h);
        spawnJointSpark(p.x, p.y, finger.hue, curl);
      }
    });
    if (finger.curl < 0.3 && Math.random() < 0.08) {
      const tip = lmXY(lm, chain[chain.length - 1], w, h);
      /* particle push disabled */;
    }
  }
}

function drawJointSparks() {
  /* 관절 점 스파크 비활성 */
}

function drawOrb(px, py, radius, hue, alpha = 1) {
  // 구름형 글로우 제거 — 얇은 링만
  radius = fxS(radius) * 0.7;
  ctx.strokeStyle = hsvColor(hue, 0.55, 1, 0.55 * alpha);
  ctx.lineWidth = Math.max(1.1, fxS(1.5));
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPoseEffect(hand, lm, w, h) {
  const px = hand.palmX * w;
  const py = hand.palmY * h;
  const hue = handHue(hand);

  if (hand.pose === POSES.OPEN_PALM) {
    drawElectricCorona(px, py, hue, 5);
  }

  if (hand.pose === POSES.PEACE) {
    const iTip = tipPos(lm, INDEX_TIP);
    const mTip = tipPos(lm, MIDDLE_TIP);
    ctx.strokeStyle = hsvColor(hue, 1, 1, 0.85);
    ctx.lineWidth = Math.max(1.5, fxS(3));
    ctx.shadowColor = hsvColor(hue, 1, 1, 0.5);
    ctx.shadowBlur = fxS(8);
    for (const tip of [iTip, mTip]) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(tip.x * w, tip.y * h - fxS(48));
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  if (hand.pose === POSES.POINT) {
    const tip = tipPos(lm, INDEX_TIP);
    ctx.strokeStyle = hsvColor(hue, 0.9, 1, 0.9);
    ctx.lineWidth = Math.max(1.5, fxS(3));
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(
      tip.x * w + (tip.x - hand.palmX) * fxS(70),
      tip.y * h + (tip.y - hand.palmY) * fxS(70),
    );
    ctx.stroke();
  }

  if (hand.pose === POSES.FIST) {
    drawOrb(px, py, 12 + hand.openness * 8, hue, 0.85);
    drawElectricCorona(px, py, hue, 3);
  }

  if (hand.pose === POSES.OK) {
    state.orbitAngle += 0.08;
    for (let i = 0; i < 3; i++) {
      const angle = state.orbitAngle + (i / 3) * Math.PI * 2;
      const r = fxS(22 + i * 5);
      const ox = px + Math.cos(angle) * r;
      const oy = py + Math.sin(angle) * r * 0.6;
      ctx.strokeStyle = hsvColor((hue + i * 0.12) % 1, 0.9, 1, 0.85);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ox, oy, Math.max(2, fxS(3.5 + i)), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = hsvColor(hue, 0.8, 1, 0.5);
    ctx.lineWidth = Math.max(1.2, fxS(2));
    ctx.beginPath();
    ctx.ellipse(px, py, fxS(26), fxS(17), state.orbitAngle * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (hand.pose === POSES.ROCK) {
    const iTip = tipPos(lm, INDEX_TIP);
    const pTip = tipPos(lm, PINKY_TIP);
    drawLightningBolt(px, py, iTip.x * w, iTip.y * h - fxS(36), hue + 0.08);
    drawLightningBolt(px, py, pTip.x * w, pTip.y * h - fxS(24), hue + 0.55);
  }

  if (hand.pose === POSES.STOP) {
    drawHexShield(px, py, fxS(32) + Math.sin(state.idlePhase * 4) * fxS(3), hue, 0.75);
  }

  if (hand.pose === POSES.SHAKA) {
    const pTip = tipPos(lm, PINKY_TIP);
    const tTip = tipPos(lm, THUMB_TIP);
    ctx.strokeStyle = hsvColor(0.55, 0.9, 1, 0.7);
    ctx.lineWidth = Math.max(1.4, fxS(2.5));
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(pTip.x * w, pTip.y * h);
      ctx.quadraticCurveTo(
        pTip.x * w + i * fxS(14),
        pTip.y * h - fxS(18),
        pTip.x * w + i * fxS(34),
        pTip.y * h,
      );
      ctx.stroke();
    }
    ctx.fillStyle = hsvColor(0.6, 0.8, 1, 0.8);
    ctx.beginPath();
    ctx.arc(tTip.x * w, tTip.y * h, fxS(5), 0, Math.PI * 2);
    ctx.fill();
  }

  if (hand.pose === POSES.JAZZ) {
    FINGER_TIPS.forEach((tipIdx, i) => {
      const t = tipPos(lm, tipIdx);
      const tx = t.x * w, ty = t.y * h;
      ctx.strokeStyle = hsvColor((hue + i * 0.18) % 1, 1, 1, 0.8);
      ctx.lineWidth = Math.max(1.2, fxS(2));
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(tx, ty - fxS(12));
      ctx.stroke();
      if (Math.random() < 0.12) {
        spawnRainbow(tx, ty, 2);
      }
    });
  }
}



/** 손들을 최대 2명의 플레이어로 묶기 (화면 좌/우 클러스터) */
function clusterPlayers(hands) {
  if (!hands.length) return [];
  const sorted = [...hands].sort((a, b) => a.palmX - b.palmX);
  if (sorted.length === 1) {
    return [{ id: 0, hands: sorted }];
  }
  if (sorted.length === 2) {
    const gap = sorted[1].palmX - sorted[0].palmX;
    // 멀리 떨어진 한 손씩 = 2명 / 가까우면 1명의 양손
    if (gap >= PLAYER_SPLIT_GAP) {
      return [
        { id: 0, hands: [sorted[0]] },
        { id: 1, hands: [sorted[1]] },
      ];
    }
    return [{ id: 0, hands: sorted }];
  }
  // 3~4손: 정렬된 X에서 가장 큰 간격으로 2그룹 분할
  let bestI = 1;
  let bestGap = -1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].palmX - sorted[i - 1].palmX;
    if (gap > bestGap) {
      bestGap = gap;
      bestI = i;
    }
  }
  // 한쪽에 3손 이상 몰리면 반으로 나눔
  let split = bestI;
  if (bestI === 0 || bestI === sorted.length) split = Math.ceil(sorted.length / 2);
  if (sorted.length === 4 && (bestI === 1 || bestI === 3) && bestGap < PLAYER_SPLIT_GAP) {
    split = 2;
  }
  const left = sorted.slice(0, split);
  const right = sorted.slice(split);
  const players = [];
  if (left.length) players.push({ id: 0, hands: left });
  if (right.length) players.push({ id: 1, hands: right });
  return players;
}

function handHue(hand) {
  if (hand.playerId != null && hand.localIndex != null) {
    return HAND_HUES[(hand.playerId * 2 + hand.localIndex) % HAND_HUES.length];
  }
  return HAND_HUES[hand.index % HAND_HUES.length] ?? state.hue;
}

function assignPlayerMeta(players) {
  players.forEach((p) => {
    p.hands.forEach((h, i) => {
      h.playerId = p.id;
      h.localIndex = i;
      h.hue = HAND_HUES[(p.id * 2 + i) % HAND_HUES.length];
    });
    const xs = p.hands.map((h) => h.palmX);
    const ys = p.hands.map((h) => h.palmY);
    p.cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    p.cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  });
  return players;
}

function nearestCrossPair(players) {
  if (players.length < 2) return null;
  const a = players[0].hands;
  const b = players[1].hands;
  let best = null;
  let bestD = Infinity;
  for (const ha of a) {
    for (const hb of b) {
      const d = Math.hypot(ha.palmX - hb.palmX, ha.palmY - hb.palmY);
      if (d < bestD) {
        bestD = d;
        best = { a: ha, b: hb, dist: d };
      }
    }
  }
  return best;
}

function detectCrossLink(players) {
  if (players.length < 2) return null;
  const pair = nearestCrossPair(players);
  if (!pair) return null;
  const { a, b, dist } = pair;
  if (dist < 0.12) return "highfive";
  const openA = a.pose === POSES.OPEN_PALM;
  const openB = b.pose === POSES.OPEN_PALM;
  if (openA && openB && dist < 0.45) return "duo_field";
  if (dist < 0.5) return "versus";
  return null;
}

/** 화면 기준 왼손/오른손 정렬 (palmX 작은 쪽 = 왼쪽) */
function sortedHands() {
  if (state.hands.length < 2) return state.hands;
  return [...state.hands].sort((a, b) => a.palmX - b.palmX);
}

/** 양손 포즈 콤보 판별 */
function detectDuoCombo(left, right) {
  const lp = left.pose;
  const rp = right.pose;
  if (left.pinching && right.pinching) return "tether";
  if (lp === POSES.POINT && rp === POSES.POINT) return "point_link";
  if (lp === POSES.PEACE && rp === POSES.PEACE) return "cross_laser";
  if (
    (lp === POSES.FIST && rp === POSES.OPEN_PALM) ||
    (rp === POSES.FIST && lp === POSES.OPEN_PALM)
  ) return "push";
  if (lp === POSES.OPEN_PALM && rp === POSES.OPEN_PALM) return "field";
  return "bridge";
}

const DUO_LABELS = {
  tether: "🔗 양손 핀치 — 에너지 끈",
  point_link: "☝️☝️ 양손 가리키기 — 연결 빔",
  cross_laser: "✌️✌️ 더블 브이 — 교차 레이저",
  push: "✊🖐 주먹+손바닥 — 밀어내기",
  field: "🖐🖐 양손 펼침 — 힘의 장",
  bridge: "🤲 양손 연결 — 에너지 브릿지",
};

const LEGEND_SOLO = [
  { key: POSES.OPEN_PALM, hand: "🖐", ico: IS_QUINT ? "🌬" : "⚡", label: IS_QUINT ? "공기 · 성운 바람" : "손바닥 · 전기 코로나" },
  { key: POSES.FIST, hand: "✊", ico: IS_QUINT ? "🪨" : "🌑", label: IS_QUINT ? "대지 · 주먹↓ 파기" : "주먹 · 수축" },
  { key: POSES.PEACE, hand: "✌️", ico: IS_QUINT ? "🔥" : "💥", label: IS_QUINT ? "불 · 태양풍 레이저" : "브이 · 레이저" },
  { key: POSES.POINT, hand: "☝️", ico: IS_QUINT ? "✨" : "🎯", label: IS_QUINT ? "별빛 · 빔/별자리" : "가리키기 · 빔/영역" },
  { key: POSES.PINCH, hand: "🤏", ico: IS_QUINT ? "🌑" : "✅", label: IS_QUINT ? "특이점 · 확정/삭제" : "핀치 · 영역확정/삭제" },
  { key: POSES.OK, hand: "👌", ico: IS_QUINT ? "🌌" : "🌀", label: IS_QUINT ? "에테르 · 제5원소 궤도" : "OK · 궤도" },
  { key: POSES.SHAKA, hand: "🤙", ico: IS_QUINT ? "🌊" : "🌊", label: IS_QUINT ? "물 · 성운 해류" : "샤카 · 파도" },
];

const LEGEND_DUO = [
  { key: "tether", hand: "🤏🤏", ico: "🔗", label: IS_QUINT ? "양손 핀치 · 중력끈" : "양손 핀치 · 끈" },
  { key: "point_link", hand: "☝️☝️", ico: "✨", label: IS_QUINT ? "양손 포인트 · 별다리" : "양손 포인트 · 연결" },
  { key: "cross_laser", hand: "✌️✌️", ico: "🔥", label: IS_QUINT ? "더블 브이 · 교차 플레어" : "더블 브이 · 교차 레이저" },
  { key: "push", hand: "✊🖐", ico: "🪨", label: IS_QUINT ? "주먹+손바닥 · 지각 밀기" : "주먹+손바닥 · 밀기" },
  { key: "storm", hand: "🤘🤘", ico: "⚡", label: IS_QUINT ? "더블 락 · 태양폭풍" : "더블 락 · 폭풍" },
  { key: "field", hand: "🖐🖐", ico: "🌬", label: IS_QUINT ? "양손 펼침 · 대기장" : "양손 펼침 · 힘의 장" },
  { key: "rainbow_bridge", hand: "🙌🙌", ico: "🌈", label: IS_QUINT ? "더블 재즈 · 오로라교" : "더블 재즈 · 무지개 다리" },
  { key: "cheer", hand: "👍👍", ico: "🚀", label: IS_QUINT ? "더블 좋아요 · 발진" : "더블 좋아요 · 환호" },
  { key: "bridge", hand: "🤲", ico: "🌌", label: IS_QUINT ? "양손 연결 · 에테르 브릿지" : "양손 연결 · 브릿지" },
  { key: "heart", hand: "🫶", ico: "❤️", label: IS_QUINT ? "하트 · 제5원소 각성" : "하트 · 사랑의 빛" },
  { key: "together", hand: "🙏", ico: IS_QUINT ? "🌑" : "✨", label: IS_QUINT ? "합장 · 블랙홀" : "합장 · 소용돌이" },
  { key: "spread", hand: "👐", ico: IS_QUINT ? "🌌" : "⚡", label: IS_QUINT ? "벌림 · 우주 팽창" : "벌림 · 번개" },
  { key: "clap", hand: "👏", ico: "💫", label: IS_QUINT ? "박수 · 초신성" : "박수 · 플래시" },
  { key: "highfive", hand: "🙌", ico: "🙌", label: "2인 하이파이브" },
  { key: "versus", hand: "👊👊", ico: "⚡", label: IS_QUINT ? "2인 원소 대결" : "2인 대결 브릿지" },
  { key: "duo_field", hand: "🖐🖐", ico: "🌐", label: IS_QUINT ? "2인 궤도 링" : "2인 전기 링" },
];

function legendIcoHtml(item) {
  const hand = item.hand ? `<span class="hand">${item.hand}</span>` : "";
  return `<span class="ico">${hand}<span class="fx">${item.ico}</span></span>`;
}

function buildLegend() {
  const solo = document.getElementById("legend-solo");
  const duo = document.getElementById("legend-duo");
  if (!solo || !duo) return;
  solo.innerHTML = LEGEND_SOLO.map(
    (item) => `<li data-key="${item.key}">${legendIcoHtml(item)}<span>${item.label}</span></li>`
  ).join("");
  duo.innerHTML = LEGEND_DUO.map(
    (item) => `<li data-key="${item.key}">${legendIcoHtml(item)}<span>${item.label}</span></li>`
  ).join("");
  const toggle = document.getElementById("legend-toggle");
  const legend = document.getElementById("legend");
  if (toggle && legend) {
    toggle.addEventListener("click", () => {
      legend.classList.toggle("collapsed");
      toggle.textContent = legend.classList.contains("collapsed") ? "펼치기" : "접기";
    });
  }
}


function syncLegendFromState() {
  const keys = [];
  if (state.heartActive) keys.push("heart");
  else if (state.clapFlash > 0.5) keys.push("clap");
  else if (state.handsTogether) keys.push("together");
  else if (state.handsSpread) keys.push("spread");
  else if (state.duoCombo) keys.push(state.duoCombo);
  for (const h of state.hands || []) {
    if (h.pose && h.pose !== POSES.NEUTRAL) keys.push(h.pose);
  }
  if (state.liveTipHulls?.length) keys.push("tip_filter");
  highlightLegend(keys);
}

function highlightLegend(activeKeys = []) {
  const keys = new Set(activeKeys.filter(Boolean));
  document.querySelectorAll("#legend .legend-grid li").forEach((li) => {
    li.classList.toggle("active", keys.has(li.dataset.key));
  });
}



function drawEnergyBridge(ax, ay, bx, by, strength, hue) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const wobble = Math.sin(state.duoPhase * 3) * fxS(10) * strength;
  ctx.save();
  ctx.strokeStyle = hsvColor(hue, 0.85, 1, 0.25 + strength * 0.55);
  ctx.lineWidth = Math.max(1.3, fxS(1.5 + strength * 3.5));
  ctx.shadowColor = hsvColor(hue, 1, 1, 0.6);
  ctx.shadowBlur = fxS(6 + strength * 8);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(mx, my + wobble, bx, by);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(mx, my - wobble * 0.6, bx, by);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // 중간 코어 (작게)
  /* soft energy core removed */
  ctx.restore();
}

function drawPinchTether(left, right, lmL, lmR, w, h) {
  const a = tipPos(lmL, INDEX_TIP);
  const b = tipPos(lmR, INDEX_TIP);
  const ax = a.x * w, ay = a.y * h;
  const bx = b.x * w, by = b.y * h;
  drawElectricArc(ax, ay, bx, by, 0.12, 8, 12);
  drawElectricArc(ax, ay, bx, by, 0.08, 6, 8);
}

function drawPointLink(left, right, lmL, lmR, w, h) {
  const a = tipPos(lmL, INDEX_TIP);
  const b = tipPos(lmR, INDEX_TIP);
  const ax = a.x * w, ay = a.y * h;
  const bx = b.x * w, by = b.y * h;
  drawElectricArc(ax, ay, bx, by, 0.55, 8, 10);
  drawElectricArc(ax, ay, bx, by, 0.62, 5, 6);
}

function drawCrossLasers(left, right, lmL, lmR, w, h) {
  const tipsL = [INDEX_TIP, MIDDLE_TIP].map((i) => tipPos(lmL, i));
  const tipsR = [INDEX_TIP, MIDDLE_TIP].map((i) => tipPos(lmR, i));
  const pairs = [
    [tipsL[0], tipsR[1], 0.72],
    [tipsL[1], tipsR[0], 0.85],
  ];
  for (const [a, b, hue] of pairs) {
    drawElectricArc(a.x * w, a.y * h, b.x * w, b.y * h, hue, 7, 8);
  }
  const mx = (left.palmX + right.palmX) / 2 * w;
  const my = (left.palmY + right.palmY) / 2 * h;
  drawElectricCorona(mx, my, 0.8, 4);
}

function drawPushBeam(left, right, w, h) {
  const fist = left.pose === POSES.FIST ? left : right;
  const open = left.pose === POSES.OPEN_PALM ? left : right;
  const ax = fist.palmX * w, ay = fist.palmY * h;
  const bx = open.palmX * w, by = open.palmY * h;
  drawElectricArc(ax, ay, bx, by, 0.08, 9, 11);
  drawElectricCorona(bx, by, 0.55, 5);
}

function drawStormLink(left, right, w, h) {
  const ax = left.palmX * w, ay = left.palmY * h;
  const bx = right.palmX * w, by = right.palmY * h;
  for (let i = 0; i < 3; i++) {
    drawLightningBolt(ax, ay, bx, by, state.hue + i * 0.12, 7);
  }
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  if (Math.random() < 0.25) {
    spawnBurst(mx, my, 6, 5, state.hue + 0.5);
  }
}

function drawForceField(left, right, w, h) {
  const ax = left.palmX * w, ay = left.palmY * h;
  const bx = right.palmX * w, by = right.palmY * h;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const rx = Math.hypot(bx - ax, by - ay) * 0.55;
  const ry = rx * 0.55;
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(Math.atan2(by - ay, bx - ax));
  ctx.strokeStyle = hsvColor(state.hue, 0.7, 1, 0.55);
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const s = 0.55 + i * 0.2 + Math.sin(state.duoPhase * 2 + i) * 0.05;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * s, ry * s, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRainbowBridge(left, right, w, h) {
  const ax = left.palmX * w, ay = left.palmY * h;
  const bx = right.palmX * w, by = right.palmY * h;
  for (let i = 0; i < 6; i++) {
    const hue = (state.hue + i * 0.12) % 1;
    ctx.strokeStyle = hsvColor(hue, 1, 1, 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - 50 - i * 8, bx, by);
    ctx.stroke();
  }
}

function drawCheerBurst(left, right, w, h) {
  const mx = (left.palmX + right.palmX) / 2 * w;
  const my = Math.min(left.palmY, right.palmY) * h;
  if (Math.random() < 0.2) spawnUpward(mx, my, 8);
  drawEnergyBridge(left.palmX * w, left.palmY * h, right.palmX * w, right.palmY * h, 0.7, 0.15);
}

/** 양손 사이 파티클 흐름 (높은 손 → 낮은 손) */
function updateDuoFlow(_left, _right, _w, _h) {
  state.duoFlow = [];
}

function drawDuoFlow() {
  /* 점 흐름 비활성 */
}

/**
 * 양손 상호작용 비주얼 — 항상 브릿지 + 포즈 콤보
 */
function drawDuoInteraction(w, h, landmarksList, pairHands = null, comboOverride = null, skipHeart = false) {
  const pair = pairHands || (state.hands.length >= 2 ? sortedHands() : null);
  if (!pair || pair.length < 2) return;
  const [left, right] = [...pair].sort((a, b) => a.palmX - b.palmX);
  const ax = left.palmX * w, ay = left.palmY * h;
  const bx = right.palmX * w, by = right.palmY * h;
  const dist = Math.hypot(left.palmX - right.palmX, left.palmY - right.palmY);
  const strength = Math.max(0.2, Math.min(1, 1 - (dist - TOGETHER_DIST) / (SPREAD_DIST - TOGETHER_DIST)));
  state.duoEnergy = Math.max(state.duoEnergy || 0, strength);
  state.duoPhase += 0.05;

  const hue = handHue(left);
  if (!(state.heartActive && !skipHeart)) {
    drawEnergyBridge(ax, ay, bx, by, strength, hue);
  }

  const lmL = landmarksList?.[left.index];
  const lmR = landmarksList?.[right.index];
  const combo = comboOverride ?? state.duoCombo;

  if (combo === "tether" && lmL && lmR) drawPinchTether(left, right, lmL, lmR, w, h);
  else if (combo === "point_link" && lmL && lmR) drawPointLink(left, right, lmL, lmR, w, h);
  else if (combo === "cross_laser" && lmL && lmR) drawCrossLasers(left, right, lmL, lmR, w, h);
  else if (combo === "push") drawPushBeam(left, right, w, h);
  else if (combo === "storm") drawStormLink(left, right, w, h);
  else if (combo === "field") drawForceField(left, right, w, h);
  else if (combo === "rainbow_bridge") drawRainbowBridge(left, right, w, h);
  else if (combo === "cheer") drawCheerBurst(left, right, w, h);

  updateDuoFlow(left, right, w, h);
  drawDuoFlow();
}

function drawPlayerLabel(pl, w, h) {
  const x = pl.cx * w;
  const y = pl.cy * h - fxS(36);
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(PLAYER_LABELS[pl.id] || `P${pl.id + 1}`, x, y);
  ctx.restore();
}

function drawCrossPlayerLink(w, h) {
  if (!state.crossLink || state.players.length < 2) return;
  const pair = nearestCrossPair(state.players);
  if (!pair) return;
  const ax = pair.a.palmX * w, ay = pair.a.palmY * h;
  const bx = pair.b.palmX * w, by = pair.b.palmY * h;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  if (state.crossLink === "highfive") {
    drawEnergyBridge(ax, ay, bx, by, 1, 0.15);
    drawElectricCorona(mx, my, 0.15, 6);
  } else if (state.crossLink === "duo_field") {
    const rx = Math.max(fxS(40), Math.hypot(bx - ax, by - ay) * 0.55);
    ctx.strokeStyle = hsvColor(0.55, 0.8, 1, 0.45);
    ctx.lineWidth = Math.max(1.5, fxS(3));
    ctx.beginPath();
    ctx.ellipse(mx, my, rx, rx * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawElectricArc(ax, ay, bx, by, 0.55, 8, 10);
  } else if (state.crossLink === "versus") {
    drawEnergyBridge(ax, ay, bx, by, 0.85, 0.08);
    // 중앙 충돌 스파크
    for (let i = 0; i < 5; i++) {
      const ang = state.duoPhase * 3 + i;
      ctx.fillStyle = hsvColor(0.08 + i * 0.05, 1, 1, 0.7);
      ctx.beginPath();
      ctx.arc(mx + Math.cos(ang) * fxS(12), my + Math.sin(ang) * fxS(12), fxS(3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHandsHeart(w, h) {
  const [a, b] = state.hands;
  const ax = a.palmX * w, ay = a.palmY * h;
  const bx = b.palmX * w, by = b.palmY * h;
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2 - 30;
  const size = 50 + state.heartPulse * 40;
  drawHeartShape(cx, cy, size, 0.6 + state.heartPulse * 0.4);
  
  /* heart orbit dots removed */
  return { mx: cx, my: cy };
}

function drawHandsSpread(w, h) {
  const [a, b] = state.hands;
  const ax = a.palmX * w, ay = a.palmY * h;
  const bx = b.palmX * w, by = b.palmY * h;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;

  ctx.strokeStyle = hsvColor(state.hue + 0.45, 1, 1, 0.75);
  ctx.lineWidth = 4;
  ctx.shadowColor = "rgba(150,200,255,0.8)";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(mx, my - 80, bx, by);
  ctx.stroke();
  ctx.shadowBlur = 0;

  /* spread cloud-dots removed — electric arcs drawn above */
}

function drawHandsTogether(w, h) {
  const [a, b] = state.hands;
  const ax = a.palmX * w, ay = a.palmY * h;
  const bx = b.palmX * w, by = b.palmY * h;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  // 점/구름 대신 얇은 전기 연결만
  drawElectricArc(ax, ay, bx, by, state.hue + 0.15, 8, 10);
  drawElectricCorona(mx, my, (state.hue + 0.33) % 1, 4);
  return { mx, my };
}

function drawBackgroundMode(w, h, attractX, attractY) {
  // 점·구름형 배경 모드 비활성 (전기/필터만 보이게)
  for (const s of state.shields) {
    drawHexShield(s.x, s.y, s.r, s.hue, s.life * 0.6);
  }
  for (const wr of state.waveRings) {
    ctx.strokeStyle = hsvColor(0.55, 0.8, 1, wr.life * 0.6);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wr.x - wr.w, wr.y);
    ctx.quadraticCurveTo(wr.x, wr.y - 20, wr.x + wr.w, wr.y);
    ctx.stroke();
  }
  for (const rb of state.ribbons) {
    if (rb.points.length < 2) continue;
    ctx.strokeStyle = hsvColor(state.hue, 0.7, 1, rb.life * 0.5);
    ctx.lineWidth = 4;
    ctx.beginPath();
    rb.points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }
  for (const s of state.shockwaves) {
    ctx.strokeStyle = hsvColor(s.hue, 0.9, 1, s.life * 0.6);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.stroke();
  }
}


/** ART 모드용 카메라 그리기 폴백은 사용하지 않음 — AR는 <video> 배경 */

function currentView() {
  return VIEW_MODES[state.viewMode] || VIEW_MODES.ar;
}

function setViewMode(modeId) {
  const mode = VIEW_MODES[modeId] || VIEW_MODES.ar;
  state.viewMode = mode.id;
  state.arMode = !!mode.camera;
  state.showJoints = !!mode.joints;
  state.showEffects = !!mode.effects;
  state.landmarkDebug = !!mode.landmarkDebug;
  state.autoFx = !!mode.autoFx;
  if (!mode.effects) {
    state.filterZones = [];
    state.liveTipHulls = [];
    state.liveTipLinks = [];
    state.tipGaps = {};
    state.fingerTrails = [[], [], [], []];
  }
  syncArStage();
  if (modeLabelEl) modeLabelEl.textContent = `모드: ${mode.label}`;
  if (hintEl) hintEl.textContent = mode.hint;
  if (testPanel) testPanel.hidden = mode.id !== "test";
  document.querySelectorAll("#mode-bar [data-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode.id);
  });
  stage?.classList.toggle("mode-track", mode.id === "track");
  stage?.classList.toggle("mode-test", mode.id === "test");
  setStatus(`${mode.label} 모드`);
  try {
    const u = new URL(location.href);
    u.searchParams.set("mode", mode.id);
    history.replaceState(null, "", u);
  } catch {}
}

function drawLandmarkDebug(lm, hand, w, h) {
  if (!lm) return;
  const hue = handHue(hand);
  // bones
  const bones = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17],
  ];
  ctx.strokeStyle = hsvColor(hue, 0.7, 1, 0.75);
  ctx.lineWidth = Math.max(1.2, fxS(1.8));
  for (const [a, b] of bones) {
    const pa = tipPos(lm, a);
    const pb = tipPos(lm, b);
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }
  // landmarks
  for (let i = 0; i < lm.length; i++) {
    const p = tipPos(lm, i);
    const x = p.x * w, y = p.y * h;
    const isTip = [4, 8, 12, 16, 20].includes(i);
    ctx.fillStyle = isTip ? hsvColor(hue, 0.9, 1, 0.95) : "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(x, y, isTip ? 4.5 : 2.4, 0, Math.PI * 2);
    ctx.fill();
    if (isTip) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "11px sans-serif";
      ctx.fillText(String(i), x + 6, y - 6);
    }
  }
  // pose label
  const px = hand.palmX * w, py = hand.palmY * h - 28;
  const label = (typeof POSE_LABELS !== "undefined" && ACTIVE_POSE_LABELS[hand.pose]) || hand.pose || "?";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(px - 54, py - 14, 108, 22);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, px, py + 2);
  ctx.textAlign = "left";
}

function runTestAutoFx(w, h, dt) {
  if (!state.autoFx) return;
  state.testPulse = (state.testPulse || 0) + dt;
  if (IS_QUINT && quint) {
    // 제5원소 테스트: 전기/사진필터 대신 우주 시퀀스
    if (state.testPulse > 2.4) {
      state.testPulse = 0;
      const step = (state.testCosmosStep = ((state.testCosmosStep || 0) + 1) % 4);
      if (step === 1) window.__HAND_TEST__?.injectGravity?.();
      else if (step === 2) window.__HAND_TEST__?.injectNebula?.();
      else if (step === 3) window.__HAND_TEST__?.injectDig?.();
      else window.__HAND_TEST__?.injectEther?.();
    }
    return;
  }
  // 클래식: 주기적으로 전기 스파크
  if (Math.random() < 0.08) {
    const x1 = w * (0.2 + Math.random() * 0.2);
    const y1 = h * (0.35 + Math.random() * 0.3);
    const x2 = w * (0.55 + Math.random() * 0.25);
    const y2 = h * (0.35 + Math.random() * 0.3);
    drawElectricArc(x1, y1, x2, y2, 0.55 + Math.random() * 0.2, 8, 12);
  }
  if (state.testPulse > 2.8) {
    state.testPulse = 0;
    if (!state.filterZones.length) {
      window.__HAND_TEST__?.injectLoopFilter?.(state.filterStyleIdx % 4);
    } else if (!state.liveTipHulls.length) {
      window.__HAND_TEST__?.injectTipFilter?.();
    } else {
      window.__HAND_TEST__?.clearFilters?.();
    }
  }
}


function syncArStage() {
  stage.classList.toggle("ar-on", state.arMode);
  if (arBtn) {
    arBtn.textContent = state.arMode ? "AR" : "ART";
    arBtn.classList.toggle("off", !state.arMode);
  }
}


/** 2D 손 상태를 WebGL 이펙트 엔진에 동기화 */
function syncFx(w, h, landmarksList) {
  if (!fx) return;
  if (!state.showEffects) {
    try { fx.setOrbs?.([]); } catch {}
    try { fx.setBeams?.([]); } catch {}
    try { fx.setHands?.([]); } catch {}
    try { fx.update?.(); } catch {}
    return;
  }
  const orbs = state.hands.map((hand, idx) => ({
    palmX: hand.palmX,
    palmY: hand.palmY,
    openness: hand.openness,
    hue: handHue(hand),
    fist: hand.pose === POSES.FIST,
    pulse: state.mergePulse,
  }));
  fx.setOrbs([]); // soft orb/cloud spheres off

  const beams = [];
  for (const pl of state.players) {
    if (pl.hands.length < 2) continue;
    const [a, b] = [...pl.hands].sort((p, q) => p.palmX - q.palmX);
    const energy = pl.together ? 0.9 : (pl.spread ? 0.7 : 0.45);
    beams.push({
      x1: a.palmX, y1: a.palmY, x2: b.palmX, y2: b.palmY,
      hue: handHue(a), width: 0.35 + energy * 0.7,
      sag: 0.04 + energy * 0.06, alpha: 0.5 + energy * 0.35,
    });
    const combo = pl.combo;
    const la = landmarksList?.[a.index];
    const lb = landmarksList?.[b.index];
    if (combo === "point_link" && la && lb) {
      const ta = tipPos(la, INDEX_TIP);
      const tb = tipPos(lb, INDEX_TIP);
      beams.push({ x1: ta.x, y1: ta.y, x2: tb.x, y2: tb.y, hue: 0.55, width: 0.8, sag: 0.01, alpha: 0.9 });
    }
    if (combo === "tether" && la && lb) {
      const ta = tipPos(la, INDEX_TIP);
      const tb = tipPos(lb, INDEX_TIP);
      beams.push({ x1: ta.x, y1: ta.y, x2: tb.x, y2: tb.y, hue: 0.12, width: 0.65, sag: 0.12, alpha: 0.85 });
    }
    if (combo === "storm" && Math.random() < 0.3) {
      fx.addBolt(a.palmX, a.palmY, b.palmX, b.palmY, handHue(a) + 0.45);
    }
    if (Math.random() < 0.35) fx.spawnFlow(a.palmX, a.palmY, b.palmX, b.palmY, handHue(a));
  }
  // 2명 크로스 빔
  if (state.crossLink && state.players.length >= 2) {
    const pair = nearestCrossPair(state.players);
    if (pair) {
      beams.push({
        x1: pair.a.palmX, y1: pair.a.palmY, x2: pair.b.palmX, y2: pair.b.palmY,
        hue: state.crossLink === "highfive" ? 0.15 : 0.08,
        width: state.crossLink === "versus" ? 1.0 : 0.7,
        sag: 0.02, alpha: 0.9,
      });
    }
  }
  // fingertip particle bursts disabled
  fx.setBeams(beams);
  fx.setBloomStrength(state.arMode ? 0.14 : 0.24);
  // subtle comet-trail on beams/bolts (open-source three.js AfterimagePass) — a bit
  // more energy during storm/tether combos, restrained over the live AR camera feed
  const trailBase = state.arMode ? 0.72 : 0.8;
  const trailBoost = state.duoCombo === "storm" ? 0.14 : 0;
  fx.setTrail?.(trailBase + trailBoost);
  if (state.clapFlash > 0.8) fx.flash(0.22);
  fx.update();
}

function quintSnapshot() {
  let mid = null;
  let n = 0;
  let mx = 0;
  let my = 0;
  for (const pl of state.players || []) {
    if (!pl.pair || pl.pair.length < 2) continue;
    const [a, b] = pl.pair;
    mx += (a.palmX + b.palmX) * 0.5;
    my += (a.palmY + b.palmY) * 0.5;
    n++;
  }
  if (n) mid = { x: mx / n, y: my / n };
  else if (state.hands.length) {
    mid = {
      x: state.hands.reduce((s, h) => s + h.palmX, 0) / state.hands.length,
      y: state.hands.reduce((s, h) => s + h.palmY, 0) / state.hands.length,
    };
  }
  const pose = state.hands.find((h) => h.pose && h.pose !== POSES.NEUTRAL)?.pose || "";
  return {
    togetherBlend: state.togetherBlend || 0,
    spreadBlend: state.spreadBlend || 0,
    mid,
    pose,
    hands: state.hands,
    tipHulls: state.liveTipHulls,
  };
}

function drawFrame(now, landmarksList) {
  const w = canvas.width;
  const h = canvas.height;
  const dt = 1 / 60;
  state.idlePhase += dt;
  state.particles = [];
  state.jointSparks = [];
  state.duoFlow = [];

  // AR: 카메라 <video>가 배경. 2D 캔버스는 투명 유지(불투명 채우기로 덮지 않음).
  // ART: 다크 캔버스. WebGL(#fx-canvas)은 AR에서 mix-blend-mode:screen 으로 검정 제거.
  if (state.arMode) {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.25,
      w / 2, h / 2, Math.max(w, h) * 0.72
    );
    /* vignette/cloud wash removed for effect visibility */
  } else {
    ctx.fillStyle = "#08060f";
    ctx.fillRect(0, 0, w, h);
  }

  const view = currentView();
  runTestAutoFx(w, h, dt);

  // —— 제5원소: 전용 우주 파이프라인 (클래식 전기/사진필터와 분리) ——
  if (IS_QUINT && quint) {
    const snap = quintSnapshot();
    quint.update(dt, snap);

    ctx.save();
    if (state.shake > 0.01) {
      const s = state.shake * 10;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    if (state.showEffects) {
      quint.draw(ctx, w, h, snap);
      drawFingerTrails(w, h);
    }

    if (state.clapFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.clapFlash * 0.12})`;
      ctx.fillRect(0, 0, w, h);
      state.clapFlash = Math.max(0, state.clapFlash - dt * 3.5);
    }

    if (state.hands.length) {
      for (const pl of state.players) {
        if (!state.showEffects) continue;
        if (pl.hands.length >= 2 && pl.heart) {
          const [a, b] = pl.pair || pl.hands;
          const cx = ((a.palmX + b.palmX) / 2) * w;
          const cy = ((a.palmY + b.palmY) / 2) * h - 30;
          drawHeartShape(cx, cy, 40 + state.heartPulse * 30, 0.7);
        }
        if (state.players.length >= 2) drawPlayerLabel(pl, w, h);
      }

      state.hands.forEach((hand) => {
        const hue = handHue(hand);
        const px = hand.palmX * w;
        const py = hand.palmY * h;
        const lm = landmarksList?.[hand.index];
        if (state.landmarkDebug && lm) {
          drawLandmarkDebug(lm, hand, w, h);
        } else if (lm && hand.joints && state.showJoints) {
          drawJointSkeleton(lm, hand.joints, w, h, hue);
        }
        if (!state.showEffects && !state.landmarkDebug) {
          drawOrb(px, py, 5 + hand.openness * 6, hue, 0.22);
        }
      });
    }

    ctx.fillStyle = "rgba(200,200,220,0.5)";
    ctx.font = "12px sans-serif";
    const playerHint = state.players.length >= 2
      ? ` · 👥${state.players.length}명/${state.hands.length}손`
      : (state.hands.length ? ` · 손${state.hands.length}` : "");
    ctx.fillText(`QUINTESSENCE${playerHint}`, 16, h - 16);

    if (!state.arMode && video.videoWidth > 0) {
      const pipW = 200, pipH = 150;
      const pipX = w - pipW - 16, pipY = h - pipH - 16;
      ctx.save();
      ctx.strokeStyle = state.handsTogether ? "rgba(255,180,255,0.7)"
        : state.handsSpread ? "rgba(150,200,255,0.7)"
        : state.hands.length ? "rgba(100,255,150,0.5)" : "rgba(255,200,80,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4);
      if (MIRROR_CAMERA) {
        ctx.translate(pipX + pipW, pipY);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, pipW, pipH);
      } else {
        ctx.drawImage(video, pipX, pipY, pipW, pipH);
      }
      ctx.restore();
    }

    state.mergePulse = Math.max(0, state.mergePulse - dt * 2);
    state.shake = Math.max(0, state.shake - dt * 2.4);
    ctx.restore();
    syncLegendFromState();
    // 제5원소는 WebGL 전기 FX 끄고 캔버스 우주만 사용
    if (fx) {
      try { fx.clear?.(); } catch {}
    }
    return;
  }

  if (IS_QUINT) {
    updateEarthWorld(dt, w, h);
    drawCosmosDust(w, h);
  }
  ctx.save();
  if (state.shake > 0.01) {
    const s = state.shake * 10;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  if (IS_QUINT) drawEarthWorld(w, h);

  // 손가락으로 이은 영역 필터(에테르 베일) — 파악 모드에서는 숨김
  if (state.showEffects) {
    drawFilterZones(w, h);
    drawLiveTipFilters(w, h);
    drawFingerTrails(w, h);
  }

  let attractX = w / 2, attractY = h / 2;

  if (state.clapFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.clapFlash * 0.12})`;
    ctx.fillRect(0, 0, w, h);
    state.clapFlash = Math.max(0, state.clapFlash - dt * 3.5);
  }

  if (state.hands.length === 0) {
    /* idle orb/cloud removed */
  } else {
    // 플레이어별 특수 연출 + 개별 손 이펙트
    for (const pl of state.players) {
      if (!state.showEffects) continue;
      if (pl.hands.length >= 2 && pl.heart) {
        // 임시로 state.hands를 해당 페어로 맞추지 않고 직접 하트 위치에 그리기
        const [a, b] = pl.pair || pl.hands;
        const cx = ((a.palmX + b.palmX) / 2) * w;
        const cy = ((a.palmY + b.palmY) / 2) * h - 30;
        drawHeartShape(cx, cy, 40 + state.heartPulse * 30, 0.7);
        attractX = cx; attractY = cy;
      } else if (pl.hands.length >= 2 && pl.together) {
        const [a, b] = pl.pair || pl.hands;
        attractX = ((a.palmX + b.palmX) / 2) * w;
        attractY = ((a.palmY + b.palmY) / 2) * h;
      } else if (pl.hands.length >= 2 && pl.spread) {
        const [a, b] = pl.pair || pl.hands;
        // 벌림: 얇은 전기 아크 (면 채움 없음)
        drawElectricArc(a.palmX * w, a.palmY * h, b.palmX * w, b.palmY * h, handHue(a) + 0.45, 9, 14);
        drawElectricArc(a.palmX * w, a.palmY * h, b.palmX * w, b.palmY * h, handHue(b) + 0.55, 7, 10);
      }
      if (state.players.length >= 2) drawPlayerLabel(pl, w, h);
    }

    state.hands.forEach((hand, idx) => {
      const hue = handHue(hand);
      const px = hand.palmX * w, py = hand.palmY * h;
      if (hand.pose !== POSES.FIST) {
        drawOrb(px, py, 5 + hand.openness * 6, hue, 0.28);
      }
      const lm = landmarksList?.[hand.index];
      if (state.landmarkDebug && lm) {
        drawLandmarkDebug(lm, hand, w, h);
      } else if (lm && hand.joints && state.showJoints) {
        drawJointSkeleton(lm, hand.joints, w, h, hue);
      }
      if (state.showEffects && lm) drawPoseEffect(hand, lm, w, h);
      else if (!state.showEffects && !state.landmarkDebug) {
        // FX 모드에서도 손 위치 힌트용 얇은 링
        drawOrb(px, py, 5 + hand.openness * 6, hue, 0.22);
      }
      /* trail dots removed */
    });
    if (state.hands.length) {
      attractX = state.hands.reduce((s, hh) => s + hh.palmX, 0) / state.hands.length * w;
      attractY = state.hands.reduce((s, hh) => s + hh.palmY, 0) / state.hands.length * h;
    }
  }

  // 플레이어별 양손 콤보 + 2인 크로스 링크
  if (state.showEffects) for (const pl of state.players) {
    if (pl.hands.length >= 2) {
      drawDuoInteraction(w, h, landmarksList, pl.pair || pl.hands, pl.combo, true);
    }
  }
  if (state.showEffects) drawCrossPlayerLink(w, h);

  if (
    state.hands.length > 0 &&
    state.showJoints &&
    (state.heartActive || state.handsTogether || state.handsSpread)
  ) {
    state.hands.forEach((hand, idx) => {
      const lm = landmarksList?.[hand.index];
      if (lm && hand.joints) {
        drawJointSkeleton(lm, hand.joints, w, h, handHue(hand));
      }
    });
  }

  drawBackgroundMode(w, h, attractX, attractY);

  // particles / joint sparks disabled

  ctx.fillStyle = "rgba(200,200,220,0.5)";
  ctx.font = "12px sans-serif";
  const curlHint = state.hands[0]?.joints
    ? ` · curl ${Math.round(state.hands[0].joints.avgCurl * 100)}%`
    : "";
  const arHint = state.arMode ? "AR · " : "";
  const playerHint = state.players.length >= 2 ? ` · 👥${state.players.length}명/${state.hands.length}손` : (state.hands.length ? ` · 손${state.hands.length}` : "");
  ctx.fillText(`${arHint}MODE: ${VISUAL_MODES[state.visualMode]}${playerHint}${curlHint}`, 16, h - 16);

  // AR 모드에서는 영상이 배경이라 PIP 불필요
  if (!state.arMode && video.videoWidth > 0) {
    const pipW = 200, pipH = 150;
    const pipX = w - pipW - 16, pipY = h - pipH - 16;
    ctx.save();
    ctx.strokeStyle = state.handsTogether ? "rgba(255,180,255,0.7)"
      : state.handsSpread ? "rgba(150,200,255,0.7)"
      : state.hands.length ? "rgba(100,255,150,0.5)" : "rgba(255,200,80,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4);
    if (MIRROR_CAMERA) {
      ctx.translate(pipX + pipW, pipY);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, pipW, pipH);
    } else {
      ctx.drawImage(video, pipX, pipY, pipW, pipH);
    }
    ctx.restore();
  }

  state.mergePulse = Math.max(0, state.mergePulse - dt * 2);
  updateParticles(dt, attractX, attractY);
  ctx.restore(); // shake
  syncLegendFromState();
  syncFx(w, h, landmarksList);
}

let lastLandmarks = [];

function parseHands(landmarksList, handednessList) {
  return landmarksList.map((lm, idx) => {
    const palm = palmCenter(lm);
    const pinching = pinchDistance(lm) < 0.05;
    const openness = handOpenness(lm);
    const pose = detectPose(lm, openness, pinching);
    const joints = analyzeJoints(lm);
    return {
      palmX: palm.x, palmY: palm.y,
      openness, pinching, pose, joints,
      side: handednessList?.[idx]?.[0]?.categoryName ?? (idx === 0 ? "Left" : "Right"),
      index: idx,
    };
  });
}

function smoothHand(prev, next, alpha = 0.35) {
  if (!prev) return { ...next };
  return {
    ...next,
    palmX: prev.palmX * (1 - alpha) + next.palmX * alpha,
    palmY: prev.palmY * (1 - alpha) + next.palmY * alpha,
    openness: prev.openness * (1 - alpha) + next.openness * alpha,
  };
}

function onPoseStart(hand, w, h) {
  const px = hand.palmX * w, py = hand.palmY * h;
  switch (hand.pose) {
    case POSES.OPEN_PALM:
      // 퍼지는 충격파 대신 짧은 전기 코로나
      drawElectricCorona(px, py, handHue(hand), 8);
      playBlip(280, 0.15);
      break;
    case POSES.FIST:
      state.mergePulse = 0.8;
      playBlip(120, 0.1);
      break;
    case POSES.PEACE:
      spawnBurst(px, py - 40, 10, 4, handHue(hand));
      playBlip(520, 0.12);
      break;
    case POSES.THUMBS_UP:
      spawnUpward(px, py);
      playBlip(400, 0.15);
      break;
    case POSES.POINT:
      playBlip(660, 0.08);
      break;
    case POSES.OK:
      playBlip(380, 0.15);
      break;
    case POSES.ROCK:
      playBlip(180, 0.2);
      break;
    case POSES.STOP:
      addShield(px, py, handHue(hand));
      playBlip(250, 0.25);
      break;
    case POSES.SHAKA:
      addWaveRing(px, py, 1);
      addWaveRing(px, py, -1);
      playBlip(420, 0.12);
      break;
    case POSES.JAZZ:
      spawnRainbow(px, py, 20);
      playBlip(550, 0.18);
      break;
    default:
      break;
  }
}

function processHands(landmarksList, handednessList, now) {
  lastLandmarks = landmarksList;
  const parsed = parseHands(landmarksList, handednessList);
  const w = canvas.width, h = canvas.height;

  state.hands = parsed.map((hh, i) => smoothHand(state.hands[i], hh));
  state.players = assignPlayerMeta(clusterPlayers(state.hands));
  // trails / pose history 슬롯 확보
  while (state.wasPose.length < MAX_HANDS) state.wasPose.push(POSES.NEUTRAL);
  while (state.wasPinching.length < MAX_HANDS) state.wasPinching.push(false);
  while (state.prevPalmX.length < MAX_HANDS) state.prevPalmX.push(0.5);
  while (state.prevPalmY.length < MAX_HANDS) state.prevPalmY.push(0.5);
  while (state.trails.length < MAX_HANDS) state.trails.push([]);
  while (state.fingerTrails.length < MAX_HANDS) state.fingerTrails.push([]);

  if (state.hands.length >= 1) {
    const main = state.hands[0];
    state.hue = (main.palmX * 0.7 + (1 - main.palmY) * 0.3) % 1;
    detectSwipe(main.palmX, main.palmY, now);
  }

  state.hands.forEach((hand, idx) => {
    if (hand.pose !== state.wasPose[idx]) {
      onPoseStart(hand, w, h);
      state.wasPose[idx] = hand.pose;
    }

    const lm = landmarksList[hand.index] ?? landmarksList[idx];
    // 핀치 rising-edge는 영역 확정/삭제보다 먼저 읽어야 함
    if (lm) updateFingerDrawing(hand, lm, w, h, idx);

    if (hand.pinching && !state.wasPinching[idx]) {
      const drawing = (state.fingerTrails[idx] || []).length >= 8;
      if (!drawing) {
        drawElectricCorona(hand.palmX * w, hand.palmY * h, handHue(hand), 4);
        playBlip(220 + idx * 80);
      }
    }
    state.wasPinching[idx] = hand.pinching;

    if (lm && hand.joints) {
      updateJointEffects(lm, hand.joints, w, h);
    }

    const vx = hand.palmX - (state.prevPalmX[idx] ?? hand.palmX);
    const vy = hand.palmY - (state.prevPalmY[idx] ?? hand.palmY);
    if (hand.pose === POSES.OPEN_PALM && Math.abs(vx) > 0.025) {
      addRibbon(hand.palmX * w, hand.palmY * h, vx * w);
      if (Math.random() < 0.2) addRipple(hand.palmX * w, hand.palmY * h);
    }
    if (hand.pose === POSES.SHAKA && Math.random() < 0.06) {
      addWaveRing(hand.palmX * w, hand.palmY * h, vx >= 0 ? 1 : -1);
    }
    // 🪨 대지 파기 (제5원소 모드만)
    if (IS_QUINT && hand.pose === POSES.FIST && vy > 0.018) {
      const power = Math.min(1.8, vy * 42);
      spawnEarthDig(hand.palmX * w, hand.palmY * h, power);
      if (power > 0.45) setStatus("🪨 대지 — 파내기");
    }
    state.prevPalmX[idx] = hand.palmX;
    state.prevPalmY[idx] = hand.palmY;

    if (!state.trails[idx]) state.trails[idx] = [];
    state.trails[idx].push([hand.palmX * w, hand.palmY * h]);
    if (state.trails[idx].length > 30) state.trails[idx].shift();

    if (hand.pose === POSES.OPEN_PALM && Math.random() < 0.08) {
      addRipple(hand.palmX * w, hand.palmY * h);
    }
  });

  // —— 1~2명 상호작용 (플레이어 클러스터 기준) ——
  const players = state.players;
  const statusParts = [];

  // 기본 플래그 리셋 후 플레이어별 갱신
  state.handsTogether = false;
  state.handsSpread = false;
  state.heartActive = false;
  state.duoCombo = null;

  let anyTogether = false;
  let anySpread = false;
  let anyHeart = false;
  let primaryCombo = null;

  for (const pl of players) {
    pl.together = false;
    pl.spread = false;
    pl.heart = false;
    pl.combo = null;
    if (pl.hands.length < 2) continue;
    const [ha, hb] = [...pl.hands].sort((p, q) => p.palmX - q.palmX);
    const dist = Math.hypot(ha.palmX - hb.palmX, ha.palmY - hb.palmY);
    const lmA = landmarksList?.[ha.index];
    const lmB = landmarksList?.[hb.index];
    const heartNow = !!(lmA && lmB && detectHeart(lmA, lmB, mirrorX));
    pl.heart = heartNow;
    pl.together = !heartNow && dist < TOGETHER_DIST;
    pl.spread = !heartNow && dist > SPREAD_DIST;
    pl.combo = heartNow ? null : detectDuoCombo(ha, hb);
    pl.dist = dist;
    pl.pair = [ha, hb];

    if (heartNow) anyHeart = true;
    if (pl.together) anyTogether = true;
    if (pl.spread) anySpread = true;
    if (pl.combo) primaryCombo = pl.combo;

    const tag = PLAYER_LABELS[pl.id] || `P${pl.id + 1}`;
    if (heartNow && !state.wasHeart) {
      state.heartPulse = 1;
      const mx = ((ha.palmX + hb.palmX) / 2) * w;
      const my = ((ha.palmY + hb.palmY) / 2) * h;
      spawnBurst(mx, my - 40, 28, 7, 0.92);
      playBlip(520, 0.3);
      statusParts.push(`${tag} ❤️ 하트`);
    } else if (pl.together && !state.wasHandsTogether) {
      const mx = ((ha.palmX + hb.palmX) / 2) * w;
      const my = ((ha.palmY + hb.palmY) / 2) * h;
      const closingFast = (state.prevHandDist - dist) > 0.08;
      if (closingFast && state.prevHandDist > 0.2) {
        state.clapFlash = 1;
        spawnBurst(mx, my, 36, 11);
        playBlip(880, 0.08);
        statusParts.push(`${tag} 👏 박수`);
      } else {
        spawnVortex(mx, my);
        spawnBurst(mx, my, 24, 9);
        state.mergePulse = 1;
        playBlip(440, 0.25);
        statusParts.push(`${tag} ✨ 합장`);
      }
    } else if (pl.spread && !state.wasHandsSpread) {
      playBlip(300, 0.2);
      statusParts.push(`${tag} ⚡ 벌림`);
    } else if (pl.combo && pl.combo !== state.wasDuoCombo) {
      playBlip(360 + Object.keys(DUO_LABELS).indexOf(pl.combo) * 40, 0.12);
    }

    state.prevHandDist = dist;
  }

  state.handsTogether = anyTogether;
  state.handsSpread = anySpread;
  state.heartActive = anyHeart;
  state.duoCombo = primaryCombo;
  if (primaryCombo) state.wasDuoCombo = primaryCombo;

  // 2명 사이 크로스 인터랙션
  const cross = detectCrossLink(players);
  state.crossLink = cross;
  if (cross && cross !== state.wasCrossLink) {
    playBlip(cross === "highfive" ? 760 : 480, 0.15);
    const pair = nearestCrossPair(players);
    if (pair && cross === "highfive") {
      spawnBurst(((pair.a.palmX + pair.b.palmX) / 2) * w, ((pair.a.palmY + pair.b.palmY) / 2) * h, 40, 12, 0.15);
      state.clapFlash = 1;
    }
  }
  state.wasCrossLink = cross;

  updateLiveTipFilters(landmarksList, w, h);

  // 상태 문구
  if (statusParts.length) {
    setStatus(statusParts.join(" · "));
  } else if (state.liveTipHulls.length) {
    setStatus(IS_QUINT ? "🌌 에테르 베일 · 제5원소" : "🪄 손끝 사이 필터");
  } else if (players.length >= 2) {
    const nHands = state.hands.length;
    if (cross === "highfive") setStatus("🙌 2인 하이파이브!");
    else if (cross === "duo_field") setStatus("🌐 2인 전기 링");
    else if (cross === "versus") setStatus("⚡ 2인 대결 브릿지");
    else setStatus(`👥 2명 모드 · 손 ${nHands}개`);
  } else if (players.length === 1 && players[0].hands.length === 2) {
    const pl = players[0];
    if (pl.heart) setStatus("❤️ 하트 — 사랑의 빛!");
    else if (pl.together) setStatus(IS_QUINT ? "🙏 양손 모음 · 중력 우물" : "🙏 양손 모음 · 소용돌이");
    else if (pl.spread) setStatus(IS_QUINT ? "👐 양손 벌림 · 성운 팽창" : "👐 양손 벌림 · 번개 유지");
    else if (pl.combo && DUO_LABELS[pl.combo]) setStatus(DUO_LABELS[pl.combo]);
    else {
      const [L, R] = pl.pair || sortedHands();
      setStatus(`${ACTIVE_POSE_LABELS[L.pose] || "왼손"} ↔ ${ACTIVE_POSE_LABELS[R.pose] || "오른손"}`);
    }
  } else if (state.hands.length === 1) {
    const hh = state.hands[0];
    setStatus(ACTIVE_POSE_LABELS[hh.pose] || `${hh.side === "Left" ? "왼손" : "오른손"}`);
  } else if (!state.hands.length) {
    setStatus("1~2명이 카메라에 손을 비춰 주세요");
  }

  const blendUp = IS_QUINT ? 0.1 : 0.06;
  const blendDown = IS_QUINT ? 0.05 : 0.06;
  if (!anyTogether && !anySpread) {
    state.togetherBlend = Math.max(0, state.togetherBlend - blendDown);
    state.spreadBlend = Math.max(0, state.spreadBlend - blendDown);
  } else if (anyTogether) {
    state.togetherBlend = Math.min(1, state.togetherBlend + blendUp);
    state.spreadBlend = Math.max(0, state.spreadBlend - 0.1);
  } else if (anySpread) {
    state.spreadBlend = Math.min(1, state.spreadBlend + blendUp);
    state.togetherBlend = Math.max(0, state.togetherBlend - 0.1);
  }

  state.wasHeart = anyHeart;

  state.wasHandsTogether = state.handsTogether;
  state.wasHandsSpread = state.handsSpread;
  showStageError("");
}

let audioCtx = null;

function playBlip(freq = 330, duration = 0.12) {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = state.handsTogether ? "triangle" : "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  } catch { /* ignore */ }
}

function loop(now) {
  if (!landmarker) {
    rafId = requestAnimationFrame(loop);
    return;
  }
  if (video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    frameTimestamp += 33;
    try {
      const result = landmarker.detectForVideo(video, frameTimestamp);
      if (result.landmarks?.length) {
        processHands(result.landmarks, result.handedness, now);
      } else {
        state.hands = [];
        state.players = [];
        state.crossLink = null;
        // 손 인식이 끊겨도 tipGaps 유예 로직 사용 (바로 초기화하지 않음)
        updateLiveTipFilters([], canvas.width || 1, canvas.height || 1);
        state.wasPinching = [false, false, false, false];
        state.wasPose = [POSES.NEUTRAL, POSES.NEUTRAL, POSES.NEUTRAL, POSES.NEUTRAL];
        if (!state.liveTipHulls.length && !state.tipGaps?.demo) {
          setStatus("1~2명이 카메라에 손을 비춰 주세요");
        }
        lastLandmarks = [];
      }
    } catch (e) {
      showStageError(`손 인식 오류: ${e.message}`);
    }
  }
  drawFrame(now, lastLandmarks);
  rafId = requestAnimationFrame(loop);
}

function createDemoStream() {
  const c = document.createElement("canvas");
  c.width = 640; c.height = 480;
  const cctx = c.getContext("2d");
  let t = 0;
  const draw = () => {
    t += 0.025;
    cctx.fillStyle = "#120a1c";
    cctx.fillRect(0, 0, 640, 480);
    // 2명(좌 P1 / 우 P2) × 양손 마커 — MediaPipe가 잡을 수 있는 대비색
    const people = [
      { base: 170, cols: ["#5ec8ff", "#9b7dff"] },
      { base: 470, cols: ["#ffb347", "#ff6b9d"] },
    ];
    people.forEach((person, pi) => {
      const handGap = 55 + Math.sin(t * 0.5 + pi) * 12;
      person.cols.forEach((col, hi) => {
        const x = person.base + (hi === 0 ? -handGap : handGap) + Math.sin(t + pi + hi) * 10;
        const y = 230 + Math.cos(t * 0.8 + pi * 0.7) * 28 + hi * 8;
        cctx.fillStyle = col;
        cctx.beginPath();
        cctx.arc(x, y, 14, 0, Math.PI * 2);
        cctx.fill();
        cctx.strokeStyle = "rgba(255,255,255,0.4)";
        cctx.lineWidth = 2;
        cctx.beginPath();
        cctx.arc(x, y, 17, 0, Math.PI * 2);
        cctx.stroke();
      });
      cctx.fillStyle = "rgba(255,255,255,0.7)";
      cctx.font = "bold 12px sans-serif";
      cctx.textAlign = "center";
      cctx.fillText(pi === 0 ? "P1" : "P2", person.base, 170);
    });
    demoAnimId = requestAnimationFrame(draw);
  };
  draw();
  return c.captureStream(30);
}

function waitForVideo() {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth > 0) return resolve();
    const onReady = () => { if (video.videoWidth > 0) resolve(); };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onReady);
    setTimeout(() => video.videoWidth > 0 ? resolve() : reject(new Error("카메라 영상 로드 실패")), 8000);
  });
}

async function initLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const make = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numHands: MAX_HANDS,
    minHandDetectionConfidence: 0.22,
    minHandPresenceConfidence: 0.22,
    minTrackingConfidence: 0.22,
  });
  try {
    landmarker = await HandLandmarker.createFromOptions(vision, make("GPU"));
    return "GPU";
  } catch {
    landmarker = await HandLandmarker.createFromOptions(vision, make("CPU"));
    return "CPU";
  }
}

async function start(useDemo = false) {
  const demoMode = useDemo || isDemoUrl;
  startBtn.disabled = true;
  if (demoBtn) demoBtn.disabled = true;
  errorMsg.hidden = true;
  errorMsg.textContent = "";
  let enteredStage = false;
  try {
    if (!demoMode && location.protocol === "file:") {
      throw new Error("python3 -m http.server 8080 후 http://localhost:8080 로 접속하세요");
    }

    startBtn.textContent = demoMode ? "데모 준비 중…" : "카메라 연결 중…";

    // WebGL은 시작을 막지 않음 (백그라운드 로드)
    const fxPromise = initFx();

    if (demoMode) {
      stream = createDemoStream();
    } else {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("이 브라우저는 카메라를 지원하지 않습니다. Safari/Chrome을 이용해 주세요.");
      }
      stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("카메라 권한 요청 시간 초과 — 주소창의 카메라 권한을 확인해 주세요")), 20000)),
      ]);
    }

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    try { video.setAttribute("playsinline", "true"); } catch {}
    await video.play();
    await waitForVideo();

    startScreen.hidden = true;
    stage.hidden = false;
    enteredStage = true;
    syncArStage();
    resize();
    window.addEventListener("resize", resize);
    setStatus(demoMode ? "데모 모드 · AI 모델 로딩 중…" : "AI 모델 로딩 중…");
    showStageError("");

    await Promise.race([
      initLandmarker(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("AI 모델 로딩 시간 초과 — 네트워크/광고차단을 확인해 주세요")), 45000)),
    ]);

    // FX 준비 여부만 확인 (실패해도 계속)
    await Promise.race([fxPromise, new Promise((r) => setTimeout(r, 8000))]);

    setStatus("준비 완료 · 손을 카메라에 비춰 보세요!");
    startBtn.disabled = false;
    startBtn.textContent = "카메라 허용하고 시작";
    if (demoBtn) demoBtn.disabled = false;
    rafId = requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    if (stream) {
      try { stream.getTracks().forEach((tr) => tr.stop()); } catch {}
      stream = null;
    }
    video.srcObject = null;
    if (enteredStage) {
      stage.hidden = true;
      startScreen.hidden = false;
    }
    startBtn.disabled = false;
    startBtn.textContent = "카메라 허용하고 시작";
    if (demoBtn) demoBtn.disabled = false;
    showStartError(err?.message || String(err) || "시작 실패");
  }
}

function stop() {
  if (rafId) cancelAnimationFrame(rafId);
  if (demoAnimId) cancelAnimationFrame(demoAnimId);
  if (stream) stream.getTracks().forEach((t) => t.stop());
  if (landmarker) landmarker.close();
  landmarker = stream = null;
  stage.hidden = true;
  startScreen.hidden = false;
  startBtn.disabled = false;
  if (demoBtn) demoBtn.disabled = false;
}

startBtn.addEventListener("click", () => start(false));
if (demoBtn) demoBtn.addEventListener("click", () => start(true));
stopBtn.addEventListener("click", stop);
if (arBtn) {
  arBtn.addEventListener("click", () => {
    setViewMode(state.arMode ? "art" : "ar");
  });
}

if (modeBar) {
  modeBar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mode]");
    if (!btn) return;
    setViewMode(btn.dataset.mode);
  });
}

if (testPanel) {
  testPanel.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-test]");
    if (!btn || !window.__HAND_TEST__) return;
    const t = btn.dataset.test;
    if (IS_QUINT) {
      if (t === "gravity") window.__HAND_TEST__.injectGravity();
      else if (t === "nebula") window.__HAND_TEST__.injectNebula();
      else if (t === "dig") window.__HAND_TEST__.injectDig();
      else if (t === "ether") window.__HAND_TEST__.injectEther();
      else if (t === "clear") window.__HAND_TEST__.clearFilters();
      return;
    }
    if (t === "loop") window.__HAND_TEST__.injectLoopFilter(state.filterStyleIdx % 4);
    else if (t === "tip") window.__HAND_TEST__.injectTipFilter();
    else if (t === "electric") {
      for (let i = 0; i < 12; i++) window.__HAND_TEST__.pulseElectric(3);
    } else if (t === "cycle") {
      window.__HAND_TEST__.clearFilters();
      window.__HAND_TEST__.injectLoopFilter(state.filterStyleIdx % 4);
    } else if (t === "clear") window.__HAND_TEST__.clearFilters();
  });
}

buildLegend();

/** 테스트/디버그용 — 클래식은 필터·전기, 제5원소는 우주 경로만 */
window.__HAND_TEST__ = {
  getState: () => state,
  addFilterZone,
  drawElectricArc,
  drawElectricCorona,
  /** 화면 중앙에 닫힌 다각형 필터 존 생성 */
  injectLoopFilter(styleIdx = 0) {
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;
    const cx = w * 0.5, cy = h * 0.48, rx = Math.min(w, h) * 0.18, ry = Math.min(w, h) * 0.14;
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    state.filterStyleIdx = styleIdx % FILTER_STYLES.length;
    addFilterZone(pts, 0.55);
    return state.filterZones[state.filterZones.length - 1];
  },
  /** 손가락 4꼭짓점 사진 필터(반투명) + 전기 테두리 주입 */
  injectTipFilter() {
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;
    const pts = [
      [w * 0.32, h * 0.38],
      [w * 0.68, h * 0.36],
      [w * 0.70, h * 0.68],
      [w * 0.30, h * 0.66],
    ];
    const imageIdx = nextFilterImageIdx();
    state.filterZones = [];
    state.liveTipHulls = [{ points: pts, hue: 0.72, imageIdx, kind: "photo" }];
    state.liveTipLinks = [
      [pts[0][0], pts[0][1], pts[1][0], pts[1][1], 0.72],
      [pts[1][0], pts[1][1], pts[2][0], pts[2][1], 0.72],
      [pts[2][0], pts[2][1], pts[3][0], pts[3][1], 0.72],
      [pts[3][0], pts[3][1], pts[0][0], pts[0][1], 0.72],
    ];
    state.tipGaps = { demo: { joined: true, opened: true, imageIdx, hue: 0.72 } };
    setStatus(IS_QUINT ? "🌌 에테르 베일 (테스트)" : "🪄 손끝 사이 필터 (테스트)");
    return { hulls: state.liveTipHulls.length, links: state.liveTipLinks.length, imageIdx };
  },
  injectGravity() {
    if (!quint) return null;
    state.togetherBlend = 1;
    state.spreadBlend = 0;
    quint.injectGravity(0.5, 0.48);
    setStatus("🌑 중력 우물 (테스트)");
    return true;
  },
  injectNebula() {
    if (!quint) return null;
    state.spreadBlend = 1;
    state.togetherBlend = 0;
    quint.injectNebula(0.5, 0.48);
    setStatus("🌌 성운 팽창 (테스트)");
    return true;
  },
  injectDig() {
    if (!quint) return null;
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;
    quint.onDig(0.5, 0.62, w, h);
    state.shake = Math.max(state.shake, 0.55);
    setStatus("🪨 대지 파열 (테스트)");
    return true;
  },
  injectEther() {
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;
    const pts = [
      [w * 0.34, h * 0.36],
      [w * 0.66, h * 0.34],
      [w * 0.68, h * 0.66],
      [w * 0.32, h * 0.64],
    ];
    state.liveTipHulls = [{ points: pts, hue: 0.62, kind: "ether" }];
    state.tipGaps = { demo: { joined: true, opened: true, hue: 0.62 } };
    quint?.injectEther?.(pts);
    setStatus("🌌 에테르 베일 (테스트)");
    return { hulls: state.liveTipHulls.length };
  },
  /** 전기 코로나를 손 위치에 강제 표시용 플래그 */
  pulseElectric(n = 3) {
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;
    for (let i = 0; i < n; i++) {
      drawElectricCorona(w * (0.3 + i * 0.2), h * 0.4, 0.55 + i * 0.1, 8);
      drawElectricArc(w * 0.25, h * 0.65, w * 0.75, h * 0.62, 0.58, 10, 14);
    }
    setStatus("⚡ 전기 아크 테스트");
  },
  clearFilters() {
    state.filterZones = [];
    state.liveTipHulls = [];
    state.liveTipLinks = [];
    state.tipGaps = {};
    state.fingerTrails = [[], [], [], []];
    state.togetherBlend = 0;
    state.spreadBlend = 0;
    quint?.clear?.();
    setStatus(IS_QUINT ? "우주 이펙트 초기화" : "필터 초기화");
  },
};

setViewMode(initialViewMode);
window.__HAND_APP_READY__ = true;
window.__HAND_SET_MODE__ = setViewMode;

