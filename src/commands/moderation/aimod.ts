import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import {
  getAIModConfig,
  updateAIModConfig,
  DEFAULT_AI_LOG_CHANNEL,
} from "../../lib/aiModStore";
import { analyzeMessageContent } from "../../lib/aiModerator";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("aimod")
    .setDescription("Configure AI Chat Assistant moderation, gali filter & timeout")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("View current AI Assistant moderation settings")
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable AI Assistant chat moderation")
        .addBooleanOption((opt) =>
          opt
            .setName("enabled")
            .setDescription("Enable or disable AI chat moderation")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("timeout")
        .setDescription("Set the timeout duration for detected abusive language (gali)")
        .addIntegerOption((opt) =>
          opt
            .setName("seconds")
            .setDescription("Timeout length in seconds (e.g. 30, 40, 60)")
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(3600)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Set the private AI moderation log channel")
        .addChannelOption((opt) =>
          opt
            .setName("target")
            .setDescription("Private log channel for AI actions")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("test")
        .setDescription("Test a sentence or phrase against the AI moderation engine")
        .addStringOption((opt) =>
          opt
            .setName("text")
            .setDescription("The text to analyze")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("words")
        .setDescription("Manage custom banned words for AI filter")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Action to perform")
            .setRequired(true)
            .addChoices(
              { name: "Add Word", value: "add" },
              { name: "Remove Word", value: "remove" },
              { name: "List Words", value: "list" },
              { name: "Clear Words", value: "clear" }
            )
        )
        .addStringOption((opt) =>
          opt.setName("word").setDescription("Word to add or remove").setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
    }

    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();
    const config = getAIModConfig(guild.id);

    // ─────────────────────────────────────────────────────────────
    // 1. STATUS
    // ─────────────────────────────────────────────────────────────
    if (sub === "status") {
      const logChanDisplay = config.logChannelId
        ? `<#${config.logChannelId}> (\`${config.logChannelId}\`)`
        : "None configured";

      const exemptUsersDisplay =
        config.exemptUsers.length > 0
          ? config.exemptUsers.map((u) => `<@${u}>`).join(", ")
          : "None";

      const exemptRolesDisplay =
        config.exemptRoles.length > 0
          ? config.exemptRoles.map((r) => `<@&${r}>`).join(", ")
          : "None";

      const embed = new EmbedBuilder()
        .setColor(config.enabled ? 0x2ecc71 : 0xe74c3c)
        .setTitle("🤖 Plugsy AI Chat Assistant Moderation")
        .setDescription(
          "Real-time multilingual AI moderation analyzing chat messages for Bengali/Banglish slurs (gali), Hindi insults, English profanity, and toxicity."
        )
        .addFields(
          {
            name: "⚡ Status",
            value: config.enabled ? "✅ **Active & Guarding**" : "❌ **Disabled**",
            inline: true,
          },
          {
            name: "⏱️ Timeout Duration",
            value: `**${config.timeoutSeconds} seconds**`,
            inline: true,
          },
          {
            name: "🗑️ Message Action",
            value: config.deleteMessage ? "Instant Delete & Warn" : "Warn Only",
            inline: true,
          },
          {
            name: "📜 Private Log Channel",
            value: logChanDisplay,
            inline: false,
          },
          {
            name: "🛡️ Exempt Users",
            value: exemptUsersDisplay,
            inline: true,
          },
          {
            name: "🛡️ Exempt Roles",
            value: exemptRolesDisplay,
            inline: true,
          },
          {
            name: "📝 Custom Banned Words",
            value: `${config.customBadWords.length} custom word(s) configured`,
            inline: false,
          }
        )
        .setFooter({ text: "Plugsy AI Assistant • Vyntric Moderation" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. TOGGLE
    // ─────────────────────────────────────────────────────────────
    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      updateAIModConfig(guild.id, { enabled });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
            .setTitle("🤖 AI Assistant Moderation Updated")
            .setDescription(
              enabled
                ? "✅ **AI Chat Moderation is now ENABLED!** Chat messages will be actively analyzed for gali/abusive language with automated 40s timeouts."
                : "❌ **AI Chat Moderation is now DISABLED.**"
            ),
        ],
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 3. TIMEOUT DURATION
    // ─────────────────────────────────────────────────────────────
    if (sub === "timeout") {
      const seconds = interaction.options.getInteger("seconds", true);
      updateAIModConfig(guild.id, { timeoutSeconds: seconds });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("⏱️ AI Timeout Duration Updated")
            .setDescription(
              `Members using prohibited gali or toxic language will now be timed out for **${seconds} seconds**.`
            ),
        ],
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 4. PRIVATE LOG CHANNEL
    // ─────────────────────────────────────────────────────────────
    if (sub === "channel") {
      const channel = interaction.options.getChannel("target", true) as TextChannel;
      updateAIModConfig(guild.id, { logChannelId: channel.id });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("📜 AI Log Channel Updated")
            .setDescription(
              `AI moderation alerts and actions will now be logged in <#${channel.id}>.`
            ),
        ],
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 5. TEST AI ANALYSIS
    // ─────────────────────────────────────────────────────────────
    if (sub === "test") {
      await interaction.deferReply({ ephemeral: true });
      const testText = interaction.options.getString("text", true);

      const result = await analyzeMessageContent(testText, config.customBadWords);

      const embed = new EmbedBuilder()
        .setColor(result.isViolation ? 0xe74c3c : 0x2ecc71)
        .setTitle("🧠 AI Chat Analysis Test")
        .setDescription(
          result.isViolation
            ? `⚠️ **VIOLATION DETECTED**\nIf sent in chat, this would be **deleted** and user timed out for **${config.timeoutSeconds}s**.`
            : `✅ **CLEAN / NO VIOLATION**\nThis message would pass freely through the AI assistant.`
        )
        .addFields(
          { name: "💬 Tested Input", value: `\`\`\`\n${testText.slice(0, 500)}\n\`\`\`` },
          { name: "🏷️ Category", value: `\`${result.category}\``, inline: true },
          { name: "🎯 Confidence", value: `${Math.round(result.confidence * 100)}%`, inline: true },
          { name: "⚙️ Engine", value: `\`${result.engine}\``, inline: true },
          {
            name: "🔍 Detected Words",
            value: result.matchedTerms.length > 0 ? `\`${result.matchedTerms.join(", ")}\`` : "None",
            inline: false,
          },
          { name: "📝 Explanation", value: result.explanation, inline: false }
        )
        .setFooter({ text: "Plugsy AI Assistant Test Tool" });

      return interaction.editReply({ embeds: [embed] });
    }

    // ─────────────────────────────────────────────────────────────
    // 6. CUSTOM WORDS
    // ─────────────────────────────────────────────────────────────
    if (sub === "words") {
      const action = interaction.options.getString("action", true);
      const word = interaction.options.getString("word")?.trim().toLowerCase();

      if (action === "list") {
        const words = config.customBadWords;
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3498db)
              .setTitle("📝 Custom Banned Words")
              .setDescription(
                words.length > 0
                  ? words.map((w, i) => `${i + 1}. \`${w}\``).join("\n")
                  : "No custom banned words added yet. (Built-in AI lexicon is active)."
              ),
          ],
        });
      }

      if (action === "clear") {
        updateAIModConfig(guild.id, { customBadWords: [] });
        return interaction.reply({
          content: "✅ Cleared all custom banned words.",
          ephemeral: true,
        });
      }

      if (!word) {
        return interaction.reply({
          content: "❌ Please provide a `word` for this action.",
          ephemeral: true,
        });
      }

      if (action === "add") {
        const list = new Set(config.customBadWords);
        list.add(word);
        updateAIModConfig(guild.id, { customBadWords: Array.from(list) });
        return interaction.reply({
          content: `✅ Added \`${word}\` to AI banned words.`,
          ephemeral: true,
        });
      }

      if (action === "remove") {
        const list = config.customBadWords.filter((w) => w !== word);
        updateAIModConfig(guild.id, { customBadWords: list });
        return interaction.reply({
          content: `✅ Removed \`${word}\` from AI banned words.`,
          ephemeral: true,
        });
      }
    }
  },
};

export default command;
