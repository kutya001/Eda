'use strict';
// Пример отключаемого модуля «Заявки»: исполнитель и постановщик, срок, подтверждение выполнения (четыре глаза), «На доработку» с причиной
/* ═════════════ Заявки ═════════════ */
const rqDone=r=>['Выполнена','Подтверждена','Отменена'].includes(r.status);
const rqOver=r=>!rqDone(r)&&r.status!=='На подтверждении'&&r.due&&r.due<TODAY;
const rqPend=r=>r.status==='На подтверждении';
function rqTabs(){const v=visRequests();return [{id:'mine',label:'Мне',icon:'user',count:v.filter(r=>r.resp===S.me&&!rqDone(r)).length||''},{id:'by',label:'Поставлены мной',icon:'send'},seeAll('requests')?{id:'all',label:'Все',icon:'list'}:null].filter(Boolean)}
function rqAdd(){return [can('rqEdit')&&{label:'Заявка',icon:'task',run:()=>requestDlg()}]}
function rqCols(){return [
  {key:'title',label:'Заявка',type:'text',w:260,val:r=>r.title},
  {key:'client',label:'Клиент',type:'enum',w:200,val:r=>r.client&&CLM[r.client]?CLM[r.client].name:'Общая'},
  {key:'resp',label:'Исполнитель',type:'enum',w:150,val:r=>empName(r.resp)},
  {key:'due',label:'Срок',type:'date',w:110,val:r=>r.due,html:r=>`<span class="${rqOver(r)?'red':''}">${fmtD(r.due)}</span>`},
  {key:'status',label:'Статус',type:'enum',w:190,val:r=>r.status,html:r=>scaleMini('request',r)},
  {key:'prio',label:'Приоритет',type:'enum',w:120,val:r=>dictName('priority',r.prio)},
  {key:'by',label:'Постановщик',type:'enum',w:150,val:r=>empName(r.by)},
  {key:'confirm',label:'Нужно подтверждение',type:'enum',w:120,val:r=>r.confirm?'Да':'Нет'},
  {key:'over',label:'Просрочена',type:'enum',w:110,val:r=>rqOver(r)?'Да':'Нет'}]}
function renderRequests(body,tab,fresh){const v=visRequests();const gid='rq-'+tab;
  const mine=v.filter(r=>r.resp===S.me&&!rqDone(r)),over=v.filter(rqOver),pend=v.filter(r=>rqPend(r)&&r.resp!==S.me&&(r.by===S.me||can('rqConfirm')));
  body.innerHTML=`<div class="plates">
    ${plate({id:'mine',icon:'task',color:'purple',label:'Мои открытые',value:mine.length})}
    ${plate({id:'over',icon:'clock',color:over.length?'red':'green',label:'Просрочено',value:over.length,sub:over.length?'срок прошёл':'всё в срок'})}
    ${plate({id:'pend',icon:'hourglass',color:pend.length?'yellow':'green',label:'Ждут моего подтверждения',value:pend.length})}
  </div><div id="rg"></div>`;
  body.querySelector('.plates').onclick=e=>{const b=e.target.closest('[data-plate]');if(!b)return;const id=b.dataset.plate;const t=seeAll('requests')?'all':'by';
    if(id==='mine')go('requests','mine',{status:{type:'enum',vals:['Новая','В работе','На доработке']}});if(id==='over')go('requests',t,{over:{type:'enum',vals:['Да']}});if(id==='pend')go('requests',t,{status:{type:'enum',vals:['На подтверждении']}})};
  const rows=()=>{const v=visRequests();return tab==='mine'?v.filter(r=>r.resp===S.me):tab==='by'?v.filter(r=>r.by===S.me):v};
  grid($('#rg',body),{id:gid,cols:rqCols(),show:['title','client','resp','due','status'],rows,title:'title',noun:['заявка','заявки','заявок'],xlsName:'Заявки',rowClass:r=>rqOver(r)?'warn':rqDone(r)?'muted':'',
    actions:rqActions,open:openRequest,preset:S.preset,simulateLoad:fresh,empty:{icon:'task',title:tab==='mine'?'Вам пока не поставили заявок':'Заявок пока нет',add:can('rqEdit')?()=>requestDlg():null}})}
