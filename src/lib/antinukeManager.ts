import {
  AuditLogEvent,
  EmbedBuilder,
  Guild,
  GuildAuditLogsEntry,
  GuildMember,
  PartialUser,
  PermissionFlagsBits,
  TextChannel,
  User,
} from "discord.js";
import { AntiNukeConfig, getAntiNukeConfig } from "./antinukeStore";
import { BRAND } from "./brand";

// Sliding-window action tracker: Map<key, timestamp[]>
const actionTracker = new Map<string, number[]>();

export function isImmune(guild: Guild, userId: string): boolean {
  if (!userId) return true;
  // Bot itself is immune
  if (guild.client.user && userId === guild.client.user.id) return true;
  // Server Owner is always immune
  if (guild.ownerId === userId) return true;

  const config = getAntiNukeConfig(guild.id);
  // Extra owners are immune
  if (config.extraOwners.includes(userId)) return true;
  // Whitelisted users are immune
  if (config.whitelistedUsers.includes(userId)) return true;

  // Check whitelisted roles
  if (config.whitelistedRoles.length > 0) {
    const member = guild.members.cache.get(userId);
    if (member && member.roles.cache.some((r) => config.whitelistedRoles.includes(r.id))) {
      return true;
    }
  }

  return false;
}

/**
 * Checks sliding window action count. Returns true if rate limit was exceeded.
 */
