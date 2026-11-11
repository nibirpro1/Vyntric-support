import {
  Message,
  PartialMessage,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  GuildMember,
} from "discord.js";
import { AutoModConfig, AutoModPunishment, getAutoModConfig } from "./automodStore";
import { getSettings } from "./store";
import { getLoggingConfig } from "./loggingStore";
import { BRAND } from "./brand";

// ─────────────────────────────────────────────────────────────
// Built-in Multilingual Gali & Abusive Language Lists
// (Covers Bengali script, Banglish, Hindi/Urdu, and English)
// ─────────────────────────────────────────────────────────────

export const BUILTIN_BENGALI_SCRIPT_GALI = [
  "চুদ",
  "চুদি",
  "চুদা",
  "চুদির",
  "চুদির ভাই",
  "চুদিরভাই",
  "চোদ",
  "চোদা",
  "চোদনা",
  "চোদন",
  "চুদবো",
  "চুদানি",
  "চুদানির পোলা",
  "চুদমারানি",
  "চুদমারানী",
  "চোদাচুদি",
  "মাগি",
  "মাগী",
  "মাগির",
  "মাগির পোলা",
  "মাগির ছেলে",
  "মাগিরপোলা",
  "খানকি",
  "খানকির",
  "খানকির পোলা",
  "খানকিরপোলা",
  "খানকির ঝি",
  "খানকির বেটি",
  "খানকিমাগি",
  "বোকাচোদা",
  "বোকাচুদা",
  "মাদারচোদ",
  "মাদারচুদ",
  "মাদারচোত",
  "বেহেনচোদ",
  "ভেনচোদ",
  "ভোসডি",
  "ভোসডিকে",
  "চুতিয়া",
  "গান্ডু",
  "গাণ্ডু",
  "গান্ডমারা",
  "গান্ড",
  "গাঁড়",
  "হারামি",
  "হারামজাদা",
  "হারামজাদি",
  "হারামির পোলা",
  "কুত্তার বাচ্চা",
  "কুত্তার পোলা",
  "কুত্তি",
  "কুত্তা মারানি",
  "শুয়োরের বাচ্চা",
  "শুয়োরেরবাচ্চা",
  "শুয়োর",
  "শুয়োরের পোলা",
  "লাউড়া",
  "লওড়া",
  "লোড়া",
  "বাল",
  "বালের",
  "বালছাল",
  "ভোদা",
  "ভোদাই",
  "পুটকি",
  "পুটকিমারানি",
  "পোদ",
  "পোদমারানি",
  "বেশ্যা",
  "বেশ্যার",
  "রান্ডি",
  "রান্ডির",
  "রান্ডির পোলা",
  "ভাতার",
  "ভাতারী",
  "হেডা",
  "হেডার",
  "ফকিন্নির পোলা",
  "ফাক",
  "বিচ",
];

