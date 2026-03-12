#!/usr/bin/env python3
"""Telegram bot for orchestrator — mobile control interface with button-based UI."""

__version__ = "0.6.0"

import asyncio
import html
import json
import logging
import os
import re
import time
from datetime import datetime
from functools import wraps
from pathlib import Path

import httpx
from dotenv import load_dotenv
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    Update,
)
from telegram.constants import ParseMode
from telegram.error import BadRequest
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

# Load config
env_path = Path(__file__).parent / "config.env"
load_dotenv(env_path)

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ALLOWED_USER_ID = int(os.getenv("ALLOWED_USER_ID", "0"))
API_URL = os.getenv("API_URL", "http://localhost:5001")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
CONTEXT_WARN_PCT = int(os.getenv("CONTEXT_WARN_PCT", "80"))
CONTEXT_COMPACT_PCT = int(os.getenv("CONTEXT_COMPACT_PCT", "90"))
CONTEXT_CRITICAL_PCT = int(os.getenv("CONTEXT_CRITICAL_PCT", "95"))
CONTEXT_CHECK_INTERVAL = int(os.getenv("CONTEXT_CHECK_INTERVAL", "300"))
RESPONSE_POLL_TIMEOUT = int(os.getenv("RESPONSE_POLL_TIMEOUT", "90"))

# Set to True to re-enable automatic notifications (context warnings, proposal alerts, etc.)
ENABLE_AUTO_NOTIFICATIONS = False

