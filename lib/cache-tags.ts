/** Tag for `unstable_cache` on the friends page payload (per Clerk user id). */
export function friendsPageDataTag(userId: string): string {
  return `friends-page:${userId}`;
}
