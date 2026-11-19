import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Guild,
  GuildMember,
  PermissionsBitField,
  TextChannel,
  VoiceChannel,
  VoiceState,
} from "discord.js";
import {
  deleteTempChannel,
  getAllTempChannels,
  getStatusSettings,
  getTempChannel,
  getTempChannelByOwner,
  getTempVoiceConfig,
  saveTempChannel,
  TempChannelRecord,
  TempChannelStatusSettings,
  updateStatusSettings,
} from "./tempVoiceStore";
import { VyntricClient } from "../structures/VyntricClient";

export const INTERFACE_IMAGE_URL =
  "https://tempvoice.xyz/api/v2/canvas?language=en&features=voice_rename_button,voice_limit_button,voice_privacy_button,voice_waiting_button,voice_thread_button,voice_trust_button,voice_untrust_button,voice_invite_button,voice_kick_button,voice_region_button,voice_block_button,voice_unblock_button,voice_claim_button,voice_transfer_button,voice_close_button&quality=2&max";

/**
 * Builds the exact TempVoice Interface Control Panel matching user screenshot.
 * If record and channel are provided, generates a real-time live status dashboard.
 */
export function buildInterfacePayload(
  record?: TempChannelRecord,
  channel?: VoiceChannel
) {
  let color = 0xd4145a;
  let description =
    "# VC Interface\n" +
    "This **interface** can be used to manage temporary voice channels. More options are available with **/voice** commands.";

  if (record && channel) {
    if (record.isHidden) color = 0x9b59b6; // Ghost / Hidden
    else if (record.isLocked) color = 0xe74c3c; // Locked / Private
    else color = 0xd4145a; // Public

    const capacityStr =
      channel.userLimit === 0
        ? "♾️ Unlimited"
        : `${channel.members.size} / ${channel.userLimit} Slots`;
    const privacyStr = record.isLocked ? "🔒 Locked" : "🔓 Public";
    const visibilityStr = record.isHidden ? "👻 Hidden" : "👁️ Visible";
    const trustedCount =
      record.trustedUserIds.length > 0
        ? `${record.trustedUserIds.length} user(s)`
        : "None";
    const blockedCount =
      record.blockedUserIds.length > 0
        ? `${record.blockedUserIds.length} user(s)`
        : "None";
    const waitingStr = record.waitingRoomChannelId ? "🟢 Active" : "Disabled";
    const chatStr = record.chatLocked ? "🔒 Locked" : "💬 Open";

    description =
      `# VC Interface\n` +
      `This **interface** can be used to manage temporary voice channels. More options are available with **/voice** commands.\n\n` +
      `> 👑 **Room Owner:** <@${record.ownerId}>\n` +
      `> 👥 **Capacity:** \`${capacityStr}\`\n` +
      `> 🔐 **Privacy:** \`${privacyStr}\`\n` +
      `> 👁️ **Visibility:** \`${visibilityStr}\`\n` +
      `> 💬 **Chat:** \`${chatStr}\`\n` +
      `> 🛡️ **Trusted:** \`${trustedCount}\`\n` +
      `> 🚫 **Blocked:** \`${blockedCount}\`\n` +
      `> ⏳ **Waiting Room:** \`${waitingStr}\``;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setDescription(description)
    .setImage(INTERFACE_IMAGE_URL)
    .setFooter({ text: "Press the buttons below to use the interface" });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("voice_rename_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161605686568960060", name: "name" }),
    new ButtonBuilder()
      .setCustomId("voice_limit_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161605683955900496", name: "limit" }),
    new ButtonBuilder()
      .setCustomId("voice_privacy_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161605685201612840", name: "lock" }),
    new ButtonBuilder()
      .setCustomId("voice_waiting_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161605871227387965", name: "waiting" }),
    new ButtonBuilder()
      .setCustomId("voice_thread_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1427941772163682408", name: "chat" })
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("voice_trust_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161647139244490832", name: "trust" }),
    new ButtonBuilder()
      .setCustomId("voice_untrust_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1162862846007320668", name: "untrust" }),
    new ButtonBuilder()
      .setCustomId("voice_invite_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161647152821444688", name: "invite" }),
    new ButtonBuilder()
      .setCustomId("voice_kick_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161605681107976263", name: "kick" }),
    new ButtonBuilder()
      .setCustomId("voice_region_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161605689576263753", name: "region" })
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("voice_block_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161605864898174986", name: "block" }),
    new ButtonBuilder()
      .setCustomId("voice_unblock_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1162862844585443370", name: "unblock" }),
    new ButtonBuilder()
      .setCustomId("voice_claim_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161605458054889472", name: "claim" }),
    new ButtonBuilder()
      .setCustomId("voice_transfer_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161647167488929963", name: "transfer" }),
    new ButtonBuilder()
      .setCustomId("voice_close_button")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji({ id: "1161605459292205076", name: "delete" })
  );

  return {
    embeds: [embed],
    components: [row1, row2, row3],
  };
}

