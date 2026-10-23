'use strict';
// Модуль «Заказчики»: два вида — юрлица и физлица. Вкладки «Юрлица», «Физлица», «Приостановлены», «Архив»;
// карточка юрлица (данные, точки доставки, заказы, регулярные, цены, счета и оплаты, доступ в приложение, история), карточка физлица (данные, адреса, заказы, регулярные, оплаты с чеками, история),
// формы юрлица и физлица, точки доставки с местом и геоточкой, загрузка юрлиц из Excel
/* ═════════════ Заказчики ═════════════ */
function cuTabs(){const v=visCusts(true);const act=v.filter(c=>c.status==='Активен');return [{id:'org',label:'Юрлица',icon:'building',count:act.filter(c=>!isPerson(c)).length},{id:'per',label:'Физлица',icon:'user',count:act.filter(isPerson).length},
  {id:'pau',label:'Приостановлены',icon:'pause',count:v.filter(c=>c.status==='Приостановлен').length||''},{id:'arc',label:'Архив',icon:'archive'}]}
function cuAdd(){return [can('cuEdit')&&{label:'Юрлицо',icon:'building',sub:'Компания, ИП или учреждение',run:()=>custDlg()},can('cuEdit')&&{label:'Физлицо',icon:'user',sub:'Частный клиент: имя и телефон',run:()=>personDlg()},can('cuImport')&&{label:'Загрузка из Excel',icon:'upload',sub:'Юрлица списком',run:()=>cuImportDlg()}]}
const CU_ROWS={org:c=>c.status==='Активен'&&!isPerson(c),per:c=>c.status==='Активен'&&isPerson(c),pau:c=>c.status==='Приостановлен',arc:c=>c.status==='В архиве'};
const cuSt=c=>custStats()[c.id]||{n:0,sum:0,last:'',lastAt:''};
function cuCols(){return [
  {key:'name',label:'Наименование',type:'text',w:240,val:c=>c.name},
  {key:'type',label:'Тип',type:'enum',w:120,val:c=>isPerson(c)?'':dictName('custType',c.type)},
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
  {key:'limit',label:'Лимит долга, сом',type:'money',w:130,num:1,val:c=>c.limit==null||c.limit===''?null:+c.limit},
  {key:'lim',label:'Долг выше лимита',type:'enum',w:120,val:c=>limitOver(c)?'Да':'Нет'}]}
// Физлица: последний заказ — когда клиент последний раз заказывал; адрес — последний использованный
function perCols(){return [
  {key:'name',label:'Имя',type:'text',w:190,val:c=>c.name},
  {key:'phone',label:'Телефон',type:'text',w:150,val:c=>c.phone,cls:'tnum'},
  {key:'addr',label:'Адрес',type:'text',w:250,val:c=>lastAddr(c)},
  {key:'n',label:'Заказов',type:'int',w:90,num:1,total:1,val:c=>cuSt(c).n},
  {key:'last',label:'Последний заказ',type:'date',w:140,val:c=>cuSt(c).lastAt.slice(0,10)||null,sortVal:c=>cuSt(c).lastAt,html:c=>{const d=cuSt(c).lastAt.slice(0,10);return d?fmtD(d)+(relDay(d)?` <span class="faint">${relDay(d)}</span>`:''):'<span class="faint">нет</span>'}},
  {key:'debt',label:'Долг, сом',type:'money',w:110,num:1,total:1,val:c=>debtOf(c.id),html:c=>{const d=debtOf(c.id);return d>0.009?`<b>${fmtM(d)}</b>`:'<span class="faint">0</span>'}},
  {key:'status',label:'Статус',type:'enum',w:170,val:c=>c.status,html:c=>scaleMini('customer',c)},
  {key:'pts',label:'Адресов',type:'int',w:90,num:1,val:c=>c.points.length},
  {key:'sum',label:'Сумма заказов, сом',type:'money',w:150,num:1,total:1,val:c=>cuSt(c).sum},
  {key:'note',label:'Комментарий',type:'text',w:200,val:c=>c.note},
  {key:'resp',label:'Ответственный',type:'enum',w:150,val:c=>empName(c.resp)}]}
