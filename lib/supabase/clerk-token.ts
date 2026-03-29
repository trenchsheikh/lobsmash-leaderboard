/**
 * Token for Supabase third-party auth (Clerk).
 * Tries optional JWT template "supabase" if configured; otherwise uses the
 * default session token (Clerk "Connect with Supabase" / session token + role claim).
 *
 * Uses `skipCache: true` so PostgREST does not see a stale cached JWT (PGRST303 / JWT expired)
 * after the Clerk session was refreshed or the template token’s TTL elapsed.
 */
export async function getClerkTokenForSupabase(
  getToken: (options?: {
    template?: string;
    skipCache?: boolean;
  }) => Promise<string | null>,
): Promise<string | null> {
  try {
    const fromTemplate = await getToken({ template: "supabase", skipCache: true });
    if (fromTemplate) return fromTemplate;
  } catch {
    // Template not created in Clerk Dashboard — use session token below.
  }
  return (await getToken({ skipCache: true })) ?? null;
}
