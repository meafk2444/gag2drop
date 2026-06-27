# gag2drop 🌕 (made with AI)

Discord webhook bot that pings a role whenever a new event appears or an existing event changes state on `gag.gg/api/events`.

## How it works

- GitHub Actions runs `bot.js` **every 5 minutes** via cron
- Each run takes ~3 seconds and uses **almost no credits** (~450 min/month out of 2000 free)
- State is saved in `state.json`, committed directly to the repo
- The Discord webhook fires **only when something changes** — no spam

## Setup

### 1. Add GitHub Secrets

In your repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|------|-------|
| `WEBHOOK_URL` | your Discord webhook URL |
| `ROLE_ID` | the role ID to ping (optional, already hardcoded) |

### 2. Enable write permissions

Go to **Settings → Actions → General → Workflow permissions** and select **Read and write permissions** so the bot can commit `state.json`.

### 3. That's it!

The bot starts on its own. The first run silently initializes the state with no alerts sent. From then on, any new event or state change triggers a Discord embed with a role ping.

## Manual test

Go to **Actions → Check gag.gg events → Run workflow** to trigger an immediate check.

## Credit usage

| | Value |
|---|---|
| Runs per day | 288 (every 5 min) |
| Time per run | ~3 seconds |
| Monthly usage | ~450 min / 2000 free |
| Webhook calls | Only on change |
