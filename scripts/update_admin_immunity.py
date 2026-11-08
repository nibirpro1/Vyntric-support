with open("src/events/messageCreate.ts", "r", encoding="utf-8") as f:
    code = f.read()

crlf = "\r\n" in code
code = code.replace("\r\n", "\n")

# 1. Update bot check in ticket channels to allow admin bots if needed
old_bot_check = """    // Silence all other bots inside active ticket channels
    if (message.author.bot) {
      if (message.author.id !== message.client.user.id) {
        const ticket = findTicketByChannel(message.channel.id);
        if (ticket && ticket.status === "open") {
          await message.delete().catch(() => {});
        }
      }
      return;
    }"""

new_bot_check = """    // Silence non-admin bots inside active ticket channels
    if (message.author.bot) {
      if (message.author.id !== message.client.user.id) {
        // If the bot has Administrator permissions, allow it through
        const isBotAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
        if (!isBotAdmin) {
          const ticket = findTicketByChannel(message.channel.id);
          if (ticket && ticket.status === "open") {
            await message.delete().catch(() => {});
          }
        }
      }
      return;
    }"""

# 2. Update staff/admin immunity to be unconditionally TRUE for Discord Administrators
old_immunity = """    // Check staff immunity (only active if adminImmunity is toggled on in config)
    const isAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ||
      member?.permissions.has(PermissionFlagsBits.ManageGuild);
    const isStaff = member?.roles.cache.some((r) =>
      settings.staffRoleIds?.includes(r.id)
    );
    const isImmune = autoMod.adminImmunity && (isAdmin || isStaff);"""

new_immunity = """    // Discord Administrators & Staff are ALWAYS immune - never auto-delete admin messages
    const isAdmin =
      member?.permissions.has(PermissionFlagsBits.Administrator) ||
      member?.permissions.has(PermissionFlagsBits.ManageGuild);
    const isStaff = member?.roles.cache.some((r) =>
      settings.staffRoleIds?.includes(r.id)
    );
    const isImmune = isAdmin || isStaff || autoMod.adminImmunity;"""

if old_bot_check in code:
    code = code.replace(old_bot_check, new_bot_check)
    print("Updated bot check!")
else:
    print("Could not find old_bot_check")

if old_immunity in code:
    code = code.replace(old_immunity, new_immunity)
    print("Updated immunity!")
else:
    print("Could not find old_immunity")

if crlf:
    code = code.replace("\n", "\r\n")

with open("src/events/messageCreate.ts", "w", encoding="utf-8") as f:
    f.write(code)

print("Saved messageCreate.ts!")
