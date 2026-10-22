'use strict';
// Запуск: сохранение рабочих данных (TemDB), кнопки «Данные прототипа», первая отрисовка
/* ═════════════ Start ═════════════ */
function dbAfter(msg){Object.keys(GS).forEach(k=>delete GS[k]);MODALS.slice().forEach(m=>m.close());closeSheet();closePop();S.me=EMP[0]?EMP[0].id:'admin';store.set('me',S.me);S.mod=null;S.tab=null;
  if(location.hash==='#home')route();else location.hash='#home';dbSave();toast(msg,'refresh')}
function setDataMode(v){DATA_MODE=v;store.set('data',v);dbApply(dbFresh(v));dbAfter(v==='empty'?'Пустая организация: как сразу после регистрации':'Включены демо-данные')}
function dbAct(k){
  if(k==='export'){dbSave();saveJson('TemDB.json',DB);return}
  if(k==='ref'){saveJson('refDB.json',{...REF,meta:{file:'refDB.json',version:DB_VER,exported:nowStamp(),description:'Справочники платформы с правками администратора из прототипа'}});return}
  if(k==='clear'){confirmDlg({title:'Очистить рабочие данные?',text:`Всё, что вы ввели и изменили, пропадёт, в том числе правки справочников. Данные вернутся к ${DATA_MODE==='empty'?'пустой организации':'demoDB.json'}.`,ok:'Очистить',danger:true,run:()=>{dbApply(dbFresh(DATA_MODE));dbAfter('Рабочие данные очищены')}});return}
  if(k==='load'){const f=document.createElement('input');f.type='file';f.accept='.json,application/json';
    f.onchange=()=>{const x=f.files[0];if(!x)return;x.text().then(tx=>{let j=null;try{j=JSON.parse(tx)}catch(e){}
      if(!j||!j.meta||!['TemDB.json','demoDB.json'].includes(j.meta.file)){toast('Это не файл TemDB.json: нет блока meta с именем файла','alert',true);return}
      const {db,miss}=dbFill(j);confirmDlg({title:'Загрузить TemDB.json?',text:`В файле: ${esc(dbSum(db))}. Сейчас: ${esc(dbSum(DB))}. Текущие рабочие данные будут заменены.${miss.length?`<br><br><b>В файле не хватает разделов:</b> ${esc(miss.join(', '))} — они будут взяты из шаблона.`:''}`,ok:'Загрузить',danger:true,
        run:()=>{db.meta={...j.meta,file:'TemDB.json',version:DB_VER};dbApply(db);dbAfter('Рабочие данные загружены из файла')}})})};f.click()}}
// Каждое действие пользователя сохраняется в TemDB (localStorage) через 0,7 с; при закрытии страницы — сразу
['click','change','input','keydown','drop','paste'].forEach(ev=>document.addEventListener(ev,dbSoon,true));
addEventListener('pagehide',()=>{if(dbT)dbSave()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&dbT)dbSave()});
if(S.me!=='admin'&&!EM[S.me])S.me=EMP[0]?EMP[0].id:'admin';
initTop();dbSave();
if(DBMISS.length)setTimeout(()=>toast('В сохранённых рабочих данных не хватало разделов: '+DBMISS.join(', ')+'. Они взяты из шаблона','alert'),600);
if(!location.hash||location.hash==='#')history.replaceState(null,'','#home');
route();
