#!/bin/bash
# Claude Code hook → Telegram notification
# Decoupled from bot process — works via direct Telegram Bot API curl.
# Configured as async hook so it doesn't block Claude.

set -euo pipefail

# Load config
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="${SCRIPT_DIR}/../bot/config.env"

if [ ! -f "$CONFIG" ]; then
    exit 0
fi

# Source config (TELEGRAM_BOT_TOKEN, ALLOWED_USER_ID)
set -a
source "$CONFIG"
set +a

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${ALLOWED_USER_ID:-}" ]; then
    exit 0
fi

# Read hook JSON from stdin
INPUT=$(cat)

EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
PROJECT=$(basename "${CWD:-unknown}")

case "$EVENT" in
    Stop)
        # Don't notify if stop hook is re-firing (prevent loops)
        STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
        if [ "$STOP_ACTIVE" = "true" ]; then
            exit 0
        fi

        LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // "(no message)"' | head -c 500)
        TEXT="<b>${PROJECT}</b> session stopped.

${LAST_MSG}"
        ;;

    Notification)
        TYPE=$(echo "$INPUT" | jq -r '.notification_type // empty')
        MSG=$(echo "$INPUT" | jq -r '.message // "(no message)"' | head -c 500)
        TITLE=$(echo "$INPUT" | jq -r '.title // empty')

        if [ -n "$TITLE" ]; then
            TEXT="<b>${PROJECT}</b> — ${TITLE}
${MSG}"
        else
            TEXT="<b>${PROJECT}</b>
${MSG}"
        fi
        ;;

    *)
        exit 0
        ;;
esac

# Send to Telegram (fire and forget, don't fail the hook)
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d chat_id="${ALLOWED_USER_ID}" \
    -d parse_mode="HTML" \
    --data-urlencode "text=${TEXT}" \
    > /dev/null 2>&1 || true

exit 0
