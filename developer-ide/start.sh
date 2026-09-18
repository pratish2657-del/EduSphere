#!/bin/bash
set -e

# Render public port
export PORT="${PORT:-10000}"

# Internal services
export IDE_BRIDGE_PORT="${IDE_BRIDGE_PORT:-8081}"
export CODE_SERVER_PORT="8080"

echo "=========================================="
echo "EduSphere Developer IDE"
echo "=========================================="
echo "Public nginx port : ${PORT}"
echo "code-server port  : ${CODE_SERVER_PORT}"
echo "IDE API port      : ${IDE_BRIDGE_PORT}"
echo "=========================================="

mkdir -p \
    /home/coder/workspace \
    /home/coder/.config/code-server \
    /home/coder/.local/share/code-server \
    /home/coder/.cache

chown -R coder:coder \
    /home/coder/workspace \
    /home/coder/.config \
    /home/coder/.local \
    /home/coder/.cache

# Remove stale nginx pid if present
rm -f /run/nginx.pid


# Generate nginx configuration using Render's public port.
envsubst '${PORT}' \
    < /opt/ide/nginx.conf \
    > /tmp/nginx.conf

echo "Starting Supervisor..."
exec /usr/bin/supervisord -c /opt/ide/supervisord.conf