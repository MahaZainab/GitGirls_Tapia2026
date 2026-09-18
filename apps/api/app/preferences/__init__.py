"""F4 BACKEND owns this package (spec section 2.5, requirement F4-R15/F4-R16).

FOUNDATION ships a minimal in-memory store (`store.py`) so `GET`/`PUT
/api/me/preferences` work out of the box for integration testing. F4 BACKEND
is expected to replace it with real per-user persistence (SQLite per section
2.4), honor `storage.sync == "device_only"` by not persisting server-side, and
add a way to delete stored preferences (F4-R16).
"""
from app.preferences.store import PreferencesStore, get_store

__all__ = ["PreferencesStore", "get_store"]
