import { Client, ClientOptions, Collection } from "discord.js";
import { Shoukaku } from "shoukaku";
import { Command } from "./Command";
import { MusicHandler } from "../music/MusicHandler";

export class VyntricClient extends Client {
  commands: Collection<string, Command> = new Collection();
  shoukaku!: Shoukaku;
  musicHandler!: MusicHandler;

  constructor(options: ClientOptions) {
    super(options);
  }
}
