// ═══════════════════════════════════════════════
// RESEARCH TREE DEFINITIONS
// ═══════════════════════════════════════════════
const RESEARCH_DEFS = [
  // ── PRODUCTION TREE ──────────────────────────
  { id:'prod1', name:'Sharpened Axes',    icon:'🪓', category:'production',
    desc:'Better logging tools increase output from all wood nodes.',
    effect:'+8% Wood Production',      bonus:{type:'res_prod',resId:'wood',pct:0.08},
    requires:[], cost:{wood:200,fiber:100},     durationMs:5*60*1000 },
  { id:'prod2', name:'Iron Drills',       icon:'⚙️', category:'production',
    desc:'Reinforced drill bits double ore extraction efficiency.',
    effect:'+8% Ore Production',       bonus:{type:'res_prod',resId:'ore',pct:0.08},
    requires:['prod1'], cost:{wood:300,ore:150},       durationMs:12*60*1000 },
  { id:'prod3', name:'Fiber Looms',       icon:'🌀', category:'production',
    desc:'Efficient looms process fiber much faster.',
    effect:'+10% Fiber Production',    bonus:{type:'res_prod',resId:'fiber',pct:0.10},
    requires:['prod2'], cost:{fiber:300,stone:150},    durationMs:25*60*1000 },
  { id:'prod4', name:'Tanning Techniques',icon:'📜', category:'production',
    desc:'Advanced tanning doubles leather yield per hide.',
    effect:'+10% Leather Production',  bonus:{type:'res_prod',resId:'leather',pct:0.10},
    requires:['prod3'], cost:{leather:250,ore:200},    durationMs:45*60*1000 },
  { id:'prod5', name:'Masonry Guild',     icon:'🏛️', category:'production',
    desc:'Organized quarrying guilds dramatically improve stone output.',
    effect:'+12% Stone Production',    bonus:{type:'res_prod',resId:'stone',pct:0.12},
    requires:['prod4'], cost:{stone:400,wood:300},     durationMs:90*60*1000 },
  { id:'prod6', name:'Supply Chains',     icon:'🔗', category:'production',
    desc:'Coordinated logistics boost all resource production.',
    effect:'+5% All Production',       bonus:{type:'all_prod',pct:0.05},
    requires:['prod5'], cost:{wood:500,stone:500,fiber:300,leather:300,ore:300}, durationMs:3*60*60*1000 },

  // ── COMBAT TREE ──────────────────────────────
  { id:'comb1', name:'Sword Tempering',   icon:'⚔️', category:'combat',
    desc:'Better heat treatment makes blades far sharper.',
    effect:'+10% Attack Power',        bonus:{type:'attack',pct:0.10},
    requires:[], cost:{ore:200,wood:100},       durationMs:8*60*1000 },
  { id:'comb2', name:'Leather Armour',    icon:'🛡️', category:'combat',
    desc:'Toughened leather padding reduces damage taken.',
    effect:'+10% Defense',             bonus:{type:'defense',pct:0.10},
    requires:['comb1'], cost:{leather:200,fiber:150},  durationMs:18*60*1000 },
  { id:'comb3', name:'War Training',      icon:'🎯', category:'combat',
    desc:'Drilled soldiers hit harder and more accurately.',
    effect:'+12% Attack Power',        bonus:{type:'attack',pct:0.12},
    requires:['comb2'], cost:{ore:300,stone:200},      durationMs:35*60*1000 },
  { id:'comb4', name:'Stone Fortifications',icon:'🏯', category:'combat',
    desc:'Reinforced walls greatly increase troop survivability. Unlocks +2 Armory slots.',
    effect:'+15% Defense · +2 Armory Slots', bonus:{type:'defense',pct:0.15},
    requires:['comb3'], cost:{stone:500,ore:200},      durationMs:75*60*1000 },
  { id:'comb5', name:'Elite Warriors',    icon:'🗡️', category:'combat',
    desc:'A standing army of elite troops ready for battle. Unlocks +3 Armory slots.',
    effect:'+20% Max HP · +3 Armory Slots',  bonus:{type:'hp',pct:0.20},
    requires:['comb4'], cost:{ore:400,leather:400,wood:300}, durationMs:2*60*60*1000 },
  { id:'comb6', name:'War Tactics',       icon:'📯', category:'combat',
    desc:'Advanced battlefield strategy multiplies combat effectiveness. Unlocks +5 Armory slots.',
    effect:'+10% All Combat · +5 Armory Slots', bonus:{type:'all_combat',pct:0.10},
    requires:['comb5'], cost:{ore:600,stone:400,leather:500}, durationMs:4*60*60*1000 },

  // ── ECONOMY TREE ─────────────────────────────
  { id:'econ1', name:'Trading Routes',    icon:'🗺️', category:'economy',
    desc:'Established trade routes increase gold income from sales.',
    effect:'+15% Crafting Speed',      bonus:{type:'craft_speed',pct:0.15},
    requires:[], cost:{wood:300,stone:100},     durationMs:15*60*1000 },
  { id:'econ2', name:'Market Expansion',  icon:'🏪', category:'economy',
    desc:'A larger market hub attracts more merchants.',
    effect:'+20% Crafting Speed',      bonus:{type:'craft_speed',pct:0.20},
    requires:['econ1'], cost:{wood:400,stone:300,fiber:200}, durationMs:40*60*1000 },
  { id:'econ3', name:'Storage Vaults',    icon:'🏦', category:'economy',
    desc:'Reinforced vaults increase the storage cap of all resources.',
    effect:'+25% Storage Capacity',    bonus:{type:'storage',pct:0.25},
    requires:['econ2'], cost:{stone:600,wood:400},     durationMs:80*60*1000 },
  { id:'econ4', name:'Resource Surplus',  icon:'📦', category:'economy',
    desc:'Surplus resource planning optimizes all production lines.',
    effect:'+8% All Production',       bonus:{type:'all_prod',pct:0.08},
    requires:['econ3'], cost:{wood:500,stone:500,fiber:500,leather:300,ore:300}, durationMs:3*60*60*1000 },

  // ── ADVANCED TREE ────────────────────────────
  { id:'adv1',  name:'Arcane Metallurgy', icon:'✨', category:'advanced',
    desc:'Infuse metals with arcane energy for superior results.',
    effect:'+15% Ore & Leather Prod',  bonus:{type:'res_prod_multi',resIds:['ore','leather'],pct:0.15},
    requires:['prod6','comb3'], cost:{ore:500,leather:400},    durationMs:5*60*60*1000 },
  { id:'adv2',  name:'Ancient Blueprints',icon:'🗂️', category:'advanced',
    desc:'Recovered schematics unlock long-forgotten construction methods.',
    effect:'+20% Research Speed',      bonus:{type:'research_speed',pct:0.20},
    requires:['adv1'], cost:{stone:600,fiber:500,ore:400},     durationMs:8*60*60*1000 },
  { id:'adv3',  name:'Golem Workforce',   icon:'🤖', category:'advanced',
    desc:'Stone golems work tirelessly, boosting all resource output.',
    effect:'+15% All Production',      bonus:{type:'all_prod',pct:0.15},
    requires:['adv2','econ4'], cost:{stone:800,ore:600,wood:600}, durationMs:12*60*60*1000 },
  { id:'adv4',  name:'Kingdom Mastery',   icon:'👑', category:'advanced',
    desc:'Total mastery of the kingdom grants power across all domains.',
    effect:'+10% Everything',          bonus:{type:'everything',pct:0.10},
    requires:['adv3','comb6'], cost:{wood:1000,stone:1000,fiber:800,leather:800,ore:800}, durationMs:24*60*60*1000 },
];

