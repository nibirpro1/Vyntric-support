with open("src/interactions/ticketInteractions.ts", "r", encoding="utf-8") as f:
    text = f.read()

# Normalize to LF for easy replacement
crlf = "\r\n" in text
text = text.replace("\r\n", "\n")

# 1. Update imports
text = text.replace(
    "  StringSelectMenuInteraction,\n",
    "  StringSelectMenuBuilder,\n  StringSelectMenuInteraction,\n"
)
text = text.replace(
    'import { findTicketType } from "../config/tickets";',
    'import { TICKET_TYPES, findTicketType } from "../config/tickets";'
)

# 2. Add functions
new_funcs = """
/** Unified v2 panel button pressed -> show category select dropdown */
export async function handleOpenSelectorButton(interaction: ButtonInteraction) {
  if (!interaction.guild) return;

  const menu = new StringSelectMenuBuilder()
    .setCustomId(IDS.categorySelect)
    .setPlaceholder("Select a ticket category to open...")
    .addOptions(
      TICKET_TYPES.map((type) => ({
        label: type.label,
        value: type.id,
        emoji: type.emoji,
        description: type.blurb.slice(0, 100),
      }))
    );

  await interaction.reply({
    content: "📋 **Please select the category that best matches your request:**",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
    flags: MessageFlags.Ephemeral,
  });
}

/** Category selected from menu -> show modal form for that category */
export async function handleCategorySelect(interaction: StringSelectMenuInteraction) {
  if (!interaction.guild) return;

  const typeId = interaction.values[0];
  const type = findTicketType(typeId);
  if (!type) {
    await deny(interaction, "This ticket category is no longer available.");
    return;
  }

  const existing = findOpenTicketOfType(interaction.guild.id, interaction.user.id, type.id);
  if (existing) {
    await interaction.update({
      content: `⚠️ You already have an open **${type.label}** ticket: <#${existing.channelId}>`,
      components: [],
    });
    return;
  }

  await interaction.showModal(buildTicketModal(type));
}
"""

text = text.replace(
    "/** Panel button pressed -> type-specific private form. */",
    new_funcs + "\n/** Panel button pressed -> type-specific private form. */"
)

btn_hook = """    if (customId === IDS.openSelector) {
      await handleOpenSelectorButton(interaction);
      return true;
    }
    if (customId.startsWith(IDS.openPrefix)) {"""

text = text.replace("    if (customId.startsWith(IDS.openPrefix)) {", btn_hook)

select_hook = """  if (interaction.isStringSelectMenu()) {
    if (customId === IDS.categorySelect) {
      await handleCategorySelect(interaction);
      return true;
    }
    if (customId === IDS.priority) {"""

text = text.replace("  if (interaction.isStringSelectMenu()) {\n    if (customId === IDS.priority) {", select_hook)

if crlf:
    text = text.replace("\n", "\r\n")

with open("src/interactions/ticketInteractions.ts", "w", encoding="utf-8") as f:
    f.write(text)

print("Updated ticketInteractions.ts successfully!")
