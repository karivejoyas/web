// ============================================================
//  BOT DE ENCARGOS · KARIVÉ JOYAS (Telegram)
//  Para anotar un encargo en segundos desde el celular: le escribes al bot como
//  hablas (o le mandas un audio) y Gemini lo entiende y lo anota; o con /nuevo
//  te va preguntando paso a paso (nombre, contacto, qué pidió, precio, fecha, foto).
//  Al final lo guarda en el panel → Encargos, igual que si lo anotaras ahí.
//  También muestra los pendientes y marca uno como entregado.
//
//  Es un bot APARTE del que ya tienen para los productos: no lo toca.
//  Va en su PROPIO proyecto de Apps Script (no en el del publicador).
//
//  CONFIGURACIÓN (una sola vez)
//  1) En Telegram, habla con @BotFather → /newbot → ponle de nombre
//     «Karivé Encargos» y un usuario que termine en «bot». Copia el token.
//  2) script.google.com → Nuevo proyecto → llámalo «Karivé Encargos (bot)» y
//     pega este archivo completo.
//  3) Configuración del proyecto (engranaje) → Propiedades del script:
//       TELEGRAM_TOKEN     = el token que te dio BotFather
//       FIREBASE_PASSWORD  = la contraseña con que entras al panel
//       ENC_CODIGO         = una palabra secreta para autorizar a quien
//                            puede usar el bot (por ejemplo: aros2026)
//  4) Implementar → Nueva implementación → tipo «Aplicación web» →
//     Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario → Implementar
//     (acepta los permisos).
//  5) Copia la URL de la aplicación web (termina en /exec) y agrégala como
//     propiedad del script  ENC_URL. Después, arriba elige «encargosConfigurar»
//     y aprieta ▶ Ejecutar.
//  6) En Telegram abre tu bot, escribe /start y después la palabra secreta.
//     Cada persona que lo vaya a usar hace lo mismo una vez.
//
//  MODO RÁPIDO CON GEMINI (opcional, recomendado)
//  Agrega la propiedad  GEMINI_KEY  (tu clave de Gemini, de aistudio.google.com/apikey).
//  Desde ahí se le puede escribir o mandar un audio como se habla:
//     «Natalia llevó aros de corazones y me debe 6 lucas»
//  y lo anota solo, con un botón «Deshacer». /nuevo sigue funcionando paso a paso.
//  Para probarlo sin Telegram: ▶ Ejecutar encargosProbarIA (no guarda nada).
//  OJO: cada vez que cambies este código, Implementar → Gestionar implementaciones →
//  ✏️ → Versión: «Nueva versión» → Implementar (la URL /exec no cambia).
// ============================================================

var ENC_FB_KEY = 'AIzaSyC6XWnbq6QEg4DjldVKvoafbe9dtZdyLqI';
var ENC_FS = 'https://firestore.googleapis.com/v1/projects/karive-catalogo/databases/(default)/documents';
var ENC_ZONA = 'America/Santiago';
var ENC_PANEL = 'https://karivejoyas.cl/admin/#/encargos';

function encProp(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }

// ------------------------------------------------------------ Telegram
function encTg(metodo, datos) {
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + encProp('TELEGRAM_TOKEN') + '/' + metodo, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(datos || {})
  });
  try { return JSON.parse(r.getContentText()); } catch (e) { return {}; }
}
function encDecir(chat, texto, botones) {
  var d = { chat_id: chat, text: texto, parse_mode: 'HTML', disable_web_page_preview: true };
  if (botones) d.reply_markup = { inline_keyboard: botones };
  return encTg('sendMessage', d);
}
function encEsc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
function encPesos(n) { return '$' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

/* Deja el bot apuntando a este proyecto y con su menú de comandos. */
function encargosConfigurar() {
  if (!encProp('TELEGRAM_TOKEN')) { Logger.log('⚠️ Falta la propiedad TELEGRAM_TOKEN.'); return; }
  if (!encProp('ENC_CODIGO')) { Logger.log('⚠️ Falta la propiedad ENC_CODIGO (la palabra secreta).'); return; }
  // Desde el editor, getUrl() suele dar la dirección de PRUEBA (…/dev), que Telegram no puede abrir, y su
  // código NO es el de la implementación. Por eso se usa la dirección exacta de la implementación, guardada
  // en la propiedad ENC_URL (Implementar → Gestionar implementaciones → la URL que termina en /exec).
  var url = encProp('ENC_URL') || String(ScriptApp.getService().getUrl() || '');
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
    Logger.log('⚠️ Falta la propiedad ENC_URL: copia la URL de la aplicación web (Implementar → Gestionar implementaciones, la que termina en /exec) y agrégala como propiedad ENC_URL.'); return;
  }
  var r = encTg('setWebhook', { url: url, drop_pending_updates: true, allowed_updates: ['message', 'callback_query'] });
  Logger.log('Dirección del bot: …' + url.slice(-30));
  encTg('setMyCommands', { commands: [
    { command: 'nuevo', description: 'Anotar un encargo' },
    { command: 'pendientes', description: 'Ver los encargos pendientes' },
    { command: 'entregado', description: 'Marcar un encargo como entregado' },
    { command: 'cancelar', description: 'Cancelar lo que estás anotando' }] });
  Logger.log(r.ok ? '✅ Bot listo. Ahora en Telegram escríbele /start y la palabra secreta.' : '❌ Telegram respondió: ' + JSON.stringify(r));
  Logger.log(encPase() ? '✅ Entra bien a la base de datos.' : '❌ No pude entrar a la base: revisa FIREBASE_PASSWORD.');
}

// ------------------------------------------------------------ base de datos (como el panel)
function encPase() {
  var cache = CacheService.getScriptCache(), pase = cache.get('enc_pase');
  if (pase) return pase;
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + ENC_FB_KEY, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ email: encProp('FIREBASE_EMAIL') || 'karive.joyas@gmail.com', password: encProp('FIREBASE_PASSWORD'), returnSecureToken: true })
  });
  if (r.getResponseCode() !== 200) return '';
  pase = JSON.parse(r.getContentText()).idToken;
  cache.put('enc_pase', pase, 3000);
  return pase;
}
function encValor(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) { var o = {}; Object.keys(v.mapValue.fields || {}).forEach(function (k) { o[k] = encValor(v.mapValue.fields[k]); }); return o; }
  return null;
}
function encAFs(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Math.round(x) === x ? { integerValue: String(x) } : { doubleValue: x };
  return { stringValue: String(x) };
}
function encCampos(o) { var f = {}; Object.keys(o).forEach(function (k) { f[k] = encAFs(o[k]); }); return f; }

