'use strict';
// «Главная»: сводка на сегодня по роли; каждая плашка открывает нужный список с уже применённым фильтром. Выручка — только с правом «Видеть деньги организации». У заказчика — свой вид
/* ═════════════ Главная ═════════════ */
function homeTabs(){return []}
const homeGo=(m,t,p)=>()=>go(m,t,p);
function renderHome(body){if(isCust())return custHome(body);
  if(!CUSTS.length&&!DISHES.length)return homeFirst(body);
  const tm=TOMORROW();const v=can('ordView')?visOrders():[];const P=[];const add=(ok,cfg,run)=>{if(ok)P.push({cfg,run})};
  const nw=v.filter(o=>o.status==='Новый'&&o.date>=TODAY);
  add(can('ordAccept'),{id:'new',icon:'circle',color:nw.length?'blue':'green',label:'Новые заказы',value:nw.length,sub:nw.length?'ждут принятия':'все приняты'},homeGo('orders','all',{status:{type:'enum',vals:['Новый']},date:{type:'date',from:TODAY,to:null}}));
  const tmr=v.filter(o=>o.date===tm&&ordActive(o));
  add(can('ordView'),{id:'tm',icon:'clock',color:'purple',label:'Заказы на завтра',value:tmr.reduce((a,o)=>a+ordPortions(o),0),unit:'порц.',sub:`${tmr.length} ${plural(tmr.length,'заказ','заказа','заказов')} · ${isClosed(tm)?'приём закрыт':'приём до '+fmtDT(cutoffAt(tm)).slice(11)}`},homeGo('orders','tomorrow'));
  const pl=PLANS.find(p=>p.date===tm&&p.shift===defShift());const plOk=!pl||pl.status!=='Черновик';
  add(can('ktView')&&(can('ktApprove')||me().role==='manager'),{id:'plan',icon:'lock',color:plOk?'green':'orange',label:'План кухни на завтра',value:pl?pl.status:'Нет заказов',sub:pl&&!plOk?'не утверждён':pl?`${planPortions(pl)} порц.`:''},homeGo('kitchen','tomorrow'));
  const nd=v.filter(o=>o.date===TODAY&&o.status==='Не доставлен');
  add(can('ordView')&&feat('delivery'),{id:'nd',icon:'alert',color:nd.length?'red':'green',label:'Не доставлено',value:nd.length,sub:'сегодня'},homeGo('orders','all',{status:{type:'enum',vals:['Не доставлен']},date:{type:'date',from:TODAY,to:TODAY}}));
  if(feat('stock')&&can('skView')){const lo=lowStock(),ex=expSoon();add(true,{id:'lo',icon:'archive',color:lo.length?'red':'green',label:'Ниже минимума',value:lo.length,sub:'продуктов'},homeGo('stock','rest',{low:{type:'enum',vals:['Да']}}));
    add(true,{id:'ex',icon:'clock',color:ex.length?'orange':'green',label:'Истекает срок',value:ex.length,sub:'за 2 дня'},homeGo('stock','rest',{exs:{type:'enum',vals:['Да']}}))}
  if(can('myView')){const L=ledgers();const cs=visCusts(true).filter(c=>L[c.id].overdue>0);add(true,{id:'ov',icon:'wallet',color:cs.length?'red':'green',label:'Просроченные долги',value:fmtM(cs.reduce((a,c)=>a+L[c.id].overdue,0),false),unit:'сом',sub:cs.length?`${cs.length} ${plural(cs.length,'заказчик','заказчика','заказчиков')}`:'просрочки нет'},homeGo('money','debts',{overdue:{type:'num',from:0.01,to:null}}))}
  if(feat('delivery')&&(can('myView')||can('dlRoute'))){const mine=!can('myView');const ts=TRIPS.filter(t=>(!mine||t.courier===S.me)&&cashStatus(t)&&cashStatus(t)!=='Принято');const s=ts.reduce((a,t)=>a+(t.cash?t.cash.sent:tripGot(t)),0);
    add(true,{id:'cash',icon:'truck',color:s?'orange':'green',label:mine?'Мои наличные':'Наличные у курьеров',value:fmtM(s,false),unit:'сом',sub:ts.some(t=>cashStatus(t)==='Ждёт приёма')?'есть сдача на подтверждение':'не сдано в кассу'},homeGo('money','cash',{st:{type:'enum',vals:['Не сдано','Ждёт приёма']}}))}
  if(feat('delivery')&&can('dlRoute')&&!isOwner()){const t=routeTrips()[0];add(true,{id:'rt',icon:'truck',color:t?t.status==='В пути'?'yellow':'purple':'gray',label:'Мой рейс сегодня',value:t?t.no:'Нет',sub:t?`${t.status} · ${tripPoints(t)} ${plural(tripPoints(t),'точка','точки','точек')}`:'рейс не назначен'},homeGo('route'))}
  const role=isOwner()?'Владелец':roleName(me().role);
  let h=`<div class="hello"><span>Сегодня <b>${dayLbl(TODAY)}</b></span><span>·</span><span>${esc(ORG.name)}</span><span>·</span><span>${esc(role)}</span>${frozen()?`<span class="pill yellow sm">${esc(ORG.plat.status)}: только просмотр</span>`:''}</div>`;
  h+=P.length?`<div class="plates">${P.map(p=>plate(p.cfg)).join('')}</div>`:'';
  if(can('orgMoney'))h+=homeMoney();
  if(can('ordView')||can('ktView')||can('dlView'))h+=homeToday();
  if(!P.length&&!can('orgMoney'))h+=`<div class="state">${ic('home','lg')}<b>Добро пожаловать</b><span>Откройте модуль в меню, чтобы начать работу.</span></div>`;
  body.innerHTML=h;
  body.onclick=e=>{const b=e.target.closest('[data-plate]');if(b){const p=P.find(x=>x.cfg.id===b.dataset.plate);if(p)p.run();return}const g=e.target.closest('[data-goto]');if(g){const[a,t]=g.dataset.goto.split('.');go(a,t)}}}
