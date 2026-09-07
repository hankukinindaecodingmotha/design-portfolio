"""TouchDesigner 스타일 반응형 비주얼 엔진."""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import cv2
import numpy as np

from hand_utils import HandFeatures


@dataclass
class Particle:
    x: float
    y: float
    vx: float
    vy: float
    life: float
    hue: float


@dataclass
class VisualState:
    scene: int = 0
    hue: float = 0.6
    pulse: float = 0.0
    ring_phase: float = 0.0
    particles: list[Particle] = field(default_factory=list)
    trail: list[tuple[float, float]] = field(default_factory=list)
    scene_names: tuple[str, ...] = ("Aurora", "Particles", "Grid")


def _hsv_to_bgr(h: float, s: float, v: float) -> tuple[int, int, int]:
    hsv = np.uint8([[[int(h * 179), int(s * 255), int(v * 255)]]])
    bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)[0, 0]
    return int(bgr[0]), int(bgr[1]), int(bgr[2])


class VisualEngine:
    SCENE_COUNT = 3

    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.state = VisualState()
        self._init_particles()

    def _init_particles(self) -> None:
        self.state.particles = [
            Particle(
                x=np.random.uniform(0, self.width),
                y=np.random.uniform(0, self.height),
                vx=np.random.uniform(-1, 1),
                vy=np.random.uniform(-1, 1),
                life=np.random.uniform(0.5, 1.0),
                hue=np.random.random(),
            )
            for _ in range(120)
        ]

    def next_scene(self) -> str:
        self.state.scene = (self.state.scene + 1) % self.SCENE_COUNT
        if self.state.scene == 1:
            self._init_particles()
        return self.state.scene_names[self.state.scene]

    def on_pinch(self, x: float, y: float, hue: float) -> None:
        self.state.pulse = 1.0
        self.state.ring_phase = 0.0
        for _ in range(16):
            angle = np.random.uniform(0, 2 * math.pi)
            speed = np.random.uniform(2, 8)
            self.state.particles.append(
                Particle(
                    x=x, y=y,
                    vx=math.cos(angle) * speed,
                    vy=math.sin(angle) * speed,
                    life=1.0,
                    hue=hue,
                )
            )

    def on_hands_together(self, x: float, y: float) -> None:
        self.state.pulse = 1.0
        self.state.ring_phase = 0.0
        for _ in range(32):
            angle = np.random.uniform(0, 2 * math.pi)
            speed = np.random.uniform(3, 12)
            self.state.particles.append(
                Particle(
                    x=x, y=y,
                    vx=math.cos(angle) * speed,
                    vy=math.sin(angle) * speed,
                    life=1.2,
                    hue=(self.state.hue + 0.5) % 1.0,
                )
            )

    def update(self, hands: list[HandFeatures] | None, frame_dt: float) -> None:
        hand = hands[0] if hands else None
        if hand:
            self.state.hue = (hand.palm_x * 0.7 + (1 - hand.palm_y) * 0.3) % 1.0
            px = hand.palm_x * self.width
            py = hand.palm_y * self.height
            self.state.trail.append((px, py))
            if len(self.state.trail) > 40:
                self.state.trail.pop(0)

        attract_x = self.width / 2
        attract_y = self.height / 2
        if hands and len(hands) == 2:
            attract_x = (hands[0].palm_x + hands[1].palm_x) / 2 * self.width
            attract_y = (hands[0].palm_y + hands[1].palm_y) / 2 * self.height
        elif hand:
            attract_x = hand.palm_x * self.width
            attract_y = hand.palm_y * self.height

        self.state.pulse = max(0.0, self.state.pulse - frame_dt * 2.5)
        self.state.ring_phase += frame_dt * 3.0

        for p in self.state.particles:
            dx = attract_x - p.x
            dy = attract_y - p.y
            dist = math.hypot(dx, dy) + 1
            force = 80 / dist
            p.vx += (dx / dist) * force * frame_dt
            p.vy += (dy / dist) * force * frame_dt
            p.x += p.vx
            p.y += p.vy
            p.vx *= 0.98
            p.vy *= 0.98
            p.life -= frame_dt * 0.3
            if p.x < 0 or p.x > self.width:
                p.vx *= -1
            if p.y < 0 or p.y > self.height:
                p.vy *= -1

        self.state.particles = [p for p in self.state.particles if p.life > 0]
        while len(self.state.particles) < 80:
            self.state.particles.append(
                Particle(
                    x=np.random.uniform(0, self.width),
                    y=np.random.uniform(0, self.height),
                    vx=0, vy=0,
                    life=1.0,
                    hue=np.random.random(),
                )
            )

    def render(
        self,
        hands: list[HandFeatures] | None,
        together: bool = False,
    ) -> np.ndarray:
        canvas = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        canvas[:] = (8, 6, 12)

        hand = hands[0] if hands else None
        scene = self.state.scene
        if scene == 0:
            self._draw_aurora(canvas, hands, together)
        elif scene == 1:
            self._draw_particles(canvas, hand)
        else:
            self._draw_grid(canvas, hand)

        if together and hands and len(hands) == 2:
            self._draw_together_bridge(canvas, hands)

        self._draw_rings(canvas, hand)
        self._draw_hud(canvas, hands, together)
        return canvas

    def _draw_together_bridge(self, canvas: np.ndarray, hands: list[HandFeatures]) -> None:
        h, w = canvas.shape[:2]
        a, b = hands[0], hands[1]
        ax, ay = int(a.palm_x * w), int(a.palm_y * h)
        bx, by = int(b.palm_x * w), int(b.palm_y * h)
        mx, my = (ax + bx) // 2, (ay + by) // 2
        color = _hsv_to_bgr((self.state.hue + 0.33) % 1.0, 0.9, 1.0)
        cv2.line(canvas, (ax, ay), (bx, by), color, 4, cv2.LINE_AA)
        cv2.circle(canvas, (mx, my), 60, color, 3, cv2.LINE_AA)
        for i in range(6):
            angle = self.state.ring_phase + i * (math.pi / 3)
            r = 50 + math.sin(self.state.ring_phase * 2 + i) * 15
            px = int(mx + math.cos(angle) * r)
            py = int(my + math.sin(angle) * r)
            cv2.circle(canvas, (px, py), 8, color, -1, cv2.LINE_AA)

    def _draw_aurora(
        self,
        canvas: np.ndarray,
        hands: list[HandFeatures] | None,
        together: bool,
    ) -> None:
        h, w = canvas.shape[:2]
        hues = [0.58, 0.92]
        targets = hands if hands else [None]
        for idx, hand in enumerate(targets):
            if hand is None:
                continue
            overlay = canvas.copy()
            cx = int(hand.palm_x * w)
            cy = int(hand.palm_y * h)
            radius = int(60 + hand.openness * 100 + self.state.pulse * 40)
            if together:
                radius = int(radius * 0.6)
            color = _hsv_to_bgr(hues[idx % 2], 0.85, 0.95)
            cv2.circle(overlay, (cx, cy), radius, color, -1, cv2.LINE_AA)
            cv2.addWeighted(overlay, 0.4, canvas, 0.6, 0, canvas)

        for i, (tx, ty) in enumerate(self.state.trail):
            alpha = (i + 1) / len(self.state.trail) if self.state.trail else 0
            r = int(4 + alpha * 10)
            c = _hsv_to_bgr(self.state.hue, 0.6, 0.4 + alpha * 0.5)
            cv2.circle(canvas, (int(tx), int(ty)), r, c, -1, cv2.LINE_AA)

    def _draw_particles(self, canvas: np.ndarray, hand: HandFeatures | None) -> None:
        for p in self.state.particles:
            c = _hsv_to_bgr(
                (self.state.hue + p.hue * 0.2) % 1.0,
                0.7,
                0.3 + p.life * 0.6,
            )
            r = max(2, int(3 + p.life * 5))
            cv2.circle(canvas, (int(p.x), int(p.y)), r, c, -1, cv2.LINE_AA)

    def _draw_grid(self, canvas: np.ndarray, hand: HandFeatures | None) -> None:
        h, w = canvas.shape[:2]
        step = 40
        warp = (hand.openness - 0.5) * 30 if hand else 0
        color = _hsv_to_bgr(self.state.hue, 0.4, 0.5)
        for x in range(0, w, step):
            pts = []
            for y in range(0, h, step):
                dx = math.sin((y + self.state.ring_phase * 40) * 0.02) * warp
                dy = math.cos((x + self.state.ring_phase * 40) * 0.02) * warp
                if hand:
                    hx = hand.palm_x * w
                    hy = hand.palm_y * h
                    dist = math.hypot(x - hx, y - hy)
                    pull = max(0, 120 - dist) * 0.15
                    dx += (hx - x) / (dist + 1) * pull
                    dy += (hy - y) / (dist + 1) * pull
                pts.append((int(x + dx), int(y + dy)))
            for i in range(len(pts) - 1):
                cv2.line(canvas, pts[i], pts[i + 1], color, 1, cv2.LINE_AA)
        for y in range(0, h, step):
            pts = []
            for x in range(0, w, step):
                dx = math.sin((y + self.state.ring_phase * 40) * 0.02) * warp
                dy = math.cos((x + self.state.ring_phase * 40) * 0.02) * warp
                if hand:
                    hx = hand.palm_x * w
                    hy = hand.palm_y * h
                    dist = math.hypot(x - hx, y - hy)
                    pull = max(0, 120 - dist) * 0.15
                    dx += (hx - x) / (dist + 1) * pull
                    dy += (hy - y) / (dist + 1) * pull
                pts.append((int(x + dx), int(y + dy)))
            for i in range(len(pts) - 1):
                cv2.line(canvas, pts[i], pts[i + 1], color, 1, cv2.LINE_AA)

    def _draw_rings(self, canvas: np.ndarray, hand: HandFeatures | None) -> None:
        if self.state.pulse <= 0 or not hand:
            return
        h, w = canvas.shape[:2]
        cx, cy = int(hand.palm_x * w), int(hand.palm_y * h)
        for i in range(3):
            r = int(40 + i * 35 + self.state.ring_phase * 20)
            alpha = self.state.pulse * (1 - i * 0.3)
            c = _hsv_to_bgr(self.state.hue, 0.8, 0.7)
            cv2.circle(canvas, (cx, cy), r, c, 2, cv2.LINE_AA)

    def _draw_hud(
        self,
        canvas: np.ndarray,
        hands: list[HandFeatures] | None,
        together: bool = False,
    ) -> None:
        h, w = canvas.shape[:2]
        overlay = canvas.copy()
        cv2.rectangle(overlay, (0, 0), (w, 90), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.55, canvas, 0.45, 0, canvas)

        scene = self.state.scene_names[self.state.scene]
        cv2.putText(
            canvas, f"SCENE: {scene}",
            (20, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (220, 220, 220), 2, cv2.LINE_AA,
        )
        if together:
            cv2.putText(
                canvas, "HANDS TOGETHER — Vortex",
                (20, 62), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 150, 255), 1, cv2.LINE_AA,
            )
        elif hands:
            cv2.putText(
                canvas,
                f"Hands: {len(hands)}  |  Pinch / Together for effects",
                (20, 62), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 160, 160), 1, cv2.LINE_AA,
            )
        cv2.putText(
            canvas,
            "2 hands | Together: vortex | Swipe: scene | Q: quit",
            (20, 82), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (120, 120, 120), 1, cv2.LINE_AA,
        )

    def draw_pip(self, canvas: np.ndarray, camera_frame: np.ndarray) -> None:
        """카메라 화면을 우하단 PIP로 표시."""
        h, w = canvas.shape[:2]
        pip_w, pip_h = 240, 180
        x0, y0 = w - pip_w - 16, h - pip_h - 16
        small = cv2.resize(camera_frame, (pip_w, pip_h))
        overlay = canvas.copy()
        cv2.rectangle(overlay, (x0 - 2, y0 - 2), (x0 + pip_w + 2, y0 + pip_h + 2), (80, 80, 80), 2)
        canvas[y0 : y0 + pip_h, x0 : x0 + pip_w] = small
        cv2.addWeighted(overlay, 0.15, canvas, 0.85, 0, canvas)