function renderCustomers(body,tab,fresh){const gid='cu-'+tab;const all=visCusts(true);const per=tab==='per';
  if(per){const ps=all.filter(CU_ROWS.per);const wk=addDays(TODAY,-7);const nw=ps.filter(c=>(c._ca||'').slice(0,10)>=wk);const td=ps.filter(c=>cuSt(c).lastAt.slice(0,10)===TODAY);const pd=ps.reduce((a,c)=>a+Math.max(0,debtOf(c.id)),0);
    body.innerHTML=`<div class="plates">
      ${plate({id:'all',icon:'user',color:'blue',label:'Физлиц',value:ps.length,sub:'частные клиенты'})}
      ${plate({id:'new',icon:'plus',color:'green',label:'Новых за 7 дней',value:nw.length,sub:'добавлены при заказе'})}
      ${plate({id:'today',icon:'task',color:'yellow',label:'Заказали сегодня',value:td.length})}
      ${plate({id:'pdebt',icon:'wallet',color:pd?'red':'green',label:'Долг физлиц',value:fmtM(pd,false),unit:'сом'})}
    </div><div id="cug"></div>`;
    body.querySelector('.plates').onclick=e=>{const b=e.target.closest('[data-plate]');if(!b||!GS[gid])return;const s=GS[gid];s.filters={};const id=b.dataset.plate;
      if(id==='new')s.filters._ca={type:'date',from:wk,to:null};if(id==='today')s.filters.last={type:'date',from:TODAY,to:TODAY};if(id==='pdebt')s.filters.debt={type:'num',from:0.01,to:null};s.page=0;renderPage()}}
  else if(tab!=='org')body.innerHTML='<div id="cug"></div>';
  else{const act=all.filter(CU_ROWS.org);const over=act.filter(c=>ledgers()[c.id].overdue>0),lim=act.filter(c=>limitOver(c));const debt=act.reduce((a,c)=>a+Math.max(0,debtOf(c.id)),0);
    body.innerHTML=`<div class="plates">
      ${plate({id:'act',icon:'building',color:'blue',label:'Активных заказчиков',value:act.length,sub:seeAll('customers')?'юрлица всей организации':'юрлица, закреплённые за вами'})}
      ${plate({id:'debt',icon:'wallet',color:'purple',label:'Общий долг',value:fmtM(debt,false),unit:'сом'})}
      ${plate({id:'over',icon:'clock',color:over.length?'red':'green',label:'С просрочкой',value:over.length,sub:over.length?'долг старше отсрочки':'все платят в срок'})}
      ${plate({id:'lim',icon:'alert',color:lim.length?'orange':'green',label:'Долг выше лимита',value:lim.length})}
    </div><div id="cug"></div>`;
    body.querySelector('.plates').onclick=e=>{const b=e.target.closest('[data-plate]');if(!b)return;const id=b.dataset.plate;const f={};
      if(id==='over')f.over={type:'num',from:0.01,to:null};if(id==='lim')f.lim={type:'enum',vals:['Да']};if(!GS[gid])return;GS[gid].filters=f;GS[gid].page=0;renderPage()}}
  const mixed=tab==='pau'||tab==='arc';
  const cols=per?perCols():mixed?[...cuCols().slice(0,1),{key:'kind',label:'Вид',type:'enum',w:100,val:c=>kindName(c)},...cuCols().slice(1)]:cuCols();
  grid($('#cug',body),{id:gid,cols,show:per?['name','phone','addr','n','last','debt','status']:mixed?['name','kind','type','phone','debt','resp','status']:['name','type','phone','pts','debt','over','resp','status'],
    rows:()=>visCusts(true).filter(CU_ROWS[tab]||CU_ROWS.org),title:'name',noun:per?['физлицо','физлица','физлиц']:['заказчик','заказчика','заказчиков'],xlsName:per?'Физлица':'Заказчики',
    rowClass:c=>ledgers()[c.id].overdue&&!per?'warn':'',actions:cuActions,open:openCust,sort:per?{key:'last',dir:-1}:{key:'name',dir:1},ordered:true,preset:S.preset,simulateLoad:fresh,
    bulk:can('cuEdit')?[{label:'Назначить ответственного',icon:'user',run:(rs,done)=>cuRespDlg(rs,done)}]:null,
    empty:{icon:per?'user':'building',title:tab==='org'?'Юрлиц пока нет':per?'Физлиц пока нет':'Здесь пусто',text:per?'Физлицо появится само, когда вы примете быстрый заказ от нового клиента.':'',add:tab==='org'&&can('cuEdit')?()=>custDlg():per&&can('ordEdit')?()=>quickOrderDlg():null}})}
function cuActions(c){const bk=scBack('customer',c);const p=isPerson(c);return [{label:'Открыть',icon:'right',run:()=>openCust(c)},
  can('ordEdit')&&(p?c.status!=='В архиве'&&{label:'Быстрый заказ',icon:'zap',run:()=>quickOrderDlg({cust:c.id})}:c.status==='Активен'&&{label:'Новый заказ',icon:'task',run:()=>orderDlg(null,{cust:c.id})}),
  can('myDocs')&&{label:'Акт сверки',icon:'file',run:()=>actDlg(c.id)},
  can('cuEdit')&&{label:'Изменить',icon:'edit',run:()=>p?personDlg(c):custDlg(c)},
  canBack('customer')&&bk&&{label:`Вернуть в «${bk}»`,icon:'history',run:()=>rollbackDlg('customer',c,bk)},
  {sep:1},can('cuStatus')&&c.status==='Активен'&&{label:'Приостановить',icon:'pause',run:()=>reasonDlg(p?'Приостановить клиента?':'Приостановить заказчика?','Причина','Приостановить',w=>setStatus('customer',c,'Приостановлен',w))},
  can('cuStatus')&&c.status!=='В архиве'&&{label:'В архив',icon:'archive',danger:true,disabled:Math.abs(debtOf(c.id))>0.009,reason:Math.abs(debtOf(c.id))>0.009?`Нельзя: долг ${money(debtOf(c.id))}`:'',
    run:()=>reasonDlg('Отправить в архив?','Причина','В архив',w=>{if(c.status==='Активен')setStatus('customer',c,'Приостановлен',w,false,{silent:true});setStatus('customer',c,'В архиве',w)})}]}
