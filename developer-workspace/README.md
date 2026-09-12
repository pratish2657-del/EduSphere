# EduSphere Developer Workspace — real VS Code workbench

This patch replaces the fake Monaco extension panel with a real browser-hosted VS Code workbench powered by code-server.

## Local development

From the EduSphere root:

```powershell
docker compose -f docker-compose.developer-workspace.yml up -d
```

The IDE is available at:

```text
http://127.0.0.1:8443
```

Then start the EduSphere frontend normally:

```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

The Developer Workspace page embeds the IDE at `VITE_DEVELOPER_IDE_URL` when set, otherwise `http://127.0.0.1:8443`.

## Workspace isolation

The container sees only `./developer-workspaces`. It does **not** mount the EduSphere source tree, backend source, database files, `.env`, or secrets.

This compose file is a local-development implementation. For multi-user production deployment, run one isolated IDE workspace/container per verified Developer and authenticate/proxy it through the EduSphere backend rather than exposing one shared IDE container.

## Extensions

The workbench has a real VS Code-compatible Extensions view and supports extension installation from its configured extension gallery (Open VSX in code-server), plus VSIX installation where supported. It is not a Microsoft Marketplace client; Microsoft's Marketplace terms restrict non-Microsoft VS Code distributions from using that marketplace.
