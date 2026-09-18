"""F1 GEN owns this package. Do not implement from FOUNDATION or another track.

Expected interface (spec section 2.2, F1 GEN requirements F1-G01..F1-G06):

    def generate_summary(source: Source, claims: ClaimList) -> SummaryBundle: ...

Wire it into `app.main` at `GET /api/passages/{id}/summary`, running the
result through `app.pipeline.verifier.verify_bundle` and repairing (re-prompting
with the verifier's complaints) up to 2 rounds before giving up with
`verification.status in {"failed", "needs_human"}`.

Until this is implemented, the endpoint serves the `fixtures/iam-01` bundle
for `passage_id == "iam-01"` and 404s otherwise.
"""
raise NotImplementedError(
    "F1 GEN: implement generate_summary() here. See "
    "agent-documents/StudyShift_Agent_Spec.md section 5, F1 GEN requirements."
)
