import {
  ActionRowBuilder,
  ButtonInteraction,
  ChannelType,
  GuildMember,
  Interaction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionsBitField,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
  VoiceChannel,
} from "discord.js";
import {
  deleteTempChannel,
  getTempChannel,
  saveTempChannel,
  TempChannelRecord,
} from "../lib/tempVoiceStore";

/**
 * Validates whether the user is in a temporary channel and whether they are authorized.
 */
function resolveUserTempChannel(
  interaction: ButtonInteraction | StringSelectMenuInteraction | UserSelectMenuInteraction | ModalSubmitInteraction
): {
  member: GuildMember | null;
  channel: VoiceChannel | null;
  tempRecord: TempChannelRecord | null;
  isOwner: boolean;
  error?: string;
} {
  const member = interaction.member as GuildMember | null;
  if (!member || !member.voice.channel) {
    return {
      member: null,
      channel: null,
      tempRecord: null,
      isOwner: false,
      error: "❌ You must be connected to a voice channel to use this interface!",
    };
  }

  const voiceCh = member.voice.channel as VoiceChannel;
  const tempRecord = getTempChannel(voiceCh.id);
  if (!tempRecord) {
    return {
      member,
      channel: voiceCh,
      tempRecord: null,
      isOwner: false,
      error: "❌ You are not connected to an active temporary voice channel!",
    };
  }

  const isOwner = tempRecord.ownerId === member.id;
  return {
    member,
    channel: voiceCh,
    tempRecord,
    isOwner,
  };
}

/**
 * Main interaction dispatcher for all TempVoice buttons, selects, and modals.
 */
