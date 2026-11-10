import { Events, MessageReaction, User, PartialMessageReaction, PartialUser } from "discord.js";
import { getGiveaway, saveGiveaway } from "../lib/giveawayStore";
import { buildGiveawayEmbed, buildGiveawayComponents } from "../lib/giveawayManager";
import { getVerificationConfig } from "../lib/verificationStore";
import { executeMemberVerification } from "../interactions/verificationInteractions";
import { VyntricClient } from "../structures/VyntricClient";

export default {
  name: Events.MessageReactionAdd,
  once: false,
  async execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch {
        return;
      }
    }

    const message = reaction.message;
    if (!message.guild) return;

    // ─────────────────────────────────────────────────────────────
    // 1. REACTION VERIFICATION SYSTEM
    // ─────────────────────────────────────────────────────────────
    const vConfig = getVerificationConfig(message.guild.id);
    const targetEmoji = vConfig.reactionEmoji || "✅";
    const isVerifyEmoji =
      reaction.emoji.name === targetEmoji ||
      reaction.emoji.name === "✅" ||
      reaction.emoji.name === "🛡️";

    const isVerifyPanel =
      (vConfig.messageId && message.id === vConfig.messageId) ||
      (vConfig.channelId && message.channel.id === vConfig.channelId);

    if (vConfig.enabled && isVerifyPanel && isVerifyEmoji) {
      const member =
        message.guild.members.cache.get(user.id) ||
        (await message.guild.members.fetch(user.id).catch(() => null));

      if (member) {
        const client = message.client as VyntricClient;
        const result = await executeMemberVerification({
          guild: message.guild,
          member,
          config: vConfig,
          client,
          source: "reaction",
        });

        if (!result.ok && result.reason === "cooldown") {
          // Remove reaction so member can react again after cooldown expires
          await reaction.users.remove(user.id).catch(() => {});

          await user
            .send({
              content: `⏳ **Security Cooldown Active:** To prevent raid bots in **${message.guild.name}**, new members must wait **${vConfig.waitMinutes} minutes** after joining. Please wait **${result.remainingMin} more minute(s)** (unlocks <t:${result.unlockTimestamp}:R>) and then react with ✅ again!`,
            })
            .catch(() => {});
        }
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. GIVEAWAY REACTIONS
    // ─────────────────────────────────────────────────────────────
    if (reaction.emoji.name !== "🎉") return;

    const g = getGiveaway(message.id);
    if (!g || g.ended) return;

    // Check required role if set
    if (g.requiredRoleId && message.guild) {
      const member =
        message.guild.members.cache.get(user.id) ||
        (await message.guild.members.fetch(user.id).catch(() => null));
      if (!member || !member.roles.cache.has(g.requiredRoleId)) {
        // Remove reaction if member doesn't meet role requirement
        await reaction.users.remove(user.id).catch(() => {});
        return;
      }
    }

    // Add entry if not already present
    if (!g.entries.includes(user.id)) {
      g.entries.push(user.id);
      saveGiveaway(g);

      try {
        await message.edit({
          embeds: [buildGiveawayEmbed(g)],
          components: buildGiveawayComponents(g),
        });
      } catch {
        /* ignore */
      }
    }
  },
};
