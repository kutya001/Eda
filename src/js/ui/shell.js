'use strict';
// Оболочка: левая панель, нижняя панель телефона, меню «≡», страница модуля (вкладки, «+ Добавить», статистика), верхняя панель, демо-панель
/* ═════════════ Shell rendering ═════════════ */
// Счётчик у модуля в меню и в нижней панели: модуль отдаёт его функцией badge() из реестра
const modBadge=m=>{const n=m.badge?m.badge():0;return n?`<span class="badge red" title="Требует внимания">${n}</span>`:''};
const brandHtml=()=>`<div class="brand"><div class="logo" aria-hidden="true"><i></i><i></i><i></i></div><div><div class="brand-name">${esc(APP.name)}</div><div class="mode">${isAdmin()?'Admin':isCust()?'Заказчик':'Business'}</div></div></div>`;
// 4 модуля нижней панели телефона — свои у каждой роли (config.js → bnav.roles)
const bnavIds=()=>isAdmin()?APP.bnav.admin:APP.bnav.roles[me().role]||APP.bnav.business;
function renderSide(){
  const l=mods();
  let h=brandHtml()+`<nav class="tree">`;
  l.forEach(m=>{const tabs=modTabs(m);const open=S.open.has(m.id);const on=S.mod===m.id;
    h+=`<div class="ti ${on?'on':''}"><a href="#${m.id}" data-go="${m.id}" ${on?'aria-current="page"':''}>${ic(m.icon)}<span>${esc(m.title)}</span>${modBadge(m)}</a>${tabs.length?`<button class="tog ${open?'open':''}" data-tog="${m.id}" aria-label="${open?'Свернуть':'Раскрыть'} вкладки" aria-expanded="${open}">${ic('right','sm')}</button>`:''}</div>`;
    if(tabs.length&&open)h+=`<div class="subtree">${tabs.map(t=>`<a class="sti ${on&&S.tab===t.id?'on':''}" href="#${m.id}.${t.id}">${ic(t.icon||'right')}<span>${esc(t.label)}</span>${t.count!=null&&t.count!==''?`<span class="badge ${t.red&&t.count?'red':''}" style="margin-left:auto">${t.count}</span>`:''}</a>`).join('')}</div>`;
  });
  h+=`</nav><div class="side-foot">`;
  if(!isAdmin())h+=`<button class="orgbtn" id="org-open" title="${isCust()?'Организация, у которой вы заказываете':'Профиль организации'}"><span class="av">${ic('landmark','sm')}</span><span style="min-width:0"><div class="o-n">${esc(ORG.name||'Организация')}</div><div class="o-s">${esc(isCust()?(CUM[me().cust]||{}).name||'':roleName(me().role))}</div></span></button>`;
  h+=`<div class="foot-row"><button class="btn ghost sm" id="me-open">${ic('user','sm')}${esc(me().short||'Мой профиль')}</button><button class="btn ghost sm" id="logout">${ic('logout','sm')}Выйти</button></div>`;
  h+=demoBox()+`</div>`;
  $('#side').innerHTML=h;
}
// Демо-панель прототипа: «Войти как», «Данные: Демо / Пустая организация», экспорт и загрузка рабочих данных
function demoBox(){return `<div class="demo"><div class="row" style="gap:6px"><b>Прототип ${esc(APP.ver)}</b></div><label>Данные:</label>${sel('demo-data-x',[['demo','Демо-данные'],['empty','Пустая организация']],DATA_MODE,'data-demo-data aria-label="Данные макета"')}<label for="demo-user">Войти как:</label>${userSel('demo-user')}<button type="button" class="linkbtn" data-demo-fail style="align-self:flex-start">Показать ошибку загрузки списка</button><label>Данные прототипа:</label><div class="demo-db"><button type="button" class="linkbtn" data-db="export">Экспорт TemDB.json</button><button type="button" class="linkbtn" data-db="load">Загрузить TemDB.json</button><button type="button" class="linkbtn" data-db="clear">Очистить рабочие данные</button><button type="button" class="linkbtn" data-db="ref">Экспорт refDB.json</button></div><span>${DATA_MODE==='empty'?'Организация как сразу после регистрации.':'Демо-данные из demoDB.json.'} Все изменения сохраняются в этом браузере (TemDB). Файлы данных: ${DBSRC.demo.from}.</span></div>`}
// «Войти как»: все сотрудники и представители заказчиков по организациям, плюс администратор платформы
function userSel(id){const cur=isAdmin()?'admin':DB.cur+':'+S.me;return `<select class="inp" id="${id}">${Object.entries(DB.tenants).map(([tid,t])=>`<optgroup label="${esc(t.organization.name)}">${t.employees.filter(e=>e.active!==false&&e.status!=='Приглашён').map(e=>{const v=tid+':'+e.id;const rn=(t.roles.find(r=>r.id===e.role)||{}).name||'';return `<option value="${v}" ${v===cur?'selected':''}>${esc(e.short)} — ${esc(rn)}${e.cust?' · '+esc((t.customers.find(c=>c.id===e.cust)||{}).name||''):''}</option>`}).join('')}</optgroup>`).join('')}<option value="admin" ${cur==='admin'?'selected':''}>Администратор платформы</option></select>`}
function renderBnav(){
  const ids=bnavIds();const ms=mods();const l=ids.map(id=>ms.find(m=>m.id===id)).filter(Boolean);
  $('#bnav').innerHTML=l.map(m=>`<a class="bn ${S.mod===m.id?'on':''}" href="#${m.id}" data-go="${m.id}" ${S.mod===m.id?'aria-current="page"':''}>${ic(m.icon)}<span>${esc(m.short)}</span>${modBadge(m)}</a>`).join('');
}
// Выдвижная панель «≡» на телефоне: платформа и режим, «Другие модули», организация, профиль, выход, демо-панель
function renderSheet(){
  const ids=bnavIds();const rest=mods().filter(m=>!ids.includes(m.id));
  $('#sheet').innerHTML=`<div class="grabber"></div>${brandHtml().replace('class="brand"','class="brand" style="padding:6px 4px 10px"')}
  ${rest.length?`<div class="sheet-mods" role="navigation" aria-label="Другие модули">${rest.map(m=>`<button data-shmod="${m.id}" class="${S.mod===m.id?'on':''}">${ic(m.icon)}<span>${esc(m.title)}</span>${modBadge(m).replace('class="badge','style="margin-left:auto" class="badge')}</button>`).join('')}</div>`:''}
  ${isAdmin()?'':`<button class="orgbtn" data-sh="org"><span class="av">${ic('landmark','sm')}</span><span><div class="o-n">${esc(ORG.name||'Организация')}</div><div class="o-s">${myTenants().length>1?'Сменить организацию':'Профиль организации'}</div></span></button>`}
  <button class="orgbtn" data-sh="me"><span class="av round">${initials(me().fio)}</span><span><div class="o-n">Мой профиль</div><div class="o-s">${esc(me().fio)}</div></span></button>
  <button class="orgbtn" data-sh="out"><span class="av">${ic('logout','sm')}</span><span><div class="o-n">Выйти из аккаунта</div></span></button>${demoBox().replace('id="demo-user"','id="demo-user-m"').replace('for="demo-user"','for="demo-user-m"').replace('id="demo-data-x"','id="demo-data-m"')}`;
}
function openSheet(){renderSheet();$('#sheet').classList.add('open');$('#sheet-cover').hidden=false;if(!(history.state&&history.state.sheet))history.pushState({sheet:1},'',location.href)}
function closeSheet(pop){const was=$('#sheet').classList.contains('open');$('#sheet').classList.remove('open');$('#sheet-cover').hidden=true;if(was&&!pop&&history.state&&history.state.sheet)history.replaceState(null,'',location.href)}
addEventListener('popstate',()=>{if($('#sheet')&&$('#sheet').classList.contains('open'))closeSheet(true)});

