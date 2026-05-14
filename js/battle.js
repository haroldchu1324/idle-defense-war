// ═══════════════════════════════════════════════════════════════
// TOWER DEFENSE BATTLE ENGINE
// ═══════════════════════════════════════════════════════════════

const TILE = 48; 

const MAP_DEFS = {
  'forest': {
    name: 'Goblin Forest',
    bg: '#1a2a15',
    pathColor: '#5a4020',
    pathWidth: 0.85,
    waypoints: [
      [0,2],[2,2],[2,4],[4,4],[4,1],[6,1],[6,5],[8,5],
      [8,7],[10,7],[10,4],[12,4],[12,8],[14,8],[14,5],[16,5],
      [16,2],[18,2],[18,6],[20,6],[20,3],[22,3]
    ],
  },
  'canyon': {
    name: 'Stone Canyon',
    bg: '#1a1510',
    pathColor: '#7a6040',
    pathWidth: 0.85,
    waypoints: [
      [0,1],[2,1],[2,3],[4,3],[4,6],[2,6],[2,8],[5,8],
      [5,5],[7,5],[7,2],[9,2],[9,6],[11,6],[11,3],[14,3],
      [14,7],[16,7],[16,4],[18,4],[18,1],[20,1],[20,5],[22,5]
    ],
  },
  'swamp': {
    name: 'Dark Swamp',
    bg: '#0f1a10',
    pathColor: '#3a5030',
    pathWidth: 0.85,
    waypoints: [
      [0,5],[2,5],[2,2],[4,2],[4,7],[6,7],[6,4],[8,4],
      [8,8],[10,8],[10,5],[12,5],[12,1],[14,1],[14,4],[16,4],
      [16,8],[18,8],[18,5],[20,5],[20,2],[22,2]
    ],
  },
};

const STAGE_MAP = {
  '1-1':'forest','1-2':'forest','1-3':'forest','1-4':'canyon',
  '1-5':'canyon','1-6':'canyon','1-7':'swamp','1-8':'swamp','1-9':'swamp','1-10':'swamp',
};

const ENEMY_TYPES = {
  red:    { name:'Red Crawler',    color:'#e03030', size:9,  hp:30,  speed:51,  reward:1, spawnOnDeath:null },
  blue:   { name:'Blue Runner',   color:'#3060e0', size:9,  hp:30,  speed:77,  reward:2, spawnOnDeath:{ type:'red',   count:1 } },
  green:  { name:'Green Sprinter',color:'#30a030', size:10, hp:30,  speed:96,  reward:3, spawnOnDeath:{ type:'blue',  count:1 } },
  yellow: { name:'Yellow Armored',color:'#c0b020', size:11, hp:30,  speed:45,  reward:4, spawnOnDeath:{ type:'green', count:2 } },
  pink:   { name:'Pink Speeder',  color:'#d050a0', size:10, hp:60,  speed:115, reward:5, spawnOnDeath:{ type:'red',   count:3 } },
  black:  { name:'Black Tank',    color:'#303030', size:13, hp:120, speed:32,  reward:8, spawnOnDeath:{ type:'yellow',count:2 } },
  purple: { name:'Purple Mage',   color:'#8030c0', size:12, hp:120, speed:64,  reward:10,spawnOnDeath:{ type:'pink',  count:2 } },
  white:  { name:'White Ghost',   color:'#c0c0e0', size:11, hp:120, speed:90,  reward:9, spawnOnDeath:{ type:'blue',  count:4 } },
  boss:   { name:'Dragon Boss',   color:'#c01010', size:22, hp:800, speed:19,  reward:50,spawnOnDeath:{ type:'black', count:3 } },
};

function getWaveConfig(stageId, wave) {
  const stageIdx = CAMPAIGN_STAGES.findIndex(s=>s.id===stageId);
  const stageMult = 1 + stageIdx * 0.15;
  // Health scales up every OTHER wave
  const waveMult  = 1 + Math.floor((wave - 1) / 2) * 0.12;
  const mult = stageMult * waveMult;
  const isBoss = stageId === '1-10' && wave >= 8;

  function scaleEnemy(typeKey, count) {
    const t = ENEMY_TYPES[typeKey];
    return {
      type: typeKey,
      count,
      hp:    Math.round(t.hp * mult),
      speed: t.speed,
      reward: Math.max(1, t.reward),
      size:  t.size,
      color: t.color,
      spawnOnDeath: t.spawnOnDeath,
    };
  }

  if (isBoss && wave === 10) {
    return { enemies: [ scaleEnemy('boss', 1), scaleEnemy('black', 5) ] };
  }
  if (isBoss) {
    return { enemies: [ scaleEnemy('boss', 1), scaleEnemy('purple', 4) ] };
  }

  const baseCount = Math.round(4 + (wave - 1) * 1.2 + Math.floor(stageIdx / 2));

  const waveSteps = [
    ['red'],                  // w1
    ['red', 'blue'],          // w2
    ['blue'],                 // w3
    ['blue', 'green'],        // w4
    ['green'],                // w5
    ['green', 'yellow'],      // w6
    ['yellow', 'pink'],       // w7
    ['pink', 'black'],        // w8
    ['black', 'purple'],      // w9
    ['purple', 'white'],      // w10
  ];

  const stepIdx = Math.min(wave - 1 + Math.floor(stageIdx), waveSteps.length - 1);
  const types = waveSteps[stepIdx];

  const groups = types.map((typeKey, i) => {
    const count = (i < baseCount % types.length)
      ? Math.ceil(baseCount / types.length)
      : Math.floor(baseCount / types.length);
    return scaleEnemy(typeKey, Math.max(1, count));
  });

  return { enemies: groups };
}

let bs = null; 
let battleRaf = null;
let battleSetupStageId = null;
let battleSelectedTowers = []; 
let placingTower = null; 
let battleSpeed = 1;
let selectedTowerId = null; 

function battleDeploySlots() {
  let slots = 2;
  if (researchState['comb1']?.done) slots += 1;
  if (researchState['comb3']?.done) slots += 1;
  if (researchState['comb5']?.done) slots += 2;
  return slots;
}

const GRID_SNAP = 10;   
const TOWER_FOOTPRINT = 30; 
const TOWER_RADIUS_PX = 15; 