// Шкала «Обслуживание» — те же правила, что у действий строки: причина обязательна, в архив нельзя с долгом
SC_WHY.customer=(c,to,back)=>{if(!back&&to==='В архиве'&&Math.abs(debtOf(c.id))>0.009)return `Нельзя: долг ${money(debtOf(c.id))}`};
SC_HOOK.customer=(c,to,done)=>{const arc=to==='В архиве';reasonDlg(arc?'Отправить в архив?':isPerson(c)?'Приостановить клиента?':'Приостановить заказчика?','Причина',arc?'В архив':'Приостановить',w=>{setStatus('customer',c,to,w);done&&done()});return true};
// Причина обязательна: приостановка, отмена, недоставка, откат
function reasonDlg(title,label,ok,run,opts){openModal({form:true,noMax:true,render:()=>({title,body:`<div class="form">${opts?fld(label,sel('rs-o',opts),{req:true,full:true,id:'rs-o'})+fld('Комментарий','<textarea class="inp" id="rs-w" rows="2"></textarea>',{full:true,id:'rs-w'}):fld(label,'<textarea class="inp" id="rs-w" rows="3"></textarea>',{req:true,full:true,id:'rs-w'})}</div>`,
  foot:`<button class="btn ghost" data-close>Назад</button><button class="btn danger" id="rs-ok">${esc(ok)}</button>`,
  mount(el,m){$('#rs-ok',el).onclick=()=>{const w=val(el,'rs-w');if(opts){const o=val(el,'rs-o');if(!setErr(el,'rs-o',o?'':'Выберите причину'))return;m.close();run(o,w);return}if(!setErr(el,'rs-w',w?'':'Укажите причину'))return;m.close();run(w)}}})})}
// Адрес на карте: геоточка места, своя или примерная по району; без геоточки адрес не показывается на карте
const geoLine=p=>{const pl=placeOf(p.place);if(pl&&hasGeo(pl.geo))return `${ic('building','sm')} Геоточка места «${esc(pl.name)}»`;if(hasGeo(p.geo))return p.approx?`<span class="orange">${ic('pin','sm')} Примерная геоточка по району</span>`:`${ic('pin','sm')} Геоточка ${geoTxt(p.geo)}`;return `<span class="orange">${ic('alert','sm')} Без геоточки — не видна на карте</span>`};
function openCust(c){if(!c)return;if(isPerson(c))return openPerson(c);let tab='main';
  openModal({size:'wide',live:true,render:m=>{const L=ledgers()[c.id];const os=visOrders().filter(o=>o.cust===c.id);const rg=REGS.filter(r=>r.cust===c.id);const reps=EMP.filter(e=>e.role==='customer'&&e.cust===c.id);
    const tabs=[['main','Данные','building'],['pts','Точки доставки','globe',c.points.length],can('ordView')?['ord','Заказы','task',os.filter(o=>!ordDone(o)).length||'']:null,feat('regular')?['reg','Регулярные заказы','repeat',rg.length||'']:null,
      ['pr','Цены','coins'],can('myView')||can('cuView')?['money','Счета и оплаты','wallet',L.overdue?'!':'',!!L.overdue]:null,feat('custLogin')?['acc','Доступ в приложение','user',reps.length||'']:null,['hist','История','list']].filter(Boolean);
    let body=cardTabs(tabs,tab,'ct');
    if(tab==='main')body+=`<div class="box">${scaleFull('customer',c)}</div>${limitOver(c)?`<div class="note warn">${ic('alert')}<span><b>Долг выше лимита.</b> Долг ${money(L.debt)} при лимите ${money(+c.limit)}: новые заказы принимает только управляющий или владелец.</span></div>`:''}
      <div class="box"><div class="kv">${kv('Вид','Юрлицо')}${kv('Тип',esc(dictName('custType',c.type)))}${kv('ИНН',`<span class="mono">${esc(c.inn||'—')}</span>`)}${kv('Контактное лицо',esc(c.contact))}${kv('Телефон',esc(c.phone))}${kv('E-mail',esc(c.email))}
        ${kv('Договор',c.contract?`№ ${esc(c.contract)}${c.contractDate?' от '+fmtD(c.contractDate):''}`:'')}${kv('Способ оплаты',esc(dictName('payMethod',c.pay)))}${kv('Отсрочка платежа',(c.delay||0)+' '+plural(c.delay||0,'день','дня','дней'))}
        ${kv('Лимит долга',c.limit==null||c.limit===''?'Без лимита':money(+c.limit))}${kv('Прайс',c.price==='ind'?'Индивидуальный':'Базовый')}${kv('Скидка',c.disc?c.disc+' %':'Нет')}${kv('Ответственный',esc(EM[c.resp]?EM[c.resp].fio:'Не назначен'))}
        ${kv('Долг',`<b class="${L.overdue?'red':''}">${money(L.debt)}</b>${L.overdue?` · просрочено ${money(L.overdue)}`:''}`)}${auditKv(c)}${kv('Комментарий',esc(c.note),1)}</div></div>`;
    if(tab==='pts')body+=`<div class="list">${c.points.map(p=>`<div class="li" style="align-items:flex-start"><span class="pl-dot ${placeOf(p.place)?'purple':'blue'}">${ic(placeOf(p.place)?'building':'globe')}</span><div class="grow"><div class="t1">${esc(p.name)} <span class="pill gray sm">${esc(p.win||'')}</span>${p.district?` <span class="pill blue sm">${esc(odName('district',p.district))}</span>`:''}${placeOf(p.place)?` <span class="pill purple sm">${esc(placeOf(p.place).name)}</span>`:''}</div><div class="t2">${esc(p.addr)}${p.mark?' · '+esc(p.mark):''}</div><div class="t2">${esc(p.contact||'')} ${esc(p.phone||'')}</div><div class="t2">${geoLine(p)}</div></div>${can('cuEdit')&&!placeOf(p.place)?`<button class="btn sm" data-geo="${p.id}">${ic('pin','sm')}Указать на карте</button>`:''}</div>`).join('')}</div>${can('cuEdit')?`<button class="btn" id="cu-pt-ed">${ic('edit','sm')}Изменить точки</button>`:''}`;
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
    return {title:esc(c.name),sub:'Юрлицо · '+esc(dictName('custType',c.type))+' · '+esc(c.phone),body,
      foot:`<button class="btn" id="cu-more">${ic('more','sm')}Действия</button><div class="grow"></div>${can('ordEdit')&&c.status==='Активен'?`<button class="btn" id="cu-no">${ic('task','sm')}Новый заказ</button>`:''}${can('cuEdit')?`<button class="btn cta" id="cu-edit">${ic('edit','sm')}Изменить</button>`:''}`,
      mount(el){bindCardTabs(el,'ct',t=>{tab=t;m.draw()});bindScale(el,'customer',c);
        $('#cu-more',el).onclick=e=>menu(e.currentTarget,cuActions(c).filter(x=>x&&x.label!=='Открыть'));const on=(id,f)=>{const x=$(id,el);if(x)x.onclick=f};
        on('#cu-edit',()=>custDlg(c));on('#cu-no',()=>orderDlg(null,{cust:c.id}));on('#cu-o-add',()=>orderDlg(null,{cust:c.id}));on('#cu-r-add',()=>regularDlg(null,c.id));on('#cu-pt-ed',()=>custDlg(c,'pts'));on('#cu-pr-ed',()=>pricesDlg(c));
        on('#cu-pay',()=>payDlg(null,c.id));on('#cu-act',()=>actDlg(c.id));on('#cu-inv',()=>inviteRepDlg(c));bindPtGeo(el,c);
        $$('[data-rep]',el).forEach(b=>b.onclick=()=>{const e=EM[b.dataset.rep];e.active=e.active===false;e.status=e.active?'Активен':'Заблокирован';log('customer',c.id,`Доступ представителя ${e.short}: ${e.active?'включён':'отключён'}`,c);refreshAll();toast(e.active?'Доступ включён':'Доступ отключён','user')});
        if($('#cu-og',el))grid($('#cu-og',el),{id:'cu-og',cols:ordCols().filter(x=>x.key!=='cust'),show:['no','date','point','portions','sum','payst','status'],rows:()=>visOrders().filter(o=>o.cust===c.id),title:'no',open:openOrder,exportable:false,audit:false,firstRun:false});
        if($('#cu-rg',el))grid($('#cu-rg',el),{id:'cu-rg',cols:regCols().filter(x=>x.key!=='cust'),rows:()=>REGS.filter(r=>r.cust===c.id),title:'point',open:r=>regularDlg(r),exportable:false,audit:false,firstRun:false})}}}})}