export const BUILTIN_BANGLISH_HINDI_GALI = [
  "choda",
  "chodar",
  "chodbo",
  "chodna",
  "chodon",
  "chodachudi",
  "chudi",
  "chuda",
  "chudbo",
  "chudir",
  "chudirbhai",
  "chudir bhai",
  "chudanir",
  "chudanirpola",
  "chudanir pola",
  "chudani",
  "chudmarani",
  "xoda",
  "xodna",
  "xudi",
  "magi",
  "maggi",
  "magir",
  "magirpola",
  "magir pola",
  "magirchele",
  "magir chele",
  "magirbhai",
  "magir jhi",
  "khanki",
  "khankir",
  "khankirpola",
  "khankir pola",
  "khankimagi",
  "khankir jhi",
  "khankir beti",
  "bokachoda",
  "bokacoda",
  "bocachoda",
  "bokachuda",
  "bokacuda",
  "bokachode",
  "boka choda",
  "boka chuda",
  "madarchod",
  "madarchoda",
  "madarcod",
  "maderchod",
  "madarchud",
  "madarchot",
  "behenchod",
  "bhenchod",
  "bencod",
  "mkc",
  "tmkc",
  "bkl",
  "gandu",
  "gaandu",
  "gaand",
  "gand",
  "gandmara",
  "gaandmara",
  "harami",
  "haramjada",
  "haramzada",
  "haramzadi",
  "haramir pola",
  "haramirpola",
  "kuttar bachcha",
  "kuttar baccha",
  "kuttarbacha",
  "kuttarbachcha",
  "kuttarpola",
  "kuttar pola",
  "kuttirbachcha",
  "kutta",
  "kutta marani",
  "kuttiya",
  "shuorer bachcha",
  "shuorer baccha",
  "shuorer",
  "shuorerbachcha",
  "shuorerpola",
  "shuorer pola",
  "shuor",
  "suarer",
  "suarerbachcha",
  "suorer baccha",
  "suor er baccha",
  "shuyor",
  "shuyorer baccha",
  "suar ki aulad",
  "bhosdi",
  "bhosda",
  "bhosdike",
  "bhosdiwale",
  "chutiya",
  "chutia",
  "chutiye",
  "chutiyapa",
  "chinal",
  "kamina",
  "kamine",
  "lauda",
  "lawda",
  "lawra",
  "lora",
  "lund",
  "lodu",
  "baal",
  "bal",
  "baler",
  "balsal",
  "bal sal",
  "baler kotha",
  "sala",
  "shala",
  "bessha",
  "beshya",
  "beshyar",
  "beshyamagi",
  "bessa",
  "vesha",
  "randi",
  "randir",
  "randirpola",
  "randir pola",
  "bhatar",
  "bhatari",
  "bhoda",
  "voda",
  "bhodai",
  "vodai",
  "putki",
  "putkimarani",
  "pod",
  "podmarani",
  "notti",
  "notir pola",
  "hijra",
  "heda",
  "hedar",
  "fokirni",
  "fokinnir pola",
];

export const BUILTIN_ENGLISH_GALI = [
  "fuck",
  "fucking",
  "fucker",
  "fucked",
  "fuckoff",
  "fuck off",
  "fuck you",
  "fuck u",
  "motherfucker",
  "motherfucking",
  "mofo",
  "fck",
  "fuk",
  "fvck",
  "phuck",
  "bitch",
  "bitches",
  "bitching",
  "son of a bitch",
  "btch",
  "biatch",
  "cunt",
  "kunt",
  "whore",
  "slut",
  "skank",
  "thot",
  "asshole",
  "dumbass",
  "jackass",
  "smartass",
  "dipshit",
  "shithead",
  "bullshit",
  "horseshit",
  "shitty",
  "piece of shit",
  "shit",
  "sht",
  "dick",
  "dck",
  "dickhead",
  "suck my dick",
  "suck dick",
  "cock",
  "cocksucker",
  "pussy",
  "pssy",
  "prick",
  "twat",
  "wanker",
  "bastard",
  "douche",
  "douchebag",
  "nigger",
  "nigga",
  "niggers",
  "niggas",
  "faggot",
  "faggots",
  "fag",
  "dyke",
  "tranny",
  "retard",
  "retarded",
  "kike",
  "chink",
  "spic",
  "stfu",
  "gtfo",
  "kys",
  "kill yourself",
  "go die",
  "neck yourself",
];

// Short/ambiguous Bengali words that MUST strictly require whole-word boundaries
// so words like "বালিশ" (pillow), "বালতি" (bucket), "বালক" (boy) aren't falsely flagged
const STRICT_BOUNDARY_BENGALI = new Set(["বাল", "চুদ", "চোদ", "পোদ", "ফাক", "বিচ"]);