function openBattleSetup(stageId) {
  battleSetupStageId = stageId;
  battleSelectedTowers = [];
  const screen = document.getElementById('battle-screen');
  const setup  = document.getElementById('battle-setup');
  const game   = document.getElementById('battle-game');
  screen.style.display = 'flex';
  setup.style.display  = 'flex';
  game.style.display   = 'none';

  document.getElementById('setup-title').textContent = `Stage ${stageId}`;
  document.getElementById('setup-sub').textContent   = `Select up to ${battleDeploySlots()} towers from your Armory to bring`;

  const stage = CAMPAIGN_STAGES.find(s=>s.id===stageId);
  const mapDef = MAP_DEFS[STAGE_MAP[stageId]||'forest'];
  document.getElementById('setup-stage-info').innerHTML = `
    <div class="setup-info-row"><span class="setup-info-label">Map</span><span class="setup-info-val">${mapDef.name}</span></div>
    <div class="setup-info-row"><span class="setup-info-label">Enemies</span><span class="setup-info-val">${stage?.enemies||'Various'}</span></div>
    <div class="setup-info-row"><span class="setup-info-label">Waves</span><span class="setup-info-val">10</span></div>
    <div class="setup-info-row"><span class="setup-info-label">Deploy slots</span><span class="setup-info-val">${battleDeploySlots()}</span></div>
    <div class="setup-info-row"><span class="setup-info-label">Starting gold</span><span class="setup-info-val">💰 200</span></div>
  `;
  renderSetupArmory();
}

function renderSetupArmory() {
  const grid = document.getElementById('setup-armory-grid');
  const maxSlots = battleDeploySlots();
  grid.innerHTML = '';
  const validTowers = armoryTowers.filter(Boolean);
  if (validTowers.length === 0) {
    grid.innerHTML = `<div style="color:#555e80;font-size:13px;grid-column:1/-1;padding:1rem;">No towers in Armory.<br>Craft some in the Crafting tab first!</div>`;
  } else {
    validTowers.forEach((entry, i) => {
      const td = TOWER_DEFS.find(t=>t.id===entry.towerId);
      const sel = battleSelectedTowers.includes(i);
      const div = document.createElement('div');
      div.className = 'setup-tower-slot' + (sel ? ' selected' : '');
      div.innerHTML = `
        <div class="setup-tower-lvl">Lv${entry.level}</div>
        <div class="setup-tower-check">✓</div>
        <div class="setup-tower-icon">${td?.icon||'🗼'}</div>
        <div class="setup-tower-name">${td?.name||'Tower'}</div>
      `;
      div.onclick = () => toggleSetupTower(i, maxSlots);
      grid.appendChild(div);
    });
  }
  updateSetupSlotBadge(maxSlots);
}

function toggleSetupTower(idx, maxSlots) {
  const pos = battleSelectedTowers.indexOf(idx);
  if (pos >= 0) {
    battleSelectedTowers.splice(pos, 1);
  } else {
    if (battleSelectedTowers.length >= maxSlots) return;
    battleSelectedTowers.push(idx);
  }
  renderSetupArmory();
}

function updateSetupSlotBadge(maxSlots) {
  const n = battleSelectedTowers.length;
  document.getElementById('setup-slot-info').textContent = `${n} / ${maxSlots} selected`;
  document.getElementById('setup-start-btn').disabled = false;
}

function closeBattleScreen() {
  stopBattleLoop();
  document.getElementById('battle-screen').style.display = 'none';
  placingTower = null;
  selectedTowerId = null;
}

let pendingTowersQueue = []; 
let pendingPlacingIdx = 0;

async function startBattle() {
  const stageId = battleSetupStageId;
  const mapKey  = STAGE_MAP[stageId] || 'forest';
  const mapDef  = MAP_DEFS[mapKey];

  let serverBattle;
  try {
    serverBattle = await serverRpc('idw_start_battle', {p_stage_id:stageId, p_armory_indexes:battleSelectedTowers});
    currentBattleId = serverBattle.battleId;
    await refreshFromServer();
  } catch(e) { return; }

  const toConsume = (serverBattle.consumedTowers || []).filter(Boolean);
  pendingTowersQueue = toConsume.map(entry => ({
    entry,
    td: TOWER_DEFS.find(t=>t.id===entry.towerId),
    level: entry.level,
  })).filter(x=>x.td);
  pendingPlacingIdx = 0;

  document.getElementById('battle-setup').style.display = 'none';
  document.getElementById('battle-game').style.display  = 'block';
  document.getElementById('hud-stage-name').textContent = `Stage ${stageId}`;

  resizeBattleCanvas();
  const canvas = document.getElementById('battle-canvas');
  const cw = canvas.width, ch = canvas.height;
  const COLS = 22, ROWS = 10;
  const tw = cw / COLS, th = ch / ROWS;
  const pixelWaypoints = mapDef.waypoints.map(([c,r]) => ({x: c * tw + tw/2, y: r * th + th/2}));

  bs = {stageId, mapKey, mapDef, tw, th, COLS, ROWS, waypoints: pixelWaypoints,
    towers: [], enemies: [], projectiles: [], explosions: [], gold: 200, lives: 20,
    wave: 0, wavesQueued: 0, waveActive: false, waveEnemiesLeft: 0, waveSpawnQueue: [],
    spawnTimer: 0, gameOver: false, victory: false, lastTime: null};

  renderShop(); updateBattleHUD(); showShopPanel();
  placingTower = null; selectedTowerId = null;
  document.getElementById('result-overlay').style.display = 'none';
  document.getElementById('hud-wave-count').value = '1';
  canvas.onclick = handleCanvasClick; canvas.onmousemove = handleCanvasMouseMove;
  canvas.oncontextmenu = (e) => { e.preventDefault(); placingTower = null; selectedTowerId = null; showShopPanel(); };
  startBattleLoop();
  showToast('Battle started by server');
}

function updatePendingTowersBar() {
  const bar  = document.getElementById('pending-towers-bar');
  const list = document.getElementById('pending-towers-list');
  if (!pendingTowersQueue.length) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  list.innerHTML = '';
  pendingTowersQueue.forEach((t, i) => {
    const chip = document.createElement('div');
    chip.className = 'pending-tower-chip' + (i === pendingPlacingIdx && placingTower ? ' active-placing' : '');
    chip.innerHTML = `${t.td.icon}<span class="pending-chip-lvl">${t.level}</span>`;
    chip.title = t.td.name;
    chip.onclick = () => startPlacingPendingTower(i);
    list.appendChild(chip);
  });
}