/**
 * Builds the Status Moderation (Game / Among Us Mode) panel matching Base-Bot-1.
 */
export function buildStatusPanelPayload(
  settings: TempChannelStatusSettings,
  member: GuildMember,
  ownerId: string
) {
  const allOwners = [ownerId, ...(settings.extraOwners || [])];
  const ownerUsers = allOwners.map((id) => `<@${id}>`).join(", ") || `<@${ownerId}>`;

  const whitelistUsers =
    settings.whitelist?.length > 0
      ? settings.whitelist.map((id) => `<@${id}>`).join(", ")
      : "None";
  const blacklistUsers =
    settings.blacklist?.length > 0
      ? settings.blacklist.map((id) => `<@${id}>`).join(", ")
      : "None";

  const embed = new EmbedBuilder()
    .setTitle("🎮 Status Moderation (Game Mode)")
    .setDescription(
      "Manage voice channel mute states and gaming permissions.\n\n" +
      `**🔇 Muted:** ${settings.isMuted ? "Yes 🔇" : "No 🔊"}\n` +
      `**👑 Owners:** ${ownerUsers}\n` +
      `**🎯 Whitelist (Targeted):** ${whitelistUsers}\n` +
      `**🛡️ Blacklist (Immune):** ${blacklistUsers}\n\n` +
      "*Use the buttons below to control the game session.*"
    )
    .setColor(settings.isMuted ? 0xff0000 : 0x00ff00)
    .setTimestamp()
    .setFooter({
      text: `Requested by ${member.user.username}`,
      iconURL: member.user.displayAvatarURL(),
    });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("status_mute_toggle")
      .setLabel(settings.isMuted ? "Unmute All" : "Mute All")
      .setStyle(settings.isMuted ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("status_whitelist")
      .setLabel("Whitelist")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("status_blacklist")
      .setLabel("Blacklist")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("status_extraowner")
      .setLabel("Extra Owner")
      .setEmoji("👑")
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("status_endgame")
      .setLabel("End Game")
      .setEmoji("🏁")
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1, row2] };
}

// Track 5-minute delayed ownership transfers when owner disconnects: channelId -> timer & ownerId
export const ownerLeaveTimers = new Map<
  string,
  { timeout: NodeJS.Timeout; ownerId: string }
>();

// Per-user creation mutex: prevents concurrent channel creation for the same user
const activeCreations = new Set<string>();

// Per-user creation cooldown: rate-limits rapid double-clicks (2.5s window)
const creationCooldowns = new Map<string, number>();

/**
 * Live updates the interactive control panel embed in the VC text chat.
 */
export async function updateVoiceChannelInterface(
  guild: Guild,
  channelId: string
): Promise<void> {
  const record = getTempChannel(channelId);
  if (!record || !record.interfaceMessageId) return;

  const channel = (await guild.channels
    .fetch(channelId)
    .catch(() => null)) as VoiceChannel | null;
  if (!channel || !channel.isVoiceBased()) return;

  const msg = await channel.messages
    .fetch(record.interfaceMessageId)
    .catch(() => null);
  if (!msg) return;

  const payload = buildInterfacePayload(record, channel);
  await msg.edit(payload).catch(() => {});
}

/**
 * Sends or updates the Control Panel in the interface text channel.
 */
export async function setupInterfaceChannel(
  channel: TextChannel,
  replaceExisting: boolean = false
): Promise<string> {
  const payload = buildInterfacePayload();

  if (replaceExisting) {
    const fetched = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    if (fetched) {
      for (const msg of fetched.values()) {
        if (msg.author.id === channel.client.user.id && msg.embeds.length > 0) {
          await msg.delete().catch(() => {});
        }
      }
    }
  }

  const sent = await channel.send(payload);
  return sent.id;
}

/**
 * Processes a member leaving a temporary voice channel:
 * - If channel becomes completely empty of humans, deletes it immediately.
 * - If channel still has humans and the departing member is the owner,
 *   starts a 5-minute delayed auto-transfer timer to the 2nd person who joined.
 */
