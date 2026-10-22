'use strict';
// Модуль «Отчёты»: продажи, себестоимость и фудкост, движение продуктов, потери, долги на дату, доставка — за выбранный период, тем же компонентом списка
/* ═════════════ Отчёты ═════════════ */
// rpView — отчёты кухни и склада, rpMoney — финансовые (продажи, долги, доставка)
function rpTabs(){return [can('rpMoney')&&{id:'sales',label:'Продажи',icon:'chart'},feat('stock')&&{id:'cost',label:'Себестоимость и фудкост',icon:'coins'},feat('stock')&&{id:'moves',label:'Движение продуктов',icon:'archive'},{id:'loss',label:'Потери',icon:'trash'},
  can('rpMoney')&&{id:'debts',label:'Долги на дату',icon:'wallet'},can('rpMoney')&&feat('delivery')&&{id:'dlv',label:'Доставка',icon:'truck'}].filter(Boolean)}
const RPK=[['week','Эта неделя'],['month','Этот месяц'],['prev','Прошлый месяц'],['custom','Период']];
function rpRange(){const k=S.rpk||'month';if(k==='week')return [weekStart(TODAY),TODAY];if(k==='prev'){const e=addDays(monthStart(TODAY),-1);return [monthStart(e),e]}if(k==='custom')return [S.rpf||monthStart(TODAY),S.rpt||TODAY];return [monthStart(TODAY),TODAY]}
const inRange=(d,[f,t])=>d>=f&&d<=t;
// Строка выбора периода над отчётом; extra — свой переключатель отчёта (например, «По дням / По заказчикам»)
function rpBar(tab,extra=''){const k=S.rpk||'month';const[f,t]=rpRange();
  return `<div class="box rp-bar">${tab==='debts'?`<label for="rp-d">На дату</label>${inp('rp-d',S.rpd||TODAY,'type="date" style="max-width:170px"')}`:`${segHtml('rp-k',RPK,k)}${k==='custom'?inp('rp-f',f,'type="date" style="max-width:160px"')+inp('rp-t',t,'type="date" style="max-width:160px"'):''}<span class="faint">${fmtD(f)} – ${fmtD(t)}</span>`}<span class="grow"></span>${extra}</div>`}
function bindRpBar(body){bindSeg(body,'rp-k',v=>{S.rpk=v;renderPage()});['rp-f','rp-t','rp-d'].forEach(id=>{const x=$('#'+id,body);if(x)x.onchange=()=>{if(id==='rp-f')S.rpf=x.value;if(id==='rp-t')S.rpt=x.value;if(id==='rp-d')S.rpd=x.value;renderPage()}})}
// Переключатель группировки отчёта: меняет первый уровень группировки списка
function rpGroupSeg(gid,opts,def){const s=GS[gid];const cur=(s&&s.group&&s.group[0])||def;return segHtml('rp-g',opts,cur)}
function bindRpGroup(body,gid){bindSeg(body,'rp-g',v=>{const s=GS[gid];if(s){s.group=[v];s.closed=new Set();gsave(gid)}renderPage()})}
function renderReports(body,tab,fresh){({sales:rpSales,cost:rpCost,moves:rpMoves,loss:rpLoss,debts:rpDebts,dlv:rpDlv}[tab]||rpLoss)(body,fresh)}
const delivered=r=>ORDERS.filter(o=>o.status==='Доставлен'&&inRange(o.date,r));
const rpGrid=(body,cfg)=>grid($('#rpg',body),{audit:false,ordered:true,simulateLoad:false,firstRun:false,...cfg});
const pct=v=>v==null||isNaN(v)?'':Math.round(v*10)/10;