function startPlacingPendingTower(idx) {
  const t = pendingTowersQueue[idx];
  if (!t) return;
  pendingPlacingIdx = idx;
  placingTower = { towerId: t.td.id, td: t.td, cost: 0, level: t.level, fromPending: true };
  document.getElementById('place-hint').style.display = 'block';
  updatePendingTowersBar();
}

function finishPlacingPendingTower(idx) {
  pendingTowersQueue.splice(idx, 1);
  placingTower = null;
  document.getElementById('place-hint').style.display = 'none';
  if (pendingTowersQueue.length > 0) {
    startPlacingPendingTower(0);
  } else {
    document.getElementById('pending-towers-bar').style.display = 'none';
  }
  updatePendingTowersBar();
}

function resizeBattleCanvas() {
  const canvas = document.getElementById('battle-canvas');
  const shop   = document.getElementById('battle-shop');
  const hud    = document.getElementById('battle-hud-top');
  const parent = document.getElementById('battle-game');
  canvas.width  = parent.clientWidth - shop.clientWidth;
  canvas.height = parent.clientHeight - hud.clientHeight;
}

function snapToGrid(x, y) {
  return {
    x: Math.floor(x / GRID_SNAP) * GRID_SNAP + (GRID_SNAP / 2),
    y: Math.floor(y / GRID_SNAP) * GRID_SNAP + (GRID_SNAP / 2),
  };
}

const MAP_BORDER = 12; 
function canPlaceTowerAt(sx, sy) {
  const half = TOWER_FOOTPRINT / 2;
  if (!bs) return false;
  const W = bs.tw * bs.COLS, H = bs.th * bs.ROWS;
  if (sx - half < MAP_BORDER || sx + half > W - MAP_BORDER) return false;
  if (sy - half < MAP_BORDER || sy + half > H - MAP_BORDER) return false;
  
  if (isTooCloseToTower(sx, sy, TOWER_RADIUS_PX)) return false;
  
  const samplePts = [];
  for (let dx = -half; dx <= half; dx += 5) {
    for (let dy = -half; dy <= half; dy += 5) {
      samplePts.push([sx+dx, sy+dy]);
    }
  }
  const halfRoad = (bs.tw * bs.mapDef.pathWidth) / 2;
  const onPath = samplePts.filter(([px,py]) => {
    const wps = bs.waypoints;
    for (let i=0;i<wps.length-1;i++) {
      if (distToSegment(px,py,wps[i].x,wps[i].y,wps[i+1].x,wps[i+1].y) < halfRoad+4) return true;
    }
    return false;
  });
  const coverage = onPath.length / samplePts.length;
  return coverage <= 0.5; // Max 50% overlap of path allowed
}

function makeTower(td, level, x, y) {
  const stats = towerStatsAtLevel(td, level);
  const tileW = bs ? bs.tw : 44;
  return {
    id: Math.random(),
    towerId: td.id,
    td, level,
    x, y,
    r: TOWER_RADIUS_PX,
    dmg:    stats.dmg,
    atkSpeed: parseFloat(stats.atkSpeed),
    range:  td.baseStats.range * tileW,
    projectiles: td.baseStats.projectiles,
    projectileSpeed: 280,
    piercing: 0, 
    special: td.id,
    cooldown: 0,
    target: null,
    upgrades: [0, 0, 0],
  };
}

function isTooCloseToPath(px, py, towerR) {
  if (!bs) return false;
  const halfRoad = (bs.tw * bs.mapDef.pathWidth) / 2 + towerR + 2;
  for (let i=0;i<bs.waypoints.length-1;i++) {
    if (distToSegment(px,py,bs.waypoints[i].x,bs.waypoints[i].y,bs.waypoints[i+1].x,bs.waypoints[i+1].y) < halfRoad) return true;
  }
  return false;
}

function isTooCloseToTower(px, py, r) {
  if (!bs) return false;
  // Allow significant overlap (up to 50%)
  return bs.towers.some(t => dist(px,py,t.x,t.y) < (t.r + r) * 0.5);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx=bx-ax, dy=by-ay;
  const lenSq = dx*dx+dy*dy;
  if (lenSq===0) return dist(px,py,ax,ay);
  let t = ((px-ax)*dx+(py-ay)*dy)/lenSq;
  t = Math.max(0,Math.min(1,t));
  return dist(px,py,ax+t*dx,ay+t*dy);
}

function dist(ax,ay,bx,by){ return Math.sqrt((ax-bx)**2+(ay-by)**2); }

function showShopPanel() {
  document.getElementById('shop-panel').style.display = 'flex';
  document.getElementById('upgrade-panel').style.display = 'none';
}
function showUpgradePanel(tower) {
  document.getElementById('shop-panel').style.display = 'none';
  document.getElementById('upgrade-panel').style.display = 'flex';
  renderUpgradePanel(tower);
}
function switchShopTab(tab) {
  ['towers'].forEach(t => {
    document.getElementById('shopview-'+t).classList.toggle('active', t===tab);
    document.getElementById('shoptab-'+t).classList.toggle('active', t===tab);
  });
}

function renderShop() {
  const list = document.getElementById('shop-list');
  if (!list || !bs) return;
  list.innerHTML = '';
  TOWER_DEFS.forEach(td => {
    const locked = playerLevel < td.unlockLevel;
    const shopCost = Math.round(Object.values(td.cost).reduce((a,b)=>a+b,0) * 0.4);
    const canAfford = (bs?.gold||0) >= shopCost;
    const sel = placingTower?.towerId === td.id && !placingTower.fromPending;
    const div = document.createElement('div');
    div.className = 'shop-item' + (sel?' shop-selected':'') + (locked?' shop-locked':'') + (!canAfford&&!locked?' shop-cant-afford':'');
    div.innerHTML = `
      <div class="shop-item-top">
        <span class="shop-item-icon">${td.icon}</span>
        <span class="shop-item-name">${td.name}</span>
        <span class="shop-item-cost">💰${shopCost}</span>
      </div>
      <div class="shop-item-stats">⚔️${td.baseStats.dmg} · ⚡${td.baseStats.atkSpeed}s · ×${td.baseStats.projectiles}${locked?` · 🔒Lv${td.unlockLevel}`:''}</div>
    `;
    if (!locked) div.onclick = () => selectShopTower(td.id, shopCost);
    list.appendChild(div);
  });
}

