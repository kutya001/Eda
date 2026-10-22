'use strict';
// Модуль «Заказы»: заказы на дату и смену по опубликованному меню, шкала «Новый → … → Доставлен», «Отменён» и «Не доставлен», регулярные заказы, закрытие приёма, автоматические задания
/* ═════════════ Заказы ═════════════ */
function ordTabs(){const v=visOrders();return [{id:'today',label:'Сегодня',icon:'calendar',count:v.filter(o=>o.date===TODAY&&!ordDone(o)).length||''},{id:'tomorrow',label:'Завтра',icon:'clock',count:v.filter(o=>o.date===TOMORROW()&&o.status==='Новый').length||'',red:true},
  {id:'all',label:'Все',icon:'list'},feat('regular')&&can('ordRegular')||feat('regular')&&can('ordView')?{id:'reg',label:'Регулярные',icon:'repeat',count:REGS.filter(r=>r.active).length||''}:null].filter(Boolean)}
function ordAdd(){return [can('ordEdit')&&{label:'Заказ',icon:'task',run:()=>orderDlg(null,{date:S.tab==='today'?TODAY:TOMORROW()})},feat('regular')&&can('ordRegular')&&{label:'Регулярный заказ',icon:'repeat',run:()=>regularDlg()}]}
function ordCols(){const pr=canPrice();return [
  {key:'no',label:'№',type:'text',w:110,val:o=>o.no,cls:'mono'},
  {key:'date',label:'Дата доставки',type:'date',w:130,val:o=>o.date,sortVal:o=>o.date+' '+(o.time||''),text:o=>fmtD(o.date)+(relDay(o.date)?' · '+relDay(o.date):'')},
  {key:'cust',label:'Заказчик',type:'enum',w:200,val:o=>custName(o.cust)},
  {key:'point',label:'Точка доставки',type:'enum',w:170,val:o=>ordPointName(o)},
  {key:'time',label:'Время',type:'text',w:110,val:o=>o.time},
  {key:'portions',label:'Порций',type:'int',w:90,num:1,total:1,val:o=>ordPortions(o)},
  pr&&{key:'sum',label:'Сумма, сом',type:'money',w:120,num:1,total:1,val:o=>ordSum(o)},
  {key:'status',label:'Статус',type:'enum',w:200,val:o=>o.status,html:o=>scaleMini('order',o)+(o.changed?' <span class="pill orange sm" title="Изменён заказчиком">изменён</span>':'')+(o.limitFlag&&o.status==='Новый'?' <span class="pill red sm">лимит</span>':'')+(o.pending?' <span class="pill yellow sm">ждёт отправки</span>':'')},
  {key:'shift',label:'Смена',type:'enum',w:100,val:o=>shiftName(o.shift)},
  {key:'comp',label:'Состав',type:'text',w:260,val:o=>ordComp(o)},
  pr&&{key:'pay',label:'Способ оплаты',type:'enum',w:150,val:o=>dictName('payMethod',o.pay)},
  {key:'src',label:'Источник',type:'enum',w:170,val:o=>o.src},
  {key:'resp',label:'Ответственный',type:'enum',w:140,val:o=>empName(o.resp)},
  {key:'courier',label:'Курьер',type:'enum',w:140,val:o=>o.trip&&TRM[o.trip]?empName(TRM[o.trip].courier):''},
  {key:'note',label:'Комментарий',type:'text',w:200,val:o=>o.note},
  {key:'flag',label:'Отметки',type:'enum',w:150,val:o=>o.changed?'Изменён заказчиком':o.limitFlag&&o.status==='Новый'?'Превышен лимит долга':o.status==='Не доставлен'?'Не доставлен':''}].filter(Boolean)}
function renderOrders(body,tab,fresh){if(tab==='reg')return renderRegs(body,fresh);
  const v=visOrders();const gid='or-'+tab;const tm=TOMORROW();const nw=v.filter(o=>o.status==='Новый'&&o.date>=TODAY),tmr=v.filter(o=>o.date===tm&&ordActive(o)),nd=v.filter(o=>o.status==='Не доставлен'),chg=v.filter(o=>o.changed&&o.date>=TODAY);
  body.innerHTML=`<div class="plates">
    ${plate({id:'new',icon:'circle',color:nw.length?'blue':'green',label:'Новые',value:nw.length,sub:nw.length?'ждут принятия':'все приняты'})}
    ${plate({id:'tm',icon:'clock',color:'purple',label:'На завтра',value:tmr.reduce((a,o)=>a+ordPortions(o),0),unit:'порц.',sub:`${tmr.length} ${plural(tmr.length,'заказ','заказа','заказов')}${isClosed(tm)?' · приём закрыт':' · приём до '+fmtDT(cutoffAt(tm)).slice(11)}`})}
    ${plate({id:'nd',icon:'alert',color:nd.length?'red':'green',label:'Не доставлено',value:nd.length})}
    ${plate({id:'chg',icon:'edit',color:chg.length?'orange':'green',label:'Изменены заказчиком',value:chg.length})}
  </div><div id="org"></div>`;
  body.querySelector('.plates').onclick=e=>{const b=e.target.closest('[data-plate]');if(!b)return;const id=b.dataset.plate;
    if(id==='new')go('orders','all',{status:{type:'enum',vals:['Новый']},date:{type:'date',from:TODAY,to:null}});if(id==='tm')go('orders','tomorrow');if(id==='nd')go('orders','all',{status:{type:'enum',vals:['Не доставлен']}});if(id==='chg')go('orders','all',{flag:{type:'enum',vals:['Изменён заказчиком']}})};
  const rows=()=>{const v=visOrders();return tab==='today'?v.filter(o=>o.date===TODAY):tab==='tomorrow'?v.filter(o=>o.date===TOMORROW()):v};
  grid($('#org',body),{id:gid,cols:ordCols(),show:['no','date','cust','point','time','portions','sum','status'],rows,title:'no',noun:['заказ','заказа','заказов'],xlsName:'Заказы',
    sort:{key:'date',dir:tab==='all'?-1:1},ordered:true,group:tab==='all'?['date','cust']:[],rowClass:o=>o.status==='Не доставлен'||o.limitFlag&&o.status==='Новый'?'warn':o.status==='Отменён'?'muted':'',
    actions:ordActions,open:openOrder,preset:S.preset,simulateLoad:fresh,
    bulk:can('ordAccept')||can('dlTrips')?[can('ordAccept')&&{label:'Принять',icon:'check',run:(os,done)=>{let n=0;os.filter(o=>o.status==='Новый'&&!scWhyNot('order',o,'Принят')).forEach(o=>{setStatus('order',o,'Принят','',false,{silent:true});n++});done();refreshAll();toast(`Принято: ${n}`)}},
      feat('delivery')&&can('dlTrips')&&{label:'Добавить в рейс',icon:'send',run:(os,done)=>tripPickDlg(os.filter(o=>canTrip(o)),done)}].filter(Boolean):null,
    empty:{icon:'task',title:tab==='tomorrow'?'На завтра заказов пока нет':tab==='today'?'На сегодня заказов нет':'Заказов пока нет',add:can('ordEdit')?()=>orderDlg(null,{date:tab==='today'?TODAY:TOMORROW()}):null}})}