/* Продажи: по дням, заказчикам, блюдам и комплексам — порции и выручка */
function rpSales(body){const r=rpRange();const rows=[];delivered(r).forEach(o=>o.lines.forEach((l,i)=>rows.push({id:o.id+':'+i,date:o.date,cust:o.cust,item:lineName(l),kind:l.kind==='c'?'Комплекс':'Блюдо',qty:l.qty,sum:Math.round(l.qty*l.price*100)/100,shift:o.shift,resp:o.resp,o})));
  const rev=rows.reduce((a,x)=>a+x.sum,0),qty=rows.reduce((a,x)=>a+x.qty,0),n=new Set(rows.map(x=>x.o.id)).size;
  body.innerHTML=rpBar('sales',rpGroupSeg('rp-sales',[['date','По дням'],['cust','По заказчикам'],['item','По блюдам']],'date'))+`<div class="plates">${plate({id:'r',icon:'coins',color:'green',label:'Выручка',value:fmtM(rev,false),unit:'сом'})}${plate({id:'q',icon:'task',color:'blue',label:'Порций',value:fmtN(qty)})}${plate({id:'n',icon:'list',color:'purple',label:'Заказов',value:n})}${plate({id:'a',icon:'chart',color:'orange',label:'Средний заказ',value:n?fmtM(rev/n,false):'0',unit:'сом'})}</div><div id="rpg"></div>`;
  bindRpBar(body);bindRpGroup(body,'rp-sales');
  rpGrid(body,{id:'rp-sales',cols:[{key:'date',label:'Дата',type:'date',w:120,val:x=>x.date},{key:'cust',label:'Заказчик',type:'enum',w:220,val:x=>custName(x.cust)},{key:'item',label:'Блюдо или комплекс',type:'enum',w:220,val:x=>x.item},{key:'kind',label:'Вид',type:'enum',w:110,val:x=>x.kind},
    {key:'qty',label:'Порций',type:'int',num:1,total:1,w:100,val:x=>x.qty},{key:'sum',label:'Выручка, сом',type:'money',num:1,total:1,w:140,val:x=>x.sum},{key:'shift',label:'Смена',type:'enum',w:100,hide:1,val:x=>shiftName(x.shift)},{key:'resp',label:'Ответственный',type:'enum',w:150,hide:1,val:x=>empName(x.resp)}],
    rows:()=>rows,rid:x=>x.id,title:'item',group:['date'],sort:{key:'date',dir:1},noun:['строка','строки','строк'],xlsName:'Продажи',open:x=>openOrder(x.o),empty:{icon:'chart',title:'За период продаж нет',text:'В продажи попадают доставленные заказы'}})}

