import fs from "fs";
import path from "path";

/**
 * Vyntric Support storage layer.
 *
 * A single JSON document keeps the bot dependency-free (no database to host)
 * while still surviving restarts. Writes are debounced and atomic
 * (tmp file + rename) so a crash never leaves a half-written file behind.
 */
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketStatus = "open" | "closed";

export interface GuildSettings {
  guildId: string;
  /** Every role that can see + manage tickets. */
  staffRoleIds: string[];
  logChannelId: string | null;
  /** Category new tickets are created in (auto-created when null). */
  categoryId: string | null;
  /** Category closed tickets are moved to (auto-created when null). */
  archiveCategoryId: string | null;
  /** Channel that receives 1-5 star reviews after a ticket is closed. */
  feedbackChannelId: string | null;
  /** Channel that receives Vyntric Tiers test-result embeds. */
  resultsChannelId: string | null;
  /** Channel that receives high-tier test *requests* (the `high-tests` feed). */
  highTestsChannelId: string | null;
  /** Channel that receives high-tier test *outcomes* (the `high-results` feed). */
  highResultsChannelId: string | null;
  /** Channel that receives the punishment log. */
  punishmentsChannelId: string | null;
  /** Channel that receives staff role movements. */
  staffLogChannelId: string | null;
  /** Channel that receives retirement / appeal tickets. */
  appealsChannelId: string | null;
  /**
   * Discord role ids per Vyntric staff rung: tester / moderator / regulator /
   * head. Kept separate from `staffRoleIds` so promoting a tester never grants
   * them the ticket queue as a side effect.
   */
  tierRoleIds: Record<string, string[]>;
  pingStaff: boolean;
  dmTranscript: boolean;
  autoArchive: boolean;
  /** Standard event time shown in announcements + DM alerts (e.g. "9:00 PM daily"). */
  eventTime: string;
  ticketCounter: number;
  panelChannelId: string | null;
  panelMessageId: string | null;
  updatedAt: number;
}

/**
 * One demotion strike, kept as an append-only ledger.
 *
 * Strikes are never edited in place: a correction is a new record with the
 * opposite `delta`. That is what makes `/strike history` a real audit trail
 * rather than a running counter that can be quietly reset.
 */
export interface StrikeRecord {
  id: string;
  guildId: string;
  /** Minecraft username, lowercased for lookup. */
  player: string;
  gamemode: string;
  /** Positive adds strikes, negative removes them. */
  delta: number;
  /** Running total *after* this record, for a stable read of the history. */
  balance: number;
  reason: string;
  /** Discord user id of whoever logged it. */
  staffId: string;
  staffTag: string;
  createdAt: number;
}

/** One issued punishment. */
export interface PunishmentRecord {
  id: string;
  guildId: string;
  /** Discord user id of the punished member. */
  userId: string;
  username: string;
  kind: string;
  reason: string;
  /** null means indefinite. */
  durationDays: number | null;
  /** Set once lifted, so the record shows both what happened and the outcome. */
  liftedBy: string | null;
  liftedReason: string | null;
  liftedAt: number | null;
  staffId: string;
  staffTag: string;
  createdAt: number;
}

export interface TicketRecord {
  id: string;
  guildId: string;
  /** Per-guild counter, displayed as #0001. */
  number: number;
  type: string;
  channelId: string;
  channelName: string;
  ownerId: string;
  answers: Record<string, string>;
  status: TicketStatus;
  priority: TicketPriority;
  claimedBy: string | null;
  createdAt: number;
  closedAt: number | null;
  closedBy: string | null;
  closeReason: string | null;
  /** 1-5 stars left by the member after closing. */
  rating: number | null;
  headerMessageId: string | null;
  transcriptFile: string | null;
}

export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "done";

export interface TaskRecord {
  id: string;
  guildId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeTag: string | null;
  createdById: string;
  createdByTag: string;
  createdAt: number;
  updatedAt: number;
}

export type ProofType = "ban" | "mute" | "kick" | "warn" | "other";

