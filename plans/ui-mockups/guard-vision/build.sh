#!/bin/sh
# Concatenates src/* into the single deliverable index.html (cats/props/core are copied from cozy-stage, sim is pure JS shared with sim-check.mjs)
cd "$(dirname "$0")"
cat src/00-head.html src/05-sim.js src/10-core.js src/22-robot-legs.js src/21-cats.js src/30-props.js src/60-scene.js src/70-app.js > index.html
