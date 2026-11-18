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
            value: "13 dedicated feature roles to grant permissions to staff without making them Administrator.",
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
          },
          {
            name: "11. 🔊 Join-to-Create (JTC) & TempVoice",
            value: "Dynamic voice rooms, 15-button in-chat interactive panel, 5-minute delayed auto-transfer on owner leave, and status moderation (`/jtc-setup`, `/interface`, `/voice`, `/status`).",
            inline: false,
          },
          {
            name: "12. 👋 Welcome & Chat Greeting Cleaner",
            value: "Custom member welcome cards, auto-roles, DM greetings, and short chat cards with automated 15-minute self-deletion (`/welcome`).",
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
          `Instead of giving full Administrator access to staff, you can assign these **13 dedicated roles** to grant access to individual features!\n\n` +
          `**Commands to manage permissions:**\n` +
          `• \`/perms give member:@user feature:<name>\` - Grant permission\n` +
          `• \`/perms remove member:@user feature:<name>\` - Revoke permission\n` +
          `• \`/perms check member:@user\` - View all permissions for a user\n` +
          `• \`/perms list feature:<name>\` - See who has this permission\n` +
          `• \`/perms roles\` - View all 13 permission roles\n\n` +
          `**All 13 Dedicated Roles in ${guild.name}:**`
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
    name: "Voice Channel Security & 24/7 Presence",
    emoji: "🎙️",
    shortDesc: "24/7 VC presence, voice gali shield, VC bans & soundboard detector",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle("🎙️ Voice Channel Moderation, 24/7 VC & Voice Gali Shield")
        .setDescription(
          `Comprehensive suite for 24/7 Voice presence, anti-gali protection, soundboard spam defense, and staff voice controls.`
        )
        .addFields(
          {
            name: "🎙️ 24/7 Persistent Voice Presence",
            value:
              "• `/247 join [channel]` or `/vc 247 action:join` - Locks VyntricBD into the voice channel 24/7.\n" +
              "• `/247 leave` or `/vc 247 action:leave` - Disconnects the bot and turns off 24/7 mode.\n" +
              "• `/247 status` - View live uptime, connection status, and ping.\n" +
              "• **Auto-Reconnect Engine:** Automatically re-joins on bot reboots, server moves, or disconnects.\n" +
              "• **Chat Trigger:** Type `247`, `joinvc`, or `leavevc` directly in chat.",
            inline: false,
          },
          {
            name: "🤬 Advanced Voice Gali Shield",
            value:
              "• **Multi-Dialect Coverage:** Bangla, Sylheti, Dhakaiya, Hindi, Urdu & English profanity.\n" +
              "• **Instant Action:** Disconnects member from VC + Server-Mutes them + Applies strike timeout.\n" +
              "• **Voice Abuse Reports:** `/vcreport member:@user reason:<details>` dispatches staff alerts with 1-click `[🔨 VC Ban]`, `[Mute]`, and `[Disconnect]` buttons.",
            inline: false,
          },
          {
            name: "🔊 Anti-Louding Soundboard Auto-Detector",
            value:
              "• Automatically detects soundboard spam (>3 sounds in 4 seconds).\n" +
              "• Instantly silences the offender with a **10-minute server timeout** and VC kick.\n" +
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
            name: "🔀 Voice Channel Move Perms",
            value:
              "• `/vc move member:@user channel:#vc` - Move a member to another Voice Channel.\n" +
              "• `/vc moveall from_channel:#vc to_channel:#vc` - Bulk move all members from one VC to another.\n" +
              "• Role **`🔀 Move Perms`** (`1572249183832768662`) has strictly `MoveMembers` permission only — safe to give to event hosts or organizers without granting kick/mute/ban permissions!",
            inline: false,
          },
          {
            name: "🛡️ Required Role",
            value:
              "Administrators, members with the **`🎙️ VC Mod Perms`** role (`1571258783471243304`), or members with the **`🔀 Move Perms`** role (`1572249183832768662`) for moving members.",
            inline: false,
          }
        )
        .setFooter({ text: "VyntricBD Voice Defense & 24/7 Active" })
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
              "• Whitelist trusted users/roles: `/antinuke whitelist add user:@user` or `role:@role`\n" +
              "• View active immunity lists: `/antinuke whitelist list`",
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
    name: "Enterprise Anti-Raid & Server Defense",
    emoji: "🚨",
    shortDesc: "Multi-vector raid detection, heuristic risk scoring, panic mode & forensics",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle("🚨 Enterprise Anti-Raid Shield & Panic Defense Hub")
        .setDescription(
          `Military-grade, multi-vector real-time shield to detect and neutralize raid attacks before they can impact **${guild.name}**.`
        )
        .addFields(
          {
            name: "⚡ Multi-Vector Raid Detection",
            value:
              "• **Join Velocity:** Catches rapid account spikes (e.g. 5 joins / 10s).\n" +
              "• **Heuristic Risk Engine:** Scores every account (0-100) based on age, avatar, and patterns; auto-isolates high-risk accounts.\n" +
              "• **Name Similarity Clustering:** Intercepts swarms sharing similar usernames/prefixes.\n" +
              "• **Default-Avatar Wave Guard:** Detects and contains waves of default-avatar accounts.\n" +
              "• **Invite Leak Interceptor:** Auto-identifies and deletes compromised Discord invites used by raiders.\n" +
              "• **Cross-Channel Copypasta:** Blocks multi-channel flood attacks in milliseconds.",
            inline: false,
          },
          {
            name: "🔴 Emergency Panic Mode (`panic`)",
            value:
              "• Type `panic`, `.panic`, `!panic` or `/antiraid panic` in chat.\n" +
              "• Instantly engages server-wide Hard Lockdown & quarantines all joiners from the last 10 minutes.\n" +
              "• Pings administrators with 1-click crisis management controls.",
            inline: false,
          },
          {
            name: "📋 Forensic Dossier & Clean-up (`/antiraid`)",
            value:
              "• `/antiraid raiders` - Forensic breakdown of the last incident wave (IDs, creation dates, risk scores, invite code).\n" +
              "• `/antiraid sweep [action]` - Bulk apply 24h timeouts or lift timeouts on all captured raiders in 1 click.\n" +
              "• `/antiraid risk user:@user` - Inspect the security risk profile and audit breakdown for any member.",
            inline: false,
          },
          {
            name: "🔒 Emergency Lockdown & Unlock Commands",
            value:
              "• `/lockdown scope:server|channel [duration]` - Instant lock.\n" +
              "• `/unlock scope:server|channel` - Lifts lockdown.\n" +
              "• **Chat Triggers:** Type `lockdown` or `unlock` directly in chat without `/`.",
            inline: false,
          }
        )
        .setFooter({ text: `${BRAND.footer} • Enterprise Anti-Raid Defense` })
        .setTimestamp(),
  },
  {
    id: "jtc",
    name: "Join-to-Create & Temporary Voice Rooms",
    emoji: "🔊",
    shortDesc: "Astro/Base-Bot-1 style temporary VC system with live interactive chat panel",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle("🔊 Join-to-Create (JTC) & TempVoice System")
        .setDescription(
          `Advanced temporary voice channel management inspired by Astro Bot and Base-Bot-1.\n` +
          `Members join the **Join To Create** lobby, and the bot instantly spins up a private room and posts an interactive control panel directly in the VC's text chat!`
        )
        .addFields(
          {
            name: "🛠️ Admin Setup Commands",
            value:
              "• `/jtc-setup` - Automatically creates the **Join To Create** category and lobby voice channel.\n" +
              "• `/status` - Open the temporary channel status moderation settings panel.\n" +
              "• `/interface` - Re-sends the interactive control panel inside your temporary voice channel chat if lost or scrolled past.",
            inline: false,
          },
          {
            name: "🎛️ In-Channel Interactive Control Panel",
            value:
              "Every generated room receives a dedicated control panel in its text chat with **15 interactive buttons**:\n" +
              "• `⫿` **Name** - Rename channel via popup modal.\n" +
              "• `👥` **Limit** - Set member count (0-99).\n" +
              "• `🔒` **Privacy** - Toggle Lock / Unlock for `@everyone`.\n" +
              "• `🕒` **Waiting Room** - Create an automated waiting queue.\n" +
              "• `💬` **Chat** - Toggle visibility of text chat.\n" +
              "• `👤+` **Trust** / `👤-` **Untrust** - Grant or revoke member access.\n" +
              "• `📞` **Invite** - Generate quick invite link.\n" +
              "• `🚫` **Kick** - Kick a disruptive member out of VC.\n" +
              "• `🌐` **Region** - Change voice server region.\n" +
              "• `⛔` **Block** / `✅` **Unblock** - Manage blacklist/whitelist.\n" +
              "• `👑` **Claim** - Take ownership of an abandoned room.\n" +
              "• `🚀` **Transfer** - Hand room ownership to another member.\n" +
              "• `🗑️` **Delete** - Instantly close and delete room.",
            inline: false,
          },
          {
            name: "⏱️ Smart Delayed Owner Auto-Transfer",
            value:
              "• If the room owner disconnects, a **5-minute countdown** starts.\n" +
              "• If the owner returns within 5 minutes, auto-transfer is cancelled.\n" +
              "• If the owner does not return, the bot automatically promotes the next active member, renames the channel to `! <NewOwner>'s Channel`, and updates the interface panel!",
            inline: false,
          },
          {
            name: "⌨️ Slash Commands Alternative",
            value:
              "• `/voice lock` / `/voice unlock` - Lock or unlock room\n" +
              "• `/voice hide` / `/voice unhide` - Hide or reveal room\n" +
              "• `/voice name <text>` - Change room name\n" +
              "• `/voice limit <number>` - Set member capacity\n" +
              "• `/voice claim` / `/voice transfer member:@user` - Ownership management\n" +
              "• `/voice kick member:@user` / `/voice block member:@user` - Member moderation",
            inline: false,
          }
        )
        .setFooter({ text: `${BRAND.name} • TempVoice System` })
        .setTimestamp(),
  },
  {
    id: "welcome",
    name: "Welcome System & Chat Auto-Cleaner",
    emoji: "👋",
    shortDesc: "Join announcements, auto-roles, DM greetings, and 15m auto-delete chat cards",
    embed: (guild: Guild) =>
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("👋 Welcome System & Chat Auto-Cleaner")
        .setDescription(
          `Complete onboarding and member greeting suite for **${guild.name}** with intelligent anti-spam and auto-cleanup.`
        )
        .addFields(
          {
            name: "📢 Main Welcome Channel Announcement",
            value:
              "• `/welcome channel channel:[#channel]` - Set welcome announcement channel (e.g. `#〢ᴡᴇʟᴄᴏᴍᴇ`).\n" +
              "• `/welcome message message:[text]` - Custom greeting template.\n" +
              "• Supports rich variables: `{user}`, `{username}`, `{server}`, `{memberCount}`.\n" +
              "• `/welcome test` - Test full welcome embed with server banner.",
            inline: false,
          },
          {
            name: "💬 General Chat Greeting Card with Auto-Delete",
            value:
              "• `/welcome chat channel:[#channel] [autodelete:10-30] [enabled:true]`\n" +
              "• Sends a clean greeting banner card directly into general chat (e.g. `#〢ᴄʜᴀᴛ`).\n" +
              "• **Auto-Deletion Engine:** Automatically deletes the welcome card after **10 to 30 minutes** (default: 15m) so general chat never gets cluttered!\n" +
              "• **Duplicate Suppression:** Built-in filter ensures no duplicate greetings are sent even during network reconnections.",
            inline: false,
          },
          {
            name: "🎭 Automatic Join Roles (`autorole`)",
            value:
              "• Automatically assigns default roles to every new member on join.\n" +
              "• Active auto-roles in ${guild.name}:\n" +
              "  - `Members` (`1552923825753038939`)\n" +
              "  - `Event Ping` (`1551797643628511293`)\n" +
              "  - `Vyntric SMP PING` (`1508723281006428170`)",
            inline: false,
          },
          {
            name: "📬 Direct Message (DM) Greeting",
            value:
              "• `/welcome dm message:[text] enabled:[true|false]`\n" +
              "• Delivers a warm welcoming direct message with server guidelines and navigation straight to new human members.",
            inline: false,
          }
        )
        .setFooter({ text: `${BRAND.name} • Member Onboarding Guide` })
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