logging.basicConfig(
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("telegram_bot")

# Track which workers were auto-compacted recently to avoid spam
_recently_compacted: dict[str, float] = {}
# Track seen proposal IDs for background push
_seen_proposals: set[str] = set()
# Shared HTTP client for connection pooling
_http_client: httpx.AsyncClient | None = None
# Command history (most recent last)
_command_history: list[str] = []
MAX_HISTORY = 20
# Conversation mode flag
_conversation_mode: bool = False
# Scheduled commands: list of (run_at_timestamp, command, target)
_scheduled_commands: list[tuple[float, str, str]] = []
# State directory for persistence
STATE_DIR = Path(__file__).parent / "state"
STATE_DIR.mkdir(exist_ok=True)
PINS_FILE = STATE_DIR / "pins.json"
SNAPSHOTS_FILE = STATE_DIR / "snapshots.json"


def _load_json(path: Path) -> list:
    """Load JSON list from file."""
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            return []
    return []


def _save_json(path: Path, data: list):
    """Save list to JSON file."""
    path.write_text(json.dumps(data, indent=2))


async def get_http_client() -> httpx.AsyncClient:
    """Get or create shared HTTP client with connection pooling."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=15)
    return _http_client


# --- Persistent reply keyboard ---

REPLY_KEYBOARD = ReplyKeyboardMarkup(
    [["Output", "Status", "Workers"],
     ["Enable RC", "Git", "Proposals"],
     ["Spawn", "Services", "Ask"]],
    resize_keyboard=True,
)

# ConversationHandler states
SPAWN_PICK, SPAWN_CUSTOM_DIR = range(2)
ASK_WAITING = 0


# --- Auth ---

def auth(func):
    """Decorator — silently ignore messages from unauthorized users."""
    @wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.effective_user.id != ALLOWED_USER_ID:
            return
        return await func(update, context)
    return wrapper


def auth_callback(func):
    """Decorator for callback query handlers — always answers the query."""
    @wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.effective_user.id != ALLOWED_USER_ID:
            await update.callback_query.answer("Unauthorized")
            return
        return await func(update, context)
    return wrapper


# --- Message helpers ---

MAX_MSG_LEN = 4096


async def send_chunked(message, text: str, parse_mode=ParseMode.HTML, reply_markup=None):
    """Send a message, splitting on newlines at 4096 chars. Takes a Message object."""
    if not text:
        text = "(empty)"
    chunks = _split_chunks(text, MAX_MSG_LEN)
    for i, chunk in enumerate(chunks):
        if i > 0:
            await asyncio.sleep(0.3)
        markup = reply_markup if i == len(chunks) - 1 else None
        try:
            await message.reply_text(chunk, parse_mode=parse_mode, reply_markup=markup)
        except Exception:
            try:
                await message.reply_text(chunk, parse_mode=None, reply_markup=markup)
            except Exception as e:
                log.error("Failed to send chunk %d/%d: %s", i + 1, len(chunks), e)
    if len(chunks) > 1:
        log.info("Sent %d chunks", len(chunks))


async def send_chunked_to_chat(bot, chat_id: int, text: str, parse_mode=ParseMode.HTML, reply_markup=None):
    """Send a chunked message directly to a chat_id (for background jobs)."""
    if not text:
        text = "(empty)"
    chunks = _split_chunks(text, MAX_MSG_LEN)
    for i, chunk in enumerate(chunks):
        if i > 0:
            await asyncio.sleep(0.3)
        markup = reply_markup if i == len(chunks) - 1 else None
        try:
            await bot.send_message(chat_id=chat_id, text=chunk, parse_mode=parse_mode, reply_markup=markup)
        except Exception:
            try:
                await bot.send_message(chat_id=chat_id, text=chunk, parse_mode=None, reply_markup=markup)
            except Exception as e:
                log.error("Failed to send chunk %d/%d to %s: %s", i + 1, len(chunks), chat_id, e)


def _split_chunks(text: str, limit: int) -> list[str]:
    """Split text into chunks at newline boundaries."""
    if len(text) <= limit:
        return [text]
    chunks = []
    current = ""
    for line in text.split("\n"):
        candidate = current + "\n" + line if current else line
        if len(candidate) > limit:
            if current:
                chunks.append(current)
            while len(line) > limit:
                chunks.append(line[:limit])
                line = line[limit:]
            current = line
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def esc(text: str) -> str:
    """Escape text for HTML parse mode."""
    return html.escape(str(text))


def _progress_bar(pct: int, width: int = 10) -> str:
    filled = round(pct / 100 * width)
    return "[" + "=" * filled + " " * (width - filled) + "]"


# --- API helpers ---

async def api_get(path: str, **params) -> dict | list | None:
    try:
        client = await get_http_client()
        r = await client.get(f"{API_URL}{path}", params=params)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.error("API GET %s failed: %s", path, e)
        return None


async def api_post(path: str, data: dict = None) -> dict | None:
    try:
        client = await get_http_client()
        r = await client.post(f"{API_URL}{path}", json=data, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.error("API POST %s failed: %s", path, e)
        return None


async def api_patch(path: str, data: dict = None) -> dict | None:
    try:
        client = await get_http_client()
        r = await client.patch(f"{API_URL}{path}", json=data)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.error("API PATCH %s failed: %s", path, e)
        return None


async def api_delete(path: str) -> dict | None:
    try:
        client = await get_http_client()
        r = await client.delete(f"{API_URL}{path}")
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.error("API DELETE %s failed: %s", path, e)
        return None


# --- View builders ---

async def build_status_view() -> tuple[str, InlineKeyboardMarkup]:
    """Build status dashboard text and inline keyboard."""
    health, procs, usage, proposals, partner_out = await asyncio.gather(
        api_get("/api/health"),
        api_get("/api/processes"),
        api_get("/api/workers/usage"),
        api_get("/api/proposals"),
        api_get("/api/processes/partner/output", lines=5),
    )

    lines = []
    if health:
        status = health.get("status", "unknown")
        session = "yes" if health.get("session") else "no"
        lines.append(f"<b>API:</b> {esc(status)}  |  <b>Session:</b> {session}")
    else:
        lines.append("<b>API:</b> unreachable")

    # Partner state detection
    partner_state = "unknown"
    if partner_out and "output" in partner_out:
        out = partner_out["output"].strip().lower()
        if "waiting for input" in out or out.endswith(">") or "─" in out[-50:]:
            partner_state = "🟢 idle"
        elif "thinking" in out or "working" in out or "..." in out[-30:]:
            partner_state = "🔄 working"
        else:
            partner_state = "🟡 active"
    lines.append(f"<b>Partner:</b> {partner_state}")

    workers_usage = {}
    if usage and "workers" in usage:
        for w in usage["workers"]:
            workers_usage[w["name"]] = w

    if procs:
        lines.append(f"\n<b>Workers ({len(procs)}):</b>")
        for p in procs:
            name = p["name"]
            u = workers_usage.get(name)
            if u:
                pct = u.get("pct", 0)
                bar = _progress_bar(pct)
                lines.append(f"  <b>{esc(name)}</b>  {bar} {pct}%")
            else:
                lines.append(f"  <b>{esc(name)}</b>")
    else:
        lines.append("\n<b>Workers:</b> none")

    pending = [p for p in (proposals or []) if p.get("status") == "pending"]
    lines.append(f"\n<b>Proposals:</b> {len(pending)} pending" if pending else "\n<b>Proposals:</b> none")

    markup = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("Refresh", callback_data="st:refresh"),
            InlineKeyboardButton("Workers >>", callback_data="wk:list"),
            InlineKeyboardButton("Proposals >>", callback_data="pr:list"),
        ]
    ])

    return "\n".join(lines), markup


async def build_worker_list() -> tuple[str, InlineKeyboardMarkup]:
    """Build worker list with per-worker buttons."""
    procs, usage = await asyncio.gather(
        api_get("/api/processes"),
        api_get("/api/workers/usage"),
    )
    if not procs:
        markup = InlineKeyboardMarkup([
            [InlineKeyboardButton("Refresh", callback_data="wk:list")]
        ])
        return "No workers or API unreachable.", markup

    workers_usage = {}
    if usage and "workers" in usage:
        for w in usage["workers"]:
            workers_usage[w["name"]] = w

    buttons = []
    for p in procs:
        name = p["name"]
        u = workers_usage.get(name)
        label = f"{name}  {u.get('pct', '?')}%" if u else name
        buttons.append([InlineKeyboardButton(label, callback_data=f"wk:{name}")])

    buttons.append([InlineKeyboardButton("Refresh", callback_data="wk:list")])
    return f"<b>Workers ({len(procs)}):</b>", InlineKeyboardMarkup(buttons)


async def build_worker_actions(name: str) -> tuple[str, InlineKeyboardMarkup]:
    """Build action menu for a specific worker."""
    # Fetch both in parallel
    procs, usage = await asyncio.gather(
        api_get("/api/processes"),
        api_get("/api/workers/usage"),
    )

    found = any(p["name"] == name for p in (procs or []))
    if not found:
        return f"Worker <b>{esc(name)}</b> not found.", InlineKeyboardMarkup([
            [InlineKeyboardButton("<< Back", callback_data="wk:list")]
        ])

    workers_usage = {}
    if usage and "workers" in usage:
        for w in usage["workers"]:
            workers_usage[w["name"]] = w

    u = workers_usage.get(name)
    if u:
        pct = u.get("pct", 0)
        bar = _progress_bar(pct)
        header = f"<b>{esc(name)}</b>  {bar} {pct}%"
    else:
        header = f"<b>{esc(name)}</b>"

    markup = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("Output", callback_data=f"wk:{name}:out"),
            InlineKeyboardButton("Last msg", callback_data=f"wk:{name}:last"),
        ],
        [
            InlineKeyboardButton("Compact", callback_data=f"wk:{name}:cmp"),
            InlineKeyboardButton("Enable RC", callback_data=f"wk:{name}:rc"),
        ],
        [
            InlineKeyboardButton("Reset", callback_data=f"wk:{name}:reset"),
            InlineKeyboardButton("Hard Reset", callback_data=f"wk:{name}:hrst"),
        ],
        [
            InlineKeyboardButton("Restart", callback_data=f"wk:{name}:rst"),
            InlineKeyboardButton("Kill", callback_data=f"wk:{name}:kill"),
        ],
        [
            InlineKeyboardButton("Kill NOW", callback_data=f"wk:{name}:nuke"),
        ],
        [InlineKeyboardButton("<< Back", callback_data="wk:list")],
    ])

    return header, markup


async def build_git_overview() -> tuple[str, InlineKeyboardMarkup]:
    """Build git overview: changed files + unpushed commits across all projects."""
    data = await api_get("/api/activity")
    if not data:
        markup = InlineKeyboardMarkup([
            [InlineKeyboardButton("Refresh", callback_data="git:list")]
        ])
        return "Git status unavailable (API unreachable).", markup

    changes_by_proj = {c["project"]: c["files"] for c in (data.get("changes") or [])}
    unpushed_by_proj = {u["project"]: u["commits"] for u in (data.get("unpushed") or [])}

    all_projects = sorted(set(changes_by_proj) | set(unpushed_by_proj))

    if not all_projects:
        markup = InlineKeyboardMarkup([
            [InlineKeyboardButton("Refresh", callback_data="git:list")]
        ])
        return "<b>Git Status</b>\n\nAll projects clean and up to date.", markup

    lines = ["<b>Git Status</b>\n"]
    buttons = []
    for proj in all_projects:
        files = changes_by_proj.get(proj, [])
        commits = unpushed_by_proj.get(proj, [])
        parts = []
        if files:
            n = len(files)
            parts.append(f"{n} file{'s' if n != 1 else ''} changed")
        else:
            parts.append("clean")
        if commits:
            n = len(commits)
            parts.append(f"{n} unpushed")
        else:
            parts.append("up to date")
        lines.append(f"<b>{esc(proj)}</b>\n  {' · '.join(parts)}")
        buttons.append([InlineKeyboardButton(f"{proj} >>", callback_data=f"git:{proj}")])

    buttons.append([InlineKeyboardButton("Refresh", callback_data="git:list")])
    return "\n".join(lines), InlineKeyboardMarkup(buttons)


async def build_git_detail(project: str) -> tuple[str, InlineKeyboardMarkup]:
    """Build git detail view for a single project."""
    data = await api_get("/api/activity")
    if not data:
        markup = InlineKeyboardMarkup([
            [InlineKeyboardButton("<< Back", callback_data="git:list")]
        ])
        return f"Git detail unavailable for {esc(project)}.", markup

    files = []
    for c in (data.get("changes") or []):
        if c["project"] == project:
            files = c["files"]
            break

    commits = []
    for u in (data.get("unpushed") or []):
        if u["project"] == project:
            commits = u["commits"]
            break

    if not files and not commits:
        markup = InlineKeyboardMarkup([
            [InlineKeyboardButton("<< Back", callback_data="git:list")]
        ])
        return f"<b>{esc(project)}</b>\n\nClean — nothing to do.", markup

    lines = [f"<b>{esc(project)}</b>\n"]

    if commits:
        lines.append(f"<b>Unpushed ({len(commits)}):</b>")
        shown = commits[:10]
        for c in shown:
            lines.append(f"  <code>{esc(c['hash'][:7])}</code> {esc(c['message'])}")
        if len(commits) > 10:
            lines.append(f"  ... and {len(commits) - 10} more")
        lines.append("")

    if files:
        lines.append(f"<b>Changed ({len(files)}):</b>")
        shown = files[:15]
        for f in shown:
            lines.append(f"  {esc(f['status'])} {esc(f['path'])}")
        if len(files) > 15:
            lines.append(f"  ... and {len(files) - 15} more")

    row = []
    if commits:
        row.append(InlineKeyboardButton("Push", callback_data=f"git:{project}:push"))
    row.append(InlineKeyboardButton("<< Back", callback_data="git:list"))
    return "\n".join(lines), InlineKeyboardMarkup([row])


# Known services to check — customize for your setup
# Format: "name": ("health_check_url", port)
SERVICES = {
    "orchestrator": ("http://localhost:5001/api/health", 5001),
}


async def _check_service(client: httpx.AsyncClient, name: str, url: str, port: int) -> str:
    """Check a single service health."""
    try:
        r = await client.get(url, timeout=3)
        if r.status_code < 400:
            return f"  ✅ <b>{esc(name)}</b> (:{port})"
        return f"  ⚠️ <b>{esc(name)}</b> (:{port}) — {r.status_code}"
    except httpx.ConnectError:
        return f"  ❌ <b>{esc(name)}</b> (:{port}) — offline"
    except httpx.TimeoutException:
        return f"  ⏱️ <b>{esc(name)}</b> (:{port}) — timeout"
    except Exception as e:
        return f"  ❌ <b>{esc(name)}</b> (:{port}) — {type(e).__name__}"


async def build_services_view() -> tuple[str, InlineKeyboardMarkup]:
    """Build services status overview (parallel checks)."""
    client = await get_http_client()

    # Check all services in parallel
    tasks = [_check_service(client, name, url, port) for name, (url, port) in SERVICES.items()]
    results = await asyncio.gather(*tasks)

    lines = ["<b>Services:</b>\n"] + list(results)
    markup = InlineKeyboardMarkup([
        [InlineKeyboardButton("Refresh", callback_data="svc:refresh")]
    ])
    return "\n".join(lines), markup


# --- Shared action helpers ---

async def _do_spawn(message, name: str, directory: str):
    """Spawn a worker and enable /rc."""
    result = await api_post("/api/processes", {"name": name, "directory": directory})
    if not result:
        await message.reply_text(f"Failed to spawn {name}.")
        return

    actual_name = result.get("name", name)
    await message.reply_text(
        f"Spawned <b>{esc(actual_name)}</b> in {esc(directory)} (with /rc)",
        parse_mode=ParseMode.HTML,
    )


async def _do_kill(message, name: str):
    """End-of-session then kill after 60s."""
    await api_post(f"/api/processes/{name}/send", {
        "text": "Complete end-of-session tasks per CLAUDE.md, then say DONE"
    })
    await message.reply_text(
        f"Sent end-of-session to <b>{esc(name)}</b>. Will kill in 60s.",
        parse_mode=ParseMode.HTML,
    )
    await asyncio.sleep(60)
    result = await api_delete(f"/api/processes/{name}")
    if result:
        await message.reply_text(f"Killed <b>{esc(name)}</b>.", parse_mode=ParseMode.HTML)
    else:
        await message.reply_text(f"Failed to kill {name} (may already be gone).")


async def _do_reset(message, name: str):
    """Soft reset a worker (Ctrl-C then /rc)."""
    await api_post(f"/api/processes/{name}/send", {"text": "\x03"})
    await asyncio.sleep(2)
    await api_post(f"/api/processes/{name}/send", {"text": "/rc"})
    await message.reply_text(f"Sent reset to <b>{esc(name)}</b>.", parse_mode=ParseMode.HTML)


async def _do_hard_reset(message, name: str):
    """Hard reset a worker (kill + respawn)."""
    await _do_restart(message, name)


async def _do_compact(message, name: str):
    """Send /compact to a worker."""
    result = await api_post(f"/api/processes/{name}/send", {"text": "/compact"})
    if result and result.get("status") == "sent":
        await message.reply_text(f"Sent /compact to <b>{esc(name)}</b>", parse_mode=ParseMode.HTML)
    else:
        await message.reply_text(f"Failed to compact {name}.")


async def _do_restart(message, name: str, extra_args=None):
    """Kill, respawn in same directory, re-enable /rc."""
    await api_delete(f"/api/processes/{name}")
    await message.reply_text(f"Killed <b>{esc(name)}</b>. Respawning...", parse_mode=ParseMode.HTML)

    directory = None
    if extra_args:
        directory = " ".join(extra_args)
    else:
        projects = await api_get("/api/projects")
        if projects:
            for p in projects:
                if p.get("name") == name:
                    directory = p.get("directory")
                    break
        if not directory:
            await message.reply_text(
                f"Could not find directory for {name}. Use: /spawn {name} <directory>",
            )
            return

    await asyncio.sleep(2)
    result = await api_post("/api/processes", {"name": name, "directory": directory})
    if not result:
        await message.reply_text(f"Failed to respawn {name}.")
        return

    await message.reply_text(f"Respawned <b>{esc(name)}</b> (with /rc)", parse_mode=ParseMode.HTML)


async def _send_output(message, name: str, lines: int = 100):
    """Send recent terminal output for a worker."""
    result = await api_get(f"/api/processes/{name}/output", lines=lines)
    if result and "output" in result:
        output = result["output"] or "(no output)"
        await message.reply_text(f"<b>{esc(name)}</b>:", parse_mode=ParseMode.HTML)
        await send_chunked(message, output, parse_mode=None)
    else:
        await message.reply_text(f"Failed to get output from {name}.")


async def _wait_and_get_response(last_msg_before: str | None, chat=None, timeout: int = 60) -> str | None:
    """Wait for partner to finish responding, then return the NEW message."""
    start = time.time()
    poll_interval = 1.5
    stable_count = 0
    last_output = ""
    last_typing = start
    last_hash = hash(last_msg_before) if last_msg_before else 0

    while time.time() - start < timeout:
        await asyncio.sleep(poll_interval)

        # Refresh typing indicator every 4 seconds
        if chat and time.time() - last_typing > 4:
            try:
                await chat.send_action("typing")
            except Exception:
                pass
            last_typing = time.time()

        result = await api_get("/api/processes/partner/output", lines=30)
        current_output = result.get("output", "") if result else ""

        # Check for idle indicators (prompt visible = done responding)
        is_idle = "❯" in current_output[-100:] or ("───" in current_output[-100:] and "❯" not in current_output[-200:-100])

        if current_output == last_output and current_output:
            stable_count += 1
            # If output is stable AND looks idle, we're done
            if is_idle and stable_count >= 2:
                break
            # Even if not clearly idle, if stable for long enough assume done
            elif stable_count >= 4:
                break
        else:
            stable_count = 0
            last_output = current_output

    # Fetch the last assistant message
    await asyncio.sleep(0.5)
    history = await api_get("/api/partner/history", limit=5)
    if history and "messages" in history:
        assistant_msgs = [m for m in history["messages"] if m.get("role") == "assistant"]
        if assistant_msgs:
            new_msg = assistant_msgs[-1].get("content", "")
            new_hash = hash(new_msg)
            # Return if it's a different message (by hash comparison)
            if new_hash != last_hash:
                return new_msg
    return None


async def _send_last(message, name: str, count: int = 1):
    """Send last N assistant messages from partner history."""
    result = await api_get("/api/partner/history", limit=50)
    if not result or "messages" not in result:
        await message.reply_text("Failed to get partner history.")
        return

    assistant_msgs = [m for m in result["messages"] if m.get("role") == "assistant"]
    if not assistant_msgs:
        await message.reply_text("No assistant messages found.")
        return

    recent = assistant_msgs[-count:]
    for msg in recent:
        content = msg.get("content", "(empty)")
        if len(content) > 3000:
            content = content[:3000] + "\n\n... (truncated)"
        await send_chunked(message, content, parse_mode=None)
        if len(recent) > 1:
            await asyncio.sleep(0.3)


async def _send_proposals(message):
    """Send each pending proposal as its own message with Approve/Reject buttons."""
    proposals = await api_get("/api/proposals")
    if not proposals:
        await message.reply_text("No proposals or API unreachable.")
        return

    pending = [p for p in proposals if p.get("status") == "pending"]
    if not pending:
        await message.reply_text("No pending proposals.")
        return

    for p in pending:
        pid = p.get("id", "?")
        title = p.get("title", "Untitled")
        worker = p.get("worker", "?")
        steps = p.get("steps", [])

        lines = [f"<b>{esc(pid)}</b> — {esc(title)}"]
        lines.append(f"  Worker: {esc(worker)}")
        for i, s in enumerate(steps, 1):
            lines.append(f"  {i}. {esc(s)}")

        markup = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("Approve", callback_data=f"pr:{pid}:a"),
                InlineKeyboardButton("Reject", callback_data=f"pr:{pid}:r"),
            ]
        ])
        await message.reply_text(
            "\n".join(lines),
            parse_mode=ParseMode.HTML,
            reply_markup=markup,
        )
        await asyncio.sleep(0.3)


async def _do_ask(message, question: str):
    """Query Ollama and send the response."""
    await message.reply_text("Thinking...")
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": [{"role": "user", "content": question}],
                    "stream": False,
                },
            )
            r.raise_for_status()
            data = r.json()
            answer = data.get("message", {}).get("content", "(no response)")
            await send_chunked(message, answer, parse_mode=None)
    except Exception as e:
        await message.reply_text(f"Ollama error: {e}")


# --- Commands ---

@auth
async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/start — Send persistent keyboard."""
    await update.message.reply_text("Orchestrator ready.", reply_markup=REPLY_KEYBOARD)


@auth
async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/status — Health + worker dashboard with buttons."""
    text, markup = await build_status_view()
    await update.message.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=markup)


@auth
async def cmd_workers(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/workers — Active workers with buttons."""
    text, markup = await build_worker_list()
    await update.message.reply_text(text, parse_mode=ParseMode.HTML, reply_markup=markup)


@auth
async def cmd_spawn(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/spawn <name> <directory> — Spawn worker, auto-enable /rc."""
    args = context.args
    if not args or len(args) < 2:
        await update.message.reply_text("Usage: /spawn <name> <directory>")
        return
    name = args[0]
    directory = " ".join(args[1:])
    await _do_spawn(update.message, name, directory)


@auth
async def cmd_kill(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/kill <name> — End-of-session then kill."""
    if not context.args:
        await update.message.reply_text("Usage: /kill <name>")
        return
    await _do_kill(update.message, context.args[0])


@auth
async def cmd_kill_now(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/kill_now <name> — Immediate kill."""
    if not context.args:
        await update.message.reply_text("Usage: /kill_now <name>")
        return
    name = context.args[0]
    result = await api_delete(f"/api/processes/{name}")
    if result:
        await update.message.reply_text(f"Killed <b>{esc(name)}</b>.", parse_mode=ParseMode.HTML)
    else:
        await update.message.reply_text(f"Failed to kill {name}.")


@auth
async def cmd_send(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/send <name> <message>"""
    if not context.args or len(context.args) < 2:
        await update.message.reply_text("Usage: /send <name> <message>")
        return
    name = context.args[0]
    text = " ".join(context.args[1:])
    result = await api_post(f"/api/processes/{name}/send", {"text": text})
    if result and result.get("status") == "sent":
        await update.message.reply_text(f"Sent to <b>{esc(name)}</b>", parse_mode=ParseMode.HTML)
    else:
        await update.message.reply_text(f"Failed to send to {name}.")


@auth
async def cmd_output(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/output [name] [lines]"""
    name = context.args[0] if context.args else "partner"
    lines = int(context.args[1]) if len(context.args) > 1 else 100
    await _send_output(update.message, name, lines)


@auth
async def cmd_proposals(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/proposals — Pending proposals with buttons."""
    await _send_proposals(update.message)


@auth
async def cmd_approve(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/approve <id>"""
    if not context.args:
        await update.message.reply_text("Usage: /approve <id>")
        return
    pid = context.args[0]
    result = await api_patch(f"/api/proposals/{pid}", {"status": "approved"})
    if result:
        await update.message.reply_text(f"Approved <b>{esc(pid)}</b>", parse_mode=ParseMode.HTML)
    else:
        await update.message.reply_text(f"Failed to approve {pid}.")


@auth
async def cmd_reject(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/reject <id>"""
    if not context.args:
        await update.message.reply_text("Usage: /reject <id>")
        return
    pid = context.args[0]
    result = await api_patch(f"/api/proposals/{pid}", {"status": "rejected"})
    if result:
        await update.message.reply_text(f"Rejected <b>{esc(pid)}</b>", parse_mode=ParseMode.HTML)
    else:
        await update.message.reply_text(f"Failed to reject {pid}.")


@auth
async def cmd_ask(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/ask <question> — Route to Ollama."""
    if not context.args:
        await update.message.reply_text("Usage: /ask <question>")
        return
    await _do_ask(update.message, " ".join(context.args))


@auth
async def cmd_reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/reset [name] — Soft reset. Defaults to partner."""
    name = context.args[0] if context.args else "partner"
    await _do_reset(update.message, name)


@auth
async def cmd_hard_reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/hard_reset [name] — Hard reset (kill + recreate). Defaults to partner."""
    name = context.args[0] if context.args else "partner"
    await _do_hard_reset(update.message, name)


@auth
async def cmd_compact(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/compact [name]"""
    name = context.args[0] if context.args else "partner"
    await _do_compact(update.message, name)


@auth
async def cmd_restart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/restart <name>"""
    if not context.args:
        await update.message.reply_text("Usage: /restart <name>")
        return
    await _do_restart(update.message, context.args[0], context.args[1:] or None)


@auth
async def cmd_last(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/last [n] — Last n assistant messages from partner."""
    count = int(context.args[0]) if context.args else 1
    await _send_last(update.message, "partner", count)


@auth
async def cmd_pinned(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/pinned — View pinned messages."""
    pins = _load_json(PINS_FILE)
    if not pins:
        await update.message.reply_text("No pinned messages.")
        return
    lines = ["<b>📌 Pinned:</b>\n"]
    for i, p in enumerate(reversed(pins[-10:]), 1):
        ts = p.get("ts", "?")[:16]
        content = p.get("content", "")[:200]
        lines.append(f"<b>{i}.</b> <i>{ts}</i>\n{esc(content)}\n")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


@auth
async def cmd_history(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/history — View command history."""
    if not _command_history:
        await update.message.reply_text("No command history.")
        return
    lines = ["<b>Command History:</b>\n"]
    for i, cmd in enumerate(reversed(_command_history[-10:]), 1):
        lines.append(f"<b>!{i}</b> {esc(cmd[:50])}")
    lines.append("\nUse /! or /!N to repeat")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


@auth
async def cmd_repeat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/! or /!N — Repeat last or Nth command."""
    if not _command_history:
        await update.message.reply_text("No command history.")
        return
    # Get index from command text (e.g., /!3)
    text = update.message.text or ""
    match = re.match(r"/!(\d+)?", text)
    idx = int(match.group(1)) if match and match.group(1) else 1
    if idx > len(_command_history):
        await update.message.reply_text(f"Only {len(_command_history)} commands in history.")
        return
    cmd = _command_history[-idx]
    await update.message.reply_text(f"Repeating: {cmd[:50]}")
    await api_post("/api/processes/partner/send", {"text": cmd})


@auth
async def cmd_p(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/p <action> — Partner shortcut. Actions: out, rc, compact, reset, hrst"""
    if not context.args:
        await update.message.reply_text("Usage: /p <out|rc|compact|reset|hrst|send ...>")
        return
    action = context.args[0].lower()
    if action == "out":
        await _send_output(update.message, "partner")
    elif action == "rc":
        await api_post("/api/processes/partner/send", {"text": "/rc"})
        await update.message.reply_text("Sent /rc to partner")
    elif action == "compact":
        await _do_compact(update.message, "partner")
    elif action == "reset":
        await _do_reset(update.message, "partner")
    elif action == "hrst":
        await _do_hard_reset(update.message, "partner")
    elif action == "send" and len(context.args) > 1:
        text = " ".join(context.args[1:])
        await api_post("/api/processes/partner/send", {"text": text})
        await update.message.reply_text("Sent ✓")
    else:
        await update.message.reply_text(f"Unknown action: {action}")


@auth
async def cmd_conversation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/conversation — Toggle conversation mode."""
    global _conversation_mode
    _conversation_mode = not _conversation_mode
    status = "ON" if _conversation_mode else "OFF"
    await update.message.reply_text(f"Conversation mode: <b>{status}</b>", parse_mode=ParseMode.HTML)


@auth
async def cmd_later(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/later <time> <command> — Schedule command. Time: 5m, 1h, 30s"""
    if len(context.args) < 2:
        await update.message.reply_text("Usage: /later <time> <command>\nExample: /later 30m compact partner")
        return
    time_str = context.args[0]
    command = " ".join(context.args[1:])

    # Parse time
    match = re.match(r"(\d+)([smh])", time_str.lower())
    if not match:
        await update.message.reply_text("Invalid time. Use: 30s, 5m, 1h")
        return
    amount, unit = int(match.group(1)), match.group(2)
    seconds = amount * {"s": 1, "m": 60, "h": 3600}[unit]

    run_at = time.time() + seconds
    _scheduled_commands.append((run_at, command, "partner"))
    await update.message.reply_text(f"Scheduled in {time_str}: <code>{esc(command)}</code>", parse_mode=ParseMode.HTML)


@auth
async def cmd_snapshot(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/snapshot [label] — Save context snapshot before compacting."""
    label = " ".join(context.args) if context.args else "unnamed"

    # Get recent conversation summary
    history = await api_get("/api/partner/history", limit=10)
    summary = ""
    if history and "messages" in history:
        msgs = history["messages"][-5:]
        for m in msgs:
            role = m.get("role", "?")[0].upper()
            content = m.get("content", "")[:100]
            summary += f"{role}: {content}\n"

    snapshots = _load_json(SNAPSHOTS_FILE)
    snapshots.append({
        "ts": datetime.now().isoformat(),
        "label": label,
        "summary": summary
    })
    _save_json(SNAPSHOTS_FILE, snapshots[-50:])  # Keep last 50
    await update.message.reply_text(f"📸 Snapshot saved: <b>{esc(label)}</b>", parse_mode=ParseMode.HTML)


@auth
async def cmd_snapshots(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/snapshots — View saved snapshots."""
    snapshots = _load_json(SNAPSHOTS_FILE)
    if not snapshots:
        await update.message.reply_text("No snapshots.")
        return
    lines = ["<b>📸 Snapshots:</b>\n"]
    for s in reversed(snapshots[-10:]):
        ts = s.get("ts", "?")[:16]
        label = s.get("label", "?")
        lines.append(f"• <i>{ts}</i> — <b>{esc(label)}</b>")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML)


@auth
async def cmd_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/dashboard — Multi-worker status dashboard."""
    procs, usage = await asyncio.gather(
        api_get("/api/processes"),
        api_get("/api/workers/usage"),
    )
    if not procs:
        await update.message.reply_text("No workers or API unreachable.")
        return

    workers_usage = {w["name"]: w for w in (usage or {}).get("workers", [])}

    lines = ["<b>📊 Worker Dashboard</b>\n"]
    for p in procs:
        name = p["name"]
        u = workers_usage.get(name, {})
        pct = u.get("pct", 0)
        bar = _progress_bar(pct, 8)

        # Status indicator
        if pct >= 90:
            indicator = "🔴"
        elif pct >= 70:
            indicator = "🟡"
        else:
            indicator = "🟢"

        lines.append(f"{indicator} <b>{esc(name)}</b>  {bar} {pct}%")

    markup = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("Refresh", callback_data="dash:refresh"),
            InlineKeyboardButton("Compact All", callback_data="dash:compactall"),
        ]
    ])
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=markup)


# --- Callback router ---

@auth_callback
async def callback_router(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Central callback query dispatcher for inline buttons."""
    query = update.callback_query
    data = query.data or ""

    try:
        if data == "noop":
            await query.answer()
            return

        # --- Status ---
        if data == "st:refresh":
            await query.answer("Refreshing...")
            text, markup = await build_status_view()
            try:
                await query.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=markup)
            except BadRequest as e:
                if "not modified" in str(e).lower():
                    await query.answer("Already up to date")
                else:
                    raise
            return

        # --- Worker list ---
        if data == "wk:list":
            await query.answer()
            text, markup = await build_worker_list()
            await query.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=markup)
            return

        # --- Worker actions ---
        if data.startswith("wk:"):
            parts = data.split(":")
            if len(parts) == 2:
                # wk:{name} — show action menu
                name = parts[1]
                await query.answer()
                text, markup = await build_worker_actions(name)
                await query.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=markup)
                return

            if len(parts) >= 3:
                name, action = parts[1], parts[2]

                if action == "out":
                    await query.answer("Fetching output...")
                    await _send_output(query.message, name)
                    return

                if action == "last":
                    await query.answer("Fetching...")
                    if name == "partner":
                        await _send_last(query.message, name)
                    else:
                        # Only partner has history API — use output for others
                        await _send_output(query.message, name, 50)
                    return

                if action == "cmp":
                    await query.answer("Compacting...")
                    await _do_compact(query.message, name)
                    return

                if action == "rc":
                    await query.answer("Enabling remote control...")
                    result = await api_post(f"/api/processes/{name}/send", {"text": "/rc"})
                    if result and result.get("status") == "sent":
                        await query.message.reply_text(f"Sent /rc to <b>{esc(name)}</b>.", parse_mode=ParseMode.HTML)
                    else:
                        await query.message.reply_text(f"Failed to send /rc to {name}.")
                    return

                if action == "rst":
                    await query.answer("Restarting...")
                    await _do_restart(query.message, name)
                    return

                if action == "reset":
                    await query.answer("Resetting...")
                    await _do_reset(query.message, name)
                    return

                if action == "hrst":
                    if len(parts) == 4 and parts[3] == "y":
                        await query.answer("Hard resetting...")
                        await query.edit_message_text(
                            f"Hard resetting <b>{esc(name)}</b>...",
                            parse_mode=ParseMode.HTML,
                        )
                        await _do_hard_reset(query.message, name)
                        return
                    await query.answer()
                    markup = InlineKeyboardMarkup([
                        [
                            InlineKeyboardButton("Yes, hard reset", callback_data=f"wk:{name}:hrst:y"),
                            InlineKeyboardButton("Cancel", callback_data=f"wk:{name}"),
                        ]
                    ])
                    await query.edit_message_text(
                        f"Hard reset <b>{esc(name)}</b>?\n(kills window and recreates)",
                        parse_mode=ParseMode.HTML,
                        reply_markup=markup,
                    )
                    return

                if action == "kill":
                    if len(parts) == 4 and parts[3] == "y":
                        # Confirmed kill
                        await query.answer("Killing...")
                        await query.edit_message_text(
                            f"Sending end-of-session to <b>{esc(name)}</b>...",
                            parse_mode=ParseMode.HTML,
                        )
                        await _do_kill(query.message, name)
                        return
                    # Show confirmation
                    await query.answer()
                    markup = InlineKeyboardMarkup([
                        [
                            InlineKeyboardButton("Yes, kill (60s)", callback_data=f"wk:{name}:kill:y"),
                            InlineKeyboardButton("Cancel", callback_data=f"wk:{name}"),
                        ]
                    ])
                    await query.edit_message_text(
                        f"Kill <b>{esc(name)}</b>?\n(end-of-session → 60s wait → kill)",
                        parse_mode=ParseMode.HTML,
                        reply_markup=markup,
                    )
                    return

                if action == "nuke":
                    if len(parts) == 4 and parts[3] == "y":
                        # Confirmed kill now
                        await query.answer("Killing NOW...")
                        result = await api_delete(f"/api/processes/{name}")
                        text = f"Killed <b>{esc(name)}</b>." if result else f"Failed to kill {name}."
                        await query.edit_message_text(text, parse_mode=ParseMode.HTML)
                        return
                    # Show confirmation
                    await query.answer()
                    markup = InlineKeyboardMarkup([
                        [
                            InlineKeyboardButton("Yes, kill NOW", callback_data=f"wk:{name}:nuke:y"),
                            InlineKeyboardButton("Cancel", callback_data=f"wk:{name}"),
                        ]
                    ])
                    await query.edit_message_text(
                        f"Kill <b>{esc(name)}</b> immediately? (no cleanup)",
                        parse_mode=ParseMode.HTML,
                        reply_markup=markup,
                    )
                    return

        # --- Proposals ---
        if data == "pr:list":
            await query.answer()
            await _send_proposals(query.message)
            return

        if data.startswith("pr:"):
            parts = data.split(":")
            if len(parts) == 3:
                pid, action = parts[1], parts[2]
                if action == "a":
                    await query.answer("Approving...")
                    result = await api_patch(f"/api/proposals/{pid}", {"status": "approved"})
                    if result:
                        await query.edit_message_text(
                            f"APPROVED: <b>{esc(pid)}</b>",
                            parse_mode=ParseMode.HTML,
                        )
                    else:
                        await query.answer("Failed to approve", show_alert=True)
                    return
                if action == "r":
                    await query.answer("Rejecting...")
                    result = await api_patch(f"/api/proposals/{pid}", {"status": "rejected"})
                    if result:
                        await query.edit_message_text(
                            f"REJECTED: <b>{esc(pid)}</b>",
                            parse_mode=ParseMode.HTML,
                        )
                    else:
                        await query.answer("Failed to reject", show_alert=True)
                    return

        # --- Git ---
        if data == "git:list":
            await query.answer("Refreshing...")
            text, markup = await build_git_overview()
            try:
                await query.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=markup)
            except BadRequest as e:
                if "not modified" in str(e).lower():
                    await query.answer("Already up to date")
                else:
                    raise
            return

        if data.startswith("git:"):
            parts = data.split(":")
            project = parts[1]

            if len(parts) == 2:
                # git:{project} — show detail
                await query.answer()
                text, markup = await build_git_detail(project)
                await query.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=markup)
                return

            if len(parts) >= 3 and parts[2] == "push":
                if len(parts) == 4 and parts[3] == "y":
                    # git:{project}:push:y — execute push
                    await query.answer("Pushing...")
                    await query.edit_message_text(
                        f"Pushing <b>{esc(project)}</b>...",
                        parse_mode=ParseMode.HTML,
                    )
                    result = await api_post("/api/push", {"project": project})
                    if result and result.get("success"):
                        step_lines = []
                        for s in result.get("steps", []):
                            icon = "+" if s.get("success") else "x"
                            step_lines.append(f"  {icon} {esc(s.get('action', '?'))}")
                        detail = "\n".join(step_lines) if step_lines else ""
                        text = f"Pushed <b>{esc(project)}</b>\n\n{detail}"
                    else:
                        err = (result or {}).get("error", "Unknown error")
                        text = f"Push failed for <b>{esc(project)}</b>\n\n{esc(err)}"
                    markup = InlineKeyboardMarkup([
                        [InlineKeyboardButton("<< Back", callback_data="git:list")]
                    ])
                    await query.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=markup)
                    return

                # git:{project}:push — show confirmation
                await query.answer()
                markup = InlineKeyboardMarkup([
                    [
                        InlineKeyboardButton("Push", callback_data=f"git:{project}:push:y"),
                        InlineKeyboardButton("Cancel", callback_data=f"git:{project}"),
                    ]
                ])
                await query.edit_message_text(
                    f"Push <b>{esc(project)}</b>?",
                    parse_mode=ParseMode.HTML,
                    reply_markup=markup,
                )
                return

        # --- Services ---
        if data == "svc:refresh":
            await query.answer("Refreshing...")
            text, markup = await build_services_view()
            try:
                await query.edit_message_text(text, parse_mode=ParseMode.HTML, reply_markup=markup)
            except BadRequest as e:
                if "not modified" in str(e).lower():
                    await query.answer("Already up to date")
                else:
                    raise
            return

        # --- Dashboard ---
        if data == "dash:refresh":
            await query.answer("Refreshing...")
            procs, usage = await asyncio.gather(
                api_get("/api/processes"),
                api_get("/api/workers/usage"),
            )
            if not procs:
                await query.edit_message_text("No workers.")
                return
            workers_usage = {w["name"]: w for w in (usage or {}).get("workers", [])}
            lines = ["<b>📊 Worker Dashboard</b>\n"]
            for p in procs:
                name = p["name"]
                u = workers_usage.get(name, {})
                pct = u.get("pct", 0)
                bar = _progress_bar(pct, 8)
                indicator = "🔴" if pct >= 90 else "🟡" if pct >= 70 else "🟢"
                lines.append(f"{indicator} <b>{esc(name)}</b>  {bar} {pct}%")
            markup = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("Refresh", callback_data="dash:refresh"),
                    InlineKeyboardButton("Compact All", callback_data="dash:compactall"),
                ]
            ])
            await query.edit_message_text("\n".join(lines), parse_mode=ParseMode.HTML, reply_markup=markup)
            return

        if data == "dash:compactall":
            await query.answer("Compacting all...")
            procs = await api_get("/api/processes")
            if procs:
                for p in procs:
                    await api_post(f"/api/processes/{p['name']}/send", {"text": "/compact"})
                await query.edit_message_text(f"Sent /compact to {len(procs)} workers.")
            return

        # --- Quick replies ---
        if data.startswith("qr:"):
            action = data[3:]
            if action == "continue":
                await query.answer("Sending...")
                await query.edit_message_text("→ Continue")
                await api_post("/api/processes/partner/send", {"text": "Continue"})
            elif action == "yes":
                await query.answer("Sending...")
                await query.edit_message_text("→ Yes")
                await api_post("/api/processes/partner/send", {"text": "Yes"})
            elif action == "no":
                await query.answer("Sending...")
                await query.edit_message_text("→ No")
                await api_post("/api/processes/partner/send", {"text": "No"})
            elif action == "more":
                await query.answer("Fetching...")
                await query.edit_message_text("→ Show more")
                await api_post("/api/processes/partner/send", {"text": "Show more details"})
            elif action == "pin":
                await query.answer("Pinning...")
                # Get last assistant message and pin it
                history = await api_get("/api/partner/history", limit=5)
                if history and "messages" in history:
                    msgs = [m for m in history["messages"] if m.get("role") == "assistant"]
                    if msgs:
                        content = msgs[-1].get("content", "")[:500]
                        pins = _load_json(PINS_FILE)
                        pins.append({
                            "ts": datetime.now().isoformat(),
                            "content": content
                        })
                        _save_json(PINS_FILE, pins[-20:])  # Keep last 20
                        await query.edit_message_text("📌 Pinned")
                        return
                await query.edit_message_text("Nothing to pin")
            return

        # --- Stale spawn buttons ---
        if data.startswith("sp:"):
            await query.answer("Session expired — tap Spawn to start.", show_alert=True)
            return

        await query.answer("Unknown action")
        log.warning("Unhandled callback: %s", data)

    except BadRequest as e:
        if "not modified" not in str(e).lower():
            log.error("Callback error: %s (data=%s)", e, data)
            try:
                await query.answer("Error occurred", show_alert=True)
            except Exception:
                pass
    except Exception as e:
        log.error("Callback error: %s (data=%s)", e, data)
        try:
            await query.answer("Error occurred", show_alert=True)
        except Exception:
            pass


