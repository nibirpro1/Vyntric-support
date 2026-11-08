import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { VyntricClient } from "./VyntricClient";

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | any;
  execute: (
    interaction: ChatInputCommandInteraction,
    client: VyntricClient
  ) => Promise<unknown>;
}
