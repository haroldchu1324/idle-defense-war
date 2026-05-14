// ═══════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════
function showAuthScreen(id) {
  ['screen-login','screen-signup','screen-confirm'].forEach(s => {
    const el = document.getElementById(s);
    el.style.display = s === id ? 'block' : 'none';
    el.classList.toggle('visible', s === id);
  });
}
function showAuthLayer(sid) {
  const l = document.getElementById('auth-layer');
  l.classList.remove('hidden'); l.style.display='flex'; l.offsetHeight; l.classList.add('visible');
  showAuthScreen(sid || 'screen-login');
}
function hideAuthLayer() {
  const l = document.getElementById('auth-layer');
  l.classList.remove('visible');
  setTimeout(() => { l.style.display='none'; l.classList.add('hidden'); }, 300);
}
function showLoadingScreen() {
  hideAuthLayer();
  document.getElementById('game').style.display='none';
  document.getElementById('game').classList.remove('visible');
  const sl = document.getElementById('screen-loading');
  sl.style.display='flex'; sl.offsetHeight; sl.classList.add('visible');
}
function showGame() {
  const sl=document.getElementById('screen-loading'), g=document.getElementById('game');
  sl.classList.remove('visible'); g.style.display='flex'; g.offsetHeight;
  setTimeout(()=>{ sl.style.display='none'; g.classList.add('visible'); }, 300);
  hideAuthLayer();
}
function hideGame() {
  const g=document.getElementById('game');
  g.classList.remove('visible');
  setTimeout(()=>{ g.style.display='none'; }, 400);
  showAuthLayer('screen-login');
}

async function doLogin() {
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-password').value;
  const btn=document.getElementById('login-btn'), msg=document.getElementById('login-msg');
  if(!email||!pass){msg.textContent='Please enter email and password.';msg.className='auth-msg error';return;}
  btn.disabled=true; msg.textContent='Signing in…'; msg.className='auth-msg';
  const {data,error}=await sb.auth.signInWithPassword({email,password:pass});
  if(error){btn.disabled=false;msg.textContent=error.message;msg.className='auth-msg error';return;}
  btn.disabled=false; msg.textContent='';
  localStorage.setItem('bf_saved_email',email);
  try{await startGame(data.user);}catch(e){console.error('startGame failed:',e);}
}
async function doSignup() {
  const username=document.getElementById('signup-username').value.trim();
  const email=document.getElementById('signup-email').value.trim();
  const pass=document.getElementById('signup-password').value;
  const btn=document.getElementById('signup-btn'), msg=document.getElementById('signup-msg');
  if(!username){msg.textContent='Please enter a username.';msg.className='auth-msg error';return;}
  btn.disabled=true; msg.textContent='Creating account…'; msg.className='auth-msg';
  const {error}=await sb.auth.signUp({email,password:pass,options:{data:{username}}});
  btn.disabled=false;
  if(error){msg.textContent=error.message;msg.className='auth-msg error';}
  else{showAuthScreen('screen-confirm');}
}
async function doLogout() {
  stopLoop(); clearTimeout(saveTimer);
  try{await saveToDB();}catch(e){}
  sessionChannel.postMessage('logout'); currentUser=null;
  await sb.auth.signOut();
}

// ── Wait for all scripts to load before wiring up auth ──
window.addEventListener('DOMContentLoaded', async () => {
  sb.auth.onAuthStateChange(async(event,session)=>{
    if(event==='SIGNED_IN'&&session?.user&&!currentUser) await startGame(session.user);
    else if(event==='SIGNED_OUT'){currentUser=null;stopLoop();clearTimeout(saveTimer);resetState();hideGame();}
  });

  const {data}=await sb.auth.getSession();
  if(!data?.session){
    showAuthLayer('screen-login');
    const e=localStorage.getItem('bf_saved_email');
    if(e){const el=document.getElementById('login-email');el.value=e;el.style.color='#6a7090';document.getElementById('login-password').focus();}
  }
});

// ═══════════════════════════════════════════════
// GAME START
// ═══════════════════════════════════════════════
async function startGame(user) {
  currentUser=user;
  const meta=user.user_metadata||{};
  document.getElementById('username-display').textContent=meta.username||user.email.split('@')[0];
  document.getElementById('login-msg').textContent='';
  showLoadingScreen();
  const lb=document.getElementById('loading-bar');
  lb.style.animation='none'; lb.offsetHeight; lb.style.animation='';
  try{await loadFromDB();await new Promise(r=>setTimeout(r,450));}
  catch(e){console.warn('startGame failed:',e);}
  finally{
    buildResourcesPanel();
    buildResearchPanel();
    buildInventoryPanel();
    buildCraftingPanel();
    buildCampaignMap();
    updateResourcePills();
    updatePlayerLevelUI();
    showGame();
    startLoop();
  }
}

