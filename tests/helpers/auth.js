/**
 * Reusable Playwright helpers for auth and game state.
 * All functions accept a Playwright `page` object.
 */

/**
 * Navigate to the game root and wait until the auth layer is visible.
 * This confirms that DOMContentLoaded has fired and game.js is running.
 */
async function gotoLogin(page) {
  await page.goto('/');
  await page.waitForSelector('#auth-layer.visible', { timeout: 15_000 });
}

/**
 * Log in with an email/password account and wait for the game to appear.
 */
async function loginWithEmail(page, email, password) {
  await gotoLogin(page);
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#login-btn');
  // Game becomes visible after server-side load completes (~3–20 s)
  await page.waitForSelector('#game.visible', { timeout: 35_000 });
}

/**
 * Click "Play as Guest" and wait for the game to appear.
 * Returns the cached guest data (userId, username, email, password)
 * read from localStorage after the game loads.
 */
async function loginAsGuest(page) {
  await gotoLogin(page);
  await page.click('#guest-play-btn');
  await page.waitForSelector('#game.visible', { timeout: 35_000 });
  return getGuestCache(page);
}

/**
 * Click the "Sign out" button and wait for the auth layer to reappear.
 *
 * The 600 ms extra wait lets hideGame()'s internal 400 ms setTimeout
 * (which sets display:none) fire before the next action. Without it,
 * a subsequent showGame() call can have its display:flex immediately
 * overwritten by the still-pending timer, leaving #game in a broken
 * display:none + class=visible state that never resolves.
 */
async function logout(page) {
  await page.click('.logout-btn');
  await page.waitForSelector('#auth-layer.visible', { timeout: 15_000 });
  await page.waitForTimeout(600);
}

/**
 * Read the guest cache stored in localStorage by the game.
 * Returns an object with { userId, username, email, password, level }
 * or an empty object if not present.
 */
async function getGuestCache(page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('idw_guest_cache') || '{}');
    } catch {
      return {};
    }
  });
}

/**
 * Clear localStorage so a test starts with a clean state.
 * Does NOT clear sessionStorage (that is per-tab and already isolated).
 */
async function clearLocalStorage(page) {
  await page.evaluate(() => localStorage.clear());
}

module.exports = {
  gotoLogin,
  loginWithEmail,
  loginAsGuest,
  logout,
  getGuestCache,
  clearLocalStorage,
};
