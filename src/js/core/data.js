'use strict';
// Данные: demoDB.json, TemDB.json, refDB.json (папка data или встроенная копия), несколько организаций (тенантов), рабочие данные в localStorage, скачивание файлов
/* ═════════════ Данные прототипа ═════════════ */
/* Прототип — каркас: ни одной записи данных в коде. На GitHub Pages файлы читаются из папки data,
   в артефакте и при открытии с диска — из копии, которую сборка (build.py) встраивает в страницу (блоки db-*).
   demoDB.json — две демо-организации, TemDB.json — пустая организация (шаблон), refDB.json — справочники платформы.
   Мультитенантность: DB.tenants = {id: данные одной организации}; DB.cur — организация, в которой сейчас работает пользователь.
   Данные организаций не пересекаются: все списки берутся только из DB.tenants[DB.cur] (в продукте это проверяет RLS на сервере).
   Рабочие данные (TemDB) живут в localStorage: всё, что пользователь ввёл, переживает перезагрузку. */
const DB_VER=3,DB_KEY=APP.prefix+'.temdb';
const DB_FILES={demo:'demoDB.json',empty:'TemDB.json',ref:'refDB.json'};
// Разделы данных одной организации: при добавлении сущности допишите её сюда и в demoDB.json / TemDB.json (tools/make_data.py)
const DB_ORG_KEYS=['organization','roles','dicts','employees','customers','products','dishes','combos','menus','templates','orders','regulars','plans',
  'receipts','writeoffs','inventories','suppliers','supPays','trips','nakls','bills','payments','notices','history'];
function dbRead(name,id){
  if(/^https?:/.test(location.protocol))try{const x=new XMLHttpRequest();x.open('GET','data/'+name+'?v='+Date.now(),false);x.send();
    if(x.status===200){const v=JSON.parse(x.responseText);if(v&&v.meta&&v.meta.file===name)return {db:v,from:'папка data'}}}catch(e){}
  const el=document.getElementById(id);if(el)try{return {db:JSON.parse(el.textContent),from:'встроенная копия'}}catch(e){}
  return {db:{meta:{file:name}},from:'нет файла'}}
const DBSRC={demo:dbRead(DB_FILES.demo,'db-demo'),empty:dbRead(DB_FILES.empty,'db-tem'),ref:dbRead(DB_FILES.ref,'db-ref')};
let DATA_MODE=store.get('data','demo'),DBMISS=[];
// Демо-данные привязаны к опорной дате meta.anchor: все даты сдвигаются так, чтобы «сегодня» в демо всегда было сегодня
function dbShift(db){const a=db.meta&&db.meta.anchor;if(!a||a===TODAY)return db;const n=Math.round((stAt(TODAY)-stAt(a))/864e5);const re=/^\d{4}-\d{2}-\d{2}/;
  const sh=s=>re.test(s)?addDays(s.slice(0,10),n)+s.slice(10):s;
  const walk=o=>{for(const k in o){const v=o[k];if(typeof v==='string')o[k]=sh(v);else if(v&&typeof v==='object')walk(v)}};
  walk(db.tenants);walk(db.platform||{});db.meta.anchor=TODAY;return db}
// Недостающие разделы (старый или чужой файл) берутся из пустого шаблона и refDB.json — прототип не ломается, а показывает, чего не хватило
function dbFill(db){const miss=[],e=DBSRC.empty.db,r=DBSRC.ref.db;db.meta=db.meta||{};
  if(!db.tenants||!Object.keys(db.tenants).length){miss.push('tenants');db.tenants=structuredClone(e.tenants||{t1:{}})}
  const et=Object.values(e.tenants||{})[0]||{};
  Object.entries(db.tenants).forEach(([id,t])=>DB_ORG_KEYS.forEach(k=>{if(t[k]==null){miss.push(id+'.'+k);t[k]=structuredClone(et[k]!=null?et[k]:k==='organization'||k==='dicts'?{}:[])}}));
  if(!db.tenants[db.cur])db.cur=Object.keys(db.tenants)[0];
  db.platform=db.platform||{log:[],requests:[]};
  db.ref=db.ref||{};Object.keys(r).forEach(k=>{if(k!=='meta'&&db.ref[k]==null)db.ref[k]=structuredClone(r[k])});
  return {db,miss}}
