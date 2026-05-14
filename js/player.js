// ═══════════════════════════════════════════════
// PLAYER LEVEL UI
// ═══════════════════════════════════════════════
function addXP(amount, x, y) {
  playerXP += amount;
  while(playerXP >= xpForLevel(playerLevel)){
    playerXP -= xpForLevel(playerLevel);
    playerLevel++;
    showToast(`🎉 Level up! Now Level ${playerLevel}`);
    updateNodeCards();
  }
  updatePlayerLevelUI();
  if(x !== undefined) spawnXPFloater(`+${amount} XP`, x, y);
}

function updatePlayerLevelUI(){
  const needed = xpForLevel(playerLevel);
  const pct = Math.min((playerXP/needed)*100, 100);
  document.getElementById('pl-num').textContent = playerLevel;
  document.getElementById('pl-xp-label').textContent = `${playerXP.toLocaleString()} / ${needed.toLocaleString()} XP`;
  document.getElementById('pl-xp-bar').style.width = pct+'%';
}

function spawnXPFloater(text,x,y){
  if(x===undefined) return;
  const el=document.createElement('div');
  el.className='xp-floater'; el.textContent=text;
  el.style.left=x+'px'; el.style.top=y+'px';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),1300);
}

// ═══════════════════════════════════════════════
// BUFFS MODAL
// ═══════════════════════════════════════════════
function openBuffsModal(){
  const lbp  = (bonusProd(playerLevel)*100).toFixed(1);
  const lbc  = (bonusCombat(playerLevel)*100).toFixed(1);
  const lbcr = (bonusCraft(playerLevel)*100).toFixed(1);
  const lbr  = (bonusResearch(playerLevel)*100).toFixed(1);
  const needed = xpForLevel(playerLevel);
  const pct = Math.min((playerXP/needed)*100,100).toFixed(1);
  const rb = getResearchBonuses();

  function fmtBonus(v){ const n=parseFloat(v.toFixed(1)); return `<span class="buff-val${n===0?' zero':''}">${n===0?'—':'+'+n.toFixed(1)+'%'}</span>`; }

  const prodRows = RESOURCE_DEFS.map(r => {
    const total = (bonusProd(playerLevel) + researchProdBonus(r.id)) * 100;
    return `<div class="buff-row"><span class="buff-label">${r.icon} ${r.name}</span>${fmtBonus(total)}</div>`;
  }).join('');

  document.getElementById('buffs-modal-content').innerHTML=`
    <div class="bmodal-header">
      <div>
        <span class="bmodal-icon">⚡</span>
        <div class="bmodal-title">Commander Level ${playerLevel}</div>
        <div class="bmodal-sub">${playerXP.toLocaleString()} / ${needed.toLocaleString()} XP (${pct}%)</div>
      </div>
      <button class="bmodal-close" onclick="closeBuffsModal()">✕</button>
    </div>
    <div class="storage-bar-wrap" style="margin-bottom:1.1rem;">
      <div class="storage-bar" style="width:${pct}%;background:linear-gradient(90deg,var(--gold2),var(--gold));"></div>
    </div>

    <div class="buffs-section">
      <div class="buffs-section-title">🌾 Resource Production</div>
      ${prodRows}
    </div>

    <div class="buffs-section">
      <div class="buffs-section-title">⚔️ Combat</div>
      <div class="buff-row"><span class="buff-label">Attack power</span>${fmtBonus((parseFloat(lbc)+rb.attack*100+rb.all_combat*100))}</div>
      <div class="buff-row"><span class="buff-label">Defense rating</span>${fmtBonus((parseFloat(lbc)+rb.defense*100+rb.all_combat*100))}</div>
      <div class="buff-row"><span class="buff-label">Max HP</span>${fmtBonus((parseFloat(lbc)+rb.hp*100+rb.all_combat*100))}</div>
    </div>

    <div class="buffs-section">
      <div class="buffs-section-title">⚙️ Efficiency</div>
      <div class="buff-row"><span class="buff-label">Crafting speed</span>${fmtBonus(parseFloat(lbcr)+rb.craft_speed*100)}</div>
      <div class="buff-row"><span class="buff-label">Research speed</span>${fmtBonus(parseFloat(lbr)+rb.research_speed*100)}</div>
      <div class="buff-row"><span class="buff-label">Storage capacity</span>${fmtBonus(rb.storage*100)}</div>
    </div>

    <div style="background:var(--bg3);border-radius:9px;padding:0.7rem 0.9rem;font-size:11px;color:var(--text3);line-height:1.7;">
      <div>+0.1% production &amp; combat per level · +0.1% crafting &amp; research every 5 levels</div>
      <div style="margin-top:3px;color:var(--text2);">Additional bonuses from research are shown above.</div>
    </div>
  `;
  document.getElementById('buffs-modal').classList.add('open');
}
function closeBuffsModal(){
  document.getElementById('buffs-modal').classList.remove('open');
}

