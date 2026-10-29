// ============================================================
//  WEB · KARIVÉ JOYAS (karivejoyas.cl)
//  Vuelve a publicar la web apenas cambia algo: los productos (bot de
//  Telegram o panel), la configuración (cupones, colecciones, envíos…) o
//  los textos y diseño de la web (panel nuevo → Tienda online).
//  · Lo que guardas en el panel se ve en la web en 2 a 3 minutos (revisión
//    rápida cada minuto, que solo lee 2 documentos de la base).
//  · Lo que cambia el bot de Telegram, en unos 15 a 20 minutos.
//  También trae tus últimos videos de Instagram para la portada (la foto y el
//  video, que en la web se reproduce solo, sin sonido). Usa el mismo acceso
//  a Instagram que ya tiene el publicador: no hay que configurar nada.
//  Y manda un correo de recordatorio a quien se fue a pagar y no terminó
//  (una sola vez por pedido; ver «RECORDATORIO DE PAGO PENDIENTE» más abajo).
//
//  Este archivo va APARTE del publicador: en Apps Script, junto al archivo
//  que ya tienes, aprieta "+" → "Secuencia de comandos", llámalo "web" y
//  pega esto. No reemplaza ni cambia nada de lo que ya funciona.
//
//  CONFIGURACIÓN (una sola vez)
//  1) Propiedades del script → agregar  GH_TOKEN  = el token de GitHub
//     (permiso "Actions: lectura y escritura" solo sobre el repositorio web).
//     y  FIREBASE_PASSWORD = la contraseña con que entras al panel (para leer
//     los pedidos y mandar los recordatorios de pago pendiente).
//  2) Arriba elige "webConfigurar" y aprieta ▶ Ejecutar.
//     Deja programadas las revisiones (cada minuto y cada 15 minutos) y publica una vez.
// ============================================================

var WEB_REPO = 'karivejoyas/web';
var WEB_FLUJO = 'publicar.yml';

/* Revisión de productos (cada 15 minutos), para lo que cambia el bot de
   Telegram: se mira la fecha de modificación de todos los productos (sin
   bajar las fotos) y cuántos hay —así también se nota uno borrado—, y si
   hay un reel nuevo en Instagram. */
function webVigilar() {
  var props = PropertiesService.getScriptProperties();
  var firma = webFirmaProductos();
  if (!firma) return;                                   // la base no respondió: se revisa en la próxima vuelta
  firma += '|' + webInstagramUltimo();                 // un reel nuevo también publica
  var anterior = props.getProperty('WEB_FIRMA');
  if (firma === anterior) return;
  props.setProperty('WEB_FIRMA', firma);
  if (anterior) webPublicarAhora();                     // la primera vez solo se anota
}

function webFirmaProductos() {
  var url = 'https://firestore.googleapis.com/v1/projects/karive-catalogo/databases/(default)/documents/catalog/products/items?pageSize=300&mask.fieldPaths=code';
  var ultima = '', total = 0, token = '';
  try {
    do {
      var r = UrlFetchApp.fetch(url + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) return '';
      var d = JSON.parse(r.getContentText());
      (d.documents || []).forEach(function (doc) {
        total++;
        if (doc.updateTime > ultima) ultima = doc.updateTime;
      });
      token = d.nextPageToken || '';
    } while (token);
  } catch (e) { return ''; }
  return total + '|' + ultima;
}

/* Revisión rápida (cada minuto): ¿se guardó algo en el panel? Mira solo la
   fecha de la web (tema y avisos de productos) y de la configuración:
   2 lecturas por minuto, una parte chica de la cuota gratis de la base. */
function webRapido() {
  var a = webFechaDoc('catalog/web', 'nombreTema'), b = webFechaDoc('catalog/settings', 'whatsapp');
  if (!a || !b) return;                                 // la base no respondió: se revisa en el próximo minuto
  var props = PropertiesService.getScriptProperties();
  var firma = a + '|' + b, anterior = props.getProperty('WEB_RAPIDO');
  if (firma === anterior) return;
  props.setProperty('WEB_RAPIDO', firma);
  if (anterior) webPublicarAhora();                     // la primera vez solo se anota
}

