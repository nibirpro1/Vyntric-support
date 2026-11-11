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
  "মাগির বাচ্চা",
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
  "হারামির বাচ্চা",
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
  "বেশ্যার পোলা",
  "রান্ডি",
  "রান্ডির",
  "রান্ডির পোলা",
  "ভাতার",
  "ভাতারী",
  "হেডা",
  "হেডার",
  "ফকিন্নির পোলা",
  "গুদমারানি",
  "গুদের",
  "লুচ্চা",
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
  "magir baccha",
  "khanki",
  "khankir",
  "khankirpola",
  "khankir pola",
  "khankir chele",
  "khankir bachcha",
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
  "haramir baccha",
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
  "balchir",
  "sala",
  "shala",
  "bessha",
  "beshya",
  "beshyar",
  "beshyamagi",
  "beshyar pola",
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
  "gudmarani",
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
  "fack",
  "fyck",
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

// High-severity compound slurs that never occur in normal words —
// checked even without spaces (e.g., "tuiektaabokachoda", "hahafuckyou")
const UNSPACED_COMPOUND_SLURS = [
  "bokachoda",
  "bokachuda",
  "bokacoda",
  "madarchod",
  "madarchud",
  "maderchod",
  "madarcod",
  "bhenchod",
  "behenchod",
  "motherfucker",
  "khankirpola",
  "khankimagi",
  "magirpola",
  "randirpola",
  "chudmarani",
  "podmarani",
  "gudmarani",
  "chudanirpola",
  "bhosdike",
  "bhosdiwale",
  "shuorerbachcha",
  "kuttarbachcha",
  "cocksucker",
  "asshole",
  "faggot",
  "nigger",
];

const STRICT_BOUNDARY_BENGALI = new Set(["বাল", "চুদ", "চোদ", "পোদ", "ফাক", "বিচ"]);

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

const OFFICIAL_DISCORD_HOSTS = [
  "discord.com",
  "discordapp.com",
  "discord.gg",
  "discord.media",
  "discordapp.net",
];

const PHISHING_PATTERNS = [
  /grabify\.link/i,
  /iplogger\.(org|com|co)/i,
  /2no\.co/i,
  /yip\.su/i,
  /blasze\.tk/i,
  /discrod/i,
  /dlscord/i,
  /discorcl/i,
  /dicsord/i,
  /discord-?(nitro|gift|airdrop|promo)/i,
  /free-?nitro/i,
  /nitro-?gift/i,
  /steamcommunuty/i,
  /steancommunity/i,
  /steamcommunnity/i,
  /stearnpowered/i,
];

// Homoglyph / Confusable Cyrillic + Greek lookalike mapping
const CONFUSABLE_MAP: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "і": "i", "у": "y",
  "к": "k", "м": "m", "н": "h", "т": "t", "в": "b", "з": "3", "ѕ": "s", "ј": "j",
  "А": "A", "Е": "E", "О": "O", "Р": "P", "С": "C", "Х": "X", "І": "I", "К": "K",
  "М": "M", "Н": "H", "Т": "T", "В": "B",
  "α": "a", "ε": "e", "ο": "o", "ρ": "p", "ι": "i", "κ": "k", "υ": "u", "ν": "v",
  "τ": "t", "χ": "x", "η": "n", "β": "b",
};

// Trackers with automatic periodic cleanup
const userMessageTimes: Map<string, number[]> = new Map();
const userRecentMessages: Map<string, Array<{ text: string; time: number }>> = new Map();
const userViolationStrikes: Map<string, number[]> = new Map();

const STRIKE_WINDOW_MS = 60 * 60 * 1000; // 1 hour rolling strike window

