from app import models  # noqa: F401
from app.db.base import Base
from app.db.session import engine
from app.seed import seed_admin


def setup() -> None:
    Base.metadata.create_all(bind=engine)
    seed_admin()


if __name__ == "__main__":
    setup()
