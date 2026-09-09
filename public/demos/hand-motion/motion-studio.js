import { GestureTracker } from "./hand-tracking.js";

const scene = document.body.dataset.scene || "ocean";
const canvas = document.getElementById("motion-canvas");
const ctx = canvas.getContext("2d");
const video = document.getElementById("motion-video");
const handBtn = document.getElementById("hand-input");
const errorEl = document.getElementById("motion-error");
const signalEl = document.getElementById("input-signal");

const GESTURE_LABELS = {
  neutral: "GESTURE READY",
  "1P": "1P · SINGLE PINCH",
  "1O": "1O · SINGLE OPEN",
  "1F": "1F · SINGLE FIST",
  "2P": "2P · DUAL PINCH",
  "2O": "2O · DUAL OPEN",
  "2F": "2F · DUAL FIST",
};
const GESTURE_COLORS = {
  neutral: [146, 255, 234],
  "1P": [118, 242, 255],
  "1O": [145, 255, 201],
  "1F": [255, 118, 93],
  "2P": [181, 157, 255],
  "2O": [255, 221, 151],
  "2F": [255, 86, 119],
};
const GESTURE_GUIDES = {
  ocean: { "1P": "손끝 소용돌이", "1O": "산호빛 조류 확장", "1F": "심해 압력파", "2P": "쌍둥이 와류", "2O": "대형 해류 개방", "2F": "해저 충격파" },
  cosmos: { "1P": "블랙홀 흡입", "1O": "성운 방출", "1F": "초신성 반발", "2P": "웜홀 연결", "2O": "은하 확장", "2F": "쌍성 폭발" },
  physics: { "1P": "가까운 물체 붙잡기", "1O": "물체 놓기", "1F": "반발장 생성", "2P": "두 물체 동시 고정", "2O": "전체 중력 해제", "2F": "양방향 충격량" },
  click: { "1P": "정밀 충격파", "1O": "빛의 개화", "1F": "압축 글리치", "2P": "이중 연쇄 반응", "2O": "전면 크로마 블룸", "2F": "대형 프랙처" },
};
const EVENT_KINDS = {
  ocean: { "1P": "vortex", "1O": "current", "1F": "pressure", "2P": "dual-vortex", "2O": "tide", "2F": "seabed" },
  cosmos: { "1P": "black-hole", "1O": "nebula", "1F": "supernova", "2P": "wormhole", "2O": "galaxy", "2F": "binary" },
  physics: { "1P": "grab", "1O": "release", "1F": "repel", "2P": "dual-grab", "2O": "zero-g", "2F": "impulse" },
  click: { "1P": "shock", "1O": "bloom", "1F": "glitch", "2P": "chain", "2O": "full-bloom", "2F": "fracture" },
};

let W = 1;
let H = 1;
let D = 1;
let last = performance.now();
let time = 0;
let tracker = null;
let handMode = false;
let cameraStarting = false;
let automaticRetries = 0;

const input = {
  x: 0.5, y: 0.5, px: 0.5, py: 0.5,
  vx: 0, vy: 0, down: false, fist: false,
  open: 0.7, dual: false, active: true,
  gesture: "neutral", hands: [],
};
const particles = [];
const bodies = [];
const bursts = [];
const trail = [];
const lastTrailByTrack = new Map();
const sceneEvents = [];
const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function resize() {
  D = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth;
  H = innerHeight;
  canvas.width = W * D;
  canvas.height = H * D;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(D, 0, 0, D, 0, 0);
  seed();
}

function seed() {
  particles.length = 0;
  bodies.length = 0;
  const count = scene === "cosmos" ? 850 : scene === "ocean" ? 620 : 180;
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x: Math.random(), y: Math.random(), px: 0, py: 0,
      z: rand(1, 0.15), a: Math.random() * Math.PI * 2,
      s: rand(2, 0.25), h: Math.random(),
    });
  }
  for (let i = 0; i < 64; i += 1) {
    bodies.push({
      x: rand(W * 0.88, W * 0.12), y: rand(H * 0.8, H * 0.12),
      vx: rand(90, -90), vy: rand(60, -60), r: rand(10, 3),
      m: rand(2.5, 0.6), h: i % 7,
    });
  }
}

