#!/usr/bin/env python3
"""MediaPipe 모델 다운로드."""

from pathlib import Path
import urllib.request

MODEL_DIR = Path(__file__).resolve().parent / "models"

MODELS = {
    "gesture": (
        "https://storage.googleapis.com/mediapipe-models/"
        "gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        "gesture_recognizer.task",
    ),
    "hand": (
        "https://storage.googleapis.com/mediapipe-models/"
        "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        "hand_landmarker.task",
    ),
}


def download_model(name: str = "gesture", force: bool = False) -> Path:
    if name not in MODELS:
        raise ValueError(f"알 수 없는 모델: {name}. 사용 가능: {list(MODELS)}")

    url, filename = MODELS[name]
    path = MODEL_DIR / filename
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    if path.exists() and not force:
        return path

    print(f"모델 다운로드 중 ({name})...\n  {url}")
    urllib.request.urlretrieve(url, path)
    print(f"저장 완료: {path}")
    return path


if __name__ == "__main__":
    for key in MODELS:
        download_model(key)
