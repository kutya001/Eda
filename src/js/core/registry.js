'use strict';
// Реестр модулей (BIZ — организация и кабинет заказчика, ADM — администратор платформы) и роутер #модуль.вкладка; подключается после всех модулей
/* ═════════════ Module registry ═════════════ */
/* Описание модуля: id, title (полное название), short (подпись в нижней панели телефона), icon, desc (текст «ⓘ» и «?»),
   tabs() — вкладки [{id,label,icon,count,red,group}], add() — пункты «+ Добавить» (один — кнопка, несколько — меню),
   perm — право просмотра (без него модуль скрыт), vis() — своё условие видимости вместо perm, feature — функция учётной политики (выключена — модуль скрыт),
   cust:true — модуль кабинета заказчика (виден только представителю заказчика), badge() — красный счётчик у модуля в меню,
   empty() — пустое состояние первого входа, render(body, tab, fresh). */
const BIZ=[
 {id:'home',title:'Главная',short:'Главная',icon:'home',desc:'«Быстрый заказ» и сводка на сегодня по вашей роли: новые и неоплаченные заказы, заказы на завтра, план кухни, склад, долги и наличные у курьеров. Каждая плашка открывает нужный список с уже применённым фильтром.',tabs:homeTabs,add:homeAdd,render:renderHome},
 {id:'customers',title:'Заказчики',short:'Заказчики',icon:'building',desc:'Юрлица (компании, ИП, учреждения) и физлица (частные клиенты), которым вы готовите: точки доставки и адреса, места доставки, прайс и скидка, отсрочка и лимит долга, доступ представителей юрлиц в приложение. Физлицо создаётся само при быстром заказе.',perm:'cuView',tabs:cuTabs,add:cuAdd,render:renderCustomers,
  empty:()=>!CUSTS.length&&{icon:'building',title:'Здесь будут ваши заказчики',text:'Добавьте заказчиков по одному или загрузите сразу списком из Excel.',btns:[can('cuEdit')&&['Добавить юрлицо','plus',()=>custDlg(),1],can('cuEdit')&&['Добавить физлицо','user',()=>personDlg()],can('cuImport')&&['Загрузить из Excel','upload',()=>cuImportDlg()]]}},
 {id:'dishes',title:'Блюда',short:'Блюда',icon:'chef',desc:'Блюда с техкартами по версиям, себестоимость и фудкост, КБЖУ и аллергены, комплексы.',perm:'dsView',tabs:dsTabs,add:dsAdd,render:renderDishes,
  empty:()=>!DISHES.length&&{icon:'chef',title:'Блюд пока нет',text:'Добавьте первое блюдо и его техкарту: из неё считаются себестоимость, план кухни и списание продуктов.',btns:[can('dsEdit')&&['Добавить блюдо','plus',()=>dishDlg(),1]]}},
 {id:'menu',title:'Меню',short:'Меню',icon:'calendar',desc:'Меню на каждый день и смену: позиции, цены и лимиты порций. Опубликованное меню видят заказчики; приём закрывается по времени из учётной политики.',perm:'mnView',tabs:mnTabs,add:mnAdd,render:renderMenu},
 {id:'orders',title:'Заказы',short:'Заказы',icon:'task',desc:'Заказы по датам и сменам: быстрый заказ с телефона за минуту, оплата с чеком, принятие, изменение до закрытия приёма, доставка с фото, накладные, сообщение клиенту. Регулярные заказы создаются сами.',perm:'ordView',tabs:ordTabs,add:ordAdd,render:renderOrders,
  badge:()=>can('ordAccept')?visOrders().filter(o=>o.status==='Новый'&&o.date>=TODAY).length:0,
  empty:()=>!ORDERS.length&&{icon:'task',title:'Заказов пока нет',text:'Заказы появятся, когда вы опубликуете меню и заказчики сделают заказ, или создайте заказ сами.',btns:[can('ordEdit')&&['Быстрый заказ','zap',()=>quickOrderDlg(),1],can('ordEdit')&&CUSTS.length&&['Создать заказ','plus',()=>orderDlg(null,{date:TOMORROW()})],can('mnView')&&['Открыть меню','calendar',()=>go('menu')]]}},
 {id:'kitchen',title:'Кухня',short:'Кухня',icon:'flame',desc:'План производства на дату и смену из заказов: сколько готовить, требование кухни — сколько чего на какие точки и места скопления, наклейки на контейнеры, потребность в продуктах.',perm:'ktView',tabs:ktTabs,render:renderKitchen},
 {id:'stock',title:'Склад',short:'Склад',icon:'archive',desc:'Остатки продуктов по средней цене, приходы, списания и инвентаризации, закупка и поставщики. Списание по плану кухни — автоматически.',perm:'skView',feature:'stock',tabs:skTabs,add:skAdd,render:renderStock,
  badge:()=>can('skDocs')?lowStock().length:0},
 {id:'delivery',title:'Доставка',short:'Доставка',icon:'truck',desc:'Рейсы курьеров на дату: распределение заказов по месту, району и окну, карта точек с местами скопления (бизнес-центры), порядок точек, загрузка по чек-листу, наличные и тара.',perm:'dlView',feature:'delivery',tabs:dlTabs,add:dlAdd,render:renderDelivery},
 {id:'route',title:'Маршрут',short:'Маршрут',icon:'pin',desc:'Телефон курьера: свой рейс по точкам списком и на карте, звонок и навигатор, отметка «Доставлен» с фото, наличные к получению за вычетом предоплаты, тара. Работает без связи.',perm:'dlRoute',feature:'delivery',badge:routeBadge,render:renderRoute},
 {id:'money',title:'Деньги',short:'Деньги',icon:'wallet',desc:'Долги заказчиков по отсрочке, накладные, счета на оплату, акт сверки, оплаты, наличные курьеров и оплаты поставщикам.',vis:()=>can('myView')||can('dlRoute')&&feat('delivery'),tabs:myTabs,add:myAdd,badge:myBadge,render:renderMoney},
 {id:'reports',title:'Отчёты',short:'Отчёты',icon:'chart',desc:'Продажи, себестоимость и фудкост, движение продуктов, списания, долги по срокам и доставка. Период и группировка — в верхней строке.',perm:'rpView',tabs:rpTabs,render:renderReports},
 {id:'c-order',title:'Заказать',short:'Заказать',icon:'plus',cust:true,desc:'Заказ на дату с опубликованным меню: точка доставки, блюда и комплексы, порции. Изменить и отменить можно до закрытия приёма.',render:renderCOrder},
 {id:'c-orders',title:'Мои заказы',short:'Заказы',icon:'task',cust:true,desc:'Ваши заказы и их статус по шкале: принят, готовится, в пути, доставлен с фото. «Повторить», «Изменить», «Отменить».',tabs:coTabs,render:renderCOrders},
 {id:'c-menu',title:'Меню',short:'Меню',icon:'calendar',cust:true,desc:'Опубликованное меню на неделю: состав комплексов, цены по вашему прайсу, КБЖУ и аллергены.',render:renderCMenu},
 {id:'c-bills',title:'Счета',short:'Счета',icon:'wallet',cust:true,desc:'Накладные, счета на оплату и оплаты; долг и ближайший срок оплаты; акт сверки.',tabs:cbTabs,render:renderCBills},
 {id:'staff',title:'Сотрудники и роли',short:'Сотрудники',icon:'users',desc:'Сотрудники организации: приглашение по номеру телефона, роль, блокировка. Роли — наборы прав по модулям с областью «Свои / Все».',perm:'stView',tabs:staffTabs,add:staffAdd,render:renderStaff},
 {id:'dicts',title:'Справочники',short:'Справочники',icon:'book',desc:'Справочники организации (районы, транспорт, причины отмены и списания) и справочники платформы для просмотра с «Попросить добавить».',tabs:dcTabs,add:dcAdd,render:renderDicts},
 {id:'journal',title:'Журнал изменений',short:'Журнал',icon:'history',desc:'Все изменения записей организации: кто, когда, что было и что стало. Только чтение.',feature:'journal',vis:()=>isOwner()||can('viewAll'),render:renderJournal},
 {id:'org',title:'Моя организация',short:'Организация',icon:'landmark',desc:'Реквизиты и логотип, учётная политика (какие функции включены), настройки приёма заказов и подписка. Редактирует владелец.',vis:()=>isOwner(),tabs:orgTabs,render:renderOrg},
];
const ADM=[
 {id:'tenants',title:'Организации',short:'Организации',icon:'landmark',desc:'Все организации платформы: тариф, статус подписки, оплачено до, владелец. Администратор не видит заказы, деньги и сотрудников организаций.',add:tnAdd,badge:tnBadge,render:renderTenants},
 {id:'accounts',title:'Учётные записи',short:'Учётки',icon:'user',desc:'Все пользователи платформы по номеру телефона: в каких организациях и с какими ролями, блокировка на платформе, завершение сессий.',render:renderAccounts},
 {id:'pdicts',title:'Справочники платформы',short:'Справочники',icon:'book',desc:'Общие списки для всех организаций. Использованное значение нельзя удалить, только отключить. Каждое изменение пишется в историю. «Запросы» — просьбы организаций добавить значение.',tabs:pdTabs,add:pdAdd,render:renderPDicts},
 {id:'plog',title:'Журнал платформы',short:'Журнал',icon:'history',desc:'Действия администраторов: организации и подписки, справочники платформы, блокировки, доступы поддержки. Только чтение.',render:renderPLog},
];
// Представитель заказчика видит только модули кабинета; сотрудник — модули по правам и учётной политике
const modOk=m=>(!m.feature||feat(m.feature))&&(isCust()?!!m.cust:!m.cust&&(m.vis?m.vis():!m.perm||can(m.perm)));
const mods=()=>isAdmin()?ADM:BIZ.filter(modOk);
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
