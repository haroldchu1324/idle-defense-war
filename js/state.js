// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
let resources = {wood:500,stone:500,fiber:500,leather:500,ore:500};
let playerXP = 0, playerLevel = 1;

const nodeState = {};
RESOURCE_DEFS.forEach(r => {
  nodeState[r.id] = r.tiers.map((_,ti) => ({
    unlocked: ti === 0, upgradeLevel: 1, storedAmount: 0,
    upgrading: false, upgradeStartMs: 0, upgradeDurationMs: 0, upgradeCostPaid: 0,
  }));
});

let currentUser = null, saveTimer = null, rafId = null;
let lastTick = Date.now(), lastStructuralRender = 0;

// ═══════════════════════════════════════════════
// SESSION BROADCAST
// ═══════════════════════════════════════════════
const sessionChannel = new BroadcastChannel('blade_forge_session');
sessionChannel.onmessage = (e) => {
  if (e.data === 'logout' && currentUser) {
    currentUser=null; stopLoop(); clearTimeout(saveTimer); resetState(); hideGame();
  }
};

