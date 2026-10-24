'use strict';
// Общие расчёты предметной области: справочники, области видимости, заказчики (юрлица и физлица), телефон, адреса и места доставки, цены, техкарты и себестоимость, остатки склада, долги, оплата заказа, печать, фото, строки документов
/* ═════════════ Справочники ═════════════ */
// Значения справочника платформы для выбора: только включённые; уже выбранное отключённое значение остаётся в записи как есть
const dictOpts=(id,cur)=>DICT[id].items.filter(x=>x.active!==false||x.code===cur).sort((a,b)=>a.order-b.order).map(x=>[x.code,x.name+(x.active===false?' (отключено)':'')]);
const dictName=(id,code)=>{const x=DICT[id]&&DICT[id].items.find(i=>i.code===code);return x?x.name:''};
// Справочники организации (смены, транспорт, районы, причины): ведёт организация (ТЗ модуль «Справочники»)
const odOpts=(id,cur)=>(ODICT[id]?ODICT[id].items:[]).filter(x=>x.active!==false||x.code===cur).sort((a,b)=>a.order-b.order).map(x=>[x.code,x.name+(x.active===false?' (отключено)':'')]);
const odName=(id,code)=>{const x=ODICT[id]&&ODICT[id].items.find(i=>i.code===code);return x?x.name:''};
const shiftName=c=>odName('shift',c)||'Обед';
const defShift=()=>(odOpts('shift')[0]||['СМ-001'])[0];
const empOpts=f=>EMP.filter(e=>e.active!==false&&e.role!=='customer'&&e.status!=='Приглашён'&&(!f||f(e))).map(e=>[e.id,`${e.short} · ${roleName(e.role)}`]);
// Кто с правом (по роли): для подсказок «кто может» и выбора курьеров и поваров
const roleCan=(e,p)=>{if(e.role==='owner')return true;const r=ROLES.find(x=>x.id===e.role);return !!(r&&r.perms.includes(p))};
const couriers=()=>EMP.filter(e=>e.active!==false&&e.status==='Активен'&&e.role!=='owner'&&roleCan(e,'dlRoute'));
const cooks=()=>EMP.filter(e=>e.active!==false&&e.status==='Активен'&&e.role!=='owner'&&(roleCan(e,'ktWork')));

/* ═════════════ Числа, даты ═════════════ */
const num=v=>{const x=+String(v??'').replace(/\s/g,'').replace(',','.');return isNaN(x)?NaN:x};
const fmtN=(n,dec=3)=>{if(n==null||n===''||isNaN(n))return '';const r=Math.round(n*10**dec)/10**dec;const[i,f]=Math.abs(r).toFixed(dec).replace(/0+$/,'').replace(/\.$/,'').split('.');return (r<0?'−':'')+i.replace(/\B(?=(\d{3})+(?!\d))/g,' ')+(f?','+f:'')};
const fmtQ=(n,u)=>fmtN(n,u==='шт'||u==='порция'?0:3)+(u?' '+u:'');
const DOW=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const dowOf=iso=>new Date(iso+'T00:00:00Z').getUTCDay();
const dayLbl=iso=>`${DOW[dowOf(iso)]}, ${fmtD(iso)}`;
const weekStart=iso=>{const w=dowOf(iso);return addDays(iso,w===0?-6:1-w)};
const TOMORROW=()=>addDays(TODAY,1);
const relDay=iso=>iso===TODAY?'сегодня':iso===TOMORROW()?'завтра':iso===addDays(TODAY,-1)?'вчера':'';
// Запоминание расчёта до следующего изменения данных (REV растёт в log() и reindex())
function memo(fn){let rev=-1,v;return(...a)=>{if(a.length)return fn(...a);if(rev!==REV){v=fn();rev=REV}return v}}

