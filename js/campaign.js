// ═══════════════════════════════════════════════
// CAMPAIGN MAP
// ═══════════════════════════════════════════════
const CAMPAIGN_STAGES = [
  { id:'1-1',  name:'1-1',  icon:'🌲', diff:1, enemies:'5 Goblins',       reward:'50 Wood' },
  { id:'1-2',  name:'1-2',  icon:'🌲', diff:1, enemies:'8 Goblins',       reward:'80 Wood + 30 Fiber' },
  { id:'1-3',  name:'1-3',  icon:'🏕️', diff:2, enemies:'Goblin + Ogre',   reward:'60 Stone' },
  { id:'1-4',  name:'1-4',  icon:'🏕️', diff:2, enemies:'12 Skeletons',    reward:'70 Stone + 40 Ore' },
  { id:'1-5',  name:'1-5',  icon:'⚔️', diff:3, enemies:'Bandit Leader',   reward:'100 Ore + 50 Leather' },
  { id:'1-6',  name:'1-6',  icon:'🌊', diff:3, enemies:'10 River Trolls', reward:'80 Fiber + 60 Leather' },
  { id:'1-7',  name:'1-7',  icon:'🌊', diff:4, enemies:'Troll King',      reward:'150 Leather + 50 Ore' },
  { id:'1-8',  name:'1-8',  icon:'🏔️', diff:4, enemies:'Stone Golems',    reward:'120 Stone + 80 Ore' },
  { id:'1-9',  name:'1-9',  icon:'🏔️', diff:5, enemies:'Dragon Scout',    reward:'200 Ore + 100 Fiber' },
  { id:'1-10', name:'1-10', icon:'🐉', diff:5, enemies:'Stage Boss: Dragon', reward:'500 of all resources' },
];

let campCompletedStages = new Set();
let campSelectedStage = null;

function buildCampaignMap() {
  const map = document.getElementById('campaign-map');
  if (!map) return;
  map.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'camp-row';

  CAMPAIGN_STAGES.forEach((stage, i) => {
    if (i > 0) {
      const conn = document.createElement('div');
      const prevDone = campCompletedStages.has(CAMPAIGN_STAGES[i-1].id);
      conn.className = 'camp-connector-h' + (prevDone ? ' done' : '');
      conn.id = `camp-conn-${i}`;
      row.appendChild(conn);
    }

    const wrap = document.createElement('div');
    wrap.className = 'camp-node-wrap';

    const label = document.createElement('div');
    label.className = 'camp-node-label';
    label.textContent = stage.name;

    const node = document.createElement('div');
    const done = campCompletedStages.has(stage.id);
    const available = i === 0 || campCompletedStages.has(CAMPAIGN_STAGES[i-1].id);
    const selected = campSelectedStage === stage.id;

    node.className = 'camp-node' +
      (done ? ' completed' : '') +
      (selected ? ' selected' : '') +
      (!available ? ' locked' : '');

    if (!done) node.textContent = stage.icon;
    node.onclick = () => {
      if (!available) return;
      campSelectedStage = stage.id;
      buildCampaignMap(); 
      updateCampaignInfo();
    };

    wrap.appendChild(label);
    wrap.appendChild(node);
    row.appendChild(wrap);
  });

  map.appendChild(row);

  const info = document.createElement('div');
  info.id = 'camp-stage-info-box';
  map.appendChild(info);
  updateCampaignInfo();
}

function updateCampaignInfo() {
  const box = document.getElementById('camp-stage-info-box');
  if (!box) return;
  if (!campSelectedStage) {
    box.innerHTML = `<div style="text-align:center;color:var(--text3);font-size:13px;padding:1.5rem;">Select a stage above to see details</div>`;
    return;
  }
  const stage = CAMPAIGN_STAGES.find(s => s.id === campSelectedStage);
  if (!stage) return;
  const done = campCompletedStages.has(stage.id);
  const stageIdx = CAMPAIGN_STAGES.indexOf(stage);
  const available = stageIdx === 0 || campCompletedStages.has(CAMPAIGN_STAGES[stageIdx-1].id);

  const diffPips = Array.from({length:5}).map((_,i) =>
    `<div class="camp-diff-pip${i < stage.diff ? ' filled' : ''}"></div>`
  ).join('');

  box.innerHTML = `
    <div class="camp-stage-info">
      <div class="camp-stage-info-title">${stage.icon} Stage ${stage.name}</div>
      <div class="camp-stage-info-sub">${stage.enemies}</div>
      <div class="camp-difficulty">
        <span class="camp-diff-label">Difficulty:</span>
        ${diffPips}
      </div>
      <div class="info-row" style="margin-bottom:0.5rem;"><span class="info-row-label">Reward</span><span style="color:var(--gold);">${stage.reward}</span></div>
      <div class="info-row" style="margin-bottom:1rem;"><span class="info-row-label">Status</span><span style="color:${done?'var(--green)':available?'var(--blue)':'var(--red)'};">${done?'✓ Completed':available?'Available':'Locked'}</span></div>
      ${available
        ? `<button class="camp-play-btn" onclick="playCampaignStage('${stage.id}')">${done?'🔄 Replay':'⚔️ Deploy Defenses'}</button>`
        : `<button class="camp-play-btn" style="opacity:0.3;cursor:not-allowed;" disabled>🔒 Complete previous stage</button>`
      }
    </div>
  `;
}

function playCampaignStage(stageId) {
  openBattleSetup(stageId);
}

