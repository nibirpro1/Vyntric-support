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
import {
  BUILTIN_BANGLISH_HINDI_GALI,
  BUILTIN_BENGALI_SCRIPT_GALI,
  BUILTIN_ENGLISH_GALI,
  evaluateContentForAutoMod,
  formatPunishmentLabel,
} from "../../lib/automodEngine";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Configure Vyntric AutoMod protection, gali filters & punishments")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View current AutoMod protection status & settings")
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable AutoMod or a specific filter")
        .addStringOption((opt) =>
          opt
            .setName("feature")
            .setDescription("Filter feature")
            .setRequired(true)
            .addChoices(
              { name: "Master AutoMod (Everything On/Off)", value: "enabled" },
              { name: "Anti-Gali / Profanity (Bangla & English)", value: "antiBadWords" },
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
        .setDescription("Manage banned or whitelisted words")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Action to perform")
            .setRequired(true)
            .addChoices(
              { name: "Add Word (Block)", value: "add" },
              { name: "Remove Word (Unblock custom)", value: "remove" },
              { name: "Allow/Whitelist Word (Bypass built-in)", value: "allow" },
              { name: "Remove from Allowlist", value: "unallow" },
              { name: "List Words", value: "list" },
              { name: "Clear Custom Blacklist", value: "clear" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("word")
            .setDescription("Word(s) separated by commas (optional for list/clear)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("logchannel")
        .setDescription("Set the private channel where AutoMod logs infractions")
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
              { name: "Timeout (30 Seconds)", value: "timeout_30s" },
              { name: "Timeout (40 Seconds)", value: "timeout_40s" },
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
        .setDescription("Test a message to see if AutoMod blocks it (Bengali/English gali, links, etc.)")
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
        const builtinCount =
          BUILTIN_BENGALI_SCRIPT_GALI.length +
          BUILTIN_BANGLISH_HINDI_GALI.length +
          BUILTIN_ENGLISH_GALI.length;

        const wordsPreview =
          config.badWords.length > 0
            ? config.badWords.slice(0, 15).join(", ") +
              (config.badWords.length > 15 ? ` (+${config.badWords.length - 15} more)` : "")
            : "None added";

        const allowPreview =
          config.allowWords.length > 0 ? config.allowWords.slice(0, 15).join(", ") : "None";

        const embed = new EmbedBuilder()
          .setColor(config.enabled ? BRAND.colors.primary : BRAND.colors.danger)
          .setTitle("🛡️ Vyntric AutoMod Dashboard")
          .setDescription(
            `Master Switch: **${config.enabled ? "✅ ENABLED" : "❌ DISABLED"}**\n` +
              `Built-in Gali Shield: **${builtinCount}+** Bangla, Banglish, Hindi & English terms (+ evasion detection)`
          )
          .addFields(
            {
              name: "🤬 Anti-Gali / Bad Words",
              value: config.antiBadWords ? "✅ Active" : "❌ Disabled",
              inline: true,
            },
            {
              name: "🔗 Anti-Invite",
              value: config.antiInvite ? "✅ Active" : "❌ Disabled",
              inline: true,
            },
            {
              name: "🌐 Anti-Link",
              value: config.antiLink ? "✅ Active (GIFs allowed)" : "❌ Disabled",
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
              name: "🛡️ Staff Immunity",
              value: config.adminImmunity ? "✅ Admins Bypass" : "⚠️ Off (Filters All)",
              inline: true,
            },
            {
              name: "🔨 Punishment",
              value: `\`${formatPunishmentLabel(config.punishment)}\``,
              inline: true,
            },
            {
              name: "📋 Log Channel",
              value: config.logChannelId ? `<#${config.logChannelId}>` : "❌ Not Set",
              inline: true,
            },
            {
              name: `🚫 Custom Blacklist (${config.badWords.length})`,
              value: `\`\`\`${wordsPreview}\`\`\``,
              inline: false,
            },
            {
              name: `✅ Allowlisted Words (${config.allowWords.length})`,
              value: `\`\`\`${allowPreview}\`\`\``,
              inline: false,
            }
          )
          .setFooter({ text: "Use /automod toggle, /automod punishment, or /automod test" });

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "toggle": {
        const feature = interaction.options.getString("feature", true) as
          | "enabled"
          | "antiBadWords"
          | "antiInvite"
          | "antiLink"
          | "antiSpam"
          | "antiMention";
        const enabled = interaction.options.getBoolean("enabled", true);

        updateAutoModConfig(guildId, { [feature]: enabled });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(enabled ? BRAND.colors.success : BRAND.colors.warning)
              .setDescription(
                `✅ AutoMod **${feature}** is now **${enabled ? "ENABLED" : "DISABLED"}**.`
              ),
          ],
        });
        break;
      }

      case "words": {
        const action = interaction.options.getString("action", true);
        const word = interaction.options.getString("word")?.trim().toLowerCase();

        if (action === "list") {
          const rawList =
            config.badWords.length > 0
              ? config.badWords.map((w) => `\`${w}\``).join(", ")
              : "No custom blacklisted words configured.";

          // Guard against Discord 4096 char embed description limit
          const safeList =
            rawList.length > 3500
              ? `${rawList.slice(0, 3500)}...\n\n*(Showing first portion of ${config.badWords.length} custom words)*`
              : rawList;

          const allowText =
            config.allowWords.length > 0
              ? config.allowWords.map((w) => `\`${w}\``).join(", ")
              : "None";

          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(BRAND.colors.primary)
                .setTitle(`🚫 AutoMod Words (${config.badWords.length} custom + Built-in Gali Shield)`)
                .setDescription(safeList)
                .addFields({
                  name: `✅ Allowlisted Words (${config.allowWords.length})`,
                  value: allowText.slice(0, 1000),
                }),
            ],
            ephemeral: true,
          });
          return;
        }

        if (action === "clear") {
          updateAutoModConfig(guildId, { badWords: [] });
          await interaction.reply({
            content:
              "🗑️ Cleared all custom blacklisted words. *(Note: The built-in Bengali & English Gali Shield remains active unless toggled off.)*",
          });
          return;
        }

        if (!word) {
          await interaction.reply({
            content: "⚠️ You must specify a word.",
            ephemeral: true,
          });
          return;
        }

        const parsedWords = word
          .split(/[\r\n,]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

        if (action === "add") {
          const currentWords = new Set(config.badWords);
          const newlyAdded: string[] = [];

          for (const w of parsedWords) {
            if (!currentWords.has(w)) {
              currentWords.add(w);
              newlyAdded.push(w);
            }
          }

          if (newlyAdded.length > 0) {
            // Also remove from allowWords if re-blacklisting
            const nextAllow = config.allowWords.filter((w) => !parsedWords.includes(w));
            updateAutoModConfig(guildId, {
              badWords: Array.from(currentWords),
              allowWords: nextAllow,
            });
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
          const next = config.badWords.filter((w) => !parsedWords.includes(w));
          updateAutoModConfig(guildId, { badWords: next });
          await interaction.reply({
            content: `🗑️ Removed specified word(s) from your custom blacklist. *(If any word is in the built-in gali list, use \`Allow/Whitelist Word\` to unblock it.)*`,
          });
        } else if (action === "allow") {
          const nextAllow = Array.from(new Set([...config.allowWords, ...parsedWords]));
          const nextBad = config.badWords.filter((w) => !parsedWords.includes(w));
          updateAutoModConfig(guildId, {
            allowWords: nextAllow,
            badWords: nextBad,
          });
          await interaction.reply({
            content: `✅ Added \`${parsedWords.join(", ")}\` to the **Allowlist** — AutoMod will no longer block them.`,
          });
        } else if (action === "unallow") {
          const nextAllow = config.allowWords.filter((w) => !parsedWords.includes(w));
          updateAutoModConfig(guildId, { allowWords: nextAllow });
          await interaction.reply({
            content: `🗑️ Removed \`${parsedWords.join(", ")}\` from the Allowlist.`,
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
              .setDescription(`✅ AutoMod infraction logs will be sent to <#${channel.id}>.`),
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
              .setDescription(
                `✅ AutoMod punishment set to: **${formatPunishmentLabel(action)}**.`
              ),
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
                  ? "🛡️ **Admin & Staff Immunity is now ENABLED**.\nServer Admins and Staff will bypass AutoMod filters (normal members are still filtered)."
                  : "🛡️ **Admin & Staff Immunity is now DISABLED**.\nAutoMod will filter EVERYONE including Admins & Staff (message will be deleted; Discord API still prevents timing out Admins)."
              ),
          ],
        });
        break;
      }

      case "test": {
        const text = interaction.options.getString("text", true);
        const evaluation = evaluateContentForAutoMod(text, config);

        const embed = new EmbedBuilder()
          .setColor(evaluation.triggered ? BRAND.colors.danger : BRAND.colors.success)
          .setTitle(`🛡️ ${BRAND.name} AutoMod Test Evaluation`)
          .addFields(
            { name: "Input Text", value: `\`\`\`\n${text.slice(0, 500)}\n\`\`\`` },
            {
              name: "Result",
              value: evaluation.triggered
                ? `⚠️ **WOULD BE BLOCKED!**\n**Triggers:** ${evaluation.reasons.join(", ")}\n**Action:** Delete + \`${formatPunishmentLabel(config.punishment)}\``
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
