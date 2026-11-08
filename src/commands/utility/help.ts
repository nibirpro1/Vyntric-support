import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { BRAND } from "../../lib/brand";

interface CategoryDoc {
  id: string;
  label: string;
  emoji: string;
  description: string;
  commands: {
    name: string;
    syntax: string;
    summary: string;
    details: string;
    permission?: string;
  }[];
}

const CATEGORIES: CategoryDoc[] = [
  {
    id: "giveaway",
    label: "Giveaway System",
    emoji: "🎁",
    description: "Start giveaways, manage winners, rerolls, and button/reaction entries.",
    commands: [
      {
        name: "giveaway start",
        syntax: "/giveaway start prize: <text> duration: <time> winners: [num] channel: [#channel]",
        summary: "Launch a new giveaway with buttons and reactions.",
        details:
          "Example: `/giveaway start prize: Nitro duration: 1d winners: 1`\nSupports time formats: `10m`, `2h`, `1d`, `7d`. Members enter by clicking the 🎉 button or reaction.",
        permission: "Manage Server / Staff",
      },
      {
        name: "giveaway setwinner",
        syntax: "/giveaway setwinner message_id: <id> winners: @user1 @user2",
        summary: "Pre-select or force specific winner(s) for a giveaway.",
        details:
          "You can select exactly who wins regardless of entry count! Supports single or multiple winners.",
        permission: "Manage Server / Staff",
      },
      {
        name: "giveaway resetwinner",
        syntax: "/giveaway resetwinner message_id: <id>",
        summary: "Clear manually set winners and revert back to random drawing.",
        details: "Removes forced winners and allows the bot to pick random winners among all participants.",
        permission: "Manage Server / Staff",
      },
      {
        name: "giveaway reroll",
        syntax: "/giveaway reroll message_id: <id> count: [num]",
        summary: "Pick new winner(s) for an already ended giveaway.",
        details: "Useful when a previous winner was inactive, failed requirements, or left the server.",
        permission: "Manage Server / Staff",
      },
      {
        name: "giveaway end",
        syntax: "/giveaway end message_id: <id>",
        summary: "Immediately end an active giveaway and draw winners.",
        details: "Picks winners instantly without waiting for the timer to expire.",
        permission: "Manage Server / Staff",
      },
      {
        name: "giveaway list",
        syntax: "/giveaway list",
        summary: "View all active giveaways running on the server.",
        details: "Displays prizes, message IDs, time remaining, and total entries.",
      },
      {
        name: "giveaway cancel",
        syntax: "/giveaway cancel message_id: <id>",
        summary: "Cancel an active giveaway without picking any winner.",
        details: "Deletes the timer and updates the embed to cancelled status.",
        permission: "Manage Server / Staff",
      },
    ],
  },
  {
    id: "announce",
    label: "Announcements & DM Alerts",
    emoji: "📢",
    description: "Server-wide announcements with rich embeds and automatic DM broadcasts.",
    commands: [
      {
        name: "announcement",
        syntax: "/announcement title: <text> message: <text> channel: [#channel] ping: [everyone|here|none] dm: [true|false]",
        summary: "Broadcast a styled announcement and optional DM alert to all members.",
        details:
          "• `dm: true` sends the announcement straight into every human member's DM with Vyntric logo and jump button.\n• Features automatic rate limit handling so DMs are delivered safely.",
        permission: "Administrator / Staff",
      },
      {
        name: "uhc",
        syntax: "/uhc title: <text> ip: <server_ip> date: <text> time: <time> version: <mc_version>",
        summary: "Post a formatted Minecraft UHC match schedule.",
        details: "Announces tournament details, IP, game rules, and schedule in the announcement feed.",
        permission: "Staff",
      },
    ],
  },
  {
    id: "tickets",
    label: "Tickets & Support System",
    emoji: "🎫",
    description: "Multi-category ticket system with Claim, Applications, Partnerships, and Reviews.",
    commands: [
      {
        name: "panel",
        syntax: "/panel channel: [#channel]",
        summary: "Send the interactive ticket panel to a support channel.",
        details:
          "Sends buttons: 🎁 Claim Reward, 📝 Team Application, 🤝 Partnership, ❓ General Support. Members click a button to open an instant private ticket.",
        permission: "Administrator",
      },
      {
        name: "ticket close",
        syntax: "/ticket close reason: [optional_text]",
        summary: "Close the current ticket channel, save transcript, and request feedback rating.",
        details: "Members receive a 1-5 star review prompt, and the transcript is archived.",
        permission: "Staff / Ticket Owner",
      },
      {
        name: "ticket claim",
        syntax: "/ticket claim",
        summary: "Claim ownership of a ticket so other staff know you are handling it.",
        details: "Updates ticket status and locks staff handling to you.",
        permission: "Staff",
      },
      {
        name: "ticket add / remove",
        syntax: "/ticket add user: @user | /ticket remove user: @user",
        summary: "Add or remove members from viewing the current ticket channel.",
        details: "Grants or revokes channel view permissions for the specified member.",
        permission: "Staff",
      },
      {
        name: "ticket rename",
        syntax: "/ticket rename name: <new_name>",
        summary: "Rename the current ticket channel.",
        details: "Updates channel name while preserving ticket counter.",
        permission: "Staff",
      },
    ],
  },
  {
    id: "moderation",
    label: "Moderation & Security",
    emoji: "🛡️",
    description: "Keep the server secure with bans, mutes, warnings, auto-mod, and logging.",
    commands: [
      {
        name: "ban",
        syntax: "/ban user: @user reason: [text] delete_messages: [days]",
        summary: "Ban a user from the server.",
        details: "Removes user and optionally purges their recent messages (0-7 days).",
        permission: "Ban Members",
      },
      {
        name: "kick",
        syntax: "/kick user: @user reason: [text]",
        summary: "Kick a user from the server.",
        details: "Kicks the user. They can rejoin with a valid invite.",
        permission: "Kick Members",
      },
      {
        name: "timeout",
        syntax: "/timeout user: @user duration: <time> reason: [text]",
        summary: "Mute / timeout a member (e.g. 10m, 1h, 1d).",
        details: "Prevents member from chatting, reacting, or speaking in voice channels.",
        permission: "Moderate Members",
      },
      {
        name: "untimeout",
        syntax: "/untimeout user: @user",
        summary: "Remove an active timeout from a member early.",
        details: "Restores normal member permissions immediately.",
        permission: "Moderate Members",
      },
      {
        name: "warn",
        syntax: "/warn user: @user reason: <text>",
        summary: "Issue an official warning to a member.",
        details: "Logs the warning in the database and DMs the user with the reason.",
        permission: "Manage Messages / Staff",
      },
      {
        name: "clear",
        syntax: "/clear amount: <1-100> user: [@optional_user]",
        summary: "Bulk delete messages in the current channel.",
        details: "Deletes up to 100 messages at once. Can filter to only delete a specific user's messages.",
        permission: "Manage Messages",
      },
      {
        name: "automod",
        syntax: "/automod",
        summary: "Configure anti-spam, invite blocking, and word filters.",
        details: "Enables automated filters to protect against raid attacks, link spammers, and profanity.",
        permission: "Administrator",
      },
      {
        name: "logs",
        syntax: "/logs channel: [#channel] type: [all|moderation|messages|members]",
        summary: "Set up audit logging channels for edits, deletes, bans, and joins.",
        details: "Sends rich embeds whenever members edit/delete messages or staff take moderation action.",
        permission: "Administrator",
      },
    ],
  },
  {
    id: "tiers",
    label: "Vyntric Tiers & Testing",
    emoji: "⚔️",
    description: "Player tiering, test results, strikes, blacklists, rules, and server IPs.",
    commands: [
      {
        name: "tier",
        syntax: "/tier player: <username>",
        summary: "View player tier profile, history, and test record.",
        details: "Shows HT1-LT5 rank, previous test dates, testers, and current status.",
      },
      {
        name: "settier",
        syntax: "/settier player: <username> tier: <HT1-LT5> tester: @tester",
        summary: "Set or promote a player's official tier rank.",
        details: "Updates tier database and logs the promotion in the results channel.",
        permission: "Tester / Staff",
      },
      {
        name: "hightest",
        syntax: "/hightest player: <username> tier: <rank> result: <pass|fail> score: <text>",
        summary: "Log High Tier test results and post official embed.",
        details: "Announces high tier testing outcomes in the high-results feed.",
        permission: "High Tester / Staff",
      },
      {
        name: "strike",
        syntax: "/strike add: @user reason: <text> | /strike list: @user | /strike remove",
        summary: "Issue, view, or remove tier strikes on players.",
        details: "Tracks competitive strikes for rule-breaking during official matches.",
        permission: "Staff",
      },
      {
        name: "punish",
        syntax: "/punish user: @user type: [blacklist|ban|mute] reason: <text>",
        summary: "Log a tier blacklist or punishment with duration.",
        details: "Stores punishment record and publishes to punishments channel.",
        permission: "Staff",
      },
      {
        name: "rules",
        syntax: "/rules category: [general|tier-testing|uhc]",
        summary: "Display official Vyntric tournament and testing rules.",
        details: "Shows formatted rule guidelines with match regulations.",
      },
      {
        name: "servers",
        syntax: "/servers",
        summary: "View official Vyntric partner server IPs and domains.",
        details: "Lists Minecraft server addresses, regions, and current status.",
      },
    ],
  },
  {
    id: "management",
    label: "Staff & Management",
    emoji: "👥",
    description: "Trial tracking, staff tasks, meetings, proof uploads, and SOPs.",
    commands: [
      {
        name: "trial",
        syntax: "/trial start: @user role: <role> duration: <days> | /trial promote | /trial extend",
        summary: "Manage staff trial periods, evaluations, and promotions.",
        details: "Tracks staff trainees from start date to final review.",
        permission: "Head Staff / Admin",
      },
      {
        name: "task",
        syntax: "/task create: <title> assign: @staff priority: [high|normal] | /task list",
        summary: "Create and track to-do tasks for staff members.",
        details: "Assign tasks with deadlines and mark them completed.",
        permission: "Staff",
      },
      {
        name: "meeting",
        syntax: "/meeting title: <text> time: <time> agenda: <text>",
        summary: "Schedule a staff meeting with interactive RSVP buttons.",
        details: "Staff can click 'Attend' or 'Decline' to RSVP directly inside the embed.",
        permission: "Management",
      },
      {
        name: "proof",
        syntax: "/proof target: <username> type: [ban|mute] evidence: <url|attachment>",
        summary: "Upload moderation clips and screenshot evidence.",
        details: "Archives proof files for player ban appeals.",
        permission: "Staff",
      },
      {
        name: "sop",
        syntax: "/sop section: [tickets|moderation|appeals]",
        summary: "View Standard Operating Procedures for staff duties.",
        details: "Interactive staff handbook explaining protocol for common scenarios.",
        permission: "Staff",
      },
      {
        name: "staffannounce",
        syntax: "/staffannounce message: <text>",
        summary: "Post an announcement inside the internal staff channel.",
        details: "Sends urgent staff notices without alerting public channels.",
        permission: "Management",
      },
      {
        name: "staffmvp",
        syntax: "/staffmvp user: @staff month: <month> reason: <text>",
        summary: "Award Staff Member of the Month with celebratory embed.",
        details: "Highlights top staff contributors in the public announcement feed.",
        permission: "Management",
      },
    ],
  },
  {
    id: "music",
    label: "Music System",
    emoji: "🎵",
    description: "High-quality YouTube & Spotify audio streaming with full playback controls.",
    commands: [
      {
        name: "play",
        syntax: "/play query: <song_name_or_url>",
        summary: "Play a song or playlist in your current voice channel.",
        details: "Supports YouTube video links, playlist links, and search queries.",
      },
      {
        name: "pause / resume",
        syntax: "/pause | /resume",
        summary: "Pause or unpause currently playing music.",
        details: "Toggles playback without clearing the queue.",
      },
      {
        name: "skip",
        syntax: "/skip",
        summary: "Skip to the next song in the queue.",
        details: "Instantly plays the next track.",
      },
      {
        name: "stop",
        syntax: "/stop",
        summary: "Stop playing music and disconnect bot from voice channel.",
        details: "Clears current song queue and leaves voice channel.",
      },
      {
        name: "queue",
        syntax: "/queue page: [number]",
        summary: "View the list of songs queued to play next.",
        details: "Shows track titles, durations, and requested-by tags.",
      },
      {
        name: "nowplaying",
        syntax: "/nowplaying",
        summary: "Display details and progress bar for the currently playing track.",
        details: "Shows visual progress bar, time elapsed, and audio quality.",
      },
      {
        name: "loop",
        syntax: "/loop mode: [song|queue|off]",
        summary: "Repeat current track or entire queue in a loop.",
        details: "Keeps music playing continuously.",
      },
      {
        name: "shuffle",
        syntax: "/shuffle",
        summary: "Randomly shuffle the upcoming song queue.",
        details: "Rearranges queued songs in random order.",
      },
      {
        name: "volume",
        syntax: "/volume percent: <1-100>",
        summary: "Adjust music output volume.",
        details: "Default is 100%. Adjusts bot volume cleanly.",
      },
    ],
  },
  {
    id: "roles",
    label: "Roles & Self Roles",
    emoji: "🎭",
    description: "Reaction roles, self-assignable buttons, and tester role assignments.",
    commands: [
      {
        name: "reactionroles",
        syntax: "/reactionroles create title: <title> role: @role channel: [#channel]",
        summary: "Create button-based reaction role panels.",
        details: "Members click a button to toggle roles on/off instantly without typing commands.",
        permission: "Manage Roles / Admin",
      },
      {
        name: "selfrole",
        syntax: "/selfrole channel: [#channel]",
        summary: "Deploy notification & ping role selection menus.",
        details: "Allows members to opt into Announcement, Giveaway, or Event pings.",
        permission: "Administrator",
      },
      {
        name: "tester",
        syntax: "/tester assign: @user rung: [junior|senior|lead]",
        summary: "Assign or adjust tester hierarchy roles.",
        details: "Grants testing permissions and updates staff logs.",
        permission: "Head Tester / Admin",
      },
    ],
  },
  {
    id: "utility",
    label: "Utility & Settings",
    emoji: "⚙️",
    description: "Bot configuration, auto-responder, welcome messages, embeds, and info.",
    commands: [
      {
        name: "help",
        syntax: "/help [command: <name>]",
        summary: "Interactive menu explaining all bot commands, usage, and examples.",
        details: "Use the category menu to browse all 46 commands or specify a command name.",
      },
      {
        name: "setup",
        syntax: "/setup",
        summary: "Interactive setup wizard for ticket categories, review channels, and logs.",
        details: "One-command full server configuration wizard for Plugsy.",
        permission: "Administrator",
      },
      {
        name: "autoresponder",
        syntax: "/autoresponder add trigger: <keyword> reply: <message> | /autoresponder list",
        summary: "Create custom automated chat replies for keywords.",
        details: "Whenever a user mentions the trigger keyword, the bot replies with your custom response.",
        permission: "Manage Server",
      },
      {
        name: "welcome",
        syntax: "/welcome channel: [#channel] message: <text> autorole: [@role]",
        summary: "Configure join greeting embeds and automatic new-member roles.",
        details: "Greets new members with custom avatar cards and grants default roles.",
        permission: "Administrator",
      },
      {
        name: "embed",
        syntax: "/embed channel: [#channel] title: <title> description: <text> color: [hex]",
        summary: "Build and send custom rich embeds to any channel.",
        details: "Send clean, professional embeds for rules, links, or guides.",
        permission: "Manage Messages",
      },
      {
        name: "serverinfo",
        syntax: "/serverinfo",
        summary: "View server stats, boost level, member counts, and creation date.",
        details: "Displays complete overview of the current Discord server.",
      },
      {
        name: "userinfo",
        syntax: "/userinfo user: [@optional_user]",
        summary: "View user account age, join date, roles, and avatar.",
        details: "Displays join position, permissions, and profile information.",
      },
    ],
  },
];

