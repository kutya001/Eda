'use strict';
// Модули «Доставка» и «Маршрут»: рейсы «Формируется → Загружен → В пути → Завершён», распределение заказов по месту, району и окну, карта точек, порядок объезда, погрузка, маршрут курьера списком и на карте без сети, сдача наличных, возврат тары
/* ═════════════ Рейсы: расчёты ═════════════ */
const tripOrders=t=>t.orders.map(id=>ORM[id]).filter(Boolean);
const tripLive=t=>tripOrders(t).filter(o=>o.status!=='Отменён');
const tripPoints=t=>new Set(tripLive(t).map(ptKey)).size;
const tripPortions=t=>tripLive(t).reduce((a,o)=>a+ordPortions(o),0);
// Наличными к получению: заказы со способом оплаты «Наличные курьеру» — сумма заказа минус оплаченное заранее
const cashDue=o=>o.pay==='СО-002'&&!o.pickup?Math.max(0,Math.round((ordSum(o)-ordPrepaid(o))*100)/100):0;
const tripCashDue=t=>Math.round(tripLive(t).reduce((a,o)=>a+cashDue(o),0)*100)/100;
const tripGot=t=>Math.round(tripOrders(t).filter(o=>o.status==='Доставлен').reduce((a,o)=>a+(+o.cash||0),0)*100)/100;
const tripDone=t=>tripLive(t).filter(o=>o.status==='Доставлен').length;
// Наличные рейса: «Не сдано» → «Ждёт приёма» (курьер сдал) → «Принято» (бухгалтер или управляющий подтвердил)
const CASH_C={'Не сдано':['orange','wallet'],'Ждёт приёма':['purple','hourglass'],'Принято':['green','check']};
const cashStatus=t=>t.cash?t.cash.status:tripGot(t)>0?'Не сдано':'';
const tripLbl=t=>`${t.no} · ${empName(t.courier)||'без курьера'}`;
// Возврат тары: у заказа «Выдано» и «Забрано», у заказчика — «Контейнеров на руках»
const taraOf=cid=>ORDERS.filter(o=>o.cust===cid&&o.tara).reduce((a,o)=>a+(+o.tara.out||0)-(+o.tara.back||0),0);
// Рейс завершается сам, когда все его заказы «Доставлен» или «Не доставлен» и отметки отправлены
function tripCheck(o){const t=o.trip&&TRM[o.trip];if(!t||t.status!=='В пути')return;if(tripLive(t).every(x=>['Доставлен','Не доставлен'].includes(x.status)&&!x.pending))sysStatus('trip',t,'Завершён','Все заказы рейса доставлены или не доставлены')}
SC_WHY.trip=(t,to,back)=>{if(back)return;
  if(to==='Загружен'){const os=tripLive(t);if(!os.length)return 'В рейсе нет заказов';const nr=os.filter(o=>o.status!=='Готов');if(nr.length)return `Не готово заказов: ${nr.length} — погрузка после отметки кухни «Готов»`}
  if(to==='В пути'){if(t.courier!==S.me&&!isOwner())return 'Начать рейс может только курьер рейса';if(S.offline)return 'Нет связи: начать рейс можно при подключении к сети'}};
SC_HOOK.trip=(t,to,done)=>{if(to==='Загружен'){loadDlg(t,done);return true}
  if(to==='В пути'){confirmDlg({title:`Начать рейс ${esc(t.no)}?`,text:`Заказы рейса (${tripLive(t).length}) перейдут в «В пути», заказчики получат уведомление. Маршрутный лист сохранится в телефоне: отметки можно ставить и без сети.`,ok:'Начать рейс',run:()=>{setStatus('trip',t,'В пути');done&&done()}});return true}};
SC_AFTER.trip=(t,from,to,rb)=>{
  if(to==='В пути'&&!rb)tripLive(t).filter(o=>o.status==='Готов').forEach(o=>setStatus('order',o,'В пути','Рейс '+t.no+' начат',false,{silent:true}));
  if(rb&&from==='В пути')tripLive(t).filter(o=>o.status==='В пути').forEach(o=>{o.pending=null;setStatus('order',o,'Готов','Откат рейса '+t.no,true,{silent:true})});
  if(to==='Загружен'&&!rb&&t.courier)notify('trip',{emps:[t.courier]},`Рейс ${t.no} загружен: можно выезжать`,'route')};

/* ═════════════ Модуль «Доставка» ═════════════ */
function dlTabs(){const v=visTrips();return [{id:'today',label:'Рейсы на сегодня',icon:'calendar',count:v.filter(t=>t.date===TODAY&&t.status!=='Завершён').length||''},{id:'tomorrow',label:'Рейсы на завтра',icon:'clock',count:v.filter(t=>t.date===TOMORROW()).length||''},
  {id:'all',label:'Все рейсы',icon:'list'},{id:'map',label:'Карта',icon:'map'},seeAll('delivery')?{id:'fleet',label:'Курьеры и транспорт',icon:'truck'}:null].filter(Boolean)}
function dlAdd(){const d=S.tab==='tomorrow'?TOMORROW():S.tab==='map'&&S.dlm?S.dlm.date:TODAY;return [can('dlTrips')&&{label:'Рейс',icon:'truck',run:()=>tripDlg(null,{date:d})},can('dlTrips')&&{label:'Распределить заказы',icon:'send',run:()=>distributeDlg(d)}]}
const unassigned=(date,shift)=>ORDERS.filter(o=>o.date===date&&(!shift||o.shift===shift)&&canTrip(o)&&!o.trip);
function tripCols(){return [
  {key:'no',label:'№',type:'text',w:100,val:t=>t.no,cls:'mono'},
  {key:'date',label:'Дата',type:'date',w:130,val:t=>t.date,sortVal:t=>t.date+' '+(t.dep||''),text:t=>fmtD(t.date)+(relDay(t.date)?' · '+relDay(t.date):'')},
  {key:'shift',label:'Смена',type:'enum',w:100,val:t=>shiftName(t.shift)},
  {key:'courier',label:'Курьер',type:'enum',w:150,val:t=>empName(t.courier)||'Не назначен'},
  {key:'vehicle',label:'Транспорт',type:'enum',w:170,val:t=>odName('vehicle',t.vehicle)},
  {key:'dep',label:'Выезд в',type:'text',w:90,val:t=>t.dep},
  {key:'pts',label:'Точек',type:'int',num:1,total:1,w:80,val:tripPoints},
  {key:'portions',label:'Порций',type:'int',num:1,total:1,w:90,val:tripPortions},
  {key:'done',label:'Доставлено',type:'text',w:110,val:t=>`${tripDone(t)} из ${tripLive(t).length}`,sortVal:t=>tripDone(t)},
  {key:'cash',label:'Наличными, сом',type:'money',num:1,total:1,w:130,val:tripCashDue},
  {key:'got',label:'Получено наличными, сом',type:'money',num:1,total:1,w:150,val:tripGot},
  {key:'cst',label:'Наличные',type:'enum',w:130,val:cashStatus,html:t=>cashStatus(t)?pill(cashStatus(t),CASH_C,'sm'):''},
  {key:'status',label:'Статус',type:'enum',w:190,val:t=>t.status,html:t=>scaleMini('trip',t)},
  {key:'note',label:'Комментарий',type:'text',w:200,val:t=>t.note}]}