// «Указать на карте» из карточки: геоточка сохраняется в точке доставки или адресе клиента
function bindPtGeo(el,c){$$('[data-geo]',el).forEach(b=>b.onclick=()=>{const p=c.points.find(x=>x.id===b.dataset.geo);if(!p)return;
  mapPickDlg({title:'Геоточка адреса',sub:esc(p.addr),geo:p.geo,near:distGeo(p.district)},g=>{p.geo=g;p.approx=false;log('customer',c.id,`Геоточка адреса «${p.addr}» уточнена на карте`,c);refreshAll();toast('Геоточка сохранена','pin')})})}
/* ═════════════ Физлицо: карточка ═════════════ */
// Вкладки «Данные», «Адреса», «Заказы», «Регулярные заказы», «Оплаты» (долг, оплаты с чеками), «История»; внизу — «Позвонить» и «Быстрый заказ»
function openPerson(c){let tab='main';
  openModal({size:'wide',live:true,render:m=>{const L=ledgers()[c.id];const s=cuSt(c);const os=visOrders().filter(o=>o.cust===c.id);const rg=REGS.filter(r=>r.cust===c.id);
    const ps=PAYS.filter(p=>p.cust===c.id).sort((a,b)=>(b.date+(b._ca||'')).localeCompare(a.date+(a._ca||'')));const unp=os.filter(o=>ordActive(o)&&['Не оплачен','Частично'].includes(payStatus(o)));
    const tabs=[['main','Данные','user'],['pts','Адреса','pin',c.points.length||''],can('ordView')?['ord','Заказы','task',os.filter(o=>!ordDone(o)).length||'']:null,feat('regular')?['reg','Регулярные заказы','repeat',rg.length||'']:null,
      ['money','Оплаты','wallet',unp.length||'',L.debt>0.009],['hist','История','list']].filter(Boolean);
    let body=cardTabs(tabs,tab,'ct');
    if(tab==='main')body+=`<div class="box">${scaleFull('customer',c)}</div>${c.status==='Приостановлен'?`<div class="note warn">${ic('pause')}<span><b>Клиент приостановлен.</b> Новые заказы не принимаются, пока клиент не возвращён в «Активен».</span></div>`:''}
      <div class="box"><div class="kv">${kv('Вид','Физлицо')}${kv('Имя',esc(c.name))}${kv('Телефон',`<a class="linkbtn" href="tel:${esc(phoneDigits(c.phone))}">${esc(c.phone)}</a>`)}${kv('Последний адрес',esc(lastAddr(c)))}
        ${kv('Способ оплаты',esc(dictName('payMethod',c.pay)))}${kv('Скидка',c.disc?c.disc+' %':'Нет')}${kv('Заказов',String(s.n))}${kv('Сумма заказов',money(s.sum))}${kv('Последний заказ',s.lastAt?fmtDT(s.lastAt):'Заказов пока нет')}
        ${kv('Долг',`<b class="${L.debt>0.009?'red':''}">${money(L.debt)}</b>${L.advance?` · аванс ${money(L.advance)}`:''}`)}${kv('Ответственный',esc(EM[c.resp]?EM[c.resp].fio:'Не назначен'))}${auditKv(c)}${kv('Комментарий',esc(c.note),1)}</div></div>`;
    if(tab==='pts')body+=(c.points.length?`<div class="list">${custPoints(c).map((p,i)=>`<div class="li" style="align-items:flex-start"><span class="pl-dot ${placeOf(p.place)?'purple':'blue'}">${ic(placeOf(p.place)?'building':'pin')}</span><div class="grow"><div class="t1">${esc(p.addr)}${p.mark?', '+esc(p.mark):''}${i===0&&s.n?' <span class="pill green sm">последний</span>':''}</div>
      <div class="t2">${[placeOf(p.place)?placeOf(p.place).name:'',odName('district',p.district),p.win].filter(Boolean).map(esc).join(' · ')||'&nbsp;'}</div><div class="t2">${geoLine(p)}</div></div>${can('cuEdit')&&!placeOf(p.place)?`<button class="btn sm" data-geo="${p.id}">${ic('pin','sm')}Указать на карте</button>`:''}</div>`).join('')}</div>`:
      `<div class="state">${ic('pin','lg')}<b>Адресов пока нет</b><span class="muted">Адрес сохранится сам при быстром заказе, если отмечено «Сохранить адрес в карточке клиента».</span></div>`)+(can('cuEdit')?`<button class="btn" id="cu-pt-ed">${ic('edit','sm')}Изменить адреса</button>`:'');
    if(tab==='ord')body+=os.length?'<div id="cu-og"></div>':`<div class="state">${ic('task','lg')}<b>Заказов пока нет</b>${can('ordEdit')&&c.status==='Активен'?`<button class="btn cta" id="cu-qo2">${ic('zap')}Быстрый заказ</button>`:''}</div>`;
    if(tab==='reg')body+=rg.length?'<div id="cu-rg"></div>':`<div class="state">${ic('repeat','lg')}<b>Регулярных заказов нет</b>${can('ordRegular')&&c.points.length?`<button class="btn cta" id="cu-r-add">${ic('plus')}Регулярный заказ</button>`:''}</div>`;
    if(tab==='money')body+=`<div class="plates">${plate({id:'d',icon:'wallet',color:L.debt>0.009?'red':'green',label:'Долг',value:fmtM(L.debt),unit:'сом'})}${plate({id:'u',icon:'clock',color:unp.length?'blue':'green',label:'Ждут оплаты',value:unp.length,sub:unp.length?money(unp.reduce((a,o)=>a+ordLeft(o),0)):'все заказы оплачены'})}${plate({id:'p',icon:'check',color:'green',label:'Оплачено всего',value:fmtM(L.paid,false),unit:'сом',sub:L.last?'последняя '+fmtD(L.last):''})}${plate({id:'a',icon:'coins',color:'purple',label:'Аванс',value:fmtM(L.advance||0,false),unit:'сом'})}</div>
      ${unp.length?`<div class="box"><h3>Ждут оплаты</h3><div class="list">${unp.map(o=>`<div class="li"><span class="pl-dot ${PAY_C[payStatus(o)][0]}">${ic('task')}</span><div class="grow"><div class="t1">${esc(o.no)} · ${dayLbl(o.date)} ${payPill(o)}</div><div class="t2">${esc(ordComp(o))} · осталось ${money(ordLeft(o))}</div></div>${can('myPay')?`<button class="btn sm cta" data-opay="${o.id}">${ic('coins','sm')}Внести оплату</button>`:''}</div>`).join('')}</div></div>`:''}
      <div class="row">${can('myPay')?`<button class="btn" id="cu-pay">${ic('plus','sm')}Оплата</button>`:''}${can('myDocs')?`<button class="btn" id="cu-act">${ic('file','sm')}Акт сверки</button>`:''}</div>
      <div class="box"><h3>Оплаты</h3>${ps.length?`<div class="list">${ps.map(p=>`<button type="button" class="li clk" data-pay="${p.id}">${p.file?`<img class="rcpt" src="${p.file}" alt="Чек оплаты">`:`<span class="pl-dot gray">${ic('coins')}</span>`}<span class="grow"><span class="t1">${money(p.sum)} · ${esc(dictName('payMethod',p.method))}${p.status!=='Проведена'?' <span class="pill gray sm">отменена</span>':''}</span><span class="t2">${fmtD(p.date)} · ${esc(p.no)}${p.order&&ORM[p.order]?' · заказ '+esc(ORM[p.order].no):''}${p.cour?' · получено курьером':''}${p.file?' · есть чек':''}</span></span></button>`).join('')}</div>`:'<div class="muted">Оплат пока нет.</div>'}</div>`;
    if(tab==='hist')body+=histBlock('customer','customer',c);
    const qo=can('ordEdit')&&c.status!=='В архиве';
    return {title:esc(c.name),sub:'Физлицо · '+esc(c.phone),body,
      foot:`<button class="btn" id="cu-more">${ic('more','sm')}Действия</button><div class="grow"></div><a class="btn" href="tel:${esc(phoneDigits(c.phone))}">${ic('phone','sm')}Позвонить</a>${qo?`<button class="btn cta" id="cu-qo">${ic('zap','sm')}Быстрый заказ</button>`:''}`,
      mount(el){bindCardTabs(el,'ct',t=>{tab=t;m.draw()});bindScale(el,'customer',c);
        $('#cu-more',el).onclick=e=>menu(e.currentTarget,cuActions(c).filter(x=>x&&x.label!=='Открыть'&&x.label!=='Быстрый заказ'));const on=(id,f)=>{const x=$(id,el);if(x)x.onclick=f};
        on('#cu-qo',()=>quickOrderDlg({cust:c.id}));on('#cu-qo2',()=>quickOrderDlg({cust:c.id}));on('#cu-r-add',()=>regularDlg(null,c.id));on('#cu-pt-ed',()=>personDlg(c,'pts'));on('#cu-pay',()=>payDlg(null,c.id));on('#cu-act',()=>actDlg(c.id));bindPtGeo(el,c);
        $$('[data-pay]',el).forEach(b=>b.onclick=()=>openPay(PAYS.find(p=>p.id===b.dataset.pay)));$$('[data-opay]',el).forEach(b=>b.onclick=()=>ordPayDlg(ORM[b.dataset.opay]));
        if($('#cu-og',el))grid($('#cu-og',el),{id:'cu-pog',cols:ordCols().filter(x=>x.key!=='cust'),show:['no','date','point','portions','sum','payst','status'],rows:()=>visOrders().filter(o=>o.cust===c.id),title:'no',open:openOrder,exportable:false,audit:false,firstRun:false,sort:{key:'date',dir:-1},ordered:true});
        if($('#cu-rg',el))grid($('#cu-rg',el),{id:'cu-rg',cols:regCols().filter(x=>x.key!=='cust'),rows:()=>REGS.filter(r=>r.cust===c.id),title:'point',open:r=>regularDlg(r),exportable:false,audit:false,firstRun:false})}}}})}
