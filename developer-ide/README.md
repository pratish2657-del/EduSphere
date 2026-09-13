# EduSphere developer-ide

Existing Render `edusphere-ide` service. This image runs code-server and a private file bridge behind nginx.

Render:
- Root Directory: `developer-ide` (when this folder is at repo root)
- Dockerfile: `Dockerfile`
- Persistent disk mount: `/home/coder/workspace`
- Environment:
  - `DEVELOPER_IDE_SHARED_SECRET`
  - `IDE_WORKSPACE_ROOT=/home/coder/workspace`

The public port is Render's `$PORT`.