function renderDelivery(body,tab,fresh){if(tab==='fleet')return renderFleet(body,fresh);if(tab==='map')return renderDlMap(body,fresh);
  const d=tab==='tomorrow'?TOMORROW():TODAY;const v=visTrips();const ua=unassigned(d);const dt=v.filter(t=>t.date===d);const nd=visOrders().filter(o=>o.date===d&&o.status==='Не доставлен');
  const left=dt.reduce((a,t)=>a+tripLive(t).filter(o=>!['Доставлен','Не доставлен'].includes(o.status)).reduce((x,o)=>x+cashDue(o),0),0);const hands=v.filter(t=>cashStatus(t)&&cashStatus(t)!=='Принято').reduce((a,t)=>a+(t.cash?t.cash.sent:tripGot(t)),0);
  body.innerHTML=`<div class="plates">
    ${plate({id:'ua',icon:'send',color:ua.length?'orange':'green',label:'Без рейса',value:ua.length,sub:(d===TODAY?'сегодня':'завтра')+(ua.length&&can('dlTrips')?' · распределить':'')})}
    ${plate({id:'way',icon:'truck',color:'yellow',label:'В пути',value:dt.filter(t=>t.status==='В пути').length,sub:`${plural(dt.length,'рейс','рейса','рейсов')} на ${d===TODAY?'сегодня':'завтра'}: ${dt.length}`})}
    ${plate({id:'nd',icon:'alert',color:nd.length?'red':'green',label:'Не доставлено',value:nd.length})}
    ${plate({id:'cash',icon:'wallet',color:'purple',label:'Наличными к получению',value:fmtM(left,false),unit:'сом',sub:hands?'у курьеров '+money(hands):''})}</div><div id="dlg"></div>`;
  body.querySelector('.plates').onclick=e=>{const b=e.target.closest('[data-plate]');if(!b)return;const id=b.dataset.plate;
    if(id==='ua'){if(can('dlTrips'))distributeDlg(d);else go('orders',d===TODAY?'today':'tomorrow')}if(id==='way')go('delivery',tab==='all'?'all':tab,{status:{type:'enum',vals:['В пути']}});if(id==='nd')go('orders','all',{status:{type:'enum',vals:['Не доставлен']}});if(id==='cash'&&canAny('myView','dlRoute'))go('money','cash')};
  const rows=()=>{const v=visTrips();return tab==='all'?v:v.filter(t=>t.date===d)};
  grid($('#dlg',body),{id:'dl-'+tab,cols:tripCols(),show:['no','date','courier','pts','portions','done','cash','status'],rows,title:'no',noun:['рейс','рейса','рейсов'],xlsName:'Рейсы',
    sort:{key:'date',dir:tab==='all'?-1:1},ordered:true,rowClass:t=>tripLive(t).some(o=>o.status==='Не доставлен')?'warn':'',actions:tripActions,open:openTrip,preset:S.preset,simulateLoad:fresh,
    empty:{icon:'truck',title:tab==='all'?'Рейсов пока нет':`На ${d===TODAY?'сегодня':'завтра'} рейсов нет`,text:ua.length?`Заказов без рейса: ${ua.length}`:'',add:can('dlTrips')?()=>ua.length?distributeDlg(d):tripDlg(null,{date:d}):null}})}
function tripActions(t){const nx=scNext('trip',t);const bk=scBack('trip',t);const ed=can('dlTrips')&&t.status==='Формируется';return [{label:'Открыть',icon:'right',run:()=>openTrip(t)},
  ed&&{label:'Изменить',icon:'edit',run:()=>tripDlg(t)},ed&&{label:'Добавить заказы',icon:'plus',run:()=>distributeDlg(t.date,t.shift)},
  nx&&!scWhyNot('trip',t,nx)&&{label:nx==='В пути'?'Начать рейс':`Перевести в «${nx}»`,icon:'check',run:()=>stepTo('trip',t,nx)},
  t.courier===S.me&&cashStatus(t)==='Не сдано'&&{label:'Сдать наличные',icon:'wallet',run:()=>cashDlg(t)},
  {label:'Маршрутный лист',icon:'file',run:()=>printRoute(t)},
  canBack('trip')&&bk&&{label:`Откатить в «${bk}»`,icon:'history',run:()=>rollbackDlg('trip',t,bk)},
  ed&&{sep:1},ed&&{label:'Удалить рейс',icon:'trash',danger:true,run:()=>confirmDlg({title:`Удалить рейс ${esc(t.no)}?`,text:`Заказы рейса (${t.orders.length}) снова будут без рейса.`,ok:'Удалить',danger:true,run:()=>{tripOrders(t).forEach(o=>{o.trip='';log('order',o.id,`Убран из рейса ${t.no}: рейс удалён`,o)});TRIPS.splice(TRIPS.indexOf(t),1);log('trip',t.id,'Рейс удалён',null);MODALS.slice().forEach(m=>m.o.trip===t&&m.close());refreshAll();toast('Рейс удалён','trash')}})}]}
