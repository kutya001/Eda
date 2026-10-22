'use strict';
// Пример основного модуля «Клиенты»: список с плашками-фильтрами, карточка с вкладками, форма, ответственный, шкала «Обслуживание», загрузка из Excel
/* ═════════════ Клиенты ═════════════ */
// Значения справочника для выбора: только включённые; уже выбранное отключённое значение остаётся в записи как есть
const dictOpts=(id,cur)=>DICT[id].items.filter(x=>x.active!==false||x.code===cur).sort((a,b)=>a.order-b.order).map(x=>[x.code,x.name+(x.active===false?' (отключено)':'')]);
const dictName=(id,code)=>{const x=DICT[id].items.find(i=>i.code===code);return x?x.name:''};
const empOpts=()=>EMP.filter(e=>e.active!==false).map(e=>[e.id,`${e.short} · ${(ROLES.find(r=>r.id===e.role)||{}).name||''}`]);
const openReqs=c=>REQUESTS.filter(r=>r.client===c.id&&!['Выполнена','Подтверждена','Отменена'].includes(r.status));

function clTabs(){return [{id:'all',label:'Все клиенты',icon:'building'},{id:'mine',label:'Мои',icon:'user'}]}
function clAdd(){return [can('clEdit')&&{label:'Клиент',icon:'building',run:()=>clientDlg()},can('clImport')&&{label:'Загрузка из Excel',icon:'upload',run:()=>clImportDlg()}]}
function clCols(){return [
  {key:'name',label:'Название',type:'text',w:240,val:c=>c.name},
  {key:'inn',label:'ИНН',type:'text',w:130,val:c=>c.inn,cls:'mono'},
  {key:'cat',label:'Категория',type:'enum',w:150,val:c=>dictName('category',c.cat)},
  {key:'resp',label:'Ответственный',type:'enum',w:150,val:c=>empName(c.resp)},
  {key:'open',label:'Открытых заявок',type:'int',w:110,num:1,val:c=>openReqs(c).length},
  {key:'status',label:'Обслуживание',type:'enum',w:170,val:c=>c.status,html:c=>scaleMini('client',c)},
  {key:'phone',label:'Телефон',type:'text',w:150,val:c=>c.phone},
  {key:'city',label:'Город',type:'enum',w:120,val:c=>c.city},
  {key:'fee',label:'Стоимость в месяц',type:'money',w:140,num:1,total:1,val:c=>c.fee},
  {key:'start',label:'Дата начала',type:'date',w:120,val:c=>c.start}]}
