import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Guild,
  GuildMember,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import {
  AntiRaidConfig,
  getAntiRaidConfig,
  updateAntiRaidConfig,
} from "./antiraidStore";
import { getAntiNukeConfig } from "./antinukeStore";
import { hasFeaturePermission } from "./permissionRolesStore";
import { BRAND } from "./brand";
import { VyntricClient } from "../structures/VyntricClient";

interface JoinRecord {
  userId: string;
  userTag: string;
  joinedAt: number;
  createdAt: number;
}

// Memory trackers (sliding window)
const recentJoins = new Map<string, JoinRecord[]>();
const recentMessages = new Map<string, number[]>();
const activeRaidCooldown = new Map<string, number>();

/**
 * Checks whether a user is immune from anti-raid triggers.
 */
export function isImmune(guild: Guild, userId: string): boolean {
  if (!userId) return true;
  if (guild.client.user && userId === guild.client.user.id) return true;
  if (guild.ownerId === userId) return true;

  // Extra owners from Anti-Nuke
  const nukeConfig = getAntiNukeConfig(guild.id);
  if (nukeConfig.extraOwners.includes(userId)) return true;

  const raidConfig = getAntiRaidConfig(guild.id);
  if (raidConfig.whitelistedUsers.includes(userId)) return true;

  const member = guild.members.cache.get(userId);
  if (member) {
    if (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return true;
    }
    if (raidConfig.whitelistedRoles.some((roleId) => member.roles.cache.has(roleId))) {
      return true;
    }
    // Check security & mod feature permission roles
    if (hasFeaturePermission(member, "security") || hasFeaturePermission(member, "mod")) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves the primary alert/log channel for security events.
 */
export function resolveAlertChannel(guild: Guild, config: AntiRaidConfig): TextChannel | null {
  if (config.logChannelId) {
    const ch = guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (ch && ch.isTextBased()) return ch;
  }

  // Fallback 1: Anti-Nuke log channel
  const nukeConfig = getAntiNukeConfig(guild.id);
  if (nukeConfig.logChannelId) {
    const ch = guild.channels.cache.get(nukeConfig.logChannelId) as TextChannel | undefined;
    if (ch && ch.isTextBased()) return ch;
  }

  // Fallback 2: Any channel with security / mod-logs / logs in name
  const fallback = guild.channels.cache.find(
    (c) =>
      c.isTextBased() &&
      (c.name.includes("security") ||
        c.name.includes("mod-log") ||
        c.name.includes("audit") ||
        c.name.includes("alert"))
  ) as TextChannel | undefined;

  return fallback || null;
}

/**
 * Triggers a full emergency lockdown on public channels.
 */
export async function lockdownServer(
  guild: Guild,
  reason: string,
  initiatorTag: string = "VyntricBD Anti-Raid Shield",
  durationMinutes: number = 15
): Promise<{ success: boolean; channelsLocked: string[] }> {
  const config = getAntiRaidConfig(guild.id);
  const everyoneRole = guild.roles.everyone;
  const lockedChannelIds: string[] = [];

  // Find all text and announcement channels where @everyone can currently speak
  for (const channel of guild.channels.cache.values()) {
    if (
      channel.type === ChannelType.GuildText ||
      channel.type === ChannelType.GuildAnnouncement
    ) {
      const textCh = channel as TextChannel;
      const currentPerms = textCh.permissionsFor(everyoneRole);
      
      // If @everyone can send messages, lock it down
      if (currentPerms.has(PermissionFlagsBits.SendMessages)) {
        try {
          await textCh.permissionOverwrites.edit(
            everyoneRole,
            {
              SendMessages: false,
              AddReactions: false,
              CreatePublicThreads: false,
            },
            { reason: `[VyntricBD Anti-Raid Lockdown] ${reason}` }
          );
          lockedChannelIds.push(textCh.id);
        } catch (err: any) {
          console.warn(`[antiraid:lockdown] Could not lock #${textCh.name}:`, err.message);
        }
      }
    }
  }

  const expiresAt = durationMinutes > 0 ? Date.now() + durationMinutes * 60 * 1000 : undefined;

  updateAntiRaidConfig(guild.id, (prev) => ({
    ...prev,
    activeLockdown: {
      active: true,
      startedAt: Date.now(),
      channelsLocked: lockedChannelIds,
      expiresAt,
      reason,
      initiatedBy: initiatorTag,
    },
  }));

  // Send announcement embed in the main general chat (e.g. #chat, #general)
  const generalCh = guild.channels.cache.find(
    (c) =>
      c.isTextBased() &&
      (c.name.includes("chat") || c.name.includes("general") || c.name.includes("main"))
  ) as TextChannel | undefined;

  if (generalCh) {
    const lockEmbed = new EmbedBuilder()
      .setColor(BRAND.colors.danger)
      .setTitle("🔒 Server Emergency Lockdown Active")
      .setDescription(
        `This server has entered **Emergency Lockdown** to shield against incoming raid attacks.\n\n` +
          `• **Reason:** ${reason}\n` +
          `• **Enforced by:** \`${initiatorTag}\`\n` +
          `• **Channels Protected:** **${lockedChannelIds.length}** channels\n` +
          `• **Status:** Public messages are temporarily restricted. Server staff have been alerted.`
      )
      .setFooter({ text: `${BRAND.footer} • Lockdown Protocol` })
      .setTimestamp();

    await generalCh.send({ embeds: [lockEmbed] }).catch(() => {});
  }

  return { success: true, channelsLocked: lockedChannelIds };
}

/**
 * Lifts an active server emergency lockdown and restores channels.
 */
export async function unlockdownServer(
  guild: Guild,
  initiatorTag: string = "Administrator"
): Promise<{ success: boolean; channelsRestored: number }> {
  const config = getAntiRaidConfig(guild.id);
  const everyoneRole = guild.roles.everyone;
  let restoredCount = 0;

  const targetIds = config.activeLockdown?.channelsLocked || [];

  for (const channelId of targetIds) {
    const ch = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (ch && ch.isTextBased()) {
      try {
        await ch.permissionOverwrites.edit(
          everyoneRole,
          {
            SendMessages: null,
            AddReactions: null,
            CreatePublicThreads: null,
          },
          { reason: `[VyntricBD Anti-Raid Unlock] Lifted by ${initiatorTag}` }
        );
        restoredCount++;
      } catch (err: any) {
        console.warn(`[antiraid:unlock] Could not restore #${ch.name}:`, err.message);
      }
    }
  }

  updateAntiRaidConfig(guild.id, (prev) => ({
    ...prev,
    activeLockdown: null,
  }));

  // Send announcement embed in the main chat
  const generalCh = guild.channels.cache.find(
    (c) =>
      c.isTextBased() &&
      (c.name.includes("chat") || c.name.includes("general") || c.name.includes("main"))
  ) as TextChannel | undefined;

  if (generalCh) {
    const unlockEmbed = new EmbedBuilder()
      .setColor(BRAND.colors.success)
      .setTitle("🔓 Server Lockdown Lifted")
      .setDescription(
        `The emergency lockdown has been successfully lifted by **${initiatorTag}**.\n\n` +
          `• **Restored Channels:** **${restoredCount}** channels\n` +
          `• Normal chat and activities have resumed. Thank you for your patience!`
      )
      .setFooter({ text: `${BRAND.footer} • System Secure` })
      .setTimestamp();

    await generalCh.send({ embeds: [unlockEmbed] }).catch(() => {});
  }

  return { success: true, channelsRestored: restoredCount };
}

/**
 * Handles member join event for mass-join raid detection and new account gate.
 */
export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const guild = member.guild;
  const config = getAntiRaidConfig(guild.id);
  if (!config.enabled) return;
  if (isImmune(guild, member.id)) return;

  const now = Date.now();
  const accountAgeDays = (now - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);

  // 1. Account Age Gate check
  if (config.accountAgeGate.enabled && accountAgeDays < config.accountAgeGate.minAgeDays) {
    const isSuspicious = accountAgeDays < 1; // Created in last 24h
    const isUnderRaid = (activeRaidCooldown.get(guild.id) || 0) > now;

    if (isSuspicious || isUnderRaid) {
      console.warn(
        `[antiraid:alt] Young account joined (${member.user.tag}, age: ${accountAgeDays.toFixed(1)}d). Applying ${config.accountAgeGate.action}.`
      );

      try {
        if (config.accountAgeGate.action === "timeout") {
          const durationMs = config.accountAgeGate.timeoutMinutes * 60 * 1000;
          await member.timeout(durationMs, `[VyntricBD Anti-Raid] Fresh account (< ${config.accountAgeGate.minAgeDays}d old)`);
        } else if (config.accountAgeGate.action === "kick") {
          await member.kick(`[VyntricBD Anti-Raid] Fresh account (< ${config.accountAgeGate.minAgeDays}d old)`);
        }
      } catch (err: any) {
        console.warn(`[antiraid:alt:error] Could not punish young account:`, err.message);
      }

      // Log alert
      const logCh = resolveAlertChannel(guild, config);
      if (logCh) {
        const altEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.warning)
          .setTitle("⚠️ Anti-Raid: Suspicious New Account Flagged")
          .setDescription(
            `A newly created account joined **${guild.name}** and was quarantined/timed out.\n\n` +
              `• **User:** <@${member.id}> (\`${member.user.tag}\` | \`${member.id}\`)\n` +
              `• **Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R> (<t:${Math.floor(member.user.createdTimestamp / 1000)}:f>)\n` +
              `• **Action Taken:** Timed out for **${config.accountAgeGate.timeoutMinutes} minutes**`
          )
          .setFooter({ text: BRAND.footer })
          .setTimestamp();

        await logCh.send({ embeds: [altEmbed] }).catch(() => {});
      }
    }
  }

  if (!config.joinRaid.enabled) return;

  // 2. Mass-Join Sliding Window Tracker
  const windowMs = config.joinRaid.windowSeconds * 1000;
  let joins = recentJoins.get(guild.id) || [];
  joins = joins.filter((j) => now - j.joinedAt < windowMs);
  joins.push({
    userId: member.id,
    userTag: member.user.tag,
    joinedAt: now,
    createdAt: member.user.createdTimestamp,
  });
  recentJoins.set(guild.id, joins);

  // Check if threshold exceeded
  if (joins.length >= config.joinRaid.threshold) {
    const lastRaidAlert = activeRaidCooldown.get(guild.id) || 0;
    // Set 60-second cooldown so we don't spam 20 alerts for the same continuous raid wave
    if (now - lastRaidAlert < 60_000) {
      // Still under active raid wave: timeout this new joiner too
      try {
        await member.timeout(
          config.joinRaid.timeoutMinutes * 60 * 1000,
          `[VyntricBD Anti-Raid] Ongoing mass join raid participant`
        );
      } catch {}
      return;
    }

    activeRaidCooldown.set(guild.id, now + 120_000); // 2 minute active raid state
    console.error(`[antiraid:MASS_RAID] Detected ${joins.length} joins in ${config.joinRaid.windowSeconds}s! Triggering protocol.`);

    const raiderRecords = [...joins];
    recentJoins.set(guild.id, []); // Reset window for next wave

    // 1. Punish all raiders in the wave (Timeout / Quarantine / Kick)
    const punishedRaiders: string[] = [];
    for (const r of raiderRecords) {
      try {
        const targetMember = guild.members.cache.get(r.userId) || (await guild.members.fetch(r.userId).catch(() => null));
        if (targetMember && !isImmune(guild, targetMember.id)) {
          if (config.joinRaid.action === "timeout") {
            await targetMember.timeout(
              config.joinRaid.timeoutMinutes * 60 * 1000,
              `[VyntricBD Anti-Raid] Mass join raid participant`
            );
            punishedRaiders.push(`<@${r.userId}> (\`${r.userTag}\`)`);
          } else if (config.joinRaid.action === "kick") {
            await targetMember.kick(`[VyntricBD Anti-Raid] Mass join raid participant`);
            punishedRaiders.push(`<@${r.userId}> (\`${r.userTag}\` - Kicked)`);
          }
        }
      } catch (err: any) {
        console.warn(`[antiraid:punish:error] Could not punish ${r.userTag}:`, err.message);
      }
    }

    // 2. Trigger Auto-Lockdown if enabled
    let lockdownInfo = "";
    if (config.joinRaid.autoLockdown) {
      const lockRes = await lockdownServer(
        guild,
        `Mass join raid detected (${raiderRecords.length} accounts in ${config.joinRaid.windowSeconds}s)`,
        "VyntricBD Anti-Raid Shield",
        config.joinRaid.autoLockdownMinutes
      );
      lockdownInfo = `\n🔒 **Auto-Lockdown:** Enforced on **${lockRes.channelsLocked.length} public channels** for **${config.joinRaid.autoLockdownMinutes} minutes**.`;
    }

    // 3. Dispatch High-Priority Security Alert to Security Log Channel
    const logCh = resolveAlertChannel(guild, config);
    if (logCh) {
      const alertEmbed = new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle("🚨 CRITICAL SECURITY ALERT: MASS JOIN RAID NEUTRALIZED")
        .setDescription(
          `**VyntricBD Anti-Raid Shield** detected and intercepted a sudden mass-join raid attack on **${guild.name}**!\n\n` +
            `• **Velocity:** **${raiderRecords.length} accounts** joined within **${config.joinRaid.windowSeconds} seconds**\n` +
            `• **Punishment Executed:** **${config.joinRaid.action.toUpperCase()}** for **${config.joinRaid.timeoutMinutes} minutes** applied to **${punishedRaiders.length} raiders**\n` +
            lockdownInfo +
            `\n\n**Raider Accounts Flagged:**\n` +
            raiderRecords.slice(0, 10).map((r, i) => `${i + 1}. <@${r.userId}> (\`${r.userTag}\`) • Created <t:${Math.floor(r.createdAt / 1000)}:R>`).join("\n") +
            (raiderRecords.length > 10 ? `\n...and **${raiderRecords.length - 10} more accounts**` : "")
        )
        .setFooter({ text: `${BRAND.footer} • Anti-Raid Active Defense` })
        .setTimestamp();

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("antiraid:unlock")
          .setLabel("🛑 End Lockdown & Reopen")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("antiraid:keep")
          .setLabel("🛡️ Maintain Shield")
          .setStyle(ButtonStyle.Secondary)
      );

      await logCh.send({
        content: `🚨 <@${guild.ownerId}> **EMERGENCY: SERVER RAID DETECTED & CONTAINED**`,
        embeds: [alertEmbed],
        components: [actionRow],
      }).catch(() => {});
    }
  }
}

