/**
 * When true, players on a verification session can open a read-only “Coach” tab to preview the
 * assessment UI during local development (submit still requires the assigned coach account).
 */
export function verificationSessionDualViewEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_VERIFICATION_SESSION_DUAL_VIEW === "true") return true;
  return process.env.NODE_ENV === "development";
}