/* ═════════════ Области видимости «Свои / Все» ═════════════ */
const visCusts=all=>{const a=seeAll('customers');return CUSTS.filter(c=>(all||c.status!=='В архиве')&&(a||c.resp===S.me))};
const visOrders=()=>{if(isCust())return ORDERS.filter(o=>o.cust===me().cust);const a=seeAll('orders');return ORDERS.filter(o=>a||o.resp===S.me||(o.trip&&TRM[o.trip]&&TRM[o.trip].courier===S.me))};
const visTrips=()=>{const a=seeAll('delivery');return TRIPS.filter(t=>a||t.courier===S.me)};
const canPrice=()=>isCust()||can('ordPrices');
const canCost=()=>can('dsCost');

/* ═════════════ Блюда и техкарты ═════════════ */
const dishOf=id=>DSM[id];
const catName=d=>dictName('dishCat',d.cat);
const isSemi=d=>!!d.semi;
// Версия техкарты, действующая на дату: изменение техкарты создаёт новую версию «с даты», утверждённые планы считаются по своей
// at — момент утверждения плана: версия, созданная позже, на этот план не влияет
const dishVer=(d,date,at)=>{const vs=(d.versions||[]).slice().sort((a,b)=>a.from<b.from?-1:1);const ok=vs.filter(v=>(!date||v.from<=date)&&(!at||!v.at||v.at<=at));return ok.length?ok[ok.length-1]:vs[0]||null};
// Потребность в продуктах на qty порций, в единице учёта продукта; полуфабрикат раскрывается по своей техкарте
function dishNeeds(d,qty,date,acc={},at){const v=d&&dishVer(d,date,at);if(!v)return acc;
  v.lines.forEach(l=>{if(l.d){const s=DSM[l.d];if(s)dishNeeds(s,qty*l.b/(s.out||1),date,acc,at);return}const p=PRM[l.p];if(!p)return;acc[l.p]=(acc[l.p]||0)+l.b*qty/(p.unit==='шт'?1:1000)});return acc}
const dishCost=(d,date,at)=>Object.entries(dishNeeds(d,1,date,{},at)).reduce((a,[p,q])=>a+q*avgPrice(p),0);
const foodcost=(d,date)=>d.price?dishCost(d,date)/d.price*100:null;
const markup=(d,date)=>{const c=dishCost(d,date);return c?(d.price-c)/c*100:null};
// КБЖУ на порцию по нетто и пищевой ценности продуктов на 100 г; штучный продукт считается как 50 г
function dishKbju(d,date){const v=d&&dishVer(d,date);if(!v)return null;let k=[0,0,0,0],any=false;
  v.lines.forEach(l=>{if(l.d){const s=DSM[l.d];const x=s&&dishKbju(s,date);if(x){any=true;const r=l.n/(s.out||1);k=k.map((a,i)=>a+x[i]*r)}return}const p=PRM[l.p];if(!p||!p.kbju)return;any=true;const g=p.unit==='шт'?l.n*50:l.n;k=k.map((a,i)=>a+p.kbju[i]*g/100)});
  return any?k.map(x=>Math.round(x)):null}
const kbjuTxt=k=>k?`${k[0]} ккал · Б ${k[1]} · Ж ${k[2]} · У ${k[3]}`:'—';
const allergTxt=a=>(a||[]).map(c=>dictName('allergen',c)).filter(Boolean).join(', ');
// Сколько порций блюда продано по доставленным и готовящимся заказам (вкладка «Продажи»)
const dishSales=memo(()=>{const m={};ORDERS.filter(o=>o.status!=='Отменён').forEach(o=>{const mn=menuOf(o.date,o.shift);o.lines.forEach(l=>Object.entries(expandLine(l,mn)).forEach(([id,q])=>{m[id]=m[id]||{};m[id][o.date]=(m[id][o.date]||0)+q}))});return m});

