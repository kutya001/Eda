'use strict';
// «Справочники»: справочники организации (смены, транспорт, районы, причины) — ведут владелец и управляющий; справочники платформы — просмотр и «Попросить добавить»; «Журнал изменений»
/* ═════════════ Справочники организации ═════════════ */
// Где используется значение: использованное нельзя удалить, только отключить
const OD_USED={shift:c=>MENUS.some(m=>m.shift===c)||ORDERS.some(o=>o.shift===c)||PLANS.some(p=>p.shift===c),vehicle:c=>TRIPS.some(t=>t.vehicle===c),district:c=>CUSTS.some(x=>x.points.some(p=>p.district===c)),
  cancel:c=>ORDERS.some(o=>o.cancel===c),nd:c=>ORDERS.some(o=>o.nd&&o.nd.reason===c),wo:c=>WOS.some(w=>w.reason===c)};
const odIds=()=>Object.keys(ODICT);
function dcTabs(){return [...odIds().map(id=>({id,label:ODICT[id].name,icon:ODICT[id].icon||'book',group:'Организации'})),{id:'platform',label:'Справочники платформы',icon:'globe',group:'Платформы'}]}
function dcAdd(){const d=ODICT[S.tab];return d&&can('dcEdit')?[{label:'Значение',icon:'plus',run:()=>odValDlg(S.tab)}]:[]}
const odHist=(id,what)=>log('dict',id,what,ODICT[id]);
function renderDicts(body,tab,fresh){if(tab==='platform')return renderPlatDicts(body);const d=ODICT[tab];if(!d){body.innerHTML='<div class="state">Нет справочников</div>';return}const ed=can('dcEdit');
  body.innerHTML=`<div class="note">${ic('info')}<span><b>${esc(d.name)}</b> — ${esc(d.what||'')}. Код присваивается автоматически и не меняется. Использованное значение нельзя удалить — только отключить: отключённое не предлагается в новых записях.${ed?'':' Ведут владелец и управляющий.'}</span></div><div id="odg"></div><div class="box"><h3>История изменений</h3>${histHtml('dict',tab)}</div>`;
  const used=x=>(OD_USED[tab]||(()=>false))(x.code);
  grid($('#odg',body),{id:'od-'+tab,cols:[{key:'order',label:'№',type:'int',w:60,num:1,val:x=>x.order},{key:'code',label:'Код',type:'text',w:110,val:x=>x.code,cls:'mono'},{key:'name',label:'Название',type:'text',w:220,val:x=>x.name},{key:'note',label:d.noteLabel||'Пояснение',type:'text',w:260,val:x=>x.note},
    {key:'used',label:'Используется',type:'enum',w:120,val:x=>used(x)?'Да':'Нет'},{key:'active',label:'Активна',type:'enum',w:100,val:x=>x.active===false?'Нет':'Да'}],
    rows:()=>d.items,rid:x=>x.code,title:'name',sort:{key:'order',dir:1},ordered:true,audit:false,rowClass:x=>x.active===false?'muted':'',open:ed?x=>odValDlg(tab,x):null,xlsName:d.name,simulateLoad:fresh,
    actions:x=>{if(!ed)return [];const s=d.items.slice().sort((a,b)=>a.order-b.order);const i=s.indexOf(x);const mv=j=>{const y=s[j];[x.order,y.order]=[y.order,x.order];odHist(tab,`«${x.name}»: №${y.order} → №${x.order}`);refreshAll()};
      return [{label:'Изменить',icon:'edit',run:()=>odValDlg(tab,x)},i>0&&{label:'Выше',icon:'up',run:()=>mv(i-1)},i<s.length-1&&{label:'Ниже',icon:'dn',run:()=>mv(i+1)},{sep:1},
        x.active===false?{label:'Включить',icon:'check',run:()=>{x.active=true;odHist(tab,`Включено «${x.name}»`);refreshAll()}}:{label:'Отключить',icon:'ban',disabled:tab==='shift'&&d.items.filter(i=>i.active!==false).length<2,reason:'Нужна хотя бы одна активная смена',run:()=>{x.active=false;odHist(tab,`Отключено «${x.name}»`);refreshAll()}},
        {label:'Удалить',icon:'trash',danger:true,disabled:used(x),reason:used(x)?'Значение используется — его можно только отключить':'',run:()=>confirmDlg({title:'Удалить значение?',text:`«${esc(x.name)}» нигде не используется и будет удалено.`,ok:'Удалить',danger:true,run:()=>{d.items.splice(d.items.indexOf(x),1);odHist(tab,`Удалено «${x.name}»`);refreshAll()}})}]},
    empty:{icon:'book',title:'Значений пока нет',add:ed?()=>odValDlg(tab):null}})}