/* Fecha de última modificación de un documento ('' si no se puede leer). */
function webFechaDoc(ruta, campo) {
  try {
    var r = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/karive-catalogo/databases/(default)/documents/' + ruta + '?mask.fieldPaths=' + campo, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return '';
    return JSON.parse(r.getContentText()).updateTime || '';
  } catch (e) { return ''; }
}

/* Le pide a GitHub que vuelva a armar y publicar la web (tarda 1 a 2 minutos).
   También sirve para ejecutarla a mano. */
function webPublicarAhora() {
  var token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  if (!token) { Logger.log('❌ Falta la propiedad GH_TOKEN (token de GitHub).'); return false; }
  var ig = webInstagram();
  var cuerpo = { ref: 'main' };
  if (ig && ig.length) cuerpo.inputs = { instagram: JSON.stringify(ig) };
  var r = UrlFetchApp.fetch('https://api.github.com/repos/' + WEB_REPO + '/actions/workflows/' + WEB_FLUJO + '/dispatches', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: JSON.stringify(cuerpo)
  });
  var ok = r.getResponseCode() === 204;
  Logger.log(ok ? '✅ Web publicándose (1 a 2 minutos).' : '❌ GitHub respondió ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  return ok;
}

/* Ejecútala UNA vez: programa las revisiones y prueba todo.
   (La de productos lee todos los productos, por eso va cada 15 minutos; la
   rápida lee 2 documentos por minuto. Juntas usan menos de un tercio de la
   cuota gratis diaria de la base, que es de 50.000 lecturas.) */
function webConfigurar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['webVigilar', 'webRapido', 'webRecordatorios'].indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('webVigilar').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('webRapido').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('webRecordatorios').timeBased().everyHours(1).create();
  webRapido();
  var firma = webFirmaProductos();
  if (firma) PropertiesService.getScriptProperties().setProperty('WEB_FIRMA', firma + '|' + webInstagramUltimo());
  Logger.log(firma ? '✅ Revisiones programadas: panel cada minuto y productos cada 15 minutos (' + firma.split('|')[0] + ' productos).' : '⚠️ No pude leer los productos ahora; igual quedaron programadas.');
  webProbarRecordatorios();
  if (typeof webProbarInstagram === 'function') webProbarInstagram();
  else Logger.log('⚠️ Falta la parte de Instagram: copia el archivo web.gs COMPLETO (termina en la función webProbarInstagram) y guarda.');
  webPublicarAhora();
}

// ------------------------------------------------------------
//  INSTAGRAM: últimas publicaciones para la portada de la web
// ------------------------------------------------------------
var WEB_GRAPH = 'https://graph.facebook.com/v21.0/';
var WEB_IG_CAMPOS = 'id,media_type,media_product_type,thumbnail_url,media_url,permalink,caption,timestamp';

/* Los accesos a Instagram/Facebook que ya guardó el publicador (propiedades
   del script). Se prueban todos hasta encontrar uno que responda. */
function webIgAccesos() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var tokens = [], ids = [];
  Object.keys(props).forEach(function (k) {
    var v = String(props[k] || '').trim();
    if (/TOKEN/i.test(k) && !/^(GH|GITHUB|MP|MERCADO|ML|MELI|TELEGRAM|TG|OPENROUTER|OR_|GEMINI|GROQ)/i.test(k) && v.length > 40) tokens.push(v);
    if (/(IG|INSTA)/i.test(k) && /(ID|USER|CUENTA)/i.test(k) && /^\d{6,}$/.test(v)) ids.push(v);
  });
  return { tokens: tokens, ids: ids };
}

function webIgPedir(url) {
  try {
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return null;
    return JSON.parse(r.getContentText());
  } catch (e) { return null; }
}