function openTrip(t){if(!t)return;let tab='ord';
  openModal({size:'wide',live:true,trip:t,render:m=>{if(!TRIPS.includes(t))return {title:'Рейс удалён',body:'<div class="muted">Рейс удалён.</div>'};const os=tripOrders(t);const ed=can('dlTrips')&&t.status==='Формируется';
    const tabs=[['ord','Заказы','task',os.length],['load','Погрузка','archive'],['cash','Наличные','wallet',cashStatus(t)==='Ждёт приёма'?'!':''],['hist','История','list']];let body=cardTabs(tabs,tab,'tt');
    if(tab==='ord'){body+=`<div class="box">${scaleFull('trip',t)}</div><div class="box"><div class="kv">${kv('Дата',dayLbl(t.date)+(relDay(t.date)?' · '+relDay(t.date):''))}${kv('Смена',esc(shiftName(t.shift)))}${kv('Курьер',esc(EM[t.courier]?EM[t.courier].fio:'Не назначен'))}${kv('Транспорт',esc(odName('vehicle',t.vehicle))+(t.vehicle?`<div class="faint">${esc((ODICT.vehicle.items.find(x=>x.code===t.vehicle)||{}).note||'')}</div>`:''))}
        ${kv('Выезд в',esc(t.dep))}${kv('Точек',tripPoints(t))}${kv('Порций',tripPortions(t))}${kv('Наличными к получению',money(tripCashDue(t)))}${feat('tara')?kv('Контейнеры',`выдано ${os.reduce((a,o)=>a+(o.tara?+o.tara.out||0:0),0)} · забрано ${os.reduce((a,o)=>a+(o.tara?+o.tara.back||0:0),0)}`):''}${auditKv(t)}${kv('Комментарий',esc(t.note),1)}</div></div>
      <div class="box"><h3>Заказы по порядку объезда</h3>${ed&&os.length>1?`<div class="hint">Перетащите строку или нажмите «Выше / Ниже»</div>`:''}<ol class="tr-ord">${os.map((o,i)=>{const pt=pointOf(o);return `<li ${ed?`draggable="true"`:''} data-i="${i}"><span class="rt-n">${i+1}</span><div class="grow"><div class="t1">${esc(custName(o.cust))} · ${esc(pt.name)}</div><div class="t2">${esc(pt.addr||'')}${pt.win?' · окно '+esc(pt.win):''} · ${ordPortions(o)} порц.${cashDue(o)?' · наличными '+money(cashDue(o)):''}</div></div>${scPill('order',o.status,'sm')}${o.pending?' <span class="pill yellow sm">ждёт отправки</span>':''}
        <span class="tr-btns"><button class="icon-btn sm" data-oo="${o.id}" aria-label="Открыть заказ" title="Открыть заказ">${ic('right','sm')}</button>${ed?`${i>0?`<button class="icon-btn sm" data-up="${i}" aria-label="Выше" title="Выше">${ic('up','sm')}</button>`:''}${i<os.length-1?`<button class="icon-btn sm" data-dn="${i}" aria-label="Ниже" title="Ниже">${ic('dn','sm')}</button>`:''}<button class="icon-btn sm" data-rm="${o.id}" aria-label="Убрать из рейса" title="Убрать из рейса">${ic('x','sm')}</button>`:''}</span></li>`}).join('')||'<li class="muted">Заказов в рейсе пока нет</li>'}</ol>
        ${ed?`<button class="btn" id="tr-add">${ic('plus','sm')}Добавить заказы</button>`:''}</div>`}
    if(tab==='load')body+=`<div class="note">${ic('info')}<span>Сборочный лист рейса: что положить в машину по каждому заказу. После погрузки повар или управляющий ставит «Загружен».</span></div>${loadHtml(t)}`;
    if(tab==='cash'){const c=t.cash;const got=tripGot(t);body+=`<div class="box"><div class="kv">${kv('К получению по рейсу',money(tripCashDue(t)))}${kv('Получено от заказчиков',money(got))}${kv('Статус',cashStatus(t)?pill(cashStatus(t),CASH_C):'Наличных нет')}${c?kv('Сдано',money(c.sent)+' · '+fmtDT(c.at))+kv('Разница',`<b class="${Math.abs(c.got-c.sent)>0.009?'red':''}">${money(Math.round((c.sent-c.got)*100)/100)}</b>`)+kv('Принял',c.acc?esc(whoName(c.acc))+' · '+fmtDT(c.accAt):'—')+kv('Комментарий',esc(c.comment),1):''}</div></div>
      <div class="box"><table class="mini"><thead><tr><th>Заказ</th><th>Заказчик</th><th class="num">К получению</th><th class="num">Получено</th></tr></thead><tbody>${os.filter(o=>cashDue(o)||o.cash).map(o=>`<tr><td class="mono">${esc(o.no)}</td><td>${esc(custName(o.cust))}</td><td class="num tnum">${fmtM(cashDue(o))}</td><td class="num tnum">${o.cash?fmtM(o.cash):'—'}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">В рейсе нет заказов с оплатой наличными курьеру</td></tr>'}</tbody></table></div>`}
    if(tab==='hist')body+=histBlock('trip','trip',t);
    const nx=scNext('trip',t);const canNx=nx&&!scWhyNot('trip',t,nx);
    return {title:'Рейс '+esc(t.no),sub:esc(empName(t.courier)||'Курьер не назначен')+' · '+fmtD(t.date),body,
      foot:`<button class="btn" id="tr-more">${ic('more','sm')}Действия</button><div class="grow"></div>${t.courier===S.me&&cashStatus(t)==='Не сдано'?`<button class="btn" id="tr-cash">${ic('wallet','sm')}Сдать наличные</button>`:''}${can('myCash')&&cashStatus(t)==='Ждёт приёма'?`<button class="btn" id="tr-acc">${ic('check','sm')}Принять наличные</button>`:''}${ed?`<button class="btn" id="tr-ed">${ic('edit','sm')}Изменить</button>`:''}${canNx?`<button class="btn cta" id="tr-nx">${ic(nx==='В пути'?'truck':'check','sm')}${nx==='В пути'?'Начать рейс':esc(nx)}</button>`:''}`,
      mount(el){bindCardTabs(el,'tt',x=>{tab=x;m.draw()});bindScale(el,'trip',t);$('#tr-more',el).onclick=e=>menu(e.currentTarget,tripActions(t).filter(x=>x&&x.label!=='Открыть'));const on=(id,f)=>{const x=$(id,el);if(x)x.onclick=f};
        on('#tr-ed',()=>tripDlg(t));on('#tr-nx',()=>stepTo('trip',t,nx));on('#tr-add',()=>distributeDlg(t.date,t.shift));on('#tr-cash',()=>cashDlg(t));on('#tr-acc',()=>acceptCashDlg(t));
        $$('[data-oo]',el).forEach(b=>b.onclick=()=>openOrder(ORM[b.dataset.oo]));
        const mv=(i,j)=>{const a=t.orders;const[x]=a.splice(i,1);a.splice(j,0,x);log('trip',t.id,'Порядок объезда изменён',t);refreshAll()};
        $$('[data-up]',el).forEach(b=>b.onclick=()=>mv(+b.dataset.up,+b.dataset.up-1));$$('[data-dn]',el).forEach(b=>b.onclick=()=>mv(+b.dataset.dn,+b.dataset.dn+1));
        $$('[data-rm]',el).forEach(b=>b.onclick=()=>{const o=ORM[b.dataset.rm];t.orders=t.orders.filter(x=>x!==o.id);o.trip='';log('order',o.id,`Убран из рейса ${t.no}`,o);log('trip',t.id,`Убран заказ ${o.no}`,t);refreshAll()});
        // Перетаскивание строк порядка объезда (ПК); на телефоне — «Выше / Ниже»
        let from=null;$$('.tr-ord li[draggable]',el).forEach(li=>{li.ondragstart=e=>{from=+li.dataset.i;li.classList.add('drag');e.dataTransfer.effectAllowed='move'};li.ondragend=()=>li.classList.remove('drag');
          li.ondragover=e=>{e.preventDefault();li.classList.add('over')};li.ondragleave=()=>li.classList.remove('over');li.ondrop=e=>{e.preventDefault();li.classList.remove('over');const to=+li.dataset.i;if(from!=null&&from!==to)mv(from,to);from=null}})}}}})}
// Сборочный лист рейса: блюда по каждому заказу (комплексы раскрыты по меню дня)
function loadHtml(t){const os=tripLive(t);if(!os.length)return '<div class="muted">В рейсе нет заказов.</div>';const tot={};
  const rows=os.map((o,i)=>{const mn=menuOf(o.date,o.shift);const ds={};o.lines.forEach(l=>Object.entries(expandLine(l,mn)).forEach(([d,q])=>{ds[d]=(ds[d]||0)+q;tot[d]=(tot[d]||0)+q}));
    return `<div class="box"><h3>${i+1}. ${esc(custName(o.cust))} · ${esc(ordPointName(o))} <span class="pill gray sm">${esc(o.no)}</span> ${scPill('order',o.status,'sm')}</h3><div class="faint">${esc(ordComp(o))}${o.note?' · '+esc(o.note):''}</div>
      <table class="mini"><tbody>${Object.entries(ds).map(([d,q])=>`<tr><td>${esc((DSM[d]||{}).name||'')}</td><td class="num tnum">${q}</td></tr>`).join('')}</tbody></table></div>`}).join('');
  return rows+`<div class="box"><h3>Всего в машину</h3><table class="mini"><tbody>${Object.entries(tot).sort((a,b)=>COLL.compare((DSM[a[0]]||{}).name||'',(DSM[b[0]]||{}).name||'')).map(([d,q])=>`<tr><td>${esc((DSM[d]||{}).name||'')}</td><td class="num tnum"><b>${q}</b></td></tr>`).join('')}</tbody></table></div>`}
// «Загружен»: отметить погрузку каждого заказа по сборочному листу
function loadDlg(t,done){const st=new Set();openModal({form:true,size:'mid',render:m=>({title:`Погрузка рейса ${esc(t.no)}`,sub:esc(empName(t.courier))+' · '+esc(odName('vehicle',t.vehicle)),body:`<div class="note">${ic('archive')}<span>Отметьте каждый погруженный заказ. Все отмечены — рейс «Загружен», курьер получит уведомление.</span></div>
  <div class="list">${tripLive(t).map(o=>`<label class="li ld-li"><input type="checkbox" data-ld="${o.id}" ${st.has(o.id)?'checked':''}><div class="grow"><div class="t1">${esc(custName(o.cust))} · ${esc(ordPointName(o))}</div><div class="t2">${esc(ordComp(o))}</div></div><b class="tnum">${ordPortions(o)}</b></label>`).join('')}</div>`,
  foot:`<button class="btn ghost" data-close>Отмена</button><span class="grow"></span><span class="faint" id="ld-n">Отмечено ${st.size} из ${tripLive(t).length}</span><button class="btn cta" id="ld-ok" ${st.size<tripLive(t).length?'disabled':''}>${ic('check','sm')}Загружен</button>`,
  mount(el){$$('[data-ld]',el).forEach(c=>c.onchange=()=>{c.checked?st.add(c.dataset.ld):st.delete(c.dataset.ld);$('#ld-n',el).textContent=`Отмечено ${st.size} из ${tripLive(t).length}`;$('#ld-ok',el).disabled=st.size<tripLive(t).length});
    $('#ld-ok',el).onclick=()=>{m.close();setStatus('trip',t,'Загружен','Погружено по сборочному листу');done&&done()}}})})}
// Новый рейс и изменение рейса
function makeTrip(d){const t=born({id:uid('tr'),no:nextNo('trip','Р'),orders:[],cash:null,note:'',...d});stStart(t,'Формируется','Рейс создан');TRIPS.push(t);TRM[t.id]=t;log('trip',t.id,'Рейс создан',t);
  if(t.courier)notify('trip',{emps:[t.courier]},`Вам назначен рейс ${t.no} на ${fmtD(t.date)}`,'route');return t}
function tripDlg(t,pre={}){const isNew=!t;openModal({form:true,render:m=>({title:isNew?'Новый рейс':'Изменить рейс '+esc(t.no),body:`<div class="form">
  ${fld('Дата',inp('tf-d',t?t.date:pre.date||TODAY,`type="date" ${t?'disabled':''}`),{req:true,id:'tf-d'})}${fld('Смена',sel('tf-s',activeShifts(),t?t.shift:defShift(),t?'disabled':''),{req:true,id:'tf-s'})}
  ${fld('Курьер',sel('tf-c',[['','—'],...couriers().map(e=>[e.id,e.short])],t?t.courier:''),{req:true,id:'tf-c'})}${fld('Транспорт',sel('tf-v',[['','—'],...odOpts('vehicle',t&&t.vehicle)],t?t.vehicle:''),{id:'tf-v',hint:'Справочник «Транспорт» — в модуле «Справочники»'})}
  ${fld('Выезд в',inp('tf-t',t?t.dep:'11:30','type="time"'),{id:'tf-t'})}${fld('Комментарий',inp('tf-n',t?t.note:''),{full:true,id:'tf-n'})}</div>`,
  foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="tf-ok">${isNew?'Создать рейс':'Сохранить'}</button>`,
  mount(el){$('#tf-ok',el).onclick=()=>{const c=val(el,'tf-c');if(!setErr(el,'tf-c',c?'':'Выберите курьера'))return;const d={courier:c,vehicle:val(el,'tf-v'),dep:val(el,'tf-t'),note:val(el,'tf-n')};
    if(isNew){const n=makeTrip({date:val(el,'tf-d'),shift:val(el,'tf-s'),...d});m.close();refreshAll();toast('Рейс '+n.no+' создан','truck');openTrip(n);return}
    const was=t.courier;Object.assign(t,d);log('trip',t.id,was!==c?`Курьер: ${empName(was)} → ${empName(c)}`:'Рейс изменён',t);if(was!==c)notify('trip',{emps:[c]},`Вам назначен рейс ${t.no} на ${fmtD(t.date)}`,'route');m.close();refreshAll();toast('Сохранено')}}})})}
function addToTrip(t,os){os.forEach(o=>{if(o.trip===t.id)return;const old=o.trip&&TRM[o.trip];if(old)old.orders=old.orders.filter(x=>x!==o.id);o.trip=t.id;t.orders.push(o.id);log('order',o.id,`Добавлен в рейс ${t.no}`,o)});log('trip',t.id,`Добавлено заказов: ${os.length}`,t)}
// «Добавить в рейс»: в существующий рейс «Формируется» на ту же дату и смену или в новый
function tripPickDlg(os,done){const ok=os.filter(canTrip);if(!ok.length){toast('Эти заказы нельзя добавить в рейс: нужен статус «Принят», «Готовится» или «Готов», доставка (не самовывоз) и рейс «Формируется»','alert',true);return}
  const keys=[...new Set(ok.map(o=>o.date+'|'+o.shift))];if(keys.length>1){toast('Выберите заказы на одну дату и смену','alert',true);return}const[date,shift]=keys[0].split('|');
  const ts=TRIPS.filter(t=>t.date===date&&t.shift===shift&&t.status==='Формируется');const st={to:ts.length?ts[0].id:'new'};
  openModal({form:true,noMax:true,render:m=>({title:'Добавить в рейс',sub:`${ok.length} ${plural(ok.length,'заказ','заказа','заказов')} · ${ok.reduce((a,o)=>a+ordPortions(o),0)} порц. · ${dayLbl(date)}`,body:`<div class="form">
    ${fld('Рейс',sel('tp-t',[...ts.map(t=>[t.id,`${tripLbl(t)} · ${tripPoints(t)} ${plural(tripPoints(t),'точка','точки','точек')}`]),['new','+ Новый рейс']],st.to),{req:true,full:true,id:'tp-t'})}
    ${st.to==='new'?fld('Курьер',sel('tp-c',[['','—'],...couriers().map(e=>[e.id,e.short])],''),{req:true,id:'tp-c'})+fld('Транспорт',sel('tp-v',[['','—'],...odOpts('vehicle')],''),{id:'tp-v'})+fld('Выезд в',inp('tp-d','11:30','type="time"'),{id:'tp-d'}):''}</div>
    ${ok.length<os.length?`<div class="note warn">${ic('alert')}<span>Пропущено заказов: ${os.length-ok.length} — самовывоз, неподходящий статус или рейс уже загружен.</span></div>`:''}`,
    foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="tp-ok">${ic('send','sm')}Добавить</button>`,
    mount(el){$('#tp-t',el).onchange=e=>{st.to=e.target.value;keepForm(el,m)};
      $('#tp-ok',el).onclick=()=>{let t=TRM[st.to];if(st.to==='new'){const c=val(el,'tp-c');if(!setErr(el,'tp-c',c?'':'Выберите курьера'))return;t=makeTrip({date,shift,courier:c,vehicle:val(el,'tp-v'),dep:val(el,'tp-d')})}
        addToTrip(t,ok);m.close();done&&done();refreshAll();toast(`В рейс ${t.no} добавлено: ${ok.length}`,'send')}}})})}
// «Распределить заказы»: заказы на дату без рейса, сгруппированные по месту (бизнес-центр — одна группа, остальные адреса по одному), району или окну доставки
function distributeDlg(date,shift){const st={by:store.get('dl.by','place'),sel:new Set(),date:date||TODAY,shift:shift||defShift()};
  openModal({size:'wide',live:true,render:m=>{const os=unassigned(st.date,st.shift);[...st.sel].forEach(id=>{if(!os.some(o=>o.id===id))st.sel.delete(id)});
    const key=o=>st.by==='place'?ptLabel(o):st.by==='district'?odName('district',pointOf(o).district)||'Район не указан':o.time||pointOf(o).win||'Окно не указано';const G={};os.forEach(o=>(G[key(o)]=G[key(o)]||[]).push(o));
    const gl=Object.entries(G).sort((a,b)=>st.by==='place'?b[1].reduce((x,o)=>x+ordPortions(o),0)-a[1].reduce((x,o)=>x+ordPortions(o),0)||COLL.compare(a[0],b[0]):COLL.compare(a[0],b[0]));
    const selP=os.filter(o=>st.sel.has(o.id)).reduce((a,o)=>a+ordPortions(o),0);
    return {title:'Распределить заказы',sub:'Заказы без рейса · '+dayLbl(st.date),body:`<div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">${inp('ds-d',st.date,'type="date" style="max-width:170px"')}${sel('ds-s',activeShifts(),st.shift,'style="max-width:140px"')}${segHtml('ds-by',[['place','По месту'],['district','По району'],['win','По окну доставки']],st.by)}</div>
      ${os.length?gl.map(([g,xs])=>`<div class="box"><h3><label class="row" style="gap:8px"><input type="checkbox" data-dg="${esc(g)}" ${xs.every(o=>st.sel.has(o.id))?'checked':''}>${esc(g)}</label><span class="pill gray sm">${xs.length} ${plural(xs.length,'заказ','заказа','заказов')} · ${xs.reduce((a,o)=>a+ordPortions(o),0)} порц.</span></h3>
        <div class="list">${xs.map(o=>{const pt=pointOf(o);return `<label class="li"><input type="checkbox" data-do="${o.id}" ${st.sel.has(o.id)?'checked':''}><div class="grow"><div class="t1">${esc(custName(o.cust))} · ${esc(pt.mark&&placeOf(pt.place)?pt.mark:pt.name)}</div><div class="t2">${esc(pt.addr||'')} · ${esc(o.time||pt.win||'')} · ${scPill('order',o.status,'sm')}</div></div><b class="tnum">${ordPortions(o)}</b></label>`}).join('')}</div></div>`).join('')
        :`<div class="state">${ic('check','lg')}<b>Все заказы на эту дату уже в рейсах</b><span>Без рейса остаются только заказы «Новый» (их сначала принимают) и самовывоз.</span></div>`}`,
      foot:`<button class="btn ghost" data-close>Закрыть</button><span class="grow"></span><span class="faint">Выбрано ${st.sel.size} · ${selP} порц.</span><button class="btn cta" id="ds-go" ${st.sel.size?'':'disabled'}>${ic('send','sm')}Добавить в рейс</button>`,
      mount(el){$('#ds-d',el).onchange=e=>{st.date=e.target.value;st.sel.clear();m.draw()};$('#ds-s',el).onchange=e=>{st.shift=e.target.value;st.sel.clear();m.draw()};bindSeg(el,'ds-by',v=>{st.by=v;store.set('dl.by',v);m.draw()});
        $$('[data-do]',el).forEach(c=>c.onchange=()=>{c.checked?st.sel.add(c.dataset.do):st.sel.delete(c.dataset.do);m.draw()});
        $$('[data-dg]',el).forEach(c=>c.onchange=()=>{(G[c.dataset.dg]||[]).forEach(o=>c.checked?st.sel.add(o.id):st.sel.delete(o.id));m.draw()});
        $('#ds-go',el).onclick=()=>tripPickDlg(os.filter(o=>st.sel.has(o.id)),()=>st.sel.clear())}}}})}
function printRoute(t){const os=tripLive(t);printDlg('Маршрутный лист '+t.no,`${docHead('Маршрутный лист '+esc(t.no),dayLbl(t.date)+' · выезд '+esc(t.dep||''))}<p><b>Курьер:</b> ${esc(EM[t.courier]?EM[t.courier].fio:'—')} · <b>Транспорт:</b> ${esc(odName('vehicle',t.vehicle))}</p>
  <table class="mini"><thead><tr><th>№</th><th>Заказчик, точка</th><th>Адрес</th><th>Окно</th><th class="num">Порций</th><th class="num">Наличными</th><th>Отметка</th></tr></thead><tbody>${os.map((o,i)=>{const pt=pointOf(o);return `<tr><td>${i+1}</td><td>${esc(custName(o.cust))}<div class="faint">${esc(pt.name)} · ${esc(pt.contact||'')} ${esc(pt.phone||'')}</div></td><td>${esc(pt.addr||'')}${pt.mark?`<div class="faint">${esc(pt.mark)}</div>`:''}</td><td>${esc(o.time||pt.win||'')}</td><td class="num">${ordPortions(o)}</td><td class="num">${cashDue(o)?fmtM(cashDue(o)):''}</td><td></td></tr>`}).join('')}</tbody>
  <tfoot><tr><td></td><td>Итого точек: ${tripPoints(t)}</td><td></td><td></td><td class="num">${tripPortions(t)}</td><td class="num">${fmtM(tripCashDue(t))}</td><td></td></tr></tfoot></table><div class="pd-sign"><span>Выдал ____________</span><span>Курьер ____________</span></div>`)}
// «Курьеры и транспорт»: кто сегодня в рейсе, сколько точек, наличные на руках
function renderFleet(body,fresh){const td=TRIPS.filter(t=>t.date===TODAY);
  body.innerHTML=`<div class="box"><h3>Курьеры</h3><div id="flc"></div></div><div class="box"><h3>Транспорт</h3><div id="flv"></div>${can('dcEdit')?`<button class="btn sm" id="fl-dc">${ic('book','sm')}Справочник «Транспорт»</button>`:''}</div>`;
  const hands=e=>TRIPS.filter(t=>t.courier===e.id&&cashStatus(t)&&cashStatus(t)!=='Принято').reduce((a,t)=>a+(t.cash?t.cash.sent:tripGot(t)),0);
  grid($('#flc',body),{id:'dl-cour',cols:[{key:'fio',label:'Курьер',type:'text',w:220,val:e=>e.fio},{key:'phone',label:'Телефон',type:'text',w:150,val:e=>e.phone},
    {key:'tr',label:'Рейсов сегодня',type:'int',num:1,total:1,w:120,val:e=>td.filter(t=>t.courier===e.id).length},{key:'pts',label:'Точек сегодня',type:'int',num:1,total:1,w:120,val:e=>td.filter(t=>t.courier===e.id).reduce((a,t)=>a+tripPoints(t),0)},
    {key:'dn',label:'Доставлено сегодня',type:'int',num:1,total:1,w:140,val:e=>td.filter(t=>t.courier===e.id).reduce((a,t)=>a+tripDone(t),0)},{key:'cash',label:'Наличные на руках, сом',type:'money',num:1,total:1,w:160,val:hands},
    feat('tara')&&{key:'tara',label:'Забрано контейнеров сегодня',type:'int',num:1,total:1,w:170,val:e=>td.filter(t=>t.courier===e.id).reduce((a,t)=>a+tripOrders(t).reduce((x,o)=>x+(o.tara?+o.tara.back||0:0),0),0)},
    {key:'st',label:'Сейчас',type:'enum',w:150,val:e=>td.some(t=>t.courier===e.id&&t.status==='В пути')?'В рейсе':td.some(t=>t.courier===e.id&&t.status!=='Завершён')?'Рейс назначен':'Свободен'}].filter(Boolean),
    rows:()=>couriers().filter(e=>seeAll('delivery')||e.id===S.me),title:'fio',noun:['курьер','курьера','курьеров'],audit:false,sort:{key:'fio',dir:1},ordered:true,simulateLoad:fresh,
    open:e=>{const t=td.find(x=>x.courier===e.id&&x.status!=='Завершён')||td.find(x=>x.courier===e.id);if(t)openTrip(t);else toast('Сегодня у курьера нет рейсов','truck')},empty:{icon:'user',title:'Курьеров нет',text:'Курьер — сотрудник с правом «Работать по маршруту»'}});
  grid($('#flv',body),{id:'dl-veh',cols:[{key:'name',label:'Транспорт',type:'text',w:220,val:v=>v.name},{key:'note',label:'Госномер',type:'text',w:150,val:v=>v.note,cls:'mono'},
    {key:'tr',label:'Рейсов сегодня',type:'int',num:1,w:120,val:v=>td.filter(t=>t.vehicle===v.code).length},{key:'now',label:'Сейчас у курьера',type:'enum',w:170,val:v=>{const t=td.find(x=>x.vehicle===v.code&&x.status==='В пути');return t?empName(t.courier):''}}],
    rows:()=>(ODICT.vehicle?ODICT.vehicle.items:[]).filter(x=>x.active!==false),rid:v=>v.code,title:'name',noun:['машина','машины','машин'],audit:false,exportable:false,sort:{key:'name',dir:1},ordered:true,firstRun:false});
  if($('#fl-dc',body))$('#fl-dc',body).onclick=()=>go('dicts','vehicle')}

/* ═════════════ Доставка → «Карта» ═════════════ */
// Заказы на дату и смену на карте точек: адреса одного места — один маркер; цвет по статусу заказа или по рейсу; панель места с «Добавить в рейс»
const TRIP_COL=['blue','purple','orange','green','#0e9aa7','#c2185b','#7a5c2e','yellow'];
const SC_ORD=['Новый','Принят','Готовится','Готов','В пути','Доставлен'];
const ordCol=s=>((SC('order').colors||{})[s]||['gray'])[0];
// Группы точек: место из справочника — одна группа, остальные адреса по одному
function ptGroups(os){const G=new Map();os.forEach(o=>{const k=ptKey(o);if(!G.has(k)){const pt=pointOf(o);const pl=placeOf(pt.place);G.set(k,{key:k,label:ptLabel(o),addr:pl?pl.addr:pt.addr,place:pl||null,geo:ptGeo(pt),approx:!pl&&!!pt.approx,orders:[],n:0})}const g=G.get(k);g.orders.push(o);g.n+=ordPortions(o)});return [...G.values()].sort((a,b)=>b.n-a.n||COLL.compare(a.label,b.label))}
// Цвет группы по статусу: «Не доставлен» — красный, иначе наименее продвинутый шаг среди недоставленных заказов
const grpStatus=g=>{if(g.orders.some(o=>o.status==='Не доставлен'))return 'Не доставлен';const xs=g.orders.filter(o=>o.status!=='Доставлен');return xs.length?xs.map(o=>o.status).sort((a,b)=>SC_ORD.indexOf(a)-SC_ORD.indexOf(b))[0]:'Доставлен'};
const hubCount=gs=>gs.filter(g=>g.place&&g.orders.length>=2).length;
function renderDlMap(body,fresh){const st=S.dlm=S.dlm||{date:TODAY,show:'all',color:'status',sel:''};st.shift=activeShifts().some(([c])=>c===st.shift)?st.shift:defShift();
  const all=visOrders().filter(o=>o.date===st.date&&o.shift===st.shift&&!o.pickup&&o.status!=='Отменён');
  const os=all.filter(o=>st.show==='none'?!o.trip&&!['Доставлен','Не доставлен'].includes(o.status):st.show==='way'?o.status==='В пути':st.show==='nd'?o.status==='Не доставлен':true);
  const gs=ptGroups(os);const geo=gs.filter(g=>g.geo),nog=gs.filter(g=>!g.geo);const ts=TRIPS.filter(t=>t.date===st.date&&t.shift===st.shift&&tripLive(t).length);const tcol=t=>TRIP_COL[ts.indexOf(t)%TRIP_COL.length];
  const gcol=g=>{if(st.color==='status')return ordCol(grpStatus(g));const cnt={};g.orders.forEach(o=>{if(o.trip)cnt[o.trip]=(cnt[o.trip]||0)+1});const k=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0];return k&&TRM[k]?tcol(TRM[k]):'gray'};
  const dk=st.date===TODAY?'t':st.date===TOMORROW()?'m':'o';const sh=activeShifts();
  const legend=st.color==='status'?[...new Set(gs.map(grpStatus))].sort((a,b)=>SC_ORD.indexOf(a)-SC_ORD.indexOf(b)).map(s=>[ordCol(s),s]):[...ts.map(t=>[tcol(t),tripLbl(t)]),['gray','Без рейса']];
  body.innerHTML=`<div class="row dm-bar">${segHtml('dm-day',[['t','Сегодня'],['m','Завтра'],['o','Дата']],dk)}${dk==='o'?inp('dm-date',st.date,'type="date" style="max-width:160px" aria-label="Дата"'):''}${sh.length>1?sel('dm-sh',sh,st.shift,'style="max-width:140px" aria-label="Смена"'):''}
      <span class="dm-lbl">Показать</span>${segHtml('dm-show',[['all','Все'],['none','Без рейса'],['way','В пути'],['nd','Не доставлено']],st.show)}<span class="dm-lbl">Цвет</span>${segHtml('dm-col',[['status','По статусу'],['trip','По рейсу']],st.color)}</div>
    <div class="plates">${plate({id:'pts',icon:'pin',color:'blue',label:'Точек на карте',value:geo.length,sub:`${os.length} ${plural(os.length,'заказ','заказа','заказов')}`})}${plate({id:'por',icon:'list',color:'purple',label:'Порций',value:os.reduce((a,o)=>a+ordPortions(o),0)})}
      ${plate({id:'hub',icon:'building',color:'orange',label:'Мест скопления',value:hubCount(gs),sub:'два и больше заказов в одном месте'})}${plate({id:'nog',icon:'alert',color:nog.length?'red':'green',label:'Без геоточки',value:nog.length,sub:nog.length?'не видны на карте':'все на карте'})}</div>
    <div class="dm-wrap"><div id="dm-map"></div><div class="dm-side"><div id="dm-pan"></div><div class="box dm-list"><h3>Места по порциям</h3>${gs.length?`<div class="list">${geo.map(g=>`<button type="button" class="li" data-g="${esc(g.key)}"><span class="pl-dot" style="background:${mapCol(gcol(g))};color:#fff">${ic(g.place?'building':'pin','sm')}</span><span class="grow"><span class="t1">${esc(g.label)}</span><span class="t2">${g.orders.length} ${plural(g.orders.length,'заказ','заказа','заказов')}${g.approx?' · примерная геоточка':''}</span></span><b class="tnum">${g.n}</b></button>`).join('')}</div>`:`<div class="muted">На ${dayLbl(st.date)} заказов с доставкой нет.</div>`}
      ${nog.length?`<div class="dm-nog"><b>${ic('alert','sm')} Без геоточки: ${nog.length}</b>${nog.map(g=>`<div class="li"><span class="grow"><span class="t1">${esc(g.label)}</span><span class="t2">${esc(g.addr||'')} · ${g.n} порц.</span></span>${can('cuEdit')||can('ordEdit')?`<button type="button" class="btn sm" data-nogeo="${esc(g.key)}">${ic('pin','sm')}Указать на карте</button>`:''}</div>`).join('')}</div>`:''}</div></div></div>`;
  const mp=mapView($('#dm-map',body),{key:'dlmap',kitchen:ORG.geo,legend:[...legend,['#999','Пунктир — примерная геоточка']],
    points:geo.map(g=>({id:g.key,geo:g.geo,n:g.n,label:g.label,title:`${g.label}: ${g.n} порц., ${g.orders.length} ${plural(g.orders.length,'заказ','заказа','заказов')}`,color:gcol(g),approx:g.approx,sel:g.key===st.sel,big:!!g.place})),
    lines:st.color==='trip'?ts.map(t=>({color:tcol(t),geo:[ORG.geo,...tripLive(t).map(o=>ptGeo(pointOf(o))).filter(Boolean)].filter(hasGeo)})):[],
    onPick:p=>{st.sel=p.id;panel()}});
  const panel=()=>{const g=gs.find(x=>x.key===st.sel);const host=$('#dm-pan',body);$$('.dm-list [data-g]',body).forEach(b=>b.classList.toggle('on',b.dataset.g===st.sel));if(!g){host.innerHTML='';return}const free=g.orders.filter(o=>!o.trip&&canTrip(o));
    host.innerHTML=`<div class="box dm-pan"><div class="row" style="align-items:flex-start;gap:8px"><div class="grow"><h3 style="margin:0">${ic(g.place?'building':'pin','sm')} ${esc(g.label)}</h3><div class="faint">${esc(g.addr||'')}${g.place&&g.place.note?' · '+esc(g.place.note):''}</div></div><button type="button" class="icon-btn sm" id="dm-x" aria-label="Закрыть панель">${ic('x','sm')}</button></div>
      <div class="rt-sum"><span>Порций <b>${g.n}</b></span><span>Заказов <b>${g.orders.length}</b></span>${free.length?`<span>Без рейса <b>${free.length}</b></span>`:''}</div>
      <div class="list">${g.orders.map(o=>{const pt=pointOf(o);const t=TRM[o.trip];return `<button type="button" class="li" data-oo="${o.id}"><span class="grow"><span class="t1">${esc(custName(o.cust))}${pt.mark?' · '+esc(pt.mark):''}</span><span class="t2">${esc(o.no)} · ${ordPortions(o)} порц.${o.time?' · '+esc(o.time):''} · ${t?esc(t.no+' · '+empName(t.courier)):'без рейса'}</span><span class="t2">${scPill('order',o.status,'sm')} ${canPrice()?payPill(o):''}</span></span>${ic('right','sm')}</button>`}).join('')}</div>
      ${free.length&&can('dlTrips')?`<button class="btn cta" id="dm-add">${ic('send','sm')}Добавить в рейс (${free.length})</button>`:''}</div>`;
    $('#dm-x',host).onclick=()=>{st.sel='';panel();mp.draw()};$$('[data-oo]',host).forEach(b=>b.onclick=()=>openOrder(ORM[b.dataset.oo]));const a=$('#dm-add',host);if(a)a.onclick=()=>tripPickDlg(free);
    if(isMobile())host.scrollIntoView({block:'nearest',behavior:'smooth'})};
  panel();
  $$('.dm-list [data-g]',body).forEach(b=>b.onclick=()=>{const g=gs.find(x=>x.key===b.dataset.g);st.sel=g.key;mp.focus(g.geo);panel();if(isMobile())$('#dm-map',body).scrollIntoView({block:'start',behavior:'smooth'})});
  $$('[data-nogeo]',body).forEach(b=>b.onclick=()=>{const g=nog.find(x=>x.key===b.dataset.nogeo);setGeoDlg(g.orders[0])});
  body.querySelector('.plates').onclick=e=>{const b=e.target.closest('[data-plate]');if(!b)return;if(b.dataset.plate==='nog'){const n=$('.dm-nog',body);n&&n.scrollIntoView({block:'center',behavior:'smooth'})}else if(b.dataset.plate==='pts')mp.fit()};
  bindSeg(body,'dm-day',v=>{if(v==='t')st.date=TODAY;else if(v==='m')st.date=TOMORROW();else st.date=st.date===TODAY||st.date===TOMORROW()?addDays(TODAY,2):st.date;st.sel='';renderPage()});
  const dd=$('#dm-date',body);if(dd)dd.onchange=()=>{st.date=dd.value||TODAY;st.sel='';renderPage()};const ds=$('#dm-sh',body);if(ds)ds.onchange=()=>{st.shift=ds.value;st.sel='';renderPage()};
  bindSeg(body,'dm-show',v=>{st.show=v;st.sel='';renderPage()});bindSeg(body,'dm-col',v=>{st.color=v;renderPage()})}
