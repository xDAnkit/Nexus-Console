#!/bin/sh
# Nexus Console — fresh-Mac setup check. Run: npm run setup   (or: sh scripts/setup.sh)
# Read-only doctor: checks every build prerequisite and prints the exact fix
# command for anything missing. It never installs anything itself.

fail=0

pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
miss() {
  printf '  \033[31m✗\033[0m %s\n      fix: %s\n' "$1" "$2"
  fail=$((fail + 1))
}

echo "Nexus Console — setup check"

# 1. Xcode Command Line Tools — compilers/linker for the Rust build.
if xcode-select -p >/dev/null 2>&1; then
  pass "Xcode Command Line Tools"
else
  miss "Xcode Command Line Tools" "xcode-select --install"
fi

# 2. Homebrew — the app manages it, and it's the easiest way to get Node.
if command -v brew >/dev/null 2>&1; then
  pass "Homebrew ($(command -v brew))"
elif [ -x /opt/homebrew/bin/brew ] || [ -x /usr/local/bin/brew ]; then
  miss "Homebrew installed but not on PATH" \
    "echo 'eval \"\$(/opt/homebrew/bin/brew shellenv)\"' >> ~/.zprofile, then open a new terminal"
else
  miss "Homebrew" \
    '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" — then follow its final PATH instructions'
fi

# 3. Node >= 22.12 (Vite 8 requirement; CI runs 22).
if command -v node >/dev/null 2>&1; then
  if node -e 'const [M,m]=process.versions.node.split(".").map(Number);process.exit(M>22||(M===22&&m>=12)?0:1)'; then
    pass "Node $(node --version)"
  else
    miss "Node $(node --version) is too old (need >= 22.12)" "brew install node"
  fi
else
  miss "Node.js" "brew install node"
fi

# 4. Rust via rustup — NOT `brew install rust` (Tauri needs rustup-managed toolchains).
if command -v cargo >/dev/null 2>&1 || [ -x "$HOME/.cargo/bin/cargo" ]; then
  if command -v rustup >/dev/null 2>&1 || [ -x "$HOME/.cargo/bin/rustup" ]; then
    pass "Rust ($("$HOME/.cargo/bin/rustc" --version 2>/dev/null || rustc --version))"
  else
    miss "Rust found but without rustup (brew-installed?)" \
      "brew uninstall rust; curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  fi
  if ! command -v cargo >/dev/null 2>&1; then
    miss "cargo not on PATH in this shell" 'source "$HOME/.cargo/env" (or open a new terminal)'
  fi
else
  miss "Rust toolchain" \
    "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh — then open a new terminal"
fi

# 5. rustfmt + clippy — the git hooks run them on every commit/push.
if command -v cargo >/dev/null 2>&1; then
  cargo fmt --version >/dev/null 2>&1 && pass "rustfmt" || miss "rustfmt" "rustup component add rustfmt"
  cargo clippy --version >/dev/null 2>&1 && pass "clippy" || miss "clippy" "rustup component add clippy"
fi

# 6. Project deps + git hooks (lefthook installs hooks via npm postinstall).
cd "$(dirname "$0")/.." || exit 1
[ -d node_modules ] && pass "npm dependencies" || miss "npm dependencies" "npm install"
if grep -q lefthook .git/hooks/pre-commit 2>/dev/null; then
  pass "git hooks (lefthook)"
else
  miss "git hooks not installed" "npx lefthook install"
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "All good — run: npm run tauri dev"
else
  echo "$fail issue(s) — apply the fixes above, open a NEW terminal, then re-run: npm run setup"
  exit 1
fi