/* ═════════════ Меню и заказы ═════════════ */
const menuOf=(date,shift)=>MENUS.find(m=>m.date===date&&m.shift===(shift||defShift()));
const menuItem=(m,kind,id)=>m&&m.items.find(i=>i.kind===kind&&i.id===id);
const itemName=(kind,id)=>kind==='c'?(CBM[id]||{}).name||'Комплекс':(DSM[id]||{}).name||'Блюдо';
const lineName=l=>itemName(l.kind,l.id);
// Комплекс раскрывается в блюда по меню дня: слот с конкретным блюдом — это блюдо, «по меню дня» — блюдо, выбранное в меню на дату
function expandLine(l,m){if(l.kind==='d')return {[l.id]:l.qty};const it=menuItem(m,'c',l.id);const c=CBM[l.id];const out={};
  (c?c.slots:[]).forEach(s=>{const d=s.dish||(it&&it.fill&&it.fill[s.slot]);if(d)out[d]=(out[d]||0)+l.qty});return out}
const ordSum=o=>Math.round(o.lines.reduce((a,l)=>a+l.qty*l.price,0)*100)/100;
const ordPortions=o=>o.lines.reduce((a,l)=>a+(+l.qty||0),0);
const ordFull=o=>{const m=menuOf(o.date,o.shift);return o.lines.reduce((a,l)=>{const it=menuItem(m,l.kind,l.id);return a+l.qty*(it?it.price:l.price)},0)};
const ordComp=o=>o.lines.map(l=>`${lineName(l)} × ${l.qty}`).join(', ');
const ordDone=o=>['Доставлен','Отменён'].includes(o.status);
const ordActive=o=>o.status!=='Отменён';
// Цена для заказчика: индивидуальная по прайсу, иначе цена меню со скидкой заказчика
function priceFor(c,kind,id,mp){if(c&&c.price==='ind'&&c.prices&&c.prices[id]!=null)return c.prices[id];return Math.round(mp*(100-((c&&c.disc)||0)))/100}
// Время закрытия приёма заказов на дату: накануне в «Время закрытия приёма» учётной политики
const cutoffAt=date=>addDays(date,-1)+' '+(ORG.policy.cutoff||'16:00');
// Меню, открытое заново откатом из «Приём закрыт», принимает заказы и после времени закрытия
const isClosed=(date,shift)=>{const m=menuOf(date,shift);if(date<TODAY)return true;if(m&&m.reopen)return m.status==='Приём закрыт';return nowStamp()>=cutoffAt(date)||!!(m&&m.status==='Приём закрыт')};
const custName=id=>(CUM[id]||{}).name||'—';
// Адрес доставки заказа: точка юрлица или сохранённый адрес физлица; адрес «только для этого заказа» хранится в самом заказе (o.addr)
const pointOf=o=>{if(o.pickup)return {name:'Самовывоз',addr:ORG.address,win:o.time||'',geo:ORG.geo};if(o.addr)return o.addr;const c=CUM[o.cust];return (c&&c.points.find(p=>p.id===o.point))||{name:'—',addr:''}};
const ordPointName=o=>o.pickup?'Самовывоз':pointOf(o).name;

/* ═════════════ Заказчики: юрлица и физлица, телефон, адреса и места доставки ═════════════ */
const isPerson=c=>!!c&&c.kind==='person';
const kindName=c=>isPerson(c)?'Физлицо':'Юрлицо';
// Телефон вводится в любом виде (0555 123 456, 555123456, +996 555 123 456) и хранится как +996 555 123 456; не 9 цифр после кода — пусто
function phoneNorm(v){let d=String(v||'').replace(/\D/g,'');if(d.length===12&&d.startsWith('996'))d=d.slice(3);else if(d.length===10&&d.startsWith('0'))d=d.slice(1);return d.length===9?`+996 ${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`:''}
const phoneDigits=v=>String(v||'').replace(/\D/g,'');
// Один номер — один клиент-физлицо (в том числе в архиве)
const phoneTaken=(ph,except)=>{const n=phoneNorm(ph);return n?CUSTS.find(c=>c!==except&&isPerson(c)&&phoneNorm(c.phone)===n):null};
// Поиск клиента для быстрого заказа: по последним цифрам номера (от 3 цифр) и по имени; архив не ищется
function custFind(q){const t=norm(q).trim();if(!t)return [];let dg=phoneDigits(q);if(dg.length===10&&dg[0]==='0')dg=dg.slice(1);const digits=/^[\d\s()+-]+$/.test(q.trim());
  return visCusts().filter(c=>digits?dg.length>=3&&phoneDigits(c.phone).includes(dg):norm(c.name).includes(t)).sort((a,b)=>((custStats()[b.id]||{}).lastAt||'').localeCompare((custStats()[a.id]||{}).lastAt||'')||COLL.compare(a.name,b.name)).slice(0,8)}