# --- Spawn ConversationHandler ---

@auth
async def spawn_entry(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Entry: show project picker with inline buttons."""
    projects = await api_get("/api/projects")
    if not projects:
        await update.message.reply_text("No projects found or API unreachable.")
        return ConversationHandler.END

    buttons = []
    for p in projects:
        name = p.get("name", "?")
        buttons.append([InlineKeyboardButton(name, callback_data=f"sp:pick:{name}")])
    buttons.append([InlineKeyboardButton("Other...", callback_data="sp:other")])

    await update.message.reply_text(
        "Pick a project:",
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return SPAWN_PICK


@auth_callback
async def spawn_pick(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle project selection or confirm/cancel in spawn flow."""
    query = update.callback_query
    data = query.data or ""

    if data == "sp:other":
        await query.answer()
        await query.edit_message_text("Type the directory path:")
        return SPAWN_CUSTOM_DIR

    if data == "sp:cancel":
        await query.answer("Cancelled")
        await query.edit_message_text("Spawn cancelled.")
        return ConversationHandler.END

    if data == "sp:confirm":
        await query.answer("Spawning...")
        name = context.user_data.get("spawn_name", "")
        directory = context.user_data.get("spawn_dir", "")
        if not name or not directory:
            await query.edit_message_text("Missing spawn info.")
            return ConversationHandler.END
        await query.edit_message_text(
            f"Spawning <b>{esc(name)}</b>...",
            parse_mode=ParseMode.HTML,
        )
        await _do_spawn(query.message, name, directory)
        return ConversationHandler.END

    if data.startswith("sp:pick:"):
        name = data[8:]
        await query.answer()
        projects = await api_get("/api/projects")
        directory = None
        if projects:
            for p in projects:
                if p.get("name") == name:
                    directory = p.get("directory")
                    break
        if not directory:
            await query.edit_message_text(f"Project {name} not found.")
            return ConversationHandler.END

        context.user_data["spawn_name"] = name
        context.user_data["spawn_dir"] = directory
        markup = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("Spawn", callback_data="sp:confirm"),
                InlineKeyboardButton("Cancel", callback_data="sp:cancel"),
            ]
        ])
        await query.edit_message_text(
            f"Spawn worker?\n  <b>Name:</b> {esc(name)}\n  <b>Dir:</b> {esc(directory)}",
            parse_mode=ParseMode.HTML,
            reply_markup=markup,
        )
        return SPAWN_PICK

    await query.answer()
    return SPAWN_PICK


