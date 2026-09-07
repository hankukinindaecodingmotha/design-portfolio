/**
 * Quintessence — dedicated cosmos experience (not classic electric reuse).
 * Gather = gravity well / accretion. Spread = expanding nebula.
 * Dig = earth rupture. Tip hulls = ether veil (not photo filters).
 *
 * Visual detail pass: noise-driven nebula drift, parallax starfield with
 * shooting stars, turbulent accretion disk, organic ether veil, and a
 * cheap downsample+blur "bloom" composite so bright cores actually glow
 * instead of reading as flat vector shapes. Noise field powered by the
 * open-source simplex-noise algorithm (see ./noise.js).
 */
import { createNoise } from "./noise.js";

const { noise2D, fbm2D } = createNoise(20260906);

export function createQuintessence() {
  const stars = Array.from({ length: 260 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: 0.15 + Math.random() * 0.85,
    tw: Math.random() * Math.PI * 2,
    twSpeed: 0.6 + Math.random() * 1.4,
    hue: Math.random() < 0.16 ? 0.85 : Math.random() < 0.12 ? 0.55 : 0.62,
  }));

  /** slow drifting background nebula clouds — soft, low-alpha, additive */
  const nebulaBlobs = Array.from({ length: 12 }, (_, i) => ({
    x: Math.random(),
    y: Math.random() * 0.85,
    r: 0.16 + Math.random() * 0.26,
    seed: i * 11.7 + 3.1,
    hueA: Math.random() < 0.5 ? "120,120,255" : "170,90,220",
    hueB: Math.random() < 0.5 ? "255,120,200" : "90,180,255",
  }));

  /** occasional streaking comets for idle liveliness */
  const comets = [];
  let comitCooldown = 2.5;

  /** orbiting accretion / nebula particles (normalized coords) */
  const orbits = [];
  const dust = [];
  const bursts = [];
  const rings = [];
  const cracks = [];
  const embers = [];
  const sparkles = [];
  let etherPulse = 0;
  let gravPhase = 0;
  let shake = 0;
  let lastPose = "";
  let wellBoost = 0;
  let nebulaBoost = 0;

  // ---- cheap bloom: downsample bright elements, blur, add back additively ----
  const BLOOM_SCALE = 0.32;
  let bloomCanvas = null;
  let bloomCtx = null;
  let bloomW = 0;
  let bloomH = 0;

  function ensureBloom(W, H) {
    const w = Math.max(2, Math.round(W * BLOOM_SCALE));
    const h = Math.max(2, Math.round(H * BLOOM_SCALE));
    if (!bloomCanvas) {
      bloomCanvas = document.createElement("canvas");
      bloomCtx = bloomCanvas.getContext("2d");
    }
    if (bloomCanvas.width !== w || bloomCanvas.height !== h) {
      bloomCanvas.width = w;
      bloomCanvas.height = h;
    }
    bloomW = w;
    bloomH = h;
    bloomCtx.setTransform(BLOOM_SCALE, 0, 0, BLOOM_SCALE, 0, 0);
    bloomCtx.clearRect(0, 0, W, H);
    return bloomCtx;
  }

  function compositeBloom(ctx, W, H, strength) {
    if (!bloomCanvas) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = strength;
    try {
      ctx.filter = `blur(${Math.max(2, bloomW * 0.05).toFixed(1)}px)`;
    } catch {}
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bloomCanvas, 0, 0, bloomW, bloomH, 0, 0, W, H);
    ctx.filter = "none";
    ctx.restore();
  }

  function glow(bctx, x, y, r, rgb, a) {
    if (!bctx || r <= 0 || a <= 0) return;
    const g = bctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    bctx.fillStyle = g;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }

  function emitDust(nx, ny, color, n = 10, speed = 0.012) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random());
      dust.push({
        x: nx,
        y: ny,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.55 + Math.random() * 0.7,
        max: 0.55 + Math.random() * 0.7,
        r: 1.4 + Math.random() * 4.2,
        color,
      });
    }
  }

  /** px, py in pixel space (matches bursts/rings/cracks, unlike the normalized dust/orbit arrays) */
  function emitEmbers(px, py, n, hue) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const s = 40 + Math.random() * 160;
      embers.push({
        x: px, y: py,
        vx: Math.cos(a) * s * 0.4,
        vy: Math.sin(a) * s,
        life: 0.6 + Math.random() * 0.8,
        max: 0.6 + Math.random() * 0.8,
        size: 1.5 + Math.random() * 3,
        hue,
      });
    }
  }

  function seedOrbits(cx, cy, n, mode) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.04 + Math.random() * 0.22;
      orbits.push({
        cx,
        cy,
        a,
        prevA: a,
        r,
        spd: (mode === "in" ? 1.8 : 1.1) * (0.7 + Math.random()) * (Math.random() < 0.5 ? 1 : -1),
        life: 0.7 + Math.random() * 0.9,
        max: 0.7 + Math.random() * 0.9,
        mode, // in = spiral to center, out = expand
        size: 1.2 + Math.random() * 2.8,
        color: mode === "in" ? "rgba(170,220,255," : "rgba(255,170,255,",
        glowRgb: mode === "in" ? "170,220,255" : "255,170,255",
      });
    }
  }

  /** @param nx normalized 0–1 x @param ny normalized 0–1 y */
  function onDig(nx, ny, W, H) {
    shake = Math.max(shake, 0.7);
    const px = nx * W;
    const py = ny * H;
    bursts.push({
      x: px,
      y: py,
      r: 10,
      max: Math.min(W, H) * 0.28,
      life: 1,
      color: "rgba(200,130,70,",
      glowRgb: "255,170,110",
    });
    for (let i = 0; i < 6; i++) {
      rings.push({
        x: px,
        y: py,
        r: 14 + i * 12,
        life: 1 - i * 0.07,
        color: "rgba(160,100,50,",
      });
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
      cracks.push({
        x: px,
        y: py,
        a,
        len: 46 + Math.random() * 100,
        life: 1,
        seed: Math.random() * 100,
      });
    }
    emitDust(nx, ny, "rgba(190,125,70,", 55, 0.032);
    emitDust(nx, ny, "rgba(95,70,45,", 30, 0.018);
    emitEmbers(px, py, 22, 0.07);
  }

  /** Test / demo injectors — cosmos only, never electric */
  function injectGravity(nx = 0.5, ny = 0.48) {
    wellBoost = 1;
    nebulaBoost = 0;
    seedOrbits(nx, ny, 48, "in");
    emitDust(nx, ny, "rgba(180,220,255,", 36, 0.006);
  }

  function injectNebula(nx = 0.5, ny = 0.48) {
    nebulaBoost = 1;
    wellBoost = 0;
    seedOrbits(nx, ny, 56, "out");
    emitDust(nx, ny, "rgba(255,170,255,", 40, 0.022);
    emitDust(nx, ny, "rgba(140,180,255,", 24, 0.016);
  }

  function injectEther(points) {
    // points stored for one-shot pulse; drawEtherVeil reads tipHulls each frame
    etherPulse = 1;
    if (points?.length) {
      const cx = points.reduce((s, p) => s + (Array.isArray(p) ? p[0] : p.x), 0) / points.length;
      const cy = points.reduce((s, p) => s + (Array.isArray(p) ? p[1] : p.y), 0) / points.length;
      // convert approx to normalized later in draw — emit around center in norm space via caller
      return { cx, cy };
    }
    return null;
  }

  /**
   * @param {{ togetherBlend:number, spreadBlend:number, mid:{x:number,y:number}|null, pose:string }} snap
   */
  function update(dt, snap) {
    gravPhase += dt;
    etherPulse = Math.max(0, etherPulse - dt * 0.55);
    shake = Math.max(0, shake - dt * 1.6);
    wellBoost = Math.max(0, wellBoost - dt * 0.45);
    nebulaBoost = Math.max(0, nebulaBoost - dt * 0.4);

    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.life -= dt;
      if (p.life <= 0) dust.splice(i, 1);
    }
    for (let i = orbits.length - 1; i >= 0; i--) {
      const o = orbits[i];
      o.prevA = o.a;
      o.a += o.spd * dt;
      if (o.mode === "in") o.r = Math.max(0.008, o.r - dt * 0.09);
      else o.r += dt * 0.14;
      o.life -= dt;
      if (o.life <= 0) orbits.splice(i, 1);
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.r += (b.max - b.r) * Math.min(1, dt * 5);
      b.life -= dt * 1.35;
      if (b.life <= 0) bursts.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += dt * 100;
      r.life -= dt * 1.1;
      if (r.life <= 0) rings.splice(i, 1);
    }
    for (let i = cracks.length - 1; i >= 0; i--) {
      cracks[i].life -= dt * 0.9;
      if (cracks[i].life <= 0) cracks.splice(i, 1);
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.vy += dt * 140; // gravity, pixel space
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life -= dt;
      if (e.life <= 0) embers.splice(i, 1);
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
      sparkles[i].life -= dt;
      if (sparkles[i].life <= 0) sparkles.splice(i, 1);
    }

    // idle shooting stars for ambient life even with no hands
    comitCooldown -= dt;
    if (comitCooldown <= 0 && comets.length < 2) {
      comitCooldown = 3.5 + Math.random() * 5;
      const fromLeft = Math.random() < 0.5;
      const sy = 0.05 + Math.random() * 0.35;
      comets.push({
        x: fromLeft ? -0.05 : 1.05,
        y: sy,
        vx: (fromLeft ? 1 : -1) * (0.35 + Math.random() * 0.25),
        vy: 0.16 + Math.random() * 0.1,
        life: 1,
        trail: [],
      });
    }
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      c.trail.push({ x: c.x, y: c.y });
      if (c.trail.length > 14) c.trail.shift();
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.life -= dt * 0.28;
      if (c.life <= 0 || c.x < -0.15 || c.x > 1.15 || c.y > 1.15) comets.splice(i, 1);
    }

    const pose = snap?.pose || "";
    if (pose && pose !== lastPose) {
      etherPulse = 1;
      lastPose = pose;
    } else if (!pose) {
      lastPose = "";
    }

    const mid = snap?.mid;
    const pull = Math.max(snap?.togetherBlend || 0, wellBoost);
    const spread = Math.max(snap?.spreadBlend || 0, nebulaBoost);
    if (mid) {
      if (pull > 0.25) {
        seedOrbits(mid.x, mid.y, 2 + Math.floor(pull * 6), "in");
        emitDust(mid.x, mid.y, "rgba(170,210,255,", 2 + Math.floor(pull * 6), 0.0035);
      }
      if (spread > 0.25) {
        seedOrbits(mid.x, mid.y, 2 + Math.floor(spread * 5), "out");
        emitDust(mid.x, mid.y, "rgba(255,190,255,", 2 + Math.floor(spread * 5), 0.02);
        if (Math.random() < spread * 0.5) {
          sparkles.push({ x: mid.x + (Math.random() - 0.5) * spread * 0.5, y: mid.y + (Math.random() - 0.5) * spread * 0.3, life: 0.6 + Math.random() * 0.5, max: 1.1 });
        }
      }
    }
  }

  function drawNebulaClouds(ctx, bctx, W, H) {
    // soft, slow-drifting colored gas — kept low-alpha so AR camera reads through
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of nebulaBlobs) {
      const nx = fbm2D(b.seed, gravPhase * 0.015, 3) * 0.06;
      const ny = fbm2D(b.seed + 50, gravPhase * 0.015, 3) * 0.05;
      const x = (b.x + nx) * W;
      const y = (b.y + ny) * H;
      const r = Math.min(W, H) * b.r;
      const pulse = 0.85 + 0.15 * Math.sin(gravPhase * 0.3 + b.seed);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * pulse);
      g.addColorStop(0, `rgba(${b.hueA},0.05)`);
      g.addColorStop(0.5, `rgba(${b.hueB},0.035)`);
      g.addColorStop(1, "rgba(10,8,30,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStarfield(ctx, W, H, pull, cx, cy) {
    for (const s of stars) {
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * noise2D(s.tw, gravPhase * 0.5 * s.twSpeed));
      // gentle idle drift so the sky feels alive even with no gesture
      const driftX = fbm2D(s.x * 3 + 9, s.y * 3 + gravPhase * 0.01, 2) * 0.004 * (1 - s.z * 0.6);
      const driftY = fbm2D(s.y * 3 + 4, s.x * 3 + gravPhase * 0.01, 2) * 0.003 * (1 - s.z * 0.6);
      let x = (s.x + driftX) * W;
      let y = (s.y + driftY) * H;
      if (pull > 0.05) {
        const k = pull * (0.18 + s.z * 0.28);
        x += (cx - x) * k;
        y += (cy - y) * k;
      } else if (pull < -0.05) {
        const push = -pull;
        x -= (cx - x) * push * (0.1 + s.z * 0.16);
        y -= (cy - y) * push * (0.1 + s.z * 0.16);
      }
      const r = (0.7 + s.z * 2.2) * (1 + Math.abs(pull) * 0.45);
      const a = 0.22 + tw * 0.65 * s.z;
      if (s.hue > 0.7) ctx.fillStyle = `rgba(255,190,230,${a})`;
      else if (s.hue > 0.58) ctx.fillStyle = `rgba(170,230,255,${a})`;
      else ctx.fillStyle = `rgba(220,235,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // brightest stars get a tiny four-point sparkle glint
      if (s.z > 0.82 && tw > 0.75) {
        ctx.save();
        ctx.globalAlpha = (tw - 0.75) * 2.4 * s.z;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - r * 3.2, y); ctx.lineTo(x + r * 3.2, y);
        ctx.moveTo(x, y - r * 3.2); ctx.lineTo(x, y + r * 3.2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawComets(ctx, W, H) {
    for (const c of comets) {
      const n = c.trail.length;
      for (let i = 0; i < n; i++) {
        const p = c.trail[i];
        const t = i / Math.max(1, n - 1);
        ctx.fillStyle = `rgba(210,235,255,${0.5 * t * c.life})`;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 1.6 * t + 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(255,255,255,${0.9 * c.life})`;
      ctx.beginPath();
      ctx.arc(c.x * W, c.y * H, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGravityWell(ctx, bctx, cx, cy, pull, W, H) {
    if (pull < 0.05) return;
    const R = Math.min(W, H) * (0.12 + pull * 0.34);
    // dark core
    const core = ctx.createRadialGradient(cx, cy, 1, cx, cy, R * 0.35);
    core.addColorStop(0, `rgba(0,0,0,${0.75 * pull})`);
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.35, 0, Math.PI * 2);
    ctx.fill();

    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, R);
    g.addColorStop(0, `rgba(255,255,255,${0.75 * pull})`);
    g.addColorStop(0.18, `rgba(140,200,255,${0.5 * pull})`);
    g.addColorStop(0.45, `rgba(90,50,180,${0.35 * pull})`);
    g.addColorStop(0.75, `rgba(20,10,50,${0.22 * pull})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // photon-ring highlight — thin bright rim with faint chromatic split
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(160,220,255,${0.5 * pull})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.37, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,190,150,${0.28 * pull})`;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.395, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // turbulent accretion disk — noise-perturbed edge instead of a clean ellipse
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(gravPhase * 0.6);
    ctx.scale(1, 0.38);
    ctx.beginPath();
    const segs = 64;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const wob = 1 + fbm2D(Math.cos(a) * 1.6 + 4, Math.sin(a) * 1.6 + gravPhase * 0.25, 3) * 0.08;
      const rr = R * 0.85 * wob;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(200,230,255,${0.45 * pull})`;
    ctx.lineWidth = 3 + pull * 4;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,200,140,${0.28 * pull})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 0.55, R * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < 5; i++) {
      const rr = R * (0.28 + i * 0.16);
      ctx.strokeStyle = `rgba(180,220,255,${0.2 + pull * 0.35})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, gravPhase * (1.4 + i * 0.3), gravPhase * (1.4 + i * 0.3) + Math.PI * 1.4);
      ctx.stroke();
    }

    for (let i = 0; i < 14; i++) {
      const a = gravPhase * 2 + i * 0.45;
      const r0 = R * (0.9 + (i % 3) * 0.06);
      const r1 = R * 0.12;
      ctx.strokeStyle = `rgba(200,230,255,${0.16 + pull * 0.28})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }

    if (bctx) glow(bctx, cx, cy, R * 0.9, "170,210,255", 0.55 * pull);
  }

  function drawExpansion(ctx, bctx, cx, cy, spread, W, H) {
    if (spread < 0.05) return;
    const R = Math.min(W, H) * (0.16 + spread * 0.48);

    // spiral arms — noise-perturbed for an organic gas-filament look
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const a = gravPhase * 0.8 + arm * ((Math.PI * 2) / 3) + t * Math.PI * 2.2;
        const wob = 1 + fbm2D(t * 3 + arm * 5, gravPhase * 0.2, 3) * 0.14;
        const rr = R * (0.12 + t * 0.88) * wob;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.72;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(255,160,255,${(0.55 - arm * 0.08) * spread})`;
      ctx.lineWidth = 3.5 - arm * 0.6;
      ctx.stroke();
    }

    for (let i = 0; i < 6; i++) {
      const t = (i + 1) / 6;
      const pulse = 1 + 0.05 * Math.sin(gravPhase * 3.2 + i);
      ctx.strokeStyle = `rgba(255,180,255,${(0.5 - t * 0.32) * spread})`;
      ctx.lineWidth = 2.5 + (1 - t) * 6;
      ctx.beginPath();
      ctx.arc(cx, cy, R * t * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(cx, cy, R * 0.08, cx, cy, R);
    g.addColorStop(0, `rgba(255,230,255,${0.28 * spread})`);
    g.addColorStop(0.35, `rgba(160,100,220,${0.2 * spread})`);
    g.addColorStop(0.7, `rgba(60,40,140,${0.12 * spread})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    if (bctx) glow(bctx, cx, cy, R * 0.85, "255,190,255", 0.4 * spread);
  }

  function drawSparkles(ctx, W, H) {
    for (const s of sparkles) {
      const a = Math.max(0, s.life / s.max);
      const x = s.x * W;
      const y = s.y * H;
      const r = 3 + (1 - a) * 5;
      ctx.strokeStyle = `rgba(255,235,255,${a * 0.8})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
      ctx.stroke();
    }
  }

  function drawOrbits(ctx, bctx, W, H) {
    for (const o of orbits) {
      const a = Math.max(0, o.life / o.max);
      const x = (o.cx + Math.cos(o.a) * o.r) * W;
      const y = (o.cy + Math.sin(o.a) * o.r * 0.72) * H;
      const px = (o.cx + Math.cos(o.prevA) * o.r) * W;
      const py = (o.cy + Math.sin(o.prevA) * o.r * 0.72) * H;
      // short motion-streak instead of a static dot
      ctx.strokeStyle = `${o.color}${(0.12 + a * 0.55)})`;
      ctx.lineWidth = o.size * (0.6 + a);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = `${o.color}${0.15 + a * 0.75})`;
      ctx.beginPath();
      ctx.arc(x, y, o.size * (0.7 + a), 0, Math.PI * 2);
      ctx.fill();
      if (bctx && a > 0.5) glow(bctx, x, y, o.size * 5, o.glowRgb, 0.35 * a);
    }
  }

  function drawEmbers(ctx, bctx, W, H) {
    for (const e of embers) {
      const a = Math.max(0, e.life / e.max);
      ctx.fillStyle = `hsla(${20 + e.hue * 40},90%,${55 + a * 20}%,${a * 0.9})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * (0.5 + a * 0.6), 0, Math.PI * 2);
      ctx.fill();
      if (bctx && a > 0.4) glow(bctx, e.x, e.y, e.size * 4, "255,170,90", 0.4 * a);
    }
  }

  function drawHandBridge(ctx, hands, W, H, pull, spread) {
    if (!hands || hands.length < 2) return;
    const [a, b] = hands;
    const ax = a.palmX * W;
    const ay = a.palmY * H;
    const bx = b.palmX * W;
    const by = b.palmY * H;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    if (pull > 0.2) {
      ctx.strokeStyle = `rgba(180,220,255,${0.35 + pull * 0.45})`;
      ctx.lineWidth = 2 + pull * 3;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(mx, my + Math.sin(gravPhase * 4) * 18, bx, by);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (spread > 0.2) {
      ctx.strokeStyle = `rgba(255,170,255,${0.3 + spread * 0.4})`;
      ctx.lineWidth = 2.5 + spread * 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(mx, my - 40 - spread * 50, bx, by);
      ctx.stroke();
    }
  }

  function drawPoseCosmos(ctx, bctx, pose, hands, W, H) {
    if (!pose || !hands?.length) return;
    const S = 1.75; // 한 손 이펙트 가시성 부스트
    const cx = hands.reduce((s, h) => s + h.palmX, 0) / hands.length * W;
    const cy = hands.reduce((s, h) => s + h.palmY, 0) / hands.length * H;

    if (pose === "pinch" || pose === "ok") {
      for (let i = 0; i < 7; i++) {
        const a = gravPhase * 1.5 + i * ((Math.PI * 2) / 7);
        const r = (36 + i * 18) * S;
        ctx.strokeStyle = `rgba(160,210,255,${0.5 + etherPulse * 0.4})`;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, a, a + Math.PI * 1.35);
        ctx.stroke();
      }
      if (bctx) glow(bctx, cx, cy, 130 * S, "170,210,255", 0.5 + etherPulse * 0.35);
    } else if (pose === "fist") {
      ctx.fillStyle = `rgba(170,110,55,${0.35 + etherPulse * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 28 * S, 120 * S, 48 * S, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(220,160,90,${0.7})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx - 100 * S, cy + 14 * S);
      ctx.lineTo(cx + 100 * S, cy + 24 * S);
      ctx.stroke();
      if (bctx) glow(bctx, cx, cy + 20 * S, 140 * S, "220,150,80", 0.45);
    } else if (pose === "rock" || pose === "peace") {
      for (const h of hands) emitDust(h.palmX, h.palmY, "rgba(255,140,60,", 5, 0.03);
      const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, 160 * S);
      g.addColorStop(0, `rgba(255,230,140,${0.7 * (0.5 + etherPulse)})`);
      g.addColorStop(0.45, `rgba(255,120,40,${0.35 * (0.45 + etherPulse)})`);
      g.addColorStop(1, "rgba(255,60,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 160 * S, 0, Math.PI * 2);
      ctx.fill();
      for (const h of hands) {
        const hx = h.palmX * W;
        const hy = h.palmY * H;
        const tipX = hx + (h.palmX - 0.5) * 220 * S + fbm2D(gravPhase * 2, hx * 0.01, 2) * 18;
        const tipY = hy - 160 * S;
        ctx.strokeStyle = `rgba(255,200,120,${0.75})`;
        ctx.lineWidth = 4.5;
        ctx.shadowColor = "rgba(255,160,60,0.8)";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (bctx) glow(bctx, tipX, tipY, 40 * S, "255,170,90", 0.65);
      }
      if (bctx) glow(bctx, cx, cy, 180 * S, "255,170,90", 0.55 * (0.5 + etherPulse));
    } else if (pose === "open_palm") {
      for (let i = 0; i < 12; i++) {
        const a = gravPhase * 2.2 + i * 0.55;
        ctx.strokeStyle = `rgba(200,235,255,${0.5})`;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 18 * S, cy + Math.sin(a) * 10 * S);
        ctx.lineTo(cx + Math.cos(a) * 170 * S, cy + Math.sin(a) * 70 * S - 50 * S);
        ctx.stroke();
      }
      if (bctx) glow(bctx, cx, cy, 150 * S, "180,220,255", 0.4);
    }
  }

  /** tipHulls: [{ points: [[px,py], ...] }] in pixel space */
  function drawEtherVeil(ctx, bctx, tipHulls, W, H) {
    for (const hub of tipHulls || []) {
      const pts = hub.points;
      if (!pts || pts.length < 3) continue;
      const P = pts.map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : p));
      let cx = 0, cy = 0;
      for (const p of P) { cx += p.x; cy += p.y; }
      cx /= P.length; cy /= P.length;

      // soft rounded veil (quadratic through midpoints) instead of a raw polygon
      ctx.beginPath();
      for (let i = 0; i < P.length; i++) {
        const cur = P[i];
        const nxt = P[(i + 1) % P.length];
        const mx = (cur.x + nxt.x) / 2;
        const my = (cur.y + nxt.y) / 2;
        if (i === 0) ctx.moveTo(mx, my);
        else ctx.quadraticCurveTo(cur.x, cur.y, mx, my);
      }
      ctx.closePath();

      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.min(W, H) * 0.28);
      g.addColorStop(0, `rgba(200,240,255,${0.42 + etherPulse * 0.2})`);
      g.addColorStop(0.35, `rgba(140,100,220,${0.28 + etherPulse * 0.15})`);
      g.addColorStop(0.7, `rgba(40,20,80,${0.12})`);
      g.addColorStop(1, "rgba(20,10,40,0)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = `rgba(210,240,255,${0.65 + etherPulse * 0.25})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // aurora shimmer ribbons — noise-driven displacement, layered hues
      const ribbonHues = ["180,255,230", "190,210,255", "255,210,250"];
      for (let i = 0; i < 5; i++) {
        const t = (i + 1) / 6;
        ctx.strokeStyle = `rgba(${ribbonHues[i % ribbonHues.length]},${0.16 + 0.1 * (0.5 + 0.5 * noise2D(i * 3, gravPhase * 1.4))})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        let first = true;
        for (let j = 0; j <= P.length; j++) {
          const p0 = P[j % P.length];
          const x0 = p0.x;
          const y0 = p0.y;
          const flow = fbm2D(x0 * 0.01 + j, gravPhase * 0.6 + i * 2, 2) * 10;
          const x = cx + (x0 - cx) * t;
          const y = cy + (y0 - cy) * t + flow;
          if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      for (const p of P) {
        ctx.fillStyle = "rgba(240,250,255,0.9)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(160,210,255,0.5)";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        if (bctx) glow(bctx, p.x, p.y, 14, "200,240,255", 0.5);
      }
      if (bctx) glow(bctx, cx, cy, Math.min(W, H) * 0.22, "180,220,255", 0.5 + etherPulse * 0.25);
    }
  }

  function drawCracks(ctx) {
    for (const c of cracks) {
      ctx.strokeStyle = `rgba(210,150,90,${0.55 * c.life})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      // fractured, noise-jittered path instead of one clean segment
      const segs = 4;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const jitter = fbm2D(c.seed + i, c.a * 3, 2) * 14;
        const x = c.x + Math.cos(c.a) * c.len * t * (1.05 - c.life * 0.2) + jitter;
        const y = c.y + Math.sin(c.a) * c.len * 0.55 * t + jitter * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ togetherBlend:number, spreadBlend:number, mid:{x:number,y:number}|null, pose:string, hands:any[], tipHulls:any[] }} snap
   */
  function draw(ctx, W, H, snap) {
    const bctx = ensureBloom(W, H);

    ctx.save();
    if (shake > 0.02) {
      ctx.translate((Math.random() - 0.5) * shake * 16, (Math.random() - 0.5) * shake * 12);
    }

    // light cosmic wash — keep AR camera readable
    ctx.fillStyle = "rgba(4,8,22,0.22)";
    ctx.fillRect(0, 0, W, H);

    const pull = Math.max(snap?.togetherBlend || 0, wellBoost);
    const spread = Math.max(snap?.spreadBlend || 0, nebulaBoost);
    const mid = snap?.mid;
    const cx = mid ? mid.x * W : W * 0.5;
    const cy = mid ? mid.y * H : H * 0.5;

    drawNebulaClouds(ctx, bctx, W, H);
    const starPull = pull > 0.05 ? pull : spread > 0.05 ? -spread : 0;
    drawStarfield(ctx, W, H, starPull, cx, cy);
    drawComets(ctx, W, H);
    drawGravityWell(ctx, bctx, cx, cy, pull, W, H);
    drawExpansion(ctx, bctx, cx, cy, spread, W, H);
    drawOrbits(ctx, bctx, W, H);
    drawSparkles(ctx, W, H);
    if (snap?.showLines !== false) {
      drawHandBridge(ctx, snap?.hands, W, H, pull, spread);
    }
    if (snap?.showLines !== false) {
      drawEtherVeil(ctx, bctx, snap?.tipHulls, W, H);
    }
    drawPoseCosmos(ctx, bctx, snap?.pose, snap?.hands, W, H);
    drawCracks(ctx);
    drawEmbers(ctx, bctx, W, H);

    for (const b of bursts) {
      const g = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, b.r);
      g.addColorStop(0, `${b.color}${0.65 * b.life})`);
      g.addColorStop(0.45, `${b.color}${0.28 * b.life})`);
      g.addColorStop(1, `${b.color}0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      if (bctx) glow(bctx, b.x, b.y, b.r * 0.6, b.glowRgb || "255,170,110", 0.5 * b.life);
    }
    for (const r of rings) {
      ctx.strokeStyle = `${r.color}${0.5 * r.life})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of dust) {
      const a = Math.max(0, p.life / p.max);
      ctx.fillStyle = `${p.color}${a})`;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // composite the accumulated bloom layer once, additively
    compositeBloom(ctx, W, H, 0.6);

    if (snap?.showHud !== false) {
      let mode = "ETHER FIELD · 우주";
      if (pull > 0.4) mode = "GRAVITY WELL — 🙏 양손 모으기";
      else if (spread > 0.4) mode = "NEBULA EXPANSION — 👐 양손 벌리기";
      else if (snap?.pose === "fist") mode = "EARTH RUPTURE — ✊↓ 파기";
      else if (snap?.tipHulls?.length) mode = "ETHER VEIL — 🖖 손끝 벌리기";
      else if (snap?.pose) mode = String(snap.pose).replace(/_/g, " ").toUpperCase();
      ctx.fillStyle = "rgba(210,230,255,0.88)";
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(mode, 16, 28);
    }

    ctx.restore();
  }

  function clear() {
    dust.length = 0;
    orbits.length = 0;
    bursts.length = 0;
    rings.length = 0;
    cracks.length = 0;
    embers.length = 0;
    sparkles.length = 0;
    wellBoost = 0;
    nebulaBoost = 0;
    etherPulse = 0;
    shake = 0;
  }

  return {
    update,
    draw,
    onDig,
    injectGravity,
    injectNebula,
    injectEther,
    clear,
  };
}
