FROM codercom/code-server:latest

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv nginx gettext-base supervisor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/ide

COPY requirements.txt /opt/ide/requirements.txt

RUN python3 -m venv /opt/ide/venv \
    && /opt/ide/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/ide/venv/bin/pip install --no-cache-dir -r /opt/ide/requirements.txt

COPY ide_api.py /opt/ide/ide_api.py
COPY nginx.conf /opt/ide/nginx.conf
COPY supervisord.conf /opt/ide/supervisord.conf
COPY start.sh /usr/local/bin/start.sh

RUN chmod +x /usr/local/bin/start.sh \
    && mkdir -p /home/coder/workspace \
    && chown -R coder:coder /home/coder/workspace /opt/ide

ENV IDE_WORKSPACE_ROOT=/home/coder/workspace
ENV IDE_BRIDGE_PORT=8081

EXPOSE 10000

ENTRYPOINT ["/usr/local/bin/start.sh"]