export async function handleTempVoiceInteraction(interaction: Interaction): Promise<void> {
  // ─────────────────────────────────────────────────────────────
  // 1. BUTTON INTERACTIONS
  // ─────────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // Check voice channel context
    const ctx = resolveUserTempChannel(interaction);
    if (ctx.error || !ctx.channel || !ctx.tempRecord || !ctx.member) {
      await interaction.reply({
        content: ctx.error || "❌ Temporary voice channel not found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { channel, tempRecord, isOwner, member } = ctx;

    // A. CLAIM BUTTON (Allowed when owner left)
    if (customId === "voice_claim_button" || customId === "tv_btn_claim") {
      if (isOwner) {
        await interaction.reply({
          content: "❌ You are already the owner of this voice channel!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check if current owner is still inside the channel
      const isCurrentOwnerInChannel = channel.members.has(tempRecord.ownerId);
      if (isCurrentOwnerInChannel) {
        await interaction.reply({
          content: `❌ The owner (<@${tempRecord.ownerId}>) is still connected! You cannot claim ownership.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Claim success
      const oldOwnerId = tempRecord.ownerId;
      tempRecord.ownerId = member.id;
      saveTempChannel(tempRecord);

      // Update Discord channel overwrites
      await channel.permissionOverwrites
        .edit(member.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          Stream: true,
          ManageChannels: true,
          MoveMembers: true,
          MuteMembers: true,
          DeafenMembers: true,
          PrioritySpeaker: true,
        })
        .catch(() => {});

      if (oldOwnerId) {
        await channel.permissionOverwrites.delete(oldOwnerId).catch(() => {});
      }

      await interaction.reply({
        content: `👑 **Ownership Claimed!** You are now the owner of **#${channel.name}**!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // ALL OTHER BUTTONS REQUIRE CHANNEL OWNER
    if (!isOwner) {
      await interaction.reply({
        content: `❌ Only the channel owner (<@${tempRecord.ownerId}>) can use this control!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 1. RENAME (Modal)
    if (customId === "voice_rename_button" || customId === "tv_btn_rename") {
      const modal = new ModalBuilder()
        .setCustomId("tv_modal_rename")
        .setTitle("Rename Voice Channel");

      const input = new TextInputBuilder()
        .setCustomId("tv_input_name")
        .setLabel("Channel Name")
        .setStyle(TextInputStyle.Short)
        .setValue(channel.name)
        .setPlaceholder("Enter new channel name...")
        .setMaxLength(80)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    // 2. LIMIT (Modal)
    if (customId === "voice_limit_button" || customId === "tv_btn_limit") {
      const modal = new ModalBuilder()
        .setCustomId("tv_modal_limit")
        .setTitle("Set User Limit");

      const input = new TextInputBuilder()
        .setCustomId("tv_input_limit")
        .setLabel("User Limit (0 = Unlimited, Max 99)")
        .setStyle(TextInputStyle.Short)
        .setValue(channel.userLimit.toString())
        .setPlaceholder("e.g. 5")
        .setMaxLength(2)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    // 3. PRIVACY (Toggle Lock/Unlock)
    if (customId === "voice_privacy_button" || customId === "tv_btn_privacy") {
      if (!tempRecord.isLocked) {
        // Lock channel
        await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone.id, {
          Connect: false,
        });

        // Ensure trusted users retain Connect
        for (const tId of tempRecord.trustedUserIds) {
          await channel.permissionOverwrites
            .edit(tId, { Connect: true, ViewChannel: true })
            .catch(() => {});
        }

        tempRecord.isLocked = true;
        saveTempChannel(tempRecord);

        await interaction.reply({
          content:
            "🔒 **Channel Locked!** Other members cannot join unless they are trusted or invited.",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        // Unlock channel
        await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone.id, {
          Connect: true,
        });

        tempRecord.isLocked = false;
        saveTempChannel(tempRecord);

        await interaction.reply({
          content: "🔓 **Channel Unlocked!** Anyone can join now.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    // 4. WAITING ROOM (Toggle)
    if (customId === "voice_waiting_button" || customId === "tv_btn_waiting") {
      if (!tempRecord.waitingRoomChannelId) {
        // Create Waiting Room
        const wr = await interaction.guild!.channels.create({
          name: `🕒 Waiting Room`,
          type: ChannelType.GuildVoice,
          parent: channel.parentId || undefined,
          permissionOverwrites: [
            {
              id: interaction.guild!.roles.everyone.id,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect],
              deny: [PermissionsBitField.Flags.Speak],
            },
            {
              id: member.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.MoveMembers,
              ],
            },
          ],
        });

        tempRecord.waitingRoomChannelId = wr.id;
        saveTempChannel(tempRecord);

        await interaction.reply({
          content: `🕒 **Waiting Room created:** <#${wr.id}>\nUsers can wait there and you can drag them into your channel.`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        // Remove Waiting Room
        const wr = await interaction.guild!.channels
          .fetch(tempRecord.waitingRoomChannelId)
          .catch(() => null);
        if (wr) await wr.delete("Removed by owner").catch(() => {});

        tempRecord.waitingRoomChannelId = null;
        saveTempChannel(tempRecord);

        await interaction.reply({
          content: "🕒 Waiting Room has been closed and removed.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    // 5. CHAT TOGGLE
    if (customId === "voice_thread_button" || customId === "tv_btn_chat") {
      const isChatLocked = Boolean(tempRecord.chatLocked);
      if (!isChatLocked) {
        // Lock chat
        await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone.id, {
          SendMessages: false,
        });
        tempRecord.chatLocked = true;
        saveTempChannel(tempRecord);

        await interaction.reply({
          content: "💬 **Voice text chat locked!** Only you can send messages here.",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        // Unlock chat
        await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone.id, {
          SendMessages: true,
        });
        tempRecord.chatLocked = false;
        saveTempChannel(tempRecord);

        await interaction.reply({
          content: "💬 **Voice text chat unlocked!** Members can chat freely.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    // 6. TRUST (UserSelect Menu)
    if (customId === "voice_trust_button" || customId === "tv_btn_trust") {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId("tv_select_trust")
        .setPlaceholder("Select a member to trust...")
        .setMaxValues(1);

      const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);
      await interaction.reply({
        content: "🛡️ **Trust Member:** Select a user to allow into your channel even when locked:",
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 7. UNTRUST (UserSelect Menu)
    if (customId === "voice_untrust_button" || customId === "tv_btn_untrust") {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId("tv_select_untrust")
        .setPlaceholder("Select a member to untrust...")
        .setMaxValues(1);

      const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);
      await interaction.reply({
        content: "❌ **Untrust Member:** Select a user to revoke trusted access from:",
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 8. INVITE (UserSelect Menu)
    if (customId === "voice_invite_button" || customId === "tv_btn_invite") {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId("tv_select_invite")
        .setPlaceholder("Select a member to invite...")
        .setMaxValues(1);

      const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);
      await interaction.reply({
        content: "📨 **Invite Member:** Select a user to send an invite DM to:",
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 9. KICK (StringSelect Menu of current members in VC)
    if (customId === "voice_kick_button" || customId === "tv_btn_kick") {
      const otherMembers = channel.members.filter((m) => m.id !== member.id);
      if (otherMembers.size === 0) {
        await interaction.reply({
          content: "⚠️ There are no other members in your voice channel to kick.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId("tv_select_kick")
        .setPlaceholder("Select member to kick...")
        .addOptions(
          otherMembers.first(25).map((m) => ({
            label: m.displayName.slice(0, 50),
            description: `@${m.user.username}`.slice(0, 50),
            value: m.id,
            emoji: "👢",
          }))
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
      await interaction.reply({
        content: "👢 **Kick Member:** Select a member currently in your VC to disconnect:",
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 10. REGION (StringSelect Menu)
    if (customId === "voice_region_button" || customId === "tv_btn_region") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("tv_select_region")
        .setPlaceholder("Select voice RTC region...")
        .addOptions([
          { label: "Automatic (Recommended)", value: "auto", emoji: "🔄" },
          { label: "Singapore", value: "singapore", emoji: "🇸🇬" },
          { label: "India", value: "india", emoji: "🇮🇳" },
          { label: "Hong Kong", value: "hongkong", emoji: "🇭🇰" },
          { label: "Japan", value: "japan", emoji: "🇯🇵" },
          { label: "US Central", value: "us-central", emoji: "🇺🇸" },
          { label: "US East", value: "us-east", emoji: "🇺🇸" },
          { label: "US West", value: "us-west", emoji: "🇺🇸" },
          { label: "Rotterdam", value: "rotterdam", emoji: "🇳🇱" },
          { label: "Brazil", value: "brazil", emoji: "🇧🇷" },
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
      await interaction.reply({
        content: "🌐 **Voice Region:** Select the preferred audio server location:",
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 11. BLOCK (UserSelect Menu)
    if (customId === "voice_block_button" || customId === "tv_btn_block") {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId("tv_select_block")
        .setPlaceholder("Select a member to block...")
        .setMaxValues(1);

      const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);
      await interaction.reply({
        content: "⛔ **Block Member:** Select a member to ban from entering your channel:",
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 12. UNBLOCK (UserSelect Menu)
    if (customId === "voice_unblock_button" || customId === "tv_btn_unblock") {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId("tv_select_unblock")
        .setPlaceholder("Select a member to unblock...")
        .setMaxValues(1);

      const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);
      await interaction.reply({
        content: "🔓 **Unblock Member:** Select a member to unblock:",
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 13. TRANSFER (UserSelect Menu)
    if (customId === "voice_transfer_button" || customId === "tv_btn_transfer") {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId("tv_select_transfer")
        .setPlaceholder("Select a new channel owner...")
        .setMaxValues(1);

      const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);
      await interaction.reply({
        content: "👑 **Transfer Ownership:** Select a member to hand ownership over to:",
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 14. DELETE (Instant cleanup)
    if (customId === "voice_close_button" || customId === "tv_btn_delete") {
      await interaction.reply({
        content: "🗑️ Deleting your temporary channel...",
        flags: MessageFlags.Ephemeral,
      });

      if (tempRecord.waitingRoomChannelId) {
        const wr = await interaction.guild!.channels
          .fetch(tempRecord.waitingRoomChannelId)
          .catch(() => null);
        if (wr) await wr.delete().catch(() => {});
      }

      deleteTempChannel(tempRecord.channelId);
      await channel.delete("Owner deleted channel via interface").catch(() => {});
      return;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. MODAL SUBMIT INTERACTIONS
  // ─────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    const ctx = resolveUserTempChannel(interaction);
    if (ctx.error || !ctx.channel || !ctx.tempRecord || !ctx.isOwner) {
      await interaction.reply({
        content: ctx.error || "❌ You are not authorized to edit this channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { channel } = ctx;

    if (interaction.customId === "tv_modal_rename") {
      const newName = interaction.fields.getTextInputValue("tv_input_name").trim();
      if (!newName) {
        await interaction.reply({
          content: "❌ Channel name cannot be empty.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await channel.setName(newName);
      await interaction.reply({
        content: `✅ Voice channel renamed to **${newName}**!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.customId === "tv_modal_limit") {
      const val = interaction.fields.getTextInputValue("tv_input_limit").trim();
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 0 || num > 99) {
        await interaction.reply({
          content: "❌ Invalid user limit. Please enter a number between 0 and 99.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await channel.setUserLimit(num);
      await interaction.reply({
        content: `✅ User limit set to **${num === 0 ? "Unlimited" : num}**!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. SELECT MENU INTERACTIONS
  // ─────────────────────────────────────────────────────────────
  if (interaction.isUserSelectMenu()) {
    const ctx = resolveUserTempChannel(interaction);
    if (ctx.error || !ctx.channel || !ctx.tempRecord || !ctx.isOwner) {
      await interaction.reply({
        content: ctx.error || "❌ You are not authorized to manage this channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { channel, tempRecord } = ctx;
    const targetUserId = interaction.values[0];

    // Trust
    if (interaction.customId === "tv_select_trust") {
      if (!tempRecord.trustedUserIds.includes(targetUserId)) {
        tempRecord.trustedUserIds.push(targetUserId);
      }
      saveTempChannel(tempRecord);

      await channel.permissionOverwrites.edit(targetUserId, {
        Connect: true,
        ViewChannel: true,
        Speak: true,
      });

      await interaction.update({
        content: `✅ <@${targetUserId}> has been trusted and can join even when locked!`,
        components: [],
      });
      return;
    }

    // Untrust
    if (interaction.customId === "tv_select_untrust") {
      tempRecord.trustedUserIds = tempRecord.trustedUserIds.filter((id) => id !== targetUserId);
      saveTempChannel(tempRecord);

      await channel.permissionOverwrites.delete(targetUserId).catch(() => {});

      if (tempRecord.isLocked) {
        const targetMember = channel.members.get(targetUserId);
        if (targetMember) {
          await targetMember.voice.disconnect("Untrusted by channel owner").catch(() => {});
        }
      }

      await interaction.update({
        content: `❌ <@${targetUserId}> has been removed from trusted users.`,
        components: [],
      });
      return;
    }

    // Invite
    if (interaction.customId === "tv_select_invite") {
      const invite = await channel.createInvite({ maxAge: 3600, maxUses: 1 }).catch(() => null);
      if (!invite) {
        await interaction.update({
          content: "❌ Failed to create invite for your channel.",
          components: [],
        });
        return;
      }

      const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
      if (targetUser) {
        await targetUser
          .send({
            content: `📨 **${interaction.user.tag}** has invited you to join their voice channel in **${interaction.guild!.name}**!\n${invite.url}`,
          })
          .catch(() => {});
      }

      await interaction.update({
        content: `📨 Invite sent directly to <@${targetUserId}>!`,
        components: [],
      });
      return;
    }

    // Block
    if (interaction.customId === "tv_select_block") {
      if (!tempRecord.blockedUserIds.includes(targetUserId)) {
        tempRecord.blockedUserIds.push(targetUserId);
      }
      saveTempChannel(tempRecord);

      await channel.permissionOverwrites.edit(targetUserId, {
        Connect: false,
        ViewChannel: false,
      });

      const targetMember = channel.members.get(targetUserId);
      if (targetMember) {
        await targetMember.voice.disconnect("Blocked by channel owner").catch(() => {});
      }

      await interaction.update({
        content: `⛔ <@${targetUserId}> has been blocked and removed from your channel!`,
        components: [],
      });
      return;
    }

    // Unblock
    if (interaction.customId === "tv_select_unblock") {
      tempRecord.blockedUserIds = tempRecord.blockedUserIds.filter((id) => id !== targetUserId);
      saveTempChannel(tempRecord);

      await channel.permissionOverwrites.delete(targetUserId).catch(() => {});

      await interaction.update({
        content: `✅ <@${targetUserId}> has been unblocked.`,
        components: [],
      });
      return;
    }

    // Transfer
    if (interaction.customId === "tv_select_transfer") {
      if (targetUserId === interaction.user.id) {
        await interaction.update({
          content: "❌ You already own this channel.",
          components: [],
        });
        return;
      }

      const oldOwnerId = tempRecord.ownerId;
      tempRecord.ownerId = targetUserId;
      saveTempChannel(tempRecord);

      await channel.permissionOverwrites
        .edit(targetUserId, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          Stream: true,
          ManageChannels: true,
          MoveMembers: true,
          MuteMembers: true,
          DeafenMembers: true,
          PrioritySpeaker: true,
        })
        .catch(() => {});

      await channel.permissionOverwrites.delete(oldOwnerId).catch(() => {});

      await interaction.update({
        content: `👑 Ownership has been successfully transferred to <@${targetUserId}>!`,
        components: [],
      });
      return;
    }
  }

  // String Select Menus
  if (interaction.isStringSelectMenu()) {
    const ctx = resolveUserTempChannel(interaction);
    if (ctx.error || !ctx.channel || !ctx.tempRecord || !ctx.isOwner) {
      await interaction.reply({
        content: ctx.error || "❌ You are not authorized to manage this channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { channel } = ctx;

    // Kick
    if (interaction.customId === "tv_select_kick") {
      const targetId = interaction.values[0];
      const targetMember = channel.members.get(targetId);
      if (targetMember) {
        await targetMember.voice.disconnect("Kicked by channel owner").catch(() => {});
        await interaction.update({
          content: `👢 Successfully kicked <@${targetId}> from your voice channel!`,
          components: [],
        });
      } else {
        await interaction.update({
          content: "⚠️ That member is no longer in your channel.",
          components: [],
        });
      }
      return;
    }

    // Region
    if (interaction.customId === "tv_select_region") {
      const selected = interaction.values[0];
      const region = selected === "auto" ? null : selected;
      await channel.setRTCRegion(region);

      await interaction.update({
        content: `🌐 Voice RTC region successfully updated to **${selected.toUpperCase()}**!`,
        components: [],
      });
      return;
    }
  }
}
