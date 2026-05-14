// ═══════════════════════════════════════════════
// INVENTORY SYSTEM
// ═══════════════════════════════════════════════
function totalArmorySlots() {
  let slots = 5;
  if (researchState['comb4']?.done) slots += 2;
  if (researchState['comb5']?.done) slots += 3;
  if (researchState['comb6']?.done) slots += 5;
  return slots;
}

let armoryTowers = [];

function buildInventoryPanel() {
  renderArmoryGrid();
  renderItemsGrid();
  renderBoostsGrid();
  updateArmorySlotCount();
}

function renderArmoryGrid() {
  const grid = document.getElementById('armory-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const total = totalArmorySlots();
  for (let i = 0; i < total; i++) {
    const entry = armoryTowers[i];
    const slot = document.createElement('div');
    if (entry) {
      const td = TOWER_DEFS.find(t => t.id === entry.towerId);
      slot.className = 'inv-slot filled tower-slot';
      slot.innerHTML = `
        <div class="inv-slot-level">Lv${entry.level}</div>
        <div class="inv-slot-icon">${td?.icon||'🗼'}</div>
        <div class="inv-slot-name">${td?.name||'Tower'}</div>
      `;
      slot.onclick = () => openArmorySlotModal(i);
    } else {
      slot.className = 'inv-slot';
      slot.innerHTML = `<div class="inv-slot-empty-icon">＋</div><div class="inv-slot-empty-text">Empty</div>`;
    }
    grid.appendChild(slot);
  }
}

function renderItemsGrid() {
  const grid = document.getElementById('items-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const ITEMS = []; 
  const TOTAL = 30;
  for (let i = 0; i < TOTAL; i++) {
    const item = ITEMS[i];
    const slot = document.createElement('div');
    slot.className = 'inv-slot' + (item ? ' filled' : '');
    if (item) {
      slot.innerHTML = `<div class="inv-slot-icon">${item.icon}</div><div class="inv-slot-name">${item.name}</div>`;
      slot.onclick = () => openItemModal(item);
    } else {
      slot.innerHTML = `<div class="inv-slot-empty-icon">＋</div><div class="inv-slot-empty-text">Empty</div>`;
    }
    grid.appendChild(slot);
  }
}

function renderBoostsGrid() {
  const grid = document.getElementById('boosts-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const BOOSTS = []; 
  const TOTAL = 20;
  for (let i = 0; i < TOTAL; i++) {
    const item = BOOSTS[i];
    const slot = document.createElement('div');
    slot.className = 'inv-slot' + (item ? ' filled' : '');
    if (item) {
      slot.innerHTML = `<div class="inv-slot-icon">${item.icon}</div><div class="inv-slot-name">${item.name}</div>`;
    } else {
      slot.innerHTML = `<div class="inv-slot-empty-icon">＋</div><div class="inv-slot-empty-text">Empty</div>`;
    }
    grid.appendChild(slot);
  }
}

function updateArmorySlotCount() {
  const total = totalArmorySlots();
  const used = armoryTowers.filter(Boolean).length;
  const totalEl = document.getElementById('armory-total');
  const usedEl = document.getElementById('armory-used');
  if (totalEl) totalEl.textContent = total;
  if (usedEl) usedEl.textContent = used;
}

function switchInvTab(name) {
  ['armory','items','boosts'].forEach(t => {
    const p = document.getElementById('inv-' + t);
    const btn = document.getElementById('invtab-' + t);
    if (p) p.classList.toggle('active', t === name);
    if (btn) btn.classList.toggle('active', t === name);
  });
}

function openArmorySlotModal(slotIdx) {
  const entry = armoryTowers[slotIdx];
  if (!entry) return;
  const td = TOWER_DEFS.find(t => t.id === entry.towerId);
  if (!td) return;
  const stats = towerStatsAtLevel(td, entry.level);
  const disenchantRes = towerDisenchantValue(td);
  const disStr = Object.entries(disenchantRes).map(([k,v]) => {
    const def = RESOURCE_DEFS.find(r=>r.id===k);
    return `${def?.icon||''} ${v.toLocaleString()} ${def?.label||k}`;
  }).join(', ');

  document.getElementById('item-modal-content').innerHTML = `
    <div class="bmodal-header">
      <div>
        <span class="bmodal-icon">${td.icon}</span>
        <div class="bmodal-title">${td.name} <span style="font-size:12px;color:var(--text3)">Lv ${entry.level}</span></div>
        <div class="bmodal-sub">${td.desc}</div>
      </div>
      <button class="bmodal-close" onclick="closeItemModal()">✕</button>
    </div>
    <div class="bmodal-stat-grid">
      <div class="bmodal-stat"><div class="bmodal-stat-label">Damage</div><div class="bmodal-stat-value">${stats.dmg}</div></div>
      <div class="bmodal-stat"><div class="bmodal-stat-label">Atk Speed</div><div class="bmodal-stat-value">${stats.atkSpeed}s</div></div>
      <div class="bmodal-stat"><div class="bmodal-stat-label">Range</div><div class="bmodal-stat-value">${stats.range}</div></div>
      <div class="bmodal-stat"><div class="bmodal-stat-label">Projectiles</div><div class="bmodal-stat-value">${stats.projectiles}</div></div>
    </div>
    ${td.special ? `<div style="background:var(--bg3);border-radius:9px;padding:0.7rem 1rem;font-size:12px;color:var(--orange);margin-bottom:1rem;">⚡ ${td.special}</div>` : ''}
    <div class="info-row"><span class="info-row-label">Disenchant value</span><span style="color:var(--gold);">${disStr}</span></div>
    <div style="margin-top:1rem;display:flex;flex-direction:column;gap:0.5rem;">
      <button class="bmodal-btn upgrade" onclick="upgradeTowerInArmory(${slotIdx})">
        ⬆️ Upgrade Tower
        <div class="btn-sub">Costs resources · +${Math.round(td.upgPctPerLevel*100)}% stats</div>
      </button>
      <button class="bmodal-btn cancel-upg" onclick="disenchantTower(${slotIdx})">
        💔 Disenchant — ${disStr}
      </button>
    </div>
  `;
  document.getElementById('item-modal').classList.add('open');
}

function openItemModal(item) {
  document.getElementById('item-modal-content').innerHTML = `
    <div class="bmodal-header">
      <div><span class="bmodal-icon">${item.icon}</span><div class="bmodal-title">${item.name}</div><div class="bmodal-sub">${item.desc}</div></div>
      <button class="bmodal-close" onclick="closeItemModal()">✕</button>
    </div>
  `;
  document.getElementById('item-modal').classList.add('open');
}
function closeItemModal() { document.getElementById('item-modal').classList.remove('open'); }

function disenchantTower(slotIdx) {
  const entry = armoryTowers[slotIdx];
  if (!entry) return;
  const td = TOWER_DEFS.find(t => t.id === entry.towerId);
  const refund = towerDisenchantValue(td);
  Object.entries(refund).forEach(([k,v]) => { resources[k] = (resources[k]||0) + v; });
  armoryTowers[slotIdx] = null;
  armoryTowers = armoryTowers.filter(Boolean);
  closeItemModal();
  renderArmoryGrid();
  updateArmorySlotCount();
  updateResourcePills();
  showToast(`💔 ${td.name} disenchanted`);
  scheduleSave();
}

function upgradeTowerInArmory(slotIdx) {
  const entry = armoryTowers[slotIdx];
  if (!entry) return;
  const td = TOWER_DEFS.find(t => t.id === entry.towerId);
  const upgCost = towerUpgradeCost(td, entry.level);
  const canAfford = Object.entries(upgCost).every(([k,v]) => (resources[k]||0) >= v);
  if (!canAfford) { showToast('Not enough resources!'); return; }
  Object.entries(upgCost).forEach(([k,v]) => { resources[k] -= v; });
  entry.level++;
  closeItemModal();
  renderArmoryGrid();
  updateResourcePills();
  showToast(`${td.icon} ${td.name} upgraded to Lv ${entry.level}!`);
  scheduleSave();
}

