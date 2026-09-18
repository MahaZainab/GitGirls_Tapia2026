/**
 * F4 UI: PreferencesPage (spec section 5, F4-R01..R17).
 */
import { useRef, useState } from "react";
import { usePreferences } from "../../shared/preferences";
import type { UserPreferences } from "@studyshift/contracts";
import { useFocusSession } from "./FocusSessionProvider";
import "./preferences.css";

type Mode = UserPreferences["mode"];
type SaveStatus = "idle" | "saving" | "saved" | "error";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function deletePreferencesOnServer(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/me/preferences`, { method: "DELETE" });
  } catch {
    // backend not running (mock mode): nothing server-side to clear
  }
}

export function PreferencesPage() {
  const { prefs, update, isLoading, error } = usePreferences();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const session = useFocusSession();
  const nudgeDialogRef = useRef<HTMLDialogElement>(null);

  if (session.state.nudgeOpen && nudgeDialogRef.current && !nudgeDialogRef.current.open) {
    nudgeDialogRef.current.showModal();
  }
  if (!session.state.nudgeOpen && nudgeDialogRef.current?.open) {
    nudgeDialogRef.current.close();
  }

  async function save(patch: Partial<UserPreferences>) {
    setSaveStatus("saving");
    try {
      await update(patch);
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch {
      setSaveStatus("error"); // usePreferences() already rolled back optimistically
    }
  }

  if (isLoading) {
    return (
      <div className="ss-prefs-page" aria-busy="true">
        Loading preferences…
      </div>
    );
  }

  function setMode(mode: Mode) {
    if (mode === "regular" && session.state.state !== "idle") {
      session.end(); // F4-R13: switching to Regular during a session ends it cleanly
    }
    void save({ mode });
  }

  async function onDelete() {
    await deletePreferencesOnServer();
    await save({
      mode: "regular",
      supports: { adhd: false, dyslexia: false },
      display: { text_scale: 1.0, motion: "full", line_focus: false, dyslexia_typography: false },
      storage: { sync: "account" },
    });
  }

  const p = prefs;
  const inSession = session.state.state === "work" || session.state.state === "break";
  const showTime = p.focus.pomodoro.visible || session.state.peeking;

  return (
    <div className="ss-prefs-page">
      <h1>Preferences</h1>

      <div className="ss-save-status" role="status" aria-live="polite">
        {saveStatus === "saving" && "Saving…"}
        {saveStatus === "saved" && "Saved"}
        {(saveStatus === "error" || error) && (
          <span className="ss-error">{error ?? "Could not save"} — reverted to your last saved settings.</span>
        )}
      </div>

      <fieldset className="ss-mode-group">
        <legend>Mode</legend>
        <label className="ss-radio">
          <input type="radio" name="mode" checked={p.mode === "regular"} onChange={() => setMode("regular")} />
          <span>
            <strong>Regular</strong> — the standard StudyShift experience.
          </span>
        </label>
        <label className="ss-radio">
          <input type="radio" name="mode" checked={p.mode === "focus"} onChange={() => setMode("focus")} />
          <span>
            <strong>Focus</strong> — a quiet layout with an optional Pomodoro timer, rain sound and in-app Do Not Disturb.
          </span>
        </label>
      </fieldset>

      {p.mode === "focus" && (
        <fieldset className="ss-focus-settings">
          <legend>Focus session settings</legend>

          <label className="ss-switch">
            <input
              type="checkbox"
              checked={p.focus.pomodoro.enabled}
              onChange={(e) => void save({ focus: { ...p.focus, pomodoro: { ...p.focus.pomodoro, enabled: e.target.checked } } })}
            />
            <span>
              <strong>Hidden Pomodoro</strong> — a work/break timer that runs quietly, with no countdown shown by default.
            </span>
          </label>
          {p.focus.pomodoro.enabled && (
            <label className="ss-switch ss-nested">
              <input
                type="checkbox"
                checked={p.focus.pomodoro.visible}
                onChange={(e) =>
                  void save({ focus: { ...p.focus, pomodoro: { ...p.focus.pomodoro, visible: e.target.checked } } })
                }
              />
              <span>Show the timer (skip hiding the countdown)</span>
            </label>
          )}

          <label className="ss-switch">
            <input
              type="checkbox"
              checked={p.focus.rain.enabled}
              onChange={(e) => void save({ focus: { ...p.focus, rain: { ...p.focus.rain, enabled: e.target.checked } } })}
            />
            <span>
              <strong>Rain sound</strong> — a soft background loop, played locally (no remote audio).
            </span>
          </label>
          {p.focus.rain.enabled && (
            <label className="ss-slider ss-nested">
              <span>Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={p.focus.rain.volume}
                onChange={(e) => void save({ focus: { ...p.focus, rain: { ...p.focus.rain, volume: Number(e.target.value) } } })}
                aria-label="Rain sound volume"
              />
            </label>
          )}

          <label className="ss-switch">
            <input
              type="checkbox"
              checked={p.focus.dnd.enabled}
              onChange={(e) => void save({ focus: { ...p.focus, dnd: { ...p.focus.dnd, enabled: e.target.checked } } })}
            />
            <span>
              <strong>Do not disturb</strong> — holds StudyShift's own notifications while a session runs. This does not change
              your device's notification or focus settings.
            </span>
          </label>

          {session.state.state === "idle" && (
            <button type="button" className="ss-start-session" onClick={session.start}>
              Start focus session
            </button>
          )}

          {inSession && (
            <div className="ss-session-status" aria-live="polite">
              <span className="ss-session-dot" aria-hidden="true" />
              <span>
                Session running ({session.state.state}){showTime && session.state.phaseEndsAt ? ` — ${remaining(session.state.phaseEndsAt)}` : ""}
              </span>
              {p.focus.pomodoro.allow_peek && !p.focus.pomodoro.visible && (
                <button type="button" onClick={session.peek}>
                  Peek at time
                </button>
              )}
              <button type="button" onClick={session.end}>
                End session
              </button>
            </div>
          )}

          {session.state.state === "ended" && (
            <div className="ss-digest" role="status">
              {session.state.digest ? (
                <>
                  Session ended. {session.state.digest.count} notification(s) held: {session.state.digest.titles.join(", ")}.
                </>
              ) : (
                "Session ended."
              )}{" "}
              <button type="button" onClick={session.acknowledge}>
                Done
              </button>
            </div>
          )}

          <dialog ref={nudgeDialogRef} className="ss-nudge-dialog" aria-label="Focus session phase changed">
            <p>{session.state.nudgeKind === "to_break" ? "Time for a break." : "Break's over."}</p>
            <div className="ss-nudge-actions">
              <button type="button" onClick={session.takeBreak}>
                Take a break
              </button>
              <button type="button" onClick={session.keepGoing}>
                Keep going
              </button>
            </div>
          </dialog>
        </fieldset>
      )}

      <fieldset>
        <legend>Learning supports</legend>
        <label className="ss-switch">
          <input
            type="checkbox"
            checked={p.supports.adhd}
            onChange={(e) => void save({ supports: { ...p.supports, adhd: e.target.checked } })}
          />
          <span>ADHD-friendly pacing</span>
        </label>
        <label className="ss-switch">
          <input
            type="checkbox"
            checked={p.supports.dyslexia}
            onChange={(e) => void save({ supports: { ...p.supports, dyslexia: e.target.checked } })}
          />
          <span>Dyslexia-friendly typography</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Display</legend>
        <label className="ss-slider">
          <span>Text size ({p.display.text_scale.toFixed(2)}x)</span>
          <input
            type="range"
            min={0.9}
            max={1.6}
            step={0.05}
            value={p.display.text_scale}
            onChange={(e) => void save({ display: { ...p.display, text_scale: Number(e.target.value) } })}
            aria-label="Text size"
          />
        </label>
        <label className="ss-select">
          <span>Motion</span>
          <select
            value={p.display.motion}
            onChange={(e) => void save({ display: { ...p.display, motion: e.target.value as UserPreferences["display"]["motion"] } })}
          >
            <option value="full">Full</option>
            <option value="reduced">Reduced</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label className="ss-switch">
          <input
            type="checkbox"
            checked={p.display.line_focus}
            onChange={(e) => void save({ display: { ...p.display, line_focus: e.target.checked } })}
          />
          <span>Line focus (dim paragraphs away from your active line)</span>
        </label>
        <label className="ss-switch">
          <input
            type="checkbox"
            checked={p.display.dyslexia_typography}
            onChange={(e) => void save({ display: { ...p.display, dyslexia_typography: e.target.checked } })}
          />
          <span>Dyslexia-friendly font spacing</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Storage</legend>
        <label className="ss-switch">
          <input
            type="checkbox"
            checked={p.storage.sync === "device_only"}
            onChange={(e) => void save({ storage: { sync: e.target.checked ? "device_only" : "account" } })}
          />
          <span>Keep on this device only (don't sync these settings to your account)</span>
        </label>
      </fieldset>

      <button type="button" className="ss-delete" onClick={onDelete}>
        Delete my stored preferences
      </button>
    </div>
  );
}

function remaining(phaseEndsAt: number): string {
  const ms = Math.max(0, phaseEndsAt - Date.now());
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")} remaining`;
}
