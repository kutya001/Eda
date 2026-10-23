'use strict';
// Карта точек (ТЗ «Карта точек»): одна схема для «Доставка → Карта», «Маршрут», «Кухня → Требование» и выбора геоточки адреса.
// В продукте — карта 2ГИС с геокодером; в макете — схема Бишкека: улицы, реки, парки, маркеры адресов, места скопления одним маркером, кластеры при отдалении, линии рейсов
/* ═════════════ Карта точек ═════════════ */
// Плоская проекция вокруг центра Бишкека: км на градус долготы и широты
const MAP0=[42.8700,74.6000],KX=81.6,KY=111.2;
const gXY=g=>[(g[1]-MAP0[1])*KX,(MAP0[0]-g[0])*KY];
const xyG=(x,y)=>[Math.round((MAP0[0]-y/KY)*1e4)/1e4,Math.round((MAP0[1]+x/KX)*1e4)/1e4];
const geoTxt=g=>hasGeo(g)?g[0].toFixed(4)+', '+g[1].toFixed(4):'';
// Схема города: главные улицы, реки и канал, парки [название, точки]
const MAP_ST=[['пр. Жибек Жолу',[[42.8888,74.52],[42.8885,74.60],[42.8880,74.68]]],['пр. Чуй',[[42.8770,74.52],[42.8766,74.60],[42.8762,74.68]]],['ул. Токтогула',[[42.8722,74.55],[42.8720,74.65]]],
  ['ул. Л. Толстого',[[42.8640,74.52],[42.8642,74.60]]],['ул. Горького',[[42.8552,74.56],[42.8548,74.66]]],['ул. Ахунбаева',[[42.8442,74.55],[42.8438,74.67]]],['Южная магистраль',[[42.8280,74.54],[42.8270,74.67]]],
  ['пр. Молодой Гвардии',[[42.905,74.5670],[42.820,74.5672]]],['пр. Манаса',[[42.890,74.5880],[42.835,74.5878]]],['ул. Советская',[[42.905,74.6090],[42.815,74.6092]]],['ул. Фучика',[[42.905,74.6232],[42.860,74.6236]]],['ул. Шабдан Баатыра',[[42.900,74.6380],[42.825,74.6382]]]];
const MAP_RV=[['р. Ала-Арча',[[42.915,74.553],[42.890,74.557],[42.865,74.551],[42.840,74.556],[42.810,74.552]]],['р. Аламедин',[[42.915,74.647],[42.890,74.643],[42.865,74.649],[42.840,74.644],[42.810,74.650]]],['БЧК',[[42.9060,74.52],[42.9045,74.60],[42.9070,74.68]]]];
const MAP_PK=[['Дубовый парк',[42.8805,74.6050],[42.8783,74.6110]],['Ботанический сад',[42.8565,74.6200],[42.8500,74.6310]],['Парк Ататюрк',[42.8430,74.5950],[42.8385,74.6045]]];
const mapCol=c=>!c?'var(--blue)':c[0]==='#'?c:`var(--${c==='gray'?'muted':c})`;
const MAPV={};
/* cfg: key — запомнить вид между перерисовками; points — [{id, geo, n (порций), label, title, color, approx, num, done (галочка), bad (крестик), sel}]; kitchen — геоточка кухни;
   lines — [{color, geo:[…]}]; legend — [[цвет, подпись]]; onPick(point, el) — клик по маркеру; pick — {geo, near, onSet(geo)} — режим выбора геоточки */
