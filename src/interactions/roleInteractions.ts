import {
  ButtonInteraction,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { VyntricClient } from "../structures/VyntricClient";
import { parseRoleCustomId } from "../lib/customIds";
import { vyntricEmbed } from "../lib/brand";

const MISSING_ROLE_PERMISSION =
  "I need the **Manage Roles** permission, and my role must sit **above** the role you are picking.";

/** Last click per `userId:roleId` — swallows accidental double-clicks. */
const lastClick = new Map<string, number>();
const DOUBLE_CLICK_MS = 2500;

/**
 * Toggles a self-assignable role.
 * Click once -> role granted. Click again -> role removed.
 * Multiple roles can be held at the same time: each button only touches
 * its own role, and the reply always reports the member's real roles.
 */
export async function handleRoleButton(interaction: ButtonInteraction, _client: VyntricClient) {
  const roleId = parseRoleCustomId(interaction.customId);
  if (!roleId) {
    await interaction.reply({
      content: "This role button is broken. Ask a staff member to republish the panel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Double-click guard: a second press within the window is ignored,
  // so an eager click can never toggle the role on and straight back off.
  const clickKey = `${interaction.user.id}:${roleId}`;
  const now = Date.now();
  const previous = lastClick.get(clickKey) ?? 0;
  if (now - previous < DOUBLE_CLICK_MS) {
    await interaction.reply({
      content: "One moment — this click was ignored to keep your roles safe.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  lastClick.set(clickKey, now);

  const guild = interaction.guild;
  if (!guild) return;

  const me = guild.members.me ?? (await guild.members.fetchMe());
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({ content: MISSING_ROLE_PERMISSION, flags: MessageFlags.Ephemeral });
    return;
  }

  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await interaction.reply({
      content: "This role no longer exists. Ask a staff member to republish the panel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (role.managed || role.id === guild.id) {
    await interaction.reply({
      content: "This role cannot be picked manually.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (role.comparePositionTo(me.roles.highest) >= 0) {
    await interaction.reply({ content: MISSING_ROLE_PERMISSION, flags: MessageFlags.Ephemeral });
    return;
  }

  // Acknowledge first, then work with a fully fresh member object so the
  // decision is never based on a stale roles cache.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member: GuildMember | null = await guild.members
    .fetch(interaction.user.id)
    .catch(() => null);
  if (!member) return;

  const hasRole = member.roles.cache.has(role.id);

  if (hasRole) {
    await member.roles.remove(role.id, "Vyntric self-role toggle");
  } else {
    // Adding a role never touches other roles, but pass the full resolved
    // role object anyway so discord.js sends a single, unambiguous change.
    await member.roles.add(role, "Vyntric self-role toggle");
  }

  // Re-read the member with a cold cache and report the truth, not the intent.
  guild.members.cache.delete(interaction.user.id);
  const refreshed: GuildMember | null = await guild.members
    .fetch(interaction.user.id)
    .catch(() => null);
  const heldRoles = refreshed?.roles.cache
    .filter((held) => held.id !== guild.id && held.comparePositionTo(me.roles.highest) < 0)
    .sort((a, b) => b.position - a.position)
    .map((held) => held.toString())
    .slice(0, 15);

  const statusLine = heldRoles?.length
    ? `**Your roles:** ${heldRoles.join(" ")}`
    : "**Your roles:** none yet";

  if (hasRole) {
    await interaction.editReply({
      embeds: [
        vyntricEmbed("warning")
          .setTitle("➖ Role Removed")
          .setDescription(`You no longer have ${role}.\n${statusLine}`),
      ],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      vyntricEmbed("success")
        .setTitle("✅ Role Added")
        .setDescription(
          `You now have ${role}!\n${statusLine}\n-# You can hold several roles at once — click a different button for each.`
        ),
    ],
  });
}

