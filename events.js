'use strict';
// Глобальные события: дерево модулей, «≡», профиль, выход, демо-панель, Esc и «/», клавиатура телефона, смена ширины
/* ═════════════ Global events ═════════════ */
document.addEventListener('click',e=>{
  const t=e.target;let b;
  if(b=t.closest('[data-tog]')){const id=b.dataset.tog;S.open.has(id)?S.open.delete(id):S.open.add(id);store.set('tree',[...S.open]);renderSide();return}
  if(t.closest('#org-open')||t.closest('[data-sh=org]')){closeSheet();go('org','main');return}
  if(t.closest('#me-open')||t.closest('[data-sh=me]')){closeSheet();profileDlg();return}
  if(t.closest('#logout')||t.closest('[data-sh=out]')){closeSheet();logoutDlg();return}
  if(b=t.closest('[data-shmod]')){closeSheet();go(b.dataset.shmod);return}
  if(t.closest('[data-demo-fail]')){FAIL_NEXT=true;closeSheet();renderPage();toast('Демо: список покажет состояние ошибки','alert');return}
  if(b=t.closest('[data-db]')){closeSheet();dbAct(b.dataset.db)}
});
document.addEventListener('change',e=>{
  if(e.target.id==='demo-user'||e.target.id==='demo-user-m'){closeSheet();switchUser(e.target.value)}
  // Переключатель «Данные»: рабочие данные создаются заново только после подтверждения
  if(e.target.hasAttribute('data-demo-data')){const v=e.target.value;e.target.value=DATA_MODE;closeSheet();if(v===DATA_MODE)return;
    confirmDlg({title:v==='empty'?'Перейти на пустую организацию?':'Включить демо-данные?',text:`Рабочие данные будут созданы заново ${v==='empty'?'как у организации сразу после регистрации':'из demoDB.json'}. Всё введённое пропадёт: если нужно, сначала сделайте «Экспорт TemDB.json».`,ok:'Переключить',danger:true,run:()=>setDataMode(v)})}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(POP){closePop();return}if(MODALS.length){MODALS[MODALS.length-1].close();return}if($('#sheet').classList.contains('open')){closeSheet();return}}
  if(e.key==='/'&&!/input|textarea|select/i.test(document.activeElement.tagName)&&!MODALS.length){e.preventDefault();$('#topbar').classList.add('searching');$('#q').focus()}
});
$('#sheet-cover').onclick=closeSheet;
swipeDown($('#sheet'),()=>$('#sheet'),{cover:$('#sheet-cover'),can:()=>true,close:()=>{closeSheet();const sh=$('#sheet');setTimeout(()=>{sh.style.transition='';sh.style.transform=''},30)}});
// Открытая клавиатура на телефоне прячет нижнюю панель и «+»
document.addEventListener('focusin',e=>{if(isMobile()&&e.target.matches('input:not([type=checkbox]):not([type=radio]),textarea')){$('#app').classList.add('kb');document.body.classList.add('kb')}});
document.addEventListener('focusout',()=>setTimeout(()=>{const a=document.activeElement;if(!a||!a.matches||!a.matches('input:not([type=checkbox]),textarea')){$('#app').classList.remove('kb');document.body.classList.remove('kb')}},50));
let wasMobile=isMobile();addEventListener('resize',()=>{const m=isMobile();if(m!==wasMobile){wasMobile=m;renderShell()}else fitTabs()});
matchMedia('(prefers-color-scheme: dark)').addEventListener&&matchMedia('(prefers-color-scheme: dark)').addEventListener('change',paintTheme);
