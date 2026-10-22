'use strict';
// Пустые состояния первого входа и подсказки «ⓘ»
/* ═════════════ Пустые состояния ═════════════ */
// Модуль задаёт empty() в реестре: {icon, title, text, btns:[[подпись, значок, действие, основная?]]}; показывается, только когда в модуле нет данных совсем.
// Пустота из-за фильтра или поиска показывает «Ничего не найдено» и «Сбросить фильтры» (это делает список сам)
function firstEmpty(){const m=curMod();return m&&m.empty?m.empty()||null:null}
function feHtml(e){return `<div class="state fe">${ic(e.icon,'lg')}<b>${esc(e.title)}</b>${e.text?`<span>${esc(e.text)}</span>`:''}<div class="row" style="justify-content:center">${e.btns.filter(Boolean).map((b,i)=>`<button class="btn ${b[3]?'cta':''}" data-a="fe" data-i="${i}">${ic(b[1])}${esc(b[0])}</button>`).join('')}</div></div>`}
// Маленький «ⓘ» у сложных полей и кнопок: пояснение по наведению (ПК) или нажатию (телефон)
const tipI=t=>`<button type="button" class="icon-btn sm tipi" data-tip="${esc(t)}" aria-label="Пояснение">${ic('info','sm')}</button>`;
document.addEventListener('click',e=>{const b=e.target.closest('.tipi');if(!b)return;e.preventDefault();e.stopPropagation();openPop(b,`<div style="padding:6px 8px;font-size:13px;line-height:1.5;max-width:300px">${esc(b.dataset.tip)}</div>`)},true);
