with open("src/events/messageCreate.ts", "r", encoding="utf-8") as f:
    code = f.read()

crlf = "\r\n" in code
code = code.replace("\r\n", "\n")

old_bot_check = """    // Silence non-admin bots inside active ticket channels
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

new_bot_check = """    // Silence ALL other bots inside active ticket channels (even if another bot has Administrator role)
    if (message.author.bot) {
      if (message.author.id !== message.client.user.id) {
        const ticket = findTicketByChannel(message.channel.id);
        if (ticket && ticket.status === "open") {
          // Immediately wipe other bot's message so only Plugsy and human staff can talk
          await message.delete().catch(() => {});
        }
      }
      return;
    }"""

if old_bot_check in code:
    code = code.replace(old_bot_check, new_bot_check)
    print("Updated bot check!")
else:
    print("Could not find old_bot_check")

if crlf:
    code = code.replace("\n", "\r\n")

with open("src/events/messageCreate.ts", "w", encoding="utf-8") as f:
    f.write(code)

print("Saved messageCreate.ts!")
