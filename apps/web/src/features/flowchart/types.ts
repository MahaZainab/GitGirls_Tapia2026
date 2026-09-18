// Contract types come from @studyshift/contracts; only F2-local prop types are defined here.
import type { Claim, FlowGraph } from "@studyshift/contracts";

export type {
  Anchor,
  Check,
  Claim,
  ClaimList,
  FlowEdge,
  FlowGraph,
  FlowNode,
  FlowNodeKind as NodeKind,
  Tone,
  VerificationReport,
} from "@studyshift/contracts";

export interface FlowHighlight {
  nodeIds: string[];
  edgeIds: string[];
}

export interface FlowchartViewProps {
  graph: FlowGraph;
  /** Set by F3 (animation) or by a parent that mirrors selection. */
  highlight?: FlowHighlight;
  onNodeSelect?: (nodeId: string) => void;
  /**
   * Optional. Cited claims, so the detail panel can show their text. When omitted, the view
   * fetches them through the shared API client. Additive to the spec 3.4 interface.
   */
  claims?: Claim[];
  /** Set true to show the verification banner (spec section 4). Off by default. */
  showVerification?: boolean;
}

