/* Karivé Joyas · «Mi pedido»: la clienta escribe su número de pedido y su
   correo y ve en qué va (lo publica el panel cada vez que cambia el estado). */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const raiz = $('#mi-pedido');
  if (!raiz) return;
  const FS = 'https://firestore.googleapis.com/v1/projects/karive-catalogo/databases/(default)/documents/catalog/seguimiento/items/';
  const valor = (v) => {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor);
    if ('mapValue' in v) { const o = {}; Object.keys(v.mapValue.fields || {}).forEach(k => { o[k] = valor(v.mapValue.fields[k]); }); return o; }
    return null;
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fecha = (iso) => { try { return iso ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : ''; } catch (e) { return ''; } };
  const pesos = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);
  const form = $('form', raiz), res = $('#mp-resultado'), btn = $('button[type="submit"]', form);
  const q = new URLSearchParams(location.search);
  if (q.get('n')) form.num.value = q.get('n');
  if (q.get('c')) form.correo.value = q.get('c');

  const PASOS = [['nuevo', 'Pedido recibido', 'fecha'], ['verificado', 'Pago verificado', 'verificadoFecha'], ['preparando', 'En preparación', 'preparandoFecha'], ['enviado', 'Enviado', 'enviadoFecha']];
  function pintar(p) {
    const actual = Math.max(0, PASOS.findIndex(x => x[0] === p.estado));
    const pasos = PASOS.map((x, i) => '<li class="' + (i < actual ? 'hecho' : i === actual ? 'ahora' : '') + '"><b>' + x[1] + '</b>' +
      (i <= actual && p[x[2]] ? '<small>' + esc(fecha(p[x[2]])) + '</small>' : '') + '</li>').join('');
    const envio = p.estado === 'enviado' && (p.tracking || p.trackingUrl)
      ? '<div class="mp-envio">🚚 Va con <b>' + esc(p.courier || 'Blue Express') + '</b>' + (p.tracking ? ' · seguimiento <b>' + esc(p.tracking) + '</b>' : '') +
        '<br><a class="btn btn-2" href="' + esc(p.trackingUrl || 'https://www.blue.cl/seguimiento') + '" target="_blank" rel="noopener">Ver dónde va mi pedido</a></div>' : '';
    const items = (p.items || []).map(i => '<li><span>' + esc(i.nombre) + '</span><span>× ' + esc(i.cantidad) + '</span></li>').join('');
    res.innerHTML = '<div class="mp-caja"><div class="mp-cab"><h2>Pedido #' + esc(p.num) + '</h2>' + (p.total ? '<span>' + pesos(p.total) + '</span>' : '') + '</div>' +
      '<ol class="mp-pasos">' + pasos + '</ol>' + envio +
      (items ? '<h3>Lo que pediste</h3><ul class="mp-items">' + items + '</ul>' : '') +
      '<p class="mp-nota">¿Dudas con tu pedido? <a href="https://wa.me/' + esc(raiz.dataset.wa || '') + '?text=' + encodeURIComponent('Hola Karivé 💜 Te escribo por mi pedido #' + p.num) + '">Escríbenos por WhatsApp</a>.</p></div>';
  }
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const num = form.num.value.replace(/\D/g, ''), correo = form.correo.value.trim();
    if (!num || !correo) { res.innerHTML = '<p class="mp-error" role="alert">Escribe tu número de pedido y el correo con que compraste.</p>'; return; }
    btn.disabled = true; btn.textContent = 'Buscando…';
    try {
      const r = await fetch(FS + await kvSeguimientoId(correo, num));
      if (r.status === 404 || r.status === 403) {
        res.innerHTML = '<p class="mp-error" role="alert">No encontramos el pedido #' + esc(num) + ' con ese correo. Revisa que el número y el correo sean los del correo de confirmación. Si compraste hace muy poco, vuelve a mirar en unas horas o <a href="https://wa.me/' + esc(raiz.dataset.wa || '') + '">escríbenos por WhatsApp</a>.</p>';
      } else if (!r.ok) {
        throw new Error(r.status);
      } else {
        const d = await r.json(), p = {};
        Object.keys(d.fields || {}).forEach(k => { p[k] = valor(d.fields[k]); });
        pintar(p);
        history.replaceState(null, '', location.pathname + '?n=' + encodeURIComponent(num));
      }
    } catch (e) {
      res.innerHTML = '<p class="mp-error" role="alert">No pudimos revisar tu pedido ahora. Inténtalo de nuevo en un momento o escríbenos por WhatsApp.</p>';
    }
    btn.disabled = false; btn.textContent = 'Ver mi pedido';
  });
  if (form.num.value && form.correo.value) form.requestSubmit();
})();
