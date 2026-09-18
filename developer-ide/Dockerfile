FROM codercom/code-server:4.137.0

USER root

# Install required system packages
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        nginx \
        supervisor \
        python3 \
        python3-venv \
        gettext-base \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/ide

# Python environment
COPY requirements.txt /opt/ide/requirements.txt

RUN python3 -m venv /opt/ide/venv \
    && /opt/ide/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/ide/venv/bin/pip install --no-cache-dir -r /opt/ide/requirements.txt

# IDE files
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
    && chown -R coder:coder \
        /home/coder/workspace \
        /home/coder/.config \
        /home/coder/.local \
        /home/coder/.cache \
        /opt/ide

ENV IDE_WORKSPACE_ROOT=/home/coder/workspace
ENV IDE_BRIDGE_PORT=8081
ENV CODE_SERVER_PORT=8080

EXPOSE 10000

ENTRYPOINT ["/usr/local/bin/start.sh"]