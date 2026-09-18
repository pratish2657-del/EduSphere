FROM debian:bookworm-slim

USER root

ENV DEBIAN_FRONTEND=noninteractive

# ------------------------------------------------------------
# System packages
# ------------------------------------------------------------
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        nginx \
        supervisor \
        python3 \
        python3-venv \
        gettext-base \
        git \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------
# Install code-server
# ------------------------------------------------------------
RUN curl -fsSL https://code-server.dev/install.sh | sh

# ------------------------------------------------------------
# IDE directory
# ------------------------------------------------------------
WORKDIR /opt/ide

COPY requirements.txt /opt/ide/requirements.txt

# ------------------------------------------------------------
# Python environment
# ------------------------------------------------------------
RUN python3 -m venv /opt/ide/venv \
    && /opt/ide/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/ide/venv/bin/pip install --no-cache-dir -r /opt/ide/requirements.txt

# ------------------------------------------------------------
# Application files
# ------------------------------------------------------------
COPY start.sh /usr/local/bin/start.sh
COPY supervisord.conf /opt/ide/supervisord.conf
COPY nginx.conf /opt/ide/nginx.conf
COPY ide_api.py /opt/ide/ide_api.py

RUN chmod +x /usr/local/bin/start.sh \
    && mkdir -p \
        /home/coder/workspace \
        /home/coder/.config/code-server \
        /home/coder/.local/share/code-server \
        /home/coder/.cache \
    && useradd -m -s /bin/bash coder \
    && chown -R coder:coder \
        /home/coder \
        /opt/ide

# ------------------------------------------------------------
# Environment
# ------------------------------------------------------------
ENV HOME=/home/coder
ENV USER=coder
ENV IDE_WORKSPACE_ROOT=/home/coder/workspace
ENV IDE_BRIDGE_PORT=8081
ENV CODE_SERVER_PORT=8080

# Render public port
EXPOSE 10000

# ------------------------------------------------------------
# ONLY startup process
# ------------------------------------------------------------
ENTRYPOINT ["/usr/local/bin/start.sh"]