const canTrip=o=>!o.pickup&&['Принят','Готовится','Готов'].includes(o.status)&&!(o.trip&&TRM[o.trip]&&TRM[o.trip].status!=='Формируется');
const canEditOrd=o=>{if(!['Новый','Принят'].includes(o.status))return false;if(isCust())return feat('custLogin')&&o.cust===me().cust&&!isClosed(o.date,o.shift);return can('ordEdit')&&(!isClosed(o.date,o.shift)||can('ordLate'))};
const canCancelOrd=o=>{if(!['Новый','Принят','Готовится'].includes(o.status))return false;if(isCust())return o.cust===me().cust&&!isClosed(o.date,o.shift)&&o.status!=='Готовится';return can('ordCancel')};
function ordActions(o){const nx=scNext('order',o);const bk=scBack('order',o);return [{label:'Открыть',icon:'right',run:()=>openOrder(o)},
  canEditOrd(o)&&{label:'Изменить',icon:'edit',run:()=>orderDlg(o)},
  o.status==='Новый'&&!scWhyNot('order',o,'Принят')&&{label:'Принять',icon:'check',run:()=>stepTo('order',o,'Принят')},
  nx&&nx!=='Принят'&&!scWhyNot('order',o,nx)&&{label:`Перевести в «${nx}»`,icon:'check',run:()=>stepTo('order',o,nx)},
  feat('delivery')&&can('dlTrips')&&canTrip(o)&&{label:o.trip?'Перенести в другой рейс':'Добавить в рейс',icon:'send',run:()=>tripPickDlg([o])},
  o.status==='Не доставлен'&&canAny('dlTrips','ordCancel')&&{label:'Повторить доставку',icon:'repeat',run:()=>redeliver(o)},
  (can('ordEdit')||isCust())&&{label:isCust()?'Повторить заказ':'Копировать на другую дату',icon:'copy',run:()=>orderDlg(null,{copy:o})},
  {label:'Распечатать накладную',icon:'file',run:()=>printNakl(o)},
  canBack('order')&&bk&&{label:`Откатить в «${bk}»`,icon:'history',run:()=>rollbackDlg('order',o,bk)},
  {sep:1},canCancelOrd(o)&&{label:'Отменить заказ',icon:'ban',danger:true,run:()=>cancelOrd(o)},
  o.status==='Не доставлен'&&can('ordCancel')&&{label:'Отменить заказ',icon:'ban',danger:true,run:()=>cancelOrd(o)}]}
// Шаги заказа: свои правила поверх refDB.json (лимит долга, самовывоз, статус заказчика)
SC_WHY.order=(o,to,back)=>{if(back)return;const c=CUM[o.cust];
  if(to==='Принят'){if(c&&c.status!=='Активен')return `Заказчик «${c.status}»: новые заказы не принимаются`;if(o.limitFlag&&!['owner','manager'].includes(me().role))return 'Превышен лимит долга: принять может только управляющий или владелец';return can('ordAccept')?null:permTxt('ordAccept')}
  if(to==='Доставлен'&&(o.pickup||!feat('delivery')))return canAny('ordAccept','ktWork')?null:'Выдать заказ может управляющий или повар';
  if(to==='Доставлен'&&o.status==='Не доставлен')return can('dlRoute')?null:permTxt('dlRoute')};
SC_HOOK.order=(o,to,done)=>{if(to==='Доставлен'){deliverDlg(o,done);return true}};
SC_AFTER.order=(o,from,to,rb)=>{const c=CUM[o.cust];const reps={emps:EMP.filter(e=>e.role==='customer'&&e.cust===o.cust).map(e=>e.id)};
  if(to==='Доставлен'&&!rb){if(!o.nakl||!NAKLS.find(n=>n.id===o.nakl&&n.status==='Действует')){const n=born({id:uid('n'),no:nextNo('nakl','Н'),date:o.date,cust:o.cust,order:o.id,sum:ordSum(o),status:'Действует'},'system');NAKLS.push(n);o.nakl=n.id}
    if(o.deliv&&o.deliv.cash>0){const p=born({id:uid('y'),no:nextNo('pay','ОП'),date:TODAY,cust:o.cust,sum:o.deliv.cash,method:'СО-002',bill:'',by:S.me,note:'Получено курьером при доставке',file:'',order:o.id,status:'Проведена',sh:[]});PAYS.push(p);o.cash=o.deliv.cash}
    notify('status',reps,`Заказ ${o.no} доставлен`,'c-orders');tripCheck(o)}
  if(rb&&from==='Доставлен'){const n=NAKLS.find(x=>x.id===o.nakl);if(n){n.status='Отменена';touch(n)}PAYS.filter(p=>p.order===o.id&&p.status==='Проведена').forEach(p=>{p.status='Отменена';p.sh=p.sh||[];p.sh.push({at:nowStamp(),from:'Проведена',to:'Отменена',who:S.me,note:'Откат доставки заказа '+o.no})});o.cash=0;o.deliv=null}
  // Откат одного заказа из «В пути»: заказ уходит из рейса, рейс продолжается; при откате всего рейса заказы остаются в нём
  if(rb&&from==='В пути'&&o.trip){const t=TRM[o.trip];if(t&&t.status==='В пути'){t.orders=t.orders.filter(x=>x!==o.id);o.trip=''}}
  if(rb&&from==='Доставлен'&&o.trip){const t=TRM[o.trip];if(t&&t.status==='Завершён')setStatus('trip',t,'В пути','Откат доставки заказа '+o.no,true,{silent:true})}
  if(to==='Отменён'){if(from==='Готовится')o.cancelAfterStart=true;if(o.trip&&TRM[o.trip]&&TRM[o.trip].status==='Формируется'){TRM[o.trip].orders=TRM[o.trip].orders.filter(x=>x!==o.id);o.trip=''}}
  if(to==='Не доставлен'){notify('nd',{roles:['manager']},`Заказ ${o.no} не доставлен: ${custName(o.cust)}`,'orders.all');notify('status',reps,`Заказ ${o.no} не доставлен: ${o.sh[o.sh.length-1].note||''}`,'c-orders');tripCheck(o)}
  if(to==='Принят'&&!rb){o.changed=false;notify('status',reps,`Заказ ${o.no} на ${fmtD(o.date)} принят`,'c-orders')}
  if(to==='В пути'&&!rb)notify('status',reps,`Заказ ${o.no} в пути`,'c-orders')};
