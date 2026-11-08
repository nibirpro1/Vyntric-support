import { ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import { Command } from "../../structures/Command";
import { vyntricEmbed } from "../../lib/brand";
import { SERVER_REGIONS, SERVER_STATUS_META, PING_TOLERANCE_MS, checkPing } from "../../config/servers";
import { addServer, findServer, listServers, removeServer } from "../../lib/servers";
import { canManageStaff, canTest } from "../../lib/permissions";
import { getSettings } from "../../lib/store";

const CHOICES_REGIONS = SERVER_REGIONS.map((r) => ({ name: r, value: r }));
const CHOICES_STATUS = (Object.keys(SERVER_STATUS_META) as Array<keyof typeof SERVER_STATUS_META>).map(
  (key) => ({ name: `${SERVER_STATUS_META[key].dot} ${SERVER_STATUS_META[key].label}`, value: key })
);

/**
 * `/servers` - the verified testing server registry.
 *
 *   list    the published list, grouped by region, with the dot key
 *   check   is this host allowed for a ranked test, and who may force it
 *   ping    the tick-range check for two players
 *   add     publish a host (Head of Testing)
 *   remove  unpublish a host (Head of Testing)
 */
const command: Command = {
  data: new SlashCommandBuilder()
    .setName("servers")
    .setDescription("Verified testing servers")
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("The published server list")
        .addStringOption((o) => o.setName("region").setDescription("Just one region").addChoices(...CHOICES_REGIONS))
    )
    .addSubcommand((sub) =>
      sub
        .setName("check")
        .setDescription("Check whether a host is allowed for ranked testing")
        .addStringOption((o) => o.setName("host").setDescription("Hostname").setRequired(true).setMaxLength(60))
    )
    .addSubcommand((sub) =>
      sub
        .setName("ping")
        .setDescription("Check whether two pings are inside the same tick range")
        .addIntegerOption((o) => o.setName("first").setDescription("First player ping (ms)").setRequired(true).setMinValue(0).setMaxValue(999))
        .addIntegerOption((o) => o.setName("second").setDescription("Second player ping (ms)").setRequired(true).setMinValue(0).setMaxValue(999))
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Publish a testing host")
        .addStringOption((o) => o.setName("host").setDescription("Hostname").setRequired(true).setMaxLength(60))
        .addStringOption((o) => o.setName("region").setDescription("Region").setRequired(true).addChoices(...CHOICES_REGIONS))
        .addStringOption((o) => o.setName("status").setDescription("What it entitles you to").setRequired(true).addChoices(...CHOICES_STATUS))
        .addStringOption((o) => o.setName("note").setDescription("Extra note, e.g. HT3+ server").setMaxLength(60))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Unpublish a testing host")
        .addStringOption((o) => o.setName("host").setDescription("Hostname").setRequired(true).setMaxLength(60))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    // Ping parity is a public rule, so it needs neither a guild nor a role.
    if (sub === "ping") {
      const a = interaction.options.getInteger("first", true);
      const b = interaction.options.getInteger("second", true);
      const check = checkPing(a, b);
      await interaction.reply({
        embeds: [
          vyntricEmbed(check.fair ? "success" : "danger")
            .setTitle(`Ping check — ${a}ms vs ${b}ms`)
            .setDescription(
              [
                `**Gap:** ${check.gap}ms (limit ${PING_TOLERANCE_MS}ms)`,
                `**Tick range:** ${check.range.low}–${check.range.high}ms`,
                "",
                check.fair
                  ? check.spoofRequired
                    ? "✅ Playable, but the lower-ping player should **spoof into the shared range** rather than fight it out."
                    : "✅ Both inside the same range — the fight is ranked."
                  : "❌ Outside the same range — not a ranked fight. Find a closer host or a verified server.",
              ].join("\n")
            ),
        ],
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

    if (sub === "add" || sub === "remove") {
      if (!canManageStaff(actor)) {
        await interaction.reply({
          content: "Only the **Head of Testing** (or the server owner) can change the list.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const host = interaction.options.getString("host", true);
      try {
        if (sub === "add") {
          addServer({
            host: host.trim().toLowerCase(),
            region: interaction.options.getString("region", true),
            status: interaction.options.getString("status", true) as any,
            note: interaction.options.getString("note")?.trim() || undefined,
          });
        } else {
          removeServer(host);
        }
        await interaction.reply({
          embeds: [
            vyntricEmbed("success")
              .setTitle(sub === "add" ? "✅ Host published" : "🗑️ Host removed")
              .setDescription(`**${host}** — run \`/servers list\` to see the updated list.`),
          ],
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        await interaction.reply({
          content: err instanceof Error ? err.message : "Could not update the list.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if (sub === "check") {
      const host = interaction.options.getString("host", true);
      const found = findServer(host);
      if (!found) {
        await interaction.reply({
          embeds: [
            vyntricEmbed("danger")
              .setTitle(`❌ ${host} is not a verified host`)
              .setDescription(
                "It is not on the published list, so a ranked test on it cannot be enforced. Run `/servers list` to see what is allowed."
              ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const meta = SERVER_STATUS_META[found.status];
      const actorCanForce = canTest(actor);
      await interaction.reply({
        embeds: [
          vyntricEmbed(meta.canForce ? "success" : "warning")
            .setTitle(`${meta.dot} ${found.host} — ${meta.label}`)
            .setDescription(
              [
                `**Region:** ${found.region}`,
                found.alias ? `**Also reachable at:** \`${found.alias}\`` : "",
                found.note ? `**Note:** ${found.note}` : "",
                "",
                meta.blurb,
                "",
                meta.canForce
                  ? actorCanForce
                    ? "✅ You can force this host if the players cannot agree."
                    : "ℹ️ A **Tiers Regulator** or above can force this host."
                  : "⚠️ Not usable for ranked tests.",
              ]
                .filter(Boolean)
                .join("\n")
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // list
    const region = interaction.options.getString("region");
    const regions = region ? [region] : [...SERVER_REGIONS];
    const populated = regions.filter((r) => listServers(r).length);

    const embed = vyntricEmbed("primary").setTitle("🌐 Verified testing servers");
    embed.setDescription(
      populated.length
        ? ["**A ranked test has to be run on one of these hosts.**", ""]
            .concat(populated.map((r) => `**${r}**\n${listServers(r).sort((x, y) => x.host.localeCompare(y.host)).map((s) => `${SERVER_STATUS_META[s.status].dot} \`${s.host}${s.alias ? " / " + s.alias : ""}\`${s.note ? ` _(${s.note})_` : ""}`).join("\n")}`))
            .join("\n\n")
        : "_No servers have been published yet. Run `/servers add`._"
    );
    embed.addFields({
      name: "Dot key",
      value: (Object.keys(SERVER_STATUS_META) as Array<keyof typeof SERVER_STATUS_META>)
        .map((key) => `${SERVER_STATUS_META[key].dot} **${SERVER_STATUS_META[key].label}** — ${SERVER_STATUS_META[key].blurb}`)
        .join("\n"),
      inline: false,
    });

    const settings = getSettings(guild.id);
    if (settings.punishmentsChannelId) {
      embed.setFooter({ text: "Ping parity: within 20ms of each other — use /servers ping to check." });
    }

    await interaction.reply({ embeds: [embed] });

    // Also mirror it into the log channel so it is searchable later.
    if (settings.staffLogChannelId) {
      const channel = guild.channels.cache.get(settings.staffLogChannelId);
      if (channel?.isTextBased() && canManageStaff(actor)) {
        await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
      }
    }
  },
};

export default command;
