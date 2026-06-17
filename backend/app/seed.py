import os

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User, UserRole


def seed_admin() -> None:
    email = os.getenv("ADMIN_EMAIL", "admin@example.com").lower()
    password = os.getenv("ADMIN_PASSWORD", "ChangeMe123!")
    name = os.getenv("ADMIN_NAME", "Platform Administrator")

    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            return
        db.add(User(name=name, email=email, password_hash=hash_password(password), role=UserRole.admin))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