@auth
async def spawn_custom_dir(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle custom directory text input for spawn."""
    directory = update.message.text.strip()
    if not directory:
        await update.message.reply_text("Please type a directory path, or /cancel to abort.")
        return SPAWN_CUSTOM_DIR

    name = Path(directory).expanduser().name
    context.user_data["spawn_name"] = name
    context.user_data["spawn_dir"] = directory

    markup = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("Spawn", callback_data="sp:confirm"),
            InlineKeyboardButton("Cancel", callback_data="sp:cancel"),
        ]
    ])
    await update.message.reply_text(
        f"Spawn worker?\n  <b>Name:</b> {esc(name)}\n  <b>Dir:</b> {esc(directory)}",
        parse_mode=ParseMode.HTML,
        reply_markup=markup,
    )
    return SPAWN_PICK


# --- Ask ConversationHandler ---

@auth
async def ask_entry(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Entry: prompt for question text."""
    await update.message.reply_text("Type your question:")
    return ASK_WAITING


@auth
async def ask_receive(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive question text and query Ollama."""
    question = update.message.text
    if not question:
        return ASK_WAITING
    await _do_ask(update.message, question)
    return ConversationHandler.END


# --- Button text router + partner fallback ---

@auth
async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Route reply keyboard taps, forward everything else to partner."""
    text = update.message.text
    if not text:
        return

    if text == "Status":
        return await cmd_status(update, context)
    if text == "Workers":
        return await cmd_workers(update, context)
    if text == "Proposals":
        return await cmd_proposals(update, context)
    if text == "Output":
        await _send_output(update.message, "partner")
        return
    if text == "Git":
        text_out, markup = await build_git_overview()
        await update.message.reply_text(text_out, parse_mode=ParseMode.HTML, reply_markup=markup)
        return

    if text == "Services":
        text_out, markup = await build_services_view()
        await update.message.reply_text(text_out, parse_mode=ParseMode.HTML, reply_markup=markup)
        return
    if text == "Enable RC":
        result = await api_post("/api/processes/partner/send", {"text": "/rc"})
        if result and result.get("status") == "sent":
            await update.message.reply_text("Sent /rc to partner.")
        else:
            await update.message.reply_text("Failed to send /rc to partner.")
        return

    # Default: forward to partner
    # Track command history
    _command_history.append(text)
    if len(_command_history) > MAX_HISTORY:
        _command_history.pop(0)

    # Capture last message before sending to detect new response
    history_before = await api_get("/api/partner/history", limit=5)
    last_msg_before = None
    if history_before and "messages" in history_before:
        assistant_msgs = [m for m in history_before["messages"] if m.get("role") == "assistant"]
        if assistant_msgs:
            last_msg_before = assistant_msgs[-1].get("content", "")

    result = await api_post("/api/processes/partner/send", {"text": text})
    if result and result.get("status") == "sent":
        await update.message.reply_text("Sent ✓")
        await update.message.chat.send_action("typing")
        # Wait for NEW response and send it (with typing refresh)
        response = await _wait_and_get_response(
            last_msg_before, chat=update.message.chat, timeout=RESPONSE_POLL_TIMEOUT
        )
        if response:
            if len(response) > 3000:
                response = response[:3000] + "\n\n... (truncated)"
            await send_chunked(update.message, response, parse_mode=None)
            # Quick reply buttons
            markup = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("Continue", callback_data="qr:continue"),
                    InlineKeyboardButton("Yes", callback_data="qr:yes"),
                    InlineKeyboardButton("No", callback_data="qr:no"),
                ],
                [
                    InlineKeyboardButton("📌 Pin", callback_data="qr:pin"),
                    InlineKeyboardButton("More", callback_data="qr:more"),
                ]
            ])
            await update.message.reply_text("⌁", reply_markup=markup)
        else:
            await update.message.reply_text("(no new response — check /output)")
    else:
        await update.message.reply_text("Failed to send to partner.")