// Заказов, сумма, последний заказ и последний адрес — по активным заказам
const custStats=memo(()=>{const m={};ORDERS.forEach(o=>{if(!ordActive(o))return;const s=m[o.cust]=m[o.cust]||{n:0,sum:0,last:'',lastAt:'',pt:null,used:{}};s.n++;s.sum+=ordSum(o);
  if(o.point)s.used[o.point]=o._ca>(s.used[o.point]||'')?o._ca:s.used[o.point];if(o._ca>s.lastAt){s.lastAt=o._ca;s.last=o.date;s.pt=o.pickup?null:pointOf(o)}});return m});
// Сохранённые адреса: последний использованный — первым
const custPoints=c=>{const u=(custStats()[c.id]||{}).used||{};return c.points.slice().sort((a,b)=>(u[b.id]||'').localeCompare(u[a.id]||''))};
const lastAddr=c=>{const s=custStats()[c.id];const p=s&&s.pt||custPoints(c)[0];return p?p.addr+(p.mark?', '+p.mark:''):''};
// Места доставки (справочник организации): адрес, район и геоточка; адрес, привязанный к месту, берёт геоточку места
const places=()=>ODICT.place?ODICT.place.items:[];
const placeOf=code=>code?places().find(x=>x.code===code):null;
const hasGeo=g=>Array.isArray(g)&&g.length===2&&isFinite(g[0])&&isFinite(g[1]);
const ptGeo=pt=>{const pl=pt&&placeOf(pt.place);return pl&&hasGeo(pl.geo)?pl.geo:pt&&hasGeo(pt.geo)?pt.geo:null};
// Группа точки на карте, в распределении и в требовании: место — одна группа, остальные адреса по одному
const ptKey=o=>{if(o.pickup)return 'pickup';const pt=pointOf(o);return pt.place&&placeOf(pt.place)?'pl:'+pt.place:o.addr?'ad:'+o.id:'pt:'+o.cust+':'+o.point};
const ptLabel=o=>{if(o.pickup)return 'Самовывоз';const pt=pointOf(o);const pl=placeOf(pt.place);if(pl)return pl.name;const c=CUM[o.cust];return isPerson(c)?pt.addr||pt.name:custName(o.cust)+' · '+pt.name};
// Центр района — по геоточкам уже известных адресов и мест района: для примерной геоточки и начального вида карты
function distGeo(code){const gs=[];if(code){CUSTS.forEach(c=>c.points.forEach(p=>{if(p.district===code&&hasGeo(p.geo)&&!p.approx)gs.push(p.geo)}));places().forEach(p=>{if(p.district===code&&hasGeo(p.geo))gs.push(p.geo)})}
  if(!gs.length)return hasGeo(ORG.geo)?ORG.geo:null;const avg=k=>Math.round(gs.reduce((a,g)=>a+g[k],0)/gs.length*1e4)/1e4;return [avg(0),avg(1)]}