// «Указать на карте» для адреса заказа: геоточка сохраняется в точке доставки заказчика или в адресе, введённом в заказе
function setGeoDlg(o){const pt=pointOf(o);const c=CUM[o.cust];mapPickDlg({title:'Геоточка адреса',sub:esc(ptLabel(o))+' · '+esc(pt.addr||''),geo:pt.geo,near:distGeo(pt.district)},g=>{
  if(o.addr){o.addr.geo=g;o.addr.approx=false;log('order',o.id,'Геоточка адреса уточнена на карте',o)}else{const p=c&&c.points.find(x=>x.id===o.point);if(p){p.geo=g;p.approx=false;log('customer',c.id,`Геоточка адреса «${p.addr}» уточнена на карте`,c)}}refreshAll();toast('Геоточка сохранена','pin')})}

/* ═════════════ Модуль «Маршрут» (телефон курьера) ═════════════ */
// Рейсы на сегодня: курьеру — свои; владельцу — все, с выбором рейса
const routeTrips=()=>TRIPS.filter(t=>t.date===TODAY&&(t.courier===S.me||isOwner())).sort((a,b)=>(a.dep||'')<(b.dep||'')?-1:1);
const routeBadge=()=>routeTrips().filter(t=>t.courier===S.me&&t.status==='Загружен').length;
function renderRoute(body){const ts=routeTrips();const tm=TRIPS.filter(t=>t.date===TOMORROW()&&t.courier===S.me);
  if(!ts.length){body.innerHTML=`<div class="state">${ic('truck','lg')}<b>На сегодня рейсов нет</b><span>${tm.length?`Завтра: ${tm.map(t=>esc(t.no)+', выезд '+esc(t.dep||'')).join('; ')}`:'Когда управляющий назначит рейс, он появится здесь и придёт уведомление.'}</span></div>${offlineSw()}`;bindOffline(body);return}
  let t=ts.find(x=>x.id===S.rtrip)||ts.find(x=>x.status==='В пути')||ts.find(x=>x.status!=='Завершён')||ts[0];S.rtrip=t.id;const os=tripLive(t);const pend=os.filter(o=>o.pending).length;
  body.innerHTML=`${ts.length>1?`<div class="rt-trips">${segHtml('rt-t',ts.map(x=>[x.id,x.no+(isOwner()&&x.courier!==S.me?' · '+empName(x.courier):'')]),t.id)}</div>`:''}
    <div class="box rt-head"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><b class="rt-no">Рейс ${esc(t.no)}</b>${scaleMini('trip',t)}<span class="grow"></span><button class="btn sm" id="rt-open">${ic('right','sm')}Карточка рейса</button></div>
      <div class="rt-sum"><span>Точек <b>${tripPoints(t)}</b></span><span>Порций <b>${tripPortions(t)}</b></span><span>Доставлено <b>${tripDone(t)} из ${os.length}</b></span><span>Наличными <b>${money(tripCashDue(t))}</b></span></div>
      <div class="faint">${esc(odName('vehicle',t.vehicle))}${t.dep?' · выезд '+esc(t.dep):''}${t.note?' · '+esc(t.note):''}</div></div>
    ${offlineSw(pend)}
    ${t.status==='Формируется'?`<div class="note">${ic('clock')}<span>Рейс ещё формируется: состав может измениться. Начать рейс можно после погрузки.</span></div>`:''}
    ${t.status==='Загружен'&&(t.courier===S.me||isOwner())?`<button class="btn cta big-btn" id="rt-go" ${S.offline?'disabled':''}>${ic('truck')}Начать рейс</button>${S.offline?'<div class="hint">Начать рейс можно при подключении к сети</div>':''}`:''}
    <div class="row">${segHtml('rt-v',[['list','Список'],['map','Карта']],S.rview||'list')}</div>
    ${S.rview==='map'?`<div id="rt-map"></div>${routeStops(os).some(x=>!x.geo)?`<div class="note warn">${ic('alert')}<span>Без геоточки (нет на карте): ${routeStops(os).filter(x=>!x.geo).map(x=>x.is.join(', ')+'. '+esc(ptLabel(x.os[0]))).join('; ')}</span></div>`:''}`:`<div class="rt-list">${os.map((o,i)=>stopHtml(o,i,t)).join('')}</div>`}
    ${t.courier===S.me&&cashStatus(t)==='Не сдано'&&t.status==='Завершён'?`<button class="btn cta big-btn" id="rt-cash">${ic('wallet')}Сдать наличные · ${money(tripGot(t))}</button>`:t.cash?`<div class="note">${ic('wallet')}<span>Наличные: ${pill(t.cash.status,CASH_C,'sm')} сдано ${money(t.cash.sent)} ${fmtDT(t.cash.at)}</span></div>`:''}`;
  bindSeg(body,'rt-t',v=>{S.rtrip=v;renderPage()});bindSeg(body,'rt-v',v=>{S.rview=v;renderPage()});bindOffline(body);
  if($('#rt-map',body)){const sts=routeStops(os);const fin=o=>['Доставлен','Не доставлен'].includes(o.status);
    mapView($('#rt-map',body),{key:'route-'+t.id,kitchen:ORG.geo,noCluster:true,legend:[['blue','Порядок объезда'],['green','Доставлено'],['red','Не доставлено']],lines:[{color:'blue',geo:[ORG.geo,...sts.map(x=>x.geo)].filter(hasGeo)}],
      points:sts.filter(x=>x.geo).map(x=>({id:x.id,geo:x.geo,n:x.os.reduce((a,o)=>a+ordPortions(o),0),num:x.is.length>1?x.is[0]+'–'+x.is[x.is.length-1]:x.is[0],done:x.os.every(fin),color:x.os.some(o=>o.status==='Не доставлен')?'red':x.os.every(fin)?'green':'blue',label:ptLabel(x.os[0]),title:x.is.join(', ')+'. '+ptLabel(x.os[0]),approx:x.approx,big:true})),
      onPick:(p,el)=>{const x=sts.find(y=>y.id===p.id);if(!x)return;if(x.os.length===1)openStop(x.os[0]);else menu(el,x.os.map((o,i)=>({label:`${x.is[i]}. ${custName(o.cust)}`,sub:pointOf(o).mark||'',icon:fin(o)?'check':'right',run:()=>openStop(o)})))}})}
  const on=(id,f)=>{const x=$(id,body);if(x)x.onclick=f};on('#rt-open',()=>openTrip(t));on('#rt-go',()=>stepTo('trip',t,'В пути'));on('#rt-cash',()=>cashDlg(t));
  $$('[data-stop]',body).forEach(b=>b.onclick=e=>{if(e.target.closest('[data-dv],[data-nd],a'))return;openStop(ORM[b.dataset.stop])});
  $$('[data-dv]',body).forEach(b=>b.onclick=()=>stepTo('order',ORM[b.dataset.dv],'Доставлен'));$$('[data-nd]',body).forEach(b=>b.onclick=()=>ndDlg(ORM[b.dataset.nd]))}