function renderClients(body,tab,fresh){
  const all=visClients(true),act=all.filter(c=>c.status!=='В архиве');const gid='cl-'+tab;const g=GS[gid];const f=k=>!!(g&&g.filters&&g.filters[k]);
  const noResp=act.filter(c=>!c.resp).length,pau=act.filter(c=>c.status==='Приостановлен').length,arc=all.filter(c=>c.status==='В архиве').length;
  body.innerHTML=`<div class="plates">
    ${plate({id:'act',icon:'building',color:'blue',label:'На обслуживании',value:act.length,sub:seeAll('clients')?'вся организация':'закреплены за вами'})}
    ${plate({id:'noresp',icon:'alert',color:noResp?'orange':'green',label:'Без ответственного',value:noResp,sub:noResp?'назначьте ответственного':'все закреплены',on:f('resp')})}
    ${plate({id:'pau',icon:'pause',color:'yellow',label:'Приостановлены',value:pau,on:f('status')&&g.filters.status.vals.includes('Приостановлен')})}
    ${plate({id:'arc',icon:'archive',color:'gray',label:'В архиве',value:arc,sub:'показать в списке',on:f('status')&&g.filters.status.vals.includes('В архиве')})}
  </div><div id="cg"></div>`;
  // Плашка ставит фильтр в этом же списке (а не открывает отдельную вкладку)
  body.querySelector('.plates').onclick=e=>{const b=e.target.closest('[data-plate]');if(!b||!GS[gid])return;const s=GS[gid];const id=b.dataset.plate;s.filters={};
    if(id==='noresp')s.filters.resp={type:'enum',vals:['']};if(id==='pau')s.filters.status={type:'enum',vals:['Приостановлен']};if(id==='arc')s.filters.status={type:'enum',vals:['В архиве']};s.page=0;renderPage()};
  const rows=()=>{const s=GS[gid];const fa=s&&s.filters.status&&s.filters.status.vals.includes('В архиве');const v=visClients(true).filter(c=>fa||c.status!=='В архиве');return tab==='mine'?v.filter(c=>c.resp===S.me):v};
  grid($('#cg',body),{id:gid,cols:clCols(),show:['name','inn','cat','resp','open','status'],rows,title:'name',noun:['клиент','клиента','клиентов'],xlsName:'Клиенты',
    rowClass:c=>!c.resp&&c.status!=='В архиве'?'warn':c.status!=='Активен'?'muted':'',actions:clActions,open:openClient,sort:{key:'name',dir:1},preset:S.preset,simulateLoad:fresh,
    bulk:can('clEdit')?[{label:'Назначить ответственного',icon:'user',run:(rs,done)=>respDlg(rs,done)}]:null,
    empty:{icon:'building',title:tab==='mine'?'За вами пока не закреплены клиенты':'Клиентов пока нет',add:tab==='all'&&can('clEdit')?()=>clientDlg():null}});
}
function clActions(c){return [{label:'Открыть',icon:'right',run:()=>openClient(c)},can('clEdit')&&{label:'Изменить',icon:'edit',run:()=>clientDlg(c)},can('clEdit')&&{label:'Сменить ответственного',icon:'user',run:()=>respDlg([c])},
  feat('requests')&&can('rqEdit')&&{label:'Новая заявка',icon:'task',run:()=>requestDlg(null,c.id)},
  can('rollback')&&scBack('client',c)&&{label:`Откатить в «${scBack('client',c)}»`,icon:'history',run:()=>rollbackDlg('client',c,scBack('client',c))},
  {sep:1},can('clArchive')&&c.status!=='В архиве'&&{label:'В архив',icon:'archive',danger:true,run:()=>confirmDlg({title:'Отправить в архив?',text:`«${esc(c.name)}» пропадёт из рабочих списков, данные сохранятся. Вернуть можно откатом статуса.`,ok:'В архив',danger:true,run:()=>setStatus('client',c,'В архиве')})}]}
// Карточка: окно поверх списка (на телефоне — шторка), «На весь экран», вкладки со счётчиками, шкала статусов, история
function openClient(c){if(!c)return;let tab='main';
  openModal({size:'wide',live:true,render:m=>{const rq=REQUESTS.filter(r=>r.client===c.id);const tabs=[['main','Основное','building'],feat('requests')&&can('rqView')?['req','Заявки','task',openReqs(c).length||'']:null,['sh','История статусов','history'],['hist','История','list']].filter(Boolean);
    let body=cardTabs(tabs,tab,'ct');
    if(tab==='main')body+=`<div class="box">${scaleFull('client',c)}</div><div class="box"><div class="kv">
      <div><span class="k">ИНН</span><span class="v mono">${esc(c.inn||'—')}</span></div><div><span class="k">Категория</span><span class="v">${esc(dictName('category',c.cat)||'—')}</span></div>
      <div><span class="k">Ответственный</span><span class="v">${esc(EM[c.resp]?EM[c.resp].fio:'Не назначен')}</span></div><div><span class="k">Телефон</span><span class="v">${esc(c.phone||'—')}</span></div>
      <div><span class="k">Город</span><span class="v">${esc(c.city||'—')}</span></div><div><span class="k">Дата начала</span><span class="v">${fmtD(c.start)||'—'}</span></div>
      <div><span class="k">Стоимость в месяц</span><span class="v">${c.fee?money(c.fee):'—'}</span></div>${auditKv(c)}
      <div style="grid-column:1/-1"><span class="k">Заметка</span><span class="v">${esc(c.note||'—')}</span></div></div></div>`;
    if(tab==='req')body+=rq.length?'<div id="cl-rq"></div>':`<div class="state">${ic('task','lg')}<b>Заявок по клиенту пока нет</b>${can('rqEdit')?`<button class="btn cta" id="cl-rq-add">${ic('plus')}Заявка</button>`:''}</div>`;
    if(tab==='sh')body+=`<div class="box">${statusHistHtml('client',c)}</div>`;
    if(tab==='hist')body+=`<div class="box">${histHtml('client',c.id)}</div>`;
    return {title:esc(c.name),sub:esc(dictName('category',c.cat)),body,
      foot:`<button class="btn" id="cl-more">${ic('more','sm')}Действия</button><div class="grow"></div>${can('clEdit')?`<button class="btn cta" id="cl-edit">${ic('edit','sm')}Изменить</button>`:''}`,
      mount(el){bindCardTabs(el,'ct',t=>{tab=t;m.draw()});bindScale(el,'client',c);
        $('#cl-more',el).onclick=e=>menu(e.currentTarget,clActions(c).filter(x=>x&&x.label!=='Открыть'));if($('#cl-edit',el))$('#cl-edit',el).onclick=()=>clientDlg(c);
        if($('#cl-rq-add',el))$('#cl-rq-add',el).onclick=()=>requestDlg(null,c.id);
        if($('#cl-rq',el))grid($('#cl-rq',el),{id:'cl-rq',cols:rqCols().filter(x=>x.key!=='client'),show:['title','resp','due','status'],rows:()=>REQUESTS.filter(r=>r.client===c.id),title:'title',open:openRequest,exportable:false,audit:false,firstRun:false})}}}})}
