export const DEFAULT_THRESHOLDS = Object.freeze({
  pinchEnter: 0.42,
  pinchExit: 0.55,
  fistEnter: 0.25,
  fistExit: 0.38,
  openEnter: 0.68,
  openExit: 0.54,
});

const TIP_IDS = [4, 8, 12, 16, 20];
const FINGER_PAIRS = [[8, 6], [12, 10], [16, 14], [20, 18]];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export async function createHandLandmarker() {
  const { FilesetResolver, HandLandmarker } = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14"
  );
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  return HandLandmarker.createFromOptions(vision, {
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

export function measureRawHand(landmarks) {
  const scale = Math.max(distance(landmarks[0], landmarks[9]), 1e-6);
  const center = {
    x: (landmarks[0].x + landmarks[9].x) * 0.5,
    y: (landmarks[0].y + landmarks[9].y) * 0.5,
  };
  const meanRatio = TIP_IDS.reduce(
    (sum, id) => sum + distance(landmarks[id], center) / scale, 0,
  ) / TIP_IDS.length;
  return {
    x: 1 - landmarks[9].x,
    y: landmarks[9].y,
    scale,
    openness: clamp((meanRatio - 0.72) / 1.15, 0, 1),
    pinchRatio: distance(landmarks[4], landmarks[8]) / scale,
    fingerCount: fingerCount(landmarks, scale),
  };
}

class MajorityLatch {
  constructor() { this.state = false; this.history = []; }
  update(candidate) {
    this.history.push(candidate);
    if (this.history.length > 5) this.history.shift();
    const yes = this.history.filter(Boolean).length;
    const no = this.history.length - yes;
    if (!this.state && yes >= 3) this.state = true;
    else if (this.state && no >= 3) this.state = false;
    return this.state;
  }
  reset() { this.state = false; this.history.length = 0; }
}

class StableHand {
  constructor() {
    this.pinch = new MajorityLatch(); this.fist = new MajorityLatch(); this.open = new MajorityLatch();
    this.x = null; this.y = null;
  }
  update(raw, thresholds, dt) {
    const pinchShape = raw.openness > (this.pinch.state ? 0.16 : 0.22) || raw.fingerCount >= 1;
    const pinching = this.pinch.update(raw.pinchRatio < (this.pinch.state ? thresholds.pinchExit : thresholds.pinchEnter) && pinchShape);
    const fist = this.fist.update(raw.openness < (this.fist.state ? thresholds.fistExit : thresholds.fistEnter) && raw.fingerCount <= (this.fist.state ? 2 : 1));
    const open = this.open.update(raw.openness > (this.open.state ? thresholds.openExit : thresholds.openEnter) && raw.fingerCount >= (this.open.state ? 3 : 4));
    const alpha = 1 - Math.exp(-dt * 14);
    const oldX = this.x ?? raw.x; const oldY = this.y ?? raw.y;
    this.x = oldX + (raw.x - oldX) * alpha; this.y = oldY + (raw.y - oldY) * alpha;
    return { ...raw, x: this.x, y: this.y, vx: (this.x - oldX) / Math.max(dt, 0.001), vy: (this.y - oldY) / Math.max(dt, 0.001), pose: pinching ? "pinch" : fist ? "fist" : open ? "open" : "neutral" };
  }
  reset() { this.pinch.reset(); this.fist.reset(); this.open.reset(); }
}

export function aggregateGesture(hands) {
  const letter = { pinch: "P", open: "O", fist: "F" };
  if (hands.length === 1 && letter[hands[0].pose]) return `1${letter[hands[0].pose]}`;
  if (hands.length >= 2 && hands[0].pose === hands[1].pose && letter[hands[0].pose]) return `2${letter[hands[0].pose]}`;
  return "neutral";
}

export class GestureTracker {
  constructor(video) {
    this.video = video; this.landmarker = null; this.stream = null; this.lastVideo = -1;
    this.states = new Map(); this.lostFrames = 0; this.thresholds = { ...DEFAULT_THRESHOLDS };
  }
  async start() {
    this.landmarker = await createHandLandmarker();
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    this.video.srcObject = this.stream; await this.video.play(); return this;
  }
  update(now, dt) {
    if (!this.landmarker || this.video.readyState < 2 || this.video.currentTime === this.lastVideo) return null;
    this.lastVideo = this.video.currentTime;
    const result = this.landmarker.detectForVideo(this.video, now);
    const list = result.landmarks || [];
    if (!list.length) {
      this.lostFrames += 1;
      if (this.lostFrames > 8) { for (const state of this.states.values()) state.reset(); return { hands: [], gesture: "neutral" }; }
      return null;
    }
    this.lostFrames = 0;
    const hands = list.slice(0, 2).map((landmarks, index) => {
      const key = result.handednesses?.[index]?.[0]?.categoryName || `hand-${index}`;
      if (!this.states.has(key)) this.states.set(key, new StableHand());
      return { ...this.states.get(key).update(measureRawHand(landmarks), this.thresholds, dt), key };
    });
    return { hands, gesture: aggregateGesture(hands) };
  }
  stop() { this.stream?.getTracks().forEach((track) => track.stop()); this.landmarker?.close(); }
}