function selectShopTower(towerId, cost) {
  if (!bs || bs.gameOver || bs.victory) return;
  if ((bs.gold||0) < cost) { showToast('Not enough gold!'); return; }
  const td = TOWER_DEFS.find(t=>t.id===towerId);
  placingTower = { towerId, td, cost, level: 1, fromPending: false };
  document.getElementById('place-hint').style.display = 'block';
  deselectTower();
  renderShop();
}

function cancelPlacement() {
  placingTower = null;
  document.getElementById('place-hint').style.display = 'none';
  renderShop();
  updatePendingTowersBar();
}

// ── CANVAS EVENTS ──
let mousePos = {x:0,y:0};
function handleCanvasMouseMove(e) {
  const r = e.target.getBoundingClientRect();
  const rawX = e.clientX - r.left;
  const rawY = e.clientY - r.top;
  if (placingTower) {
    mousePos.x = Math.floor(rawX / GRID_SNAP) * GRID_SNAP + (GRID_SNAP / 2);
    mousePos.y = Math.floor(rawY / GRID_SNAP) * GRID_SNAP + (GRID_SNAP / 2);
  } else {
    mousePos.x = rawX;
    mousePos.y = rawY;
  }
}

function handleCanvasClick(e) {
  if (!bs) return;
  const rect = e.target.getBoundingClientRect();
  const rawX = e.clientX - rect.left;
  const rawY = e.clientY - rect.top;

  if (placingTower) {
    const x = mousePos.x, y = mousePos.y;
    if (!canPlaceTowerAt(x, y)) {
      showToast('Cannot place here — heavily overlapping path or tower!'); return;
    }
    if (x < 0 || y < 0 || x > bs.tw*bs.COLS || y > bs.th*bs.ROWS) {
      showToast('Place within the map!'); return;
    }
    if (!placingTower.fromPending) {
      bs.gold -= placingTower.cost;
      updateBattleHUD();
    }
    bs.towers.push(makeTower(placingTower.td, placingTower.level, x, y));
    if (placingTower.fromPending) {
      const idx = pendingTowersQueue.findIndex(t => t.td.id === placingTower.towerId && !t._placed);
      if (idx >= 0) { pendingTowersQueue[idx]._placed = true; finishPlacingPendingTower(idx); }
    } else {
      cancelPlacement();
    }
    renderShop();
    return;
  }

  const clicked = bs.towers.find(t => dist(rawX, rawY, t.x, t.y) <= t.r + 6);
  if (clicked) {
    selectedTowerId = clicked.id;
    showUpgradePanel(clicked);
  } else {
    deselectTower();
  }
}

function deselectTower() {
  selectedTowerId = null;
  showShopPanel();
}

// ── WAVE MANAGEMENT ──
function startNextWave() {
  if (!bs || bs.gameOver || bs.victory) return;
  if (bs.wave >= 10) return;
  const countEl = document.getElementById('hud-wave-count');
  const count = parseInt(countEl?.value||'1');
  
  // Instantly send X waves based on the dropdown
  for (let i = 0; i < count; i++) {
    if (bs.wave < 10) launchWave();
  }
}

function launchWave() {
  if (!bs || bs.wave >= 10) return;
  bs.wave++;
  bs.waveActive = true;
  const config = getWaveConfig(bs.stageId, bs.wave);
  let newEnemiesCount = 0;
  
  // Append enemies instead of wiping the queue
  config.enemies.forEach(group => {
    newEnemiesCount += group.count;
    for (let i=0;i<group.count;i++) {
      bs.waveSpawnQueue.push({ ...group, spawnDelay: bs.spawnTimer + i*(Math.max(350,1000-bs.wave*50)) });
    }
  });
  bs.waveSpawnQueue.sort((a,b)=>a.spawnDelay-b.spawnDelay);
  bs.waveEnemiesLeft += newEnemiesCount;
  updateBattleHUD();
}

// ── UPGRADE PANEL ──
const UPGRADE_PATHS = [
  {
    key:'range', icon:'📏', name:'Extended Range',
    levels:[
      { desc:'Range +20%',    cost:60  },
      { desc:'Range +40%',    cost:120 },
      { desc:'Range +60%',    cost:220 },
    ],
    apply(t, lvl) { t.range = t.td.baseStats.range * bs.tw * (1 + lvl * 0.2); }
  },
  {
    key:'speed', icon:'⚡', name:'Attack Speed',
    levels:[
      { desc:'Speed +15%',    cost:80  },
      { desc:'Speed +30%',    cost:160 },
      { desc:'Speed +50%',    cost:280 },
    ],
    apply(t, lvl) { t.atkSpeed = parseFloat(towerStatsAtLevel(t.td,t.level).atkSpeed) * (1 - lvl*0.15); }
  },
  {
    key:'special', icon:'✨', name:'Special Boost',
    levels:[
      { desc:'Proj speed +25%',  cost:70  },
      { desc:'Pierce +1 enemy',  cost:150 },
      { desc:'Damage +30%',      cost:260 },
    ],
    apply(t, lvl) {
      if (lvl >= 1) t.projectileSpeed = 280 * (1 + (lvl)*0.25);
      if (lvl >= 2) t.piercing = 1;
      if (lvl >= 3) t.dmg = Math.round(towerStatsAtLevel(t.td,t.level).dmg * 1.3);
    }
  },
];

