import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, TextChannel } from "discord.js";
import { Command } from "../../structures/Command";
import { vyntricEmbed } from "../../lib/brand";
import { PUNISHMENTS, PunishmentKind, formatDuration, parseDurationDays } from "../../config/punishments";
import { canModerate } from "../../lib/permissions";
import { addPunishment, getSettings, latestPunishment, listPunishments, liftPunishment } from "../../lib/store";
import { logStaffMovement } from "../../lib/staffLog";

const KINDS = Object.values(PUNISHMENTS);
const CHOICES = KINDS.map((k) => ({ name: `${k.emoji} ${k.headline}`, value: k.kind }));

/**
 * `/punish` - the punishment system.
 *
 *   give     issue a punishment, apply the role, log it
 *   lift     clear the role and mark the record lifted
 *   history  every punishment on a member
 *
 * Nothing here acts silently. The record is written to the punishments channel
 * and the member keeps the role until somebody lifts it, so a punishment is
 * always something a member can see, appeal, and be cleared from.
 */
const command: Command = {
  data: new SlashCommandBuilder()
    .setName("punish")
    .setDescription("Vyntric Tiers punishment system")
    .addSubcommand((sub) =>
      sub
        .setName("give")
        .setDescription("Issue a punishment")
        .addUserOption((o) => o.setName("member").setDescription("Who to punish").setRequired(true))
        .addStringOption((o) =>
          o.setName("type").setDescription("What for").setRequired(true).addChoices(...CHOICES)
        )
        .addStringOption((o) =>
          o
            .setName("reason")
            .setDescription('The evidence, e.g. "Video evidence", "Refusal to SS"')
            .setRequired(true)
            .setMaxLength(400)
        )
        // Declared last on purpose: Discord rejects the entire command when a
        // required option sits after an optional one, and "indefinite" has to
        // stay a real choice rather than a required dummy value.
        .addStringOption((o) =>
          o
            .setName("duration")
            .setDescription('How long, e.g. "90d", "2 weeks", "36h" (omit for indefinite)')
            .setMaxLength(32)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("lift")
        .setDescription("Lift a member's current punishment")
        .addUserOption((o) => o.setName("member").setDescription("Who to clear").setRequired(true))
        .addStringOption((o) =>
          o.setName("reason").setDescription("Why it is being lifted").setRequired(true).setMaxLength(300)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("history")
        .setDescription("Every punishment on a member")
        .addUserOption((o) => o.setName("member").setDescription("Whose record").setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: "This command only works inside a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guild = interaction.guild!;
    const actor = await guild.members.fetch(interaction.user.id);
    if (!canModerate(actor)) {
      await interaction.reply({
        content: "Only **Tiers Moderators** and above can do that.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const settings = getSettings(guild.id);
    const sub = interaction.options.getSubcommand();
    const target = await guild.members
      .fetch(interaction.options.getUser("member", true).id)
      .catch(() => null);
    if (!target) {
      await interaction.reply({
        content: "That member is not in this server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "history") {
      const records = listPunishments(guild.id, target.id);
      if (!records.length) {
        await interaction.reply({
          content: `${target.user.username} has a clean punishment record.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        embeds: [
          vyntricEmbed("primary")
            .setTitle(`📋 Punishments — ${target.user.username}`)
            .setDescription(
              records
                .slice(0, 10)
                .map((r) => {
                  const type = PUNISHMENTS[r.kind as PunishmentKind];
                  const state = r.liftedAt ? "🟢 lifted" : "🔴 active";
                  return (
                    `**${type?.emoji ?? "⚠️"} ${type?.headline ?? r.kind}** — ${state}\n` +
                    `<t:${Math.floor(r.createdAt / 1000)}:d> · ` +
                    `${r.durationDays ? formatDuration(r.durationDays) : "indefinite"} · ${r.reason}\n` +
                    `by ${r.staffTag}${r.liftedBy ? ` · lifted by ${r.liftedBy}` : ""}`
                  );
                })
                .join("\n\n")
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "lift") {
      const current = latestPunishment(guild.id, target.id);
      if (!current || current.liftedAt) {
        await interaction.reply({
          content: `${target.user.username} has no active punishment to lift.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const type = PUNISHMENTS[current.kind as PunishmentKind];
      const notes: string[] = [];

      if (type?.roleName) {
        const role = guild.roles.cache.find((r) => r.name === type.roleName);
        if (role && target.roles.cache.has(role.id)) {
          if (role.comparePositionTo(guild.members.me!.roles.highest) >= 0) {
            notes.push(`⚠️ **${type.roleName}** sits above my highest role, so I could not remove it.`);
          } else {
            await target.roles.remove(role, `Punishment lifted by ${actor.user.tag}`);
            await logStaffMovement(guild.id, {
              member: target,
              actor,
              roleName: role.name,
              roleId: role.id,
              direction: "remove",
              reason: `Punishment lifted — ${current.reason}`,
            });
          }
        }
      }

      if (target.isCommunicationDisabled()) {
        const cleared = await target
          .timeout(null, `Punishment lifted by ${actor.user.tag}`)
          .then(() => true)
          .catch(() => false);
        notes.push(cleared ? "Timeout cleared." : "⚠️ I could not clear the timeout.");
      }

      const reason = interaction.options.getString("reason", true);
      liftPunishment(current.id, actor.user.tag, reason);

      await interaction.reply({
        embeds: [
          vyntricEmbed("success")
            .setTitle(`🕊️ ${target.user.username} has been cleared`)
            .setDescription(
              [
                `**${type?.headline ?? current.kind}** lifted.`,
                `**Reason:** ${reason}`,
                ...notes,
              ].join("\n")
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // give
    const kind = interaction.options.getString("type", true) as PunishmentKind;
    const definition = PUNISHMENTS[kind];
    const reason = interaction.options.getString("reason", true);
    const rawDuration = interaction.options.getString("duration")?.trim();

    let durationDays: number | null = null;
    if (rawDuration) {
      durationDays = parseDurationDays(rawDuration);
      if (durationDays === null) {
        await interaction.reply({
          content:
            `I could not read **${rawDuration}** as a duration. Try \`90d\`, \`2 weeks\`, \`36h\` or \`6 months\`, or leave it empty for indefinite.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // A blacklist is terminal, so it never carries a short duration.
    if (kind === "blacklist") durationDays = null;

    const prior = latestPunishment(guild.id, target.id);
    const repeat = Boolean(prior && !prior.liftedAt);
    const record = addPunishment({
      guildId: guild.id,
      userId: target.id,
      username: target.user.username,
      kind,
      reason,
      durationDays,
      staffId: actor.id,
      staffTag: actor.user.tag,
    });

    // Apply the role. A missing or unreachable role is reported rather than
    // silently ignored, because "it says restricted but they can still chat" is
    // exactly the failure that erodes trust in a moderation system.
    const notes: string[] = [];
    if (definition.roleName) {
      const role = guild.roles.cache.find((r) => r.name === definition.roleName);
      if (!role) {
        notes.push(`⚠️ I could not find a **${definition.roleName}** role — create it and re-run.`);
      } else if (role.comparePositionTo(guild.members.me!.roles.highest) >= 0) {
        notes.push(`⚠️ **${definition.roleName}** sits above my highest role, so I could not apply it.`);
      } else {
        await target.roles.add(role, `${definition.headline} by ${actor.user.tag}`);
        await logStaffMovement(guild.id, {
          member: target,
          actor,
          roleName: role.name,
          roleId: role.id,
          direction: "add",
          reason: `${definition.headline} — ${reason}`,
          fromPunishment: true,
        });
      }
    }

    const embed = vyntricEmbed("danger")
      .setTitle(`${definition.emoji} ${definition.headline}`)
      .setDescription(
        [
          `<@${target.id}> — \`${target.user.username}\``,
          `**${reason}**`,
          "",
          `**Duration:** ${durationDays === null ? "Indefinite" : formatDuration(durationDays)}`,
          `**Issued by:** ${actor.user.tag}`,
          repeat ? "\n⚠️ **This member already had an active punishment.**" : "",
          ...notes,
          "\n> You may appeal this in the appeals channel.",
        ]
          .filter(Boolean)
          .join("\n")
      )
      .setTimestamp()
      .setFooter({ text: `Punishment #${record.id}` });

    let posted = false;
    if (settings.punishmentsChannelId) {
      const channel = guild.channels.cache.get(settings.punishmentsChannelId);
      if (channel?.isTextBased()) {
        posted = await (channel as TextChannel).send({ embeds: [embed] })
          .then(() => true)
          .catch(() => false);
      }
    }

    await interaction.reply({
      embeds: [
        vyntricEmbed(posted ? "danger" : "warning")
          .setTitle(`${definition.emoji} ${definition.headline}`)
          .setDescription(
            [
              `**${target.user.username}** — ${reason}`,
              `**Duration:** ${durationDays === null ? "Indefinite" : formatDuration(durationDays)}`,
              ...notes,
              posted
                ? "Posted in the punishments channel."
                : "⚠️ No punishments channel set — run `/setup tier-channel feed:punishments`.",
            ].join("\n")
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
