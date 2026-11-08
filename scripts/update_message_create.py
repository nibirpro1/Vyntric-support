with open("src/events/messageCreate.ts", "r", encoding="utf-8") as f:
    code = f.read()

crlf = "\r\n" in code
code = code.replace("\r\n", "\n")

# 1. Update import
code = code.replace(
    'import { getSettings } from "../lib/store";',
    'import { findTicketByChannel, getSettings } from "../lib/store";'
)

# 2. Update author.bot handling
old_check = """  async execute(message: Message) {
    if (!message.guild || message.author.bot) return;"""

new_check = """  async execute(message: Message) {
    if (!message.guild) return;

    // Silence all other bots inside active ticket channels
    if (message.author.bot) {
      if (message.author.id !== message.client.user.id) {
        const ticket = findTicketByChannel(message.channel.id);
        if (ticket && ticket.status === "open") {
          await message.delete().catch(() => {});
        }
      }
      return;
    }"""

if old_check in code:
    code = code.replace(old_check, new_check)
    if crlf:
        code = code.replace("\n", "\r\n")
    with open("src/events/messageCreate.ts", "w", encoding="utf-8") as f:
        f.write(code)
    print("messageCreate.ts updated successfully!")
else:
    print("Could not find old_check in messageCreate.ts")
