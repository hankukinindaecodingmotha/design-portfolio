"""손 움직임에 반응하는 간단한 오디오 엔진 (pygame)."""

from __future__ import annotations

import math
from array import array

try:
    import pygame

    HAS_AUDIO = True
except ImportError:
    HAS_AUDIO = False


SAMPLE_RATE = 22050


def _sine_wave(freq: float, duration: float, volume: float = 0.3) -> bytes:
    n = int(SAMPLE_RATE * duration)
    buf = array("h")
    amp = int(32767 * volume)
    for i in range(n):
        t = i / SAMPLE_RATE
        envelope = min(1.0, i / (SAMPLE_RATE * 0.01)) * min(
            1.0, (n - i) / (SAMPLE_RATE * 0.05)
        )
        sample = int(amp * envelope * math.sin(2 * math.pi * freq * t))
        buf.append(sample)
        buf.append(sample)
    return buf.tobytes()


def _noise_burst(duration: float = 0.08, volume: float = 0.4) -> bytes:
    import random

    n = int(SAMPLE_RATE * duration)
    buf = array("h")
    amp = int(32767 * volume)
    for i in range(n):
        envelope = (1 - i / n) ** 2
        sample = int(amp * envelope * random.uniform(-1, 1))
        buf.append(sample)
        buf.append(sample)
    return buf.tobytes()


class AudioEngine:
    """손 위치·개방도에 따라 톤·비트를 재생."""

    PRESETS = [
        {"name": "Ambient", "base": 220.0, "scale": (0, 2, 4, 7, 9)},
        {"name": "Deep", "base": 110.0, "scale": (0, 3, 5, 7, 10)},
        {"name": "Bright", "base": 330.0, "scale": (0, 2, 4, 5, 7)},
    ]

    def __init__(self) -> None:
        self.enabled = False
        self.preset_idx = 0
        self.last_tone_at = 0.0
        self.last_beat_at = 0.0
        self.tone_sound: object | None = None
        self.beat_sound: object | None = None

        if not HAS_AUDIO:
            return

        try:
            pygame.mixer.pre_init(SAMPLE_RATE, -16, 2, 512)
            pygame.mixer.init()
            self.beat_sound = pygame.mixer.Sound(_noise_burst(0.1, 0.35))
            self.enabled = True
        except Exception:
            self.enabled = False

    @property
    def preset_name(self) -> str:
        return self.PRESETS[self.preset_idx % len(self.PRESETS)]["name"]

    def next_preset(self) -> str:
        self.preset_idx = (self.preset_idx + 1) % len(self.PRESETS)
        return self.preset_name

    def _note_freq(self, hand_y: float, finger_count: int) -> float:
        preset = self.PRESETS[self.preset_idx]
        scale = preset["scale"]
        idx = max(0, min(len(scale) - 1, finger_count - 1))
        semitone = scale[idx]
        base = preset["base"]
        y_shift = (0.5 - hand_y) * 12
        freq = base * (2 ** ((semitone + y_shift) / 12))
        return max(80.0, min(1200.0, freq))

    def update(
        self,
        hand_y: float,
        openness: float,
        finger_count: int,
        is_pinching: bool,
        is_open_palm: bool,
        now: float,
    ) -> None:
        if not self.enabled:
            return

        volume = 0.08 + openness * 0.22
        if is_open_palm and now - self.last_tone_at > 0.18:
            freq = self._note_freq(hand_y, finger_count)
            self.tone_sound = pygame.mixer.Sound(_sine_wave(freq, 0.15, volume))
            self.tone_sound.play()
            self.last_tone_at = now

        if is_pinching and now - self.last_beat_at > 0.22:
            if self.beat_sound:
                self.beat_sound.set_volume(0.3 + openness * 0.5)
                self.beat_sound.play()
            self.last_beat_at = now

    def close(self) -> None:
        if self.enabled and HAS_AUDIO:
            pygame.mixer.quit()
