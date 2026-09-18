// The only file in this feature that talks to FOUNDATION-owned code (event bus, motion policy,
// API client, current passage), so a change to those APIs is a one-file fix here.
import { useMotionPolicy } from "@studyshift/ui-tokens";
import type { Anchor, Claim, ClaimList, FlowGraph } from "@studyshift/contracts";
import { apiClient } from "../../shared/apiClient";
import { useCurrentPassage } from "../../shared/currentPassage";
import { eventBus } from "../../shared/eventBus";

export { useMotionPolicy, useCurrentPassage };

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
/** The mock API only serves this fixture; any other passage (pasted text) needs the real backend. */
const MOCK_PASSAGE = "iam-01";

export function emitAnchorReveal(anchor: Anchor): void {
  eventBus.emit("anchor.reveal", { anchor, origin: "flow_node" });
}

export function emitNodeSelected(nodeId: string): void {
  eventBus.emit("flow.node.selected", { node_id: nodeId });
}

async function backend<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    throw new Error("Could not reach the API. Is apps/api running?");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    const message = typeof detail === "string" ? detail : (detail?.message ?? `The API returned ${res.status}.`);
    const problems: string[] = Array.isArray(detail?.problems) ? detail.problems : [];
    throw new Error([message, ...problems].join(" "));
  }
  return (await res.json()) as T;
}

export async function fetchClaims(passageId: string): Promise<Claim[]> {
  if (apiClient.isMockMode && passageId !== MOCK_PASSAGE) {
    return (await backend<ClaimList>(`/api/passages/${encodeURIComponent(passageId)}/claims`)).claims;
  }
  return (await apiClient.getClaims(passageId)).claims;
}

/** The flow for a passage. Pasted text is turned into a flowchart by the backend (no model involved). */
export async function loadFlow(passageId: string): Promise<FlowGraph> {
  if (passageId === MOCK_PASSAGE) return apiClient.getFlow(passageId);
  return backend<FlowGraph>(`/api/passages/${encodeURIComponent(passageId)}/flow/generate`, { method: "POST" });
}
