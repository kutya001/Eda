'use strict';
// Модуль «Заказчики»: вкладки по статусу обслуживания, карточка (данные, точки доставки, заказы, регулярные, цены, счета и оплаты, доступ в приложение, история), форма, загрузка из Excel
/* ═════════════ Заказчики ═════════════ */
function cuTabs(){const v=visCusts(true);return [{id:'act',label:'Активные',icon:'building',count:v.filter(c=>c.status==='Активен').length},{id:'pau',label:'Приостановлены',icon:'pause',count:v.filter(c=>c.status==='Приостановлен').length||''},{id:'arc',label:'Архив',icon:'archive'}]}
function cuAdd(){return [can('cuEdit')&&{label:'Заказчик',icon:'building',run:()=>custDlg()},can('cuImport')&&{label:'Загрузка из Excel',icon:'upload',run:()=>cuImportDlg()}]}
const CU_ST={act:'Активен',pau:'Приостановлен',arc:'В архиве'};
function cuCols(){return [
  {key:'name',label:'Наименование',type:'text',w:240,val:c=>c.name},
  {key:'type',label:'Тип',type:'enum',w:120,val:c=>dictName('custType',c.type)},
  {key:'phone',label:'Телефон',type:'text',w:150,val:c=>c.phone},
  {key:'pts',label:'Точек',type:'int',w:80,num:1,val:c=>c.points.length},
  {key:'debt',label:'Долг, сом',type:'money',w:120,num:1,total:1,val:c=>debtOf(c.id)},
  {key:'over',label:'Просрочено, сом',type:'money',w:130,num:1,total:1,val:c=>ledgers()[c.id].overdue,html:c=>{const o=ledgers()[c.id].overdue;return o?`<span class="red">${fmtM(o)}</span>`:'<span class="faint">0</span>'}},
  {key:'resp',label:'Ответственный',type:'enum',w:150,val:c=>empName(c.resp)},
  {key:'status',label:'Статус',type:'enum',w:170,val:c=>c.status,html:c=>scaleMini('customer',c)},
  {key:'inn',label:'ИНН',type:'text',w:140,val:c=>c.inn,cls:'mono'},
  {key:'contact',label:'Контактное лицо',type:'text',w:160,val:c=>c.contact},
  {key:'contract',label:'Договор №',type:'text',w:110,val:c=>c.contract},
  {key:'delay',label:'Отсрочка, дней',type:'int',w:110,num:1,val:c=>c.delay},
  {key:'limit',label:'Лимит долга, сом',type:'money',w:130,num:1,val:c=>c.limit==null||c.limit===''?null:+c.limit}]}
function renderCustomers(body,tab,fresh){const gid='cu-'+tab;const all=visCusts(true);const act=all.filter(c=>c.status==='Активен');
  const over=act.filter(c=>ledgers()[c.id].overdue>0),lim=act.filter(c=>limitOver(c));const debt=act.reduce((a,c)=>a+Math.max(0,debtOf(c.id)),0);
  body.innerHTML=`<div class="plates">
    ${plate({id:'act',icon:'building',color:'blue',label:'Активных заказчиков',value:act.length,sub:seeAll('customers')?'вся организация':'закреплены за вами'})}
    ${plate({id:'debt',icon:'wallet',color:'purple',label:'Общий долг',value:fmtM(debt,false),unit:'сом'})}
    ${plate({id:'over',icon:'clock',color:over.length?'red':'green',label:'С просрочкой',value:over.length,sub:over.length?'долг старше отсрочки':'все платят в срок'})}
    ${plate({id:'lim',icon:'alert',color:lim.length?'orange':'green',label:'Долг выше лимита',value:lim.length})}
  </div><div id="cug"></div>`;
  body.querySelector('.plates').onclick=e=>{const b=e.target.closest('[data-plate]');if(!b||!GS[gid])return;const s=GS[gid];s.filters={};const id=b.dataset.plate;
    if(id==='over')s.filters.over={type:'num',from:0.01,to:null};if(id==='lim')s.filters.lim={type:'enum',vals:['Да']};if(id!=='act'&&tab!=='act')return go('customers','act',s.filters);s.page=0;renderPage()};
  const cols=cuCols().concat([{key:'lim',label:'Долг выше лимита',type:'enum',w:120,val:c=>limitOver(c)?'Да':'Нет'}]);
  grid($('#cug',body),{id:gid,cols,show:['name','type','phone','pts','debt','over','resp','status'],rows:()=>visCusts(true).filter(c=>c.status===CU_ST[tab]),title:'name',noun:['заказчик','заказчика','заказчиков'],xlsName:'Заказчики',
    rowClass:c=>ledgers()[c.id].overdue?'warn':'',actions:cuActions,open:openCust,sort:{key:'name',dir:1},ordered:true,preset:S.preset,simulateLoad:fresh,
    bulk:can('cuEdit')?[{label:'Назначить ответственного',icon:'user',run:(rs,done)=>cuRespDlg(rs,done)}]:null,
    empty:{icon:'building',title:tab==='act'?'Заказчиков пока нет':'Здесь пусто',add:tab==='act'&&can('cuEdit')?()=>custDlg():null}})}