// Примерная геоточка (пунктирный маркер): в продукте её ставит геокодер по адресу, в макете — центр района со сдвигом по тексту адреса
function autoGeo(p){if(ptGeo(p)||!p.district)return p;const g=distGeo(p.district);if(!g)return p;let h=0;for(const ch of String(p.addr||''))h=(h*31+ch.charCodeAt(0))%1600;
  p.geo=[Math.round((g[0]+(h%40-20)/4000)*1e4)/1e4,Math.round((g[1]+(Math.floor(h/40)-20)/3000)*1e4)/1e4];p.approx=true;return p}

/* ═════════════ Склад: движение, остатки, средняя цена ═════════════ */
// Движение продуктов собирается из проведённых документов: приход +, списание −, инвентаризация ± разница
const stockMoves=memo(()=>{const mv=[];
  RECEIPTS.filter(r=>r.status==='Проведён').forEach(r=>r.lines.forEach(l=>mv.push({date:r.date,p:l.p,q:+l.qty,price:+l.price,kind:'in',doc:r.no,ref:r})));
  WOS.filter(w=>w.status==='Проведён').forEach(w=>w.lines.forEach(l=>mv.push({date:w.date,p:l.p,q:-l.qty,kind:w.auto?'prod':'wo',reason:w.reason,doc:w.no,ref:w})));
  INVS.filter(v=>v.status==='Проведена').forEach(v=>v.lines.forEach(l=>{const dlt=l.diff!=null?l.diff:(l.fact-l.acc);if(dlt)mv.push({date:v.date,p:l.p,q:dlt,kind:'inv',doc:v.no,ref:v})}));return mv});
const balances=memo(()=>{const b={};PRODS.forEach(p=>b[p.id]=0);stockMoves().forEach(m=>b[m.p]=(b[m.p]||0)+m.q);return b});
const balOn=date=>{const b={};stockMoves().filter(m=>m.date<=date).forEach(m=>b[m.p]=(b[m.p]||0)+m.q);return b};
const prices=memo(()=>{const s={};stockMoves().filter(m=>m.kind==='in').forEach(m=>{s[m.p]=s[m.p]||[0,0];s[m.p][0]+=m.q*m.price;s[m.p][1]+=m.q});return Object.fromEntries(Object.entries(s).map(([k,[a,b]])=>[k,b?a/b:0]))});
// Средняя цена: по средней скользящей — в макете как средневзвешенная по всем проведённым приходам
const avgPrice=p=>prices()[p]||0;
const prodName=id=>(PRM[id]||{}).name||'—';
const prodUnit=id=>(PRM[id]||{}).unit||'';
// Ближайший срок годности по партиям с остатком (партии списываются по порядку прихода)
const expiryOf=memo(()=>{const out={};const b=balances();PRODS.forEach(p=>{let left=b[p.id]||0;const lots=[];RECEIPTS.filter(r=>r.status==='Проведён').forEach(r=>r.lines.filter(l=>l.p===p.id&&l.exp).forEach(l=>lots.push({exp:l.exp,q:+l.qty,date:r.date})));
  lots.sort((a,c)=>a.date<c.date?1:-1);const live=[];for(const l of lots){if(left<=0)break;live.push(l);left-=l.q}out[p.id]=live.length?live.map(l=>l.exp).sort()[0]:''});return out});
const lowStock=()=>PRODS.filter(p=>p.min&&(balances()[p.id]||0)<p.min);
const expSoon=()=>PRODS.filter(p=>{const e=expiryOf()[p.id];return e&&e<=addDays(TODAY,2)&&(balances()[p.id]||0)>0});