function renderUpgradePanel(tower) {
  if (!tower) return;
  const stats = { dmg:tower.dmg, atkSpeed:tower.atkSpeed.toFixed(2), range:Math.round(tower.range), proj:tower.projectiles };
  document.getElementById('upg-panel-title').textContent = `${tower.td.icon} ${tower.td.name}`;
  document.getElementById('upg-panel-stats').innerHTML = `
    <div class="upg-stat-row"><span class="upg-stat-label">⚔️ Damage</span><span class="upg-stat-val">${stats.dmg}</span></div>
    <div class="upg-stat-row"><span class="upg-stat-label">⚡ Atk Speed</span><span class="upg-stat-val">${stats.atkSpeed}s</span></div>
    <div class="upg-stat-row"><span class="upg-stat-label">📏 Range</span><span class="upg-stat-val">${stats.range}px</span></div>
    <div class="upg-stat-row"><span class="upg-stat-label">🎯 Projectiles</span><span class="upg-stat-val">×${stats.proj}${tower.piercing?` +${tower.piercing} pierce`:''}</span></div>
    ${tower.td.special ? `<div class="upg-stat-row"><span class="upg-stat-label" style="color:#f0a040;">✨ Special</span><span class="upg-stat-val" style="font-size:9px;color:#8890b0;">${tower.td.special.slice(0,30)}</span></div>` : ''}
  `;

  const paths = document.getElementById('upg-paths');
  paths.innerHTML = '';
  UPGRADE_PATHS.forEach((path, pi) => {
    const currentLvl = tower.upgrades[pi];
    const maxLvl = path.levels.length;
    const nextLvl = path.levels[currentLvl];
    const canAfford = nextLvl && (bs?.gold||0) >= nextLvl.cost;

    const pips = Array.from({length: maxLvl}).map((_,i) => {
      const cls = i < currentLvl ? 'done' : i === currentLvl ? 'current' : '';
      return `<div class="upg-pip ${cls}"></div>`;
    }).join('');

    const pathEl = document.createElement('div');
    pathEl.className = 'upg-path';
    pathEl.innerHTML = `
      <div class="upg-path-title">${path.icon} ${path.name}</div>
      <div class="upg-path-desc">${nextLvl ? nextLvl.desc : '✅ Maxed'}</div>
      <div class="upg-path-progress">${pips}</div>
      ${nextLvl
        ? `<button class="upg-path-btn" ${!canAfford?'disabled':''} onclick="applyTowerUpgrade('${tower.id}',${pi})">
            Upgrade · 💰${nextLvl.cost}
           </button>
           <div class="upg-path-cost">${canAfford ? 'Can afford' : `Need ${nextLvl.cost - (bs?.gold||0)} more gold`}</div>`
        : `<div class="upg-path-cost" style="color:#3ecf8e;">✅ Max level reached</div>`
      }
    `;
    paths.appendChild(pathEl);
  });
}

function applyTowerUpgrade(towerId, pathIdx) {
  if (!bs) return;
  const tower = bs.towers.find(t => String(t.id) === String(towerId));
  if (!tower) return;
  const path = UPGRADE_PATHS[pathIdx];
  const currentLvl = tower.upgrades[pathIdx];
  if (currentLvl >= path.levels.length) return;
  const cost = path.levels[currentLvl].cost;
  if ((bs.gold||0) < cost) { showToast('Not enough gold!'); return; }
  bs.gold -= cost;
  tower.upgrades[pathIdx]++;
  UPGRADE_PATHS.forEach((p, i) => { for (let l=1; l<=tower.upgrades[i]; l++) p.apply(tower, l); });
  renderUpgradePanel(tower);
  updateBattleHUD();
}

function toggleSpeed() {
  if (battleSpeed === 1) battleSpeed = 2;
  else if (battleSpeed === 2) battleSpeed = 4;
  else battleSpeed = 1;
  document.getElementById('hud-speed-btn').textContent = battleSpeed + '×';
}

let enemyIdCounter = 0;
function spawnEnemy(template) {
  const wp = bs.waypoints;
  return {
    id: ++enemyIdCounter,
    type: template.type,
    x: wp[0].x, y: wp[0].y,
    hp: template.hp, maxHp: template.hp,
    speed: template.speed,
    reward: template.reward,
    size: template.size,
    color: template.color,
    spawnOnDeath: template.spawnOnDeath || null,
    wpIdx: 1,
    dist: 0,
    slowTimer: 0,
    isDead: false,
    isReached: false,
  };
}

function spawnChildEnemy(parent, typeKey, count) {
  const t = ENEMY_TYPES[typeKey];
  if (!t) return;
  const stageIdx = CAMPAIGN_STAGES.findIndex(s=>s.id===bs.stageId);
  const waveMult = 1 + (bs.wave-1)*0.14;
  const stageMult = 1 + stageIdx*0.20;
  const mult = stageMult * waveMult;
  for (let i = 0; i < count; i++) {
    bs.enemies.push({
      id: ++enemyIdCounter,
      type: typeKey,
      x: parent.x, y: parent.y,
      hp: Math.round(t.hp * mult), maxHp: Math.round(t.hp * mult),
      speed: t.speed,
      reward: Math.max(1, Math.round(t.reward * 0.5)), 
      size: t.size,
      color: t.color,
      spawnOnDeath: t.spawnOnDeath || null,
      wpIdx: parent.wpIdx,
      dist: parent.dist,
      slowTimer: 0,
      isDead: false,
      isReached: false,
    });
  }
}

function makeProjectile(tower, target, dmg) {
  return {
    id: Math.random(),
    x: tower.x, y: tower.y,
    tx: target.id,
    lastTx: null,
    speed: tower.projectileSpeed || 300,
    dmg,
    color: tower.td.typeBadge?.color || '#fff',
    special: tower.special,
    radius: tower.towerId === 'catapult' ? 6 : 4,
    piercing: tower.piercing || 0,
    maxAoeTargets: tower.td.maxAoeTargets || 99,
    _done: false,
  };
}

// ── MAIN BATTLE LOOP ──
function battleLoop(ts) {
  if (!bs) return;
  if (!bs.lastTime) bs.lastTime = ts;
  const rawDt = Math.min((ts - bs.lastTime) / 1000, 0.1); // seconds, capped
  bs.lastTime = ts;
  const dt = rawDt * battleSpeed;

  if (!bs.gameOver && !bs.victory) {
    updateSpawn(dt);
    updateEnemies(dt);
    updateTowers(dt);
    updateProjectiles(dt);
    updateExplosions(dt);
    checkWaveEnd();
  }

  drawBattle();
  battleRaf = requestAnimationFrame(battleLoop);
}

function stopBattleLoop() {
  if (battleRaf) { cancelAnimationFrame(battleRaf); battleRaf = null; }
}

