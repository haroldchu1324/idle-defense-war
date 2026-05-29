/**
 * My Hero — gear management page tests.
 *
 * Covers the gear/equipment/skills UI that replaced the old hero-class-selection
 * panel. All gear state lives in localStorage (idw_hero_gear), so no Supabase
 * interaction is needed and cleanup is just removing that key.
 *
 * Uses TEST_EMAIL_A (same as smoke tests) — no guest cleanup required.
 *
 * Test isolation: each test navigates to the hero section and resets
 * heroGearState + localStorage before exercising the feature.
 */

const { test, expect } = require('@playwright/test');
const { loginWithEmail } = require('../../helpers/auth');

const EMAIL    = process.env.TEST_EMAIL_A;
const PASSWORD = process.env.TEST_PASSWORD_A;

test.beforeAll(() => {
  if (!EMAIL || !PASSWORD) {
    throw new Error('TEST_EMAIL_A and TEST_PASSWORD_A must be set in .env.test for hero-gear tests.');
  }
});

// Fail immediately on any uncaught JS error
test.beforeEach(async ({ page }) => {
  page.on('pageerror', err => {
    throw new Error(`[pageerror] ${err.message}`);
  });
});

test.afterEach(async ({ page }) => {
  try {
    if (await page.locator('#game.visible').isVisible()) {
      await page.click('.logout-btn');
    }
  } catch { /* already logged out */ }
});

/**
 * Navigate to the My Hero section with a clean gear state for test isolation.
 * Resets localStorage AND the in-memory heroGearState so each test starts fresh.
 */
