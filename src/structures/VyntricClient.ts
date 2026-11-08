import { Client, ClientOptions, Collection } from "discord.js";
import { Command } from "./Command";

export class VyntricClient extends Client {
  commands: Collection<string, Command> = new Collection();

  constructor(options: ClientOptions) {
    super(options);
  }
}
