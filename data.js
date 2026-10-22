'use strict';
// Данные: demoDB.json, TemDB.json, refDB.json (папка data или встроенная копия), рабочие данные в localStorage, скачивание файлов
/* ═════════════ Данные прототипа ═════════════ */
/* Прототип — каркас: ни одной записи данных в коде. На GitHub Pages файлы читаются из папки data,
   в артефакте и при открытии с диска — из копии, которую сборка (build.py) встраивает в страницу (блоки db-*).
   demoDB.json — демо-организация, TemDB.json — пустая организация (шаблон), refDB.json — справочники платформы.
   Рабочие данные (TemDB) живут в localStorage: всё, что пользователь ввёл, переживает перезагрузку. */
const DB_VER=1,DB_KEY=APP.prefix+'.temdb';
const DB_FILES={demo:'demoDB.json',empty:'TemDB.json',ref:'refDB.json'};
// Разделы данных организации: при добавлении сущности допишите её сюда и в demoDB.json / TemDB.json
const DB_ORG_KEYS=['organization','roles','employees','clients','requests','history'];
function dbRead(name,id){
  if(/^https?:/.test(location.protocol))try{const x=new XMLHttpRequest();x.open('GET','data/'+name+'?v='+Date.now(),false);x.send();
    if(x.status===200){const v=JSON.parse(x.responseText);if(v&&v.meta&&v.meta.file===name)return {db:v,from:'папка data'}}}catch(e){}
  const el=document.getElementById(id);if(el)try{return {db:JSON.parse(el.textContent),from:'встроенная копия'}}catch(e){}
  return {db:{meta:{file:name}},from:'нет файла'}}
const DBSRC={demo:dbRead(DB_FILES.demo,'db-demo'),empty:dbRead(DB_FILES.empty,'db-tem'),ref:dbRead(DB_FILES.ref,'db-ref')};
let DATA_MODE=store.get('data','demo'),DBMISS=[];
// Недостающие разделы (старый или чужой файл) берутся из пустого шаблона и refDB.json — прототип не ломается, а показывает, чего не хватило
function dbFill(db){const miss=[],e=DBSRC.empty.db,r=DBSRC.ref.db;db.meta=db.meta||{};
  DB_ORG_KEYS.forEach(k=>{if(db[k]==null){miss.push(k);db[k]=structuredClone(e[k]!=null?e[k]:k==='organization'?{}:[])}});
  db.ref=db.ref||{};Object.keys(r).forEach(k=>{if(k!=='meta'&&db.ref[k]==null)db.ref[k]=structuredClone(r[k])});
  return {db,miss}}
// Новые рабочие данные: демо-организация или пустая (как сразу после регистрации)
function dbFresh(mode){const src=structuredClone(mode==='empty'?DBSRC.empty.db:DBSRC.demo.db);const {db}=dbFill(src);db.meta={...db.meta,file:'TemDB.json',version:DB_VER,mode};return db}
function dbLoad(){let db=null;try{const t=localStorage.getItem(DB_KEY);if(t)db=JSON.parse(t)}catch(e){}
  if(!db||!db.meta)return dbFresh(DATA_MODE);const r=dbFill(db);DBMISS=r.miss;return r.db}
let DB=dbLoad();
// Короткие имена разделов; после замены данных (dbApply) указывают на новые массивы
let ORG,ROLES,EMP,EM,REF,DICT,CLIENTS,CLM,REQUESTS,HIST;
function dbBind(){ORG=DB.organization;ROLES=DB.roles;EMP=DB.employees;EM=Object.fromEntries(EMP.map(e=>[e.id,e]));REF=DB.ref;DICT=REF.dictionaries;
  CLIENTS=DB.clients;CLM=Object.fromEntries(CLIENTS.map(c=>[c.id,c]));REQUESTS=DB.requests;HIST=DB.history;ORG.features=ORG.features||{};ORG.policy=ORG.policy||{}}
dbBind();
const reindex=()=>{EM=Object.fromEntries(EMP.map(e=>[e.id,e]));CLM=Object.fromEntries(CLIENTS.map(c=>[c.id,c]))};
let dbT=null,dbWarned=false;
function dbSave(){clearTimeout(dbT);dbT=null;DB.meta.saved=nowStamp();try{localStorage.setItem(DB_KEY,JSON.stringify(DB))}catch(e){if(!dbWarned){dbWarned=true;toast('Не удалось сохранить рабочие данные: в браузере не хватает места','alert',true)}}}
const dbSoon=()=>{clearTimeout(dbT);dbT=setTimeout(dbSave,700)};
function dbApply(db){DB=db;dbBind()}
const dbSum=db=>`${(db.clients||[]).length} клиентов, ${(db.requests||[]).length} заявок, ${(db.employees||[]).length} сотрудников`;
// Скачать файл. В артефакте claude.ai прямое скачивание запрещено: файл предлагается через возможность downloads, иначе текст копируется в буфер
function saveFile(name,blob,okMsg){
  if(window.top!==window.self){const u=window.claude&&window.claude.use;const cp=()=>blob.text().then(t=>/json|text/.test(blob.type)?copyText(t,`Скопировано: сохраните как ${name}`):toast('Скачивание недоступно в этом окне: откройте прототип в браузере','alert',true));
    if(!u){cp();return}u.call(window.claude,'downloads').then(dl=>{if(!dl){cp();return}dl.save({filename:name,data:blob}).then(()=>toast(okMsg||`Файл ${name} сохранён`,'download'),e=>{if(e&&e.code==='declined')toast('Сохранение отменено','x');else cp()})},cp);return}
  try{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);toast(okMsg||`Файл ${name} скачан`,'download')}catch(e){toast('Не удалось скачать файл','alert',true)}}
const saveJson=(name,obj)=>saveFile(name,new Blob([JSON.stringify(obj,null,1)],{type:'application/json'}));
