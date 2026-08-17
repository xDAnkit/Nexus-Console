#!/bin/sh
# Nexus Console — one-command setup for a fresh Mac.
#
#   sh scripts/setup.sh        install whatever is missing (asks before each step)
#   sh scripts/setup.sh --yes  don't ask, just install
#   sh scripts/setup.sh --check  report only, install nothing (CI / a quick doctor)
#
# Written in POSIX sh with no dependencies, because it has to run on a Mac that
# doesn't have Node yet — it is what installs Node.

set -u

MODE=install
YES=0
for arg in "$@"; do
  case "$arg" in
    --check) MODE=check ;;
    -y | --yes) YES=1 ;;
    *) echo "unknown option: $arg" && exit 2 ;;
  esac
done
# No terminal (piped, CI, a GUI hook) → never install behind someone's back.
[ -t 0 ] || MODE=check

fail=0
pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
miss() {
  printf '  \033[31m✗\033[0m %s\n      fix: %s\n' "$1" "$2"
  fail=$((fail + 1))
}

# Returns 0 when we should run the fix for "$1" ourselves.
ask() {
  [ "$MODE" = check ] && return 1
  [ "$YES" = 1 ] && return 0
  printf '  \033[33m?\033[0m %s [Y/n] ' "$1"
  read -r reply
  case "$reply" in n | N | no | NO) return 1 ;; *) return 0 ;; esac
}

echo "Nexus Console — setup"

# 1. Xcode Command Line Tools — the compiler/linker every Rust build needs.
if xcode-select -p >/dev/null 2>&1; then
  pass "Xcode Command Line Tools"
elif ask "Install Xcode Command Line Tools?"; then
  xcode-select --install >/dev/null 2>&1
  echo "      Apple's installer window is open — finish it; waiting…"
  # Apple's installer is a GUI, so there's nothing to wait on but the result.
  waited=0
  while ! xcode-select -p >/dev/null 2>&1; do
    [ "$waited" -ge 1800 ] && break
    sleep 10
    waited=$((waited + 10))
  done
  xcode-select -p >/dev/null 2>&1 && pass "Xcode Command Line Tools" ||
    miss "Xcode Command Line Tools" "xcode-select --install"
else
  miss "Xcode Command Line Tools" "xcode-select --install"
fi

# 2. Homebrew — the app manages it, and it's how Node gets installed below.
#    On Apple Silicon it lives outside the default PATH, so every branch here
#    ends with `brew shellenv` evaluated in THIS shell — otherwise step 3 would
#    fail on a machine that just installed brew successfully.
brew_shellenv() {
  eval "$("$1" shellenv)"
  if [ -f "$HOME/.zprofile" ] && grep -q 'brew shellenv' "$HOME/.zprofile"; then :; else
    printf '\neval "$(%s shellenv)"\n' "$1" >>"$HOME/.zprofile"
    warn "added brew to ~/.zprofile (new terminals will find it)"
  fi
}
if command -v brew >/dev/null 2>&1; then
  pass "Homebrew ($(command -v brew))"
elif [ -x /opt/homebrew/bin/brew ] || [ -x /usr/local/bin/brew ]; then
  [ -x /opt/homebrew/bin/brew ] && brew_bin=/opt/homebrew/bin/brew || brew_bin=/usr/local/bin/brew
  brew_shellenv "$brew_bin"
  pass "Homebrew ($brew_bin)"
elif ask "Install Homebrew? (it will ask for your password)"; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  [ -x /opt/homebrew/bin/brew ] && brew_shellenv /opt/homebrew/bin/brew
  [ -x /usr/local/bin/brew ] && brew_shellenv /usr/local/bin/brew
  command -v brew >/dev/null 2>&1 && pass "Homebrew ($(command -v brew))" ||
    miss "Homebrew" "see https://brew.sh"
else
  miss "Homebrew" '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
fi

# 3. Node >= 22.12 (Vite 8's floor; CI runs 22).
node_ok() {
  command -v node >/dev/null 2>&1 &&
    node -e 'const [M,m]=process.versions.node.split(".").map(Number);process.exit(M>22||(M===22&&m>=12)?0:1)'
}
if node_ok; then
  pass "Node $(node --version)"
elif command -v brew >/dev/null 2>&1 && ask "Install Node via Homebrew?"; then
  brew install node
  node_ok && pass "Node $(node --version)" || miss "Node >= 22.12" "brew install node"
else
  miss "Node >= 22.12" "brew install node"
fi

# 4. Rust via rustup — NOT `brew install rust`: Tauri needs rustup-managed
#    toolchains, and rustup is what ships the rustfmt/clippy the hooks run.
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
if command -v cargo >/dev/null 2>&1; then
  if command -v rustup >/dev/null 2>&1; then
    pass "Rust ($(rustc --version))"
  else
    miss "Rust installed without rustup (brew-installed?)" \
      "brew uninstall rust; curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  fi
elif ask "Install Rust via rustup?"; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  [ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
  command -v cargo >/dev/null 2>&1 && pass "Rust ($(rustc --version))" ||
    miss "Rust toolchain" "open a new terminal and re-run this script"
else
  miss "Rust toolchain" "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
fi

# 5. rustfmt + clippy — the git hooks run them on every commit/push.
if command -v cargo >/dev/null 2>&1; then
  # `rustfmt` the component is `cargo fmt` the subcommand — check the right one.
  for pair in rustfmt:fmt clippy:clippy; do
    component=${pair%%:*}
    if cargo "${pair##*:}" --version >/dev/null 2>&1; then
      pass "$component"
    elif ask "Add the $component component?"; then
      rustup component add "$component" && pass "$component" ||
        miss "$component" "rustup component add $component"
    else
      miss "$component" "rustup component add $component"
    fi
  done
fi

# 6. Project deps + git hooks (npm's postinstall runs lefthook install).
cd "$(dirname "$0")/.." || exit 1
if [ -d node_modules ]; then
  pass "npm dependencies"
elif command -v npm >/dev/null 2>&1 && ask "Install project dependencies (npm install)?"; then
  npm install && pass "npm dependencies" || miss "npm dependencies" "npm install"
else
  miss "npm dependencies" "npm install"
fi
if grep -q lefthook .git/hooks/pre-commit 2>/dev/null; then
  pass "git hooks (lefthook)"
elif [ -d node_modules ] && ask "Install the git hooks?"; then
  npx lefthook install >/dev/null 2>&1 && pass "git hooks (lefthook)" ||
    miss "git hooks" "npx lefthook install"
else
  miss "git hooks" "npx lefthook install"
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "All set — run the app with:  npm start"
else
  echo "$fail thing(s) left — apply the fixes above, open a NEW terminal, then re-run: npm run setup"
  exit 1
fi
