#!/usr/bin/env python3
"""
TouchDesigner 스타일 손 제어 AV 퍼포먼스 (Mac)

참고 영상: https://www.youtube.com/shorts/PaIYtyZrplY
카메라 손 움직임 → 비주얼(색상·파티클·그리드) + 오디오(톤·비트) 실시간 제어
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision import drawing_utils, drawing_styles

from audio_engine import AudioEngine
from download_model import download_model
from hand_utils import HandFeatures, SwipeDetector, extract_features, hands_spread, hands_together
from visual_engine import VisualEngine


def create_hand_landmarker(model_path: Path) -> vision.HandLandmarker:
    def make_options(delegate: str) -> vision.HandLandmarkerOptions:
        return vision.HandLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(
                model_asset_path=str(model_path),
                delegate=delegate,
            ),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=0.4,
            min_hand_presence_confidence=0.4,
            min_tracking_confidence=0.4,
        )

    try:
        return vision.HandLandmarker.create_from_options(make_options("GPU"))
    except Exception:
        print("GPU 사용 불가 → CPU 모드로 실행합니다.")
        return vision.HandLandmarker.create_from_options(make_options("CPU"))


def draw_skeleton(frame, landmarks) -> None:
    drawing_utils.draw_landmarks(
        frame,
        landmarks,
        vision.HandLandmarksConnections.HAND_CONNECTIONS,
        drawing_styles.get_default_hand_landmarks_style(),
        drawing_styles.get_default_hand_connections_style(),
    )


def run(
    camera_id: int = 0,
    width: int = 1280,
    height: int = 720,
    no_audio: bool = False,
) -> int:
    model_path = download_model("hand")
    landmarker = create_hand_landmarker(model_path)

    cap = cv2.VideoCapture(camera_id)
    if not cap.isOpened():
        print(
            "웹캠을 열 수 없습니다.\n"
            "  macOS: 시스템 설정 → 개인정보 보호 → 카메라에서 터미널/Python 허용",
            file=sys.stderr,
        )
        return 1

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

    out_w, out_h = 1280, 720
    visuals = VisualEngine(out_w, out_h)
    audio = AudioEngine() if not no_audio else None
    swipe = SwipeDetector()
    was_pinching = [False, False]
    was_hands_together = False
    was_hands_spread = False
    was_pose: list[str] = ["neutral", "neutral"]
    prev_hand_dist = 1.0

    window = "Hand Performer — TouchDesigner Style"
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window, out_w, out_h)

    print("=" * 50)
    print("  Hand Performer — 손으로 오디오·비주얼 제어")
    print("=" * 50)
    print("  🖐 손바닥 → 충격파 | ✊ 주먹 → 수축 | ✌️ → 레이저")
    print("  👍 엄지 → 상승 | 🤏 핀치 → 폭발 | 👌 OK → 궤도")
    print("  🤘 락 → 번개 | ✋ 스톱 → 방패 | 🤙 샤카 → 파도 | 🙌 재즈 → 무지개")
    print("  양손 모음 → 소용돌이 | 양손 벌림 → 번개 | 빠르게 모음 → 박수")
    print("  손 펼치기   → 밝기·볼륨·톤")
    print("  핀치        → 비트 + 파티클")
    print("  좌/우 스와이프 → 씬 전환 (Aurora / Particles / Grid)")
    print("  스페이스바  → 씬 수동 전환")
    print("  Q / ESC     → 종료")
    if audio and not audio.enabled:
        print("  (오디오 비활성 — pygame 설치 후 재시도)")
    print()

    frame_ts = 0
    last_time = time.perf_counter()
    hand: HandFeatures | None = None
    hands: list[HandFeatures] = []
    action_msg = ""
    action_until = 0.0

    try:
        while True:
            now = time.perf_counter()
            dt = min(now - last_time, 0.05)
            last_time = now

            ok, cam = cap.read()
            if not ok:
                break

            cam = cv2.flip(cam, 1)
            cam_h, cam_w = cam.shape[:2]
            rgb = cv2.cvtColor(cam, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

            frame_ts += 33
            result = landmarker.detect_for_video(mp_image, frame_ts)

            hands = []
            together = False
            spread = False
            if result.hand_landmarks:
                for lm in result.hand_landmarks:
                    draw_skeleton(cam, lm)
                    hands.append(extract_features(lm, cam_w, cam_h))

                hand = hands[0]
                if len(hands) >= 2:
                    together = hands_together(hands[0], hands[1])
                    spread = hands_spread(hands[0], hands[1])
                    dist = ((hands[0].palm_x - hands[1].palm_x) ** 2 + (hands[0].palm_y - hands[1].palm_y) ** 2) ** 0.5
                    closing_fast = prev_hand_dist - dist > 0.08
                    if together and not was_hands_together:
                        mx = (hands[0].palm_x + hands[1].palm_x) / 2 * out_w
                        my = (hands[0].palm_y + hands[1].palm_y) / 2 * out_h
                        if closing_fast and prev_hand_dist > 0.2:
                            action_msg = "CLAP!"
                        else:
                            visuals.on_hands_together(mx, my)
                            action_msg = "HANDS TOGETHER!"
                        action_until = now + 1.5
                    if spread and not was_hands_spread:
                        action_msg = "SPREAD — Lightning!"
                        action_until = now + 1.2
                    was_hands_together = together
                    was_hands_spread = spread
                    prev_hand_dist = dist

                for idx, h in enumerate(hands):
                    if h.pose != was_pose[idx]:
                        if h.pose == "open_palm":
                            visuals.on_pinch(h.palm_x * out_w, h.palm_y * out_h, visuals.state.hue)
                        was_pose[idx] = h.pose

                for idx, h in enumerate(hands):
                    direction = swipe.update(h.palm_x, h.palm_y, now)
                    if direction in ("left", "right"):
                        scene = visuals.next_scene()
                        action_msg = f"Scene → {scene}"
                        action_until = now + 1.2
                        if audio:
                            audio.next_preset()
                        break

                    if h.is_pinching and not was_pinching[idx]:
                        px = h.palm_x * out_w
                        py = h.palm_y * out_h
                        visuals.on_pinch(px, py, visuals.state.hue)
                    was_pinching[idx] = h.is_pinching

                    if audio:
                        audio.update(
                            h.palm_y,
                            h.openness,
                            h.finger_count,
                            h.is_pinching,
                            h.is_open_palm,
                            now,
                        )
            else:
                hand = None
                hands = []
                was_pinching = [False, False]
                was_hands_together = False
                was_hands_spread = False
                was_pose = ["neutral", "neutral"]
                prev_hand_dist = 1.0

            visuals.update(hands if hands else None, dt)
            output = visuals.render(hands if hands else None, together or spread)
            visuals.draw_pip(output, cam)

            if now < action_until:
                cv2.putText(
                    output, action_msg,
                    (out_w // 2 - 120, out_h // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA,
                )

            if audio and audio.enabled:
                cv2.putText(
                    output, f"Audio: {audio.preset_name}",
                    (out_w - 200, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 200, 100), 1, cv2.LINE_AA,
                )

            cv2.imshow(window, output)
            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord("q"), ord("Q")):
                break
            if key == ord(" "):
                scene = visuals.next_scene()
                action_msg = f"Scene → {scene}"
                action_until = now + 1.0

    finally:
        cap.release()
        cv2.destroyAllWindows()
        landmarker.close()
        if audio:
            audio.close()

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="손 움직임으로 오디오·비주얼을 제어하는 VJ 퍼포먼스 앱",
    )
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--no-audio", action="store_true", help="오디오 비활성화")
    args = parser.parse_args()
    return run(
        camera_id=args.camera,
        width=args.width,
        height=args.height,
        no_audio=args.no_audio,
    )


if __name__ == "__main__":
    raise SystemExit(main())