// ── UPDATE FUNCTIONS ──
function updateSpawn(dt) {
  if (!bs.waveActive || bs.waveSpawnQueue.length === 0) return;
  bs.spawnTimer += dt * 1000;
  while (bs.waveSpawnQueue.length > 0 && bs.spawnTimer >= bs.waveSpawnQueue[0].spawnDelay) {
    const template = bs.waveSpawnQueue.shift();
    bs.enemies.push(spawnEnemy(template));
  }
}

function updateEnemies(dt) {
  bs.enemies.forEach(e => {
    if (e.isDead || e.isReached) return;
    const speed = e.slowTimer > 0 ? e.speed * 0.5 : e.speed;
    if (e.slowTimer > 0) e.slowTimer -= dt * 1000;

    const target = bs.waypoints[e.wpIdx];
    if (!target) { e.isReached = true; bs.lives = Math.max(0, bs.lives-1); return; }

    const dx = target.x - e.x, dy = target.y - e.y;
    const d = Math.sqrt(dx*dx+dy*dy);
    const move = speed * dt;

    if (d <= move) {
      e.x = target.x; e.y = target.y;
      e.wpIdx++;
      if (e.wpIdx >= bs.waypoints.length) { e.isReached = true; bs.lives = Math.max(0,bs.lives-1); }
    } else {
      e.x += (dx/d)*move;
      e.y += (dy/d)*move;
    }
    e.dist += move;
  });

  bs.enemies = bs.enemies.filter(e => !e.isDead && !e.isReached);

  if (bs.lives <= 0) {
    bs.gameOver = true;
    showResultScreen(false);
  }
}

function updateTowers(dt) {
  bs.towers.forEach(t => {
    t.cooldown -= dt;
    if (t.cooldown > 0) return;

    // Find targets in range, sorted by furthest along path
    const inRange = bs.enemies
      .filter(e => dist(t.x, t.y, e.x, e.y) <= t.range)
      .sort((a,b) => b.dist - a.dist);

    if (inRange.length === 0) return;

    // Inferno: hit all in range
    if (t.towerId === 'inferno') {
      inRange.slice(0,6).forEach(e => {
        e.hp -= t.dmg;
        if (e.hp <= 0) killEnemy(e, t);
      });
      t.cooldown = t.atkSpeed;
      return;
    }

    // Multi-shot: hit up to `projectiles` targets
    const targets = inRange.slice(0, t.projectiles);
    targets.forEach(target => {
      bs.projectiles.push(makeProjectile(t, target, t.dmg));
    });
    t.cooldown = t.atkSpeed;
  });
}

function updateProjectiles(dt) {
  bs.projectiles.forEach(p => {
    // Track target position — if dead use last known pos
    const target = bs.enemies.find(e => e.id === p.tx);
    if (!target && !p.lastTx) { p._done = true; return; }
    if (target) { p.lastTx = { x: target.x, y: target.y }; }
    const tx = target ? target.x : p.lastTx.x;
    const ty = target ? target.y : p.lastTx.y;

    const dx = tx - p.x, dy = ty - p.y;
    const d = Math.sqrt(dx*dx+dy*dy);
    const move = p.speed * dt;

    if (d <= move + p.radius) {
      // Hit impact point
      const impactX = tx, impactY = ty;

      if (p.special === 'catapult') {
        // AoE: damage up to maxAoeTargets enemies within 1 tile radius
        const aoeR = bs.tw * 1.0;
        const maxHit = p.maxAoeTargets || 5;
        const inAoe = bs.enemies
          .filter(e => dist(impactX, impactY, e.x, e.y) < aoeR)
          .sort((a,b) => dist(impactX,impactY,a.x,a.y) - dist(impactX,impactY,b.x,b.y))
          .slice(0, maxHit);
        inAoe.forEach(e => {
          e.hp -= p.dmg;
          if (e.hp <= 0) killEnemy(e, null);
        });
        // Spawn explosion animation
        bs.explosions.push({ x: impactX, y: impactY, r: aoeR * 0.2, maxR: aoeR, age: 0, maxAge: 0.5 });
      } else if (p.special === 'inferno') {
        // already handled in updateTowers
      } else {
        // Normal hit
        if (target) {
          target.hp -= p.dmg;
          if (p.special === 'ice_tower') target.slowTimer = 2000;
          if (target.hp <= 0) killEnemy(target, null);
          // Pierce: continue as new projectile toward next enemy
          if (p.piercing > 0 && target) {
            const nextTarget = bs.enemies
              .filter(e => !e.isDead && e.id !== target.id && dist(p.x,p.y,e.x,e.y) <= (bs.tw*3))
              .sort((a,b)=>b.dist-a.dist)[0];
            if (nextTarget) {
              bs.projectiles.push({
                ...p, id: Math.random(), x: impactX, y: impactY,
                tx: nextTarget.id, piercing: p.piercing - 1, _done: false,
              });
            }
          }
        }
      }
      p._done = true;
    } else {
      p.x += (dx/d)*move;
      p.y += (dy/d)*move;
    }
  });
  bs.projectiles = bs.projectiles.filter(p => !p._done);
}

function killEnemy(e, tower) {
  if (e.isDead) return;
  e.isDead = true;
  bs.gold += e.reward;
  bs.waveEnemiesLeft = Math.max(0, bs.waveEnemiesLeft - 1);
  // Spawn children (Blood TD chain spawn)
  if (e.spawnOnDeath) {
    spawnChildEnemy(e, e.spawnOnDeath.type, e.spawnOnDeath.count);
  }
  updateBattleHUD();
  renderShop();
}

function updateExplosions(dt) {
  if (!bs.explosions) bs.explosions = [];
  bs.explosions.forEach(ex => { ex.age += dt; });
  bs.explosions = bs.explosions.filter(ex => ex.age < ex.maxAge);
}

function checkWaveEnd() {
  if (!bs.waveActive) return;
  if (bs.enemies.length === 0 && bs.waveSpawnQueue.length === 0) {
    bs.waveActive = false;
    const bonus = 20 + bs.wave * 8;
    bs.gold += bonus;
    updateBattleHUD();

    if (bs.wave >= 10) {
      bs.victory = true;
      setTimeout(()=>showResultScreen(true), 800);
    } else if (bs.wavesQueued > 0) {
      bs.wavesQueued--;
      setTimeout(launchWave, 300);
    } else {
      // Wave cleared — wave button is always enabled so no need to re-enable
      showToast(`Wave ${bs.wave} cleared! +💰${bonus}`);
    }
    renderShop(); // refresh affordability
  }
}

