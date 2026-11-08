import { ButtonStyle, TextInputStyle } from "discord.js";

/**
 * Vyntric Support ticket catalogue.
 */
export type TicketTypeId =
  | "general_support"
  | "order_support"
  | "claim_reward"
  | "team_application"
  | "partnership"
  | "player_report";

export interface TicketQuestion {
  /** TextInput custom id + the label reused in the ticket header embed. */
  id: string;
  label: string;
  placeholder: string;
  style: TextInputStyle;
  maxLength: number;
  required: boolean;
}

export interface TicketType {
  id: TicketTypeId;
  label: string;
  emoji: string;
  buttonStyle: ButtonStyle;
  color: number;
  /** Channel name prefix, e.g. `ticket-0007`. */
  channelPrefix: string;
  blurb: string;
  promise: string;
  highlights: string[];
  /** First reply expectation, printed in the ticket header. */
  sla: string;
  answers: TicketQuestion[];
}

export const TICKET_TYPES: TicketType[] = [
  {
    id: "general_support",
    label: "General Support",
    emoji: "📩",
    buttonStyle: ButtonStyle.Primary,
    color: 0x5865f2,
    channelPrefix: "ticket",
    blurb: "Need assistance? Questions, server help, or general issues.",
    promise: "A staff member will assist you directly in this channel.",
    highlights: [
      "General help, questions, or issues",
      "Direct response from server staff",
      "Private 1-on-1 channel",
    ],
    sla: "Support replies promptly.",
    answers: [
      {
        id: "subject",
        label: "Subject / Topic",
        placeholder: "Briefly explain what you need help with",
        style: TextInputStyle.Short,
        maxLength: 100,
        required: true,
      },
      {
        id: "details",
        label: "Details (optional)",
        placeholder: "Provide any extra info or context",
        style: TextInputStyle.Paragraph,
        maxLength: 600,
        required: false,
      },
    ],
  },
  {
    id: "order_support",
    label: "Order Support",
    emoji: "🛍️",
    buttonStyle: ButtonStyle.Primary,
    color: 0x9b5de5,
    channelPrefix: "order",
    blurb: "Help with store orders, purchases, coins, or pre-sale questions.",
    promise: "Our store and sales team will assist you with your order.",
    highlights: [
      "Order issues, delivery, tracking, or refunds",
      "Pre-sale questions, pricing, and package info",
      "Custom orders, special requests, or seller roles",
    ],
    sla: "Sales team replies within 12 hours.",
    answers: [
      {
        id: "item_order",
        label: "Item / Service / Order ID",
        placeholder: "What order or item do you need assistance with?",
        style: TextInputStyle.Short,
        maxLength: 100,
        required: true,
      },
      {
        id: "issue_details",
        label: "Describe your order issue or question",
        placeholder: "Give full details about your order or request",
        style: TextInputStyle.Paragraph,
        maxLength: 600,
        required: true,
      },
      {
        id: "proof",
        label: "Transaction ID / Receipt link (optional)",
        placeholder: "Paste transaction ID, receipt link, or 'in ticket'",
        style: TextInputStyle.Short,
        maxLength: 200,
        required: false,
      },
    ],
  },
  {
    id: "claim_reward",
    label: "Claim Reward",
    emoji: "🎁",
    buttonStyle: ButtonStyle.Success,
    color: 0xf2c14e,
    channelPrefix: "reward",
    blurb: "Collect an event, giveaway or tournament prize.",
    promise: "Attach your proof and a Vyntric team member delivers your reward.",
    highlights: [
      "You won a Vyntric giveaway, event or tournament",
      "The reward was never delivered or arrived incomplete",
      "The prize must be moved to another account",
    ],
    sla: "Rewards are verified and delivered within 24 hours.",
    answers: [
      {
        id: "reward",
        label: "Reward / Prize",
        placeholder: "e.g. 5000 Vyntric coins, Nitro, custom role",
        style: TextInputStyle.Short,
        maxLength: 100,
        required: true,
      },
      {
        id: "source",
        label: "Event or Giveaway name",
        placeholder: "e.g. Vyntric Launch Giveaway #2",
        style: TextInputStyle.Short,
        maxLength: 100,
        required: true,
      },
      {
        id: "proof",
        label: "Proof link (screenshot / clip)",
        placeholder: "Paste an image or clip URL, or write 'in this ticket'",
        style: TextInputStyle.Short,
        maxLength: 200,
        required: true,
      },
      {
        id: "account",
        label: "Account, IGN or Discord ID",
        placeholder: "Where should the reward be delivered?",
        style: TextInputStyle.Short,
        maxLength: 80,
        required: true,
      },
      {
        id: "notes",
        label: "Extra details (optional)",
        placeholder: "Anything else the team should know",
        style: TextInputStyle.Paragraph,
        maxLength: 400,
        required: false,
      },
    ],
  },
  {
    id: "team_application",
    label: "Team Application",
    emoji: "🛡️",
    buttonStyle: ButtonStyle.Primary,
    color: 0xb1121f,
    channelPrefix: "team",
    blurb: "Apply for staff, support, design or moderation.",
    promise: "Your application is reviewed by Vyntric management, never in public.",
    highlights: [
      "Support, moderation, design or development roles",
      "Reviewed within 3 days by management",
      "Shortlisted applicants get a private voice interview",
    ],
    sla: "Management answers every application within 72 hours.",
    answers: [
      {
        id: "position",
        label: "Position you are applying for",
        placeholder: "e.g. Support Agent / Moderator / Designer",
        style: TextInputStyle.Short,
        maxLength: 80,
        required: true,
      },
      {
        id: "availability",
        label: "Weekly availability + timezone",
        placeholder: "e.g. 20h/week, GMT+6",
        style: TextInputStyle.Short,
        maxLength: 100,
        required: true,
      },
      {
        id: "experience",
        label: "Relevant experience",
        placeholder: "Previous teams, servers or projects you worked with",
        style: TextInputStyle.Paragraph,
        maxLength: 600,
        required: true,
      },
      {
        id: "motivation",
        label: "Why should Vyntric pick you?",
        placeholder: "Tell us what you bring to the team",
        style: TextInputStyle.Paragraph,
        maxLength: 600,
        required: true,
      },
      {
        id: "portfolio",
        label: "Portfolio / profile links (optional)",
        placeholder: "GitHub, Behance, YouTube, Discord tag...",
        style: TextInputStyle.Short,
        maxLength: 200,
        required: false,
      },
    ],
  },
  {
    id: "partnership",
    label: "Partnership",
    emoji: "🤝",
    buttonStyle: ButtonStyle.Secondary,
    color: 0xd1435a,
    channelPrefix: "partner",
    blurb: "Partner your server, brand or community with Vyntric.",
    promise: "A partnership manager negotiates the deal with you right here.",
    highlights: [
      "Server, community or brand partnerships",
      "Cross-events, shoutouts and shared giveaways",
      "Sponsorships and paid collaborations",
    ],
    sla: "A partnership manager replies within 48 hours.",
    answers: [
      {
        id: "brand",
        label: "Server or brand name",
        placeholder: "Name of your community or company",
        style: TextInputStyle.Short,
        maxLength: 100,
        required: true,
      },
      {
        id: "size",
        label: "Member count / audience size",
        placeholder: "e.g. 12,000 members, 40k subscribers",
        style: TextInputStyle.Short,
        maxLength: 60,
        required: true,
      },
      {
        id: "offer",
        label: "What you bring to Vyntric",
        placeholder: "Audience, services, events, revenue share...",
        style: TextInputStyle.Paragraph,
        maxLength: 600,
        required: true,
      },
      {
        id: "request",
        label: "What you expect from us",
        placeholder: "The deal you have in mind",
        style: TextInputStyle.Paragraph,
        maxLength: 600,
        required: true,
      },
      {
        id: "contact",
        label: "Contact / invite link",
        placeholder: "discord.gg/... or an email address",
        style: TextInputStyle.Short,
        maxLength: 200,
        required: true,
      },
    ],
  },
  {
    id: "player_report",
    label: "Report Player / Bug",
    emoji: "🚨",
    buttonStyle: ButtonStyle.Danger,
    color: 0xe23a4e,
    channelPrefix: "report",
    blurb: "Report a rule-breaker, toxicity, cheater, or technical bug.",
    promise: "Moderators will investigate your report confidentially.",
    highlights: [
      "Rule violations, toxicity, or harassment",
      "Cheating, hacking, or unfair gameplay",
      "Server exploits or technical glitches",
    ],
    sla: "Moderation team reviews reports within 24 hours.",
    answers: [
      {
        id: "target_user",
        label: "Reported User / Subject",
        placeholder: "Who or what are you reporting?",
        style: TextInputStyle.Short,
        maxLength: 100,
        required: true,
      },
      {
        id: "reason",
        label: "Reason / Details",
        placeholder: "Explain what happened in detail",
        style: TextInputStyle.Paragraph,
        maxLength: 600,
        required: true,
      },
      {
        id: "evidence",
        label: "Evidence / Proof Link (optional)",
        placeholder: "Screenshot, clip URL, or 'posting in ticket'",
        style: TextInputStyle.Short,
        maxLength: 200,
        required: false,
      },
    ],
  },
];

export function findTicketType(id: string): TicketType | undefined {
  return TICKET_TYPES.find((type) => type.id === id);
}
