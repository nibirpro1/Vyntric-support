/**
 * The verified testing server registry.
 *
 * Modelled on the server's own server-list post, which grades every host with a
 * colour and then explains what each colour entitles you to:
 *
 *   👑  primary        may be enforced when players cannot agree on a host
 *   🟢  verified       may be forced by a Regulator for a tierlist fight
 *   🟡  mutual         usable when both players agree; admins may still force it
 *   ⚪  unlisted       not published, not usable for ranked tests
 */
export type ServerStatus = "primary" | "verified" | "mutual" | "unlisted";

export interface TestingServer {
  /** Hostname exactly as players type it. */
  host: string;
  region: string;
  status: ServerStatus;
  /** Optional note, e.g. "HT3+ only". */
  note?: string;
  /** A port or extra address appended to the host, when there is one. */
  alias?: string;
}

export const SERVER_STATUS_META: Record<
  ServerStatus,
  { dot: string; label: string; canForce: boolean; blurb: string }
> = {
  primary: {
    dot: "👑",
    label: "Primary",
    canForce: true,
    blurb: "Our primary testing server, which may be enforced if players cannot mutually agree on one.",
  },
  verified: {
    dot: "🟢",
    label: "Verified",
    canForce: true,
    blurb: "Verified testing server. A Regulator can force this host for a tierlist fight.",
  },
  mutual: {
    dot: "🟡",
    label: "Mutual agreement",
    canForce: true,
    blurb: "Allowed with mutual agreement. Administrators may force it as well if there is no other option.",
  },
  unlisted: {
    dot: "⚪",
    label: "Unlisted",
    canForce: false,
    blurb: "Not published for ranked testing.",
  },
};

/** The regions the server list is published by, in display order. */
export const SERVER_REGIONS = ["NA", "EU", "AS", "AU", "SA", "ME"] as const;

/**
 * The starting registry.
 *
 * Seeded from the published AS/AU list. Staff edit this through `/servers`, and
 * the file it writes to (`data/servers.json`) always wins over this seed once
 * it exists — so replacing an entry here is only a suggestion for a fresh
 * install, never a silent revert of a live edit.
 */
export const DEFAULT_SERVERS: TestingServer[] = [
  { host: "as.minecraftfranked.xyz", region: "AS", status: "verified" },
  { host: "as.mcpvp.club", region: "AS", status: "verified", alias: "au.mcpvp.club" },
  { host: "as.metalmc.vip", region: "AS", status: "verified" },
  { host: "as.minemen.club", region: "AS", status: "verified" },
  { host: "as.smpprac.xyz", region: "AS", status: "verified", note: "HT3+ server" },
  { host: "indianprac.xyz", region: "AS", status: "verified" },
  { host: "au.vexaxy.nl", region: "AS", status: "verified" },
  { host: "as.catpvp.xyz", region: "AS", status: "mutual", alias: "au.catpvp.xyz" },
  { host: "as.stray.gg", region: "AS", status: "mutual" },
  { host: "as.meowmc.fun", region: "AS", status: "mutual" },
  { host: "as.inpvp.xyz", region: "AS", status: "mutual" },
  { host: "oceanias.net", region: "AU", status: "mutual" },
  { host: "ocenet.club", region: "AU", status: "mutual" },
];

/**
 * Ping parity.
 *
 * A ranked fight is only comparable when both players are inside the same tick
 * range. The published rule is within 20ms of each other, and a player more
 * than 10ms outside the other's range has to spoof into it rather than
 * forfeiting.
 */
export const PING_TOLERANCE_MS = 20;
export const PING_SPOOF_THRESHOLD_MS = 10;

/**
 * Are two pings close enough for a ranked test?
 *
 * `spoofRequired` is separate from `fair` on purpose: a 15ms gap is playable
 * but the lower-ping player should spoof, whereas a 90ms gap cannot be spoofed
 * away and the fight is not ranked at all.
 */
export function checkPing(playerPing: number, opponentPing: number) {
  const gap = Math.abs(playerPing - opponentPing);
  const range = { low: Math.min(playerPing, opponentPing), high: Math.max(playerPing, opponentPing) };
  return {
    gap,
    range,
    fair: gap <= PING_TOLERANCE_MS,
    spoofRequired: gap > PING_SPOOF_THRESHOLD_MS && gap <= PING_TOLERANCE_MS,
  };
}
