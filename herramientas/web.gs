// ============================================================
//  WEB · KARIVÉ JOYAS (karivejoyas.cl / nueva.karivejoyas.cl)
//  Vuelve a publicar la web apenas cambia un producto: lo que subas o
//  cambies con el bot de Telegram o en el panel aparece en la web en
//  unos 5 a 8 minutos, sin esperar la actualización de la noche.
//
//  Este archivo va APARTE del publicador: en Apps Script, junto al archivo
//  que ya tienes, aprieta "+" → "Secuencia de comandos", llámalo "web" y
//  pega esto. No reemplaza ni cambia nada de lo que ya funciona.
//
//  CONFIGURACIÓN (una sola vez)
//  1) Propiedades del script → agregar  GH_TOKEN  = el token de GitHub
//     (permiso "Actions: lectura y escritura" solo sobre el repositorio web).
//  2) Arriba elige "webConfigurar" y aprieta ▶ Ejecutar.
//     Deja programada la revisión cada 5 minutos y publica una vez.
// ============================================================

var WEB_REPO = 'karivejoyas/web';
var WEB_FLUJO = 'publicar.yml';

/* ¿Cambió algún producto desde la última revisión? Se mira la fecha de
   modificación de todos (sin bajar las fotos, es muy liviano) y cuántos hay,
   así también se nota un producto borrado. */
function webVigilar() {
  var props = PropertiesService.getScriptProperties();
  var firma = webFirmaProductos();
  if (!firma) return;                                   // la base no respondió: se revisa en la próxima vuelta
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

/* Le pide a GitHub que vuelva a armar y publicar la web (tarda 1 a 2 minutos).
   También sirve para ejecutarla a mano. */
function webPublicarAhora() {
  var token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  if (!token) { Logger.log('❌ Falta la propiedad GH_TOKEN (token de GitHub).'); return false; }
  var r = UrlFetchApp.fetch('https://api.github.com/repos/' + WEB_REPO + '/actions/workflows/' + WEB_FLUJO + '/dispatches', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: JSON.stringify({ ref: 'main' })
  });
  var ok = r.getResponseCode() === 204;
  Logger.log(ok ? '✅ Web publicándose (1 a 2 minutos).' : '❌ GitHub respondió ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  return ok;
}

/* Ejecútala UNA vez: programa la revisión cada 5 minutos y prueba todo. */
function webConfigurar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'webVigilar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('webVigilar').timeBased().everyMinutes(5).create();
  var firma = webFirmaProductos();
  if (firma) PropertiesService.getScriptProperties().setProperty('WEB_FIRMA', firma);
  Logger.log(firma ? '✅ Revisión cada 5 minutos programada (' + firma.split('|')[0] + ' productos).' : '⚠️ No pude leer los productos ahora; igual quedó programada.');
  webPublicarAhora();
}
