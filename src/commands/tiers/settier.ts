import { ChatInputCommandInteraction, GuildMember, MessageFlags, SlashCommandBuilder } from "discord.js";
import { Command } from "../../structures/Command";
import { vyntricEmbed } from "../../lib/brand";
import { getSettings } from "../../lib/store";
import { isTicketStaff } from "../../lib/permissions";
import {
  TIER_FULL,
  TIER_LIST,
  TIER_MODES,
  TIER_REGIONS,
  applyTier,
  buildTierResultEmbed,
  findPlayer,
  resolveRegion,
} from "../../lib/tiers";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("settier")
    .setDescription("Set a player's tier - posts the result and updates the Vyntric Tiers website")
    .addStringOption((option) =>
      option.setName("username").setDescription("Minecraft username").setRequired(true).setMaxLength(32)
    )
    .addStringOption((option) =>
      option
        .setName("gamemode")
        .setDescription("Gamemode that was tested")
        .setRequired(true)
        .addChoices(...TIER_MODES.map(([value, name]) => ({ name, value })))
    )
    .addStringOption((option) =>
      option
        .setName("tier")
        .setDescription("Tier earned")
        .setRequired(true)
        .addChoices(...TIER_LIST.map((value) => ({ name: `${value} - ${TIER_FULL[value]}`, value })))
    )
    .addStringOption((option) =>
      option
        .setName("region")
        .setDescription("Player region - auto-detected from Discord locale when omitted")
        .addChoices(...TIER_REGIONS.map((value) => ({ name: value, value })))
    )
    .addUserOption((option) => option.setName("tester").setDescription("Tester (defaults to you)")),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command only works inside a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guild = interaction.guild;
    const member: GuildMember = await guild.members.fetch(interaction.user.id);
    if (!isTicketStaff(member)) {
      await interaction.reply({
        content: "Only tier testers and staff can set tiers.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const username = interaction.options.getString("username", true).trim();
    const gamemode = interaction.options.getString("gamemode", true);
    const tier = interaction.options.getString("tier", true);
    const chosenRegion = interaction.options.getString("region");
    const tester = interaction.options.getUser("tester") ?? interaction.user;
    const settings = getSettings(guild.id);

    /* Auto-detect the region. A player's Discord locale is the only region
       signal a Discord account carries, so it is what fills the `region` option
       when the tester leaves it blank — but an already-ranked player's stored
       region wins, so re-testing somebody never silently moves them. */
    const stored = findPlayer(username);
    const region = resolveRegion({
      chosen: chosenRegion,
      stored: stored?.region ?? null,
      locale: interaction.locale,
    });
    const autoDetected = !chosenRegion && !stored?.region && region !== "NA";

    let result;
    try {
      result = applyTier({ username, gamemode, tier, region, tester: tester.username });
    } catch (err) {
      console.error("[command:settier]", err);
      await interaction.reply({
        content: "Could not write the tiers data file. Check TIERS_DATA_JSON in .env.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const label = TIER_MODES.find(([key]) => key === gamemode)?.[1] ?? gamemode;

    if (settings.resultsChannelId) {
      try {
        const channel = await guild.channels.fetch(settings.resultsChannelId);
        if (channel && channel.isTextBased()) {
          const message = await channel.send({
            embeds: [
              buildTierResultEmbed({
                username,
                region: result.region,
                gamemodeLabel: label,
                previous: result.previous,
                current: result.current,
                testerMention: `<@${tester.id}>`,
              }),
            ],
          });
          try {
            await message.react("🏆");
          } catch {
            /* missing Add Reactions permission */
          }
        }
      } catch (err) {
        console.error("[command:settier] could not post the result embed", err);
      }
    }

    await interaction.reply({
      embeds: [
        vyntricEmbed("success")
          .setTitle("🏆 Tier Saved")
          .setDescription(
            [
              `**${username}** is now **${TIER_FULL[TIER_LIST[result.current]]}** in **${label}**.`,
              `Previous rank: **${result.previous === null ? "Unranked" : TIER_FULL[TIER_LIST[result.previous]]}**`,
              `Region: **${region}**${
                autoDetected ? " (auto-detected from Discord locale - use the region option to change it)" : ""
              }`,
              settings.resultsChannelId
                ? `Result posted in <#${settings.resultsChannelId}>.`
                : "No results channel yet - run `/setup results-channel channel:#results`.",
              "The website refreshes within 30 seconds.",
            ].join("\n")
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;