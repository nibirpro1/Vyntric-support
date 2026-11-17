import {
  ActionRowBuilder,
  EmbedBuilder,
  Guild,
  GuildMember,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import { BRAND } from "./brand";
import { PERMISSION_ROLE_DEFS } from "./permissionRolesStore";

export interface HelpCategory {
  id: string;
  name: string;
  emoji: string;
  shortDesc: string;
  embed: (guild: Guild) => EmbedBuilder;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "overview",
    name: "Master Overview & Index",
    emoji: "🧭",
    shortDesc: "Vyntric Bot features overview & administrator navigation",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`🛡️ ${guild.name} • Administrator Master Help Hub`)
        .setDescription(
          `Welcome to the **Vyntric Advanced Bot System**!\n` +
          `This system is customized exclusively for **${guild.name}**.\n\n` +
          `📌 **Access Level:** \`Administrator Only\`\n` +
          `⚡ **Prefixes:** Works with slash commands (\`/\`), prefixless (\`warn @user\`, \`mute @user\`), or prefixes (\`!\`, \`.\`, \`?\`)\n` +
          `🛡️ **Moderation Policy:** **Timeout Only Policy** (\`no kicks, no bans\`). All escalations & penalties are timeouts.\n\n` +
          `Select any module from the dropdown below to view full details:`
        )
        .addFields(
          {
            name: "1. 🛡️ Modular Permission Roles (`/perms`)",
            value: "11 dedicated feature roles to grant permissions to staff without making them Administrator.",
            inline: false,
          },
          {
            name: "2. ⚠️ Warn & Strike System",
            value: "Automatic strike escalation ladder (Strike 2: 10m, Strike 3: 1h, Strike 4: 12h, Strike 5: 24h, Strike 6+: 3d).",
            inline: false,
          },
          {
            name: "3. 🔇 Text-Based Moderation",
            value: "Type `warn @user <reason>`, `mute @user [duration] [reason]`, `warns @user` directly in chat without `/`.",
            inline: false,
          },
          {
            name: "4. 📢 Announcements & UHC Channels",
            value: "Channel-locked roles: `📢 Server Announce` for `#announcement`, `⚔️ UHC Announce` for `#uhc-events`.",
            inline: false,
          },
          {
            name: "5. 🎁 Advanced Giveaway System",
            value: "Persistent giveaways, button entries, `/giveaway setwinner` to force winners, auto-draw & winner ping.",
            inline: false,
          },
          {
            name: "6. 🎙️ Voice Channel Moderation & Anti-Ear Rape",
            value: "VC bans, instant disconnects, and automatic ear-rape soundboard spam detection.",
            inline: false,
          },
          {
            name: "7. 🛡️ AutoMod & Gali Protection",
            value: "Full Bangla, English & Hindi gali filters, invite blocker, link filtering, and anti-spam.",
            inline: false,
          },
          {
            name: "8. 🎫 Support Ticket System",
            value: "Interactive ticket panels, staff claiming, transcripts, and member satisfaction ratings.",
            inline: false,
          },
          {
            name: "9. 🔐 Anti-Nuke & Server Security",
            value: "Automatic protection against unauthorized bot additions, channel deletions, and mass actions.",
            inline: false,
          },
          {
            name: "10. 🚨 Anti-Raid & Emergency Lockdown",
            value: "Mass-join raid detection, account age gate (< 3d), anti-mention raid, `/antiraid`, and `/lockdown`.",
            inline: false,
          }
        )
        .setFooter({ text: `${BRAND.name} • Administrator System Guide` })
        .setTimestamp(),
  },
  {
    id: "perms",
    name: "Modular Permission Roles",
    emoji: "🛡️",
    shortDesc: "Roles for granting specific permissions to any member",
    embed: (guild: Guild) => {
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("🛡️ Modular Feature Permission Roles System")
        .setDescription(
          `Instead of giving full Administrator access to staff, you can assign these **11 dedicated roles** to grant access to individual features!\n\n` +
          `**Commands to manage permissions:**\n` +
          `• \`/perms give member:@user feature:<name>\` - Grant permission\n` +
          `• \`/perms remove member:@user feature:<name>\` - Revoke permission\n` +
          `• \`/perms check member:@user\` - View all permissions for a user\n` +
          `• \`/perms list feature:<name>\` - See who has this permission\n` +
          `• \`/perms roles\` - View all 11 permission roles\n\n` +
          `**All 11 Dedicated Roles in ${guild.name}:**`
        );

      for (const def of PERMISSION_ROLE_DEFS) {
        embed.addFields({
          name: `${def.emoji} ${def.name} (\`${def.key}\`)`,
          value: `• **Default Role ID:** \`${def.defaultId}\`\n• **Capability:** ${def.description}`,
          inline: false,
        });
      }

      embed.setFooter({ text: "Assign roles manually or use /perms give" }).setTimestamp();
      return embed;
    },
  },
  {
    id: "warn",
    name: "Warn & Strike System",
    emoji: "⚠️",
    shortDesc: "Automatic strike escalation & timeout-only penalty ladder",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(BRAND.colors.warning)
        .setTitle("⚠️ Warn & Strike Escalation System")
        .setDescription(
          `Comprehensive strike tracking for rule violations. Every warning is permanently logged with Case IDs.\n\n` +
          `🔒 **Policy Rule:** **Timeout Only Policy** (\`no banned no kick jus timeout\`).\n` +
          `Infractions escalate through longer timeouts rather than kicks or permanent bans.`
        )
        .addFields(
          {
            name: "📈 Auto-Escalation Ladder",
            value:
              "• **Strike 1:** Official warning logged + member receives DM notification.\n" +
              "• **Strike 2:** ⚠️ **10-Minute Timeout**\n" +
              "• **Strike 3:** 🛑 **1-Hour Timeout**\n" +
              "• **Strike 4:** 🚨 **12-Hour Timeout**\n" +
              "• **Strike 5:** 🔨 **24-Hour Timeout**\n" +
              "• **Strike 6+:** 🔨 **3-Day Timeout** (Capped safely under 28 days)",
            inline: false,
          },
          {
            name: "⌨️ How to Issue Warnings",
            value:
              "1. **Prefixless Text:** Type `warn @user [reason]`\n" +
              "2. **Prefix Text:** Type `!warn @user [reason]` or `.warn @user [reason]`\n" +
              "3. **Reply to message:** Reply to any message and type `warn [reason]`\n" +
              "4. **Slash Command:** `/warn add user:@user reason:<text>`",
            inline: false,
          },
          {
            name: "📋 Other Warning Commands",
            value:
              "• `/warn list user:@user` or `warns @user` - View active strikes and history\n" +
              "• `/warn clear user:@user` or `clearwarns @user` - Clear all warnings for member\n" +
              "• `/warn remove case_id:<id>` or `remwarn <id>` - Pardon a specific warning",
            inline: false,
          },
          {
            name: "🛡️ Who Can Warn?",
            value:
              "Administrators, Server Owner, or anyone with the **`⚖️ Warn & Mod Perms`** role (`1571509403918532618`).",
            inline: false,
          }
        )
        .setFooter({ text: `${guild.name} • Strict Timeout-Only Policy Enforced` })
        .setTimestamp(),
  },
  {
    id: "textmod",
    name: "Text Moderation & Timeout",
    emoji: "🔇",
    shortDesc: "Prefixless & quick moderation commands without slash",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle("🔇 Text Moderation & Timeout Commands")
        .setDescription(
          `Staff can moderate instantly using plain text messages without typing \`/\`.\n` +
          `Supports reply-to-target or user @mentions.`
        )
        .addFields(
          {
            name: "⏱️ Mute / Timeout Commands",
            value:
              "• `mute @user [time] [reason]` (e.g. `mute @user 10m spamming`, `mute @user 2h bad words`)\n" +
              "• `timeout @user [time] [reason]`\n" +
              "• `unmute @user` / `untimeout @user` - Remove timeout immediately\n" +
              "• *Time formats supported:* `30s`, `10m`, `1h`, `12h`, `1d`, `7d`",
            inline: false,
          },
          {
            name: "⚠️ Warn & Strike Text Commands",
            value:
              "• `warn @user <reason>` - Issues warning and applies auto-timeout escalation\n" +
              "• `warns @user` / `warnings @user` - Displays member warning records\n" +
              "• `clearwarns @user` / `unwarn @user` - Wipes active strikes for user\n" +
              "• `remwarn <case_id>` - Removes a single case ID",
            inline: false,
          },
          {
            name: "🚫 Kicking & Banning Policy",
            value:
              "• Server policy prohibits kicks and bans: `no banned no kick jus timeout`.\n" +
              "• If staff types `kick @user`, the bot automatically applies a **12-Hour Timeout** instead.\n" +
              "• If staff types `ban @user`, the bot automatically applies a **24-Hour Timeout** instead.",
            inline: false,
          }
        )
        .setFooter({ text: "Staff permission or ⚖️ Warn & Mod Perms required" })
        .setTimestamp(),
  },
  {
    id: "announce",
    name: "Announcements & UHC Feed",
    emoji: "📢",
    shortDesc: "Channel-isolated announcement permissions & DM broadcasts",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle("📢 Announcement Channels & Permissions")
        .setDescription(
          `Announcement permissions are separated between the main server channel and UHC event channels:`
        )
        .addFields(
          {
            name: "📢 Main Server Announcement Channel",
            value:
              "• **Target Channel:** `#announcement` (ID: `1507722709214380124`)\n" +
              "• **Required Role:** **`📢 Server Announce`** (ID: `1571405116869840926`)\n" +
              "• **Command:** `/announcement title:<text> message:<text> channel:#announcement [dm:true] [ping:everyone]`",
            inline: false,
          },
          {
            name: "⚔️ UHC Events Channel",
            value:
              "• **Target Channel:** `#uhc-events` (ID: `1551794273039810620`)\n" +
              "• **Required Role:** **`⚔️ UHC Announce`** (ID: `1571405118786633798`)\n" +
              "• **Command:** `/announcement ... channel:#uhc-events` or `/uhc title:... ip:... date:... time:...`",
            inline: false,
          },
          {
            name: "🔒 Channel Boundary Security",
            value:
              "Members with `⚔️ UHC Announce` CANNOT post in `#announcement`.\n" +
              "Members with `📢 Server Announce` CANNOT post in `#uhc-events`.\n" +
              "Administrators and Server Owner can post in both.",
            inline: false,
          }
        )
        .setFooter({ text: "Use /perms give to assign announcement roles" })
        .setTimestamp(),
  },
  {
    id: "giveaway",
    name: "Giveaway System",
    emoji: "🎁",
    shortDesc: "Giveaways with buttons, persistent entries, and setwinner",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("🎁 Advanced Giveaway System")
        .setDescription(
          `Enterprise giveaway engine built to survive container restarts, crashes, and rate limits without losing participants!`
        )
        .addFields(
          {
            name: "🚀 Starting a Giveaway",
            value:
              "`/giveaway start prize:<text> duration:<time> [winners:num] [winner_mode:random|secret] [secret_winner:@user]`\n" +
              "• **Winner Modes:**\n" +
              "  - `🎲 Fair Random Drawing`: Draws winners completely randomly from all entrants.\n" +
              "  - `🤫 Secret Forced Winner`: Pre-selects a secret winner who is guaranteed to win (hidden from members).\n" +
              "• Members can join by clicking the **🎉 Enter** button or reacting with 🎉 without ever being accidentally removed.",
            inline: false,
          },
          {
            name: "🎯 Pre-Selecting or Forcing Winners (`setwinner`)",
            value:
              "`/giveaway setwinner message_id:<id> winners:@user1 @user2`\n" +
              "• Forces specific user(s) to win the giveaway when it ends, regardless of total entries!\n" +
              "• Use `/giveaway resetwinner message_id:<id>` to revert back to random drawing.",
            inline: false,
          },
          {
            name: "⚙️ Management Commands",
            value:
              "• `/giveaway end message_id:<id>` - End immediately and draw winners\n" +
              "• `/giveaway reroll message_id:<id> [count]` - Pick new winners\n" +
              "• `/giveaway cancel message_id:<id>` - Cancel active giveaway\n" +
              "• `/giveaway list` - View active giveaways across the server",
            inline: false,
          },
          {
            name: "🛡️ Required Role",
            value:
              "Administrators or members with the **`🎁 Giveaway Perms`** role (`1571258781487210660`).",
            inline: false,
          }
        )
        .setFooter({ text: "All giveaway participants are auto-synced & recovered from Discord" })
        .setTimestamp(),
  },
  {
    id: "vc",
    name: "Voice Channel Security & Anti-Louding",
    emoji: "🎙️",
    shortDesc: "VC bans, disconnects, and automatic ear-rape soundboard detector",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle("🎙️ Voice Channel Moderation & Anti-Abuse")
        .setDescription(
          `Keep your voice channels clean, peaceful, and free of ear-rape trolls.`
        )
        .addFields(
          {
            name: "🔊 Anti-Louding Soundboard Auto-Detector",
            value:
              "• Automatically detects soundboard spam (>3 sounds in 4 seconds).\n" +
              "• Instantly silences the offender with a **10-minute server timeout**.\n" +
              "• Logs incident to `#server-logs` with sound ID and count.",
            inline: false,
          },
          {
            name: "🛑 Permanent VC Ban System",
            value:
              "• `/vc ban user:@user [reason]` - Permanently blocks user from voice channels.\n" +
              "• If they try to join ANY voice channel, the bot **instantly kicks them out within milliseconds**!\n" +
              "• `/vc unban user:@user` - Restore voice channel access\n" +
              "• `/vc banlist` - View all active VC bans",
            inline: false,
          },
          {
            name: "🛠️ VC Moderation Commands",
            value:
              "• `/vc kick user:@user` - Disconnect from voice\n" +
              "• `/vc mute user:@user` / `/vc unmute` - Server mute/unmute\n" +
              "• `/vc deafen user:@user` / `/vc undeafen` - Server deafen\n" +
              "• `/vc move user:@user channel:#target` - Move member between channels\n" +
              "• `/vc lock` / `/vc unlock` - Lock voice channel from non-whitelisted members",
            inline: false,
          },
          {
            name: "🛡️ Required Role",
            value:
              "Administrators or members with the **`🎙️ VC Mod Perms`** role (`1571258783471243304`).",
            inline: false,
          }
        )
        .setFooter({ text: "Extreme Voice Protection Suite Active" })
        .setTimestamp(),
  },
  {
    id: "automod",
    name: "AutoMod & Gali Protection",
    emoji: "🛡️",
    shortDesc: "Bangla, English & Hindi profanity filters, anti-phishing & invites",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🛡️ AutoMod & Multi-Language Protection")
        .setDescription(
          `Automated intelligent defense against raid attacks, scam links, and abuse.`
        )
        .addFields(
          {
            name: "🤬 Multi-Language Gali Filter (Bangla, Hindi, English)",
            value:
              "• Deep phonetic and character-substitution detection (e.g. `m@g1`, `b@nch0d`, `c**t`).\n" +
              "• Instantly deletes abusive messages and applies warning/timeout.\n" +
              "• Add/remove custom words with `/automod words action:add word:...`",
            inline: false,
          },
          {
            name: "🔗 Anti-Link & Anti-Invite Filter",
            value:
              "• Blocks all unauthorized Discord invite links (`discord.gg/...`).\n" +
              "• Blocks scam and phishing websites.\n" +
              "• **Bypass Role:** Members with **`🔗 Link Perms`** (`1571254489610977400`) can post links freely!",
            inline: false,
          },
          {
            name: "⚡ Rate Limits & Anti-Spam",
            value:
              "• Anti-duplicate text flood protection.\n" +
              "• Anti-caps shouting filter (>75% caps in message).\n" +
              "• Mass mention protection (>4 mentions per message).\n" +
              "• **Bypass Role:** Members with **`🛡️ AutoMod Bypass`** (`1571258787778535536`) are exempt.",
            inline: false,
          }
        )
        .setFooter({ text: "Use /automod status to view dashboard" })
        .setTimestamp(),
  },
  {
    id: "tickets",
    name: "Support Tickets System",
    emoji: "🎫",
    shortDesc: "Interactive ticket panels, claiming, closing, and reviews",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("🎫 Support Tickets System")
        .setDescription(
          `Complete ticket lifecycle for support, partner requests, and staff applications.`
        )
        .addFields(
          {
            name: "📬 Interactive Ticket Panel",
            value:
              "• `/panel channel:[#channel]` - Sends embed with 4 instant buttons:\n" +
              "  1. 🎁 Claim Reward\n" +
              "  2. 📝 Team Application\n" +
              "  3. 🤝 Partnership Request\n" +
              "  4. ❓ General Support",
            inline: false,
          },
          {
            name: "🛠️ Staff Ticket Handling",
            value:
              "• `/ticket claim` - Claim ticket so other staff know you are assisting.\n" +
              "• `/ticket close [reason]` - Close ticket, archive transcript, and request feedback rating.\n" +
              "• `/ticket add user:@user` - Add user to ticket\n" +
              "• `/ticket remove user:@user` - Remove user from ticket\n" +
              "• `/ticket rename name:<text>` - Rename ticket channel",
            inline: false,
          },
          {
            name: "🛡️ Required Role",
            value:
              "Administrators or members with the **`🎫 Ticket Staff Perms`** role (`1571509405915291740`).",
            inline: false,
          }
        )
        .setFooter({ text: "All closed tickets are permanently archived" })
        .setTimestamp(),
  },
  {
    id: "security",
    name: "Anti-Nuke & Server Protection",
    emoji: "🔐",
    shortDesc: "Bot addition protection, role/channel guards, and disaster prevention",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🔐 Anti-Nuke & Server Protection")
        .setDescription(
          `Hardened real-time safeguards to defend ${guild.name} against unauthorized modifications and compromised accounts.`
        )
        .addFields(
          {
            name: "🤖 Bot Addition Guard",
            value:
              "• Prevents non-whitelisted members from inviting malicious bots.\n" +
              "• Unauthorized bots are instantly kicked and inviter is punished.\n" +
              "• Configure with `/antinuke whitelist user:@user`",
            inline: false,
          },
          {
            name: "🛡️ Channel & Role Guards",
            value:
              "• Rapid channel or role deletion triggers instant lockdown.\n" +
              "• Offending accounts have their roles stripped and are timed out immediately.",
            inline: false,
          },
          {
            name: "🛡️ Required Role",
            value:
              "Server Owner or Administrators with the **`🔐 Security Perms`** role (`1571509407865638993`).",
            inline: false,
          }
        )
        .setFooter({ text: "Anti-Nuke Protection Active" })
        .setTimestamp(),
  },
  {
    id: "antiraid",
    name: "Anti-Raid & Server Lockdown",
    emoji: "🚨",
    shortDesc: "Mass join detection, account age gate, and emergency lockdown",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle("🚨 Anti-Raid Shield & Server Emergency Lockdown")
        .setDescription(
          `Automated, high-velocity defense shield to neutralize raid attacks before they damage ${guild.name}.`
        )
        .addFields(
          {
            name: "⚡ Mass-Join Detection",
            value:
              "• Detects rapid join waves (e.g. 5+ accounts in 10s).\n" +
              "• Automatically executes timeouts on all raiders.\n" +
              "• Dispatches high-priority emergency alerts with 1-click control buttons.",
            inline: false,
          },
          {
            name: "📅 Account Age Gate (< 3 Days)",
            value:
              "• Automatically flags and restricts brand-new accounts created in the last 24-72 hours.\n" +
              "• Prevents disposable raid accounts from spamming channels.",
            inline: false,
          },
          {
            name: "🔒 Emergency Lockdown Commands",
            value:
              "• `/antiraid lockdown action:lock [duration]` - Locks down all public channels.\n" +
              "• `/lockdown scope:server` or `/lockdown scope:channel` - Instant lockdown.\n" +
              "• `/unlock scope:server` or `/unlock scope:channel` - Lifts lockdown.\n" +
              "• **Text Trigger:** Type `lockdown` or `unlock` in chat (Administrators / Security staff only).",
            inline: false,
          },
          {
            name: "🛡️ Configuration & Controls",
            value:
              "• `/antiraid status` - View live shield status and lockdown states.\n" +
              "• `/antiraid enable` / `/antiraid disable` - Quick toggle.\n" +
              "• `/antiraid config` - Tune join thresholds, min account age, and timeout durations.\n" +
              "• `/antiraid whitelist` - Exempt trusted staff or VIP roles.",
            inline: false,
          }
        )
        .setFooter({ text: `${BRAND.footer} • Anti-Raid Defense` })
        .setTimestamp(),
  },
];