/* Lista de publicaciones de Instagram tal como las entrega Meta (o null). */
function webIgMedios() {
  var cache = CacheService.getScriptCache();
  var guardado = cache.get('web_ig');
  if (guardado) return JSON.parse(guardado);
  var acc = webIgAccesos(), datos = null;
  for (var i = 0; i < acc.tokens.length && !datos; i++) {
    var t = encodeURIComponent(acc.tokens[i]);
    var cuentas = acc.ids.slice();
    // acceso de Instagram (inicio de sesión con Instagram)
    var d = webIgPedir('https://graph.instagram.com/me/media?fields=' + WEB_IG_CAMPOS + '&limit=30&access_token=' + t);
    if (d && d.data) { datos = d.data; break; }
    // acceso de Facebook (página o usuario): se busca la cuenta de Instagram conectada
    var yo = webIgPedir(WEB_GRAPH + 'me?fields=instagram_business_account&access_token=' + t);
    if (yo && yo.instagram_business_account) cuentas.push(yo.instagram_business_account.id);
    var pags = webIgPedir(WEB_GRAPH + 'me/accounts?fields=instagram_business_account&access_token=' + t);
    ((pags && pags.data) || []).forEach(function (p) { if (p.instagram_business_account) cuentas.push(p.instagram_business_account.id); });
    for (var j = 0; j < cuentas.length && !datos; j++) {
      var m = webIgPedir(WEB_GRAPH + cuentas[j] + '/media?fields=' + WEB_IG_CAMPOS + '&limit=30&access_token=' + t);
      if (m && m.data) datos = m.data;
    }
  }
  if (datos) cache.put('web_ig', JSON.stringify(datos), 1500);   // se vuelve a mirar cada 25 minutos
  return datos;
}

/* Lo que se manda a la web: hasta 12 videos y 6 fotos, lo más nuevo primero. */
function webInstagram() {
  var datos = webIgMedios();
  if (!datos) return null;
  var videos = [], otras = [];
  datos.forEach(function (x) {
    var img = x.media_type === 'VIDEO' ? (x.thumbnail_url || '') : (x.media_url || x.thumbnail_url || '');
    if (!img || !x.permalink) return;
    var it = { id: x.id, tipo: x.media_type, img: img, url: x.permalink, texto: String(x.caption || '').slice(0, 200), fecha: x.timestamp || '' };
    if (x.media_type === 'VIDEO' && x.media_url) it.video = x.media_url;   // el video, para que en la web se mueva solo
    if (it.tipo === 'VIDEO') { if (videos.length < 12) videos.push(it); }
    else if (otras.length < 6) otras.push(it);
  });
  return videos.concat(otras);
}

/* Id de la publicación más nueva de Instagram. */
function webInstagramUltimo() {
  var props = PropertiesService.getScriptProperties();
  var d = webIgMedios(), id = (d && d[0] && d[0].id) || '';
  if (id) props.setProperty('WEB_IG_ULTIMO', id);       // si Instagram no responde, se usa el último conocido
  return id || props.getProperty('WEB_IG_ULTIMO') || '';
}

/* Para revisar a mano: dice cuántas publicaciones encontró. */
function webProbarInstagram() {
  var ig = webInstagram();
  if (!ig) { Logger.log('⚠️ Instagram: no encontré un acceso que funcione en las propiedades del script. La portada no mostrará la sección de Instagram.'); return; }
  var v = ig.filter(function (x) { return x.tipo === 'VIDEO'; }).length;
  Logger.log('✅ Instagram: ' + ig.length + ' publicaciones (' + v + ' videos). La más nueva: ' + (ig[0] ? ig[0].url : '—'));
}
// ------------------------------------------------------------
//  RECORDATORIO DE PAGO PENDIENTE («carrito abandonado»)
//  Si alguien llenó sus datos, se fue a pagar con Mercado Pago y no terminó,
//  a las 3 horas le llega UN correo (desde esta cuenta de Gmail) con lo que
//  eligió y un enlace que le vuelve a armar el carrito. Nunca se repite por
//  el mismo pedido, ni si después compró. Máximo 20 al día.
//  Necesita la propiedad FIREBASE_PASSWORD (la contraseña del panel) para
//  poder leer los pedidos, que son privados.
// ------------------------------------------------------------
var WEB_FB_KEY = 'AIzaSyC6XWnbq6QEg4DjldVKvoafbe9dtZdyLqI';
var WEB_FS = 'https://firestore.googleapis.com/v1/projects/karive-catalogo/databases/(default)/documents';