/* ═════════════ Деньги: начисления, оплаты, долг, просрочка ═════════════ */
// Долг = действующие накладные − проведённые оплаты. Оплата по заказу сначала закрывает накладную этого заказа (до доставки ждёт её как аванс), оплата по счёту — накладные этого счёта,
// остаток и оплаты без счёта и заказа — самые старые накладные (FIFO); переплата и оплата отменённого заказа остаются авансом
function ledger(cid){const c=CUM[cid]||{};const ns=NAKLS.filter(n=>n.cust===cid&&n.status==='Действует').sort((a,b)=>a.date<b.date?-1:1);const ps=PAYS.filter(p=>p.cust===cid&&p.status==='Проведена').sort((a,b)=>a.date<b.date?-1:1);
  const charged=ns.reduce((a,n)=>a+n.sum,0),paid=ps.reduce((a,p)=>a+p.sum,0);const lf=Object.fromEntries(ns.map(n=>[n.id,n.sum]));let pool=0,hold=0,overdue=0,days=0;const open=[];const byOrd=Object.fromEntries(ns.filter(n=>n.order).map(n=>[n.order,n]));
  ps.forEach(p=>{let r=p.sum;if(p.order){const n=byOrd[p.order];const o=ORM[p.order];if(n){const k=Math.min(r,lf[n.id]);lf[n.id]-=k;r-=k}else if(o&&o.status!=='Отменён'){hold+=r;r=0}}
    const b=p.bill&&BILLS.find(x=>x.id===p.bill);if(b)b.nakls.forEach(id=>{if(r<=0||lf[id]==null)return;const k=Math.min(r,lf[id]);lf[id]-=k;r-=k});pool+=r});
  ns.forEach(n=>{const k=Math.min(pool,lf[n.id]);lf[n.id]=Math.round((lf[n.id]-k)*100)/100;pool-=k;const left=lf[n.id];if(left>0.009){open.push({n,left});const due=addDays(n.date,c.delay||0);if(due<TODAY){overdue+=left;days=Math.max(days,Math.round((stAt(TODAY)-stAt(due))/864e5))}}});
  const last=ps[ps.length-1];
  return {charged,paid,debt:Math.round((charged-paid)*100)/100,overdue:Math.round(overdue*100)/100,days,last:last?last.date:'',open,lf,advance:pool+hold>0.009?Math.round((pool+hold)*100)/100:0}}
const ledgers=memo(()=>Object.fromEntries(CUSTS.map(c=>[c.id,ledger(c.id)])));
const debtOf=cid=>(ledgers()[cid]||{debt:0}).debt;
const limitOver=(c,add=0)=>c&&c.limit!=null&&c.limit!==''&&debtOf(c.id)+add>+c.limit;
// Сальдо на дату для акта сверки
function saldoOn(cid,date){const ch=NAKLS.filter(n=>n.cust===cid&&n.status==='Действует'&&n.date<date).reduce((a,n)=>a+n.sum,0);const pd=PAYS.filter(p=>p.cust===cid&&p.status==='Проведена'&&p.date<date).reduce((a,p)=>a+p.sum,0);return ch-pd}
// «Оплата» заказа считается сама: по оплатам, привязанным к заказу, а после доставки — по закрытию его накладной
const ordPays=o=>PAYS.filter(p=>p.order===o.id&&p.status==='Проведена');
// Оплачено заранее (при быстром заказе, в карточке заказа) — без наличных, полученных курьером при доставке
const ordPrepaid=o=>Math.round(ordPays(o).filter(p=>!p.cour).reduce((a,p)=>a+p.sum,0)*100)/100;
function ordPaid(o){const n=o.nakl&&NAKLS.find(x=>x.id===o.nakl&&x.status==='Действует');if(n){const L=ledgers()[o.cust];const left=L&&L.lf[n.id]!=null?L.lf[n.id]:n.sum;return Math.round((n.sum-left)*100)/100}return Math.min(ordSum(o),Math.round(ordPays(o).reduce((a,p)=>a+p.sum,0)*100)/100)}
const ordLeft=o=>Math.max(0,Math.round((ordSum(o)-ordPaid(o))*100)/100);
function payStatus(o){if(o.status==='Отменён'||ordSum(o)<=0)return '';const p=ordPaid(o);if(p>=ordSum(o)-0.009)return 'Оплачен';if(p>0.009)return 'Частично';const c=CUM[o.cust];return c&&!isPerson(c)&&o.pay==='СО-001'?'По счёту':'Не оплачен'}
const PAY_C={'Оплачен':['green','check'],'Частично':['yellow','half'],'Не оплачен':['blue','wallet'],'По счёту':['purple','file']};
// «Не оплачен» после «Доставлен» — красная отметка: это долг заказчика
const payPill=(o,x='sm')=>{const s=payStatus(o);return s?pill(s,s==='Не оплачен'&&o.status==='Доставлен'?{[s]:['red','alert']}:PAY_C,x):''};
// Заказы на сегодня и вперёд, которые ждут оплаты (кроме «По счёту»)
const unpaidOrders=()=>visOrders().filter(o=>o.date>=TODAY&&ordActive(o)&&['Не оплачен','Частично'].includes(payStatus(o)));
const supDebt=sid=>{const rs=RECEIPTS.filter(r=>r.sup===sid&&r.status==='Проведён'&&r.pay==='debt');const s=rs.reduce((a,r)=>a+r.lines.reduce((x,l)=>x+l.qty*l.price,0),0);return Math.round((s-SUPPAYS.filter(p=>p.sup===sid).reduce((a,p)=>a+p.sum,0))*100)/100};
const docSum=d=>Math.round(d.lines.reduce((a,l)=>a+(+l.qty||0)*(+l.price||0),0)*100)/100;

