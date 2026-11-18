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
  getTempChannel,
  getTempChannelByOwner,
  getTempVoiceConfig,
  saveTempChannel,
  TempChannelRecord,
} from "./tempVoiceStore";

export const INTERFACE_IMAGE_URL =
  "https://tempvoice.xyz/api/v2/canvas?language=en&features=voice_rename_button,voice_limit_button,voice_privacy_button,voice_waiting_button,voice_thread_button,voice_trust_button,voice_untrust_button,voice_invite_button,voice_kick_button,voice_region_button,voice_block_button,voice_unblock_button,voice_claim_button,voice_transfer_button,voice_close_button&quality=2&max";

/**
 * Builds the exact TempVoice Interface Control Panel matching user screenshot.
 */
export function buildInterfacePayload() {
  const embed = new EmbedBuilder()
    .setColor(0xd4145a)
    .setDescription(
      "# TempVoice Interface\n" +
        "This **interface** can be used to manage temporary voice channels. More options are available with **/voice** commands."
    )
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

  // ─────────────────────────────────────────────────────────────
  // 1. JOIN-TO-CREATE: Member joins the creator channel ("Create vc")
  // ─────────────────────────────────────────────────────────────
  if (newState.channelId && newState.channelId === config.creatorChannelId) {
    try {
      // Check if user already has an active channel
      const existingRecord = getTempChannelByOwner(guild.id, member.id);
      if (existingRecord) {
        const existingCh = (await guild.channels
          .fetch(existingRecord.channelId)
          .catch(() => null)) as VoiceChannel | null;
        if (existingCh) {
          // Move user back to their channel
          await member.voice.setChannel(existingCh);
          return;
        } else {
          // Channel was deleted manually
          deleteTempChannel(existingRecord.channelId);
        }
      }

      // Generate channel name: "! {User}'s Channel"
      const cleanName = member.displayName.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "User";
      const channelName = config.defaultNameTemplate
        .replace("{user}", cleanName)
        .replace("{tag}", member.user.username);

      // Create new Voice Channel under category
      const newChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: config.categoryId || undefined,
        userLimit: config.defaultUserLimit || 0,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.Stream,
            ],
          },
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.Stream,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.MoveMembers,
              PermissionsBitField.Flags.MuteMembers,
              PermissionsBitField.Flags.DeafenMembers,
              PermissionsBitField.Flags.PrioritySpeaker,
            ],
          },
        ],
        reason: `TempVoice: Join to create by ${member.user.tag}`,
      });

      // Move member into new channel
      await member.voice.setChannel(newChannel);

      // Save to store
      const record: TempChannelRecord = {
        channelId: newChannel.id,
        guildId: guild.id,
        ownerId: member.id,
        createdAt: Date.now(),
        isLocked: false,
        trustedUserIds: [],
        blockedUserIds: [],
        waitingRoomChannelId: null,
      };
      saveTempChannel(record);

      console.log(
        `[tempvoice] Created temporary channel #${newChannel.name} for ${member.user.tag}`
      );
    } catch (err) {
      console.error("[tempvoice:j2c:create:error]", err);
    }
    return;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CHANNEL CLEANUP: Member leaves a temporary channel
  // ─────────────────────────────────────────────────────────────
  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    const tempRecord = getTempChannel(oldState.channelId);
    if (!tempRecord) return;

    try {
      const oldChannel = (await guild.channels
        .fetch(oldState.channelId)
        .catch(() => null)) as VoiceChannel | null;

      if (!oldChannel || oldChannel.members.size === 0) {
        // Channel is completely empty -> delete it
        if (oldChannel) {
          await oldChannel.delete("TempVoice: Channel is empty").catch(() => {});
        }

        // Delete waiting room if one was attached
        if (tempRecord.waitingRoomChannelId) {
          const wr = await guild.channels
            .fetch(tempRecord.waitingRoomChannelId)
            .catch(() => null);
          if (wr) await wr.delete("TempVoice: Main channel deleted").catch(() => {});
        }

        deleteTempChannel(tempRecord.channelId);
        console.log(
          `[tempvoice] Deleted empty temporary channel ${tempRecord.channelId}`
        );
      } else {
        // Channel still has members, but the owner left
        if (member.id === tempRecord.ownerId) {
          console.log(
            `[tempvoice] Owner ${member.user.tag} left temporary channel #${oldChannel.name}. Channel remains active for others.`
          );
        }
      }
    } catch (err) {
      console.error("[tempvoice:j2c:leave:error]", err);
    }
  }
}