export async function handleLeaveTempChannel(
  guild: Guild,
  member: GuildMember,
  oldChannelId: string
): Promise<void> {
  const tempRecord = getTempChannel(oldChannelId);
  if (!tempRecord) return;

  try {
    const oldChannel = (await guild.channels
      .fetch(oldChannelId)
      .catch(() => null)) as VoiceChannel | null;

    // Filter remaining human members, explicitly excluding the departing member and bots
    const remainingHumans = oldChannel
      ? oldChannel.members.filter((m) => m.id !== member.id && !m.user.bot)
      : null;

    const isChannelEmpty = !oldChannel || !remainingHumans || remainingHumans.size === 0;

    if (isChannelEmpty) {
      // Voice channel is deleted immediately if there's no one in the voice channel
      const pending = ownerLeaveTimers.get(tempRecord.channelId);
      if (pending) {
        clearTimeout(pending.timeout);
        ownerLeaveTimers.delete(tempRecord.channelId);
      }

      if (oldChannel) {
        await oldChannel.delete("TempVoice: Channel is empty").catch(() => {});
      }

      // Delete waiting room if one was attached
      if (tempRecord.waitingRoomChannelId) {
        const wr = await guild.channels
          .fetch(tempRecord.waitingRoomChannelId)
          .catch(() => null);
        if (wr)
          await wr.delete("TempVoice: Main channel deleted").catch(() => {});
      }

      deleteTempChannel(tempRecord.channelId);
      console.log(
        `[tempvoice] Deleted empty temporary channel ${tempRecord.channelId}`
      );
    } else {
      // Channel still has members

      // If a non-owner member left, remove them from the join order list
      if (member.id !== tempRecord.ownerId && tempRecord.memberJoinOrder) {
        tempRecord.memberJoinOrder = tempRecord.memberJoinOrder.filter((id) => id !== member.id);
        saveTempChannel(tempRecord);
      }

      // If the owner left (and room is not empty), start 5-minute auto-transfer to the 2nd person who joined
      if (member.id === tempRecord.ownerId) {
        const existingTimer = ownerLeaveTimers.get(tempRecord.channelId);
        if (existingTimer) clearTimeout(existingTimer.timeout);

        const timeout = setTimeout(async () => {
          ownerLeaveTimers.delete(tempRecord.channelId);
          try {
            const targetCh = (await guild.channels
              .fetch(tempRecord.channelId)
              .catch(() => null)) as VoiceChannel | null;
            
            const activeHumans = targetCh
              ? targetCh.members.filter((m) => !m.user.bot)
              : null;

            if (!targetCh || !targetCh.isVoiceBased() || !activeHumans || activeHumans.size === 0) {
              if (targetCh) await targetCh.delete("TempVoice: Empty channel").catch(() => {});
              deleteTempChannel(tempRecord.channelId);
              return;
            }

            const currentRec = getTempChannel(targetCh.id);
            if (!currentRec || currentRec.ownerId !== member.id) return;
            if (targetCh.members.has(member.id)) return; // Owner rejoined

            // Select the 2nd person who joined after the owner!
            let newOwnerId: string | undefined = currentRec.memberJoinOrder?.find(
              (id) =>
                id !== member.id &&
                targetCh.members.has(id) &&
                !targetCh.members.get(id)?.user.bot
            );

            // Fallback if not found in join order
            if (!newOwnerId) {
              newOwnerId = activeHumans.first()?.id;
            }
            if (!newOwnerId) return;

            const newOwner = targetCh.members.get(newOwnerId);
            if (!newOwner) return;

            const oldOwnerId = currentRec.ownerId;
            currentRec.ownerId = newOwnerId;
            if (currentRec.memberJoinOrder) {
              currentRec.memberJoinOrder = [
                newOwnerId,
                ...currentRec.memberJoinOrder.filter(
                  (id) => id !== newOwnerId && id !== oldOwnerId
                ),
              ];
            }
            saveTempChannel(currentRec);

            // Rename channel
            const cleanName =
              newOwner.displayName.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "User";
            await targetCh.setName(`! ${cleanName}'s Channel`).catch(() => {});

            // Grant full control permissions to new owner
            await targetCh.permissionOverwrites
              .edit(newOwnerId, {
                ViewChannel: true,
                Connect: true,
                Speak: true,
                Stream: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageChannels: true,
                MoveMembers: true,
                MuteMembers: true,
                DeafenMembers: true,
                PrioritySpeaker: true,
              })
              .catch(() => {});

            // Remove previous owner's specific manage permissions
            if (oldOwnerId) {
              await targetCh.permissionOverwrites.delete(oldOwnerId).catch(() => {});
            }

            void updateVoiceChannelInterface(guild, targetCh.id);

            await targetCh
              .send({
                content: `👑 **Ownership Auto-Transferred:** <@${newOwnerId}> is now the channel owner.`,
              })
              .catch(() => {});
          } catch (e) {
            console.error("[tempvoice:delayed_transfer:error]", e);
          }
        }, 5 * 60 * 1000);

        ownerLeaveTimers.set(tempRecord.channelId, { timeout, ownerId: member.id });
      }

      // Update live interface embed
      void updateVoiceChannelInterface(guild, oldChannelId);
    }
  } catch (err) {
    console.error("[tempvoice:j2c:leave:error]", err);
  }
}