const RESEARCH_CATEGORIES = [
  { id:'production', name:'Production',  icon:'🌾', desc:'Boost resource output' },
  { id:'combat',     name:'Combat',      icon:'⚔️', desc:'Strengthen your forces' },
  { id:'economy',    name:'Economy',     icon:'💰', desc:'Improve efficiency & storage' },
  { id:'advanced',   name:'Advanced',    icon:'✨', desc:'Powerful late-game upgrades' },
];

const researchState = {};
RESEARCH_DEFS.forEach(r => {
  researchState[r.id] = { done:false, researching:false, startMs:0, durationMs:0 };
});

let activeResearchId = null;

function getResearchBonuses() {
  const b = { prod:{}, attack:0, defense:0, hp:0, craft_speed:0, research_speed:0, storage:0, all_prod:0, all_combat:0 };
  RESOURCE_DEFS.forEach(r => { b.prod[r.id] = 0; });
  RESEARCH_DEFS.forEach(rd => {
    if (!researchState[rd.id]?.done) return;
    const bx = rd.bonus;
    if (bx.type === 'res_prod')        b.prod[bx.resId]   = (b.prod[bx.resId]||0) + bx.pct;
    if (bx.type === 'res_prod_multi')  bx.resIds.forEach(id => { b.prod[id] = (b.prod[id]||0) + bx.pct; });
    if (bx.type === 'attack')          b.attack           += bx.pct;
    if (bx.type === 'defense')         b.defense          += bx.pct;
    if (bx.type === 'hp')              b.hp               += bx.pct;
    if (bx.type === 'craft_speed')     b.craft_speed      += bx.pct;
    if (bx.type === 'research_speed')  b.research_speed   += bx.pct;
    if (bx.type === 'storage')         b.storage          += bx.pct;
    if (bx.type === 'all_prod')        b.all_prod         += bx.pct;
    if (bx.type === 'all_combat')      b.all_combat       += bx.pct;
    if (bx.type === 'everything') {
      Object.keys(b.prod).forEach(id => { b.prod[id] += bx.pct; });
      b.attack += bx.pct; b.defense += bx.pct; b.hp += bx.pct;
      b.craft_speed += bx.pct; b.research_speed += bx.pct; b.all_prod += bx.pct;
    }
  });
  return b;
}

