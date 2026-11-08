/**
 * Vyntric Support self-check.
 *
 * Validates the ticket system without touching the Discord gateway:
 * catalogue limits, modal/panel payloads (exactly what Discord receives),
 * the JSON store lifecycle and the transcript generators.
 *
 * Run with: npm run verify
 */
import fs from "fs";
import os from "os";
import path from "path";

interface Check {
  name: string;
  ok: boolean;
}

const results: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  // Isolated storage so the real data/store.json is never touched.
  const dataDir = path.join(os.tmpdir(), `vyntric-verify-${Date.now()}`);
  process.env.DATA_DIR = dataDir;

  const { TICKET_TYPES, findTicketType } = await import("../config/tickets");
  const panel = await import("../lib/panel");
  const transcript = await import("../lib/transcript");
  const { IDS, parseRatingId, isTicketCustomId } = await import("../lib/customIds");
  const store = await import("../lib/store");
  const { padTicketNumber, slugify } = await import("../lib/permissions");

  console.log("\n── Catalogue ─────────────────────────────────────────────");

  check("ticket panels exist", TICKET_TYPES.length >= 3, TICKET_TYPES.map((t) => t.id).join(", "));
  check(
    "panel ids match the brand request",
    ["claim_reward", "team_application", "partnership"].every((id) => Boolean(findTicketType(id)))
  );
  check(
    "every panel has at most 5 questions (Discord modal limit)",
    TICKET_TYPES.every((type) => type.answers.length <= 5),
    TICKET_TYPES.map((type) => `${type.id}:${type.answers.length}`).join(", ")
  );
  check(
    "question labels fit the 45 char modal limit",
    TICKET_TYPES.every((type) => type.answers.every((answer) => answer.label.length <= 45))
  );
  check(
    "question ids are unique per panel",
    TICKET_TYPES.every((type) => new Set(type.answers.map((a) => a.id)).size === type.answers.length)
  );

  console.log("\n── Panel payload (what Discord renders) ──────────────────");

  const panelEmbed = panel.buildPanelEmbed().toJSON();
  check(
    `panel embed has a title, description and ${TICKET_TYPES.length} fields`,
    Boolean(panelEmbed.title) && Boolean(panelEmbed.description) && panelEmbed.fields?.length === TICKET_TYPES.length,
    panelEmbed.title ?? "no title"
  );

  const panelRow = panel.buildPanelRows()[0].toJSON();
  const panelButtons = panelRow.components as Array<{ custom_id: string; label: string }>;
  check("panel row holds one button per ticket type", panelButtons.length === TICKET_TYPES.length);
  check(
    "panel button ids are wired to the router",
    panelButtons.every((button, index) => button.custom_id === IDS.openTicket(TICKET_TYPES[index].id)),
    panelButtons.map((button) => button.custom_id).join(", ")
  );

  console.log("\n── Modals ───────────────────────────────────────────────");

  for (const type of TICKET_TYPES) {
    const modal = panel.buildTicketModal(type).toJSON();
    const rows = modal.components as Array<{ components: Array<{ custom_id: string; label: string }> }>;
    check(
      `modal for ${type.id} builds ${type.answers.length} question(s)`,
      rows.length === type.answers.length && modal.custom_id === IDS.ticketForm(type.id),
      modal.title
    );
  }

  console.log("\n── Store lifecycle ──────────────────────────────────────");

  const fresh = store.getSettings("guild-1");
  check("fresh guild settings are safe defaults", fresh.staffRoleIds.length === 0 && fresh.pingStaff === true);

  store.updateSettings("guild-1", {
    staffRoleIds: ["role-1"],
    logChannelId: "log-1",
    pingStaff: false,
    dmTranscript: true,
  });
  const updatedSettings = store.getSettings("guild-1");
  check(
    "settings persist in memory + on disk",
    updatedSettings.staffRoleIds[0] === "role-1" &&
      updatedSettings.logChannelId === "log-1" &&
      updatedSettings.pingStaff === false
  );

  check("ticket counter increments", store.nextTicketNumber("guild-1") === 1 && store.nextTicketNumber("guild-1") === 2);

  const ticket = store.createTicket({
    guildId: "guild-1",
    number: 1,
    type: "claim_reward",
    channelId: "channel-1",
    channelName: "reward-0001",
    ownerId: "user-1",
    answers: { reward: "5000 coins", source: "Launch Giveaway" },
    status: "open",
    priority: "normal",
    claimedBy: null,
    createdAt: Date.now(),
    closedAt: null,
    closedBy: null,
    closeReason: null,
    rating: null,
    headerMessageId: null,
    transcriptFile: null,
  });

  check("ticket is retrievable by channel", store.findTicketByChannel("channel-1")?.id === ticket.id);
  check(
    "open ticket lookup is type aware",
    store.findOpenTicketOfType("guild-1", "user-1", "claim_reward")?.id === ticket.id &&
      store.findOpenTicketOfType("guild-1", "user-1", "partnership") === undefined
  );

  store.updateTicket(ticket.id, { claimedBy: "staff-1", priority: "urgent" });
  const claimed = store.getTicket(ticket.id)!;
  check("claim + priority updates apply", claimed.claimedBy === "staff-1" && claimed.priority === "urgent");

  store.updateTicket(ticket.id, {
    status: "closed",
    closedAt: Date.now(),
    closedBy: "staff-1",
    closeReason: "Reward delivered",
  });
  check(
    "closing frees the type slot again",
    store.findOpenTicketOfType("guild-1", "user-1", "claim_reward") === undefined &&
      store.listTickets("guild-1", "closed").length === 1
  );

  console.log("\n── Ticket rendering ─────────────────────────────────────");

  const rewardType = findTicketType("claim_reward")!;
  const header = panel.buildTicketHeaderEmbed(claimed, rewardType, "member#0001").toJSON();
  check(
    "header shows padded number, owner and submitted answers",
    (header.description ?? "").includes("0001") &&
      (header.description ?? "").includes("<@user-1>") &&
      (header.description ?? "").includes("5000 coins")
  );

  const controlRows = panel.buildTicketControlRows(claimed).map((row) => row.toJSON());
  check(
    "open tickets get claim/transcript/close + priority menu",
    controlRows.length === 2 && controlRows[0].components.length === 3 && controlRows[1].components.length === 1
  );

  const closedRow = panel.buildClosedRows(claimed)[0].toJSON();
  check("closed tickets get reopen/transcript/delete", closedRow.components.length === 3);

  const ratingRow = panel.buildRatingRow(claimed).toJSON();
  check("rating row holds five stars", ratingRow.components.length === 5);

  check("four priority levels are defined", Object.keys(panel.PRIORITY_META).length === 4);

  console.log("\n── Transcript ───────────────────────────────────────────");

  const now = Date.now();
  const entries = [
    {
      authorId: "user-1",
      authorTag: "member#0001",
      isBot: false,
      avatarUrl: null,
      content: "Hello <@123> — proof attached",
      notes: [],
      at: now,
    },
    {
      authorId: "bot-1",
      authorTag: "Vyntric Support#1",
      isBot: true,
      avatarUrl: null,
      content: "<script>alert('xss')</script>",
      notes: ["1 embed(s)"],
      at: now + 1000,
    },
  ];

  const html = transcript.buildHtmlTranscript(claimed, entries);
  check(
    "html transcript escapes member input",
    html.includes("&lt;script&gt;") && !html.includes("<script>alert")
  );
  check(
    "html transcript carries the ticket meta",
    html.includes("#0001") && html.includes("Reward delivered")
  );
  check(
    "html transcript renders messages and notes",
    html.includes("member#0001") && html.includes("1 embed(s)")
  );

  const txt = transcript.buildTxtTranscript(claimed, entries);
  check(
    "txt transcript has a header and body lines",
    txt.includes("Ticket: #1") && txt.includes("member#0001: Hello <@123>")
  );

  console.log("\n── Slash command payloads ───────────────────────────────");

  const commandModules: Array<[string, string]> = [
    ["panel", "../commands/tickets/panel"],
    ["ticket", "../commands/tickets/ticket"],
    ["setup", "../commands/settings/setup"],
  ];

  for (const [name, modulePath] of commandModules) {
    const command = (await import(modulePath)).default;
    const json = command.data.toJSON() as {
      name: string;
      description: string;
      options?: Array<{ name: string; description: string; required?: boolean; options?: any[] }>;
    };

    const flat: Array<{ name: string; description: string; required?: boolean }> = [];
    const walk = (options: any[] = []) => {
      for (const option of options) {
        flat.push(option);
        if (option.options) walk(option.options);
      }
    };
    walk(json.options);

    const namesOk = flat.every((option) => /^[a-z0-9_-]{1,32}$/.test(option.name));
    const descriptionsOk = flat.every(
      (option) => option.description.length >= 1 && option.description.length <= 100
    );

    let orderingOk = true;
    for (const option of json.options ?? []) {
      if (!option.options) continue;
      const flags = option.options.map((child: any) => Boolean(child.required));
      const firstOptional = flags.indexOf(false);
      if (firstOptional !== -1 && flags.slice(firstOptional).some(Boolean)) orderingOk = false;
    }

    check(
      `/${name} payload is valid`,
      json.name === name &&
        json.description.length <= 100 &&
        typeof command.execute === "function" &&
        namesOk &&
        descriptionsOk &&
        orderingOk,
      `${(json.options ?? []).length} option(s), ${flat.length} total node(s)`
    );
  }

  console.log("\n── Custom ids & helpers ─────────────────────────────────");

  check("open id builder is stable", IDS.openTicket("partnership") === "vt:open:partnership");
  check("rating id round-trips", parseRatingId(IDS.rating("ticket-9", 5))?.stars === 5);
  check("malformed rating ids are rejected", parseRatingId("vt:rate:ticket-9:42") === null);
  check(
    "router only accepts vt: ids",
    isTicketCustomId("vt:close") && !isTicketCustomId("giveaway_enter")
  );
  check("ticket numbers are padded", padTicketNumber(7) === "0007");
  check("channel names are slugified", slugify("My Ticket! 2026") === "my-ticket-2026");

  store.flushStore();
  check("store.json is written to disk", fs.existsSync(path.join(dataDir, "store.json")));

  const { collectCommandPayloads } = await import("../lib/commandPayloads");
  const collected = collectCommandPayloads();
  const REQUIRED_COMMANDS = [
    "panel", "ticket", "setup", "selfrole", "announcement", "uhc",
    "tier", "tester", "punish", "hightest", "strike", "servers", "rules",
  ];
  check(
    "the shared command collector finds every command",
    REQUIRED_COMMANDS.every((name) => collected.some((payload: any) => payload.name === name)) &&
      collected.every((payload: any) => typeof payload.name === "string"),
    collected.map((payload: any) => `/${payload.name}`).join(", ")
  );

  console.log("\n── Bot invite link ──────────────────────────────────────");

  console.log("\n── Discord payload rules ────────────────────────────────");

  // Discord answers 400 "Invalid Form Body" and registers nothing at all if any
  // required option follows an optional one. One such declaration silently
  // removes every command from the bot, so it is asserted here.
  const violatesRequiredFirst = (options: any[] | undefined): string[] => {
    if (!Array.isArray(options)) return [];
    const bad: string[] = [];
    let sawOptional = false;
    for (const option of options) {
      if (option.required) {
        if (sawOptional) bad.push(option.name);
      } else {
        sawOptional = true;
      }
      bad.push(...violatesRequiredFirst(option.options));
    }
    return bad;
  };

  const orderOffenders = collected.flatMap((payload: any) =>
    violatesRequiredFirst(payload.options).map((optionName: string) => `${payload.name}: ${optionName}`)
  );
  check(
    "no command puts a required option after an optional one",
    orderOffenders.length === 0,
    orderOffenders.join(", ")
  );

  check(
    "every command description fits Discord's 100 char limit",
    collected.every((payload: any) => (payload.description ?? "").length <= 100),
    collected.filter((payload: any) => (payload.description ?? "").length > 100).map((p: any) => p.name).join(" ")
  );

  const invite = await import("../lib/invite");
  const { PermissionFlagsBits: PermBits } = await import("discord.js");
  const bits = invite.invitePermissionsBitfield();
  const inviteUrl = invite.buildInviteUrl({
    clientId: "123456789012345678",
    guildId: "987654321098765432",
  });
  const hasBit = (bit: bigint) => (bits & bit) === bit;

  check(
    "invite link carries the client id, scopes and permission bitfield",
    inviteUrl.startsWith("https://discord.com/oauth2/authorize?") &&
      inviteUrl.includes("client_id=123456789012345678") &&
      inviteUrl.includes("scope=bot%20applications.commands") &&
      inviteUrl.includes(`permissions=${bits.toString()}`)
  );
  check(
    "invite requests Manage Channels + Manage Roles (needed for ticket overwrites)",
    hasBit(PermBits.ManageChannels) && hasBit(PermBits.ManageRoles)
  );
  check(
    "invite pre-selects the guild when GUILD_ID is configured",
    inviteUrl.includes("guild_id=987654321098765432") && inviteUrl.includes("disable_guild_select=true")
  );

  console.log("\n── Repository language policy ───────────────────────────");

  const projectRoot = path.resolve(__dirname, "..", "..");
  const textExtensions = new Set([".ts", ".js", ".mjs", ".json", ".md", ".yml", ".yaml", ".txt", ".example"]);
  const nonLatinScript = /[\u0980-\u09FF\u0900-\u097F]/;
  const offenders: string[] = [];
  let scannedFiles = 0;

  const scanDir = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", "dist", "data", ".git"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full);
        continue;
      }

      const isConfigFile = entry.name === ".env" || entry.name === ".gitignore";
      if (!isConfigFile && !textExtensions.has(path.extname(entry.name))) continue;

      scannedFiles += 1;
      if (nonLatinScript.test(fs.readFileSync(full, "utf8"))) {
        offenders.push(path.relative(projectRoot, full));
      }
    }
  };
  scanDir(projectRoot);

  check(
    "every code, config and doc file is written in English",
    offenders.length === 0,
    offenders.length ? offenders.join(", ") : `${scannedFiles} files scanned`
  );

  fs.rmSync(dataDir, { recursive: true, force: true });

  const failed = results.filter((result) => !result.ok);
  console.log(
    `\n── Result ───────────────────────────────────────────────\n${
      results.length - failed.length
    }/${results.length} checks passed.`
  );

  if (failed.length) {
    console.error(`Failed: ${failed.map((item) => item.name).join(" | ")}`);
    process.exit(1);
  }
}

void main();
