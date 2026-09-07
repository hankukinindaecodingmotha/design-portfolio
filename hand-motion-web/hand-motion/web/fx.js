/**
 * WebGL 이펙트 엔진 — Three.js + UnrealBloom
 * https://threejs.org (MIT)
 */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { AfterimagePass } from "three/addons/postprocessing/AfterimagePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const MAX_PARTICLES = 1200;

function hsvToColor(h, s = 0.85, v = 1) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  const i = Math.floor(((h % 1) + 1) % 1 * 6) % 6;
  if (i === 0) [r, g, b] = [c, x, 0];
  else if (i === 1) [r, g, b] = [x, c, 0];
  else if (i === 2) [r, g, b] = [0, c, x];
  else if (i === 3) [r, g, b] = [0, x, c];
  else if (i === 4) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return new THREE.Color(r + m, g + m, b + m);
}

export class EffectsEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.w = 1;
    this.h = 1;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.beams = [];
    this.orbs = [];
    this.rings = [];
    this.bolts = [];
    this.pIndex = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 2;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.PointLight(0xaaccff, 1.1, 8);
    key.position.set(0.4, 0.5, 2);
    this.scene.add(key);

    const positions = new Float32Array(MAX_PARTICLES * 3);
    const colors = new Float32Array(MAX_PARTICLES * 3);
    const sizes = new Float32Array(MAX_PARTICLES);
    this.particleState = Array.from({ length: MAX_PARTICLES }, () => ({
      life: 0, vx: 0, vy: 0, decay: 1,
    }));
    this.pGeo = new THREE.BufferGeometry();
    this.pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.pGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    this.pMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: { uPixelRatio: { value: this.renderer.getPixelRatio() } },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixelRatio * (220.0 / max(0.1, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float alpha = smoothstep(0.5, 0.0, d);
          alpha *= alpha;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
    });
    this.points = new THREE.Points(this.pGeo, this.pMat);
    this.scene.add(this.points);
    this.points.visible = false;

    this.composer = new EffectComposer(this.renderer);
    // Clear to transparent so AR camera underlay can show through (with CSS screen blend as backup)
    const renderPass = new RenderPass(this.scene, this.camera);
    renderPass.clear = true;
    renderPass.clearAlpha = 0;
    this.composer.addPass(renderPass);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.22, 0.35);
    this.composer.addPass(this.bloomPass);
    // Comet-trail glow for beams/bolts — three.js addons AfterimagePass (MIT, open source).
    // damp=0 → old frame contributes nothing (off); higher damp = longer trail.
    this.afterimagePass = new AfterimagePass(0);
    this.composer.addPass(this.afterimagePass);
    this.composer.addPass(new OutputPass());
    this.renderer.autoClear = true;

    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(w, h) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.composer.setSize(this.w, this.h);
    this.bloomPass.setSize(this.w, this.h);
    const aspect = this.w / this.h;
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
    this.pMat.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
  }

  toWorld(nx, ny) {
    const aspect = this.w / this.h;
    return new THREE.Vector3((nx * 2 - 1) * aspect, -(ny * 2 - 1), 0);
  }

  spawnBurst(nx, ny, count = 28, speed = 1, hue = 0.6) {
    /* particle/cloud disabled */
  }

  spawnUpward(nx, ny, count = 16, hue = 0.15) {
    /* particle/cloud disabled */
  }

  spawnFlow(nx1, ny1, nx2, ny2, hue = 0.6) {
    /* particle/cloud disabled */
  }

  _emit(x, y, vx, vy, color, size, life) {
    const i = this.pIndex % MAX_PARTICLES;
    this.pIndex++;
    const st = this.particleState[i];
    st.life = life;
    st.vx = vx;
    st.vy = vy;
    st.decay = 0.55 + Math.random() * 0.5;
    const pos = this.pGeo.attributes.position.array;
    const col = this.pGeo.attributes.color.array;
    const sizes = this.pGeo.attributes.size.array;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = 0;
    col[i * 3] = color.r;
    col[i * 3 + 1] = color.g;
    col[i * 3 + 2] = color.b;
    sizes[i] = size;
  }

  setOrbs(_hands) {
    // soft glowing spheres look like clouds — hide them
    for (const o of this.orbs) {
      if (o.mesh) o.mesh.visible = false;
    }
  }

  setBeams(beams) {
    while (this.beams.length < beams.length) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
      );
      const geo = new THREE.TubeGeometry(curve, 32, 0.006, 8, false);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x88ddff,
        emissiveIntensity: 3.2,
        transparent: true,
        opacity: 0.92,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.scene.add(mesh);
      this.beams.push({ mesh, mat, curve });
    }
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      if (i >= beams.length) {
        b.mesh.visible = false;
        continue;
      }
      const spec = beams[i];
      const a = this.toWorld(spec.x1, spec.y1);
      const c = this.toWorld(spec.x2, spec.y2);
      const mid = a.clone().lerp(c, 0.5);
      mid.y += (spec.sag ?? 0.08) * Math.sin(this.time * (spec.wobble ?? 3) + i);
      b.curve.v0.copy(a);
      b.curve.v1.copy(mid);
      b.curve.v2.copy(c);
      const radius = 0.003 + (spec.width ?? 0.5) * 0.011;
      b.mesh.geometry.dispose();
      b.mesh.geometry = new THREE.TubeGeometry(b.curve, 40, radius, 8, false);
      const color = hsvToColor(spec.hue ?? 0.6);
      b.mat.emissive.copy(color);
      b.mat.color.copy(color);
      b.mat.opacity = spec.alpha ?? 0.92;
      b.mesh.visible = true;
    }
  }

  addShockwave(nx, ny, hue = 0.6) {
    const mat = new THREE.MeshBasicMaterial({
      color: hsvToColor(hue),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.034, 48), mat);
    mesh.position.copy(this.toWorld(nx, ny));
    this.scene.add(mesh);
    this.rings.push({ mesh, mat, life: 1, speed: 1.6 + Math.random() * 0.5 });
  }

  addBolt(x1, y1, x2, y2, hue = 0.55) {
    const a = this.toWorld(x1, y1);
    const b = this.toWorld(x2, y2);
    const points = [];
    const segs = 8;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = a.clone().lerp(b, t);
      if (i > 0 && i < segs) {
        p.x += (Math.random() - 0.5) * 0.08;
        p.y += (Math.random() - 0.5) * 0.08;
      }
      points.push(p);
    }
    const mat = new THREE.LineBasicMaterial({
      color: hsvToColor(hue),
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat);
    this.scene.add(line);
    this.bolts.push({ line, mat, life: 0.4 });
  }

  setBloomStrength(v) {
    this.bloomPass.strength = v;
  }

  /** 0 = no trail (sharp), ~0.7-0.9 = visible comet-trail on beams/bolts/particles */
  setTrail(damp) {
    if (this.afterimagePass) {
      this.afterimagePass.uniforms["damp"].value = Math.max(0, Math.min(0.97, damp));
    }
  }

  flash(amount = 0.35) {
    this.renderer.toneMappingExposure = 1.15 + amount * 2;
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    const pos = this.pGeo.attributes.position.array;
    const sizes = this.pGeo.attributes.size.array;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const st = this.particleState[i];
      if (st.life <= 0) {
        sizes[i] = 0;
        continue;
      }
      st.life -= dt * st.decay;
      pos[i * 3] += st.vx;
      pos[i * 3 + 1] += st.vy;
      st.vx *= 0.98;
      st.vy *= 0.98;
      sizes[i] *= 0.985;
      if (st.life <= 0) sizes[i] = 0;
    }
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.size.needsUpdate = true;
    this.pGeo.attributes.color.needsUpdate = true;

    for (const r of this.rings) {
      r.life -= dt * 0.7;
      const s = (1 - r.life) * r.speed + 0.2;
      r.mesh.scale.set(s, s, s);
      r.mat.opacity = Math.max(0, r.life * 0.85);
    }
    this.rings = this.rings.filter((r) => {
      if (r.life > 0) return true;
      this.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mat.dispose();
      return false;
    });

    for (const b of this.bolts) {
      b.life -= dt;
      b.mat.opacity = Math.max(0, b.life * 2.2);
    }
    this.bolts = this.bolts.filter((b) => {
      if (b.life > 0) return true;
      this.scene.remove(b.line);
      b.line.geometry.dispose();
      b.mat.dispose();
      return false;
    });

    this.renderer.toneMappingExposure += (1.15 - this.renderer.toneMappingExposure) * 0.08;
    for (const o of this.orbs) {
      if (!o.mesh.visible) continue;
      const pulse = 1 + Math.sin(this.time * 3 + o.mesh.position.x * 4) * 0.05;
      o.glow.scale.setScalar(pulse);
    }

    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
    this.renderer.dispose();
  }
}
