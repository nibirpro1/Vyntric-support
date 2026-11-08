import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { section, vyntricEmbed } from "../../lib/brand";
import { IDS } from "../../lib/customIds";

interface RoleEntry {
  role: Role;
  emoji: string;
  blurb: string;
  style: ButtonStyle;
}

/** How each self-role is presented on the panel. */
const ROLE_STYLES: Array<{ match: RegExp; emoji: string; blurb: string; style: ButtonStyle }> = [
  {
    match: /smp/i,
    emoji: "⛏️",
    blurb: "Join the Vyntric SMP — survival, events and community builds.",
    style: ButtonStyle.Success,
  },
  {
    match: /uhc/i,
    emoji: "🗡️",
    blurb: "Get UHC event pings — match announcements, queues and results.",
    style: ButtonStyle.Danger,
  },
  {
    match: /event|announce/i,
    emoji: "📣",
    blurb: "Be first to know about giveaways and server events.",
    style: ButtonStyle.Primary,
  },
];

function describeRole(role: Role, index: number) {
  const preset = ROLE_STYLES[index] ?? ROLE_STYLES.find((p) => p.match.test(role.name));
  return {
    emoji: preset?.emoji ?? "🏷️",
    blurb: preset?.blurb ?? `Get pinged for everything about ${role.name}.`,
    style: preset?.style ?? ButtonStyle.Secondary,
  };
}

async function resolveRoles(interaction: ChatInputCommandInteraction): Promise<RoleEntry[]> {
  const guild = interaction.guild;
  if (!guild) return [];

  const picked = [
    ...new Map(
      ["first", "second", "third"]
        .map((name) => interaction.options.getRole(name))
        .filter((role): role is Role => Boolean(role))
        .map((role) => [role.id, role])
    ).values(),
  ];

  if (picked.length > 0) {
    return picked.map((role, index) => ({ role, ...describeRole(role, index) }));
  }

  // No roles passed: auto-discover roles named like Vyntric SMP / Vyntric UHC.
  const auto = guild.roles.cache
    .filter((role) => /smp|uhc/i.test(role.name) && !role.managed && role.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .first(3);

  return (auto ?? []).map((role, index) => ({ role, ...describeRole(role, index) }));
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("selfrole")
    .setDescription("Post the Vyntric self-role panel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((option) =>
      option.setName("first").setDescription("First self-role (default: auto-detect SMP/UHC roles)")
    )
    .addRoleOption((option) => option.setName("second").setDescription("Second self-role"))
    .addRoleOption((option) => option.setName("third").setDescription("Third self-role"))
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to post the panel in (defaults to the current channel)")
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: "This command only works inside a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const entries = await resolveRoles(interaction);
    if (entries.length === 0) {
      await interaction.reply({
        content:
          "No roles found. Create the **Vyntric SMP** and **Vyntric UHC** roles first, or pick them with the `first`/`second` options.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const target = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel | null;
    if (!target || !target.isTextBased()) {
      await interaction.reply({ content: "I cannot post the panel there.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const member = interaction.member as GuildMember;
    const memberLines = entries
      .map(({ role, emoji, blurb }) => `${emoji} ${role} — ${blurb}`)
      .join("\n");

    const embed = vyntricEmbed("primary")
      .setTitle("🏷️ Vyntric Self Roles")
      .setDescription(
        [
          section("Pick your roles"),
          memberLines,
          "",
          "> Click a button below to **grab** the role.",
          "> Click the same button again to **drop** it.",
          "",
          section("Good to know"),
          "`•` Roles are instant — no staff approval needed.",
          "`•` Keep them on to receive the right event pings.",
          "`•` Lost a role? Just press the button again.",
        ].join("\n")
      )
      .addFields({
        name: "You currently hold",
        value:
          entries
            .filter(({ role }) => member?.roles?.cache?.has(role.id))
            .map(({ role }) => role.toString())
            .join(" ") || "*None yet — pick one below!*",
      });

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < entries.length; i += 5) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...entries.slice(i, i + 5).map(({ role, emoji, style }) =>
            new ButtonBuilder()
              .setCustomId(IDS.roleButton(role.id))
              .setLabel(role.name.slice(0, 80))
              .setEmoji(emoji)
              .setStyle(style)
          )
        )
      );
    }

    const message = await target.send({ embeds: [embed], components: rows });
    await message.pin().catch(() => {});

    await interaction.editReply({
      embeds: [
        vyntricEmbed("success")
          .setTitle("✅ Self-role panel published")
          .setDescription(
            [
              `The panel is live in ${target}.`,
              `**Roles on the panel:** ${entries.map(({ role }) => role.name).join(", ")}`,
              "-# Members click a button to take the role, click again to drop it.",
            ].join("\n")
          ),
      ],
    });
  },
};

export default command;
