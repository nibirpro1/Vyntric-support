import { SlashCommandBuilder } from "discord.js";
import { Command } from "../../structures/Command";
import helpCommand from "./help";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("commands")
    .setDescription("View documentation, usage, and examples for all Plugsy commands")
    .addStringOption((opt) =>
      opt
        .setName("command")
        .setDescription("View detailed documentation for a specific command")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    return helpCommand.execute(interaction, client);
  },
};

export default command;
