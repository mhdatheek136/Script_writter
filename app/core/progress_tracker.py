import logging
from typing import Dict, Any, Optional
import time

logger = logging.getLogger(__name__)

class ProgressStore:
    """
    Thread-safe in-memory store for session progress updates.
    In a multi-process environment (e.g. gunicorn with multiple workers), 
    this should be replaced by Redis or a database.
    """
    _instance = None
    _store: Dict[str, Dict[str, Any]] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ProgressStore, cls).__new__(cls)
            cls._store = {}
        return cls._instance

    def update(self, session_id: str, status: str, percentage: int, details: Optional[str] = None):
        """Update progress for a session."""
        self._store[session_id] = {
            "status": status,
            "percentage": percentage,
            "details": details,
            "timestamp": time.time()
        }
        logger.info(f"[Progress] {session_id}: {percentage}% - {status} ({details or ''})")

    def get(self, session_id: str) -> Dict[str, Any]:
        """Get progress for a session."""
        return self._store.get(session_id, {
            "status": "unknown", 
            "percentage": 0, 
            "details": "Session not found"
        })

    def clear(self, session_id: str):
        """Clear session progress."""
        if session_id in self._store:
            del self._store[session_id]