function mountGestureGuide() {
  const guide = document.createElement("aside");
  guide.className = "gesture-guide";
  guide.innerHTML = `<header><span>GESTURE MAP</span><b>${scene.toUpperCase()}</b></header><ul>${Object.entries(GESTURE_GUIDES[scene]).map(([code, label]) => `<li data-gesture="${code}"><strong>${code}</strong><span>${label}</span></li>`).join("")}</ul>`;
  document.getElementById("motion-stage").appendChild(guide);
}

function triggerSceneEffect(code, hands) {
  const kind = EVENT_KINDS[scene][code];
  if (!kind) return;
  const points = hands.length ? hands.map((hand) => ({ x: hand.x * W, y: hand.y * H })) : [{ x: input.x * W, y: input.y * H }];
  const event = { kind, code, points, life: 1, age: 0, grabbed: [] };
  if (scene === "physics" && kind.includes("grab")) {
    const available = [...bodies];
    event.grabbed = points.map((point) => {
      available.sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y));
      return available.shift();
    }).filter(Boolean);
  }
  sceneEvents.push(event);
  for (const point of points) burst(point.x, point.y, code);
}

function setGesture(code, hands = input.hands) {
  if (code === input.gesture) return;
  const previous = input.gesture;
  input.gesture = code;
  input.dual = code.startsWith("2");
  input.down = code.endsWith("P");
  input.fist = code.endsWith("F");
  signalEl.textContent = GESTURE_LABELS[code] || GESTURE_LABELS.neutral;
  document.querySelectorAll(".gesture-guide li").forEach((item) => item.classList.toggle("active", item.dataset.gesture === code));
  if (code !== "neutral") triggerSceneEffect(code, hands);
  if (previous.endsWith("P") && code.endsWith("O")) sceneEvents.push({ kind: "release-transition", code, points: hands.map((hand) => ({ x: hand.x * W, y: hand.y * H })), life: 1, age: 0, grabbed: [] });
}

function pushTrail(x, y, vx, vy, track = "pointer", source = "pointer") {
  const speed = Math.hypot(vx, vy);
  const candidate = lastTrailByTrack.get(track);
  const previous = candidate && candidate.life > 0
    && Math.hypot(candidate.x - x, candidate.y - y) < Math.max(W, H) * 0.22
    ? candidate : null;
  const targetWidth = clamp(1.4 + speed * 3.8, 1.4, 10);
  const width = previous ? previous.width + (targetWidth - previous.width) * 0.24 : targetWidth;
  const point = {
    x: previous ? previous.x + (x - previous.x) * 0.62 : x,
    y: previous ? previous.y + (y - previous.y) * 0.62 : y,
    width,
    alpha: clamp(0.92 - speed * 0.11, 0.28, 0.9),
    life: source === "hand" ? 1.25 : 1,
    speed,
    track,
  };
  trail.push(point);
  lastTrailByTrack.set(track, point);
  if (trail.length > 180) trail.shift();
}

function pointer(event) {
  if (handMode && input.hands.length) return;
  input.px = input.x;
  input.py = input.y;
  input.x = event.clientX / W;
  input.y = event.clientY / H;
  input.vx = (input.x - input.px) * 60;
  input.vy = (input.y - input.py) * 60;
  input.active = true;
  input.hands = [{ x: input.x, y: input.y, pose: input.down ? "pinch" : "neutral" }];
  pushTrail(event.clientX, event.clientY, input.vx, input.vy);
}