// Новые рабочие данные: демо-организации или пустая (как сразу после регистрации)
function dbFresh(mode){const src=dbShift(structuredClone(mode==='empty'?DBSRC.empty.db:DBSRC.demo.db));const {db}=dbFill(src);db.meta={...db.meta,file:'TemDB.json',version:DB_VER,mode};return db}
function dbLoad(){let db=null;try{const t=localStorage.getItem(DB_KEY);if(t)db=JSON.parse(t)}catch(e){}
  if(!db||!db.meta||db.meta.version!==DB_VER||!db.tenants)return dbFresh(DATA_MODE);const r=dbFill(db);DBMISS=r.miss;return r.db}
let DB=dbLoad();
// Короткие имена разделов текущей организации; после смены организации или замены данных (dbBind) указывают на новые массивы
let T,ORG,ROLES,EMP,EM,REF,DICT,ODICT,CUSTS,CUM,PRODS,PRM,DISHES,DSM,COMBOS,CBM,MENUS,TPLS,ORDERS,ORM,REGS,PLANS,RECEIPTS,WOS,INVS,SUPS,SUPM,SUPPAYS,TRIPS,TRM,NAKLS,BILLS,PAYS,NOTICES,HIST;
function dbBind(){T=DB.tenants[DB.cur];ORG=T.organization;ROLES=T.roles;EMP=T.employees;REF=DB.ref;DICT=REF.dictionaries;ODICT=T.dicts;
  CUSTS=T.customers;PRODS=T.products;DISHES=T.dishes;COMBOS=T.combos;MENUS=T.menus;TPLS=T.templates;ORDERS=T.orders;REGS=T.regulars;PLANS=T.plans;
  RECEIPTS=T.receipts;WOS=T.writeoffs;INVS=T.inventories;SUPS=T.suppliers;SUPPAYS=T.supPays;TRIPS=T.trips;NAKLS=T.nakls;BILLS=T.bills;PAYS=T.payments;NOTICES=T.notices;HIST=T.history;
  ORG.features=ORG.features||{};ORG.policy=ORG.policy||{};ORG.seq=ORG.seq||{};reindex()}
// Справочники по id: пересчитываются после каждого изменения (refreshAll)
function reindex(){const ix=a=>Object.fromEntries(a.map(x=>[x.id,x]));EM=ix(EMP);CUM=ix(CUSTS);PRM=ix(PRODS);DSM=ix(DISHES);CBM=ix(COMBOS);ORM=ix(ORDERS);TRM=ix(TRIPS);SUPM=ix(SUPS);REV++}
let REV=0;
dbBind();
// Номер документа по порядку внутри организации: З-000123, Н-0045
function nextNo(kind,pre,w=4){ORG.seq[kind]=(ORG.seq[kind]||0)+1;return pre+'-'+String(ORG.seq[kind]).padStart(w,'0')}
let dbT=null,dbWarned=false;
function dbSave(){clearTimeout(dbT);dbT=null;DB.meta.saved=nowStamp();try{localStorage.setItem(DB_KEY,JSON.stringify(DB))}catch(e){if(!dbWarned){dbWarned=true;toast('Не удалось сохранить рабочие данные: в браузере не хватает места','alert',true)}}}
const dbSoon=()=>{clearTimeout(dbT);dbT=setTimeout(dbSave,700)};
function dbApply(db){DB=db;dbBind()}
const dbSum=db=>{const ts=Object.values(db.tenants||{});const n=k=>ts.reduce((a,t)=>a+(t[k]||[]).length,0);return `${ts.length} ${plural(ts.length,'организация','организации','организаций')}, ${n('orders')} заказов, ${n('customers')} заказчиков, ${n('employees')} сотрудников`};
// Скачать файл. В артефакте claude.ai прямое скачивание запрещено: файл предлагается через возможность downloads, иначе текст копируется в буфер
function saveFile(name,blob,okMsg){
  if(window.top!==window.self){const u=window.claude&&window.claude.use;const cp=()=>blob.text().then(t=>/json|text/.test(blob.type)?copyText(t,`Скопировано: сохраните как ${name}`):toast('Скачивание недоступно в этом окне: откройте прототип в браузере','alert',true));
    if(!u){cp();return}u.call(window.claude,'downloads').then(dl=>{if(!dl){cp();return}dl.save({filename:name,data:blob}).then(()=>toast(okMsg||`Файл ${name} сохранён`,'download'),e=>{if(e&&e.code==='declined')toast('Сохранение отменено','x');else cp()})},cp);return}
  try{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);toast(okMsg||`Файл ${name} скачан`,'download')}catch(e){toast('Не удалось скачать файл','alert',true)}}
const saveJson=(name,obj)=>saveFile(name,new Blob([JSON.stringify(obj,null,1)],{type:'application/json'}));