// Остановки на карте маршрута: подряд идущие заказы одного места — один пронумерованный маркер
function routeStops(os){const out=[];os.forEach((o,i)=>{const k=ptKey(o);const l=out[out.length-1];if(l&&l.k===k){l.os.push(o);l.is.push(i+1);return}const pt=pointOf(o);out.push({id:k+'#'+(i+1),k,os:[o],is:[i+1],geo:ptGeo(pt),approx:!placeOf(pt.place)&&!!pt.approx})});return out}
function stopHtml(o,i,t){const pt=pointOf(o);const act=o.status==='В пути'&&!o.pending&&(t.courier===S.me||isOwner());const done=['Доставлен','Не доставлен'].includes(o.status);
  return `<div class="rt-stop ${done?'done':''} ${o.status==='Не доставлен'?'bad':''}" data-stop="${o.id}" role="button" tabindex="0"><span class="rt-n">${done?ic(o.status==='Доставлен'?'check':'x','sm'):i+1}</span><div class="grow">
    <div class="t1">${esc(custName(o.cust))}</div><div class="t2">${pt.name&&pt.name!==pt.addr?`<b>${esc(pt.name)}</b> · `:''}${esc(pt.addr||'')}</div>${pt.mark?`<div class="t2">${ic('pin','sm')}${esc(pt.mark)}</div>`:''}
    <div class="rt-meta"><span>${ic('clock','sm')}${esc(o.time||pt.win||'—')}</span><span><b>${ordPortions(o)}</b> порц.</span>${cashDue(o)?`<span class="rt-cash">${ic('wallet','sm')}${money(cashDue(o))}</span>`:''}${payStatus(o)==='Оплачен'?pill('Оплачено',{'Оплачено':['green','check']},'sm'):''}${o.pending?`<span class="pill yellow sm">${ic('clock')}Ждёт отправки: «${esc(o.pending.to)}»</span>`:scPill('order',o.status,'sm')}</div>
    ${act?`<div class="rt-acts"><button class="btn danger" data-nd="${o.id}">Не доставлено</button><button class="btn cta" data-dv="${o.id}">${ic('check','sm')}Доставлено</button></div>`:''}</div></div>`}