function rqActions(r){const nx=scNext('request',r);const bk=scBack('request',r);return [{label:'Открыть',icon:'right',run:()=>openRequest(r)},
  can('rqEdit')&&r.by===S.me&&!rqDone(r)&&{label:'Изменить',icon:'edit',run:()=>requestDlg(r)},
  nx&&!scWhyNot('request',r,nx)&&{label:`Перевести в «${nx}»`,icon:'check',run:()=>stepTo('request',r,nx)},
  rqPend(r)&&!scWhyNot('request',r,'Подтверждена')&&{label:'На доработку',icon:'refresh',run:()=>reworkDlg(r)},
  can('rollback')&&bk&&{label:`Откатить в «${bk}»`,icon:'history',run:()=>rollbackDlg('request',r,bk)},
  {sep:1},(r.by===S.me||isOwner())&&!rqDone(r)&&{label:'Отменить заявку',icon:'ban',danger:true,run:()=>reasonDlg('Отменить заявку?','Причина отмены','Отменить',w=>setStatus('request',r,'Отменена',w))}]}
// Причина обязательна: «На доработку», отмена, откат
function reasonDlg(title,label,ok,run){openModal({form:true,noMax:true,render:()=>({title,body:`<div class="form">${fld(label,'<textarea class="inp" id="rs-w" rows="3"></textarea>',{req:true,full:true,id:'rs-w'})}</div>`,foot:`<button class="btn ghost" data-close>Назад</button><button class="btn danger" id="rs-ok">${esc(ok)}</button>`,
  mount(el,m){$('#rs-ok',el).onclick=()=>{const w=val(el,'rs-w');if(!setErr(el,'rs-w',w?'':'Укажите причину'))return;m.close();run(w)}}})})}
const reworkDlg=r=>reasonDlg('Вернуть на доработку?','Что исправить','На доработку',w=>{r.rework=w;setStatus('request',r,'На доработке',w)});
function openRequest(r){if(!r)return;let tab='main';
  openModal({size:'mid',live:true,render:m=>{const tabs=[['main','Заявка','task'],['sh','История статусов','history'],['hist','История','list']];let body=cardTabs(tabs,tab,'rt');
    if(tab==='main')body+=`<div class="box">${scaleFull('request',r)}</div>${r.status==='На доработке'&&r.rework?`<div class="note warn">${ic('refresh')}<span><b>Возвращена на доработку:</b> ${esc(r.rework)}</span></div>`:''}${rqPend(r)?`<div class="note">${ic('hourglass')}<span>Ждёт подтверждения: ${esc(empName(r.by))} или сотрудник с правом «${esc(PERM().rqConfirm.name)}». Исполнитель свою заявку не подтверждает.</span></div>`:''}
      <div class="box"><div class="kv"><div><span class="k">Клиент</span><span class="v">${r.client&&CLM[r.client]?`<button class="linkbtn" id="rq-cl">${esc(CLM[r.client].name)}</button>`:'Общая заявка'}</span></div><div><span class="k">Приоритет</span><span class="v">${esc(dictName('priority',r.prio)||'—')}</span></div>
      <div><span class="k">Исполнитель</span><span class="v">${esc(EM[r.resp]?EM[r.resp].fio:'—')}</span></div><div><span class="k">Постановщик</span><span class="v">${esc(empName(r.by))}</span></div>
      <div><span class="k">Срок</span><span class="v ${rqOver(r)?'red':''}">${fmtD(r.due)||'—'}${rqOver(r)?' · просрочена':''}</span></div><div><span class="k">Подтверждение</span><span class="v">${r.confirm?'Требуется':'Не требуется'}</span></div>${auditKv(r)}
      <div style="grid-column:1/-1"><span class="k">Описание</span><span class="v">${esc(r.text||'—')}</span></div></div></div>`;
    if(tab==='sh')body+=`<div class="box">${statusHistHtml('request',r)}</div>`;
    if(tab==='hist')body+=`<div class="box">${histHtml('request',r.id)}</div>`;
    const nx=scNext('request',r);const canNx=nx&&!scWhyNot('request',r,nx);
    return {title:esc(r.title),sub:esc(r.client&&CLM[r.client]?CLM[r.client].name:'Общая'),body,
      foot:`<button class="btn" id="rq-more">${ic('more','sm')}Действия</button><div class="grow"></div>${rqPend(r)&&canNx?`<button class="btn" id="rq-rw">${ic('refresh','sm')}На доработку</button>`:''}${canNx?`<button class="btn cta" id="rq-nx">${ic('check','sm')}${esc(nx==='Подтверждена'?'Подтвердить':nx)}</button>`:''}`,
      mount(el){bindCardTabs(el,'rt',t=>{tab=t;m.draw()});bindScale(el,'request',r);$('#rq-more',el).onclick=e=>menu(e.currentTarget,rqActions(r).filter(x=>x&&x.label!=='Открыть'));
        if($('#rq-nx',el))$('#rq-nx',el).onclick=()=>stepTo('request',r,nx);if($('#rq-rw',el))$('#rq-rw',el).onclick=()=>reworkDlg(r);if($('#rq-cl',el))$('#rq-cl',el).onclick=()=>openClient(CLM[r.client])}}}})}
