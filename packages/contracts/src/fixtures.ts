/**
 * Typed re-exports of the shared `fixtures/iam-01` bundle (spec appendix A).
 * Feature agents develop against these with no LLM key and no backend
 * beyond the mock API client (rule A-04).
 */
import sourceJson from "../../../fixtures/iam-01/source.json";
import claimsJson from "../../../fixtures/iam-01/claims.json";
import summaryJson from "../../../fixtures/iam-01/summary.json";
import flowJson from "../../../fixtures/iam-01/flow.json";
import animationJson from "../../../fixtures/iam-01/animation.json";
import preferencesRegularJson from "../../../fixtures/iam-01/preferences.regular.json";
import preferencesFocusJson from "../../../fixtures/iam-01/preferences.focus.json";
import focusSessionExampleJson from "../../../fixtures/iam-01/focus-session.example.json";

import type {
  AnimationScript,
  ClaimList,
  FlowGraph,
  FocusSessionState,
  Source,
  SummaryBundle,
  UserPreferences,
} from "./types";

export const iam01Source = sourceJson as Source;
export const iam01Claims = claimsJson as ClaimList;
export const iam01Summary = summaryJson as SummaryBundle;
export const iam01Flow = flowJson as FlowGraph;
export const iam01Animation = animationJson as AnimationScript;
export const iam01PreferencesRegular = preferencesRegularJson as UserPreferences;
export const iam01PreferencesFocus = preferencesFocusJson as UserPreferences;
export const iam01FocusSessionExample = focusSessionExampleJson as FocusSessionState;

export const iam01Bundle = {
  passageId: "iam-01" as const,
  source: iam01Source,
  claims: iam01Claims,
  summary: iam01Summary,
  flow: iam01Flow,
  animation: iam01Animation,
  preferencesRegular: iam01PreferencesRegular,
  preferencesFocus: iam01PreferencesFocus,
};
