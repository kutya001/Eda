'use strict';
// Реестр модулей (BIZ — организация, ADM — администратор платформы) и роутер #модуль.вкладка; подключается после всех модулей
/* ═════════════ Module registry ═════════════ */
/* Описание модуля: id, title (полное название), short (подпись в нижней панели телефона), icon, desc (текст «ⓘ» и «?»),
   tabs() — вкладки [{id,label,icon,count,red,group}], add() — пункты «+ Добавить» (один — кнопка, несколько — меню),
   perm — право просмотра (без него модуль скрыт), feature — функция учётной политики (выключена — модуль скрыт),
   badge() — красный счётчик у модуля в меню, empty() — пустое состояние первого входа, render(body, tab, fresh). */
const BIZ=[
 {id:'home',title:'Главная',short:'Главная',icon:'home',desc:'Сводка на сегодня: что просрочено, что ждёт подтверждения и ближайшие сроки. Каждая плашка открывает нужный список с уже применённым фильтром.',tabs:homeTabs,render:renderHome},
 {id:'clients',title:'Клиенты',short:'Клиенты',icon:'building',desc:'Основная сущность приложения: реквизиты, ответственный сотрудник, статус обслуживания и связанные записи.',perm:'clView',tabs:clTabs,add:clAdd,render:renderClients,
  empty:()=>!CLIENTS.length&&{icon:'building',title:'Здесь будут ваши клиенты',text:'Добавьте клиентов по одному или загрузите сразу списком из Excel.',btns:[can('clEdit')&&['Добавить клиента','plus',()=>clientDlg(),1],can('clImport')&&['Загрузить из Excel','upload',()=>clImportDlg()]]}},
 {id:'requests',title:'Заявки',short:'Заявки',icon:'task',desc:'Поручения сотрудникам по клиентам или общие: исполнитель, срок, подтверждение выполнения постановщиком.',perm:'rqView',feature:'requests',tabs:rqTabs,add:rqAdd,render:renderRequests,
  badge:()=>visRequests().filter(r=>r.resp===S.me&&rqOver(r)).length,
  empty:()=>!REQUESTS.length&&{icon:'task',title:'Заявок пока нет',text:'Поставьте первую заявку себе или сотруднику.',btns:[can('rqEdit')&&['Поставить заявку','plus',()=>requestDlg(),1]]}},
 {id:'journal',title:'Журнал изменений',short:'Журнал',icon:'history',desc:'Все изменения записей организации: кто, когда, что было и что стало.',perm:'jrView',feature:'journal',render:renderJournal},
 {id:'staff',title:'Сотрудники',short:'Сотрудники',icon:'users',desc:'Сотрудники организации, их роли и права по модулям с областью «Свои / Все».',perm:'stView',tabs:staffTabs,add:staffAdd,render:renderStaff},
 {id:'dicts',title:'Справочники',short:'Справочники',icon:'book',desc:'Справочники платформы для просмотра: организация выбирает из них значения, а ведёт их администратор платформы.',render:renderDicts},
 {id:'org',title:'Моя организация',short:'Организация',icon:'landmark',desc:'Сведения об организации и учётная политика: какие функции включены. Редактирует владелец.',tabs:orgTabs,render:renderOrg},
];
const ADM=[
 {id:'accounts',title:'Учётные записи',short:'Учётки',icon:'user',desc:'Все пользователи платформы: сброс пароля, блокировка и разблокировка.',render:renderAccounts},
 {id:'pdicts',title:'Справочники платформы',short:'Справочники',icon:'book',desc:'Общие списки для всех организаций. Использованное значение нельзя удалить, только отключить. Каждое изменение пишется в историю.',tabs:pdTabs,add:pdAdd,render:renderPDicts},
];
const mods=()=>isAdmin()?ADM:BIZ.filter(m=>(!m.feature||feat(m.feature))&&(!m.perm||can(m.perm)));
const curMod=()=>{const l=mods();return l.find(m=>m.id===S.mod)||l[0]};
function modTabs(m){return m.tabs?m.tabs().filter(Boolean):[]}

/* ═════════════ Router: #module.tab ═════════════ */
function parseHash(){const h=location.hash.replace(/^#/,'');const[a,b]=h.split('.');return {mod:a||'',tab:b||''}}
// go(модуль, вкладка, предустановка) — переход с готовым фильтром списка: {ключ столбца: фильтр}
function go(mod,tab,preset){S.preset=preset||null;const h='#'+mod+(tab?'.'+tab:'');if(location.hash===h)route();else location.hash=h}
function route(){
  const {mod,tab}=parseHash();const l=mods();const m=l.find(x=>x.id===mod)||l[0];
  const tabs=modTabs(m);const t=tabs.find(x=>x.id===tab)||tabs[0];
  const changed=S.mod!==m.id||S.tab!==(t&&t.id);
  S.mod=m.id;S.tab=t?t.id:null;
  if(changed){clearSearch();$('#topbar').classList.remove('searching')}
  if(!changed&&!S.preset){renderShell();return}
  renderShell(true);
  if(location.hash!=='#'+S.mod+(S.tab?'.'+S.tab:''))history.replaceState(null,'','#'+S.mod+(S.tab?'.'+S.tab:''));
}
addEventListener('hashchange',route);
