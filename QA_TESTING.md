# QA Testing Guide — Idle Defense War

## Overview

This project uses **Playwright** for all tests — browser-based E2E tests for auth flows, game UI smoke checks, and formula verification via `page.evaluate()` against the real production game code.

No separate unit-test framework is needed. Playwright tests run the actual `game.js` in a real Chromium browser, so "if the test says it passes, the real code passes."

---

## File Structure

```
tests/
  helpers/
    admin.js          — Supabase admin API helper (delete test users)
    auth.js           — Reusable login/logout/guest helpers
  e2e/
    auth/
      guest-login.spec.js         — Guest login, saved card, resume, logout
      email-login.spec.js         — Email login, wrong password, logout, re-login
      multi-tab.spec.js           — Multi-account tab isolation
      same-account-kick.spec.js   — Same account on two tabs → Tab 1 kicked
      guest-link.spec.js          — Guest-to-email account linking
    game/
      smoke.spec.js               — Core panels render, navigation works
      formulas.spec.js            — Pure formula correctness via page.evaluate()
      hero-gear.spec.js           — My Hero gear/equipment/skills UI

playwright.config.js    — Playwright configuration
package.json            — npm scripts and dependencies
.env.test.example       — Template for required environment variables
.env.test               — Your real secrets (git-ignored, create from example)
```

---

## Setup

### 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Create your `.env.test` file

```bash
cp .env.test.example .env.test
```

Open `.env.test` and fill in:

| Variable | Description |
|---|---|
| `TEST_EMAIL_A` | Email of dedicated QA test account A (already exists in Supabase) |
| `TEST_PASSWORD_A` | Password for account A |
| `TEST_EMAIL_B` | Email of dedicated QA test account B (already exists in Supabase) |
| `TEST_PASSWORD_B` | Password for account B |
| `TEST_SUPABASE_SERVICE_KEY` | Service role key from Supabase Dashboard → Project Settings → API |

> **Never commit `.env.test` to git.** It is in `.gitignore`.

### 3. Create dedicated QA accounts in Supabase

If you haven't yet, sign up two test accounts through the game UI (or via the Supabase dashboard):
- Account A — used for single-tab email login, kick test, smoke tests
- Account B — used for multi-tab isolation tests

Use email addresses you own but that are clearly test accounts (e.g. `yourname+qa-a@gmail.com`).

---

## Running Tests

### Run everything

```bash
npm test
```

### Run only auth tests

```bash
npm run test:auth
```

### Run only smoke tests (UI panels)

```bash
npm run test:smoke
```

### Run only hero gear tests

```bash
npm run test:hero
```

### Run only formula tests (no login needed)

```bash
npm run test:formulas
```

### Open Playwright's interactive UI (great for debugging)

```bash
npm run test:ui
```

### View the HTML report after a run

```bash
npm run test:report
```

---

## Test Descriptions

### Auth — `guest-login.spec.js` (5 tests)

| Test | What it verifies |
|---|---|
| Guest login works | Clicking "Play as Guest" loads the game |
| Guest saved card shows correct name | After logout, the saved card shows the guest's username |
| Guest logout returns to login screen | Sign out returns to auth layer |
| Guest resume loads the game | Clicking "Continue" on the saved card loads the game |
| Guest resume does not get stuck on second attempt | Resume works on the second logout→resume cycle |

**Cleanup:** Each test creates a real guest account in Supabase. It is automatically deleted after the test using the service role key.

---

### Auth — `email-login.spec.js` (5 tests)

| Test | What it verifies |
|---|---|
| Email login works | Correct credentials load the game |
| Username is populated | `#username-display` is non-empty after login |
| Wrong password shows error | Error message appears, game does not load |
| Logout returns to login screen | Sign out works |
| Re-login after logout works | Can log in again in the same tab |

---

### Auth — `multi-tab.spec.js` (3 tests)

| Test | What it verifies |
|---|---|
| Account A and B are independent | Both games load with different usernames |
| Logout of A does not affect B | B stays logged in after A signs out |
| Logout of B does not affect A | A stays logged in after B signs out |

**Known limitation:** These tests use separate Playwright browser contexts (isolated storage). The `BroadcastChannel` cross-tab logout filter (`sessionChannel`) does not fire across Playwright contexts the same way it would in a real browser with two tabs in the same window. The BroadcastChannel logic should be verified manually (see manual checklist below).

---

### Auth — `same-account-kick.spec.js` (1 test)

| Test | What it verifies |
|---|---|
| Tab 2 loads, Tab 1 is kicked | When Account A logs in on Tab 2, Tab 1 shows the "logged out in another tab" message |

