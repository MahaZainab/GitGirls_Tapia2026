/**
 * F1 UI placeholder. This directory belongs to the F1 agent (spec section
 * 2.5, rule A-02) -- replace this file with `SummaryPanel` and `SourcePane`
 * per spec section 5, F1. It implements none of F1's actual requirements.
 */
import { useState } from "react";
import useEffectCheatSheet from "../../assets/useEffect.png";
import useEffectSummaryData from "../../assets/summary.json";

// Ad hoc shape of assets/summary.json -- not the contract SummaryBundle type
// (spec section 3.1). This is arbitrary reference content dropped in for the
// placeholder, not F1's real, anchor-cited summary/pointers output.
interface AdHocSummaryDoc {
  source: {
    title: string;
    url: string;
    preview_image?: string;
    react_version_on_page?: string;
    retrieved_on?: string;
  };
  summary: {
    one_line: string;
    signature?: string;
    overview: string;
  };
  points: Array<{
    id: number;
    title: string;
    summary: string;
    section?: string;
    source_url: string;
  }>;
}

const useEffectSummary = useEffectSummaryData as AdHocSummaryDoc;

type ViewMode = "summary" | "points";

export default function SummaryFeaturePlaceholder() {
  const [viewMode, setViewMode] = useState<ViewMode>("summary"); // default is Summary (mirrors F1-R01)

  return (
    <section aria-label="Summary (F1, not yet implemented)">
      <h2>F1: Summary, examples and pointers</h2>
      <article aria-label={useEffectSummary.summary.one_line}>
        <h3>
          <a href={useEffectSummary.source.url} target="_blank" rel="noreferrer">
            {useEffectSummary.source.title}
          </a>
        </h3>
        <p>{useEffectSummary.summary.one_line}</p>

        <div role="group" aria-label="View" style={{ display: "flex", gap: "0.5rem", margin: "0.75rem 0" }}>
          <button
            type="button"
            aria-pressed={viewMode === "summary"}
            onClick={() => setViewMode("summary")}
            style={{
              minHeight: 44,
              minWidth: 44,
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--line)",
              background: viewMode === "summary" ? "var(--brand)" : "var(--surface)",
              color: viewMode === "summary" ? "var(--brand-ink)" : "var(--ink)",
            }}
          >
            Summary
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "points"}
            onClick={() => setViewMode("points")}
            style={{
              minHeight: 44,
              minWidth: 44,
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--line)",
              background: viewMode === "points" ? "var(--brand)" : "var(--surface)",
              color: viewMode === "points" ? "var(--brand-ink)" : "var(--ink)",
            }}
          >
            Point-wise details
          </button>
        </div>

        {viewMode === "summary" ? (
          <div>
            {useEffectSummary.summary.signature && (
              <p>
                <code>{useEffectSummary.summary.signature}</code>
              </p>
            )}
            <p>{useEffectSummary.summary.overview}</p>
          </div>
        ) : (
          <ol style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingLeft: "1.25rem" }}>
            {useEffectSummary.points.map((point) => (
              <li key={point.id}>
                <strong>{point.title}</strong>
                {point.section ? <span style={{ color: "var(--muted)" }}> — {point.section}</span> : null}
                <p style={{ margin: "0.25rem 0" }}>{point.summary}</p>
                <a href={point.source_url} target="_blank" rel="noreferrer">
                  Source
                </a>
              </li>
            ))}
          </ol>
        )}
      </article>

      <hr style={{ margin: "1.5rem 0", border: "none", borderTop: "1px solid var(--line)" }} />

      <img
        src={useEffectCheatSheet}
        alt="useEffect cheat sheet: syntax, when it runs, dependency behavior, and a do/don't checklist"
        style={{ maxWidth: "100%", height: "auto", borderRadius: "0.5rem", border: "1px solid var(--line)" }}
      />
    </section>
  );
}
