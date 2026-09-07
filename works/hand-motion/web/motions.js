/**
 * 손 포즈·모션 감지 및 관절(마디) 분석
 * MediaPipe 21점 랜드마크 기반
 *
 * 활성 포즈는 구분도 높은 6종만 사용 (정확도 우선):
 * open_palm · fist · peace · point · pinch · ok · shaka
 */

export const POSES = {
  OPEN_PALM: "open_palm",
  FIST: "fist",
  PEACE: "peace",
  POINT: "point",
  PINCH: "pinch",
  OK: "ok",
  SHAKA: "shaka",
  NEUTRAL: "neutral",
  // 하위 호환 — 감지하지 않음
  THUMBS_UP: "thumbs_up",
  ROCK: "rock",
  STOP: "stop",
  JAZZ: "jazz",
};

const INDEX_PIP = 6;
const MIDDLE_PIP = 10;
const RING_PIP = 14;
const PINKY_PIP = 18;
const INDEX_TIP = 8;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_TIP = 20;
const THUMB_TIP = 4;
const INDEX_MCP = 5;

/** 손가락별 관절 체인: [손목쪽 … 끝] */
export const FINGER_CHAINS = {
  thumb: { name: "엄지", hue: 0.08, chain: [1, 2, 3, 4] },
  index: { name: "검지", hue: 0.55, chain: [5, 6, 7, 8] },
  middle: { name: "중지", hue: 0.72, chain: [9, 10, 11, 12] },
  ring: { name: "약지", hue: 0.88, chain: [13, 14, 15, 16] },
  pinky: { name: "새끼", hue: 0.42, chain: [17, 18, 19, 20] },
};

/** 뼈대 연결선 (손목·손바닥 포함) */
export const BONE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

export function fingerExtended(lm, tip, pip) {
  return lm[tip].y < lm[pip].y - 0.02;
}

export function countFingers(lm) {
  let n = 0;
  const thumb = lm[THUMB_TIP];
  const indexMcp = lm[INDEX_MCP];
  if (Math.hypot(thumb.x - indexMcp.x, thumb.y - indexMcp.y) > 0.08) n++;
  for (const [tip, pip] of [
    [INDEX_TIP, INDEX_PIP],
    [MIDDLE_TIP, MIDDLE_PIP],
    [RING_TIP, RING_PIP],
    [PINKY_TIP, PINKY_PIP],
  ]) {
    if (fingerExtended(lm, tip, pip)) n++;
  }
  return n;
}

function thumbExtended(lm) {
  const thumb = lm[THUMB_TIP];
  const indexMcp = lm[INDEX_MCP];
  return Math.hypot(thumb.x - indexMcp.x, thumb.y - indexMcp.y) > 0.08;
}

function isOkSign(lm) {
  const d = Math.hypot(lm[THUMB_TIP].x - lm[INDEX_TIP].x, lm[THUMB_TIP].y - lm[INDEX_TIP].y);
  if (d > 0.05) return false;
  return (
    fingerExtended(lm, MIDDLE_TIP, MIDDLE_PIP) &&
    fingerExtended(lm, RING_TIP, RING_PIP) &&
    fingerExtended(lm, PINKY_TIP, PINKY_PIP)
  );
}

/**
 * 관절 각도 → 굽힘량 0~1 (0=펴짐, 1=깊게 굽힘)
 * a–b–c 세 점으로 b에서의 내각 사용
 */
export function jointCurl(a, b, c) {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const la = Math.hypot(bax, bay) + 1e-6;
  const lc = Math.hypot(bcx, bcy) + 1e-6;
  const cos = Math.max(-1, Math.min(1, (bax * bcx + bay * bcy) / (la * lc)));
  const angle = Math.acos(cos);
  return Math.max(0, Math.min(1, (Math.PI - angle) / (Math.PI * 0.55)));
}

/**
 * 손가락 하나: MCP/PIP/DIP 굽힘 + tip 위치 + 전체 curl
 */
export function analyzeFinger(lm, chain, wrist) {
  const pts = chain.map((i) => lm[i]);
  const curls = [];
  curls.push(jointCurl(wrist, pts[0], pts[1]));
  curls.push(jointCurl(pts[0], pts[1], pts[2]));
  if (pts.length >= 4) {
    curls.push(jointCurl(pts[1], pts[2], pts[3]));
  }
  const curl = curls.reduce((s, v) => s + v, 0) / curls.length;
  const tip = pts[pts.length - 1];
  const mcp = pts[0];
  return {
    curls,
    curl,
    tip,
    mcp,
    extended: curl < 0.35,
    chain,
  };
}

/**
 * 손 전체 관절 분석 — 마디별 제어용
 */