This test exercises the Supabase Realtime broadcast kick mechanism end-to-end. It allows up to 40 seconds for the Realtime kick to propagate.

---

### Auth — `guest-link.spec.js` (4 tests)

| Test | What it verifies |
|---|---|
| Link modal opens | Clicking "Link account" opens the modal |
| Modal has all required fields | Username, email, confirm email, password, confirm password |
| Valid submission shows success | Success message contains the new email |
| Cache cleared, returns to login | Guest cache removed, email pre-filled on login screen |

**Known limitation:** Cannot verify email delivery or post-confirmation login (email confirmation is required). The test uses a generated `idw-qa-link-{timestamp}@example.com` address.

**Cleanup:** The guest account created for each test is deleted via the admin API after the test.

---

### Game — `smoke.spec.js` (9 tests)

| Test | What it verifies |
|---|---|
| No uncaught JS errors during login | `pageerror` listener — any JS crash fails the test |
| Resources panel renders | `#resources-panel` has children |
| Resource pills show values | `#pill-wood` etc. are non-empty |
| Research panel renders | `#research-panel` has children after tab switch |
| Inventory/armory panel renders | `#armory-grid` is present |
| Crafting panel renders | `#tower-grid` is present |
| Campaign map renders | `#campaign-map` has children |
| Alliance section opens without crashing | `#al-content` has children |
| PvP section opens (no guest lock for real account) | `pvp-guest-lock` is not active |
| Navigation between sections works | Base → Campaign → Alliance → Base cycle |

---

### Game — `hero-gear.spec.js` (12 tests)

All gear state lives in `localStorage` (`idw_hero_gear`). No Supabase interaction is needed. Each test resets the in-memory `heroGearState` and clears localStorage before running so tests are fully isolated.

| Test | What it verifies |
|---|---|
| Two-panel layout renders | `.hero-inv-panel` and `.hero-char-panel` are visible; subtitle mentions "equipment" |
| Weapons tab is default | Active tab is "Weapons"; cards show rarity, level, handedness, and Equip button |
| Gear tab switch | Clicking Gear tab shows armour/offhand cards with slot labels |
| Equip one-handed weapon | Main Hand slot fills, Unequip button appears, stats show ATK +15 |
| Two-handed weapon disables offhand | Offhand slot gets `.equip-slot-disabled`; `equippedGear.offhand` is null |
| Switch two-handed → one-handed re-enables offhand | Disabled slot count drops to 0 |
| Equip helmet + armor + boots | 3 filled slots; DEF, HP +70, Mov Spd all appear in stats summary |
| Unequip a slot | Slot reverts to empty; stats revert to "No gear equipped" |
| Skills tab — 3 empty slots, disabled buttons | `.skill-slot` count = 3; all Equip buttons disabled; "coming soon" text present |
| Hero selection updates panel title | After `selectHero('warlord')`, right panel title shows "Warlord" |
| localStorage persistence | `idw_hero_gear` key contains correct `equippedGear` and `skills` array |
| Navigate away and back preserves gear | Gear still equipped after Campaign → back to My Hero |
| Other nav sections unaffected | Market, Campaign, Base sections still show/hide correctly after visiting My Hero |

---

### Game — `formulas.spec.js` (31 tests)

Formula tests run on an **unauthenticated page** — no login required. They call game functions directly via `page.evaluate()` and check exact return values.

| Function | Tests |
|---|---|
| `xpForLevel` | Level 1=100, Level 2=135, Level 5=332, monotonically increasing |
| `upgradeTimeSecs` | Level 1=5, Level 2=7, Level 3=9, growing |
| `fmtTime` | 0s, 59s, 60→"1m 0s", 90→"1m 30s", 3600→"1h 0m", 3661→"1h 1m" |
| `fmtCompact` | 500→"500", 1500→"1.5K", 1M→"1M", 1.5B→"1.5B" |
| `nodeProdPerHour` | Wood tier-0 level-1=300, level-2=450 |
| `nodeUpgradeCost` | Wood tier-0 level-1=80, level-2=128, growing |
| `nodeStorageCap` | Wood tier-0 level-1=900, level-2=1710 |
| `bonusProd` | Level 1=0, Level 2=0.001, Level 10=0.009 |
| `RESOURCE_DEFS` | Exactly 5 resources, each with 5 tiers |
| `RESEARCH_DEFS` | All entries have required fields |

---

## Environment Variables Reference

