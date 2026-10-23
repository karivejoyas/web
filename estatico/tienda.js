/* ============================================================
   Karivé Joyas · tienda web
   Carrito, buscador, menú, precios al día y boletín.
   Usa las mismas reglas del catálogo (comun.js): precios con oferta y
   descuento general, stock, cupones, envío por región.
   ============================================================ */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const FS = 'https://firestore.googleapis.com/v1/projects/karive-catalogo/databases/(default)/documents';
  const CAMPOS_AJUSTES = ['igPubUrl', 'pedidos', 'pagos', 'cupones', 'bienvenida', 'descuentoGlobal', 'whatsapp', 'instagram', 'facebook', 'whatsappMsg', 'envioTarifas'];
  const CAMPOS_PROD = ['name', 'price', 'priceOffer', 'category', 'code', 'stock', 'cantidad', 'detail'];

  /* ---------- Firestore por REST (sin el SDK: más liviano) ---------- */
  function fsValor(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return parseInt(v.integerValue, 10);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('nullValue' in v) return null;
    if ('timestampValue' in v) return v.timestampValue;
    if ('mapValue' in v) { const o = {}; const f = v.mapValue.fields || {}; Object.keys(f).forEach(k => { o[k] = fsValor(f[k]); }); return o; }
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsValor);
    return null;
  }
  function fsCampo(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(fsCampo) } };
    if (typeof v === 'object') { const f = {}; Object.keys(v).forEach(k => { f[k] = fsCampo(v[k]); }); return { mapValue: { fields: f } }; }
    return { stringValue: String(v) };
  }
  function fsCampos(o) { const f = {}; Object.keys(o).forEach(k => { f[k] = fsCampo(o[k]); }); return f; }
  async function fsCrear(ruta, datos) {
    const r = await fetch(FS + '/' + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fsCampos(datos) }) });
    if (!r.ok) throw new Error('No se pudo guardar (' + r.status + ')');
    const d = await r.json();
    return d.name.split('/').pop();
  }
  async function fsActualizar(ruta, datos) {
    const mask = Object.keys(datos).map(k => 'updateMask.fieldPaths=' + k).join('&');
    const r = await fetch(FS + '/' + ruta + '?' + mask, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fsCampos(datos) }) });
    if (!r.ok) throw new Error('No se pudo actualizar (' + r.status + ')');
  }

  /* ---------- ajustes (los mismos del panel), con caché corto ---------- */
  let ajustesProm = null;
  function ajustes() {
    if (ajustesProm) return ajustesProm;
    ajustesProm = (async () => {
      try {
        const g = JSON.parse(sessionStorage.getItem('kv_ajustes') || 'null');
        if (g && Date.now() - g.t < 5 * 60e3) return g.v;
      } catch (e) {}
      const mask = CAMPOS_AJUSTES.map(c => 'mask.fieldPaths=' + c).join('&');
      let v = {};
      try {
        const r = await fetch(FS + '/catalog/settings?' + mask);
        if (!r.ok) throw new Error('ajustes ' + r.status);
        const d = await r.json();
        Object.keys(d.fields || {}).forEach(k => { v[k] = fsValor(d.fields[k]); });
      } catch (err) {
        // la base no responde: se usa la copia publicada con la web, para no dejar de vender
        console.warn('Configuración en vivo no disponible; uso la publicada:', err);
        v = await fetch('/ajustes.json', { cache: 'no-cache' }).then(x => x.json());
        return v;
      }
      try { sessionStorage.setItem('kv_ajustes', JSON.stringify({ t: Date.now(), v: v })); } catch (e) {}
      return v;
    })().then(v => { kvSetDescuento(v); usarTarifas(v); return v; }).catch(err => { ajustesProm = null; throw err; });
    return ajustesProm;
  }

  /* Costos de envío: los que se fijan en el panel (Configuración → Envíos). */
  /* "Envío: $2.990 en la RM · de $3.990 a $5.990 en regiones, según tu región." */
  function textoEnvio() {
    const r = kvEnvioRango(window.kvEnvioTarifas);
    return 'Envío: ' + formatCLP(r.rm) + ' en la Región Metropolitana · ' + (r.regMin === r.regMax ? formatCLP(r.regMin) + ' al resto de Chile.' : 'de ' + formatCLP(r.regMin) + ' a ' + formatCLP(r.regMax) + ' en regiones, según tu región (se calcula al pagar).');
  }
  function usarTarifas(v) {
    const t = (v && v.envioTarifas) || {};
    window.kvEnvioCosto = function (region) { return kvEnvioDe(t, region); };
    window.kvEnvioTarifas = t;
  }

  /* ---------- productos ----------
     La lista sale de /productos.json (lo publicado, que se rehace a los pocos
     minutos de cada cambio). Solo se le pregunta a la base por los productos
     que importan en ese momento —la ficha que estás viendo y lo que hay en el
     carrito—, de a uno: así cada visita gasta unas pocas lecturas y no 130. */
  let productosProm = null;
  function productos() {
    if (!productosProm) productosProm = fetch('/productos.json', { cache: 'no-cache' }).then(r => r.json())
      .then(d => d.productos || []).catch(err => { productosProm = null; throw err; });
    return productosProm;
  }
  const VIVOS_KEY = 'kv_vivos';
  function vivosGuardados() { try { return JSON.parse(sessionStorage.getItem(VIVOS_KEY) || '{}') || {}; } catch (e) { return {}; } }
  /* Precio, oferta y stock al día de unos productos (por id). */
  async function productosAlDia(ids) {
    const lista = await productos();
    ids = Array.from(new Set((ids || []).filter(Boolean)));
    const cache = vivosGuardados(), ahora = Date.now();
    const faltan = ids.filter(id => !cache[id] || ahora - cache[id].t > 3 * 60e3);
    if (faltan.length) {
      try {
        const raiz = FS.split('/documents')[0].replace('https://firestore.googleapis.com/v1/', '') + '/documents/catalog/products/items/';
        const r = await fetch(FS + ':batchGet', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documents: faltan.map(id => raiz + id), mask: { fieldPaths: CAMPOS_PROD } }) });
        if (!r.ok) throw new Error('productos ' + r.status);
        (await r.json()).forEach(x => {
          if (x.found) {
            const p = {}; Object.keys(x.found.fields || {}).forEach(k => { p[k] = fsValor(x.found.fields[k]); });
            cache[x.found.name.split('/').pop()] = { t: ahora, p: p };
          } else if (x.missing) cache[x.missing.split('/').pop()] = { t: ahora, p: null };
        });
        try { sessionStorage.setItem(VIVOS_KEY, JSON.stringify(cache)); } catch (e) {}
      } catch (e) { console.warn('Precios al día no disponibles; uso los publicados:', e); }
    }
    ids.forEach(id => {
      const p = lista.find(x => x.id === id), c = cache[id];
      if (!p || !c) return;
      if (!c.p) { p.stock = false; return; }
      ['name', 'price', 'priceOffer', 'stock', 'cantidad', 'detail'].forEach(k => { if (k in c.p) p[k] = c.p[k]; else if (k === 'cantidad') delete p.cantidad; });
    });
    try { await ajustes(); } catch (e) {}
    return lista;
  }

  /* ---------- utilidades de pantalla ---------- */
  let toastT = null;
  function aviso(txt) {
    let t = $('#aviso-toast');
    if (!t) { t = document.createElement('div'); t.id = 'aviso-toast'; t.className = 'aviso-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = txt; t.classList.add('ver');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('ver'), 2600);
  }
  function precioDe(p) { return kvPrecioOferta(p) || p.price || 0; }
  function precioHtml(p) {
    const v = kvPrecioOferta(p);
    return v ? formatCLP(v) + '<s>' + formatCLP(p.price) + '</s>' : formatCLP(p.price || 0);
  }
  function abrirCajon(id) { const c = $('#' + id); if (!c) return; c.classList.add('abierto'); document.body.style.overflow = 'hidden'; const f = c.querySelector('button, a, input'); if (f) f.focus(); }
  function cerrarCajon(id) { const c = $('#' + id); if (!c) return; c.classList.remove('abierto'); document.body.style.overflow = ''; }
  $$('[data-cerrar]').forEach(b => b.addEventListener('click', () => cerrarCajon(b.dataset.cerrar)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.cajon.abierto, .buscador.abierto').forEach(c => { c.classList.remove('abierto'); document.body.style.overflow = ''; }); });

  /* ---------- menú ---------- */
  const hamb = $('#btn-menu');
  if (hamb) hamb.addEventListener('click', () => abrirCajon('cajon-menu'));
  $$('.desplegable > button').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const d = b.parentElement, abierto = d.classList.toggle('abierto');
    b.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  }));
  document.addEventListener('click', () => $$('.desplegable.abierto').forEach(d => { d.classList.remove('abierto'); d.firstElementChild.setAttribute('aria-expanded', 'false'); }));

  /* ---------- carrito ---------- */
  const CARRO_KEY = 'kv_carrito';
  let carro = {};
  try { carro = JSON.parse(localStorage.getItem(CARRO_KEY) || '{}') || {}; } catch (e) { carro = {}; }
  function carroGuardar() { try { localStorage.setItem(CARRO_KEY, JSON.stringify(carro)); } catch (e) {} carroContador(); visitaCarrito(); }
  function carroContador() {
    const n = Object.values(carro).reduce((a, b) => a + (b || 0), 0);
    $$('.contador').forEach(c => { c.textContent = n > 99 ? '99+' : n; c.hidden = n === 0; });
  }
  carroContador();
  async function carroItems() {
    const lista = await productosAlDia(Object.keys(carro));
    return Object.keys(carro).map(id => {
      const p = lista.find(x => x.id === id && kvEnStock(x));
      if (!p) return null;
      const tope = kvStockCantidad(p);
      return { p: p, qty: tope !== null ? Math.min(carro[id], tope) : carro[id] };
    }).filter(x => x && x.qty > 0);
  }
  async function agregar(id, n) {
    const lista = await productosAlDia([id]);
    const p = lista.find(x => x.id === id);
    if (!p || !kvEnStock(p)) { aviso('Este producto ya no está disponible'); return; }
    const tope = kvStockCantidad(p);
    const nuevo = (carro[id] || 0) + (n || 1);
    if (tope !== null && nuevo > tope) {
      carro[id] = tope; carroGuardar();
      aviso('Solo queda' + (tope === 1 ? ' 1 unidad' : 'n ' + tope + ' unidades') + ' de ' + p.name);
    } else {
      carro[id] = nuevo; carroGuardar();
      aviso('✓ ' + p.name + ' agregado al carrito');
    }
    carroPintar();
    await volarAlCarro(id);
    abrirCajon('cajon-carro');
  }

  /* La foto del producto vuela hasta la bolsa, la bolsa se mueve y el número salta. */
  function volarAlCarro(id) {
    const destino = $('#btn-carro');
    const origen = $('[data-tarjeta="' + id + '"] .tarjeta-foto img') || $('[data-ficha="' + id + '"] .ficha-foto img');
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saltar = () => { $$('.contador').forEach(c => { c.classList.remove('salta'); void c.offsetWidth; c.classList.add('salta'); });
      if (destino) { destino.classList.remove('salta'); void destino.offsetWidth; destino.classList.add('salta'); } };
    if (!origen || !destino || quieto || !origen.animate) { saltar(); return Promise.resolve(); }
    const a = origen.getBoundingClientRect(), b = destino.getBoundingClientRect();
    if (a.bottom < 0 || a.top > innerHeight) { saltar(); return Promise.resolve(); }
    const img = document.createElement('img');
    img.src = origen.currentSrc || origen.src; img.className = 'vuela'; img.alt = '';
    const x0 = a.left + a.width / 2 - 32, y0 = a.top + a.height / 2 - 32;
    const x1 = b.left + b.width / 2 - 32, y1 = b.top + b.height / 2 - 32;
    img.style.left = x0 + 'px'; img.style.top = y0 + 'px';
    document.body.appendChild(img);
    const dx = x1 - x0, dy = y1 - y0;
    const anim = img.animate([
      { transform: 'translate(0,0) scale(1.6)', opacity: 0 },
      { transform: 'translate(0,-10px) scale(1.25)', opacity: 1, offset: .15 },
      { transform: 'translate(' + dx * .55 + 'px,' + (dy * .55 - 90) + 'px) scale(.85)', opacity: 1, offset: .6 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.25)', opacity: .2 }
    ], { duration: 720, easing: 'cubic-bezier(.5,0,.3,1)' });
    return anim.finished.catch(() => {}).then(() => { img.remove(); saltar(); return new Promise(r => setTimeout(r, 260)); });
  }
  async function carroPintar() {
    const cont = $('#carro-cuerpo'); if (!cont) return;
    const items = await carroItems();
    if (!items.length) {
      cont.innerHTML = '<div class="vacio">Tu carrito está vacío.<br><br><a class="btn btn-1" href="/tienda/">Ver la tienda</a></div>';
      return;
    }
    const sub = items.reduce((s, it) => s + precioDe(it.p) * it.qty, 0);
    cont.innerHTML = '<div class="carro"><div class="carro-lista">' + items.map(it =>
      '<div class="carro-item"><img src="' + escapeHtml(it.p.img) + '" alt="" width="72" height="72" loading="lazy">' +
      '<div><b>' + escapeHtml(it.p.name) + '</b><small>' + escapeHtml(it.p.code) + ' · ' + formatCLP(precioDe(it.p)) + '</small></div>' +
      '<div class="cantidad"><button type="button" data-qty="-1" data-id="' + it.p.id + '" aria-label="Quitar uno">−</button><span>' + it.qty + '</span>' +
      '<button type="button" data-qty="1" data-id="' + it.p.id + '" aria-label="Agregar uno">+</button></div></div>').join('') +
      '</div><div class="carro-pie"><div class="fila total"><span>Subtotal</span><span>' + formatCLP(sub) + '</span></div>' +
      '<p class="nota">' + textoEnvio() + ' Si tienes un cupón, lo aplicas al pagar.</p>' +
      '<a class="btn btn-1 btn-bloque" href="/finalizar-compra.html">Finalizar compra</a>' +
      '<button type="button" class="btn btn-2 btn-bloque" style="margin-top:8px" data-cerrar="cajon-carro">Seguir comprando</button></div></div>';
    cont.querySelectorAll('[data-qty]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.id, d = parseInt(b.dataset.qty, 10);
      const p = (await productos()).find(x => x.id === id);
      const tope = p ? kvStockCantidad(p) : null;
      const nuevo = (carro[id] || 0) + d;
      if (tope !== null && nuevo > tope) { aviso('Solo queda' + (tope === 1 ? ' 1 unidad' : 'n ' + tope + ' unidades')); return; }
      if (nuevo <= 0) delete carro[id]; else carro[id] = nuevo;
      carroGuardar(); carroPintar();
    }));
    cont.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', () => cerrarCajon(b.dataset.cerrar)));
  }
  const btnCarro = $('#btn-carro');
  if (btnCarro) btnCarro.addEventListener('click', () => { carroPintar(); abrirCajon('cajon-carro'); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-agregar]');
    if (!b) return;
    e.preventDefault();
    const sel = b.dataset.cantidadDe ? $(b.dataset.cantidadDe) : null;
    agregar(b.dataset.agregar, sel ? parseInt(sel.textContent, 10) || 1 : 1);
  });

  /* ---------- ficha: cantidad, stock al día y foto ampliada ---------- */
  const ficha = $('[data-ficha]');
  if (ficha) {
    const id = ficha.dataset.ficha;
    const num = $('#ficha-cantidad');
    $$('[data-mas]').forEach(b => b.addEventListener('click', () => {
      const n = Math.max(1, (parseInt(num.textContent, 10) || 1) + parseInt(b.dataset.mas, 10));
      num.textContent = n;
    }));
    productosAlDia([id]).then(lista => {
      const p = lista.find(x => x.id === id);
      if (!p) return;
      const precio = $('#ficha-precio'); if (precio) precio.innerHTML = precioHtml(p);
      const st = $('#ficha-stock'), btn = $('#ficha-agregar');
      const tope = kvStockCantidad(p);
      if (!kvEnStock(p)) { st.textContent = 'Agotado por ahora'; st.className = 'stock no'; if (btn) { btn.disabled = true; btn.textContent = 'Agotado'; } }
      else if (tope !== null && tope <= 3) { st.textContent = tope === 1 ? '¡Queda solo 1!' : '¡Quedan solo ' + tope + '!'; st.className = 'stock pocas'; }
    });
    const foto = $('.ficha-foto');
    if (foto) foto.addEventListener('click', () => {
      let z = $('#zoom');
      if (!z) { z = document.createElement('div'); z.id = 'zoom'; z.className = 'zoom'; z.innerHTML = '<img alt="">'; z.addEventListener('click', () => z.classList.remove('abierto')); document.body.appendChild(z); }
      z.querySelector('img').src = foto.dataset.grande; z.querySelector('img').alt = foto.querySelector('img').alt;
      z.classList.add('abierto');
    });
  }

  /* ---------- tarjetas: precio y "agotado" según lo publicado (y lo ya
     consultado en esta visita); el precio final se confirma en el carrito ---------- */
  if ($('[data-tarjeta]')) Promise.all([productos(), ajustes().catch(() => null)]).then(([lista]) => {
    const cache = vivosGuardados();
    lista.forEach(p => { const c = cache[p.id]; if (c && c.p) Object.assign(p, c.p); else if (c && !c.p) p.stock = false; });
    $$('[data-tarjeta]').forEach(t => {
      const p = lista.find(x => x.id === t.dataset.tarjeta);
      if (!p) return;
      const pr = t.querySelector('.precio'); if (pr) pr.innerHTML = precioHtml(p);
      if (!kvEnStock(p)) { const b = t.querySelector('[data-agregar]'); if (b) { b.disabled = true; b.textContent = 'Agotado'; } }
    });
  });

  /* ---------- tienda: filtros y orden ---------- */
  const grillaTienda = $('#grilla-tienda');
  if (grillaTienda) {
    let col = new URLSearchParams(location.search).get('coleccion') || '';
    const items = $$('li', grillaTienda);
    const pintar = () => {
      const orden = ($('#orden') || {}).value || 'recomendado';
      const vis = items.filter(li => !col || li.dataset.col === col);
      items.forEach(li => { li.hidden = vis.indexOf(li) < 0; });
      const ord = vis.slice().sort((a, b) => orden === 'menor' ? a.dataset.precio - b.dataset.precio
        : orden === 'mayor' ? b.dataset.precio - a.dataset.precio
        : orden === 'nuevos' ? b.dataset.n - a.dataset.n : a.dataset.i - b.dataset.i);
      ord.forEach(li => grillaTienda.appendChild(li));
      $$('[data-filtro]').forEach(c => c.setAttribute('aria-pressed', c.dataset.filtro === col ? 'true' : 'false'));
      const cuenta = $('#cuenta'); if (cuenta) cuenta.textContent = vis.length + (vis.length === 1 ? ' producto' : ' productos');
    };
    $$('[data-filtro]').forEach(c => c.addEventListener('click', () => {
      col = c.dataset.filtro;
      history.replaceState(null, '', col ? '?coleccion=' + col : location.pathname);
      pintar();
    }));
    const o = $('#orden'); if (o) o.addEventListener('change', pintar);
    pintar();
  }

  /* ---------- buscador ---------- */
  const sinTildes = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const bus = $('#buscador'), busIn = $('#buscar-texto'), busRes = $('#buscar-res');
  async function buscar() {
    const q = sinTildes(busIn.value).trim();
    if (!q) { busRes.innerHTML = '<p class="vacio">Busca por nombre, color, colección o código (ej. «corazón», «azul», «FL-001»).</p>'; return; }
    const pal = q.split(/\s+/);
    const res = (await productos()).filter(p => kvEnStock(p) && pal.every(w => sinTildes([p.name, p.code, p.col, p.color].join(' ')).indexOf(w) >= 0));
    busRes.innerHTML = res.length
      ? '<ul class="grilla">' + res.slice(0, 24).map(p => '<li class="tarjeta"><a class="tarjeta-foto" href="' + p.url + '"><img src="' + escapeHtml(p.img) + '" alt="' + escapeHtml(p.name) + '" loading="lazy" width="400" height="400"></a>' +
        '<div class="tarjeta-txt"><a class="tarjeta-nombre" href="' + p.url + '">' + escapeHtml(p.name) + '</a><span class="precio">' + precioHtml(p) + '</span></div></li>').join('') + '</ul>'
      : '<p class="vacio">No encontramos «' + escapeHtml(busIn.value) + '». Prueba con otra palabra o escríbenos por WhatsApp.</p>';
  }
  const btnBus = $('#btn-buscar');
  if (btnBus && bus) {
    btnBus.addEventListener('click', () => { bus.classList.add('abierto'); document.body.style.overflow = 'hidden'; busIn.focus(); buscar(); });
    bus.addEventListener('click', e => { if (e.target === bus) { bus.classList.remove('abierto'); document.body.style.overflow = ''; } });
    busIn.addEventListener('input', buscar);
    const q = new URLSearchParams(location.search).get('q');
    if (q) { busIn.value = q; btnBus.click(); }
  }

  /* ---------- boletín ---------- */
  const bol = $('#boletin');
  if (bol) bol.addEventListener('submit', async e => {
    e.preventDefault();
    const correo = (bol.correo.value || '').trim().toLowerCase(), msg = $('#boletin-msg');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) { msg.textContent = 'Revisa tu correo.'; return; }
    msg.textContent = 'Guardando…';
    try {
      const a = await ajustes();
      const b = kvBienvenida(a);
      await fsCrear('catalog/suscriptores/items', { correo: correo, fecha: new Date().toISOString(), origen: 'web', codigo: b.activo ? b.codigo : '', acepta: true });
      if (b.activo && a.igPubUrl) {
        fetch(a.igPubUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'bienvenida', correo: correo, codigo: b.codigo, pct: b.pct }) }).catch(() => {});
      }
      msg.textContent = b.activo ? '¡Listo! Te enviamos tu cupón de ' + b.pct + '% a tu correo 💜' : '¡Listo! Te avisaremos de las novedades 💜';
      bol.reset();
    } catch (err) { msg.textContent = 'No pudimos guardar tu correo. Intenta de nuevo.'; }
  });

  /* ============================================================
     VISITAS (anónimas, para el panel: Informes y Vista en tiempo real).
     Igual que el catálogo antiguo: sin IP ni datos personales; solo ciudad
     aproximada, dispositivo, de dónde llegó y qué miró. No se cuentan las
     vistas previas del panel (van dentro de un marco).
     ============================================================ */
  const RAIZ_DOC = 'projects/karive-catalogo/databases/(default)/documents/';
  let visitaId = '';
  const enMarco = (() => { try { return window.top !== window; } catch (e) { return true; } })();
  if (!enMarco && !/[?&]nocontar\b/.test(location.search)) {
    try {
      visitaId = sessionStorage.getItem('kv_visita_id') || '';
      if (!visitaId) { visitaId = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); sessionStorage.setItem('kv_visita_id', visitaId); }
    } catch (e) { visitaId = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  }
  /* Guarda campos en la visita; `agregar` suma elementos a listas sin repetir. */
  function visita(datos, agregar) {
    if (!visitaId) return;
    const campos = Object.assign({ ultima: new Date().toISOString() }, datos || {});
    const w = { update: { name: RAIZ_DOC + 'catalog/visitas/items/' + visitaId, fields: fsCampos(campos) }, updateMask: { fieldPaths: Object.keys(campos) } };
    if (agregar) w.updateTransforms = Object.keys(agregar).map(k => ({ fieldPath: k, appendMissingElements: { values: agregar[k].map(fsCampo) } }));
    fetch(FS + ':commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ writes: [w] }), keepalive: true }).catch(() => {});
  }
  if (visitaId) {
    let nueva = false;
    try { nueva = !sessionStorage.getItem('kv_visita_ok'); sessionStorage.setItem('kv_visita_ok', '1'); } catch (e) {}
    if (nueva) {
      const dev = kvVisitaDispositivo(), org = kvVisitaOrigen(document.referrer);
      visita({ creada: new Date().toISOString(), dispositivo: dev.dispositivo, so: dev.so, navegador: dev.navegador, origenTipo: org.tipo, origenHost: org.host, pais: '', region: '', ciudad: '', sitio: 'web nueva' });
      try {
        const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 2500);
        fetch('https://get.geojs.io/v1/ip/geo.json', { signal: ctrl.signal }).then(r => r.json())
          .then(g => { if (g) visita({ pais: g.country || '', region: g.region || '', ciudad: g.city || '' }); }).catch(() => {});
      } catch (e) {}
    } else visita({});
    const ficha = $('[data-ficha]');
    if (ficha) visita({}, { productos: [($('h1', ficha) || {}).textContent || ''], productosIds: [ficha.dataset.ficha] });
    const col = location.pathname.match(/^\/c\//) && $('.migas [aria-current]');
    if (col) visita({}, { colecciones: [col.textContent.trim()] });
  }
  let visitaCarroT = null;
  function visitaCarrito() {
    if (!visitaId) return;
    clearTimeout(visitaCarroT);
    visitaCarroT = setTimeout(async () => {
      const items = await carroItems();
      const datos = { carritoActual: items.map(it => ({ id: it.p.id, name: it.p.name || '', code: it.p.code || '', qty: it.qty, precio: precioDe(it.p) })),
        carritoTotal: items.reduce((s, it) => s + precioDe(it.p) * it.qty, 0) };
      if (items.length) datos.agregoCarrito = true;
      visita(datos);
    }, 800);
  }

  /* ---------- siempre la última versión publicada ----------
     El navegador guarda las páginas unos minutos. Si ya hay una publicación
     más nueva que la que se está viendo, se recarga una vez (sin gastar nada
     de la base: version.txt es un archivo de la web). */
  (function () {
    const m = document.querySelector('meta[name="kv-version"]'); if (!m || window.top !== window) return;
    fetch('/version.txt', { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(v => {
      v = v.trim();
      if (!v || v <= m.content) return;
      const clave = 'kv_recargado_' + v;
      try { if (sessionStorage.getItem(clave)) return; sessionStorage.setItem(clave, '1'); } catch (e) { return; }
      location.reload();
    }).catch(() => {});
  })();

  /* ---------- movimiento de la portada ---------- */
  window.kvRevela = true;
  // el título de la portada sube palabra por palabra
  const h1 = $('.hero h1');
  if (h1 && !h1.querySelector('.palabra')) {
    let n = 0;
    const partir = (nodo) => Array.from(nodo.childNodes).forEach(c => {
      if (c.nodeType === 3) {
        const f = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(t => {
          if (!t) return;
          if (/^\s+$/.test(t)) { f.appendChild(document.createTextNode(t)); return; }
          const sp = document.createElement('span'); sp.className = 'palabra'; sp.style.setProperty('--p', n++); sp.textContent = t; f.appendChild(sp);
        });
        c.replaceWith(f);
      } else if (c.nodeType === 1 && c.tagName !== 'BR') partir(c);
    });
    h1.setAttribute('aria-label', h1.textContent);
    partir(h1);
  }
  // las colecciones entran en cascada al aparecer
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('[data-revelar]').forEach(el => io.observe(el));
    // lo que se mueve solo se pausa cuando no se ve
    const pausa = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('quieta', !e.isIntersecting)));
    $$('.cinta, .franja, .olas, .hero-marco').forEach(el => pausa.observe(el));
  } else $$('[data-revelar]').forEach(el => el.classList.add('visto'));
  // «Sobre nosotros»: al aparecer, las fotos se abren en abanico y el texto sube en cascada
  const entrarSobre = (el) => {
    el.classList.add('is-entered');
    el.querySelectorAll('.kv-anim.kv-hidden').forEach(a => { a.classList.remove('kv-hidden'); a.classList.add(a.dataset.kvAnim); });
  };
  if ('IntersectionObserver' in window) {
    const ioSobre = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { entrarSobre(e.target); ioSobre.unobserve(e.target); } }), { rootMargin: '0px 0px -200px 0px' });
    $$('.kv-aiwt').forEach(el => ioSobre.observe(el));
  } else $$('.kv-aiwt').forEach(entrarSobre);
  // efecto "profundidad con el mouse" en la foto de portada: las capas se
  // mueven a distintas velocidades (en celular queda quieta)
  const marco = $('.hero-img-marco');
  if (marco && matchMedia('(hover:hover) and (prefers-reduced-motion:no-preference)').matches) {
    const capas = () => [$('.hero-img', marco), $('.hero-img img', marco), $('.hero-sello', marco), $('.hero-nuevo', marco)];
    marco.addEventListener('pointermove', e => {
      if (document.documentElement.dataset.efPortada !== 'profundidad' || e.pointerType !== 'mouse') return;
      const r = marco.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      const [foto, img, sello, nuevo] = capas();
      if (foto) foto.style.transform = 'rotateY(' + (x * 6) + 'deg) rotateX(' + (-y * 6) + 'deg)';
      if (img) img.style.transform = 'scale(1.08) translate(' + (-x * 18) + 'px,' + (-y * 18) + 'px)';
      if (sello) sello.style.transform = 'translate(' + (x * 22) + 'px,' + (y * 22) + 'px)';
      if (nuevo) nuevo.style.transform = 'translate(' + (x * 30) + 'px,' + (y * 30) + 'px)';
    });
    marco.addEventListener('pointerleave', () => capas().forEach(el => { if (el) el.style.transform = ''; }));
  }
  // transición entre páginas: "la foto vuela" marca la foto que se tocó
  // (lo de "deslizar" al volver atrás está en el <head>)
  addEventListener('pageswap', e => {
    if (!e.viewTransition || document.documentElement.dataset.tr !== 'vuela') return;
    $$('[style*="view-transition-name"]').forEach(el => { if (el.tagName === 'IMG') el.style.viewTransitionName = ''; });
    const destino = e.activation && e.activation.entry && e.activation.entry.url;
    if (!destino) return;
    const ruta = new URL(destino).pathname;
    const a = $$('a.tarjeta-foto, a.hero-nuevo').find(x => x.pathname === ruta);
    const img = a && $('img', a);
    if (img && !$('.ficha-foto img')) img.style.viewTransitionName = 'foto';
  });
  // encabezado compacto al bajar
  const cab = $('.cabecera');
  if (cab) { const rev = () => cab.classList.toggle('bajando', scrollY > 40); addEventListener('scroll', rev, { passive: true }); rev(); }

  // lo que usa la página de pago
  window.KV = { productos: productos, productosAlDia: productosAlDia, ajustes: ajustes, carroItems: carroItems, carro: () => carro, vaciarCarro: () => { carro = {}; carroGuardar(); },
                fsCrear: fsCrear, fsActualizar: fsActualizar, aviso: aviso, precioDe: precioDe, visita: visita };
})();
