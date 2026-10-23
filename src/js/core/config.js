'use strict';
// Настройки приложения: название, часовой пояс, валюта, 4 модуля нижней панели телефона для каждой роли
/* ═════════════ Config ═════════════ */
const APP={
  name:'Eda',                            // показывается в левой панели, в «≡» и в заголовке
  sub:'Учёт для столовых и доставки',     // подпись под названием
  prefix:'eda',                          // префикс ключей localStorage: у каждого приложения свой, чтобы настройки не смешивались
  ver:'v2 · 23.10.2026',                 // номер версии прототипа: растёт с каждой выдачей (и <title> в index.html)
  tz:'Asia/Bishkek',tzLabel:'Бишкек',    // часовой пояс организации: «сегодня», «на завтра» и закрытие приёма считаются по нему
  currency:'сом',                        // одна валюта; в продукте деньги хранятся целым числом в тыйынах
  mobileMax:767,                         // граница ПК и телефона: до 767 px — телефон (как в mobile.css)
  // Нижняя панель телефона — ровно 4 основных модуля роли, остальные в «≡ Другие модули» (ТЗ «Рабочая страница»)
  bnav:{
    roles:{owner:['home','orders','kitchen','money'],manager:['home','orders','kitchen','money'],chef:['kitchen','menu','dishes','stock'],cook:['kitchen','menu','dishes','stock'],
      store:['stock','kitchen','home','dishes'],courier:['route','delivery','home','money'],acc:['money','customers','reports','home'],customer:['c-order','c-orders','c-menu','c-bills']},
    business:['home','orders','kitchen','money'],                      // для ролей, созданных владельцем
    admin:['tenants','accounts','pdicts','plog']},
};
