'use strict';
// Сессия, права (can) с областью «Свои / Все», функции учётной политики (feat), история изменений (log), уведомления (notify)
/* ═════════════ Session, rights, features ═════════════ */
const S={me:store.get('me','e1'),search:'',navHidden:store.get('nav',false),open:new Set(store.get('tree',[])),preset:null,offline:false};
const PLATFORM_ADMIN={id:'admin',fio:'Администратор платформы',short:'Администратор',login:'admin',role:'admin'};
const me=()=>S.me==='admin'?PLATFORM_ADMIN:EM[S.me]||EMP[0];
const isAdmin=()=>S.me==='admin';
const isOwner=()=>!isAdmin()&&me().role==='owner';
// Представитель заказчика: свои модули «Заказать», «Мои заказы», «Меню», «Счета»; модули организации ему не видны
const isCust=()=>!isAdmin()&&me().role==='customer';
const myRole=()=>ROLES.find(r=>r.id===me().role);
const roleName=id=>(ROLES.find(r=>r.id===id)||{}).name||'';
const empName=id=>id&&EM[id]?EM[id].short:'';
const whoName=id=>!id?'':id==='admin'?'Администратор платформы':id==='system'?'Система':empName(id)||id;
// Организации, где состоит этот человек: один номер телефона — несколько организаций с разными ролями
const myTenants=()=>{if(isAdmin())return [];const ph=me().phone;return Object.entries(DB.tenants).filter(([id,t])=>t.employees.some(e=>e.phone===ph&&e.active!==false&&e.status!=='Приглашён')).map(([id,t])=>({id,name:t.organization.name}))};

/* Права — из справочника платформы «Права ролей» (refDB.json → permissions): группы по модулям, у каждого права название и описание.
   view:true — право просмотра группы, «ворота»: без него остальные права группы не действуют и модуль скрыт.
   scope:true у группы — область «Свои / Все» (свои = записи, где сотрудник ответственный или курьер рейса).
   ownerOnly — есть только у владельца; ownerGrants — выдаёт и снимает только владелец. */
const PGROUPS=()=>REF.permissions;
const PERM=()=>Object.fromEntries(PGROUPS().flatMap(g=>g.perms.map(p=>[p.id,{...p,group:g.id}])));
const permView=g=>{const G=PGROUPS().find(x=>x.id===g);const v=G&&G.perms.find(p=>p.view);return v&&v.id};
const SCOPE_GROUPS=()=>PGROUPS().filter(g=>g.scope).map(g=>g.id);
// Организация приостановлена или закрыта администратором платформы: данные открыты только на чтение (просмотр, выгрузка, деньги, настройки владельца)
const frozen=()=>!isAdmin()&&!!ORG.plat&&['Приостановлена','Закрыта'].includes(ORG.plat.status);
const FROZEN_OK=['viewAll','export','orgMoney','orgSettings'];
// Право действует, только если в роли есть и просмотр своей группы
function can(p){if(isAdmin()||isCust())return false;if(frozen()&&!FROZEN_OK.includes(p)&&!(PERM()[p]||{}).view)return false;if(isOwner())return true;const r=myRole();if(!r||!r.perms.includes(p))return false;const P=PERM()[p];if(!P||P.ownerOnly)return false;const v=permView(P.group);return !v||v===p||r.perms.includes(v)}
const canAny=(...ps)=>ps.some(can);
// Область группы прав: «Свои» или «Все»; общее право «Видеть всё» даёт «Все» во всех группах
const roleScope=r=>Object.fromEntries(SCOPE_GROUPS().map(g=>[g,(r&&r.scope&&r.scope[g])||'own']));
function seeAll(g){if(isAdmin()||isCust())return false;if(isOwner()||can('viewAll'))return true;return roleScope(myRole())[g]==='all'}

/* Учётная политика: функции из refDB.json → features; kind: core — всегда включена, on/off — значение по умолчанию у новой организации */
const FEATS=()=>REF.features;
function feat(f){const F=FEATS().find(x=>x.id===f);if(!F)return true;if(F.kind==='core')return true;return !!ORG.features[f]}

/* История изменений: кто, когда, что было и что стало; системные поля записи — создал, изменил, создано, изменено */
function born(o,who){o._cb=o._ub=who||S.me;o._ca=o._ua=nowStamp();return o}
function touch(o){if(o){o._ub=S.me;o._ua=nowStamp()}return o}
// Изменения администратора платформы пишутся не в историю организации, а в «Журнал платформы» (admin.js → plog)
function log(ent,id,what,obj,who){if(isAdmin()){touch(obj);REV++;return}HIST.push({id:uid('h'),at:nowStamp(),who:who||S.me,ent,rid:id,what});touch(obj);REV++}
const histOf=(ent,id)=>HIST.filter(h=>h.ent===ent&&h.rid===id).sort((a,b)=>a.at<b.at?1:-1);
function auditKv(o){return `<div><span class="k">Создал</span><span class="v">${esc(whoName(o._cb)||'—')}<div class="aud">${fmtDT(o._ca)}</div></span></div><div><span class="k">Изменил</span><span class="v">${esc(whoName(o._ub||o._cb)||'—')}<div class="aud">${fmtDT(o._ua||o._ca)}</div></span></div>`}
function histHtml(ent,id){const hs=histOf(ent,id);return hs.length?`<ul class="tl">${hs.map(h=>`<li><span class="t">${fmtD(h.at.slice(0,10))}<br>${h.at.slice(11)}</span><span>${esc(h.what)}<br><span class="w">${esc(whoName(h.who))}</span></span></li>`).join('')}</ul>`:'<div class="muted">Изменений пока нет.</div>'}
// Одновременная правка: у записи номер версии; сохранение устаревшей версии показывает предупреждение (в продукте это проверяет API)
function stale(o,ver){if((o._v||0)!==ver){toast('Запись изменена другим пользователем: откройте её заново','alert',true);return true}o._v=(o._v||0)+1;return false}

/* Уведомления: push и колокольчик. to — {roles:[...], emps:[...]}; type — из refDB.json → notifyTypes (пользователь может отключить тип в профиле) */
function notify(type,to,text,link){NOTICES.push({id:uid('nt'),at:nowStamp(),type,to,text,link:link||'',read:[]})}
const myNotices=()=>{if(isAdmin())return [];const u=me();return NOTICES.filter(n=>((n.to.roles||[]).includes(u.role)||(n.to.emps||[]).includes(u.id)||(u.role==='owner'&&(n.to.roles||[]).includes('manager')))&&!(u.mute||[]).includes(n.type)).sort((a,b)=>a.at<b.at?1:-1)};
const unread=()=>myNotices().filter(n=>!n.read.includes(S.me)).length;