function encLeerEncargos() {
  var r = UrlFetchApp.fetch(ENC_FS + '/catalog/encargos/items?pageSize=300' +
    ['nombre', 'contacto', 'que', 'tipo', 'notas', 'precio', 'abono', 'pagado', 'entregado', 'entregadoEl', 'fechaEntrega', 'creado', 'actualizado'].map(function (k) { return '&mask.fieldPaths=' + k; }).join(''),
    { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + encPase() } });
  if (r.getResponseCode() !== 200) return null;
  return (JSON.parse(r.getContentText()).documents || []).map(function (d) {
    var e = encValor({ mapValue: { fields: d.fields || {} } }); e.id = d.name.split('/').pop(); return e;
  });
}
function encProductos() {
  var cache = CacheService.getScriptCache(), c = cache.get('enc_prods');
  if (c) return JSON.parse(c);
  var r = UrlFetchApp.fetch(ENC_FS + '/catalog/products/items?pageSize=500&mask.fieldPaths=name&mask.fieldPaths=code', { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return [];
  var l = (JSON.parse(r.getContentText()).documents || []).map(function (d) {
    var f = d.fields || {}; return { id: d.name.split('/').pop(), name: encValor(f.name) || '', code: encValor(f.code) || '' };
  });
  try { cache.put('enc_prods', JSON.stringify(l), 600); } catch (e) {}
  return l;
}

// ------------------------------------------------------------ fechas
function encHoy(n) { return Utilities.formatDate(new Date(Date.now() + (n || 0) * 864e5), ENC_ZONA, 'yyyy-MM-dd'); }
function encFechaBonita(f) {
  if (!f) return 'sin fecha';
  if (f === encHoy(0)) return 'hoy';
  if (f === encHoy(1)) return 'mañana';
  var p = f.split('-'); return p[2] + '-' + p[1] + '-' + p[0];
}
function encSinTildes(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
/* Entiende: hoy, mañana, pasado mañana, lunes…domingo, 15/12, 15-12-2026, 15 dic. */
function encLeerFecha(t) {
  t = encSinTildes(t);
  if (!t) return '';
  if (t === 'hoy') return encHoy(0);
  if (t === 'manana') return encHoy(1);
  if (t === 'pasado manana' || t === 'pasado') return encHoy(2);
  var dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  var i = dias.indexOf(t.replace(/^el /, ''));
  if (i !== -1) {
    var hoy = Number(Utilities.formatDate(new Date(), ENC_ZONA, 'u')) % 7;   // 1=lunes … 7=domingo → 0=domingo
    var falta = (i - hoy + 7) % 7 || 7;
    return encHoy(falta);
  }
  var meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var m = t.match(/^(\d{1,2})\s*(?:de\s*)?([a-z]{3})[a-z]*\.?(?:\s*(?:de\s*)?(\d{2,4}))?$/);
  var d, mes, anio;
  if (m && meses.indexOf(m[2]) !== -1) { d = +m[1]; mes = meses.indexOf(m[2]) + 1; anio = m[3] ? +m[3] : 0; }
  else {
    m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
    if (!m) return null;
    d = +m[1]; mes = +m[2]; anio = m[3] ? +m[3] : 0;
  }
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
  var esteAnio = +encHoy(0).slice(0, 4);
  if (!anio) { anio = esteAnio; if (('' + anio + '-' + ('0' + mes).slice(-2) + '-' + ('0' + d).slice(-2)) < encHoy(0)) anio++; }
  else if (anio < 100) anio += 2000;
  return anio + '-' + ('0' + mes).slice(-2) + '-' + ('0' + d).slice(-2);
}
function encLeerMonto(t) {
  var s = String(t || '').toLowerCase().replace(/\s/g, '');
  var mil = /mil|k$/.test(s);
  var n = parseFloat(s.replace(/mil|k/g, '').replace(/\$/g, '').replace(/\./g, '').replace(',', '.'));
  if (isNaN(n)) return null;
  return Math.round(mil ? n * 1000 : n);
}

// ------------------------------------------------------------ estado de cada conversación
function encEstado(chat) { try { return JSON.parse(encProp('ENC_ESTADO_' + chat) || 'null'); } catch (e) { return null; } }
function encGuardarEstado(chat, est) {
  var p = PropertiesService.getScriptProperties();
  if (est) p.setProperty('ENC_ESTADO_' + chat, JSON.stringify(est)); else p.deleteProperty('ENC_ESTADO_' + chat);
}
function encAutorizado(chat) { return (',' + encProp('ENC_CHATS') + ',').indexOf(',' + chat + ',') !== -1; }

// ------------------------------------------------------------ entrada de Telegram
function doPost(e) {
  try {
    var u = JSON.parse(e.postData.contents);
    // Telegram reintenta si Apps Script responde con una redirección: no se procesa dos veces
    var cache = CacheService.getScriptCache();
    if (u.update_id && cache.get('u' + u.update_id)) return encOk();
    if (u.update_id) cache.put('u' + u.update_id, '1', 21600);
    var lock = LockService.getScriptLock(); lock.tryLock(20000);
    try { encProcesar(u); } finally { try { lock.releaseLock(); } catch (x) {} }
  } catch (err) { console.error(err); }
  return encOk();
}
/* Respuesta a Telegram. ContentService responde con una redirección (302): Telegram la toma como
   error, reintenta y deja en espera los mensajes siguientes. HtmlService responde 200 directo. */
function encOk() { return HtmlService.createHtmlOutput('ok'); }

function encProcesar(u) {
  var msg = u.message, cb = u.callback_query;
  var chat = msg ? msg.chat.id : cb ? cb.message.chat.id : null;
  if (!chat) return;
  if (cb) encTg('answerCallbackQuery', { callback_query_id: cb.id });
  var texto = msg && msg.text ? msg.text.trim() : '';
  var dato = cb ? cb.data : '';

  // autorización con la palabra secreta
  if (!encAutorizado(chat)) {
    if (texto && encSinTildes(texto) === encSinTildes(encProp('ENC_CODIGO'))) {
      var l = encProp('ENC_CHATS'); PropertiesService.getScriptProperties().setProperty('ENC_CHATS', (l ? l + ',' : '') + chat);
      encDecir(chat, '✅ Listo, ya puedes anotar encargos.\n\nEscribe /nuevo para anotar uno, /pendientes para verlos o /entregado para marcar uno como entregado.');
    } else encDecir(chat, 'Hola 👋 Este bot es de Karivé Joyas. Para usarlo escribe la palabra secreta.');
    return;
  }

  var cmd = encSinTildes(texto).replace(/@\w+$/, '');
  if (cmd === '/cancelar' || cmd === 'cancelar' || dato === 'cancelar') { encGuardarEstado(chat, null); encDecir(chat, 'Cancelado. Escribe /nuevo cuando quieras anotar otro.'); return; }
  if (cmd === '/start' || cmd === '/ayuda' || cmd === 'ayuda') { encDecir(chat, encAyuda()); return; }
  if (cmd === '/pendientes' || cmd === 'pendientes') { encPendientes(chat); return; }
  if (cmd === '/entregado' || cmd === 'entregado') { encElegirEntregado(chat); return; }
  if (dato.indexOf('ent:') === 0) { encMarcarEntregado(chat, dato.slice(4)); return; }
  if (dato.indexOf('undo:') === 0) { encDeshacer(chat, dato.slice(5)); return; }
  if (dato === 'ver') { encPendientes(chat); return; }
  if (dato === 'entregar') { encElegirEntregado(chat); return; }
  if (cmd === '/nuevo' || cmd === 'nuevo' || cmd === 'encargo' || dato === 'nuevo') { encPaso(chat, { paso: 'nombre', e: {} }); return; }

  var est = encEstado(chat);
  if (!est) {
    // MODO RÁPIDO: sin conversación abierta, el mensaje (texto, audio o foto con texto) lo entiende Gemini
    if (msg && encProp('GEMINI_KEY') && (texto || msg.caption || msg.voice || msg.audio)) { encRapido(chat, msg); return; }
    if (msg && msg.photo && !msg.caption) { encDecir(chat, '📷 Mándame la foto <b>con un texto</b> que diga de quién es (ej: «foto del encargo de Natalia») y la adjunto.'); return; }
    encDecir(chat, '¿Qué quieres hacer?', [[{ text: '📝 Anotar encargo', callback_data: 'nuevo' }], [{ text: '📋 Ver pendientes', callback_data: 'ver' }, { text: '✅ Marcar entregado', callback_data: 'entregar' }]]);
    return;
  }
  encResponder(chat, est, msg, texto, dato);
}

function encAyuda() {
  if (!encProp('GEMINI_KEY')) return 'Escribe /nuevo para anotar un encargo, /pendientes para verlos o /entregado para marcar uno como entregado.';
  return '✍️ <b>Escríbeme como hablas</b> (o mándame un audio 🎤) y lo anoto solo. Por ejemplo:\n\n' +
    '• <i>Natalia pidió aros de corazones rojos para el viernes, 8 lucas</i>\n' +
    '• <i>Natalia llevó los aros de corazones y me debe 6 lucas</i>\n' +
    '• <i>La Cami me pagó 3 lucas</i>\n' +
    '• <i>Le entregué a la Fran</i>\n' +
    '• <i>¿Quién me debe plata?</i>\n\n' +
    'Si me equivoco, toca «↩️ Deshacer» o corrígeme (ej: <i>no, eran 8 lucas</i>).\n\n' +
    'También sigue funcionando paso a paso: /nuevo · /pendientes · /entregado';
}

// ------------------------------------------------------------ preguntas
var ENC_SALTAR = [{ text: 'Saltar ⏭', callback_data: 'saltar' }];
var ENC_CANCELAR = [{ text: 'Cancelar ✖', callback_data: 'cancelar' }];

function encPaso(chat, est) {
  encGuardarEstado(chat, est);
  var p = est.paso, e = est.e;
  if (p === 'nombre') encDecir(chat, '📝 <b>Nuevo encargo</b>\n\n¿Cómo se llama quien lo pidió?', [ENC_CANCELAR]);
  else if (p === 'contacto') encDecir(chat, '¿Su teléfono o Instagram? (para escribirle cuando esté listo)', [ENC_SALTAR, ENC_CANCELAR]);
  else if (p === 'que') encDecir(chat, '¿Qué pidió? Cuéntalo con tus palabras (color, modelo, para qué es…).', [ENC_CANCELAR]);
  else if (p === 'tipo') encDecir(chat, '¿Es un aro nuevo o la reposición de uno que se acabó?', [[{ text: '✨ Aro nuevo', callback_data: 'tipo:nuevo' }, { text: '🔁 Reposición', callback_data: 'tipo:reposicion' }], ENC_CANCELAR]);
  else if (p === 'producto') encDecir(chat, '¿Cuál producto? Escribe parte del nombre o el código (ej: «luna turquesa» o AG-006).', [ENC_SALTAR, ENC_CANCELAR]);
  else if (p === 'precio') encDecir(chat, '¿Cuánto cobras? (ej: 12990 o 12 mil)', [ENC_SALTAR, ENC_CANCELAR]);
  else if (p === 'abono') encDecir(chat, '¿Ya te pagó algo?', [[{ text: 'Nada todavía', callback_data: 'abono:0' }, { text: 'Pagó todo ✅', callback_data: 'abono:todo' }], [{ text: 'Escribo cuánto abonó', callback_data: 'abono:escribir' }], ENC_CANCELAR]);
  else if (p === 'abono-monto') encDecir(chat, '¿Cuánto abonó? (ej: 5000)', [ENC_CANCELAR]);
  else if (p === 'fecha') encDecir(chat, '¿Para cuándo lo tienes que entregar?\nTambién puedes escribir la fecha (ej: 15/12, viernes, 20 dic).', [
    [{ text: 'Hoy', callback_data: 'fecha:' + encHoy(0) }, { text: 'Mañana', callback_data: 'fecha:' + encHoy(1) }, { text: 'Pasado mañana', callback_data: 'fecha:' + encHoy(2) }],
    [{ text: 'En una semana', callback_data: 'fecha:' + encHoy(7) }, { text: 'Sin fecha', callback_data: 'fecha:' }], ENC_CANCELAR]);
  else if (p === 'foto') encDecir(chat, '📷 Mándame una foto de referencia (captura del chat, foto del aro…) o toca «Sin foto».', [[{ text: 'Sin foto', callback_data: 'saltar' }], ENC_CANCELAR]);
  else if (p === 'notas') encDecir(chat, '¿Alguna nota? (ej: lo retira en persona, quiere caja de regalo)', [ENC_SALTAR, ENC_CANCELAR]);
  else if (p === 'confirmar') encResumen(chat, e);
}

function encSiguiente(paso, e) {
  var orden = ['nombre', 'contacto', 'que', 'tipo', 'producto', 'precio', 'abono', 'fecha', 'foto', 'notas', 'confirmar'];
  var i = orden.indexOf(paso) + 1;
  if (orden[i] === 'producto' && e.tipo !== 'reposicion') i++;
  return orden[i];
}

function encResponder(chat, est, msg, texto, dato) {
  var e = est.e, p = est.paso, saltar = dato === 'saltar';
  var seguir = function () { est.paso = est.volver || encSiguiente(p, e); est.volver = ''; encPaso(chat, est); };

  if (p === 'nombre') { if (!texto) return encDecir(chat, 'Escríbeme el nombre, por favor.'); e.nombre = texto.slice(0, 80); return seguir(); }
  if (p === 'contacto') { if (!saltar) { if (!texto) return encDecir(chat, 'Escribe el teléfono o el Instagram, o toca «Saltar».'); e.contacto = texto.slice(0, 80); } return seguir(); }
  if (p === 'que') { if (!texto) return encDecir(chat, 'Cuéntame qué pidió, por favor.'); e.que = texto.slice(0, 500); return seguir(); }
  if (p === 'tipo') { if (dato.indexOf('tipo:') !== 0) return encPaso(chat, est); e.tipo = dato.slice(5); if (e.tipo !== 'reposicion') e.productoId = ''; return seguir(); }
  if (p === 'producto') {
    if (saltar) { e.productoId = ''; return seguir(); }
    if (dato.indexOf('prod:') === 0) { var pr = encProductos().filter(function (x) { return x.id === dato.slice(5); })[0]; e.productoId = pr ? pr.id : ''; e.productoNombre = pr ? pr.name + ' · ' + pr.code : ''; return seguir(); }
    var q = encSinTildes(texto);
    if (!q) return encDecir(chat, 'Escribe parte del nombre o el código, o toca «Saltar».');
    var hallados = encProductos().filter(function (x) { return encSinTildes(x.name + ' ' + x.code).indexOf(q) !== -1; }).slice(0, 6);
    if (!hallados.length) return encDecir(chat, 'No encontré «' + encEsc(texto) + '». Prueba con otra palabra o el código, o toca «Saltar».', [ENC_SALTAR, ENC_CANCELAR]);
    return encDecir(chat, '¿Cuál de estos?', hallados.map(function (x) { return [{ text: (x.name + ' · ' + x.code).slice(0, 60), callback_data: 'prod:' + x.id }]; }).concat([ENC_SALTAR]));
  }
  if (p === 'precio') {
    if (!saltar) { var n = encLeerMonto(texto); if (n === null) return encDecir(chat, 'No entendí el monto. Escríbelo así: 12990 o 12 mil (o toca «Saltar»).'); e.precio = n; }
    return seguir();
  }
  if (p === 'abono') {
    if (dato === 'abono:0') { e.abono = 0; e.pagado = false; return seguir(); }
    if (dato === 'abono:todo') { e.pagado = true; e.abono = e.precio || 0; return seguir(); }
    if (dato === 'abono:escribir') { est.paso = 'abono-monto'; return encPaso(chat, est); }
    var a0 = encLeerMonto(texto); if (a0 !== null) { e.abono = a0; e.pagado = !!(e.precio && a0 >= e.precio); return seguir(); }
    return encPaso(chat, est);
  }
  if (p === 'abono-monto') {
    var a = encLeerMonto(texto); if (a === null) return encDecir(chat, 'No entendí el monto. Escríbelo así: 5000 o 5 mil.');
    e.abono = a; e.pagado = !!(e.precio && a >= e.precio); p = 'abono'; return seguir();
  }
  if (p === 'fecha') {
    if (dato.indexOf('fecha:') === 0) { e.fechaEntrega = dato.slice(6); return seguir(); }
    var f = encLeerFecha(texto);
    if (!f) return encDecir(chat, 'No entendí la fecha. Escríbela así: 15/12, viernes o 20 dic (o elige un botón).');
    e.fechaEntrega = f; return seguir();
  }
  if (p === 'foto') {
    if (saltar) { e.fotoId = ''; return seguir(); }
    var fotos = msg && msg.photo;
    if (msg && msg.document && /^image\//.test(msg.document.mime_type || '')) fotos = [{ file_id: msg.document.file_id, file_size: msg.document.file_size, width: 1000 }];
    if (!fotos || !fotos.length) return encDecir(chat, 'Mándame una foto o toca «Sin foto».', [[{ text: 'Sin foto', callback_data: 'saltar' }]]);
    // la más grande que no pase de ~1.300 px ni de ~600 KB (la base acepta hasta 1 MB por encargo, y la foto va en base64)
    var elegida = fotos[0];
    fotos.forEach(function (x) { if ((x.width || 0) <= 1300 && (x.file_size || 0) <= 600000) elegida = x; });
    e.fotoId = elegida.file_id; return seguir();
  }
  if (p === 'notas') { if (!saltar) e.notas = (texto || '').slice(0, 500); return seguir(); }
  if (p === 'confirmar') {
    if (dato === 'guardar') return encGuardar(chat, e);
    if (dato.indexOf('cambiar:') === 0) { est.paso = dato.slice(8); est.volver = 'confirmar'; return encPaso(chat, est); }
    return encResumen(chat, e);
  }
}

function encResumen(chat, e) {
  var falta = e.pagado ? 'pagado ✅' : e.precio ? 'falta cobrar ' + encPesos(Math.max(0, (e.precio || 0) - (e.abono || 0))) : '';
  var t = '📝 <b>Revisa el encargo</b>\n\n' +
    '👤 ' + encEsc(e.nombre) + (e.contacto ? ' · ' + encEsc(e.contacto) : '') + '\n' +
    '💬 ' + encEsc(e.que || '') + '\n' +
    (e.tipo === 'reposicion' ? '🔁 Reposición' + (e.productoNombre ? ': ' + encEsc(e.productoNombre) : '') + '\n' : '✨ Aro nuevo\n') +
    '💰 ' + (e.precio ? encPesos(e.precio) : 'sin precio') + (e.abono && !e.pagado ? ' · abonó ' + encPesos(e.abono) : '') + (falta ? ' · ' + falta : '') + '\n' +
    '📅 ' + encFechaBonita(e.fechaEntrega) + '\n' +
    '📷 ' + (e.fotoId ? 'con foto' : 'sin foto') + (e.notas ? '\n🗒 ' + encEsc(e.notas) : '');
  encDecir(chat, t, [[{ text: '✅ Guardar', callback_data: 'guardar' }],
    [{ text: '✏️ Nombre', callback_data: 'cambiar:nombre' }, { text: '✏️ Qué pidió', callback_data: 'cambiar:que' }, { text: '✏️ Precio', callback_data: 'cambiar:precio' }],
    [{ text: '✏️ Fecha', callback_data: 'cambiar:fecha' }, { text: '✏️ Foto', callback_data: 'cambiar:foto' }, { text: '✏️ Contacto', callback_data: 'cambiar:contacto' }],
    ENC_CANCELAR]);
}

function encFotoDataUrl(fileId) {
  var f = encTg('getFile', { file_id: fileId });
  if (!f.ok) return '';
  var blob = UrlFetchApp.fetch('https://api.telegram.org/file/bot' + encProp('TELEGRAM_TOKEN') + '/' + f.result.file_path, { muteHttpExceptions: true }).getBlob();
  var bytes = blob.getBytes();
  if (bytes.length > 640000) return '';   // demasiado pesada para la base (en base64 crece un tercio)
  return 'data:' + (blob.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(bytes);
}

function encGuardar(chat, e) {
  var pase = encPase();
  if (!pase) { encDecir(chat, '❌ No pude entrar a la base de datos. Revisa la propiedad FIREBASE_PASSWORD del bot.'); return; }
  var ahora = new Date().toISOString();
  var foto = e.fotoId ? encFotoDataUrl(e.fotoId) : '';
  var datos = {
    nombre: e.nombre || '', contacto: e.contacto || '', que: e.que || '', tipo: e.tipo || 'nuevo', productoId: e.productoId || '',
    notas: e.notas || '', precio: e.precio || 0, abono: e.abono || 0, pagado: !!e.pagado, entregado: false,
    fechaEntrega: e.fechaEntrega || '', foto: foto, creado: ahora, actualizado: ahora, origen: 'telegram'
  };
  var r = UrlFetchApp.fetch(ENC_FS + '/catalog/encargos/items', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + pase },
    payload: JSON.stringify({ fields: encCampos(datos) })
  });
  if (r.getResponseCode() !== 200) { encDecir(chat, '❌ No se pudo guardar (' + r.getResponseCode() + '). Inténtalo de nuevo con el botón «Guardar».'); return; }
  encGuardarEstado(chat, null);
  encDecir(chat, '✅ <b>Encargo anotado</b>: ' + encEsc(e.nombre) + ' · ' + encFechaBonita(e.fechaEntrega) +
    (e.fotoId && !foto ? '\n⚠️ La foto era muy pesada y no se guardó: súbela desde el panel.' : '') +
    '\n\nYa aparece en el panel → <a href="' + ENC_PANEL + '">Encargos</a>.', [[{ text: '📝 Anotar otro', callback_data: 'nuevo' }, { text: '📋 Ver pendientes', callback_data: 'ver' }]]);
}

// ------------------------------------------------------------ pendientes y entregados
function encPendientesLista() {
  var l = encLeerEncargos();
  if (!l) return null;
  return l.filter(function (e) { return !e.entregado; }).sort(function (a, b) {
    var da = a.fechaEntrega || '9999', db = b.fechaEntrega || '9999';
    return da < db ? -1 : da > db ? 1 : String(a.creado || '') < String(b.creado || '') ? -1 : 1;
  });
}
function encPendientes(chat) {
  var l = encPendientesLista();
  if (!l) { encDecir(chat, '❌ No pude leer los encargos.'); return; }
  if (!l.length) { encDecir(chat, '🎉 No hay encargos pendientes.', [[{ text: '📝 Anotar encargo', callback_data: 'nuevo' }]]); return; }
  var hoy = encHoy(0);
  var t = '📋 <b>' + l.length + ' encargo' + (l.length > 1 ? 's' : '') + ' pendiente' + (l.length > 1 ? 's' : '') + '</b>\n\n' + l.slice(0, 25).map(function (e) {
    var marca = !e.fechaEntrega ? '⚪' : e.fechaEntrega < hoy ? '🔴' : e.fechaEntrega === hoy ? '🟠' : '🟢';
    var falta = e.pagado ? '' : e.precio ? ' · falta ' + encPesos(Math.max(0, (e.precio || 0) - (e.abono || 0))) : '';
    return marca + ' <b>' + encEsc(e.nombre || 'Sin nombre') + '</b> · ' + encFechaBonita(e.fechaEntrega) + (e.fechaEntrega && e.fechaEntrega < hoy ? ' (atrasado)' : '') +
      '\n    ' + encEsc(String(e.que || '').slice(0, 80)) + falta;
  }).join('\n') + (l.length > 25 ? '\n\n… y ' + (l.length - 25) + ' más en el panel.' : '');
  encDecir(chat, t, [[{ text: '✅ Marcar entregado', callback_data: 'entregar' }, { text: '📝 Anotar otro', callback_data: 'nuevo' }]]);
}
function encElegirEntregado(chat) {
  var l = encPendientesLista();
  if (!l) { encDecir(chat, '❌ No pude leer los encargos.'); return; }
  if (!l.length) { encDecir(chat, '🎉 No hay encargos pendientes.'); return; }
  encDecir(chat, '¿Cuál entregaste?', l.slice(0, 20).map(function (e) {
    return [{ text: ((e.nombre || 'Sin nombre') + ' · ' + String(e.que || '').slice(0, 30) + ' · ' + encFechaBonita(e.fechaEntrega)).slice(0, 60), callback_data: 'ent:' + e.id }];
  }).concat([ENC_CANCELAR]));
}
function encMarcarEntregado(chat, id) {
  var ahora = new Date().toISOString();
  var r = UrlFetchApp.fetch(ENC_FS + '/catalog/encargos/items/' + id + '?updateMask.fieldPaths=entregado&updateMask.fieldPaths=entregadoEl&updateMask.fieldPaths=actualizado&currentDocument.exists=true', {
    method: 'patch', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + encPase() },
    payload: JSON.stringify({ fields: encCampos({ entregado: true, entregadoEl: ahora, actualizado: ahora }) })
  });
  if (r.getResponseCode() !== 200) { encDecir(chat, '❌ No se pudo marcar (' + r.getResponseCode() + ').'); return; }
  encDecir(chat, '✅ Marcado como entregado.\n\nSi quieres que cuente como venta en Informes, ábrelo en el panel → <a href="' + ENC_PANEL + '">Encargos</a> y toca «Registrar como venta».');
}

// ============================================================ MODO RÁPIDO CON GEMINI
// Ella escribe (o graba un audio) como habla: «Natalia llevó aros de corazones y me debe 6 lucas».
// Gemini lo convierte en acciones sobre la lista de encargos; el bot las guarda al tiro y ofrece «Deshacer».

var ENC_GEM_MODELOS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite'];
var ENC_DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function encPromptSistema() {
  var hoy = encHoy(0), dia = ENC_DIAS[Number(Utilities.formatDate(new Date(), ENC_ZONA, 'u')) % 7];
  return [
    'Eres quien anota los encargos de Karivé Joyas, una tienda chilena de aros hechos a mano.',
    'La dueña te escribe (o te habla en un audio) en chileno informal. Conviertes su mensaje en acciones sobre su lista de encargos.',
    'Hoy es ' + dia + ' ' + hoy + ' (Chile).',
    '',
    'JERGA: «luca/lucas» = mil pesos (6 lucas = 6000; 6 lucas y media = 6500); «6k» o «6 mil» = 6000; «la Cami», «el Pedro» = Cami, Pedro.',
    '',
    'REGLAS:',
    '- «pidió / encargó / quiere / me pidió» → encargo NUEVO pendiente (entregado=false).',
    '- «llevó / se llevó / retiró / le entregué / le pasé / ya tiene» → entregado=true. Si en la lista hay un encargo NO entregado de esa persona que calza, ACTUALÍZALO; si no hay ninguno, crea uno NUEVO ya entregado.',
    '- «cuesta / vale / le cobro / son X» → precio = X.',
    '- «me debe X» → lo que falta por cobrar es X. Si el encargo ya tiene precio: abono = precio − X. Si no tiene precio: precio = abono actual + X (en uno nuevo: precio = X y abono = 0).',
    '- «pagó X / abonó X / me transfirió X / me dio X» → abono = abono actual + X.',
    '- «pagó todo / me pagó / quedó pagado» (sin monto) → pagado=true y abono = precio.',
    '- pagado = true solo cuando el abono cubre el precio completo.',
    '- Fechas: «para el viernes», «mañana», «el 15» → fechaEntrega con formato AAAA-MM-DD, nunca en el pasado. Si no dice fecha, no la pongas.',
    '- «que»: lo pedido en pocas palabras, como ella lo dice (ej: «aros de corazones rojos»). «nombre»: con mayúscula inicial.',
    '- Si una persona tiene más de un encargo y no se sabe cuál, o falta algo indispensable (por ejemplo, el nombre en un encargo nuevo), NO adivines: usa la acción «preguntar» y escribe la pregunta en «respuesta».',
    '- Si te pregunta algo (quién debe, qué hay para mañana, cuánto le falta a alguien), usa «consulta» y contesta en «respuesta» usando solo la lista.',
    '- Si te corrige («no, eran 8 lucas», «era para el sábado»), actualiza el encargo de la conversación reciente.',
    '- NUNCA inventes montos, fechas ni nombres que no estén en el mensaje o en la lista.',
    '- Un mensaje puede traer varias cosas: devuelve una acción por cada una.',
    '',
    'RESPONDE SOLO CON JSON, así:',
    '{"transcripcion":"(solo si vino un audio: lo que entendiste)","acciones":[',
    '  {"accion":"nuevo","campos":{"nombre":"","contacto":"","que":"","precio":0,"abono":0,"pagado":false,"entregado":false,"fechaEntrega":"","notas":""}},',
    '  {"accion":"actualizar","id":"(id de la lista)","campos":{ solo los campos que cambian, con su valor FINAL }},',
    '  {"accion":"consulta"}, {"accion":"preguntar"}',
    '],"respuesta":"(texto corto para consultas o preguntas; vacío si no hace falta)"}'
  ].join('\n');
}

/* Lista que ve Gemini: lo pendiente, lo que deben y lo que se tocó en los últimos 3 días. */
function encContexto(lista) {
  var limite = new Date(Date.now() - 3 * 864e5).toISOString();
  return lista.filter(function (e) { return !e.entregado || !e.pagado || String(e.actualizado || e.creado || '') >= limite; })
    .sort(function (a, b) { return String(b.actualizado || b.creado || '') < String(a.actualizado || a.creado || '') ? -1 : 1; })
    .slice(0, 80)
    .map(function (e) {
      return { id: e.id, nombre: e.nombre || '', contacto: e.contacto || '', que: e.que || '', precio: e.precio || 0, abono: e.abono || 0,
        pagado: !!e.pagado, entregado: !!e.entregado, fechaEntrega: e.fechaEntrega || '', notas: e.notas || '' };
    });
}

function encGemini(partes) {
  var key = encProp('GEMINI_KEY'), ultimo = '';
  for (var i = 0; i < ENC_GEM_MODELOS.length; i++) {
    var m = ENC_GEM_MODELOS[i];
    var gen = { temperature: 0.1, responseMimeType: 'application/json' };
    if (/^gemini-2\.5-flash$/.test(m)) gen.thinkingConfig = { thinkingBudget: 0 };   // más rápido
    var r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ systemInstruction: { parts: [{ text: encPromptSistema() }] }, contents: [{ role: 'user', parts: partes }], generationConfig: gen })
    });
    var c = r.getResponseCode();
    if (c === 200) {
      try {
        var t = JSON.parse(r.getContentText()).candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('');
        return JSON.parse(t.replace(/^```(?:json)?\s*|\s*```$/g, ''));
      } catch (e) { ultimo = 'respuesta rara de ' + m; continue; }
    }
    ultimo = m + ' → ' + c;
    if (c === 400 || c === 401 || c === 403) { if (!/not found|not supported|thinking/i.test(r.getContentText())) break; }
  }
  throw new Error(ultimo);
}

