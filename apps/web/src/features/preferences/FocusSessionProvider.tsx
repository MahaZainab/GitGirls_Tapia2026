/**
 * F4: the Pomodoro/rain/DND session state machine (spec section 5, "Session
 * state machine" table). Timing is timestamp-based (F4-R07): a missed phase
 * boundary while the tab was hidden is settled in one jump with exactly one
 * nudge, never one nudge per elapsed phase.
 *
 * Reads live preferences via FOUNDATION's usePreferences() -- this must be
 * rendered inside <PreferencesProvider> (App.tsx already does this at the
 * root), so it always sees the same prefs the settings page is editing.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { eventBus } from "../../shared/eventBus";
import { usePreferences } from "../../shared/preferences";
import { NotificationService, setDndActive } from "./NotificationService";
import type { FocusSessionPhase, UserPreferences } from "@studyshift/contracts";
import { startRain, stopRain, setRainVolume, isRainSupported } from "./rainAudio";

const STORAGE_KEY = "studyshift.focusSession.v1";

interface InternalState {
  state: FocusSessionPhase;
  startedAt: number | null;
  phaseStartedAt: number | null;
  phaseEndsAt: number | null;
  cyclesCompleted: number;
  rainRunning: boolean;
  dndActive: boolean;
  peeking: boolean;
  nudgeOpen: boolean;
  nudgeKind: "to_break" | "to_work" | null;
  digest: { count: number; titles: string[] } | null;
}

const IDLE: InternalState = {
  state: "idle",
  startedAt: null,
  phaseStartedAt: null,
  phaseEndsAt: null,
  cyclesCompleted: 0,
  rainRunning: false,
  dndActive: false,
  peeking: false,
  nudgeOpen: false,
  nudgeKind: null,
  digest: null,
};

function loadPersisted(): InternalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...IDLE, ...JSON.parse(raw), rainRunning: false }; // F4-R10: never resume audio on reload
  } catch {
    /* ignore */
  }
  return IDLE;
}

function persist(s: InternalState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export interface FocusSessionApi {
  state: InternalState;
  start(): void;
  end(): void;
  peek(): void;
  takeBreak(): void;
  keepGoing(): void;
  acknowledge(): void;
  resumeRain(): void;
}

const Ctx = createContext<FocusSessionApi | null>(null);

export function useFocusSession(): FocusSessionApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFocusSession must be used inside FocusSessionProvider");
  return ctx;
}

