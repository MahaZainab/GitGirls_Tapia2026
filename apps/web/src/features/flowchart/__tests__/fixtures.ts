import { iam01Bundle, type FlowGraph } from "@studyshift/contracts";

export const iamFlow: FlowGraph = iam01Bundle.flow;
export const iamClaims = iam01Bundle.claims.claims;

export function cloneFlow(): FlowGraph {
  return structuredClone(iamFlow);
}
