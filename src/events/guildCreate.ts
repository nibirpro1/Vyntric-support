import { Events, Guild, REST, Routes } from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";
import { collectCommandPayloads } from "../lib/commandPayloads";

/**
 * The moment the bot is invited to a server, its slash commands are registered
 * there — so /setup and /panel work without running the deploy script again.
 */
export default {
  name: Events.GuildCreate,
  once: false,
  async execute(guild: Guild, client: VyntricClient) {
    console.log(`[INFO] Joined ${guild.name} (${guild.id}) — registering slash commands.`);

    try {
      const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
      const body = collectCommandPayloads();
      await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body });
      console.log(
        `[INFO] ${body.length} commands ready in ${guild.name}. Run /setup then /panel to finish the setup.`
      );
    } catch (err) {
      console.error("[guildCreate] Could not register commands automatically:", err);
      console.error("[guildCreate] Run 'npm run deploy-commands' manually instead.");
    }
  },
};