function mapView(host,cfg){const st=cfg.key&&MAPV[cfg.key]?MAPV[cfg.key]:{s:0,cx:0,cy:0};if(cfg.key)MAPV[cfg.key]=st;
  host.innerHTML=`<div class="emap ${cfg.pick?'picking':''}" aria-label="Карта точек"><svg class="em-svg" aria-hidden="true"></svg><div class="em-mk"></div>
    <div class="em-ctl"><button type="button" class="icon-btn" data-z="1" aria-label="Приблизить" title="Приблизить">+</button><button type="button" class="icon-btn" data-z="-1" aria-label="Отдалить" title="Отдалить">−</button><button type="button" class="btn sm" data-fit title="Вписать всё" aria-label="Вписать всё">${ic('maximize','sm')}<span class="em-ft">Вписать всё</span></button></div>
    <div class="em-attr">Схема Бишкека · в продукте — 2ГИС</div></div>${cfg.legend&&cfg.legend.length?`<div class="em-leg">${cfg.legend.map(([c,l])=>`<span><i style="background:${mapCol(c)}"></i>${esc(l)}</span>`).join('')}</div>`:''}`;
  const box=$('.emap',host),svg=$('.em-svg',box),mk=$('.em-mk',box);let groups=[];
  const W=()=>box.clientWidth||600,H=()=>box.clientHeight||400;
  const toS=g=>{const[x,y]=gXY(g);return [(x-st.cx)*st.s+W()/2,(y-st.cy)*st.s+H()/2]};
  const toW=(sx,sy)=>[(sx-W()/2)/st.s+st.cx,(sy-H()/2)/st.s+st.cy];
  const geos=()=>[...cfg.points.filter(p=>hasGeo(p.geo)).map(p=>p.geo),...(hasGeo(cfg.kitchen)?[cfg.kitchen]:[]),...(cfg.pick&&hasGeo(cfg.pick.geo)?[cfg.pick.geo]:[])];
  function fit(gs,maxS=260){gs=(gs||geos()).filter(hasGeo);if(!gs.length)gs=[MAP0];const xy=gs.map(gXY);const xs=xy.map(p=>p[0]),ys=xy.map(p=>p[1]);
    st.cx=(Math.min(...xs)+Math.max(...xs))/2;st.cy=(Math.min(...ys)+Math.max(...ys))/2;st.s=Math.max(14,Math.min(maxS,(W()-90)/Math.max(.5,Math.max(...xs)-Math.min(...xs)),(H()-90)/Math.max(.5,Math.max(...ys)-Math.min(...ys))));draw()}
  function zoom(k,sx=W()/2,sy=H()/2){const[wx,wy]=toW(sx,sy);st.s=Math.max(14,Math.min(1600,st.s*k));st.cx=wx-(sx-W()/2)/st.s;st.cy=wy-(sy-H()/2)/st.s;draw()}
  const path=pts=>pts.map((g,i)=>{const[x,y]=toS(g);return (i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join('');
  const sz=n=>Math.round(28+Math.min(26,Math.sqrt(n||1)*3.4));
  function draw(){const w=W(),h=H();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);const lbl=st.s>55;
    svg.innerHTML=MAP_PK.map(([n,a,b])=>{const[x0,y0]=toS(a),[x1,y1]=toS(b);return `<rect class="em-pk" x="${Math.min(x0,x1)}" y="${Math.min(y0,y1)}" width="${Math.abs(x1-x0)}" height="${Math.abs(y1-y0)}" rx="4"/>${lbl?`<text class="em-pt" x="${(x0+x1)/2}" y="${(y0+y1)/2+3}">${esc(n)}</text>`:''}`}).join('')+
      MAP_RV.map(([n,pts])=>`<path class="em-rv" d="${path(pts)}"/>`).join('')+
      MAP_ST.map(([n,pts])=>{const[a,b]=[toS(pts[0]),toS(pts[pts.length-1])];const v=Math.abs(b[1]-a[1])>Math.abs(b[0]-a[0]);const m=toS(pts[Math.floor(pts.length/2)]);
        return `<path class="em-st" d="${path(pts)}"/>${lbl?`<text class="em-sn" x="${m[0]+(v?6:0)}" y="${m[1]-(v?0:5)}" ${v?`transform="rotate(-90 ${m[0]+6} ${m[1]})"`:''}>${esc(n)}</text>`:''}`}).join('')+
      (cfg.lines||[]).map(l=>{const gs=l.geo.filter(hasGeo);return gs.length>1?`<path class="em-ln" d="${path(gs)}" style="stroke:${mapCol(l.color)}"/>`:''}).join('');
    // Кластеры: близкие на экране маркеры объединяются в кружок с суммой порций и числом точек
    const ps=cfg.points.filter(p=>hasGeo(p.geo)).map(p=>({p,xy:toS(p.geo)}));const used=new Set();groups=[];const R=cfg.noCluster?0:38;
    ps.slice().sort((a,b)=>(b.p.n||0)-(a.p.n||0)).forEach(a=>{if(used.has(a))return;used.add(a);const g=[a];if(R)ps.forEach(b=>{if(!used.has(b)&&Math.hypot(a.xy[0]-b.xy[0],a.xy[1]-b.xy[1])<R){used.add(b);g.push(b)}});groups.push(g)});
    const vis=([x,y])=>x>-60&&y>-60&&x<w+60&&y<h+60;
    mk.innerHTML=(hasGeo(cfg.kitchen)&&vis(toS(cfg.kitchen))?(([x,y])=>`<span class="em-k" style="left:${x}px;top:${y}px" title="Кухня: ${esc(ORG.address||'')}">${ic('flame','sm')}<span class="em-l">Кухня</span></span>`)(toS(cfg.kitchen)):'')+
      groups.map((g,i)=>{if(g.length===1){const{p,xy:[x,y]}=g[0];if(!vis([x,y]))return '';return `<button type="button" class="em-m ${p.approx?'approx':''} ${p.done?'done':''} ${p.sel?'sel':''}" data-mi="${i}" style="left:${x}px;top:${y}px;--d:${sz(p.n)}px;--c:${mapCol(p.color)}" title="${esc(p.title||p.label||'')}"><b>${p.bad?ic('x','sm'):p.done?ic('check','sm'):esc(p.num!=null?p.num:p.n)}</b>${p.label&&(p.big||st.s>70)?`<span class="em-l">${esc(p.label)}</span>`:''}</button>`}
        const n=g.reduce((a,x)=>a+(x.p.n||0),0);const x=g.reduce((a,q)=>a+q.xy[0],0)/g.length,y=g.reduce((a,q)=>a+q.xy[1],0)/g.length;if(!vis([x,y]))return '';
        return `<button type="button" class="em-m em-cl" data-ci="${i}" style="left:${x}px;top:${y}px;--d:${sz(n)+8}px" title="${g.length} ${plural(g.length,'точка','точки','точек')}: приблизить"><b>${n}</b><em>${g.length} ${plural(g.length,'точка','точки','точек')}</em></button>`}).join('')+
      (cfg.pick&&hasGeo(cfg.pick.geo)?(([x,y])=>`<span class="em-pin" style="left:${x}px;top:${y}px">${ic('pin')}</span>`)(toS(cfg.pick.geo)):'')}
  // Перетаскивание, колесо мыши, два пальца; клик без сдвига — выбор геоточки в режиме pick
  const pts=new Map();let drag=null,pinch=null;
  box.addEventListener('pointerdown',e=>{if(e.target.closest('.em-ctl,.em-m'))return;pts.set(e.pointerId,[e.clientX,e.clientY]);try{box.setPointerCapture(e.pointerId)}catch(x){}
    if(pts.size===1)drag={x:e.clientX,y:e.clientY,cx:st.cx,cy:st.cy,moved:false};
    if(pts.size===2){const[a,b]=[...pts.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),s:st.s};drag=null}});
  box.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);
    if(pinch&&pts.size===2){const[a,b]=[...pts.values()];const r=box.getBoundingClientRect();const k=Math.hypot(a[0]-b[0],a[1]-b[1])/pinch.d;zoom(pinch.s*k/st.s,(a[0]+b[0])/2-r.left,(a[1]+b[1])/2-r.top);return}
    if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;drag.moved=true;box.classList.add('grab');st.cx=drag.cx-dx/st.s;st.cy=drag.cy-dy/st.s;draw()});
  const up=e=>{if(!pts.has(e.pointerId))return;pts.delete(e.pointerId);box.classList.remove('grab');
    if(drag&&!drag.moved&&cfg.pick&&e.type==='pointerup'){const r=box.getBoundingClientRect();const[wx,wy]=toW(e.clientX-r.left,e.clientY-r.top);cfg.pick.geo=xyG(wx,wy);cfg.pick.onSet(cfg.pick.geo);draw()}
    if(pts.size<2)pinch=null;if(!pts.size)drag=null};
  box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
  box.addEventListener('wheel',e=>{e.preventDefault();const r=box.getBoundingClientRect();zoom(e.deltaY<0?1.25:.8,e.clientX-r.left,e.clientY-r.top)},{passive:false});
  $$('[data-z]',box).forEach(b=>b.onclick=()=>zoom(+b.dataset.z>0?1.5:1/1.5));$('[data-fit]',box).onclick=()=>fit();
  mk.addEventListener('click',e=>{const m=e.target.closest('[data-mi]');if(m){const g=groups[+m.dataset.mi];if(g&&cfg.onPick)cfg.onPick(g[0].p,m);return}
    const c=e.target.closest('[data-ci]');if(c){const g=groups[+c.dataset.ci];if(g)fit(g.map(x=>x.p.geo),Math.max(st.s*2.2,120))}});
  // Первый вид — когда у карты появился размер (окно могло ещё открываться): вписать все точки или показать выбранную геоточку
  let started=false,w0=0;const start=()=>{if(started||!box.clientWidth)return;started=true;w0=box.clientWidth;
    if(!st.s){if(cfg.pick&&(hasGeo(cfg.pick.geo)||hasGeo(cfg.pick.near))){const g=hasGeo(cfg.pick.geo)?cfg.pick.geo:cfg.pick.near;const[x,y]=gXY(g);st.cx=x;st.cy=y;st.s=240;draw()}else fit()}else draw()};
  requestAnimationFrame(start);if(window.ResizeObserver)new ResizeObserver(()=>{if(!started)return start();if(box.clientWidth&&box.clientWidth!==w0){w0=box.clientWidth;draw()}}).observe(box)
  return {fit,draw,focus(geo,s=170){if(!hasGeo(geo))return;const[x,y]=gXY(geo);st.cx=x;st.cy=y;st.s=Math.max(st.s,s);draw()}}}
