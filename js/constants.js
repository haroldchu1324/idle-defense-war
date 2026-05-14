// ═══════════════════════════════════════════════
// CONSTANTS & FORMULAS
// ═══════════════════════════════════════════════
const LEVEL_UNLOCK = [0, 10, 20, 40, 60];
const XP_PER_UNLOCK = 50;
const XP_PER_UPGRADE = 15;
const MAX_NODE_LEVEL = 15;

function xpForLevel(n) { return Math.floor(100 * Math.pow(1.35, n - 1)); }

// Level bonuses (multipliers, e.g. 0.05 = +5%)
function bonusProd(lvl)     { return (lvl - 1) * 0.001; }
function bonusCombat(lvl)   { return (lvl - 1) * 0.001; }
function bonusCraft(lvl)    { return Math.floor((lvl - 1) / 5) * 0.001; }
function bonusResearch(lvl) { return Math.floor((lvl - 1) / 5) * 0.001; }

// Upgrade time: 5s × 1.4^(upgradeLevel-1), displayed nicely
function upgradeTimeSecs(upgradeLevel) {
  return Math.max(5, Math.floor(5 * Math.pow(1.4, upgradeLevel - 1)));
}
function fmtTime(s) {
  s = Math.max(0, Math.round(s));
  if (s < 60)   return s + 's';
  if (s < 3600) return Math.floor(s/60) + 'm ' + (s%60) + 's';
  return Math.floor(s/3600) + 'h ' + Math.floor((s%3600)/60) + 'm';
}
function fmtCountdown(s) {
  s = Math.max(0, Math.round(s));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60), sec = s % 60;
  if (s < 3600) return m + ':' + String(sec).padStart(2,'0');
  const h = Math.floor(s / 3600), min = Math.floor((s % 3600) / 60);
  return h + 'h ' + String(min).padStart(2,'0') + 'm';
}
function fillTimeSecs(stored, cap, ph) {
  if (ph <= 0) return Infinity;
  const rem = cap - stored;
  if (rem <= 0) return 0;
  return Math.round((rem / ph) * 3600);
}

function nodeProdPerHour(r, ti, ul) {
  const base = Math.round(r.tiers[ti].baseProd * (1 + (ul - 1) * 0.50));
  const levelMult = 1 + bonusProd(playerLevel);
  const resMult = (typeof researchProdBonus === 'function') ? (1 + researchProdBonus(r.id)) : 1;
  return Math.round(base * levelMult * resMult);
}
function nodeStorageCap(r, ti, ul) {
  return Math.round(r.tiers[ti].cap * (1 + (ul - 1) * 0.60));
}
function nodeUpgradeCost(r, ti, ul) {
  return Math.round(r.tiers[ti].upgCostBase * Math.pow(1.6, ul - 1));
}

const TIER_TABLE = [
  [300,  80,   900 ],
  [600,  180,  1800],
  [1200, 400,  3600],
  [2400, 900,  7200],
  [4800, 2000, 14400],
];

const RESOURCE_DEFS = [
  { id:'wood',    name:'Wood',    icon:'🪵', type:'wood',
    label:'Wood',    costCurrency:'fiber',   costCurrencyLabel:'Fiber',   costCurrencyIcon:'🌿',
    desc:'Lumberjacks harvest timber from surrounding forests.',
    tiers: TIER_TABLE.map(([p,u,c],i) => ({baseProd:p,upgCostBase:u,cap:c,
      unlockCost:[0,300,700,1500,3500][i]})) },
  { id:'stone',   name:'Stone',   icon:'🪨', type:'stone',
    label:'Stone',   costCurrency:'leather', costCurrencyLabel:'Leather', costCurrencyIcon:'🟫',
    desc:'Miners extract durable stone from deep quarries.',
    tiers: TIER_TABLE.map(([p,u,c],i) => ({baseProd:p,upgCostBase:u,cap:c,
      unlockCost:[0,250,600,1400,3000][i]})) },
  { id:'fiber',   name:'Fiber',   icon:'🌿', type:'fiber',
    label:'Fiber',   costCurrency:'ore',     costCurrencyLabel:'Ore',     costCurrencyIcon:'⛏️',
    desc:'Fields of flax and hemp supply fiber for cloth.',
    tiers: TIER_TABLE.map(([p,u,c],i) => ({baseProd:p,upgCostBase:u,cap:c,
      unlockCost:[0,280,650,1450,3200][i]})) },
  { id:'leather', name:'Leather', icon:'🟫', type:'leather',
    label:'Leather', costCurrency:'stone',   costCurrencyLabel:'Stone',   costCurrencyIcon:'🪨',
    desc:'Tanners process hides into tough leather.',
    tiers: TIER_TABLE.map(([p,u,c],i) => ({baseProd:p,upgCostBase:u,cap:c,
      unlockCost:[0,220,550,1300,2800][i]})) },
  { id:'ore',     name:'Ore',     icon:'⛏️', type:'ore',
    label:'Ore',     costCurrency:'wood',    costCurrencyLabel:'Wood',    costCurrencyIcon:'🪵',
    desc:'Deep mines extract raw ore for smithing.',
    tiers: TIER_TABLE.map(([p,u,c],i) => ({baseProd:p,upgCostBase:u,cap:c,
      unlockCost:[0,200,500,1200,2500][i]})) },
];

