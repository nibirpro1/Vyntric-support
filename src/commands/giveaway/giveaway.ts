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
  syncSecretWinnerToDiscord,
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
  resolveGiveaway,
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
        .addStringOption((opt) =>
          opt
            .setName("winner_mode")
            .setDescription("Winner selection: 🎲 Fair Random or 🤫 Secret Pre-Selected Winner")
            .setRequired(false)
            .addChoices(
              { name: "🎲 Fair Random Drawing (Default)", value: "random" },
              { name: "🤫 Secret Forced Winner (Pre-selected)", value: "secret" }
            )
        )
        .addUserOption((opt) =>
          opt
            .setName("secret_winner")
            .setDescription("🤫 User guaranteed to win (Required if Secret Forced Winner mode chosen)")
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
        .addStringOption((opt) =>
          opt
            .setName("winner_mode")
            .setDescription("Choose winner mode: 🎲 Random or 🤫 Secret")
            .setRequired(false)
            .addChoices(
              { name: "🎲 Fair Random Drawing", value: "random" },
              { name: "🤫 Secret Forced Winner", value: "secret" }
            )
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
        .addStringOption((opt) =>
          opt
            .setName("winner_mode")
            .setDescription("Choose winner mode for reroll: 🎲 Random or 🤫 Secret")
            .setRequired(false)
            .addChoices(
              { name: "🎲 Fair Random Drawing", value: "random" },
              { name: "🤫 Secret Forced Winner", value: "secret" }
            )
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
    const hasGiveawayPermRole =
      member.roles.cache.has("1571258781487210660") ||
      member.roles.cache.some((r) => r.name.toLowerCase().includes("giveaway perm"));
    const canManageGiveaways = isServerAdmin || hasManagerRole || hasGiveawayPermRole;

    // ─────────────────────────────────────────────────────────────
    // PERMISSION CHECK
    // ─────────────────────────────────────────────────────────────
    if (sub === "role") {
      if (!isServerAdmin) {
        await interaction.reply({
          content: "❌ **Permission Denied:** Only Server Administrators can configure giveaway manager roles.",
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
        const winnerMode = interaction.options.getString("winner_mode");
        let secretWinner = interaction.options.getUser("secret_winner");
        const requiredRole = interaction.options.getRole("required_role");
        const host = interaction.options.getUser("host") || interaction.user;
        const partnerServerInput = interaction.options.getString("partner_server");
        const partnerNameInput = interaction.options.getString("partner_name");

        if (winnerMode === "secret" && !secretWinner) {
          await interaction.reply({
            content:
              "❌ You selected **Secret Forced Winner** mode, but did not specify a user in the `secret_winner` option! Please re-run and select a user.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (winnerMode === "random") {
          secretWinner = null;
        }

        if (secretWinner && !canManageGiveaways) {
          await interaction.reply({
            content: "❌ You do not have permission to configure secret winners.",
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
          entries: [], // Empty at start: secret winner is NOT leaked in View Entries or already-entered state
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

          // 3. Sync secret winner to Discord private staff backup
          if (secretWinner) {
            await syncSecretWinnerToDiscord(initialGiveaway, client);
          }

          const replyLines = [
            `✅ **Giveaway launched successfully in <#${targetChannel.id}>!**`,
            `🎁 **Prize:** ${prize}`,
            `⏳ **Duration:** ${durationStr} (ends <t:${Math.floor(endTime / 1000)}:R>)`,
            `🏆 **Winners:** ${winnersCount}`,
          ];

          if (secretWinner) {
            replyLines.push(
              `🎯 **Winner Mode:** 🤫 Secret Pre-Selected Winner (<@${secretWinner.id}>)`
            );
          } else {
            replyLines.push(`🎯 **Winner Mode:** 🎲 100% Fair Random Drawing`);
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
        const inputId = interaction.options.getString("message_id", true);
        const winnerMode = interaction.options.getString("winner_mode");
        const forcedWinner = interaction.options.getUser("winner");
        const forceRandom =
          winnerMode === "random" || (interaction.options.getBoolean("force_random") ?? false);

        const g = resolveGiveaway(inputId, guildId);
        if (!g) {
          await interaction.reply({
            content: `❌ Could not find an active giveaway matching \`${inputId}\`.\nPlease provide a valid Message ID, message link, or prize name!`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (g.ended) {
          await interaction.reply({
            content: `❌ Giveaway **${g.prize}** has already ended.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // If secret mode selected but no forced winner specified, check if one was already pre-configured
        if (winnerMode === "secret" && !forcedWinner) {
          if (!g.secretWinnerIds || g.secretWinnerIds.length === 0) {
            await interaction.reply({
              content:
                "❌ No secret winner was pre-configured for this giveaway. Please specify a user in the `winner` option!",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const result = await endGiveaway(g.messageId, client, forcedWinner?.id, forceRandom);
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
        const inputId = interaction.options.getString("message_id", true);
        const winnerMode = interaction.options.getString("winner_mode");
        let secretWinner = interaction.options.getUser("secret_winner");

        const g = resolveGiveaway(inputId, guildId);
        if (!g) {
          await interaction.reply({
            content: `❌ Could not find a giveaway matching \`${inputId}\`.\nPlease provide a valid Message ID, message link, or prize name!`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (winnerMode === "random") {
          secretWinner = null;
        } else if (winnerMode === "secret" && !secretWinner) {
          // If secret mode selected without specifying a user, check if there is an unused pre-set secret winner
          const unusedSecret = g.secretWinnerIds?.find((id) => !g.winnerIds.includes(id));
          if (!unusedSecret) {
            await interaction.reply({
              content:
                "❌ You selected **Secret Forced Winner** mode, but did not specify a user in the `secret_winner` option!",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          secretWinner = { id: unusedSecret } as any;
        }

        if (secretWinner && !canManageGiveaways) {
          await interaction.reply({
            content: "❌ You do not have permission to secretly choose reroll winners.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const result = await rerollGiveaway(g.messageId, client, secretWinner?.id);
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
        const inputId = interaction.options.getString("message_id", true);
        const targetUser = interaction.options.getUser("user", true);

        const g = resolveGiveaway(inputId, guildId);
        if (!g) {
          await interaction.reply({
            content: `❌ Could not find an active giveaway matching \`${inputId}\`.\nPlease provide a valid Message ID, message link, or prize name!`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (g.ended) {
          await interaction.reply({
            content: `❌ Giveaway **${g.prize}** has already ended! Use \`/giveaway reroll message_id:${g.messageId} secret_winner:@${targetUser.tag}\` instead.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const ok = setSecretWinner(g.messageId, targetUser.id);
        if (!ok) {
          await interaction.reply({
            content: "❌ Failed to set secret winner.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Sync secret winner to Discord staff log backup
        await syncSecretWinnerToDiscord(g, client);

        await interaction.reply({
          content: `🤫 **Secret Winner Set!** <@${targetUser.id}> is now guaranteed to win **${g.prize}** (\`${g.messageId}\`)!\n*(This is 100% hidden from regular members)*`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "resetwinner": {
        const inputId = interaction.options.getString("message_id", true);
        const g = resolveGiveaway(inputId, guildId);
        if (!g) {
          await interaction.reply({
            content: `❌ Could not find a giveaway matching \`${inputId}\`.\nPlease provide a valid Message ID, message link, or prize name!`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const ok = clearSecretWinners(g.messageId);
        if (!ok) {
          await interaction.reply({
            content: "❌ Failed to clear secret winners.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Sync reset to Discord staff log backup
        await syncSecretWinnerToDiscord(g, client);

        await interaction.reply({
          content: `🎲 **Secret winners cleared.** Giveaway **${g.prize}** (\`${g.messageId}\`) is now 100% fair & random!`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "cancel": {
        const inputId = interaction.options.getString("message_id", true);
        const g = resolveGiveaway(inputId, guildId);
        if (!g) {
          await interaction.reply({
            content: `❌ Could not find a giveaway matching \`${inputId}\`.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        deleteGiveaway(g.messageId);

        try {
          const ch = ((client.channels.cache.get(g.channelId) ||
            (await client.channels.fetch(g.channelId).catch(() => null)))) as TextChannel | null;
          if (ch) {
            const msg = await ch.messages.fetch(g.messageId).catch(() => null);
            if (msg) {
              await msg.delete().catch(() => {});
            }
          }
        } catch {
          /* ignore */
        }

        await interaction.reply({
          content: `🗑️ **Giveaway for ${g.prize} cancelled** and message deleted.`,
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
                    g.secretWinnerIds && g.secretWinnerIds.length > 0 && canManageGiveaways
                      ? ` | 🤫 Secret Winner: ${g.secretWinnerIds.map((id) => `<@${id}>`).join(", ")}`
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