function resetState() {
  resources={wood:500,stone:500,fiber:500,leather:500,ore:500};
  playerXP=0; playerLevel=1;
  RESOURCE_DEFS.forEach(r=>{
    nodeState[r.id]=r.tiers.map((_,ti)=>({
      unlocked:ti===0,upgradeLevel:1,storedAmount:0,
      upgrading:false,upgradeStartMs:0,upgradeDurationMs:0,upgradeCostPaid:0,
    }));
  });
  RESEARCH_DEFS.forEach(r=>{ researchState[r.id]={done:false,researching:false,startMs:0,durationMs:0}; });
  activeResearchId=null;
  armoryTowers=[];
  campCompletedStages=new Set();
  campSelectedStage=null;
}

// ═══════════════════════════════════════════════
// SAVE / LOAD
// ═══════════════════════════════════════════════

async function loadFromDB() {
  try {
    await refreshFromServer();
  } catch (e) {
    console.warn('server load failed, falling back to old game_saves:', e);
    let data,error;
    try{
      const result=await Promise.race([
        sb.from('game_saves').select('save_data').eq('id',currentUser.id).single().then(r=>r),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),8000))
      ]);
      data=result.data; error=result.error;
    }catch(err){console.warn('loadFromDB fallback failed:',err);return;}
    if(data?.save_data?.v2){ applyServerPayload(data.save_data); }
  }
}

async function saveToDB() {
  if(!currentUser) return;
  try { await serverRpc('idw_touch'); } catch(e) { console.warn('touch failed', e); }
}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveToDB,5000);}

// ═══════════════════════════════════════════════
// OFFLINE PROGRESS & UPGRADE RESOLUTION
// ═══════════════════════════════════════════════
function resolveOfflineUpgrades() {
  const now = Date.now();
  RESOURCE_DEFS.forEach(r => {
    r.tiers.forEach((_,ti) => {
      const ns = nodeState[r.id][ti];
      if (!ns.upgrading) return;
      const finishMs = ns.upgradeStartMs + ns.upgradeDurationMs;
      if (now >= finishMs) {
        ns.upgradeLevel++;
        ns.upgrading = false;
        ns.upgradeDurationMs = 0;
        ns.upgradeStartMs = 0;
        addXP(XP_PER_UPGRADE, undefined, undefined);
      }
    });
  });
}

function applyOfflineProgress(lastSeen) {
  if(!lastSeen) return;
  const maxMs = 8*60*60*1000;
  const elapsed = Math.min(Date.now()-lastSeen, maxMs);
  if(elapsed < 5000) return;
  const summary = [];
  RESOURCE_DEFS.forEach(r=>{
    r.tiers.forEach((_,ti)=>{
      const ns = nodeState[r.id][ti];
      if(!ns.unlocked || ns.upgrading) return; 
      const ph  = nodeProdPerHour(r,ti,ns.upgradeLevel);
      const cap = nodeStorageCap(r,ti,ns.upgradeLevel);
      const produced = Math.floor(ph*(elapsed/3600000));
      const added = Math.min(produced, cap-ns.storedAmount);
      if(added>0){
        ns.storedAmount=Math.min(ns.storedAmount+added, cap);
        summary.push(`${r.icon} ${r.name}: +${added.toLocaleString()}`);
      }
    });
  });
  if(summary.length>0){
    const h=Math.floor(elapsed/3600000), m=Math.floor((elapsed%3600000)/60000);
    const ts=h>0?`${h}h ${m}m`:`${m}m`;
    setTimeout(()=>showOfflineBanner(ts,summary),600);
  }
}

function showOfflineBanner(ts,lines){
  const slot=document.getElementById('offline-banner-slot');
  if(!slot) return;
  slot.innerHTML=`<div class="offline-banner"><div><div style="color:var(--green);font-weight:600;margin-bottom:4px;">⏰ Offline ${ts} — gathered while away:</div><div style="color:var(--text2);font-size:11px;line-height:1.7;">${lines.join('<br>')}</div></div><button class="offline-banner-close" onclick="this.closest('.offline-banner').remove()">✕</button></div>`;
}

window.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden'&&currentUser) saveToDB(); });
window.addEventListener('beforeunload',()=>{ if(currentUser) saveToDB(); });
