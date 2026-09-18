/**
 * Add material (spec section 6, G5: "paste text or a PDF and produce
 * Source"). G5 is context-only for the F1-F4 feature agents ("do not
 * build"), but the app needs *some* entry point that turns real input into
 * a `Source`, so FOUNDATION provides this one. Not owned by any F1-F4
 * feature -- don't put F1-F4 work in this directory, and don't move this
 * into `features/*`.
 *
 * Talks to `POST /api/materials` (see `apps/api/app/materials.py`), which
 * always requires the real backend to be running (there's no mock-mode
 * equivalent for arbitrary ingestion). Segmenting happens synchronously;
 * claim extraction needs an LLM key (`app/pipeline/claims.py`), so a freshly
 * added passage's `job` will normally come back `failed` at the `claims`
 * stage until that's wired up -- that's expected, not a bug.
 */
import { useId, useState } from "react";
import type { IngestResult } from "../shared/apiClient";
import { apiClient, ApiError } from "../shared/apiClient";

type Mode = "text" | "url" | "pdf";

export default function AddMaterial() {
  const [mode, setMode] = useState<Mode>("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);

  const formId = useId();
  const canSubmit =
    title.trim().length > 0 &&
    !isSubmitting &&
    ((mode === "text" && text.trim().length > 0) ||
      (mode === "url" && url.trim().length > 0) ||
      (mode === "pdf" && file !== null));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.set("title", title);
      if (mode === "text") form.set("text", text);
      if (mode === "url") form.set("url", url);
      if (mode === "pdf" && file) form.set("file", file);
      const ingested = await apiClient.ingestMaterial(form);
      setResult(ingested);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this material. Is apps/api running?");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-label="Add material">
      <h2>Add material</h2>
      <p>
        Paste text, give a link, or upload a PDF. It's segmented into a <code>Source</code> that F1-F4 read from
        once implemented (claim extraction needs an LLM key -- see the README -- so new passages will stall at that
        stage until then, same as the seeded <code>iam-01</code> fixture doesn't).
      </p>

      <form onSubmit={handleSubmit}>
        <div role="radiogroup" aria-label="Material type" style={{ display: "flex", gap: "1rem", margin: "0.75rem 0" }}>
          {(
            [
              ["text", "Paste text"],
              ["url", "Link"],
              ["pdf", "Upload PDF"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <input
                type="radio"
                name={`${formId}-mode`}
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              {label}
            </label>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 480 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ minHeight: 44, padding: "0.5rem" }}
            />
          </label>

          {mode === "text" && (
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              Text
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                style={{ padding: "0.5rem" }}
              />
            </label>
          )}

          {mode === "url" && (
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              Link
              <input
                type="url"
                inputMode="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{ minHeight: 44, padding: "0.5rem" }}
              />
            </label>
          )}

          {mode === "pdf" && (
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              PDF file
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{ minHeight: 44, minWidth: 44, alignSelf: "flex-start", padding: "0.5rem 1rem" }}
          >
            {isSubmitting ? "Adding..." : "Add material"}
          </button>
        </div>
      </form>

      <div role="status" aria-live="polite" style={{ marginTop: "1rem" }}>
        {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
        {result && (
          <p>
            Created passage <strong>{result.passage_id}</strong>. Pipeline stage: <strong>{result.job.stage}</strong>
            , status: <strong>{result.job.status}</strong>
            {result.job.error ? ` (${result.job.error})` : ""}.
          </p>
        )}
      </div>
    </section>
  );
}
