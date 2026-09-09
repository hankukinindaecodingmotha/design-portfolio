#!/usr/bin/env python3
"""맥북 웹캠용 6종 손 제스처 데모."""

from __future__ import annotations

import argparse
import math
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision import drawing_styles, drawing_utils

from download_model import download_model
from hand_utils import GestureStabilizer, extract_features, gesture_code

INDEX_TIP = 8
GESTURE_LABELS = {
    "neutral": "—",
    "1P": "1P · 한 손 핀치",
    "1O": "1O · 한 손 펼침",
    "1F": "1F · 한 손 주먹",
    "2P": "2P · 두 손 핀치",
    "2O": "2O · 두 손 펼침",
    "2F": "2F · 두 손 주먹",
}
GESTURE_COLORS = {
    "neutral": (210, 210, 210),
    "1P": (80, 230, 255),
    "1O": (150, 255, 160),
    "1F": (100, 110, 255),
    "2P": (255, 170, 90),
    "2O": (255, 120, 210),
    "2F": (170, 100, 255),
}


@dataclass
class AppState:
    cursors: dict[str, tuple[float, float]] = field(default_factory=dict)
    gesture: str = "neutral"
    previous_gesture: str = "neutral"
    flash: float = 0.0
    particles: list[tuple[float, float, float, float, float]] = field(default_factory=list)


def smooth(previous: float | None, value: float, alpha: float = 0.32) -> float:
    return value if previous is None else previous * (1 - alpha) + value * alpha


def draw_hand_landmarks(frame: np.ndarray, landmarks) -> None:
    drawing_utils.draw_landmarks(
        frame,
        landmarks,
        vision.HandLandmarksConnections.HAND_CONNECTIONS,
        drawing_styles.get_default_hand_landmarks_style(),
        drawing_styles.get_default_hand_connections_style(),
    )


def _hand_key(result, index: int) -> str:
    if result.handedness and index < len(result.handedness) and result.handedness[index]:
        return result.handedness[index][0].category_name or f"hand-{index}"
    return f"hand-{index}"


def emit_gesture_particles(state: AppState) -> None:
    if not state.cursors:
        return
    cx = sum(point[0] for point in state.cursors.values()) / len(state.cursors)
    cy = sum(point[1] for point in state.cursors.values()) / len(state.cursors)
    count = 30 if state.gesture.startswith("2") else 18
    for _ in range(count):
        angle = np.random.uniform(0, math.tau)
        speed = np.random.uniform(1.5, 7.0)
        state.particles.append(
            (cx, cy, math.cos(angle) * speed, math.sin(angle) * speed, 1.0)
        )


def process_result(result, frame: np.ndarray, state: AppState, stabilizers) -> None:
    height, width = frame.shape[:2]
    if not result.hand_landmarks:
        state.cursors.clear()
        state.gesture = "neutral"
        for stabilizer in stabilizers.values():
            stabilizer.reset()
        return

    features = []
    visible_keys = set()
    for index, landmarks in enumerate(result.hand_landmarks[:2]):
        key = _hand_key(result, index)
        visible_keys.add(key)
        draw_hand_landmarks(frame, landmarks)
        stabilizer = stabilizers.setdefault(key, GestureStabilizer())
        features.append(extract_features(landmarks, stabilizer=stabilizer))

        tip = landmarks[INDEX_TIP]
        px, py = tip.x * width, tip.y * height
        previous = state.cursors.get(key)
        state.cursors[key] = (
            smooth(previous[0] if previous else None, px),
            smooth(previous[1] if previous else None, py),
        )

    for key in list(state.cursors):
        if key not in visible_keys:
            state.cursors.pop(key, None)

    state.gesture = gesture_code(features)
    if state.gesture != state.previous_gesture:
        if state.gesture != "neutral":
            state.flash = 1.0
            emit_gesture_particles(state)
        state.previous_gesture = state.gesture


