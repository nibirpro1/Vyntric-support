import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import {
  addAutoResponse,
  clearAutoResponses,
  getAutoResponses,
  MatchMode,
  removeAutoResponse,
} from "../../lib/autoResponderStore";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("autoresponder")
    .setDescription("Configure custom automatic message triggers & replies")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add an automatic responder trigger")
        .addStringOption((opt) =>
          opt
            .setName("trigger")
            .setDescription("Keyword or phrase that triggers the bot")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("response")
            .setDescription("Bot response (supports {user}, {username}, {server}, {channel})")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("match")
            .setDescription("Match condition (default: exact)")
            .setRequired(false)
            .addChoices(
              { name: "Exact Match", value: "exact" },
              { name: "Contains Keyword", value: "contains" },
              { name: "Starts With", value: "startswith" }
            )
        )
        .addBooleanOption((opt) =>
          opt
            .setName("embed")
            .setDescription("Send response inside an embed (default: false)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all active auto-responders")
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove an auto-responder trigger")
        .addStringOption((opt) =>
          opt.setName("trigger").setDescription("Trigger or ID to remove").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Remove all auto-responders from the server")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    switch (sub) {
      case "add": {
        const trigger = interaction.options.getString("trigger", true);
        const response = interaction.options.getString("response", true);
        const match = (interaction.options.getString("match") || "exact") as MatchMode;
        const embed = interaction.options.getBoolean("embed") || false;

        const item = addAutoResponse(guildId, trigger, response, match, embed);

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.success)
              .setTitle("✅ Auto-Responder Added")
              .addFields(
                { name: "🎯 Trigger", value: `\`${item.trigger}\``, inline: true },
                { name: "🔍 Match Mode", value: `\`${item.matchMode}\``, inline: true },
                { name: "🎨 Embed", value: embed ? "Yes" : "No", inline: true },
                { name: "💬 Response", value: item.response }
              ),
          ],
        });
        break;
      }

      case "list": {
        const list = getAutoResponses(guildId);
        if (list.length === 0) {
          await interaction.reply({
            content: "📭 No auto-responders configured in this server. Use `/autoresponder add` to create one!",
            ephemeral: true,
          });
          return;
        }

        const lines = list.map(
          (item, i) =>
            `**${i + 1}.** \`${item.trigger}\` [${item.matchMode}] ➔ ${item.response.slice(0, 80)}${item.response.length > 80 ? "..." : ""}`
        );

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.primary)
              .setTitle(`🤖 Auto-Responders (${list.length})`)
              .setDescription(lines.join("\n\n"))
              .setFooter({ text: "Delete with /autoresponder remove <trigger>" }),
          ],
        });
        break;
      }

      case "remove": {
        const trigger = interaction.options.getString("trigger", true);
        const ok = removeAutoResponse(guildId, trigger);
        if (ok) {
          await interaction.reply({
            content: `✅ Successfully removed auto-responder for \`${trigger}\`.`,
          });
        } else {
          await interaction.reply({
            content: `❌ No auto-responder found matching \`${trigger}\`.`,
            ephemeral: true,
          });
        }
        break;
      }

      case "clear": {
        clearAutoResponses(guildId);
        await interaction.reply({
          content: "🗑️ Cleared all auto-responders for this server.",
        });
        break;
      }
    }
  },
};

export default command;