// Плашка статистики: кликабельная, ставит фильтр списка (паттерны, раздел 3)
function plate({icon,color,label,value,unit,sub,on,id}){return `<button class="plate ${on?'on':''}" data-plate="${id}"><span class="pl-top"><span class="pl-dot ${color}">${ic(icon)}</span>${esc(label)}</span><span class="pl-val">${value}${unit?`<small>${unit}</small>`:''}</span>${sub?`<span class="pl-sub">${sub}</span>`:''}</button>`}

// Страница модуля: ряд вкладок, «Статистика», «+ Добавить» (меню, если пунктов несколько); на телефоне — круглая «+»
function renderPage(fresh){
  const m=curMod();const tabs=modTabs(m);const page=$('#page');const pane=$('#pane');
  const keep=fresh?0:pane.scrollTop;
  ACTIVE=[];closePop();
  // Организация приостановлена — «+ Добавить» скрыт; курьер без связи — рабочим остаётся только «Маршрут»
  const adds=m.add&&!frozen()?m.add().filter(Boolean):[];
  const banner=frozen()?`<div class="note warn frozen-note">${ic('lock')}<span><b>Организация ${ORG.plat.status==='Закрыта'?'закрыта':'приостановлена'}.</b> ${isCust()?'Новые заказы временно не принимаются.':'Данные открыты только для просмотра: создавать и менять записи нельзя. '+(isOwner()?'Продлите подписку в «Моя организация → Подписка».':'Обратитесь к владельцу организации.')}</span></div>`:
    S.offline&&m.id!=='route'?`<div class="note warn">${ic('wifi')}<span><b>Нет связи.</b> Без сети работает только «Маршрут»: здесь показаны данные на момент последней загрузки.</span></div>`:'';
  page.innerHTML=banner+`<div class="tabrow"><span class="tr-l"></span>
  ${tabs.length?`<div class="tabs" id="tabs" role="tablist">${tabs.map((t,ti)=>`${ti&&t.group&&t.group!==tabs[ti-1].group?`<span class="tab-sep" aria-hidden="true"></span>`:''}<a class="tab ${S.tab===t.id?'on':''}" role="tab" aria-selected="${S.tab===t.id}" href="#${m.id}.${t.id}" title="${esc(t.group?t.group+' · '+t.label:t.label)}">${ic(t.icon||'right')}<span class="lbl">${esc(t.label)}</span>${t.count!=null&&t.count!==''?`<span class="badge ${t.red&&t.count?'red':''}">${t.count}</span>`:''}</a>`).join('')}</div>`:''}<div class="tr-r"><button type="button" class="icon-btn stat-btn" id="stat-btn" hidden aria-label="Статистика" title="Скрыть или показать статистику">${ic('chart')}</button>${adds.length?`<button class="btn cta add-btn" id="add-btn" title="Добавить">${ic('plus')}<span class="lbl">Добавить</span>${adds.length>1?ic('down','sm'):''}</button>`:''}</div></div><div id="mbody" style="display:flex;flex-direction:column;gap:14px;min-width:0"></div>`;
  const runAdd=b=>{if(adds.length===1)adds[0].run();else menu(b,adds.map(a=>a.sep?a:({label:a.label,icon:a.icon,run:a.run,badge:a.beta?'Бета':'',sub:a.sub||''})))};
  const ab=$('#add-btn');if(ab)ab.onclick=()=>runAdd(ab);
  const fab=$('#fab');fab.hidden=!adds.length;fab.innerHTML=ic('plus');fab.onclick=()=>runAdd(fab);
  m.render($('#mbody'),S.tab,fresh);
  // Статистика модуля: скрывается значком «Статистика»; выбор — на пользователя и модуль; по умолчанию показана на ПК и скрыта на телефоне
  {const sb=$('#stat-btn');const has=!!$('#mbody .plates');sb.hidden=!has;const k='stats.'+m.id;const off=()=>store.get(k,isMobile()?'off':'on')==='off';const ap=()=>{page.classList.toggle('nostats',off());sb.classList.toggle('on',!off());sb.setAttribute('aria-pressed',String(!off()));sb.title=off()?'Показать статистику':'Скрыть статистику'};ap();sb.onclick=()=>{store.set(k,off()?'on':'off');ap();fitTabs();track('stats')}}
  S.preset=null;
  fitTabs();
  pane.scrollTop=keep;
  $('#q-scope').textContent=tabs.length?(tabs.find(t=>t.id===S.tab)||{}).label||'':m.title;
  {const tl=tabs.length?(tabs.find(t=>t.id===S.tab)||{}).label||'':'';$('#tb-mod').textContent=m.title;$('#tb-tab').textContent=tl;$('#tb-tab').hidden=!tl;const tb=$('#tb-title');tb.classList.remove('full');tb.title=m.title+(tl?' · '+tl:'');tb.onclick=()=>tb.classList.toggle('full');const ti=$('#tb-info');ti.innerHTML=ic('info','sm');ti.onclick=()=>openPop(ti,`<h4>${esc(m.title)}</h4><div style="font-size:13px;line-height:1.5;max-width:300px">${esc(m.desc)}</div>`,{cls:'pad'})}
}
// Ряд вкладок не помещается: на ПК сначала сжимаются отступы, потом прячутся значки; на телефоне — только значки; активная вкладка всегда видна
function fitTabs(){const t=$('#tabs');if(!t)return;const ab=$('#add-btn');const over=()=>t.scrollWidth>t.clientWidth+2;t.classList.remove('compact','tight','tight2');if(ab)ab.classList.remove('slim');
  if(isMobile()){if(ab&&over())ab.classList.add('slim');if(over())t.classList.add('compact')}else{if(over())t.classList.add('tight');if(over())t.classList.add('tight2')}
  const on=$('.tab.on',t);if(on&&over())t.scrollLeft=Math.max(0,on.offsetLeft-(t.clientWidth-on.offsetWidth)/2)}