/* Себестоимость и фудкост: по блюдам и дням — выручка, себестоимость по средней цене склада, фудкост, валовая прибыль */
function rpCost(body){const r=rpRange();const m={};const norm=+ORG.policy.foodcost||35;
  delivered(r).forEach(o=>{const mn=menuOf(o.date,o.shift);o.lines.forEach(l=>{const k=o.date+'|'+l.kind+':'+l.id;const x=m[k]=m[k]||{id:k,date:o.date,item:lineName(l),kind:l.kind==='c'?'Комплекс':'Блюдо',qty:0,rev:0,cost:0};
    const unit=Object.entries(expandLine({...l,qty:1},mn)).reduce((a,[d,q])=>a+q*(DSM[d]?dishCost(DSM[d],o.date):0),0);x.qty+=l.qty;x.rev+=l.qty*l.price;x.cost+=l.qty*unit})});
  const rows=Object.values(m).map(x=>({...x,rev:Math.round(x.rev*100)/100,cost:Math.round(x.cost*100)/100,fc:x.rev?x.cost/x.rev*100:null,pr:Math.round((x.rev-x.cost)*100)/100}));const R=rows.reduce((a,x)=>a+x.rev,0),C=rows.reduce((a,x)=>a+x.cost,0);
  body.innerHTML=rpBar('cost',rpGroupSeg('rp-cost',[['item','По блюдам'],['date','По дням']],'item'))+`<div class="plates">${plate({id:'r',icon:'coins',color:'green',label:'Выручка',value:fmtM(R,false),unit:'сом'})}${plate({id:'c',icon:'archive',color:'blue',label:'Себестоимость',value:fmtM(C,false),unit:'сом'})}
    ${plate({id:'f',icon:'gauge',color:R&&C/R*100>norm?'red':'green',label:'Фудкост',value:R?pct(C/R*100):'—',unit:'%',sub:'норма '+norm+' %'})}${plate({id:'p',icon:'chart',color:'purple',label:'Валовая прибыль',value:fmtM(R-C,false),unit:'сом'})}</div><div id="rpg"></div>`;
  bindRpBar(body);bindRpGroup(body,'rp-cost');
  rpGrid(body,{id:'rp-cost',cols:[{key:'item',label:'Блюдо или комплекс',type:'enum',w:220,val:x=>x.item},{key:'date',label:'Дата',type:'date',w:120,val:x=>x.date},{key:'kind',label:'Вид',type:'enum',w:110,val:x=>x.kind},{key:'qty',label:'Порций',type:'int',num:1,total:1,w:100,val:x=>x.qty},
    {key:'rev',label:'Выручка, сом',type:'money',num:1,total:1,w:130,val:x=>x.rev},{key:'cost',label:'Себестоимость, сом',type:'money',num:1,total:1,w:150,val:x=>x.cost},
    {key:'fc',label:'Фудкост, %',type:'num',num:1,w:110,val:x=>x.fc==null?null:pct(x.fc),html:x=>x.fc==null?'':`<span class="${x.fc>norm?'red':''}">${pct(x.fc)}</span>`},{key:'pr',label:'Валовая прибыль, сом',type:'money',num:1,total:1,w:160,val:x=>x.pr}],
    rows:()=>rows,rid:x=>x.id,title:'item',group:['item'],sort:{key:'date',dir:1},rowClass:x=>x.fc>norm?'warn':'',noun:['строка','строки','строк'],xlsName:'Себестоимость и фудкост',empty:{icon:'coins',title:'За период продаж нет'}})}

/* Движение продуктов: остаток на начало, приход, расход на производство, списания, инвентаризация, остаток на конец */
function rpMoves(body){const[f,t]=rpRange();const mv=stockMoves().filter(x=>x.date>=f&&x.date<=t);const b0=balOn(addDays(f,-1)),b1=balOn(t);const mon=can('skPrices');
  const rows=PRODS.map(p=>{const ms=mv.filter(x=>x.p===p.id);const s=k=>ms.filter(x=>x.kind===k).reduce((a,x)=>a+x.q,0);const r3=v=>Math.round(v*1000)/1000;
    return {id:p.id,name:p.name,cat:p.cat,unit:p.unit,open:r3(b0[p.id]||0),in:r3(s('in')),prod:r3(-s('prod')),wo:r3(-s('wo')),inv:r3(s('inv')),close:r3(b1[p.id]||0)}}).filter(x=>x.open||x.in||x.prod||x.wo||x.inv||x.close);
  body.innerHTML=rpBar('moves')+`<div class="plates">${plate({id:'i',icon:'download',color:'green',label:'Приходов',value:new Set(mv.filter(x=>x.kind==='in').map(x=>x.doc)).size})}${plate({id:'p',icon:'archive',color:'blue',label:'Списаний на производство',value:new Set(mv.filter(x=>x.kind==='prod').map(x=>x.doc)).size})}
    ${mon?plate({id:'s',icon:'coins',color:'purple',label:'Приход на сумму',value:fmtM(mv.filter(x=>x.kind==='in').reduce((a,x)=>a+x.q*x.price,0),false),unit:'сом'}):''}</div><div id="rpg"></div>`;bindRpBar(body);
  const nc=(key,label)=>({key,label,type:'num',num:1,w:120,val:x=>x[key]||null,html:x=>x[key]?fmtN(x[key]):''});
  rpGrid(body,{id:'rp-moves',cols:[{key:'name',label:'Продукт',type:'text',w:200,val:x=>x.name},{key:'cat',label:'Категория',type:'enum',w:170,val:x=>dictName('prodCat',x.cat)},{key:'unit',label:'Ед.',type:'enum',w:70,val:x=>x.unit},
    {...nc('open','На начало')},{...nc('in','Приход')},{...nc('prod','Расход на производство')},{...nc('wo','Списано')},{...nc('inv','Инвентаризация ±')},{...nc('close','На конец'),html:x=>`<b class="${x.close<0?'red':''}">${fmtN(x.close)}</b>`},
    mon&&{key:'sum',label:'На конец, сом',type:'money',num:1,total:1,w:130,val:x=>Math.round(Math.max(0,x.close)*avgPrice(x.id)*100)/100}].filter(Boolean),
    rows:()=>rows,title:'name',group:['cat'],sort:{key:'name',dir:1},noun:['продукт','продукта','продуктов'],xlsName:'Движение продуктов',open:x=>openProd(PRM[x.id]),empty:{icon:'archive',title:'Движения за период нет'}})}

