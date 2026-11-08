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
  AutoModPunishment,
  getAutoModConfig,
  updateAutoModConfig,
} from "../../lib/automodStore";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Configure Vyntric AutoMod protection and filters")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View current AutoMod protection status")
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable a specific AutoMod filter")
        .addStringOption((opt) =>
          opt
            .setName("feature")
            .setDescription("Filter feature")
            .setRequired(true)
            .addChoices(
              { name: "Anti-Invite (Block discord.gg links)", value: "antiInvite" },
              { name: "Anti-Link (Block external websites)", value: "antiLink" },
              { name: "Anti-Spam (Block rapid message spam)", value: "antiSpam" },
              { name: "Anti-Mention (Block >4 mass mentions)", value: "antiMention" }
            )
        )
        .addBooleanOption((opt) =>
          opt.setName("enabled").setDescription("Enable or disable").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("words")
        .setDescription("Manage banned words blacklist")
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
    )
    .addSubcommand((sub) =>
      sub
        .setName("logchannel")
        .setDescription("Set the channel where AutoMod logs infractions")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Log channel")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("punishment")
        .setDescription("Set the punishment applied when a filter is triggered")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Punishment level")
            .setRequired(true)
            .addChoices(
              { name: "Warn (Delete message + notice)", value: "warn" },
              { name: "Timeout (1 Minute)", value: "timeout_1m" },
              { name: "Timeout (5 Minutes)", value: "timeout_5m" },
              { name: "Timeout (10 Minutes)", value: "timeout_10m" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("immunity")
        .setDescription("Configure whether Admins & Staff bypass AutoMod")
        .addBooleanOption((opt) =>
          opt
            .setName("enabled")
            .setDescription("True = Admins bypass | False = Filter everyone (recommended for testing)")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("test")
        .setDescription("Test a message to see which AutoMod filter triggers")
        .addStringOption((opt) =>
          opt.setName("text").setDescription("Text to test").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const config = getAutoModConfig(guildId);

    switch (sub) {
      case "status": {
        const wordsPreview =
          config.badWords.length > 0
            ? config.badWords.slice(0, 15).join(", ") +
              (config.badWords.length > 15 ? ` (+${config.badWords.length - 15} more)` : "")
            : "None configured";

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle("🛡️ Vyntric AutoMod Dashboard")
          .setDescription("Automated server protection rules and active filters:")
          .addFields(
            {
              name: "🔗 Anti-Invite",
              value: config.antiInvite ? "✅ Active" : "❌ Disabled",
              inline: true,
            },
            {
              name: "🌐 Anti-Link",
              value: config.antiLink ? "✅ Active" : "❌ Disabled",
              inline: true,
            },
            {
              name: "⚡ Anti-Spam",
              value: config.antiSpam ? "✅ Active" : "❌ Disabled",
              inline: true,
            },
            {
              name: "📢 Anti-Mass-Mention",
              value: config.antiMention ? "✅ Active" : "❌ Disabled",
              inline: true,
            },
            {
              name: "🔨 Punishment",
              value: `\`${config.punishment}\``,
              inline: true,
            },
            {
              name: "📋 Log Channel",
              value: config.logChannelId ? `<#${config.logChannelId}>` : "❌ Not Set",
              inline: true,
            },
            {
              name: `🚫 Blacklisted Words (${config.badWords.length})`,
              value: `\`\`\`${wordsPreview}\`\`\``,
            }
          )
          .setFooter({ text: "Use /automod toggle or /automod words to configure" });

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "toggle": {
        const feature = interaction.options.getString("feature", true) as keyof typeof config;
        const enabled = interaction.options.getBoolean("enabled", true);

        updateAutoModConfig(guildId, { [feature]: enabled });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(enabled ? BRAND.colors.success : BRAND.colors.warning)
              .setDescription(`✅ **${feature}** is now **${enabled ? "ENABLED" : "DISABLED"}**.`),
          ],
        });
        break;
      }

      case "words": {
        const action = interaction.options.getString("action", true);
        const word = interaction.options.getString("word")?.trim().toLowerCase();

        if (action === "list") {
          const list = config.badWords.join(", ") || "No blacklisted words.";
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(BRAND.colors.primary)
                .setTitle(`🚫 Blacklisted Words (${config.badWords.length})`)
                .setDescription(list),
            ],
            ephemeral: true,
          });
          return;
        }

        if (action === "clear") {
          updateAutoModConfig(guildId, { badWords: [] });
          await interaction.reply({ content: "🗑️ Cleared all blacklisted words." });
          return;
        }

        if (!word) {
          await interaction.reply({
            content: "⚠️ You must specify a word to add or remove.",
            ephemeral: true,
          });
          return;
        }

        if (action === "add") {
          const wordsToAdd = word
            .split(/[\r\n,]+/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          const currentWords = new Set(config.badWords);
          const newlyAdded: string[] = [];

          for (const w of wordsToAdd) {
            if (!currentWords.has(w)) {
              currentWords.add(w);
              newlyAdded.push(w);
            }
          }

          if (newlyAdded.length > 0) {
            updateAutoModConfig(guildId, { badWords: Array.from(currentWords) });
            await interaction.reply({
              content: `✅ Added **${newlyAdded.length}** word(s) to AutoMod blacklist: \`${newlyAdded.join(", ")}\``,
            });
          } else {
            await interaction.reply({
              content: `ℹ️ Specified word(s) are already in the AutoMod blacklist.`,
              ephemeral: true,
            });
          }
        } else if (action === "remove") {
          const wordsToRemove = word
            .split(/[\r\n,]+/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          const next = config.badWords.filter((w) => !wordsToRemove.includes(w));
          updateAutoModConfig(guildId, { badWords: next });
          await interaction.reply({
            content: `🗑️ Removed specified word(s) from AutoMod blacklist.`,
          });
        }
        break;
      }

      case "logchannel": {
        const channel = interaction.options.getChannel("channel", true) as TextChannel;
        updateAutoModConfig(guildId, { logChannelId: channel.id });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.success)
              .setDescription(`✅ AutoMod incident logs will be sent to <#${channel.id}>.`),
          ],
        });
        break;
      }

      case "punishment": {
        const action = interaction.options.getString("action", true) as AutoModPunishment;
        updateAutoModConfig(guildId, { punishment: action });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.primary)
              .setDescription(`✅ Default AutoMod punishment set to: **${action}**.`),
          ],
        });
        break;
      }

      case "immunity": {
        const enabled = interaction.options.getBoolean("enabled", true);
        updateAutoModConfig(guildId, { adminImmunity: enabled });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(enabled ? BRAND.colors.warning : BRAND.colors.success)
              .setTitle(`🛡️ ${BRAND.name} AutoMod Staff Immunity`)
              .setDescription(
                enabled
                  ? "🛡️ **Admin & Staff Immunity is now ENABLED**.\nServer Admins and Staff will bypass AutoMod filters."
                  : "🛡️ **Admin & Staff Immunity is now DISABLED**.\nAutoMod will filter EVERYONE (including server admins/owner). Recommended for testing!"
              ),
          ],
        });
        break;
      }

      case "test": {
        const text = interaction.options.getString("text", true);
        const lower = text.toLowerCase();
        const triggers: string[] = [];

        // Check invite
        if (
          /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite|dsc\.gg)\/[a-z0-9_-]+/i.test(
            text
          )
        ) {
          triggers.push("🔗 Discord Invite Link");
        }
        // Check link
        if (/https?:\/\/[^\s]+/i.test(text)) {
          triggers.push("🌐 External Link");
        }
        // Check bad words
        const matchedWords: string[] = [];
        for (const rawWord of config.badWords) {
          const w = rawWord.trim().toLowerCase();
          if (!w) continue;
          let matches = false;
          if (w.includes(" ")) {
            matches = lower.includes(w);
          } else if (/^[a-zA-Z0-9]+$/.test(w)) {
            matches = new RegExp(`(?<=^|[^a-zA-Z0-9])${w}(?=$|[^a-zA-Z0-9])`, "i").test(lower);
          } else {
            matches = lower.includes(w);
          }
          if (matches) matchedWords.push(w);
        }
        if (matchedWords.length > 0) {
          triggers.push(`🚫 Banned Words: \`${matchedWords.join(", ")}\``);
        }

        const embed = new EmbedBuilder()
          .setColor(triggers.length > 0 ? BRAND.colors.danger : BRAND.colors.success)
          .setTitle(`🛡️ ${BRAND.name} AutoMod Test Evaluation`)
          .addFields(
            { name: "Input Text", value: `\`\`\`\n${text.slice(0, 500)}\n\`\`\`` },
            {
              name: "Result",
              value:
                triggers.length > 0
                  ? `⚠️ **WOULD BE BLOCKED!**\nTriggers detected:\n- ${triggers.join("\n- ")}`
                  : "✅ **CLEAN!** No AutoMod filters triggered.",
            }
          );

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
    }
  },
};

export default command;
