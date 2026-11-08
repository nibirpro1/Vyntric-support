import { ChatInputCommandInteraction, ChannelType, MessageFlags, SlashCommandBuilder, TextChannel } from "discord.js";
import { Command } from "../../structures/Command";
import { vyntricEmbed } from "../../lib/brand";
import { ARENAS } from "../../config/tiers";
import { buildArenaEmbed, buildGlobalRulesEmbed, buildRetirementEmbed } from "../../lib/rules";
import { canManageStaff } from "../../lib/permissions";

const CHOICES_MODES = ARENAS.map((a) => ({ name: `${a.emoji} ${a.label}`, value: a.slug }));

/**
 * `/rules` - the published rule text.
 *
 *   view       read any of the rule posts without posting them
 *   publish    post and pin one into a channel
 *   arenas     post the per-gamemode header into each arena's own channel
 *
 * `view` is public on purpose. A member who has to ask a tester where the rules
 * live is a member who ends up breaking one of them.
 */
const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rules")
    .setDescription("Vyntric Tiers rule posts")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Read a rule post")
        .addStringOption((o) =>
          o
            .setName("which")
            .setDescription("Which post")
            .setRequired(true)
            .addChoices(
              { name: "🌐 Global testing rules", value: "global" },
              { name: "🏳️ Retirement requirements", value: "retirement" },
              { name: "⚔️ Demotion strikes", value: "strikes" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("publish")
        .setDescription("Post and pin a rule post into a channel")
        .addStringOption((o) =>
          o
            .setName("which")
            .setDescription("Which post")
            .setRequired(true)
            .addChoices(
              { name: "🌐 Global testing rules", value: "global" },
              { name: "🏳️ Retirement requirements", value: "retirement" }
            )
        )
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Where to post it (defaults to this channel)")
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("arenas")
        .setDescription("Post the per-gamemode header into one arena channel")
        .addStringOption((o) => o.setName("gamemode").setDescription("Which arena").setRequired(true).addChoices(...CHOICES_MODES))
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Where to post it (defaults to this channel)")
            .addChannelTypes(ChannelType.GuildText)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const which = sub === "view" || sub === "publish" ? interaction.options.getString("which", true) : null;

    if (sub === "view") {
      const embed =
        which === "retirement" ? buildRetirementEmbed() : buildGlobalRulesEmbed();
      if (which === "strikes") {
        await interaction.reply({
          content: "The strike table is in `/strike rules` — it reads the same data the engine uses.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: "This command only works inside a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guild = interaction.guild!;
    const actor = await guild.members.fetch(interaction.user.id);
    if (!canManageStaff(actor)) {
      await interaction.reply({
        content: "Only the **Head of Testing** (or the server owner) can publish rule posts.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const target = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel | null;
    if (!target || !target.isTextBased()) {
      await interaction.reply({
        content: "I cannot post there — check my channel permissions.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed =
      sub === "arenas"
        ? buildArenaEmbed(interaction.options.getString("gamemode", true))
        : which === "retirement"
          ? buildRetirementEmbed()
          : buildGlobalRulesEmbed();

    const message = await target.send({ embeds: [embed] });
    await message.pin().catch(() => undefined);

    await interaction.reply({
      embeds: [
        vyntricEmbed("success")
          .setTitle("📌 Published and pinned")
          .setDescription(`**${embed.data.title}** is now live in ${target}.`),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