/* Потери: ручные списания по причинам, недостача по инвентаризации, порции, отменённые после запуска плана */
function rpLoss(body){const r=rpRange();const rows=[];const mon=can('skPrices')||can('dsCost');
  WOS.filter(w=>w.status==='Проведён'&&!w.auto&&inRange(w.date,r)).forEach(w=>w.lines.forEach((l,i)=>rows.push({id:w.id+':'+i,date:w.date,kind:'Списание',reason:odName('wo',w.reason),item:prodName(l.p),qty:+l.qty,unit:prodUnit(l.p),sum:l.qty*avgPrice(l.p),doc:w.no,open:()=>openWo(w)})));
  INVS.filter(v=>v.status==='Проведена'&&inRange(v.date,r)).forEach(v=>v.lines.filter(l=>(l.diff||0)<0).forEach((l,i)=>rows.push({id:v.id+':'+i,date:v.date,kind:'Недостача',reason:'Инвентаризация',item:prodName(l.p),qty:-l.diff,unit:prodUnit(l.p),sum:-l.diff*avgPrice(l.p),doc:v.no,open:()=>openInv(v)})));
  ORDERS.filter(o=>o.cancelAfterStart&&o.status==='Отменён'&&inRange(o.date,r)).forEach(o=>{const mn=menuOf(o.date,o.shift);const ds={};o.lines.forEach(l=>Object.entries(expandLine(l,mn)).forEach(([d,q])=>ds[d]=(ds[d]||0)+q));
    Object.entries(ds).forEach(([d,q])=>rows.push({id:o.id+':'+d,date:o.date,kind:'Отменено после запуска',reason:(stSince(o)||{}).note||'',item:(DSM[d]||{}).name||'',qty:q,unit:'порц.',sum:DSM[d]&&feat('stock')?q*dishCost(DSM[d],o.date):0,doc:o.no,open:()=>openOrder(o)}))});
  rows.forEach(x=>x.sum=Math.round(x.sum*100)/100);const S0=rows.reduce((a,x)=>a+x.sum,0);const k=t=>rows.filter(x=>x.kind===t);
  body.innerHTML=rpBar('loss')+`<div class="plates">${mon?plate({id:'s',icon:'trash',color:S0?'red':'green',label:'Потери',value:fmtM(S0,false),unit:'сом'}):''}${plate({id:'w',icon:'trash',color:'orange',label:'Списания',value:k('Списание').length,sub:'строк'})}${plate({id:'i',icon:'list',color:'purple',label:'Недостача',value:k('Недостача').length,sub:'продуктов'})}
    ${plate({id:'c',icon:'ban',color:'gray',label:'Отменено после запуска',value:k('Отменено после запуска').reduce((a,x)=>a+x.qty,0),unit:'порц.'})}</div><div id="rpg"></div>`;bindRpBar(body);
  rpGrid(body,{id:'rp-loss',cols:[{key:'date',label:'Дата',type:'date',w:110,val:x=>x.date},{key:'kind',label:'Вид потерь',type:'enum',w:190,val:x=>x.kind},{key:'reason',label:'Причина',type:'enum',w:190,val:x=>x.reason},{key:'item',label:'Продукт или блюдо',type:'text',w:200,val:x=>x.item},
    {key:'qty',label:'Количество',type:'num',num:1,w:110,val:x=>Math.round(x.qty*1000)/1000},{key:'unit',label:'Ед.',type:'enum',w:70,val:x=>x.unit},mon&&{key:'sum',label:'Сумма, сом',type:'money',num:1,total:1,w:130,val:x=>x.sum},{key:'doc',label:'Документ',type:'text',w:110,val:x=>x.doc,cls:'mono'}].filter(Boolean),
    rows:()=>rows,rid:x=>x.id,title:'item',group:['kind'],sort:{key:'date',dir:1},noun:['строка','строки','строк'],xlsName:'Потери',open:x=>x.open(),empty:{icon:'check',title:'Потерь за период нет'}})}

