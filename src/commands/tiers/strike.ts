import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, TextChannel, EmbedBuilder } from "discord.js";
import { Command } from "../../structures/Command";
import { vyntricEmbed } from "../../lib/brand";
import { ARENAS, DEMOTION_THRESHOLD } from "../../config/tiers";
import {
  BAND_RULES,
  EXTREME_LOSS_RATIO,
  FORFEIT_PASS_STRIKES,
  isExtremeLoss,
  isSignificantLoss,
  scoreRatio,
  shouldDemote,
  strikeBar,
  strikesForFight,
  totalStrikes,
} from "../../lib/strikes";
import { addStrike, getSettings, listStrikes, strikeBalance, strikeTotals } from "../../lib/store";
import { canTest, isHardStaff } from "../../lib/permissions";
import { applyTier, demoteTier, findPlayer, modeLabel, testName } from "../../lib/tiers";

const CHOICES_MODES = ARENAS.map((a) => ({ name: `${a.emoji} ${a.label}`, value: a.slug }));

/**
 * `/strike` - the demotion strike system.
 *
 *   rules    the published strike table, so it can be read without scrolling
 *   view     one player's strikes, per gamemode
 *   log      a manual add or removal, with a reason
 *   fight    the interesting one: score a real fight and let the rules decide
 *   history  the full append-only ledger for a player
 *
 * `fight` is the only path that is allowed to move a ranking on its own. A
 * manual `log` writes to the ledger but never demotes, so a typo in a reason
 * cannot cost somebody a rung.
 */
