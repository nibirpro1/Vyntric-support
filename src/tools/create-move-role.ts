import dotenv from "dotenv";
dotenv.config();

import { Client, GatewayIntentBits, PermissionFlagsBits, PermissionsBitField } from "discord.js";

const GUILD_ID = "1507706011622965258";

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error("No DISCORD_TOKEN found in environment / .env");
    process.exit(1);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  await client.login(token);
  console.log(`Logged in as ${client.user?.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) {
    console.error(`Guild ${GUILD_ID} not found`);
    await client.destroy();
    process.exit(1);
  }

  console.log(`Fetched guild: ${guild.name} (${guild.id})`);

  // Check if role "Move" or "🔀 Move Perms" already exists
  await guild.roles.fetch();
  let moveRole = guild.roles.cache.find(
    (r) =>
      r.name.toLowerCase() === "move" ||
      r.name === "🔀 Move Perms" ||
      r.name.toLowerCase() === "move perms"
  );

  const desiredPerms = new PermissionsBitField([PermissionFlagsBits.MoveMembers]);

  if (moveRole) {
    console.log(`Found existing role: "${moveRole.name}" (${moveRole.id})`);
    console.log(`Current permissions bitfield: ${moveRole.permissions.bitfield.toString()}`);
    console.log(`Current permission names:`, moveRole.permissions.toArray());

    // Update to strictly have ONLY MoveMembers
    console.log(`Updating role "${moveRole.name}" to strictly possess ONLY MoveMembers permission...`);
    moveRole = await moveRole.edit({
      name: "🔀 Move Perms",
      permissions: desiredPerms,
      reason: "Ensure role has strictly MoveMembers permission only as requested by user",
    });
    console.log(`Role updated successfully!`);
  } else {
    console.log(`Role not found. Creating new role "🔀 Move Perms" with strictly MoveMembers permission...`);
    moveRole = await guild.roles.create({
      name: "🔀 Move Perms",
      color: 0x3498db, // Discord Blurple / Blue
      permissions: desiredPerms,
      hoist: false,
      mentionable: false,
      reason: "User requested role with MoveMembers permission only",
    });
    console.log(`Role created successfully! ID: ${moveRole.id}`);
  }

  console.log(`\n=== ROLE DETAILS ===`);
  console.log(`ID: ${moveRole.id}`);
  console.log(`Name: ${moveRole.name}`);
  console.log(`Color: #${moveRole.color.toString(16)}`);
  console.log(`Permissions Bitfield: ${moveRole.permissions.bitfield.toString()}`);
  console.log(`Permissions Array:`, moveRole.permissions.toArray());
  console.log(`Has MoveMembers only: ${moveRole.permissions.equals(desiredPerms)}`);

  await client.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error executing script:", err);
  process.exit(1);
});
