/**
 * `/tier` — the full Vyntric Tiers command surface.
 *
 * One umbrella command carries the whole ladder so the server does not fill up
 * with a dozen near-identical slash commands. Every subcommand that writes
 * requires a tester or staff role; every subcommand that reads is public.
 *
 *   public   profile · top · leaderboard · ranks · ladder · modes · search
 *            tests · stats · help
 *   staff    set · remove · retire · region
 *
 * `/settier` still exists and still works — it is the same write path, kept so
 * muscle memory and older links do not break.
 */
import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { vyntricEmbed } from "../../lib/brand";
import { isTicketStaff } from "../../lib/permissions";
import {
  REGION_NAMES,
  TIER_FULL,
  TIER_LIST,
  TIER_MODES,
  TIER_POINTS,
  TIER_REGIONS,
  applyTier,
  buildTierResultEmbed,
  findPlayer,
  leaderboard,
  modeCounts,
  modeLabel,
  playerTests,
  recentTests,
  removeTier,
  resolveRegion,
  retirePlayer,
  searchPlayers,
  setRegion,
  splitIndex,
  topOfMode,
} from "../../lib/tiers";
import { getSettings } from "../../lib/store";

const CHOICES_MODES = TIER_MODES.map(([value, name]) => ({ name, value }));
const CHOICES_TIERS = TIER_LIST.map((value) => ({ name: `${value} - ${TIER_FULL[value]}`, value }));
const CHOICES_REGIONS = TIER_REGIONS.map((value) => ({ name: value, value }));

const WEBSITE = "https://vyntric.net";

/** `HT1`..`LT5`, best first — the ladder every subcommand speaks in. */
const LADDER_ROWS = TIER_LIST.map((v) => {
  const { tier, pos } = splitIndex(TIER_LIST.indexOf(v) as number);
  return `${TIER_POINTS[`${tier}-${pos}`] ?? 0}`.padStart(3, " ") + ` pts  ·  ${TIER_FULL[v]}`;
}).join("\n");

const HELP_LINES = [
  "**Anyone can run these**",
  "`/tier profile` — a player's full ladder card",
  "`/tier top` — best players in one arena",
  "`/tier leaderboard` — the overall ladder",
  "`/tier ranks` — where a player sits in one arena",
  "`/tier ladder` — every rung and its points",
  "`/tier modes` — every arena and its player count",
  "`/tier search` — find someone by name",
  "`/tier tests` — recent test history",
  "`/tier stats` — ladder-wide numbers",
  "",
  "**Testers and staff only**",
  "`/tier set` — award a tier and post the result",
  "`/tier remove` — drop a ranking, or a whole player",
  "`/tier retire` — retire a player from one arena",
  "`/tier region` — move a player to another region",
].join("\n");

