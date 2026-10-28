/* ============================================================
   Karivé Joyas · finalizar compra
   Mismo flujo que el carrito del catálogo, que ya funciona:
   - Transferencia: el pedido y su comprobante van al publicador (que da el
     número y manda el correo) y se registran en la base para el panel.
   - Tarjeta: se pide el link de pago a Mercado Pago, el pedido se guarda
     ANTES de ir a pagar (así nunca se pierde una venta pagada) y al volver
     se pide el número y sale el correo.
   ============================================================ */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const raiz = $('#pago');
  if (!raiz || !window.KV) return;
  const PEND = 'kv_pedido_pendiente';
  const form = { nombre: '', correo: '', telefono: '', direccion: '', region: '', comuna: '', notas: '' };
  try { Object.assign(form, JSON.parse(localStorage.getItem('kv_datos_compra') || '{}')); } catch (e) {}
  let medio = 'mercadopago', comprobante = null, cupon = null, cuponTxt = '', cuponErr = '', enviando = false, correoAvisado = '';
  let A = {}, items = [];

  function pendGuardar(d) {
    try { localStorage.setItem(PEND, JSON.stringify(d)); } catch (e) {}
    try { document.cookie = PEND + '=' + encodeURIComponent(JSON.stringify({ total: d.total, ref: d.ref, docId: d.docId })) + ';path=/;max-age=7200;samesite=lax;secure'; } catch (e) {}
  }
  function pendLeer() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(PEND) || 'null'); } catch (e) {}
    if (d && d.pedido) return d;
    try { const m = document.cookie.match(new RegExp('(?:^|; )' + PEND + '=([^;]*)')); if (m) return Object.assign(JSON.parse(decodeURIComponent(m[1])), d || {}); } catch (e) {}
    return d;
  }
  function pendBorrar() { try { localStorage.removeItem(PEND); } catch (e) {} document.cookie = PEND + '=;path=/;max-age=0'; }

  const subtotal = () => items.reduce((s, it) => s + KV.precioDe(it.p) * it.qty, 0);
  const descuento = () => { if (!cupon) return 0; const r = kvCuponValidar(cupon.codigo, A, subtotal()); return r.ok ? r.descuento : 0; };
  const whatsapp = () => { const m = String(A.whatsapp || '+56988829803').match(/\d+/g); return m ? m.join('') : '56988829803'; };

  function pintarError(msg) { const e = $('#pago-error'); e.textContent = msg; e.hidden = false; e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }

  /* Mensaje para WhatsApp con el pedido, para quien quiere pagar por transferencia. */
  function mensajeTransferencia(total, envio) {
    const f = form;
    return '¡Hola Karivé! 💜 Quiero pagar por transferencia este pedido:\n' +
      items.map(it => '• ' + it.qty + ' × ' + (it.p.name || '') + (it.p.code ? ' (' + it.p.code + ')' : '') + ' — ' + formatCLP(KV.precioDe(it.p) * it.qty)).join('\n') +
      (envio != null ? '\nEnvío: ' + formatCLP(envio) + ' (' + [f.comuna, f.region].filter(Boolean).join(', ') + ')' : '') +
      (cupon && descuento() ? '\nCupón ' + cupon.codigo + ': −' + formatCLP(descuento()) : '') +
      '\nTotal: ' + formatCLP(total) + (f.nombre ? '\n\nMi nombre: ' + f.nombre : '');
  }

  // Mercado Pago, las tarjetas que acepta y las empresas de envío (Personalizar → Pago y envíos)
  const LOGOS_TARJETA = [['visa', 'Visa'], ['mastercard', 'Mastercard'], ['amex', 'American Express']];
  function logosTarjetas() {
    if (raiz.dataset.tarjetas === '0') return '';
    return '<div class="logos-pago" aria-label="Tarjetas que acepta Mercado Pago">' + LOGOS_TARJETA.map(l => '<img src="/assets/pagos/' + l[0] + '.svg" alt="' + l[1] + '" title="' + l[1] + '" width="44" height="28" loading="lazy">').join('') + '</div>';
  }
  function couriers() {
    try { return (JSON.parse(raiz.dataset.couriers || '[]') || []).filter(c => c && (c[0] || c[1])); } catch (e) { return []; }
  }
  function courier(conTexto) {
    const l = couriers();
    if (!l.length) return '';
    return '<span class="courier">' + (conTexto ? '<span>' + conTexto + '</span>' : '') + l.map(c => c[1]
      ? '<span class="courier-chip"><img src="' + escapeHtml(c[1]) + '" alt="' + escapeHtml(c[0] || 'Empresa de envío') + '" title="' + escapeHtml(c[0]) + '"></span>'
      : '<span class="courier-chip solo-nombre">' + escapeHtml(c[0]) + '</span>').join('') + '</span>';
  }
  function nombresCouriers() {
    const n = couriers().map(c => c[0]).filter(Boolean);
    return n.length > 1 ? n.slice(0, -1).join(', ') + ' o ' + n[n.length - 1] : n[0] || '';
  }

  function pintar() {
    if (!items.length) {
      raiz.innerHTML = '<div class="ok-caja"><h2>Tu carrito está vacío</h2><p>Elige tus joyas favoritas en la tienda.</p><a class="btn btn-1" href="/tienda/">Ir a la tienda</a></div>';
      return;
    }
    const sub = subtotal(), dcto = descuento();
    const envio = form.region ? kvEnvioCosto(form.region) : null;
    const total = Math.max(0, sub - dcto) + (envio || 0);
    const mp = kvMercadoPago(A), t = kvTransferencia(A);
    const conTarjeta = medio === 'mercadopago' && mp.activo;
    const campo = (k, etq, tipo, extra) => '<label class="campo"><span>' + etq + '</span><input data-c="' + k + '" type="' + (tipo || 'text') + '" value="' + escapeHtml(form[k] || '') + '"' + (extra || '') + '></label>';
    const comunas = kvComunasDe(form.region);
    raiz.innerHTML =
      '<div class="pago-caja">' +
        '<h2>Tus datos</h2>' +
        campo('nombre', 'Nombre y apellido *', 'text', ' autocomplete="name" required') +
        '<div class="doble">' + campo('correo', 'Correo electrónico *', 'email', ' autocomplete="email" required') +
        campo('telefono', 'Teléfono *', 'tel', ' autocomplete="tel" placeholder="+56 9 1234 5678" required') + '</div>' +
        '<h2 style="margin-top:14px">Envío</h2>' + (courier() ? '<div class="envio-con">' + courier('Despachamos a todo Chile con') + '</div>' : '') +
        campo('direccion', 'Dirección (calle, número, depto) *', 'text', ' autocomplete="street-address" required') +
        '<div class="doble"><label class="campo"><span>Región *</span><select data-c="region"><option value="">Elige tu región</option>' +
          KV_REGIONES.map(r => '<option value="' + escapeHtml(r) + '"' + (form.region === r ? ' selected' : '') + '>' + escapeHtml(r) + ' · envío ' + formatCLP(kvEnvioCosto(r)) + '</option>').join('') + '</select></label>' +
        '<label class="campo"><span>Comuna *</span><select data-c="comuna"' + (comunas.length ? '' : ' disabled') + '><option value="">' + (comunas.length ? 'Elige tu comuna' : 'Primero la región') + '</option>' +
          comunas.map(c => '<option' + (form.comuna === c ? ' selected' : '') + '>' + escapeHtml(c) + '</option>').join('') + '</select></label></div>' +
        '<label class="campo"><span>Nota para tu pedido (opcional)</span><textarea data-c="notas" rows="2">' + escapeHtml(form.notas || '') + '</textarea></label>' +
        '<h2 style="margin-top:14px">Pago</h2>' +
        (conTarjeta
          ? '<div class="medio-unico"><div class="mp-cab"><img class="mp-logo" src="/assets/pagos/mercadopago.webp" alt="Mercado Pago" width="64" height="60">' +
              '<div><b>Mercado Pago</b><small>Paga con tarjeta de débito o crédito</small>' + logosTarjetas() + '</div></div>' +
              '<span>Al confirmar te llevamos a Mercado Pago para pagar de forma segura.' + (mp.prueba ? ' <b>Modo de prueba: no se cobra dinero real.</b>' : '') + '</span></div>' +
            '<a class="transf-wa" href="https://wa.me/' + whatsapp() + '?text=' + encodeURIComponent(mensajeTransferencia(total, envio)) + '" target="_blank" rel="noopener">' +
              '<b>¿Prefieres pagar por transferencia?</b><span>Escríbenos por WhatsApp con tu pedido y te damos los datos.</span></a>'
          : '<div class="transf">' + (kvTransferenciaLista(A)
              ? '<b>' + escapeHtml(t.titular) + '</b><br>' + (t.rut ? 'RUT ' + escapeHtml(t.rut) + '<br>' : '') + escapeHtml(t.banco) + (t.tipo ? ' · ' + escapeHtml(t.tipo) : '') +
                '<br>N° de cuenta <b>' + escapeHtml(t.numero) + '</b>' + (t.correo ? '<br>' + escapeHtml(t.correo) : '') +
                '<br><button type="button" class="btn btn-2" style="margin-top:10px;min-height:40px" id="copiar-transf">Copiar datos</button>'
              : 'Escríbenos por WhatsApp y te damos los datos de transferencia.') + '</div>' +
            '<label class="archivo' + (comprobante ? ' listo' : '') + '">' + (comprobante ? '✓ Comprobante adjunto (toca para cambiarlo)' : '📎 Adjunta la foto o captura de tu transferencia *') +
            '<input type="file" accept="image/*" id="comprobante" hidden></label>') +
        '<div class="error-caja" id="pago-error" hidden></div>' +
        '<button type="button" class="btn btn-1 btn-bloque" id="confirmar" style="margin-top:14px"' + (enviando ? ' disabled' : '') + '>' +
          (enviando ? 'Enviando…' : conTarjeta ? 'Pagar ' + formatCLP(total) + ' con tarjeta' : 'Confirmar pedido por ' + formatCLP(total)) + '</button>' +
        '<p class="nota" style="margin-top:10px">Al comprar aceptas nuestra <a href="/devoluciones.html">política de cambios</a> (no hay cambios ni devoluciones por arrepentimiento; si hay un problema, lo vemos contigo) y la <a href="/privacidad.html">de privacidad</a>.</p>' +
      '</div>' +
      '<aside class="pago-caja"><h2>Tu pedido</h2>' +
        items.map(it => '<div class="resumen-item"><img src="' + escapeHtml(it.p.img) + '" alt="" width="56" height="56"><div>' + escapeHtml(it.p.name) +
          '<br><small class="nota">' + it.qty + ' × ' + formatCLP(KV.precioDe(it.p)) + '</small></div><b>' + formatCLP(KV.precioDe(it.p) * it.qty) + '</b></div>').join('') +
        '<div class="cupon"><input id="cupon" placeholder="Código de descuento" value="' + escapeHtml(cuponTxt) + '" autocomplete="off">' +
          (cupon ? '<button type="button" class="btn btn-2" id="cupon-quitar">Quitar</button>' : '<button type="button" class="btn btn-2" id="cupon-aplicar">Aplicar</button>') + '</div>' +
        (cuponErr ? '<div class="cupon-msg error">' + escapeHtml(cuponErr) + '</div>' : '') +
        (cupon ? '<div class="cupon-msg ok">✓ ' + escapeHtml(cupon.codigo) + ': ' + escapeHtml(kvCuponTexto(cupon)) + '</div>' : '') +
        '<div class="fila"><span>Subtotal</span><span>' + formatCLP(sub) + '</span></div>' +
        (dcto ? '<div class="fila"><span>Descuento</span><span>−' + formatCLP(dcto) + '</span></div>' : '') +
        '<div class="fila"><span>Envío' + (form.region ? (form.region === KV_REGION_RM ? ' (RM)' : ' (regiones)') : '') + '</span><span>' + (envio != null ? formatCLP(envio) : 'elige tu región') + '</span></div>' +
        '<div class="fila total"><span>Total</span><span>' + formatCLP(total) + '</span></div>' +
        '<ul class="lista-confianza"><li>🚚 ' + (nombresCouriers() ? 'Despacho a todo Chile con ' + escapeHtml(nombresCouriers()) : 'Despacho a todo Chile desde Santiago') + '</li><li>💬 ¿Dudas? <a href="https://wa.me/' + whatsapp() + '">Escríbenos por WhatsApp</a></li></ul>' +
      '</aside>';
    conectar();
  }

  function conectar() {
    // el mensaje de WhatsApp se arma al tocarlo, con lo último que se escribió
    const tw = raiz.querySelector('.transf-wa');
    if (tw) tw.addEventListener('click', () => {
      const env = form.region ? kvEnvioCosto(form.region) : null;
      tw.href = 'https://wa.me/' + whatsapp() + '?text=' + encodeURIComponent(mensajeTransferencia(Math.max(0, subtotal() - descuento()) + (env || 0), env));
    });
    raiz.querySelectorAll('[data-c]').forEach(n => n.addEventListener(n.tagName === 'SELECT' ? 'change' : 'input', () => {
      form[n.dataset.c] = n.value;
      try { localStorage.setItem('kv_datos_compra', JSON.stringify(form)); } catch (e) {}
      guardarContacto();
      if (n.dataset.c === 'region') { if (kvComunasDe(n.value).indexOf(form.comuna) < 0) form.comuna = ''; pintar(); }
    }));
    raiz.querySelectorAll('[data-medio]').forEach(b => b.addEventListener('click', () => { medio = b.dataset.medio; pintar(); }));
    const cp = $('#copiar-transf');
    if (cp) cp.addEventListener('click', () => {
      const t = kvTransferencia(A);
      try { navigator.clipboard.writeText([t.titular, t.rut ? 'RUT: ' + t.rut : '', t.banco, t.tipo, t.numero, t.correo].filter(Boolean).join('\n')); cp.textContent = '✓ Copiados'; } catch (e) {}
    });
    const ci = $('#cupon'); if (ci) ci.addEventListener('input', e => { cuponTxt = e.target.value; });
    const ca = $('#cupon-aplicar');
    if (ca) ca.addEventListener('click', () => {
      const r = kvCuponValidar(cuponTxt, A, subtotal());
      if (r.ok) { cupon = r.cupon; cuponErr = ''; cuponTxt = kvCuponNormalizar(cuponTxt); } else { cupon = null; cuponErr = r.error; }
      pintar();
    });
    const cq = $('#cupon-quitar'); if (cq) cq.addEventListener('click', () => { cupon = null; cuponTxt = ''; cuponErr = ''; pintar(); });
    const comp = $('#comprobante');
    if (comp) comp.addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) kvCompressPhoto(f, d => { comprobante = d; pintar(); }, 1100, 0.8); });
    $('#confirmar').addEventListener('click', enviar);
  }

  /* Si alcanza a escribir sus datos y no termina, el panel puede ayudarte a
     recuperar el carrito (Pedidos → Carritos abandonados). */
  let contactoT = null, contactoUlt = '';
  function guardarContacto() {
    clearTimeout(contactoT);
    contactoT = setTimeout(() => {
      const mail = String(form.correo || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) || !KV.visita) return;
      const firma = mail + '|' + (form.nombre || '') + '|' + (form.telefono || '');
      if (firma === contactoUlt) return;
      contactoUlt = firma;
      KV.visita({ contacto: { nombre: String(form.nombre || '').trim(), correo: mail, telefono: String(form.telefono || '').trim() } });
    }, 900);
  }

  async function enviar() {
    if (enviando) return;
    const f = form;
    if (!f.nombre.trim()) return pintarError('Escribe tu nombre.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.correo.trim())) return pintarError('Revisa tu correo electrónico.');
    const sug = kvCorreoOjo(f.correo);
    if (sug && correoAvisado !== f.correo.trim()) { correoAvisado = f.correo.trim(); return pintarError('¿Quisiste poner ' + sug + '? Si tu correo está bien, vuelve a tocar el botón: ahí te llega tu pedido.'); }
    if (!f.telefono.trim()) return pintarError('Escribe tu teléfono.');
    if (!f.direccion.trim()) return pintarError('Escribe tu dirección.');
    if (!f.region) return pintarError('Elige tu región para calcular el envío.');
    if (!f.comuna) return pintarError('Elige tu comuna.');
    const conTarjeta = medio === 'mercadopago' && kvMercadoPago(A).activo;
    if (!conTarjeta && !comprobante) return pintarError('Adjunta el comprobante de tu transferencia para confirmar el pedido.');
    const url = String(A.igPubUrl || '').trim();
    if (!url) return pintarError('Por ahora no podemos recibir pedidos en línea. Escríbenos por WhatsApp 💜');

    // precios y stock al día justo antes de cobrar
    items = await KV.carroItems();
    if (!items.length) { pintar(); return; }
    const envio = kvEnvioCosto(f.region), sub = subtotal(), dcto = descuento();
    const pedido = {
      cliente: { nombre: f.nombre.trim(), correo: f.correo.trim(), telefono: f.telefono.trim() },
      direccion: { calle: f.direccion.trim(), comuna: f.comuna, region: f.region },
      items: items.map(it => ({ id: it.p.id, code: it.p.code || '', name: it.p.name || '', precio: KV.precioDe(it.p), qty: it.qty })),
      subtotal: sub, cupon: dcto > 0 ? { codigo: cupon.codigo, descuento: dcto } : null,
      envio: { region: f.region, costo: envio }, total: Math.max(0, sub - dcto) + envio,
      notas: (f.notas || '').trim(), medioPago: conTarjeta ? 'mercadopago' : 'transferencia', origen: 'web'
    };
    enviando = true; pintar();

    if (conTarjeta) {
      const ref = 'kv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const conRef = Object.assign({}, pedido, { pagoRef: ref });
      try {
        const rp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'mp-preferencia', pedido: conRef, referencia: ref, volverA: location.origin + location.pathname }) });
        const dp = await rp.json();
        if (!dp || !dp.ok || !dp.url) throw new Error((dp && dp.error) || 'No se pudo iniciar el pago');
        // el pedido se guarda antes de ir a pagar; si la base no responde se sigue
        // igual (al volver de Mercado Pago el pedido llega por correo con el número)
        let docId = '';
        try {
          docId = await KV.fsCrear('catalog/pedidos/items', Object.assign({}, conRef, {
            num: 0, estado: 'nuevo', fecha: new Date().toISOString(), comprobante: '',
            pagoEstado: 'esperando-pago', pagoRef: ref, pagoId: '', courier: '', tracking: '', trackingUrl: '' }));
        } catch (e) { console.warn('No se pudo guardar el pedido en la base antes de pagar:', e); }
        pendGuardar({ total: pedido.total, ref: ref, docId: docId, pedido: conRef });
        location.href = dp.url;
      } catch (err) {
        enviando = false; pintar();
        pintarError('No pudimos iniciar el pago con tarjeta (' + err.message + '). Inténtalo de nuevo, o escríbenos por WhatsApp para pagar por transferencia 💜');
      }
      return;
    }

    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'pedido', pedido: pedido, comprobante: comprobante.split(',')[1] || '' }) });
      const d = await r.json();
      if (!d || !d.ok || !d.num) throw new Error((d && d.error) || 'No se pudo registrar el pedido');
      try {
        await KV.fsCrear('catalog/pedidos/items', Object.assign({}, pedido, { num: d.num, estado: 'nuevo', fecha: new Date().toISOString(),
          comprobante: comprobante, courier: '', tracking: '', trackingUrl: '' }));
      } catch (e2) { console.warn('El pedido llegó por correo; no se pudo registrar en la base:', e2); }
      KV.vaciarCarro();
      listo(d.num, pedido.total);
    } catch (err) {
      enviando = false; pintar();
      pintarError('No pudimos enviar tu pedido (' + err.message + '). Revisa tu conexión e intenta de nuevo, o escríbenos por WhatsApp 💜');
    }
  }

  function listo(num, total) {
    if (KV.visita) KV.visita({ hizoPedido: true });
    const txt = 'Hola Karivé 💜 ' + (form.nombre ? 'Soy ' + form.nombre.trim() + ', acabo' : 'Acabo') + ' de hacer ' + (num ? 'el pedido #' + num : 'un pedido') +
      (total ? ' por ' + formatCLP(total) : '') + ' en la web. ¡Quedo atenta!';
    raiz.innerHTML = '<div class="ok-caja" style="grid-column:1/-1"><div class="antetitulo">Pedido recibido</div>' +
      '<div class="ok-num">' + (num ? 'Pedido #' + num : '¡Listo!') + '</div>' +
      '<p>¡Gracias por tu compra! 💜 Te enviamos un correo de confirmación.<br>Cuando verifiquemos el pago preparamos tu pedido y te avisamos cuando vaya en camino.</p>' +
      '<p><a class="btn btn-wa" href="https://wa.me/' + whatsapp() + '?text=' + encodeURIComponent(txt) + '">Avisar también por WhatsApp</a></p>' +
      '<a class="btn btn-2" href="/">Volver al inicio</a></div>';
  }

  /* vuelta desde Mercado Pago (?pago=ok|pendiente|error). La URL NO prueba el
     pago: el pedido queda "por verificar" y el panel lo confirma. */
  async function vueltaPago() {
    const estado = new URLSearchParams(location.search).get('pago');
    if (!estado) return false;
    const pend = pendLeer();
    history.replaceState(null, '', location.pathname);
    pendBorrar();
    if (estado === 'ok') {
      KV.vaciarCarro();
      listo(0, pend && pend.total);
      if (pend && pend.pedido && A.igPubUrl) {
        try {
          const r = await fetch(A.igPubUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ accion: 'pedido', pedido: pend.pedido, comprobante: '' }) });
          const d = await r.json();
          if (d && d.ok && d.num) {
            listo(d.num, pend.total);
            if (pend.docId) KV.fsActualizar('catalog/pedidos/items/' + pend.docId, { num: d.num }).catch(e => console.warn(e));
          }
        } catch (e) { console.warn('No se pudo pedir el número del pedido:', e); }
      }
      return true;
    }
    KV.aviso(estado === 'pendiente' ? 'Tu pago quedó pendiente en Mercado Pago. Si se aprueba te avisamos 💜' : 'El pago no se completó. Puedes intentar de nuevo, o escríbenos por WhatsApp para pagar por transferencia 💜');
    return false;
  }

  (async () => {
    raiz.innerHTML = '<p class="vacio" style="grid-column:1/-1">Cargando tu carrito…</p>';
    try { A = await KV.ajustes(); } catch (e) { A = {}; }
    if (await vueltaPago()) return;
    items = await KV.carroItems();
    // vista previa del panel (Personalizar): pedido de ejemplo, sin tocar el carrito
    if (!items.length && window.top !== window && /[?&]vista\b/.test(location.search)) {
      const lista = await KV.productos();
      items = lista.filter(p => kvEnStock(p)).slice(0, 2).map(p => ({ p: p, qty: 1 }));
      form.region = form.region || KV_REGION_RM;
    }
    pintar();
  })();
  // el panel avisa cuando cambia el logo de envío o los de tarjetas
  window.addEventListener('kv-pago-repintar', () => { if (items.length) pintar(); });
})();
