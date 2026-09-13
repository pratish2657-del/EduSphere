#!/bin/bash
set -e

export PORT="${PORT:-10000}"
export IDE_BRIDGE_PORT="${IDE_BRIDGE_PORT:-8081}"

mkdir -p /home/coder/workspace

envsubst '${PORT}' < /opt/ide/nginx.conf > /tmp/nginx.conf

exec /usr/bin/supervisord -c /opt/ide/supervisord.conf