function head(name: string) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/96`;
}

/** Staff check shared by every writing subcommand. */
async function requireStaff(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: "This command only works inside a server.", flags: MessageFlags.Ephemeral });
    return false;
  }
  const member = interaction.guild!.members.cache.get(interaction.user.id) as GuildMember | undefined;
  if (!member || !isTicketStaff(member)) {
    await interaction.reply({ content: "Only tier testers and staff can do that.", flags: MessageFlags.Ephemeral });
    return false;
  }
  return true;
}

function fail(interaction: ChatInputCommandInteraction, err: unknown): void {
  const message = err instanceof Error ? err.message : "Something went wrong.";
  interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => undefined);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("tier")
    .setDescription("Everything on the Vyntric Tiers ladder")
    .addSubcommand((sub) =>
      sub
        .setName("profile")
        .setDescription("Show a player's full ladder card")
        .addStringOption((o) => o.setName("player").setDescription("Minecraft username").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("top")
        .setDescription("Show the highest ranked players in one gamemode")
        .addStringOption((o) =>
          o.setName("gamemode").setDescription("Which arena").setRequired(true).addChoices(...CHOICES_MODES)
        )
        .addIntegerOption((o) => o.setName("limit").setDescription("How many (1-25)").setMinValue(1).setMaxValue(25))
    )
    .addSubcommand((sub) =>
      sub
        .setName("leaderboard")
        .setDescription("Show the overall ladder")
        .addStringOption((o) => o.setName("region").setDescription("Filter by region").addChoices(...CHOICES_REGIONS))
        .addIntegerOption((o) => o.setName("limit").setDescription("How many (1-25)").setMinValue(1).setMaxValue(25))
    )
    .addSubcommand((sub) =>
      sub
        .setName("ranks")
        .setDescription("Where does a player sit inside one gamemode")
        .addStringOption((o) => o.setName("player").setDescription("Minecraft username").setRequired(true))
        .addStringOption((o) =>
          o.setName("gamemode").setDescription("Which arena").setRequired(true).addChoices(...CHOICES_MODES)
        )
    )
    .addSubcommand((sub) => sub.setName("ladder").setDescription("Every rung and what it is worth"))
    .addSubcommand((sub) => sub.setName("modes").setDescription("Every arena and how many are ranked in it"))
    .addSubcommand((sub) =>
      sub
        .setName("search")
        .setDescription("Find a player by name")
        .addStringOption((o) => o.setName("query").setDescription("Part of a username").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("tests")
        .setDescription("Recent test history for a player, or across the server")
        .addStringOption((o) => o.setName("player").setDescription("Minecraft username"))
    )
    .addSubcommand((sub) => sub.setName("stats").setDescription("Ladder-wide statistics"))
    .addSubcommand((sub) => sub.setName("help").setDescription("What every /tier subcommand does"))
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set a player's tier and post the result")
        .addStringOption((o) =>
          o.setName("player").setDescription("Minecraft username").setRequired(true).setMaxLength(32)
        )
        .addStringOption((o) =>
          o.setName("gamemode").setDescription("Gamemode that was tested").setRequired(true).addChoices(...CHOICES_MODES)
        )
        .addStringOption((o) =>
          o.setName("tier").setDescription("Tier earned").setRequired(true).addChoices(...CHOICES_TIERS)
        )
        .addStringOption((o) =>
          o.setName("region").setDescription("Player region - auto-detected from Discord locale when omitted").addChoices(...CHOICES_REGIONS)
        )
        .addUserOption((o) => o.setName("tester").setDescription("Tester (defaults to you)"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a ranking, or a whole player")
        .addStringOption((o) =>
          o.setName("player").setDescription("Minecraft username").setRequired(true).setMaxLength(32)
        )
        .addStringOption((o) => o.setName("gamemode").setDescription("Only remove this arena").addChoices(...CHOICES_MODES))
    )
    .addSubcommand((sub) =>
      sub
        .setName("retire")
        .setDescription("Retire a player from one arena, freezing their peak")
        .addStringOption((o) =>
          o.setName("player").setDescription("Minecraft username").setRequired(true).setMaxLength(32)
        )
        .addStringOption((o) =>
          o.setName("gamemode").setDescription("Which arena").setRequired(true).addChoices(...CHOICES_MODES)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("region")
        .setDescription("Move a player to another region")
        .addStringOption((o) =>
          o.setName("player").setDescription("Minecraft username").setRequired(true).setMaxLength(32)
        )
        .addStringOption((o) =>
          o.setName("region").setDescription("New region").setRequired(true).addChoices(...CHOICES_REGIONS)
        )
    ) as any,

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    if (!sub) return;

    /* ------------------------------------------------------- static pages */
    if (sub === "help") {
      await interaction.reply({
        embeds: [
          vyntricEmbed("accent")
            .setTitle("🏆 Vyntric Tiers — commands")
            .setDescription(HELP_LINES)
            .setURL(WEBSITE),
        ],
      });
      return;
    }

    if (sub === "ladder") {
      await interaction.reply({
        embeds: [
          vyntricEmbed("accent")
            .setTitle("📐 The Vyntric ladder")
            .setDescription(
              "Ten rungs per arena. **1 is the best**, 5 the lowest, and every rung has a High " +
                "and a Low half:\n\n```\n" + LADDER_ROWS + "\n```\n" +
                "A player's overall points are the sum of every arena they are ranked in."
            ),
        ],
      });
      return;
    }

    if (sub === "modes") {
      const counts = modeCounts();
      const board = leaderboard();
      await interaction.reply({
        embeds: [
          vyntricEmbed("accent")
            .setTitle("🎯 Every arena")
            .setDescription(
              TIER_MODES.map(([key, label]) => {
                const hi = board.filter((p) => p.rankings.some((r) => r.slug === key && r.pos === 0)).length;
                return `**${label}** — ${counts[key] ?? 0} ranked · ${hi} in a High tier`;
              }).join("\n")
            )
            .setURL(WEBSITE),
        ],
      });
      return;
    }

    if (sub === "stats") {
      const board = leaderboard();
      const counts = modeCounts();
      const ranked = board.reduce((a, p) => a + p.rankings.length, 0);
      const busiest = TIER_MODES.map(([k, l]) => ({ l, n: counts[k] ?? 0 })).sort((a, b) => b.n - a.n)[0];
      await interaction.reply({
        embeds: [
          vyntricEmbed("accent")
            .setTitle("📊 Ladder statistics")
            .addFields(
              { name: "Ranked players", value: `${board.length}`, inline: true },
              { name: "Rankings held", value: `${ranked}`, inline: true },
              { name: "Arenas", value: `${TIER_MODES.length}`, inline: true },
              {
                name: "Top player",
                value: board[0] ? `${board[0].name} — ${board[0].points} pts` : "—",
                inline: true,
              },
              { name: "Busiest arena", value: busiest ? `${busiest.l} (${busiest.n})` : "—", inline: true },
              {
                name: "Regions",
                value: TIER_REGIONS.map((r) => `**${r}** ${board.filter((p) => p.region === r).length}`).join(" · "),
                inline: false,
              }
            )
            .setURL(WEBSITE),
        ],
      });
      return;
    }

    if (sub === "profile") {
      const p = findPlayer(interaction.options.getString("player", true));
      if (!p) {
        await interaction.reply({
          content: `Nobody called **${interaction.options.getString("player", true)}** is ranked on Vyntric yet.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        embeds: [
          vyntricEmbed("accent")
            .setTitle(`${p.name} — ${p.title}`)
            .setThumbnail(head(p.name))
            .setDescription(
              `**#${p.overall}** overall · **${p.points}** points · ${REGION_NAMES[p.region] ?? p.region}\n\n` +
                p.rankings
                  .map(
                    (r) =>
                      `\`${modeLabel(r.slug)}\` **${r.labelTitle}**` +
                      (r.retired ? ` *(retired, peak ${r.peak})*` : "") +
                      ` · ${r.points} pts`
                  )
                  .join("\n")
            )
            .setURL(`${WEBSITE}/#/profile/${encodeURIComponent(p.name)}`),
        ],
      });
      return;
    }

    if (sub === "top") {
      const gamemode = interaction.options.getString("gamemode", true);
      const rows = topOfMode(gamemode, interaction.options.getInteger("limit") ?? 10);
      if (!rows.length) {
        await interaction.reply({
          content: `Nobody holds a **${modeLabel(gamemode)}** ranking yet.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        embeds: [
          vyntricEmbed("accent")
            .setTitle(`🏆 Top ${modeLabel(gamemode)}`)
            .setDescription(
              rows
                .map((p, i) => {
                  const r = p.rankings.find((x) => x.slug === gamemode)!;
                  return `**${i + 1}.** ${p.name} — \`${r.label}\` · ${p.points} pts`;
                })
                .join("\n")
            )
            .setURL(`${WEBSITE}/#/mode/${gamemode}`),
        ],
      });
      return;
    }

    if (sub === "leaderboard") {
      const region = interaction.options.getString("region");
      let board = leaderboard();
      if (region) board = board.filter((p) => p.region === region);
      const rows = board.slice(0, interaction.options.getInteger("limit") ?? 10);
      if (!rows.length) {
        await interaction.reply({
          content: `Nobody in **${region ? REGION_NAMES[region] ?? region : "that filter"}** is ranked yet.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        embeds: [
          vyntricEmbed("accent")
            .setTitle(`📈 Overall ladder${region ? ` · ${REGION_NAMES[region] ?? region}` : ""}`)
            .setDescription(
              rows.map((p) => `**${p.overall}.** ${p.name} — ${p.points} pts · \`${p.region}\``).join("\n")
            )
            .setURL(`${WEBSITE}/#/rankings`),
        ],
      });
      return;
    }

    if (sub === "ranks") {
      const name = interaction.options.getString("player", true);
      const gamemode = interaction.options.getString("gamemode", true);
      const p = findPlayer(name);
      const r = p?.rankings.find((x) => x.slug === gamemode);
      if (!p || !r) {
        await interaction.reply({
          content: `**${p?.name ?? name}** does not hold a ${modeLabel(gamemode)} ranking.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const field = topOfMode(gamemode, 250).findIndex((x) => x.name === p.name) + 1;
      await interaction.reply({
        embeds: [
          vyntricEmbed("accent")
            .setTitle(`${p.name} — ${modeLabel(gamemode)}`)
            .setThumbnail(head(p.name))
            .addFields(
              { name: "Rank in arena", value: field > 0 ? `#${field}` : "unranked", inline: true },
              { name: "Tier", value: r.labelTitle, inline: true },
              { name: "Points", value: `${r.points}`, inline: true },
              { name: "Overall", value: `#${p.overall} (${p.points} pts)`, inline: true },
              { name: "Region", value: REGION_NAMES[p.region] ?? p.region, inline: true },
              { name: "Status", value: r.retired ? `Retired — peak \`${r.peak}\`` : "Active", inline: true }
            )
            .setURL(`${WEBSITE}/#/mode/${gamemode}`),
        ],
      });
      return;
    }

    if (sub === "search") {
      const query = interaction.options.getString("query", true);
      const hits = searchPlayers(query, 10);
      if (!hits.length) {
        await interaction.reply({ content: `No player matches **${query}**.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({
        embeds: [
          vyntricEmbed("accent")
            .setTitle(`🔎 ${hits.length} match${hits.length === 1 ? "" : "es"} for "${query}"`)
            .setDescription(
              hits
                .map(
                  (p) =>
                    `**${p.name}** — \`${p.region}\` · #${p.overall} overall · ${p.points} pts · ` +
                    `${p.rankings.length} gamemode${p.rankings.length === 1 ? "" : "s"}`
                )
                .join("\n")
            ),
        ],
      });
      return;
    }

    if (sub === "tests") {
      const name = interaction.options.getString("player");
      const tests = name ? playerTests(name, 10) : recentTests(10);
      if (!tests.length) {
        await interaction.reply({
          content: name ? `**${name}** has no tests on record yet.` : "No tests have been recorded yet.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        embeds: [
          vyntricEmbed("accent")
            .setTitle(name ? `🧪 ${name} — test history` : "🧪 Recent tests")
            .setDescription(
              tests
                .map((t) => {
                  const got = splitIndex(t.tier).label;
                  const from = t.prev === null ? "first test" : splitIndex(t.prev).label;
                  return `\`${modeLabel(t.gamemode)}\` **${t.name}** — ${from} → **${got}** · by ${t.tester}`;
                })
                .join("\n")
            ),
        ],
      });
      return;
    }

    /* ------------------------------------------------------------- writing */
    if (sub === "set") {
      if (!(await requireStaff(interaction))) return;
      const username = interaction.options.getString("player", true).trim();
      const gamemode = interaction.options.getString("gamemode", true);
      const tier = interaction.options.getString("tier", true);
      const chosenRegion = interaction.options.getString("region");
      const tester = interaction.options.getUser("tester") ?? interaction.user;

      /* Same auto-detection as `/settier`: an explicit region wins, then the
         player's stored region, then their Discord locale, then NA. */
      const stored = findPlayer(username);
      const region = resolveRegion({
        chosen: chosenRegion,
        stored: stored?.region ?? null,
        locale: interaction.locale,
      });
      const autoDetected = !chosenRegion && !stored?.region && region !== "NA";

      try {
        const result = applyTier({ username, gamemode, tier, region, tester: tester.username });
        const settings = getSettings(interaction.guildId!);

        /* the result embed is the visible part, so defer before we post it */
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (settings.resultsChannelId) {
          const channel = interaction.guild!.channels.cache.get(settings.resultsChannelId);
          if (channel?.isTextBased()) {
            const message = await channel.send({
              embeds: [
                buildTierResultEmbed({
                  username,
                  region: result.region,
                  gamemodeLabel: modeLabel(gamemode),
                  previous: result.previous,
                  current: result.current,
                  testerMention: `<@${tester.id}>`,
                }),
              ],
            });
            await message.react("🏆").catch(() => undefined);
          }
        }

        await interaction.editReply({
          embeds: [
            vyntricEmbed("success")
              .setTitle("🏆 Tier Saved")
              .setDescription(
                [
                  `**${username}** is now **${TIER_FULL[TIER_LIST[result.current]]}** in **${modeLabel(gamemode)}**.`,
                  `Previous rank: **${result.previous === null ? "Unranked" : TIER_FULL[TIER_LIST[result.previous]]}**`,
                  `Region: **${region}**${
                    autoDetected ? " (auto-detected from Discord locale - use the region option to change it)" : ""
                  }`,
                  settings.resultsChannelId
                    ? "Result posted in the results channel."
                    : "No results channel yet - run `/setup results-channel channel:#results`.",
                  "The website refreshes within 30 seconds.",
                ].join("\n")
              ),
          ],
        });
      } catch (err) {
        /* the deferred reply already carries Ephemeral, so this one must not */
        const message = err instanceof Error ? err.message : "Could not write the tiers data file.";
        if (interaction.deferred) await interaction.editReply({ content: message });
        else fail(interaction, err);
      }
      return;
    }

    if (sub === "remove" || sub === "retire" || sub === "region") {
      if (!(await requireStaff(interaction))) return;
      const player = interaction.options.getString("player", true).trim();
      try {
        if (sub === "remove") {
          const gamemode = interaction.options.getString("gamemode");
          const { removed } = removeTier(player, gamemode);
          await interaction.reply({
            embeds: [
              vyntricEmbed("warning")
                .setTitle("🗑️ Ranking Removed")
                .setDescription(
                  `Cleared **${removed}** ranking${removed === 1 ? "" : "s"} for **${player}**` +
                    (gamemode ? ` in **${modeLabel(gamemode)}**.` : " across every arena.") +
                    "\nThe website refreshes within 30 seconds."
                ),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (sub === "retire") {
          const gamemode = interaction.options.getString("gamemode", true);
          const { peak } = retirePlayer(player, gamemode);
          await interaction.reply({
            embeds: [
              vyntricEmbed("neutral")
                .setTitle("🏳️ Player Retired")
                .setDescription(
                  `**${player}** is retired from **${modeLabel(gamemode)}**.\n` +
                    `The board now shows their frozen peak of **${TIER_FULL[peak]}**.`
                ),
            ],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const region = interaction.options.getString("region", true);
        setRegion(player, region);
        await interaction.reply({
          embeds: [
            vyntricEmbed("success")
              .setTitle("🌍 Region Updated")
              .setDescription(`**${player}** now plays from **${REGION_NAMES[region] ?? region}** (${region}).`),
          ],
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        fail(interaction, err);
      }
    }
  },
};

export default command;

