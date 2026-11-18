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

    // Strictly enforce "No Kick / No Removal" server policy:
    // Once a member enters a giveaway, their entry is permanent and can never be removed or kicked.
    return;
  },
};