| Variable | Required by | Description |
|---|---|---|
| `TEST_EMAIL_A` | email-login, multi-tab, kick, smoke | Email for QA account A |
| `TEST_PASSWORD_A` | email-login, multi-tab, kick, smoke | Password for QA account A |
| `TEST_EMAIL_B` | multi-tab | Email for QA account B |
| `TEST_PASSWORD_B` | multi-tab | Password for QA account B |
| `TEST_SUPABASE_SERVICE_KEY` | guest-login, guest-link | Supabase service role key for user deletion |

Formula tests (`formulas.spec.js`) require **no environment variables**.

---

## How to Add New Tests

1. Create a new `.spec.js` file in `tests/e2e/auth/` or `tests/e2e/game/`.
2. Import helpers at the top:
   ```js
   const { test, expect } = require('@playwright/test');
   const { loginWithEmail, logout } = require('../../helpers/auth');
   ```
3. Write tests using `test('description', async ({ page }) => { ... })`.
4. For formula tests, navigate to `'/'`, wait for `#auth-layer.visible`, then use `page.evaluate(() => yourFunction(...))`.
5. For guest tests, call `deleteSupabaseUser(guestUserId)` in `afterEach`.

### Adding a formula test

```js
test('formula — myFunction(x) returns expected', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#auth-layer.visible', { timeout: 15_000 });
  const result = await page.evaluate(() => myFunction(someArg));
  expect(result).toBe(expectedValue);
});
```

### Adding an auth flow test

```js
test('my new auth test', async ({ page }) => {
  await loginWithEmail(page, process.env.TEST_EMAIL_A, process.env.TEST_PASSWORD_A);
  // ... assertions ...
  await logout(page);
});
```

---

## Known Limitations

1. **BroadcastChannel cross-tab filter** — The `sessionChannel.postMessage` logout filter (prevents Account A's logout from affecting Account B in the same browser window) cannot be fully automated with Playwright because Playwright contexts are isolated. Verify manually: open two tabs in the same Chrome window, log into different accounts, sign out of one, confirm the other stays logged in.

2. **Email confirmation flow** — The guest-link tests cannot verify post-confirmation login because a real email must be clicked. The test stops at the "confirmation email sent" step.

3. **Realtime kick timing** — The kick test allows 40 seconds for the Realtime broadcast to propagate. In rare cases of high Supabase latency the test may time out. Re-run if this happens.

4. **Production database** — All tests run against the production Supabase project. Guest accounts are cleaned up automatically. Test email accounts (A and B) are never deleted. Avoid using your personal game account as a test account.

5. **Alliance section** — The alliance panel content (browser vs. member view) varies by account state. The smoke test only confirms the section renders with at least one child element.

---

## Pre-Merge Manual Checklist

Run this before merging any branch to `main`:

```
Auth
[ ] Guest login works (Play as Guest → game loads)
[ ] Guest saved card appears with correct name after logout
[ ] Guest resume works (Continue → game loads, not stuck)
[ ] Email login works
[ ] Wrong password shows an error
[ ] Logout returns to login screen
[ ] Re-login after logout works

Multi-tab (manual — open two browser tabs in the same window)
[ ] Account A on Tab 1, Account B on Tab 2 → both stay independent
[ ] Sign out of Account A → Account B is NOT affected
[ ] Sign out of Account B → Account A is NOT affected
[ ] Account A logged in on Tab 1, log in as Account A on Tab 2 → Tab 1 shows "logged out in another tab"

Guest linking
[ ] Can open link modal from guest banner
[ ] Submitting valid form shows success message
[ ] After linking, returns to login screen with email pre-filled

In-game panels
[ ] Resources panel loads with node cards
[ ] Research panel loads
[ ] Inventory/Armory panel loads
[ ] Crafting panel loads
[ ] Campaign map loads
[ ] Navigation between Base / Campaign / PvP / Alliance does not crash
[ ] Resource pills show values in the top bar

My Hero — gear page
[ ] My Hero tab opens with two-column layout (Inventory left, Commander right)
[ ] Weapons tab shows weapon cards with rarity, level, handedness, and Equip button
[ ] Gear tab shows armour/offhand cards with slot labels
[ ] Equipping a one-handed weapon fills Main Hand slot; stats update
[ ] Equipping a two-handed weapon disables the Offhand slot
[ ] Switching to a one-handed weapon re-enables the Offhand slot
[ ] Equipping helmet, armor, boots fills the correct slots; stats accumulate
[ ] Unequipping a slot via ✕ reverts it to empty; stats decrease
[ ] Skills tab shows 3 empty slots with disabled Equip buttons
[ ] Selecting a hero class updates the Commander panel title
[ ] Gear state survives navigating away and back to My Hero

Console (open DevTools → Console)
[ ] No red errors during login
[ ] No red errors during normal gameplay
[ ] No red errors during logout
```
