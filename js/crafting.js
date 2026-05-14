// ═══════════════════════════════════════════════
// TOWER DEFINITIONS
// ═══════════════════════════════════════════════
const TOWER_DEFS = [
  {
    id:'archer', name:'Archer Post', icon:'🏹', color:'#c8842a',
    unlockLevel:0,
    desc:'A reliable single-target ranged tower that fires quickly.',
    type:'Single Target',
    typeBadge:{bg:'rgba(74,143,255,0.15)',color:'#4a8fff',border:'#2a5fcc'},
    baseStats:{dmg:25,atkSpeed:1.2,range:2.5,projectiles:1},
    special:null,
    cost:{wood:80, fiber:40},
    upgPctPerLevel:0.12,
    upgCostMult:0.5,
  },
  {
    id:'catapult', name:'Catapult', icon:'💣', color:'#8890b0',
    unlockLevel:0,
    desc:'Slow-firing boulder launcher with AoE splash. Hits up to 5 enemies per shot.',
    type:'AoE',
    typeBadge:{bg:'rgba(245,90,90,0.15)',color:'#f55a5a',border:'#aa2020'},
    baseStats:{dmg:40,atkSpeed:5.0,range:2.2,projectiles:1},
    special:'AoE splash — up to 5 enemies hit · 1-tile radius on impact',
    cost:{stone:120, wood:60},
    upgPctPerLevel:0.12,
    upgCostMult:0.5,
    maxAoeTargets:5,
  },
  {
    id:'crossbow', name:'Crossbow Turret', icon:'🎯', color:'#6cbf6c',
    unlockLevel:10,
    desc:'A high-precision turret that fires 3 bolts simultaneously.',
    type:'Multi-Shot',
    typeBadge:{bg:'rgba(108,191,108,0.15)',color:'#6cbf6c',border:'#2a7a2a'},
    baseStats:{dmg:20,atkSpeed:1.8,range:2.5,projectiles:3},
    special:'Fires 3 bolts per shot — each can hit a different target',
    cost:{wood:150, fiber:80, ore:40},
    upgPctPerLevel:0.10,
    upgCostMult:0.5,
  },
  {
    id:'ice_tower', name:'Frost Spire', icon:'🧊', color:'#4a8fff',
    unlockLevel:10,
    desc:'Fires ice shards that slow enemies significantly.',
    type:'Slow',
    typeBadge:{bg:'rgba(74,143,255,0.15)',color:'#4a8fff',border:'#2a5fcc'},
    baseStats:{dmg:15,atkSpeed:1.5,range:2.0,projectiles:1},
    special:'Slows hit enemies by 50% for 2 seconds',
    cost:{stone:100, fiber:60, leather:40},
    upgPctPerLevel:0.10,
    upgCostMult:0.5,
  },
  {
    id:'sniper', name:'Sniper Tower', icon:'🔭', color:'#f0c040',
    unlockLevel:20,
    desc:'Extreme range single-target tower with massive damage.',
    type:'Long Range',
    typeBadge:{bg:'rgba(240,192,64,0.15)',color:'#f0c040',border:'#c89a20'},
    baseStats:{dmg:150,atkSpeed:4.0,range:4.5,projectiles:1},
    special:'Ignores 30% of enemy armor',
    cost:{ore:200, leather:100, wood:80},
    upgPctPerLevel:0.10,
    upgCostMult:0.5,
  },
  {
    id:'inferno', name:'Inferno Core', icon:'🔥', color:'#f0a040',
    unlockLevel:40,
    desc:'A devastating AoE tower that continuously burns all nearby enemies.',
    type:'AoE Burn',
    typeBadge:{bg:'rgba(240,160,64,0.15)',color:'#f0a040',border:'#7a4a10'},
    baseStats:{dmg:40,atkSpeed:0.8,range:1.8,projectiles:1},
    special:'Burns all enemies in range simultaneously — no targeting needed',
    cost:{ore:350, stone:200, leather:150, fiber:100},
    upgPctPerLevel:0.15,
    upgCostMult:0.5,
  },
];

function towerStatsAtLevel(td, level) {
  const m = 1 + (level - 1) * td.upgPctPerLevel;
  return {
    dmg: Math.round(td.baseStats.dmg * m),
    atkSpeed: (td.baseStats.atkSpeed / Math.pow(1 + td.upgPctPerLevel * 0.3, level-1)).toFixed(2),
    range: td.baseStats.range,
    projectiles: td.baseStats.projectiles,
  };
}

function towerDisenchantValue(td) {
  const result = {};
  Object.entries(td.cost).forEach(([k,v]) => { result[k] = Math.floor(v * 0.5); });
  return result;
}

function towerUpgradeCost(td, currentLevel) {
  const result = {};
  Object.entries(td.cost).forEach(([k,v]) => {
    result[k] = Math.round(v * td.upgCostMult * Math.pow(1.4, currentLevel - 1));
  });
  return result;
}

function buildCraftingPanel() {
  renderTowerGrid();
}

