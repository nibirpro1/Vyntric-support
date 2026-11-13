import {
  AttachmentBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import path from "path";
import fs from "fs";
import { Command } from "../../structures/Command";
import {
  formatWelcomeText,
  getRandomWelcomeJoke,
  getWelcomeConfig,
  updateWelcomeConfig,
} from "../../lib/welcomeStore";
import { BRAND } from "../../lib/brand";

const DEFAULT_BANNER_PATH = path.resolve(process.cwd(), "assets", "banners", "vyntric-welcome.gif");

const command: Command = {
  data: new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("Configure Vyntric Welcome, Leave, and Auto-Role system")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription("Quick setup for the welcome channel and optional auto-role")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The channel to send welcome messages in")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addRoleOption((opt) =>
        opt
          .setName("autorole")
          .setDescription("Role to automatically give to joining members")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("message")
          .setDescription("Custom message ({user}, {username}, {server}, {memberCount})")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("banner")
      .setDescription("Set a custom animated GIF banner or reset to default Vyntric red animation")
      .addStringOption((opt) =>
        opt
          .setName("url")
          .setDescription("Direct image or GIF URL, or type 'reset' to use default animated Vyntric banner")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("message")
      .setDescription("Set custom welcome announcement message")
      .addStringOption((opt) =>
        opt
          .setName("text")
          .setDescription("Message with placeholders: {user}, {username}, {server}, {memberCount}")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("autorole")
      .setDescription("Manage automatic roles given to new members")
      .addStringOption((opt) =>
        opt
          .setName("action")
          .setDescription("Action to perform")
          .setRequired(true)
          .addChoices(
            { name: "Add Role", value: "add" },
            { name: "Remove Role", value: "remove" },
            { name: "List Roles", value: "list" }
          )
      )
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("The role to add or remove").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("dm")
      .setDescription("Configure direct message sent to new members")
      .addBooleanOption((opt) =>
        opt.setName("enabled").setDescription("Enable or disable DM welcome").setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("message")
          .setDescription("Message text ({user}, {username}, {server}, {memberCount})")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("leavechannel")
      .setDescription("Set the channel for goodbye/leave messages")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The leave channel")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("leavemessage")
      .setDescription("Set custom goodbye message")
      .addStringOption((opt) =>
        opt
          .setName("text")
          .setDescription("Goodbye text ({username}, {server}, {memberCount})")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("chat")
      .setDescription("Configure the short greeting card sent to general chat on member join")
      .addBooleanOption((opt) =>
        opt.setName("enabled").setDescription("Enable or disable the general chat welcome card").setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The chat channel (defaults to #〢ᴄʜᴀᴛ)")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("ping")
          .setDescription("Ping line above the card (e.g. '💜 Yoo, {user}')")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("description")
          .setDescription("Custom card text (supports markdown, \\n for new lines)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("View current Welcome & Leave configuration")
  )
  .addSubcommand((sub) =>
    sub.setName("test").setDescription("Simulate a member join and test the welcome message")
  ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const config = getWelcomeConfig(guildId);

    switch (sub) {
      case "setup": {
        const channel = interaction.options.getChannel("channel", true) as TextChannel;
        const role = interaction.options.getRole("autorole");
        const msg = interaction.options.getString("message");

        const autoRoles = [...config.autoRoleIds];
        if (role && !autoRoles.includes(role.id)) {
          autoRoles.push(role.id);
        }

        updateWelcomeConfig(guildId, {
          enabled: true,
          channelId: channel.id,
          autoRoleIds: autoRoles,
          ...(msg ? { message: msg } : {}),
        });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.success)
              .setTitle("✅ Welcome System Configured")
              .setDescription(
                [
                  `📢 **Welcome Channel:** <#${channel.id}>`,
                  role ? `🎭 **Auto-Role:** <@&${role.id}>` : "🎭 **Auto-Role:** None",
                  `💬 **Message Preview:** ${msg || config.message}`,
                  `🎨 **Banner:** Built-in Vyntric Red Animation`,
                  "",
                  "💡 Run `/welcome test` to preview the actual card!",
                ].join("\n")
              ),
          ],
        });
        break;
      }

      case "banner": {
        await interaction.deferReply();
        const url = interaction.options.getString("url")?.trim();
        const files: AttachmentBuilder[] = [];

        if (!url || url.toLowerCase() === "reset") {
          updateWelcomeConfig(guildId, { bannerUrl: null });
          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.primary)
            .setTitle("✅ Vyntric Animated Red Banner Activated")
            .setDescription("The default neon-red animated Vyntric banner is now active for all welcome cards!");

          if (fs.existsSync(DEFAULT_BANNER_PATH)) {
            const attachment = new AttachmentBuilder(DEFAULT_BANNER_PATH, { name: "vyntric-welcome.gif" });
            embed.setImage("attachment://vyntric-welcome.gif");
            files.push(attachment);
          }

          await interaction.editReply({ embeds: [embed], files });
        } else {
          updateWelcomeConfig(guildId, { bannerUrl: url });
          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.primary)
            .setTitle("✅ Custom Welcome Banner Set")
            .setDescription(`Custom banner updated:\n${url}`)
            .setImage(url);

          await interaction.editReply({ embeds: [embed] });
        }
        break;
      }

      case "message": {
        const text = interaction.options.getString("text", true);
        updateWelcomeConfig(guildId, { message: text });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.primary)
              .setTitle("✅ Welcome Message Updated")
              .setDescription(`New template:\n> ${text}`),
          ],
        });
        break;
      }

      case "autorole": {
        const action = interaction.options.getString("action", true);
        const role = interaction.options.getRole("role");

        if (action === "list") {
          const list = config.autoRoleIds.map((id) => `<@&${id}>`).join(", ") || "None";
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(BRAND.colors.primary)
                .setTitle("🎭 Configured Auto-Roles")
                .setDescription(`New members will receive: ${list}`),
            ],
            ephemeral: true,
          });
          return;
        }

        if (!role) {
          await interaction.reply({
            content: "⚠️ You must specify a role to add or remove.",
            ephemeral: true,
          });
          return;
        }

        if (action === "add") {
          if (!config.autoRoleIds.includes(role.id)) {
            const nextRoles = [...config.autoRoleIds, role.id];
            updateWelcomeConfig(guildId, { autoRoleIds: nextRoles });
          }
          await interaction.reply({
            content: `✅ Added <@&${role.id}> to Auto-Roles!`,
          });
        } else if (action === "remove") {
          const nextRoles = config.autoRoleIds.filter((id) => id !== role.id);
          updateWelcomeConfig(guildId, { autoRoleIds: nextRoles });
          await interaction.reply({
            content: `🗑️ Removed <@&${role.id}> from Auto-Roles.`,
          });
        }
        break;
      }

      case "dm": {
        const enabled = interaction.options.getBoolean("enabled", true);
        const msg = interaction.options.getString("message");
        updateWelcomeConfig(guildId, {
          dmEnabled: enabled,
          ...(msg ? { dmMessage: msg } : {}),
        });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(enabled ? BRAND.colors.success : BRAND.colors.warning)
              .setTitle(`📨 DM Welcome: ${enabled ? "Enabled" : "Disabled"}`)
              .setDescription(
                enabled
                  ? `Message template:\n> ${msg || config.dmMessage}`
                  : "Members will no longer receive a DM welcome message."
              ),
          ],
        });
        break;
      }

      case "leavechannel": {
        const channel = interaction.options.getChannel("channel", true) as TextChannel;
        updateWelcomeConfig(guildId, { leaveChannelId: channel.id });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.primary)
              .setTitle("✅ Leave Channel Set")
              .setDescription(`Goodbye announcements will be posted in <#${channel.id}>.`),
          ],
        });
        break;
      }

      case "leavemessage": {
        const text = interaction.options.getString("text", true);
        updateWelcomeConfig(guildId, { leaveMessage: text });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.primary)
              .setTitle("✅ Leave Message Updated")
              .setDescription(`New template:\n> ${text}`),
          ],
        });
        break;
      }

      case "chat": {
        const enabled = interaction.options.getBoolean("enabled", true);
        const channel = interaction.options.getChannel("channel") as TextChannel | null;
        const ping = interaction.options.getString("ping");
        const description = interaction.options.getString("description")?.replace(/\\n/g, "\n");

        const targetChannelId = channel ? channel.id : (config.chatWelcomeChannelId || "1560688449353420930");

        updateWelcomeConfig(guildId, {
          chatWelcomeEnabled: enabled,
          chatWelcomeChannelId: targetChannelId,
          ...(ping ? { chatWelcomePing: ping } : {}),
          ...(description ? { chatWelcomeDescription: description } : {}),
        });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.success)
              .setTitle("✅ Chat Greeting Card Configured")
              .setDescription(
                [
                  `✨ **Chat Welcome Status:** ${enabled ? "✅ Enabled" : "❌ Disabled"}`,
                  `💬 **Channel:** <#${targetChannelId}>`,
                  `👋 **Ping Line:** \`${ping || config.chatWelcomePing || "💜 Yoo, {user}"}\``,
                  "",
                  "💡 When a new member joins, they will get a clean, stylish welcome card in this chat channel!",
                  "Run `/welcome test` to preview how both cards look!",
                ].join("\n")
              ),
          ],
        });
        break;
      }

      case "status": {
        await interaction.deferReply();
        const autoRoles = config.autoRoleIds.map((id) => `<@&${id}>`).join(", ") || "None";
        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle("⚙️ Vyntric Welcome & Goodbye System Status")
          .addFields(
            {
              name: "📢 Welcome Channel",
              value: config.channelId ? `<#${config.channelId}>` : "❌ Disabled",
              inline: true,
            },
            {
              name: "💬 Chat Greeting Card",
              value: config.chatWelcomeEnabled ? `✅ Enabled in <#${config.chatWelcomeChannelId || "1560688449353420930"}>` : "❌ Disabled",
              inline: true,
            },
            {
              name: "🎭 Auto-Roles",
              value: autoRoles,
              inline: true,
            },
            {
              name: "🎨 Banner Animation",
              value: config.bannerUrl ? `[Custom Banner](${config.bannerUrl})` : "🔥 Built-in Vyntric Red Animation",
              inline: true,
            },
            {
              name: "📨 DM Welcome",
              value: config.dmEnabled ? "✅ Enabled" : "❌ Disabled",
              inline: true,
            },
            {
              name: "🚪 Leave Channel",
              value: config.leaveChannelId ? `<#${config.leaveChannelId}>` : "❌ Disabled",
              inline: true,
            },
            {
              name: "💬 Welcome Message Template",
              value: `\`\`\`${config.message}\`\`\``,
            },
            {
              name: "💬 Leave Message Template",
              value: `\`\`\`${config.leaveMessage}\`\`\``,
            }
          )
          .setFooter({ text: "Use /welcome setup or /welcome chat to modify settings" });

        const files: AttachmentBuilder[] = [];
        if (!config.bannerUrl && fs.existsSync(DEFAULT_BANNER_PATH)) {
          const attachment = new AttachmentBuilder(DEFAULT_BANNER_PATH, { name: "vyntric-welcome.gif" });
          embed.setImage("attachment://vyntric-welcome.gif");
          files.push(attachment);
        } else if (config.bannerUrl) {
          embed.setImage(config.bannerUrl);
        }

        await interaction.editReply({ embeds: [embed], files });
        break;
      }

      case "test": {
        await interaction.deferReply();

        const userTag = interaction.user.tag || interaction.user.username;
        const avatarUrl = interaction.user.displayAvatarURL({ size: 256 });
        const formattedDesc = formatWelcomeText(config.message, interaction.member || interaction.user);

        // 1. Official welcome channel card
        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setAuthor({
            name: `Welcome to ${interaction.guild.name}! [OFFICIAL CHANNEL CARD]`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setThumbnail(avatarUrl)
          .setDescription(formattedDesc)
          .addFields(
            { name: "👤 User", value: `<@${interaction.user.id}> (${userTag})`, inline: true },
            { name: "👥 Member Count", value: `**#${interaction.guild.memberCount}**`, inline: true },
            { name: "📅 Account Created", value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`, inline: true }
          )
          .setFooter({ text: getRandomWelcomeJoke() })
          .setTimestamp();

        // 2. Chat greeting card (as requested from screenshot)
        const chatPing = formatWelcomeText(config.chatWelcomePing || "💜 Yoo, {user}", interaction.member || interaction.user);
        const chatTitle = formatWelcomeText(config.chatWelcomeTitle || "Welcome to {server}", interaction.member || interaction.user);
        const chatDesc = formatWelcomeText(
          config.chatWelcomeDescription ||
            "🌸 Enjoy fun moments, make new friends..!\n" +
            "Play together in a positive & active gaming community. 🔥\n\n" +
            "» Don't forget to:\n" +
            "  » Check our rules in <#1554018991759032320> and get roles in <#1551792726243287130>\n" +
            "  » Chat and hang out right here in <#1560688449353420930> ⚡",
          interaction.member || interaction.user
        );

        const chatEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle(chatTitle.slice(0, 256))
          .setThumbnail(avatarUrl)
          .setDescription(chatDesc)
          .setFooter({ text: `${interaction.guild.name} • Welcome to the family` })
          .setTimestamp();

        const files: AttachmentBuilder[] = [];
        if (config.bannerUrl && config.bannerUrl.trim().length > 0) {
          embed.setImage(config.bannerUrl.trim());
          chatEmbed.setImage(config.bannerUrl.trim());
        } else if (fs.existsSync(DEFAULT_BANNER_PATH)) {
          const bannerAttachment = new AttachmentBuilder(DEFAULT_BANNER_PATH, { name: "vyntric-welcome.gif" });
          embed.setImage("attachment://vyntric-welcome.gif");
          chatEmbed.setImage("attachment://vyntric-welcome.gif");
          files.push(bannerAttachment);
        }

        await interaction.editReply({
          content: `👀 **Test preview of Welcome Cards:**\n${chatPing}`,
          embeds: [embed, chatEmbed],
          files,
        });
        break;
      }
    }
  },
};

export default command;
