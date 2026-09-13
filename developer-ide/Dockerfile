FROM codercom/code-server:latest

USER root

RUN mkdir -p /home/coder/workspace \
    && chown -R coder:coder /home/coder/workspace

COPY start.sh /usr/local/bin/start-ide.sh

RUN chmod +x /usr/local/bin/start-ide.sh

USER coder

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/start-ide.sh"]