function renderTowerGrid() {
  const grid = document.getElementById('tower-grid');
  if (!grid) return;
  grid.innerHTML = '';
  TOWER_DEFS.forEach(td => {
    const locked = playerLevel < td.unlockLevel;
    const canAfford = !locked && Object.entries(td.cost).every(([k,v]) => (resources[k]||0) >= v);
    const card = document.createElement('div');
    card.className = 'tower-card' + (locked ? ' tower-locked' : '');
    card.onclick = () => openTowerModal(td.id);

    const costChips = Object.entries(td.cost).map(([k,v]) => {
      const def = RESOURCE_DEFS.find(r=>r.id===k);
      const ok = !locked && (resources[k]||0) >= v;
      return `<span class="tower-cost-chip ${ok?'ok':'bad'}">${def?.icon||''} ${v.toLocaleString()}</span>`;
    }).join('');

    const statsHtml = `
      <span class="tower-stat">⚔️ <span>${td.baseStats.dmg}</span></span>
      <span class="tower-stat">⚡ <span>${td.baseStats.atkSpeed}s</span></span>
      <span class="tower-stat">📏 <span>${td.baseStats.range}</span></span>
      <span class="tower-stat">🎯 <span>×${td.baseStats.projectiles}</span></span>
    `;

    card.innerHTML = `
      <div class="tower-icon-wrap" style="background:${td.color}22;border:1px solid ${td.color}44;">${td.icon}</div>
      <div class="tower-info">
        <div class="tower-name">${td.name}
          <span class="tower-type-badge" style="background:${td.typeBadge.bg};color:${td.typeBadge.color};border-color:${td.typeBadge.border};">${td.type}</span>
        </div>
        <div class="tower-stats">${statsHtml}</div>
        <div class="tower-cost-row">${costChips}</div>
      </div>
      <div class="tower-right">
        ${locked
          ? `<div class="tower-lock-badge">🔒 Lv ${td.unlockLevel}</div>`
          : `<button class="tower-craft-btn" ${!canAfford?'disabled':''} onclick="event.stopPropagation();craftTower('${td.id}')">Craft</button>`
        }
      </div>
    `;
    grid.appendChild(card);
  });
}

function openTowerModal(towerId) {
  const td = TOWER_DEFS.find(t => t.id === towerId);
  if (!td) return;
  const locked = playerLevel < td.unlockLevel;
  const stats = td.baseStats;
  const canAfford = !locked && Object.entries(td.cost).every(([k,v]) => (resources[k]||0) >= v);
  const slots = totalArmorySlots();
  const usedSlots = armoryTowers.filter(Boolean).length;
  const hasSlot = usedSlots < slots;

  const costRows = Object.entries(td.cost).map(([k,v]) => {
    const def = RESOURCE_DEFS.find(r=>r.id===k);
    const have = Math.floor(resources[k]||0);
    const ok = have >= v;
    return `<div class="info-row"><span class="info-row-label">${def?.icon||''} ${def?.label||k}</span><span style="color:${ok?'var(--green)':'var(--red)'};">${have.toLocaleString()} / ${v.toLocaleString()}</span></div>`;
  }).join('');

  document.getElementById('item-modal-content').innerHTML = `
    <div class="bmodal-header">
      <div>
        <span class="bmodal-icon">${td.icon}</span>
        <div class="bmodal-title">${td.name}
          <span class="tower-type-badge" style="background:${td.typeBadge.bg};color:${td.typeBadge.color};border-color:${td.typeBadge.border};font-size:11px;">${td.type}</span>
        </div>
        <div class="bmodal-sub">${td.desc}</div>
      </div>
      <button class="bmodal-close" onclick="closeItemModal()">✕</button>
    </div>
    <div class="bmodal-stat-grid">
      <div class="bmodal-stat"><div class="bmodal-stat-label">⚔️ Damage</div><div class="bmodal-stat-value">${stats.dmg}</div></div>
      <div class="bmodal-stat"><div class="bmodal-stat-label">⚡ Atk Speed</div><div class="bmodal-stat-value">${stats.atkSpeed}s</div></div>
      <div class="bmodal-stat"><div class="bmodal-stat-label">📏 Range</div><div class="bmodal-stat-value">${stats.range} tiles</div></div>
      <div class="bmodal-stat"><div class="bmodal-stat-label">🎯 Projectiles</div><div class="bmodal-stat-value">×${stats.projectiles}</div></div>
    </div>
    ${td.special ? `<div style="background:rgba(240,160,64,0.1);border:1px solid rgba(240,160,64,0.3);border-radius:9px;padding:0.7rem 1rem;font-size:12px;color:var(--orange);margin-bottom:1rem;">⚡ ${td.special}</div>` : ''}
    <div class="bmodal-section">
      <div class="bmodal-section-title">Craft Cost</div>
      ${costRows}
    </div>
    ${!hasSlot ? `<div style="background:rgba(245,90,90,0.08);border:1px solid rgba(245,90,90,0.25);border-radius:8px;padding:0.65rem 0.9rem;font-size:12px;color:var(--red);margin-bottom:0.75rem;">⚠️ No empty Armory slots — disenchant a tower first.</div>` : ''}
    ${locked ? `<div style="font-size:13px;color:var(--red);text-align:center;padding:0.75rem;">Requires account Level ${td.unlockLevel}</div>` : ''}
    <div class="bmodal-btns">
      <button class="bmodal-btn upgrade" ${(!canAfford||!hasSlot||locked)?'disabled':''} onclick="craftTower('${td.id}');closeItemModal();">
        🔨 Craft ${td.name}
      </button>
    </div>
  `;
  document.getElementById('item-modal').classList.add('open');
}

async function craftTower(towerId) {
  try { await serverRpc('idw_craft_tower', {p_tower_id:towerId}); await refreshFromServer(); showToast('Tower crafted by server'); }
  catch(e){ /* toast shown by serverRpc */ }
}

function switchCraftTab(name) {
  ['towers','enchants'].forEach(t => {
    const p = document.getElementById('craft-' + t);
    const btn = document.getElementById('crafttab-' + t);
    if (p) p.classList.toggle('active', t === name);
    if (btn) btn.classList.toggle('active', t === name);
  });
}

