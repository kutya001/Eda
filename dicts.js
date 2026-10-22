'use strict';
// «Справочники» организации: справочники платформы группами-плитками (только просмотр) и «Попросить добавить»; «Журнал изменений» — пример выключенного по умолчанию модуля
/* ═════════════ Справочники (просмотр) ═════════════ */
// Группы и пояснения — из refDB.json: dictionaryGroups=[{name, items:[id]}], у справочника what («что это») и where («где используется»)
function renderDicts(body){const G=REF.dictionaryGroups||[{name:'Справочники',items:Object.keys(DICT)}];
  body.innerHTML=G.map(g=>`<div class="box"><h3>${esc(g.name)}</h3><div class="plates">${g.items.filter(id=>DICT[id]).map(id=>{const d=DICT[id];return plate({id,icon:d.icon||'book',color:'blue',label:d.name,value:d.items.filter(x=>x.active!==false).length,sub:d.what})}).join('')}</div></div>`).join('')+
    `<div class="note">${ic('info')}<span>Справочники ведёт администратор платформы; организация выбирает из них значения. Если нужного значения нет — «Попросить добавить».</span></div>`;
  body.onclick=e=>{const b=e.target.closest('[data-plate]');if(b)dictView(b.dataset.plate)}}
function dictView(id){const d=DICT[id];openModal({size:'mid',render:()=>({title:esc(d.name),sub:esc(d.what||''),body:`${d.where?`<div class="note">${ic('info')}<span><b>Где используется:</b> ${esc(d.where)}</span></div>`:''}<div id="dv-g"></div>`,
  foot:'<button class="btn" id="dv-req">'+ic('send','sm')+'Попросить добавить</button><div class="grow"></div><button class="btn cta" data-close>Закрыть</button>',
  mount(el){grid($('#dv-g',el),{id:'dv-'+id,cols:[{key:'order',label:'№',type:'int',w:60,num:1,val:x=>x.order},{key:'name',label:'Значение',type:'text',w:220,val:x=>x.name},{key:'note',label:d.noteLabel||'Пояснение',type:'text',w:300,val:x=>x.note}],rows:()=>d.items.filter(x=>x.active!==false),title:'name',sort:{key:'order',dir:1},ordered:true,audit:false,exportable:false,firstRun:false,search:false});$('#dv-req',el).onclick=()=>requestValueDlg(d)}})})}
function requestValueDlg(d){openModal({form:true,noMax:true,render:()=>({title:'Попросить добавить значение',sub:esc(d.name),body:`<div class="form">${fld('Что добавить',inp('rv-v'),{req:true,full:true,id:'rv-v'})}${fld('Зачем',`<textarea class="inp" id="rv-w" rows="2"></textarea>`,{full:true,id:'rv-w'})}</div>`,foot:'<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="rv-ok">Отправить</button>',
  mount(el,m){$('#rv-ok',el).onclick=()=>{const v=val(el,'rv-v');if(!setErr(el,'rv-v',v?'':'Укажите значение'))return;REF.requestsToAdmin=REF.requestsToAdmin||[];REF.requestsToAdmin.push({at:nowStamp(),who:S.me,org:ORG.name,dict:d.name,value:v,why:val(el,'rv-w')});m.close();toast('Запрос отправлен администратору платформы','send')}}})})}

/* ═════════════ Журнал изменений ═════════════ */
function renderJournal(body){body.innerHTML='<div id="jg"></div>';const ENT={client:'Клиент',request:'Заявка',emp:'Сотрудник',role:'Роль',org:'Организация'};
  const recName=h=>h.ent==='client'?(CLM[h.rid]||{}).name:h.ent==='request'?(REQUESTS.find(r=>r.id===h.rid)||{}).title:h.ent==='emp'?empName(h.rid):h.ent==='role'?roleName(h.rid):ORG.name;
  grid($('#jg',body),{id:'journal',cols:[{key:'at',label:'Когда',type:'datetime',w:150,val:h=>h.at},{key:'who',label:'Кто',type:'enum',w:150,val:h=>whoName(h.who)},{key:'ent',label:'Раздел',type:'enum',w:120,val:h=>ENT[h.ent]||h.ent},{key:'rec',label:'Запись',type:'text',w:220,val:h=>recName(h)||''},{key:'what',label:'Что изменилось',type:'text',w:380,val:h=>h.what}],
    rows:()=>HIST.filter(h=>seeAll('clients')||h.who===S.me),title:'what',sort:{key:'at',dir:-1},audit:false,noun:['запись','записи','записей'],xlsName:'Журнал'})}