/* ═════════════ Точки доставки и адреса: один вложенный список ═════════════ */
// «Место» из справочника «Места доставки» подставляет адрес, район и геоточку; офис, этаж или квартира — в «Ориентир»; «Геоточка» уточняется на карте
function ptCols(per){const nm={key:'name',label:'Название',type:'text',w:130,req:!per},ad={key:'addr',label:'Адрес',type:'text',w:190,req:1};
  const rest=[{key:'mark',label:'Ориентир',type:'text',w:140},{key:'place',label:'Место',type:'sel',w:150,opts:r=>odOpts('place',r.place)},{key:'district',label:'Район',type:'sel',w:120,opts:r=>odOpts('district',r.district)},
    {key:'geo',label:'Геоточка',type:'ro',w:150,ro:(r,i)=>{const pl=placeOf(r.place);if(pl&&hasGeo(pl.geo))return '<span class="faint">из места</span>';return `<button type="button" class="btn sm" data-pgeo="${i}">${ic('pin','sm')}${hasGeo(r.geo)?(r.approx?'≈ по району':geoTxt(r.geo)):'Указать на карте'}</button>`}},
    {key:'contact',label:'Контакт на месте',type:'text',w:130},{key:'phone',label:'Телефон',type:'text',w:120},{key:'win',label:'Окно доставки',type:'text',w:100}];
  return per?[ad,rest[0],rest[1],rest[2],rest[3],nm,...rest.slice(4)]:[nm,ad,...rest]}