/* Entra a la base como el panel (el pase dura 1 hora; se guarda 50 minutos). */
function webPase() {
  var cache = CacheService.getScriptCache(), pase = cache.get('web_pase');
  if (pase) return pase;
  var props = PropertiesService.getScriptProperties();
  var clave = props.getProperty('FIREBASE_PASSWORD');
  if (!clave) return '';
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + WEB_FB_KEY, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ email: props.getProperty('FIREBASE_EMAIL') || 'karive.joyas@gmail.com', password: clave, returnSecureToken: true })
  });
  if (r.getResponseCode() !== 200) { Logger.log('❌ No pude entrar a la base: revisa FIREBASE_PASSWORD.'); return ''; }
  pase = JSON.parse(r.getContentText()).idToken;
  cache.put('web_pase', pase, 3000);
  return pase;
}

function webValor(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(webValor);
  if ('mapValue' in v) { var o = {}; Object.keys(v.mapValue.fields || {}).forEach(function (k) { o[k] = webValor(v.mapValue.fields[k]); }); return o; }
  return null;
}

/* Pedidos de los últimos días (más nuevos primero). */
function webPedidosRecientes(pase, dias) {
  var desde = new Date(Date.now() - dias * 864e5).toISOString();
  var r = UrlFetchApp.fetch(WEB_FS + '/catalog/pedidos:runQuery', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + pase },
    payload: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'items' }],
      where: { fieldFilter: { field: { fieldPath: 'fecha' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: desde } } },
      orderBy: [{ field: { fieldPath: 'fecha' }, direction: 'DESCENDING' }], limit: 300 } })
  });
  if (r.getResponseCode() !== 200) { Logger.log('❌ No pude leer los pedidos (' + r.getResponseCode() + ').'); return null; }
  return JSON.parse(r.getContentText()).filter(function (x) { return x.document; }).map(function (x) {
    var p = webValor({ mapValue: { fields: x.document.fields || {} } });
    p._ruta = x.document.name.split('/documents/')[1];
    return p;
  });
}

