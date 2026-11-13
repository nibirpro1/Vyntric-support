import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { BRAND } from "../../lib/brand";
import {
  buildGiveawayComponents,
  buildGiveawayEmbed,
  endGiveaway,
  parseDuration,
  rerollGiveaway,
  scheduleGiveawayTimer,
} from "../../lib/giveawayManager";
import {
  addGiveawayManagerRole,
  clearSecretWinners,
  deleteGiveaway,
  getActiveGiveaways,
  getGiveaway,
  getGiveawayGuildSettings,
  Giveaway,
  removeGiveawayManagerRole,
  saveGiveaway,
  setSecretWinner,
} from "../../lib/giveawayStore";
import { VyntricClient } from "../../structures/VyntricClient";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Host, manage, and configure giveaways with partner requirements & manager roles")
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a new interactive giveaway")
        .addStringOption((opt) =>
          opt.setName("prize").setDescription("The prize being given away").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("duration")
            .setDescription("Duration of the giveaway (e.g. 10m, 1h, 24h, 2d)")
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("winners")
            .setDescription("Number of winners (default: 1)")
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to post the giveaway in (default: current channel)")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("partner_server")
            .setDescription("Discord invite link or server ID of partner server (users must join to enter)")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("partner_name")
            .setDescription("Custom display name for the partner server")
            .setRequired(false)
        )
        .addRoleOption((opt) =>
          opt
            .setName("required_role")
            .setDescription("Only users with this role can enter")
            .setRequired(false)
        )
        .addUserOption((opt) =>
          opt
            .setName("host")
            .setDescription("Custom host user to display on the giveaway card")
            .setRequired(false)
        )
        .addUserOption((opt) =>
          opt
            .setName("secret_winner")
            .setDescription("🤫 Secretly guarantee this user wins (Admins only)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("role")
        .setDescription("Configure which roles (e.g. @Partnership, @Giveaway Host) can manage giveaways")
        .addStringOption((opt) =>
          opt
            .setName("action")
            .setDescription("Action to perform")
            .setRequired(true)
            .addChoices(
              { name: "Add Manager Role", value: "add" },
              { name: "Remove Manager Role", value: "remove" },
              { name: "List Allowed Roles", value: "list" }
            )
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role to grant or revoke giveaway permissions for")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End an active giveaway immediately and pick winners")
        .addStringOption((opt) =>
          opt.setName("message_id").setDescription("Giveaway message ID").setRequired(true)
        )
        .addUserOption((opt) =>
          opt
            .setName("winner")
            .setDescription("Force a specific winner right now")
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("force_random")
            .setDescription("Force picking 100% fair random winners (ignores any secret winner)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("reroll")
        .setDescription("Re-roll winner(s) for an ended giveaway")
        .addStringOption((opt) =>
          opt.setName("message_id").setDescription("Giveaway message ID").setRequired(true)
        )
        .addUserOption((opt) =>
          opt
            .setName("secret_winner")
            .setDescription("Secretly choose who wins the reroll (leave empty for random)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("setwinner")
        .setDescription("🤫 Rig / predetermine who will win an active giveaway (Admin only)")
        .addStringOption((opt) =>
          opt.setName("message_id").setDescription("Giveaway message ID").setRequired(true)
        )
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("User who is guaranteed to win")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("resetwinner")
        .setDescription("🎲 Reset giveaway back to 100% fair random mode (Admin only)")
        .addStringOption((opt) =>
          opt.setName("message_id").setDescription("Giveaway message ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("cancel")
        .setDescription("Cancel an active giveaway without picking any winner")
        .addStringOption((opt) =>
          opt.setName("message_id").setDescription("Giveaway message ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all currently active giveaways in this server")
    ),

  async execute(interaction: ChatInputCommandInteraction, client: VyntricClient) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const member = (interaction.member as GuildMember) || (await interaction.guild.members.fetch(interaction.user.id));
    const settings = getGiveawayGuildSettings(guildId);

    const isServerAdmin =
      member.id === interaction.guild.ownerId ||
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild);

    const hasManagerRole = settings.managerRoleIds.some((rId) => member.roles.cache.has(rId));
    const canManageGiveaways = isServerAdmin || hasManagerRole;

    // ─────────────────────────────────────────────────────────────
    // PERMISSION CHECK
    // ─────────────────────────────────────────────────────────────
    if (sub === "role" || sub === "setwinner" || sub === "resetwinner") {
      if (!isServerAdmin) {
        await interaction.reply({
          content: "❌ **Permission Denied:** Only Server Administrators can configure giveaway roles or secret winner controls.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    } else {
      if (!canManageGiveaways) {
        const allowedRolesText =
          settings.managerRoleIds.length > 0
            ? settings.managerRoleIds.map((rId) => `<@&${rId}>`).join(", ")
            : "No Giveaway Manager role configured yet (ask an Admin to run `/giveaway role`)";

        await interaction.reply({
          content:
            `❌ **Permission Denied:** You do not have permission to host or manage giveaways.\n\n` +
            `🔹 **Required:** Manage Server permission or one of these authorized roles: ${allowedRolesText}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    switch (sub) {
      case "role": {
        const action = interaction.options.getString("action", true);
        const role = interaction.options.getRole("role");

        if (action === "list") {
          const listEmbed = new EmbedBuilder()
            .setColor(BRAND.colors.primary)
            .setTitle("🎁 Giveaway Manager Roles")
            .setDescription(
              settings.managerRoleIds.length > 0
                ? settings.managerRoleIds.map((id) => `• <@&${id}>`).join("\n")
                : "No custom Giveaway Manager roles configured.\n*(Currently only Administrators & Server Managers can host giveaways)*"
            )
            .setFooter({ text: "Use /giveaway role action:Add Manager Role to authorize partnership roles" });

          await interaction.reply({ embeds: [listEmbed], flags: MessageFlags.Ephemeral });
          return;
        }

        if (!role) {
          await interaction.reply({
            content: "⚠️ You must select a `role` for this action.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (action === "add") {
          addGiveawayManagerRole(guildId, role.id);
          await interaction.reply({
            content: `✅ Role <@&${role.id}> has been granted **Giveaway Manager** permissions!\nMembers with this role can now use \`/giveaway start\`, \`/giveaway end\`, \`/giveaway reroll\`, and \`/giveaway cancel\`.`,
            flags: MessageFlags.Ephemeral,
          });
        } else if (action === "remove") {
          removeGiveawayManagerRole(guildId, role.id);
          await interaction.reply({
            content: `🗑️ Removed <@&${role.id}> from Giveaway Manager roles.`,
            flags: MessageFlags.Ephemeral,
          });
        }
        break;
      }

      case "start": {
        const prize = interaction.options.getString("prize", true);
        const durationStr = interaction.options.getString("duration", true);
        const winnersCount = interaction.options.getInteger("winners") || 1;
        const targetChannel =
          (interaction.options.getChannel("channel") as TextChannel) ||
          (interaction.channel as TextChannel);
        const secretWinner = interaction.options.getUser("secret_winner");
        const requiredRole = interaction.options.getRole("required_role");
        const host = interaction.options.getUser("host") || interaction.user;
        const partnerServerInput = interaction.options.getString("partner_server");
        const partnerNameInput = interaction.options.getString("partner_name");

        if (secretWinner && !isServerAdmin) {
          await interaction.reply({
            content: "❌ Only server administrators can set secret winners.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const durationMs = parseDuration(durationStr);
        if (!durationMs) {
          await interaction.reply({
            content:
              "❌ Invalid duration format! Use formats like `30s`, `10m`, `2h`, `1d`, `1w`.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const now = Date.now();
        const endTime = now + durationMs;

        // Resolve Partner Server / Invite link
        let partnerInviteUrl: string | null = null;
        let partnerGuildId: string | null = null;
        let partnerGuildName: string | null = partnerNameInput?.trim() || null;

        if (partnerServerInput) {
          const trimmed = partnerServerInput.trim();
          const inviteMatch = trimmed.match(
            /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)([a-zA-Z0-9-]+)/i
          );
          if (inviteMatch) {
            const code = inviteMatch[1];
            partnerInviteUrl = `https://discord.gg/${code}`;
            try {
              const res = await fetch(`https://discord.com/api/v10/invites/${code}`);
              if (res.ok) {
                const inviteData: any = await res.json();
                partnerGuildId = inviteData.guild?.id || null;
                if (!partnerGuildName) {
                  partnerGuildName = inviteData.guild?.name || null;
                }
              }
            } catch {
              /* ignore */
            }
          } else if (/^\d{17,20}$/.test(trimmed)) {
            partnerGuildId = trimmed;
            const g = client.guilds.cache.get(partnerGuildId);
            if (g && !partnerGuildName) partnerGuildName = g.name;
          } else if (trimmed.startsWith("http")) {
            partnerInviteUrl = trimmed;
          }
        }

        // Temporary object to build initial card
        const initialGiveaway: Giveaway = {
          id: "",
          guildId: interaction.guild.id,
          channelId: targetChannel.id,
          messageId: "",
          prize,
          winnersCount,
          hostId: host.id,
          requiredRoleId: requiredRole?.id || null,
          partnerInviteUrl: partnerInviteUrl || null,
          partnerGuildId: partnerGuildId || null,
          partnerGuildName: partnerGuildName || null,
          secretWinnerIds: secretWinner ? [secretWinner.id] : [],
          entries: secretWinner ? [secretWinner.id] : [],
          startTime: now,
          endTime,
          ended: false,
          winnerIds: [],
        };

        try {
          const sentMsg = await targetChannel.send({
            content: "🎉 **GIVEAWAY!** 🎉",
            embeds: [buildGiveawayEmbed(initialGiveaway)],
            components: buildGiveawayComponents(initialGiveaway),
          });

          initialGiveaway.id = sentMsg.id;
          initialGiveaway.messageId = sentMsg.id;

          saveGiveaway(initialGiveaway);
          scheduleGiveawayTimer(initialGiveaway, client);

          // 1. Add party popper reaction 🎉 like in the user screenshot
          await sentMsg.react("🎉").catch(() => {});

          // 2. Update message components so buttons have the finalized messageId
          await sentMsg.edit({
            embeds: [buildGiveawayEmbed(initialGiveaway)],
            components: buildGiveawayComponents(initialGiveaway),
          }).catch(() => {});

          const replyLines = [
            `✅ **Giveaway launched successfully in <#${targetChannel.id}>!**`,
            `🎁 **Prize:** ${prize}`,
            `⏳ **Duration:** ${durationStr} (ends <t:${Math.floor(endTime / 1000)}:R>)`,
            `🏆 **Winners:** ${winnersCount}`,
          ];

          if (secretWinner) {
            replyLines.push(
              `🤫 **Secret Winner Set:** <@${secretWinner.id}> is guaranteed to win!`
            );
          }
          if (requiredRole) {
            replyLines.push(`📜 **Required Role:** <@&${requiredRole.id}>`);
          }
          if (partnerInviteUrl || partnerGuildName) {
            replyLines.push(
              `🔗 **Partner Server Requirement:** ${partnerGuildName ? `**${partnerGuildName}**` : ""} (${partnerInviteUrl || "Configured"})`
            );
            if (partnerGuildId && !client.guilds.cache.has(partnerGuildId)) {
              replyLines.push(
                `💡 *Tip: Invite Plugsy to the partner server so it can automatically verify that users have joined before entering!*`
              );
            }
          }

          await interaction.editReply({
            content: replyLines.join("\n"),
          });
        } catch (err: any) {
          console.error("[giveaway:start:error]", err);
          await interaction.editReply({
            content: `❌ Could not start giveaway: ${err.message}`,
          });
        }
        break;
      }

      case "end": {
        const messageId = interaction.options.getString("message_id", true).trim();
        const forcedWinner = interaction.options.getUser("winner");
        const forceRandom = interaction.options.getBoolean("force_random") ?? false;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const result = await endGiveaway(messageId, client, forcedWinner?.id, forceRandom);
        if (!result.success) {
          await interaction.editReply({
            content: `❌ ${result.message || "Could not end giveaway."}`,
          });
          return;
        }

        await interaction.editReply({
          content: `✅ **Giveaway ended successfully!**\n🏆 **Winner(s):** ${result.winners.map((id) => `<@${id}>`).join(", ")}`,
        });
        break;
      }

      case "reroll": {
        const messageId = interaction.options.getString("message_id", true).trim();
        const secretWinner = interaction.options.getUser("secret_winner");

        if (secretWinner && !isServerAdmin) {
          await interaction.reply({
            content: "❌ Only server administrators can secretly choose reroll winners.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const result = await rerollGiveaway(messageId, client, secretWinner?.id);
        if (!result.success) {
          await interaction.editReply({
            content: `❌ ${result.message || "Could not reroll giveaway."}`,
          });
          return;
        }

        await interaction.editReply({
          content: `🎲 **Giveaway rerolled successfully!**\n🏆 **New Winner:** ${result.newWinner ? `<@${result.newWinner}>` : "None"}`,
        });
        break;
      }

      case "setwinner": {
        const messageId = interaction.options.getString("message_id", true).trim();
        const targetUser = interaction.options.getUser("user", true);

        const ok = setSecretWinner(messageId, targetUser.id);
        if (!ok) {
          await interaction.reply({
            content: "❌ Giveaway not found or already ended.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.reply({
          content: `🤫 **Secret Winner Set!** <@${targetUser.id}> is now guaranteed to win giveaway \`${messageId}\`!\n*(This is 100% hidden from regular members)*`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "resetwinner": {
        const messageId = interaction.options.getString("message_id", true).trim();
        const ok = clearSecretWinners(messageId);
        if (!ok) {
          await interaction.reply({
            content: "❌ Giveaway not found or already ended.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.reply({
          content: `🎲 **Secret winners cleared.** Giveaway \`${messageId}\` is now 100% fair & random!`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "cancel": {
        const messageId = interaction.options.getString("message_id", true).trim();
        const g = getGiveaway(messageId);
        if (!g) {
          await interaction.reply({
            content: "❌ Giveaway not found.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        deleteGiveaway(messageId);

        try {
          const ch = (await client.channels.fetch(g.channelId)) as TextChannel;
          if (ch) {
            const msg = await ch.messages.fetch(messageId);
            if (msg) {
              await msg.delete();
            }
          }
        } catch {
          /* ignore */
        }

        await interaction.reply({
          content: `🗑️ **Giveaway cancelled** and message deleted.`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "list": {
        const active = getActiveGiveaways(interaction.guild.id);
        if (active.length === 0) {
          await interaction.reply({
            content: "ℹ️ There are no active giveaways running right now.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle(`🎉 Active Giveaways (${active.length})`)
          .setDescription(
            active
              .map(
                (g, i) =>
                  `**${i + 1}. [${g.prize}](https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId})**\n` +
                  `📍 <#${g.channelId}> | ⏳ Ends: <t:${Math.floor(g.endTime / 1000)}:R> | 👥 Entries: \`${g.entries.length}\`\n` +
                  `🆔 Message ID: \`${g.messageId}\`${
                    g.partnerGuildName ? ` | 🔗 Partner: **${g.partnerGuildName}**` : ""
                  }${
                    g.secretWinnerIds && g.secretWinnerIds.length > 0 && isServerAdmin
                      ? ` | 🤫 Secret Winner: <@${g.secretWinnerIds[0]}>`
                      : ""
                  }`
              )
              .join("\n\n")
          )
          .setFooter({ text: `${BRAND.name} Giveaways` });

        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
        break;
      }
    }
  },
};

export default command;