// Код — постоянный: префикс справочника и следующий номер
const nextCode=(items,pre)=>{const p=pre||((items[0]||{}).code||'ЗН-000').split('-')[0];const n=Math.max(0,...items.map(i=>+String(i.code).split('-')[1]||0))+1;return p+'-'+String(n).padStart(3,'0')};
const OD_PRE={shift:'СМ',vehicle:'ТР',district:'РН',cancel:'ПО',nd:'ПН',wo:'ПС'};
function odValDlg(id,x){const d=ODICT[id];const isNew=!x;openModal({form:true,noMax:true,render:()=>({title:isNew?'Новое значение':'Изменить значение',sub:esc(d.name),body:`<div class="form">${fld('Название',inp('ov-n',x?x.name:''),{req:true,full:true,id:'ov-n'})}${fld('Код',inp('ov-c',x?x.code:nextCode(d.items,OD_PRE[id]),'class="inp mono" readonly'),{id:'ov-c',hint:'Присваивается автоматически и не меняется'})}${fld(d.noteLabel||'Пояснение',inp('ov-o',x?x.note:''),{full:true,id:'ov-o'})}</div>`,
  foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="ov-ok">${isNew?'Добавить':'Сохранить'}</button>`,mount(el,m){$('#ov-ok',el).onclick=()=>{const n=val(el,'ov-n');if(!setErr(el,'ov-n',!n?'Укажите название':d.items.some(i=>i!==x&&i.name.toLowerCase()===n.toLowerCase())?'Такое значение уже есть':''))return;
    if(isNew){d.items.push({code:val(el,'ov-c'),name:n,note:val(el,'ov-o'),active:true,order:Math.max(0,...d.items.map(i=>i.order))+1});odHist(id,`Добавлено «${n}»`)}else{if(x.name!==n)odHist(id,`Переименовано: «${x.name}» → «${n}»`);if(x.note!==val(el,'ov-o'))odHist(id,`«${n}»: ${d.noteLabel||'пояснение'} ${x.note||'—'} → ${val(el,'ov-o')||'—'}`);x.name=n;x.note=val(el,'ov-o')}m.close();refreshAll();toast('Сохранено')}}})})}
/* ═════════════ Справочники платформы (просмотр) ═════════════ */
// Группы и пояснения — из refDB.json: dictionaryGroups=[{name, items:[id]}], у справочника what («что это») и where («где используется»)
function renderPlatDicts(body){const G=REF.dictionaryGroups||[{name:'Справочники',items:Object.keys(DICT)}];
  body.innerHTML=G.map(g=>`<div class="box"><h3>${esc(g.name)}</h3><div class="plates">${g.items.filter(id=>DICT[id]).map(id=>{const d=DICT[id];return plate({id,icon:d.icon||'book',color:'blue',label:d.name,value:d.items.filter(x=>x.active!==false).length,sub:d.what})}).join('')}</div></div>`).join('')+
    `<div class="note">${ic('info')}<span>Справочники платформы общие для всех организаций и ведёт их администратор платформы. Если нужного значения нет — откройте справочник и нажмите «Попросить добавить».</span></div>`;
  body.onclick=e=>{const b=e.target.closest('[data-plate]');if(b)dictView(b.dataset.plate)}}
function dictView(id){const d=DICT[id];openModal({size:'mid',render:()=>({title:esc(d.name),sub:esc(d.what||''),body:`${d.where?`<div class="note">${ic('info')}<span><b>Где используется:</b> ${esc(d.where)}</span></div>`:''}<div id="dv-g"></div>`,
  foot:`${isCust()?'':`<button class="btn" id="dv-req">${ic('send','sm')}Попросить добавить</button>`}<div class="grow"></div><button class="btn cta" data-close>Закрыть</button>`,
  mount(el){grid($('#dv-g',el),{id:'dv-'+id,cols:[{key:'order',label:'№',type:'int',w:60,num:1,val:x=>x.order},{key:'name',label:'Значение',type:'text',w:220,val:x=>x.name},{key:'note',label:d.noteLabel||'Пояснение',type:'text',w:300,val:x=>x.note}],rows:()=>d.items.filter(x=>x.active!==false),rid:x=>x.code,title:'name',sort:{key:'order',dir:1},ordered:true,audit:false,exportable:false,firstRun:false,search:false});if($('#dv-req',el))$('#dv-req',el).onclick=()=>requestValueDlg(d)}})})}
function requestValueDlg(d){openModal({form:true,noMax:true,render:()=>({title:'Попросить добавить значение',sub:esc(d.name),body:`<div class="form">${fld('Что добавить',inp('rv-v'),{req:true,full:true,id:'rv-v'})}${fld('Зачем',`<textarea class="inp" id="rv-w" rows="2"></textarea>`,{full:true,id:'rv-w'})}</div>`,foot:'<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="rv-ok">Отправить</button>',
  mount(el,m){$('#rv-ok',el).onclick=()=>{const v=val(el,'rv-v');if(!setErr(el,'rv-v',v?'':'Укажите значение'))return;DB.platform.requests.push({at:nowStamp(),who:S.me,org:ORG.name,tid:DB.cur,kind:'dict',dictId:Object.keys(DICT).find(k=>DICT[k]===d),dict:d.name,value:v,why:val(el,'rv-w'),status:'Новый'});m.close();toast('Запрос отправлен администратору платформы','send')}}})})}

/* ═════════════ Журнал изменений ═════════════ */
// Все изменения записей организации: когда, кто, модуль, запись, что изменено; только чтение
const ENT={order:['Заказы',o=>(ORM[o]||{}).no],regular:['Заказы',id=>{const r=REGS.find(x=>x.id===id);return r?'Регулярный · '+custName(r.cust):''}],customer:['Заказчики',id=>custName(id)],dish:['Блюда',id=>(DSM[id]||{}).name],combo:['Блюда',id=>(CBM[id]||{}).name],
  menu:['Меню',id=>{const m=MENUS.find(x=>x.id===id);return m?'Меню на '+fmtD(m.date):''}],tpl:['Меню',id=>(TPLS.find(x=>x.id===id)||{}).name],plan:['Кухня',id=>{const p=PLANS.find(x=>x.id===id);return p?'План на '+fmtD(p.date):''}],
  receipt:['Склад',id=>(RECEIPTS.find(x=>x.id===id)||{}).no],writeoff:['Склад',id=>(WOS.find(x=>x.id===id)||{}).no],inventory:['Склад',id=>(INVS.find(x=>x.id===id)||{}).no],product:['Склад',id=>(PRM[id]||{}).name],supplier:['Склад',id=>(SUPM[id]||{}).name],
  trip:['Доставка',id=>(TRM[id]||{}).no],payment:['Деньги',id=>(PAYS.find(x=>x.id===id)||{}).no],bill:['Деньги',id=>(BILLS.find(x=>x.id===id)||{}).no],nakl:['Деньги',id=>(NAKLS.find(x=>x.id===id)||{}).no],supPay:['Деньги',()=>'Оплата поставщику'],
  emp:['Сотрудники',id=>empName(id)],role:['Сотрудники',id=>roleName(id)],org:['Моя организация',()=>ORG.name],dict:['Справочники',id=>(ODICT[id]||{}).name]};
function renderJournal(body,tab,fresh){body.innerHTML=`<div class="note">${ic('history')}<span>Только чтение: записи журнала не меняются и не удаляются.</span></div><div id="jg"></div>`;
  grid($('#jg',body),{id:'journal',cols:[{key:'at',label:'Когда',type:'datetime',w:150,val:h=>h.at},{key:'who',label:'Кто',type:'enum',w:150,val:h=>whoName(h.who)},{key:'ent',label:'Модуль',type:'enum',w:140,val:h=>(ENT[h.ent]||[h.ent])[0]},
    {key:'rec',label:'Запись',type:'text',w:200,val:h=>{const e=ENT[h.ent];return (e&&e[1]&&e[1](h.rid))||''}},{key:'what',label:'Что изменено',type:'text',w:420,val:h=>h.what}],
    rows:()=>HIST,title:'what',sort:{key:'at',dir:-1},audit:false,noun:['запись','записи','записей'],xlsName:'Журнал изменений',simulateLoad:fresh})}