# --- Background jobs ---

async def context_health_check(context: ContextTypes.DEFAULT_TYPE):
    """Check context sizes, warn/auto-compact as needed."""
    usage = await api_get("/api/workers/usage")
    if not usage or "workers" not in usage:
        return

    bot = context.bot
    chat_id = ALLOWED_USER_ID

    for w in usage["workers"]:
        name = w.get("name", "?")
        pct = w.get("pct", 0)

        if pct >= CONTEXT_CRITICAL_PCT:
            last = _recently_compacted.get(name, 0)
            if time.time() - last < 600:
                await send_chunked_to_chat(
                    bot, chat_id,
                    f"<b>{esc(name)}</b> still at {pct}% after compact.\n"
                    f"/restart {esc(name)} to start fresh?",
                )
            else:
                await api_post(f"/api/processes/{name}/send", {"text": "/compact"})
                _recently_compacted[name] = time.time()
                await send_chunked_to_chat(
                    bot, chat_id,
                    f"Auto-compacted <b>{esc(name)}</b> (was at {pct}%)",
                )

        elif pct >= CONTEXT_COMPACT_PCT:
            last = _recently_compacted.get(name, 0)
            if time.time() - last < 600:
                continue
            await api_post(f"/api/processes/{name}/send", {"text": "/compact"})
            _recently_compacted[name] = time.time()
            await send_chunked_to_chat(
                bot, chat_id,
                f"Auto-compacted <b>{esc(name)}</b> (was at {pct}%)",
            )

        elif pct >= CONTEXT_WARN_PCT:
            await send_chunked_to_chat(
                bot, chat_id,
                f"<b>{esc(name)}</b> at {pct}% context — "
                f"/compact {esc(name)} to free space",
            )