export function buildHelpSelectMenu(activeId: string = "overview"): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("admin_help_select")
    .setPlaceholder("📂 Select a feature to view detailed documentation...");

  for (const cat of HELP_CATEGORIES) {
    menu.addOptions({
      label: cat.name,
      value: cat.id,
      description: cat.shortDesc.slice(0, 100),
      emoji: cat.emoji,
      default: cat.id === activeId,
    });
  }

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/**
 * Checks if a member is authorized to view the Master Administrator Help Hub:
 * - Server Owner
 * - Administrators
 */
export function isAdministrator(member: GuildMember): boolean {
  if (member.id === member.guild.ownerId) return true;
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Handles .help, ?help, !help, and help text commands
 */
export async function handleHelpTextCommand(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;

  const raw = message.content.trim().toLowerCase();
  const HELP_TRIGGERS = new Set([
    "help",
    ".help",
    "?help",
    "!help",
    "/help",
    "-help",
    "+help",
  ]);

  if (!HELP_TRIGGERS.has(raw)) return false;

  const member =
    message.member ||
    (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member) return false;

  // STRICT ACCESS CONTROL: Only Server Owner & Administrators
  if (!isAdministrator(member)) {
    const denied = await message.reply({
      content:
        "❌ **Access Denied:** The system help & feature documentation is restricted to **Server Administrators** only.",
    });
    // Auto delete after 8 seconds to keep chat clean
    setTimeout(() => {
      denied.delete().catch(() => {});
      message.delete().catch(() => {});
    }, 8_000);
    return true;
  }

  const overviewCat = HELP_CATEGORIES.find((c) => c.id === "overview") || HELP_CATEGORIES[0];
  const embed = overviewCat.embed(message.guild);
  const row = buildHelpSelectMenu("overview");

  const replyMsg = await message.reply({
    embeds: [embed],
    components: [row],
  });

  // Collector for 10 minutes
  const collector = replyMsg.createMessageComponentCollector({
    time: 600_000,
  });

  collector.on("collect", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "admin_help_select") return;

    if (interaction.user.id !== message.author.id) {
      await interaction.reply({
        content: "❌ Run `help` or `/help` yourself to navigate your own menu.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const selectedId = interaction.values[0];
    const cat = HELP_CATEGORIES.find((c) => c.id === selectedId) || overviewCat;
    const newEmbed = cat.embed(message.guild!);
    const newRow = buildHelpSelectMenu(selectedId);

    await interaction.update({
      embeds: [newEmbed],
      components: [newRow],
    });
  });

  collector.on("end", async () => {
    try {
      const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("admin_help_expired")
          .setPlaceholder("⌛ Menu session expired. Type help or /help to open again.")
          .setDisabled(true)
          .addOptions({ label: "Expired", value: "expired" })
      );
      await replyMsg.edit({ components: [disabledRow] }).catch(() => null);
    } catch {}
  });

  return true;
}
