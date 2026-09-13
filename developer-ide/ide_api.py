#!/usr/bin/env python3
import os
import re
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

WORKSPACE_ROOT = Path(os.getenv("IDE_WORKSPACE_ROOT", "/home/coder/workspace")).resolve()
SHARED_SECRET = os.getenv("DEVELOPER_IDE_SHARED_SECRET", "").strip()
MAX_FILE_SIZE = 2 * 1024 * 1024
SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")

app = FastAPI(title="EduSphere Developer IDE Bridge")


class FileItem(BaseModel):
    filename: str = Field(min_length=1, max_length=128)
    content: str = ""


def authorize(authorization: str | None, x_ide_secret: str | None) -> None:
    if not SHARED_SECRET:
        raise HTTPException(500, "IDE shared secret is not configured")
    token = x_ide_secret or ""
    if not token and authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer":
            token = value
    if token != SHARED_SECRET:
        raise HTTPException(401, "Invalid IDE credentials")


def safe_filename(filename: str) -> str:
    filename = (filename or "").strip()
    if not SAFE_NAME.fullmatch(filename):
        raise HTTPException(400, "Invalid filename")
    if Path(filename).name != filename:
        raise HTTPException(400, "Nested paths are not allowed")
    return filename


def developer_dir(developer_id: int) -> Path:
    if developer_id <= 0:
        raise HTTPException(400, "Invalid developer ID")
    path = (WORKSPACE_ROOT / str(developer_id)).resolve()
    if path.parent != WORKSPACE_ROOT:
        raise HTTPException(400, "Invalid workspace")
    path.mkdir(parents=True, exist_ok=True)
    return path


def file_path(developer_id: int, filename: str) -> Path:
    directory = developer_dir(developer_id)
    path = (directory / safe_filename(filename)).resolve()
    if path.parent != directory:
        raise HTTPException(400, "Invalid file path")
    return path


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "edusphere-ide"}


@app.get("/api/files/{developer_id}")
def list_files(
    developer_id: int,
    authorization: str | None = Header(default=None),
    x_ide_secret: str | None = Header(default=None),
):
    authorize(authorization, x_ide_secret)
    directory = developer_dir(developer_id)
    result = []
    for path in sorted(directory.iterdir(), key=lambda p: p.name.lower()):
        if not path.is_file():
            continue
        try:
            size = path.stat().st_size
            if size > MAX_FILE_SIZE:
                continue
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        result.append({"filename": path.name, "content": content, "size": size})
    return {"developer_id": developer_id, "files": result}


@app.put("/api/files/{developer_id}/{filename}")
def write_file(
    developer_id: int,
    filename: str,
    body: FileItem,
    authorization: str | None = Header(default=None),
    x_ide_secret: str | None = Header(default=None),
):
    authorize(authorization, x_ide_secret)
    content = body.content or ""
    size = len(content.encode("utf-8"))
    if size > MAX_FILE_SIZE:
        raise HTTPException(400, "File exceeds the 2 MB limit")
    path = file_path(developer_id, filename)
    path.write_text(content, encoding="utf-8", newline="")
    return {"message": "File written", "filename": path.name, "size": size}


@app.delete("/api/files/{developer_id}/{filename}")
def remove_file(
    developer_id: int,
    filename: str,
    authorization: str | None = Header(default=None),
    x_ide_secret: str | None = Header(default=None),
):
    authorize(authorization, x_ide_secret)
    path = file_path(developer_id, filename)
    try:
        path.unlink()
    except FileNotFoundError:
        pass
    return {"message": "File deleted", "filename": path.name}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8081")))
