const scene = document.body.dataset.scene || "ocean";
const canvas = document.getElementById("motion-canvas");
const ctx = canvas.getContext("2d");
const video = document.getElementById("motion-video");
const handBtn = document.getElementById("hand-input");
const errorEl = document.getElementById("motion-error");
const signalEl = document.getElementById("input-signal");

const TIP_IDS = [4, 8, 12, 16, 20];
const FINGER_PAIRS = [[8, 6], [12, 10], [16, 14], [20, 18]];
const PINCH_ENTER = 0.42;
const PINCH_EXIT = 0.55;
const FIST_ENTER = 0.25;
const FIST_EXIT = 0.38;
const OPEN_ENTER = 0.68;
const OPEN_EXIT = 0.54;
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

let W = 1;
let H = 1;
let D = 1;
let last = performance.now();
let time = 0;
let landmarker = null;
let stream = null;
let lastVideo = -1;
let handMode = false;
let lostHandFrames = 0;

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
const handStates = new Map();
const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

class MajorityLatch {
  constructor() {
    this.state = false;
    this.history = [];
  }
  update(candidate) {
    this.history.push(candidate);
    if (this.history.length > 5) this.history.shift();
    const yes = this.history.filter(Boolean).length;
    const no = this.history.length - yes;
    if (!this.state && yes >= 3) this.state = true;
    else if (this.state && no >= 3) this.state = false;
    return this.state;
  }
  reset() {
    this.state = false;
    this.history.length = 0;
  }
}

class StableHandState {
  constructor() {
    this.pinch = new MajorityLatch();
    this.fist = new MajorityLatch();
    this.open = new MajorityLatch();
    this.x = null;
    this.y = null;
  }
  update(pinchRatio, openness, fingerCount) {
    const pinchShape = openness > (this.pinch.state ? 0.16 : 0.22) || fingerCount >= 1;
    const pinching = this.pinch.update(
      pinchRatio < (this.pinch.state ? PINCH_EXIT : PINCH_ENTER) && pinchShape,
    );
    const fist = this.fist.update(
      openness < (this.fist.state ? FIST_EXIT : FIST_ENTER)
        && fingerCount <= (this.fist.state ? 2 : 1),
    );
    const open = this.open.update(
      openness > (this.open.state ? OPEN_EXIT : OPEN_ENTER)
        && fingerCount >= (this.open.state ? 3 : 4),
    );
    return pinching ? "pinch" : fist ? "fist" : open ? "open" : "neutral";
  }
  reset() {
    this.pinch.reset();
    this.fist.reset();
    this.open.reset();
  }
}

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

function setGesture(code, hands = input.hands) {
  if (code === input.gesture) return;
  input.gesture = code;
  input.dual = code.startsWith("2");
  input.down = code.endsWith("P");
  input.fist = code.endsWith("F");
  signalEl.textContent = GESTURE_LABELS[code] || GESTURE_LABELS.neutral;
  if (code !== "neutral") {
    for (const hand of hands) burst(hand.x * W, hand.y * H, code);
  }
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
  trail.push({ x: event.clientX, y: event.clientY, life: 1 });
  if (trail.length > 38) trail.shift();
}

