# GY6 Check-In Bot

A custom Slack bot for GY6's remote team to **check in, take breaks, mark "in a meeting", and check out**. Every action is logged to a Notion database, which is the single source of truth for attendance.

- **Hosting:** Cloudflare Workers
- **Data store:** Notion
- **Language:** TypeScript

> 📘 Full project documentation — decisions, build log, and changelog — lives in Notion. This README is the technical setup guide.

---

## What you need (one-time accounts)

1. **GitHub** account — stores the code. ✅ (you have this)
2. **Cloudflare** account (free) — runs the bot.
3. **Slack** workspace where you're an admin — installs the bot.
4. **Notion** integration token — lets the bot write to the attendance database.

> 🔐 You will **never** paste secrets into chat. All secret keys go into Cloudflare as encrypted secrets.

## Project structure

```
gy6-checkin-bot/
├── src/
│   ├── index.ts      # Main entry: handles all Slack requests
│   ├── slack.ts      # Slack signature check + API helpers
│   └── notion.ts     # Writes attendance rows to Notion
├── wrangler.toml     # Cloudflare configuration
├── package.json
├── tsconfig.json
├── .dev.vars.example # Template for local env values
└── README.md
```

## Environment variables (secrets)

| Name | What it is | Where to get it |
| --- | --- | --- |
| `SLACK_SIGNING_SECRET` | Verifies requests really come from Slack | Slack app → Basic Information |
| `SLACK_BOT_TOKEN` | Lets the bot call Slack (starts with `xoxb-`) | Slack app → OAuth & Permissions |
| `NOTION_TOKEN` | Lets the bot write to Notion (starts with `ntn_`) | notion.so/my-integrations |
| `NOTION_ATTENDANCE_DB_ID` | Which Notion database to write to | Attendance Log database link |
| `TZ_DEFAULT` | Fallback timezone | e.g. `Asia/Dhaka` |

## Setup

Follow the **Setup & Deployment Runbook** in the Notion documentation. In short:

1. Install tools: `npm install`
2. Create the Slack app.
3. Create the Notion integration and share the Attendance Log database with it.
4. Add the secrets to Cloudflare (`npx wrangler secret put NAME`).
5. Deploy: `npm run deploy`
6. Paste the Worker URL into the Slack app's Request URLs.

## Slash commands

| Command | Action |
| --- | --- |
| `/checkin` | Check in |
| `/break` | Start a break |
| `/back` | End a break |
| `/meeting` | Mark "in a meeting" |
| `/checkout` | Check out |

Or use the buttons on the bot's **Home** tab in Slack.
