import {
  Message,
  EmbedBuilder,
  TextChannel,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { getAIModConfig, DEFAULT_AI_LOG_CHANNEL } from "./aiModStore";
import { BRAND } from "./brand";

export interface AIAnalysisResult {
  isViolation: boolean;
  severity: "high" | "medium" | "low";
  category: string;
  confidence: number;
  matchedTerms: string[];
  explanation: string;
  engine: "Plugsy-AI-NLP" | "Gemini-Flash";
}

// ─────────────────────────────────────────────────────────────
// Multilingual Gali & Abusive Language Lexicon
// ─────────────────────────────────────────────────────────────

const BENGALI_SCRIPT_GALI = [
  "মাগি",
  "মাগীর",
  "খানকি",
  "খানকির",
  "খানকির পোলা",
  "খানকিরপোলা",
  "খানকির ঝি",
  "খানকির বেটি",
  "মাদারচোদ",
  "মাদারচোত",
  "মাদারচুদ",
  "বোকাচোদা",
  "বোকাচুদা",
  "চোদা",
  "চোদ",
  "চুদি",
  "চুদমারানী",
  "চুদির ভাই",
  "চুদিরভাই",
  "চুদানী",
  "গান্ডু",
  "রাঁড়ি",
  "রান্ডি",
  "রান্ডির পোলা",
  "শুয়োরের বাচ্চা",
  "শুয়োরেরবাচ্চা",
  "শুয়োর",
  "কুত্তার বাচ্চা",
  "কুত্তারবাচ্চা",
  "কুত্তা মারানি",
  "হারামি",
  "হারামজাদা",
  "হারামির পোলা",
  "হারামিরপোলা",
  "বাল",
  "বালের",
  "বাল শাল",
  "বেশ্যা",
  "ভাতার",
  "ভাতারী",
  "পোদ্মারানী",
];

const BANGLA_BANGLISH_GALI = [
  // High severity slurs / mother-sister / abusive terms
  "magi",
  "magir",
  "magirpola",
  "magir pola",
  "magir jhi",
  "khanki",
  "khankir",
  "khankirpola",
  "khankir pola",
  "khankir jhi",
  "khankir beti",
  "madarchod",
  "madarcod",
  "maderchod",
  "madercod",
  "bhenchod",
  "behenchod",
  "bencod",
  "bokachoda",
  "bokacuda",
  "bokachuda",
  "boka choda",
  "boka chuda",
  "gandu",
  "chudani",
  "chudmarani",
  "chudir",
  "chudirbhai",
  "chudir bhai",
  "chodachodi",
  "podmarani",
  "randi",
  "randir",
  "randirpola",
  "randir pola",
  "suorer baccha",
  "suorerbaccha",
  "suor er baccha",
  "shuyorer baccha",
  "kuttar baccha",
  "kuttarbaccha",
  "kutta marani",
  "bessa",
  "vesha",
  "bhatar",
  "bhatari",
  "harami",
  "haramzada",
  "haramzadi",
  "haramir pola",
  "haramirpola",
  "baler",
  "bal sal",
];

const HINDI_URDU_GALI = [
  "chutiya",
  "chutiye",
  "chutiyapa",
  "bhosdike",
  "bhosdiwale",
  "bhosdi",
  "gaand",
  "lodu",
  "lauda",
  "lawda",
  "chinal",
  "kuttiya",
  "kamina",
  "suar ki aulad",
];

const ENGLISH_SLURS_AND_TOXIC = [
  // Hate slurs
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "kike",
  "chink",
  // Severe profanity & toxic harassment
  "motherfucker",
  "fuck you",
  "fuck u",
  "go fuck",
  "shut the fuck up",
  "stfu",
  "bitch",
  "cunt",
  "whore",
  "slut",
  "kill yourself",
  "kys",
  "dickhead",
  "asshole",
  "dipshit",
  "cocksucker",
];

// Safe words that must NOT trigger false positives
const SAFE_WORDS = new Set([
  "classic",
  "class",
  "grass",
  "glass",
  "pass",
  "passport",
  "assistant",
  "assist",
  "balance",
  "ball",
  "balcony",
  "global",
  "balloon",
  "magic",
  "magical",
  "magician",
  "imagination",
  "boka", // innocent word for silly
  "bachelor",
  "analysis",
  "mass",
  "hello",
  "bhai",
  "kemon",
  "valo",
]);

/**
 * Normalizes text to defeat evasion tricks:
 * - strips zero-width chars and invisible characters
 * - converts leetspeak (@ -> a, 0 -> o, 1/! -> i, $ -> s, etc.)
 * - removes spacing between isolated single letters (e.g. "m a g i" -> "magi")
 * - collapses character repetitions (e.g. "shuuuuuyor" -> "shuyor")
 */
export function normalizeText(raw: string): string {
  if (!raw) return "";

  // 1. Strip zero-width and invisible characters
  let text = raw.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u202A-\u202E]/g, "").toLowerCase();

  // 2. Leetspeak map
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

  // 3. Spaced-out single letter re-joining: e.g. "b . o . k . a" or "m a g i"
  text = text.replace(/(?<=\b[a-z])[\s._\-*~]+(?=[a-z]\b)/g, "");

  // 4. Repeated character collapse (reduce 3+ repeats to at most 1 or 2)
  text = text.replace(/(.)\1{2,}/g, "$1");

  return text;
}

