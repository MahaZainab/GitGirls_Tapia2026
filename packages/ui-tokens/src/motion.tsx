/**
 * Motion policy (spec section 2.7). FOUNDATION-owned, read-only for feature
 * agents (A-02). Effective value is the *lower* of the user's
 * `display.motion` preference and the OS `prefers-reduced-motion` setting
 * (OS "reduce" caps at "reduced"). Order: full > reduced > off.
 *
 * Every animated thing in the product MUST consult `useMotionPolicy()`.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type MotionSetting = "full" | "reduced" | "off";

const RANK: Record<MotionSetting, number> = { full: 2, reduced: 1, off: 0 };

export function combineMotionPolicy(userSetting: MotionSetting, osPrefersReduced: boolean): MotionSetting {
  const osCapped: MotionSetting = osPrefersReduced && userSetting === "full" ? "reduced" : userSetting;
  return RANK[osCapped] <= RANK[userSetting] ? osCapped : userSetting;
}

export function useOSReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && "matchMedia" in window
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

const MotionPolicyContext = createContext<MotionSetting>("full");

export function MotionPolicyProvider({
  userMotionSetting,
  children,
}: {
  userMotionSetting: MotionSetting;
  children: ReactNode;
}) {
  const osReduced = useOSReducedMotion();
  const value = useMemo(() => combineMotionPolicy(userMotionSetting, osReduced), [userMotionSetting, osReduced]);
  return <MotionPolicyContext.Provider value={value}>{children}</MotionPolicyContext.Provider>;
}

/** `"full" | "reduced" | "off"` -- consult this before animating anything. */
export function useMotionPolicy(): MotionSetting {
  return useContext(MotionPolicyContext);
}