function researchProdBonus(resId) {
  const b = getResearchBonuses();
  return (b.prod[resId]||0) + b.all_prod;
}

function effectiveResearchMs(rd) {
  const b = getResearchBonuses();
  const speedBonus = b.research_speed + bonusResearch(playerLevel);
  return Math.max(5000, Math.round(rd.durationMs * (1 - speedBonus)));
}

function isResearchUnlocked(rd) {
  return rd.requires.every(id => researchState[id]?.done);
}

function buildResearchPanel() {
  const panel = document.getElementById('research-panel');
  if (!panel) return;
  panel.innerHTML = '';

  RESEARCH_CATEGORIES.forEach(cat => {
    const nodes = RESEARCH_DEFS.filter(r => r.category === cat.id);
    if (!nodes.length) return;

    const catDiv = document.createElement('div');
    catDiv.className = 'research-category';
    catDiv.innerHTML = `
      <div class="research-cat-header">
        <span class="research-cat-icon">${cat.icon}</span>
        <span class="research-cat-name">${cat.name}</span>
        <span class="research-cat-desc">${cat.desc}</span>
      </div>
      <div class="research-tree-row" id="rtree-${cat.id}"></div>
    `;
    panel.appendChild(catDiv);

    const row = document.getElementById('rtree-' + cat.id);
    nodes.forEach((rd, i) => {
      if (i > 0) {
        const prevRd = nodes[i - 1];
        const conn = document.createElement('div');
        const prevDone = researchState[prevRd.id]?.done;
        const prevResearching = researchState[prevRd.id]?.researching;
        conn.className = 'research-connector' + (prevDone ? ' unlocked' : prevResearching ? ' researching' : '');
        conn.id = `rconn-${prevRd.id}-${rd.id}`;
        row.appendChild(conn);
      }
      const card = document.createElement('div');
      card.id = 'rnode-' + rd.id;
      card.onclick = () => openResearchModal(rd.id);
      row.appendChild(card);
    });
  });

  updateResearchCards();
}

