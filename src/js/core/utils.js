'use strict';
// Общие утилиты: $, esc, store (localStorage), даты по часовому поясу организации, деньги, метки статусов
/* ═════════════ Utils ═════════════ */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Настройки вида (списки g5.*, статистика stats.*) запоминаются для каждого пользователя отдельно
const MEMSTORE={};const ukey=k=>/^(g5|stats)\./.test(k)&&typeof S!=='undefined'&&S.me?k.replace('.','.'+S.me+'.'):k;
const store={get(k,d){k=ukey(k);if(k in MEMSTORE)return MEMSTORE[k];try{const v=localStorage.getItem(APP.prefix+'.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){k=ukey(k);MEMSTORE[k]=v;try{localStorage.setItem(APP.prefix+'.'+k,JSON.stringify(v))}catch(e){}}};
const isMobile=()=>matchMedia(`(max-width: ${APP.mobileMax}px)`).matches;
const plural=(n,a,b,c)=>{const m=Math.abs(n)%100,k=m%10;return m>10&&m<20?c:k>1&&k<5?b:k===1?a:c};
const uid=p=>p+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);
const initials=fio=>String(fio||'').split(' ').slice(0,2).map(w=>w[0]||'').join('');
// Хук обучения: модули и компоненты сообщают о первом использовании функции (поиск, «Столбцы», свайп…). В шаблоне ничего не делает
function track(name){}

/* Даты — всё по часовому поясу организации */
function tzNow(){
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:APP.tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const g=t=>(p.find(x=>x.type===t)||{}).value;
  return {iso:`${g('year')}-${g('month')}-${g('day')}`,hm:`${g('hour')}:${g('minute')}`};
}
let TODAY=tzNow().iso;
const nowStamp=()=>TODAY+' '+tzNow().hm;
const fmtD=s=>s?`${s.slice(8,10)}.${s.slice(5,7)}.${s.slice(0,4)}`:'';
const fmtDT=v=>v?fmtD(String(v).slice(0,10))+(String(v).length>10?' '+String(v).slice(11,16):''):'';
const stAt=s=>new Date(String(s).replace(' ','T')+(String(s).length>10?':00':'T00:00:00')+'Z').getTime();
const addDays=(iso,n)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
// Деньги: «1 250,50»; в данных прототипа — числом с копейками, в продукте — целым числом в минимальных единицах
function fmtM(n,dec=true){if(n==null||n===''||isNaN(n))return '';const neg=n<0;const v=Math.abs(+n);const[i,f]=v.toFixed(dec?2:0).split('.');return (neg?'−':'')+i.replace(/\B(?=(\d{3})+(?!\d))/g,' ')+(f?','+f:'')}
const money=n=>fmtM(n,(Math.round(n*100)%100)!==0)+' '+APP.currency;
// Метка статуса: цвет всегда вместе с текстом и значком (паттерны, раздел 1)
const stl=s=>s;
const pill=(text,map,extra='')=>{const[c,i]=(map&&map[text])||['gray','circle'];return `<span class="pill ${c} ${extra}">${ic(i)}${esc(stl(text))}</span>`};
