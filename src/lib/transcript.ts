import { AttachmentBuilder, TextChannel } from "discord.js";
import fs from "fs";
import path from "path";
import { BRAND } from "./brand";
import { TicketRecord, transcriptsDir } from "./store";
import { findTicketType } from "../config/tickets";

export interface TranscriptResult {
  html: AttachmentBuilder;
  txt: AttachmentBuilder;
  messageCount: number;
  participants: string[];
  savedPath: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function transcriptCss() {
  return `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin:0; background:#0d0709; color:#f3e9ea; font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
    .wrap { max-width: 940px; margin: 0 auto; padding: 40px 22px 80px; }
    header.hero { background:linear-gradient(135deg,#4d0710 0%,#8f0f1d 55%,#c81e2e 100%); border-radius:18px; padding:28px 30px; box-shadow:0 18px 40px rgba(200,30,46,.25); }
    header.hero h1 { margin:0; font-size:26px; letter-spacing:.5px; }
    header.hero p { margin:6px 0 0; opacity:.85; font-size:14px; }
    .pill { display:inline-block; background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.25); border-radius:999px; padding:4px 12px; font-size:12px; margin:10px 8px 0 0; }
    section.meta, section.answers { background:#160d10; border:1px solid #2a1519; border-radius:16px; padding:20px 24px; margin-top:22px; }
    section h2 { margin:0 0 14px; font-size:16px; color:#ff9aa6; letter-spacing:.6px; text-transform:uppercase; }
    .row { display:flex; gap:10px; font-size:14px; padding:5px 0; border-bottom:1px dashed rgba(255,255,255,.06); }
    .row:last-child { border-bottom:0; }
    .row .k { width:230px; flex:0 0 230px; color:#c9a8ad; }
    .row .v { white-space:pre-wrap; word-break:break-word; }
    .messages { margin-top:26px; display:flex; flex-direction:column; gap:14px; }
    .msg { display:flex; gap:14px; background:#150c0f; border:1px solid #26141a; border-radius:14px; padding:14px 16px; }
    .msg .avatar { width:42px; height:42px; border-radius:50%; background:#2a1519; flex:0 0 42px; }
    .msg .body { flex:1; min-width:0; }
    .msg .head { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
    .msg .author { font-weight:700; color:#ffd9de; }
    .msg .time { font-size:12px; color:#8f757a; }
    .msg .content { margin-top:6px; white-space:pre-wrap; word-break:break-word; font-size:14.5px; line-height:1.45; }
    .msg .note { margin-top:6px; font-size:12.5px; color:#a98e93; font-style:italic; }
    .msg.bot { border-color:#3a1d24; }
    footer { margin-top:34px; text-align:center; color:#7d6469; font-size:12px; }
  `;
}

export interface TranscriptEntry {
  authorId: string;
  authorTag: string;
  isBot: boolean;
  avatarUrl: string | null;
  content: string;
  notes: string[];
  at: number;
}

function typeLabel(ticket: TicketRecord) {
  const type = findTicketType(ticket.type);
  return type ? `${type.emoji} ${type.label}` : ticket.type;
}

function statusLabel(ticket: TicketRecord) {
  return ticket.status === "open" ? "Open" : "Closed";
}

export function buildHtmlTranscript(ticket: TicketRecord, entries: TranscriptEntry[]) {
  const type = findTicketType(ticket.type);
  const answerRows = type
    ? type.answers
        .filter((answer) => ticket.answers[answer.id])
        .map(
          (answer) =>
            `<div class="row"><div class="k">${escapeHtml(answer.label)}</div><div class="v">${escapeHtml(
              String(ticket.answers[answer.id])
            )}</div></div>`
        )
        .join("")
    : "";

  const messages = entries
    .map(
      (entry) => `
      <div class="msg${entry.isBot ? " bot" : ""}">
        ${entry.avatarUrl ? `<img class="avatar" src="${escapeHtml(entry.avatarUrl)}" alt="">` : `<div class="avatar"></div>`}
        <div class="body">
          <div class="head">
            <span class="author">${escapeHtml(entry.authorTag)}</span>
            <span class="time">${escapeHtml(new Date(entry.at).toISOString())}</span>
          </div>
          ${entry.content ? `<div class="content">${escapeHtml(entry.content)}</div>` : ""}
          ${entry.notes.map((note) => `<div class="note">${escapeHtml(note)}</div>`).join("")}
        </div>
      </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(`${BRAND.name} - Ticket #${ticket.number} transcript`)}</title>
<style>${transcriptCss()}</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <h1>${escapeHtml(BRAND.name)} — Ticket #${ticket.number.toString().padStart(4, "0")}</h1>
    <p>${escapeHtml(ticket.channelName)} • generated ${escapeHtml(new Date().toISOString())}</p>
    <div>
      <span class="pill">${escapeHtml(typeLabel(ticket))}</span>
      <span class="pill">Status: ${escapeHtml(statusLabel(ticket))}</span>
      <span class="pill">${entries.length} messages</span>
      <span class="pill">Priority: ${escapeHtml(ticket.priority)}</span>
    </div>
  </header>

  <section class="meta">
    <h2>Ticket information</h2>
    <div class="row"><div class="k">Ticket owner</div><div class="v">${escapeHtml(ticket.ownerId)}</div></div>
    <div class="row"><div class="k">Opened</div><div class="v">${escapeHtml(new Date(ticket.createdAt).toISOString())}</div></div>
    <div class="row"><div class="k">Claimed by</div><div class="v">${escapeHtml(ticket.claimedBy ?? "nobody")}</div></div>
    <div class="row"><div class="k">Closed by</div><div class="v">${escapeHtml(ticket.closedBy ?? "—")}</div></div>
    <div class="row"><div class="k">Close reason</div><div class="v">${escapeHtml(ticket.closeReason ?? "—")}</div></div>
    <div class="row"><div class="k">Member rating</div><div class="v">${ticket.rating ? `${ticket.rating}/5` : "not rated"}</div></div>
  </section>

  ${answerRows ? `<section class="answers"><h2>Submitted details</h2>${answerRows}</section>` : ""}

  <div class="messages">${messages || `<div class="msg"><div class="body">No messages were captured.</div></div>`}</div>

  <footer>${escapeHtml(BRAND.footer)} — this transcript was generated automatically.</footer>
</div>
</body>
</html>`;
}

export function buildTxtTranscript(ticket: TicketRecord, entries: TranscriptEntry[]) {
  const header = [
    `${BRAND.name} — ticket transcript`,
    `Ticket: #${ticket.number} (${typeLabel(ticket)})`,
    `Channel: #${ticket.channelName} (${ticket.channelId})`,
    `Owner: ${ticket.ownerId}`,
    `Status: ${statusLabel(ticket)}`,
    `Claimed by: ${ticket.claimedBy ?? "nobody"}`,
    `Closed by: ${ticket.closedBy ?? "—"}`,
    `Close reason: ${ticket.closeReason ?? "—"}`,
    `Rating: ${ticket.rating ? `${ticket.rating}/5` : "not rated"}`,
    `Generated: ${new Date().toISOString()}`,
    `Messages: ${entries.length}`,
    "".padEnd(60, "-"),
  ];

  const lines = entries.length
    ? entries.map((entry) => {
        const notes = entry.notes.length ? ` [${entry.notes.join(" | ")}]` : "";
        return `[${new Date(entry.at).toISOString()}] ${entry.authorTag}: ${entry.content}${notes}`;
      })
    : ["<no messages captured>"];

  return [...header, ...lines].join("\n");
}

export async function buildTranscript(
  channel: TextChannel,
  ticket: TicketRecord
): Promise<TranscriptResult> {
  const fetched = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const ordered = fetched
    ? [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    : [];

  const entries: TranscriptEntry[] = ordered.map((message) => {
    const notes: string[] = [];
    if (message.embeds.length) notes.push(`${message.embeds.length} embed(s)`);
    if (message.attachments.size) {
      notes.push(`attachments: ${[...message.attachments.values()].map((a) => a.name).join(", ")}`);
    }
    if (message.stickers.size) {
      notes.push(`stickers: ${[...message.stickers.values()].map((s) => s.name).join(", ")}`);
    }
    if (message.system) notes.push("system message");

    return {
      authorId: message.author.id,
      authorTag: message.author.tag,
      isBot: message.author.bot,
      avatarUrl: message.author.displayAvatarURL({ size: 64 }),
      content: message.cleanContent ?? message.content,
      notes,
      at: message.createdTimestamp,
    };
  });

  const html = buildHtmlTranscript(ticket, entries);
  const txt = buildTxtTranscript(ticket, entries);

  const folder = path.join(transcriptsDir(), ticket.guildId);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const savedPath = path.join(
    folder,
    `${ticket.number.toString().padStart(4, "0")}-${ticket.channelName}.html`
  );
  try {
    fs.writeFileSync(savedPath, html, "utf8");
  } catch (err) {
    console.error("[transcript] Could not write transcript to disk", err);
  }

  return {
    html: new AttachmentBuilder(Buffer.from(html, "utf8"), {
      name: `${ticket.channelName}-${ticket.number}.html`,
      description: `${BRAND.name} transcript for ticket #${ticket.number}`,
    }),
    txt: new AttachmentBuilder(Buffer.from(txt, "utf8"), {
      name: `${ticket.channelName}-${ticket.number}.txt`,
    }),
    messageCount: entries.length,
    participants: [...new Set(entries.map((entry) => entry.authorTag))],
    savedPath,
  };
}