async def proposal_check(context: ContextTypes.DEFAULT_TYPE):
    """Push new pending proposals proactively with Approve/Reject buttons."""
    proposals = await api_get("/api/proposals")
    if not proposals:
        return

    bot = context.bot
    chat_id = ALLOWED_USER_ID

    for p in proposals:
        if p.get("status") != "pending":
            continue
        pid = p.get("id", "?")
        if pid in _seen_proposals:
            continue
        _seen_proposals.add(pid)

        title = p.get("title", "Untitled")
        worker = p.get("worker", "?")
        steps = p.get("steps", [])

        lines = [f"<b>New proposal:</b> {esc(pid)} — {esc(title)}"]
        lines.append(f"  Worker: {esc(worker)}")
        for i, s in enumerate(steps, 1):
            lines.append(f"  {i}. {esc(s)}")

        markup = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("Approve", callback_data=f"pr:{pid}:a"),
                InlineKeyboardButton("Reject", callback_data=f"pr:{pid}:r"),
            ]
        ])

        await send_chunked_to_chat(bot, chat_id, "\n".join(lines), reply_markup=markup)


async def scheduled_commands_check(context: ContextTypes.DEFAULT_TYPE):
    """Execute scheduled commands when their time comes."""
    now = time.time()
    bot = context.bot
    chat_id = ALLOWED_USER_ID

    to_remove = []
    for i, (run_at, command, target) in enumerate(_scheduled_commands):
        if now >= run_at:
            to_remove.append(i)
            # Execute the command
            parts = command.split()
            if parts:
                action = parts[0].lower()
                if action == "compact":
                    target_name = parts[1] if len(parts) > 1 else "partner"
                    await api_post(f"/api/processes/{target_name}/send", {"text": "/compact"})
                    await bot.send_message(chat_id, f"⏰ Scheduled: /compact {target_name}")
                elif action == "kill":
                    target_name = parts[1] if len(parts) > 1 else "partner"
                    await api_delete(f"/api/processes/{target_name}")
                    await bot.send_message(chat_id, f"⏰ Scheduled: killed {target_name}")
                elif action == "send":
                    text = " ".join(parts[1:])
                    await api_post("/api/processes/partner/send", {"text": text})
                    await bot.send_message(chat_id, f"⏰ Scheduled: sent to partner")
                else:
                    await bot.send_message(chat_id, f"⏰ Unknown scheduled command: {command}")

    # Remove executed commands (reverse order to preserve indices)
    for i in reversed(to_remove):
        _scheduled_commands.pop(i)