function cancelOrd(o){reasonDlg('Отменить заказ?','Причина отмены','Отменить заказ',(code,w)=>{o.cancel=code;setStatus('order',o,'Отменён',odName('cancel',code)+(w?': '+w:''))},odOpts('cancel'))}
function redeliver(o){const t=o.trip&&TRM[o.trip];if(t)t.orders=t.orders.filter(x=>x!==o.id);o.trip='';o.nd=null;setStatus('order',o,'Готов','Повторить доставку')}
// «Доставлено»: фото обязательно, получатель, наличные — если способ оплаты «Наличные курьеру»; без сети отметка ждёт отправки
function deliverDlg(o,done){const st={};const cash=o.pay==='СО-002'&&!o.pickup;
  openModal({form:true,noMax:true,render:()=>({title:o.pickup?'Выдать заказ':'Доставлено',sub:`${o.no} · ${esc(custName(o.cust))} · ${esc(ordPointName(o))}`,body:`<div class="form">
    ${fld('Фото',photoFld('dv-ph','',!o.pickup)+(o.pickup?'':`<button type="button" class="linkbtn" id="dv-demo">Демо: подставить фото</button>`),{req:!o.pickup,full:true,id:'dv-ph'})}
    ${fld('Получатель',inp('dv-r',pointOf(o).contact||''),{req:true,full:true,id:'dv-r',hint:'Имя того, кто принял заказ'})}
    ${cash?fld('Получено наличными, '+APP.currency,inp('dv-c',String(ordSum(o)).replace('.',','),'inputmode="decimal"'),{req:true,full:true,id:'dv-c',hint:'К получению: '+money(ordSum(o))}):''}
    ${feat('tara')&&!o.pickup?fld('Выдано контейнеров',inp('dv-to',String(ordPortions(o)),'inputmode="numeric"'),{id:'dv-to'})+fld('Забрано контейнеров',inp('dv-tb','0','inputmode="numeric"'),{id:'dv-tb',hint:'Пустые с прошлых доставок; на руках у заказчика: '+taraOf(o.cust)}):''}</div>`,
    foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="dv-ok">${ic('check','sm')}${o.pickup?'Выдано':'Доставлено'}</button>`,
    mount(el,m){bindPhoto(el,'dv-ph',st);if($('#dv-demo',el))$('#dv-demo',el).onclick=()=>{st['dv-ph']=demoPhoto('Доставка '+o.no);$('[data-ph="dv-ph"]',el).innerHTML=`<img src="${st['dv-ph']}" alt="">`};
      $('#dv-ok',el).onclick=()=>{const r=val(el,'dv-r'),c=cash?num(val(el,'dv-c')):0;let ok=setErr(el,'dv-ph',!o.pickup&&!st['dv-ph']?'Сделайте фото доставки':'');ok=setErr(el,'dv-r',r?'':'Укажите получателя')&&ok;if(cash)ok=setErr(el,'dv-c',isNaN(c)||c<0?'Введите сумму':'')&&ok;if(!ok)return;
        o.deliv={photo:st['dv-ph']||'',recv:r,cash:c,at:nowStamp()};if($('#dv-to',el))o.tara={out:+num(val(el,'dv-to'))||0,back:+num(val(el,'dv-tb'))||0};m.close();
        if(S.offline&&!o.pickup){o.pending={to:'Доставлен',at:nowStamp()};log('order',o.id,'Отметка «Доставлено» сохранена без сети: ждёт отправки',o);refreshAll();toast('Нет сети: отметка сохранена и ждёт отправки','clock');done&&done();return}
        setStatus('order',o,'Доставлен',r?'Получатель: '+r:'',false,{file:st['dv-ph']||''});done&&done()}}})})}
function ndDlg(o,done){const st={};openModal({form:true,noMax:true,render:()=>({title:'Не доставлено',sub:`${o.no} · ${esc(custName(o.cust))}`,body:`<div class="form">${fld('Причина',sel('nd-r',[['','—'],...odOpts('nd')],''),{req:true,full:true,id:'nd-r'})}${fld('Комментарий',inp('nd-w',''),{full:true,id:'nd-w'})}${fld('Фото',photoFld('nd-ph',''),{full:true,id:'nd-ph'})}</div>`,
  foot:'<button class="btn ghost" data-close>Отмена</button><button class="btn danger" id="nd-ok">Не доставлено</button>',
  mount(el,m){bindPhoto(el,'nd-ph',st);$('#nd-ok',el).onclick=()=>{const r=val(el,'nd-r');if(!setErr(el,'nd-r',r?'':'Выберите причину'))return;o.nd={reason:r,photo:st['nd-ph']||'',at:nowStamp()};m.close();const note=odName('nd',r)+(val(el,'nd-w')?': '+val(el,'nd-w'):'');
    if(S.offline){o.pending={to:'Не доставлен',note,at:nowStamp()};log('order',o.id,'Отметка «Не доставлено» сохранена без сети',o);refreshAll();toast('Нет сети: отметка ждёт отправки','clock');done&&done();return}
    setStatus('order',o,'Не доставлен',note,false,{file:st['nd-ph']||''});done&&done()}}})})}
function openOrder(o){if(!o)return;let tab='main';
  openModal({size:'wide',live:true,render:m=>{const pr=canPrice();const c=CUM[o.cust]||{};const pt=pointOf(o);const t=o.trip&&TRM[o.trip];const mn=menuOf(o.date,o.shift);
    const tabs=[['main','Состав','task'],!o.pickup&&feat('delivery')?['dl','Доставка','send']:null,pr?['pay','Оплата','wallet']:null,['hist','История','list']].filter(Boolean);let body=cardTabs(tabs,tab,'ot');
    if(tab==='main'){body+=`<div class="box">${scaleFull('order',o)}</div>${o.limitFlag&&o.status==='Новый'?`<div class="note warn">${ic('alert')}<span><b>Превышен лимит долга.</b> Долг заказчика ${money(debtOf(o.cust))}, лимит ${money(+c.limit)}. Принять заказ может только управляющий или владелец.</span></div>`:''}
      ${o.changed?`<div class="note warn">${ic('edit')}<span><b>Изменён заказчиком</b> после принятия — примите заказ заново.</span></div>`:''}${o.pending?`<div class="note">${ic('clock')}<span><b>Ждёт отправки:</b> отметка «${esc(o.pending.to)}» сохранена без сети ${fmtDT(o.pending.at)}.</span></div>`:''}
      ${o.status==='Не доставлен'?`<div class="note warn">${ic('alert')}<span><b>Не доставлен:</b> ${esc(o.nd?odName('nd',o.nd.reason):'')}. Решите: «Повторить доставку» (в новый рейс) или «Отменить заказ».</span></div>`:''}${o.cancelAfterStart?`<div class="note">${ic('ban')}<span>Отменено после запуска плана кухни: порции остались в плане с отметкой «Отменено после запуска».</span></div>`:''}
      <div class="box"><table class="mini"><thead><tr><th>Позиция</th><th class="num">Порций</th>${pr?'<th class="num">Цена, сом</th><th class="num">Сумма, сом</th>':''}</tr></thead><tbody>${o.lines.map(l=>{const ex=l.kind==='c'?Object.keys(expandLine(l,mn)).map(id=>(DSM[id]||{}).name).filter(Boolean).join(', '):'';return `<tr><td><b>${esc(lineName(l))}</b>${ex?`<div class="faint">${esc(ex)}</div>`:''}</td><td class="num tnum">${l.qty}</td>${pr?`<td class="num tnum">${fmtM(l.price)}</td><td class="num tnum">${fmtM(l.qty*l.price)}</td>`:''}</tr>`}).join('')}</tbody>
      <tfoot><tr><td>Итого</td><td class="num tnum">${ordPortions(o)}</td>${pr?`<td></td><td class="num tnum"><b>${fmtM(ordSum(o))}</b></td>`:''}</tr></tfoot></table>${pr&&ordFull(o)-ordSum(o)>0.009?`<div class="hint">Скидка ${money(Math.round((ordFull(o)-ordSum(o))*100)/100)} · по меню ${money(ordFull(o))}</div>`:''}</div>
      <div class="box"><div class="kv">${kv('Заказчик',`<button class="linkbtn" id="or-cu">${esc(c.name||'—')}</button>`)}${kv('Дата доставки',dayLbl(o.date)+(relDay(o.date)?' · '+relDay(o.date):''))}${kv('Смена',esc(shiftName(o.shift)))}${kv('Время',esc(o.time))}
        ${kv(o.pickup?'Самовывоз':'Точка доставки',esc(pt.name)+(pt.addr?`<div class="faint">${esc(pt.addr)}</div>`:''))}${pr?kv('Способ оплаты',esc(dictName('payMethod',o.pay))):''}${kv('Источник',esc(o.src))}${kv('Ответственный',esc(empName(o.resp)))}${kv('Приём закрывается',fmtDT(cutoffAt(o.date)))}${auditKv(o)}${kv('Комментарий',esc(o.note),1)}</div></div>`}
    if(tab==='dl')body+=`<div class="box"><div class="kv">${kv('Рейс',t?`${esc(t.no)} · ${scPill('trip',t.status,'sm')}`:'Не назначен')}${kv('Курьер',t?esc(EM[t.courier]?EM[t.courier].fio:''):'')}${kv('Адрес',esc(pt.addr)+(pt.mark?`<div class="faint">${esc(pt.mark)}</div>`:''))}${kv('Контакт на месте',esc((pt.contact||'')+' '+(pt.phone||'')))}
      ${kv('Доставлено',o.deliv?fmtDT(o.deliv.at)+' · получатель '+esc(o.deliv.recv):'')}${o.deliv&&o.deliv.cash?kv('Получено наличными',money(o.deliv.cash)):''}${o.nd?kv('Не доставлено',esc(odName('nd',o.nd.reason))+' · '+fmtDT(o.nd.at)):''}${feat('tara')&&o.tara?kv('Контейнеры',`выдано ${o.tara.out} · забрано ${o.tara.back}`):''}</div>
      ${o.deliv&&o.deliv.photo?`<img class="dl-ph" src="${o.deliv.photo}" alt="Фото доставки">`:''}${o.nd&&o.nd.photo?`<img class="dl-ph" src="${o.nd.photo}" alt="Фото">`:''}</div>${can('dlTrips')&&canTrip(o)?`<button class="btn" id="or-trip">${ic('send','sm')}${o.trip?'Перенести в другой рейс':'Добавить в рейс'}</button>`:''}`;
    if(tab==='pay'){const n=NAKLS.find(x=>x.id===o.nakl);const ps=PAYS.filter(p=>p.order===o.id);const L=ledgers()[o.cust]||{debt:0,overdue:0};
      body+=`<div class="box"><div class="kv">${kv('Сумма заказа',money(ordSum(o)))}${kv('Способ оплаты',esc(dictName('payMethod',o.pay)))}${kv('Накладная',n?`${esc(n.no)} от ${fmtD(n.date)}${n.status!=='Действует'?' (отменена)':''}`:'Создаётся при доставке')}${kv('Получено при доставке',ps.length?ps.map(p=>money(p.sum)+(p.status!=='Проведена'?' (отменена)':'')).join(', '):'—')}
        ${kv('Долг заказчика',`<b class="${L.overdue?'red':''}">${money(L.debt)}</b>`)}${kv('Отсрочка',(c.delay||0)+' дн.')}</div></div>`}
    if(tab==='hist')body+=histBlock('order','order',o);
    const nx=scNext('order',o);const canNx=nx&&!scWhyNot('order',o,nx)&&!o.pending;
    return {title:'Заказ '+esc(o.no),sub:esc(c.name||'')+' · '+fmtD(o.date),body,
      foot:`<button class="btn" id="or-more">${ic('more','sm')}Действия</button><div class="grow"></div>${canEditOrd(o)?`<button class="btn" id="or-ed">${ic('edit','sm')}Изменить</button>`:''}${o.status==='В пути'&&can('dlRoute')&&!o.pending?`<button class="btn danger" id="or-nd">Не доставлено</button>`:''}${canNx?`<button class="btn cta" id="or-nx">${ic('check','sm')}${esc(nx==='Принят'?'Принять':nx==='Доставлен'&&o.pickup?'Выдать':nx)}</button>`:''}`,
      mount(el){bindCardTabs(el,'ot',x=>{tab=x;m.draw()});bindScale(el,'order',o);$('#or-more',el).onclick=e=>menu(e.currentTarget,ordActions(o).filter(x=>x&&x.label!=='Открыть'));const on=(id,f)=>{const x=$(id,el);if(x)x.onclick=f};
        on('#or-ed',()=>orderDlg(o));on('#or-nx',()=>stepTo('order',o,nx));on('#or-nd',()=>ndDlg(o));on('#or-trip',()=>tripPickDlg([o]));on('#or-cu',()=>{if(can('cuView'))openCust(c)})}}}})}
// Создание заказа: общий путь для сотрудника, заказчика в приложении и регулярного заказа
function makeOrder(d,{who,src,note}){const c=CUM[d.cust];const o=born({id:uid('o'),no:nextNo('order','З',6),cust:d.cust,point:d.pickup?'':d.point,pickup:!!d.pickup,date:d.date,shift:d.shift,time:d.time||(d.pickup?'':((c.points.find(p=>p.id===d.point)||{}).win||'')),
  lines:d.lines,pay:d.pay||c.pay,note:d.note||'',resp:d.resp||c.resp||'',src,reg:d.reg||'',trip:'',changed:false,limitFlag:false,deliv:null,nd:null,cash:0},who);
  o.limitFlag=!!limitOver(c,ordSum(o));stStart(o,'Новый',note||'Заказ оформлен',who);ORDERS.push(o);ORM[o.id]=o;log('order',o.id,'Заказ создан ('+src+')',o,who);
  if(feat('autoAccept')&&c.status==='Активен'&&!o.limitFlag)sysStatus('order',o,'Принят','Автопринятие');
  if(src==='Заказчик в приложении')notify('newOrder',{roles:['manager'],emps:[o.resp]},`Новый заказ от заказчика: ${c.name} на ${fmtD(o.date)}, ${ordPortions(o)} порц.`,'orders.'+(o.date===TOMORROW()?'tomorrow':'all'));
  planTouch(o.date,o.shift);return o}
// Форма заказа: позиции только из опубликованного меню на дату; цена по прайсу заказчика; после закрытия приёма — только с правом
function orderDlg(o,pre={}){const isNew=!o;const src=o||pre.copy;const cu=isCust()?me().cust:(src?src.cust:pre.cust)||'';
  const st={cust:cu,date:o?o.date:pre.copy?(isClosed(TOMORROW())?addDays(TOMORROW(),1):TOMORROW()):pre.date||TOMORROW(),shift:src?src.shift:defShift(),rows:src?src.lines.map(l=>({src:l.kind+':'+l.id,qty:l.qty})):[{src:'',qty:''}]};
  const custs=()=>isCust()?[CUM[cu]]:visCusts().filter(c=>c.status==='Активен'||(o&&c.id===o.cust));
  openModal({form:true,size:'wide',render:md=>{const c=CUM[st.cust];const mn=menuOf(st.date,st.shift);const pub=mn&&(mn.status==='Опубликовано'||mn.status==='Приём закрыт'&&can('ordLate'));const closed=isClosed(st.date,st.shift);
    const opts=()=>pub?mn.items.map(i=>[i.kind+':'+i.id,(i.kind==='c'?'Комплекс · ':'')+itemName(i.kind,i.id)+(c&&canPrice()?` — ${fmtM(priceFor(c,i.kind,i.id,i.price))} сом`:'')+(itemLeft(mn,i)!=null?` (осталось ${itemLeft(mn,i)})`:'')]):[];
    const cols=[{key:'src',label:'Позиция меню',type:'sel',w:340,opts,req:1},{key:'qty',label:'Порций',type:'num',w:90,req:1},canPrice()&&{key:'sum',label:'Сумма, сом',type:'ro',num:1,w:110,ro:r=>{if(!r.src||!c||!mn)return '';const[t,id]=r.src.split(':');const it=menuItem(mn,t,id);return it?fmtM(priceFor(c,t,id,it.price)*(+r.qty||0)):''}}].filter(Boolean);
    const total=()=>{if(!c||!mn)return 0;return st.rows.reduce((a,r)=>{if(!r.src)return a;const[t,id]=r.src.split(':');const it=menuItem(mn,t,id);return a+(it?priceFor(c,t,id,it.price)*(+r.qty||0):0)},0)};
    const pts=c?c.points.map(p=>[p.id,p.name+' · '+p.addr]):[];
    return {title:isNew?(pre.copy?(isCust()?'Повторить заказ':'Копия заказа'):'Новый заказ'):'Изменить заказ '+esc(o.no),sub:c?esc(c.name):'',body:`<div class="form">
      ${isCust()?'':fld('Заказчик',sel('of-c',[['','—'],...custs().map(x=>[x.id,x.name])],st.cust,o?'disabled':''),{req:true,full:true,id:'of-c'})}
      ${fld('Дата доставки',inp('of-d',st.date,'type="date" min="'+TODAY+'"'),{req:true,id:'of-d'})}
      ${fld('Смена',sel('of-s',activeShifts(),st.shift),{req:true,id:'of-s'})}
      ${fld('Точка доставки',sel('of-p',[...pts,...(feat('pickup')?[['pickup','Самовывоз']]:[])],src?(src.pickup?'pickup':src.point):(pts[0]||[''])[0]),{req:true,full:true,id:'of-p'})}
      <div class="fld full">${!mn?`<div class="note warn">${ic('alert')}<span>На ${dayLbl(st.date)} меню ещё нет.</span></div>`:!pub?`<div class="note warn">${ic('alert')}<span>Меню на ${dayLbl(st.date)}: «${esc(mn.status)}»${mn.status==='Приём закрыт'?' — менять заказы может только сотрудник с правом «Менять заказы после закрытия приёма»':' — заказы принимаются после публикации'}.</span></div>`:closed?`<div class="note warn">${ic('lock')}<span>Приём заказов на эту дату закрыт ${fmtDT(cutoffAt(st.date))}. ${can('ordLate')?'У вас есть право менять заказы после закрытия.':''}</span></div>`:`<div class="hint">Приём заказов на эту дату открыт до ${fmtDT(cutoffAt(st.date))}.</div>`}</div>
      ${fld('Позиции',linesHtml('of-l',st.rows,cols,{add:'Добавить позицию',foot:canPrice()?`<tfoot><tr><td>Итого</td><td class="num tnum">${st.rows.reduce((a,r)=>a+(+r.qty||0),0)}</td><td class="num tnum" id="of-tot"><b>${fmtM(total())}</b></td><td></td></tr></tfoot>`:''}),{req:true,full:true,id:'of-l'})}
      ${fld('Время доставки',inp('of-t',src&&src.time||'','placeholder="По окну точки"'),{id:'of-t'})}
      ${canPrice()?fld('Способ оплаты',sel('of-pay',dictOpts('payMethod',src&&src.pay),src?src.pay:c?c.pay:'СО-001'),{id:'of-pay'}):''}
      ${isCust()?'':fld('Ответственный',sel('of-r',[['','—'],...empOpts()],src?src.resp:c?c.resp:''),{id:'of-r'})}
      ${fld('Комментарий',inp('of-n',src?src.note:'','placeholder="Например, 2 порции без лука"'),{full:true,id:'of-n'})}</div>${c&&limitOver(c,total())?`<div class="note warn">${ic('alert')}<span>С этим заказом долг заказчика превысит лимит ${money(+c.limit)}: заказ сохранится с отметкой «Превышен лимит долга».</span></div>`:''}`,
      foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="of-ok" ${!pub||closed&&!can('ordLate')?'disabled':''}>${isNew?(isCust()?'Отправить заказ':'Создать заказ'):'Сохранить'}</button>`,
      mount(el){const keep=()=>{st.shift=val(el,'of-s')||st.shift;keepForm(el,md)};
        if($('#of-c',el))$('#of-c',el).onchange=e=>{st.cust=e.target.value;keep()};$('#of-d',el).onchange=e=>{st.date=e.target.value;st.rows=st.rows.filter(r=>{const[t,id]=(r.src||':').split(':');return menuItem(menuOf(st.date,st.shift),t,id)});if(!st.rows.length)st.rows=[{src:'',qty:''}];keep()};$('#of-s',el).onchange=e=>{st.shift=e.target.value;keep()};
        bindLines(el,'of-l',st.rows,cols,{blank:()=>({src:'',qty:''}),redraw:keep,onChange:(r,k,x)=>{const tr=x.closest('tr');const sc=tr&&tr.children[2];if(canPrice()&&sc&&cols[2])sc.textContent=cols[2].ro(r);const t=$('#of-tot',el);if(t)t.innerHTML=`<b>${fmtM(total())}</b>`}});
        $('#of-ok',el).onclick=()=>{const cid=st.cust;const rows=st.rows.filter(r=>r.src);let ok=true;if(!isCust())ok=setErr(el,'of-c',cid?'':'Выберите заказчика');
          const keys=rows.map(r=>r.src);ok=setErr(el,'of-l',!rows.length?'Добавьте хотя бы одну позицию':rows.some(r=>!(r.qty>0)||r.qty%1)?'Порции — целое число больше нуля':new Set(keys).size!==keys.length?'Позиция повторяется':'')&&ok;
          if(ok&&mn){const over=rows.find(r=>{const[t,id]=r.src.split(':');const it=menuItem(mn,t,id);const mine=o?o.lines.filter(l=>l.kind===t&&l.id===id).reduce((a,l)=>a+l.qty,0):0;return it&&it.limit&&r.qty>itemLeft(mn,it)+mine});if(over)ok=setErr(el,'of-l',`«${itemName(...over.src.split(':'))}» — осталось меньше, чем заказано`)}
          if(!ok)return;const c=CUM[cid];const p=val(el,'of-p');
          const lines=rows.map(r=>{const[t,id]=r.src.split(':');const it=menuItem(mn,t,id);return {kind:t,id,qty:+r.qty,price:priceFor(c,t,id,it.price)}});
          const d={cust:cid,point:p==='pickup'?'':p,pickup:p==='pickup',date:st.date,shift:st.shift,lines,time:val(el,'of-t'),pay:val(el,'of-pay')||c.pay,resp:isCust()?c.resp:val(el,'of-r'),note:val(el,'of-n')};
          if(isNew){const n=makeOrder(d,{who:S.me,src:isCust()?'Заказчик в приложении':'Сотрудник',note:pre.copy?'Скопирован из '+pre.copy.no:''});md.close();refreshAll();toast(isCust()?'Заказ отправлен':'Заказ создан','task');if(!isCust())openOrder(n);return}
          const was=JSON.stringify(o.lines);Object.assign(o,{point:d.point,pickup:d.pickup,date:d.date,shift:d.shift,lines:d.lines,time:d.time||((c.points.find(x=>x.id===d.point)||{}).win||''),pay:d.pay,note:d.note});if(!isCust())o.resp=d.resp;
          o.limitFlag=o.status==='Новый'?!!limitOver(c,0):o.limitFlag;log('order',o.id,was!==JSON.stringify(o.lines)?'Состав заказа изменён: '+ordComp(o):'Заказ изменён',o);
          if(isCust()){if(o.status==='Принят'&&!feat('autoAccept')){o.changed=true;sysStatus('order',o,'Новый','Изменён заказчиком')}notify('custChange',{roles:['manager'],emps:[o.resp]},`Заказчик изменил заказ ${o.no}: ${ordComp(o)}`,'orders.all')}
          planTouch(o.date,o.shift);md.close();refreshAll();toast('Заказ сохранён')}}}}})}
