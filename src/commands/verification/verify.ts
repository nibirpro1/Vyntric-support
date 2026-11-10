import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import path from "path";
import fs from "fs";
import { Command } from "../../structures/Command";
import {
  DEFAULT_VERIFICATION_DESC,
  DEFAULT_VERIFICATION_TITLE,
  getVerificationConfig,
  updateVerificationConfig,
} from "../../lib/verificationStore";
import { BRAND } from "../../lib/brand";
import { IDS } from "../../lib/customIds";

const DEFAULT_VERIFY_BANNER = path.resolve(process.cwd(), "assets", "banners", "vyntric-verify.png");

export function buildRulesEmbed(serverName: string) {
  return new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(`📜 ${serverName.toUpperCase()} • SERVER RULES & GUIDELINES`)
    .setDescription(
      `Welcome to **${serverName}**! To ensure a safe, fair, and respectful community for everyone, all members are required to follow these rules.\n\n` +
      `By participating in this server, you agree to comply with Discord's [Terms of Service](https://discord.com/terms) and [Community Guidelines](https://discord.com/guidelines).`
    )
    .addFields(
      {
        name: "1️⃣ Respect & Conduct",
        value:
          "• Treat everyone with dignity and respect.\n" +
          "• Harassment, hate speech, discrimination, racism, slurs, or personal attacks of any kind will result in an immediate ban.\n" +
          "• Toxicity, excessive arguing, and flame wars will not be tolerated.",
      },
      {
        name: "2️⃣ No Spamming or Self-Promotion",
        value:
          "• Do not spam text, emojis, duplicate messages, all-caps, or chain mail.\n" +
          "• Self-promotion, unsolicited advertising, or sharing unauthorized Discord invites in public channels or member DMs is strictly prohibited.\n" +
          "• Excessive pinging of server members or staff without valid cause is punishable.",
      },
      {
        name: "3️⃣ Safe Environment (No NSFW or Illegal Content)",
        value:
          "• No Not-Safe-For-Work (NSFW) content, adult media, pornography, gore, or sexual discussions.\n" +
          "• Do not share malicious links, IP loggers, malware, phishing sites, or dangerous downloads.\n" +
          "• Respect user privacy: Never leak, dox, or share private personal information (PII) of any member.",
      },
      {
        name: "4️⃣ Appropriate Channel Usage",
        value:
          "• Keep discussions relevant to the designated channel purpose.\n" +
          "• Use bot commands only in designated bot channels.\n" +
          "• Keep voice channels pleasant: No microphone spamming, soundboard ear-rape, or voice distortion.",
      },
      {
        name: "5️⃣ Staff Authority & Rule Enforcement",
        value:
          "• Server Staff and Moderators have final authority on rule enforcement.\n" +
          "• If asked by staff to stop a behavior, comply immediately.\n" +
          "• Attempting to find loopholes, bypass automod filters, or evade punishments will lead to a permanent ban.",
      }
    )
    .setFooter({
      text: `${BRAND.name} • Upholding server integrity & fairness`,
    })
    .setTimestamp();
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Configure Vyntric Security & Member Verification System")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Configure verified role, verification channel, mode, and cooldown")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("The role granted to verified members (e.g. @Member or @Verified)")
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("The channel where members will verify")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Verification style: Reaction (default, trusted) or Button")
            .addChoices(
              { name: "Reaction (React with ✅ to verify - Safe & Trusted)", value: "reaction" },
              { name: "Button (Click button to verify)", value: "button" },
              { name: "Both (Reaction & Button)", value: "both" }
            )
            .setRequired(false)
        )
        .addRoleOption((opt) =>
          opt
            .setName("unverified-role")
            .setDescription("Optional unverified role to remove once member is verified")
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("wait-minutes")
            .setDescription("Minutes new members must wait after joining before verifying (default: 0)")
            .setMinValue(0)
            .setMaxValue(1440)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("log-channel")
            .setDescription("Optional channel to send verification audit logs")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("panel")
        .setDescription("Send the official interactive verification panel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to post the verification panel into (defaults to current)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Override verification mode for this panel (default: Reaction)")
            .addChoices(
              { name: "Reaction (React with ✅ to verify - No buttons)", value: "reaction" },
              { name: "Button (Click button to verify)", value: "button" },
              { name: "Both (Reaction & Button)", value: "both" }
            )
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("include-rules")
            .setDescription("Whether to include the Server Rules summary")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("rules")
        .setDescription("Publish the official Vyntric Server Rules embed")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to post the rules into (defaults to current)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("banner")
        .setDescription("Set a custom verification banner URL or reset to default Vyntric red cyber banner")
        .addStringOption((opt) =>
          opt
            .setName("url")
            .setDescription("Direct image URL, or type 'reset' to use default built-in banner")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View current Verification system settings")
    )
    .addSubcommand((sub) =>
      sub.setName("test").setDescription("Preview the verification panel as an ephemeral test")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const config = getVerificationConfig(guildId);

    switch (sub) {
      case "setup": {
        const role = interaction.options.getRole("role", true);
        const channel = interaction.options.getChannel("channel") as TextChannel | null;
        const mode = (interaction.options.getString("mode") as "reaction" | "button" | "both") || "reaction";
        const unverifiedRole = interaction.options.getRole("unverified-role");
        const waitMinutes = interaction.options.getInteger("wait-minutes");
        const logChannel = interaction.options.getChannel("log-channel") as TextChannel | null;

        updateVerificationConfig(guildId, {
          enabled: true,
          roleId: role.id,
          mode,
          reactionEmoji: "✅",
          ...(channel ? { channelId: channel.id } : {}),
          ...(unverifiedRole !== undefined ? { unverifiedRoleId: unverifiedRole?.id ?? null } : {}),
          ...(waitMinutes !== null ? { waitMinutes } : {}),
          ...(logChannel !== undefined ? { logChannelId: logChannel?.id ?? null } : {}),
        });

        const updated = getVerificationConfig(guildId);

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.primary)
              .setTitle("✅ Verification System Configured")
              .setDescription(
                `The verification system for **${interaction.guild.name}** has been successfully updated!\n\n` +
                `Next step: Run \`/verify panel\` in your verification channel to post the panel.`
              )
              .addFields(
                { name: "🛡️ Verified Role", value: `<@&${updated.roleId}>`, inline: true },
                {
                  name: "⚙️ Mode",
                  value:
                    updated.mode === "button"
                      ? "🔘 Button Only"
                      : updated.mode === "both"
                      ? "🔘+✅ Both (Button & Reaction)"
                      : "✅ Reaction (No Buttons)",
                  inline: true,
                },
                {
                  name: "📢 Channel",
                  value: updated.channelId ? `<#${updated.channelId}>` : "Not set (set during `/verify panel`)",
                  inline: true,
                },
                {
                  name: "⏳ Security Wait Cooldown",
                  value: updated.waitMinutes > 0 ? `${updated.waitMinutes} minute(s)` : "None (instant verification)",
                  inline: true,
                },
                {
                  name: "🚫 Unverified Role",
                  value: updated.unverifiedRoleId ? `<@&${updated.unverifiedRoleId}>` : "_None_",
                  inline: true,
                },
                {
                  name: "📝 Audit Log Channel",
                  value: updated.logChannelId ? `<#${updated.logChannelId}>` : "_None_",
                  inline: true,
                }
              )
              .setFooter({ text: `${BRAND.name} Security System` }),
          ],
        });
        break;
      }

      case "panel": {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetChannel =
          (interaction.options.getChannel("channel") as TextChannel | null) ||
          (interaction.channel as TextChannel);

        if (!targetChannel || !targetChannel.isTextBased()) {
          await interaction.editReply({ content: "⚠️ Please specify a valid text channel for the verification panel." });
          return;
        }

        const includeRules = interaction.options.getBoolean("include-rules") ?? false;
        const selectedMode =
          (interaction.options.getString("mode") as "reaction" | "button" | "both") ||
          config.mode ||
          "reaction";

        if (!config.roleId) {
          await interaction.editReply({
            content: "⚠️ You must configure a verified role first! Please run `/verify setup role:@Member` before posting the panel.",
          });
          return;
        }

        const emoji = config.reactionEmoji || "✅";

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle(config.title || DEFAULT_VERIFICATION_TITLE);

        let desc =
          `Welcome to **${interaction.guild.name}**!\n` +
          `React with the **${emoji}** emoji below to verify and unlock full access.`;

        if (selectedMode === "button") {
          desc =
            `Welcome to **${interaction.guild.name}**!\n` +
            `Click the **Verify** button below to unlock full access.`;
        } else if (selectedMode === "both") {
          desc =
            `Welcome to **${interaction.guild.name}**!\n` +
            `React with **${emoji}** or click **Verify** below to unlock full access.`;
        }

        if (includeRules) {
          desc +=
            `\n\n📌 **Rules:**\n` +
            `• Follow Discord ToS & Guidelines.\n` +
            `• Be respectful. No toxicity or spam.`;
        }

        embed.setDescription(desc);

        const files: AttachmentBuilder[] = [];
        if (!config.bannerUrl && fs.existsSync(DEFAULT_VERIFY_BANNER)) {
          const attachment = new AttachmentBuilder(DEFAULT_VERIFY_BANNER, { name: "vyntric-verify.png" });
          files.push(attachment);
          embed.setImage("attachment://vyntric-verify.png");
        } else if (config.bannerUrl) {
          embed.setImage(config.bannerUrl);
        }

        embed.setFooter({
          text:
            selectedMode === "reaction"
              ? `${BRAND.name} Security • React with ${emoji} below`
              : `${BRAND.name} Security • Click or react below`,
          iconURL: interaction.client.user?.displayAvatarURL(),
        });

        const components: ActionRowBuilder<ButtonBuilder>[] = [];
        if (selectedMode === "button" || selectedMode === "both") {
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(IDS.verifyButton)
              .setLabel(config.buttonLabel || "Verify")
              .setStyle(ButtonStyle.Success)
              .setEmoji("🛡️")
          );
          components.push(row);
        }

        try {
          const sentMsg = await targetChannel.send({
            embeds: [embed],
            components,
            files,
          });

          // Auto-react with verification emoji for seamless reaction verification
          if (selectedMode === "reaction" || selectedMode === "both") {
            await sentMsg.react(emoji).catch(() => {});
          }

          // Save active message and channel config
          updateVerificationConfig(guildId, {
            channelId: targetChannel.id,
            messageId: sentMsg.id,
            mode: selectedMode,
            reactionEmoji: emoji,
            enabled: true,
          });

          await interaction.editReply({
            content:
              `✅ Verification panel has been successfully posted in <#${targetChannel.id}>!\n` +
              (selectedMode === "reaction"
                ? `👉 **Mode:** Reaction verification active (${emoji}). Members can now simply react with ${emoji} to verify.`
                : `👉 **Mode:** ${selectedMode}`),
          });
        } catch (err: any) {
          console.error("[verify:panel:send]", err);
          await interaction.editReply({
            content: `⚠️ Failed to send panel in <#${targetChannel.id}>: ${err.message}. Please verify the bot has permissions to send messages and embed links.`,
          });
        }
        break;
      }

      case "rules": {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetChannel =
          (interaction.options.getChannel("channel") as TextChannel | null) ||
          (interaction.channel as TextChannel);

        if (!targetChannel || !targetChannel.isTextBased()) {
          await interaction.editReply({ content: "⚠️ Please specify a valid text channel to post rules." });
          return;
        }

        const rulesEmbed = buildRulesEmbed(interaction.guild.name);

        try {
          await targetChannel.send({ embeds: [rulesEmbed] });
          await interaction.editReply({
            content: `✅ Official Server Rules have been posted in <#${targetChannel.id}>!`,
          });
        } catch (err: any) {
          console.error("[verify:rules:send]", err);
          await interaction.editReply({
            content: `⚠️ Failed to post rules: ${err.message}. Check bot permissions in <#${targetChannel.id}>.`,
          });
        }
        break;
      }

      case "banner": {
        await interaction.deferReply();
        const url = interaction.options.getString("url");

        if (!url || url.toLowerCase() === "reset") {
          updateVerificationConfig(guildId, { bannerUrl: null });
          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.primary)
            .setTitle("✅ Verification Banner Reset")
            .setDescription("The verification panel has been reset to the default high-tech Vyntric crimson banner.");
          await interaction.editReply({ embeds: [embed] });
          return;
        }

        updateVerificationConfig(guildId, { bannerUrl: url });

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle("✅ Custom Verification Banner Set")
          .setDescription(`Your custom banner has been saved and will appear on the verification panel.`)
          .setImage(url);

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "status": {
        await interaction.deferReply();

        const roleText = config.roleId ? `<@&${config.roleId}>` : "❌ _Not configured (run /verify setup)_";
        const unverifiedText = config.unverifiedRoleId ? `<@&${config.unverifiedRoleId}>` : "_None_";
        const channelText = config.channelId ? `<#${config.channelId}>` : "❌ _Not set_";
        const logText = config.logChannelId ? `<#${config.logChannelId}>` : "_None_";
        const waitText = config.waitMinutes > 0 ? `⏱️ **${config.waitMinutes} minute(s)**` : "⚡ Instant (0 min)";
        const modeText =
          config.mode === "button"
            ? "🔘 Button Only"
            : config.mode === "both"
            ? `🔘+${config.reactionEmoji || "✅"} Both`
            : `✅ Reaction (${config.reactionEmoji || "✅"}) - No Buttons`;

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle(`🛡️ ${BRAND.name} Verification System Status`)
          .addFields(
            { name: "🔘 Status", value: config.enabled ? "✅ Enabled" : "⚠️ Disabled", inline: true },
            { name: "⚙️ Mode", value: modeText, inline: true },
            { name: "🛡️ Verified Role", value: roleText, inline: true },
            { name: "📢 Verification Channel", value: channelText, inline: true },
            { name: "⏳ Cooldown Wait", value: waitText, inline: true },
            { name: "🚫 Unverified Role", value: unverifiedText, inline: true },
            { name: "📝 Audit Log Channel", value: logText, inline: true },
            {
              name: "🎨 Banner Mode",
              value: config.bannerUrl ? `[Custom Banner](${config.bannerUrl})` : "🔥 Built-in Vyntric Red Cyber Banner",
              inline: false,
            }
          )
          .setFooter({ text: "Use /verify setup or /verify panel to update settings" });

        const files: AttachmentBuilder[] = [];
        if (!config.bannerUrl && fs.existsSync(DEFAULT_VERIFY_BANNER)) {
          const attachment = new AttachmentBuilder(DEFAULT_VERIFY_BANNER, { name: "vyntric-verify.png" });
          files.push(attachment);
          embed.setImage("attachment://vyntric-verify.png");
        } else if (config.bannerUrl) {
          embed.setImage(config.bannerUrl);
        }

        await interaction.editReply({ embeds: [embed], files });
        break;
      }

      case "test": {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const emoji = config.reactionEmoji || "✅";
        const mode = config.mode || "reaction";

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle(`[TEST PREVIEW] ${config.title || DEFAULT_VERIFICATION_TITLE}`)
          .setDescription(
            `Welcome to **${interaction.guild.name}**!\n\n` +
            `This is an administrator preview of how members will see the verification panel.\n\n` +
            `📋 **How to verify:**\n` +
            (mode === "reaction"
              ? `React with the **${emoji}** emoji below to complete verification and unlock server access.\n\n*(No buttons or external links)*\n\n`
              : `Click the **Verify** button below to complete verification and unlock server access.\n\n`) +
            (config.waitMinutes > 0
              ? `⏳ *Security Cooldown: New members must wait ${config.waitMinutes} minute(s) before verifying.*\n\n`
              : "") +
            `📌 **Rules:** Agree to Discord Terms of Service, Community Guidelines, and Server Rules.`
          );

        const files: AttachmentBuilder[] = [];
        if (!config.bannerUrl && fs.existsSync(DEFAULT_VERIFY_BANNER)) {
          const attachment = new AttachmentBuilder(DEFAULT_VERIFY_BANNER, { name: "vyntric-verify.png" });
          files.push(attachment);
          embed.setImage("attachment://vyntric-verify.png");
        } else if (config.bannerUrl) {
          embed.setImage(config.bannerUrl);
        }

        const components: ActionRowBuilder<ButtonBuilder>[] = [];
        if (mode === "button" || mode === "both") {
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(IDS.verifyButton)
              .setLabel(config.buttonLabel || "Verify")
              .setStyle(ButtonStyle.Success)
              .setEmoji("🛡️")
          );
          components.push(row);
        }

        await interaction.editReply({
          embeds: [embed],
          components,
          files,
        });
        break;
      }
    }
  },
};

export default command;
