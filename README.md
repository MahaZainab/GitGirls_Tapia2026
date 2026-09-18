# Git Girl Hackathon

## StudyShift

Full spec: [`agent-documents/StudyShift_Agent_Spec.md`](agent-documents/StudyShift_Agent_Spec.md).

This repo currently has the **FOUNDATION** layer (spec section 2.6): repo
scaffold, contracts, design tokens, event bus, mock-mode API client, a
runnable backend, and an app shell with one empty slot per feature. F1-F4 are
still placeholders -- see the "not yet implemented" note in each of
`apps/web/src/features/*/index.tsx`.

### Layout

```
schemas/                 studyshift.schema.json (source of truth)
fixtures/iam-01/          shared fixture bundle
tools/                    validate_bundle.py + its own test suite
packages/contracts/       generated-by-hand TS types, schema, fixtures (read-only for features)
packages/ui-tokens/       themes, motion tokens, useMotionPolicy (read-only for features)
apps/web/src/shared/      event bus, API client (mock mode), a11y helpers, useUser stub (read-only)
apps/web/src/features/*/  F1-F4 UI slots (placeholders -- one agent per feature)
apps/api/app/pipeline/    segmenter (real) + verifier (wraps tools/validate_bundle.py) + claims (needs an LLM)
apps/api/app/generators/  F1/F2/F3 GEN stubs -- each raises NotImplementedError with what to build
apps/api/app/preferences/ F4 BACKEND -- FOUNDATION ships a working in-memory default to replace
```

### Run it

Backend:

```
pip install -r apps/api/requirements.txt
cd apps/api && uvicorn app.main:app --reload --port 8000
```

Frontend (needs Node.js 20+; defaults to mock mode, so the backend above is optional):

```
npm install
npm run dev
```

Tests:

```
npm run test:web     # frontend (vitest)
npm run test:api     # backend (pytest)
python tools/validate_bundle.py fixtures/iam-01   # reference verifier against the fixture
```

### Rules for feature agents

Read `agent-documents/StudyShift_Agent_Spec.md` section 0 first. In short:
implement only your assigned `F1`-`F4` feature and track, edit only your
feature's directories, treat `packages/contracts` and `packages/ui-tokens` as
read-only, and develop against `fixtures/iam-01` (no LLM key needed).