function printNakl(o){const n=NAKLS.find(x=>x.id===o.nakl);const pt=pointOf(o);const pr=canPrice();
  printDlg('Накладная '+(n?n.no:'(черновик)'),`${docHead('Накладная '+(n?esc(n.no):'— будет создана при доставке'),n?'от '+fmtD(n.date):'')}<p><b>Получатель:</b> ${esc(custName(o.cust))}, ${esc(pt.name)}, ${esc(pt.addr||'')}<br><b>Заказ:</b> ${esc(o.no)} на ${fmtD(o.date)}</p>
    <table class="mini"><thead><tr><th>№</th><th>Позиция</th><th class="num">Кол-во</th>${pr?'<th class="num">Цена</th><th class="num">Сумма</th>':''}</tr></thead><tbody>${o.lines.map((l,i)=>`<tr><td>${i+1}</td><td>${esc(lineName(l))}</td><td class="num">${l.qty}</td>${pr?`<td class="num">${fmtM(l.price)}</td><td class="num">${fmtM(l.qty*l.price)}</td>`:''}</tr>`).join('')}</tbody>${pr?`<tfoot><tr><td></td><td>Итого</td><td class="num">${ordPortions(o)}</td><td></td><td class="num"><b>${fmtM(ordSum(o))}</b></td></tr></tfoot>`:''}</table>
    <div class="pd-sign"><span>Отпустил ____________</span><span>Получил ____________ ${o.deliv?esc(o.deliv.recv):''}</span></div>`)}

