"""Check a summary while writing it:  python -m app.generators.flow iam-01   (run from apps/api)."""
import json
import sys

from app.store import get_store

from .generator import FlowTxtError, flow_from_txt
from .router import summaries_dir

if len(sys.argv) != 2:
    raise SystemExit(__doc__)
pid = sys.argv[1]
store = get_store()
source, claims = store.sources.get(pid), store.claims.get(pid)
if source is None or claims is None:
    raise SystemExit(f"No source and claims for passage '{pid}'.")
try:
    flow = flow_from_txt((summaries_dir() / f"{pid}.txt").read_text(encoding="utf-8"),
                         source.model_dump(by_alias=True), claims.model_dump(by_alias=True))
except FlowTxtError as exc:
    raise SystemExit("\n".join(exc.problems))
print(json.dumps(flow, indent=2))
print(f"status: {flow['verification']['status']}", file=sys.stderr)
