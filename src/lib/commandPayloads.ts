import fs from "fs";
import path from "path";

/**
 * Discord refuses to register a command when a required option appears after
 * an optional one, and it does so with a single opaque "Invalid Form Body"
 * that names the whole application and every other command. That is a bad way
 * to find one stray declaration, so options are normalised here instead.
 *
 * The sort is stable, so options that share a required-ness keep the order they
 * were written in and the prompt still reads naturally.
 */
function requiredOptionsFirst<T extends { required?: boolean }>(options: T[]): T[] {
  return options
    .map((option, index) => ({ option, index }))
    .sort((a, b) => Number(b.option.required ?? false) - Number(a.option.required ?? false) || a.index - b.index)
    .map((entry) => entry.option);
}

function normaliseOptions(options: any[]): any[] {
  return requiredOptionsFirst(options).map((option) => {
    // Recurse, so a required-first violation nested one level deeper is also caught.
    if (Array.isArray(option.options)) option.options = normaliseOptions(option.options);
    return option;
  });
}

/**
 * Collects the JSON payload of every slash command in `src/commands` (or
 * `dist/commands` at runtime). Used by the deploy script and by the
 * guildCreate listener that registers commands the moment the bot is invited.
 */
export function collectCommandPayloads(): any[] {
  const commandsPath = path.join(__dirname, "..", "commands");
  const payloads: any[] = [];

  for (const category of fs.readdirSync(commandsPath)) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    for (const file of fs.readdirSync(categoryPath)) {
      if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;

      const command = require(path.join(categoryPath, file)).default;
      if (command?.data?.toJSON) {
        const json = command.data.toJSON();
        if (Array.isArray(json.options)) json.options = normaliseOptions(json.options);
        payloads.push(json);
      }
    }
  }

  // Directory iteration order is filesystem-dependent, so sort by name. That
  // makes the deploy log and any diff of the registered command list stable.
  return payloads.sort((a, b) => a.name.localeCompare(b.name));
}
