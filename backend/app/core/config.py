from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Agency Task Platform"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    secret_key: str = Field(default="change-me-in-production")
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14
    database_url: str = "postgresql+psycopg://postgres:postgres@postgres:5432/agency_tasks"
    cors_origins: str = "http://localhost:3000"

    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "task-attachments"
    minio_secure: bool = False
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_bucket: str | None = None
    s3_region: str = "auto"
    storage_auto_create_bucket: bool = True
    max_upload_size_mb: int = 50
    storage_backend: str = "s3"
    local_upload_dir: str = "local_uploads"
    backend_public_url: str = "http://localhost:8000"

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return "postgresql+psycopg://" + value.removeprefix("postgres://")
        if value.startswith("postgresql://"):
            return "postgresql+psycopg://" + value.removeprefix("postgresql://")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def object_storage_endpoint_url(self) -> str:
        if self.s3_endpoint_url:
            return self.s3_endpoint_url.rstrip("/")
        endpoint = self.minio_endpoint.rstrip("/")
        if endpoint.startswith(("http://", "https://")):
            return endpoint
        return ("https://" if self.minio_secure else "http://") + endpoint

    @property
    def object_storage_access_key(self) -> str:
        return self.s3_access_key_id or self.minio_access_key

    @property
    def object_storage_secret_key(self) -> str:
        return self.s3_secret_access_key or self.minio_secret_key

    @property
    def object_storage_bucket(self) -> str:
        return self.s3_bucket or self.minio_bucket


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
