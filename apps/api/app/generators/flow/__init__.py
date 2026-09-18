"""F2 GEN owns this package. Do not implement from FOUNDATION or another track.

Expected interface (spec section 2.2, F2 GEN requirements F2-G01..F2-G06):

    def generate_flow(source: Source, claims: ClaimList, max_nodes: int | None = None) -> FlowGraph: ...

Wire it into `app.main` at `GET /api/passages/{id}/flow`, running the result
through `app.pipeline.verifier.verify_bundle` and repairing up to 2 rounds.

Until this is implemented, the endpoint serves the `fixtures/iam-01` bundle
for `passage_id == "iam-01"` and 404s otherwise.
"""
raise NotImplementedError(
    "F2 GEN: implement generate_flow() here. See "
    "agent-documents/StudyShift_Agent_Spec.md section 5, F2 GEN requirements."
)