// Выручка сегодня и за месяц — по накладным (доставленным заказам); порций сегодня — по активным заказам
function homeMoney(){const ms=monthStart(TODAY);const live=NAKLS.filter(n=>n.status==='Действует');const td=live.filter(n=>n.date===TODAY).reduce((a,n)=>a+n.sum,0),mo=live.filter(n=>n.date>=ms).reduce((a,n)=>a+n.sum,0);
  const por=ORDERS.filter(o=>o.date===TODAY&&ordActive(o)).reduce((a,o)=>a+ordPortions(o),0);const days=[...Array(14)].map((_,i)=>addDays(TODAY,i-13));const by=days.map(d=>live.filter(n=>n.date===d).reduce((a,n)=>a+n.sum,0));const mx=Math.max(1,...by);
  return `<div class="box home-money"><h3>Деньги организации</h3><div class="hm-row"><div class="hm-k"><span>Выручка сегодня</span><b>${fmtM(td,false)} <small>сом</small></b></div><div class="hm-k"><span>Выручка за месяц</span><b>${fmtM(mo,false)} <small>сом</small></b></div><div class="hm-k"><span>Порций сегодня</span><b>${fmtN(por)}</b></div></div>
    <div class="hm-bars" role="img" aria-label="Выручка за 14 дней">${days.map((d,i)=>`<span class="hm-b ${d===TODAY?'on':''}" title="${dayLbl(d)}: ${money(by[i])}"><i style="height:${Math.max(2,Math.round(by[i]/mx*100))}%"></i><em>${d.slice(8,10)}</em></span>`).join('')}</div><div class="hint">Выручка по накладным: накладная создаётся, когда заказ доставлен.</div></div>`}
// «Сегодня»: план кухни, рейсы и заказы по статусам
function homeToday(){const pl=PLANS.find(p=>p.date===TODAY&&p.shift===defShift());const os=(can('ordView')?visOrders():[]).filter(o=>o.date===TODAY);const ts=(feat('delivery')&&can('dlView')?visTrips():[]).filter(t=>t.date===TODAY);
  const cnt={};os.forEach(o=>cnt[o.status]=(cnt[o.status]||0)+1);
  return `<div class="box"><h3>Сегодня</h3><div class="list">
    ${can('ktView')?`<button class="li" data-goto="kitchen.today"><span class="pl-dot purple">${ic('list')}</span><div class="grow"><div class="t1">План кухни</div><div class="t2">${pl?`${planPortions(pl)} порц. · ${planDishes(pl).length} блюд`:'Заказов на сегодня нет'}</div></div>${pl?scaleMini('plan',pl):''}</button>`:''}
    ${can('ordView')?`<button class="li" data-goto="orders.today"><span class="pl-dot blue">${ic('task')}</span><div class="grow"><div class="t1">Заказы: ${os.filter(ordActive).length}</div><div class="t2">${Object.entries(cnt).map(([s,n])=>`${s} ${n}`).join(' · ')||'нет'}</div></div></button>`:''}
    ${feat('delivery')&&can('dlView')?`<button class="li" data-goto="delivery.today"><span class="pl-dot yellow">${ic('truck')}</span><div class="grow"><div class="t1">Рейсы: ${ts.length}</div><div class="t2">${ts.map(t=>`${t.no} ${empName(t.courier)} — ${t.status}`).join(' · ')||'не сформированы'}</div></div></button>`:''}</div></div>`}
// Пустая организация: первые шаги
function homeFirst(body){const steps=[[can('cuView'),'customers.act','building','Добавьте заказчиков','По одному или списком из Excel, с точками доставки'],[can('dsView'),'dishes.list','list','Заведите блюда и техкарты','Продукты, выход порции, цена — себестоимость посчитается сама'],
  [can('mnView'),'menu.week','calendar','Составьте и опубликуйте меню','Заказчики начнут заказывать на завтра'],[can('stView'),'staff.list','users','Пригласите сотрудников','Шеф-повара, поваров, курьеров, бухгалтера'],[isOwner(),'org.policy','sliders','Проверьте учётную политику','Какие функции нужны: склад, доставка, вход для заказчиков']].filter(s=>s[0]);
  body.innerHTML=`<div class="state">${ic('home','lg')}<b>Добро пожаловать в Eda</b><span>Сводка на сегодня появится, когда будут заказчики, блюда и меню. Начните с этих шагов:</span></div><div class="box"><div class="list">${steps.map((s,i)=>`<button class="li" data-goto="${s[1]}"><span class="rt-n">${i+1}</span><span class="pl-dot blue">${ic(s[2])}</span><div class="grow"><div class="t1">${s[3]}</div><div class="t2">${s[4]}</div></div>${ic('right','sm')}</button>`).join('')}</div></div>`;
  body.onclick=e=>{const g=e.target.closest('[data-goto]');if(g){const[a,t]=g.dataset.goto.split('.');go(a,t)}}}