/* ═════════════ Регулярные заказы ═════════════ */
const DOWS=[[1,'Пн'],[2,'Вт'],[3,'Ср'],[4,'Чт'],[5,'Пт'],[6,'Сб'],[7,'Вс']];
function regCols(){return [{key:'cust',label:'Заказчик',type:'enum',w:200,val:r=>custName(r.cust)},{key:'point',label:'Точка',type:'enum',w:170,val:r=>((CUM[r.cust]||{points:[]}).points.find(p=>p.id===r.point)||{}).name||''},
  {key:'comp',label:'Позиции',type:'text',w:220,val:r=>r.lines.map(l=>`${itemName(l.kind,l.id)} × ${l.qty}`).join(', ')},{key:'dows',label:'Дни',type:'text',w:140,val:r=>DOWS.filter(([d])=>r.dows.includes(d)).map(x=>x[1]).join(', ')},
  {key:'period',label:'Действует',type:'text',w:170,val:r=>`с ${fmtD(r.from)}${r.to?' по '+fmtD(r.to):''}`},{key:'act',label:'Активен',type:'enum',w:90,val:r=>r.active?'Да':'Нет'}]}
function renderRegs(body,fresh){body.innerHTML=`<div class="note">${ic('repeat')}<span>За сутки до закрытия приёма система создаёт обычный заказ «Новый» на каждую подходящую дату. До закрытия приёма заказчик или менеджер может поменять порции в созданном заказе.</span></div><div id="rgg"></div>`;
  grid($('#rgg',body),{id:'regs',cols:regCols(),rows:()=>REGS.filter(r=>isCust()?r.cust===me().cust:visCusts(true).some(c=>c.id===r.cust)),title:'cust',noun:['регулярный заказ','регулярных заказа','регулярных заказов'],open:r=>regularDlg(r),rowClass:r=>r.active?'':'muted',simulateLoad:fresh,
    actions:r=>[can('ordRegular')&&{label:'Изменить',icon:'edit',run:()=>regularDlg(r)},can('ordRegular')&&{label:r.active?'Остановить':'Возобновить',icon:r.active?'pause':'play',run:()=>{r.active=!r.active;log('regular',r.id,r.active?'Возобновлён':'Остановлен',r);refreshAll()}}],
    empty:{icon:'repeat',title:'Регулярных заказов пока нет',add:can('ordRegular')?()=>regularDlg():null}})}