function renderShell(fresh){$('#app').classList.toggle('nav-hidden',S.navHidden&&!isMobile());renderSide();renderBnav();renderTopExtra();renderPage(fresh)}
// Верхняя панель: переключатель «Организация» (если человек состоит в нескольких) и колокольчик уведомлений
function renderTopExtra(){const ts=myTenants();const ob=$('#org-sw');ob.hidden=ts.length<2;ob.innerHTML=`${ic('landmark','sm')}<span>${esc(ORG.name)}</span>${ic('down','sm')}`;
  ob.onclick=()=>menu(ob,ts.map(t=>({label:t.name,icon:'landmark',on:t.id===DB.cur,sub:t.id===DB.cur?'Сейчас':'',run:()=>{if(t.id!==DB.cur)switchTenant(t.id)}})));
  const bl=$('#bell');bl.hidden=isAdmin();const n=unread();bl.innerHTML=ic('bell')+(n?`<span class="badge red">${n}</span>`:'');bl.onclick=()=>bellPop(bl)}
function bellPop(b){const ns=myNotices().slice(0,30);
  openPop(b,`<div class="nt-pop"><div class="nt-h"><b>Уведомления</b><span class="grow"></span>${ns.some(n=>!n.read.includes(S.me))?'<button class="linkbtn" data-nt-all>Прочитать все</button>':''}</div>${ns.length?ns.map(n=>`<button class="nt ${n.read.includes(S.me)?'':'new'}" data-nt="${n.id}"><span class="nt-t">${esc(n.text)}</span><span class="nt-w">${fmtDT(n.at)}</span></button>`).join(''):'<div class="muted" style="padding:10px">Уведомлений пока нет.</div>'}<div class="nt-f">Отключить отдельные уведомления можно в «Мой профиль»</div></div>`,{cls:'pad',mount(el){
    el.onclick=e=>{const a=e.target.closest('[data-nt-all]');if(a){myNotices().forEach(n=>{if(!n.read.includes(S.me))n.read.push(S.me)});closePop();renderTopExtra();return}
      const x=e.target.closest('[data-nt]');if(!x)return;const n=NOTICES.find(q=>q.id===x.dataset.nt);if(!n.read.includes(S.me))n.read.push(S.me);closePop();if(n.link){const[m,t]=n.link.split('.');go(m,t)}else renderTopExtra()}}})}
