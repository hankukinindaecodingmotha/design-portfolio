"""손 크기 정규화와 시간 안정화를 적용한 손 랜드마크 분석 유틸."""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field
from typing import Iterable

THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP = 4, 8, 12, 16, 20
THUMB_IP, INDEX_PIP, MIDDLE_PIP, RING_PIP, PINKY_PIP = 3, 6, 10, 14, 18
WRIST, MIDDLE_MCP = 0, 9
FINGER_TIPS = (INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP)
FINGER_PIPS = (INDEX_PIP, MIDDLE_PIP, RING_PIP, PINKY_PIP)

PINCH_ENTER = 0.42
PINCH_EXIT = 0.55
FIST_ENTER = 0.25
FIST_EXIT = 0.38
OPEN_ENTER = 0.68
OPEN_EXIT = 0.54
VOTE_WINDOW = 5
VOTE_REQUIRED = 3


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
    hand_scale: float = 0.0
    pinch_ratio: float = 0.0
    avg_curl: float = 0.0
    finger_curls: dict[str, float] = field(default_factory=dict)


@dataclass
class _MajorityLatch:
    state: bool = False
    history: deque[bool] = field(default_factory=lambda: deque(maxlen=VOTE_WINDOW))

    def update(self, candidate: bool) -> bool:
        self.history.append(candidate)
        yes = sum(self.history)
        no = len(self.history) - yes
        if not self.state and yes >= VOTE_REQUIRED:
            self.state = True
        elif self.state and no >= VOTE_REQUIRED:
            self.state = False
        return self.state

    def reset(self) -> None:
        self.state = False
        self.history.clear()


@dataclass
class GestureStabilizer:
    """제스처별 히스테리시스와 최근 프레임 다수결 상태."""

    pinch: _MajorityLatch = field(default_factory=_MajorityLatch)
    fist: _MajorityLatch = field(default_factory=_MajorityLatch)
    open_palm: _MajorityLatch = field(default_factory=_MajorityLatch)

    def update(
        self, pinch_ratio: float, openness: float, finger_count: int
    ) -> tuple[bool, bool, bool, str]:
        pinch_limit = PINCH_EXIT if self.pinch.state else PINCH_ENTER
        fist_limit = FIST_EXIT if self.fist.state else FIST_ENTER
        open_limit = OPEN_EXIT if self.open_palm.state else OPEN_ENTER

        pinch_shape = openness > (0.16 if self.pinch.state else 0.22) or finger_count >= 1
        pinching = self.pinch.update(pinch_ratio < pinch_limit and pinch_shape)
        fist_fingers = 2 if self.fist.state else 1
        is_fist = self.fist.update(openness < fist_limit and finger_count <= fist_fingers)
        open_fingers = 3 if self.open_palm.state else 4
        is_open = self.open_palm.update(
            openness > open_limit and finger_count >= open_fingers
        )

        if pinching:
            pose = "pinch"
        elif is_fist:
            pose = "fist"
        elif is_open:
            pose = "open_palm"
        else:
            pose = "neutral"
        return pinching, is_fist, is_open, pose

    def reset(self) -> None:
        self.pinch.reset()
        self.fist.reset()
        self.open_palm.reset()


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
        weight = sum(range(1, len(pts)))
        vx = sum((pts[i][0] - pts[i - 1][0]) * i for i in range(1, len(pts))) / weight
        vy = sum((pts[i][1] - pts[i - 1][1]) * i for i in range(1, len(pts))) / weight
        threshold = 0.018
        direction = None
        if abs(vx) > abs(vy):
            direction = "right" if vx > threshold else "left" if vx < -threshold else None
        else:
            direction = "down" if vy > threshold else "up" if vy < -threshold else None

        if direction:
            self.cooldown = now + 0.55
            self.last_direction = direction
            self.history.clear()
        return direction


def _distance(a, b) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


def hand_scale(landmarks) -> float:
    """손목-중지 MCP 거리를 카메라 거리와 무관한 손 크기 단위로 사용."""
    return max(_distance(landmarks[WRIST], landmarks[MIDDLE_MCP]), 1e-6)


def pinch_ratio(landmarks) -> float:
    return _distance(landmarks[THUMB_TIP], landmarks[INDEX_TIP]) / hand_scale(landmarks)


def _finger_extended(landmarks, tip: int, pip: int) -> bool:
    wrist = landmarks[WRIST]
    return _distance(landmarks[tip], wrist) > _distance(landmarks[pip], wrist) * 1.12


