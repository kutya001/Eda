'use strict';
// Сессия, права (can) с областью «Свои / Все», функции учётной политики (feat), история изменений (log)
/* ═════════════ Session, rights, features ═════════════ */
const S={me:store.get('me','e1'),search:'',navHidden:store.get('nav',false),open:new Set(store.get('tree',[])),preset:null};
const PLATFORM_ADMIN={id:'admin',fio:'Администратор платформы',short:'Администратор',login:'admin'};
const me=()=>S.me==='admin'?PLATFORM_ADMIN:EM[S.me]||EMP[0];
const isAdmin=()=>S.me==='admin';
const isOwner=()=>!isAdmin()&&me().role==='owner';
const myRole=()=>ROLES.find(r=>r.id===me().role);
const empName=id=>id&&EM[id]?EM[id].short:'';
const whoName=id=>!id?'':id==='admin'?'Администратор платформы':id==='system'?'Система':empName(id)||id;

/* Права — из справочника платформы «Права ролей» (refDB.json → permissions): группы по модулям, у каждого права название и описание.
   view:true — право просмотра группы, «ворота»: без него остальные права группы не действуют и модуль скрыт.
   scope:true у группы — область «Свои / Все» (свои = записи, где сотрудник ответственный).
   ownerOnly — есть только у владельца; ownerGrants — выдаёт и снимает только владелец. */
const PGROUPS=()=>REF.permissions;
const PERM=()=>Object.fromEntries(PGROUPS().flatMap(g=>g.perms.map(p=>[p.id,{...p,group:g.id}])));
const permView=g=>{const G=PGROUPS().find(x=>x.id===g);const v=G&&G.perms.find(p=>p.view);return v&&v.id};
const SCOPE_GROUPS=()=>PGROUPS().filter(g=>g.scope).map(g=>g.id);
// Право действует, только если в роли есть и просмотр своей группы
function can(p){if(isAdmin())return false;if(isOwner())return true;const r=myRole();if(!r||!r.perms.includes(p))return false;const P=PERM()[p];if(!P||P.ownerOnly)return false;const v=permView(P.group);return !v||v===p||r.perms.includes(v)}
// Область группы прав: «Свои» или «Все»; общее право «Видеть всё» даёт «Все» во всех группах
const roleScope=r=>Object.fromEntries(SCOPE_GROUPS().map(g=>[g,(r&&r.scope&&r.scope[g])||'own']));
function seeAll(g){if(isAdmin())return false;if(isOwner()||can('viewAll'))return true;return roleScope(myRole())[g]==='all'}
// Видимые записи: одна функция области на группу, через неё идут все списки, плашки и счётчики
const visClients=(all)=>{const a=seeAll('clients');return CLIENTS.filter(c=>(all||c.status!=='В архиве')&&(a||c.resp===S.me))};
const visRequests=()=>{const a=seeAll('requests');return REQUESTS.filter(r=>a||r.resp===S.me||r.by===S.me)};

/* Учётная политика: функции из refDB.json → features; kind: core — всегда включена, on/off — значение по умолчанию у новой организации */
const FEATS=()=>REF.features;
function feat(f){const F=FEATS().find(x=>x.id===f);if(!F)return true;if(F.kind==='core')return true;return !!ORG.features[f]}

/* История изменений: кто, когда, что было и что стало; системные поля записи — создал, изменил, создано, изменено */
function born(o,who){o._cb=o._ub=who||S.me;o._ca=o._ua=nowStamp();return o}
function touch(o){if(o){o._ub=S.me;o._ua=nowStamp()}return o}
function log(ent,id,what,obj){HIST.push({id:uid('h'),at:nowStamp(),who:S.me,ent,rid:id,what});touch(obj)}
const histOf=(ent,id)=>HIST.filter(h=>h.ent===ent&&h.rid===id).sort((a,b)=>a.at<b.at?1:-1);
function auditKv(o){return `<div><span class="k">Создал</span><span class="v">${esc(whoName(o._cb)||'—')}<div class="aud">${fmtDT(o._ca)}</div></span></div><div><span class="k">Изменил</span><span class="v">${esc(whoName(o._ub||o._cb)||'—')}<div class="aud">${fmtDT(o._ua||o._ca)}</div></span></div>`}
function histHtml(ent,id){const hs=histOf(ent,id);return hs.length?`<ul class="tl">${hs.map(h=>`<li><span class="t">${fmtD(h.at.slice(0,10))}<br>${h.at.slice(11)}</span><span>${esc(h.what)}<br><span class="w">${esc(whoName(h.who))}</span></span></li>`).join('')}</ul>`:'<div class="muted">Изменений пока нет.</div>'}
// Одновременная правка: у записи номер версии; сохранение устаревшей версии показывает предупреждение (в продукте это проверяет API)
function stale(o,ver){if((o._v||0)!==ver){toast('Запись изменена другим пользователем: откройте её заново','alert',true);return true}o._v=(o._v||0)+1;return false}