/**
 * Core NLP AI Analyzer for Bengali/Banglish/Hindi/English Gali & Toxicity
 */
export function analyzeChatNLP(rawContent: string, customBadWords: string[] = []): AIAnalysisResult {
  const normalized = normalizeText(rawContent);
  const lowerRaw = rawContent.toLowerCase();

  const matchedTerms: string[] = [];
  let detectedCategory = "";
  let severity: "high" | "medium" | "low" = "low";

  // Check custom server bad words first
  for (const cw of customBadWords) {
    const cleanCw = normalizeText(cw);
    if (!cleanCw) continue;
    if (normalized.includes(cleanCw) || lowerRaw.includes(cw.toLowerCase())) {
      matchedTerms.push(cw);
      detectedCategory = "Server Custom Banned Word";
      severity = "high";
      break;
    }
  }

  // Check Bengali Script
  if (matchedTerms.length === 0) {
    for (const term of BENGALI_SCRIPT_GALI) {
      if (lowerRaw.includes(term)) {
        matchedTerms.push(term);
        detectedCategory = "Bengali Abusive Slur (বাংলা গালি)";
        severity = "high";
        break;
      }
    }
  }

  // Check Bangla / Banglish Gali
  if (matchedTerms.length === 0) {
    for (const term of BANGLA_BANGLISH_GALI) {
      // Word boundary or normalized containment
      const regex = new RegExp(`(?<=^|[^a-z0-9])${term}(?=$|[^a-z0-9])`, "i");
      if (regex.test(normalized) || regex.test(lowerRaw)) {
        // Ensure it's not part of an innocent safe word
        const words = normalized.split(/[^a-z0-9]+/);
        const isSafe = words.some((w) => SAFE_WORDS.has(w) && w.includes(term));
        if (!isSafe) {
          matchedTerms.push(term);
          detectedCategory = "Banglish Abusive Slur (গালি)";
          severity = "high";
          break;
        }
      }
    }
  }

  // Check Hindi / Urdu Gali
  if (matchedTerms.length === 0) {
    for (const term of HINDI_URDU_GALI) {
      const regex = new RegExp(`(?<=^|[^a-z0-9])${term}(?=$|[^a-z0-9])`, "i");
      if (regex.test(normalized) || regex.test(lowerRaw)) {
        matchedTerms.push(term);
        detectedCategory = "Hindi/Urdu Abusive Slur (गाली)";
        severity = "high";
        break;
      }
    }
  }

  // Check English Slurs & Severe Toxicity
  if (matchedTerms.length === 0) {
    for (const term of ENGLISH_SLURS_AND_TOXIC) {
      let isHit = false;
      if (term.includes(" ")) {
        isHit = normalized.includes(term) || lowerRaw.includes(term);
      } else {
        const regex = new RegExp(`(?<=^|[^a-z0-9])${term}(?=$|[^a-z0-9])`, "i");
        isHit = regex.test(normalized) || regex.test(lowerRaw);
      }

      if (isHit) {
        // Safe word check
        const words = normalized.split(/[^a-z0-9]+/);
        const isSafe = words.some((w) => SAFE_WORDS.has(w) && w.includes(term));
        if (!isSafe) {
          matchedTerms.push(term);
          detectedCategory = term.match(/nigger|nigga|faggot|retard|kike|chink/)
            ? "Hate Speech / Slur"
            : "Profanity / Toxic Harassment";
          severity = "high";
          break;
        }
      }
    }
  }

  if (matchedTerms.length > 0) {
    return {
      isViolation: true,
      severity,
      category: detectedCategory,
      confidence: 0.98,
      matchedTerms,
      explanation: `Detected prohibited abusive language / gali: "${matchedTerms.join(", ")}"`,
      engine: "Plugsy-AI-NLP",
    };
  }

  return {
    isViolation: false,
    severity: "low",
    category: "Clean",
    confidence: 0.1,
    matchedTerms: [],
    explanation: "Message analyzed and deemed clean.",
    engine: "Plugsy-AI-NLP",
  };
}

