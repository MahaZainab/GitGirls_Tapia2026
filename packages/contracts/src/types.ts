/**
 * Hand-authored TypeScript mirror of `schemas/studyshift.schema.json`.
 * FOUNDATION-owned, read-only for feature agents (spec A-02, section 2.5).
 * Field names match the wire format (snake_case) exactly -- do not rename.
 */

export type SentenceId = string; // ^S[0-9]+$
export type ClaimId = string; // ^C[0-9]+$
export type SummaryId = string; // ^M[0-9]+$
export type PointerId = string; // ^P[0-9]+$
export type ExampleId = string; // ^X[0-9]+$
export type NodeId = string; // ^N[0-9]+$
export type EdgeId = string; // ^E[0-9]+$
export type StepId = string; // ^A[0-9]+$

export interface Anchor {
  sentence_id: SentenceId;
  start: number;
  end: number;
  quote: string;
}

export interface Sentence {
  id: SentenceId;
  start: number;
  end: number;
  text: string;
}

export interface Source {
  schema_version: "1.0";
  passage_id: string;
  title: string;
  language: string;
  text: string;
  sentences: Sentence[];
}

export interface Claim {
  id: ClaimId;
  text: string;
  sentence_ids: SentenceId[];
  anchor: Anchor;
  must_keep: string[];
}

export interface ClaimList {
  schema_version: "1.0";
  passage_id: string;
  claims: Claim[];
}

export type CheckLayer = "code" | "auditor" | "human";
export type CheckStatus = "pass" | "warn" | "fail";

export interface Check {
  name: string;
  layer: CheckLayer;
  status: CheckStatus;
  detail: string;
}

export type VerificationStatus = "passed" | "failed" | "needs_human";

export interface VerificationReport {
  status: VerificationStatus;
  checks: Check[];
}

export interface SummarySentence {
  id: SummaryId;
  text: string;
  claim_ids: ClaimId[];
  pointer_ids: PointerId[];
}

export interface Pointer {
  id: PointerId;
  order: number;
  title: string;
  summary: string;
  anchor: Anchor;
  claim_ids: ClaimId[];
}

export type ExampleKind = "analogy" | "worked_example" | "scenario";

export interface Example {
  id: ExampleId;
  kind: ExampleKind;
  title: string;
  body: string;
  related_pointer_ids: PointerId[];
  claim_ids: ClaimId[];
  is_source_content: false;
  derived_numbers: string[];
}

export interface SummaryBundle {
  schema_version: "1.0";
  passage_id: string;
  summary: SummarySentence[];
  pointers: Pointer[];
  examples: Example[];
  verification: VerificationReport;
}

export type FlowNodeKind = "terminal_start" | "terminal_end" | "process" | "decision" | "note";
export type Tone = "neutral" | "positive" | "negative";

export interface FlowNode {
  id: NodeId;
  kind: FlowNodeKind;
  label: string;
  detail?: string;
  tone: Tone;
  claim_ids: ClaimId[];
  anchor?: Anchor;
}

export type EdgeBasis = "stated" | "implied";

export interface FlowEdge {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  label?: string;
  claim_ids: ClaimId[];
  basis: EdgeBasis;
  rationale?: string;
}

export interface FlowGraph {
  schema_version: "1.0";
  passage_id: string;
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  verification: VerificationReport;
}

export interface AnimationStep {
  id: StepId;
  order: number;
  focus_node_ids: NodeId[];
  focus_edge_ids: EdgeId[];
  caption: string;
  claim_ids: ClaimId[];
  anchor?: Anchor;
  suggested_duration_ms: number;
  hypothetical: boolean;
}

export type AnimationKind = "walkthrough" | "scenario";

export interface AnimationScript {
  schema_version: "1.0";
  passage_id: string;
  kind: AnimationKind;
  title: string;
  scenario_premise?: string;
  path_edge_ids: EdgeId[];
  steps: AnimationStep[];
  verification: VerificationReport;
}

export type MotionSetting = "full" | "reduced" | "off";
export type Nudge = "chime" | "visual" | "both" | "none";
export type DuringBreak = "continue" | "pause";
export type SyncSetting = "account" | "device_only";

export interface UserPreferences {
  schema_version: "1.0";
  mode: "regular" | "focus";
  supports: { adhd: boolean; dyslexia: boolean };
  display: {
    text_scale: number;
    motion: MotionSetting;
    line_focus: boolean;
    dyslexia_typography: boolean;
  };
  focus: {
    pomodoro: {
      enabled: boolean;
      visible: boolean;
      allow_peek: boolean;
      work_minutes: number;
      break_minutes: number;
      nudge: Nudge;
    };
    rain: { enabled: boolean; volume: number; during_break: DuringBreak };
    dnd: { enabled: boolean; hold_in_app_notifications: boolean; digest_on_end: boolean };
  };
  storage: { sync: SyncSetting };
  updated_at: string;
}

export type NotificationCategory = "study" | "social" | "reminder" | "system" | "security";

export interface NotificationItem {
  id: string;
  created_at: string;
  category: NotificationCategory;
  title: string;
  body: string;
}

export type FocusSessionPhase = "idle" | "work" | "break" | "ended";

export interface FocusSessionState {
  state: FocusSessionPhase;
  started_at?: string;
  phase_started_at?: string;
  phase_ends_at?: string;
  cycles_completed: number;
  rain_running: boolean;
  dnd_active: boolean;
  queued_notifications: NotificationItem[];
}

export type EventType =
  | "anchor.reveal"
  | "pointer.activated"
  | "flow.node.selected"
  | "animation.step.changed"
  | "prefs.changed"
  | "focus.session.started"
  | "focus.session.phase_changed"
  | "focus.session.ended"
  | "notification.suppressed"
  | "contract.violation";

export interface EventEnvelope<T = Record<string, unknown>> {
  type: EventType;
  at: string;
  payload: T;
}

export type FeatureId = "F1" | "F2" | "F3" | "F4";
export type Track = "UI" | "GEN" | "BACKEND" | "BOTH";

export interface CompletionReport {
  feature_id: FeatureId;
  track: Track;
  status: "complete" | "partial" | "blocked";
  files_changed: string[];
  requirements: Array<{
    id: string;
    status: "met" | "partial" | "not_met";
    evidence: string;
  }>;
  tests: { added: number; passing: number };
  contract_change_requests: string[];
  assumptions: string[];
  known_issues: string[];
}
