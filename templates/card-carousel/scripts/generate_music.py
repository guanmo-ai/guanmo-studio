"""Generate the original 15-second, sample-free Card Carousel backing track."""

from array import array
from math import exp, pi, sin
from pathlib import Path
import sys
import wave

RATE = 48000
DURATION = 15
BEAT = 0.5
channels = [array('f', [0]) * (RATE * DURATION) for _ in range(2)]


def synth(start, seconds, volume, pan, voice, pitch=60):
    first = round(start * RATE)
    length = min(round(seconds * RATE), len(channels[0]) - first)
    frequency = 440 * 2 ** ((pitch - 69) / 12)
    left, right = (1 - pan) ** 0.5, pan ** 0.5
    for i in range(length):
        t = i / RATE
        phase = 2 * pi * frequency * t
        tail = min(1, (length - i) / RATE / 0.06)
        if voice == 'kick':
            sample = sin(2 * pi * (46 * t + 1.7 * (1 - exp(-30 * t)))) * exp(-27 * t)
        elif voice == 'tick':
            sample = (sin(2 * pi * 4891 * t) + sin(2 * pi * 6719 * t) * .55) * exp(-100 * t)
        elif voice == 'pad':
            sample = (sin(phase) + .15 * sin(phase * 2.002)) * min(1, t / .16) * exp(-.35 * t)
        else:
            sample = (sin(phase) + .34 * sin(phase * 2) + .11 * sin(phase * 3)) * min(1, t / .006) * exp(-7 * t)
        value = volume * sample * tail
        channels[0][first + i] += value * left
        channels[1][first + i] += value * right


progression = [(50, 57, 60, 64, 65), (46, 53, 57, 60, 62),
               (53, 60, 64, 67, 69), (48, 55, 58, 62, 64)]
motif = (0, 2, 1, 3, 2, 1, 4, 2)
for bar in range(7):
    chord = progression[bar % len(progression)]
    start = bar * 4 * BEAT
    calm = 3 <= bar < 5
    for i, note in enumerate(chord[1:]):
        synth(start, 2.18, .029, .22 + i * .18, 'pad', note)
    for i, degree in enumerate(motif):
        beat = start + i * BEAT / 2
        if not calm or i % 2 == 0:
            synth(beat, .36, .079 if i % 2 == 0 else .048, .37 + .26 * (i % 2), 'pluck', chord[degree] + 12)
        if i % 4 == 0:
            synth(beat, .43, .13 if calm else .17, .5, 'pluck', chord[0] - 12)
        if not calm and (i == 0 or i == 4):
            synth(beat, .21, .19, .5, 'kick')
        if not calm and i % 2 == 1:
            synth(beat, .067, .029, .68, 'tick')

for i, note in enumerate((50, 57, 62, 65, 69)):
    synth(14 + i * .024, .86, .056, .26 + i * .12, 'pluck', note)
synth(14, .27, .17, .5, 'kick')

dest = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'assets/audio/music.wav'
peak = max(max(abs(sample) for sample in track) for track in channels)
pcm = array('h')
for i, (left, right) in enumerate(zip(*channels)):
    envelope = min(1, i / (RATE * .014), (RATE * DURATION - i - 1) / (RATE * .18))
    gain = 21000 * envelope / peak
    pcm.extend((round(left * gain), round(right * gain)))
if sys.byteorder != 'little':
    pcm.byteswap()
with wave.open(str(dest), 'wb') as result:
    result.setparams((2, 2, RATE, 0, 'NONE', 'not compressed'))
    result.writeframes(pcm.tobytes())
