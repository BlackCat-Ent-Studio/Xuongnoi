#!/bin/sh
# Builds the single deliverable index.html: shared three.js props/robots come straight from the approved cozy-stage sources.
cd "$(dirname "$0")"
C=../cozy-stage/src
{
  cat src/00-head.html
  cat $C/10-core.js $C/20-robots.js $C/21-cats.js $C/30-props.js
  cat src/60-sim.js src/70-stage.js src/80-app.js
  printf '</script>\n</body>\n</html>\n'
} > index.html
