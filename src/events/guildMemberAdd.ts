import { Events, GuildMember, EmbedBuilder, TextChannel, AttachmentBuilder } from "discord.js";
import path from "path";
import fs from "fs";
import { formatWelcomeText, getRandomWelcomeJoke, getWelcomeConfig } from "../lib/welcomeStore";
import { BRAND } from "../lib/brand";
import { getAntiNukeConfig } from "../lib/antinukeStore";
import { isImmune, executePunishment, sendAntiNukeAlert } from "../lib/antinukeManager";

const DEFAULT_BANNER_PATH = path.resolve(process.cwd(), "assets", "banners", "vyntric-welcome.gif");

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member: GuildMember) {
    console.log(`[welcome] Member joined: ${member.user.tag} (${member.id}) bot=${member.user.bot}`);

    // ─────────────────────────────────────────────────────────────
    // 0. ANTI-NUKE: UNAUTHORIZED BOT ADD PROTECTION
    // ─────────────────────────────────────────────────────────────
    if (member.user.bot) {
      const antiNukeConfig = getAntiNukeConfig(member.guild.id);
      if (antiNukeConfig.enabled && antiNukeConfig.features.antiBot.enabled) {
        try {
          await new Promise((r) => setTimeout(r, 600));
          const auditLogs = await member.guild.fetchAuditLogs({
            limit: 3,
            type: 28, // AuditLogEvent.BotAdd
          });
          const entry =
            auditLogs.entries.find((e) => e.targetId === member.id) ||
            auditLogs.entries.first();

          if (entry && entry.executor && !isImmune(member.guild, entry.executor.id)) {
            console.warn(
              `[antinuke:antibot] Unauthorized bot add detected: ${member.user.tag} added by ${entry.executor.tag}`
            );

            // 1. Kick unauthorized bot
            await member.kick("[Krypton Anti-Nuke] Unauthorized bot addition");

            // 2. Punish inviter
            const punishmentResult = await executePunishment(
              member.guild,
              entry.executor.id,
              `Unauthorized bot addition (${member.user.tag})`,
              antiNukeConfig
            );

            // 3. Send security alert
            await sendAntiNukeAlert({
              guild: member.guild,
              executor: entry.executor,
              actionName: "Anti-Bot (Unauthorized Bot Add)",
              details: `Bot: <@${member.id}> (\`${member.user.tag}\`)`,
              punishmentResult: `Bot Kicked & Inviter ${punishmentResult}`,
              config: antiNukeConfig,
            });

            return; // Abort welcome flow
          }
        } catch (err) {
          console.error("[antinuke:antibot:error]", err);
        }
      }
    }

    const config = getWelcomeConfig(member.guild.id);
    if (!config.enabled && !config.channelId && (!config.autoRoleIds || config.autoRoleIds.length === 0)) {
      console.log(`[welcome] Welcome disabled or not configured for guild ${member.guild.id}`);
      return;
    }

    // 1. Assign Auto-Roles
    if (config.autoRoleIds && config.autoRoleIds.length > 0) {
      for (const roleId of config.autoRoleIds) {
        try {
          const role =
            member.guild.roles.cache.get(roleId) ||
            (await member.guild.roles.fetch(roleId).catch(() => null));
          if (role && !member.roles.cache.has(roleId)) {
            await member.roles.add(role, "Vyntric Auto-Role on join");
            console.log(`[welcome:autorole] Assigned ${role.name} to ${member.user.tag}`);
          }
        } catch (err: any) {
          console.warn(`[welcome:autorole] Could not assign role ${roleId} to ${member.user.tag}:`, err.message);
        }
      }
    }

    // 2. Send Welcome Channel Announcement
    if (config.channelId) {
      try {
        const channel =
          (member.guild.channels.cache.get(config.channelId) as TextChannel | undefined) ||
          (await member.guild.channels.fetch(config.channelId).catch(() => null) as TextChannel | null);

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
          console.log(`[welcome] Sent welcome message to #${channel.name} for ${member.user.tag}`);
        } else {
          console.warn(`[welcome] Channel ${config.channelId} not found or not text-based`);
        }
      } catch (err) {
        console.error("[welcome:channel:error]", err);
      }
    }

    // 3. Send DM Welcome Message (skip bots since bots cannot receive user DMs)
    if (config.dmEnabled && config.dmMessage && !member.user.bot) {
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
        console.log(`[welcome] Sent welcome DM to ${member.user.tag}`);
      } catch {
        // Member has DMs closed
      }
    }
  },
};
