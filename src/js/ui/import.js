'use strict';
// Общая загрузка из Excel: шаблон → вставка или файл → «Проверить» (новые, изменённые, без изменений, ошибки) → «Применить» → история загрузок
/* ═════════════ Загрузка из Excel ═════════════ */
/* importDlg(cfg):
   cfg.title, cfg.file — имя шаблона; cfg.key — ключ сопоставления (ИНН, код), никогда номер строки;
   cfg.cols=[{key,label,req,hint,parse(v)→значение, check(v,row)→текст ошибки|''}] — порядок колонок шаблона;
   cfg.find(row)→существующая запись или null; cfg.example — строки-примеры из данных этой организации; cfg.hints — второй лист «Подсказки»;
   cfg.apply(newRows, changed[{rec,row,diff}]) — записать; cfg.log — массив истории загрузок.
   Правила: пустая ячейка не стирает внесённое значение; удаление через загрузку не делается; применяются только строки без ошибок. */
function importDlg(cfg){let parsed=null;
  const tpl=()=>{const rows=[cfg.cols.map(c=>({v:c.label+(c.req?' *':''),s:XL_ST.head})),...(cfg.example||[]).map(r=>cfg.cols.map(c=>r[c.key]??''))];
    const hints=[[{v:'Колонка',s:XL_ST.head},{v:'Обязательная',s:XL_ST.head},{v:'Что вводить',s:XL_ST.head}],...cfg.cols.map(c=>[c.label,c.req?'да':'нет',c.hint||'']),[''],['Пустая ячейка не стирает уже внесённое значение. Строки сопоставляются по колонке «'+cfg.cols.find(c=>c.key===cfg.key).label+'».'],...(cfg.hints||[]).map(h=>[h])];
    saveFile(cfg.file+'.xlsx',xlWrite([{name:'Данные',rows,widths:cfg.cols.map(()=>22),freeze:{y:1}},{name:'Подсказки',rows:hints,widths:[26,14,70]}]),'Шаблон скачан')};
  // Заголовки находятся по названию; без заголовков колонки идут в порядке шаблона
  const parse=rows=>{rows=rows.filter(r=>r&&r.some(x=>String(x??'').trim()!==''));if(!rows.length)return [];const norm=s=>String(s??'').toLowerCase().replace(/\*/g,'').replace(/ё/g,'е').trim();
    const head=rows[0].map(norm);const map=cfg.cols.map(c=>head.indexOf(norm(c.label)));const hasHead=map.some(i=>i>=0);const idx=hasHead?map:cfg.cols.map((c,i)=>i);
    return rows.slice(hasHead?1:0).map((r,n)=>{const row={_n:n+(hasHead?2:1)};const errs=[];cfg.cols.forEach((c,i)=>{const raw=idx[i]>=0?String(r[idx[i]]??'').trim():'';const v=raw===''?'':c.parse?c.parse(raw):raw;row[c.key]=v;
        if(c.req&&v==='')errs.push(`«${c.label}»: не заполнено`);else if(v!==''&&c.check){const e=c.check(v,row);if(e)errs.push(`«${c.label}»: ${e}`)}});
      const rec=errs.length?null:cfg.find(row);let diff=[];if(rec)diff=cfg.cols.filter(c=>row[c.key]!==''&&String(rec[c.key]??'')!==String(row[c.key])).map(c=>({c,from:rec[c.key],to:row[c.key]}));
      return {row,errs,rec,diff,kind:errs.length?'err':!rec?'new':diff.length?'chg':'same'}})};
  // Повтор ключа внутри файла — ошибка строки
  const dupes=list=>{const seen={};list.forEach(x=>{const k=x.row[cfg.key];if(!k)return;if(seen[k]){x.errs.push(`повтор «${k}» в файле (строка ${seen[k]})`);x.kind='err'}else seen[k]=x.row._n})};
  openModal({size:'wide',form:true,render:m=>{const P=parsed;const cnt=k=>P?P.filter(x=>x.kind===k).length:0;
    return {title:cfg.title,sub:'Шаблон → вставка или файл → «Проверить» → «Применить»',body:`<div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn" id="im-tpl">${ic('download','sm')}Выгрузить шаблон</button><button class="btn" id="im-file">${ic('upload','sm')}Выбрать файл .xlsx или .csv</button><button class="linkbtn" id="im-hist">${ic('history','sm')}История загрузок · ${cfg.log.length}</button></div>
      ${fld('Или вставьте строки из Excel',`<textarea class="inp mono" id="im-ta" rows="5" placeholder="Скопируйте строки вместе с заголовками и вставьте сюда"></textarea>`,{full:true,id:'im-ta'})}
      ${P?`<div class="plates" style="margin-top:6px">${plate({id:'n',icon:'plus',color:'green',label:'Новые',value:cnt('new')})}${plate({id:'c',icon:'edit',color:'blue',label:'Изменённые',value:cnt('chg')})}${plate({id:'s',icon:'check',color:'gray',label:'Без изменений',value:cnt('same')})}${plate({id:'e',icon:'alert',color:cnt('err')?'red':'green',label:'Ошибки',value:cnt('err')})}</div>
      <div class="tbl-wrap"><table class="mini m-cards"><thead><tr><th>Строка</th><th>Итог</th>${cfg.cols.map(c=>`<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${P.map(x=>`<tr class="${x.kind==='err'?'warn':''}"><td class="tnum">${x.row._n}</td><td>${x.kind==='err'?`<span class="pill red sm">${ic('alert')}Ошибка</span><div class="hint" style="color:var(--red)">${esc(x.errs.join('; '))}</div>`:x.kind==='new'?`<span class="pill green sm">${ic('plus')}Новая</span>`:x.kind==='chg'?`<span class="pill blue sm">${ic('edit')}Изменится</span>`:`<span class="pill gray sm">${ic('check')}Без изменений</span>`}</td>${cfg.cols.map(c=>{const d=x.diff.find(y=>y.c===c);return `<td>${d?`<span class="faint">${esc(d.from||'—')} →</span> <b>${esc(x.row[c.key])}</b>`:esc(x.row[c.key])}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`:''}`,
      foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn" id="im-check">${ic('check','sm')}Проверить</button>${P?`<button class="btn cta" id="im-ok" ${cnt('new')+cnt('chg')?'':'disabled'}>Применить: ${cnt('new')+cnt('chg')}</button>`:''}`,
      mount(el){const keep=parsed?null:$('#im-ta',el);$('#im-tpl',el).onclick=tpl;
        $('#im-hist',el).onclick=()=>openModal({size:'mid',render:()=>({title:'История загрузок',body:cfg.log.length?`<div class="tbl-wrap"><table class="mini"><thead><tr><th>Когда</th><th>Кто</th><th>Источник</th><th class="num">Новых</th><th class="num">Изменено</th><th class="num">Ошибок</th></tr></thead><tbody>${cfg.log.slice().reverse().map(l=>`<tr><td class="tnum">${fmtDT(l.at)}</td><td>${esc(whoName(l.who))}</td><td>${esc(l.src)}</td><td class="num">${l.n}</td><td class="num">${l.c}</td><td class="num">${l.e}</td></tr>`).join('')}</tbody></table></div>`:'<div class="muted">Загрузок ещё не было.</div>',foot:'<button class="btn cta" data-close>Закрыть</button>'})});
        const run=(rows,src)=>{parsed=parse(rows);dupes(parsed);m.src=src;m.draw()};
        $('#im-file',el).onclick=()=>{const f=document.createElement('input');f.type='file';f.accept='.xlsx,.csv,.txt';f.onchange=()=>{const x=f.files[0];if(x)xlRead(x).then(r=>run(r,x.name),e=>toast(e.message,'alert',true))};f.click()};
        // Разделитель определяется сам: табуляция (копия из Excel) или «;»
        $('#im-check',el).onclick=()=>{const t=$('#im-ta',el)?$('#im-ta',el).value:'';if(!t.trim()){if(!parsed)toast('Вставьте строки или выберите файл','info');else m.draw();return}const d=t.includes('\t')?'\t':';';run(t.split(/\r?\n/).map(l=>l.split(d)),'Вставка')};
        if($('#im-ok',el))$('#im-ok',el).onclick=()=>{const nw=parsed.filter(x=>x.kind==='new'),ch=parsed.filter(x=>x.kind==='chg'),er=parsed.filter(x=>x.kind==='err').length;
          confirmDlg({title:'Применить загрузку?',text:`Будет добавлено: ${nw.length}, изменено: ${ch.length}. Строки с ошибками (${er}) не загрузятся. Пустые ячейки ничего не стирают.`,ok:'Применить',run:()=>{cfg.apply(nw.map(x=>x.row),ch);cfg.log.push({at:nowStamp(),who:S.me,src:m.src||'Вставка',n:nw.length,c:ch.length,e:er});m.close();refreshAll();toast(`Загружено: новых ${nw.length}, изменено ${ch.length}`,'upload')}})}}}}})}
