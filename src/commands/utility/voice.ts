import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  InviteTargetType,
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
import {
  setupInterfaceChannel,
  updateVoiceChannelInterface,
} from "../../lib/tempVoiceManager";
import { BRAND } from "../../lib/brand";

const ACTIVITIES = [
  { name: "YouTube Watch Together", id: "880218394199220274" },
  { name: "Poker Night", id: "755827207812677713" },
  { name: "Chess in the Park", id: "832012774040141894" },
  { name: "Checkers in the Park", id: "832013003968348200" },
  { name: "Letter League", id: "879863686562779157" },
  { name: "SpellCast", id: "852509694341283840" },
  { name: "Sketch Heads (Gartic)", id: "902271675360940052" },
  { name: "Bobble League", id: "947957217959759964" },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("voice")
    .setDescription("Manage temporary voice channels (Astro / TempVoice Pro system)")
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
      sub.setName("hide").setDescription("👻 Ghost Mode: Hide your channel from the server sidebar")
    )
    .addSubcommand((sub) =>
      sub.setName("unhide").setDescription("👁️ Make your channel visible to everyone on the sidebar")
    )
    .addSubcommand((sub) =>
      sub
        .setName("bitrate")
        .setDescription("Change audio bitrate quality for crystal clear sound")
        .addIntegerOption((opt) =>
          opt
            .setName("kbps")
            .setDescription("Audio bitrate in kbps (e.g. 64, 96, 128)")
            .setRequired(true)
            .setMinValue(8)
            .setMaxValue(384)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("slowmode")
        .setDescription("Set chat slowmode rate limit for the voice text channel")
        .addIntegerOption((opt) =>
          opt
            .setName("seconds")
            .setDescription("Slowmode in seconds (0 = off, max 21600)")
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(21600)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("activity")
        .setDescription("🎮 Launch Discord Watch Together or party games in your voice channel")
        .addStringOption((opt) =>
          opt
            .setName("game")
            .setDescription("The game or activity to play")
            .setRequired(true)
            .addChoices(
              ...ACTIVITIES.map((a) => ({ name: a.name, value: a.id }))
            )
        )
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
        .setDescription("Administrator: Setup the VC interface control panel")
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
        ((await guild.channels
          .fetch(config.interfaceChannelId)
          .catch(() => null)) as TextChannel | null);

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
        `✅ **VC Interface successfully set up in <#${targetCh.id}>!**\n` +
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

    // ACTIVITY (Anyone in the room can launch an activity)
    if (sub === "activity") {
      const appId = interaction.options.getString("game", true);
      const actObj = ACTIVITIES.find((a) => a.id === appId);
      const actName = actObj?.name || "Activity";

      try {
        const invite = await voiceCh.createInvite({
          targetApplication: appId,
          targetType: InviteTargetType.EmbeddedApplication,
          maxAge: 3600,
          maxUses: 0,
        });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel(`🎮 Launch ${actName}`)
            .setStyle(ButtonStyle.Link)
            .setURL(invite.url)
        );

        await interaction.reply({
          content: `🎉 **${interaction.user.displayName}** started **${actName}** in <#${voiceCh.id}>!\nClick the link button below to play together:`,
          components: [row],
        });
      } catch (err) {
        console.error("[voice:activity:error]", err);
        await interaction.reply({
          content: "❌ Failed to start the Discord activity. Please check bot permissions.",
          flags: MessageFlags.Ephemeral,
        });
      }
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

      void updateVoiceChannelInterface(guild, voiceCh.id);

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
      void updateVoiceChannelInterface(guild, voiceCh.id);

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
      void updateVoiceChannelInterface(guild, voiceCh.id);

      await interaction.reply({
        content: `✅ User limit set to **${limit === 0 ? "Unlimited" : limit}**!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // LOCK
    if (sub === "lock") {
      await voiceCh.permissionOverwrites.edit(guild.id, { Connect: false });
      for (const tId of tempRecord.trustedUserIds) {
        await voiceCh.permissionOverwrites
          .edit(tId, { Connect: true, ViewChannel: true })
          .catch(() => {});
      }
      tempRecord.isLocked = true;
      saveTempChannel(tempRecord);
      void updateVoiceChannelInterface(guild, voiceCh.id);

      await interaction.reply({
        content: "🔒 **Channel Locked!** Only trusted members or invited guests can join.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // UNLOCK
    if (sub === "unlock") {
      await voiceCh.permissionOverwrites.edit(guild.id, { Connect: true });
      tempRecord.isLocked = false;
      saveTempChannel(tempRecord);
      void updateVoiceChannelInterface(guild, voiceCh.id);

      await interaction.reply({
        content: "🔓 **Channel Unlocked!** Anyone can join now.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // HIDE (Ghost Mode)
    if (sub === "hide") {
      await voiceCh.permissionOverwrites.edit(guild.id, { ViewChannel: false });
      for (const tId of tempRecord.trustedUserIds) {
        await voiceCh.permissionOverwrites
          .edit(tId, { ViewChannel: true, Connect: true })
          .catch(() => {});
      }
      tempRecord.isHidden = true;
      saveTempChannel(tempRecord);
      void updateVoiceChannelInterface(guild, voiceCh.id);

      await interaction.reply({
        content: "👻 **Ghost Mode Enabled!** Your channel is now hidden from the server sidebar.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // UNHIDE
    if (sub === "unhide") {
      await voiceCh.permissionOverwrites.edit(guild.id, { ViewChannel: true });
      tempRecord.isHidden = false;
      saveTempChannel(tempRecord);
      void updateVoiceChannelInterface(guild, voiceCh.id);

      await interaction.reply({
        content: "👁️ **Channel Visible!** Everyone can now see your channel on the sidebar.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // BITRATE
    if (sub === "bitrate") {
      const kbps = interaction.options.getInteger("kbps", true);
      const maxBitrate = (guild.maximumBitrate || 96000) / 1000;
      if (kbps > maxBitrate) {
        await interaction.reply({
          content: `⚠️ Server boost level only supports up to **${maxBitrate} kbps**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await voiceCh.setBitrate(kbps * 1000);
      tempRecord.bitrate = kbps;
      saveTempChannel(tempRecord);

      await interaction.reply({
        content: `🔊 Audio bitrate set to **${kbps} kbps** for high quality voice!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // SLOWMODE
    if (sub === "slowmode") {
      const seconds = interaction.options.getInteger("seconds", true);
      await voiceCh.setRateLimitPerUser(seconds);
      tempRecord.slowmode = seconds;
      saveTempChannel(tempRecord);

      await interaction.reply({
        content: `⏳ Voice chat slowmode set to **${seconds}s**!`,
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

      void updateVoiceChannelInterface(guild, voiceCh.id);

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

      void updateVoiceChannelInterface(guild, voiceCh.id);

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

      void updateVoiceChannelInterface(guild, voiceCh.id);

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
      void updateVoiceChannelInterface(guild, voiceCh.id);

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
      void updateVoiceChannelInterface(guild, voiceCh.id);

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
      void updateVoiceChannelInterface(guild, voiceCh.id);

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
