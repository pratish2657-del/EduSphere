#!/bin/bash

set -e

PORT="${PORT:-8080}"

mkdir -p /home/coder/workspace

exec code-server \
  --bind-addr "0.0.0.0:${PORT}" \
  --auth none \
  --disable-telemetry \
  /home/coder/workspace