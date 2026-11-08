import fs from "fs";
import path from "path";
import { VyntricClient } from "../structures/VyntricClient";

export function loadEvents(client: VyntricClient) {
  const eventsPath = path.join(__dirname, "..", "events");
  const files = fs
    .readdirSync(eventsPath)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

  for (const file of files) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath).default;

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }

  console.log(`[INFO] Loaded ${files.length} events.`);
}
