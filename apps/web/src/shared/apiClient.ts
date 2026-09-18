/**
 * API client (spec section 2.2, 2.6, 3.2). FOUNDATION-owned, read-only for
 * feature agents (A-02). Has a mock mode that serves `fixtures/iam-01`
 * directly with no network call, which is what feature agents should
 * develop against (rule A-04: run with no LLM key and no backend beyond the
 * mock API). Set `VITE_MOCK_API=false` to hit a real running `apps/api`
 * instead.
 */
import {
  iam01Bundle,
  type AnimationScript,
  type ClaimList,
  type FlowGraph,
  type Source,
  type SummaryBundle,
  type UserPreferences,
} from "@studyshift/contracts";
import { checkContract } from "./contractCheck";

const MOCK_MODE = import.meta.env.VITE_MOCK_API !== "false";
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(`${init?.method ?? "GET"} ${path} -> ${res.status}: ${body}`, res.status);
  }
  return res.json() as Promise<T>;
}

export interface JobStatus {
  status: "queued" | "running" | "done" | "failed";
  stage: string;
  error: string | null;
}

export interface IngestResult {
  passage_id: string;
  job_id: string;
  job: JobStatus;
}

function mockOnly<T>(passageId: string, value: T, what: string): T {
  if (passageId !== "iam-01") {
    throw new ApiError(
      `mock API only serves passage_id "iam-01"; "${passageId}" has no ${what}. ` +
        `Feature agents develop against fixtures/iam-01 (rule A-04).`,
      404,
    );
  }
  return value;
}

let mockPreferences: UserPreferences = { ...iam01Bundle.preferencesRegular };

export const apiClient = {
  isMockMode: MOCK_MODE,

  async createPassage(title: string, text: string): Promise<{ passage_id: string; job_id: string }> {
    if (MOCK_MODE) {
      throw new ApiError("createPassage is not available in mock mode", 501);
    }
    return request("/api/passages", { method: "POST", body: JSON.stringify({ title, text }) });
  },

  async getJob(jobId: string): Promise<JobStatus> {
    if (MOCK_MODE) throw new ApiError("getJob is not available in mock mode", 501);
    return request(`/api/jobs/${jobId}`);
  },

  /**
   * Add material (spec section 6, G5): pasted text, a link, or a PDF file.
   * Always hits the real backend at `${VITE_API_BASE_URL}` -- there is no
   * mock-mode equivalent, since arbitrary ingestion needs real segmenting
   * (and PDF/URL extraction) rather than a canned fixture.
   */
  async ingestMaterial(form: FormData): Promise<IngestResult> {
    const res = await fetch(`${BASE_URL}/api/materials`, { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ApiError(`POST /api/materials -> ${res.status}: ${body}`, res.status);
    }
    return res.json();
  },

  async getSource(passageId: string): Promise<Source> {
    if (MOCK_MODE) return mockOnly(passageId, iam01Bundle.source, "source");
    const data = await request<Source>(`/api/passages/${passageId}/source`);
    checkContract("Source", data, "apiClient.getSource");
    return data;
  },

  async getClaims(passageId: string): Promise<ClaimList> {
    if (MOCK_MODE) return mockOnly(passageId, iam01Bundle.claims, "claims");
    const data = await request<ClaimList>(`/api/passages/${passageId}/claims`);
    checkContract("ClaimList", data, "apiClient.getClaims");
    return data;
  },

  async getSummary(passageId: string): Promise<SummaryBundle> {
    if (MOCK_MODE) return mockOnly(passageId, iam01Bundle.summary, "summary");
    const data = await request<SummaryBundle>(`/api/passages/${passageId}/summary`);
    checkContract("SummaryBundle", data, "apiClient.getSummary");
    return data;
  },

  async getFlow(passageId: string): Promise<FlowGraph> {
    if (MOCK_MODE) return mockOnly(passageId, iam01Bundle.flow, "flow");
    const data = await request<FlowGraph>(`/api/passages/${passageId}/flow`);
    checkContract("FlowGraph", data, "apiClient.getFlow");
    return data;
  },

  async getAnimation(passageId: string): Promise<AnimationScript> {
    if (MOCK_MODE) return mockOnly(passageId, iam01Bundle.animation, "animation");
    const data = await request<AnimationScript>(`/api/passages/${passageId}/animation`);
    checkContract("AnimationScript", data, "apiClient.getAnimation");
    return data;
  },

  async getPreferences(): Promise<UserPreferences> {
    if (MOCK_MODE) return { ...mockPreferences };
    const data = await request<UserPreferences>("/api/me/preferences");
    checkContract("UserPreferences", data, "apiClient.getPreferences");
    return data;
  },

  async putPreferences(prefs: UserPreferences): Promise<UserPreferences> {
    if (MOCK_MODE) {
      mockPreferences = { ...prefs, updated_at: new Date().toISOString() };
      return { ...mockPreferences };
    }
    const data = await request<UserPreferences>("/api/me/preferences", {
      method: "PUT",
      body: JSON.stringify(prefs),
    });
    checkContract("UserPreferences", data, "apiClient.putPreferences");
    return data;
  },
};
