/**
 * Minimal 2D/3D Simplex noise — a compact re-implementation of the classic
 * public-domain "Simplex Noise" algorithm (Ken Perlin / Stefan Gustavson,
 * as popularized by the open-source `simplex-noise` npm package, MIT).
 * No external fetch needed — small enough to vendor inline so the cosmos
 * visuals stay organic (nebula drift, aurora ripple, ember turbulence)
 * without any network dependency at runtime.
 */

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3;
const G3 = 1 / 6;

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

function buildPermutation(seed = 1) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // xorshift-based shuffle so each instance gets its own stable field
  let s = (seed * 2654435761) >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
  return { perm, permMod12 };
}

export function createNoise(seed = 1) {
  const { perm, permMod12 } = buildPermutation(seed);

  function noise2D(xin, yin) {
    let n0, n1, n2;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = permMod12[ii + perm[jj]];
    const gi1 = permMod12[ii + i1 + perm[jj + j1]];
    const gi2 = permMod12[ii + 1 + perm[jj + 1]];
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    n0 = t0 < 0 ? 0 : (t0 *= t0, t0 * t0 * (GRAD3[gi0][0] * x0 + GRAD3[gi0][1] * y0));
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    n1 = t1 < 0 ? 0 : (t1 *= t1, t1 * t1 * (GRAD3[gi1][0] * x1 + GRAD3[gi1][1] * y1));
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    n2 = t2 < 0 ? 0 : (t2 *= t2, t2 * t2 * (GRAD3[gi2][0] * x2 + GRAD3[gi2][1] * y2));
    return 70 * (n0 + n1 + n2); // ~[-1, 1]
  }

  /** fBm helper — layered octaves for cloud-like drift */
  function fbm2D(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise2D(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  return { noise2D, fbm2D };
}