/**
 * Optional Gemini Flash API integration (if GEMINI_API_KEY is available)
 */
async function callGeminiFlashModeration(content: string): Promise<AIAnalysisResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800); // 1.8s deadline

    const prompt = `You are a strict Discord chat moderation AI assistant.
Analyze this user chat message for:
1. Bengali / Banglish slurs & abusive words (গালি যেমন: মাগি, খানকি, মাদারচোদ, বোকাচোদা, শুয়োরের বাচ্চা, etc.).
2. Hindi / Urdu abusive slurs (chutiya, madarchod, bhenchod, etc.).
3. English severe profanity, hate speech, slurs (n-word, f-word, slurs, harassment).
4. Toxic harassment or death threats (kys, kill yourself, etc.).

Message:
"${content.replace(/"/g, '\\"')}"

Respond ONLY with valid JSON:
{
  "isViolation": boolean,
  "category": string,
  "confidence": number,
  "matchedTerms": string[],
  "explanation": string
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = (await res.json()) as any;
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return null;

    const parsed = JSON.parse(rawJson);
    return {
      isViolation: Boolean(parsed.isViolation),
      severity: parsed.isViolation ? "high" : "low",
      category: parsed.category || "AI Detected Toxicity",
      confidence: Number(parsed.confidence) || 0.95,
      matchedTerms: Array.isArray(parsed.matchedTerms) ? parsed.matchedTerms : [],
      explanation: parsed.explanation || "AI Assistant flagged abusive intent.",
      engine: "Gemini-Flash",
    };
  } catch {
    return null; // Fallback to NLP silently
  }
}

/**
 * Master analyzer combining Gemini Flash and ultra-fast NLP
 */
export async function analyzeMessageContent(
  content: string,
  customBadWords: string[] = []
): Promise<AIAnalysisResult> {
  // 1. Fast local NLP analysis
  const nlpResult = analyzeChatNLP(content, customBadWords);
  if (nlpResult.isViolation) {
    return nlpResult;
  }

  // 2. If clean on NLP, but Gemini API key exists and message is longer than 5 chars, run Gemini check
  if (process.env.GEMINI_API_KEY && content.trim().length > 5) {
    const geminiResult = await callGeminiFlashModeration(content);
    if (geminiResult && geminiResult.isViolation) {
      return geminiResult;
    }
  }

  return nlpResult;
}

/**
 * Handles incoming message in MessageCreate:
 * - Checks exemptions (Server Owner, Extra Owners, Admins, Logs channels)
 * - Analyzes message content
 * - Enforces timeout (default 40s) & message deletion
 * - Sends self-deleting chat alert
 * - Dispatches log to private AI log channel
 */
export async function handleAIMessageModeration(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;
  if (!message.content || message.content.trim().length === 0) return false;

  const guild = message.guild;
  const member = message.member;
  const config = getAIModConfig(guild.id);

  if (!config.enabled) return false;

  // ─────────────────────────────────────────────────────────────
  // 1. EXEMPTION CHECKS
  // ─────────────────────────────────────────────────────────────

  // Exempt specific users (Server Owner & Extra Owner)
  if (config.exemptUsers.includes(message.author.id)) return false;

  // Exempt Admins and ManageGuild holders
  if (
    member?.permissions.has(PermissionFlagsBits.Administrator) ||
    member?.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member?.permissions.has(PermissionFlagsBits.ModerateMembers)
  ) {
    return false;
  }

  // Exempt roles
  if (config.exemptRoles && config.exemptRoles.length > 0 && member) {
    const hasExemptRole = member.roles.cache.some((r) => config.exemptRoles.includes(r.id));
    if (hasExemptRole) return false;
  }

  // Exempt private log and staff channels
  if (config.exemptChannels.includes(message.channel.id)) return false;

  // ─────────────────────────────────────────────────────────────
  // 2. AI ANALYSIS
  // ─────────────────────────────────────────────────────────────
  const analysis = await analyzeMessageContent(message.content, config.customBadWords);
  if (!analysis.isViolation) return false;

  // ─────────────────────────────────────────────────────────────
  // 3. ENFORCEMENT ACTION (Delete + Timeout)
  // ─────────────────────────────────────────────────────────────
  const timeoutSeconds = config.timeoutSeconds || 40;
  const durationMs = timeoutSeconds * 1000;

  // Delete offending message
  if (config.deleteMessage) {
    await message.delete().catch(() => {});
  }

  // Apply Discord native timeout
  let timeoutSuccess = false;
  let timeoutErrorReason = "";
  if (member && member.moderatable) {
    try {
      await member.timeout(durationMs, `Plugsy AI: ${analysis.explanation}`);
      timeoutSuccess = true;
    } catch (err: any) {
      timeoutErrorReason = err?.message || "Failed to apply timeout";
      console.error("[aimod:timeout:error]", err);
    }
  } else {
    timeoutErrorReason = "Member not moderatable (Role hierarchy or missing permissions)";
  }

  // ─────────────────────────────────────────────────────────────
  // 4. TEMPORARY CHAT WARNING
  // ─────────────────────────────────────────────────────────────
  if (config.warnInChat && message.channel && "send" in message.channel) {
    try {
      const channel = message.channel as TextChannel;
      const warnEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🤖 Plugsy AI Moderation")
        .setDescription(
          `⚠️ **${message.author}** has been timed out for **${timeoutSeconds} seconds**.\n` +
          `**Reason:** Prohibited language / Gali detected (\`${analysis.category}\`).\n` +
          `*Please maintain respectful conversation.*`
        )
        .setFooter({ text: "Plugsy AI Assistant • Auto-deleting in 8s" });

      const sentMsg = await channel.send({ embeds: [warnEmbed] });
      setTimeout(() => sentMsg.delete().catch(() => {}), 8000);
    } catch (err) {
      console.error("[aimod:chatWarn:error]", err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. DIRECT MESSAGE TO USER
  // ─────────────────────────────────────────────────────────────
  if (config.sendDm) {
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`⚠️ Moderation Notice — ${guild.name}`)
        .setDescription(
          `You have been placed on a **${timeoutSeconds}-second timeout** in **${guild.name}** for using prohibited/abusive language.\n\n` +
          `**Violation Category:** \`${analysis.category}\`\n` +
          `**Details:** ${analysis.explanation}\n\n` +
          `*Please follow the server rules and keep the chat clean.*`
        )
        .setTimestamp();

      await message.author.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch {
      // Ignore closed DMs
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. LOG TO DEDICATED PRIVATE AI LOG CHANNEL
  // ─────────────────────────────────────────────────────────────
  try {
    const logChannelId = config.logChannelId || DEFAULT_AI_LOG_CHANNEL;
    let logChan = guild.channels.cache.get(logChannelId) as TextChannel | undefined;
    if (!logChan) {
      logChan = (await guild.channels.fetch(logChannelId).catch(() => null)) as TextChannel | undefined;
    }

    if (logChan && logChan.isTextBased()) {
      const actionText = timeoutSuccess
        ? `✅ **Timed out for ${timeoutSeconds}s** & Message Deleted`
        : `⚠️ **Message Deleted** (Timeout skipped: ${timeoutErrorReason})`;

      const logEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🤖 AI Assistant Moderation Action: Timeout")
        .setThumbnail(message.author.displayAvatarURL())
        .addFields(
          {
            name: "👤 Offender",
            value: `${message.author}\n\`${message.author.tag}\`\n\`ID: ${message.author.id}\``,
            inline: true,
          },
          {
            name: "📍 Channel",
            value: `<#${message.channel.id}>\n\`ID: ${message.channel.id}\``,
            inline: true,
          },
          {
            name: "⏱️ Action Taken",
            value: actionText,
            inline: true,
          },
          {
            name: "🧠 Violation Category",
            value: `\`${analysis.category}\` (${Math.round(analysis.confidence * 100)}% confidence)`,
            inline: true,
          },
          {
            name: "🔍 AI Detection",
            value: `Flagged: \`${analysis.matchedTerms.join(", ") || "Toxic Pattern"}\`\nAnalysis: *${analysis.explanation}*`,
            inline: true,
          },
          {
            name: "⚙️ AI Engine",
            value: `\`${analysis.engine}\``,
            inline: true,
          },
          {
            name: "💬 Offending Message",
            value: `||${message.content.slice(0, 1000) || "[No text / media]"}||`,
            inline: false,
          }
        )
        .setFooter({ text: `Plugsy AI Safety System • Server: ${guild.name}` })
        .setTimestamp();

      await logChan.send({ embeds: [logEmbed] });
    }
  } catch (err) {
    console.error("[aimod:logChannel:error]", err);
  }

  return true; // Handled and action taken
}