/**
 * Handles member entering or leaving voice channels for Join-to-Create (J2C) logic.
 */
export async function handleTempVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  const member = newState.member || oldState.member;
  const guild = newState.guild || oldState.guild;
  if (!member || !guild || member.user.bot) return;

  const config = getTempVoiceConfig(guild.id);
  if (!config.enabled) return;

  // Ignore audio state changes (self-mute, self-deaf, speaking, streaming) where channel did not change
  if (oldState.channelId === newState.channelId) {
    return;
  }

  // ─────────────────────────────────────────────────────────────
  // 1. LEAVE EVENT & CHANNEL CLEANUP (Runs whenever member leaves a channel)
  // ─────────────────────────────────────────────────────────────
  if (oldState.channelId) {
    await handleLeaveTempChannel(guild, member, oldState.channelId);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. JOIN-TO-CREATE: Member joins the creator channel ("Create vc")
  // ─────────────────────────────────────────────────────────────
  if (
    newState.channelId &&
    newState.channelId === config.creatorChannelId &&
    oldState.channelId !== config.creatorChannelId
  ) {
    const lockKey = `${guild.id}:${member.id}`;

    // A. Check mutex lock: if creation is already in flight for this member, drop duplicate event
    if (activeCreations.has(lockKey)) {
      console.warn(
        `[tempvoice:lock] Blocked concurrent duplicate creation attempt for ${member.user.tag}`
      );
      return;
    }

    // B. Check debounce cooldown: rate limit rapid double-clicking (2500ms window)
    const now = Date.now();
    const lastCreated = creationCooldowns.get(lockKey) || 0;
    if (now - lastCreated < 2500) {
      console.warn(
        `[tempvoice:cooldown] Rate limited rapid creation attempt for ${member.user.tag}`
      );
      return;
    }

    // Acquire mutex lock
    activeCreations.add(lockKey);
    creationCooldowns.set(lockKey, now);

    try {
      // Re-verify member is still connected in creator channel
      if (!member.voice.channelId || member.voice.channelId !== config.creatorChannelId) {
        console.log(
          `[tempvoice] Member ${member.user.tag} left creator channel before creation began; aborted.`
        );
        return;
      }

      // Check existing channels owned by this member
      const existingOwned = getAllTempChannels(guild.id).filter(
        (c) => c.ownerId === member.id
      );

      for (const existingRecord of existingOwned) {
        const existingCh = (await guild.channels
          .fetch(existingRecord.channelId)
          .catch(() => null)) as VoiceChannel | null;

        if (existingCh) {
          const remainingHumans = existingCh.members.filter(
            (m) => m.id !== member.id && !m.user.bot
          );

          if (remainingHumans.size > 0) {
            // There are still other people in the owner's old VC!
            // Do NOT force the user back to the old VC.
            // Let the owner create a brand new VC, while the old VC remains on
            // its 5-minute auto-transfer countdown to transfer ownership to the 2nd joiner.
            console.log(
              `[tempvoice] Owner ${member.user.tag} creating new channel; old channel #${existingCh.name} has ${remainingHumans.size} members and will auto-transfer.`
            );
          } else {
            // Old channel has no other humans (it is empty) - delete it immediately
            const pending = ownerLeaveTimers.get(existingRecord.channelId);
            if (pending) {
              clearTimeout(pending.timeout);
              ownerLeaveTimers.delete(existingRecord.channelId);
            }
            await existingCh.delete("TempVoice: Owner creating new channel").catch(() => {});
            deleteTempChannel(existingRecord.channelId);
          }
        } else {
          // Channel already deleted
          deleteTempChannel(existingRecord.channelId);
        }
      }

      // Generate channel name: "! {User}'s Channel"
      const cleanName =
        member.displayName.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "User";
      const channelName = config.defaultNameTemplate
        .replace("{user}", cleanName)
        .replace("{tag}", member.user.username);

      // Create new Voice Channel under category
      const botId = guild.client.user?.id || (await guild.members.fetchMe()).id;
      const newChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: config.categoryId || undefined,
        userLimit: config.defaultUserLimit || 0,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.Stream,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.Stream,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.MoveMembers,
              PermissionsBitField.Flags.MuteMembers,
              PermissionsBitField.Flags.DeafenMembers,
              PermissionsBitField.Flags.PrioritySpeaker,
            ],
          },
          {
            id: botId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.EmbedLinks,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.MoveMembers,
            ],
          },
        ],
        reason: `TempVoice: Join to create by ${member.user.tag}`,
      });

      // Prepare temp channel record
      const record: TempChannelRecord = {
        channelId: newChannel.id,
        guildId: guild.id,
        ownerId: member.id,
        createdAt: Date.now(),
        isLocked: false,
        isHidden: false,
        trustedUserIds: [],
        blockedUserIds: [],
        waitingRoomChannelId: null,
        memberJoinOrder: [member.id],
        statusSettings: {
          isMuted: false,
          extraOwners: [],
          whitelist: [],
          blacklist: [],
        },
      };

      // IMMEDIATELY save record to store so concurrent lookups see it right away
      saveTempChannel(record);

      // Move member into new channel with rollback safety
      try {
        await member.voice.setChannel(newChannel);
      } catch (moveErr) {
        console.warn(
          `[tempvoice] Failed to move ${member.user.tag} to #${newChannel.name} (user disconnected or moved away). Rolling back channel.`
        );
        await newChannel.delete("TempVoice: User left before move completed").catch(() => {});
        deleteTempChannel(newChannel.id);
        return;
      }

      // Post the Control Panel directly in the newly created voice channel's chat!
      const panelPayload = buildInterfacePayload(record, newChannel);
      const sentPanel = await newChannel.send(panelPayload).catch((err) => {
        console.error("[tempvoice:send_vc_interface:error]", err);
        return null;
      });

      if (sentPanel) {
        record.interfaceMessageId = sentPanel.id;
        saveTempChannel(record);
      }

      console.log(
        `[tempvoice] Created temporary channel #${newChannel.name} with live interface for ${member.user.tag}`
      );
    } catch (err) {
      console.error("[tempvoice:j2c:create:error]", err);
    } finally {
      // Guaranteed release of mutex lock
      activeCreations.delete(lockKey);
    }
    return;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. WAITING ROOM NOTIFICATION & 1-CLICK ADMISSION
  // ─────────────────────────────────────────────────────────────
  if (newState.channelId && newState.channelId !== oldState.channelId) {
    const allChannels = getAllTempChannels(guild.id);
    const waitingMatch = allChannels.find(
      (c) => c.waitingRoomChannelId === newState.channelId
    );

    if (waitingMatch) {
      const mainCh = (await guild.channels
        .fetch(waitingMatch.channelId)
        .catch(() => null)) as VoiceChannel | null;

      if (mainCh) {
        const admitRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`tv_admit_${member.id}_${waitingMatch.channelId}`)
            .setLabel(`Admit ${member.displayName}`)
            .setStyle(ButtonStyle.Success)
            .setEmoji("📥"),
          new ButtonBuilder()
            .setCustomId(`tv_deny_${member.id}_${waitingMatch.channelId}`)
            .setLabel("Decline")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("✖️")
        );

        const alertMsg = await mainCh
          .send({
            content: `🔔 **Waiting Room Alert:** ${member.user} is waiting to join your room!`,
            components: [admitRow],
          })
          .catch(() => null);

        if (alertMsg) {
          setTimeout(() => alertMsg.delete().catch(() => {}), 120_000);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. JOIN EVENT TO EXISTING TEMP CHANNEL: Toast & Live Embed Update
  // ─────────────────────────────────────────────────────────────
  if (
    newState.channelId &&
    newState.channelId !== config.creatorChannelId &&
    newState.channelId !== oldState.channelId
  ) {
    const tempRecord = getTempChannel(newState.channelId);
    if (tempRecord) {
      // Record join order chronologically (excluding bots)
      if (!member.user.bot) {
        if (!tempRecord.memberJoinOrder) {
          tempRecord.memberJoinOrder = [tempRecord.ownerId];
        }
        if (!tempRecord.memberJoinOrder.includes(member.id)) {
          tempRecord.memberJoinOrder.push(member.id);
          saveTempChannel(tempRecord);
        }
      }

      // If the owner rejoined, cancel any pending delayed ownership transfer!
      const pendingTimer = ownerLeaveTimers.get(newState.channelId);
      if (pendingTimer && pendingTimer.ownerId === member.id) {
        // Only cancel if this user does NOT currently own another active channel
        const isOwnerOfAnotherChannel = getAllTempChannels(guild.id).some(
          (c) => c.channelId !== newState.channelId && c.ownerId === member.id
        );

        if (!isOwnerOfAnotherChannel) {
          clearTimeout(pendingTimer.timeout);
          ownerLeaveTimers.delete(newState.channelId);
          console.log(
            `[tempvoice] Owner ${member.user.tag} returned within 5m grace period. Auto-transfer cancelled.`
          );
        }
      }

      // Update live interface embed
      void updateVoiceChannelInterface(guild, newState.channelId);
    }
  }
}

/**
 * Sweeps and deletes any temporary voice channels that are currently empty.
 * Guarantees that empty temporary channels are never left behind.
 */
export async function sweepEmptyTempChannels(client: VyntricClient): Promise<number> {
  let totalDeleted = 0;
  for (const guild of client.guilds.cache.values()) {
    const config = getTempVoiceConfig(guild.id);
    if (!config.enabled) continue;

    const allRecords = getAllTempChannels(guild.id);
    for (const record of allRecords) {
      try {
        const channel = (await guild.channels
          .fetch(record.channelId)
          .catch(() => null)) as VoiceChannel | null;

        const humanCount = channel
          ? channel.members.filter((m) => !m.user.bot).size
          : 0;

        if (!channel || humanCount === 0) {
          const pending = ownerLeaveTimers.get(record.channelId);
          if (pending) {
            clearTimeout(pending.timeout);
            ownerLeaveTimers.delete(record.channelId);
          }
          if (channel) {
            await channel
              .delete("TempVoice: Auto-sweep empty voice channel")
              .catch(() => {});
          }
          if (record.waitingRoomChannelId) {
            const wr = await guild.channels
              .fetch(record.waitingRoomChannelId)
              .catch(() => null);
            if (wr)
              await wr.delete("TempVoice: Main channel deleted").catch(() => {});
          }
          deleteTempChannel(record.channelId);
          totalDeleted++;
        }
      } catch (err) {
        console.error(`[tempvoice:sweep:${record.channelId}]`, err);
      }
    }

    // In addition, sweep any orphaned or untracked empty voice channels in the JTC category!
    if (config.categoryId) {
      try {
        const category = await guild.channels.fetch(config.categoryId).catch(() => null);
        if (category && category.type === ChannelType.GuildCategory) {
          const children = guild.channels.cache.filter(
            (ch) =>
              ch.parentId === config.categoryId &&
              ch.type === ChannelType.GuildVoice &&
              ch.id !== config.creatorChannelId
          );

          for (const ch of children.values()) {
            const vc = ch as VoiceChannel;
            // Grace period: do not delete channels created in the last 15 seconds (in-flight move)
            if (vc.createdTimestamp && Date.now() - vc.createdTimestamp < 15_000) {
              continue;
            }

            const humanCount = vc.members.filter((m) => !m.user.bot).size;
            if (humanCount === 0) {
              const pending = ownerLeaveTimers.get(vc.id);
              if (pending) {
                clearTimeout(pending.timeout);
                ownerLeaveTimers.delete(vc.id);
              }
              await vc
                .delete("TempVoice: Auto-sweep orphaned empty category channel")
                .catch(() => {});
              deleteTempChannel(vc.id);
              totalDeleted++;
            }
          }
        }
      } catch (catErr) {
        console.error(`[tempvoice:sweep:category:${config.categoryId}]`, catErr);
      }
    }
  }
  return totalDeleted;
}

/**
 * Initializes TempVoice heartbeat:
 * 1. Sweeps empty channels on startup.
 * 2. Runs an empty channel check every 30 seconds to guarantee no empty voice channel remains.
 */
export function initTempVoice(client: VyntricClient) {
  sweepEmptyTempChannels(client).catch((err) =>
    console.error("[tempvoice:initSweep:error]", err)
  );

  setInterval(() => {
    sweepEmptyTempChannels(client).catch(() => {});
  }, 30_000);
}
