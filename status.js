'use strict';
// Шкала статусов (одна на все сущности), переход на следующий шаг, откат на один шаг с причиной, «История статусов»
/* ═════════════ Шкала статусов ═════════════ */
/* Описание шкалы — в refDB.json → statuses.<ключ>:
   name — подпись шкалы; steps — шаги по порядку; stepsC — шаги с подтверждением (если у записи confirm:true);
   side — боковые статусы {статус:{at:номер шага от 0 или −1 с конца, cls:'red'|'faint'}} — отметка на шаге, а не шаг;
   none — нейтральные статусы («Не требуется») вместо шкалы; colors — {статус:[цвет, значок]};
   perm — право на переход вперёд; confirm — {step, perm}: шаг подтверждения, ставит постановщик или сотрудник с правом, но не исполнитель;
   back — {статус:'что изменится при откате в этот статус'}; field — поле ответственного (для «свои» и «не подтверждает своё»).
   История статусов хранится в записи: sh=[{at, from, to, who, note, rb}] — не редактируется и не удаляется. */
const SC=k=>REF.statuses[k];
const scSteps=(k,o)=>{const D=SC(k);return D.stepsC&&o&&o.confirm?D.stepsC:D.steps};
function scPos(k,o){const D=SC(k),st=o.status,steps=scSteps(k,o);let i=steps.indexOf(st),side=null;if(i<0&&D.side&&D.side[st]){side=D.side[st];i=side.at<0?steps.length+side.at:side.at}return {i,side,n:steps.length,steps}}
const scColor=(k,st)=>((SC(k).colors||{})[st]||['gray'])[0];
const scPill=(k,st,extra)=>pill(st,SC(k).colors,extra);
// Следующий шаг: из обычного шага — следующий; из бокового — шаг после того, на котором он стоит; последний и «отменённые» — никуда
function scNext(k,o){const {i,side,steps}=scPos(k,o);if(side&&side.at<0)return null;const j=i+1;return j<steps.length?steps[j]:null}
// Шаг назад для отката: из бокового статуса — на его шаг, из обычного — на предыдущий; только один шаг за раз
function scBack(k,o){const bf=SC(k).backFrom;if(bf&&bf[o.status])return bf[o.status];const {i,side,steps}=scPos(k,o);if(side)return steps[Math.max(0,side.at<0?steps.length-2:side.at)];return i>0?steps[i-1]:null}
// Почему нельзя перейти (null — можно)
function scWhyNot(k,o,to){const D=SC(k);if(D.confirm&&to===D.confirm.step){const f=D.field||'resp';if(o[f]===S.me)return 'Свою запись подтвердить нельзя';if(o.by!==S.me&&!can(D.confirm.perm))return `Нужно право «${PERM()[D.confirm.perm].name}»`;return null}
  return D.perm&&!can(D.perm)?`Нужно право «${PERM()[D.perm].name}»`:null}
function stSince(o){const h=o.sh||[];return h.length?h[h.length-1]:null}
// Компактная шкала для списков и плиток: точки шагов, «2/4 В работе» и дата установки
function scaleMini(k,o){const D=SC(k),st=o.status;if(!st)return '<span class="faint">—</span>';const e=stSince(o);
  let h;if((D.none||[]).includes(st))h=`<span class="scm none" title="${esc(st)}: шкала не ведётся">${ic('ban','sm')}${esc(st)}</span>`;
  else{const {i,side,n,steps}=scPos(k,o);h=i<0?scPill(k,st):`<span class="scm sc-${scColor(k,st)}" title="Этап ${i+1} из ${n}: ${esc(st)}"><span class="scm-d">${steps.map((x,j)=>`<i class="${j<i?'p':j===i?(side?'c x':'c'):''}"></i>`).join('')}</span><b>${i+1}/${n}</b><span class="scm-l">${esc(st)}</span></span>`}
  return e?`<span class="scm-w" title="Установлен ${fmtDT(e.at)}${e.who?', '+esc(whoName(e.who)):''}">${h}<small>${fmtDT(e.at)}</small></span>`:h}
// Полная шкала в карточке: следующий шаг кликабелен (с правом), предыдущий — откат (с правом «Откат статусов»); на телефоне — столбиком (CSS)
function scaleFull(k,o){const D=SC(k),st=o.status;const H=o.sh||[];const when=x=>{for(let q=H.length-1;q>=0;q--)if(H[q].to===x)return H[q].at;return null};
  if((D.none||[]).includes(st))return `<div class="scf-wrap"><span class="scf-t">${esc(D.name)}</span><div class="scf"><span class="scf-none">${ic('ban','sm')}${esc(st)} — шкала не ведётся</span></div></div>`;
  const {i,side,steps}=scPos(k,o);const nx=scNext(k,o);const nxOk=nx&&!scWhyNot(k,o,nx);const bk=can('rollback')?scBack(k,o):null;const col=scColor(k,st);
  return `<div class="scf-wrap"><span class="scf-t">${esc(D.name)}</span><div class="scf" data-sk="${k}" role="list">${steps.map((x,j)=>{const cls=j<i?'p':j===i?'c sc-'+(side?side.cls==='red'?'red':'faint':col):'f';const goS=nxOk&&x===nx;const back=!goS&&bk===x&&(j<i||(j===i&&side));const w=j<=i?when(j===i&&side?st:x):null;
    return `<button type="button" role="listitem" class="scf-s ${cls} ${goS?'go':''} ${back?'back':''}" ${goS?`data-step="${esc(x)}" title="Перевести в «${esc(x)}»"`:back?`data-back="${esc(x)}" title="Откатить в «${esc(x)}»"`:`tabindex="-1" aria-disabled="true"`} aria-current="${j===i?'step':'false'}"><span class="n">${j<i?ic('check','sm'):j===i&&side?ic(side.cls==='red'?'x':'ban','sm'):j+1}</span><span class="l">${j===i&&side?`${esc(st)}<em class="scf-side">на шаге ${j+1} «${esc(x)}»</em>`:esc(x)}${w?`<small class="scf-at">${fmtDT(w)}</small>`:''}${back?`<small class="scf-bk">${ic('history','sm')}откатить</small>`:''}</span></button>${j<steps.length-1?`<span class="scf-ln ${j<i?'p':''}"></span>`:''}`}).join('')}</div>${nx&&!nxOk?`<span class="hint">Следующий шаг «${esc(nx)}»: ${esc(scWhyNot(k,o,nx))}</span>`:''}</div>`}
