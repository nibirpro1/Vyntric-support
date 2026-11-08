import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, TextChannel } from "discord.js";
import { Command } from "../../structures/Command";
import { vyntricEmbed } from "../../lib/brand";
import { ARENAS, TIER_LIST } from "../../config/tiers";
import { findPlayer, modeLabel, testName } from "../../lib/tiers";
import { canTest } from "../../lib/permissions";
import { getSettings } from "../../lib/store";
import { checkPing, PING_TOLERANCE_MS } from "../../config/servers";

const CHOICES_MODES = ARENAS.map((a) => ({ name: `${a.emoji} ${a.label}`, value: a.slug }));
const CHOICES_TIERS = TIER_LIST.map((t) => ({ name: t, value: t }));

/** `HT3` and `LT2` -> `HT3 / LT2`. Rung labels are validated by Discord choices. */
function rungLabel(tier: string) {
  return tier.toUpperCase();
}

/**
 * `/hightest` - the high-tier testing feed.
 *
 *   open     post a test request into `high-tests`, with prediction reactions
 *   result   post the outcome into `high-results` and update the ladder
 *
 * Split in two on purpose: the request channel is where people gather to watch,
 * and the result channel is the permanent record. A single combined channel
 * buries results under requests within a week.
 */
const command: Command = {
  data: new SlashCommandBuilder()
    .setName("hightest")
    .setDescription("Vyntric Tiers high-tier test system")
    .addSubcommand((sub) =>
      sub
        .setName("open")
        .setDescription("Open a high-tier test request")
        .addStringOption((o) =>
          o.setName("challenger").setDescription("Player being tested").setRequired(true).setMaxLength(32)
        )
        .addStringOption((o) =>
          o.setName("opponent").setDescription("Who they are fighting").setRequired(true).setMaxLength(32)
        )
        .addStringOption((o) =>
          o.setName("gamemode").setDescription("Arena").setRequired(true).addChoices(...CHOICES_MODES)
        )
        .addStringOption((o) =>
          o.setName("tier").setDescription("Rung being contested").setRequired(true).addChoices(...CHOICES_TIERS)
        )
        .addStringOption((o) =>
          o.setName("server").setDescription("Testing host (must be on the verified list)").setMaxLength(60)
        )
        .addIntegerOption((o) =>
          o.setName("challenger-ping").setDescription("Challenger ping in ms").setMinValue(0).setMaxValue(999)
        )
        .addIntegerOption((o) =>
          o.setName("opponent-ping").setDescription("Opponent ping in ms").setMinValue(0).setMaxValue(999)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("result")
        .setDescription("Post a high-tier test outcome")
        .addStringOption((o) =>
          o.setName("player").setDescription("Player the result is for").setRequired(true).setMaxLength(32)
        )
        .addStringOption((o) =>
          o.setName("opponent").setDescription("Who they fought").setRequired(true).setMaxLength(32)
        )
        .addStringOption((o) =>
          o.setName("gamemode").setDescription("Arena").setRequired(true).addChoices(...CHOICES_MODES)
        )
        .addStringOption((o) =>
          o
            .setName("outcome")
            .setDescription("What happened")
            .setRequired(true)
            .addChoices(
              { name: "✅ Passed", value: "pass" },
              { name: "❌ Failed", value: "fail" },
              { name: "🔁 Forfeited", value: "forfeit" }
            )
        )
        .addStringOption((o) =>
          o.setName("score").setDescription('e.g. "4-2"').setRequired(true).setMaxLength(20)
        )
        .addStringOption((o) =>
          o
            .setName("tier")
            .setDescription("New rung if they passed (skip on fail/forfeit)")
            .addChoices(...CHOICES_TIERS)
        )
        .addStringOption((o) =>
          o
            .setName("note")
            .setDescription("Extra line, e.g. 'Bridging to LT2'")
            .setMaxLength(200)
        )
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
    if (!canTest(actor)) {
      await interaction.reply({
        content: "Only **Tiers Testers** and staff can do that.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const settings = getSettings(guild.id);
    const sub = interaction.options.getSubcommand();
    const challenger = interaction.options.getString("challenger", true).trim();
    const opponent = interaction.options.getString("opponent", true).trim();
    const gamemode = interaction.options.getString("gamemode", true);
    const arena = ARENAS.find((a) => a.slug === gamemode)!;

    if (sub === "open") {
      const tier = rungLabel(interaction.options.getString("tier", true));
      const server = interaction.options.getString("server")?.trim();
      const pingA = interaction.options.getInteger("challenger-ping");
      const pingB = interaction.options.getInteger("opponent-ping");

      const lines = [
        `**${challenger}** vs **${opponent}**`,
        `**${modeLabel(gamemode)}** · ${rungLabel(tier)} · ${arena.testName} kit`,
      ];
      if (server) lines.push(`**Server:** \`${server}\``);

      let pingNote = "";
      if (pingA !== null && pingB !== null) {
        const check = checkPing(pingA, pingB);
        pingNote = check.fair
          ? `\n**Ping:** ${pingA}ms vs ${pingB}ms — within ${PING_TOLERANCE_MS}ms ✅`
          : `\n**Ping:** ${pingA}ms vs ${pingB}ms — ${check.gap}ms apart, **over the ${PING_TOLERANCE_MS}ms limit** ⚠️`;
        if (check.spoofRequired) {
          pingNote += `\n> The lower-ping player should spoof into ${check.range.low}-${check.range.high}ms rather than forfeiting.`;
        }
      }

      const embed = vyntricEmbed("primary")
        .setTitle(`${arena.emoji} ${rungLabel(tier)} Test — ${challenger}`)
        .setDescription(
          [
            lines.join("\n"),
            pingNote,
            "",
            "**Winner prediction**",
            "`1️⃣` " + challenger,
            "`2️⃣` " + opponent,
          ]
            .filter(Boolean)
            .join("\n")
        )
        .setTimestamp()
        .setFooter({ text: `${testName(gamemode)} · opened by ${actor.user.tag}` });

      let posted = false;
      if (settings.highTestsChannelId) {
        const channel = guild.channels.cache.get(settings.highTestsChannelId);
        if (channel?.isTextBased()) {
          const message = await (channel as TextChannel).send({ embeds: [embed] });
          // Prediction reactions, matching the existing feed's shape.
          await message.react("1️⃣").catch(() => undefined);
          await message.react("2️⃣").catch(() => undefined);
          posted = true;
        }
      }

      await interaction.reply({
        embeds: [
          vyntricEmbed(posted ? "success" : "warning")
            .setTitle(posted ? "✅ Test opened" : "⚠️ Test not posted")
            .setDescription(
              posted
                ? `**${challenger}** vs **${opponent}** — ${rungLabel(tier)} ${modeLabel(gamemode)} is live.`
                : "No high-tests channel set. Run `/setup tier-channel high-tests channel:#high-tests`."
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // result
    const player = interaction.options.getString("player", true).trim();
    const outcome = interaction.options.getString("outcome", true);
    const score = interaction.options.getString("score", true).trim();
    const newTier = interaction.options.getString("tier");
    const note = interaction.options.getString("note")?.trim();
    // The ladder already knows the region; the post should not guess it.
    const region = findPlayer(player)?.region;

    // A "pass" with no tier would leave the ladder claiming a pass with nothing
    // awarded, so it is rejected rather than quietly posted.
    if (outcome === "pass" && !newTier) {
      await interaction.reply({
        content: "A pass needs a tier. Add the `tier` option, or use `❌ Failed`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const verb = outcome === "pass" ? "Passed" : outcome === "fail" ? "Failed" : "Forfeited";
    const tone = outcome === "pass" ? "success" : "danger";
    const icon = outcome === "pass" ? "✅" : outcome === "fail" ? "❌" : "🔁";

    const embed = vyntricEmbed(tone as any)
      .setTitle(`${icon} ${player} — ${verb} ${rungLabel(newTier ?? interaction.options.getString("tier") ?? "")} ${arena.testName.toUpperCase()}`)
      .setDescription(
        [
          `**${arena.emoji} ${modeLabel(gamemode)}** · ${player} vs ${opponent}`,
          `**Score:** ${score}`,
          note ? `\n**${note}**` : "",
          "",
          `Logged by ${actor.user.tag}`,
        ]
          .filter(Boolean)
          .join("\n")
      )
      .setTimestamp()
      .setFooter({ text: `${testName(gamemode)} · ${region ?? "region unset"}` });

    let posted = false;
    if (settings.highResultsChannelId) {
      const channel = guild.channels.cache.get(settings.highResultsChannelId);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send({ embeds: [embed] });
        posted = true;
      }
    }

    await interaction.reply({
      embeds: [
        vyntricEmbed(posted ? "success" : "warning")
          .setTitle(posted ? "✅ Result posted" : "⚠️ Result not posted")
          .setDescription(
            posted
              ? `**${player}** ${verb.toLowerCase()} — see the high-results channel.`
              : "No high-results channel set. Run `/setup tier-channel high-results channel:#high-results`."
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};


export default command;

