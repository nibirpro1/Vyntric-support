import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
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
  getUserAutoModStrikes,
  resetUserAutoModStrikes,
} from "../../lib/automodEngine";
import { BRAND } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Configure Advanced Vyntric AutoMod protection, filters & strike escalation")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View Advanced AutoMod dashboard & all active modules")
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable AutoMod or any specific protection module")
        .addStringOption((opt) =>
          opt
            .setName("feature")
            .setDescription("Protection module")
            .setRequired(true)
            .addChoices(
              { name: "Master AutoMod (Everything On/Off)", value: "enabled" },
              { name: "Anti-Gali / Profanity (Bangla & English)", value: "antiBadWords" },
              { name: "Anti-Phishing & Scam Links", value: "antiPhishing" },
              { name: "Anti-Invite (Block discord.gg links)", value: "antiInvite" },
              { name: "Anti-Link (Block external websites)", value: "antiLink" },
              { name: "Anti-Spam (Rapid message rate limit)", value: "antiSpam" },
              { name: "Anti-Duplicate (Copy-paste flood)", value: "antiDuplicate" },
              { name: "Anti-Mention (>4 mass mentions)", value: "antiMention" },
              { name: "Anti-Caps (>75% ALL CAPS shouting)", value: "antiCaps" },
              { name: "Anti-Emoji (>10 emoji flood)", value: "antiEmoji" },
              { name: "Anti-Zalgo & Newline Flood", value: "antiZalgo" },
              { name: "Auto-Escalation Strike Ladder", value: "escalatePunishment" },
              { name: "DM Notice on Punishment", value: "dmOnPunish" }
            )
        )
        .addBooleanOption((opt) =>
          opt.setName("enabled").setDescription("Enable or disable").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("words")
        .setDescription("Manage custom banned or allowlisted words")
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
        .setName("exempt")
        .setDescription("Manage exempt channels, roles, and users (bypass AutoMod)")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Add, Remove, or List exemptions")
            .setRequired(true)
            .addChoices(
              { name: "Add Exemption", value: "add" },
              { name: "Remove Exemption", value: "remove" },
              { name: "List Exemptions", value: "list" }
            )
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to exempt/unexempt")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Role to exempt/unexempt").setRequired(false)
        )
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User to exempt/unexempt").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("strikes")
        .setDescription("View or reset a member's active 1-hour AutoMod strikes")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Target member").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Check or Reset")
            .setRequired(true)
            .addChoices(
              { name: "Check Strikes", value: "check" },
              { name: "Reset Strikes", value: "reset" }
            )
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
        .setDescription("Set base punishment applied when a filter is triggered")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Base punishment level")
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
            .setDescription("True = Admins bypass | False = Filter everyone (best for live testing)")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("test")
        .setDescription("Run Advanced AutoMod diagnostics on any text (bypass tricks, caps, emojis, etc.)")
        .addStringOption((opt) =>
          opt.setName("text").setDescription("Text to analyze").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const isEphemeral =
      sub === "test" ||
      sub === "strikes" ||
      (sub === "words" && interaction.options.getString("action") === "list") ||
      (sub === "exempt" && interaction.options.getString("action") === "list");

    // Defer immediately within milliseconds so Discord never shows "The application did not respond"
    await interaction.deferReply({ flags: isEphemeral ? MessageFlags.Ephemeral : undefined });

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
            ? config.badWords.slice(0, 12).join(", ") +
              (config.badWords.length > 12 ? ` (+${config.badWords.length - 12} more)` : "")
            : "None added";

        const badge = (on: boolean) => (on ? "✅ Active" : "❌ Off");

        const embed = new EmbedBuilder()
          .setColor(config.enabled ? BRAND.colors.primary : BRAND.colors.danger)
          .setTitle("🛡️ Vyntric Advanced AutoMod Dashboard")
          .setDescription(
            `Master Switch: **${config.enabled ? "✅ ENABLED" : "❌ DISABLED"}**\n` +
              `Built-in Gali Shield: **${builtinCount}+** Bangla, Banglish, Hindi & English terms + Unicode/Font/Homoglyph Evasion Engine`
          )
          .addFields(
            { name: "🤬 Anti-Gali", value: badge(config.antiBadWords), inline: true },
            { name: "🎣 Anti-Phishing", value: badge(config.antiPhishing), inline: true },
            { name: "🔗 Anti-Invite", value: badge(config.antiInvite), inline: true },
            { name: "🌐 Anti-Link", value: config.antiLink ? "✅ On (GIFs safe)" : "❌ Off", inline: true },
            { name: "⚡ Anti-Spam", value: badge(config.antiSpam), inline: true },
            { name: "📑 Anti-Duplicate", value: badge(config.antiDuplicate), inline: true },
            { name: "📢 Anti-Mention", value: badge(config.antiMention), inline: true },
            { name: "🔠 Anti-Caps", value: badge(config.antiCaps), inline: true },
            { name: "😀 Anti-Emoji", value: badge(config.antiEmoji), inline: true },
            { name: "👾 Anti-Zalgo/Lines", value: badge(config.antiZalgo), inline: true },
            { name: "📈 Auto-Escalation", value: badge(config.escalatePunishment), inline: true },
            { name: "🛡️ Staff Immunity", value: config.adminImmunity ? "✅ Bypass On" : "⚠️ Off (All Filtered)", inline: true },
            { name: "🔨 Base Punishment", value: `\`${formatPunishmentLabel(config.punishment)}\``, inline: true },
            { name: "📋 Log Channel", value: config.logChannelId ? `<#${config.logChannelId}>` : "❌ Not Set", inline: true },
            { name: "✉️ DM Offenders", value: badge(config.dmOnPunish), inline: true },
            {
              name: `🚫 Custom Words (${config.badWords.length}) | ✅ Allowlist (${config.allowWords.length})`,
              value: `\`\`\`${wordsPreview}\`\`\``,
              inline: false,
            }
          )
          .setFooter({ text: "Use /automod test, /automod toggle, or /automod exempt" });

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "toggle": {
        const feature = interaction.options.getString("feature", true) as keyof typeof config;
        const enabled = interaction.options.getBoolean("enabled", true);

        updateAutoModConfig(guildId, { [feature]: enabled });

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(enabled ? BRAND.colors.success : BRAND.colors.warning)
              .setDescription(
                `✅ AutoMod **${String(feature)}** is now **${enabled ? "ENABLED" : "DISABLED"}**.`
              ),
          ],
        });
        break;
      }

      case "exempt": {
        const action = interaction.options.getString("action", true);
        const chan = interaction.options.getChannel("channel");
        const role = interaction.options.getRole("role");
        const user = interaction.options.getUser("user");

        if (action === "list") {
          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.primary)
            .setTitle("🛡️ AutoMod Exemptions")
            .addFields(
              {
                name: "📺 Exempt Channels",
                value:
                  config.exemptChannels.length > 0
                    ? config.exemptChannels.map((c) => `<#${c}>`).join(", ")
                    : "None",
              },
              {
                name: "🎭 Exempt Roles",
                value:
                  config.exemptRoles.length > 0
                    ? config.exemptRoles.map((r) => `<@&${r}>`).join(", ")
                    : "None",
              },
              {
                name: "👤 Exempt Users",
                value:
                  config.exemptUsers.length > 0
                    ? config.exemptUsers.map((u) => `<@${u}>`).join(", ")
                    : "None",
              }
            );
          await interaction.editReply({ embeds: [embed] });
          return;
        }

        if (!chan && !role && !user) {
          await interaction.editReply({
            content: "⚠️ Please provide at least one `channel`, `role`, or `user` option.",
          });
          return;
        }

        const nextChans = new Set(config.exemptChannels);
        const nextRoles = new Set(config.exemptRoles);
        const nextUsers = new Set(config.exemptUsers);
        const updatedNotes: string[] = [];

        if (chan) {
          if (action === "add") nextChans.add(chan.id);
          else nextChans.delete(chan.id);
          updatedNotes.push(`Channel <#${chan.id}>`);
        }
        if (role) {
          if (action === "add") nextRoles.add(role.id);
          else nextRoles.delete(role.id);
          updatedNotes.push(`Role <@&${role.id}>`);
        }
        if (user) {
          if (action === "add") nextUsers.add(user.id);
          else nextUsers.delete(user.id);
          updatedNotes.push(`User <@${user.id}>`);
        }

        updateAutoModConfig(guildId, {
          exemptChannels: Array.from(nextChans),
          exemptRoles: Array.from(nextRoles),
          exemptUsers: Array.from(nextUsers),
        });

        await interaction.editReply({
          content: `✅ ${action === "add" ? "Added to" : "Removed from"} AutoMod exemptions: ${updatedNotes.join(", ")}`,
        });
        break;
      }

      case "strikes": {
        const user = interaction.options.getUser("user", true);
        const action = interaction.options.getString("action", true);

        if (action === "check") {
          const strikes = getUserAutoModStrikes(guildId, user.id);
          await interaction.editReply({
            content: `📊 **${user.tag}** currently has **${strikes}** active AutoMod strike(s) in the last 1 hour.`,
          });
        } else {
          resetUserAutoModStrikes(guildId, user.id);
          await interaction.editReply({
            content: `✅ Reset all active 1-hour AutoMod strikes for **${user.tag}**.`,
          });
        }
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

          const safeList =
            rawList.length > 3500
              ? `${rawList.slice(0, 3500)}...\n\n*(Showing first portion of ${config.badWords.length} custom words)*`
              : rawList;

          const allowText =
            config.allowWords.length > 0
              ? config.allowWords.map((w) => `\`${w}\``).join(", ")
              : "None";

          await interaction.editReply({
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
          });
          return;
        }

        if (action === "clear") {
          updateAutoModConfig(guildId, { badWords: [] });
          await interaction.editReply({
            content:
              "🗑️ Cleared all custom blacklisted words. *(Note: The built-in Bengali & English Gali Shield remains active unless toggled off.)*",
          });
          return;
        }

        if (!word) {
          await interaction.editReply({
            content: "⚠️ You must specify a word.",
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
            const nextAllow = config.allowWords.filter((w) => !parsedWords.includes(w));
            updateAutoModConfig(guildId, {
              badWords: Array.from(currentWords),
              allowWords: nextAllow,
            });
            await interaction.editReply({
              content: `✅ Added **${newlyAdded.length}** word(s) to AutoMod blacklist: \`${newlyAdded.join(", ")}\``,
            });
          } else {
            await interaction.editReply({
              content: `ℹ️ Specified word(s) are already in the AutoMod blacklist.`,
            });
          }
        } else if (action === "remove") {
          const next = config.badWords.filter((w) => !parsedWords.includes(w));
          updateAutoModConfig(guildId, { badWords: next });
          await interaction.editReply({
            content: `🗑️ Removed specified word(s) from your custom blacklist. *(To unblock a built-in word, use \`Allow/Whitelist Word\`.)*`,
          });
        } else if (action === "allow") {
          const nextAllow = Array.from(new Set([...config.allowWords, ...parsedWords]));
          const nextBad = config.badWords.filter((w) => !parsedWords.includes(w));
          updateAutoModConfig(guildId, {
            allowWords: nextAllow,
            badWords: nextBad,
          });
          await interaction.editReply({
            content: `✅ Added \`${parsedWords.join(", ")}\` to the **Allowlist** — AutoMod will no longer block them.`,
          });
        } else if (action === "unallow") {
          const nextAllow = config.allowWords.filter((w) => !parsedWords.includes(w));
          updateAutoModConfig(guildId, { allowWords: nextAllow });
          await interaction.editReply({
            content: `🗑️ Removed \`${parsedWords.join(", ")}\` from the Allowlist.`,
          });
        }
        break;
      }

      case "logchannel": {
        const channel = interaction.options.getChannel("channel", true) as TextChannel;
        updateAutoModConfig(guildId, { logChannelId: channel.id });
        await interaction.editReply({
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
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.primary)
              .setDescription(
                `✅ Base AutoMod punishment set to: **${formatPunishmentLabel(action)}**.`
              ),
          ],
        });
        break;
      }

      case "immunity": {
        const enabled = interaction.options.getBoolean("enabled", true);
        updateAutoModConfig(guildId, { adminImmunity: enabled });
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(enabled ? BRAND.colors.warning : BRAND.colors.success)
              .setTitle(`🛡️ ${BRAND.name} AutoMod Staff Immunity`)
              .setDescription(
                enabled
                  ? "🛡️ **Admin & Staff Immunity is now ENABLED**.\nAdmins/Staff bypass AutoMod (regular members are still filtered)."
                  : "🛡️ **Admin & Staff Immunity is now DISABLED**.\nAutoMod will filter EVERYONE including Admins & Staff (messages deleted; Discord API prevents timing out Admins)."
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
          .setTitle(`🛡️ ${BRAND.name} Advanced AutoMod Diagnostics`)
          .addFields(
            { name: "📥 Input Text", value: `\`\`\`\n${text.slice(0, 400)}\n\`\`\`` },
            {
              name: "🔍 Decoded / Normalized View",
              value: `\`${evaluation.diagnostics.normalizedPreview || "[empty]"}\``,
            },
            {
              name: "📊 Signal Metrics",
              value: `Caps: **${evaluation.diagnostics.capsPercent}%** • Emojis: **${evaluation.diagnostics.emojiCount}** • Newlines: **${evaluation.diagnostics.newlineCount}** • Zalgo Marks: **${evaluation.diagnostics.zalgoBurst}**`,
            },
            {
              name: "⚖️ Verdict",
              value: evaluation.triggered
                ? `⚠️ **BLOCKED (${evaluation.severity.toUpperCase()} severity)**\n**Triggers:** ${evaluation.reasons.join(", ")}\n**Strike 1 Action:** ${
                    evaluation.severity === "soft"
                      ? "Delete + Warn"
                      : `Delete + ${formatPunishmentLabel(config.punishment)}`
                  }`
                : "✅ **CLEAN!** Passed all 10 protection modules.",
            }
          );

        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  },
};

export default command;