/* Memoria corta por chat (10 min) para que entienda correcciones y respuestas a sus preguntas. */
function encMemoria(chat, nueva) {
  var cache = CacheService.getScriptCache(), k = 'mem_' + chat;
  var m = []; try { m = JSON.parse(cache.get(k) || '[]'); } catch (e) {}
  if (nueva) { m.push(nueva); m = m.slice(-6); cache.put(k, JSON.stringify(m), 600); }
  return m;
}

function encAudioParte(msg) {
  var a = msg.voice || msg.audio;
  if (!a) return null;
  if ((a.file_size || 0) > 6000000) return 'grande';
  var f = encTg('getFile', { file_id: a.file_id });
  if (!f.ok) return null;
  var blob = UrlFetchApp.fetch('https://api.telegram.org/file/bot' + encProp('TELEGRAM_TOKEN') + '/' + f.result.file_path, { muteHttpExceptions: true }).getBlob();
  var tipo = a.mime_type || (msg.voice ? 'audio/ogg' : 'audio/mpeg');
  return { inline_data: { mime_type: tipo, data: Utilities.base64Encode(blob.getBytes()) } };
}

var ENC_CAMPOS_OK = ['nombre', 'contacto', 'que', 'precio', 'abono', 'pagado', 'entregado', 'fechaEntrega', 'notas'];
function encLimpiar(c) {
  var o = {};
  Object.keys(c || {}).forEach(function (k) {
    if (ENC_CAMPOS_OK.indexOf(k) === -1) return;
    var v = c[k];
    if (k === 'precio' || k === 'abono') { v = Math.round(Math.abs(Number(v) || 0)); }
    else if (k === 'pagado' || k === 'entregado') { v = v === true || v === 'true'; }
    else if (k === 'fechaEntrega') { v = /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : ''; }
    else { v = String(v == null ? '' : v).trim().slice(0, k === 'nombre' || k === 'contacto' ? 80 : 500); }
    o[k] = v;
  });
  return o;
}

