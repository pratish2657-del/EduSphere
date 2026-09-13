# Existing EduSphere developer-ide — two-way workspace bridge

This replaces the existing `developer-ide` contents. It keeps code-server and adds a secure file bridge in the same Render service.

## Render
Keep the existing service named `edusphere-ide`; do NOT create a second service.

Runtime:
- Docker
- Dockerfile: `developer-ide/Dockerfile` if this folder is at repository root
- If Root Directory is `developer-ide`, use `Dockerfile`

Environment:
- `DEVELOPER_IDE_SHARED_SECRET` = long random secret (must also be configured on the EduSphere backend)
- `IDE_WORKSPACE_ROOT=/home/coder/workspace`

Persistent disk:
- Mount path: `/home/coder/workspace`

The public Render port is supplied through `$PORT`. nginx exposes code-server and the bridge from the same service:
- `/` -> code-server
- `/healthz` -> bridge health
- `/api/files/...` -> bridge

Bridge authentication:
`Authorization: Bearer <DEVELOPER_IDE_SHARED_SECRET>` or `X-IDE-Secret`.

Do not expose the bridge without the secret.
