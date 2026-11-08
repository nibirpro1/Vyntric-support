# Vyntric Support — Premium Discord Ticket Bot

Brand: **Vyntric Support** · Logo assets: `assets/png/vyntric-logo.png` (vector + PNG in `assets/`)
Stack: **Node.js + TypeScript + discord.js v14** — same structure and conventions as the `insane-ownz` bot.

> Only **one feature** ships for now: a full premium **ticket system**.
> The panel offers three ticket types: **Claim Reward**, **Team Application**, **Partnership**.
> Every file in this repository is written in English (enforced by `npm run verify`).

---

## Features

| Feature | Details |
| --- | --- |
| Premium panel | Branded embed with banner, one colour-coded button per ticket type, auto-pinned |
| Type-specific forms | Claim Reward = 5 questions, Team Application = 5, Partnership = 5 (Discord modal limit respected) |
| Fully private tickets | `@everyone` denied; only the requester, staff roles and the bot can see the channel |
| Claim / Unclaim | Staff can take or release a ticket; the pinned header updates instantly |
| Priority control | Low / Normal / High / Urgent via dropdown or `/ticket priority` |
| HTML + TXT transcript | Styled dark-theme HTML transcript plus a plain `.txt` copy, also saved under `data/transcripts/` |
| Log channel | open / claim / priority / close / delete / rating events, transcripts attached on close |
| Auto archive | Closed tickets are moved to the archive category |
| DM + rating | Requester receives the transcript, the close reason and 1-5 star rating buttons in DM; ratings land in the feedback channel |
| Duplicate guard | One open ticket per member per type |
| Extra commands | `/ticket add · remove · rename · info · transcript · close · reopen · list` |
| Tier results | `/settier` saves a player's tier to the Vyntric Tiers website data file (auto-refreshes in 30s) and posts the MCTIERS-style result embed |
| No database | `data/store.json` (atomic, debounced writes) — zero infrastructure |
| Self-check | `npm run verify` — 38 checks covering payloads, limits, storage, transcripts and language policy |

---

## Setup

### 1. Create the bot
1. Open https://discord.com/developers/applications → **New Application** → name it `Vyntric Support`.
2. **Bot** tab → **Reset Token** → copy the token (goes into `.env`).
3. **Bot → Privileged Gateway Intents** → enable **SERVER MEMBERS INTENT**.
4. **Bot → Avatar** → upload `assets/png/vyntric-logo.png`.
   The bot reuses its own avatar as the icon on every embed, so changing the avatar re-themes the whole bot.

### 2. Invite the bot
The fastest way — the helper builds the link with the right permissions for you:
```powershell
npm run invite
```
It prints a link like
`https://discord.com/oauth2/authorize?client_id=YOUR_ID&permissions=268452368&scope=bot%20applications.commands`
Open it, pick your server, press **Authorize**.

