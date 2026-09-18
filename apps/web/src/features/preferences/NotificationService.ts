/**
 * F4-R11, F4-R12: DND-aware wrapper around FOUNDATION's plain-toast
 * NotificationService (spec section 3.4: "NotificationService: { notify(...) }
 * // policy lives in F4"). While a focus session is active with dnd.enabled,
 * toasts are suppressed for every category except "security" and queued
 * instead; DND is in-app only (A5) -- it never touches OS notification
 * settings, and the real toast UI (ToastHost) is FOUNDATION's, untouched here.
 */
import { eventBus } from "../../shared/eventBus";
import { NotificationService as BaseNotificationService } from "../../shared/notificationService";
import type { NotificationItem } from "@studyshift/contracts";

let dndActive = false;
let queue: NotificationItem[] = [];

export function setDndActive(active: boolean): void {
  dndActive = active;
}

function notify(n: NotificationItem): void {
  if (dndActive && n.category !== "security") {
    queue.push(n);
    eventBus.emit("notification.suppressed", { id: n.id, category: n.category });
    return;
  }
  BaseNotificationService.notify(n);
}

function drainQueue(): NotificationItem[] {
  const drained = queue;
  queue = [];
  return drained;
}

export const NotificationService = { notify, drainQueue };