export function FocusSessionProvider({ children }: { children: ReactNode }) {
  const { prefs } = usePreferences();
  const [s, setS] = useState<InternalState>(loadPersisted);
  const prefsRef = useRef<UserPreferences>(prefs);
  prefsRef.current = prefs;
  const needsRainResume = useRef(s.state !== "idle" && s.rainRunning);

  useEffect(() => persist(s), [s]);

  const fireNudge = useCallback((kind: "to_break" | "to_work") => {
    const nudge = prefsRef.current.focus.pomodoro.nudge;
    if (nudge === "none") return;
    if (nudge === "chime" || nudge === "both") {
      try {
        const audioCtx = new AudioContext();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = kind === "to_break" ? 440 : 550;
        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.65);
      } catch {
        /* audio unavailable, visual nudge still applies below */
      }
    }
    if (nudge === "visual" || nudge === "both") {
      setS((prev) => ({ ...prev, nudgeOpen: true, nudgeKind: kind }));
    }
  }, []);

  /** Settle any elapsed phase boundaries in one jump (F4-R07). */
  const settle = useCallback(
    (prev: InternalState, now: number): InternalState => {
      if (prev.state !== "work" && prev.state !== "break") return prev;
      if (prev.phaseEndsAt === null) return prev;

      let phase = prev.state;
      let phaseStartedAt = prev.phaseStartedAt ?? now;
      let phaseEndsAt = prev.phaseEndsAt;
      let cycles = prev.cyclesCompleted;
      let firedNudge = false;
      const workMs = prefsRef.current.focus.pomodoro.work_minutes * 60_000;
      const breakMs = prefsRef.current.focus.pomodoro.break_minutes * 60_000;
      const during = prefsRef.current.focus.rain.during_break;

      let guard = 0;
      while (now >= phaseEndsAt && guard < 1000) {
        guard++;
        if (phase === "work") {
          phase = "break";
          if (!firedNudge) {
            fireNudge("to_break");
            firedNudge = true;
          }
        } else {
          phase = "work";
          cycles += 1;
          if (!firedNudge) {
            fireNudge("to_work");
            firedNudge = true;
          }
        }
        phaseStartedAt = phaseEndsAt;
        phaseEndsAt = phaseStartedAt + (phase === "work" ? workMs : breakMs);
      }

      if (phase === "break" && during === "pause" && prev.rainRunning) {
        stopRain(0.3);
      } else if (phase === "work" && during === "pause" && !prev.rainRunning && prefsRef.current.focus.rain.enabled) {
        void startRain(prefsRef.current.focus.rain.volume);
      }

      return { ...prev, state: phase, phaseStartedAt, phaseEndsAt, cyclesCompleted: cycles };
    },
    [fireNudge]
  );

  useEffect(() => {
    if (s.state !== "work" && s.state !== "break") return;
    const tick = () => setS((prev) => settle(prev, Date.now()));
    const id = window.setInterval(tick, 1000);
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.state, settle]);

  const start = useCallback(() => {
    const now = Date.now();
    const workMs = prefsRef.current.focus.pomodoro.work_minutes * 60_000;
    const rainOn = prefsRef.current.focus.rain.enabled;
    const dndOn = prefsRef.current.focus.dnd.enabled;
    if (rainOn && isRainSupported()) void startRain(prefsRef.current.focus.rain.volume, 1.5);
    if (dndOn) setDndActive(true);
    setS({
      ...IDLE,
      state: "work",
      startedAt: now,
      phaseStartedAt: now,
      phaseEndsAt: now + workMs,
      rainRunning: rainOn,
      dndActive: dndOn,
    });
    eventBus.emit("focus.session.started", { state: "work", cycles_completed: 0 });
  }, []);

  const end = useCallback(() => {
    stopRain(1);
    setDndActive(false);
    const queued = NotificationService.drainQueue();
    const digest =
      prefsRef.current.focus.dnd.digest_on_end && queued.length > 0
        ? { count: queued.length, titles: queued.map((n) => n.title) }
        : null;
    setS((prev) => ({
      ...prev,
      state: "ended",
      rainRunning: false,
      dndActive: false,
      nudgeOpen: false,
      digest,
    }));
    eventBus.emit("focus.session.ended", { state: "ended", cycles_completed: s.cyclesCompleted });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.cyclesCompleted]);

  const acknowledge = useCallback(() => setS(IDLE), []);

  const peek = useCallback(() => {
    if (!prefsRef.current.focus.pomodoro.allow_peek) return;
    setS((prev) => ({ ...prev, peeking: true }));
    window.setTimeout(() => setS((prev) => ({ ...prev, peeking: false })), 4000);
  }, []);

  const takeBreak = useCallback(() => {
    setS((prev) => ({ ...prev, nudgeOpen: false, nudgeKind: null }));
  }, []);

  const keepGoing = useCallback(() => {
    // Postpone: cancel the just-started break and go back to a fresh work phase.
    const now = Date.now();
    const workMs = prefsRef.current.focus.pomodoro.work_minutes * 60_000;
    if (prefsRef.current.focus.rain.during_break === "pause" && !s.rainRunning && prefsRef.current.focus.rain.enabled) {
      void startRain(prefsRef.current.focus.rain.volume);
    }
    setS((prev) => ({
      ...prev,
      state: "work",
      phaseStartedAt: now,
      phaseEndsAt: now + workMs,
      nudgeOpen: false,
      nudgeKind: null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.rainRunning]);

  const resumeRain = useCallback(() => {
    if (isRainSupported() && prefsRef.current.focus.rain.enabled) {
      void startRain(prefsRef.current.focus.rain.volume, 1);
      setS((prev) => ({ ...prev, rainRunning: true }));
    }
  }, []);

  useEffect(() => {
    if (s.rainRunning) setRainVolume(prefs.focus.rain.volume);
  }, [prefs.focus.rain.volume, s.rainRunning]);

  const api = useMemo<FocusSessionApi>(
    () => ({ state: s, start, end, peek, takeBreak, keepGoing, acknowledge, resumeRain }),
    [s, start, end, peek, takeBreak, keepGoing, acknowledge, resumeRain]
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {needsRainResume.current && s.state !== "idle" && !s.rainRunning && (
        <div role="status" className="ss-resume-rain-banner">
          Rain sound was on before reload.{" "}
          <button type="button" onClick={resumeRain}>
            Resume rain
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}
