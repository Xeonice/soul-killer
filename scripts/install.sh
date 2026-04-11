#!/bin/sh
# Soulkiller installer — detects platform, downloads binary, configures PATH.
set -e

REPO="Xeonice/soul-killer"
INSTALL_DIR="$HOME/.soulkiller/bin"
BINARY="$INSTALL_DIR/soulkiller"

# ── Detect platform ──────────────────────────────────────────────
detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Darwin) os="darwin" ;;
    Linux)  os="linux" ;;
    *)
      echo "Error: Unsupported OS: $OS"
      echo "Soulkiller supports macOS and Linux."
      exit 1
      ;;
  esac

  case "$ARCH" in
    arm64|aarch64) arch="arm64" ;;
    x86_64|amd64)  arch="x64" ;;
    *)
      echo "Error: Unsupported architecture: $ARCH"
      exit 1
      ;;
  esac

  PLATFORM="${os}-${arch}"
}

# ── Download and install ─────────────────────────────────────────
install_binary() {
  ASSET="soulkiller-${PLATFORM}.tar.gz"

  # Get latest release download URL
  DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"

  echo "  Downloading soulkiller for ${PLATFORM}..."

  mkdir -p "$INSTALL_DIR"

  # Download and extract
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$DOWNLOAD_URL" | tar -xz -C "$INSTALL_DIR"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$DOWNLOAD_URL" | tar -xz -C "$INSTALL_DIR"
  else
    echo "Error: Neither curl nor wget found. Please install one and retry."
    exit 1
  fi

  chmod +x "$BINARY"

  # macOS: remove quarantine attribute
  if [ "$(uname -s)" = "Darwin" ]; then
    xattr -d com.apple.quarantine "$BINARY" 2>/dev/null || true
  fi
}

# ── Configure PATH ───────────────────────────────────────────────
configure_path() {
  # Already in PATH?
  case ":$PATH:" in
    *":$INSTALL_DIR:"*) return ;;
  esac

  EXPORT_LINE="export PATH=\"\$HOME/.soulkiller/bin:\$PATH\""

  # Detect shell and rc file
  SHELL_NAME="$(basename "${SHELL:-/bin/sh}")"
  case "$SHELL_NAME" in
    zsh)  RC_FILE="$HOME/.zshrc" ;;
    bash)
      # Prefer .bashrc, fall back to .bash_profile on macOS
      if [ -f "$HOME/.bashrc" ]; then
        RC_FILE="$HOME/.bashrc"
      else
        RC_FILE="$HOME/.bash_profile"
      fi
      ;;
    fish)
      # Fish uses a different syntax
      FISH_DIR="$HOME/.config/fish"
      mkdir -p "$FISH_DIR"
      RC_FILE="$FISH_DIR/config.fish"
      EXPORT_LINE="set -gx PATH \$HOME/.soulkiller/bin \$PATH"
      ;;
    *)    RC_FILE="$HOME/.profile" ;;
  esac

  # Don't duplicate
  if [ -f "$RC_FILE" ] && grep -q '.soulkiller/bin' "$RC_FILE" 2>/dev/null; then
    return
  fi

  echo "" >> "$RC_FILE"
  echo "# Soulkiller" >> "$RC_FILE"
  echo "$EXPORT_LINE" >> "$RC_FILE"

  PATH_CONFIGURED=1
}

# ── Main ─────────────────────────────────────────────────────────
main() {
  echo ""
  echo "  ╔══════════════════════════════════════╗"
  echo "  ║   SOULKILLER INSTALLER               ║"
  echo "  ╚══════════════════════════════════════╝"
  echo ""

  detect_platform
  install_binary
  configure_path

  # Get version from installed binary
  VERSION="$("$BINARY" --version 2>/dev/null || echo "soulkiller")"

  echo ""
  echo "  ✓ Installed: $VERSION"
  echo "  ✓ Location:  $BINARY"
  echo ""

  if [ "${PATH_CONFIGURED:-0}" = "1" ]; then
    echo "  PATH updated. Open a new terminal window, then run:"
  else
    echo "  Run:"
  fi

  echo ""
  echo "    soulkiller"
  echo ""
}

main