canvas.addEventListener("pointermove", pointer);
canvas.addEventListener("pointerdown", (event) => {
  pointer(event);
  input.down = true;
  setGesture("1P", input.hands);
});
addEventListener("pointerup", () => {
  if (handMode && input.hands.length) return;
  input.down = false;
  input.hands = input.hands.map((hand) => ({ ...hand, pose: "neutral" }));
  setGesture("neutral");
});
addEventListener("resize", resize);

function burst(x, y, gesture = input.gesture) {
  bursts.push({ x, y, r: 5, life: 1, type: scene, gesture });
  if (scene === "physics") {
    const polarity = gesture.endsWith("P") ? -1 : 1;
    for (const body of bodies) {
      const dx = body.x - x;
      const dy = body.y - y;
      const d = Math.hypot(dx, dy) + 1;
      if (d < 280) {
        const strength = 720 * (1 - d / 280) * polarity;
        body.vx += (dx / d) * strength;
        body.vy += (dy / d) * strength;
      }
    }
  }
}

function background(inner, outer) {
  const gradient = ctx.createRadialGradient(
    input.x * W, input.y * H, 0,
    W * 0.5, H * 0.48, Math.max(W, H) * 0.82,
  );
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
}

function gestureForce(dx, dy, d2, amount) {
  if (input.down) return -amount / d2;
  if (input.fist) return amount * 1.35 / d2;
  return 0;
}

