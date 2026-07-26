# Product

## Register

**Product** — app UI (a macOS menu-bar utility). Design serves the workflow; it is never the show.

## Users & Purpose

- One developer on a Mac, managing their local dev environment: Homebrew services, ports,
  work sessions — and machine health via **Nexus Doctor** (system probes, the Claude chat
  Archiver, VSCode cleanup, disk hygiene).
- Context: the app lives in the menu-bar tray all day. It gets opened for seconds — check,
  act, dismiss. Zero patience for friction, zero tolerance for jank.
- Primary jobs: start/stop services, kill a port, run a health scan, archive/restore Claude
  chats, reclaim disk space — each in as few clicks as the action honestly needs.

## Brand personality

**Native. Honest. Invisible.** It should feel like a first-party macOS utility (Notes, Mail,
System Settings) that happens to know about Homebrew and Claude — never like a web app in a
window. Honesty is product DNA: every Doctor finding carries an honest `[Speed]` / `[Storage]`
/ `[Info]` tag, and the app never claims disk cleanup makes a machine faster (it doesn't).

## Design principles

1. **macOS-native first.** System font (SF stack), master-detail layouts, macOS/iOS controls
   (switches, round selection checkboxes, segmented controls), 8px rhythm, sentence case,
   restrained accent (≤ ~10% of any screen).
2. **Dark mode is flat** — 1px borders + tonal surfaces, no shadows. Light mode gently lifted.
3. **One accent** (theme tokens); status always = semantic color **plus** label/icon, never
   color alone.
4. **Read-only by default.** Every mutation is explicit, confirmable, and journaled — the UI
   must make destructive vs. safe actions visually unmistakable (danger styling + two-step
   confirms for anything permanent).
5. **No layout jank.** Skeletons over spinners, fixed-height headers whose contents may swap,
   every long list scrolls inside its own card.

## Anti-references

- The Electron look: custom web chrome, marketing-style UI inside an app window, cards nested
  in cards.
- Dashboard slop: hero metrics, gradient text, side-stripe accent borders, uppercase eyebrow
  labels over every section.
- CleanMyMac-style alarmism: no scare badges, no fake "boost" buttons, no red for things that
  are merely informational.

## Accessibility

WCAG 2.1 AA contrast; visible `:focus-visible` rings everywhere; custom-looking controls keep
real native inputs underneath (sr-only pattern); every animation has a
`prefers-reduced-motion` alternative.