function buildOverviewEmbed(guildName?: string, iconUrl?: string | null) {
  const totalCommands = CATEGORIES.reduce((acc, cat) => acc + cat.commands.length, 0);

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(`📖 ${guildName || "Vyntric"} • Complete Command Guide`)
    .setDescription(
      `Welcome to **Plugsy**! Below is the complete catalog of all **${totalCommands} commands** available on this server.\n\n` +
        `Select a category from the **dropdown menu below** to see full syntax, required permissions, and examples for each command!`
    )
    .setThumbnail(iconUrl || null)
    .setFooter({ text: "Use /help [command] for direct command documentation" });

  for (const cat of CATEGORIES) {
    const list = cat.commands.map((c) => `\`/${c.name}\``).join(", ");
    embed.addFields({
      name: `${cat.emoji} ${cat.label} (${cat.commands.length})`,
      value: `${cat.description}\n${list}`,
      inline: false,
    });
  }

  return embed;
}

function buildCategoryEmbed(cat: CategoryDoc, guildName?: string, iconUrl?: string | null) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(`${cat.emoji} ${cat.label} — Command Guide`)
    .setDescription(`${cat.description}\n\n**Commands in this section:** ${cat.commands.length}`)
    .setThumbnail(iconUrl || null)
    .setFooter({ text: "Use the dropdown menu to switch categories anytime." });

  for (const cmd of cat.commands) {
    const permText = cmd.permission ? `🔒 **Permission:** \`${cmd.permission}\`\n` : "";
    embed.addFields({
      name: `⌨️ /${cmd.name}`,
      value: `**Usage:** \`${cmd.syntax}\`\n${permText}📝 ${cmd.summary}\n> ${cmd.details.replace(/\n/g, "\n> ")}`,
      inline: false,
    });
  }

  return embed;
}