function encRapido(chat, msg) {
  encTg('sendChatAction', { chat_id: chat, action: 'typing' });
  var pase = encPase();
  if (!pase) { encDecir(chat, '❌ No pude entrar a la base de datos. Revisa la propiedad FIREBASE_PASSWORD del bot.'); return; }
  var lista = encLeerEncargos();
  if (!lista) { encDecir(chat, '❌ No pude leer los encargos.'); return; }
  var porId = {}; lista.forEach(function (e) { porId[e.id] = e; });

  var texto = (msg.text || msg.caption || '').trim();
  var audio = encAudioParte(msg);
  if (audio === 'grande') { encDecir(chat, 'El audio es muy largo 😅 Mándame uno más corto o escríbelo.'); return; }
  var memoria = encMemoria(chat);
  var partes = [{ text:
    'ENCARGOS (JSON):\n' + JSON.stringify(encContexto(lista)) +
    (memoria.length ? '\n\nCONVERSACIÓN RECIENTE:\n' + memoria.join('\n') : '') +
    '\n\nMENSAJE NUEVO:\n' + (texto || (audio ? '(viene en el audio adjunto)' : '')) }];
  if (audio) partes.push(audio);

  var res;
  try { res = encGemini(partes); }
  catch (err) { encDecir(chat, '❌ La IA no respondió (' + encEsc(err.message) + '). Prueba de nuevo o usa /nuevo.'); return; }

  var dicho = res.transcripcion ? '🎤 <i>' + encEsc(res.transcripcion) + '</i>\n\n' : '';
  var acciones = (res.acciones || []).filter(function (a) { return a && (a.accion === 'nuevo' || a.accion === 'actualizar'); });
  var foto = msg.photo && msg.photo.length ? encFotoDataUrl(msg.photo.reduce(function (b, x) { return ((x.width || 0) <= 1300 && (x.file_size || 0) <= 600000) ? x : b; }, msg.photo[0]).file_id) : '';

  if (!acciones.length) {
    var resp = res.respuesta || 'No entendí 😅 Prueba así: «Natalia pidió aros de corazones para el viernes, 8 lucas».';
    encMemoria(chat, 'Ella: ' + (texto || res.transcripcion || '(audio)') + '\nTú: ' + resp);
    encDecir(chat, dicho + encEsc(resp), [[{ text: '📋 Ver pendientes', callback_data: 'ver' }]]);
    return;
  }

  var ahora = new Date().toISOString(), hechos = [], deshacer = [], lineas = [];
  acciones.forEach(function (a, i) {
    var c = encLimpiar(a.campos);
    if (foto && i === 0) c.foto = foto;
    if (a.accion === 'nuevo') {
      if (!c.nombre) return;
      var d = { nombre: '', contacto: '', que: '', tipo: 'nuevo', productoId: '', notas: '', precio: 0, abono: 0, pagado: false, entregado: false,
        fechaEntrega: '', foto: '', creado: ahora, actualizado: ahora, origen: 'telegram' };
      Object.keys(c).forEach(function (k) { d[k] = c[k]; });
      if (d.precio && d.abono >= d.precio) d.pagado = true;
      if (d.pagado && !d.abono) d.abono = d.precio;
      if (d.entregado) d.entregadoEl = ahora;
      var r = UrlFetchApp.fetch(ENC_FS + '/catalog/encargos/items', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + pase },
        payload: JSON.stringify({ fields: encCampos(d) })
      });
      if (r.getResponseCode() !== 200) { lineas.push('❌ No pude guardar el de ' + encEsc(d.nombre) + ' (' + r.getResponseCode() + ')'); return; }
      var id = JSON.parse(r.getContentText()).name.split('/').pop();
      deshacer.push({ t: 'crear', id: id });
      hechos.push(id + ' (nuevo: ' + d.nombre + ')');
      lineas.push('📝 <b>Nuevo</b> · ' + encLinea(d));
    } else {
      var e0 = porId[a.id];
      if (!e0) return;
      var cambios = {};
      Object.keys(c).forEach(function (k) { if (c[k] !== (k === 'precio' || k === 'abono' ? (e0[k] || 0) : k === 'pagado' || k === 'entregado' ? !!e0[k] : (e0[k] || ''))) cambios[k] = c[k]; });
      var fin = {}; Object.keys(e0).forEach(function (k) { fin[k] = e0[k]; }); Object.keys(cambios).forEach(function (k) { fin[k] = cambios[k]; });
      var pagadoFin = !!(fin.precio && (fin.abono || 0) >= fin.precio) || (cambios.pagado === true);
      if (pagadoFin !== !!e0.pagado) cambios.pagado = pagadoFin; else delete cambios.pagado;
      if (cambios.pagado === true && !(fin.abono >= fin.precio)) cambios.abono = fin.precio || fin.abono || 0;
      if (cambios.entregado === true) cambios.entregadoEl = ahora;
      if (cambios.entregado === false) cambios.entregadoEl = '';
      if (!Object.keys(cambios).length) { lineas.push('👌 ' + encEsc(e0.nombre) + ': ya estaba así.'); return; }
      var antes = {}; Object.keys(cambios).forEach(function (k) { antes[k] = e0[k] === undefined ? (k === 'precio' || k === 'abono' ? 0 : k === 'pagado' || k === 'entregado' ? false : '') : e0[k]; });
      if (e0.foto === undefined) delete antes.foto;   // la foto anterior no se leyó: deshacer no la toca
      cambios.actualizado = ahora; antes.actualizado = e0.actualizado || ahora;
      if (encParchar(a.id, cambios, pase) !== 200) { lineas.push('❌ No pude actualizar el de ' + encEsc(e0.nombre)); return; }
      deshacer.push({ t: 'cambiar', id: a.id, antes: antes });
      Object.keys(cambios).forEach(function (k) { fin[k] = cambios[k]; });
      hechos.push(a.id + ' (cambiado: ' + e0.nombre + ')');
      lineas.push('✏️ <b>Actualizado</b> · ' + encLinea(fin));
    }
  });

  if (!lineas.length) { encDecir(chat, dicho + 'No encontré qué anotar 😅 Prueba de nuevo con el nombre de la persona.'); return; }
  var token = Utilities.getUuid().slice(0, 8);
  if (deshacer.length) CacheService.getScriptCache().put('undo_' + token, JSON.stringify(deshacer), 21600);
  encMemoria(chat, 'Ella: ' + (texto || res.transcripcion || '(audio)') + '\nTú anotaste: ' + hechos.join('; '));
  var botones = [[{ text: '📋 Pendientes', callback_data: 'ver' }]];
  if (deshacer.length) botones[0].unshift({ text: '↩️ Deshacer', callback_data: 'undo:' + token });
  encDecir(chat, dicho + lineas.join('\n\n') + (res.respuesta ? '\n\n' + encEsc(res.respuesta) : ''), botones);
}