def _thumb_extended(landmarks) -> bool:
    wrist = landmarks[WRIST]
    scale = hand_scale(landmarks)
    return (
        _distance(landmarks[THUMB_TIP], wrist)
        > _distance(landmarks[THUMB_IP], wrist) * 1.08
        and _distance(landmarks[THUMB_TIP], landmarks[5]) / scale > 0.42
    )


def count_fingers(landmarks) -> int:
    count = int(_thumb_extended(landmarks))
    return count + sum(
        _finger_extended(landmarks, tip, pip)
        for tip, pip in zip(FINGER_TIPS, FINGER_PIPS)
    )


def palm_center(landmarks) -> tuple[float, float, float]:
    wrist = landmarks[WRIST]
    middle = landmarks[MIDDLE_MCP]
    return (
        (wrist.x + middle.x) / 2,
        (wrist.y + middle.y) / 2,
        (wrist.z + middle.z) / 2,
    )


def hand_openness(landmarks) -> float:
    """손끝의 평균 확장량을 손 크기로 나눈 뒤 0..1로 정규화."""
    cx, cy, _ = palm_center(landmarks)
    scale = hand_scale(landmarks)
    mean_ratio = sum(
        math.hypot(landmarks[i].x - cx, landmarks[i].y - cy) / scale
        for i in (THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP)
    ) / 5
    return max(0.0, min(1.0, (mean_ratio - 0.72) / 1.15))


def is_pinching(landmarks, *_unused, threshold: float = PINCH_ENTER) -> bool:
    """하위 호환용 단일 프레임 판정. 안정화 판정은 GestureStabilizer를 사용."""
    return pinch_ratio(landmarks) < threshold


def detect_pose(
    landmarks,
    openness: float,
    pinching: bool,
    stabilizer: GestureStabilizer | None = None,
) -> str:
    fingers = count_fingers(landmarks)
    if stabilizer is not None:
        return stabilizer.update(pinch_ratio(landmarks), openness, fingers)[3]
    if pinching:
        return "pinch"
    if fingers <= 1 and openness < FIST_ENTER:
        return "fist"
    if fingers >= 4 and openness > OPEN_ENTER:
        return "open_palm"
    return "neutral"


def hands_distance(a: HandFeatures, b: HandFeatures) -> float:
    return math.hypot(a.palm_x - b.palm_x, a.palm_y - b.palm_y)


def hands_together(a: HandFeatures, b: HandFeatures, threshold: float = 0.14) -> bool:
    return hands_distance(a, b) < threshold


def hands_spread(a: HandFeatures, b: HandFeatures, threshold: float = 0.38) -> bool:
    return hands_distance(a, b) > threshold


def gesture_code(hands: Iterable[HandFeatures]) -> str:
    """안정화된 손 상태를 1P/1O/1F/2P/2O/2F 중 하나로 집계."""
    items = list(hands)[:2]
    pose_to_letter = {"pinch": "P", "open_palm": "O", "fist": "F"}
    if len(items) == 1:
        letter = pose_to_letter.get(items[0].pose)
        return f"1{letter}" if letter else "neutral"
    if len(items) == 2 and items[0].pose == items[1].pose:
        letter = pose_to_letter.get(items[0].pose)
        return f"2{letter}" if letter else "neutral"
    return "neutral"


def extract_features(
    landmarks,
    frame_w: int | None = None,
    frame_h: int | None = None,
    stabilizer: GestureStabilizer | None = None,
) -> HandFeatures:
    del frame_w, frame_h  # 좌표는 손 크기로 정규화하므로 프레임 크기가 필요하지 않다.
    cx, cy, cz = palm_center(landmarks)
    scale = hand_scale(landmarks)
    openness = hand_openness(landmarks)
    fingers = count_fingers(landmarks)
    ratio = pinch_ratio(landmarks)

    if stabilizer is None:
        pinching = ratio < PINCH_ENTER
        is_fist = fingers <= 1 and openness < FIST_ENTER
        is_open = fingers >= 4 and openness > OPEN_ENTER
        pose = "pinch" if pinching else "fist" if is_fist else "open_palm" if is_open else "neutral"
    else:
        pinching, is_fist, is_open, pose = stabilizer.update(ratio, openness, fingers)

    return HandFeatures(
        palm_x=cx,
        palm_y=cy,
        palm_z=cz,
        openness=openness,
        finger_count=fingers,
        is_pinching=pinching,
        is_fist=is_fist,
        is_open_palm=is_open,
        pose=pose,
        hand_scale=scale,
        pinch_ratio=ratio,
    )
