/**
 * Coach verification attributes: six axes aligned to how padel coaches assess players,
 * with copy grounded in club-style rating matrices (e.g. fitness/footwork, walls, net,
 * overheads, positioning, partner & point construction).
 */
import type { LucideIcon } from "lucide-react";
import {
  AlignLeft,
  Brain,
  Footprints,
  Layers,
  Target,
  Zap,
} from "lucide-react";

export const RATING_ATTRIBUTE_KEYS = [
  "serve_return",
  "net_game",
  "power",
  "consistency",
  "movement",
  "tactical_iq",
] as const;

export type VerificationRatingKey = (typeof RATING_ATTRIBUTE_KEYS)[number];

export type RatingAttributeUi = {
  value: VerificationRatingKey;
  label: string;
  /** One line: what to watch on court */
  coachPrompt: string;
  /** Which SPC-style pillars this axis summarises for coaches */
  spcPillars: string;
  /** Short level guide (1–2 low, mid, high) — not a full matrix */
  rubric: string;
  Icon: LucideIcon;
};

export const RATING_ATTRIBUTE_UI: readonly RatingAttributeUi[] = [
  {
    value: "serve_return",
    label: "Serve & return",
    coachPrompt:
      "First-ball quality, return depth and width, and how quickly they neutralise or attack after the serve.",
    spcPillars: "SPC: opening exchanges · pressure on the first shot",
    rubric:
      "Low (1–3): basic contact, predictable placement, weak second ball. Mid (4–5): safer depth, starting to vary height and pace. High (6–8): targets weaknesses, stable under pressure, uses slice/top/flat with intent.",
    Icon: Target,
  },
  {
    value: "net_game",
    label: "Net play",
    coachPrompt:
      "Volley depth and slice, ready position, transition vs finishing volleys, dropshot threat when appropriate.",
    spcPillars: "SPC: Net play — volleys, readiness, depth",
    rubric:
      "Low: limited volley technique, poor ready shape, lets balls drop unnecessarily. Mid: consistent medium/low sliced volleys, clearer transition choices. High: low sliced depth, picks winner vs transition, dropshots under control.",
    Icon: Layers,
  },
  {
    value: "power",
    label: "Overheads & finishing",
    coachPrompt:
      "Bandeja and vibora shape, flat vs spin smash selection, rulo/gancho when relevant — not raw muscle, shot selection under pressure.",
    spcPillars: "SPC: Overheads — bandeja, vibora, smash programme",
    rubric:
      "Low: smashes without plan, bandeja not understood. Mid: bandeja used but depth/slice inconsistent; smash can lose points. High: sliced deep bandejas/viboras, smart smash selection, can finish without gifting the net.",
    Icon: Zap,
  },
  {
    value: "consistency",
    label: "Groundstrokes & ball control",
    coachPrompt:
      "FH/BH reliability, spin variety (flat, slice, topspin), chiquita when useful, unforced errors in rally play.",
    spcPillars: "SPC: Groundstrokes — technique, spin, errors",
    rubric:
      "Low: flat contacts, many UEs, weak BH. Mid: clearer spin differences, fewer errors in rhythm. High: both wings technically solid, uses chiquita/top when needed, very few cheap errors.",
    Icon: AlignLeft,
  },
  {
    value: "movement",
    label: "Fitness, footwork & positioning",
    coachPrompt:
      "Court coverage, recovery, padel-specific footwork, defensive lines vs net height, and where they stand in attack/defence phases.",
    spcPillars: "SPC: Fitness & footwork · Court position",
    rubric:
      "Low: endurance limits shot choice; poor lines after serve; glass reads weak. Mid: longer rallies possible; better net after serve; improving defensive shape. High: high-intensity rallies, fast accurate footwork, strong position in all phases.",
    Icon: Footprints,
  },
  {
    value: "tactical_iq",
    label: "Tactics, point build & pairs",
    coachPrompt:
      "Lobs to recover net, bajadas vs lobs, reading opponents, covering with partner, left/right roles, and turning defence into attack.",
    spcPillars: "SPC: Partner work · Strategy & point construction",
    rubric:
      "Low: plays as individuals, weak attack/defence sense. Mid: some pair patterns, reacts to opponents, building point ideas. High: adapts with partner, anticipates, exploits weaknesses, shot choice matches plan.",
    Icon: Brain,
  },
] as const;

export function ratingAttributeMeta(
  key: string,
): RatingAttributeUi | undefined {
  return RATING_ATTRIBUTE_UI.find((a) => a.value === key);
}