/* ═════════════ Печать и PDF: в макете — окно предпросмотра ═════════════ */
function printDlg(title,html,sub){openModal({size:'wide',render:()=>({title:esc(title),sub:sub||'Предпросмотр печати',body:`<div class="print-doc">${html}</div>`,
  foot:`<button class="btn ghost" data-close>Закрыть</button><div class="grow"></div><button class="btn cta" id="pr-go">${ic('file','sm')}Печать / PDF</button>`,
  mount(el){$('#pr-go',el).onclick=()=>toast('В макете печать и PDF показаны предпросмотром: в продукте откроется окно печати','file')}})})}
const docHead=(t,sub)=>`<div class="pd-h"><div><b>${esc(ORG.name)}</b><div class="faint">${esc(ORG.address||'')} · ИНН ${esc(ORG.inn||'—')}</div></div><div style="text-align:right"><b>${t}</b>${sub?`<div class="faint">${sub}</div>`:''}</div></div>`;

/* ═════════════ Фото: выбор с камеры или из галереи, уменьшается до 320 px ═════════════ */
const photoFld=(id,cur,req)=>`<div class="ph-in"><label class="btn" for="${id}">${ic('upload','sm')}Сделать или выбрать фото</label><input type="file" id="${id}" accept="image/*" capture="environment" hidden><span class="ph-prev" data-ph="${id}">${cur?`<img src="${cur}" alt="Фото">`:req?'<span class="faint">Фото обязательно</span>':'<span class="faint">Без фото</span>'}</span></div>`;
function bindPhoto(el,id,st){const f=$('#'+id,el);if(!f)return;f.onchange=()=>{const x=f.files[0];if(!x)return;const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,320/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  st[id]=c.toDataURL('image/jpeg',.7);$(`[data-ph="${id}"]`,el).innerHTML=`<img src="${st[id]}" alt="Фото">`};im.src=r.result};r.readAsDataURL(x)}}
// Демо: если фото нет под рукой, «Сделать фото» подставляет картинку-заглушку
const demoPhoto=t=>'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="110"><rect width="160" height="110" rx="10" fill="#d9c9b0"/><text x="80" y="60" font-size="13" text-anchor="middle" fill="#5a4630" font-family="sans-serif">${t||'Фото'}</text></svg>`);

