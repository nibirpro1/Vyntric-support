import { Events, MessageReaction, User, PartialMessageReaction, PartialUser } from "discord.js";
import { getGiveaway, saveGiveaway } from "../lib/giveawayStore";
import { buildGiveawayEmbed, buildGiveawayComponents } from "../lib/giveawayManager";

export default {
  name: Events.MessageReactionRemove,
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

    const idx = g.entries.indexOf(user.id);
    if (idx >= 0) {
      g.entries.splice(idx, 1);
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