function updateResearchCards() {
  const now = Date.now();
  RESEARCH_DEFS.forEach(rd => {
    const card = document.getElementById('rnode-' + rd.id);
    if (!card) return;
    const rs = researchState[rd.id];
    const unlocked = isResearchUnlocked(rd);

    let statusClass = '', badgeClass = '', badgeText = '';
    if (rs.done)          { statusClass='rnode-done';       badgeClass='badge-done';       badgeText='✓ Done'; }
    else if (rs.researching){ statusClass='rnode-researching'; badgeClass='badge-researching'; badgeText='In Progress'; }
    else if (unlocked)    { statusClass='rnode-available';  badgeClass='badge-available';  badgeText='Available'; }
    else                  { statusClass='rnode-locked';     badgeClass='badge-locked';     badgeText='Locked'; }

    card.className = 'rnode ' + statusClass;

    let progHtml = '';
    if (rs.researching) {
      const pct = Math.min(((now - rs.startMs) / rs.durationMs) * 100, 100).toFixed(1);
      const rem = Math.max(0, Math.ceil((rs.durationMs - (now - rs.startMs)) / 1000));
      progHtml = `
        <div class="rnode-time" id="rptimer-${rd.id}">⏱ ${fmtCountdown(rem)}</div>
        <div class="rnode-prog-wrap"><div class="rnode-prog" id="rprog-${rd.id}" style="width:${pct}%"></div></div>
      `;
    } else if (!rs.done) {
      const costs = Object.entries(rd.cost).map(([k,v]) => {
        const icon = RESOURCE_DEFS.find(x=>x.id===k)?.icon||'';
        return `${icon}${v.toLocaleString()}`;
      }).join(' ');
      const dur = effectiveResearchMs(rd);
      progHtml = `
        <div class="rnode-cost">${costs}</div>
        <div class="rnode-time">⏱ ${fmtTime(dur/1000)}</div>
      `;
    }

    card.innerHTML = `
      <div class="rnode-top">
        <span class="rnode-icon">${rd.icon}</span>
        <span class="rnode-status-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="rnode-name">${rd.name}</div>
      <div class="rnode-effect">${rd.effect}</div>
      <div class="rnode-desc">${rd.desc}</div>
      ${progHtml}
    `;

    RESEARCH_DEFS.forEach(rd2 => {
      if (rd2.requires.includes(rd.id) && rd2.category === rd.category) {
        const conn = document.getElementById(`rconn-${rd.id}-${rd2.id}`);
        if (conn) {
          conn.className = 'research-connector' + (rs.done ? ' unlocked' : rs.researching ? ' researching' : '');
        }
      }
    });
  });
}

function updateResearchBars() {
  const now = Date.now();
  RESEARCH_DEFS.forEach(rd => {
    const rs = researchState[rd.id];
    if (!rs.researching) return;

    if (now >= rs.startMs + rs.durationMs) {
      rs.done = true; rs.researching = false; rs.startMs = 0; rs.durationMs = 0;
      activeResearchId = null;
      showToast(`🔬 ${rd.name} research complete!`);
      addXP(30, undefined, undefined);
      updateResearchCards();
      if (rd.category === 'combat') { buildInvGrid('armory-grid', ARMORY_ITEMS, true); updateArmorySlotCount(); }
      scheduleSave();
      if (researchModalId === rd.id) renderResearchModal();
      return;
    }

    const bar = document.getElementById('rprog-' + rd.id);
    if (bar) {
      const pct = Math.min(((now - rs.startMs) / rs.durationMs) * 100, 100);
      bar.style.width = pct.toFixed(2) + '%';
    }
    const timerEl = document.getElementById('rptimer-' + rd.id);
    if (timerEl) timerEl.textContent = '⏱ ' + fmtCountdown(Math.max(0, Math.ceil((rs.durationMs - (now - rs.startMs)) / 1000)));
    const mbar = document.getElementById('rmodal-prog');
    if (mbar && researchModalId === rd.id) {
      const pct = Math.min(((now - rs.startMs) / rs.durationMs) * 100, 100);
      mbar.style.width = pct.toFixed(2) + '%';
      const eta = document.getElementById('rmodal-eta');
      const rem = Math.max(0, Math.ceil((rs.durationMs - (now - rs.startMs)) / 1000));
      if (eta) eta.textContent = '⏱ ' + fmtCountdown(rem) + ' remaining';
    }
  });
}

