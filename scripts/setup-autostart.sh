#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
LABEL="com.switchboard.server"

usage() {
    echo "Usage: $0 [--remove]"
    echo "  Install or remove Switchboard auto-start on login"
    exit 1
}

remove_macos() {
    local plist="$HOME/Library/LaunchAgents/${LABEL}.plist"
    if [ -f "$plist" ]; then
        launchctl bootout "gui/$(id -u)" "$plist" 2>/dev/null || true
        rm -f "$plist"
        echo "Removed macOS LaunchAgent"
    else
        echo "No macOS LaunchAgent found"
    fi
}

remove_linux() {
    local unit="switchboard.service"
    if systemctl --user is-enabled "$unit" 2>/dev/null; then
        systemctl --user disable "$unit"
        echo "Disabled systemd user service"
    fi
    local dest="$HOME/.config/systemd/user/$unit"
    if [ -f "$dest" ]; then
        rm -f "$dest"
        systemctl --user daemon-reload
        echo "Removed systemd user service"
    else
        echo "No systemd user service found"
    fi
}

install_macos() {
    local src="$SCRIPT_DIR/${LABEL}.plist"
    local dest="$HOME/Library/LaunchAgents/${LABEL}.plist"

    if [ ! -f "$src" ]; then
        echo "Error: $src not found"
        exit 1
    fi

    mkdir -p "$HOME/Library/LaunchAgents"
    cp "$src" "$dest"

    # Patch PATH to include npm global bin dir
    local npm_bin
    npm_bin="$(dirname "$(which npm 2>/dev/null)")" 2>/dev/null || true
    if [ -n "$npm_bin" ] && [ "$npm_bin" != "." ]; then
        local current_path
        current_path=$(/usr/libexec/PlistBuddy -c "Print :EnvironmentVariables:PATH" "$dest" 2>/dev/null || echo "")
        if [ -n "$current_path" ] && ! echo "$current_path" | grep -q "$npm_bin"; then
            /usr/libexec/PlistBuddy -c "Set :EnvironmentVariables:PATH ${npm_bin}:${current_path}" "$dest"
        fi
    fi

    # Unload if previously loaded, then load
    launchctl bootout "gui/$(id -u)" "$dest" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$dest"

    echo "Installed macOS LaunchAgent"
    echo "  Switchboard will start automatically on login"
    echo "  Plist: $dest"
}

install_linux() {
    local src="$SCRIPT_DIR/switchboard.service"
    local dest="$HOME/.config/systemd/user/switchboard.service"

    if [ ! -f "$src" ]; then
        echo "Error: $src not found"
        exit 1
    fi

    mkdir -p "$HOME/.config/systemd/user"
    cp "$src" "$dest"
    systemctl --user daemon-reload
    systemctl --user enable switchboard.service

    echo "Installed systemd user service"
    echo "  Switchboard will start automatically on login"
    echo "  Unit: $dest"
    echo ""
    echo "  To start now:  systemctl --user start switchboard"
    echo "  To persist without login session:"
    echo "    sudo loginctl enable-linger $(whoami)"
}

# Parse args
REMOVE=false
for arg in "$@"; do
    case "$arg" in
        --remove) REMOVE=true ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $arg"; usage ;;
    esac
done

# Detect platform and act
case "$(uname -s)" in
    Darwin)
        if $REMOVE; then remove_macos; else install_macos; fi
        ;;
    Linux)
        if $REMOVE; then remove_linux; else install_linux; fi
        ;;
    *)
        echo "Unsupported platform: $(uname -s)"
        exit 1
        ;;
esac
