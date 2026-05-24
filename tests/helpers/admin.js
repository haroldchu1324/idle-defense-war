/**
 * Supabase admin helpers — run in the Node.js test-runner context (not the browser).
 * Uses the service-role key to perform privileged operations like deleting users.
 */

const SUPABASE_URL = 'https://gdlkslptehtxudfghhqh.supabase.co';

/**
 * Permanently delete a Supabase auth user by UUID.
 * Call this in afterEach / afterAll hooks to clean up guest accounts
 * created during tests so they do not accumulate in production.
 *
 * Requires TEST_SUPABASE_SERVICE_KEY to be set in .env.test.
 *
 * @param {string|null} userId - The UUID of the user to delete. No-op if falsy.
 */
async function deleteSupabaseUser(userId) {
  if (!userId) return;

  const serviceKey = process.env.TEST_SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    console.warn('[cleanup] TEST_SUPABASE_SERVICE_KEY not set — skipping user deletion for', userId);
    return;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    // 404 means the user was already deleted — that is fine
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => '');
      console.warn(`[cleanup] Failed to delete user ${userId}: HTTP ${res.status} — ${body}`);
    }
  } catch (err) {
    console.warn('[cleanup] Network error while deleting user', userId, err.message);
  }
}

module.exports = { deleteSupabaseUser };