// «Указать на карте»: геоточка адреса; в продукте её сначала ставит геокодер 2ГИС по адресу
function mapPickDlg({title,sub,geo,near},done){const st={geo:hasGeo(geo)?geo.slice():null};
  openModal({size:'wide',noMax:true,render:m=>({title:title||'Указать на карте',sub:sub||'',body:`<div class="note">${ic('pin')}<span>Нажмите на карту там, где адрес. В продукте геоточку сначала ставит геокодер по адресу, здесь её можно уточнить.</span></div><div id="mp-map"></div><div class="hint" id="mp-g">${st.geo?'Геоточка: '+geoTxt(st.geo):'Геоточка не выбрана'}</div>`,
    foot:`<button class="btn ghost" data-close>Отмена</button><button class="btn cta" id="mp-ok" ${st.geo?'':'disabled'}>${ic('pin','sm')}Сохранить геоточку</button>`,
    mount(el){mapView($('#mp-map',el),{points:[],kitchen:ORG.geo,pick:{geo:st.geo,near:hasGeo(near)?near:ORG.geo,onSet:g=>{st.geo=g;$('#mp-g',el).textContent='Геоточка: '+geoTxt(g);$('#mp-ok',el).disabled=false}}});
      $('#mp-ok',el).onclick=()=>{m.close();done(st.geo)}}})})}