// Подключить кнопки шкалы в карточке; done — перерисовать карточку
function bindScale(el,k,o,done){$$(`.scf[data-sk="${k}"] [data-step]`,el).forEach(b=>b.onclick=()=>stepTo(k,o,b.dataset.step,done));$$(`.scf[data-sk="${k}"] [data-back]`,el).forEach(b=>b.onclick=()=>rollbackDlg(k,o,b.dataset.back,done))}
// Переход: то же окно подтверждения, что у кнопки действия; модуль может перехватить шаг (например, «Выполнена» с файлом) через SC_HOOK
const SC_HOOK={};
function stepTo(k,o,to,done){const why=scWhyNot(k,o,to);if(why)return toast(why,'alert',true);if(SC_HOOK[k]&&SC_HOOK[k](o,to,done))return;
  confirmDlg({title:`Перевести в «${esc(to)}»?`,text:`Сейчас: «${esc(o.status)}». Переход будет записан в «Историю статусов».`,ok:'Перевести',run:()=>{setStatus(k,o,to);done&&done()}})}
function setStatus(k,o,to,note,rb){const from=o.status;if(from===to)return;o.sh=o.sh||[];o.sh.push({at:nowStamp(),from,to,who:S.me,note:note||'',rb:!!rb});o.status=to;log(k,o.id,`Статус: ${from} → ${to}${rb?' (откат)':''}${note?` (${note})`:''}`,o);refreshAll();toast(rb?`Откат: «${to}»`:`Статус: «${to}»`,rb?'history':'check')}
// Откат: только на один шаг, только с правом «Откат статусов», окно с последствиями и обязательной причиной
function rollbackDlg(k,o,to,done){if(!can('rollback'))return toast('Нужно право «Откат статусов»','alert',true);const D=SC(k);const cons=(D.back||{})[to]||'Запись вернётся на предыдущий шаг.';
  openModal({form:true,noMax:true,render:()=>({title:`Откатить: «${esc(o.status)}» → «${esc(to)}»`,body:`<div class="note warn">${ic('history')}<span><b>Что изменится.</b> ${esc(cons)}</span></div><div class="form">${fld('Причина',`<textarea class="inp" id="rb-why" rows="3" placeholder="Почему откатываете"></textarea>`,{req:true,full:true,id:'rb-why'})}</div>`,
    foot:'<button class="btn ghost" data-close>Отмена</button><button class="btn danger" id="rb-ok">Откатить</button>',
    mount(el,m){$('#rb-ok',el).onclick=()=>{const w=val(el,'rb-why');if(!setErr(el,'rb-why',w?'':'Укажите причину отката'))return;m.close();setStatus(k,o,to,w,true);done&&done()}}})})}
function durTxt(ms){if(ms<0)ms=0;const h=ms/36e5;if(h<1)return 'меньше часа';if(h<24)return Math.round(h)+' ч';const d=Math.round(h/24);return d+' '+plural(d,'день','дня','дней')}
// «История статусов»: когда, было → стало, кто, причина или комментарий, сколько в статусе; на телефоне строки идут одна под другой (CSS)
function statusHistHtml(k,o){const h=(o.sh||[]).map((e,i,a)=>({...e,ms:stAt(a[i+1]?a[i+1].at:nowStamp())-stAt(e.at),now:!a[i+1]}));if(!h.length)return '<div class="muted">Статус ещё не менялся.</div>';const map=SC(k).colors;const tot={};h.forEach(e=>tot[e.to]=(tot[e.to]||0)+e.ms);
  return `<div class="sh-blk"><div class="tbl-wrap"><table class="mini sh"><thead><tr><th>Когда</th><th>Статус</th><th>Кто</th><th>Комментарий, причина</th><th class="num">В статусе</th></tr></thead><tbody>${h.slice().reverse().map(e=>`<tr><td class="tnum sh-when">${fmtDT(e.at)}</td><td class="sh-st">${e.from?`<span class="faint">${esc(e.from)} →</span> `:''}${pill(e.to,map,'sm')}</td><td class="sh-who">${esc(whoName(e.who)||'—')}</td><td class="sh-note ${!e.note&&!e.rb?'sh-none':''}">${e.rb?`<span class="pill orange sm">${ic('history')}Откат</span> `:''}${esc(e.note)}${!e.note&&!e.rb?'<span class="faint">—</span>':''}</td><td class="num tnum sh-dur">${durTxt(e.ms)}${e.now?' <span class="faint">· сейчас</span>':''}</td></tr>`).join('')}</tbody></table></div>
  <div class="sh-sum">${Object.entries(tot).map(([s,ms])=>`<span>${esc(s)}: <b>${durTxt(ms)}</b></span>`).join('')}</div></div>`}
// Новая запись получает первую строку истории
function stStart(o,st,note){o.status=st;o.sh=[{at:nowStamp(),from:'',to:st,who:S.me,note:note||''}]}