// Карточка точки: позвонить, открыть в картах, состав без цен, «Доставлено» / «Не доставлено»
function openStop(o){if(!o)return;openModal({size:'mid',live:true,render:m=>{const pt=pointOf(o);const t=TRM[o.trip];const act=o.status==='В пути'&&!o.pending&&t&&(t.courier===S.me||isOwner());const q=encodeURIComponent('Бишкек, '+(pt.addr||''));const mn=menuOf(o.date,o.shift);
  return {title:esc(custName(o.cust)),sub:esc(pt.name)+' · '+esc(o.no),body:`<div class="box"><div class="kv">${kv('Адрес',esc(pt.addr))}${kv('Ориентир',esc(pt.mark))}${kv('Окно доставки',esc(o.time||pt.win))}${kv('Контакт на месте',esc(pt.contact))}${kv('Статус',o.pending?`<span class="pill yellow sm">Ждёт отправки: «${esc(o.pending.to)}»</span>`:scPill('order',o.status,'sm'))}${cashDue(o)?kv('Получить наличными',`<b>${money(cashDue(o))}</b>`+(ordPrepaid(o)>0.009?`<div class="faint">оплачено заранее ${money(ordPrepaid(o))}</div>`:'')):''}${payStatus(o)==='Оплачен'?kv('Оплата',pill('Оплачено',{'Оплачено':['green','check']},'sm')):''}${kv('Комментарий',esc(o.note),1)}</div>
    <div class="rt-links">${pt.phone?`<a class="btn" href="tel:${esc(pt.phone.replace(/\s/g,''))}">${ic('phone','sm')}Позвонить</a>`:''}<a class="btn" href="https://2gis.kg/bishkek/search/${q}" target="_blank" rel="noopener">${ic('pin','sm')}Открыть в 2ГИС</a><a class="btn" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">${ic('globe','sm')}Открыть в Google Картах</a></div></div>
    <div class="box"><h3>Состав заказа</h3><table class="mini"><tbody>${o.lines.map(l=>{const ex=l.kind==='c'?Object.keys(expandLine(l,mn)).map(id=>(DSM[id]||{}).name).filter(Boolean).join(', '):'';return `<tr><td><b>${esc(lineName(l))}</b>${ex?`<div class="faint">${esc(ex)}</div>`:''}</td><td class="num tnum">${l.qty}</td></tr>`}).join('')}</tbody><tfoot><tr><td>Итого порций</td><td class="num tnum">${ordPortions(o)}</td></tr></tfoot></table></div>
    ${o.deliv?`<div class="box"><div class="kv">${kv('Доставлено',fmtDT(o.deliv.at)+' · получатель '+esc(o.deliv.recv))}${o.deliv.cash?kv('Получено наличными',money(o.deliv.cash)):''}</div>${o.deliv.photo?`<img class="dl-ph" src="${o.deliv.photo}" alt="Фото доставки">`:''}</div>`:''}`,
    foot:act?`<button class="btn danger" id="st-nd">Не доставлено</button><div class="grow"></div><button class="btn cta" id="st-dv">${ic('check','sm')}Доставлено</button>`:'<div class="grow"></div><button class="btn cta" data-close>Закрыть</button>',
    mount(el){const on=(id,f)=>{const x=$(id,el);if(x)x.onclick=f};on('#st-dv',()=>stepTo('order',o,'Доставлен',()=>m.close()));on('#st-nd',()=>ndDlg(o,()=>m.close()))}}}})}