canvas.addEventListener("pointermove", pointer);
canvas.addEventListener("pointerdown", (event) => {
  pointer(event);
  input.down = true;
  setGesture("1P", input.hands);
  burst(event.clientX, event.clientY, "pointer");
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

function drawClick(dt) {
  background("rgba(43,32,16,.28)", "#060706");
  trail.forEach((point, index) => {
    point.life -= dt * 1.5;
    if (index) {
      const previous = trail[index - 1];
      ctx.strokeStyle = `rgba(255,224,166,${point.life * 0.34})`;
      ctx.lineWidth = 1 + point.life * 3;
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  });
  while (trail[0]?.life <= 0) trail.shift();
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

function fingerCount(landmarks, scale) {
  const wrist = landmarks[0];
  let count = FINGER_PAIRS.reduce((sum, [tip, pip]) => (
    sum + (distance(landmarks[tip], wrist) > distance(landmarks[pip], wrist) * 1.12 ? 1 : 0)
  ), 0);
  const thumbOpen = distance(landmarks[4], wrist) > distance(landmarks[3], wrist) * 1.08
    && distance(landmarks[4], landmarks[5]) / scale > 0.42;
  if (thumbOpen) count += 1;
  return count;
}

function measureHand(landmarks, state, dt) {
  const scale = Math.max(distance(landmarks[0], landmarks[9]), 1e-6);
  const center = {
    x: (landmarks[0].x + landmarks[9].x) * 0.5,
    y: (landmarks[0].y + landmarks[9].y) * 0.5,
  };
  const meanRatio = TIP_IDS.reduce(
    (sum, id) => sum + distance(landmarks[id], center) / scale, 0,
  ) / TIP_IDS.length;
  const openness = clamp((meanRatio - 0.72) / 1.15, 0, 1);
  const ratio = distance(landmarks[4], landmarks[8]) / scale;
  const fingers = fingerCount(landmarks, scale);
  const pose = state.update(ratio, openness, fingers);
  const targetX = 1 - landmarks[9].x;
  const targetY = landmarks[9].y;
  const alpha = 1 - Math.exp(-dt * 14);
  const oldX = state.x ?? targetX;
  const oldY = state.y ?? targetY;
  state.x = oldX + (targetX - oldX) * alpha;
  state.y = oldY + (targetY - oldY) * alpha;
  return {
    x: state.x, y: state.y,
    vx: (state.x - oldX) / Math.max(dt, 0.001),
    vy: (state.y - oldY) / Math.max(dt, 0.001),
    openness, pinchRatio: ratio, fingerCount: fingers, pose,
  };
}

function aggregateGesture(hands) {
  const letter = { pinch: "P", open: "O", fist: "F" };
  if (hands.length === 1 && letter[hands[0].pose]) return `1${letter[hands[0].pose]}`;
  if (hands.length >= 2 && hands[0].pose === hands[1].pose && letter[hands[0].pose]) {
    return `2${letter[hands[0].pose]}`;
  }
  return "neutral";
}

function applyHandResult(result, dt) {
  const landmarksList = result.landmarks || [];
  if (!landmarksList.length) {
    lostHandFrames += 1;
    if (lostHandFrames > 8) {
      input.hands = [];
      setGesture("neutral", []);
      for (const state of handStates.values()) state.reset();
    }
    return;
  }
  lostHandFrames = 0;
  const hands = landmarksList.slice(0, 2).map((landmarks, index) => {
    const key = result.handednesses?.[index]?.[0]?.categoryName || `hand-${index}`;
    if (!handStates.has(key)) handStates.set(key, new StableHandState());
    return measureHand(landmarks, handStates.get(key), dt);
  });
  input.px = input.x;
  input.py = input.y;
  input.x = hands.reduce((sum, hand) => sum + hand.x, 0) / hands.length;
  input.y = hands.reduce((sum, hand) => sum + hand.y, 0) / hands.length;
  input.vx = hands.reduce((sum, hand) => sum + hand.vx, 0) / hands.length;
  input.vy = hands.reduce((sum, hand) => sum + hand.vy, 0) / hands.length;
  input.open = hands.reduce((sum, hand) => sum + hand.openness, 0) / hands.length;
  input.hands = hands;
  input.active = true;
  setGesture(aggregateGesture(hands), hands);
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = clamp((now - last) / 1000, 0.005, 0.033);
  last = now;
  time += dt;
  if (handMode && landmarker && video.readyState >= 2 && video.currentTime !== lastVideo) {
    lastVideo = video.currentTime;
    try {
      applyHandResult(landmarker.detectForVideo(video, now), dt);
    } catch (error) {
      errorEl.textContent = error.message || String(error);
    }
  }
  if (scene === "ocean") drawOcean(dt);
  else if (scene === "cosmos") drawCosmos(dt);
  else if (scene === "physics") drawPhysics(dt);
  else drawClick(dt);
  drawBursts(dt);
  drawGestureLayer();
}

async function enableHand() {
  handBtn.disabled = true;
  errorEl.textContent = "";
  try {
    const { FilesetResolver, HandLandmarker } = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14"
    );
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    handMode = true;
    handBtn.classList.add("active");
    handBtn.textContent = "HAND ACTIVE";
    signalEl.textContent = "SHOW 1 OR 2 HANDS";
  } catch (error) {
    errorEl.textContent = error.message || String(error);
    handBtn.disabled = false;
  }
}

handBtn.addEventListener("click", enableHand);
resize();
requestAnimationFrame(loop);
window.__HAND_APP_READY__ = true;
