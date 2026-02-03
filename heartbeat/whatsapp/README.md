# Orko Telegram Integration

Send tasks to Orko via Telegram and receive responses back.

## Prerequisites

- Node.js 18+
- Telegram account

## Quick Start

### 1. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Choose a name and username for your bot
4. Copy the **bot token** provided (looks like `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Get Your Chat ID

1. Start a chat with your new bot (search for it by username)
2. Send any message to it (e.g., "hello")
3. Run this command (replace `YOUR_BOT_TOKEN`):
   ```bash
   curl https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
4. Find `"chat":{"id":123456789}` in the response - that number is your chat ID

### 3. Set Up Environment

```bash
# Copy the example environment file
cp ../.env.example ../.env

# Edit with your credentials
nano ../.env
```

Configure these values:
- `TELEGRAM_BOT_TOKEN` - From @BotFather
- `MY_TELEGRAM_CHAT_ID` - Your chat ID (numeric)

### 4. Start the Integration

```bash
./start.sh
```

This will:
1. Install npm dependencies (first run)
2. Start the Telegram bot with polling

### 5. Test It

Send a Telegram message to your bot:
- `/help` - Show available commands
- `/task Check the weather` - Add a task for Orko
- `/status` - Check Orko's status
- `/list` - List pending actions

## Commands

| Command | Description |
|---------|-------------|
| `/task <description>` | Add a new task for Orko to process |
| `/status` | Check Orko's current status |
| `/list` | List pending actions |
| `/help` or `/start` | Show help message |
| `<any text>` | Treated as a task (same as `/task`) |

## How It Works

```
Telegram → Bot Polling → Server → heartbeat.md
                                       ↓
                                   Orko (Claude)
                                       ↓
                     responses.json ← Telegram Reply
                           ↓
                        Server
                           ↓
                       Telegram
```

1. You send a Telegram message
2. Bot receives it via polling
3. Server adds an action to `heartbeat.md`
4. When Orko runs, it processes the action
5. Orko writes a response to `responses.json`
6. Server detects the change and sends via Telegram
7. You receive the response

## Files

| File | Purpose |
|------|---------|
| `server.js` | Telegram bot with polling |
| `responses.json` | Queue for pending Telegram replies |
| `start.sh` | Start bot |
| `stop.sh` | Stop bot |
| `package.json` | Node.js dependencies |

## Stopping

```bash
./stop.sh
```

## Troubleshooting

### Bot not responding
- Check if the bot is running: `ps aux | grep server.js`
- Check logs for errors
- Verify `TELEGRAM_BOT_TOKEN` is correct

### Messages not arriving
- Make sure you've started a chat with the bot
- Verify `MY_TELEGRAM_CHAT_ID` matches your chat ID
- Check bot logs for authorization errors

### Responses not sending
- Verify credentials in `.env`
- Check `responses.json` format is correct
- Check server logs for Telegram API errors

### Getting "Unauthorized" response
- Verify `MY_TELEGRAM_CHAT_ID` matches your Telegram chat ID
- Re-run the `getUpdates` curl command to confirm your chat ID

## Security

- Only messages from `MY_TELEGRAM_CHAT_ID` are processed
- PII is redacted from logs
- Never commit `.env` to git

## Advantages over WhatsApp/Twilio

- **No ngrok required** - Telegram uses polling, no need for public webhook URL
- **Free** - No per-message costs
- **Simpler setup** - Just create a bot with @BotFather
- **No sandbox limitations** - Works immediately in production