// ── RESEARCH MODAL ───────────────────────────────
let researchModalId = null;

function openResearchModal(id) {
  researchModalId = id;
  renderResearchModal();
  document.getElementById('building-modal').classList.add('open');
}

function renderResearchModal() {
  const rd = RESEARCH_DEFS.find(x => x.id === researchModalId);
  if (!rd) return;
  const rs = researchState[rd.id];
  const unlocked = isResearchUnlocked(rd);
  const now = Date.now();

  const canAfford = Object.entries(rd.cost).every(([k,v]) => (resources[k]||0) >= v);
  const costLines = Object.entries(rd.cost).map(([k,v]) => {
    const def = RESOURCE_DEFS.find(x=>x.id===k);
    const have = Math.floor(resources[k]||0);
    const ok = have >= v;
    return `<div class="info-row">
      <span class="info-row-label">${def?.icon||''} ${def?.label||k}</span>
      <span style="color:${ok?'var(--green)':'var(--red)'};">${have.toLocaleString()} / ${v.toLocaleString()}</span>
    </div>`;
  }).join('');

  const reqLines = rd.requires.length ? rd.requires.map(id => {
    const prev = RESEARCH_DEFS.find(x=>x.id===id);
    const done = researchState[id]?.done;
    return `<span style="color:${done?'var(--green)':'var(--red)'};">${done?'✓':'✗'} ${prev?.name||id}</span>`;
  }).join('  ') : '<span style="color:var(--green)">✓ No prerequisites</span>';

  let body = '';

  if (rs.done) {
    body = `
      <div class="rmodal-effect-box">✅ ${rd.effect} — Applied to your kingdom!</div>
      <div style="font-size:13px;color:var(--text2);">This research is complete. Its bonus is permanently active.</div>
    `;
  } else if (rs.researching) {
    const elapsed = now - rs.startMs;
    const pct = Math.min((elapsed / rs.durationMs) * 100, 100).toFixed(1);
    const rem = Math.max(0, Math.ceil((rs.durationMs - elapsed) / 1000));
    body = `
      <div class="rmodal-in-progress">
        <div style="font-size:14px;font-weight:700;color:var(--orange);margin-bottom:4px;">🔬 Researching…</div>
        <div style="font-size:12px;color:var(--text2);">Do not close the game — research continues offline.</div>
        <div class="rmodal-prog-wrap"><div class="rmodal-prog" id="rmodal-prog" style="width:${pct}%"></div></div>
        <div class="rmodal-eta upg-eta" id="rmodal-eta">⏱ ${fmtCountdown(rem)} remaining</div>
      </div>
      <div class="bmodal-btns">
        <button class="bmodal-btn cancel-upg" onclick="cancelResearch('${rd.id}')">
          ✕ Cancel Research
          <div class="btn-sub">Refunds 50% of materials spent</div>
        </button>
      </div>
    `;
  } else {
    const dur = effectiveResearchMs(rd);
    const alreadyResearching = activeResearchId && activeResearchId !== rd.id;
    const activeRd = alreadyResearching ? RESEARCH_DEFS.find(x=>x.id===activeResearchId) : null;
    body = `
      <div class="rmodal-effect-box" style="background:var(--bg3);border-color:var(--border2);color:var(--green);">
        ✨ ${rd.effect}
      </div>
      <div class="bmodal-section">
        <div class="bmodal-section-title">Prerequisites</div>
        <div style="font-size:12px;line-height:1.8;">${reqLines}</div>
      </div>
      <div class="bmodal-section">
        <div class="bmodal-section-title">Resource Cost</div>
        ${costLines}
      </div>
      <div class="info-row" style="margin-bottom:0.9rem;">
        <span class="info-row-label">Research time</span>
        <span style="color:var(--orange);font-weight:600;">⏱ ${fmtTime(dur/1000)}</span>
      </div>
      ${alreadyResearching ? `<div style="background:rgba(240,160,64,0.1);border:1px solid rgba(240,160,64,0.3);border-radius:8px;padding:0.6rem 0.85rem;font-size:12px;color:var(--orange);margin-bottom:0.75rem;">⚠️ Already researching <b>${activeRd?.name||''}</b>. Cancel it first.</div>` : ''}
      <div class="bmodal-btns">
        <button class="bmodal-btn upgrade" ${(!unlocked||!canAfford||alreadyResearching)?'disabled':''} onclick="startResearch('${rd.id}')">
          🔬 Begin Research
          <div class="btn-sub">⏱ ${fmtTime(dur/1000)} · +30 XP on complete</div>
        </button>
      </div>
    `;
  }

  document.getElementById('bmodal-content').innerHTML = `
    <div class="bmodal-header">
      <div>
        <span class="bmodal-icon">${rd.icon}</span>
        <div class="bmodal-title">${rd.name}</div>
        <div class="bmodal-sub">${rd.desc}</div>
      </div>
      <button class="bmodal-close" onclick="closeModal()">✕</button>
    </div>
    ${body}
  `;
}

