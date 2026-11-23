#!/bin/sh
# Concatenates src/* into the single deliverable index.html
cd "$(dirname "$0")"
cat src/00-head.html src/10-core.js src/20-robots.js src/21-cats.js src/30-props.js src/40-scenes.js src/50-app.js > index.html
