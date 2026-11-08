import { Events, MessageReaction, User, PartialMessageReaction, PartialUser } from "discord.js";
import { getGiveaway, saveGiveaway } from "../lib/giveawayStore";
import { buildGiveawayEmbed, buildGiveawayComponents } from "../lib/giveawayManager";

export default {
  name: Events.MessageReactionAdd,
  once: false,
  async execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;
    if (reaction.emoji.name !== "🎉") return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch {
        return;
      }
    }

    const message = reaction.message;
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