function cuActions(c){const bk=scBack('customer',c);return [{label:'Открыть',icon:'right',run:()=>openCust(c)},
  can('ordEdit')&&c.status==='Активен'&&{label:'Новый заказ',icon:'task',run:()=>orderDlg(null,{cust:c.id})},
  can('myDocs')&&{label:'Акт сверки',icon:'file',run:()=>actDlg(c.id)},
  can('cuEdit')&&{label:'Изменить',icon:'edit',run:()=>custDlg(c)},
  canBack('customer')&&bk&&{label:`Вернуть в «${bk}»`,icon:'history',run:()=>rollbackDlg('customer',c,bk)},
  {sep:1},can('cuStatus')&&c.status==='Активен'&&{label:'Приостановить',icon:'pause',run:()=>reasonDlg('Приостановить заказчика?','Причина','Приостановить',w=>setStatus('customer',c,'Приостановлен',w))},
  can('cuStatus')&&c.status!=='В архиве'&&{label:'В архив',icon:'archive',danger:true,disabled:Math.abs(debtOf(c.id))>0.009,reason:Math.abs(debtOf(c.id))>0.009?`Нельзя: долг ${money(debtOf(c.id))}`:'',
    run:()=>reasonDlg('Отправить в архив?','Причина','В архив',w=>{if(c.status==='Активен')setStatus('customer',c,'Приостановлен',w,false,{silent:true});setStatus('customer',c,'В архиве',w)})}]}
// Причина обязательна: приостановка, отмена, недоставка, откат
function reasonDlg(title,label,ok,run,opts){openModal({form:true,noMax:true,render:()=>({title,body:`<div class="form">${opts?fld(label,sel('rs-o',opts),{req:true,full:true,id:'rs-o'})+fld('Комментарий','<textarea class="inp" id="rs-w" rows="2"></textarea>',{full:true,id:'rs-w'}):fld(label,'<textarea class="inp" id="rs-w" rows="3"></textarea>',{req:true,full:true,id:'rs-w'})}</div>`,
  foot:`<button class="btn ghost" data-close>Назад</button><button class="btn danger" id="rs-ok">${esc(ok)}</button>`,
  mount(el,m){$('#rs-ok',el).onclick=()=>{const w=val(el,'rs-w');if(opts){const o=val(el,'rs-o');if(!setErr(el,'rs-o',o?'':'Выберите причину'))return;m.close();run(o,w);return}if(!setErr(el,'rs-w',w?'':'Укажите причину'))return;m.close();run(w)}}})})}