function drawBattle() {
  const canvas = document.getElementById('battle-canvas');
  if (!canvas || !bs) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Background
  ctx.fillStyle = bs.mapDef.bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  for (let c=0;c<=bs.COLS;c++) { ctx.beginPath();ctx.moveTo(c*bs.tw,0);ctx.lineTo(c*bs.tw,h);ctx.stroke(); }
  for (let r=0;r<=bs.ROWS;r++) { ctx.beginPath();ctx.moveTo(0,r*bs.th);ctx.lineTo(w,r*bs.th);ctx.stroke(); }

  drawPath(ctx);
  bs.towers.forEach(t => drawTower(ctx, t));
  bs.enemies.forEach(e => drawEnemy(ctx, e));
  bs.projectiles.forEach(p => drawProjectile(ctx, p));
  if (bs.explosions) bs.explosions.forEach(ex => drawExplosion(ctx, ex));
  if (placingTower) drawPlacementPreview(ctx);

  // Map border — placement boundary
  ctx.save();
  ctx.strokeStyle = 'rgba(200,200,255,0.10)';
  ctx.lineWidth = 2;
  ctx.strokeRect(MAP_BORDER, MAP_BORDER, w - MAP_BORDER*2, h - MAP_BORDER*2);
  ctx.restore();

  // Enemy legend (bottom-left corner)
  const activeTypes = [...new Set(bs.enemies.map(e=>e.type))];
  if (activeTypes.length > 0) {
    let ly = h - 12;
    const legendItems = activeTypes.map(t => ({ key:t, ...ENEMY_TYPES[t] })).filter(Boolean);
    legendItems.reverse().forEach(et => {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(8, ly - 13, 110, 15);
      ctx.beginPath();
      ctx.arc(18, ly - 5, 5, 0, Math.PI*2);
      ctx.fillStyle = et.color;
      ctx.fill();
      ctx.fillStyle = '#d4d8f0';
      ctx.font = '9px Inter';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(et.name, 27, ly - 5);
      if (et.spawnOnDeath) {
        ctx.fillStyle = '#8890b0';
        ctx.fillText(`→ ${et.spawnOnDeath.count}× ${et.spawnOnDeath.type}`, 27, ly - 5 + 10);
      }
      ly -= 18;
    });
  }
}

function drawPath(ctx) {
  const wps = bs.waypoints;
  const roadW = bs.tw * bs.mapDef.pathWidth; // narrow — enemy nearly fills it
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Outer border/shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = roadW + 6;
  ctx.beginPath();
  ctx.moveTo(wps[0].x, wps[0].y);
  wps.slice(1).forEach(wp => ctx.lineTo(wp.x, wp.y));
  ctx.stroke();

  // Path base
  ctx.strokeStyle = bs.mapDef.pathColor;
  ctx.lineWidth = roadW;
  ctx.beginPath();
  ctx.moveTo(wps[0].x, wps[0].y);
  wps.slice(1).forEach(wp => ctx.lineTo(wp.x, wp.y));
  ctx.stroke();

  // Path top highlight
  ctx.strokeStyle = adjustColor(bs.mapDef.pathColor, 25);
  ctx.lineWidth = roadW * 0.55;
  ctx.beginPath();
  ctx.moveTo(wps[0].x, wps[0].y);
  wps.slice(1).forEach(wp => ctx.lineTo(wp.x, wp.y));
  ctx.stroke();

  // Edge lines (define road boundary)
  ctx.strokeStyle = adjustColor(bs.mapDef.pathColor, -20);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  // We can't easily draw offset paths in canvas, so just a subtle darker outline
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = roadW + 2;
  // Not a full redraw — skip, the shadow serves as border

  ctx.setLineDash([]);

  // Start marker
  ctx.fillStyle = '#3ecf8e';
  ctx.shadowColor = '#3ecf8e'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(wps[0].x, wps[0].y, 13, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Inter';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('▶', wps[0].x, wps[0].y);

  // End marker
  const last = wps[wps.length-1];
  ctx.fillStyle = '#f55a5a';
  ctx.shadowColor = '#f55a5a'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(last.x, last.y, 13, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.font = 'bold 8px Inter';
  ctx.fillText('■', last.x, last.y);

  ctx.restore();
}

function drawTower(ctx, t) {
  ctx.save();
  const isSelected = selectedTowerId === t.id;

  // Range circle — only shown when selected
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.range, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(240,192,64,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4,4]);
    ctx.stroke();
    ctx.fillStyle = 'rgba(240,192,64,0.06)';
    ctx.fill();
    ctx.setLineDash([]);
  }

  const clr = t.td.color || '#4a8fff';

  // Selection highlight ring
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r + 4, 0, Math.PI*2);
    ctx.strokeStyle = '#f0c040';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Tower circle base
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.r, 0, Math.PI*2);
  ctx.fillStyle = clr + '44';
  ctx.fill();
  ctx.strokeStyle = clr;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Icon emoji
  ctx.font = `${Math.round(t.r * 1.1)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.td.icon, t.x, t.y + 1);

  // Level badge
  ctx.fillStyle = 'rgba(14,15,20,0.85)';
  ctx.beginPath();
  ctx.arc(t.x + t.r - 5, t.y - t.r + 5, 7, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#f0c040';
  ctx.font = 'bold 7px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.level, t.x + t.r - 5, t.y - t.r + 5);

  ctx.restore();
}

function drawEnemy(ctx, e) {
  ctx.save();

  const isBoss = e.type === 'boss';

  // Boss glow
  if (isBoss) {
    ctx.shadowColor = '#f55a5a';
    ctx.shadowBlur = 20;
  } else if (e.slowTimer > 0) {
    ctx.shadowColor = '#4a8fff';
    ctx.shadowBlur = 8;
  }

  // Body circle
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.size, 0, Math.PI*2);
  ctx.fillStyle = e.color;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Outline — darker version of fill
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = isBoss ? 3 : 1.5;
  ctx.stroke();

  // Inner highlight
  ctx.beginPath();
  ctx.arc(e.x - e.size*0.25, e.y - e.size*0.25, e.size*0.35, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();

  // Slow indicator — blue ring
  if (e.slowTimer > 0) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size + 2, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(74,143,255,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // HP bar — only show if below 100%
  if (e.hp < e.maxHp) {
    const barW = e.size * 2.2;
    const barH = 3;
    const bx = e.x - barW/2, by = e.y - e.size - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx-1, by-1, barW+2, barH+2);
    ctx.fillStyle = '#222';
    ctx.fillRect(bx, by, barW, barH);
    const hp = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = hp > 0.5 ? '#3ecf8e' : hp > 0.25 ? '#f0a040' : '#f55a5a';
    ctx.fillRect(bx, by, barW * hp, barH);
  }

  ctx.restore();
}

function drawProjectile(ctx, p) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
  ctx.fillStyle = p.color || '#fff';
  ctx.shadowColor = p.color || '#fff';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.restore();
}

function drawExplosion(ctx, ex) {
  const progress = ex.age / ex.maxAge;
  const maxR = ex.maxR || ex.r;
  const currentR = maxR * Math.min(1, progress * 2.5); // expand quickly
  const alpha = 1 - progress;
  ctx.save();
  ctx.shadowBlur = 0;
  // Outer ring
  ctx.beginPath();
  ctx.arc(ex.x, ex.y, currentR, 0, Math.PI*2);
  ctx.strokeStyle = `rgba(255,160,40,${alpha * 0.9})`;
  ctx.lineWidth = 3 * (1 - progress * 0.5);
  ctx.stroke();
  // Inner fill
  ctx.beginPath();
  ctx.arc(ex.x, ex.y, currentR * 0.65, 0, Math.PI*2);
  ctx.fillStyle = `rgba(255,80,10,${alpha * 0.4})`;
  ctx.fill();
  // Core bright flash
  if (progress < 0.25) {
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, currentR * 0.3, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,255,180,${(0.25-progress)/0.25 * 0.9})`;
    ctx.fill();
  }
  ctx.restore();
}

