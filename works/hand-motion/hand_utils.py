"""손 랜드마크 분석: 손가락 수, 개방도, 스와이프."""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field

# MediaPipe 손 랜드마크 인덱스
THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP = 4, 8, 12, 16, 20
THUMB_IP, INDEX_PIP, MIDDLE_PIP, RING_PIP, PINKY_PIP = 3, 6, 10, 14, 18
WRIST, MIDDLE_MCP = 0, 9

FINGER_TIPS = (INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP)
FINGER_PIPS = (INDEX_PIP, MIDDLE_PIP, RING_PIP, PINKY_PIP)

# 손가락별 관절 체인 [손목쪽 … 끝]
FINGER_CHAINS = {
    "thumb": (1, 2, 3, 4),
    "index": (5, 6, 7, 8),
    "middle": (9, 10, 11, 12),
    "ring": (13, 14, 15, 16),
    "pinky": (17, 18, 19, 20),
}


@dataclass
class HandFeatures:
    palm_x: float
    palm_y: float
    palm_z: float
    openness: float
    finger_count: int
    is_pinching: bool
    is_fist: bool
    is_open_palm: bool
    pose: str = "neutral"
    avg_curl: float = 0.0
    finger_curls: dict[str, float] = field(default_factory=dict)


@dataclass
class SwipeDetector:
    history: deque[tuple[float, float, float]] = field(
        default_factory=lambda: deque(maxlen=8)
    )
    cooldown: float = 0.0
    last_direction: str | None = None

    def update(self, x: float, y: float, now: float) -> str | None:
        self.history.append((x, y, now))
        if self.cooldown > now or len(self.history) < 6:
            return None

        pts = list(self.history)
        vx = sum((pts[i][0] - pts[i - 1][0]) * i for i in range(1, len(pts)))
        vy = sum((pts[i][1] - pts[i - 1][1]) * i for i in range(1, len(pts)))
        weight = sum(range(1, len(pts)))
        vx /= weight
        vy /= weight

        threshold = 0.018
        direction = None
        if abs(vx) > abs(vy):
            if vx > threshold:
                direction = "right"
            elif vx < -threshold:
                direction = "left"
        else:
            if vy > threshold:
                direction = "down"
            elif vy < -threshold:
                direction = "up"

        if direction:
            self.cooldown = now + 0.55
            self.last_direction = direction
            self.history.clear()
        return direction


def _finger_extended(landmarks, tip: int, pip: int) -> bool:
    tip_y = landmarks[tip].y
    pip_y = landmarks[pip].y
    wrist_y = landmarks[WRIST].y
    return tip_y < pip_y - 0.02 or (wrist_y - tip_y) > 0.12


def _thumb_extended(landmarks) -> bool:
    thumb = landmarks[THUMB_TIP]
    index_mcp = landmarks[5]
    wrist = landmarks[WRIST]
    dist_index = math.hypot(thumb.x - index_mcp.x, thumb.y - index_mcp.y)
    dist_wrist = math.hypot(thumb.x - wrist.x, thumb.y - wrist.y)
    return dist_index > 0.06 and dist_wrist > 0.08


def count_fingers(landmarks) -> int:
    count = 0
    if _thumb_extended(landmarks):
        count += 1
    for tip, pip in zip(FINGER_TIPS, FINGER_PIPS):
        if _finger_extended(landmarks, tip, pip):
            count += 1
    return count


def palm_center(landmarks) -> tuple[float, float, float]:
    wrist = landmarks[WRIST]
    middle = landmarks[MIDDLE_MCP]
    cx = (wrist.x + middle.x) / 2
    cy = (wrist.y + middle.y) / 2
    cz = (wrist.z + middle.z) / 2
    return cx, cy, cz


def hand_openness(landmarks) -> float:
    cx, cy, _ = palm_center(landmarks)
    tips = [landmarks[i] for i in (THUMB_TIP, *FINGER_TIPS)]
    dists = [math.hypot(t.x - cx, t.y - cy) for t in tips]
    raw = sum(dists) / len(dists)
    return max(0.0, min(1.0, (raw - 0.08) / 0.18))


def is_pinching(landmarks, frame_w: int, frame_h: int, threshold: float = 0.05) -> bool:
    thumb = landmarks[THUMB_TIP]
    index = landmarks[INDEX_TIP]
    dx = (thumb.x - index.x) * frame_w
    dy = (thumb.y - index.y) * frame_h
    return math.hypot(dx, dy) < threshold * max(frame_w, frame_h)


def hands_distance(a: HandFeatures, b: HandFeatures) -> float:
    return math.hypot(a.palm_x - b.palm_x, a.palm_y - b.palm_y)


def hands_together(a: HandFeatures, b: HandFeatures, threshold: float = 0.14) -> bool:
    return hands_distance(a, b) < threshold


def detect_pose(landmarks, openness: float, pinching: bool) -> str:
    """활성 4종만 감지 — open_palm, fist, peace, pinch"""
    if pinching:
        return "pinch"
    fingers = count_fingers(landmarks)
    index_up = _finger_extended(landmarks, INDEX_TIP, INDEX_PIP)
    middle_up = _finger_extended(landmarks, MIDDLE_TIP, MIDDLE_PIP)
    ring_up = _finger_extended(landmarks, RING_TIP, RING_PIP)
    pinky_up = _finger_extended(landmarks, PINKY_TIP, PINKY_PIP)
    if fingers <= 1 and openness < 0.32:
        return "fist"
    if index_up and middle_up and not ring_up and not pinky_up:
        return "peace"
    if fingers >= 4 and openness > 0.6:
        return "open_palm"
    return "neutral"


def hands_spread(a: HandFeatures, b: HandFeatures, threshold: float = 0.38) -> bool:
    return hands_distance(a, b) > threshold


def extract_features(landmarks, frame_w: int, frame_h: int) -> HandFeatures:
    cx, cy, cz = palm_center(landmarks)
    openness = hand_openness(landmarks)
    fingers = count_fingers(landmarks)
    pinching = is_pinching(landmarks, frame_w, frame_h)
    pose = detect_pose(landmarks, openness, pinching)
    return HandFeatures(
        palm_x=cx,
        palm_y=cy,
        palm_z=cz,
        openness=openness,
        finger_count=fingers,
        is_pinching=pinching,
        is_fist=fingers <= 1 and openness < 0.25,
        is_open_palm=fingers >= 4 and openness > 0.55,
        pose=pose,
    )
