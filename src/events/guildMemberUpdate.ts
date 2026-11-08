import { EmbedBuilder, GuildMember, TextChannel } from "discord.js";
import { formatBoosterText, getBoosterConfig } from "../lib/boosterStore";
import { BRAND } from "../lib/brand";

export default {
  name: "guildMemberUpdate",
  once: false,
  async execute(oldMember: GuildMember, newMember: GuildMember) {
    if (!newMember.guild) return;

    const guild = newMember.guild;
    const config = getBoosterConfig(guild.id);
    if (!config.enabled) return;

    const wasBoosting = Boolean(oldMember.premiumSince);
    const isBoosting = Boolean(newMember.premiumSince);

    // CASE 1: Member started boosting
    if (!wasBoosting && isBoosting) {
      console.log(`[booster] ${newMember.user.tag} started boosting ${guild.name}!`);

      // 1. Assign booster role
      if (config.roleId) {
        const role = guild.roles.cache.get(config.roleId);
        const botMember = guild.members.me;

        if (role && botMember && botMember.roles.highest.position > role.position) {
          if (!newMember.roles.cache.has(config.roleId)) {
            try {
              await newMember.roles.add(role, "Vyntric Auto Booster Role — Member boosted server");
              console.log(`[booster] Assigned role ${role.name} to ${newMember.user.tag}`);
            } catch (err) {
              console.error(`[booster] Failed to assign booster role:`, err);
            }
          }
        }
      }

      // 2. Announce boost in configured channel
      if (config.channelId) {
        const channel = guild.channels.cache.get(config.channelId) as TextChannel | undefined;
        if (channel && channel.isTextBased()) {
          const boostCount = guild.premiumSubscriptionCount || 1;
          const level = guild.premiumTier;

          const desc = formatBoosterText(config.message, {
            user: `<@${newMember.id}>`,
            username: newMember.user.username,
            server: guild.name,
            boostCount,
            level,
          });

          const embed = new EmbedBuilder()
            .setColor(0xf47fff) // Discord Nitro Pink / Magenta
            .setTitle("🚀 NEW SERVER BOOST!")
            .setDescription(desc)
            .setThumbnail(newMember.user.displayAvatarURL({ size: 256 }))
            .addFields(
              { name: "💎 Total Server Boosts", value: `**${boostCount} Boosts**`, inline: true },
              { name: "⚡ Server Level", value: `**Level ${level}**`, inline: true },
              { name: "👑 Booster", value: `<@${newMember.id}>`, inline: true }
            )
            .setFooter({
              text: `${BRAND.name} Booster Perks • Thank you for your support!`,
              iconURL: guild.iconURL() ?? undefined,
            })
            .setTimestamp();

          await channel.send({ content: `🎉 <@${newMember.id}> just boosted the server!`, embeds: [embed] }).catch(() => null);
        }
      }

      // 3. Send Thank-You DM
      if (config.dmEnabled) {
        try {
          const dmText = formatBoosterText(config.dmMessage, {
            user: `<@${newMember.id}>`,
            username: newMember.user.username,
            server: guild.name,
            boostCount: guild.premiumSubscriptionCount || 1,
            level: guild.premiumTier,
          });

          await newMember.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xf47fff)
                .setTitle(`💖 Thank You for Boosting ${guild.name}!`)
                .setDescription(dmText)
                .setFooter({ text: `${BRAND.name} Community Perks` })
                .setTimestamp(),
            ],
          });
        } catch {
          // User DMs may be closed
        }
      }
    }

    // CASE 2: Member stopped boosting (boost expired or was transferred)
    if (wasBoosting && !isBoosting) {
      console.log(`[booster] ${newMember.user.tag} stopped boosting ${guild.name}.`);

      if (config.roleId) {
        const role = guild.roles.cache.get(config.roleId);
        const botMember = guild.members.me;

        if (role && botMember && botMember.roles.highest.position > role.position) {
          if (newMember.roles.cache.has(config.roleId)) {
            try {
              await newMember.roles.remove(role, "Member stopped boosting server");
              console.log(`[booster] Removed booster role ${role.name} from ${newMember.user.tag}`);
            } catch (err) {
              console.error(`[booster] Failed to remove booster role:`, err);
            }
          }
        }
      }
    }
  },
};
