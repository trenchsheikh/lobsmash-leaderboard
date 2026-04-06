/**
 * Session wizard requires `numCourts * 2` team rows (pairs) to fill all courts.
 * See SessionCreateWizard: teamsRequired = effectiveCourts * 2.
 */
export function teamsCoverCourts(numCourts: number, teamPairCount: number): boolean {
  if (!Number.isFinite(numCourts) || numCourts < 1) return false;
  const requiredPairs = numCourts * 2;
  return teamPairCount >= requiredPairs;
}
