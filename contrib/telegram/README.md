# Telegram Bot for Switchboard

> **Experimental** — This integration is a work-in-progress and not required for core Switchboard functionality. Some features (partner history, conversation mode) reference endpoints that don't exist yet.

Optional mobile control interface for Switchboard via Telegram.

## Setup

1. Create a Telegram bot via [@BotFather](https://t.me/BotFather)
2. Copy `bot/config.env.example` to `bot/config.env` and fill in your credentials
3. Install dependencies: `pip3 install -r bot/requirements.txt`
4. Run: `python3 bot/telegram_bot.py`

## Systemd Service (Linux)

```bash
cp switchboard-telegram.service ~/.config/systemd/user/
# Edit paths in the service file to match your setup
systemctl --user daemon-reload
systemctl --user enable switchboard-telegram
systemctl --user start switchboard-telegram
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

The bot talks to the Switchboard API (default: `http://localhost:5001`).
Switchboard has zero Telegram dependencies — this is fully optional.
