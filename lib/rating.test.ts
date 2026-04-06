import { describe, expect, it } from "vitest";
import {
  ALPHA,
  CHAMP_TEMPERATURE,
  DEFAULT_SKILL,
  DISPLAY_SKILL_MAX,
  DISPLAY_SKILL_MIN,
  ELO_SCALE,
  K_BASE,
  MARGIN_BETA,
  MARGIN_CAP,
  averageTeamSkill,
  expectedChampShares,
  expectedTeamWinProbability,
  expectedWinForSides,
  skillForPlayer,
  skillToDisplayLevel,
} from "./rating";

describe("rating constants (mirror SQL migration)", () => {
  it("matches algorithm.md / player_skill_ratings.sql", () => {
    expect(DEFAULT_SKILL).toBe(1500);
    expect(ELO_SCALE).toBe(400);
    expect(K_BASE).toBe(32);
    expect(ALPHA).toBe(0.05);
    expect(CHAMP_TEMPERATURE).toBe(200);
    expect(MARGIN_BETA).toBe(0.15);
    expect(MARGIN_CAP).toBe(8);
    expect(DISPLAY_SKILL_MIN).toBe(800);
    expect(DISPLAY_SKILL_MAX).toBe(2200);
  });
});

describe("expectedTeamWinProbability (logistic / Elo)", () => {
  it("is 0.5 when team strengths are equal", () => {
    expect(expectedTeamWinProbability(1500, 1500)).toBeCloseTo(0.5, 6);
  });

  it("favors the stronger team", () => {
    const p = expectedTeamWinProbability(1700, 1500);
    expect(p).toBeGreaterThan(0.5);
    expect(expectedTeamWinProbability(1500, 1700)).toBeCloseTo(1 - p, 6);
  });
});

describe("expectedWinForSides", () => {
  it("uses team-average skills (full mode shape)", () => {
    const skills: Record<string, number> = {
      a: 1500,
      b: 1500,
      c: 1500,
      d: 1500,
    };
    const { teamA, teamB } = expectedWinForSides(["a", "b"], ["c", "d"], skills);
    expect(teamA).toBeCloseTo(0.5, 6);
    expect(teamB).toBeCloseTo(0.5, 6);
  });
});

describe("skillForPlayer / averageTeamSkill", () => {
  it("defaults missing players to DEFAULT_SKILL", () => {
    expect(skillForPlayer("x", {})).toBe(DEFAULT_SKILL);
    expect(averageTeamSkill(["a", "b"], {})).toBe(DEFAULT_SKILL);
  });
});

describe("reliability K (documented formula)", () => {
  it("K = K_BASE / (1 + ALPHA * rated_games)", () => {
    const ratedGames = 10;
    const k = K_BASE / (1 + ALPHA * ratedGames);
    expect(k).toBeCloseTo(32 / 1.5, 6);
  });
});

describe("margin factor m (full mode)", () => {
  it("m = 1 + MARGIN_BETA * min(1, max(0, |Δs| / MARGIN_CAP))", () => {
    const deltaScore = 8;
    const m = 1 + MARGIN_BETA * Math.min(1, Math.max(0, deltaScore / MARGIN_CAP));
    expect(m).toBeCloseTo(1 + MARGIN_BETA, 6);
  });
});

describe("expectedChampShares (softmax over team strengths)", () => {
  it("sums to 1 and matches equal-skill symmetry", () => {
    const shares = expectedChampShares([1500, 1500, 1500]);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(shares[0]).toBeCloseTo(1 / 3, 5);
  });

  it("uses CHAMP_TEMPERATURE in exponent", () => {
    const s = 1600;
    const ex = Math.exp(s / CHAMP_TEMPERATURE);
    const shares = expectedChampShares([s]);
    expect(shares[0]).toBeCloseTo(1, 6);
    expect(ex).toBeGreaterThan(1);
  });
});

describe("skillToDisplayLevel", () => {
  it("maps band edges to 0 and 7", () => {
    expect(skillToDisplayLevel(DISPLAY_SKILL_MIN)).toBe(0);
    expect(skillToDisplayLevel(DISPLAY_SKILL_MAX)).toBe(7);
  });
});
