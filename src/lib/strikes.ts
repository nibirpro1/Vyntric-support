import { DEMOTION_THRESHOLD, StrikeBand } from "../config/tiers";

/**
 * The published demotion-strike rules.
 *
 * Transcribed from the server's own `retirement-demotions` post so the bot and
 * the pinned text can never disagree about what a loss is worth.
 *
 * Two things in the published table are NOT symmetric, and this file preserves
 * both of them:
 *
 *   losing to a *lower* tier   LT1/HT1 = 3 strikes, LT2/HT2 = 2, HT3 = 2
 *   dodging an assigned fight LT1/HT1 = 2 strikes, LT2/HT2 = 1, HT3 = not listed
 */
export interface StrikeOutcome {
  /** Positive = strikes added, negative = strikes removed. */
  strikes: number;
  /** Stable reason code, stored on the record for the audit trail. */
  code: StrikeCode;
  /** One line, shown in the embed and stored so a later edit can be traced. */
  reason: string;
}

export type StrikeCode =
  | "same_tier_loss"
  | "significant_loss"
  | "lower_tier_loss"
  | "dodge"
  | "forfeit_pass"
  | "extreme_loss"
  | "defence_win"
  | "manual_add"
  | "manual_remove";

/** Per-band strike values. `null` means the published rules are silent on it. */
export interface BandRules {
  lossSameTier: number;
  lossLowerTier: number;
  /** null = the published rules do not list dodging for this band. */
  dodge: number | null;
}

export const BAND_RULES: Record<Exclude<StrikeBand, null>, BandRules> = {
  1: { lossSameTier: 1, lossLowerTier: 3, dodge: 2 },
  2: { lossSameTier: 1, lossLowerTier: 2, dodge: 1 },
  3: { lossSameTier: 1, lossLowerTier: 2, dodge: null },
};

/** A forfeit that lets the opponent pass costs 2 strikes at every band. */
export const FORFEIT_PASS_STRIKES = 2;

/** Winning against a same-or-higher tier player ("a defence") removes 1. */
export const DEFENCE_WIN_REMOVAL = -1;

/**
 * A loss is "extreme" — instant demotion, no strike counting — at a score ratio
 * of 0.2 or worse. The published examples are 2/10 and 3-15.
 */
export const EXTREME_LOSS_RATIO = 0.2;

/** `lossScore / winScore`, or null when the scores are unusable. */
export function scoreRatio(lossScore: number, winScore: number): number | null {
  if (!Number.isFinite(lossScore) || !Number.isFinite(winScore)) return null;
  if (winScore <= 0 || lossScore < 0) return null;
  return lossScore / winScore;
}

export function isExtremeLoss(lossScore: number, winScore: number): boolean {
  const ratio = scoreRatio(lossScore, winScore);
  return ratio !== null && ratio <= EXTREME_LOSS_RATIO;
}

/**
 * Did this score make the loss "significant"?
 *
 * The windows are written per arena *and* per band (Sword at LT1 is 14-20 in a
 * 20-point fight, but only 5-10 further down), so both are looked up here
 * instead of being guessed from the total.
 */
export function isSignificantLoss(
  window: { min: number; max: number } | undefined,
  lossScore: number
): boolean {
  if (!window) return false;
  return lossScore >= window.min;
}

/**
 * The full decision for one completed fight, given the band it was judged in.
 *
 * Returns every strike that applies rather than stopping at the first, so a
 * fight that is both a forfeit and a loss to a lower tier is recorded honestly
 * instead of under-counted.
 */
export function strikesForFight(input: {
  band: Exclude<StrikeBand, null>;
  /** Did the tested player win? */
  won: boolean;
  /** Opponent ranked in the same tier band. */
  sameTier: boolean;
  /** Opponent sat on a lower (worse) rung. */
  vsLowerTier: boolean;
  significant: boolean;
  /** Losing by a ratio of 0.2 or worse. */
  extreme: boolean;
  /** The tested player walked away or disconnected. */
  dodged?: boolean;
  /** The opponent passed as a direct result of this fight. */
  opponentPassed?: boolean;
}): StrikeOutcome[] {
  const rules = BAND_RULES[input.band];
  if (!rules) return [];

  // A defence: beating someone at your level or above clears a strike and
  // costs nothing. Nothing else is evaluated on a win.
  if (input.won) {
    return [
      {
        strikes: DEFENCE_WIN_REMOVAL,
        code: "defence_win",
        reason: "Defence - beat a same-or-higher tier player",
      },
    ];
  }

  const outcomes: StrikeOutcome[] = [];

  // A forfeit that hands the opponent the rung is always 2, at every band.
  if (input.opponentPassed) {
    outcomes.push({
      strikes: FORFEIT_PASS_STRIKES,
      code: "forfeit_pass",
      reason: `Forfeit that let the opponent pass (${FORFEIT_PASS_STRIKES} strikes)`,
    });
  }

  if (input.dodged && rules.dodge !== null) {
    outcomes.push({
      strikes: rules.dodge,
      code: "dodge",
      reason: `Dodged an assigned fight (${rules.dodge} strike${rules.dodge === 1 ? "" : "s"})`,
    });
  }

  if (input.extreme) {
    // Flagged for the caller to demote immediately; still worth a record.
    outcomes.push({
      strikes: 0,
      code: "extreme_loss",
      reason: `Extreme loss (ratio ${EXTREME_LOSS_RATIO} or worse) - instant demotion`,
    });
    return outcomes;
  }

  if (input.vsLowerTier) {
    outcomes.push({
      strikes: rules.lossLowerTier,
      code: "lower_tier_loss",
      reason: `Lost to a lower tier player (${rules.lossLowerTier} strikes)`,
    });
    return outcomes;
  }

  if (input.significant) {
    outcomes.push({ strikes: 2, code: "significant_loss", reason: "Significant loss (2 strikes)" });
    return outcomes;
  }

  outcomes.push({
    strikes: rules.lossSameTier,
    code: "same_tier_loss",
    reason: `Loss at the same tier (${rules.lossSameTier} strike${rules.lossSameTier === 1 ? "" : "s"})`,
  });

  return outcomes;
}

/** Net strikes from a list of outcomes — one fight can yield several. */
export function totalStrikes(outcomes: StrikeOutcome[]): number {
  return outcomes.reduce((sum, outcome) => sum + outcome.strikes, 0);
}

/** Has this many accumulated strikes crossed the demotion line? */
export function shouldDemote(strikes: number): boolean {
  return strikes >= DEMOTION_THRESHOLD;
}

/** Renders the strike bar, e.g. "⚔️⚔️⚔️" out of three. */
export function strikeBar(strikes: number): string {
  const clamped = Math.max(0, Math.min(DEMOTION_THRESHOLD, strikes));
  return "⚔️".repeat(clamped) + "·".repeat(DEMOTION_THRESHOLD - clamped);
}