function startResearch(id) {
  const rd = RESEARCH_DEFS.find(x=>x.id===id);
  const rs = researchState[id];
  if (rs.done || rs.researching) return;
  if (!isResearchUnlocked(rd)) { showToast('Prerequisites not met!'); return; }
  if (activeResearchId) { showToast('Already researching something!'); return; }

  const ok = Object.entries(rd.cost).every(([k,v]) => (resources[k]||0) >= v);
  if (!ok) { showToast('Not enough resources!'); return; }
  Object.entries(rd.cost).forEach(([k,v]) => { resources[k] -= v; });

  const dur = effectiveResearchMs(rd);
  rs.researching = true;
  rs.startMs = Date.now();
  rs.durationMs = dur;
  activeResearchId = id;

  renderResearchModal();
  updateResearchCards();
  updateResourcePills();
  showToast(`🔬 ${rd.name} research started — ${fmtTime(dur/1000)}`);
  scheduleSave();
}

function cancelResearch(id) {
  const rd = RESEARCH_DEFS.find(x=>x.id===id);
  const rs = researchState[id];
  if (!rs.researching) return;
  Object.entries(rd.cost).forEach(([k,v]) => {
    resources[k] = (resources[k]||0) + Math.floor(v*0.5);
  });
  rs.researching = false; rs.startMs = 0; rs.durationMs = 0;
  if (activeResearchId === id) activeResearchId = null;
  renderResearchModal();
  updateResearchCards();
  updateResourcePills();
  showToast(`Research cancelled — 50% materials refunded`);
  scheduleSave();
}

function resolveOfflineResearch() {
  const now = Date.now();
  RESEARCH_DEFS.forEach(rd => {
    const rs = researchState[rd.id];
    if (!rs.researching) return;
    if (now >= rs.startMs + rs.durationMs) {
      rs.done = true; rs.researching = false; rs.startMs = 0; rs.durationMs = 0;
      if (activeResearchId === rd.id) activeResearchId = null;
      addXP(30, undefined, undefined);
    }
  });
}

