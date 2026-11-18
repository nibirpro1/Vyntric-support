import {
  ChannelType,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { getTempVoiceConfig, setTempVoiceConfig } from "../../lib/tempVoiceStore";

export default {
  data: new SlashCommandBuilder()
    .setName("jtc-setup")
    .setDescription("Setup or reconfigure the Join-to-Create lobby and category")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const currentConfig = getTempVoiceConfig(guild.id);

      // Check if current category and creator channel exist
      let category = currentConfig.categoryId
        ? await guild.channels.fetch(currentConfig.categoryId).catch(() => null)
        : null;

      if (!category) {
        category = await guild.channels.create({
          name: "Join To Create",
          type: ChannelType.GuildCategory,
        });
      }

      let voiceChannel = currentConfig.creatorChannelId
        ? await guild.channels.fetch(currentConfig.creatorChannelId).catch(() => null)
        : null;

      if (!voiceChannel) {
        voiceChannel = await guild.channels.create({
          name: "🔊 Join To Create",
          type: ChannelType.GuildVoice,
          parent: category.id,
        });
      }

      setTempVoiceConfig(guild.id, {
        enabled: true,
        categoryId: category.id,
        creatorChannelId: voiceChannel.id,
      });

      await interaction.editReply({
        content:
          `✅ **JTC System setup complete!**\n` +
          `• **Category:** \`${category.name}\` (<#${category.id}>)\n` +
          `• **Creator Lobby:** \`${voiceChannel.name}\` (<#${voiceChannel.id}>)\n` +
          `Anyone who joins the lobby will automatically have their own temporary voice room created!`,
      });
    } catch (err: any) {
      console.error("[jtc:setup:error]", err);
      await interaction.editReply({
        content: `❌ Failed to setup JTC system: ${err.message || err}`,
      });
    }
  },
};