function refreshAll(){reindex();const live=MODALS.filter(m=>m.o.live);renderShell();live.forEach(m=>m.draw())}

/* ═════════════ Top bar ═════════════ */
function tick(){const n=tzNow();TODAY=n.iso;$('#clock').innerHTML=`<span class="d">${fmtD(n.iso)}</span>${n.hm}`;$('#clock').title=`${fmtD(n.iso)} ${n.hm}, ${APP.tzLabel}`}
function effTheme(){const a=document.documentElement.getAttribute('data-theme');return a||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}
function paintTheme(){$('#theme').innerHTML=ic(effTheme()==='dark'?'sun':'moon')}
function initTop(){
  $('#burger').innerHTML=ic('menu');$('#help').innerHTML=ic('help');$('#help').onclick=()=>helpDlg();$('#search-ic').outerHTML=ic('search');$('#q-open').innerHTML=ic('search');paintTheme();
  $('#burger').onclick=()=>{if(isMobile()){openSheet();return}S.navHidden=!S.navHidden;store.set('nav',S.navHidden);$('#app').classList.toggle('nav-hidden',S.navHidden);fitTabs()};
  $('#theme').onclick=()=>{track('theme');const t=effTheme()==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem(APP.prefix+'.theme',t)}catch(e){}paintTheme()};
  let deb;$('#q').addEventListener('input',e=>{clearTimeout(deb);deb=setTimeout(()=>{S.search=e.target.value;if(S.search)track('search');ACTIVE.forEach(g=>{g.s.page=0;g.refresh()})},120)});
  $('#q-open').onclick=()=>{$('#topbar').classList.add('searching');$('#q').focus()};
  $('#q').addEventListener('blur',()=>{if(!S.search)$('#topbar').classList.remove('searching')});
  tick();setInterval(tick,20000);
}
// «?» — статья о текущем модуле; в шаблоне показывается описание модуля из реестра (в Buhuchet.kg — статья «Базы знаний»)
function helpDlg(){const m=curMod();openModal({noMax:true,render:()=>({title:'Помощь: '+esc(m.title),body:`<p style="margin:0;line-height:1.55">${esc(m.desc)}</p>${m.help?`<div class="note" style="margin-top:12px">${ic('info')}<span>${m.help}</span></div>`:''}`,foot:'<button class="btn cta" data-close>Понятно</button>'})})}