// Демо-переключатель «Без сети»: отметки копятся в телефоне и отправляются, когда сеть появилась
const offlineSw=pend=>`<label class="box rt-off ${S.offline?'on':''}"><span class="pl-dot ${S.offline?'orange':'green'}">${ic('wifi')}</span><span class="grow"><b>${S.offline?'Нет сети':'Сеть есть'}</b><span class="t2">${S.offline?'Отметки сохраняются в телефоне и уйдут, когда появится связь':'Демо: включите, чтобы проверить работу без сети'}${pend?` · ждут отправки: ${pend}`:''}</span></span><input type="checkbox" class="sw" id="rt-off" ${S.offline?'checked':''} aria-label="Режим без сети (демо)"></label>`;
function bindOffline(el){const c=$('#rt-off',el);if(c)c.onchange=()=>{S.offline=c.checked;if(S.offline){toast('Режим без сети: маршрутный лист сохранён в телефоне','wifi');renderShell()}else syncPending()}}
function syncPending(){const ps=ORDERS.filter(o=>o.pending);ps.forEach(o=>{const p=o.pending;o.pending=null;if(o.status!=='В пути')return;const off=' · отмечено без сети '+fmtDT(p.at);
  if(p.to==='Доставлен')setStatus('order',o,'Доставлен',(o.deliv&&o.deliv.recv?'Получатель: '+o.deliv.recv:'')+off,false,{silent:true,file:(o.deliv||{}).photo||''});else setStatus('order',o,'Не доставлен',(p.note||'')+off,false,{silent:true,file:(o.nd||{}).photo||''})});
  refreshAll();toast(ps.length?`Сеть появилась: отправлено отметок — ${ps.length}`:'Сеть появилась','wifi')}
