#!/bin/sh
# Vite dev server with a Node that rolldown supports (>= 22). The desktop launcher runs this from .claude/launch.json.
export PATH="/Users/macbookpro/.nvm/versions/node/v24.22.0/bin:$PATH"
cd "$(dirname "$0")/../frontend" || exit 1
exec node node_modules/vite/bin/vite.js