// Форма: обязательные поля отмечены, ошибки под полем; на телефоне короткие поля встают по два (mobile-pack.js)
function clientDlg(c){const isNew=!c;const v0=c?c._v||0:0;
  openModal({form:true,render:()=>({title:isNew?'Новый клиент':'Изменить клиента',sub:isNew?'':esc(c.name),body:`<div class="form">
    ${fld('Название',inp('cf-name',c?c.name:''),{req:true,full:true,id:'cf-name'})}
    ${fld('ИНН',inp('cf-inn',c?c.inn:'','inputmode="numeric" class="inp mono"'),{req:true,id:'cf-inn',hint:'14 цифр'})}
    ${fld('Телефон',inp('cf-phone',c?c.phone:'','inputmode="tel"'),{id:'cf-phone'})}
    ${fld('Категория',sel('cf-cat',[['','—'],...dictOpts('category',c&&c.cat)],c?c.cat:''),{id:'cf-cat'})}
    ${fld('Ответственный',sel('cf-resp',[['','Не назначен'],...empOpts()],c?c.resp:(seeAll('clients')?'':S.me)),{id:'cf-resp'})}
    ${fld('Город',inp('cf-city',c?c.city:''),{id:'cf-city'})}
    ${fld('Стоимость в месяц, '+APP.currency,inp('cf-fee',c&&c.fee?String(c.fee).replace('.',','):'','inputmode="decimal"'),{id:'cf-fee'})}
    ${fld('Заметка',`<textarea class="inp" id="cf-note" rows="3">${esc(c?c.note:'')}</textarea>`,{full:true,id:'cf-note'})}</div>`,
    foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="cf-ok">${isNew?'Добавить':'Сохранить'}</button>`,
    mount(el,m){$('#cf-ok',el).onclick=()=>{const name=val(el,'cf-name'),inn=val(el,'cf-inn').replace(/\s/g,''),fee=val(el,'cf-fee');
      let ok=setErr(el,'cf-name',name?'':'Укажите название');
      ok=setErr(el,'cf-inn',!/^\d{14}$/.test(inn)?'ИНН — 14 цифр':CLIENTS.some(x=>x.inn===inn&&x!==c)?'Клиент с таким ИНН уже есть (в том числе в архиве)':'')&&ok;
      ok=setErr(el,'cf-fee',fee&&isNaN(+fee.replace(',','.').replace(/\s/g,''))?'Введите число':'')&&ok;if(!ok)return;
      if(c&&stale(c,v0))return;
      const d={name,inn,phone:val(el,'cf-phone'),cat:val(el,'cf-cat'),resp:val(el,'cf-resp'),city:val(el,'cf-city'),fee:fee?+fee.replace(',','.').replace(/\s/g,''):0,note:val(el,'cf-note')};
      if(isNew){const n=born({id:uid('c'),...d,start:TODAY});stStart(n,'Активен','Клиент добавлен');CLIENTS.push(n);log('client',n.id,'Клиент добавлен',n);m.close();refreshAll();toast('Клиент добавлен');openClient(n)}
      else{const ch=Object.entries(d).filter(([k,v])=>String(c[k]??'')!==String(v??''));ch.forEach(([k,v])=>{log('client',c.id,`${k}: ${c[k]||'—'} → ${v||'—'}`,c);c[k]=v});m.close();refreshAll();toast(ch.length?'Сохранено':'Изменений нет')}}}})})}
function respDlg(cs,done){
  openModal({form:true,render:()=>({title:cs.length>1?`Ответственный для ${cs.length} клиентов`:'Сменить ответственного',sub:cs.length>1?'':esc(cs[0].name),
    body:`<div class="form">${fld('Ответственный',sel('rs-e',empOpts(),cs.length===1?cs[0].resp:''),{req:true,full:true,id:'rs-e'})}</div>`,
    foot:'<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="rs-ok">Назначить</button>',
    mount(el,m){$('#rs-ok',el).onclick=()=>{const to=val(el,'rs-e');cs.forEach(c=>{if(c.resp!==to){log('client',c.id,`Ответственный: ${empName(c.resp)||'—'} → ${empName(to)}`,c);c.resp=to}});m.close();done&&done();refreshAll();toast(cs.length>1?`Ответственный назначен: ${cs.length} клиентов`:'Ответственный изменён','user')}}})})}
// Загрузка клиентов списком: сопоставление по ИНН, категория — по названию из справочника, ответственный — по логину или ФИО
function clImportDlg(){const catBy=v=>DICT.category.items.find(x=>x.active!==false&&(x.name.toLowerCase()===v.toLowerCase()||x.code===v));const empBy=v=>EMP.find(e=>e.active!==false&&(e.login===v||e.fio===v||e.short===v));
  ORG.imports=ORG.imports||[];
  importDlg({title:'Загрузка клиентов из Excel',file:'Шаблон клиентов',key:'inn',log:ORG.imports,
    cols:[{key:'name',label:'Название',req:true,hint:'Как в документах'},{key:'inn',label:'ИНН',req:true,hint:'14 цифр',parse:v=>v.replace(/\s/g,''),check:v=>/^\d{14}$/.test(v)?'':'нужно 14 цифр'},
      {key:'phone',label:'Телефон',hint:'+996 …'},{key:'cat',label:'Категория',hint:'Одно из: '+DICT.category.items.filter(x=>x.active!==false).map(x=>x.name).join(', '),parse:v=>{const x=catBy(v);return x?x.code:'?'+v},check:v=>v[0]==='?'?`нет в справочнике «${v.slice(1)}»`:''},
      {key:'resp',label:'Ответственный',hint:'Логин или ФИО сотрудника: '+EMP.filter(e=>e.active!==false).map(e=>e.login).join(', '),parse:v=>{const e=empBy(v);return e?e.id:'?'+v},check:v=>v[0]==='?'?`сотрудник «${v.slice(1)}» не найден`:''},
      {key:'city',label:'Город'},{key:'fee',label:'Стоимость в месяц',hint:'Число, копейки через запятую',parse:v=>+String(v).replace(/\s/g,'').replace(',','.'),check:v=>isNaN(v)||v<0?'не число':''}],
    example:EMP.slice(0,2).map((e,i)=>({name:i?'ИП Пример':'ОсОО «Пример»',inn:i?'20101199000123':'01203201910123',phone:'+996 555 000 00'+i,cat:(DICT.category.items[i]||{}).name||'',resp:e.login,city:'Бишкек',fee:i?3000:5000})),
    find:row=>CLIENTS.find(c=>c.inn===row.inn),
    apply:(nw,ch)=>{nw.forEach(r=>{const {_n,...d}=r;const n=born({id:uid('c'),...d,fee:d.fee||0,start:TODAY});stStart(n,'Активен','Загружен из Excel');CLIENTS.push(n);log('client',n.id,'Клиент загружен из Excel',n)});
      ch.forEach(({rec,diff})=>diff.forEach(d=>{log('client',rec.id,`${d.c.label}: ${d.from||'—'} → ${d.to} (из Excel)`,rec);rec[d.c.key]=d.to}))}})}
