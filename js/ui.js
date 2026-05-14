// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function switchSection(name){
  ['base','campaign','pvp'].forEach(s=>{
    const el=document.getElementById('section-'+s);
    if(el) el.style.display=s===name?'flex':'none';
    const btn=document.getElementById('nav-'+s);
    if(btn) btn.classList.toggle('active',s===name);
  });
}
function switchBaseTab(name){
  ['resources','research','inventory','crafting','settings'].forEach(t=>{
    const p=document.getElementById('base-panel-'+t);
    if(p) p.classList.toggle('active',t===name);
  });
  document.querySelectorAll('#base-tabs .ctab').forEach((btn,i)=>{
    btn.classList.toggle('active',['resources','research','inventory','crafting','settings'][i]===name);
  });
}

// ═══════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════
let toastTimer=null;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2500);
}

window.addEventListener('resize', () => {
  if (document.getElementById('battle-game')?.style.display !== 'none') {
    resizeBattleCanvas();
  }
});
</script>
</body>
</html>
