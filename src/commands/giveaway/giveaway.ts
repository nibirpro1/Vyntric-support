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
  clearSecretWinners,
  deleteGiveaway,
  getActiveGiveaways,
  getGiveaway,
  Giveaway,
  saveGiveaway,
  setSecretWinner,
} from "../../lib/giveawayStore";
import { VyntricClient } from "../../structures/VyntricClient";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Host, manage, and configure giveaways with custom/secret winner selection")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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
        .addUserOption((opt) =>
          opt
            .setName("secret_winner")
            .setDescription("🤫 Secretly guarantee this user wins (hidden from everyone)")
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
        .setDescription("🤫 Rig / predetermine who will win an active giveaway")
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
        .setDescription("🎲 Reset giveaway back to 100% fair random mode (clears secret winner)")
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

    switch (sub) {
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
            content: `❌ ${result.message || "Failed to end giveaway."}`,
          });
          return;
        }

        const winnersStr =
          result.winners.length > 0
            ? result.winners.map((w) => `<@${w}>`).join(", ")
            : "No valid entries";

        await interaction.editReply({
          content: `✅ Giveaway ended! Winners: ${winnersStr}${forceRandom ? " (Selected randomly)" : ""}`,
        });
        break;
      }

      case "reroll": {
        const messageId = interaction.options.getString("message_id", true).trim();
        const secretWinner = interaction.options.getUser("secret_winner");

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const result = await rerollGiveaway(messageId, client, secretWinner?.id);
        if (!result.success) {
          await interaction.editReply({
            content: `❌ ${result.message || "Failed to reroll giveaway."}`,
          });
          return;
        }

        await interaction.editReply({
          content: `🎉 New winner selected: <@${result.newWinner}>!`,
        });
        break;
      }

      case "setwinner": {
        const messageId = interaction.options.getString("message_id", true).trim();
        const targetUser = interaction.options.getUser("user", true);

        const g = getGiveaway(messageId);
        if (!g) {
          await interaction.reply({
            content: `❌ Giveaway with Message ID \`${messageId}\` was not found.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (g.ended) {
          await interaction.reply({
            content: `❌ This giveaway has already ended! Use \`/giveaway reroll\` instead.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        setSecretWinner(messageId, targetUser.id);

        await interaction.reply({
          content: [
            `🤫 **Secret Winner Set!**`,
            `User <@${targetUser.id}> is now guaranteed to win the giveaway for **${g.prize}** when it ends.`,
            `-# This action is completely confidential and only visible to you. Use \`/giveaway resetwinner\` if you ever want to revert back to random.`,
          ].join("\n"),
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "resetwinner": {
        const messageId = interaction.options.getString("message_id", true).trim();
        const g = getGiveaway(messageId);
        if (!g) {
          await interaction.reply({
            content: `❌ Giveaway with Message ID \`${messageId}\` was not found.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (g.ended) {
          await interaction.reply({
            content: `❌ This giveaway has already ended!`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        clearSecretWinners(messageId);

        await interaction.reply({
          content: `🎲 **Giveaway Reset to Random!**\nAny secret/predetermined winners have been removed for **${g.prize}**. When this giveaway ends, winners will be picked 100% fairly and randomly from all entries!`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "cancel": {
        const messageId = interaction.options.getString("message_id", true).trim();
        const g = getGiveaway(messageId);

        if (!g) {
          await interaction.reply({
            content: `❌ Giveaway with Message ID \`${messageId}\` not found.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        deleteGiveaway(messageId);

        // Delete or disable original message
        try {
          const channel = client.channels.cache.get(g.channelId) as TextChannel | undefined;
          if (channel) {
            const msg = await channel.messages.fetch(messageId).catch(() => null);
            if (msg) {
              await msg.edit({
                embeds: [
                  new EmbedBuilder()
                    .setColor(BRAND.colors.danger)
                    .setTitle(`🚫 GIVEAWAY CANCELLED: ${g.prize}`)
                    .setDescription(`This giveaway was cancelled by staff.`)
                    .setFooter({ text: `${BRAND.name} Giveaways` }),
                ],
                components: [],
              }).catch(() => {});
            }
          }
        } catch {
          /* ignore */
        }

        await interaction.reply({
          content: `✅ Cancelled giveaway for **${g.prize}**.`,
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
                    g.secretWinnerIds && g.secretWinnerIds.length > 0
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