/* Долги на дату: по заказчикам с разбивкой по сроку долга (до 7, 8–30, больше 30 дней) */
function agingOn(cid,D){const c=CUM[cid]||{};const ns=NAKLS.filter(n=>n.cust===cid&&n.status==='Действует'&&n.date<=D).sort((a,b)=>a.date<b.date?-1:1);let pool=PAYS.filter(p=>p.cust===cid&&p.status==='Проведена'&&p.date<=D).reduce((a,p)=>a+p.sum,0);const r={debt:0,b7:0,b30:0,b31:0,over:0,adv:0};
  ns.forEach(n=>{const k=Math.min(pool,n.sum);pool-=k;const left=n.sum-k;if(left<=0.009)return;const age=Math.round((stAt(D)-stAt(n.date))/864e5);r.debt+=left;if(age<=7)r.b7+=left;else if(age<=30)r.b30+=left;else r.b31+=left;if(addDays(n.date,c.delay||0)<D)r.over+=left});
  r.adv=pool>0.009?pool:0;Object.keys(r).forEach(k=>r[k]=Math.round(r[k]*100)/100);return r}
function rpDebts(body){const D=S.rpd||TODAY;const rows=visCusts(true).map(c=>({c,...agingOn(c.id,D)})).filter(x=>x.debt>0||x.adv>0);const sum=k=>rows.reduce((a,x)=>a+x[k],0);
  body.innerHTML=rpBar('debts')+`<div class="plates">${plate({id:'d',icon:'wallet',color:'purple',label:'Долг на '+fmtD(D),value:fmtM(sum('debt'),false),unit:'сом'})}${plate({id:'o',icon:'clock',color:sum('over')?'red':'green',label:'Просрочено',value:fmtM(sum('over'),false),unit:'сом'})}${plate({id:'b',icon:'alert',color:sum('b31')?'red':'green',label:'Больше 30 дней',value:fmtM(sum('b31'),false),unit:'сом'})}</div><div id="rpg"></div>`;bindRpBar(body);
  const mc=(key,label)=>({key,label,type:'money',num:1,total:1,w:130,val:x=>x[key]||null});
  rpGrid(body,{id:'rp-debts',cols:[{key:'cust',label:'Заказчик',type:'text',w:220,val:x=>x.c.name},mc('debt','Долг, сом'),mc('b7','До 7 дней, сом'),mc('b30','8–30 дней, сом'),{...mc('b31','Больше 30 дней, сом'),html:x=>x.b31?`<b class="red">${fmtM(x.b31)}</b>`:''},mc('over','Просрочено, сом'),mc('adv','Аванс, сом'),
    {key:'resp',label:'Ответственный',type:'enum',w:150,val:x=>empName(x.c.resp)},{key:'delay',label:'Отсрочка, дней',type:'int',num:1,w:120,hide:1,val:x=>x.c.delay||0}],
    rows:()=>rows,rid:x=>x.c.id,title:'cust',sort:{key:'debt',dir:-1},noun:['заказчик','заказчика','заказчиков'],xlsName:'Долги на дату',open:x=>can('cuView')?openCust(x.c):actDlg(x.c.id),empty:{icon:'check',title:'На эту дату долгов нет'}})}

