"""
Database configuration and session management.
Uses SQLAlchemy with async support for SQLite (PostgreSQL-compatible design).
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/script_writer.db")

# For SQLite, we need special handling
if DATABASE_URL.startswith("sqlite"):
    # SQLite-specific: use StaticPool for thread safety
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
else:
    # PostgreSQL or other databases
    engine = create_engine(DATABASE_URL, echo=False)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency to get database session.
    Use in FastAPI endpoints: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database tables.
    Called on application startup.
    """
    from app.models import db_models  # Import models to register them
    
    # Create data directory if using SQLite
    if DATABASE_URL.startswith("sqlite"):
        import pathlib
        db_path = DATABASE_URL.replace("sqlite:///", "")
        if db_path.startswith("./"):
            db_path = db_path[2:]
        pathlib.Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    
    Base.metadata.create_all(bind=engine)
