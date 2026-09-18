FROM codercom/code-server:4.137.0

USER root

# install nginx, supervisor, python, etc.
# ...

COPY start.sh /usr/local/bin/start.sh
COPY supervisord.conf /opt/ide/supervisord.conf
COPY nginx.conf /opt/ide/nginx.conf
COPY ide_api.py /opt/ide/ide_api.py

RUN chmod +x /usr/local/bin/start.sh

EXPOSE 10000

ENTRYPOINT ["/usr/local/bin/start.sh"]