function openCust(c){if(!c)return;let tab='main';
  openModal({size:'wide',live:true,render:m=>{const L=ledgers()[c.id];const os=visOrders().filter(o=>o.cust===c.id);const rg=REGS.filter(r=>r.cust===c.id);const reps=EMP.filter(e=>e.role==='customer'&&e.cust===c.id);
    const tabs=[['main','Данные','building'],['pts','Точки доставки','globe',c.points.length],can('ordView')?['ord','Заказы','task',os.filter(o=>!ordDone(o)).length||'']:null,feat('regular')?['reg','Регулярные заказы','repeat',rg.length||'']:null,
      ['pr','Цены','coins'],can('myView')||can('cuView')?['money','Счета и оплаты','wallet',L.overdue?'!':'',!!L.overdue]:null,feat('custLogin')?['acc','Доступ в приложение','user',reps.length||'']:null,['hist','История','list']].filter(Boolean);
    let body=cardTabs(tabs,tab,'ct');
    if(tab==='main')body+=`<div class="box">${scaleFull('customer',c)}</div>${limitOver(c)?`<div class="note warn">${ic('alert')}<span><b>Долг выше лимита.</b> Долг ${money(L.debt)} при лимите ${money(+c.limit)}: новые заказы принимает только управляющий или владелец.</span></div>`:''}
      <div class="box"><div class="kv">${kv('Тип',esc(dictName('custType',c.type)))}${kv('ИНН',`<span class="mono">${esc(c.inn||'—')}</span>`)}${kv('Контактное лицо',esc(c.contact))}${kv('Телефон',esc(c.phone))}${kv('E-mail',esc(c.email))}
        ${kv('Договор',c.contract?`№ ${esc(c.contract)}${c.contractDate?' от '+fmtD(c.contractDate):''}`:'')}${kv('Способ оплаты',esc(dictName('payMethod',c.pay)))}${kv('Отсрочка платежа',(c.delay||0)+' '+plural(c.delay||0,'день','дня','дней'))}
        ${kv('Лимит долга',c.limit==null||c.limit===''?'Без лимита':money(+c.limit))}${kv('Прайс',c.price==='ind'?'Индивидуальный':'Базовый')}${kv('Скидка',c.disc?c.disc+' %':'Нет')}${kv('Ответственный',esc(EM[c.resp]?EM[c.resp].fio:'Не назначен'))}
        ${kv('Долг',`<b class="${L.overdue?'red':''}">${money(L.debt)}</b>${L.overdue?` · просрочено ${money(L.overdue)}`:''}`)}${auditKv(c)}${kv('Комментарий',esc(c.note),1)}</div></div>`;
    if(tab==='pts')body+=`<div class="list">${c.points.map(p=>`<div class="li" style="align-items:flex-start"><span class="pl-dot blue">${ic('globe')}</span><div class="grow"><div class="t1">${esc(p.name)} <span class="pill gray sm">${esc(p.win||'')}</span>${p.district?` <span class="pill blue sm">${esc(odName('district',p.district))}</span>`:''}</div><div class="t2">${esc(p.addr)}${p.mark?' · '+esc(p.mark):''}</div><div class="t2">${esc(p.contact||'')} ${esc(p.phone||'')}${p.geo?' · геоточка '+esc(p.geo):''}</div></div></div>`).join('')}</div>${can('cuEdit')?`<button class="btn" id="cu-pt-ed">${ic('edit','sm')}Изменить точки</button>`:''}`;
    if(tab==='ord')body+=os.length?'<div id="cu-og"></div>':`<div class="state">${ic('task','lg')}<b>Заказов пока нет</b>${can('ordEdit')?`<button class="btn cta" id="cu-o-add">${ic('plus')}Новый заказ</button>`:''}</div>`;
    if(tab==='reg')body+=rg.length?'<div id="cu-rg"></div>':`<div class="state">${ic('repeat','lg')}<b>Регулярных заказов нет</b>${can('ordRegular')?`<button class="btn cta" id="cu-r-add">${ic('plus')}Регулярный заказ</button>`:''}</div>`;
    if(tab==='pr')body+=`<div class="note">${ic('info')}<span>${c.price==='ind'?'Индивидуальный прайс: для позиций из списка — своя цена, для остальных — цена меню':'Базовый прайс: цена меню'}${c.disc?` со скидкой ${c.disc} %`:''}.</span></div>
      <div class="box"><table class="mini"><thead><tr><th>Позиция</th><th class="num">Цена меню, сом</th><th class="num">Цена для заказчика, сом</th></tr></thead><tbody>${[...COMBOS.filter(x=>x.status==='Активно').map(x=>['c',x]),...DISHES.filter(d=>d.status==='Активно'&&!d.semi).map(d=>['d',d])].map(([k,x])=>`<tr><td>${esc(x.name)}${c.prices[x.id]!=null?' <span class="pill purple sm">своя цена</span>':''}</td><td class="num tnum">${fmtM(x.price)}</td><td class="num tnum"><b>${fmtM(priceFor(c,k,x.id,x.price))}</b></td></tr>`).join('')}</tbody></table></div>${can('cuEdit')?`<button class="btn" id="cu-pr-ed">${ic('edit','sm')}Изменить цены</button>`:''}`;
    if(tab==='money'){const ns=NAKLS.filter(n=>n.cust===c.id).sort((a,b)=>a.date<b.date?1:-1);const ps=PAYS.filter(p=>p.cust===c.id).sort((a,b)=>a.date<b.date?1:-1);
      body+=`<div class="plates">${plate({id:'d',icon:'wallet',color:'purple',label:'Долг',value:fmtM(L.debt),unit:'сом'})}${plate({id:'o',icon:'clock',color:L.overdue?'red':'green',label:'Просрочено',value:fmtM(L.overdue),unit:'сом',sub:L.days?L.days+' '+plural(L.days,'день','дня','дней'):''})}${plate({id:'c',icon:'file',color:'blue',label:'Начислено всего',value:fmtM(L.charged,false),unit:'сом'})}${plate({id:'p',icon:'check',color:'green',label:'Оплачено всего',value:fmtM(L.paid,false),unit:'сом',sub:L.last?'последняя '+fmtD(L.last):''})}</div>
      <div class="row">${can('myPay')?`<button class="btn cta" id="cu-pay">${ic('plus','sm')}Оплата</button>`:''}${can('myDocs')?`<button class="btn" id="cu-act">${ic('file','sm')}Акт сверки</button>`:''}</div>
      <div class="box"><h3>Начисления и оплаты</h3><table class="mini"><thead><tr><th>Дата</th><th>Документ</th><th class="num">Начислено</th><th class="num">Оплачено</th></tr></thead><tbody>${[...ns.map(n=>({d:n.date,t:`Накладная ${n.no}${n.status!=='Действует'?' (отменена)':''}`,a:n.status==='Действует'?n.sum:0,b:0})),...ps.map(p=>({d:p.date,t:`Оплата ${p.no} · ${dictName('payMethod',p.method)}${p.status!=='Проведена'?' (отменена)':''}`,a:0,b:p.status==='Проведена'?p.sum:0}))].sort((x,y)=>x.d<y.d?1:-1).slice(0,40).map(r=>`<tr><td class="tnum">${fmtD(r.d)}</td><td>${esc(r.t)}</td><td class="num tnum">${r.a?fmtM(r.a):''}</td><td class="num tnum">${r.b?fmtM(r.b):''}</td></tr>`).join('')}</tbody></table></div>`}
    if(tab==='acc')body+=`<div class="note">${ic('info')}<span>Представитель входит по номеру телефона, видит только этого заказчика: меню, свои заказы, счета и акт сверки, может сам оформлять заказы до закрытия приёма.</span></div><div class="list">${reps.map(e=>`<div class="li"><span class="av round">${initials(e.fio)}</span><div class="grow"><div class="t1">${esc(e.fio)}</div><div class="t2">${esc(e.phone)} · ${esc(e.status)}${e.lastIn?' · вход '+fmtDT(e.lastIn):''}</div></div>${can('cuAccess')?`<button class="btn sm ${e.active===false?'':'danger'}" data-rep="${e.id}">${e.active===false?'Включить':'Отключить'}</button>`:''}</div>`).join('')||'<div class="muted">Представителей пока нет.</div>'}</div>${can('cuAccess')?`<button class="btn cta" id="cu-inv">${ic('send','sm')}Пригласить представителя</button>`:''}`;
    if(tab==='hist')body+=histBlock('customer','customer',c);
    return {title:esc(c.name),sub:esc(dictName('custType',c.type))+' · '+esc(c.phone),body,
      foot:`<button class="btn" id="cu-more">${ic('more','sm')}Действия</button><div class="grow"></div>${can('ordEdit')&&c.status==='Активен'?`<button class="btn" id="cu-no">${ic('task','sm')}Новый заказ</button>`:''}${can('cuEdit')?`<button class="btn cta" id="cu-edit">${ic('edit','sm')}Изменить</button>`:''}`,
      mount(el){bindCardTabs(el,'ct',t=>{tab=t;m.draw()});bindScale(el,'customer',c);
        $('#cu-more',el).onclick=e=>menu(e.currentTarget,cuActions(c).filter(x=>x&&x.label!=='Открыть'));const on=(id,f)=>{const x=$(id,el);if(x)x.onclick=f};
        on('#cu-edit',()=>custDlg(c));on('#cu-no',()=>orderDlg(null,{cust:c.id}));on('#cu-o-add',()=>orderDlg(null,{cust:c.id}));on('#cu-r-add',()=>regularDlg(null,c.id));on('#cu-pt-ed',()=>custDlg(c,'pts'));on('#cu-pr-ed',()=>pricesDlg(c));
        on('#cu-pay',()=>payDlg(null,c.id));on('#cu-act',()=>actDlg(c.id));on('#cu-inv',()=>inviteRepDlg(c));
        $$('[data-rep]',el).forEach(b=>b.onclick=()=>{const e=EM[b.dataset.rep];e.active=e.active===false;e.status=e.active?'Активен':'Заблокирован';log('customer',c.id,`Доступ представителя ${e.short}: ${e.active?'включён':'отключён'}`,c);refreshAll();toast(e.active?'Доступ включён':'Доступ отключён','user')});
        if($('#cu-og',el))grid($('#cu-og',el),{id:'cu-og',cols:ordCols().filter(x=>x.key!=='cust'),show:['no','date','point','portions','sum','status'],rows:()=>visOrders().filter(o=>o.cust===c.id),title:'no',open:openOrder,exportable:false,audit:false,firstRun:false});
        if($('#cu-rg',el))grid($('#cu-rg',el),{id:'cu-rg',cols:regCols().filter(x=>x.key!=='cust'),rows:()=>REGS.filter(r=>r.cust===c.id),title:'point',open:r=>regularDlg(r),exportable:false,audit:false,firstRun:false})}}}})}
