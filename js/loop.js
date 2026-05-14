// ═══════════════════════════════════════════════
// RAF LOOP
// ═══════════════════════════════════════════════
function startLoop(){
  stopLoop(); lastTick=Date.now(); lastStructuralRender=0;
  function loop(){ tickAll(); rafId=requestAnimationFrame(loop); }
  rafId=requestAnimationFrame(loop);
}
function stopLoop(){ if(rafId){ cancelAnimationFrame(rafId); rafId=null; } }

function tickAll(){
  const now=Date.now(), dt=Math.min(now-lastTick,200);
  lastTick=now;
  let changed=false;

  RESOURCE_DEFS.forEach(r=>{
    r.tiers.forEach((_,ti)=>{
      const ns=nodeState[r.id][ti];
      if(!ns.unlocked) return;

      if(ns.upgrading){
        const finishMs = ns.upgradeStartMs + ns.upgradeDurationMs;
        if(now >= finishMs){
          ns.upgradeLevel++;
          ns.upgrading=false; ns.upgradeDurationMs=0; ns.upgradeStartMs=0; ns.upgradeCostPaid=0;
          changed=true;
          addXP(XP_PER_UPGRADE, undefined, undefined);
          showToast(`${r.icon} ${r.name} Lv ${ns.upgradeLevel} upgrade complete!`);
          if(modalResId===r.id && modalTierIdx===ti) renderNodeModal();
        }
        return;
      }

      const ph  = nodeProdPerHour(r,ti,ns.upgradeLevel);
      const cap = nodeStorageCap(r,ti,ns.upgradeLevel);
      const prev = Math.floor(ns.storedAmount);
      ns.storedAmount = Math.min(ns.storedAmount + ph*(dt/3600000), cap);
      if(Math.floor(ns.storedAmount) !== prev) changed=true;
    });
  });

  updateUpgradeBars();
  updateProgressBars();
  updateResearchBars();

  if(changed && now-lastStructuralRender>1000){
    lastStructuralRender=now;
    updateResourcePills();
    updateNodeCards();
    if(document.getElementById('craft-towers')?.classList.contains('active')) renderTowerGrid();
    scheduleSave();
  }
}

