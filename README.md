# Idle Defense War

Browser-based idle tower defense game. Built with vanilla JS + Supabase.

---

## Running the Game Locally

Open `index.html` through a local HTTP server — **do not open it directly as a file** (`file://`) or the CSS and JS won't load.

Quickest option with VS Code: install the **Live Server** extension → right-click `index.html` → *Open with Live Server*.

Or from the terminal:

```bash
npm run serve:test     # serves at http://localhost:5000
```

---

## QA / Testing

### First-time setup (run once)

```bash
npm run setup
```

This installs dependencies and downloads the Playwright Chromium browser.

### Configure credentials

```bash
cp .env.test.example .env.test
```

Open `.env.test` and fill in:

| Variable | What to put |
|---|---|
| `TEST_EMAIL_A` | Email of QA test account A (already in Supabase) |
| `TEST_PASSWORD_A` | Password for account A |
| `TEST_EMAIL_B` | Email of QA test account B (already in Supabase) |
| `TEST_PASSWORD_B` | Password for account B |
| `TEST_SUPABASE_SERVICE_KEY` | Service role key — Supabase Dashboard → Project Settings → API |

### Run all tests

```bash
npm test
```

That's it. Playwright starts a local server, runs all 58 tests, and prints results.

---

## Other Test Commands

| Command | What it runs |
|---|---|
| `npm test` | All 58 tests |
| `npm run test:formulas` | 31 formula/math tests — **no credentials needed** |
| `npm run test:smoke` | 9 in-game UI panel tests |
| `npm run test:auth` | 18 login/session/multi-tab tests |
| `npm run test:ui` | Opens Playwright's visual UI for debugging |
| `npm run test:report` | Opens the last HTML test report |

---

## What the Tests Cover

- **Guest login** — create, resume, logout, saved card
- **Email login** — sign in, wrong password, logout, re-login
- **Multi-tab** — two accounts stay independent across tabs
- **Same-account kick** — Tab 2 logs in → Tab 1 gets kicked automatically
- **Guest linking** — convert guest to email account
- **Game panels** — resources, research, inventory, crafting, campaign, alliance
- **Formulas** — all core math functions verified against the real game code

Full details: see [`QA_TESTING.md`](QA_TESTING.md)

---

## Tech Stack

- **Game:** Vanilla JS, CSS, HTML — no build step
- **Backend:** Supabase (auth + database + Realtime)
- **Hosting:** Netlify
- **Tests:** Playwright (Chromium)
