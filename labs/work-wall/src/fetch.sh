#!/bin/bash
cd "$(dirname "$0")"
while read rel asset; do
  id=${asset%.mp4}
  [ -f video/$id.mp4 ] && continue
  for i in 1 2 3 4 5; do curl -sSfL -o tmp.mp4 "https://github.com/guanmo-ai/design-style/releases/download/$rel/$asset" && break; sleep $((i*8)); done; sleep 3
  ffmpeg -loglevel error -y -i tmp.mp4 -vf scale=960:540,fps=30 -an -c:v libx264 -crf 20 -preset fast video/$id.mp4
  case $id in 025-plush|023-liquid-chrome|022-point-cloud|003-constructivism|026-art-nouveau|004-memphis) mv tmp.mp4 full/$id.mp4;; *) rm -f tmp.mp4;; esac
  echo done $id
done < releases.txt
echo ALLDONE