/**
 * Handles message spam raids (burst messages & mass mentions).
 */
export async function handleRaidMessage(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;
  const guild = message.guild;
  const config = getAntiRaidConfig(guild.id);
  if (!config.enabled) return false;
  if (isImmune(guild, message.author.id)) return false;

  const now = Date.now();
  const member = message.member || (await guild.members.fetch(message.author.id).catch(() => null));
  if (!member) return false;

  // 1. Anti-Mention Raid (Mass Mentions)
  if (config.antiMentionRaid.enabled) {
    const totalMentions = message.mentions.users.size + message.mentions.roles.size;
    const hasBroadMention = message.content.includes("@everyone") || message.content.includes("@here");
    
    if (totalMentions >= config.antiMentionRaid.maxMentions || (hasBroadMention && totalMentions >= 2)) {
      console.warn(`[antiraid:mention] ${message.author.tag} attempted mass mention (${totalMentions} mentions).`);
      await message.delete().catch(() => {});

      try {
        await member.timeout(
          config.antiMentionRaid.timeoutMinutes * 60 * 1000,
          `[VyntricBD Anti-Raid] Mass mention raid (${totalMentions} mentions)`
        );
      } catch (err: any) {
        console.warn("[antiraid:timeout:error]", err.message);
      }

      const logCh = resolveAlertChannel(guild, config);
      if (logCh) {
        const mentionEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle("🚨 Anti-Raid: Mass Mention Raid Intercepted")
          .setDescription(
            `A user triggered the **Mass Mention Raid Filter** and was immediately timed out.\n\n` +
              `• **Offender:** <@${member.id}> (\`${member.user.tag}\`)\n` +
              `• **Channel:** <#${message.channel.id}>\n` +
              `• **Mentions Count:** **${totalMentions}** mentions\n` +
              `• **Action Taken:** Timed out for **${config.antiMentionRaid.timeoutMinutes} minutes**\n` +
              `• **Message Deleted:** \`\`\`${message.content.slice(0, 300)}\`\`\``
          )
          .setFooter({ text: BRAND.footer })
          .setTimestamp();

        await logCh.send({ embeds: [mentionEmbed] }).catch(() => {});
      }
      return true;
    }
  }

  // 2. Anti-Spam Raid (Burst Chat Flood)
  if (config.antiSpamRaid.enabled) {
    const key = `${guild.id}:${message.author.id}`;
    const windowMs = config.antiSpamRaid.windowSeconds * 1000;
    let timestamps = (recentMessages.get(key) || []).filter((ts) => now - ts < windowMs);
    timestamps.push(now);
    recentMessages.set(key, timestamps);

    if (timestamps.length >= config.antiSpamRaid.maxMessages) {
      console.warn(`[antiraid:spam] ${message.author.tag} breached chat flood limit (${timestamps.length} msgs / ${config.antiSpamRaid.windowSeconds}s).`);
      await message.delete().catch(() => {});

      try {
        await member.timeout(
          config.antiSpamRaid.timeoutMinutes * 60 * 1000,
          `[VyntricBD Anti-Raid] Chat flood raid (${timestamps.length} msgs in ${config.antiSpamRaid.windowSeconds}s)`
        );
      } catch (err: any) {
        console.warn("[antiraid:timeout:error]", err.message);
      }

      const logCh = resolveAlertChannel(guild, config);
      if (logCh) {
        const floodEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle("🚨 Anti-Raid: Chat Flood Raid Intercepted")
          .setDescription(
            `A user triggered the **Chat Flood Raid Filter** and was immediately timed out.\n\n` +
              `• **Offender:** <@${member.id}> (\`${member.user.tag}\`)\n` +
              `• **Channel:** <#${message.channel.id}>\n` +
              `• **Velocity:** **${timestamps.length} messages** in **${config.antiSpamRaid.windowSeconds} seconds**\n` +
              `• **Action Taken:** Timed out for **${config.antiSpamRaid.timeoutMinutes} minutes**`
          )
          .setFooter({ text: BRAND.footer })
          .setTimestamp();

        await logCh.send({ embeds: [floodEmbed] }).catch(() => {});
      }
      return true;
    }
  }

  return false;
}

