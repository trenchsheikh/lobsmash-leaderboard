/**
 * Client-only bridge so a demo “coach” submission on `/verification/dev-session` can show up as
 * feedback on `/verification` for the matching simulated booking. Uses `localStorage` so another
 * tab on the same origin can pick up updates via the `storage` event (sessionStorage is tab-only).
 */

export const VERIFICATION_DEMO_FEEDBACK_STORAGE_KEY = "lobsmah_verification_demo_feedback_v1";

export const VERIFICATION_DEMO_FEEDBACK_EVENT = "lobsmah:verification-demo-feedback";

export type VerificationDemoFeedbackPayload = {
  slotId: string;
  coachUserId: string;
  scores: Record<string, number>;
  notes: Record<string, string>;
  submittedAt: string;
};

export type VerificationDemoFeedbackMap = Record<string, VerificationDemoFeedbackPayload>;

export type VerificationDemoFeedbackEventDetail =
  | VerificationDemoFeedbackPayload
  | { type: "removed"; slotId: string };

export function readDemoFeedbackMap(): VerificationDemoFeedbackMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(VERIFICATION_DEMO_FEEDBACK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as VerificationDemoFeedbackMap;
  } catch {
    return {};
  }
}

export function upsertDemoFeedback(payload: VerificationDemoFeedbackPayload): void {
  if (typeof window === "undefined") return;
  const next = { ...readDemoFeedbackMap(), [payload.slotId]: payload };
  localStorage.setItem(VERIFICATION_DEMO_FEEDBACK_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent<VerificationDemoFeedbackEventDetail>(VERIFICATION_DEMO_FEEDBACK_EVENT, {
      detail: payload,
    }),
  );
}

export function removeDemoFeedbackSlot(slotId: string): void {
  if (typeof window === "undefined") return;
  const next = { ...readDemoFeedbackMap() };
  delete next[slotId];
  localStorage.setItem(VERIFICATION_DEMO_FEEDBACK_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent<VerificationDemoFeedbackEventDetail>(VERIFICATION_DEMO_FEEDBACK_EVENT, {
      detail: { type: "removed", slotId },
    }),
  );
}
