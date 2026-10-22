'use strict';
// «Главная»: сводка «что требует внимания сегодня»; каждая плашка открывает нужный список с уже применённым фильтром
/* ═════════════ Главная ═════════════ */
function homeTabs(){return []}
function renderHome(body){
  if(!CLIENTS.length){body.innerHTML=`<div class="state">${ic('building','lg')}<b>Добавьте первого клиента</b><span>Сводка на сегодня появится, когда в организации будут клиенты и заявки.</span><button class="btn cta" data-goto="clients.all">${ic('plus')}Перейти к клиентам</button></div>`;
    body.onclick=e=>{const b=e.target.closest('[data-goto]');if(b){const[a,t]=b.dataset.goto.split('.');go(a,t)}};return}
  const rq=feat('requests')&&can('rqView')?visRequests():[];const cl=visClients();
  const over=rq.filter(rqOver),mine=rq.filter(r=>r.resp===S.me&&!rqDone(r)&&r.due<=TODAY),pend=rq.filter(r=>rqPend(r)&&r.resp!==S.me&&(r.by===S.me||can('rqConfirm'))),noResp=cl.filter(c=>!c.resp);
  const week=rq.filter(r=>!rqDone(r)&&r.due>TODAY&&r.due<=addDays(TODAY,7)).sort((a,b)=>a.due<b.due?-1:1);
  let h=`<div class="hello"><span>Сегодня <b>${fmtD(TODAY)}</b></span><span>·</span><span>${seeAll('requests')?'Вы видите всю организацию':'Вы видите только свои записи'}</span></div><div class="plates">
    ${feat('requests')&&can('rqView')?plate({id:'over',icon:'alert',color:over.length?'red':'green',label:'Просрочено заявок',value:over.length,sub:over.length?'срок прошёл':'всё в срок'})+plate({id:'mine',icon:'task',color:'purple',label:'Мои на сегодня',value:mine.length,sub:'включая просроченные'})+plate({id:'pend',icon:'hourglass',color:pend.length?'yellow':'green',label:'Ждут подтверждения',value:pend.length}):''}
    ${can('clView')?plate({id:'noresp',icon:'user',color:noResp.length?'orange':'green',label:'Клиенты без ответственного',value:noResp.length}):''}
  </div>`;
  if(week.length)h+=`<div class="box"><h3>Сроки на неделе</h3><div class="list">${week.slice(0,8).map(r=>`<div class="li" data-rq="${r.id}" tabindex="0"><div class="datebox"><b>${r.due.slice(8)}</b><span>${r.due.slice(5,7)}</span></div><div class="grow"><div class="t1">${esc(r.title)}</div><div class="t2">${esc(r.client&&CLM[r.client]?CLM[r.client].name:'Общая')} · ${esc(empName(r.resp))}</div></div>${scPill('request',r.status)}</div>`).join('')}</div></div>`;
  body.innerHTML=h;
  body.onclick=e=>{let b;const t=seeAll('requests')?'all':'by';
    if(b=e.target.closest('[data-plate]')){const id=b.dataset.plate;
      if(id==='over')go('requests',t,{over:{type:'enum',vals:['Да']}});if(id==='mine')go('requests','mine',{due:{type:'date',from:null,to:TODAY},status:{type:'enum',vals:['Новая','В работе','На доработке']}});
      if(id==='pend')go('requests',t,{status:{type:'enum',vals:['На подтверждении']}});if(id==='noresp')go('clients','all',{resp:{type:'enum',vals:['']}});return}
    if(b=e.target.closest('[data-rq]'))openRequest(REQUESTS.find(r=>r.id===b.dataset.rq))};
}