export interface StaffProofRecord {
  id: string;
  guildId: string;
  target: string;
  type: ProofType;
  evidence: string;
  reason: string;
  staffId: string;
  staffTag: string;
  createdAt: number;
}

export type TrialStatus = "active" | "promoted" | "extended" | "demoted";

export interface TrialRecord {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  roleName: string;
  durationDays: number;
  startDate: number;
  endDate: number;
  status: TrialStatus;
  mentorId: string;
  mentorTag: string;
  notes: string;
}

export interface MeetingRecord {
  id: string;
  guildId: string;
  title: string;
  time: string;
  agenda: string;
  channelId: string | null;
  organizerId: string;
  organizerTag: string;
  attendees: string[];
  createdAt: number;
}

export interface MvpRecord {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  month: string;
  reason: string;
  awardedById: string;
  awardedByTag: string;
  createdAt: number;
}

interface StoreShape {
  version: number;
  settings: Record<string, GuildSettings>;
  tickets: TicketRecord[];
  strikes: StrikeRecord[];
  punishments: PunishmentRecord[];
  tasks: TaskRecord[];
  proofs: StaffProofRecord[];
  trials: TrialRecord[];
  meetings: MeetingRecord[];
  mvps: MvpRecord[];
}

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const TRANSCRIPT_DIR = path.join(DATA_DIR, "transcripts");