// Innocent words that should NEVER trigger substring/normalized false positives
const SAFE_WORDS = new Set([
  "classic",
  "class",
  "grass",
  "glass",
  "pass",
  "passport",
  "assistant",
  "assist",
  "mass",
  "bass",
  "compass",
  "ambassador",
  "assassin",
  "embarrass",
  "hello",
  "shell",
  "ball",
  "balance",
  "balcony",
  "global",
  "balloon",
  "cobalt",
  "magic",
  "magical",
  "magician",
  "imagination",
  "random",
  "brand",
  "grand",
  "errand",
  "stand",
  "land",
  "band",
  "hand",
  "sand",
  "salad",
  "masala",
  "minecraft",
  "mcpe",
  "putin",
  "put",
  "putting",
  "output",
  "input",
  "laptop",
  "boka",
  "london",
  "lundon",
  "scunthorpe",
  "dickens",
  "cockpit",
  "peacock",
  "hancock",
  "shutter",
  "button",
  "butter",
  "shift",
  "shirts",
  "shirt",
  "বালিশ",
  "বালতি",
  "বালক",
  "বালিকা",
  "বাংলা",
  "বাংলাদেশ",
  "চোখ",
  "পোশাক",
]);

const SAFE_LINK_HOSTS = [
  "tenor.com",
  "c.tenor.com",
  "media.tenor.com",
  "media1.tenor.com",
  "giphy.com",
  "media.giphy.com",
  "cdn.discordapp.com",
  "media.discordapp.net",
  "images-ext-1.discordapp.net",
  "images-ext-2.discordapp.net",
];

// In-memory spam tracker: userId -> timestamp[]
const userMessageTimes: Map<string, number[]> = new Map();

// Periodically clean stale spam tracker entries (every 5 minutes)
setInterval(() => {
  const cutoff = Date.now() - 10_000;
  for (const [userId, times] of userMessageTimes.entries()) {
    const fresh = times.filter((t) => t > cutoff);
    if (fresh.length === 0) userMessageTimes.delete(userId);
    else userMessageTimes.set(userId, fresh);
  }
}, 300_000).unref();

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalizes text to defeat evasion tricks:
 * - removes zero-width / invisible unicode characters
 * - applies NFC normalization
 * - decodes common leetspeak (@ -> a, 0 -> o, 1/! -> i, $ -> s, 3 -> e, 4 -> a, 5 -> s, 7 -> t, 8 -> b)
 * - joins separated single characters (e.g. "m a g i" -> "magi", "f.u.c.k" -> "fuck")
 * - collapses excessive repeated chars ("fuuuuck" -> "fuck", "shuuuuyor" -> "shuyor")
 */
export function normalizeAutoModText(raw: string): string {
  if (!raw) return "";

  let text = raw
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u202A-\u202E]/g, "")
    .toLowerCase();

  const leetMap: Record<string, string> = {
    "@": "a",
    "4": "a",
    "$": "s",
    "5": "s",
    "0": "o",
    "1": "i",
    "!": "i",
    "|": "i",
    "3": "e",
    "7": "t",
    "8": "b",
  };
  text = text.replace(/[@$01!|37845]/g, (ch) => leetMap[ch] || ch);

  // Merge separated single letters: e.g. "f u c k" or "m.a.g.i" or "b-o-k-a"
  text = text.replace(/(?<=\b[a-z])[\s._\-*~]+(?=[a-z]\b)/g, "");

  // Collapse 3+ repeated characters down to 1 ("fuuuuck" -> "fuck")
  text = text.replace(/(.)\1{2,}/g, "$1");

  return text;
}

/**
 * Also handles asterisk-censored evasion (e.g. "f*ck", "b*tch", "sh*t", "p*ssy")
 */