/* ═════════════ Строки документа (продукты, позиции): одна таблица для приходов, списаний, техкарт, меню, заказов ═════════════ */
/* cols: [{key,label,type:'sel'|'num'|'date'|'text'|'ro', opts:()=>[[v,l]], w, ro:(row)=>html, req}]; rows — массив объектов (меняется на месте); cards — на телефоне строки плитками */
function linesHtml(id,rows,cols,{add='Добавить строку',ro=false,foot='',cards=false}={}){
  const cell=(c,r,i)=>{if(ro||c.type==='ro')return `<td class="${c.type==='num'||c.num?'num':''}">${c.ro?c.ro(r,i):esc(r[c.key]??'')}</td>`;const v=r[c.key]??'';
    if(c.type==='sel')return `<td>${sel(`${id}-${i}-${c.key}`,[['','—'],...c.opts(r)],v,`data-ln="${i}" data-k="${c.key}"`)}</td>`;
    const t=c.type==='date'?'type="date"':c.type==='num'?'inputmode="decimal"':'';
    return `<td class="${c.type==='num'?'num':''}"><input class="inp ${c.type==='num'?'tnum':''}" ${t} data-ln="${i}" data-k="${c.key}" value="${esc(c.type==='num'&&v!==''?String(v).replace('.',','):v)}"></td>`};
  return `<div class="tbl-wrap ln-wrap"><table class="mini ln${cards?' m-cards':''}" id="${id}"><thead><tr>${cols.map(c=>`<th class="${c.type==='num'||c.num?'num':''}" ${c.w?`style="width:${c.w}px"`:''}>${esc(c.label)}${c.req&&!ro?' <span class="red">*</span>':''}</th>`).join('')}${ro?'':'<th style="width:36px"></th>'}</tr></thead>
    <tbody>${rows.map((r,i)=>`<tr>${cols.map(c=>cell(c,r,i)).join('')}${ro?'':`<td><button type="button" class="icon-btn sm" data-ln-del="${i}" aria-label="Удалить строку">${ic('trash','sm')}</button></td>`}</tr>`).join('')||`<tr><td colspan="${cols.length+1}" class="muted">Строк пока нет</td></tr>`}</tbody>${foot}</table></div>${ro?'':`<button type="button" class="btn sm" data-ln-add="${id}">${ic('plus','sm')}${esc(add)}</button>`}`}
function bindLines(el,id,rows,cols,{blank,onChange,redraw}){
  $$(`#${id} [data-ln]`,el).forEach(x=>{const ev=x.tagName==='SELECT'?'change':'input';x.addEventListener(ev,()=>{const r=rows[+x.dataset.ln];const c=cols.find(q=>q.key===x.dataset.k);r[c.key]=c.type==='num'?(x.value.trim()===''?'':num(x.value)):x.value;onChange&&onChange(r,c.key,x)})});
  $$(`#${id} [data-ln-del]`,el).forEach(b=>b.onclick=()=>{rows.splice(+b.dataset.lnDel,1);redraw()});
  const a=$(`[data-ln-add="${id}"]`,el);if(a)a.onclick=()=>{rows.push(blank());redraw()}}
// Сегментный переключатель
const segHtml=(id,opts,cur)=>`<span class="seg" role="group" id="${id}">${opts.map(([v,l])=>`<button type="button" data-v="${esc(v)}" class="${String(v)===String(cur)?'on':''}">${esc(l)}</button>`).join('')}</span>`;
const bindSeg=(el,id,fn)=>$$(`#${id} [data-v]`,el).forEach(b=>b.onclick=()=>fn(b.dataset.v));
// Блок «История»: история статусов и история изменений записи (последняя вкладка любой карточки)
const histBlock=(k,ent,o)=>`${k?`<div class="box"><h3>История статусов</h3>${statusHistHtml(k,o)}</div>`:''}<div class="box"><h3>История изменений</h3>${histHtml(ent,o.id)}</div>`;
const kv=(k,v,full)=>`<div ${full?'style="grid-column:1/-1"':''}><span class="k">${k}</span><span class="v">${v===''||v==null?'—':v}</span></div>`;
// Последствия смены статуса для связанных записей — без отдельных уведомлений внизу экрана
const sysStatus=(k,o,to,note)=>setStatus(k,o,to,note,false,{who:'system',silent:true});