async def conversation_mode_check(context: ContextTypes.DEFAULT_TYPE):
    """In conversation mode, auto-send new responses."""
    if not _conversation_mode:
        return

    bot = context.bot
    chat_id = ALLOWED_USER_ID

    # Check for new output from partner
    result = await api_get("/api/processes/partner/output", lines=10)
    if not result or "output" not in result:
        return

    output = result["output"]
    # Check if idle (has prompt)
    if "❯" in output[-50:] or "───" in output[-80:]:
        # Get last message and send if new
        history = await api_get("/api/partner/history", limit=3)
        if history and "messages" in history:
            msgs = [m for m in history["messages"] if m.get("role") == "assistant"]
            if msgs:
                content = msgs[-1].get("content", "")
                # Use a simple hash to detect if it's new
                content_hash = hash(content[:200])
                last_hash = getattr(conversation_mode_check, "_last_hash", None)
                if content_hash != last_hash:
                    conversation_mode_check._last_hash = content_hash
                    if len(content) > 2000:
                        content = content[:2000] + "\n... (truncated)"
                    await bot.send_message(chat_id, f"💬 {content[:4000]}")


@auth
async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle voice messages — transcribe via Whisper and send to partner."""
    voice = update.message.voice
    if not voice:
        return

    await update.message.reply_text("🎤 Transcribing...")

    try:
        # Download voice file
        file = await context.bot.get_file(voice.file_id)
        voice_path = STATE_DIR / f"voice_{voice.file_id}.ogg"
        await file.download_to_drive(voice_path)

        # Transcribe via Ollama Whisper or fallback
        # Try Whisper API first
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                with open(voice_path, "rb") as f:
                    files = {"file": ("voice.ogg", f, "audio/ogg")}
                    r = await client.post(
                        f"{OLLAMA_URL}/v1/audio/transcriptions",
                        files=files,
                        data={"model": "whisper"}
                    )
                    if r.status_code == 200:
                        text = r.json().get("text", "")
                    else:
                        # Fallback: describe that we received voice
                        text = "(voice message - transcription unavailable)"
        except Exception:
            text = "(voice message - transcription unavailable)"

        # Clean up
        voice_path.unlink(missing_ok=True)

        if text and text != "(voice message - transcription unavailable)":
            await update.message.reply_text(f"🎤 \"{text}\"")
            await api_post("/api/processes/partner/send", {"text": text})
            await update.message.reply_text("Sent ✓")
        else:
            await update.message.reply_text("Could not transcribe voice. Try typing instead.")

    except Exception as e:
        log.error("Voice handling error: %s", e)
        await update.message.reply_text(f"Voice error: {e}")


# --- Cancel handler (shared by ConversationHandlers) ---

async def _conv_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel current conversation."""
    if update.message:
        await update.message.reply_text("Cancelled.")
    return ConversationHandler.END