async function openHeroSection(page) {
  await page.evaluate(() => {
    localStorage.removeItem('idw_hero_gear');
    // Reset in-memory state so loadHeroGearState() re-initialises from defaults
    heroGearState = null;
    document.getElementById('nav-hero').click();
  });
  await expect(page.locator('#section-hero')).toBeVisible();
  await expect(page.locator('.hero-page-wrap')).toBeVisible();
}

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — My Hero section opens and renders two-panel layout', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  // Both panels must be present
  await expect(page.locator('.hero-inv-panel')).toBeVisible();
  await expect(page.locator('.hero-char-panel')).toBeVisible();

  // Header subtitle must reflect new purpose
  await expect(page.locator('.campaign-stage-sub')).toContainText('equipment');
});

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — Weapons tab is active by default and shows weapon cards', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  // Weapons tab button should carry the active class
  const weaponsTabBtn = page.locator('.hero-tab-btn.active').first();
  await expect(weaponsTabBtn).toContainText('Weapons');

  // At least one weapon card must be visible
  const weaponCards = page.locator('.hero-inv-list .gear-item-card');
  await expect(weaponCards.first()).toBeVisible();
  expect(await weaponCards.count()).toBeGreaterThan(0);

  // Each card must show a rarity tag, level tag, handedness tag, and Equip button
  const firstCard = weaponCards.first();
  await expect(firstCard.locator('.gear-rarity-tag')).toBeVisible();
  await expect(firstCard.locator('.gear-level-tag')).toBeVisible();
  await expect(firstCard.locator('.gear-hand-tag')).toBeVisible();
  await expect(firstCard.locator('.gear-btn-equip')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — Gear tab switch shows armour/offhand cards with slot labels', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  await page.evaluate(() => heroSetInvTab('gear'));

  const gearCards = page.locator('.hero-inv-list .gear-item-card');
  await expect(gearCards.first()).toBeVisible();
  expect(await gearCards.count()).toBeGreaterThan(0);

  // Gear cards must have a slot tag (Helmet / Armor / Boots / Offhand)
  await expect(gearCards.first().locator('.gear-slot-tag')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — equipping a one-handed weapon fills Main Hand slot and updates stats', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  await page.evaluate(() => equipGearItem('mainHand', 'iron_sword'));

  // Exactly one filled equipment slot (Main Hand)
  const filledCount = await page.evaluate(() =>
    document.querySelectorAll('.equip-slot-filled').length
  );
  expect(filledCount).toBe(1);

  // The inventory card for iron_sword must now show an Unequip button
  expect(await page.evaluate(() => !!document.querySelector('.gear-btn-unequip'))).toBe(true);

  // Stats summary must contain iron_sword's ATK +15
  const statsText = await page.locator('.gear-stats-summary').innerText();
  expect(statsText).toContain('ATK');
  expect(statsText).toContain('+15');
});

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — equipping a two-handed weapon disables the Offhand slot', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  await page.evaluate(() => equipGearItem('mainHand', 'war_axe'));

  // Offhand must carry the disabled class
  expect(
    await page.evaluate(() => !!document.querySelector('.equip-slot-disabled'))
  ).toBe(true);

  // State: offhand must be null
  const offhand = await page.evaluate(() => heroGearState.equippedGear.offhand);
  expect(offhand).toBeNull();
});

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — switching from two-handed to one-handed re-enables the Offhand slot', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  // Equip two-handed first
  await page.evaluate(() => equipGearItem('mainHand', 'war_axe'));
  expect(
    await page.evaluate(() => document.querySelectorAll('.equip-slot-disabled').length)
  ).toBe(1);

  // Switch to one-handed — disabled slot must disappear
  await page.evaluate(() => equipGearItem('mainHand', 'iron_sword'));
  expect(
    await page.evaluate(() => document.querySelectorAll('.equip-slot-disabled').length)
  ).toBe(0);
});

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — equipping helmet, armor, and boots fills all three slots and accumulates stats', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  await page.evaluate(() => {
    equipGearItem('helmet', 'iron_helmet');  // DEF +8,  HP +20
    equipGearItem('armor',  'chain_armor'); // DEF +18, HP +50
    equipGearItem('boots',  'iron_boots'); // DEF +5,  MoveSpd +5
  });

  // Three slots filled
  expect(
    await page.evaluate(() => document.querySelectorAll('.equip-slot-filled').length)
  ).toBe(3);

  const statsText = await page.locator('.gear-stats-summary').innerText();
  expect(statsText).toContain('DEF');  // aggregated DEF
  expect(statsText).toContain('+70'); // combined HP (20+50)
  expect(statsText).toContain('Mov Spd'); // boots move speed
});

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — unequipping a slot reverts it to empty state and removes its stats', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  // Equip helmet, verify HP stat appears
  await page.evaluate(() => equipGearItem('helmet', 'iron_helmet'));
  let statsText = await page.locator('.gear-stats-summary').innerText();
  expect(statsText).toContain('+20'); // iron_helmet HP

  // Unequip via programmatic call (mirrors clicking the ✕ button)
  await page.evaluate(() => unequipGearSlot('helmet'));

  // No filled slots remain
  expect(
    await page.evaluate(() => document.querySelectorAll('.equip-slot-filled').length)
  ).toBe(0);

  // Stats summary must revert to "No gear equipped"
  statsText = await page.locator('.gear-stats-summary').innerText();
  expect(statsText).toContain('No gear equipped');
});

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — Skills tab renders 3 empty skill slots with disabled Equip buttons', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  await page.evaluate(() => heroSetCharTab('skills'));

  // Exactly 3 skill slots
  await expect(page.locator('.skill-slot')).toHaveCount(3);

  // All Equip buttons must be disabled
  expect(
    await page.evaluate(() =>
      Array.from(document.querySelectorAll('.skill-slot .gear-btn-equip'))
        .every(btn => btn.disabled)
    )
  ).toBe(true);

  // "Coming soon" note must be visible
  await expect(page.locator('.skills-layout')).toContainText('coming soon');
});

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — selecting a hero updates the character panel title', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  // Without a hero the right panel title should fall back to "Commander"
  const titlesBefore = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.hero-panel-title')).map(el => el.textContent)
  );
  expect(titlesBefore.some(t => t.includes('Commander'))).toBe(true);

  // Select the Warlord (uses the existing battle mechanic — must stay intact)
  await page.evaluate(() => selectHero('warlord'));

  const titlesAfter = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.hero-panel-title')).map(el => el.textContent)
  );
  expect(titlesAfter.some(t => t.includes('Warlord'))).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — gear state persists to localStorage after equipping', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  await page.evaluate(() => {
    equipGearItem('mainHand', 'elven_bow');
    equipGearItem('armor',    'chain_armor');
  });

  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('idw_hero_gear') || 'null')
  );

  expect(saved).not.toBeNull();
  expect(saved.equippedGear.mainHand).toBe('elven_bow');
  expect(saved.equippedGear.armor).toBe('chain_armor');
  expect(Array.isArray(saved.skills)).toBe(true);
  expect(saved.skills.length).toBe(3);
});

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — navigating away and back preserves equipped gear', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  await page.evaluate(() => equipGearItem('mainHand', 'iron_sword'));

  // Leave the hero section
  await page.evaluate(() => document.getElementById('nav-campaign').click());
  await expect(page.locator('#section-campaign')).toBeVisible();

  // Return — gear must still be equipped
  await page.evaluate(() => document.getElementById('nav-hero').click());
  await expect(page.locator('.hero-page-wrap')).toBeVisible();

  expect(
    await page.evaluate(() => document.querySelectorAll('.equip-slot-filled').length)
  ).toBe(1);

  // State value must still match
  expect(
    await page.evaluate(() => heroGearState.equippedGear.mainHand)
  ).toBe('iron_sword');
});

// ─────────────────────────────────────────────────────────────────────────────
test('hero-gear — other nav sections still work after visiting My Hero', async ({ page }) => {
  await loginWithEmail(page, EMAIL, PASSWORD);
  await openHeroSection(page);

  // Equip some gear while on My Hero
  await page.evaluate(() => {
    equipGearItem('mainHand', 'war_axe');
    equipGearItem('armor', 'chain_armor');
  });

  // Market
  await page.evaluate(() => document.getElementById('nav-market').click());
  await expect(page.locator('#section-market')).toBeVisible();
  await expect(page.locator('#section-hero')).not.toBeVisible();

  // Campaign
  await page.evaluate(() => document.getElementById('nav-campaign').click());
  await expect(page.locator('#section-campaign')).toBeVisible();
  await expect(page.locator('#section-market')).not.toBeVisible();

  // Base
  await page.evaluate(() => document.getElementById('nav-base').click());
  await expect(page.locator('#section-base')).toBeVisible();

  // No crash
  await expect(page.locator('#game')).toBeVisible();
});