function drawPlacementPreview(ctx) {
  const x = mousePos.x, y = mousePos.y; // already grid-snapped
  const half = TOWER_FOOTPRINT / 2;
  const canPlace = canPlaceTowerAt(x, y);
  const rangeRadius = placingTower ? placingTower.td.baseStats.range * bs.tw : 0;

  ctx.save();

  // Range preview circle — only show if placement is valid
  if (canPlace && rangeRadius > 0) {
    ctx.beginPath();
    ctx.arc(x, y, rangeRadius, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(240,192,64,0.07)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,192,64,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4,4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Tower footprint square — snaps to grid visually
  ctx.fillStyle = canPlace ? 'rgba(240,192,64,0.18)' : 'rgba(245,90,90,0.22)';
  ctx.fillRect(x - half, y - half, TOWER_FOOTPRINT, TOWER_FOOTPRINT);
  ctx.strokeStyle = canPlace ? '#f0c040' : '#f55a5a';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3,3]);
  ctx.strokeRect(x - half, y - half, TOWER_FOOTPRINT, TOWER_FOOTPRINT);
  ctx.setLineDash([]);

  // Tower circle inside the square
  const r = TOWER_RADIUS_PX;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = canPlace ? 'rgba(240,192,64,0.3)' : 'rgba(245,90,90,0.35)';
  ctx.fill();
  ctx.strokeStyle = canPlace ? '#f0c040' : '#f55a5a';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.stroke();

  if (placingTower) {
    ctx.font = `${r * 1.1}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(placingTower.td.icon, x, y + 1);
  }

  ctx.restore();
}

// ── RESULT SCREEN ──
async function showResultScreen(won) {
  const overlay = document.getElementById('result-overlay');
  const box = document.getElementById('result-box');
  const stage = bs.stageId;
  const goldEarned = bs.gold;
  let serverReward = {};

  if (currentBattleId) {
    try {
      const result = await serverRpc('idw_submit_battle_result', {
        p_battle_id: currentBattleId,
        p_won: !!won,
        p_waves: bs.wave || 0,
        p_lives: bs.lives || 0,
        p_client_gold: bs.gold || 0
      });
      serverReward = result?.reward || {};
      applyServerPayload(result?.state || result);
    } catch(e) {
      won = false;
    } finally {
      currentBattleId = null;
    }
  }

  const rewardText = Object.entries(serverReward).map(([k,v]) => `${v} ${k}`).join(' + ');
  box.innerHTML = `
    <div class="result-title ${won?'victory':'defeat'}">${won?'🏆 Victory!':'💀 Defeated'}</div>
    <div class="result-sub">${won?`Stage ${stage} complete!`:`Your base was overrun on Wave ${bs.wave}`}</div>
    <div style="font-size:24px;font-weight:700;color:#f0c040;margin-bottom:1.5rem;">${rewardText || 'No reward'}</div>
    <div style="font-size:13px;color:#555e80;margin-bottom:1.5rem;">Reward/progress was validated by Supabase RPC.</div>
    <div>
      <button class="result-btn" onclick="closeBattleScreen()">← Back to Map</button>
      ${won ? `<button class="result-btn" onclick="replayBattle()">🔄 Replay</button>` : `<button class="result-btn" onclick="replayBattle()">↩ Retry</button>`}
    </div>`;
  overlay.style.display = 'flex';
}

function replayBattle() {
  document.getElementById('result-overlay').style.display = 'none';
  openBattleSetup(battleSetupStageId);
}

function exitBattle() {
  stopBattleLoop();
  closeBattleScreen();
}

function updateBattleHUD() {
  if (!bs) return;
  document.getElementById('hud-lives').textContent = bs.lives;
  document.getElementById('hud-wave').textContent  = bs.wave;
  document.getElementById('hud-gold').textContent  = bs.gold;
}

// ── COLOR HELPER ──
function adjustColor(hex, amount) {
  const c = parseInt(hex.slice(1),16);
  const r = Math.min(255, ((c>>16)&255)+amount);
  const g = Math.min(255, ((c>>8)&255)+amount);
  const b = Math.min(255, (c&255)+amount);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