const blankPt=per=>({id:uid('pt'),name:'',addr:'',mark:'',place:'',contact:'',phone:'',win:per?'':'12:00–12:30',geo:'',district:'',approx:false});
function bindPts(el,id,rows,cols,redraw,per){bindLines(el,id,rows,cols,{blank:()=>blankPt(per),redraw,onChange:(r,k)=>{if(k!=='place')return;const pl=placeOf(r.place);
    if(pl){r.addr=pl.addr||r.addr;r.district=pl.district||r.district;if(hasGeo(pl.geo)){r.geo=pl.geo.slice();r.approx=false}if(per||!r.name)r.name=pl.name}redraw()}});
  $$(`#${id} [data-pgeo]`,el).forEach(b=>b.onclick=()=>{const r=rows[+b.dataset.pgeo];mapPickDlg({title:'Геоточка адреса',sub:esc(r.addr||'Адрес ещё не введён'),geo:r.geo,near:distGeo(r.district)},g=>{r.geo=g;r.approx=false;redraw()})})}
// Перед сохранением: у адреса физлица название по умолчанию — место или адрес, контакт — сам клиент; без геоточки ставится примерная по району (в продукте — геокодер по адресу)
function fixPts(pts,per,name,phone){return pts.map(p=>{const pl=placeOf(p.place);const q={...p};if(per){q.name=q.name||(pl?pl.name:q.addr);q.contact=q.contact||name;q.phone=q.phone||phone}autoGeo(q);return q})}
/* ═════════════ Юрлицо: форма ═════════════ */
// Форма юрлица: реквизиты и точки доставки (вложенный список); на телефоне короткие поля встают по два (mobile-pack.js), точки — плитками
function custDlg(c,focus){const isNew=!c;const v0=c?c._v||0:0;const st={pts:c?structuredClone(c.points):[{...blankPt(false),name:'Основная'}]};const ptc=ptCols(false);
  openModal({form:true,size:'wide',render:m=>({title:isNew?'Новое юрлицо':'Изменить юрлицо',sub:isNew?'Компания, ИП или учреждение':esc(c.name),body:`<div class="form">
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
    ${fld('Точки доставки',linesHtml('cf-pts',st.pts,ptc,{add:'Добавить точку',cards:true}),{req:true,full:true,id:'cf-pts',hint:'Хотя бы одна точка. Окно доставки — например, 12:00–12:30. «Место» (например, бизнес-центр) подставит адрес, район и геоточку'})}</div>`,
    foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="cf-ok">${isNew?'Добавить':'Сохранить'}</button>`,
    mount(el){bindPts(el,'cf-pts',st.pts,ptc,()=>keepForm(el,m),false);
      if(focus==='pts'){const t=$('#cf-pts',el);t&&t.scrollIntoView({block:'center'})}
      $('#cf-ok',el).onclick=()=>{const name=val(el,'cf-name'),inn=val(el,'cf-inn').replace(/\s/g,''),lim=val(el,'cf-lim'),ds=val(el,'cf-ds'),dl=val(el,'cf-dl');
        let ok=setErr(el,'cf-name',name?'':'Укажите наименование');ok=setErr(el,'cf-phone',val(el,'cf-phone')?'':'Укажите телефон')&&ok;
        ok=setErr(el,'cf-inn',inn&&!/^\d{14}$/.test(inn)?'ИНН — 14 цифр':inn&&CUSTS.some(x=>x.inn===inn&&x!==c)?'Заказчик с таким ИНН уже есть (в том числе в архиве)':'')&&ok;
        ok=setErr(el,'cf-lim',lim&&isNaN(num(lim))?'Введите число':'')&&ok;ok=setErr(el,'cf-ds',ds&&(isNaN(num(ds))||num(ds)<0||num(ds)>100)?'От 0 до 100':'')&&ok;ok=setErr(el,'cf-dl',dl&&isNaN(num(dl))?'Введите число дней':'')&&ok;
        const pts=st.pts.filter(p=>p.name||p.addr);ok=setErr(el,'cf-pts',!pts.length?'Добавьте хотя бы одну точку доставки':pts.some(p=>!p.name||!p.addr)?'У каждой точки нужны название и адрес':'')&&ok;if(!ok)return;
        if(c&&stale(c,v0))return;const ph=val(el,'cf-phone');
        const d={name,type:val(el,'cf-type'),phone:phoneNorm(ph)||ph,inn,contact:val(el,'cf-ct'),email:val(el,'cf-em'),contract:val(el,'cf-cn'),contractDate:val(el,'cf-cd'),pay:val(el,'cf-pay'),delay:dl?num(dl):0,limit:lim?num(lim):null,price:val(el,'cf-pr'),disc:ds?num(ds):0,resp:val(el,'cf-resp'),note:val(el,'cf-note')};
        const fx=fixPts(pts,false);
        if(isNew){const n=born({id:uid('c'),kind:'org',...d,points:fx,prices:{}});stStart(n,'Активен','Заказчик добавлен');CUSTS.push(n);log('customer',n.id,'Юрлицо добавлено',n);m.close();refreshAll();toast('Юрлицо добавлено');openCust(CUM[n.id])}
        else{const ch=Object.entries(d).filter(([k,v])=>String(c[k]??'')!==String(v??''));ch.forEach(([k,v])=>{log('customer',c.id,`${k}: ${c[k]??'—'} → ${v??'—'}`,c);c[k]=v});
          if(JSON.stringify(fx)!==JSON.stringify(c.points)){c.points=fx;log('customer',c.id,'Точки доставки изменены',c)}m.close();refreshAll();toast('Сохранено')}}}})})}
/* ═════════════ Физлицо: форма и создание ═════════════ */
// Способы оплаты физлица — без «Безналичного перевода» (он для юрлиц по счёту)
const perPayOpts=cur=>dictOpts('payMethod',cur).filter(([k])=>k!=='СО-001'||k===cur);
// Новое физлицо: из формы или само при быстром заказе; ответственный — кто создал, отсрочка 0, без лимита, прайс «Базовый»
function newPerson(d,note){const n=born({id:uid('c'),kind:'person',name:d.name,type:'',inn:'',contact:'',phone:d.phone,email:'',contract:'',contractDate:'',pay:d.pay||'СО-003',delay:0,limit:null,price:'base',disc:d.disc||0,prices:{},resp:S.me,note:d.note||'',points:d.points||[]});
  stStart(n,'Активен',note||'Клиент добавлен');CUSTS.push(n);CUM[n.id]=n;log('customer',n.id,note||'Клиент добавлен',n);return n}
function personDlg(c,focus){const isNew=!c;const v0=c?c._v||0:0;const st={pts:c?structuredClone(c.points):[]};const ptc=ptCols(true);
  openModal({form:true,size:'wide',render:m=>({title:isNew?'Новое физлицо':'Изменить физлицо',sub:isNew?'Частный клиент: имя и телефон':esc(c.name),body:`<div class="form">
    ${fld('Имя',inp('pf-name',c?c.name:'','autocomplete="off"'),{req:true,id:'pf-name'})}
    ${fld('Телефон',inp('pf-phone',c?c.phone:'','inputmode="tel" placeholder="0555 123 456"'),{req:true,id:'pf-phone',hint:'В любом виде: 0555 123 456 или +996 555 123 456'})}
    ${fld('Способ оплаты по умолчанию',sel('pf-pay',perPayOpts(c&&c.pay),c?c.pay:'СО-003'),{id:'pf-pay'})}
    ${fld('Скидка, %',inp('pf-ds',c?c.disc||'':'','inputmode="decimal"'),{id:'pf-ds'})}
    ${fld('Комментарий',`<textarea class="inp" id="pf-note" rows="2" placeholder="Например, аллергия на орехи">${esc(c?c.note:'')}</textarea>`,{full:true,id:'pf-note'})}
    ${fld('Адреса',linesHtml('pf-pts',st.pts,ptc,{add:'Добавить адрес',cards:true}),{full:true,id:'pf-pts',hint:'Подъезд, этаж, квартира или офис — в «Ориентир». «Место» (например, бизнес-центр) подставит адрес, район и геоточку'})}</div>`,
    foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="pf-ok">${isNew?'Добавить':'Сохранить'}</button>`,
    mount(el){bindPts(el,'pf-pts',st.pts,ptc,()=>keepForm(el,m),true);
      if(focus==='pts'){const t=$('#pf-pts',el);t&&t.scrollIntoView({block:'center'})}
      $('#pf-ok',el).onclick=()=>{const name=val(el,'pf-name'),raw=val(el,'pf-phone'),ph=phoneNorm(raw),ds=val(el,'pf-ds');const dup=ph&&phoneTaken(ph,c);
        let ok=setErr(el,'pf-name',name?'':'Укажите имя');ok=setErr(el,'pf-phone',!raw?'Укажите телефон':!ph?'Номер: 9 цифр после +996, например 0555 123 456':dup?'Клиент с таким телефоном уже есть':'')&&ok;
        if(dup){const e=$('[data-f="pf-phone"] .err',el);e.insertAdjacentHTML('beforeend',` <button type="button" class="linkbtn" id="pf-dup">Открыть</button>`);$('#pf-dup',el).onclick=()=>{m.close();openCust(dup)}}
        ok=setErr(el,'pf-ds',ds&&(isNaN(num(ds))||num(ds)<0||num(ds)>100)?'От 0 до 100':'')&&ok;
        const pts=st.pts.filter(p=>p.addr||p.mark||p.place);ok=setErr(el,'pf-pts',pts.some(p=>!p.addr)?'У каждого адреса нужен «Адрес»':'')&&ok;if(!ok)return;
        if(c&&stale(c,v0))return;const d={name,phone:ph,pay:val(el,'pf-pay'),disc:ds?num(ds):0,note:val(el,'pf-note')};const fx=fixPts(pts,true,name,ph);
        if(isNew){const n=newPerson({...d,points:fx},'Физлицо добавлено');m.close();refreshAll();toast('Физлицо добавлено','user');openCust(CUM[n.id]);return}
        const ch=Object.entries(d).filter(([k,v])=>String(c[k]??'')!==String(v??''));ch.forEach(([k,v])=>{log('customer',c.id,`${k}: ${c[k]??'—'} → ${v??'—'}`,c);c[k]=v});
        if(JSON.stringify(fx)!==JSON.stringify(c.points)){c.points=fx;log('customer',c.id,'Адреса изменены',c)}m.close();refreshAll();toast('Сохранено')}}})})}
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
// Загрузка юрлиц списком: сопоставление по ИНН, тип и способ оплаты — по названию из справочника
function cuImportDlg(){const by=(id,v)=>DICT[id].items.find(x=>x.active!==false&&(x.name.toLowerCase()===v.toLowerCase()||x.code===v));ORG.imports=ORG.imports||[];
  importDlg({title:'Загрузка юрлиц из Excel',file:'Шаблон заказчиков',key:'inn',log:ORG.imports,
    cols:[{key:'name',label:'Наименование',req:true},{key:'inn',label:'ИНН',req:true,hint:'14 цифр',parse:v=>v.replace(/\s/g,''),check:v=>/^\d{14}$/.test(v)?'':'нужно 14 цифр'},
      {key:'type',label:'Тип',hint:'Одно из: '+DICT.custType.items.map(x=>x.name).join(', '),parse:v=>{const x=by('custType',v);return x?x.code:'?'+v},check:v=>v[0]==='?'?`нет в справочнике «${v.slice(1)}»`:''},
      {key:'phone',label:'Телефон',req:true,hint:'+996 …',parse:v=>phoneNorm(v)||v,check:v=>phoneNorm(v)?'':'номер: 9 цифр после +996'},{key:'contact',label:'Контактное лицо'},
      {key:'pay',label:'Способ оплаты',hint:'Одно из: '+DICT.payMethod.items.map(x=>x.name).join(', '),parse:v=>{const x=by('payMethod',v);return x?x.code:'?'+v},check:v=>v[0]==='?'?`нет в справочнике «${v.slice(1)}»`:''},
      {key:'addr',label:'Адрес доставки',req:true,hint:'Адрес первой точки доставки'}],
    example:[{name:'ОсОО «Пример»',inn:'01203201910123',type:'Компания',phone:'+996 555 000 001',contact:'Иванов Иван',pay:'Безналичный перевод',addr:'Бишкек, ул. Примерная, 1'}],
    find:row=>CUSTS.find(c=>c.inn===row.inn),
    apply:(nw,ch)=>{nw.forEach(r=>{const {_n,addr,...d}=r;const n=born({id:uid('c'),kind:'org',...d,type:d.type||'ТЗ-001',pay:d.pay||'СО-001',delay:ORG.policy.delay??7,limit:null,price:'base',disc:0,prices:{},resp:'',note:'',email:'',contract:'',contractDate:'',
      points:[{...blankPt(false),name:'Основная',addr,contact:d.contact||'',phone:d.phone}]});stStart(n,'Активен','Загружен из Excel');CUSTS.push(n);log('customer',n.id,'Заказчик загружен из Excel',n)});
      ch.forEach(({rec,diff})=>diff.forEach(d=>{if(d.c.key==='addr')return;log('customer',rec.id,`${d.c.label}: ${d.from||'—'} → ${d.to} (из Excel)`,rec);rec[d.c.key]=d.to}))}})}
