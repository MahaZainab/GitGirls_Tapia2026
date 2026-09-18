"""Minimal in-memory preferences store. FOUNDATION placeholder for F4 BACKEND.

Not persistent across process restarts and does not distinguish real users
(the whole app has one stubbed user, per `useUser()` / assumption A3). F4
BACKEND should swap this for SQLite-backed per-user storage and implement the
`storage.sync == "device_only"` and delete-preferences (F4-R16) behavior.
"""
from __future__ import annotations

import copy
from datetime import datetime, timezone
from threading import Lock
from typing import Dict

from app.models import DEFAULT_PREFERENCES, UserPreferences


class PreferencesStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._by_user: Dict[str, dict] = {}

    def get(self, user_id: str) -> UserPreferences:
        with self._lock:
            raw = self._by_user.get(user_id)
            if raw is None:
                raw = copy.deepcopy(DEFAULT_PREFERENCES)
                raw["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                self._by_user[user_id] = raw
            return UserPreferences.model_validate(raw)

    def put(self, user_id: str, prefs: UserPreferences) -> UserPreferences:
        data = prefs.model_dump()
        data["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        with self._lock:
            self._by_user[user_id] = data
        return UserPreferences.model_validate(data)

    def delete(self, user_id: str) -> None:
        with self._lock:
            self._by_user.pop(user_id, None)


_store = PreferencesStore()


def get_store() -> PreferencesStore:
    return _store