export function analyzeJoints(lm) {
  const wrist = lm[0];
  const fingers = {};
  for (const [key, meta] of Object.entries(FINGER_CHAINS)) {
    fingers[key] = {
      ...analyzeFinger(lm, meta.chain, wrist),
      name: meta.name,
      hue: meta.hue,
    };
  }
  const avgCurl =
    Object.values(fingers).reduce((s, f) => s + f.curl, 0) / Object.keys(fingers).length;
  return { fingers, avgCurl, wrist };
}

/** 활성 6종만 감지 — 락/스톱/재즈/엄지는 오인식이 많아 제외 */
export function detectPose(lm, openness, pinching) {
  if (isOkSign(lm)) return POSES.OK;
  if (pinching) return POSES.PINCH;

  const f = countFingers(lm);
  const indexUp = fingerExtended(lm, INDEX_TIP, INDEX_PIP);
  const middleUp = fingerExtended(lm, MIDDLE_TIP, MIDDLE_PIP);
  const ringUp = fingerExtended(lm, RING_TIP, RING_PIP);
  const pinkyUp = fingerExtended(lm, PINKY_TIP, PINKY_PIP);
  const thumbOut = thumbExtended(lm);

  // 샤카: 엄지+새끼만 (물)
  if (pinkyUp && thumbOut && !indexUp && !middleUp && !ringUp) return POSES.SHAKA;
  // 주먹 (대지)
  if (f <= 1 && openness < 0.3) return POSES.FIST;
  // 브이 / 락→불로 통합 (검지+중지, 또는 검지+새끼)
  if (indexUp && middleUp && !ringUp && !pinkyUp) return POSES.PEACE;
  if (indexUp && pinkyUp && !middleUp && !ringUp) return POSES.PEACE;
  // 가리키기
  if (indexUp && !middleUp && !ringUp && !pinkyUp && f <= 2) return POSES.POINT;
  // 손바닥 (공기)
  if (f >= 4 && openness > 0.58) return POSES.OPEN_PALM;

  return POSES.NEUTRAL;
}

/** 양손 하트 모양 (검지 끝·엄지 끝이 가까울 때) */
export function detectHeart(lmA, lmB, mirrorX) {
  const tip = (lm, idx) => ({
    x: mirrorX(lm[idx].x),
    y: lm[idx].y,
  });
  const iA = tip(lmA, INDEX_TIP);
  const iB = tip(lmB, INDEX_TIP);
  const tA = tip(lmA, THUMB_TIP);
  const tB = tip(lmB, THUMB_TIP);
  const indexDist = Math.hypot(iA.x - iB.x, iA.y - iB.y);
  const thumbDist = Math.hypot(tA.x - tB.x, tA.y - tB.y);
  return indexDist < 0.11 && thumbDist < 0.14;
}

export const POSE_LABELS = {
  [POSES.OPEN_PALM]: "🖐 공기 — 성운 바람",
  [POSES.FIST]: "✊ 대지 — 중력핵 / 파기",
  [POSES.PEACE]: "✌️ 불 — 태양풍 레이저",
  [POSES.POINT]: "☝️ 별빛 — 빔/별자리",
  [POSES.PINCH]: "🤏 특이점 — 확정/삭제",
  [POSES.OK]: "👌 에테르 — 제5원소 궤도",
  [POSES.SHAKA]: "🤙 물 — 성운 해류",
  [POSES.NEUTRAL]: "",
};

/** 원소/우주 시각 모드 */
export const VISUAL_MODES = ["Earth", "Water", "Fire", "Air", "Aether"];

/** 인터랙티브 컨셉 — 제5원소 + 우주 */
export const CONCEPT = {
  name: "QUINTESSENCE",
  nameKo: "제5원소",
  tagline: "손으로 네 원소를 다루고, 손가락 사이가 우주가 된다",
  elements: {
    earth: { pose: POSES.FIST, label: "대지", hint: "주먹 + 아래로 파기" },
    water: { pose: POSES.SHAKA, label: "물", hint: "샤카로 해류" },
    fire: { pose: POSES.PEACE, label: "불", hint: "브이로 플레어" },
    air: { pose: POSES.OPEN_PALM, label: "공기", hint: "손바닥으로 바람" },
    aether: { pose: POSES.OK, label: "에테르", hint: "OK · 4손가락 공간" },
  },
};

/** 클래식 모드용 포즈 라벨 (전기·필터 세계관) */
export const CLASSIC_POSE_LABELS = {
  [POSES.OPEN_PALM]: "🖐 손바닥 — 전기 코로나",
  [POSES.FIST]: "✊ 주먹 — 수축",
  [POSES.PEACE]: "✌️ 브이 — 레이저",
  [POSES.POINT]: "☝️ 가리키기 — 빔/영역",
  [POSES.PINCH]: "🤏 핀치 — 영역확정/삭제",
  [POSES.OK]: "👌 OK — 궤도",
  [POSES.SHAKA]: "🤙 샤카 — 파도",
  [POSES.NEUTRAL]: "",
};