/* Доставка: вовремя / с опозданием / не доставлено — по курьерам; опоздание считается от конца окна доставки */
const winEnd=w=>{const m=String(w||'').match(/(\d{1,2}:\d{2})\s*$/);return m?m[1].padStart(5,'0'):''};
function rpDlv(body){const r=rpRange();const rows=ORDERS.filter(o=>!o.pickup&&inRange(o.date,r)&&['Доставлен','Не доставлен'].includes(o.status)).map(o=>{const t=TRM[o.trip];const w=o.time||pointOf(o).win||'';
    const at=o.status==='Доставлен'?(o.deliv?o.deliv.at:(stSince(o)||{}).at):'';const end=winEnd(w);const late=at&&end?Math.round((stAt(at)-stAt(o.date+' '+end))/6e4):0;
    return {id:o.id,courier:t?empName(t.courier):'Без рейса',date:o.date,no:o.no,cust:o.cust,point:ordPointName(o),win:w,at,res:o.status==='Не доставлен'?'Не доставлено':late>0?'С опозданием':'Вовремя',late:late>0?late:null,o}});
  const n=rows.length,c=k=>rows.filter(x=>x.res===k).length;const RC={'Вовремя':['green','check'],'С опозданием':['orange','clock'],'Не доставлено':['red','alert']};
  body.innerHTML=rpBar('dlv',rpGroupSeg('rp-dlv',[['courier','По курьерам'],['date','По дням'],['res','По результату']],'courier'))+`<div class="plates">${plate({id:'ok',icon:'check',color:'green',label:'Вовремя',value:c('Вовремя'),sub:n?Math.round(c('Вовремя')/n*100)+' %':''})}${plate({id:'late',icon:'clock',color:c('С опозданием')?'orange':'green',label:'С опозданием',value:c('С опозданием'),sub:n?Math.round(c('С опозданием')/n*100)+' %':''})}${plate({id:'nd',icon:'alert',color:c('Не доставлено')?'red':'green',label:'Не доставлено',value:c('Не доставлено')})}</div><div id="rpg"></div>`;
  bindRpBar(body);bindRpGroup(body,'rp-dlv');
  body.querySelector('.plates').onclick=e=>{const b=e.target.closest('[data-plate]');if(!b||!GS['rp-dlv'])return;const s=GS['rp-dlv'];const v={ok:'Вовремя',late:'С опозданием',nd:'Не доставлено'}[b.dataset.plate];s.filters=s.filters.res&&s.filters.res.vals[0]===v?{}:{res:{type:'enum',vals:[v]}};s.page=0;renderPage()};
  rpGrid(body,{id:'rp-dlv',cols:[{key:'courier',label:'Курьер',type:'enum',w:160,val:x=>x.courier},{key:'date',label:'Дата',type:'date',w:110,val:x=>x.date},{key:'no',label:'Заказ',type:'text',w:110,val:x=>x.no,cls:'mono'},{key:'cust',label:'Заказчик',type:'enum',w:200,val:x=>custName(x.cust)},
    {key:'point',label:'Точка',type:'enum',w:150,val:x=>x.point},{key:'win',label:'Окно',type:'text',w:120,val:x=>x.win},{key:'at',label:'Доставлено',type:'datetime',w:140,val:x=>x.at||null},{key:'late',label:'Опоздание, мин',type:'int',num:1,w:120,val:x=>x.late},
    {key:'res',label:'Результат',type:'enum',w:150,val:x=>x.res,html:x=>pill(x.res,RC,'sm')}],
    rows:()=>rows,rid:x=>x.id,title:'no',group:['courier'],sort:{key:'date',dir:1},noun:['заказ','заказа','заказов'],xlsName:'Доставка',open:x=>openOrder(x.o),rowClass:x=>x.res==='Не доставлено'?'warn':'',empty:{icon:'truck',title:'За период доставок нет'}})}