// «Требуется подтверждение» — начальное значение берётся из учётной политики организации
function requestDlg(r,client){const isNew=!r;
  openModal({form:true,render:()=>({title:isNew?'Новая заявка':'Изменить заявку',body:`<div class="form">
    ${fld('Заявка',inp('rf-t',r?r.title:''),{req:true,full:true,id:'rf-t'})}
    ${fld('Клиент',sel('rf-c',[['','Общая заявка'],...visClients().map(c=>[c.id,c.name])],r?r.client:client||''),{full:true,id:'rf-c'})}
    ${fld('Исполнитель',sel('rf-r',empOpts(),r?r.resp:S.me),{req:true,id:'rf-r'})}
    ${fld('Срок',inp('rf-d',r?r.due:addDays(TODAY,3),'type="date"'),{req:true,id:'rf-d'})}
    ${fld('Приоритет',sel('rf-p',dictOpts('priority',r&&r.prio),r?r.prio:(DICT.priority.items[1]||{}).code),{id:'rf-p'})}
    ${fld('Подтверждение',`<label class="row" style="gap:8px;min-height:38px"><input type="checkbox" id="rf-cf" ${(r?r.confirm:ORG.policy.confirm!==false)?'checked':''}>Требуется подтверждение ${tipI('Исполнитель отмечает «На подтверждении», постановщик подтверждает или возвращает на доработку. Значение по умолчанию задаёт учётная политика.')}</label>`,{id:'rf-cf'})}
    ${fld('Описание',`<textarea class="inp" id="rf-x" rows="3">${esc(r?r.text:'')}</textarea>`,{full:true,id:'rf-x'})}</div>`,
    foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="rf-ok">${isNew?'Поставить':'Сохранить'}</button>`,
    mount(el,m){$('#rf-ok',el).onclick=()=>{const t=val(el,'rf-t'),d=val(el,'rf-d');let ok=setErr(el,'rf-t',t?'':'Укажите, что сделать');ok=setErr(el,'rf-d',d?'':'Укажите срок')&&ok;if(!ok)return;
      const v={title:t,client:val(el,'rf-c'),resp:val(el,'rf-r'),due:d,prio:val(el,'rf-p'),confirm:$('#rf-cf',el).checked,text:val(el,'rf-x')};
      if(isNew){const n=born({id:uid('r'),by:S.me,...v});stStart(n,'Новая','Заявка поставлена');REQUESTS.push(n);log('request',n.id,'Заявка поставлена',n);m.close();refreshAll();toast('Заявка поставлена','task')}
      else{Object.entries(v).forEach(([k,x])=>{if(String(r[k]??'')!==String(x??'')){log('request',r.id,`${k}: ${r[k]||'—'} → ${x||'—'}`,r);r[k]=x}});m.close();refreshAll();toast('Сохранено')}}}})})}
