import fs from "fs";
import path from "path";
import { VyntricClient } from "../structures/VyntricClient";
import { Command } from "../structures/Command";

export function loadCommands(client: VyntricClient) {
  const commandsPath = path.join(__dirname, "..", "commands");
  const categories = fs.readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    const files = fs
      .readdirSync(categoryPath)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const command: Command = require(filePath).default;

      if (!command?.data?.name) {
        console.warn(`[WARN] Skipped invalid command file: ${filePath}`);
        continue;
      }

      client.commands.set(command.data.name, command);
    }
  }

  console.log(`[INFO] Loaded ${client.commands.size} commands.`);
}
