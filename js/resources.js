// ═══════════════════════════════════════════════
// RESOURCE PILLS
// ═══════════════════════════════════════════════
function updateResourcePills(){
  RESOURCE_DEFS.forEach(r=>{
    const el=document.getElementById('pill-'+r.id);
    if(el) el.textContent=Math.floor(resources[r.id]).toLocaleString();
  });
}

// ═══════════════════════════════════════════════
// BUILD RESOURCES PANEL
// ═══════════════════════════════════════════════
function buildResourcesPanel(){
  const panel=document.getElementById('resources-panel');
  panel.innerHTML='';

  const bar=document.createElement('div');
  bar.className='collect-all-bar';
  bar.innerHTML=`<button class="collect-all-btn" onclick="collectAll()">📥 Collect All</button>`;
  panel.appendChild(bar);

  RESOURCE_DEFS.forEach(r=>{
    const lane=document.createElement('div');
    lane.className='res-lane';
    lane.id='lane-'+r.id;
    lane.innerHTML=`
      <div class="res-lane-header">
        <span class="res-lane-icon">${r.icon}</span>
        <span class="res-lane-name">${r.name}s</span>
        <span class="res-lane-rate" id="lane-rate-${r.id}"></span>
      </div>
      <div class="res-nodes-row" id="nodes-row-${r.id}"></div>
    `;
    panel.appendChild(lane);

    const row=document.getElementById('nodes-row-'+r.id);
    r.tiers.forEach((_,ti)=>{
      const card=document.createElement('div');
      card.id=`node-${r.id}-${ti}`;
      card.className=`node-card type-${r.type}`;
      card.onclick=()=>openNodeModal(r.id,ti);
      row.appendChild(card);
    });
  });

  updateNodeCards();
}

function updateNodeCards(){
  RESOURCE_DEFS.forEach(r=>{
    let totalPH=0;
    r.tiers.forEach((_,ti)=>{
      const card=document.getElementById(`node-${r.id}-${ti}`);
      if(!card) return;
      const ns=nodeState[r.id][ti];
      const def=r.tiers[ti];
      const reqLevel=LEVEL_UNLOCK[ti];

      if(!ns.unlocked){
        let firstLocked=true;
        for(let i=0;i<ti;i++) if(!nodeState[r.id][i].unlocked){firstLocked=false;break;}
        if(!firstLocked){card.classList.add('locked-hidden');return;}
        card.classList.remove('locked-hidden');
        card.classList.add('locked');
        card.classList.remove('upgrading');
        const canUnlock=playerLevel>=reqLevel;
        const canAfford=resources[r.costCurrency]>=def.unlockCost;
        const statusColor=(!canUnlock||!canAfford)?'var(--red)':'var(--green)';
        card.innerHTML=`
          <div class="nc-top"><span class="nc-icon">${r.icon}</span></div>
          <div class="nc-lock-body">
            <span class="nc-lock-icon">🔒</span>
            <div class="nc-lock-req" style="color:${statusColor}">${!canUnlock?'Need Lv '+reqLevel:def.unlockCost.toLocaleString()+' '+r.costCurrencyIcon}</div>
          </div>`;
        return;
      }

      if(ns.upgrading){
        card.classList.remove('locked','locked-hidden');
        card.classList.add('upgrading');
        const elapsed=Date.now()-ns.upgradeStartMs;
        const pct=Math.min((elapsed/ns.upgradeDurationMs)*100,100);
        const remaining=Math.max(0,Math.ceil((ns.upgradeDurationMs-elapsed)/1000));
        card.innerHTML=`
          <div class="nc-top">
            <span class="nc-icon">${r.icon}</span>
            <span class="nc-lvlbadge badge-${r.type}">⬆${ns.upgradeLevel+1}</span>
          </div>
          <div class="nc-rate" style="color:var(--orange);font-size:7px;">Upgrading</div>
          <div class="nc-timer" style="color:var(--orange)" id="nctimer-${r.id}-${ti}">${fmtCountdown(remaining)}</div>
          <div class="nc-upg-wrap" style="margin-top:auto;"><div class="nc-upg-bar" id="ncupg-${r.id}-${ti}" style="width:${pct.toFixed(1)}%"></div></div>`;
        return;
      }

      card.classList.remove('locked','locked-hidden','upgrading');
      const ph=nodeProdPerHour(r,ti,ns.upgradeLevel);
      const cap=nodeStorageCap(r,ti,ns.upgradeLevel);
      const stored=Math.floor(ns.storedAmount);
      const pct=Math.min((ns.storedAmount/cap)*100,100).toFixed(1);
      totalPH+=ph;

      card.innerHTML=`
        <div class="nc-top">
          <span class="nc-icon">${r.icon}</span>
          <span class="nc-lvlbadge badge-${r.type}">Lv${ns.upgradeLevel}</span>
        </div>
        <div class="nc-rate">${ph.toLocaleString()}/hr</div>
        <div class="nc-stored">${stored.toLocaleString()}/${cap.toLocaleString()}</div>
        <div class="nc-progwrap" style="margin-top:auto;"><div class="nc-prog type-${r.type}" id="ncprog-${r.id}-${ti}" style="width:${pct}%"></div></div>`;
    });

    const rateEl=document.getElementById('lane-rate-'+r.id);
    if(rateEl) rateEl.textContent=totalPH>0?`${totalPH.toLocaleString()}/hr total`:'';
  });
}