// «Сдать наличные»: итог по рейсу уходит бухгалтеру на подтверждение
function cashDlg(t){const got=tripGot(t);const os=tripOrders(t).filter(o=>o.cash);openModal({form:true,noMax:true,render:()=>({title:'Сдать наличные',sub:`Рейс ${esc(t.no)} · ${dayLbl(t.date)}`,body:`<div class="box"><div class="kv">${kv('Получено от заказчиков',`<b>${money(got)}</b>`)}${kv('Заказов с наличными',os.length)}</div></div>
  <div class="form">${fld('Сдаю, сом',inp('cs-s',String(got).replace('.',','),'inputmode="decimal"'),{req:true,id:'cs-s'})}${fld('Комментарий',`<textarea class="inp" id="cs-c" rows="2"></textarea>`,{full:true,id:'cs-c',hint:'Обязателен, если сумма отличается от полученной'})}</div>`,
  foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="cs-ok">${ic('wallet','sm')}Сдать</button>`,
  mount(el,m){$('#cs-ok',el).onclick=()=>{const s=num(val(el,'cs-s')),c=val(el,'cs-c');let ok=setErr(el,'cs-s',isNaN(s)||s<0?'Введите сумму':'');if(ok&&Math.abs(s-got)>0.009)ok=setErr(el,'cs-c',c?'':`Сумма отличается на ${money(Math.round((s-got)*100)/100)}: укажите причину`);if(!ok)return;
    t.cash={got,sent:s,at:nowStamp(),acc:'',accAt:'',comment:c,status:'Ждёт приёма'};log('trip',t.id,`Сданы наличные: ${money(s)} из ${money(got)}`,t);notify('cash',{roles:['acc']},`${empName(t.courier)} сдал наличные ${money(s)} по рейсу ${t.no}`,'money.cash');m.close();refreshAll();toast('Наличные сданы: ждут подтверждения бухгалтера','wallet')}}})})}
