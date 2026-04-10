"use client";

import { useLayoutEffect, useRef, useState } from "react";

const STORAGE_PREFIX = "lobsmah-standings-ranks:v1";

/**
 * Compares current ordering to the last snapshot (in-memory, then localStorage on first paint).
 * Positive delta = moved up (better rank). Negative = moved down.
 */
export function useStandingsRankDelta(
  leagueId: string,
  scope: "players" | "pairs",
  orderedKeys: readonly string[],
): Record<string, number | null> {
  const [deltas, setDeltas] = useState<Record<string, number | null>>({});
  const prevRanksRef = useRef<Record<string, number> | null>(null);
  const scopeMarkerRef = useRef<string>("");

  useLayoutEffect(() => {
    const marker = `${leagueId}:${scope}`;
    if (scopeMarkerRef.current !== marker) {
      scopeMarkerRef.current = marker;
      prevRanksRef.current = null;
    }

    const storageKey = `${STORAGE_PREFIX}:${leagueId}:${scope}`;
    const current: Record<string, number> = {};
    orderedKeys.forEach((id, i) => {
      current[id] = i + 1;
    });

    let baseline: Record<string, number>;
    if (prevRanksRef.current === null) {
      try {
        baseline = JSON.parse(
          typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) || "{}" : "{}",
        ) as Record<string, number>;
      } catch {
        baseline = {};
      }
    } else {
      baseline = prevRanksRef.current;
    }

    const next: Record<string, number | null> = {};
    for (const id of orderedKeys) {
      const prevRank = baseline[id];
      if (prevRank === undefined) {
        next[id] = null;
      } else {
        next[id] = prevRank - current[id]!;
      }
    }

    setDeltas(next);
    prevRanksRef.current = current;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(storageKey, JSON.stringify(current));
      }
    } catch {
      /* quota / private mode */
    }
  }, [leagueId, scope, orderedKeys.join("\u0001")]);

  return deltas;
}
