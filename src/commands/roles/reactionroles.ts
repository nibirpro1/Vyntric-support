import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import {
  findPanel,
  getPanels,
  ReactionRolePanel,
  RoleOption,
  savePanel,
} from "../../lib/reactionRoleStore";
import { BRAND } from "../../lib/brand";

function buttonStyleFromStr(style?: string): ButtonStyle {
  switch (style) {
    case "success":
      return ButtonStyle.Success;
    case "danger":
      return ButtonStyle.Danger;
    case "secondary":
      return ButtonStyle.Secondary;
    default:
      return ButtonStyle.Primary;
  }
}

export function buildPanelComponents(roles: RoleOption[]): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  for (let i = 0; i < roles.length; i++) {
    const r = roles[i];
    const btn = new ButtonBuilder()
      .setCustomId(`rr:${r.roleId}`)
      .setLabel(r.label)
      .setStyle(buttonStyleFromStr(r.style));

    if (r.emoji) {
      btn.setEmoji(r.emoji);
    }

    currentRow.addComponents(btn);

    if (currentRow.components.length === 5 || i === roles.length - 1) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
  }

  return rows;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("reactionroles")
    .setDescription("Carl-bot style interactive Reaction Roles & Button panels")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new interactive reaction role panel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to post the role panel in")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("title").setDescription("Panel title").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Panel description / instructions").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a role button to an existing panel")
        .addStringOption((opt) =>
          opt.setName("message_id").setDescription("Message ID of the panel").setRequired(true)
        )
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("The role to grant / remove").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("label").setDescription("Button label (e.g. 'Announcements')").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("emoji").setDescription("Optional button emoji (e.g. 🔔, 🎮)").setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("style")
            .setDescription("Button style color")
            .setRequired(false)
            .addChoices(
              { name: "Blue (Primary)", value: "primary" },
              { name: "Grey (Secondary)", value: "secondary" },
              { name: "Green (Success)", value: "success" },
              { name: "Red (Danger)", value: "danger" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all active reaction role panels")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    switch (sub) {
      case "create": {
        const channel = interaction.options.getChannel("channel", true) as TextChannel;
        const title = interaction.options.getString("title", true);
        const description = interaction.options.getString("description", true);

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle(title)
          .setDescription(description)
          .setFooter({ text: "Click the buttons below to pick your roles!" })
          .setTimestamp();

        const msg = await channel.send({ embeds: [embed] });

        const panel: ReactionRolePanel = {
          id: `rr_${Date.now()}`,
          guildId,
          channelId: channel.id,
          messageId: msg.id,
          title,
          description,
          roles: [],
          createdAt: Date.now(),
        };

        savePanel(panel);

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.success)
              .setTitle("✅ Reaction Role Panel Created!")
              .setDescription(
                [
                  `📢 **Channel:** <#${channel.id}>`,
                  `🆔 **Message ID:** \`${msg.id}\``,
                  `🔗 **Jump:** [View Message](${msg.url})`,
                  "",
                  "👉 Now use `/reactionroles add message_id:" + msg.id + " ...` to add role buttons!",
                ].join("\n")
              ),
          ],
        });
        break;
      }

      case "add": {
        const messageId = interaction.options.getString("message_id", true);
        const role = interaction.options.getRole("role", true) as Role;
        const label = interaction.options.getString("label", true);
        const emoji = interaction.options.getString("emoji") || undefined;
        const style = (interaction.options.getString("style") as any) || "primary";

        const panel = findPanel(guildId, messageId);
        if (!panel) {
          await interaction.reply({
            content: `❌ Could not find a panel with Message ID \`${messageId}\`. Make sure it was created with \`/reactionroles create\`.`,
            ephemeral: true,
          });
          return;
        }

        const channel = interaction.guild.channels.cache.get(panel.channelId) as TextChannel | undefined;
        if (!channel) {
          await interaction.reply({ content: "❌ Target channel not found.", ephemeral: true });
          return;
        }

        const targetMsg = await channel.messages.fetch(panel.messageId).catch(() => null);
        if (!targetMsg) {
          await interaction.reply({ content: "❌ Could not fetch panel message from Discord.", ephemeral: true });
          return;
        }

        // Check if role is already in panel
        const existingIdx = panel.roles.findIndex((r) => r.roleId === role.id);
        const roleOpt: RoleOption = { roleId: role.id, label, emoji, style };

        if (existingIdx >= 0) {
          panel.roles[existingIdx] = roleOpt;
        } else {
          if (panel.roles.length >= 25) {
            await interaction.reply({ content: "❌ Maximum 25 roles per panel allowed.", ephemeral: true });
            return;
          }
          panel.roles.push(roleOpt);
        }

        savePanel(panel);

        const rows = buildPanelComponents(panel.roles);

        // Update the embed with listed roles
        const roleListDesc =
          panel.description +
          "\n\n**Available Roles:**\n" +
          panel.roles.map((r) => `${r.emoji || "🔘"} <@&${r.roleId}> — **${r.label}**`).join("\n");

        const updatedEmbed = EmbedBuilder.from(targetMsg.embeds[0] || new EmbedBuilder())
          .setDescription(roleListDesc)
          .setColor(BRAND.colors.primary);

        await targetMsg.edit({
          embeds: [updatedEmbed],
          components: rows,
        });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.success)
              .setDescription(`✅ Added button for **<@&${role.id}>** (\`${label}\`) to the panel!`),
          ],
        });
        break;
      }

      case "list": {
        const panels = getPanels(guildId);
        if (panels.length === 0) {
          await interaction.reply({
            content: "📭 No reaction role panels found. Create one with `/reactionroles create`!",
            ephemeral: true,
          });
          return;
        }

        const lines = panels.map(
          (p, i) =>
            `**${i + 1}.** **${p.title}** in <#${p.channelId}> (Message ID: \`${p.messageId}\`) — **${p.roles.length} roles**`
        );

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.primary)
              .setTitle(`🎭 Reaction Role Panels (${panels.length})`)
              .setDescription(lines.join("\n\n")),
          ],
        });
        break;
      }
    }
  },
};

export default command;