function encLinea(d) {
  var falta = Math.max(0, (d.precio || 0) - (d.abono || 0));
  var plata = d.pagado ? (d.precio ? encPesos(d.precio) + ' · pagado ✅' : 'pagado ✅')
    : d.precio ? encPesos(d.precio) + (d.abono ? ' · abonó ' + encPesos(d.abono) : '') + ' · <b>debe ' + encPesos(falta) + '</b>' : 'sin precio';
  return '<b>' + encEsc(d.nombre) + '</b>' + (d.que ? ' — ' + encEsc(d.que) : '') +
    '\n    ' + (d.entregado ? '📦 entregado' : '📅 ' + encFechaBonita(d.fechaEntrega)) + ' · 💰 ' + plata +
    (d.foto ? ' · 📷' : '') + (d.notas ? '\n    🗒 ' + encEsc(d.notas) : '');
}

function encParchar(id, campos, pase) {
  var mask = Object.keys(campos).map(function (k) { return 'updateMask.fieldPaths=' + k; }).join('&');
  var r = UrlFetchApp.fetch(ENC_FS + '/catalog/encargos/items/' + id + '?' + mask + '&currentDocument.exists=true', {
    method: 'patch', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + (pase || encPase()) },
    payload: JSON.stringify({ fields: encCampos(campos) })
  });
  return r.getResponseCode();
}

