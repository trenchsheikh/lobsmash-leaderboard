/**
 * Token for Supabase third-party auth (Clerk).
 * Tries optional JWT template "supabase" if configured; otherwise uses the
 * default session token (Clerk "Connect with Supabase" / session token + role claim).
 */
export async function getClerkTokenForSupabase(
  getToken: (options?: { template?: string }) => Promise<string | null>,
): Promise<string | null> {
  try {
    const fromTemplate = await getToken({ template: "supabase" });
    if (fromTemplate) return fromTemplate;
  } catch {
    // Template not created in Clerk Dashboard — use session token below.
  }
  return (await getToken()) ?? null;
}