function webPesos(n) { return '$' + String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function webEsc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function webRecordatorios() {
  var pase = webPase();
  if (!pase) return;
  var pedidos = webPedidosRecientes(pase, 3);
  if (!pedidos) return;
  var props = PropertiesService.getScriptProperties();
  var hoy = Utilities.formatDate(new Date(), 'America/Santiago', 'yyyy-MM-dd');
  var enviados = props.getProperty('WEB_REC_DIA') === hoy ? Number(props.getProperty('WEB_REC_N') || 0) : 0;
  var ahora = Date.now(), n = 0;
  pedidos.forEach(function (p) {
    if (enviados >= 20) return;
    var correo = String((p.cliente || {}).correo || '').trim();
    var edad = ahora - Date.parse(p.fecha || 0);
    if (p.num || p.medioPago !== 'mercadopago' || p.recordatorioFecha || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return;
    if (edad < 3 * 3600e3 || edad > 48 * 3600e3) return;
    // si después hizo otro pedido (pagado o por transferencia), no se le escribe
    var compro = pedidos.some(function (o) { return o !== p && o.num && String((o.cliente || {}).correo || '').trim().toLowerCase() === correo.toLowerCase() && String(o.fecha) >= String(p.fecha); });
    if (compro) return;
    var items = (p.items || []).filter(function (i) { return i && i.id; });
    if (!items.length) return;
    var enlace = 'https://karivejoyas.cl/finalizar-compra.html?carro=' + items.map(function (i) { return i.id + ':' + (i.qty || 1); }).join(',');
    var nombre = String((p.cliente || {}).nombre || '').trim().split(/\s+/)[0] || '';
    var lista = items.map(function (i) { return '• ' + (i.name || i.code) + (i.qty > 1 ? ' × ' + i.qty : ''); }).join('\n');
    var texto = 'Hola' + (nombre ? ' ' + nombre : '') + ':\n\nVimos que empezaste un pedido en karivejoyas.cl, pero el pago no alcanzó a completarse. Te dejamos lo que elegiste:\n\n' + lista +
      '\n\nTotal: ' + webPesos(p.total) + '\n\nPara terminar tu compra: ' + enlace +
      '\n\nSi tuviste algún problema con el pago o prefieres pagar por transferencia, responde este correo o escríbenos por WhatsApp al +56 9 8882 9803.' +
      '\n\nSi ya no te interesa, no tienes que hacer nada: no volveremos a escribirte por este pedido.\n\nUn abrazo,\nKarivé Joyas · Santiago, Chile · karivejoyas.cl';
    var html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#2A1838;max-width:520px">' +
      '<p>Hola' + (nombre ? ' ' + webEsc(nombre) : '') + ':</p><p>Vimos que empezaste un pedido en karivejoyas.cl, pero el pago no alcanzó a completarse. Te dejamos lo que elegiste:</p><ul>' +
      items.map(function (i) { return '<li>' + webEsc(i.name || i.code) + (i.qty > 1 ? ' × ' + i.qty : '') + '</li>'; }).join('') + '</ul>' +
      '<p><b>Total: ' + webPesos(p.total) + '</b></p>' +
      '<p><a href="' + enlace + '" style="display:inline-block;background:#5B2A82;color:#fff;text-decoration:none;padding:12px 22px;border-radius:24px">Terminar mi compra</a></p>' +
      '<p>Si tuviste algún problema con el pago o prefieres pagar por transferencia, responde este correo o escríbenos por WhatsApp al +56 9 8882 9803.</p>' +
      '<p style="color:#6B5A7B;font-size:13px">Si ya no te interesa, no tienes que hacer nada: no volveremos a escribirte por este pedido.</p>' +
      '<p>Un abrazo,<br>Karivé Joyas · Santiago, Chile · <a href="https://karivejoyas.cl" style="color:#5B2A82">karivejoyas.cl</a></p></div>';
    try {
      MailApp.sendEmail({ to: correo, subject: 'Tu pedido en Karivé Joyas quedó pendiente', body: texto, htmlBody: html, name: 'Karivé Joyas' });
    } catch (e) { Logger.log('❌ No se pudo enviar a ' + correo + ': ' + e); return; }
    UrlFetchApp.fetch(WEB_FS + '/' + p._ruta + '?updateMask.fieldPaths=recordatorioFecha', {
      method: 'patch', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + pase },
      payload: JSON.stringify({ fields: { recordatorioFecha: { stringValue: new Date().toISOString() } } })
    });
    enviados++; n++;
  });
  props.setProperties({ WEB_REC_DIA: hoy, WEB_REC_N: String(enviados) });
  if (n) Logger.log('✉️ Recordatorios enviados: ' + n);
}

/* Para probar a mano: dice cuántos pedidos podría recordar ahora, sin enviar nada. */
function webProbarRecordatorios() {
  var pase = webPase();
  if (!pase) { Logger.log('⚠️ Recordatorios: falta la propiedad FIREBASE_PASSWORD (la contraseña con que entras al panel).'); return; }
  var pedidos = webPedidosRecientes(pase, 3);
  if (!pedidos) return;
  var pend = pedidos.filter(function (p) { return !p.num && p.medioPago === 'mercadopago' && !p.recordatorioFecha; }).length;
  Logger.log('✅ Recordatorios: leo los pedidos bien (' + pedidos.length + ' de los últimos 3 días; ' + pend + ' con el pago sin terminar).');
}
// ---- fin de web.gs (si no ves esta línea en Apps Script, el archivo quedó cortado) ----
