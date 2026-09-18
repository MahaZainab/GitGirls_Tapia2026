import copy
import json
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[4]
FIXTURES = REPO / "fixtures" / "iam-01"
SCHEMA = REPO / "schemas" / "studyshift.schema.json"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.fixture
def source() -> dict:
    return _load("source.json")


@pytest.fixture
def claim_list() -> dict:
    return _load("claims.json")


@pytest.fixture
def fixture_flow() -> dict:
    return _load("flow.json")


@pytest.fixture
def flow(fixture_flow) -> dict:
    return copy.deepcopy(fixture_flow)


@pytest.fixture
def schema() -> dict:
    return json.loads(SCHEMA.read_text(encoding="utf-8"))
