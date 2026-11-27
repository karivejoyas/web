// ============================================================
//  BOT DE ENCARGOS · KARIVÉ JOYAS (Telegram)
//  Para anotar un encargo en segundos desde el celular: le escribes al bot y
//  te va preguntando (nombre, contacto, qué pidió, precio, para cuándo, foto).
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
    ['nombre', 'contacto', 'que', 'precio', 'abono', 'pagado', 'entregado', 'fechaEntrega', 'creado'].map(function (k) { return '&mask.fieldPaths=' + k; }).join(''),
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
  if (cmd === '/start' || cmd === '/ayuda' || cmd === 'ayuda') { encDecir(chat, 'Escribe /nuevo para anotar un encargo, /pendientes para verlos o /entregado para marcar uno como entregado.'); return; }
  if (cmd === '/pendientes' || cmd === 'pendientes') { encPendientes(chat); return; }
  if (cmd === '/entregado' || cmd === 'entregado') { encElegirEntregado(chat); return; }
  if (dato.indexOf('ent:') === 0) { encMarcarEntregado(chat, dato.slice(4)); return; }
  if (dato === 'ver') { encPendientes(chat); return; }
  if (dato === 'entregar') { encElegirEntregado(chat); return; }
  if (cmd === '/nuevo' || cmd === 'nuevo' || cmd === 'encargo' || dato === 'nuevo') { encPaso(chat, { paso: 'nombre', e: {} }); return; }

  var est = encEstado(chat);
  if (!est) {   // sin conversación abierta: cualquier mensaje empieza un encargo
    encDecir(chat, '¿Qué quieres hacer?', [[{ text: '📝 Anotar encargo', callback_data: 'nuevo' }], [{ text: '📋 Ver pendientes', callback_data: 'ver' }, { text: '✅ Marcar entregado', callback_data: 'entregar' }]]);
    return;
  }
  encResponder(chat, est, msg, texto, dato);
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