function encDeshacer(chat, token) {
  var cache = CacheService.getScriptCache(), l = cache.get('undo_' + token);
  if (!l) { encDecir(chat, 'Ya no puedo deshacer eso (pasó mucho rato). Corrígelo en el panel → <a href="' + ENC_PANEL + '">Encargos</a>.'); return; }
  var pase = encPase(), ok = 0, mal = 0;
  JSON.parse(l).reverse().forEach(function (u) {
    if (u.t === 'crear') {
      var r = UrlFetchApp.fetch(ENC_FS + '/catalog/encargos/items/' + u.id, { method: 'delete', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + pase } });
      r.getResponseCode() === 200 ? ok++ : mal++;
    } else { encParchar(u.id, u.antes, pase) === 200 ? ok++ : mal++; }
  });
  cache.remove('undo_' + token);
  encMemoria(chat, 'Ella deshizo lo último que anotaste.');
  encDecir(chat, mal ? '⚠️ Deshice ' + ok + ', pero ' + mal + ' no se pudo. Revísalo en el panel.' : '↩️ Listo, lo deshice.');
}

/* Prueba el modo rápido desde el editor (no guarda nada): ▶ Ejecutar encargosProbarIA */
function encargosProbarIA() {
  if (!encProp('GEMINI_KEY')) { Logger.log('⚠️ Falta la propiedad GEMINI_KEY.'); return; }
  var lista = encLeerEncargos() || [];
  ['Natalia pidió aros de corazones rojos para el viernes, 8 lucas', 'Natalia llevó aros de corazones y me debe 6 lucas', '¿quién me debe plata?'].forEach(function (t) {
    try {
      var r = encGemini([{ text: 'ENCARGOS (JSON):\n' + JSON.stringify(encContexto(lista)) + '\n\nMENSAJE NUEVO:\n' + t }]);
      Logger.log('«' + t + '» → ' + JSON.stringify(r));
    } catch (e) { Logger.log('❌ ' + e.message); }
  });
}