function regularDlg(r,cust){const isNew=!r;const ro=!can('ordRegular');const st={cust:r?r.cust:cust||'',rows:r?r.lines.map(l=>({src:l.kind+':'+l.id,qty:l.qty})):[{src:'',qty:''}]};
  openModal({form:!ro,size:'mid',render:md=>{const c=CUM[st.cust];const opts=()=>[...COMBOS.filter(x=>x.status==='Активно').map(x=>['c:'+x.id,'Комплекс · '+x.name]),...DISHES.filter(d=>d.status==='Активно'&&!d.semi).map(d=>['d:'+d.id,d.name])];
    const cols=[{key:'src',label:'Позиция',type:'sel',w:280,opts,req:1},{key:'qty',label:'Порций',type:'num',w:90,req:1}];
    return {title:isNew?'Новый регулярный заказ':'Регулярный заказ',sub:c?esc(c.name):'',body:`<div class="form">${fld('Заказчик',sel('rf-c',[['','—'],...visCusts().map(x=>[x.id,x.name])],st.cust,ro||!isNew?'disabled':''),{req:true,full:true,id:'rf-c'})}
      ${fld('Точка доставки',sel('rf-p',c?c.points.map(p=>[p.id,p.name]):[],r?r.point:'',ro?'disabled':''),{req:true,id:'rf-p'})}${fld('Смена',sel('rf-s',activeShifts(),r?r.shift:defShift(),ro?'disabled':''),{req:true,id:'rf-s'})}
      ${fld('Дни недели',`<div class="chips">${DOWS.map(([d,l])=>`<label class="chip"><input type="checkbox" data-dw="${d}" ${(r?r.dows:[1,2,3,4,5]).includes(d)?'checked':''} ${ro?'disabled':''}>${l}</label>`).join('')}</div>`,{req:true,full:true,id:'rf-dw'})}
      ${fld('Позиции',linesHtml('rf-l',st.rows,cols,{add:'Добавить позицию',ro}),{req:true,full:true,id:'rf-l'})}
      ${fld('Действует с',inp('rf-f',r?r.from:TOMORROW(),'type="date" '+(ro?'readonly':'')),{req:true,id:'rf-f'})}${fld('Действует по',inp('rf-t',r?r.to:'','type="date" '+(ro?'readonly':'')),{id:'rf-t',hint:'Пусто — бессрочно'})}</div>`,
      foot:ro?'<button class="btn cta" data-close>Закрыть</button>':`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="rf-ok">${isNew?'Создать':'Сохранить'}</button>`,
      mount(el){if(ro)return;$('#rf-c',el).onchange=e=>{st.cust=e.target.value;keepForm(el,md)};bindLines(el,'rf-l',st.rows,cols,{blank:()=>({src:'',qty:''}),redraw:()=>keepForm(el,md)});
        $('#rf-ok',el).onclick=()=>{const dows=$$('[data-dw]',el).filter(x=>x.checked).map(x=>+x.dataset.dw);const rows=st.rows.filter(x=>x.src);let ok=setErr(el,'rf-c',st.cust?'':'Выберите заказчика');ok=setErr(el,'rf-dw',dows.length?'':'Выберите дни')&&ok;ok=setErr(el,'rf-l',!rows.length||rows.some(x=>!(x.qty>0))?'Добавьте позиции и порции':'')&&ok;ok=setErr(el,'rf-p',val(el,'rf-p')?'':'Выберите точку')&&ok;if(!ok)return;
          const v={cust:st.cust,point:val(el,'rf-p'),shift:val(el,'rf-s'),dows,lines:rows.map(x=>{const[t,id]=x.src.split(':');return {kind:t,id,qty:+x.qty}}),from:val(el,'rf-f'),to:val(el,'rf-t')};
          if(isNew){const n=born({id:uid('g'),...v,active:true});REGS.push(n);log('regular',n.id,'Регулярный заказ создан',n)}else{Object.assign(r,v);log('regular',r.id,'Регулярный заказ изменён',r)}md.close();autoJobs();refreshAll();toast('Сохранено','repeat')}}}}})}