const command: Command = {
  data: new SlashCommandBuilder()
    .setName("strike")
    .setDescription("Vyntric Tiers demotion strikes")
    .addSubcommand((sub) => sub.setName("rules").setDescription("Show the published strike rules"))
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("A player's current strikes")
        .addStringOption((o) => o.setName("player").setDescription("Minecraft username").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("log")
        .setDescription("Add or remove a strike by hand")
        .addStringOption((o) => o.setName("player").setDescription("Minecraft username").setRequired(true).setMaxLength(32))
        .addStringOption((o) => o.setName("gamemode").setDescription("Arena").setRequired(true).addChoices(...CHOICES_MODES))
        .addIntegerOption((o) =>
          o.setName("amount").setDescription("Positive adds, negative removes").setRequired(true).setMinValue(-3).setMaxValue(3)
        )
        .addStringOption((o) => o.setName("reason").setDescription("Why").setRequired(true).setMaxLength(300))
    )
    .addSubcommand((sub) =>
      sub
        .setName("fight")
        .setDescription("Score a completed fight and apply the published rules")
        .addStringOption((o) => o.setName("player").setDescription("The tested player").setRequired(true).setMaxLength(32))
        .addStringOption((o) => o.setName("opponent").setDescription("Who they fought").setRequired(true).setMaxLength(32))
        .addStringOption((o) => o.setName("gamemode").setDescription("Arena").setRequired(true).addChoices(...CHOICES_MODES))
        .addIntegerOption((o) => o.setName("won").setDescription("Rounds the tested player scored").setRequired(true).setMinValue(0).setMaxValue(99))
        .addIntegerOption((o) => o.setName("lost").setDescription("Rounds the opponent scored").setRequired(true).setMinValue(0).setMaxValue(99))
        .addBooleanOption((o) => o.setName("opponent-tier").setDescription("Opponent held the same tier before the fight"))
        .addBooleanOption((o) => o.setName("opponent-passed").setDescription("This result passed the opponent"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("history")
        .setDescription("Every strike ever logged against a player")
        .addStringOption((o) => o.setName("player").setDescription("Minecraft username").setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "rules") {
      await interaction.reply({
        embeds: [buildRulesEmbed()],
        flags: MessageFlags.Ephemeral,
      });
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
    if (!canTest(actor)) {
      await interaction.reply({
        content: "Only **Tiers Testers** and staff can do that.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const settings = getSettings(guild.id);
    const player = interaction.options.getString("player", true).trim();

    if (sub === "view") {
      const totals = strikeTotals(guild.id, player);
      const entries = Object.entries(totals);
      if (!entries.length) {
        await interaction.reply({
          content: `${player} has no strikes on the ledger.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        embeds: [
          vyntricEmbed("primary")
            .setTitle(`⚔️ Strikes — ${player}`)
            .setDescription(
              entries
                .map(([mode, count]) => {
                  const arena = ARENAS.find((a) => a.slug === mode);
                  return `${arena?.emoji ?? "•"} **${modeLabel(mode)}** — ${strikeBar(count)} (${count}/${DEMOTION_THRESHOLD})`;
                })
                .join("\n")
            )
            .setFooter({ text: `${DEMOTION_THRESHOLD} strikes = demotion` }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "history") {
      const records = listStrikes(guild.id, player);
      if (!records.length) {
        await interaction.reply({
          content: `No strike history for ${player}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        embeds: [
          vyntricEmbed("primary")
            .setTitle(`📜 Strike history — ${player}`)
            .setDescription(
              records
                .slice(0, 15)
                .map(
                  (r) =>
                    `<t:${Math.floor(r.createdAt / 1000)}:d> **${r.delta > 0 ? "+" : ""}${r.delta}** ` +
                    `in ${modeLabel(r.gamemode)} → **${r.balance}**\n${r.reason} _({r.staffTag})_`
                )
                .join("\n\n")
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "log") {
      const gamemode = interaction.options.getString("gamemode", true);
      const amount = interaction.options.getInteger("amount", true);
      const reason = interaction.options.getString("reason", true);
      const record = addStrike({
        guildId: guild.id,
        player,
        gamemode,
        delta: amount,
        reason,
        staffId: actor.id,
        staffTag: actor.user.tag,
      });

      await interaction.reply({
        embeds: [
          vyntricEmbed(amount > 0 ? "warning" : "success")
            .setTitle(`⚔️ Strike ${amount > 0 ? "added" : "removed"} — ${player}`)
            .setDescription(
              [
                `**${modeLabel(gamemode)}** — ${strikeBar(record.balance)} (**${record.balance}**/${DEMOTION_THRESHOLD})`,
                `**Reason:** ${reason}`,
                "",
                "> A manual log never moves the ranking on its own. Use `/strike fight` for that.",
                shouldDemote(record.balance)
                  ? `\n⚠️ They are at the demotion threshold — run \`/tier set\` to apply the drop, or use \`/strike fight\`.`
                  : "",
              ]
                .filter(Boolean)
                .join("\n")
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // fight
    const opponent = interaction.options.getString("opponent", true).trim();
    const gamemode = interaction.options.getString("gamemode", true);
    const won = interaction.options.getInteger("won", true);
    const lost = interaction.options.getInteger("lost", true);
    const opponentPassed = interaction.options.getBoolean("opponent-passed") ?? false;
    const sameTier = interaction.options.getBoolean("opponent-tier") ?? false;
    const arena = ARENAS.find((a) => a.slug === gamemode)!;
    const band = arena.strikeBand;

    if (band === null) {
      await interaction.reply({
        content: `**${modeLabel(gamemode)}** has no published demotion rules, so fights there cannot cost strikes.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const view = findPlayer(player);
    const currentTier = view?.rankings.find((r) => r.slug === gamemode)?.label ?? null;
    if (!currentTier) {
      await interaction.reply({
        content: `${player} holds no **${modeLabel(gamemode)}** ranking yet — there is nothing to defend.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const currentBand = Number(/^(?:HT|LT)(\d)$/i.exec(currentTier)?.[1] ?? 0);
    const window = arena.significant[String(band)];
    const significant = isSignificantLoss(window, lost);
    const extreme = isExtremeLoss(lost, won);
    const vsLowerTier = !won && !sameTier;

    const outcomes = strikesForFight({
      band,
      won: won > lost,
      sameTier,
      vsLowerTier,
      significant,
      extreme,
      opponentPassed: opponentPassed && won < lost,
    });
    const delta = totalStrikes(outcomes);

    if (delta !== 0) {
      addStrike({
        guildId: guild.id,
        player,
        gamemode,
        delta,
        reason: `${won}-${lost} vs ${opponent} — ${outcomes.map((o) => o.reason).join("; ")}`,
        staffId: actor.id,
        staffTag: actor.user.tag,
      });
    }

    const balance = strikeBalance(guild.id, player, gamemode);
    const ratio = scoreRatio(lost, won);
    let demotionNote = "";
    let demoted = false;

    // Extreme loss is an instant demotion regardless of the strike count, and
    // three accumulated strikes demote by one rung. Both go through /tier's
    // write path so the website data file and the result post stay in step.
    if (extreme || shouldDemote(balance)) {
      const next = demoteTier(currentTier);
      if (next) {
        const result = applyTier({
          username: player,
          gamemode,
          tier: next,
          region: view?.region ?? "NA",
          tester: actor.user.username,
        });
        demoted = true;
        demotionNote =
          `\n**⬇️ Demoted: ${currentTier} → ${next}**` +
          (extreme ? " (extreme loss)" : ` (${DEMOTION_THRESHOLD} strikes)`) +
          `\nBalance reset to 0 after demotion.`;

        if (settings.resultsChannelId) {
          const channel = guild.channels.cache.get(settings.resultsChannelId!);
          if (channel?.isTextBased()) {
            await (channel as TextChannel).send({
              embeds: [
                vyntricEmbed("warning")
                  .setTitle(`⬇️ Demoted — ${player}`)
                  .setDescription(
                    [
                      `**${arena.emoji} ${modeLabel(gamemode)}** — ${currentTier} → **${next}**`,
                      `**Reason:** ${extreme ? "Extreme loss" : `${DEMOTION_THRESHOLD} strikes`}`,
                      `**Fight:** ${won}-${lost} vs ${opponent}`,
                    ].join("\n")
                  )
                  .setTimestamp(),
              ],
            }).catch(() => undefined);
          }
        }
        // Clear the ledger so the next run starts from zero.
        if (balance > 0) {
          addStrike({
            guildId: guild.id,
            player,
            gamemode,
            delta: -balance,
            reason: `Reset after demotion ${currentTier} → ${next}`,
            staffId: actor.id,
            staffTag: actor.user.tag,
          });
        }
        void result;
      }
    }

    const embed = vyntricEmbed(demoted ? "danger" : delta > 0 ? "warning" : "success")
      .setTitle(`⚔️ ${player} — ${modeLabel(gamemode)}`)
      .setDescription(
        [
          `**${won} - ${lost}** vs **${opponent}** (${testName(gamemode)} kit)`,
          `Held **${currentTier}** (band ${currentBand})`,
          "",
          ...outcomes.map((o) => `• ${o.reason}`),
          delta === 0 && !extreme ? "• No strike change." : "",
          "",
          `**Balance:** ${strikeBar(demoted ? 0 : balance)} (**${demoted ? 0 : balance}**/${DEMOTION_THRESHOLD})`,
          ratio !== null ? `**Score ratio:** ${ratio.toFixed(2)}${extreme ? " ⚠️ extreme" : ""}` : "",
          demotionNote,
        ]
          .filter(Boolean)
          .join("\n")
      )
      .setFooter({ text: `band ${band} rules · logged by ${actor.user.tag}` });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};


/** The published table, rendered from the same data the engine uses. */
function buildRulesEmbed(): EmbedBuilder {
  const embed = vyntricEmbed("primary").setTitle("⚔️ Tier Demotion Strikes");
  const rules = BAND_RULES;

  embed.setDescription(
    [
      `**${DEMOTION_THRESHOLD} strikes = demotion** (one rung).`,
      "",
      `**🔻 LT1 / HT1**`,
      `> ${rules[1].lossSameTier} loss = 1 strike.`,
      `> Significant loss = 2 strikes.`,
      `> Loss vs lower tier = ${rules[1].lossLowerTier} strikes.`,
      `> Dodging a fight = ${rules[1].dodge} strikes.`,
      "",
      `**🔻 LT2 / HT2**`,
      `> Loss vs same tier = 1 strike.`,
      `> Significant loss vs same tier = 2 strikes.`,
      `> Loss vs lower tier = ${rules[2].lossLowerTier} strikes.`,
      `> Dodging = ${rules[2].dodge} strike.`,
      "",
      `**🔻 HT3**`,
      `> Loss vs same tier = 1 strike.`,
      `> Significant loss vs same tier = 2 strikes.`,
      `> Loss vs lower tier = ${rules[3].lossLowerTier} strikes.`,
      "",
      `**✅ Strike removal**`,
      `> Win vs a same-tier player = −1 strike.`,
      `> Losing your own test still counts as a loss.`,
      `> Winning but your opponent still passes = no removal.`,
      "",
      `**⚠️ Notable**`,
      `> A forfeit that passes the opponent = ${FORFEIT_PASS_STRIKES} strikes at any tier.`,
      `> An extreme loss (ratio ≤ ${EXTREME_LOSS_RATIO}) is an instant demotion.`,
    ].join("\n")
  );

  const windows = ARENAS.filter((a) => a.strikeBand !== null)
    .map((a) => {
      const w = a.significant[String(a.strikeBand)];
      return `**${a.emoji} ${a.testName}** — ${w?.label ?? "—"}`;
    })
    .join("\n");
  embed.addFields({ name: "Significant loss scores", value: windows, inline: false });
  return embed;
}

export default command;