/* Dice qué ve Telegram: a qué dirección manda los mensajes, cuántos esperan y el último error. */
function encargosDiagnostico() {
  var r = encTg('getWebhookInfo', {});
  if (!r.ok) { Logger.log('❌ Telegram respondió: ' + JSON.stringify(r)); return; }
  var w = r.result || {};
  Logger.log('Dirección: …' + String(w.url || '(ninguna)').slice(-30));
  Logger.log('Mensajes esperando: ' + (w.pending_update_count || 0));
  Logger.log(w.last_error_message ? '❌ Último error: ' + w.last_error_message + ' (' + new Date((w.last_error_date || 0) * 1000).toLocaleString() + ')' : '✅ Sin errores.');
}

/* Para probar a mano sin Telegram: revisa la base y las fechas. */
function encargosProbar() {
  Logger.log(encPase() ? '✅ Entra a la base.' : '❌ No entra a la base: revisa FIREBASE_PASSWORD.');
  var l = encLeerEncargos(); Logger.log(l ? '✅ Lee ' + l.length + ' encargos.' : '❌ No lee los encargos.');
  Logger.log('Productos: ' + encProductos().length);
  ['hoy', 'mañana', 'viernes', '15/12', '20 dic', '3-1-27'].forEach(function (t) { Logger.log(t + ' → ' + encLeerFecha(t)); });
}
// ---- fin de encargos-bot.gs (si no ves esta línea en Apps Script, el archivo quedó cortado) ----