# --- Main ---

def main():
    if not BOT_TOKEN:
        print("Error: TELEGRAM_BOT_TOKEN not set in config.env")
        return
    if not ALLOWED_USER_ID:
        print("Error: ALLOWED_USER_ID not set in config.env")
        return

    app = Application.builder().token(BOT_TOKEN).build()

    # Spawn ConversationHandler (must be registered before plain text handler)
    spawn_conv = ConversationHandler(
        entry_points=[
            MessageHandler(filters.TEXT & filters.Regex(r"^Spawn$"), spawn_entry),
        ],
        states={
            SPAWN_PICK: [
                CallbackQueryHandler(spawn_pick, pattern=r"^sp:"),
            ],
            SPAWN_CUSTOM_DIR: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, spawn_custom_dir),
            ],
        },
        fallbacks=[
            CommandHandler("cancel", _conv_cancel),
        ],
        allow_reentry=True,
        conversation_timeout=300,
    )

    # Ask ConversationHandler
    ask_conv = ConversationHandler(
        entry_points=[
            MessageHandler(filters.TEXT & filters.Regex(r"^Ask$"), ask_entry),
        ],
        states={
            ASK_WAITING: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, ask_receive),
            ],
        },
        fallbacks=[
            CommandHandler("cancel", _conv_cancel),
        ],
        allow_reentry=True,
        conversation_timeout=300,
    )

    # ConversationHandlers first (higher priority for their entry points)
    app.add_handler(spawn_conv)
    app.add_handler(ask_conv)

    # Commands
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("workers", cmd_workers))
    app.add_handler(CommandHandler("spawn", cmd_spawn))
    app.add_handler(CommandHandler("kill", cmd_kill))
    app.add_handler(CommandHandler("kill_now", cmd_kill_now))
    app.add_handler(CommandHandler("send", cmd_send))
    app.add_handler(CommandHandler("output", cmd_output))
    app.add_handler(CommandHandler("proposals", cmd_proposals))
    app.add_handler(CommandHandler("approve", cmd_approve))
    app.add_handler(CommandHandler("reject", cmd_reject))
    app.add_handler(CommandHandler("ask", cmd_ask))
    app.add_handler(CommandHandler("reset", cmd_reset))
    app.add_handler(CommandHandler("hard_reset", cmd_hard_reset))
    app.add_handler(CommandHandler("compact", cmd_compact))
    app.add_handler(CommandHandler("restart", cmd_restart))
    app.add_handler(CommandHandler("last", cmd_last))

    # New commands
    app.add_handler(CommandHandler("pinned", cmd_pinned))
    app.add_handler(CommandHandler("history", cmd_history))
    app.add_handler(MessageHandler(filters.Regex(r"^/!\d*$"), cmd_repeat))
    app.add_handler(CommandHandler("p", cmd_p))
    app.add_handler(CommandHandler("conversation", cmd_conversation))
    app.add_handler(CommandHandler("later", cmd_later))
    app.add_handler(CommandHandler("snapshot", cmd_snapshot))
    app.add_handler(CommandHandler("snapshots", cmd_snapshots))
    app.add_handler(CommandHandler("dashboard", cmd_dashboard))

    # Callback queries (inline buttons — global router)
    app.add_handler(CallbackQueryHandler(callback_router))

    # Voice messages → transcribe → send to partner
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))

    # Plain text → button router → partner fallback
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    # Background jobs
    job_queue = app.job_queue
    if job_queue and ENABLE_AUTO_NOTIFICATIONS:
        job_queue.run_repeating(
            context_health_check,
            interval=CONTEXT_CHECK_INTERVAL,
            first=30,
        )
        job_queue.run_repeating(
            proposal_check,
            interval=30,
            first=10,
        )
        job_queue.run_repeating(
            scheduled_commands_check,
            interval=10,
            first=5,
        )
        job_queue.run_repeating(
            conversation_mode_check,
            interval=5,
            first=15,
        )
        log.info("Background jobs enabled (context: %ds, proposals: 30s, scheduled: 10s)", CONTEXT_CHECK_INTERVAL)
    elif job_queue:
        log.info("Background jobs disabled (ENABLE_AUTO_NOTIFICATIONS=False)")
    else:
        log.warning("JobQueue not available — background jobs disabled. "
                     "Install: pip3 install 'python-telegram-bot[job-queue]'")

    log.info("Starting bot (long-polling)...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
