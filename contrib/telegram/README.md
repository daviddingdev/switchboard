# Telegram Bot for Helm

Optional mobile control interface for Helm via Telegram.

## Setup

1. Create a Telegram bot via [@BotFather](https://t.me/BotFather)
2. Copy `bot/config.env.example` to `bot/config.env` and fill in your credentials
3. Install dependencies: `pip3 install -r bot/requirements.txt`
4. Run: `python3 bot/telegram_bot.py`

## Systemd Service (Linux)

```bash
cp helm-telegram.service ~/.config/systemd/user/
# Edit paths in the service file to match your setup
systemctl --user daemon-reload
systemctl --user enable helm-telegram
systemctl --user start helm-telegram
```

## Notification Hook

`hooks/notify-telegram.sh` sends Claude Code stop/notification events to Telegram.

To use it, add it as a hook in your project's `.claude/settings.local.json`:

```json
{
  "hooks": {
    "Stop": [{ "command": "/path/to/contrib/telegram/hooks/notify-telegram.sh" }],
    "Notification": [{ "command": "/path/to/contrib/telegram/hooks/notify-telegram.sh" }]
  }
}
```

## Architecture

The bot talks to the Helm API (default: `http://localhost:5001`).
Helm has zero Telegram dependencies — this is fully optional.