function buildSelectMenu(currentId?: string) {
  const select = new StringSelectMenuBuilder()
    .setCustomId("help_category_select")
    .setPlaceholder("📂 Select a category to see how each command works...");

  select.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel("All Categories Overview")
      .setValue("overview")
      .setDescription("Summary of all bot features and command lists")
      .setEmoji("📖")
      .setDefault(currentId === "overview" || !currentId)
  );

  for (const cat of CATEGORIES) {
    select.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(cat.label)
        .setValue(cat.id)
        .setDescription(cat.description.slice(0, 100))
        .setEmoji(cat.emoji)
        .setDefault(currentId === cat.id)
    );
  }

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("View documentation, usage, and examples for all Plugsy commands")
    .addStringOption((opt) =>
      opt
        .setName("command")
        .setDescription("View detailed documentation for a specific command")
        .setRequired(false)
        .addChoices(
          { name: "giveaway", value: "giveaway" },
          { name: "announcement", value: "announcement" },
          { name: "panel (tickets)", value: "panel" },
          { name: "ticket", value: "ticket" },
          { name: "ban", value: "ban" },
          { name: "kick", value: "kick" },
          { name: "timeout", value: "timeout" },
          { name: "automod", value: "automod" },
          { name: "play (music)", value: "play" },
          { name: "setup", value: "setup" },
          { name: "tier", value: "tier" },
          { name: "settier", value: "settier" },
          { name: "meeting", value: "meeting" },
          { name: "reactionroles", value: "reactionroles" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const specificCmd = interaction.options.getString("command")?.toLowerCase();
    const guild = interaction.guild;
    const guildName = guild?.name || "Vyntric";
    const iconUrl = guild?.iconURL({ size: 256 }) || undefined;

    // Direct search for a single command if requested
    if (specificCmd) {
      let foundCat: CategoryDoc | undefined;
      let foundCmd: (typeof CATEGORIES)[0]["commands"][0] | undefined;

      for (const cat of CATEGORIES) {
        for (const cmd of cat.commands) {
          if (cmd.name.toLowerCase().includes(specificCmd)) {
            foundCat = cat;
            foundCmd = cmd;
            break;
          }
        }
        if (foundCmd) break;
      }

      if (foundCmd && foundCat) {
        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle(`📖 Command Help: /${foundCmd.name}`)
          .setDescription(`Category: ${foundCat.emoji} **${foundCat.label}**\n\n${foundCmd.summary}`)
          .setThumbnail(iconUrl || null)
          .addFields(
            { name: "⌨️ Syntax & Usage", value: `\`${foundCmd.syntax}\``, inline: false },
            {
              name: "🔒 Permission",
              value: foundCmd.permission ? `\`${foundCmd.permission}\`` : "Everyone",
              inline: true,
            },
            {
              name: "💡 Details & Example",
              value: foundCmd.details,
              inline: false,
            }
          )
          .setFooter({ text: "Run /help without arguments to browse all categories" });

        await interaction.reply({
          embeds: [embed],
          components: [buildSelectMenu(foundCat.id)],
        });
        return;
      }
    }

    // Default overview page
    const initialEmbed = buildOverviewEmbed(guildName, iconUrl);
    const initialMenu = buildSelectMenu("overview");

    const replyMsg = await interaction.reply({
      embeds: [initialEmbed],
      components: [initialMenu],
      fetchReply: true,
    });

    // Create interactive collector for dropdown menu
    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300_000, // 5 minutes
    });

    collector.on("collect", async (menuInt) => {
      if (menuInt.user.id !== interaction.user.id) {
        await menuInt.reply({
          content: "❌ Run `/help` yourself to navigate your own menu.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const selected = menuInt.values[0];
      if (selected === "overview") {
        await menuInt.update({
          embeds: [buildOverviewEmbed(guildName, iconUrl)],
          components: [buildSelectMenu("overview")],
        });
        return;
      }

      const category = CATEGORIES.find((c) => c.id === selected);
      if (!category) {
        await menuInt.update({
          embeds: [buildOverviewEmbed(guildName, iconUrl)],
          components: [buildSelectMenu("overview")],
        });
        return;
      }

      await menuInt.update({
        embeds: [buildCategoryEmbed(category, guildName, iconUrl)],
        components: [buildSelectMenu(category.id)],
      });
    });

    collector.on("end", async () => {
      // Disable the menu when collector expires
      try {
        const disabledMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("help_expired")
            .setPlaceholder("⌛ Menu expired. Run /help again.")
            .setDisabled(true)
            .addOptions({ label: "Expired", value: "expired" })
        );
        await interaction.editReply({ components: [disabledMenu] }).catch(() => null);
      } catch {
        /* message already deleted or expired */
      }
    });
  },
};

export default command;
