# Orko WhatsApp Integration

Send tasks to Orko via WhatsApp and receive responses back.

## Prerequisites

- Node.js 18+
- ngrok (`brew install ngrok`)
- Twilio account (free tier works)

## Quick Start

### 1. Configure Twilio

1. Create a Twilio account at [twilio.com](https://www.twilio.com)
2. Go to **Messaging** → **Try it out** → **Send a WhatsApp message**
3. Follow instructions to join the sandbox (send the join code to Twilio's WhatsApp number)
4. Note your sandbox WhatsApp number (e.g., `+14155238886`)

### 2. Set Up Environment

```bash
# Copy the example environment file
cp ../.env.example ../.env

# Edit with your credentials
nano ../.env
```

Configure these values:
- `TWILIO_ACCOUNT_SID` - From Twilio Console
- `TWILIO_AUTH_TOKEN` - From Twilio Console
- `TWILIO_WHATSAPP_NUMBER` - Sandbox number (format: `whatsapp:+14155238886`)
- `MY_WHATSAPP_NUMBER` - Your phone (format: `whatsapp:+1XXXXXXXXXX`)

### 3. Start the Integration

```bash
./start.sh
```

This will:
1. Install npm dependencies (first run)
2. Start ngrok tunnel
3. Start webhook server
4. Display the webhook URL

### 4. Configure Twilio Webhook

1. Go to Twilio Console → Messaging → Settings → WhatsApp sandbox settings
2. Set **When a message comes in** to: `https://<your-ngrok-url>/webhook`
3. Set method to **POST**
4. Save

### 5. Test It

Send a WhatsApp message to the Twilio sandbox number:
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
| `/help` | Show help message |
| `<any text>` | Treated as a task (same as `/task`) |

## How It Works

```
WhatsApp → Twilio → ngrok → Webhook Server → heartbeat.md
                                                  ↓
                                              Orko (Claude)
                                                  ↓
                            responses.json ← WhatsApp Reply
                                  ↓
                           Webhook Server
                                  ↓
                              Twilio → WhatsApp
```

1. You send a WhatsApp message
2. Twilio forwards it to the webhook server
3. Server adds an action to `heartbeat.md`
4. When Orko runs, it processes the action
5. Orko writes a response to `responses.json`
6. Webhook server detects the change and sends via Twilio
7. You receive the response on WhatsApp

## Files

| File | Purpose |
|------|---------|
| `server.js` | Express webhook server |
| `responses.json` | Queue for pending WhatsApp replies |
| `start.sh` | Start ngrok + server |
| `stop.sh` | Stop all services |
| `package.json` | Node.js dependencies |

## Stopping

```bash
./stop.sh
```

## Troubleshooting

### ngrok not starting
- Check if port 3000 is in use: `lsof -i :3000`
- Verify ngrok is installed: `which ngrok`

### Messages not arriving
- Check Twilio webhook URL is correct
- Check ngrok is running: `http://localhost:4040`
- Check server logs for errors

### Responses not sending
- Verify Twilio credentials in `.env`
- Check `responses.json` format is correct
- Check server logs for Twilio API errors

### Unauthorized sender
- Verify `MY_WHATSAPP_NUMBER` matches your phone
- Format must be `whatsapp:+1XXXXXXXXXX`

## Security

- Only messages from `MY_WHATSAPP_NUMBER` are processed
- Twilio signature validation is enabled by default
- PII is redacted from logs
- Never commit `.env` to git