/* ═════════════ Автоматические задания (в продукте — на сервере по расписанию) ═════════════ */
// 1) регулярные заказы за сутки до закрытия приёма; 2) закрытие приёма по времени; 3) напоминание заказчикам за час до закрытия; 4) ежедневные уведомления
function autoJobs(){const now=nowStamp();let ch=false;const tenant=DB.cur;
  Object.keys(DB.tenants).forEach(tid=>{if(tid!==DB.cur){DB.cur=tid;dbBind()}
    if(feat('regular'))for(let i=0;i<=3;i++){const d=addDays(TODAY,i);const ca=cutoffAt(d);const start=addDays(ca.slice(0,10),-1)+ca.slice(10);if(now<start||isClosed(d))continue;
      REGS.filter(r=>r.active&&r.from<=d&&(!r.to||r.to>=d)&&r.dows.includes(dowOf(d)||7)).forEach(r=>{if(ORDERS.some(o=>o.reg===r.id&&o.date===d))return;const c=CUM[r.cust];if(!c||c.status!=='Активен')return;const m=menuOf(d,r.shift);
        if(!m||m.status!=='Опубликовано'){if(!NOTICES.some(n=>n.type==='noMenu'&&n.key===d)){notify('noMenu',{roles:['manager']},`Нет меню на ${dayLbl(d)} для регулярных заказов`,'menu.week');NOTICES[NOTICES.length-1].key=d;ch=true}return}
        const lines=r.lines.map(l=>{const it=menuItem(m,l.kind,l.id);return it?{...l,price:priceFor(c,l.kind,l.id,it.price)}:null}).filter(Boolean);if(!lines.length)return;
        makeOrder({cust:r.cust,point:r.point,date:d,shift:r.shift,lines,reg:r.id},{who:'system',src:'Регулярный',note:'Создан по регулярному заказу'});ch=true})}
    MENUS.filter(m=>m.status==='Опубликовано'&&!m.reopen&&now>=cutoffAt(m.date)).forEach(m=>{sysStatus('menu',m,'Приём закрыт','Время закрытия приёма');ch=true});
    {const d=TOMORROW();const ca=cutoffAt(d);const hr=String(+ca.slice(11,13)-1).padStart(2,'0')+ca.slice(13);if(now>=ca.slice(0,11)+hr&&now<ca&&feat('custLogin')&&!NOTICES.some(n=>n.type==='remind'&&n.key===d)){
      const reps=EMP.filter(e=>e.role==='customer'&&e.active!==false&&!ORDERS.some(o=>o.cust===e.cust&&o.date===d&&ordActive(o))).map(e=>e.id);if(reps.length){notify('remind',{emps:reps},`Приём заказов на завтра закроется через 1 час`,'c-order');NOTICES[NOTICES.length-1].key=d;ch=true}}}
    const daily=(type,to,text,link)=>{if(!NOTICES.some(n=>n.type===type&&n.at.slice(0,10)===TODAY)){notify(type,to,text,link);ch=true}};
    if(feat('stock')){const lo=lowStock(),ex=expSoon();if(lo.length||ex.length)daily('stock',{roles:['store','chef']},[lo.length?`Ниже минимума: ${lo.length}`:'',ex.length?`истекает срок: ${ex.length}`:''].filter(Boolean).join(', '),'stock.rest')}
    if(dowOf(TODAY)>0&&dowOf(TODAY)<6){const ov=CUSTS.filter(c=>ledgers()[c.id].overdue>0);if(ov.length)daily('overdue',{roles:['acc'],emps:[...new Set(ov.map(c=>c.resp).filter(Boolean))]},`Просрочен долг у ${ov.length} ${plural(ov.length,'заказчика','заказчиков','заказчиков')}`,'money.debts')}});
  if(DB.cur!==tenant){DB.cur=tenant;dbBind()}return ch}
