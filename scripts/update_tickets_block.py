with open("src/lib/tickets.ts", "r", encoding="utf-8") as f:
    tickets_code = f.read()

# Update BLOCKED_BOT_PERMS and blockedBotOverwrites
old_target = """/** Denies that silence every other bot inside a ticket channel. */
const BLOCKED_BOT_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.AttachFiles,
];

/**
 * Overwrites that lock every other bot out of a ticket channel, so only
 * Vyntric Support (and staff) can see or answer anything in there.
 * Uses bot application roles (role tags), so it needs no member intent.
 */
function blockedBotOverwrites(guild: Guild, meId: string) {
  return guild.roles.cache
    .filter((role) => {
      const botId = role.tags?.botId;
      return Boolean(botId) && botId !== meId && !role.managed === false;
    })
    .map((role) => ({ id: role.id, deny: BLOCKED_BOT_PERMS }));
}"""

new_replacement = """/** Denies that silence every other bot inside a ticket channel. */
const BLOCKED_BOT_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.UseApplicationCommands,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.UseExternalStickers,
];

/**
 * Overwrites that lock every other bot out of a ticket channel, so only
 * Plugsy (and staff) can see or answer anything in there.
 * Denies bot integration roles, generic 'bot' roles, and individual bot member accounts.
 */
function blockedBotOverwrites(guild: Guild, meId: string) {
  const overwrites: { id: string; deny: bigint[] }[] = [];
  const addedIds = new Set<string>();

  // 1. Block every bot integration role (e.g. Carl-bot, Dyno, OwO) and generic "bot" roles
  for (const role of guild.roles.cache.values()) {
    const isBotRole = Boolean(role.tags?.botId && role.tags.botId !== meId);
    const isGenericBotRole = role.name.toLowerCase() === "bot" || role.name.toLowerCase() === "bots";
    if ((isBotRole || isGenericBotRole) && !addedIds.has(role.id)) {
      overwrites.push({ id: role.id, deny: BLOCKED_BOT_PERMS });
      addedIds.add(role.id);
    }
  }

  // 2. Explicitly block every other bot member in the server
  for (const member of guild.members.cache.values()) {
    if (member.user.bot && member.id !== meId && !addedIds.has(member.id)) {
      overwrites.push({ id: member.id, deny: BLOCKED_BOT_PERMS });
      addedIds.add(member.id);
    }
  }

  return overwrites;
}"""

crlf = "\r\n" in tickets_code
tickets_code = tickets_code.replace("\r\n", "\n")
old_target = old_target.replace("\r\n", "\n")
new_replacement = new_replacement.replace("\r\n", "\n")

if old_target in tickets_code:
    tickets_code = tickets_code.replace(old_target, new_replacement)
    if crlf:
        tickets_code = tickets_code.replace("\n", "\r\n")
    with open("src/lib/tickets.ts", "w", encoding="utf-8") as f:
        f.write(tickets_code)
    print("tickets.ts updated successfully!")
else:
    print("Could not find old_target in tickets.ts")