function ensureDirs() {
  for (const dir of [DATA_DIR, TRANSCRIPT_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function emptyStore(): StoreShape {
  return {
    version: 1,
    settings: {},
    tickets: [],
    strikes: [],
    punishments: [],
    tasks: [],
    proofs: [],
    trials: [],
    meetings: [],
    mvps: [],
  };
}

function readStore(): StoreShape {
  try {
    ensureDirs();
    if (!fs.existsSync(STORE_FILE)) return emptyStore();
    const raw = fs.readFileSync(STORE_FILE, "utf8").trim();
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return {
      version: parsed.version ?? 1,
      settings: parsed.settings ?? {},
      tickets: parsed.tickets ?? [],
      strikes: Array.isArray(parsed.strikes) ? parsed.strikes : [],
      punishments: Array.isArray(parsed.punishments) ? parsed.punishments : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      proofs: Array.isArray(parsed.proofs) ? parsed.proofs : [],
      trials: Array.isArray(parsed.trials) ? parsed.trials : [],
      meetings: Array.isArray(parsed.meetings) ? parsed.meetings : [],
      mvps: Array.isArray(parsed.mvps) ? parsed.mvps : [],
    };
  } catch (err) {
    console.error("[store] Could not read store.json - starting from an empty store.", err);
    return emptyStore();
  }
}

let store: StoreShape = readStore();
let writeTimer: NodeJS.Timeout | null = null;

function writeNow() {
  try {
    ensureDirs();
    const tmp = `${STORE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tmp, STORE_FILE);
  } catch (err) {
    console.error("[store] Failed to persist store.json", err);
  }
}

/** Debounced + atomic persist. */
function persist() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    writeNow();
  }, 200);
}

/** Force an immediate flush (used on shutdown). */
export function flushStore() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  writeNow();
}

export function newId(prefix = "t") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_EVENT_TIME = "9:00 PM (daily)";

export function getSettings(guildId: string): GuildSettings {
  const existing = store.settings[guildId];
  if (existing) {
    if (!Array.isArray(existing.staffRoleIds)) existing.staffRoleIds = [];
    if (!existing.eventTime) existing.eventTime = DEFAULT_EVENT_TIME;
    // Settings written before the tier channels existed get them filled in as
    // null on first read, so every command can read `settings.X` without
    // guarding each one.
    for (const key of [
      "highTestsChannelId",
      "highResultsChannelId",
      "punishmentsChannelId",
      "staffLogChannelId",
      "appealsChannelId",
    ] as const) {
      if (existing[key] === undefined) existing[key] = null;
    }
    // Same for the staff hierarchy map, which post-dates the settings file.
    if (!existing.tierRoleIds || typeof existing.tierRoleIds !== "object") {
      existing.tierRoleIds = {};
    }
    return existing;
  }

  const created: GuildSettings = {
    guildId,
    staffRoleIds: [],
    logChannelId: null,
    categoryId: null,
    archiveCategoryId: null,
    feedbackChannelId: null,
    resultsChannelId: null,
    highTestsChannelId: null,
    highResultsChannelId: null,
    punishmentsChannelId: null,
    staffLogChannelId: null,
    appealsChannelId: null,
    tierRoleIds: {},
    pingStaff: true,
    dmTranscript: true,
    autoArchive: true,
    eventTime: process.env.EVENT_TIME || DEFAULT_EVENT_TIME,
    ticketCounter: 0,
    panelChannelId: null,
    panelMessageId: null,
    updatedAt: Date.now(),
  };

  store.settings[guildId] = created;
  persist();
  return created;
}

export function updateSettings(guildId: string, patch: Partial<GuildSettings>): GuildSettings {
  const settings = { ...getSettings(guildId), ...patch, guildId, updatedAt: Date.now() };
  store.settings[guildId] = settings;
  persist();
  return settings;
}

export function resetSettings(guildId: string) {
  const settings = getSettings(guildId);
  store.settings[guildId] = {
    ...settings,
    staffRoleIds: [],
    logChannelId: null,
    categoryId: null,
    archiveCategoryId: null,
    feedbackChannelId: null,
    resultsChannelId: null,
    highTestsChannelId: null,
    highResultsChannelId: null,
    punishmentsChannelId: null,
    staffLogChannelId: null,
    appealsChannelId: null,
    tierRoleIds: {},
    pingStaff: true,
    dmTranscript: true,
    autoArchive: true,
    eventTime: settings.eventTime || DEFAULT_EVENT_TIME,
    panelChannelId: null,
    panelMessageId: null,
    updatedAt: Date.now(),
  };
  persist();
  return store.settings[guildId];
}

export function nextTicketNumber(guildId: string) {
  const settings = getSettings(guildId);
  settings.ticketCounter += 1;
  settings.updatedAt = Date.now();
  persist();
  return settings.ticketCounter;
}

export function createTicket(record: Omit<TicketRecord, "id">): TicketRecord {
  const ticket: TicketRecord = { ...record, id: newId("ticket") };
  store.tickets.push(ticket);
  persist();
  return ticket;
}

export function getTicket(id: string) {
  return store.tickets.find((ticket) => ticket.id === id);
}

export function findTicketByChannel(channelId: string) {
  return store.tickets.find((ticket) => ticket.channelId === channelId);
}

export function findOpenTicket(guildId: string, ownerId: string) {
  return store.tickets.find(
    (ticket) => ticket.guildId === guildId && ticket.ownerId === ownerId && ticket.status === "open"
  );
}

export function findOpenTicketOfType(guildId: string, ownerId: string, type: string) {
  return store.tickets.find(
    (ticket) =>
      ticket.guildId === guildId &&
      ticket.ownerId === ownerId &&
      ticket.type === type &&
      ticket.status === "open"
  );
}

export function listTickets(guildId: string, status?: TicketStatus) {
  return store.tickets
    .filter((ticket) => ticket.guildId === guildId && (!status || ticket.status === status))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function updateTicket(id: string, patch: Partial<TicketRecord>) {
  const ticket = getTicket(id);
  if (!ticket) return undefined;
  Object.assign(ticket, patch);
  persist();
  return ticket;
}

/** Absolute path of the transcript folder (created on demand). */
export function transcriptsDir() {
  ensureDirs();
  return TRANSCRIPT_DIR;
}



/* ============================================================================
   Strike ledger
   --------------------------------------------------------------------------
   Append-only. A correction is a new record with a negative delta, so the
   history always shows how a balance got to where it is.
   ========================================================================== */

/** Current strike balance for one player in one gamemode. */
export function strikeBalance(guildId: string, player: string, gamemode: string): number {
  const q = player.trim().toLowerCase();
  return store.strikes
    .filter((s) => s.guildId === guildId && s.player === q && s.gamemode === gamemode)
    .reduce((sum, record) => sum + record.delta, 0);
}

/** Totals across every gamemode, for the `/strike view` overview. */
export function strikeTotals(guildId: string, player: string) {
  const q = player.trim().toLowerCase();
  const byMode: Record<string, number> = {};
  for (const record of store.strikes.filter((s) => s.guildId === guildId && s.player === q)) {
    byMode[record.gamemode] = (byMode[record.gamemode] ?? 0) + record.delta;
  }
  return byMode;
}

/**
 * Appends a strike movement and returns the new balance.
 *
 * The balance is recomputed from the whole ledger rather than incremented, so a
 * balance that was edited or restored by hand can never drift.
 */
export function addStrike(input: {
  guildId: string;
  player: string;
  gamemode: string;
  delta: number;
  reason: string;
  staffId: string;
  staffTag: string;
}): StrikeRecord {
  const q = input.player.trim().toLowerCase();
  const prior = store.strikes
    .filter((s) => s.guildId === input.guildId && s.player === q && s.gamemode === input.gamemode)
    .reduce((sum, record) => sum + record.delta, 0);

  const record: StrikeRecord = {
    id: newId("strike"),
    guildId: input.guildId,
    player: q,
    gamemode: input.gamemode,
    delta: input.delta,
    balance: prior + input.delta,
    reason: input.reason,
    staffId: input.staffId,
    staffTag: input.staffTag,
    createdAt: Date.now(),
  };
  store.strikes.push(record);
  persist();
  return record;
}

export function listStrikes(guildId: string, player?: string, gamemode?: string) {
  const q = player?.trim().toLowerCase();
  return store.strikes
    .filter(
      (s) =>
        s.guildId === guildId &&
        (!q || s.player === q) &&
        (!gamemode || s.gamemode === gamemode)
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

/* ============================================================================
   Punishment log
   ========================================================================== */

export function addPunishment(
  input: Omit<PunishmentRecord, "id" | "createdAt" | "liftedBy" | "liftedReason" | "liftedAt">
): PunishmentRecord {
  const record: PunishmentRecord = {
    ...input,
    id: newId("pun"),
    createdAt: Date.now(),
    liftedBy: null,
    liftedReason: null,
    liftedAt: null,
  };
  store.punishments.push(record);
  persist();
  return record;
}

/** The most recent record for a member, so a second ban can reference the first. */
export function latestPunishment(guildId: string, userId: string) {
  return store.punishments
    .filter((p) => p.guildId === guildId && p.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

export function listPunishments(guildId: string, userId?: string) {
  return store.punishments
    .filter((p) => p.guildId === guildId && (!userId || p.userId === userId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Marks a punishment lifted. Returns null when the id is unknown. */
export function liftPunishment(id: string, staffTag: string, reason: string): PunishmentRecord | null {
  const record = store.punishments.find((p) => p.id === id);
  if (!record) return null;
  record.liftedBy = staffTag;
  record.liftedReason = reason;
  record.liftedAt = Date.now();
  persist();
  return record;
}

/* ============================================================================
   Task board & Project management
   ========================================================================== */
export function createTask(input: Omit<TaskRecord, "id" | "createdAt" | "updatedAt">): TaskRecord {
  const count = store.tasks.filter((t) => t.guildId === input.guildId).length + 1;
  const task: TaskRecord = {
    ...input,
    id: `TSK-${count}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  store.tasks.push(task);
  persist();
  return task;
}

export function listTasks(guildId: string, status?: TaskStatus): TaskRecord[] {
  return store.tasks
    .filter((t) => t.guildId === guildId && (!status || t.status === status))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getTask(guildId: string, id: string): TaskRecord | undefined {
  return store.tasks.find((t) => t.guildId === guildId && t.id.toLowerCase() === id.toLowerCase());
}

export function updateTask(guildId: string, id: string, patch: Partial<TaskRecord>): TaskRecord | null {
  const task = getTask(guildId, id);
  if (!task) return null;
  Object.assign(task, patch, { updatedAt: Date.now() });
  persist();
  return task;
}

export function deleteTask(guildId: string, id: string): boolean {
  const idx = store.tasks.findIndex((t) => t.guildId === guildId && t.id.toLowerCase() === id.toLowerCase());
  if (idx === -1) return false;
  store.tasks.splice(idx, 1);
  persist();
  return true;
}

/* ============================================================================
   Staff Proofs & Evidence
   ========================================================================== */
export function addStaffProof(input: Omit<StaffProofRecord, "id" | "createdAt">): StaffProofRecord {
  const record: StaffProofRecord = {
    ...input,
    id: newId("prf"),
    createdAt: Date.now(),
  };
  store.proofs.push(record);
  persist();
  return record;
}

export function listStaffProofs(guildId: string, target?: string): StaffProofRecord[] {
  const q = target?.trim().toLowerCase();
  return store.proofs
    .filter((p) => p.guildId === guildId && (!q || p.target.toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/* ============================================================================
   Trial management
   ========================================================================== */
export function addTrial(input: Omit<TrialRecord, "id" | "startDate" | "endDate" | "status">): TrialRecord {
  const now = Date.now();
  const endDate = now + input.durationDays * 24 * 60 * 60 * 1000;
  const record: TrialRecord = {
    ...input,
    id: newId("trl"),
    startDate: now,
    endDate,
    status: "active",
  };
  store.trials.push(record);
  persist();
  return record;
}

export function listTrials(guildId: string, status?: TrialStatus): TrialRecord[] {
  return store.trials
    .filter((t) => t.guildId === guildId && (!status || t.status === status))
    .sort((a, b) => b.startDate - a.startDate);
}

export function getActiveTrial(guildId: string, userId: string): TrialRecord | undefined {
  return store.trials.find((t) => t.guildId === guildId && t.userId === userId && t.status === "active");
}

export function concludeTrial(
  guildId: string,
  userId: string,
  decision: "promoted" | "extended" | "demoted",
  notes?: string
): TrialRecord | null {
  const trial = getActiveTrial(guildId, userId);
  if (!trial) return null;
  trial.status = decision;
  if (notes) trial.notes = notes;
  persist();
  return trial;
}

/* ============================================================================
   Meeting Scheduler & Sync
   ========================================================================== */
export function scheduleMeeting(input: Omit<MeetingRecord, "id" | "attendees" | "createdAt">): MeetingRecord {
  const record: MeetingRecord = {
    ...input,
    id: newId("mtg"),
    attendees: [],
    createdAt: Date.now(),
  };
  store.meetings.push(record);
  persist();
  return record;
}

export function listMeetings(guildId: string): MeetingRecord[] {
  return store.meetings
    .filter((m) => m.guildId === guildId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getMeeting(id: string): MeetingRecord | undefined {
  return store.meetings.find((m) => m.id === id);
}

export function toggleRsvpMeeting(id: string, userId: string): { meeting: MeetingRecord; attending: boolean } | null {
  const meeting = getMeeting(id);
  if (!meeting) return null;
  const idx = meeting.attendees.indexOf(userId);
  let attending = false;
  if (idx === -1) {
    meeting.attendees.push(userId);
    attending = true;
  } else {
    meeting.attendees.splice(idx, 1);
    attending = false;
  }
  persist();
  return { meeting, attending };
}

/* ============================================================================
   Staff of the Month / MVP Recognition
   ========================================================================== */
export function awardMvp(input: Omit<MvpRecord, "id" | "createdAt">): MvpRecord {
  const record: MvpRecord = {
    ...input,
    id: newId("mvp"),
    createdAt: Date.now(),
  };
  store.mvps.push(record);
  persist();
  return record;
}

export function listMvp(guildId: string): MvpRecord[] {
  return store.mvps
    .filter((m) => m.guildId === guildId)
    .sort((a, b) => b.createdAt - a.createdAt);
}