function stripWildcardSymbols(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, "")
    .toLowerCase()
    .replace(/[*_~`]/g, "");
}

export interface AutoModEvaluation {
  triggered: boolean;
  reasons: string[];
  matchedWords: string[];
}

/**
 * Evaluates text content against Invite, Link, and Gali/Bad-Word rules.
 * Used identically by messageCreate, messageUpdate, and `/automod test`.
 */
export function evaluateContentForAutoMod(
  content: string,
  config: AutoModConfig
): AutoModEvaluation {
  const reasons: string[] = [];
  const matchedWords: string[] = [];

  if (!content || content.trim().length === 0) {
    return { triggered: false, reasons, matchedWords };
  }

  // 1. Anti-Invite Check
  if (
    config.antiInvite &&
    /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite|dsc\.gg)\/[a-z0-9_-]+/i.test(
      content
    )
  ) {
    reasons.push("Discord Invite Link");
  }

  // 2. Anti-Link Check (whitelisting safe GIF/Discord CDN links)
  if (config.antiLink) {
    const urls = content.match(/https?:\/\/[^\s<>]+/gi) || [];
    const hasBlockedLink = urls.some((rawUrl) => {
      try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase();
        return !SAFE_LINK_HOSTS.some(
          (safe) => host === safe || host.endsWith(`.${safe}`)
        );
      } catch {
        return true;
      }
    });
    if (hasBlockedLink) {
      reasons.push("Unauthorized External Link");
    }
  }

  // 3. Anti-Gali & Blacklisted Bad Words Check (Bengali + Banglish + Hindi + English + Custom)
  if (config.antiBadWords) {
    const rawClean = content
      .normalize("NFC")
      .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, "")
      .toLowerCase();
    const normalized = normalizeAutoModText(content);
    const wildcardStripped = stripWildcardSymbols(content);

    const allowSet = new Set(config.allowWords.map((w) => w.trim().toLowerCase()));
    const combinedWords = Array.from(
      new Set([
        ...config.badWords,
        ...BUILTIN_BENGALI_SCRIPT_GALI,
        ...BUILTIN_BANGLISH_HINDI_GALI,
        ...BUILTIN_ENGLISH_GALI,
      ])
    );

    // Token list for safe-word exemption check
    const rawTokens = rawClean.split(/[^a-z0-9\u0980-\u09FF]+/).filter(Boolean);
    const nonSafeTokens = rawTokens.filter((t) => !SAFE_WORDS.has(t));
    const safeCheckText = nonSafeTokens.join(" ");

    for (const rawWord of combinedWords) {
      const word = rawWord.trim().toLowerCase().normalize("NFC");
      if (!word || allowSet.has(word)) continue;

      let matched = false;
      const isBengali = /[\u0980-\u09FF]/.test(word);
      const isAsciiWord = /^[a-z0-9]+$/.test(word);

      if (isBengali) {
        if (word.includes(" ") || STRICT_BOUNDARY_BENGALI.has(word)) {
          const escaped = escapeRegex(word);
          const bnRegex = new RegExp(
            `(?<=^|[\\s.,!?;:'"()\\-–—])${escaped}(?=$|[\\s.,!?;:'"()\\-–—])`,
            "u"
          );
          matched = bnRegex.test(rawClean) || bnRegex.test(safeCheckText);
        } else {
          // Compound/long Bengali gali (e.g. বোকাচোদা, মাগি, খানকি, মাদারচোদ)
          const bnSpaced = rawClean.replace(/[\s.,!?;:\-_'"*`~]+(?=[\u0980-\u09FF])/g, "");
          matched =
            safeCheckText.includes(word) ||
            rawClean.includes(word) ||
            bnSpaced.includes(word);
        }
      } else if (word.includes(" ")) {
        // Multi-word phrases ("magir pola", "fuck you", "kuttar bachcha")
        const escaped = escapeRegex(word).replace(/\s+/g, "\\s+");
        const phraseRegex = new RegExp(`(?<=^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i");
        matched =
          phraseRegex.test(rawClean) ||
          phraseRegex.test(normalized) ||
          phraseRegex.test(wildcardStripped);
      } else if (isAsciiWord) {
        const escaped = escapeRegex(word);
        const wordRegex = new RegExp(`(?<=^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i");

        // Ensure we don't flag if every matching token is explicitly in SAFE_WORDS
        const matchInRaw = wordRegex.test(rawClean) && nonSafeTokens.some((t) => wordRegex.test(t));
        const matchInNorm = wordRegex.test(normalized);
        const matchInWild = wordRegex.test(wildcardStripped);

        if (matchInRaw || matchInNorm || matchInWild) {
          // Extra guard against a single SAFE_WORDS token matching after normalization
          const normTokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
          const matchingNormTokens = normTokens.filter((t) => wordRegex.test(t));
          const onlySafeMatched =
            matchingNormTokens.length > 0 &&
            matchingNormTokens.every((t) => SAFE_WORDS.has(t));
          if (!onlySafeMatched) {
            matched = true;
          }
        }
      } else {
        // Custom word with special symbols
        matched = rawClean.includes(word) || normalized.includes(word);
      }

      if (matched) {
        matchedWords.push(word);
        break; // One confirmed profanity match is enough to trigger moderation
      }
    }

    if (matchedWords.length > 0) {
      reasons.push(`Prohibited Language / Gali (${matchedWords[0]})`);
    }
  }

  return {
    triggered: reasons.length > 0,
    reasons,
    matchedWords,
  };
}

export function getPunishmentDurationMs(punishment: AutoModPunishment): number | null {
  switch (punishment) {
    case "timeout_30s":
      return 30_000;
    case "timeout_40s":
      return 40_000;
    case "timeout_1m":
      return 60_000;
    case "timeout_5m":
      return 300_000;
    case "timeout_10m":
      return 600_000;
    case "warn":
    default:
      return null;
  }
}

export function formatPunishmentLabel(punishment: AutoModPunishment): string {
  switch (punishment) {
    case "timeout_30s":
      return "Timeout (30 Seconds)";
    case "timeout_40s":
      return "Timeout (40 Seconds)";
    case "timeout_1m":
      return "Timeout (1 Minute)";
    case "timeout_5m":
      return "Timeout (5 Minutes)";
    case "timeout_10m":
      return "Timeout (10 Minutes)";
    case "warn":
      return "Warn (Delete + Notice)";
    default:
      return punishment;
  }
}

/**
 * Executes full AutoMod check & enforcement on MessageCreate or MessageUpdate.
 * Returns true if an infraction occurred and action was taken.
 */
export async function executeAutoModCheck(
  message: Message | PartialMessage,
  isEdit: boolean = false
): Promise<boolean> {
  if (!message.guild || message.author?.bot) return false;

  const guild = message.guild;
  const autoMod = getAutoModConfig(guild.id);
  if (!autoMod.enabled) return false;

  const settings = getSettings(guild.id);
  const logsCfg = getLoggingConfig(guild.id);

  // Skip system log channels to prevent self-deletion loops on log embeds
  const systemExemptChannels = new Set<string>([
    ...(autoMod.exemptChannels || []),
    ...(logsCfg.logChannelId ? [logsCfg.logChannelId] : []),
    ...(logsCfg.messageLogChannelId ? [logsCfg.messageLogChannelId] : []),
    ...(logsCfg.commandLogChannelId ? [logsCfg.commandLogChannelId] : []),
  ]);
  if (systemExemptChannels.has(message.channelId)) return false;

  // Fetch member if not cached
  let member: GuildMember | null = message.member ?? null;
  if (!member && message.author?.id) {
    member = await guild.members.fetch(message.author.id).catch(() => null);
  }

  // Fixed Immunity Logic:
  // Only bypass if adminImmunity is TRUE AND the user is Owner/Admin/Staff/Exempt.
  // If adminImmunity is FALSE, Admins/Staff ARE checked too (for testing).
  const isOwner = message.author?.id === guild.ownerId;
  const isAdmin =
    isOwner ||
    Boolean(member?.permissions.has(PermissionFlagsBits.Administrator)) ||
    Boolean(member?.permissions.has(PermissionFlagsBits.ManageGuild)) ||
    Boolean(member?.permissions.has(PermissionFlagsBits.ModerateMembers));
  const isStaff = Boolean(
    member?.roles.cache.some((r) => settings.staffRoleIds?.includes(r.id))
  );
  const isExplicitExemptUser = Boolean(
    message.author?.id && autoMod.exemptUsers?.includes(message.author.id)
  );
  const isExplicitExemptRole = Boolean(
    member?.roles.cache.some((r) => autoMod.exemptRoles?.includes(r.id))
  );

  const isImmune = Boolean(
    autoMod.adminImmunity &&
      (isAdmin || isStaff || isExplicitExemptUser || isExplicitExemptRole)
  );
  if (isImmune) return false;

  let violated = false;
  let violationReason = "";

  // A. Content Evaluation (Invite, Link, Gali/Bad Words)
  const content = message.content || "";
  const contentEval = evaluateContentForAutoMod(content, autoMod);
  if (contentEval.triggered) {
    violated = true;
    violationReason = contentEval.reasons[0];
  }

  // B. Anti-Mass-Mention Check (skip on edit unless mentions increased? safe on both)
  if (!violated && autoMod.antiMention && "mentions" in message && message.mentions) {
    const totalMentions =
      (message.mentions.users?.size || 0) + (message.mentions.roles?.size || 0);
    if (totalMentions > 4) {
      violated = true;
      violationReason = `Mass Mention (${totalMentions} mentions)`;
    }
  }

  // C. Anti-Spam Check (> 4 messages in 3 seconds, only on new messages)
  if (!violated && !isEdit && autoMod.antiSpam && message.author?.id) {
    const now = Date.now();
    const timestamps = userMessageTimes.get(message.author.id) || [];
    const recent = timestamps.filter((t) => now - t < 3000);
    recent.push(now);
    userMessageTimes.set(message.author.id, recent);

    if (recent.length > 4) {
      violated = true;
      violationReason = "Rapid Message Spam";
      userMessageTimes.set(message.author.id, []);
    }
  }

  if (!violated) return false;

  // ─────────────────────────────────────────────────────────────
  // Enforcement: Delete + Timeout + Notice + Private Mod Log
  // ─────────────────────────────────────────────────────────────
  try {
    await message.delete().catch(() => {});

    const durationMs = getPunishmentDurationMs(autoMod.punishment);
    let timeoutNote = "Warning (Message deleted)";

    if (durationMs && member) {
      if (member.moderatable) {
        try {
          await member.timeout(durationMs, `AutoMod: ${violationReason}`);
          timeoutNote = formatPunishmentLabel(autoMod.punishment);
        } catch (err) {
          console.error("[automod:timeout:error]", err);
          timeoutNote = "Message deleted (Timeout failed - permissions)";
        }
      } else {
        timeoutNote = "Message deleted (Admin/Owner immune to Discord timeout)";
      }
    }

    // Channel notice (auto-deletes after 6s to keep chat clean)
    if (message.channel && "send" in message.channel) {
      try {
        const warnMsg = await (message.channel as TextChannel).send({
          content: `⚠️ **${message.author}**, your message was removed by **${BRAND.name} AutoMod** [Reason: \`${violationReason}\` • Action: \`${timeoutNote}\`]`,
        });
        setTimeout(() => warnMsg.delete().catch(() => {}), 6000);
      } catch (err) {
        console.error("[automod:warnMsg:error]", err);
      }
    }

    // Log infraction to configured AutoMod log channel (with channel fetch fallback!)
    if (autoMod.logChannelId) {
      let logChan = guild.channels.cache.get(autoMod.logChannelId) as TextChannel | undefined;
      if (!logChan) {
        logChan = (await guild.channels
          .fetch(autoMod.logChannelId)
          .catch(() => null)) as TextChannel | undefined;
      }

      if (logChan && logChan.isTextBased()) {
        const authorTag = message.author?.tag || "Unknown User";
        const logEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle(`🛡️ ${BRAND.name} AutoMod Action Taken`)
          .setDescription(
            [
              `👤 **Member:** ${message.author} (\`${authorTag}\`)`,
              `📍 **Channel:** <#${message.channelId}>${isEdit ? " *(via message edit)*" : ""}`,
              `⚠️ **Reason:** \`${violationReason}\``,
              `🔨 **Punishment:** \`${timeoutNote}\``,
              "",
              "**Deleted Content:**",
              `||${content.slice(0, 800) || "[No text / media]"}||`,
            ].join("\n")
          )
          .setFooter({ text: `User ID: ${message.author?.id || "unknown"}` })
          .setTimestamp();

        await logChan.send({ embeds: [logEmbed] }).catch((e) => {
          console.error("[automod:logSend:error]", e);
        });
      }
    }
  } catch (err) {
    console.error("[automod:action:error]", err);
  }

  return true;
}
