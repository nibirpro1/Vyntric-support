import { Events, GuildMember, EmbedBuilder, TextChannel, AttachmentBuilder } from "discord.js";
import path from "path";
import fs from "fs";
import { formatWelcomeText, getRandomWelcomeJoke, getWelcomeConfig } from "../lib/welcomeStore";
import { BRAND } from "../lib/brand";

const DEFAULT_BANNER_PATH = path.resolve(process.cwd(), "assets", "banners", "vyntric-welcome.gif");

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member: GuildMember) {
    const config = getWelcomeConfig(member.guild.id);
    if (!config.enabled && !config.channelId && config.autoRoleIds.length === 0) return;

    // 1. Assign Auto-Roles
    if (config.autoRoleIds && config.autoRoleIds.length > 0) {
      for (const roleId of config.autoRoleIds) {
        try {
          const role = member.guild.roles.cache.get(roleId);
          if (role && !member.roles.cache.has(roleId)) {
            await member.roles.add(role, "Vyntric Auto-Role on join");
          }
        } catch (err: any) {
          console.warn(`[welcome:autorole] Could not assign role ${roleId} to ${member.user.tag}:`, err.message);
        }
      }
    }

    // 2. Send Welcome Channel Announcement with Animated Vyntric Red Banner
    if (config.channelId) {
      try {
        const channel = member.guild.channels.cache.get(config.channelId) as TextChannel | undefined;
        if (channel && channel.isTextBased()) {
          const formattedDesc = formatWelcomeText(config.message, member);

          const embed = new EmbedBuilder()
            .setColor(BRAND.colors.primary)
            .setAuthor({
              name: `Welcome to ${member.guild.name}!`,
              iconURL: member.guild.iconURL() || undefined,
            })
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setDescription(formattedDesc)
            .addFields(
              { name: "👤 User", value: `<@${member.id}> (${member.user.tag})`, inline: true },
              { name: "👥 Member Count", value: `**#${member.guild.memberCount}**`, inline: true },
              { name: "📅 Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: getRandomWelcomeJoke() })
            .setTimestamp();

          const files: AttachmentBuilder[] = [];

          if (config.bannerUrl && config.bannerUrl.trim().length > 0) {
            embed.setImage(config.bannerUrl.trim());
          } else if (fs.existsSync(DEFAULT_BANNER_PATH)) {
            const bannerAttachment = new AttachmentBuilder(DEFAULT_BANNER_PATH, { name: "vyntric-welcome.gif" });
            embed.setImage("attachment://vyntric-welcome.gif");
            files.push(bannerAttachment);
          }

          await channel.send({
            content: `👋 <@${member.id}>`,
            embeds: [embed],
            files,
          });
        }
      } catch (err) {
        console.error("[welcome:channel:error]", err);
      }
    }

    // 3. Send DM Welcome Message
    if (config.dmEnabled && config.dmMessage) {
      try {
        const formattedDm = formatWelcomeText(config.dmMessage, member);
        const dmEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.accent)
          .setTitle(`Welcome to ${member.guild.name}!`)
          .setDescription(formattedDm)
          .setThumbnail(member.guild.iconURL() || member.user.displayAvatarURL())
          .setFooter({ text: member.guild.name })
          .setTimestamp();

        const dmFiles: AttachmentBuilder[] = [];
        if (config.bannerUrl && config.bannerUrl.trim().length > 0) {
          dmEmbed.setImage(config.bannerUrl.trim());
        } else if (fs.existsSync(DEFAULT_BANNER_PATH)) {
          const bannerAttachment = new AttachmentBuilder(DEFAULT_BANNER_PATH, { name: "vyntric-welcome.gif" });
          dmEmbed.setImage("attachment://vyntric-welcome.gif");
          dmFiles.push(bannerAttachment);
        }

        await member.send({ embeds: [dmEmbed], files: dmFiles });
      } catch {
        // Member has DMs closed
      }
    }
  },
};
