/**
 * The Vyntric punishment catalogue.
 *
 * Modelled on the server's own `punishments` post, which uses a small fixed set
 * of destinations and a day count. Every punishment here is a *staff note plus a
 * role*, never a silent action: the record is written to the punishments channel
 * so the member can always see why they were restricted and ask for an appeal.
 */
export type PunishmentKind = "hacking_subhuman" | "restricted" | "blacklist";

export interface PunishmentType {
  kind: PunishmentKind;
  /** Exact wording used in the channel headline. */
  headline: string;
  emoji: string;
  /** Role applied on the member, when the punishment carries one. */
  roleName: string | null;
  /** Discord timeout duration, in ms. null = no timeout, role only. */
  timeoutMs: number | null;
  color: number;
  blurb: string;
}

const DAY = 24 * 60 * 60 * 1000;

export const PUNISHMENTS: Record<PunishmentKind, PunishmentType> = {
  hacking_subhuman: {
    kind: "hacking_subhuman",
    headline: "Has Been Sent to Hacking SubHuman",
    emoji: "💀",
    roleName: "Restricted",
    timeoutMs: 90 * DAY,
    color: 0xc81e2e,
    blurb: "Suspected of a banned client, macro or unfair advantage.",
  },
  restricted: {
    kind: "restricted",
    headline: "Has Been Restricted",
    emoji: "⛔",
    roleName: "Restricted",
    timeoutMs: 30 * DAY,
    color: 0xf0a32e,
    blurb: "Broken a testing or conduct rule but is not banned outright.",
  },
  blacklist: {
    kind: "blacklist",
    headline: "Has Been Blacklisted",
    emoji: "☠️",
    roleName: "Blacklisted",
    timeoutMs: null,
    color: 0x000000,
    blurb: "Terminal. Repeat misconduct, or lying to staff during an appeal.",
  },
};

/**
 * Accepted duration units. Staff write "90d" far more often than
 * "90 days", so the parser accepts both rather than making them pick from a
 * dropdown for every ban.
 *
 * The leading `-?` is load-bearing: without it, "-5d" would match the "5" and
 * silently parse as a five-day ban, which is the opposite of what was typed.
 */
const DURATION_PATTERN = /(-)?(\d+(?:\.\d+)?)\s*(d|day|days|w|week|weeks|m|month|months|h|hour|hours)\b/i;

const UNIT_MS: Record<string, number> = {
  h: 60 * 60 * 1000,
  d: DAY,
  w: 7 * DAY,
  m: 30 * DAY,
};

/**
 * `"90 days"` -> 90, `"2 weeks"` -> 14, `"36h"` -> 1.5.
 *
 * Returns null rather than guessing, so a typo produces an error message
 * instead of a silent 30-day ban nobody asked for.
 */
export function parseDurationDays(input: string): number | null {
  const match = DURATION_PATTERN.exec(input.trim());
  if (!match) return null;
  // A negative duration is a typo, not a request — refuse rather than clamp.
  if (match[1]) return null;

  const amount = Number.parseFloat(match[2]);
  const unit = match[3].toLowerCase();
  const days = amount * (UNIT_MS[unit[0]] / DAY);
  if (!Number.isFinite(days) || days <= 0) return null;
  return Math.round(days * 100) / 100;
}

/** Renders a day count the way the punishments channel writes it. */
export function formatDuration(days: number): string {
  if (days % 1 !== 0) return `${days} Days`;
  return `${days} Day${days === 1 ? "" : "s"}`;
}