def draw_hud(frame: np.ndarray, state: AppState) -> None:
    height, width = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (width, 76), (8, 12, 14), -1)
    cv2.addWeighted(overlay, 0.72, frame, 0.28, 0, frame)
    color = GESTURE_COLORS[state.gesture]
    cv2.putText(frame, GESTURE_LABELS[state.gesture], (18, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.72, color, 2, cv2.LINE_AA)
    cv2.putText(frame, "1P / 1O / 1F / 2P / 2O / 2F   |   Q or ESC", (18, 61), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (175, 185, 185), 1, cv2.LINE_AA)

    points = list(state.cursors.values())
    if len(points) == 2:
        cv2.line(frame, tuple(map(int, points[0])), tuple(map(int, points[1])), color, 2, cv2.LINE_AA)
    for x, y in points:
        radius = 11 if state.gesture.endswith("P") else 18 if state.gesture.endswith("O") else 14
        cv2.circle(frame, (int(x), int(y)), radius + 7, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.circle(frame, (int(x), int(y)), radius, color, 2, cv2.LINE_AA)

    updated = []
    for x, y, vx, vy, life in state.particles:
        life -= 0.045
        if life <= 0:
            continue
        x += vx
        y += vy
        cv2.circle(frame, (int(x), int(y)), max(1, int(life * 5)), color, -1, cv2.LINE_AA)
        updated.append((x, y, vx * 0.985, vy * 0.985, life))
    state.particles = updated

    if state.flash > 0 and points:
        cx = int(sum(point[0] for point in points) / len(points))
        cy = int(sum(point[1] for point in points) / len(points))
        radius = int((1 - state.flash) * 110 + 24)
        cv2.circle(frame, (cx, cy), radius, color, 2, cv2.LINE_AA)
        state.flash = max(0.0, state.flash - 0.06)


def create_hand_landmarker(model_path: Path) -> vision.HandLandmarker:
    def options(delegate: str) -> vision.HandLandmarkerOptions:
        return vision.HandLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path), delegate=delegate),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=0.5,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    try:
        return vision.HandLandmarker.create_from_options(options("GPU"))
    except Exception:
        print("GPU 사용 불가 → CPU 모드로 실행합니다.")
        return vision.HandLandmarker.create_from_options(options("CPU"))


def run(camera_id: int = 0, width: int = 1280, height: int = 720) -> int:
    landmarker = create_hand_landmarker(download_model("hand"))
    stabilizers: dict[str, GestureStabilizer] = {}
    state = AppState()
    cap = cv2.VideoCapture(camera_id)
    if not cap.isOpened():
        print("웹캠을 열 수 없습니다. macOS 카메라 권한을 확인하세요.", file=sys.stderr)
        landmarker.close()
        return 1

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    window = "Hand Motion — 6 Gesture System"
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window, 960, 540)
    print("6종 제스처: 1P/1O/1F · 2P/2O/2F | 종료: Q 또는 ESC")

    frame_ts = 0
    fps_started = time.perf_counter()
    fps_frames = 0
    fps = 0.0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("프레임을 읽을 수 없습니다.", file=sys.stderr)
                break
            frame = cv2.flip(frame, 1)
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            frame_ts += 33
            process_result(landmarker.detect_for_video(mp_image, frame_ts), frame, state, stabilizers)
            draw_hud(frame, state)

            fps_frames += 1
            elapsed = time.perf_counter() - fps_started
            if elapsed >= 1.0:
                fps = fps_frames / elapsed
                fps_frames = 0
                fps_started = time.perf_counter()
            cv2.putText(frame, f"{fps:.0f} FPS", (frame.shape[1] - 88, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 170, 170), 1, cv2.LINE_AA)
            cv2.imshow(window, frame)
            if cv2.waitKey(1) & 0xFF in (27, ord("q"), ord("Q")):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()
        landmarker.close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="맥북 웹캠 6종 손 제스처 데모")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    args = parser.parse_args()
    return run(args.camera, args.width, args.height)


if __name__ == "__main__":
    raise SystemExit(main())
