/**
 * Every custom id used by the Vyntric Support ticket system.
 * Single source of truth so the builders and the router can never drift apart.
 */
export const IDS = {
  openPrefix: "vt:open:",
  formPrefix: "vt:form:",
  ratingPrefix: "vt:rate:",

  openTicket: (typeId: string) => `vt:open:${typeId}`,
  ticketForm: (typeId: string) => `vt:form:${typeId}`,
  rating: (ticketId: string, stars: number) => `vt:rate:${ticketId}:${stars}`,

  claim: "vt:claim",
  transcript: "vt:transcript",
  close: "vt:close",
  closeForm: "vt:closeform",
  reopen: "vt:reopen",
  delete: "vt:delete",
  priority: "vt:priority",

  /** Self-roles live on their own `vs:` namespace (Vyntric Self-roles). */
  rolePrefix: "vs:role:",
  roleButton: (roleId: string) => `vs:role:${roleId}`,

  /** Verification button custom ID */
  verifyButton: "vyntric:verify",
} as const;

/** `vs:role:<roleId>` -> roleId (or null when malformed). */
export function parseRoleCustomId(customId: string) {
  if (!customId.startsWith(IDS.rolePrefix)) return null;
  const roleId = customId.slice(IDS.rolePrefix.length);
  return /^\d{5,25}$/.test(roleId) ? roleId : null;
}

export function isTicketCustomId(customId: string) {
  return customId.startsWith("vt:");
}

/** `vt:rate:<ticketId>:<stars>` -> parts (or null when malformed). */
export function parseRatingId(customId: string) {
  const parts = customId.split(":");
  if (parts.length !== 4 || parts[0] !== "vt" || parts[1] !== "rate") return null;
  const stars = Number.parseInt(parts[3], 10);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) return null;
  return { ticketId: parts[2], stars };
}