// Форма заказчика: реквизиты и точки доставки (вложенный список); на телефоне короткие поля встают по два (mobile-pack.js)
function custDlg(c,focus){const isNew=!c;const v0=c?c._v||0:0;const st={pts:c?structuredClone(c.points):[{id:uid('pt'),name:'Основная',addr:'',mark:'',contact:'',phone:'',win:'12:00–12:30',geo:'',district:''}]};
  const ptCols=[{key:'name',label:'Название',type:'text',w:130,req:1},{key:'addr',label:'Адрес',type:'text',w:190,req:1},{key:'mark',label:'Ориентир',type:'text',w:130},{key:'contact',label:'Контакт на месте',type:'text',w:130},{key:'phone',label:'Телефон',type:'text',w:120},
    {key:'win',label:'Окно доставки',type:'text',w:100},{key:'district',label:'Район',type:'sel',w:120,opts:()=>odOpts('district')},{key:'geo',label:'Геоточка',type:'text',w:100}];
  openModal({form:true,size:'wide',render:m=>({title:isNew?'Новый заказчик':'Изменить заказчика',sub:isNew?'':esc(c.name),body:`<div class="form">
    ${fld('Наименование',inp('cf-name',c?c.name:''),{req:true,full:true,id:'cf-name'})}
    ${fld('Тип',sel('cf-type',dictOpts('custType',c&&c.type),c?c.type:'ТЗ-001'),{req:true,id:'cf-type'})}
    ${fld('Телефон',inp('cf-phone',c?c.phone:'','inputmode="tel"'),{req:true,id:'cf-phone'})}
    ${fld('ИНН',inp('cf-inn',c?c.inn:'','inputmode="numeric" class="inp mono"'),{id:'cf-inn',hint:'14 цифр'})}
    ${fld('Контактное лицо',inp('cf-ct',c?c.contact:''),{id:'cf-ct'})}
    ${fld('E-mail',inp('cf-em',c?c.email:'','inputmode="email"'),{id:'cf-em'})}
    ${fld('Договор №',inp('cf-cn',c?c.contract:''),{id:'cf-cn'})}
    ${fld('Дата договора',inp('cf-cd',c?c.contractDate:'','type="date"'),{id:'cf-cd'})}
    ${fld('Способ оплаты по умолчанию',sel('cf-pay',dictOpts('payMethod',c&&c.pay),c?c.pay:'СО-001'),{id:'cf-pay'})}
    ${fld('Отсрочка платежа, дней',inp('cf-dl',c?c.delay:ORG.policy.delay??7,'inputmode="numeric"'),{id:'cf-dl'})}
    ${fld('Лимит долга, сом',inp('cf-lim',c&&c.limit!=null?c.limit:'','inputmode="decimal" placeholder="Без лимита"'),{id:'cf-lim',hint:'Пусто — без лимита'})}
    ${fld('Прайс',sel('cf-pr',[['base','Базовый'],['ind','Индивидуальный']],c?c.price:'base'),{id:'cf-pr'})}
    ${fld('Скидка, %',inp('cf-ds',c?c.disc||'':'','inputmode="decimal"'),{id:'cf-ds'})}
    ${fld('Ответственный',sel('cf-resp',[['','Не назначен'],...empOpts()],c?c.resp:(seeAll('customers')?'':S.me)),{id:'cf-resp'})}
    ${fld('Комментарий',`<textarea class="inp" id="cf-note" rows="2">${esc(c?c.note:'')}</textarea>`,{full:true,id:'cf-note'})}
    ${fld('Точки доставки',linesHtml('cf-pts',st.pts,ptCols,{add:'Добавить точку'}),{req:true,full:true,id:'cf-pts',hint:'Хотя бы одна точка. Окно доставки — например, 12:00–12:30'})}</div>`,
    foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="cf-ok">${isNew?'Добавить':'Сохранить'}</button>`,
    mount(el){bindLines(el,'cf-pts',st.pts,ptCols,{blank:()=>({id:uid('pt'),name:'',addr:'',mark:'',contact:'',phone:'',win:'12:00–12:30',geo:'',district:''}),redraw:()=>{keepForm(el,m)}});
      if(focus==='pts'){const t=$('#cf-pts',el);t&&t.scrollIntoView({block:'center'})}
      $('#cf-ok',el).onclick=()=>{const name=val(el,'cf-name'),inn=val(el,'cf-inn').replace(/\s/g,''),lim=val(el,'cf-lim'),ds=val(el,'cf-ds'),dl=val(el,'cf-dl');
        let ok=setErr(el,'cf-name',name?'':'Укажите наименование');ok=setErr(el,'cf-phone',val(el,'cf-phone')?'':'Укажите телефон')&&ok;
        ok=setErr(el,'cf-inn',inn&&!/^\d{14}$/.test(inn)?'ИНН — 14 цифр':inn&&CUSTS.some(x=>x.inn===inn&&x!==c)?'Заказчик с таким ИНН уже есть (в том числе в архиве)':'')&&ok;
        ok=setErr(el,'cf-lim',lim&&isNaN(num(lim))?'Введите число':'')&&ok;ok=setErr(el,'cf-ds',ds&&(isNaN(num(ds))||num(ds)<0||num(ds)>100)?'От 0 до 100':'')&&ok;ok=setErr(el,'cf-dl',dl&&isNaN(num(dl))?'Введите число дней':'')&&ok;
        const pts=st.pts.filter(p=>p.name||p.addr);ok=setErr(el,'cf-pts',!pts.length?'Добавьте хотя бы одну точку доставки':pts.some(p=>!p.name||!p.addr)?'У каждой точки нужны название и адрес':'')&&ok;if(!ok)return;
        if(c&&stale(c,v0))return;
        const d={name,type:val(el,'cf-type'),phone:val(el,'cf-phone'),inn,contact:val(el,'cf-ct'),email:val(el,'cf-em'),contract:val(el,'cf-cn'),contractDate:val(el,'cf-cd'),pay:val(el,'cf-pay'),delay:dl?num(dl):0,limit:lim?num(lim):null,price:val(el,'cf-pr'),disc:ds?num(ds):0,resp:val(el,'cf-resp'),note:val(el,'cf-note')};
        if(isNew){const n=born({id:uid('c'),...d,points:pts,prices:{}});stStart(n,'Активен','Заказчик добавлен');CUSTS.push(n);log('customer',n.id,'Заказчик добавлен',n);m.close();refreshAll();toast('Заказчик добавлен');openCust(CUM[n.id])}
        else{const ch=Object.entries(d).filter(([k,v])=>String(c[k]??'')!==String(v??''));ch.forEach(([k,v])=>{log('customer',c.id,`${k}: ${c[k]??'—'} → ${v??'—'}`,c);c[k]=v});
          if(JSON.stringify(pts)!==JSON.stringify(c.points)){c.points=pts;log('customer',c.id,'Точки доставки изменены',c)}m.close();refreshAll();toast(ch.length?'Сохранено':'Сохранено')}}}})})}
// Перерисовать форму с сохранением введённых значений (при добавлении и удалении строк)
function keepForm(el,m){const vals={};$$('.form input:not([data-ln]):not([type=file]),.form select:not([data-ln]),.form textarea',el).forEach(x=>{if(x.id)vals[x.id]=x.type==='checkbox'?x.checked:x.value});m.draw();Object.entries(vals).forEach(([id,v])=>{const x=$('#'+id,m.el);if(x){if(x.type==='checkbox')x.checked=v;else x.value=v}})}
function pricesDlg(c){const st={...c.prices};const rows=[...COMBOS.filter(x=>x.status==='Активно').map(x=>['c',x]),...DISHES.filter(d=>d.status==='Активно'&&!d.semi).map(d=>['d',d])];
  openModal({form:true,size:'mid',render:()=>({title:'Индивидуальные цены',sub:esc(c.name),body:`<div class="note">${ic('info')}<span>Пустое поле — цена меню${c.disc?` со скидкой ${c.disc} %`:''}. Своя цена действует, если в карточке выбран прайс «Индивидуальный».</span></div><table class="mini"><thead><tr><th>Позиция</th><th class="num">Цена меню</th><th class="num">Цена для заказчика</th></tr></thead><tbody>${rows.map(([k,x])=>`<tr><td>${esc(x.name)}</td><td class="num tnum">${fmtM(x.price)}</td><td class="num"><input class="inp tnum" style="max-width:110px" data-pr="${x.id}" inputmode="decimal" value="${st[x.id]!=null?String(st[x.id]).replace('.',','):''}"></td></tr>`).join('')}</tbody></table>`,
    foot:'<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="pd-ok">Сохранить</button>',
    mount(el,m){$('#pd-ok',el).onclick=()=>{const n={};$$('[data-pr]',el).forEach(x=>{const v=x.value.trim();if(v!==''&&!isNaN(num(v)))n[x.dataset.pr]=num(v)});c.prices=n;if(Object.keys(n).length&&c.price!=='ind')c.price='ind';log('customer',c.id,'Индивидуальные цены изменены',c);m.close();refreshAll();toast('Цены сохранены','coins')}}})})}
function cuRespDlg(cs,done){openModal({form:true,render:()=>({title:cs.length>1?`Ответственный для ${cs.length} заказчиков`:'Сменить ответственного',body:`<div class="form">${fld('Ответственный',sel('rs-e',empOpts(),cs.length===1?cs[0].resp:''),{req:true,full:true,id:'rs-e'})}</div>`,
  foot:'<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="rs-ok">Назначить</button>',
  mount(el,m){$('#rs-ok',el).onclick=()=>{const to=val(el,'rs-e');cs.forEach(c=>{if(c.resp!==to){log('customer',c.id,`Ответственный: ${empName(c.resp)||'—'} → ${empName(to)}`,c);c.resp=to}});m.close();done&&done();refreshAll();toast('Ответственный назначен','user')}}})})}
function inviteRepDlg(c){openModal({form:true,noMax:true,render:()=>({title:'Пригласить представителя',sub:esc(c.name),body:`<div class="form">${fld('ФИО',inp('iv-f'),{req:true,full:true,id:'iv-f'})}${fld('Телефон',inp('iv-p','+996 ','inputmode="tel"'),{req:true,full:true,id:'iv-p',hint:'Придёт SMS со ссылкой на вход'})}</div>`,
  foot:'<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="iv-ok">Отправить приглашение</button>',
  mount(el,m){$('#iv-ok',el).onclick=()=>{const f=val(el,'iv-f'),p=val(el,'iv-p');let ok=setErr(el,'iv-f',f?'':'Укажите ФИО');ok=setErr(el,'iv-p',p.replace(/\D/g,'').length<12?'Номер в формате +996 XXX XXX XXX':EMP.some(e=>e.phone===p)?'Этот номер уже есть в организации':'')&&ok;if(!ok)return;
    EMP.push(born({id:uid('e'),fio:f,short:f.split(' ').slice(0,2).map((w,i)=>i?w[0]+'.':w).join(' '),phone:p,login:p,role:'customer',pos:'Представитель заказчика',status:'Приглашён',active:true,cust:c.id,lastIn:'',mute:[]}));log('customer',c.id,`Приглашён представитель ${f}`,c);m.close();refreshAll();toast('Приглашение отправлено по SMS (в макете — без отправки)','send')}}})})}
// Загрузка заказчиков списком: сопоставление по ИНН, тип и способ оплаты — по названию из справочника
function cuImportDlg(){const by=(id,v)=>DICT[id].items.find(x=>x.active!==false&&(x.name.toLowerCase()===v.toLowerCase()||x.code===v));ORG.imports=ORG.imports||[];
  importDlg({title:'Загрузка заказчиков из Excel',file:'Шаблон заказчиков',key:'inn',log:ORG.imports,
    cols:[{key:'name',label:'Наименование',req:true},{key:'inn',label:'ИНН',req:true,hint:'14 цифр',parse:v=>v.replace(/\s/g,''),check:v=>/^\d{14}$/.test(v)?'':'нужно 14 цифр'},
      {key:'type',label:'Тип',hint:'Одно из: '+DICT.custType.items.map(x=>x.name).join(', '),parse:v=>{const x=by('custType',v);return x?x.code:'?'+v},check:v=>v[0]==='?'?`нет в справочнике «${v.slice(1)}»`:''},
      {key:'phone',label:'Телефон',req:true,hint:'+996 …'},{key:'contact',label:'Контактное лицо'},
      {key:'pay',label:'Способ оплаты',hint:'Одно из: '+DICT.payMethod.items.map(x=>x.name).join(', '),parse:v=>{const x=by('payMethod',v);return x?x.code:'?'+v},check:v=>v[0]==='?'?`нет в справочнике «${v.slice(1)}»`:''},
      {key:'addr',label:'Адрес доставки',req:true,hint:'Адрес первой точки доставки'}],
    example:[{name:'ОсОО «Пример»',inn:'01203201910123',type:'Юрлицо',phone:'+996 555 000 001',contact:'Иванов Иван',pay:'Безналичный перевод',addr:'Бишкек, ул. Примерная, 1'}],
    find:row=>CUSTS.find(c=>c.inn===row.inn),
    apply:(nw,ch)=>{nw.forEach(r=>{const {_n,addr,...d}=r;const n=born({id:uid('c'),...d,type:d.type||'ТЗ-001',pay:d.pay||'СО-001',delay:ORG.policy.delay??7,limit:null,price:'base',disc:0,prices:{},resp:'',note:'',email:'',contract:'',contractDate:'',
      points:[{id:uid('pt'),name:'Основная',addr,mark:'',contact:d.contact||'',phone:d.phone,win:'12:00–12:30',geo:'',district:''}]});stStart(n,'Активен','Загружен из Excel');CUSTS.push(n);log('customer',n.id,'Заказчик загружен из Excel',n)});
      ch.forEach(({rec,diff})=>diff.forEach(d=>{if(d.c.key==='addr')return;log('customer',rec.id,`${d.c.label}: ${d.from||'—'} → ${d.to} (из Excel)`,rec);rec[d.c.key]=d.to}))}})}
