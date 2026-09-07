#!/usr/bin/env python3
"""
맥북 웹캠 손 반응 데모

- 검지 끝으로 원(커서) 이동
- 엄지+검지 핀치 → 클릭 효과
- MediaPipe 제스처(👍 ✌️ ✊ 등) → 화면 반응
"""

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
from mediapipe.tasks.python.vision import drawing_utils, drawing_styles

from download_model import download_model
INDEX_TIP = 8
THUMB_TIP = 4
WRIST = 0

# 제스처 → 화면 반응 색상 (BGR)
GESTURE_COLORS: dict[str, tuple[int, int, int]] = {
    "None": (255, 180, 80),
    "Closed_Fist": (80, 80, 255),
    "Open_Palm": (80, 255, 80),
    "Pointing_Up": (255, 255, 80),
    "Thumb_Down": (80, 80, 220),
    "Thumb_Up": (80, 220, 80),
    "Victory": (220, 80, 220),
    "ILoveYou": (180, 80, 255),
}

GESTURE_LABELS_KO: dict[str, str] = {
    "None": "손 감지됨",
    "Closed_Fist": "주먹 ✊",
    "Open_Palm": "손바닥 🖐",
    "Pointing_Up": "위로 가리킴 ☝️",
    "Thumb_Down": "엄지 아래 👎",
    "Thumb_Up": "엄지 위 👍",
    "Victory": "브이 ✌️",
    "ILoveYou": "사랑해요 🤟",
}


@dataclass
class AppState:
    cursor_x: float | None = None
    cursor_y: float | None = None
    gesture: str = "None"
    gesture_score: float = 0.0
    is_pinched: bool = False
    was_pinched: bool = False
    click_flash: float = 0.0
    score: int = 0
    last_gesture: str = "None"
    particles: list[tuple[float, float, float]] = field(default_factory=list)


def smooth(prev: float | None, value: float, alpha: float = 0.35) -> float:
    if prev is None:
        return value
    return prev * (1 - alpha) + value * alpha


def pinch_distance(landmarks, frame_w: int, frame_h: int) -> float:
    thumb = landmarks[THUMB_TIP]
    index = landmarks[INDEX_TIP]
    tx, ty = thumb.x * frame_w, thumb.y * frame_h
    ix, iy = index.x * frame_w, index.y * frame_h
    return math.hypot(tx - ix, ty - iy)


def draw_hand_landmarks(frame: np.ndarray, landmarks) -> None:
    drawing_utils.draw_landmarks(
        frame,
        landmarks,
        vision.HandLandmarksConnections.HAND_CONNECTIONS,
        drawing_styles.get_default_hand_landmarks_style(),
        drawing_styles.get_default_hand_connections_style(),
    )


