import mimetypes
import uuid
from pathlib import Path
from urllib.parse import quote

import boto3
from botocore.client import Config
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

ALLOWED_EXTENSIONS = {
    ".doc",
    ".docx",
    ".gif",
    ".jpeg",
    ".jpg",
    ".pdf",
    ".png",
    ".ppt",
    ".pptx",
    ".txt",
    ".webp",
    ".xls",
    ".xlsx",
    ".zip",
}


class StorageService:
    def __init__(self) -> None:
        self.local_root = Path(settings.local_upload_dir)
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.object_storage_endpoint_url,
            aws_access_key_id=settings.object_storage_access_key,
            aws_secret_access_key=settings.object_storage_secret_key,
            config=Config(signature_version="s3v4"),
            region_name=settings.s3_region,
        )

    def ensure_bucket(self) -> None:
        if settings.storage_backend == "local":
            self.local_root.mkdir(parents=True, exist_ok=True)
            return
        if not settings.storage_auto_create_bucket:
            return
        buckets = self.client.list_buckets().get("Buckets", [])
        if not any(bucket["Name"] == settings.object_storage_bucket for bucket in buckets):
            self.client.create_bucket(Bucket=settings.object_storage_bucket)

    async def upload(self, file: UploadFile, task_id) -> tuple[str, str, int, str | None]:
        extension = Path(file.filename or "").suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="File type is not allowed")

        content = await file.read()
        max_size = settings.max_upload_size_mb * 1024 * 1024
        if len(content) > max_size:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File is too large")

        content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0]
        object_key = f"tasks/{task_id}/{uuid.uuid4()}{extension}"
        self.ensure_bucket()
        if settings.storage_backend == "local":
            path = self.local_root / object_key
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            return object_key, self.presigned_url(object_key), len(content), content_type

        self.client.put_object(
            Bucket=settings.object_storage_bucket,
            Key=object_key,
            Body=content,
            ContentType=content_type or "application/octet-stream",
        )
        return object_key, self.presigned_url(object_key), len(content), content_type

    def presigned_url(self, object_key: str, expires_in: int = 900) -> str:
        if settings.storage_backend == "local":
            return f"{settings.backend_public_url.rstrip('/')}/uploads/{quote(object_key)}"
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.object_storage_bucket, "Key": object_key},
            ExpiresIn=expires_in,
        )

    def delete(self, object_key: str) -> None:
        if settings.storage_backend == "local":
            path = self.local_root / object_key
            if path.exists():
                path.unlink()
            return
        self.client.delete_object(Bucket=settings.object_storage_bucket, Key=object_key)


storage_service = StorageService()