function updateProgressBars(){
  RESOURCE_DEFS.forEach(r=>{
    r.tiers.forEach((_,ti)=>{
      const ns=nodeState[r.id][ti];
      if(!ns.unlocked || ns.upgrading) return; 
      const bar=document.getElementById(`ncprog-${r.id}-${ti}`);
      if(!bar) return;
      const cap=nodeStorageCap(r,ti,ns.upgradeLevel);
      bar.style.width=Math.min((ns.storedAmount/cap)*100,100).toFixed(2)+'%';
    });
  });
}

function updateUpgradeBars(){
  const now=Date.now();
  RESOURCE_DEFS.forEach(r=>{
    r.tiers.forEach((_,ti)=>{
      const ns=nodeState[r.id][ti];
      if(!ns.upgrading) return;
      const elapsed=now-ns.upgradeStartMs;
      const pct=Math.min((elapsed/ns.upgradeDurationMs)*100,100);
      const remSecs=Math.max(0,Math.ceil((ns.upgradeDurationMs-elapsed)/1000));

      const bar=document.getElementById(`ncupg-${r.id}-${ti}`);
      if(bar) bar.style.width=pct.toFixed(2)+'%';

      const timerEl=document.getElementById(`nctimer-${r.id}-${ti}`);
      if(timerEl) timerEl.textContent=fmtCountdown(remSecs);

      const mbar=document.getElementById('modal-upg-bar');
      if(mbar && modalResId===r.id && modalTierIdx===ti){
        mbar.style.width=pct.toFixed(2)+'%';
        const etaEl=document.getElementById('modal-upg-eta');
        if(etaEl) etaEl.textContent='⏱ '+fmtCountdown(remSecs)+' remaining';
      }
    });
  });
}

// ═══════════════════════════════════════════════
// COLLECT ALL
// ═══════════════════════════════════════════════
function collectAll(){
  let totals={};
  RESOURCE_DEFS.forEach(r=>{ totals[r.id]=0; });
  RESOURCE_DEFS.forEach(r=>{
    r.tiers.forEach((_,ti)=>{
      const ns=nodeState[r.id][ti];
      if(!ns.unlocked||ns.upgrading||ns.storedAmount<1) return;
      const amount=Math.floor(ns.storedAmount);
      resources[r.id]=(resources[r.id]||0)+amount;
      ns.storedAmount-=amount;
      totals[r.id]+=amount;
    });
  });
  const parts=RESOURCE_DEFS.filter(r=>totals[r.id]>0).map(r=>`${r.icon}+${totals[r.id].toLocaleString()}`);
  showToast(parts.length?'Collected: '+parts.join('  '):'Nothing to collect yet');
  updateResourcePills(); updateNodeCards(); scheduleSave();
}

// ═══════════════════════════════════════════════
// NODE MODAL
// ═══════════════════════════════════════════════
let modalResId=null, modalTierIdx=null;

function openNodeModal(resId,tierIdx){
  modalResId=resId; modalTierIdx=tierIdx;
  renderNodeModal();
  document.getElementById('building-modal').classList.add('open');
}
function closeModal(){
  document.getElementById('building-modal').classList.remove('open');
  modalResId=modalTierIdx=null;
}

