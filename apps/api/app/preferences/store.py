"""In-memory preferences store (F4 BACKEND).

Not persistent across process restarts and does not distinguish real users
(the whole app has one stubbed user, per `useUser()` / assumption A3).
Honors F4-R15: when `storage.sync == "device_only"`, `put()` does not persist
server-side -- it only remembers that the user opted for device-only sync,
and hands the validated payload straight back so the client keeps the source
of truth in its own local storage.
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
        self._device_only_users: set[str] = set()

    def get(self, user_id: str) -> UserPreferences:
        with self._lock:
            if user_id in self._device_only_users and user_id not in self._by_user:
                raw = copy.deepcopy(DEFAULT_PREFERENCES)
                raw["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                return UserPreferences.model_validate(raw)
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
            if prefs.storage.sync == "device_only":
                self._device_only_users.add(user_id)
                self._by_user.pop(user_id, None)
                return UserPreferences.model_validate(data)
            self._device_only_users.discard(user_id)
            self._by_user[user_id] = data
        return UserPreferences.model_validate(data)

    def delete(self, user_id: str) -> None:
        with self._lock:
            self._by_user.pop(user_id, None)
            self._device_only_users.discard(user_id)


_store = PreferencesStore()


def get_store() -> PreferencesStore:
    return _store
