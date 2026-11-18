import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  VoiceChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import {
  deleteTempChannel,
  getTempChannel,
  getTempVoiceConfig,
  saveTempChannel,
  setTempVoiceConfig,
} from "../../lib/tempVoiceStore";
import { setupInterfaceChannel } from "../../lib/tempVoiceManager";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("voice")
    .setDescription("Manage temporary voice channels (Astro / TempVoice system)")
    .addSubcommand((sub) =>
      sub
        .setName("name")
        .setDescription("Rename your temporary voice channel")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("New name for your channel")
            .setRequired(true)
            .setMaxLength(80)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("limit")
        .setDescription("Set the user limit for your voice channel (0 = unlimited)")
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("Number of members allowed (0-99)")
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(99)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("lock").setDescription("Lock your channel so other members cannot join")
    )
    .addSubcommand((sub) =>
      sub.setName("unlock").setDescription("Unlock your channel so anyone can join")
    )
    .addSubcommand((sub) =>
      sub
        .setName("trust")
        .setDescription("Trust a member so they can join even when your channel is locked")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to trust").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("untrust")
        .setDescription("Remove trusted status from a member")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to untrust").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("block")
        .setDescription("Block a member from seeing or entering your channel")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to block").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("unblock")
        .setDescription("Unblock a member")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to unblock").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("kick")
        .setDescription("Kick/disconnect a member from your channel")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("Member to kick").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("claim").setDescription("Claim ownership of an abandoned temporary voice channel")
    )
    .addSubcommand((sub) =>
      sub
        .setName("transfer")
        .setDescription("Transfer ownership of your channel to another member")
        .addUserOption((opt) =>
          opt.setName("member").setDescription("New channel owner").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("delete").setDescription("Delete your temporary voice channel")
    )
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Administrator: Setup the TempVoice interface control panel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Text channel to post the control panel in (defaults to #interface)")
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("creator")
            .setDescription("The Join to Create voice channel (defaults to 'Create vc')")
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;
    const member = interaction.member as any;

    // ─────────────────────────────────────────────────────────────
    // SETUP SUBCOMMAND (Admin only)
    // ─────────────────────────────────────────────────────────────
    if (sub === "setup") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: "❌ You need `Administrator` permission to run `/voice setup`.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const config = getTempVoiceConfig(guild.id);
      const targetCh =
        (interaction.options.getChannel("channel") as TextChannel | null) ||
        ((await guild.channels.fetch(config.interfaceChannelId).catch(() => null)) as TextChannel | null);

      if (!targetCh || !targetCh.isTextBased()) {
        await interaction.editReply(
          "❌ Could not find a valid interface text channel. Please specify one with the `channel` option."
        );
        return;
      }

      const creatorCh = interaction.options.getChannel("creator");
      if (creatorCh) {
        setTempVoiceConfig(guild.id, { creatorChannelId: creatorCh.id });
      }

      const msgId = await setupInterfaceChannel(targetCh, false);
      setTempVoiceConfig(guild.id, {
        interfaceChannelId: targetCh.id,
        interfaceMessageId: msgId,
      });

      await interaction.editReply(
        `✅ **TempVoice Interface successfully set up in <#${targetCh.id}>!**\n` +
          `Control Panel has been deployed with all 15 management buttons.`
      );
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // VOICE CHANNEL ACTIONS
    // ─────────────────────────────────────────────────────────────
    const voiceCh = member.voice?.channel as VoiceChannel | null;
    if (!voiceCh) {
      await interaction.reply({
        content: "❌ You must be connected to a voice channel to use `/voice` commands.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const tempRecord = getTempChannel(voiceCh.id);
    if (!tempRecord) {
      await interaction.reply({
        content: "❌ You are not in an active temporary voice channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // CLAIM
    if (sub === "claim") {
      if (tempRecord.ownerId === member.id) {
        await interaction.reply({
          content: "❌ You already own this temporary voice channel!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const isOwnerInCh = voiceCh.members.has(tempRecord.ownerId);
      if (isOwnerInCh) {
        await interaction.reply({
          content: `❌ The owner (<@${tempRecord.ownerId}>) is still connected! You cannot claim ownership.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const oldOwnerId = tempRecord.ownerId;
      tempRecord.ownerId = member.id;
      saveTempChannel(tempRecord);

      await voiceCh.permissionOverwrites
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
        await voiceCh.permissionOverwrites.delete(oldOwnerId).catch(() => {});
      }

      await interaction.reply({
        content: `👑 **Ownership Claimed!** You are now the owner of **#${voiceCh.name}**!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // OWNER VERIFICATION FOR ALL OTHER COMMANDS
    if (tempRecord.ownerId !== member.id) {
      await interaction.reply({
        content: `❌ Only the channel owner (<@${tempRecord.ownerId}>) can use this command!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // RENAME
    if (sub === "name") {
      const newName = interaction.options.getString("name", true).trim();
      await voiceCh.setName(newName);
      await interaction.reply({
        content: `✅ Voice channel renamed to **${newName}**!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // LIMIT
    if (sub === "limit") {
      const limit = interaction.options.getInteger("limit", true);
      await voiceCh.setUserLimit(limit);
      await interaction.reply({
        content: `✅ User limit set to **${limit === 0 ? "Unlimited" : limit}**!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // LOCK
    if (sub === "lock") {
      await voiceCh.permissionOverwrites.edit(guild.roles.everyone.id, { Connect: false });
      for (const tId of tempRecord.trustedUserIds) {
        await voiceCh.permissionOverwrites
          .edit(tId, { Connect: true, ViewChannel: true })
          .catch(() => {});
      }
      tempRecord.isLocked = true;
      saveTempChannel(tempRecord);
      await interaction.reply({
        content: "🔒 **Channel Locked!** Only trusted members or invited guests can join.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // UNLOCK
    if (sub === "unlock") {
      await voiceCh.permissionOverwrites.edit(guild.roles.everyone.id, { Connect: true });
      tempRecord.isLocked = false;
      saveTempChannel(tempRecord);
      await interaction.reply({
        content: "🔓 **Channel Unlocked!** Anyone can join now.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // TRUST
    if (sub === "trust") {
      const target = interaction.options.getUser("member", true);
      if (!tempRecord.trustedUserIds.includes(target.id)) {
        tempRecord.trustedUserIds.push(target.id);
      }
      saveTempChannel(tempRecord);

      await voiceCh.permissionOverwrites.edit(target.id, {
        Connect: true,
        ViewChannel: true,
        Speak: true,
      });

      await interaction.reply({
        content: `✅ <@${target.id}> is now trusted and can join even when locked!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // UNTRUST
    if (sub === "untrust") {
      const target = interaction.options.getUser("member", true);
      tempRecord.trustedUserIds = tempRecord.trustedUserIds.filter((id) => id !== target.id);
      saveTempChannel(tempRecord);

      await voiceCh.permissionOverwrites.delete(target.id).catch(() => {});

      if (tempRecord.isLocked) {
        const targetMember = voiceCh.members.get(target.id);
        if (targetMember) {
          await targetMember.voice.disconnect("Untrusted by channel owner").catch(() => {});
        }
      }

      await interaction.reply({
        content: `❌ <@${target.id}> has been removed from trusted users.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // BLOCK
    if (sub === "block") {
      const target = interaction.options.getUser("member", true);
      if (!tempRecord.blockedUserIds.includes(target.id)) {
        tempRecord.blockedUserIds.push(target.id);
      }
      saveTempChannel(tempRecord);

      await voiceCh.permissionOverwrites.edit(target.id, {
        Connect: false,
        ViewChannel: false,
      });

      const targetMember = voiceCh.members.get(target.id);
      if (targetMember) {
        await targetMember.voice.disconnect("Blocked by channel owner").catch(() => {});
      }

      await interaction.reply({
        content: `⛔ <@${target.id}> has been blocked and cannot join your channel!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // UNBLOCK
    if (sub === "unblock") {
      const target = interaction.options.getUser("member", true);
      tempRecord.blockedUserIds = tempRecord.blockedUserIds.filter((id) => id !== target.id);
      saveTempChannel(tempRecord);

      await voiceCh.permissionOverwrites.delete(target.id).catch(() => {});

      await interaction.reply({
        content: `✅ <@${target.id}> has been unblocked.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // KICK
    if (sub === "kick") {
      const target = interaction.options.getUser("member", true);
      const targetMember = voiceCh.members.get(target.id);
      if (!targetMember) {
        await interaction.reply({
          content: `⚠️ <@${target.id}> is not currently in your voice channel.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await targetMember.voice.disconnect("Kicked by channel owner").catch(() => {});
      await interaction.reply({
        content: `👢 Disconnected <@${target.id}> from your voice channel.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // TRANSFER
    if (sub === "transfer") {
      const target = interaction.options.getUser("member", true);
      if (target.id === member.id) {
        await interaction.reply({
          content: "❌ You already own this channel.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const oldOwnerId = tempRecord.ownerId;
      tempRecord.ownerId = target.id;
      saveTempChannel(tempRecord);

      await voiceCh.permissionOverwrites
        .edit(target.id, {
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

      await voiceCh.permissionOverwrites.delete(oldOwnerId).catch(() => {});

      await interaction.reply({
        content: `👑 Ownership has been transferred to <@${target.id}>!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // DELETE
    if (sub === "delete") {
      await interaction.reply({
        content: "🗑️ Deleting your temporary channel...",
        flags: MessageFlags.Ephemeral,
      });

      if (tempRecord.waitingRoomChannelId) {
        const wr = await guild.channels
          .fetch(tempRecord.waitingRoomChannelId)
          .catch(() => null);
        if (wr) await wr.delete().catch(() => {});
      }

      deleteTempChannel(tempRecord.channelId);
      await voiceCh.delete("Deleted by owner via /voice delete").catch(() => {});
      return;
    }
  },
};

export default command;