export function checkRateLimit(
  guildId: string,
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number
): boolean {
  const key = `${guildId}:${userId}:${action}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const timestamps = (actionTracker.get(key) || []).filter((ts) => now - ts < windowMs);
  timestamps.push(now);
  actionTracker.set(key, timestamps);

  return timestamps.length > limit;
}

const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.MentionEveryone,
];

/**
 * Executes anti-nuke punishment on the offender (Ban, Kick, or Quarantine/Role Strip).
 */
export async function executePunishment(
  guild: Guild,
  userId: string,
  reason: string,
  config: AntiNukeConfig
): Promise<string> {
  const member =
    guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));

  const botMember = guild.members.me;

  // Check hierarchy before attempting punishment
  if (member && botMember && botMember.roles.highest.position <= member.roles.highest.position) {
    console.warn(`[antinuke:punish] Cannot punish ${member.user.tag}: higher or equal in role hierarchy.`);
    return "Failed: Bot role is lower in hierarchy than offender";
  }

  if (config.punishment === "ban") {
    try {
      await guild.members.ban(userId, { reason: `[Krypton Anti-Nuke] ${reason}` });
      return "Banned from server";
    } catch (err: any) {
      console.error("[antinuke:ban:error]", err);
      return `Ban failed (${err.message})`;
    }
  }

  if (config.punishment === "kick") {
    try {
      if (member) {
        await member.kick(`[Krypton Anti-Nuke] ${reason}`);
        return "Kicked from server";
      }
      return "Kick failed (Member not in server)";
    } catch (err: any) {
      console.error("[antinuke:kick:error]", err);
      return `Kick failed (${err.message})`;
    }
  }

  // Quarantine: Strip dangerous admin/mod roles
  if (config.punishment === "quarantine" && member) {
    try {
      const dangerousRoles = member.roles.cache.filter((role) => {
        if (role.id === guild.id) return false; // @everyone
        return DANGEROUS_PERMISSIONS.some((perm) => role.permissions.has(perm));
      });

      if (dangerousRoles.size > 0) {
        await member.roles.remove(
          dangerousRoles,
          `[Krypton Anti-Nuke Quarantine] Stripped admin permissions: ${reason}`
        );
        return `Quarantined (Stripped ${dangerousRoles.size} admin/mod role(s))`;
      }
      return "Quarantined (No administrative roles found)";
    } catch (err: any) {
      console.error("[antinuke:quarantine:error]", err);
      return `Quarantine failed (${err.message})`;
    }
  }

  return "No punishment executed";
}

/**
 * Sends a high-visibility security alert embed to the security log channel and DMs server owners.
 */
export async function sendAntiNukeAlert(options: {
  guild: Guild;
  executor: User | PartialUser | { id: string; tag?: string };
  actionName: string;
  details: string;
  punishmentResult: string;
  config: AntiNukeConfig;
}) {
  const { guild, executor, actionName, details, punishmentResult, config } = options;

  const embed = new EmbedBuilder()
    .setColor(0xb1121f) // Crimson Red Alert
    .setAuthor({
      name: `🛡️ KRYPTON ANTI-NUKE PROTECTION`,
      iconURL: guild.iconURL() || undefined,
    })
    .setTitle(`🚨 UNAUTHORIZED ACTION DETECTED & NEUTRALIZED`)
    .setDescription(
      `An automated protection rule was triggered in **${guild.name}**. The offending action was intercepted and punishment was executed.`
    )
    .addFields(
      {
        name: "👤 Offender",
        value: `<@${executor.id}> (\`${executor.tag || executor.id}\`)`,
        inline: true,
      },
      {
        name: "⚡ Triggered Module",
        value: `**${actionName}**`,
        inline: true,
      },
      {
        name: "⚖️ Action Executed",
        value: `\`${punishmentResult}\``,
        inline: true,
      },
      {
        name: "📌 Target / Details",
        value: details,
        inline: false,
      }
    )
    .setFooter({
      text: `${BRAND.name} Security System • 24/7 Server Shield`,
      iconURL: guild.client.user?.displayAvatarURL(),
    })
    .setTimestamp();

  // Send to Security Log Channel
  if (config.logChannelId) {
    try {
      const channel =
        (guild.channels.cache.get(config.logChannelId) as TextChannel | undefined) ||
        ((await guild.channels.fetch(config.logChannelId).catch(() => null)) as TextChannel | null);

      if (channel && channel.isTextBased()) {
        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error("[antinuke:log:error]", err);
    }
  }

  // Notify Server Owner & Extra Owners via DM
  const ownerIds = Array.from(new Set([guild.ownerId, ...(config.extraOwners || [])]));
  for (const ownerId of ownerIds) {
    try {
      const user = await guild.client.users.fetch(ownerId).catch(() => null);
      if (user) {
        await user.send({ embeds: [embed] }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }
}

/**
 * Dispatches an Anti-Nuke event inspection.
 * Fetches the audit log to identify executor, verifies immunity, checks rate limits, and punishes if breached.
 */
export async function handleAntiNukeEvent(options: {
  guild: Guild;
  auditType: AuditLogEvent;
  moduleKey: keyof AntiNukeConfig["features"];
  moduleName: string;
  targetDetails: string;
  targetId?: string;
}) {
  const { guild, auditType, moduleKey, moduleName, targetDetails, targetId } = options;

  const config = getAntiNukeConfig(guild.id);
  if (!config.enabled) return;

  const feature = config.features[moduleKey];
  if (!feature || !feature.enabled) return;

  try {
    // Wait briefly for Discord audit log to populate
    await new Promise((r) => setTimeout(r, 700));

    const auditLogs = await guild.fetchAuditLogs({
      limit: 3,
      type: auditType,
    });

    const entry = auditLogs.entries.find((e) => {
      if (targetId && e.targetId) {
        return e.targetId === targetId;
      }
      return Date.now() - e.createdTimestamp < 8000;
    }) || auditLogs.entries.first();

    if (!entry || !entry.executor) return;

    const executor = entry.executor;

    // Check immunity
    if (isImmune(guild, executor.id)) return;

    // Check rate limit if applicable
    if ("limit" in feature && "windowSeconds" in feature) {
      const exceeded = checkRateLimit(
        guild.id,
        executor.id,
        moduleKey,
        feature.limit,
        feature.windowSeconds
      );

      if (!exceeded) return;
    }

    // Rate limit breached or instant action!
    const punishmentResult = await executePunishment(
      guild,
      executor.id,
      `Exceeded threshold on ${moduleName}`,
      config
    );

    await sendAntiNukeAlert({
      guild,
      executor,
      actionName: moduleName,
      details: targetDetails,
      punishmentResult,
      config,
    });
  } catch (err) {
    console.error(`[antinuke:${moduleKey}:error]`, err);
  }
}