function renderNodeModal(){
  const r=RESOURCE_DEFS.find(x=>x.id===modalResId);
  if(!r) return;
  const ti=modalTierIdx;
  const ns=nodeState[r.id][ti];
  const def=r.tiers[ti];
  const reqLevel=LEVEL_UNLOCK[ti];
  const costRes=Math.floor(resources[r.costCurrency]);

  let html=`
    <div class="bmodal-header">
      <div>
        <span class="bmodal-icon">${r.icon}</span>
        <div class="bmodal-title">${r.name} Node${ns.unlocked?' — Lv '+(ns.upgrading?ns.upgradeLevel+' (upgrading)':ns.upgradeLevel):''}</div>
        <div class="bmodal-sub">${r.desc}</div>
      </div>
      <button class="bmodal-close" onclick="closeModal()">✕</button>
    </div>
  `;

  if(!ns.unlocked){
    const canUnlock=playerLevel>=reqLevel;
    const canAfford=costRes>=def.unlockCost;
    html+=`
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:11px;padding:1.1rem;margin-bottom:1rem;">
        <div style="font-size:13px;color:var(--text2);margin-bottom:0.7rem;">Unlock this node to produce ${r.label}.</div>
        <div class="info-row"><span class="info-row-label">Account level required</span><span style="color:${canUnlock?'var(--green)':'var(--red)'};">${canUnlock?'✓ Met':'Need Lv '+reqLevel+' ('+(reqLevel-playerLevel)+' more)'}</span></div>
        <div class="info-row"><span class="info-row-label">Unlock cost</span><span style="color:var(--gold);font-weight:600;">${r.costCurrencyIcon} ${def.unlockCost.toLocaleString()} ${r.costCurrencyLabel}</span></div>
        <div class="info-row"><span class="info-row-label">You have ${r.costCurrencyIcon}</span><span style="color:${canAfford?'var(--green)':'var(--red)'};">${costRes.toLocaleString()} ${r.costCurrencyLabel}</span></div>
      </div>
      <div class="bmodal-btns">
        <button class="bmodal-btn unlock-modal" ${(!canUnlock||!canAfford)?'disabled':''} onclick="unlockNode('${r.id}',${ti},event)">
          🔓 Unlock — ${r.costCurrencyIcon} ${def.unlockCost.toLocaleString()}
          <div class="xp-note">+${XP_PER_UNLOCK} XP on unlock</div>
        </button>
      </div>`;

  } else if(ns.upgrading){
    const elapsed=Date.now()-ns.upgradeStartMs;
    const pct=Math.min((elapsed/ns.upgradeDurationMs)*100,100);
    const remaining=Math.max(0,Math.ceil((ns.upgradeDurationMs-elapsed)/1000));
    const refundAmt=Math.floor(ns.upgradeCostPaid*0.5);
    html+=`
      <div class="upg-in-progress">
        <div style="font-size:14px;font-weight:600;color:var(--orange);margin-bottom:4px;">🔨 Under Construction</div>
        <div style="font-size:12px;color:var(--text2);">Upgrading to Level ${ns.upgradeLevel+1} — not producing during upgrade.</div>
        <div class="upg-progress-bar-wrap"><div class="upg-progress-bar" id="modal-upg-bar" style="width:${pct.toFixed(1)}%"></div></div>
        <div class="upg-eta" id="modal-upg-eta">⏱ ${fmtCountdown(remaining)} remaining</div>
      </div>
      <div class="bmodal-btns">
        <button class="bmodal-btn cancel-upg" onclick="cancelUpgrade('${r.id}',${ti})">
          ✕ Cancel Upgrade
          <div class="btn-sub">Refunds ${r.costCurrencyIcon} ${refundAmt.toLocaleString()} ${r.costCurrencyLabel} (50%)</div>
        </button>
      </div>`;

  } else {
    const ph=nodeProdPerHour(r,ti,ns.upgradeLevel);
    const cap=nodeStorageCap(r,ti,ns.upgradeLevel);
    const stored=Math.floor(ns.storedAmount);
    const storedPct=Math.min((stored/cap)*100,100).toFixed(1);
    const upgCost=nodeUpgradeCost(r,ti,ns.upgradeLevel);
    const isMax=ns.upgradeLevel>=MAX_NODE_LEVEL;
    const fillSecs=fillTimeSecs(stored,cap,ph);
    const fillStr=fillSecs===0?'Full':fillSecs===Infinity?'—':fmtTime(fillSecs);

    html+=`
      <div class="bmodal-stat-grid">
        <div class="bmodal-stat">
          <div class="bmodal-stat-label">Level</div>
          <div class="bmodal-stat-value" style="color:var(--${r.type})">${ns.upgradeLevel}${isMax?' <span style="font-size:9px;color:var(--text3)">(max)</span>':''}</div>
        </div>
        <div class="bmodal-stat">
          <div class="bmodal-stat-label">Production</div>
          <div class="bmodal-stat-value">${ph.toLocaleString()}<span style="font-size:9px;color:var(--text3)">/hr</span></div>
        </div>
        <div class="bmodal-stat">
          <div class="bmodal-stat-label">Stored</div>
          <div class="bmodal-stat-value">${stored.toLocaleString()}<span style="font-size:9px;color:var(--text3)">/${cap.toLocaleString()}</span></div>
        </div>
        <div class="bmodal-stat">
          <div class="bmodal-stat-label">Full in</div>
          <div class="bmodal-stat-value" style="font-size:12px;">${fillStr}</div>
        </div>
      </div>
      <div class="bmodal-section">
        <div class="bmodal-section-title">Storage</div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:4px;">${stored.toLocaleString()} / ${cap.toLocaleString()} ${r.label}</div>
        <div class="storage-bar-wrap"><div class="storage-bar" style="width:${storedPct}%;background:var(--${r.type});"></div></div>
      </div>`;

    if(!isMax){
      const nextPH=nodeProdPerHour(r,ti,ns.upgradeLevel+1);
      const nextCap=nodeStorageCap(r,ti,ns.upgradeLevel+1);
      const upgTimeSecs=upgradeTimeSecs(ns.upgradeLevel);
      html+=`
        <div class="bmodal-section">
          <div class="bmodal-section-title">Upgrade to Lv ${ns.upgradeLevel+1}</div>
          <div class="upg-preview">
            <span class="upg-now">${ph.toLocaleString()}/hr · ${cap.toLocaleString()}</span>
            <span class="upg-arrow">→</span>
            <span class="upg-next">${nextPH.toLocaleString()}/hr · ${nextCap.toLocaleString()}</span>
          </div>
          <div class="info-row"><span class="info-row-label">Upgrade cost</span><span style="color:var(--gold);font-weight:600;display:flex;align-items:center;gap:4px;">${r.costCurrencyIcon} ${upgCost.toLocaleString()} ${r.costCurrencyLabel}</span></div>
          <div class="info-row"><span class="info-row-label">You have</span><span style="color:${costRes>=upgCost?'var(--green)':'var(--red)'};display:flex;align-items:center;gap:4px;">${r.costCurrencyIcon} ${costRes.toLocaleString()} ${r.costCurrencyLabel}</span></div>
          <div class="info-row"><span class="info-row-label">Upgrade time</span><span style="color:var(--text2);">⏱ ${fmtTime(upgTimeSecs)}</span></div>
        </div>`;
    }

    html+=`
      <div class="bmodal-btns">
        <button class="bmodal-btn collect" ${stored<=0?'disabled':''} onclick="collectNode('${r.id}',${ti},event)">
          📥 Collect ${stored.toLocaleString()} ${r.label}
        </button>
        ${isMax
          ?`<button class="bmodal-btn upgrade" disabled>✅ Max Level (${MAX_NODE_LEVEL})</button>`
          :`<button class="bmodal-btn upgrade" ${costRes<nodeUpgradeCost(r,ti,ns.upgradeLevel)?'disabled':''} onclick="startUpgrade('${r.id}',${ti},event)">
              ⬆️ Upgrade — ${r.costCurrencyIcon} ${nodeUpgradeCost(r,ti,ns.upgradeLevel).toLocaleString()}
              <div class="btn-sub">⏱ ${fmtTime(upgradeTimeSecs(ns.upgradeLevel))} · +${XP_PER_UPGRADE} XP on complete</div>
            </button>`
        }
      </div>`;
  }

  document.getElementById('bmodal-content').innerHTML=html;
}