def draw_hud(frame: np.ndarray, state: AppState) -> None:
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 72), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)

    label = GESTURE_LABELS_KO.get(state.gesture, state.gesture)
    cv2.putText(
        frame,
        f"제스처: {label}  ({state.gesture_score:.0%})",
        (16, 28),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (240, 240, 240),
        2,
        cv2.LINE_AA,
    )
    cv2.putText(
        frame,
        f"점수: {state.score}   |   Q 또는 ESC 종료",
        (16, 56),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (180, 180, 180),
        1,
        cv2.LINE_AA,
    )

    if state.is_pinched:
        cv2.putText(
            frame,
            "PINCH!",
            (w // 2 - 60, h - 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (0, 255, 255),
            3,
            cv2.LINE_AA,
        )


def draw_cursor(frame: np.ndarray, state: AppState) -> None:
    if state.cursor_x is None or state.cursor_y is None:
        return

    color = GESTURE_COLORS.get(state.gesture, GESTURE_COLORS["None"])
    radius = 18 if not state.is_pinched else 10
    if state.click_flash > 0:
        radius = int(radius + state.click_flash * 12)
        state.click_flash = max(0.0, state.click_flash - 0.08)

    cx, cy = int(state.cursor_x), int(state.cursor_y)
    cv2.circle(frame, (cx, cy), radius + 6, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.circle(frame, (cx, cy), radius, color, -1, cv2.LINE_AA)

    for px, py, life in state.particles:
        pr = max(2, int(life * 8))
        cv2.circle(frame, (int(px), int(py)), pr, color, -1, cv2.LINE_AA)

    state.particles = [
        (px, py, life - 0.05)
        for px, py, life in state.particles
        if life - 0.05 > 0
    ]


def on_gesture_change(state: AppState, new_gesture: str, x: float, y: float) -> None:
    if new_gesture == state.last_gesture or new_gesture == "None":
        return

    state.last_gesture = new_gesture
    if new_gesture == "Thumb_Up":
        state.score += 1
    elif new_gesture == "Victory":
        state.score += 2

    for _ in range(12):
        angle = np.random.uniform(0, 2 * math.pi)
        dist = np.random.uniform(20, 60)
        state.particles.append(
            (x + math.cos(angle) * dist, y + math.sin(angle) * dist, 1.0)
        )


def process_result(result, frame: np.ndarray, state: AppState) -> None:
    h, w = frame.shape[:2]
    state.is_pinched = False

    if not result.hand_landmarks:
        state.cursor_x = None
        state.cursor_y = None
        state.gesture = "None"
        state.is_pinched = False
        state.was_pinched = False
        return

    landmarks = result.hand_landmarks[0]
    draw_hand_landmarks(frame, landmarks)

    tip = landmarks[INDEX_TIP]
    px, py = tip.x * w, tip.y * h
    state.cursor_x = smooth(state.cursor_x, px)
    state.cursor_y = smooth(state.cursor_y, py)

    dist = pinch_distance(landmarks, w, h)
    state.is_pinched = dist < 45
    if state.is_pinched and not state.was_pinched:
        state.click_flash = 1.0
        state.score += 1
    state.was_pinched = state.is_pinched

    if result.gestures and result.gestures[0]:
        top = result.gestures[0][0]
        state.gesture = top.category_name or "None"
        state.gesture_score = top.score or 0.0
        on_gesture_change(state, state.gesture, px, py)


def create_recognizer(model_path: Path) -> vision.GestureRecognizer:
    options = vision.GestureRecognizerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=vision.RunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return vision.GestureRecognizer.create_from_options(options)


def run(camera_id: int = 0, width: int = 1280, height: int = 720) -> int:
    model_path = download_model("gesture")
    recognizer = create_recognizer(model_path)
    state = AppState()

    cap = cv2.VideoCapture(camera_id)
    if not cap.isOpened():
        print(
            "웹캠을 열 수 없습니다.\n"
            "  - macOS: 시스템 설정 → 개인정보 보호 → 카메라에서 터미널/Python 허용\n"
            "  - 다른 카메라: python app.py --camera 1",
            file=sys.stderr,
        )
        return 1

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

    window = "Hand Motion Demo (Mac)"
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window, 960, 540)

    print("손을 카메라 앞에 보여주세요.")
    print("  검지 → 원 이동 | 핀치(엄지+검지) → 클릭 | 👍 ✌️ → 점수")
    print("  종료: Q 또는 ESC")

    frame_ts = 0
    fps_t0 = time.perf_counter()
    fps_count = 0
    fps_display = 0.0

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
            result = recognizer.recognize_for_video(mp_image, frame_ts)
            process_result(result, frame, state)
            draw_cursor(frame, state)
            draw_hud(frame, state)

            fps_count += 1
            elapsed = time.perf_counter() - fps_t0
            if elapsed >= 1.0:
                fps_display = fps_count / elapsed
                fps_count = 0
                fps_t0 = time.perf_counter()

            cv2.putText(
                frame,
                f"{fps_display:.0f} FPS",
                (frame.shape[1] - 90, 24),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (160, 160, 160),
                1,
                cv2.LINE_AA,
            )

            cv2.imshow(window, frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord("q"), ord("Q")):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()
        recognizer.close()

    print(f"종료. 최종 점수: {state.score}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="맥북 웹캠 손 반응 데모")
    parser.add_argument("--camera", type=int, default=0, help="카메라 인덱스 (기본 0)")
    parser.add_argument("--width", type=int, default=1280, help="캡처 가로 해상도")
    parser.add_argument("--height", type=int, default=720, help="캡처 세로 해상도")
    args = parser.parse_args()
    return run(camera_id=args.camera, width=args.width, height=args.height)


if __name__ == "__main__":
    raise SystemExit(main())
