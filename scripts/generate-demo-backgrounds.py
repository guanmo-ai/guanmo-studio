"""Regenerate the three original backgrounds and web previews for Guanmo Studio."""

from dataclasses import dataclass
from math import cos, exp, hypot, sin
from pathlib import Path

from PIL import Image


@dataclass(frozen=True)
class Stage:
    name: str
    shadow: tuple[int, int, int]
    glow: tuple[int, int, int]
    highlight: tuple[int, int, int]
    center: tuple[float, float]
    radii: tuple[float, float]
    angle: float
    contour: float


STAGES = (
    Stage('studio-amber', (17, 12, 18), (97, 45, 29), (248, 155, 85),
          (1.23, 0.43), (0.57, 0.64), -0.62, 1.0),
    Stage('studio-indigo', (9, 15, 33), (32, 54, 111), (129, 169, 250),
          (0.91, 1.28), (0.63, 0.60), 0.45, 1.04),
    Stage('studio-rose', (22, 12, 23), (85, 39, 61), (224, 133, 160),
          (1.14, 0.52), (0.54, 0.68), 0.77, 1.31),
)


def draw_stage(stage: Stage) -> Image.Image:
    """Draw a soft field of light with a curved edge and room for titles."""
    width, height = 960, 540
    image = Image.new('RGB', (width, height))
    pixels = []
    cosine, sine = cos(stage.angle), sin(stage.angle)
    center_x, center_y = stage.center
    radius_x, radius_y = stage.radii
    bend = stage.contour - 1

    for py in range(height):
        y = py / (height - 1)
        for px in range(width):
            x = px / (width - 1)
            dx, dy = x - center_x, y - center_y
            local_x = (dx * cosine - dy * sine) / radius_x
            local_y = (dx * sine + dy * cosine) / radius_y
            radius = hypot(local_x * (1 + bend * local_y**2), local_y)
            field = 0.84 * exp(-((x - 0.87)**2 * 4.5 + (y - 0.64)**2 * 2.3))
            key = 0.29 + 0.71 * exp(-((y - 0.60) / 0.36)**2)
            contour = 0.22 * exp(-((radius - 1.0) / 0.046)**2)
            contour += 0.19 * exp(-((radius - 1.008) / 0.006)**2)
            contour += 0.084 * exp(-((radius - 0.925) / 0.020)**2)
            contour += 0.069 * exp(-((radius - 0.83) / 0.034)**2)
            glint = contour * key
            pixels.append(tuple(
                round((dark + (mid - dark) * field) * (1 - glint) + bright * glint)
                for dark, mid, bright in zip(stage.shadow, stage.glow, stage.highlight)
            ))

    image.putdata(pixels)
    return image.resize((1920, 1080), Image.Resampling.BICUBIC)


def main() -> None:
    directory = Path(__file__).resolve().parents[1] / 'assets' / 'backgrounds'
    previews = directory / 'previews'
    previews.mkdir(parents=True, exist_ok=True)
    for stage in STAGES:
        image = draw_stage(stage)
        image.save(directory / f'{stage.name}.png', optimize=True)
        image.resize((960, 540), Image.Resampling.LANCZOS).save(
            previews / f'{stage.name}.webp', quality=88, method=6
        )


if __name__ == '__main__':
    main()
