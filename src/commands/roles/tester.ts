import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { vyntricEmbed } from "../../lib/brand";
import { STAFF_ROLES } from "../../config/staff";
import {
  canGrantRole,
  canManageStaff,
  describePermissions,
  ensureStaffRole,
  isHardStaff,
  registerRole,
  roleIdsFor,
} from "../../lib/permissions";
import { logStaffMovement } from "../../lib/staffLog";

const CHOICES = STAFF_ROLES.map((role) => ({ name: `${role.emoji} ${role.name}`, value: role.key }));

/** Every member holding a registered role for `key`, as readable mentions. */
async function roster(guild: any, key: string): Promise<string> {
  const ids = roleIdsFor(guild.id, key);
  if (!ids.length) return "_No role registered yet - run `/tester setup`._";

  const members = await guild.members.fetch({ role: ids[0] }).catch(() => null);
  if (!members || members.size === 0) return "_Nobody holds it right now._";

  return [...members.values()]
    .slice(0, 25)
    .map((m: GuildMember) => `<@${m.id}>`)
    .join(" ");
}

/**
 * `/tester` - the Tiers Tester role system.
 *
 *   setup    create all four staff roles with their exact permission bitfields
 *   roles    every role, its rank, its live permission list and its roster
 *   give     hand a role to a member
 *   take     take a role back
 *
 * The roles are created by the bot rather than by hand so the bitfield is
 * guaranteed to match config/staff.ts. Correcting a permission later is a
 * one-line change there, not a manual re-click in the Discord UI.
 */
const command: Command = {
  data: new SlashCommandBuilder()
    .setName("tester")
    .setDescription("Manage the Vyntric Tiers tester and staff roles")
    .addSubcommand((sub) =>
      sub.setName("setup").setDescription("Create every Vyntric staff role with the right permissions")
    )
    .addSubcommand((sub) =>
      sub.setName("roles").setDescription("Show every staff role, its permissions and who holds it")
    )
    .addSubcommand((sub) =>
      sub
        .setName("give")
        .setDescription("Give a staff role to a member")
        .addUserOption((o) => o.setName("member").setDescription("Who to promote").setRequired(true))
        .addStringOption((o) =>
          o.setName("role").setDescription("Which role").setRequired(true).addChoices(...CHOICES)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("take")
        .setDescription("Take a staff role from a member")
        .addUserOption((o) => o.setName("member").setDescription("Who to demote").setRequired(true))
        .addStringOption((o) =>
          o.setName("role").setDescription("Which role").setRequired(true).addChoices(...CHOICES)
        )
        .addStringOption((o) =>
          o.setName("reason").setDescription("Shown in the staff-movements log").setMaxLength(200)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: "This command only works inside a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guild = interaction.guild!;
    const actor = await guild.members.fetch(interaction.user.id);
    const isHead = isHardStaff(actor) || canManageStaff(actor);

    // Reading the hierarchy is public: anyone can see who runs the ladder.
    if (sub === "roles") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const fields = [];
      for (const role of STAFF_ROLES) {
        const ids = roleIdsFor(guild.id, role.key);
        const live = ids.length ? describePermissions(ids[0], guild) : "_Not created yet._";
        fields.push({
          name: `${role.emoji} ${role.name}${ids.length ? "" : " — not created"}`,
          value: [
            `**Rank ${role.rank}** · ${role.blurb}`,
            `**Channels:** ${role.channels.map((c) => `\`#${c}\``).join(", ")}`,
            `**Can:** ${live}`,
            `**Holds:** ${await roster(guild, role.key)}`,
          ].join("\n"),
          inline: false,
        });
      }
      await interaction.editReply({
        embeds: [
          vyntricEmbed("primary")
            .setTitle("🛡️ Vyntric Tiers staff roles")
            .setDescription(
              [
                "Four roles, strictly ranked. **You can only grant a role below your own.**",
                "",
                "No Vyntric role carries `Administrator` or `Manage Server` — those stay with the owner.",
                "",
                "> Run `/tester setup` to create any that are missing.",
              ].join("\n")
            )
            .addFields(fields)
            .setFooter({ text: "Bot must sit above these roles to grant them." }),
        ],
      });
      return;
    }

    if (!isHead) {
      await interaction.reply({
        content: "Only the **Head of Testing** (or the server owner) can do that.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "setup") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const bot = await guild.members.me?.fetch();
      if (!bot) throw new Error("Could not resolve my own member object");

      const lines: string[] = [];
      for (const role of STAFF_ROLES) {
        const { role: created, created: isNew } = await ensureStaffRole(guild, role.key, bot);
        registerRole(guild.id, role.key, created.id);
        const positionOk = created.comparePositionTo(bot.roles.highest) < 0;
        lines.push(
          `${isNew ? "🆕 Created" : "✔ Exists  "} **${created.name}** (<@&${created.id}>)` +
            (positionOk ? "" : " ⚠️ *above me — drag it down*")
        );
      }

      await interaction.editReply({
        embeds: [
          vyntricEmbed("success")
            .setTitle("✅ Vyntric staff roles ready")
            .setDescription(lines.join("\n"))
            .addFields({
              name: "Next steps",
              value:
                "1. In **Server Settings → Roles**, drag each Vyntric role **below my highest role**.\n" +
                "2. Open each staff channel and allow the tester role to **View** and **Send**.\n" +
                "3. Run `/tester give member:@someone role:Tiers Tester`.",
            }),
        ],
      });
      return;
    }

    // give / take
    const bot = await guild.members.me?.fetch();
    if (!bot) throw new Error("Could not resolve my own member object");

    const key = interaction.options.getString("role", true);
    const definition = STAFF_ROLES.find((r) => r.key === key)!;
    const grant = canGrantRole(actor, key, bot);
    if (!grant.ok) {
      await interaction.reply({ content: grant.reason, flags: MessageFlags.Ephemeral });
      return;
    }

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

    const { role } = await ensureStaffRole(guild, key, bot);
    registerRole(guild.id, key, role.id);
    const holds = target.roles.cache.has(role.id);

    if (sub === "give") {
      if (holds) {
        await interaction.reply({
          content: `${target.user.username} already holds ${role}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await target.roles.add(role, `Promoted by ${actor.user.tag}`);
      await logStaffMovement(guild.id, {
        member: target,
        actor,
        roleName: role.name,
        roleId: role.id,
        direction: "add",
        reason: null,
      });
      await interaction.reply({
        embeds: [
          vyntricEmbed("success")
            .setTitle(`✅ ${target.user.username} is now a ${definition.name}`)
            .setDescription(
              [
                definition.blurb,
                "",
                `**What they can do:** ${describePermissions(role.id, guild)}`,
                "",
                "> Channel access still has to be allowed in each staff channel.",
              ].join("\n")
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const reason = interaction.options.getString("reason")?.trim() || null;
    if (!holds) {
      await interaction.reply({
        content: `${target.user.username} does not hold ${role}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await target.roles.remove(role, `Demoted by ${actor.user.tag}`);
    await logStaffMovement(guild.id, {
      member: target,
      actor,
      roleName: role.name,
      roleId: role.id,
      direction: "remove",
      reason,
    });
    await interaction.reply({
      embeds: [
        vyntricEmbed("warning")
          .setTitle(`➖ ${target.user.username} is no longer a ${definition.name}`)
          .setDescription(reason ? `**Reason:** ${reason}` : "No reason given."),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