/**
 * Handles Anti-Raid button interactions (e.g. End Lockdown, Maintain Shield).
 */
export async function handleAntiRaidButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.member) return;

  const member =
    interaction.guild.members.cache.get(interaction.user.id) ||
    (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

  if (
    !member ||
    (!member.permissions.has(PermissionFlagsBits.Administrator) &&
      !member.permissions.has(PermissionFlagsBits.ManageGuild) &&
      !member.permissions.has(PermissionFlagsBits.ManageChannels) &&
      !hasFeaturePermission(member, "security") &&
      !hasFeaturePermission(member, "mod"))
  ) {
    await interaction.reply({
      content: "❌ You need **Administrator** or **🔐 Security Perms** to manage Anti-Raid shield actions.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const customId = interaction.customId;

  if (customId === "antiraid:unlock") {
    await interaction.deferReply();
    const res = await unlockdownServer(interaction.guild, interaction.user.tag);
    await interaction.editReply({
      content: `🔓 **Server Emergency Lockdown Lifted by <@${interaction.user.id}>.**\nRestored public messaging across **${res.channelsRestored} channels**.`,
    });
    return;
  }

  if (customId === "antiraid:lock") {
    await interaction.deferReply();
    const res = await lockdownServer(
      interaction.guild,
      "Manual Emergency Lockdown via Security Dashboard",
      interaction.user.tag,
      15
    );
    await interaction.editReply({
      content: `🔒 **Emergency Lockdown Activated by <@${interaction.user.id}>.**\nRestricted \`SendMessages\` across **${res.channelsLocked.length} channels** for 15 minutes.`,
    });
    return;
  }

  if (customId === "antiraid:toggle") {
    const next = updateAntiRaidConfig(interaction.guild.id, (prev) => ({
      ...prev,
      enabled: !prev.enabled,
    }));
    await interaction.reply({
      content: next.enabled
        ? `🟢 **VyntricBD Anti-Raid Shield has been ENABLED by <@${interaction.user.id}>.**`
        : `🔴 **VyntricBD Anti-Raid Shield has been DISABLED by <@${interaction.user.id}>.**`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (customId === "antiraid:keep") {
    await interaction.reply({
      content: `🛡️ **Anti-Raid Shield status acknowledged.** Active defenses and lockdown will remain intact.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
}

/**
 * Handles text commands without slash: lockdown, unlock, antiraid
 */
export async function handleAntiRaidTextCommand(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;
  const raw = message.content.trim();
  if (raw.length < 6) return false;

  const match = raw.match(/^([!?.+\-$&;]?)(lockdown|unlock|antiraid)(?:\s+([\s\S]*))?$/i);
  if (!match) return false;

  const cmd = match[2].toLowerCase();
  const args = (match[3] || "").trim().toLowerCase();

  const member =
    message.member ||
    (await message.guild.members.fetch(message.author.id).catch(() => null));

  if (
    !member ||
    (!member.permissions.has(PermissionFlagsBits.Administrator) &&
      !member.permissions.has(PermissionFlagsBits.ManageGuild) &&
      !member.permissions.has(PermissionFlagsBits.ManageChannels) &&
      !hasFeaturePermission(member, "security") &&
      !hasFeaturePermission(member, "mod"))
  ) {
    return false; // Silently ignore non-staff members
  }

  if (cmd === "lockdown") {
    const isChannelOnly = args === "channel" || args === "here";
    if (isChannelOnly) {
      const textCh = message.channel as TextChannel;
      if (textCh && textCh.isTextBased() && !textCh.isDMBased()) {
        try {
          await textCh.permissionOverwrites.edit(
            message.guild.roles.everyone,
            { SendMessages: false, AddReactions: false, CreatePublicThreads: false },
            { reason: `[Text Lockdown] Initiated by ${message.author.tag}` }
          );
          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.danger)
            .setTitle("🔒 Channel Locked")
            .setDescription(`This channel has been locked down by ${message.author}. Regular members cannot send messages.`)
            .setFooter({ text: `${BRAND.footer} • Channel Lockdown` })
            .setTimestamp();
          await message.reply({ embeds: [embed] });
          return true;
        } catch (err: any) {
          await message.reply({ content: `❌ Could not lock channel: ${err.message}` });
          return true;
        }
      }
    }

    // Default: Server-Wide Lockdown
    const res = await lockdownServer(
      message.guild,
      args || "Administrator Emergency Text Lockdown",
      message.author.tag,
      15
    );

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.danger)
      .setTitle("🔒 Server Emergency Lockdown Activated")
      .setDescription(
        `**${message.author.tag}** initiated a server-wide emergency lockdown.\n\n` +
          `• **Channels Locked:** **${res.channelsLocked.length} channels**\n` +
          `• **Duration:** **15 minutes** (auto-restores)\n` +
          `• **Action:** Public channels have been muted to shield against raids.`
      )
      .setFooter({ text: `${BRAND.footer} • Anti-Raid Defense` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return true;
  }

  if (cmd === "unlock") {
    const isChannelOnly = args === "channel" || args === "here";
    if (isChannelOnly) {
      const textCh = message.channel as TextChannel;
      if (textCh && textCh.isTextBased() && !textCh.isDMBased()) {
        try {
          await textCh.permissionOverwrites.edit(
            message.guild.roles.everyone,
            { SendMessages: null, AddReactions: null, CreatePublicThreads: null },
            { reason: `[Text Unlock] Lifted by ${message.author.tag}` }
          );
          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.success)
            .setTitle("🔓 Channel Unlocked")
            .setDescription(`This channel has been unlocked by ${message.author}. Members may now chat.`)
            .setFooter({ text: `${BRAND.footer} • Channel Restored` })
            .setTimestamp();
          await message.reply({ embeds: [embed] });
          return true;
        } catch (err: any) {
          await message.reply({ content: `❌ Could not unlock channel: ${err.message}` });
          return true;
        }
      }
    }

    // Default: Lift Server Lockdown
    const res = await unlockdownServer(message.guild, message.author.tag);
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.success)
      .setTitle("🔓 Server Lockdown Lifted")
      .setDescription(
        `**${message.author.tag}** lifted the server-wide lockdown.\n\n` +
          `• **Channels Restored:** **${res.channelsRestored} channels**\n` +
          `• Normal messaging permissions have resumed.`
      )
      .setFooter({ text: `${BRAND.footer} • System Operational` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return true;
  }

  if (cmd === "antiraid") {
    const cfg = getAntiRaidConfig(message.guild.id);
    const alertCh = resolveAlertChannel(message.guild, cfg);

    const statusIcon = cfg.enabled ? "🟢 **ENABLED & SHIELD ACTIVE**" : "🔴 **DISABLED**";
    const lockdownStatus = cfg.activeLockdown
      ? `🔒 **ACTIVE LOCKDOWN** (${cfg.activeLockdown.channelsLocked.length} channels locked)\n` +
        `• Started: <t:${Math.floor(cfg.activeLockdown.startedAt / 1000)}:R>`
      : "🔓 **Server Normal (No active lockdown)**";

    const embed = new EmbedBuilder()
      .setColor(cfg.enabled ? BRAND.colors.success : BRAND.colors.danger)
      .setTitle(`🛡️ ${BRAND.name} Anti-Raid Shield Status`)
      .setDescription(
        `**Shield System:** ${statusIcon}\n` +
          `**Server Lockdown:** ${lockdownStatus}\n\n` +
          `${BRAND.divider}\n\n` +
          `### ⚡ Active Defense Parameters\n` +
          `• **Mass Join Detection:** **${cfg.joinRaid.threshold} joins** within **${cfg.joinRaid.windowSeconds}s**\n` +
          `• **Join Raid Action:** **${cfg.joinRaid.action.toUpperCase()}** for **${cfg.joinRaid.timeoutMinutes}m**\n` +
          `• **Auto-Lockdown on Raid:** ${cfg.joinRaid.autoLockdown ? `✅ Yes (${cfg.joinRaid.autoLockdownMinutes}m)` : "❌ Disabled"}\n` +
          `• **Account Age Gate:** ${cfg.accountAgeGate.enabled ? `✅ Minimum **${cfg.accountAgeGate.minAgeDays} days**` : "❌ Disabled"}\n` +
          `• **Anti-Mention Raid:** ${cfg.antiMentionRaid.enabled ? `✅ Max **${cfg.antiMentionRaid.maxMentions} mentions**` : "❌ Disabled"}\n` +
          `• **Anti-Spam Flood:** ${cfg.antiSpamRaid.enabled ? `✅ Max **${cfg.antiSpamRaid.maxMessages} msgs / ${cfg.antiSpamRaid.windowSeconds}s**` : "❌ Disabled"}\n\n` +
          `• **Alert Channel:** ${alertCh ? `<#${alertCh.id}>` : "_None configured_"}`
      )
      .setFooter({ text: `${BRAND.footer} • Anti-Raid Shield` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("antiraid:toggle")
        .setLabel(cfg.enabled ? "Disable Shield" : "Enable Shield")
        .setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(cfg.activeLockdown ? "antiraid:unlock" : "antiraid:lock")
        .setLabel(cfg.activeLockdown ? "🔓 Lift Lockdown" : "🔒 Emergency Lockdown")
        .setStyle(cfg.activeLockdown ? ButtonStyle.Success : ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return true;
  }

  return false;
}

/**
 * Initializes heartbeat to automatically lift expired lockdowns.
 */
export function initAntiRaid(client: VyntricClient) {
  setInterval(async () => {
    const now = Date.now();
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = getAntiRaidConfig(guild.id);
        if (
          config.activeLockdown &&
          config.activeLockdown.expiresAt &&
          config.activeLockdown.expiresAt <= now
        ) {
          console.log(`[antiraid:heartbeat] Auto-lockdown expired for guild ${guild.name} (${guild.id}). Unlocking...`);
          await unlockdownServer(guild, "Auto-Lockdown Expiration Timer");
        }
      } catch (err: any) {
        console.error("[antiraid:heartbeat:error]", err.message);
      }
    }
  }, 20_000);
}
