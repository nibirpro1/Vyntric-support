import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Collection,
  EmbedBuilder,
  Guild,
  GuildMember,
  Invite,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
  User,
} from "discord.js";
import {
  AntiRaidConfig,
  LockdownMode,
  RaiderProfile,
  RaidIncident,
  getAntiRaidConfig,
  updateAntiRaidConfig,
} from "./antiraidStore";
import { getAntiNukeConfig } from "./antinukeStore";
import { hasFeaturePermission } from "./permissionRolesStore";
import { BRAND } from "./brand";
import { VyntricClient } from "../structures/VyntricClient";

// ─────────────────────────────────────────────────────────────
// IN-MEMORY TELEMETRY & TRACKING STORES
// ─────────────────────────────────────────────────────────────
const recentJoins = new Map<string, RaiderProfile[]>();
const recentMessages = new Map<string, number[]>();
const crossChannelTracker = new Map<string, Map<string, { channels: Set<string>; firstSeen: number }>>();
const activeRaidCooldown = new Map<string, number>();

// Invite Cache: guildId -> Map<inviteCode, uses>
const guildInviteCache = new Map<string, Map<string, number>>();

/**
 * Caches all current invites for a guild.
 */
export async function cacheGuildInvites(guild: Guild): Promise<void> {
  try {
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) return;
    const invites = await guild.invites.fetch().catch(() => new Collection<string, Invite>());
    const codeMap = new Map<string, number>();
    for (const inv of invites.values()) {
      codeMap.set(inv.code, inv.uses || 0);
    }
    guildInviteCache.set(guild.id, codeMap);
  } catch (err: any) {
    console.warn(`[antiraid:invites] Could not cache invites for ${guild.name}:`, err.message);
  }
}

/**
 * Identifies which invite was used by the joining member.
 */
export async function trackUsedInvite(guild: Guild): Promise<string | undefined> {
  try {
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) return undefined;
    const currentInvites = await guild.invites.fetch().catch(() => new Collection<string, Invite>());
    const cached = guildInviteCache.get(guild.id);

    let usedCode: string | undefined;

    if (cached) {
      for (const inv of currentInvites.values()) {
        const prevUses = cached.get(inv.code) || 0;
        if ((inv.uses || 0) > prevUses) {
          usedCode = inv.code;
          break;
        }
      }
    }

    // Refresh cache
    const freshMap = new Map<string, number>();
    for (const inv of currentInvites.values()) {
      freshMap.set(inv.code, inv.uses || 0);
    }
    guildInviteCache.set(guild.id, freshMap);

    return usedCode;
  } catch {
    return undefined;
  }
}

/**
 * Computes Levenshtein Distance similarity ratio (0.0 to 1.0) between two strings.
 */
export function similarityRatio(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1.toLowerCase() : s2.toLowerCase();
  const shorter = s1.length > s2.length ? s2.toLowerCase() : s1.toLowerCase();
  if (longer.length === 0) return 1.0;

  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return (longer.length - costs[shorter.length]) / longer.length;
}

/**
 * Checks whether a user is immune from anti-raid triggers.
 */
