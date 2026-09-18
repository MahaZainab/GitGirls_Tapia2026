"""F3 GEN owns this package. Do not implement from FOUNDATION or another track.

Expected interface (spec section 2.2, F3 GEN requirements F3-G01..F3-G05):

    def generate_animation(source: Source, claims: ClaimList, flow: FlowGraph) -> AnimationScript: ...

Wire it into `app.main` at `GET /api/passages/{id}/animation`, running the
result through `app.pipeline.verifier.verify_bundle` and repairing up to 2
rounds.

Until this is implemented, the endpoint serves the `fixtures/iam-01` bundle
for `passage_id == "iam-01"` and 404s otherwise.
"""
raise NotImplementedError(
    "F3 GEN: implement generate_animation() here. See "
    "agent-documents/StudyShift_Agent_Spec.md section 5, F3 GEN requirements."
)