async function unlockNode(resId,tierIdx,event){
  try { await serverRpc('idw_unlock_node', {p_res_id:resId, p_tier_idx:tierIdx}); closeModal(); await refreshFromServer(); showToast('Node unlocked by server'); }
  catch(e){ /* toast shown by serverRpc */ }
}

async function collectNode(resId,tierIdx){
  try { await serverRpc('idw_collect_resource', {p_res_id:resId, p_tier_idx:tierIdx}); await refreshFromServer(); showToast('Resources collected by server'); }
  catch(e){ /* toast shown by serverRpc */ }
}

async function startUpgrade(resId,tierIdx,event){
  try { await serverRpc('idw_start_node_upgrade', {p_res_id:resId, p_tier_idx:tierIdx}); await refreshFromServer(); renderNodeModal(); showToast('Upgrade started by server'); }
  catch(e){ /* toast shown by serverRpc */ }
}

function cancelUpgrade(resId,tierIdx){
  const r=RESOURCE_DEFS.find(x=>x.id===resId);
  const ns=nodeState[r.id][tierIdx];
  if(!ns.upgrading) return;
  const refund=Math.floor(ns.upgradeCostPaid*0.5);
  resources[r.costCurrency]=(resources[r.costCurrency]||0)+refund;
  ns.upgrading=false; ns.upgradeStartMs=0; ns.upgradeDurationMs=0; ns.upgradeCostPaid=0;
  renderNodeModal(); updateNodeCards(); updateResourcePills();
  showToast(`Upgrade cancelled — refunded ${r.costCurrencyIcon} ${refund.toLocaleString()} ${r.costCurrencyLabel}`);
  scheduleSave();
}