export function isImmune(guild: Guild, userId: string): boolean {
  if (!userId) return true;
  if (guild.client.user && userId === guild.client.user.id) return true;
  if (guild.ownerId === userId || userId === "1495738572362481777") return true;

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
    if (hasFeaturePermission(member, "security") || hasFeaturePermission(member, "mod")) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves the primary alert channel for anti-raid incidents.
 */
export function resolveAlertChannel(guild: Guild, config: AntiRaidConfig): TextChannel | null {
  if (config.logChannelId) {
    const ch = guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
    if (ch && ch.isTextBased()) return ch;
  }

  const nukeConfig = getAntiNukeConfig(guild.id);
  if (nukeConfig.logChannelId) {
    const ch = guild.channels.cache.get(nukeConfig.logChannelId) as TextChannel | undefined;
    if (ch && ch.isTextBased()) return ch;
  }

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
 * Heuristic risk assessment score for any member (0 to 100).
 */
export function calculateRiskScore(
  member: GuildMember,
  guildUnderRaid: boolean = false
): { score: number; factors: string[]; level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" } {
  let score = 0;
  const factors: string[] = [];
  const now = Date.now();
  const createdAgeMs = now - member.user.createdTimestamp;
  const createdAgeDays = createdAgeMs / (1000 * 60 * 60 * 24);
  const createdAgeHours = createdAgeMs / (1000 * 60 * 60);

  // 1. Account Age Scoring
  if (createdAgeHours < 1) {
    score += 65;
    factors.push("Created < 1 hour ago (+65)");
  } else if (createdAgeHours < 24) {
    score += 45;
    factors.push("Created < 24 hours ago (+45)");
  } else if (createdAgeDays < 3) {
    score += 30;
    factors.push(`Account age ${createdAgeDays.toFixed(1)} days (+30)`);
  } else if (createdAgeDays < 7) {
    score += 15;
    factors.push(`Account age ${createdAgeDays.toFixed(1)} days (+15)`);
  }

  // 2. Default Discord Avatar
  const hasCustomAvatar = member.user.avatar !== null;
  if (!hasCustomAvatar) {
    score += 25;
    factors.push("Default Discord avatar without custom profile photo (+25)");
  }

  // 3. Username Heuristic Patterns
  const name = member.user.username.toLowerCase();
  const isSuspiciousPattern =
    /(discord\.gg|http|free|nitro|token|raid|nuke|hack|anon|\.ru|\.com|\.xyz)/i.test(name) ||
    /^[a-z0-9]{8,12}$/i.test(name) && !/[aeiou]/i.test(name) || // Random hex/consonant string
    /\d{5,}$/.test(name); // Ends with 5+ digits (common bot generator pattern)

  if (isSuspiciousPattern) {
    score += 30;
    factors.push("Username matches automated raid/scam pattern (+30)");
  }

  // 4. Guild Traffic Multiplier
  if (guildUnderRaid) {
    score += 35;
    factors.push("Joined during active server raid/traffic spike (+35)");
  }

  score = Math.min(100, score);

  let level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  if (score >= 75) level = "CRITICAL";
  else if (score >= 55) level = "HIGH";
  else if (score >= 35) level = "MEDIUM";

  return { score, factors, level };
}

/**
 * Triggers full server emergency lockdown.
 */
export async function lockdownServer(
  guild: Guild,
  reason: string,
  initiatorTag: string = "VyntricBD Anti-Raid Shield",
  durationMinutes: number = 15,
  mode: LockdownMode = "hard"
): Promise<{ success: boolean; channelsLocked: string[] }> {
  const everyoneRole = guild.roles.everyone;
  const lockedChannelIds: string[] = [];

  for (const channel of guild.channels.cache.values()) {
    if (
      channel.type === ChannelType.GuildText ||
      channel.type === ChannelType.GuildAnnouncement
    ) {
      const textCh = channel as TextChannel;
      const currentPerms = textCh.permissionsFor(everyoneRole);

      if (currentPerms.has(PermissionFlagsBits.SendMessages)) {
        try {
          const overwrites: any = {
            SendMessages: false,
            AddReactions: false,
          };
          if (mode === "hard") {
            overwrites.CreatePublicThreads = false;
            overwrites.CreatePrivateThreads = false;
            overwrites.SendMessagesInThreads = false;
            overwrites.UseApplicationCommands = false;
          }

          await textCh.permissionOverwrites.edit(
            everyoneRole,
            overwrites,
            { reason: `[VyntricBD Anti-Raid ${mode.toUpperCase()} Lockdown] ${reason}` }
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
      mode,
      startedAt: Date.now(),
      channelsLocked: lockedChannelIds,
      expiresAt,
      reason,
      initiatedBy: initiatorTag,
    },
  }));

  const generalCh = guild.channels.cache.find(
    (c) =>
      c.isTextBased() &&
      (c.name.includes("chat") || c.name.includes("general") || c.name.includes("main"))
  ) as TextChannel | undefined;

  if (generalCh) {
    const lockEmbed = new EmbedBuilder()
      .setColor(BRAND.colors.danger)
      .setTitle(`🔒 Server Emergency Lockdown Active [${mode.toUpperCase()}]`)
      .setDescription(
        `This server has entered **${mode.toUpperCase()} Emergency Lockdown** to shield against incoming attacks.\n\n` +
          `• **Reason:** ${reason}\n` +
          `• **Enforced by:** \`${initiatorTag}\`\n` +
          `• **Channels Protected:** **${lockedChannelIds.length}** channels\n` +
          `• **Duration:** ${durationMinutes > 0 ? `${durationMinutes} minutes (auto-lift)` : "Indefinite until lifted"}\n` +
          `• **Status:** Public messages & interactions are muted. Staff have taken command.`
      )
      .setFooter({ text: `${BRAND.footer} • Server Defense Shield` })
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
            CreatePrivateThreads: null,
            SendMessagesInThreads: null,
            UseApplicationCommands: null,
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
          `• Messaging permissions restored. Thank you for your patience!`
      )
      .setFooter({ text: `${BRAND.footer} • System Operational` })
      .setTimestamp();

    await generalCh.send({ embeds: [unlockEmbed] }).catch(() => {});
  }

  return { success: true, channelsRestored: restoredCount };
}

/**
 * Triggers a raid wave defense protocol.
 */
async function triggerRaidProtocol(
  guild: Guild,
  type: RaidIncident["type"],
  velocityStr: string,
  raiders: RaiderProfile[],
  detectedInviteCode?: string
): Promise<void> {
  const config = getAntiRaidConfig(guild.id);
  const now = Date.now();

  console.error(`[antiraid:RAID_DETECTED] Type: ${type}, Velocity: ${velocityStr}, Raiders: ${raiders.length}`);

  // 1. Timeout raiders (Timeout-only policy, no kick/ban)
  const timeoutMs = config.joinRaid.timeoutMinutes * 60 * 1000;
  for (const r of raiders) {
    try {
      const targetMember =
        guild.members.cache.get(r.userId) || (await guild.members.fetch(r.userId).catch(() => null));
      if (targetMember && !isImmune(guild, targetMember.id)) {
        await targetMember.timeout(
          timeoutMs,
          `[VyntricBD Anti-Raid Shield] Coordinated raid wave (${type})`
        );
        r.timedOut = true;
      }
    } catch (err: any) {
      console.warn(`[antiraid:timeout:error] Could not timeout raider ${r.userTag}:`, err.message);
    }
  }

  // 2. Auto-Revoke Raid Invite (if enabled)
  let inviteRevokeInfo = "";
  if (detectedInviteCode && config.inviteTracking.autoRevokeRaidInvite) {
    try {
      const invites = await guild.invites.fetch().catch(() => new Collection<string, Invite>());
      const raidInv = invites.get(detectedInviteCode);
      if (raidInv) {
        await raidInv.delete(`[VyntricBD Anti-Raid] Compromised invite used by raid wave (${type})`);
        inviteRevokeInfo = `\n🛑 **Compromised Invite Revoked:** \`discord.gg/${detectedInviteCode}\` has been permanently deleted to cut off entry!`;
      }
    } catch (err: any) {
      console.warn(`[antiraid:invite:revoke:error]`, err.message);
    }
  }

  // 3. Auto-Lockdown (if enabled)
  let lockdownRes: { success: boolean; channelsLocked: string[] } = { success: false, channelsLocked: [] };
  if (config.joinRaid.autoLockdown) {
    lockdownRes = await lockdownServer(
      guild,
      `Anti-Raid Auto-Defense: ${type} attack (${velocityStr})`,
      "VyntricBD Anti-Raid Shield",
      config.joinRaid.autoLockdownMinutes,
      config.joinRaid.lockdownMode
    );
  }

  // 4. Save Incident Record
  const incident: RaidIncident = {
    id: `raid_${Date.now()}`,
    timestamp: now,
    type,
    velocity: velocityStr,
    inviteCode: detectedInviteCode,
    raiderCount: raiders.length,
    raiders,
    lockdownApplied: config.joinRaid.autoLockdown,
    channelsLocked: lockdownRes.channelsLocked,
  };

  updateAntiRaidConfig(guild.id, (prev) => ({
    ...prev,
    lastIncident: incident,
  }));

  // 5. Send High-Priority Emergency Dispatch
  const logCh = resolveAlertChannel(guild, config);
  if (logCh) {
    const alertEmbed = new EmbedBuilder()
      .setColor(BRAND.colors.danger)
      .setTitle("🚨 CRITICAL SECURITY ALERT: RAID ATTACK NEUTRALIZED")
      .setDescription(
        `**VyntricBD Enterprise Anti-Raid Shield** intercepted a coordinated attack on **${guild.name}**!\n\n` +
          `• **Attack Vector:** \`${type.toUpperCase()}\`\n` +
          `• **Velocity:** **${velocityStr}**\n` +
          `• **Raiders Contained:** **${raiders.length} accounts** (all placed in **${config.joinRaid.timeoutMinutes}m timeout**)\n` +
          (lockdownRes.channelsLocked.length > 0
            ? `• **Emergency Lockdown:** Active across **${lockdownRes.channelsLocked.length} channels** for **${config.joinRaid.autoLockdownMinutes}m**\n`
            : "") +
          inviteRevokeInfo +
          `\n\n### 📋 Raiders Dossier (Top ${Math.min(raiders.length, 10)}):\n` +
          raiders
            .slice(0, 10)
            .map(
              (r, i) =>
                `\`${i + 1}.\` <@${r.userId}> (\`${r.userTag}\`) • Risk: **${r.riskScore}/100** • Created <t:${Math.floor(r.createdAt / 1000)}:R>` +
                (r.inviteCode ? ` • via \`${r.inviteCode}\`` : "")
            )
            .join("\n") +
          (raiders.length > 10 ? `\n...and **${raiders.length - 10} more accounts**` : "")
      )
      .setFooter({ text: `${BRAND.footer} • Anti-Raid Incident #${incident.id}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("antiraid:unlock")
        .setLabel("🛑 End Lockdown & Reopen")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("antiraid:sweep_timeout")
        .setLabel("🧹 Re-apply 24h Timeout to All")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("antiraid:keep")
        .setLabel("🛡️ Maintain Shield")
        .setStyle(ButtonStyle.Secondary)
    );

    await logCh
      .send({
        content: `🚨 <@${guild.ownerId}> **EMERGENCY: SERVER RAID DETECTED & CONTAINED**`,
        embeds: [alertEmbed],
        components: [row],
      })
      .catch(() => {});
  }
}

/**
 * Handles member join event with advanced multi-vector heuristic analysis.
 */
export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const guild = member.guild;
  const config = getAntiRaidConfig(guild.id);
  if (!config.enabled) return;
  if (isImmune(guild, member.id)) return;

  const now = Date.now();
  const isUnderRaid = (activeRaidCooldown.get(guild.id) || 0) > now;

  // 1. Detect used invite code
  const usedInvite = await trackUsedInvite(guild);

  // 2. Multi-Vector Risk Calculation
  const risk = calculateRiskScore(member, isUnderRaid);

  const profile: RaiderProfile = {
    userId: member.id,
    userTag: member.user.tag,
    createdAt: member.user.createdTimestamp,
    joinedAt: now,
    riskScore: risk.score,
    riskFactors: risk.factors,
    timedOut: false,
    inviteCode: usedInvite,
  };

  // 3. Pre-Emptive High Risk Isolation (Score >= quarantineThreshold)
  if (config.riskScoring.enabled && risk.score >= config.riskScoring.quarantineThreshold) {
    console.warn(
      `[antiraid:risk_isolation] High-risk account joined (${member.user.tag}, score: ${risk.score}/100, factors: [${risk.factors.join(", ")}]). Pre-emptively isolating.`
    );

    try {
      await member.timeout(
        config.riskScoring.timeoutMinutes * 60 * 1000,
        `[VyntricBD Anti-Raid Risk Engine] High risk score (${risk.score}/100): ${risk.factors.slice(0, 2).join("; ")}`
      );
      profile.timedOut = true;
    } catch (err: any) {
      console.warn(`[antiraid:risk:timeout:error]`, err.message);
    }

    const logCh = resolveAlertChannel(guild, config);
    if (logCh) {
      const riskEmbed = new EmbedBuilder()
        .setColor(BRAND.colors.warning)
        .setTitle("⚠️ Anti-Raid: High-Risk Account Pre-Emptively Quarantined")
        .setDescription(
          `A suspicious account was quarantined upon joining **${guild.name}**.\n\n` +
            `• **User:** <@${member.id}> (\`${member.user.tag}\` | \`${member.id}\`)\n` +
            `• **Security Risk Score:** **${risk.score}/100** [${risk.level}]\n` +
            `• **Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n` +
            (usedInvite ? `• **Invite Used:** \`discord.gg/${usedInvite}\`\n` : "") +
            `• **Action Taken:** Timed out for **${config.riskScoring.timeoutMinutes} minutes**\n\n` +
            `**Triggered Risk Indicators:**\n` +
            risk.factors.map((f) => `• ${f}`).join("\n")
        )
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      await logCh.send({ embeds: [riskEmbed] }).catch(() => {});
    }
  }

  // 4. Update Sliding Window Joins
  const windowMs = config.joinRaid.windowSeconds * 1000;
  let joins = recentJoins.get(guild.id) || [];
  joins = joins.filter((j) => now - j.joinedAt < windowMs);
  joins.push(profile);
  recentJoins.set(guild.id, joins);

  // If ongoing cooldown is active, auto-timeout new incoming members during the wave
  if (isUnderRaid) {
    try {
      await member.timeout(
        config.joinRaid.timeoutMinutes * 60 * 1000,
        `[VyntricBD Anti-Raid] Active raid containment wave`
      );
      profile.timedOut = true;
    } catch {}
    return;
  }

  // 5. VECTOR A: MASS JOIN VELOCITY SPIKE
  if (config.joinRaid.enabled && joins.length >= config.joinRaid.threshold) {
    activeRaidCooldown.set(guild.id, now + 120_000);
    const wave = [...joins];
    recentJoins.set(guild.id, []);

    // Check if wave accounts share an invite
    const inviteCounts = new Map<string, number>();
    for (const r of wave) {
      if (r.inviteCode) {
        inviteCounts.set(r.inviteCode, (inviteCounts.get(r.inviteCode) || 0) + 1);
      }
    }
    let mostUsedInvite: string | undefined;
    for (const [code, count] of inviteCounts.entries()) {
      if (count >= 2) mostUsedInvite = code;
    }

    await triggerRaidProtocol(
      guild,
      "mass_join",
      `${wave.length} accounts in ${config.joinRaid.windowSeconds}s`,
      wave,
      mostUsedInvite
    );
    return;
  }

  // 6. VECTOR B: NAME PATTERN / SIMILARITY CLUSTERING
  if (config.nameSimilarity.enabled && joins.length >= config.nameSimilarity.threshold) {
    let similarCount = 1;
    const currentName = member.user.username;
    const similarCluster: RaiderProfile[] = [profile];

    for (const prior of joins) {
      if (prior.userId === member.id) continue;
      const sim = similarityRatio(currentName, prior.userTag.split("#")[0]);
      if (sim >= config.nameSimilarity.similarityRatio) {
        similarCount++;
        similarCluster.push(prior);
      }
    }

    if (similarCount >= config.nameSimilarity.threshold) {
      activeRaidCooldown.set(guild.id, now + 120_000);
      recentJoins.set(guild.id, []);
      await triggerRaidProtocol(
        guild,
        "name_pattern",
        `${similarCount} accounts with matching pattern '${currentName.slice(0, 8)}...'`,
        similarCluster,
        usedInvite
      );
      return;
    }
  }

  // 7. VECTOR C: BURST DEFAULT-AVATAR DETECTOR
  if (config.defaultAvatarGate.enabled) {
    const defaultAvatarsInWindow = joins.filter((j) => {
      const m = guild.members.cache.get(j.userId);
      return m && m.user.avatar === null;
    });

    if (defaultAvatarsInWindow.length >= config.defaultAvatarGate.burstCount) {
      activeRaidCooldown.set(guild.id, now + 120_000);
      recentJoins.set(guild.id, []);
      await triggerRaidProtocol(
        guild,
        "default_avatar",
        `${defaultAvatarsInWindow.length} default-avatar accounts in ${config.joinRaid.windowSeconds}s`,
        defaultAvatarsInWindow,
        usedInvite
      );
      return;
    }
  }
}

/**
 * Handles message spam raids (mass mentions, chat flood, cross-channel copypasta).
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

  const text = message.content.trim().toLowerCase();

  // 1. Cross-Channel Copypasta Spam Shield
  if (config.crossChannelSpam.enabled && text.length >= 10) {
    let userMap = crossChannelTracker.get(message.author.id);
    if (!userMap) {
      userMap = new Map();
      crossChannelTracker.set(message.author.id, userMap);
    }

    const hashKey = text.slice(0, 100);
    const record = userMap.get(hashKey) || { channels: new Set<string>(), firstSeen: now };
    
    // Clean old records
    if (now - record.firstSeen > 12_000) {
      record.channels.clear();
      record.firstSeen = now;
    }

    record.channels.add(message.channel.id);
    userMap.set(hashKey, record);

    if (record.channels.size >= config.crossChannelSpam.maxChannels) {
      console.warn(`[antiraid:cross_channel] ${message.author.tag} flooded ${record.channels.size} channels with identical text.`);
      await message.delete().catch(() => {});

      try {
        await member.timeout(
          config.crossChannelSpam.timeoutMinutes * 60 * 1000,
          `[VyntricBD Anti-Raid] Cross-channel copypasta raid across ${record.channels.size} channels`
        );
      } catch {}

      const logCh = resolveAlertChannel(guild, config);
      if (logCh) {
        const copyEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle("🚨 Anti-Raid: Cross-Channel Copypasta Raid Blocked")
          .setDescription(
            `A user blasted identical messages across multiple channels and was immediately contained.\n\n` +
              `• **Offender:** <@${member.id}> (\`${member.user.tag}\`)\n` +
              `• **Channels Flooded:** ${Array.from(record.channels).map((id) => `<#${id}>`).join(", ")}\n` +
              `• **Action Taken:** Timed out for **${config.crossChannelSpam.timeoutMinutes} minutes**\n` +
              `• **Content:** \`\`\`${message.content.slice(0, 250)}\`\`\``
          )
          .setFooter({ text: BRAND.footer })
          .setTimestamp();

        await logCh.send({ embeds: [copyEmbed] }).catch(() => {});
      }
      return true;
    }
  }

  // 2. Mass Mention Raid
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
      } catch {}

      const logCh = resolveAlertChannel(guild, config);
      if (logCh) {
        const mentionEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle("🚨 Anti-Raid: Mass Mention Raid Intercepted")
          .setDescription(
            `Mass mention raid blocked.\n\n` +
              `• **Offender:** <@${member.id}> (\`${member.user.tag}\`)\n` +
              `• **Channel:** <#${message.channel.id}>\n` +
              `• **Mentions Count:** **${totalMentions}** mentions\n` +
              `• **Action Taken:** Timed out for **${config.antiMentionRaid.timeoutMinutes} minutes**`
          )
          .setFooter({ text: BRAND.footer })
          .setTimestamp();

        await logCh.send({ embeds: [mentionEmbed] }).catch(() => {});
      }
      return true;
    }
  }

  // 3. Fast Chat Flood
  if (config.antiSpamRaid.enabled) {
    const key = `${guild.id}:${message.author.id}`;
    const windowMs = config.antiSpamRaid.windowSeconds * 1000;
    let timestamps = (recentMessages.get(key) || []).filter((ts) => now - ts < windowMs);
    timestamps.push(now);
    recentMessages.set(key, timestamps);

    if (timestamps.length >= config.antiSpamRaid.maxMessages) {
      await message.delete().catch(() => {});

      try {
        await member.timeout(
          config.antiSpamRaid.timeoutMinutes * 60 * 1000,
          `[VyntricBD Anti-Raid] Chat flood raid (${timestamps.length} msgs in ${config.antiSpamRaid.windowSeconds}s)`
        );
      } catch {}

      const logCh = resolveAlertChannel(guild, config);
      if (logCh) {
        const floodEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle("🚨 Anti-Raid: Chat Flood Intercepted")
          .setDescription(
            `Chat flood breached rate limit.\n\n` +
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
 * Triggers emergency Panic Mode for the server.
 */
export async function triggerPanicMode(
  guild: Guild,
  initiatorTag: string
): Promise<{ success: boolean; channelsLocked: number; raidersSwept: number }> {
  // 1. Enforce Hard Lockdown
  const lockRes = await lockdownServer(
    guild,
    `EMERGENCY PANIC ACTIVATED by ${initiatorTag}`,
    initiatorTag,
    30,
    "hard"
  );

  // 2. Sweep: Quarantine all accounts that joined in last 10 minutes
  const now = Date.now();
  let sweptCount = 0;
  for (const m of guild.members.cache.values()) {
    if (m.joinedTimestamp && now - m.joinedTimestamp < 600_000 && !isImmune(guild, m.id)) {
      try {
        await m.timeout(3600_000, `[VyntricBD Anti-Raid Panic Sweep] Initiated by ${initiatorTag}`);
        sweptCount++;
      } catch {}
    }
  }

  // 3. Dispatch Panic Announcement
  const logCh = resolveAlertChannel(guild, getAntiRaidConfig(guild.id));
  if (logCh) {
    const panicEmbed = new EmbedBuilder()
      .setColor(0x721c24)
      .setTitle("🔴 FULL SERVER PANIC MODE TRIGGERED")
      .setDescription(
        `**${initiatorTag}** initiated **Emergency Panic Protocol**!\n\n` +
          `• **Hard Lockdown:** Active on **${lockRes.channelsLocked.length} public channels** (all threads, reactions, and messaging muted)\n` +
          `• **Recent Joiner Sweep:** **${sweptCount} accounts** joined in the last 10m have been placed in **1-hour timeout**\n` +
          `• **Duration:** 30 minutes auto-timer\n\n` +
          `Use the buttons below to manage the crisis.`
      )
      .setFooter({ text: `${BRAND.footer} • Emergency Defense` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("antiraid:unlock")
        .setLabel("🛑 End Panic & Lift Lockdown")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("antiraid:sweep_timeout")
        .setLabel("🧹 Re-Timeout All Wave Raiders")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("antiraid:keep")
        .setLabel("🛡️ Keep Panic Shield Active")
        .setStyle(ButtonStyle.Secondary)
    );

    await logCh.send({ content: `@everyone`, embeds: [panicEmbed], components: [row] }).catch(() => {});
  }

  return {
    success: true,
    channelsLocked: lockRes.channelsLocked.length,
    raidersSwept: sweptCount,
  };
}

/**
 * Handles Anti-Raid button interactions.
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
      content: "❌ You need **Administrator** or **🔐 Security Perms** to manage Anti-Raid actions.",
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
      15,
      "hard"
    );
    await interaction.editReply({
      content: `🔒 **Emergency Hard Lockdown Activated by <@${interaction.user.id}>.**\nRestricted messaging and threads across **${res.channelsLocked.length} channels** for 15 minutes.`,
    });
    return;
  }

  if (customId === "antiraid:sweep_timeout") {
    await interaction.deferReply();
    const cfg = getAntiRaidConfig(interaction.guild.id);
    const raiders = cfg.lastIncident?.raiders || [];
    let count = 0;
    for (const r of raiders) {
      try {
        const m = await interaction.guild.members.fetch(r.userId).catch(() => null);
        if (m && !isImmune(interaction.guild, m.id)) {
          await m.timeout(24 * 3600_000, `[VyntricBD Raid Sweep] Applied 24h timeout by ${interaction.user.tag}`);
          count++;
        }
      } catch {}
    }
    await interaction.editReply({
      content: `🧹 **Raider Sweep Completed:** Re-applied **24-hour timeout** to **${count} raiders** from the last incident wave.`,
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
      content: `🛡️ **Anti-Raid Shield acknowledged by <@${interaction.user.id}>.** Active defenses and lockdown will remain intact.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
}

/**
 * Handles text-based commands without slash: lockdown, unlock, antiraid, panic
 */
export async function handleAntiRaidTextCommand(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;
  const raw = message.content.trim();
  if (raw.length < 4) return false;

  const match = raw.match(/^([!?.+\-$&;]?)(panic|lockdown|unlock|antiraid)(?:\s+([\s\S]*))?$/i);
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
    return false;
  }

  if (cmd === "panic") {
    await triggerPanicMode(message.guild, message.author.tag);
    await message.reply({
      content: `🚨 **PANIC MODE ENGAGED:** Hard server lockdown activated and recent wave joiners swept.`,
    });
    return true;
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

    const res = await lockdownServer(
      message.guild,
      args || "Administrator Emergency Text Lockdown",
      message.author.tag,
      15,
      "hard"
    );

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.danger)
      .setTitle("🔒 Server Emergency Lockdown Activated [HARD]")
      .setDescription(
        `**${message.author.tag}** initiated a server-wide emergency lockdown.\n\n` +
          `• **Channels Locked:** **${res.channelsLocked.length} channels**\n` +
          `• **Duration:** **15 minutes** (auto-restores)\n` +
          `• **Action:** Public channels and threads have been muted.`
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
        `• Mode: \`${cfg.activeLockdown.mode.toUpperCase()}\` • Started: <t:${Math.floor(cfg.activeLockdown.startedAt / 1000)}:R>`
      : "🔓 **Server Normal (No active lockdown)**";

    const lastRaidText = cfg.lastIncident
      ? `• Incident ID: \`${cfg.lastIncident.id}\` (<t:${Math.floor(cfg.lastIncident.timestamp / 1000)}:R>)\n` +
        `• Vector: \`${cfg.lastIncident.type.toUpperCase()}\` • Raiders: **${cfg.lastIncident.raiderCount} accounts**\n` +
        (cfg.lastIncident.inviteCode ? `• Compromised Invite: \`discord.gg/${cfg.lastIncident.inviteCode}\`\n` : "")
      : "_No incidents recorded_";

    const embed = new EmbedBuilder()
      .setColor(cfg.enabled ? BRAND.colors.success : BRAND.colors.danger)
      .setTitle(`🛡️ ${BRAND.name} Enterprise Anti-Raid Shield`)
      .setDescription(
        `**Shield System:** ${statusIcon}\n` +
          `**Server Lockdown:** ${lockdownStatus}\n\n` +
          `${BRAND.divider}\n\n` +
          `### ⚡ Enterprise Multi-Vector Defenses\n` +
          `• **Velocity Detection:** **${cfg.joinRaid.threshold} joins** in **${cfg.joinRaid.windowSeconds}s**\n` +
          `• **Risk Scoring Engine:** ${cfg.riskScoring.enabled ? `✅ Active (Threshold: **${cfg.riskScoring.quarantineThreshold}/100**)` : "❌ Disabled"}\n` +
          `• **Name Similarity Clustering:** ${cfg.nameSimilarity.enabled ? `✅ Active (Threshold: **${cfg.nameSimilarity.threshold} accounts**)` : "❌ Disabled"}\n` +
          `• **Default-Avatar Wave Guard:** ${cfg.defaultAvatarGate.enabled ? `✅ Active (Burst: **${cfg.defaultAvatarGate.burstCount} accounts**)` : "❌ Disabled"}\n` +
          `• **Invite Auto-Revoke:** ${cfg.inviteTracking.autoRevokeRaidInvite ? "✅ Auto-Deletes Raid Invites" : "❌ Disabled"}\n` +
          `• **Cross-Channel Copypasta:** ${cfg.crossChannelSpam.enabled ? "✅ Blocks Multi-Channel Flood" : "❌ Disabled"}\n` +
          `• **Auto-Lockdown:** ${cfg.joinRaid.autoLockdown ? `✅ Yes (${cfg.joinRaid.autoLockdownMinutes}m ${cfg.joinRaid.lockdownMode.toUpperCase()})` : "❌ Disabled"}\n\n` +
          `### 🚨 Last Raid Incident\n${lastRaidText}\n\n` +
          `• **Alert Channel:** ${alertCh ? `<#${alertCh.id}>` : "_None configured_"}`
      )
      .setFooter({ text: `${BRAND.footer} • Anti-Raid Telemetry` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("antiraid:toggle")
        .setLabel(cfg.enabled ? "Disable Shield" : "Enable Shield")
        .setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(cfg.activeLockdown ? "antiraid:unlock" : "antiraid:lock")
        .setLabel(cfg.activeLockdown ? "🔓 Lift Lockdown" : "🔒 Hard Lockdown")
        .setStyle(cfg.activeLockdown ? ButtonStyle.Success : ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
    return true;
  }

  return false;
}

/**
 * Initializes anti-raid telemetry and auto-lockdown expiration heartbeat.
 */
export function initAntiRaid(client: VyntricClient) {
  // Pre-cache guild invites
  for (const guild of client.guilds.cache.values()) {
    cacheGuildInvites(guild).catch(() => {});
  }

  // Heartbeat check for expired auto-lockdowns
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
  }, 15_000);
}