setInterval(() => {
  const now = Date.now();
  for (const [k, times] of userMessageTimes.entries()) {
    const fresh = times.filter((t) => now - t < 10_000);
    if (fresh.length === 0) userMessageTimes.delete(k);
    else userMessageTimes.set(k, fresh);
  }
  for (const [k, msgs] of userRecentMessages.entries()) {
    const fresh = msgs.filter((m) => now - m.time < 20_000);
    if (fresh.length === 0) userRecentMessages.delete(k);
    else userRecentMessages.set(k, fresh);
  }
  for (const [k, strikes] of userViolationStrikes.entries()) {
    const fresh = strikes.filter((t) => now - t < STRIKE_WINDOW_MS);
    if (fresh.length === 0) userViolationStrikes.delete(k);
    else userViolationStrikes.set(k, fresh);
  }
}, 300_000).unref();

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Decodes Unicode fancy mathematical alphabets (𝐟𝐮𝐜𝐤), circled letters (ⓐ-ⓩ),
 * fullwidth letters (ｆｕｃｋ), and Cyrillic/Greek homoglyphs (mаgi) back to ASCII,
 * while preserving Bengali Unicode script intact.
 */
export function decodeFancyAndHomoglyphs(raw: string): string {
  if (!raw) return "";
  let out = "";

  for (const ch of raw) {
    const cp = ch.codePointAt(0)!;

    // Mathematical Alphanumeric Symbols (Bold, Italic, Script, Sans, Monospace, etc.)
    if (cp >= 0x1d400 && cp <= 0x1d6a3) {
      // Blocks of 26 uppercase and 26 lowercase repeating every 52 codepoints
      const offset = cp - 0x1d400;
      const letterIdx = offset % 52;
      if (letterIdx < 26) {
        out += String.fromCharCode(65 + letterIdx);
        continue;
      } else {
        out += String.fromCharCode(97 + (letterIdx - 26));
        continue;
      }
    }
    // Circled uppercase Ⓐ-Ⓩ (0x24B6-0x24CF) and lowercase ⓐ-ⓩ (0x24D0-0x24E9)
    if (cp >= 0x24b6 && cp <= 0x24cf) {
      out += String.fromCharCode(65 + (cp - 0x24b6));
      continue;
    }
    if (cp >= 0x24d0 && cp <= 0x24e9) {
      out += String.fromCharCode(97 + (cp - 0x24d0));
      continue;
    }
    // Negative squared uppercase 🅰-🆉 (0x1F170-0x1F189)
    if (cp >= 0x1f170 && cp <= 0x1f189) {
      out += String.fromCharCode(65 + (cp - 0x1f170));
      continue;
    }
    // Confusable Cyrillic / Greek lookalikes
    if (CONFUSABLE_MAP[ch]) {
      out += CONFUSABLE_MAP[ch];
      continue;
    }

    // NFKD normalize individual fullwidth/compat Latin characters while keeping Bengali intact
    if (cp >= 0xff01 && cp <= 0xff5e) {
      out += ch.normalize("NFKD");
      continue;
    }

    out += ch;
  }

  // Strip Latin combining accents/Zalgo diacritics (U+0300-U+036F) cleanly
  // WITHOUT touching Bengali Unicode block (U+0980-U+09FF)
  return out.replace(/[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g, "");
}

/**
 * Full evasion-proof text normalizer:
 * - Decodes fancy Unicode fonts, homoglyphs & combining marks
 * - Removes zero-width invisible characters
 * - Converts leetspeak (@ -> a, 0 -> o, 1/! -> i, $ -> s, 3 -> e, 4 -> a, 5 -> s, 7 -> t, 8 -> b)
 * - Strips inline emoji noise inside words (e.g. f🔥u🔥c🔥k)
 * - Re-joins spaced single letters (m a g i, b.o.k.a.c.h.o.d.a)
 * - Collapses elongated repeats (shuuuuuyor -> shuyor)
 */
export function normalizeAutoModText(raw: string): string {
  if (!raw) return "";

  let text = decodeFancyAndHomoglyphs(raw)
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

  // Remove inline emoji symbols used to split bad words
  text = text.replace(/\p{Extended_Pictographic}/gu, "");

  // Merge separated single letters: e.g. "f u c k" or "m.a.g.i" or "b-o-k-a"
  text = text.replace(/(?<=\b[a-z])[\s._\-*~+/]+(?=[a-z]\b)/g, "");

  // Collapse 3+ repeated characters down to 1
  text = text.replace(/(.)\1{2,}/g, "$1");

  return text;
}

function stripWildcardSymbols(raw: string): string {
  return decodeFancyAndHomoglyphs(raw)
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, "")
    .toLowerCase()
    .replace(/[*_~`]/g, "");
}

function countCombiningMarksBurst(raw: string): number {
  let maxBurst = 0;
  let burst = 0;
  for (const ch of raw) {
    const cp = ch.codePointAt(0)!;
    // Diacritical marks used in Zalgo glitch spam (exclude Bengali block)
    if (
      (cp >= 0x0300 && cp <= 0x036f) ||
      (cp >= 0x1ab0 && cp <= 0x1aff) ||
      (cp >= 0x1dc0 && cp <= 0x1dff) ||
      (cp >= 0x20d0 && cp <= 0x20ff) ||
      (cp >= 0xfe20 && cp <= 0xfe2f)
    ) {
      burst++;
      if (burst > maxBurst) maxBurst = burst;
    } else {
      burst = 0;
    }
  }
  return maxBurst;
}

function countEmojis(content: string): number {
  const customEmojis = (content.match(/<a?:\w+:\d+>/g) || []).length;
  const withoutCustom = content.replace(/<a?:\w+:\d+>/g, "");
  const unicodeEmojis = (withoutCustom.match(/\p{Extended_Pictographic}/gu) || []).length;
  return customEmojis + unicodeEmojis;
}

function computeCapsStats(content: string): { letters: number; capsRatio: number } {
  // Ignore URLs, user/role/channel mentions, and custom emojis before counting caps
  const cleaned = content
    .replace(/https?:\/\/[^\s<>]+/gi, "")
    .replace(/<a?:\w+:\d+>/g, "")
    .replace(/<[@#][!&]?\d+>/g, "");

  const asciiLetters = cleaned.match(/[a-zA-Z]/g) || [];
  if (asciiLetters.length === 0) return { letters: 0, capsRatio: 0 };
  const upperCount = asciiLetters.filter((c) => c >= "A" && c <= "Z").length;
  return {
    letters: asciiLetters.length,
    capsRatio: upperCount / asciiLetters.length,
  };
}

export interface AutoModEvaluation {
  triggered: boolean;
  severity: "high" | "soft";
  reasons: string[];
  matchedWords: string[];
  diagnostics: {
    normalizedPreview: string;
    capsPercent: number;
    emojiCount: number;
    newlineCount: number;
    zalgoBurst: number;
  };
}

/**
 * Evaluates text content against ALL Advanced AutoMod rules.
 * Used identically by messageCreate, messageUpdate, and `/automod test`.
 */
export function evaluateContentForAutoMod(
  content: string,
  config: AutoModConfig
): AutoModEvaluation {
  const reasons: string[] = [];
  const matchedWords: string[] = [];
  let severity: "high" | "soft" = "soft";

  const normalized = normalizeAutoModText(content || "");
  const { letters: capsLetters, capsRatio } = computeCapsStats(content || "");
  const emojiCount = countEmojis(content || "");
  const newlineCount = ((content || "").match(/\r?\n/g) || []).length;
  const zalgoBurst = countCombiningMarksBurst(content || "");

  const diagnostics = {
    normalizedPreview: normalized.slice(0, 180),
    capsPercent: Math.round(capsRatio * 100),
    emojiCount,
    newlineCount,
    zalgoBurst,
  };

  if (!content || content.trim().length === 0) {
    return { triggered: false, severity, reasons, matchedWords, diagnostics };
  }

  // 1. Anti-Phishing & Scam URL Check (Highest severity)
  if (config.antiPhishing) {
    const urls = content.match(/https?:\/\/[^\s<>]+/gi) || [];
    for (const url of urls) {
      let host = "";
      try {
        host = new URL(url).hostname.toLowerCase();
      } catch {
        host = "";
      }
      const isOfficialDiscord =
        host !== "" &&
        OFFICIAL_DISCORD_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
      if (isOfficialDiscord) continue;

      if (PHISHING_PATTERNS.some((rx) => rx.test(url))) {
        reasons.push("Phishing / Scam Link Detected");
        severity = "high";
        break;
      }
    }
  }

  // 2. Anti-Invite Check
  if (
    config.antiInvite &&
    /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite|dsc\.gg)\/[a-z0-9_-]+/i.test(
      decodeFancyAndHomoglyphs(content)
    )
  ) {
    reasons.push("Discord Invite Link");
    severity = "high";
  }

  // 3. Anti-Link Check (allowing safe Discord CDN & Tenor/Giphy GIFs)
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
      severity = "high";
    }
  }

  // 4. Anti-Gali & Blacklisted Bad Words (Bengali + Banglish + Hindi + English + Custom)
  if (config.antiBadWords) {
    const rawClean = decodeFancyAndHomoglyphs(content)
      .normalize("NFC")
      .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, "")
      .toLowerCase();
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

    const rawTokens = rawClean.split(/[^a-z0-9\u0980-\u09FF]+/).filter(Boolean);
    const nonSafeTokens = rawTokens.filter((t) => !SAFE_WORDS.has(t));
    const safeCheckText = nonSafeTokens.join(" ");

    // Also compact all letters for unspaced compound detection (e.g. "tuibokachoda")
    const compactedAscii = normalized.replace(/[^a-z0-9]/g, "");

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
          const bnSpaced = rawClean.replace(/[\s.,!?;:\-_'"*`~]+(?=[\u0980-\u09FF])/g, "");
          matched =
            safeCheckText.includes(word) ||
            rawClean.includes(word) ||
            bnSpaced.includes(word);
        }
      } else if (word.includes(" ")) {
        const escaped = escapeRegex(word).replace(/\s+/g, "\\s+");
        const phraseRegex = new RegExp(`(?<=^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i");
        matched =
          phraseRegex.test(rawClean) ||
          phraseRegex.test(normalized) ||
          phraseRegex.test(wildcardStripped);
      } else if (isAsciiWord) {
        const escaped = escapeRegex(word);
        const wordRegex = new RegExp(`(?<=^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i");

        const matchInRaw = wordRegex.test(rawClean) && nonSafeTokens.some((t) => wordRegex.test(t));
        const matchInNorm = wordRegex.test(normalized);
        const matchInWild = wordRegex.test(wildcardStripped);

        if (matchInRaw || matchInNorm || matchInWild) {
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
        matched = rawClean.includes(word) || normalized.includes(word);
      }

      if (matched) {
        matchedWords.push(word);
        break;
      }
    }

    // Check unspaced compound slurs (e.g. "hahabokachodabro") if not already matched
    if (matchedWords.length === 0) {
      for (const slur of UNSPACED_COMPOUND_SLURS) {
        if (allowSet.has(slur)) continue;
        if (compactedAscii.includes(slur)) {
          matchedWords.push(slur);
          break;
        }
      }
    }

    if (matchedWords.length > 0) {
      reasons.push(`Prohibited Language / Gali (${matchedWords[0]})`);
      severity = "high";
    }
  }

  // 5. Anti-Zalgo / Glitch Text & Vertical Newline Flood (Soft unless repeated)
  if (config.antiZalgo) {
    if (zalgoBurst >= 8) {
      reasons.push(`Glitch / Zalgo Text (${zalgoBurst} stacked marks)`);
    } else if (newlineCount >= 12) {
      reasons.push(`Vertical Text Flood (${newlineCount} lines)`);
    }
  }

  // 6. Anti-Emoji Spam (> 10 emojis in a single message)
  if (config.antiEmoji && emojiCount > 10) {
    reasons.push(`Excessive Emoji Spam (${emojiCount} emojis)`);
  }

  // 7. Anti-Caps Flood (>= 18 ASCII letters and > 75% uppercase)
  if (config.antiCaps && capsLetters >= 18 && capsRatio > 0.75) {
    reasons.push(`Excessive Caps (${diagnostics.capsPercent}%)`);
  }

  return {
    triggered: reasons.length > 0,
    severity,
    reasons,
    matchedWords,
    diagnostics,
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

function formatDurationMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} Seconds`;
  return `${Math.round(ms / 60_000)} Minute(s)`;
}

export function getUserAutoModStrikes(guildId: string, userId: string): number {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const recent = (userViolationStrikes.get(key) || []).filter(
    (t) => now - t < STRIKE_WINDOW_MS
  );
  userViolationStrikes.set(key, recent);
  return recent.length;
}

export function resetUserAutoModStrikes(guildId: string, userId: string): void {
  userViolationStrikes.delete(`${guildId}:${userId}`);
}

function recordViolationStrike(guildId: string, userId: string): number {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const recent = (userViolationStrikes.get(key) || []).filter(
    (t) => now - t < STRIKE_WINDOW_MS
  );
  recent.push(now);
  userViolationStrikes.set(key, recent);
  return recent.length;
}

/**
 * Computes final timeout duration considering severity and Auto-Escalation Ladder.
 */
function resolveEscalatedTimeoutMs(
  basePunishment: AutoModPunishment,
  severity: "high" | "soft",
  strikeNumber: number,
  escalateEnabled: boolean
): { durationMs: number | null; label: string } {
  const baseMs = getPunishmentDurationMs(basePunishment);

  // Soft infractions (Caps / Emoji / Newline) only warn on Strike 1 unless escalated
  if (severity === "soft" && strikeNumber === 1) {
    return { durationMs: null, label: "Warning (Message deleted)" };
  }

  if (!escalateEnabled) {
    return {
      durationMs: baseMs,
      label: baseMs ? `Timeout (${formatDurationMs(baseMs)})` : "Warning (Message deleted)",
    };
  }

  // Smart Escalation Ladder
  let targetMs = baseMs || 30_000;
  if (strikeNumber === 2) targetMs = Math.max(targetMs, 120_000); // 2m
  else if (strikeNumber === 3) targetMs = Math.max(targetMs, 300_000); // 5m
  else if (strikeNumber >= 4) targetMs = Math.max(targetMs, 900_000); // 15m

  if (strikeNumber === 1 && !baseMs && severity === "high") {
    return { durationMs: null, label: "Warning (Message deleted)" };
  }

  const escalatedNote = strikeNumber > 1 ? ` [Escalated Strike #${strikeNumber}]` : "";
  return {
    durationMs: targetMs,
    label: `Timeout (${formatDurationMs(targetMs)})${escalatedNote}`,
  };
}

/**
 * Executes full Advanced AutoMod check & enforcement on MessageCreate or MessageUpdate.
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

  // Exempt system log channels & configured exempt channels
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

  // Immunity evaluation
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
  let severity: "high" | "soft" = "high";

  // A. Content Rules (Phishing, Invite, Link, Gali, Zalgo, Emoji, Caps)
  const content = message.content || "";
  const contentEval = evaluateContentForAutoMod(content, autoMod);
  if (contentEval.triggered) {
    violated = true;
    violationReason = contentEval.reasons[0];
    severity = contentEval.severity;
  }

  // B. Anti-Mass-Mention (> 4 mentions)
  if (!violated && autoMod.antiMention && "mentions" in message && message.mentions) {
    const totalMentions =
      (message.mentions.users?.size || 0) + (message.mentions.roles?.size || 0);
    if (totalMentions > 4) {
      violated = true;
      violationReason = `Mass Mention (${totalMentions} mentions)`;
      severity = "high";
    }
  }

  // C. Anti-Spam (> 4 messages in 3 seconds)
  if (!violated && !isEdit && autoMod.antiSpam && message.author?.id) {
    const key = `${guild.id}:${message.author.id}`;
    const now = Date.now();
    const timestamps = userMessageTimes.get(key) || [];
    const recent = timestamps.filter((t) => now - t < 3000);
    recent.push(now);
    userMessageTimes.set(key, recent);

    if (recent.length > 4) {
      violated = true;
      violationReason = "Rapid Message Spam";
      severity = "high";
      userMessageTimes.set(key, []);
    }
  }

  // D. Anti-Duplicate Flood (3 identical >= 6-char messages within 15s)
  if (
    !violated &&
    !isEdit &&
    autoMod.antiDuplicate &&
    message.author?.id &&
    content.trim().length >= 6
  ) {
    const key = `${guild.id}:${message.author.id}`;
    const now = Date.now();
    const cleanSample = content.trim().toLowerCase().replace(/\s+/g, " ");
    const history = (userRecentMessages.get(key) || []).filter((m) => now - m.time < 15_000);
    history.push({ text: cleanSample, time: now });
    userRecentMessages.set(key, history);

    const duplicates = history.filter((m) => m.text === cleanSample).length;
    if (duplicates >= 3) {
      violated = true;
      violationReason = `Duplicate Copy-Paste Spam (${duplicates}x)`;
      severity = "high";
      userRecentMessages.set(key, []);
    }
  }

  if (!violated) return false;

  // ─────────────────────────────────────────────────────────────
  // Enforcement: Delete + Escalating Timeout + Notice + DM + Log
  // ─────────────────────────────────────────────────────────────
  try {
    await message.delete().catch(() => {});

    const strikeCount = message.author?.id
      ? recordViolationStrike(guild.id, message.author.id)
      : 1;

    const { durationMs, label: resolvedPunishment } = resolveEscalatedTimeoutMs(
      autoMod.punishment,
      severity,
      strikeCount,
      autoMod.escalatePunishment
    );

    let actionNote = resolvedPunishment;
    if (durationMs && member) {
      if (member.moderatable) {
        try {
          await member.timeout(durationMs, `AutoMod (Strike #${strikeCount}): ${violationReason}`);
        } catch (err) {
          console.error("[automod:timeout:error]", err);
          actionNote = "Message deleted (Timeout failed - permissions)";
        }
      } else {
        actionNote = "Message deleted (Admin/Owner immune to Discord timeout)";
      }
    }

    // Channel warning notice (auto-deletes after 6s)
    if (message.channel && "send" in message.channel) {
      try {
        const warnMsg = await (message.channel as TextChannel).send({
          content: `⚠️ **${message.author}**, your message was removed by **${BRAND.name} AutoMod** [Reason: \`${violationReason}\` • Action: \`${actionNote}\`]`,
        });
        setTimeout(() => warnMsg.delete().catch(() => {}), 6000);
      } catch (err) {
        console.error("[automod:warnMsg:error]", err);
      }
    }

    // Optional DM Warning to offender
    if (autoMod.dmOnPunish && message.author && !isAdmin) {
      const dmEmbed = new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle(`🛡️ ${guild.name} AutoMod Notice`)
        .setDescription(
          `Your message in **#${(message.channel as TextChannel)?.name || "channel"}** was removed.\n\n` +
            `• **Reason:** \`${violationReason}\`\n` +
            `• **Action Taken:** \`${actionNote}\`\n` +
            `• **Active Strikes (1h):** \`Strike #${strikeCount}\`\n\n` +
            `*Please follow the server rules to avoid longer timeouts.*`
        )
        .setTimestamp();
      await message.author.send({ embeds: [dmEmbed] }).catch(() => {});
    }

    // Log infraction to configured private log channel
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
          .setColor(strikeCount >= 3 ? 0x992d22 : BRAND.colors.danger)
          .setTitle(
            strikeCount >= 4
              ? `🚨 ${BRAND.name} AutoMod — Repeat Offender (Strike #${strikeCount})`
              : `🛡️ ${BRAND.name} AutoMod Action Taken`
          )
          .setThumbnail(message.author?.displayAvatarURL() || null)
          .setDescription(
            [
              `👤 **Member:** ${message.author} (\`${authorTag}\`)`,
              `📍 **Channel:** <#${message.channelId}>${isEdit ? " *(via message edit)*" : ""}`,
              `⚠️ **Reason:** \`${violationReason}\``,
              `🔨 **Action:** \`${actionNote}\``,
              `📊 **1h Strikes:** \`Strike #${strikeCount}\` (${severity.toUpperCase()} severity)`,
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