Manual alternative (Developer Portal): OAuth2 → URL Generator → scopes `bot` + `applications.commands`,
then tick `View Channels`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`,
`Add Reactions`, `Manage Messages`, `Manage Channels`, `Manage Roles`.

> Where to find your Application ID: **General Information → Application ID** → paste it into `.env` as `CLIENT_ID`.
> The bot role must sit **above** the staff roles, otherwise channel permission overwrites will not apply.

### 3. Run it
```powershell
cd D:\vyntric-support
npm install
Copy-Item .env.example .env      # then fill in DISCORD_TOKEN, CLIENT_ID, GUILD_ID
npm run deploy-commands          # registers the slash commands (instant when GUILD_ID is set)
npm start                        # or, for development: npm run dev
```

### 4. Configure inside Discord
```text
/setup staff-role role:@Support             -> roles that can manage tickets
/setup log-channel channel:#ticket-logs     -> all ticket logs + transcripts
/setup feedback-channel channel:#reviews    -> 1-5 star reviews are posted here
/setup results-channel channel:#results     -> Vyntric Tiers test-result embeds
/setup category category:Vyntric            -> (optional) where tickets are created
/setup archive-category category:Archive    -> (optional) where closed tickets move
/setup ping-staff enabled:true
/setup dm-transcript enabled:true
/setup view                                 -> show the whole configuration
/setup stats                                -> ticket statistics
/panel channel:#support                     -> publish the panel (pinned automatically)
```
> If no category is configured, the bot creates **Vyntric Tickets** and **Vyntric Archive** automatically.

### 5. Optional: hosted branding
Host `assets/png/vyntric-banner.png` anywhere public (GitHub raw, imgur, CDN) and add to `.env`:
```
BRAND_BANNER_URL=https://.../vyntric-banner.png
BRAND_ICON_URL=https://.../vyntric-logo.png
```

---

## Ticket lifecycle

```text
/panel  ->  Claim Reward / Team Application / Partnership button
        ->  private form (5 questions)  ->  private channel (#reward-0001, #team-0002, #partner-0003)
        ->  pinned header: requester, submitted answers, priority, status, claimed-by
        ->  Claim (staff)  ->  Priority  ->  conversation / screenshots
        ->  Close (reason modal)  ->  HTML + TXT transcript  ->  log channel + archive + DM + rating
        ->  Reopen / Transcript / Delete (staff)
```

## Commands

| Command | Who can run it | What it does |
| --- | --- | --- |
| `/panel [channel]` | Manage Server | Publishes the premium ticket panel (auto-pinned) |
| `/ticket info` | owner + staff | Full ticket information |
| `/ticket transcript` | owner + staff | Download the HTML + TXT transcript |
| `/ticket close [reason]` | owner + staff | Transcript, archive, log entry, DM rating request |
| `/ticket claim` / `/ticket unclaim` | staff | Take or release the ticket |
| `/ticket add` / `/ticket remove <user>` | staff | Grant or revoke access for another member |
| `/ticket rename <name>` | staff | Rename the channel (slugified automatically) |
| `/ticket priority <level>` | staff | Low / Normal / High / Urgent |
| `/ticket reopen` | staff | Reopen a closed ticket |
| `/ticket list` | staff | Every open ticket in the server |
| `/setup ...` | Manage Server | `view`, `stats`, `staff-role`, `log-channel`, `category`, `archive-category`, `feedback-channel`, `ping-staff`, `dm-transcript`, `auto-archive`, `reset` |

**Buttons:** Claim · Transcript · Close · Reopen · Delete channel · Priority dropdown · 1-5 star rating (DM)

---

## Project structure

```text
vyntric-support/
├─ assets/
│  ├─ png/vyntric-logo.png        # bot avatar / server icon (used as every embed icon)
│  ├─ png/vyntric-emblem.png      # transparent emblem
│  ├─ png/vyntric-banner.png      # panel banner
│  └─ *.svg                       # vector versions of all three
├─ scripts/render-brand-assets.mjs    # logo + banner generator (npm run brand:assets)
├─ src/
│  ├─ config/tickets.ts           # the three ticket types and their questions
│  ├─ commands/tickets/panel.ts   # /panel
│  ├─ commands/tickets/ticket.ts  # /ticket
│  ├─ commands/settings/setup.ts  # /setup
│  ├─ events/                     # interactionCreate (router) + ready (brand preset)
│  ├─ handlers/                   # dynamic command + event loaders
│  ├─ interactions/ticketInteractions.ts   # every button / modal / select handler
│  ├─ lib/brand.ts                # colours, divider, embed factory
│  ├─ lib/customIds.ts            # single source of truth for custom ids
│  ├─ lib/panel.ts                # panel, header, control rows, rating row
│  ├─ lib/permissions.ts          # staff checks, category resolution, slugify
│  ├─ lib/store.ts                # JSON persistence (atomic + debounced)
│  ├─ lib/tickets.ts              # open / close / reopen / delete / rating flows
│  ├─ lib/transcript.ts           # HTML + TXT transcript builders
│  ├─ structures/                 # Command + VyntricClient
│  ├─ tools/verify.ts             # self-check (npm run verify)
│  ├─ deploy-commands.ts
│  └─ index.ts
├─ data/store.json                # runtime data (git-ignored)
└─ data/transcripts/<guildId>/    # every HTML transcript
```

## Customization

- **Questions or a new ticket type:** `src/config/tickets.ts` (max 5 questions per modal).
- **Colours, footer, divider:** `src/lib/brand.ts`.
- **Copy and emojis:** `src/lib/panel.ts` (panel + header) and `src/lib/tickets.ts` (flow messages).
- **Logo / banner:** edit `LEFT_SHAPES` and `CENTER_SHAPES` in `scripts/render-brand-assets.mjs`, then run
  `npm run brand:assets` — the SVGs and PNGs are regenerated from a single mirrored shape definition.

## Hosting 24/7

- Start command: `npm start` (run `npm run build` first, or use `npm install && npm run build` as the build step).
- Required environment variables: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`.
- Give the host a persistent volume and set `DATA_DIR=/data`, otherwise settings and the ticket counter reset on restart
  (the Discord channels themselves always remain).
- Without `GUILD_ID` the deploy script registers global commands, which can take up to an hour to appear.

## Health checks

```powershell
npm run typecheck     # TypeScript strict check
npm run invite        # print the OAuth2 invite link for your CLIENT_ID
npm run verify        # 41 checks: catalogue, panel/modal payloads, slash command payloads,
                      # store lifecycle, transcript XSS escaping, invite link, English-only policy
npm run brand:assets  # regenerate logo / banner assets
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| The bot cannot create ticket channels | Grant `Manage Channels` + `Manage Roles` and move the bot role above the staff roles |
| Panel buttons do nothing | Re-run `npm run deploy-commands` and restart the bot |
| Embeds have no logo | Set `assets/png/vyntric-logo.png` as the bot avatar, or set `BRAND_ICON_URL` |
| Staff cannot see tickets | Run `/setup staff-role role:@Support` (members with Manage Server always count as staff) |
| Ratings never appear | Run `/setup feedback-channel channel:#reviews` |
| Data disappears after a restart | Point `DATA_DIR` at a persistent volume |

## Roadmap

New features plug straight into the existing structure: add `src/commands/<feature>/` plus `src/lib/<feature>.ts`
(both loaders discover them automatically). Extra persistence slots go into `StoreShape` in `src/lib/store.ts`,
and the storage layer can be swapped for Prisma later — the same approach used by the `insane-ownz` bot.



---

## Vyntric Tiers — staff, testing and moderation

The bot also runs the tier ladder. Everything below is gated on a Discord role,
not on a secret URL, and no role the bot creates ever carries `Administrator`.

### Staff hierarchy

`/tester setup` creates all four roles with an exact permission bitfield, so a
permission change is a one-line edit in `src/config/staff.ts` rather than a
manual re-click in the Discord UI.

| Role | Rank | Can | Key permissions |
| --- | --- | --- | --- |
| **Tiers Tester** | 10 | Run tests, post results, log strikes | View/Send/Embed/Attach/Add Reactions in the tier channels |
| **Tiers Moderator** | 20 | Issue and lift punishments | the above + `Manage Roles`, `Kick`, `Ban`, `Manage Nicknames`, `Manage Messages` |
| **Tiers Regulator** | 30 | Appeals, force a verified server | the above + `Manage Roles`, `Manage Messages` |
| **Head of Testing** | 40 | Promote/demote staff, publish rules | the above + `Manage Channels` |

Two locks guard every grant: you must **outrank** the role, and the bot's own
role must sit **above** it. The second is the one that usually bites — a bot
that cannot outrank a role silently fails to grant it, so `/tester` says so
explicitly rather than appearing to do nothing.

| Command | What it does |
| --- | --- |
| `/tester setup` | Create every staff role with the right permissions |
| `/tester roles` | Show each role, its live permission list and who holds it |
| `/tester give` / `take` | Promote or demote, logged to `staff-movements` |
| `/tier` | Public ladder (profile, top, ladder, search) + staff writes (set, remove, retire, region) |
| `/hightest open` / `result` | The `high-tests` request feed and the `high-results` record |
| `/punish give` / `lift` / `history` | Punishment log, role application, appeals trail |
| `/strike rules` / `view` / `log` / `fight` / `history` | The demotion strike system |
| `/servers list` / `check` / `ping` / `add` / `remove` | The verified testing server registry |
| `/rules view` / `publish` / `arenas` | The published rule posts, per arena |

### Wiring the channels

```
/setup tier-channel feed:high-tests       channel:#high-tests
/setup tier-channel feed:high-results     channel:#high-results
/setup tier-channel feed:punishments      channel:#punishments
/setup tier-channel feed:staff-movements  channel:#staff-movements
/setup tier-channel feed:appeals          channel:#appeals
/setup tier-channel feed:results          channel:#results
```

Then, in **Server Settings → Roles**, drag each Vyntric role **below the bot's
highest role**, and allow the tester role to View + Send in the tier channels.

### Demotion strikes

Transcribed from the server's own `retirement-demotions` post. Three strikes
demote a player one rung; the two asymmetries in the published table are
preserved rather than smoothed over.

| Band | Same-tier loss | Loss to a lower tier | Dodging |
| --- | --- | --- | --- |
| LT1 / HT1 | 1 | **3** | **2** |
| LT2 / HT2 | 1 | 2 | 1 |
| HT3 | 1 | 2 | not published |

Also enforced: a forfeit that passes the opponent is **2** strikes at any tier,
a significant loss (per-arena, per-band score window) is **2**, a win against a
same-or-higher player is **−1**, and an **extreme loss** (ratio ≤ 0.2, e.g. 2/10
or 3-15) is an instant demotion.

`/strike fight` is the only path that moves a ranking on its own; a manual
`/strike log` writes to the ledger but never demotes, so a typo in a reason
cannot cost somebody a rung. The ledger is append-only — a correction is a new
record with the opposite delta — so `/strike history` is a real audit trail.

### Verified testing servers

`/servers list` publishes the registry with its dot key: 👑 primary (enforced
when players cannot agree), 🟢 verified (a Regulator can force it), 🟡 mutual
agreement, ⚪ unlisted. `/servers check host:` answers "may this fight run here",
and `/servers ping 155 170` applies the 20ms tick-range rule.

### Self-checks

| Command | Covers |
| --- | --- |
| `npm run verify` | Ticket payloads, modals, store lifecycle, transcripts, all 14 commands |
| `npm run verify:tiers` | The published strike table, duration parsing, ping parity, embed limits (85 checks) |
| `npm run typecheck` | `tsc --noEmit` |

The strike table is asserted against the published numbers explicitly, so a rule
change in `config/tiers.ts` or `lib/strikes.ts` that contradicts the pinned post
fails the build rather than shipping silently.

### If a command does not appear

Slash commands do not come from `npm start`. Run the deploy script:

```
npm run deploy-commands
```

`GUILD_ID` is set, so this writes guild commands and they appear within a few
seconds. Without `GUILD_ID` they would register globally, which takes up to an
hour and is a poor feedback loop while iterating.

If a new command still does not show, ask the server what it actually holds:

```
npm run doctor:commands
```

It prints the commands this codebase expects next to the ones Discord has
registered, and names any that are missing. If the two lists match but Discord
still shows nothing, the bot was invited without the `applications.commands`
scope - `npm run invite` prints a link that includes it.

Discord rejects a whole registration with `Invalid Form Body` when any required
option follows an optional one, and it registers nothing at all, so a single
mis-declared option makes *every* command vanish. `npm run verify` asserts that
rule for all commands and subcommands.