function drawOcean(dt) {
  background("rgba(8,60,60,.32)", "#02080a");
  ctx.globalCompositeOperation = "screen";
  const dualBoost = input.dual ? 1.55 : 1;
  for (let band = 0; band < 7; band += 1) {
    ctx.beginPath();
    for (let x = -20; x < W + 20; x += 14) {
      const y = H * (0.2 + band * 0.1)
        + Math.sin(x * 0.006 + time * (0.26 + band * 0.04)) * 38
        + Math.sin(x * 0.013 - time * 0.4) * 12;
      if (x < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${band % 3 === 0 ? "255,118,93" : "108,255,229"},${0.055 + band * 0.008})`;
    ctx.lineWidth = 1.2 + band * 0.25;
    ctx.stroke();
  }
  for (const particle of particles) {
    particle.px = particle.x;
    particle.py = particle.y;
    const dx = particle.x - input.x;
    const dy = particle.y - input.y;
    const d2 = dx * dx + dy * dy + 0.003;
    const d = Math.sqrt(d2);
    const flow = Math.sin(particle.y * 12 + time * 0.32)
      + Math.cos(particle.x * 9 - time * 0.24);
    particle.a += flow * 0.012;
    const radial = gestureForce(dx, dy, d2, 0.00011) * dualBoost;
    particle.x += Math.cos(particle.a) * dt * (0.012 + particle.z * 0.024)
      + input.vx * 0.00003 / d2 + (dx / d) * radial * dt;
    particle.y += Math.sin(particle.a) * dt * (0.009 + particle.z * 0.016)
      + 0.002 * dt + (dy / d) * radial * dt;
    if (particle.x < 0) particle.x = 1;
    if (particle.x > 1) particle.x = 0;
    if (particle.y < 0) particle.y = 1;
    if (particle.y > 1) particle.y = 0;
    ctx.strokeStyle = `rgba(${particle.h > 0.88 ? "255,125,99" : "139,255,232"},${0.12 + particle.z * 0.5})`;
    ctx.lineWidth = 0.35 + particle.z * 1.2;
    ctx.beginPath();
    ctx.moveTo(particle.px * W, particle.py * H);
    ctx.lineTo(particle.x * W, particle.y * H);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawCosmos(dt) {
  background("rgba(52,25,94,.35)", "#020207");
  const cx = input.x;
  const cy = input.y;
  ctx.globalCompositeOperation = "screen";
  for (const particle of particles) {
    particle.px = particle.x;
    particle.py = particle.y;
    const dx = particle.x - cx;
    const dy = particle.y - cy;
    const d = Math.hypot(dx, dy) + 0.004;
    const field = input.down ? -0.035 : input.fist ? 0.045 : 0.007;
    const gravity = field * dt * (input.dual ? 1.55 : 1) / (d * d + 0.01);
    particle.a += dt * (0.12 + particle.z * 0.3);
    particle.x += (-dy / d) * dt * 0.012 * particle.z + (dx / d) * gravity;
    particle.y += (dx / d) * dt * 0.012 * particle.z + (dy / d) * gravity;
    if (particle.x < -0.1 || particle.x > 1.1 || particle.y < -0.1 || particle.y > 1.1) {
      particle.x = Math.random();
      particle.y = Math.random();
    }
    const color = particle.h > 0.82 ? "255,147,193" : particle.h > 0.65 ? "173,151,255" : "199,232,255";
    ctx.strokeStyle = `rgba(${color},${0.18 + particle.z * 0.72})`;
    ctx.lineWidth = 0.3 + particle.z * 1.35;
    ctx.beginPath();
    ctx.moveTo(particle.px * W, particle.py * H);
    ctx.lineTo(particle.x * W, particle.y * H);
    ctx.stroke();
  }
  const x = cx * W;
  const y = cy * H;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, 130);
  halo.addColorStop(0, input.down ? "rgba(0,0,0,.98)" : input.fist ? "rgba(255,86,119,.8)" : "rgba(230,246,255,.9)");
  halo.addColorStop(0.08, "rgba(171,145,255,.65)");
  halo.addColorStop(0.35, "rgba(255,111,177,.12)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 130, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i += 1) {
    ctx.strokeStyle = `rgba(${i % 2 ? "255,128,188" : "180,159,255"},${0.48 - i * 0.075})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 35 + i * 18, 9 + i * 6, time * (i % 2 ? 0.35 : -0.28) + i, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawPhysics(dt) {
  background("rgba(55,28,22,.27)", "#050707");
  let hits = 0;
  const hx = input.x * W;
  const hy = input.y * H;
  for (const body of bodies) {
    body.vy += 52 * dt;
    const dx = hx - body.x;
    const dy = hy - body.y;
    const d2 = dx * dx + dy * dy + 900;
    const d = Math.sqrt(d2);
    const polarity = input.fist ? -1 : input.down ? 1 : 0.36;
    const force = polarity * 210000 * (input.dual ? 1.55 : 1) / d2;
    body.vx += (dx / d) * force * dt;
    body.vy += (dy / d) * force * dt;
    body.vx *= Math.pow(0.992, dt * 60);
    body.vy *= Math.pow(0.992, dt * 60);
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    if (body.x < body.r || body.x > W - body.r) {
      body.x = clamp(body.x, body.r, W - body.r);
      body.vx *= -0.86;
    }
    if (body.y < body.r || body.y > H - body.r) {
      body.y = clamp(body.y, body.r, H - body.r);
      body.vy *= -0.86;
    }
  }
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minDistance = a.r + b.r;
      if (d && d < minDistance) {
        const nx = dx / d;
        const ny = dy / d;
        const overlap = (minDistance - d) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
        const relativeVelocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (relativeVelocity < 0) {
          const impulse = -1.78 * relativeVelocity / (1 / a.m + 1 / b.m);
          a.vx -= impulse * nx / a.m;
          a.vy -= impulse * ny / a.m;
          b.vx += impulse * nx / b.m;
          b.vy += impulse * ny / b.m;
        }
        hits += 1;
      }
    }
  }
  ctx.globalCompositeOperation = "screen";
  for (const body of bodies) {
    const speed = Math.hypot(body.vx, body.vy);
    ctx.shadowColor = body.h % 4 === 0 ? "#ff8068" : "#9dffe7";
    ctx.shadowBlur = 8 + speed * 0.02;
    ctx.fillStyle = body.h % 4 === 0 ? "#ff8068" : "#9dffe7";
    ctx.beginPath();
    ctx.arc(body.x, body.y, body.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.beginPath();
    ctx.moveTo(body.x, body.y);
    ctx.lineTo(body.x - body.vx * 0.07, body.y - body.vy * 0.07);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.setLineDash([4, 9]);
  ctx.lineDashOffset = -time * 25;
  ctx.strokeStyle = input.fist ? "rgba(255,128,104,.85)" : "rgba(157,255,231,.7)";
  ctx.beginPath();
  ctx.arc(hx, hy, input.fist ? 58 : 92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalCompositeOperation = "source-over";
  if (input.gesture === "neutral") signalEl.textContent = `${hits} COLLISIONS`;
}

function drawTrails(dt) {
  const palette = {
    ocean: [112, 255, 230],
    cosmos: [190, 174, 255],
    physics: [255, 126, 98],
    click: [255, 220, 151],
  }[scene];
  ctx.save();
  ctx.globalCompositeOperation = scene === "physics" ? "source-over" : "screen";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = `rgb(${palette.join(",")})`;
  ctx.shadowBlur = scene === "cosmos" ? 15 : scene === "ocean" ? 9 : 5;
  for (let index = 1; index < trail.length; index += 1) {
    const previous = trail[index - 1];
    const point = trail[index];
    if (previous.track !== point.track) continue;
    const alpha = clamp(point.life * point.alpha, 0, 1);
    ctx.strokeStyle = `rgba(${palette.join(",")},${alpha * (scene === "cosmos" ? 0.72 : 0.56)})`;
    ctx.lineWidth = point.width * (scene === "ocean" ? 1.25 : scene === "cosmos" ? 0.72 : 1);
    if (scene === "physics") ctx.setLineDash([Math.max(2, point.width), Math.max(5, point.speed * 8)]);
    const midX = (previous.x + point.x) * 0.5;
    const midY = (previous.y + point.y) * 0.5;
    const bend = scene === "ocean" ? Math.sin(time * 3 + index * 0.2) * Math.min(8, point.speed * 3) : 0;
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.quadraticCurveTo(previous.x + bend, previous.y - bend, midX, midY);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
  for (const point of trail) point.life -= dt * (0.72 + point.speed * 0.035);
  while (trail[0]?.life <= 0) trail.shift();
}

function drawClick(dt) {
  background("rgba(43,32,16,.28)", "#060706");
  ctx.globalCompositeOperation = "screen";
  for (const effect of bursts) {
    if (effect.type !== "click") continue;
    effect.r += dt * (effect.gesture?.startsWith("2") ? 205 : 150);
    effect.life -= dt * 0.55;
    const rgb = GESTURE_COLORS[effect.gesture] || GESTURE_COLORS["1P"];
    for (let i = 0; i < 12; i += 1) {
      const angle = i / 12 * Math.PI * 2 + time * 0.16;
      const length = effect.r * (1 + 0.28 * Math.sin(i * 2.3));
      ctx.strokeStyle = `rgba(${rgb.join(",")},${effect.life * 0.52})`;
      ctx.beginPath();
      ctx.moveTo(effect.x + Math.cos(angle) * effect.r * 0.25, effect.y + Math.sin(angle) * effect.r * 0.25);
      ctx.quadraticCurveTo(
        effect.x + Math.cos(angle + 0.28) * length * 0.7,
        effect.y + Math.sin(angle + 0.28) * length * 0.7,
        effect.x + Math.cos(angle) * length,
        effect.y + Math.sin(angle) * length,
      );
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawBursts(dt) {
  for (const effect of bursts) {
    if (effect.type === "click") continue;
    effect.r += dt * (effect.gesture?.startsWith("2") ? 280 : 210);
    effect.life -= dt * 0.9;
    const rgb = GESTURE_COLORS[effect.gesture] || [255, 255, 255];
    ctx.strokeStyle = `rgba(${rgb.join(",")},${effect.life * 0.55})`;
    ctx.lineWidth = effect.gesture?.endsWith("F") ? 3 : 1;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, effect.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = bursts.length - 1; i >= 0; i -= 1) {
    if (bursts[i].life <= 0) bursts.splice(i, 1);
  }
}

function drawSceneEvents(dt) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const event of sceneEvents) {
    event.age += dt;
    if (input.gesture === event.code && input.hands.length) {
      event.life = 1;
      event.points = input.hands.map((hand) => ({ x: hand.x * W, y: hand.y * H }));
    } else {
      event.life -= dt * 0.7;
    }
    const rgb = GESTURE_COLORS[event.code] || GESTURE_COLORS.neutral;
    const alpha = Math.max(0, event.life);
    for (const [index, point] of event.points.entries()) {
      if (scene === "ocean") {
        ctx.strokeStyle = `rgba(${rgb.join(",")},${alpha * 0.65})`;
        ctx.lineWidth = event.kind.includes("pressure") || event.kind === "seabed" ? 3 : 1.4;
        ctx.beginPath();
        for (let angle = 0; angle < Math.PI * 5; angle += 0.14) {
          const radius = angle * (event.kind.includes("vortex") ? 5 : 8) + event.age * 24;
          const x = point.x + Math.cos(angle + time * (index ? -2 : 2)) * radius;
          const y = point.y + Math.sin(angle + time * (index ? -2 : 2)) * radius * 0.55;
          if (angle === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (scene === "cosmos") {
        const radius = 24 + event.age * (event.kind === "black-hole" ? 18 : 70);
        const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.2);
        glow.addColorStop(0, event.kind.includes("hole") || event.kind === "wormhole" ? "rgba(0,0,0,.95)" : `rgba(${rgb.join(",")},${alpha * 0.8})`);
        glow.addColorStop(0.28, `rgba(${rgb.join(",")},${alpha * 0.4})`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(point.x, point.y, radius * 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(${rgb.join(",")},${alpha * 0.72})`;
        ctx.beginPath(); ctx.ellipse(point.x, point.y, radius * 1.7, radius * 0.38, time * (index ? -0.7 : 0.7), 0, Math.PI * 2); ctx.stroke();
      } else if (scene === "physics") {
        const body = event.grabbed[index];
        if (body && event.kind.includes("grab") && input.gesture === event.code) {
          body.vx += (point.x - body.x) * dt * 22;
          body.vy += (point.y - body.y) * dt * 22;
          body.vx *= 0.82; body.vy *= 0.82;
          ctx.strokeStyle = `rgba(${rgb.join(",")},${alpha * 0.85})`;
          ctx.setLineDash([3, 7]); ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(body.x, body.y); ctx.stroke(); ctx.setLineDash([]);
        }
        if (event.kind === "zero-g") for (const item of bodies) item.vy *= 0.94;
      } else {
        ctx.strokeStyle = `rgba(${rgb.join(",")},${alpha * 0.68})`;
        ctx.lineWidth = event.kind === "glitch" || event.kind === "fracture" ? 3 : 1.2;
        const rays = event.kind.includes("bloom") ? 18 : event.kind === "glitch" ? 9 : 14;
        for (let ray = 0; ray < rays; ray += 1) {
          const angle = ray / rays * Math.PI * 2 + time * 0.18;
          const length = 35 + event.age * (event.kind === "fracture" ? 230 : 150);
          ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(point.x + Math.cos(angle) * length, point.y + Math.sin(angle) * length); ctx.stroke();
        }
      }
    }
    if (event.points.length === 2 && (event.kind === "wormhole" || event.kind === "dual-vortex" || event.kind === "chain")) {
      const [a, b] = event.points;
      ctx.strokeStyle = `rgba(${rgb.join(",")},${alpha * 0.8})`;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(W * 0.5, 0, W * 0.5, H, b.x, b.y); ctx.stroke();
    }
  }
  ctx.restore();
  for (let index = sceneEvents.length - 1; index >= 0; index -= 1) if (sceneEvents[index].life <= 0) sceneEvents.splice(index, 1);
}

function drawGestureLayer() {
  if (!input.hands.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const rgb = GESTURE_COLORS[input.gesture] || GESTURE_COLORS.neutral;
  if (input.hands.length === 2) {
    const [a, b] = input.hands;
    const gradient = ctx.createLinearGradient(a.x * W, a.y * H, b.x * W, b.y * H);
    gradient.addColorStop(0, `rgba(${rgb.join(",")},.08)`);
    gradient.addColorStop(0.5, `rgba(${rgb.join(",")},.72)`);
    gradient.addColorStop(1, `rgba(${rgb.join(",")},.08)`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = input.gesture === "2F" ? 4 : 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x * W, a.y * H);
    ctx.quadraticCurveTo(W * 0.5, H * (0.5 + Math.sin(time * 2) * 0.05), b.x * W, b.y * H);
    ctx.stroke();
  }
  for (const hand of input.hands) {
    const radius = hand.pose === "pinch" ? 26 : hand.pose === "fist" ? 54 : 78 + hand.openness * 18;
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.strokeStyle = `rgba(${rgb.join(",")},${0.52 - ring * 0.13})`;
      ctx.lineWidth = hand.pose === "fist" ? 2.5 : 1;
      ctx.beginPath();
      ctx.ellipse(
        hand.x * W, hand.y * H,
        radius + ring * 14, (radius + ring * 14) * (hand.pose === "open" ? 0.62 : 1),
        time * (ring % 2 ? -0.3 : 0.22), 0, Math.PI * 2,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = clamp((now - last) / 1000, 0.005, 0.033);
  last = now;
  time += dt;
  if (handMode && tracker) {
    try {
      const result = tracker.update(now, dt);
      if (result) {
        const hands = result.hands;
        if (hands.length) {
          input.px = input.x;
          input.py = input.y;
          input.x = hands.reduce((sum, hand) => sum + hand.x, 0) / hands.length;
          input.y = hands.reduce((sum, hand) => sum + hand.y, 0) / hands.length;
          input.vx = hands.reduce((sum, hand) => sum + hand.vx, 0) / hands.length;
          input.vy = hands.reduce((sum, hand) => sum + hand.vy, 0) / hands.length;
          input.open = hands.reduce((sum, hand) => sum + hand.openness, 0) / hands.length;
          for (const hand of hands) {
            pushTrail(hand.x * W, hand.y * H, hand.vx, hand.vy, hand.key, "hand");
          }
        }
        input.hands = hands;
        setGesture(result.gesture, hands);
      }
    } catch (error) {
      errorEl.textContent = error.message || String(error);
    }
  }
  if (scene === "ocean") drawOcean(dt);
  else if (scene === "cosmos") drawCosmos(dt);
  else if (scene === "physics") drawPhysics(dt);
  else drawClick(dt);
  drawTrails(dt);
  drawBursts(dt);
  drawSceneEvents(dt);
  drawGestureLayer();
}

async function enableHand() {
  if (cameraStarting || handMode) return;
  cameraStarting = true;
  handBtn.hidden = true;
  handBtn.disabled = true;
  errorEl.textContent = "";
  try {
    tracker = new GestureTracker(video);
    await tracker.start();
    handMode = true;
    cameraStarting = false;
    handBtn.classList.remove("retry");
    signalEl.textContent = "SHOW 1 OR 2 HANDS";
  } catch (error) {
    cameraStarting = false;
    tracker?.stop();
    tracker = null;
    errorEl.textContent = `카메라를 시작할 수 없습니다. ${error.message || error}`;
    handBtn.disabled = false;
    if (error.name !== "NotAllowedError" && automaticRetries < 1) {
      automaticRetries += 1;
      setTimeout(enableHand, 1800);
    } else {
      handBtn.hidden = false;
      handBtn.classList.add("retry");
      handBtn.textContent = "RETRY CAMERA";
    }
  }
}

handBtn.addEventListener("click", enableHand);
mountGestureGuide();
resize();
requestAnimationFrame(loop);
enableHand();
window.__HAND_APP_READY__ = true;
