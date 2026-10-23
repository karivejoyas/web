/* Panel · Tienda online: temas (copias de la web), editor con vista en vivo,
   navegación (menús), preferencias y apps.

   El "tema" son todos los textos, imágenes, colores, menús y páginas de la
   web. El publicado vive en Firestore en catalog/web; las copias, en
   catalog/web/temas. La web se vuelve a armar sola unos minutos después de
   guardar (lo vigila herramientas/web.gs en Apps Script). */
(function () {
  'use strict';
  const h = A.h;

  // ============================================================
  //  tema: lectura, mezcla y guardado
  // ============================================================
  A.mezclar = function mezclar(base, encima) {
    const out = A.copia(base) || {};
    if (!encima || typeof encima !== 'object' || Array.isArray(encima)) return out;
    Object.keys(encima).forEach(k => {
      const v = encima[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = mezclar(out[k], v);
      else if (v !== undefined && v !== null) out[k] = A.copia(v);
    });
    return out;
  };
  A.temaDefecto = () => (A.temaPublicado && A.temaPublicado.defecto) || null;
  /* Lo que se ve (o se verá en minutos) en la web: lo armado + lo guardado después. */
  A.temaVigente = function () {
    if (!A.temaPublicado) return null;
    return actualizarTextos(migrar(A.mezclar(A.mezclar(A.temaPublicado.defecto, A.temaPublicado.tema), (A.web || {}).tema || {})));
  };
  /* Igual que migrar() en tema.py: los textos de fábrica antiguos (con garantía
     de 3 meses, acero, etc.) pasan a los nuevos; lo que editaste no se toca.
     Y «Sobre nosotros» toma el lugar de «Diseños a pedido». */
  function migrar(t) {
    t = A.copia(t);
    ((A.temaPublicado || {}).migraciones || []).forEach(([ruta, marca, nuevo]) => {
      const v = obtener(t, ruta);
      if (v != null && JSON.stringify(v).indexOf(marca) !== -1) poner(t, ruta, A.copia(nuevo));
    });
    const p = t.portada || {}, orden = (p.orden || []).slice();
    if (orden.length && orden.indexOf('sobre') === -1) {
      const i = orden.indexOf('especial');
      if (i !== -1) { orden[i] = 'sobre'; p.ocultas = (p.ocultas || []).concat((p.ocultas || []).indexOf('especial') === -1 ? ['especial'] : []); }
      else orden.push('sobre');
      p.orden = orden;
    }
    return t;
  }
  /* Igual que en construir.py: textos antiguos de fábrica → los nuevos, y en el
     menú «Tienda» pasa a llamarse «Ver todo». */
  function actualizarTextos(t) {
    const viejos = (A.temaPublicado && A.temaPublicado.textosAntiguos) || {};
    const pasar = (v) => Array.isArray(v) ? v.map(pasar) : (v && typeof v === 'object') ? Object.keys(v).reduce((o, k) => { o[k] = pasar(v[k]); return o; }, {}) : (typeof v === 'string' && viejos[v]) || v;
    t = pasar(t);
    if (Array.isArray(t.menu)) t.menu = t.menu.map(it => it && it.texto === 'Tienda' && it.url === '/tienda/' ? Object.assign({}, it, { texto: 'Ver todo' }) : it);
    return t;
  }
  A.nombreTemaVivo = () => ((A.web || {}).nombreTema) || 'Karivé';
  A.guardarTemaVivo = function (tema, nombre) {
    const datos = { tema: tema, actualizado: new Date().toISOString() };
    const campos = ['tema', 'actualizado'];
    if (nombre) { datos.nombreTema = nombre; campos.push('nombreTema'); }
    return A.ref.web.set(datos, { mergeFields: campos }).then(() => {
      A.web = Object.assign({}, A.web || {}, datos);
      if (A.seguirPublicacion) A.seguirPublicacion();
    });
  };
  A.avisoPermisoWeb = function () {
    return A.webError === 'permiso'
      ? '<div class="nota mal">🔐 <b>Falta activar un permiso en Firebase</b> para poder guardar los textos, imágenes y temas de la web. Toma 2 minutos: <a href="#/config/respaldos">mira cómo hacerlo aquí</a>. Mientras tanto puedes mirar y probar, pero no guardar.</div>'
      : '';
  };
  const obtener = (o, ruta) => ruta.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
  function poner(o, ruta, v) {
    const ks = ruta.split('.'); let x = o;
    ks.slice(0, -1).forEach(k => { if (x[k] == null || typeof x[k] !== 'object') x[k] = {}; x = x[k]; });
    x[ks[ks.length - 1]] = v;
  }
  A.temaObtener = obtener;

  // ---------- textos del tema → HTML (igual que tema.py) ----------
  const VARS = () => {   // igual que variables_envio() en construir.py
    const r = kvEnvioRango(A.settings.envioTarifas || {});
    const rango = (a, b) => a === b ? A.clp(a) : A.clp(a) + ' a ' + A.clp(b);
    return { envio_rm: A.clp(r.rm), envio_regiones: rango(r.regMin, r.regMax), envio_min: A.clp(r.min), envio_max: A.clp(r.max), envio_rango: rango(r.min, r.max) };
  };
  function reemplazos(s, extra) { Object.keys(extra).forEach(k => { s = s.split('{' + k + '}').join(extra[k]); }); return s; }
  A.textoTema = function (s) {
    return reemplazos(h(s == null ? '' : s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'), VARS());
  };

  /* Aplica un tema a una página de la web ya cargada (la vista previa del
     editor). Usa las marcas data-kv que pone construir.py. */
  /* Orden de las secciones de la portada; las que se agregaron después de
     guardar el tema van en su lugar de fábrica (igual que en construir.py). */
  const focoValido = (v) => /^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/.test(String(v || '').trim()) ? String(v).trim() : '';
  function ordenPortada(P) {
    const fab = ((A.temaDefecto() || {}).portada || {}).orden || Object.keys(SECCIONES);
    const orden = (P.orden || []).filter(k => fab.indexOf(k) !== -1 || SECCIONES[k]);
    fab.forEach((k, i) => { if (orden.indexOf(k) === -1) { const antes = fab.slice(0, i).filter(x => orden.indexOf(x) !== -1); orden.splice(antes.length ? orden.indexOf(antes[antes.length - 1]) + 1 : 0, 0, k); } });
    Object.keys(SECCIONES).forEach(k => { if (orden.indexOf(k) === -1) orden.push(k); });
    return orden;
  }
  /* Empresas de envío (Personalizar → Página de pago), igual que en construir.py.
     Antes era una sola (courierNombre / courierLogo). */
  A.listaCouriers = function (t, listo) {
    const pg = (t && t.pago) || {};
    const l = Array.isArray(pg.couriers) ? pg.couriers : [{ nombre: pg.courierNombre || '', logo: pg.courierLogo || '' }];
    return l.filter(c => c && (String(c.nombre || '').trim() || c.logo)).map(c => ({ nombre: String(c.nombre || '').trim(), logo: logoAjustado(A.urlImagen(c.logo), listo) }));
  };
  /* El logo sin el margen liso que suelen traer (como hace construir.py), para
     que se vea grande aunque sea cuadrado. Mientras se calcula, va el original. */
  const logosListos = {};
  function logoAjustado(url, listo) {
    if (!url || url.indexOf('data:') !== 0) return url;
    const k = url.length + ':' + url.slice(-80);
    if (logosListos[k]) return logosListos[k] === 'calculando' ? url : logosListos[k];
    logosListos[k] = 'calculando';
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
        const f = [d[0], d[1], d[2], d[3]], transp = f[3] < 30;
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const dist = transp ? (d[i + 3] > 30) : Math.max(Math.abs(d[i] - f[0]), Math.abs(d[i + 1] - f[1]), Math.abs(d[i + 2] - f[2])) > 30;
          if (dist) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        if (x1 < 0) { logosListos[k] = url; return; }
        const m = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03);
        x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(W - 1, x1 + m); y1 = Math.min(H - 1, y1 + m);
        const out = document.createElement('canvas'), alto = Math.min(120, y1 - y0 + 1), ancho = Math.round((x1 - x0 + 1) * alto / (y1 - y0 + 1));
        out.width = ancho; out.height = alto;
        out.getContext('2d').drawImage(cv, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, ancho, alto);
        logosListos[k] = out.toDataURL('image/png');
      } catch (e) { logosListos[k] = url; }
      if (listo) listo();
    };
    img.onerror = () => { logosListos[k] = url; };
    img.src = url;
    return url;
  }
  function couriersHtml(t, listo) {
    const l = A.listaCouriers(t, listo);
    return '<div class="envio-empresas" data-kv-couriers' + (l.length ? '' : ' hidden') + '><span>Enviamos con</span><div class="courier-lista">' +
      l.map(c => c.logo ? '<span class="courier-chip"><img src="' + h(c.logo) + '" alt="' + h(c.nombre || 'Empresa de envío') + '" title="' + h(c.nombre) + '"></span>' : '<span class="courier-chip solo-nombre">' + h(c.nombre) + '</span>').join('') + '</div></div>';
  }
  A.aplicarTema = function (doc, t) {
    if (!doc || !doc.documentElement) return;
    const cache = doc.__kv || (doc.__kv = {
      sub: (doc.querySelector('.desplegable-panel') || {}).innerHTML || '',
      subMovil: (doc.querySelector('#cajon-menu .sub:not(.sub-ayuda)') || {}).innerHTML || '',
      abajo: (doc.querySelector('#cajon-menu .pliegue summary svg') || {}).outerHTML || '',
      tabla: (doc.querySelector('.tabla-envios') || {}).outerHTML || '',
      tarjetas: (doc.querySelector('.contacto-grilla') || {}).outerHTML || '',
      sep: (doc.querySelector('.cinta-sep') || {}).outerHTML || ''
    });
    const tx = A.textoTema;
    // colores
    const c = t.colores || {};
    const MAP = { fondo: '--crema', fondo2: '--crema2', texto: '--tinta', suave: '--suave', borde: '--borde', principal: '--morado', oscuro: '--morado-osc', lila: '--lila', dorado: '--dorado', doradoClaro: '--dorado-cl' };
    let st = doc.getElementById('kv-colores');
    if (!st) { st = doc.createElement('style'); st.id = 'kv-colores'; doc.head.appendChild(st); }
    const lo = t.logo || {}, ol = t.olas || {};
    const px = (v, d, mi, ma) => Math.max(mi, Math.min(ma, Math.round(Number(v) || d)));
    const medidas = ['--logo-h:' + px(lo.alto, 44, 28, 110) + 'px', '--logo-hm:' + px(lo.altoMovil, 38, 24, 80) + 'px', '--logo-pie:' + px(lo.altoPie, 52, 30, 120) + 'px',
      '--ola:' + px(ol.alto, 110, 30, 220) + 'px', '--ola-m:' + px(ol.altoMovil, 64, 20, 160) + 'px'];
    if (/^#[0-9a-f]{3,8}$/i.test(ol.color || '')) medidas.push('--ola-color:' + ol.color);
    st.textContent = ':root{' + Object.keys(MAP).filter(k => /^#[0-9a-f]{3,8}$/i.test(c[k] || '')).map(k => MAP[k] + ':' + c[k]).concat(medidas).join(';') + '}';
    // efectos: si cambió el de la portada, se vuelve a correr para verlo
    const ef = t.efectos || {}, raiz = doc.documentElement;
    const efP = EFECTOS_PORTADA[ef.portada] ? ef.portada : 'destello';
    if (raiz.dataset.efPortada !== efP) {
      raiz.dataset.efPortada = 'ninguno'; void raiz.offsetWidth; raiz.dataset.efPortada = efP;
      doc.querySelectorAll('.hero-img, .hero-img img, .hero-sello, .hero-nuevo').forEach(el => { el.style.transform = ''; });
    }
    raiz.dataset.tr = TRANSICIONES[ef.transicion] ? ef.transicion : 'profundidad';
    // logo, olas, WhatsApp y asistente
    const logo = A.urlImagen(lo.imagen);
    doc.querySelectorAll('[data-kv-logo], .pie-logo img').forEach(el => { if (!el.dataset.original) el.dataset.original = el.getAttribute('src'); el.src = logo || el.dataset.original; });
    const olas = doc.querySelector('.olas');
    if (olas) { olas.classList.toggle('quietas', ol.animacion === false); olas.classList.toggle('al-reves', !!ol.rotar); }
    const pie = doc.querySelector('.pie'); if (pie) pie.classList.toggle('con-olas', ol.activo !== false);
    const wa = doc.querySelector('.wa-flota'); if (wa) wa.classList.toggle('respira', t.whatsappRespira !== false);
    doc.querySelectorAll('.chat-btn, .chat-globo').forEach(el => { el.style.display = (t.chat || {}).activo === false ? 'none' : ''; });
    // textos y botones
    doc.querySelectorAll('[data-kv]').forEach(el => {
      const v = obtener(t, el.dataset.kv);
      if (v == null) return;
      if (typeof v === 'object') { el.innerHTML = tx(v.texto || ''); if (el.tagName === 'A' && v.url) el.setAttribute('href', v.url); }
      else el.innerHTML = tx(v);
    });
    doc.querySelectorAll('[data-kv-colimg]').forEach(el => {
      if (!el.dataset.original) el.dataset.original = el.getAttribute('src');
      const u = A.urlImagen(((obtener(t, 'portada.colecciones.imagenes') || {})[el.dataset.kvColimg]) || '');
      el.src = u || el.dataset.original;
      el.style.objectPosition = focoValido((obtener(t, 'portada.colecciones.focos') || {})[el.dataset.kvColimg]);
    });
    const pagoEl = doc.getElementById('pago');
    if (pagoEl && doc.defaultView) {
      const pg = t.pago || {};
      pagoEl.dataset.tarjetas = pg.tarjetas === false ? '0' : '1';
      pagoEl.dataset.couriers = JSON.stringify(A.listaCouriers(t, () => A.aplicarTema(doc, t)).map(x => [x.nombre, x.logo]));
      doc.defaultView.dispatchEvent(new Event('kv-pago-repintar'));
    }
    doc.querySelectorAll('[data-kv-banner], [data-kv-banner-pag]').forEach(sec => {
      const b = (sec.dataset.kvBannerPag ? obtener(t, 'paginas.' + sec.dataset.kvBannerPag + '.portada') : ((obtener(t, 'coleccionPagina.banners') || {})[sec.dataset.kvBanner])) || {};
      const pc = A.urlImagen(b.pc) || A.urlImagen(b.movil), mo = A.urlImagen(b.movil) || pc;
      sec.hidden = !pc;
      if (sec.dataset.kvBannerPag && sec.nextElementSibling) sec.nextElementSibling.classList.toggle('con-foto', !!pc);
      if (pc) { const img = sec.querySelector('img'), src = sec.querySelector('source'); if (img) img.src = pc; if (src) src.srcset = mo; sec.classList.toggle('solo-pc', !A.urlImagen(b.movil)); }
      const f1 = focoValido(b.foco), f2 = focoValido(b.focoMovil);
      if (f1) sec.style.setProperty('--foco', f1); else sec.style.removeProperty('--foco');
      if (f2) sec.style.setProperty('--foco-m', f2); else sec.style.removeProperty('--foco-m');
    });
    doc.querySelectorAll('[data-kv-coltit]').forEach(el => { if (!el.dataset.original) el.dataset.original = el.textContent; el.textContent = obtener(t, 'coleccionPagina.titulos.' + el.dataset.kvColtit) || el.dataset.original; });
    doc.querySelectorAll('[data-kv-coldesc]').forEach(el => { const v = obtener(t, 'coleccionPagina.descripciones.' + el.dataset.kvColdesc); if (v) el.textContent = v; });
    doc.querySelectorAll('[data-kv-circulo]').forEach(el => { const v = String(obtener(t, 'portada.taller.circulo') || 'Hecho a mano · Mostacilla · Arcilla').toUpperCase().replace(/[\s·]+$/, '') + ' ·'; el.textContent = v; });
    doc.querySelectorAll('[data-kv-img]').forEach(el => { el.style.objectPosition = focoValido(obtener(t, el.dataset.kvImg + 'Foco')); });
    doc.querySelectorAll('[data-kv-img]').forEach(el => { const u = A.urlImagen(obtener(t, el.dataset.kvImg)); if (u) { el.src = u; el.removeAttribute('srcset'); } });
    doc.querySelectorAll('[data-kv-html]').forEach(el => {
      const v = obtener(t, el.dataset.kvHtml); if (v == null) return;
      let html = String(v);
      if (el.dataset.kvHtml === 'paginas.envios.html' && html.indexOf('{empresas_envio}') === -1) html = html.indexOf('{tabla_envios}') !== -1 ? html.replace('{tabla_envios}', '{tabla_envios}{empresas_envio}') : html + '{empresas_envio}';
      el.innerHTML = reemplazos(html, Object.assign(VARS(), { tabla_envios: cache.tabla, tarjetas_contacto: cache.tarjetas, empresas_envio: couriersHtml(t, () => A.aplicarTema(doc, t)) }));
    });
    // listas
    const menuItem = (it, movil) => it.tipo === 'colecciones'
      ? (movil ? '<details class="pliegue"><summary>' + h(it.texto) + cache.abajo + '</summary><div class="sub">' + cache.subMovil + '</div></details>' : '<div class="desplegable"><button type="button" aria-expanded="false" aria-haspopup="true">' + h(it.texto) + ' ▾</button><div class="desplegable-panel">' + cache.sub + '</div></div>')
      : '<a href="' + h(it.url || '/') + '">' + h(it.texto) + '</a>';
    const LISTAS = {
      'menu': () => (t.menu || []).map(it => menuItem(it, false)).join(''),
      'menu-movil': () => (t.menu || []).map(it => menuItem(it, true)).join(''),
      'menuPie': () => (t.menuPie || []).map(it => '<li><a href="' + h(it.url || '/') + '">' + h(it.texto) + '</a></li>').join(''),
      'portada.confianza.items': () => (obtener(t, 'portada.confianza.items') || []).map(it => '<div><span class="ic">' + (((A.temaPublicado || {}).iconos || {})[A.claveIcono(it.icono)] || h(it.icono || '')) + '</span><span><b>' + tx(it.titulo) + '</b>' + tx(it.texto) + '</span></div>').join(''),
      'portada.cinta.items': () => { const f = (obtener(t, 'portada.cinta.items') || []).filter(x => String(x).trim()).map(x => '<span>' + tx(x) + '</span>' + cache.sep).join(''); return f + '<span aria-hidden="true" class="cinta-copia">' + f + '</span>'; },
      'portada.taller.pasos': () => (obtener(t, 'portada.taller.pasos') || []).map((x, i) => '<li><span class="n">' + (i + 1) + '</span><span>' + tx(x) + '</span></li>').join(''),
      'producto.beneficios': () => (obtener(t, 'producto.beneficios') || []).map(x => '<li>' + tx(x) + '</li>').join(''),
      'paginas.preguntas.items': () => (obtener(t, 'paginas.preguntas.items') || []).filter(x => x.q).map(x => '<details><summary>' + tx(x.q) + '</summary><p>' + tx(x.a) + '</p></details>').join('')
    };
    doc.querySelectorAll('[data-kv-lista]').forEach(el => { const f = LISTAS[el.dataset.kvLista]; if (f) el.innerHTML = f(); });
    const an = doc.querySelector('.anuncio'); if (an) an.hidden = !(t.anuncio || {}).activo;
    doc.querySelectorAll('[data-kv-si]').forEach(el => { el.hidden = !obtener(t, el.dataset.kvSi); });
    // secciones de la portada: orden, visibilidad y cantidad de productos
    const cont = doc.querySelector('[data-kv-secciones]');
    if (cont && t.portada) {
      const ocultas = t.portada.ocultas || [];
      ordenPortada(t.portada).forEach(k => { const s = cont.querySelector(':scope > [data-kv-sec="' + k + '"]'); if (s) cont.appendChild(s); });
      cont.querySelectorAll(':scope > [data-kv-sec]').forEach(s => { s.hidden = ocultas.indexOf(s.dataset.kvSec) !== -1; });
      ['favoritos', 'nuevos'].forEach(k => {
        const n = Number(obtener(t, 'portada.' + k + '.cantidad')) || 8;
        cont.querySelectorAll('[data-kv-sec="' + k + '"] .grilla > li').forEach((li, i) => { li.hidden = i >= n; });
      });
    }
  };

  // ============================================================
  //  temas
  // ============================================================
  let temas = null;
  A.cargarTemas = async function () {
    const s = await A.ref.temas.get();
    temas = s.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => String(b.actualizado || b.creado).localeCompare(String(a.actualizado || a.creado)));
    return temas;
  };
  const paleta = (t) => '<span class="paleta-mini">' + ['fondo', 'principal', 'oscuro', 'dorado', 'lila'].map(k => '<i style="background:' + h(((t || {}).colores || {})[k] || '#fff') + '"></i>').join('') + '</span>';

  A.pagina('tienda', function (vista) {
    const t = A.temaVigente();
    if (!t) { vista.innerHTML = A.cargandoHtml; return; }
    const w = A.web || {};
    vista.innerHTML = '<div class="pag">' + A.cab('Temas', { acciones: '<a class="btn" href="/" target="_blank" rel="noopener">' + A.ic.ojo + ' Ver tienda</a>' }) + A.avisoPermisoWeb() +
      '<div class="tarjeta"><div class="tema-actual"><div class="tema-mini" id="tm-mini"><iframe src="/" title="Vista del tema" tabindex="-1" loading="lazy"></iframe></div>' +
        '<div class="tema-info"><span class="ins verde" style="align-self:flex-start">Tema actual</span><h3>' + h(A.nombreTemaVivo()) + '</h3>' +
          '<p class="ayuda" style="margin:0">' + (w.actualizado ? 'Guardado ' + h(A.hace(w.actualizado)) : 'Diseño original de la web nueva') + '</p>' + paleta(t) +
          '<p class="ayuda" style="margin:0">Los cambios que guardes aparecen en la web en unos 2 a 3 minutos.</p>' +
          '<div class="acciones"><a class="btn btn-primario" href="#/tienda/editor">Personalizar</a><button class="btn" id="tm-duplicar">' + A.ic.copiar + ' Duplicar</button>' +
            '<button class="btn" id="tm-mas" aria-label="Más acciones">' + A.ic.puntos + '</button></div></div></div></div>' +
      '<div class="tarjeta lista-temas"><div class="tarjeta-cab"><h2>Biblioteca de temas</h2><div class="acciones"><button class="btn btn-chico" id="tm-subir">' + A.ic.subir + ' Subir tema</button></div></div>' +
        '<p class="ayuda" style="padding:4px 16px 8px;margin:0">Copias de la web que puedes editar con calma sin que nadie las vea, y publicar cuando estén listas. También sirven de respaldo: si algo sale mal, publicas la copia anterior.</p>' +
        '<div id="tm-lista">' + A.cargandoHtml + '</div></div>' +
    '</div>';

    const pintarLista = () => {
      const caja = A.$('#tm-lista', vista); if (!caja) return;
      caja.innerHTML = !temas.length ? '<div class="vacio" style="padding:22px">Todavía no hay copias. Aprieta <b>Duplicar</b> para crear la primera.</div>' :
        temas.map(x => '<div class="tema-fila"><div class="t"><b>' + h(x.nombre || 'Copia') + '</b><small>' + (x.automatico ? 'Respaldo automático · ' : '') + 'guardado ' + h(A.hace(x.actualizado || x.creado)) + '</small></div>' + paleta(x.tema) +
          '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-chico" data-pub="' + x.id + '">Publicar</button><a class="btn btn-chico" href="#/tienda/editor/' + x.id + '">Personalizar</a>' +
          '<button class="btn btn-chico" data-ren="' + x.id + '">Cambiar nombre</button><button class="btn btn-chico" data-des="' + x.id + '" aria-label="Descargar">' + A.ic.descargar + '</button><button class="btn btn-chico btn-plano" data-del="' + x.id + '" aria-label="Eliminar">' + A.ic.basura + '</button></div></div>').join('');
      A.$$('[data-pub]', caja).forEach(b => b.addEventListener('click', () => publicarCopia(temas.find(x => x.id === b.dataset.pub))));
      A.$$('[data-ren]', caja).forEach(b => b.addEventListener('click', () => renombrar(temas.find(x => x.id === b.dataset.ren))));
      A.$$('[data-des]', caja).forEach(b => b.addEventListener('click', () => { const x = temas.find(y => y.id === b.dataset.des); descargarTema(x.nombre, x.tema); }));
      A.$$('[data-del]', caja).forEach(b => b.addEventListener('click', async () => {
        const x = temas.find(y => y.id === b.dataset.del);
        if (!(await A.confirmar('Se borra la copia «' + (x.nombre || '') + '». La web publicada no cambia.', { titulo: '¿Eliminar copia?', si: 'Eliminar', peligro: true }))) return;
        try { await A.ref.temas.doc(x.id).delete(); temas = temas.filter(y => y.id !== x.id); pintarLista(); } catch (e) { A.errorGuardar(e); }
      }));
    };
    A.cargarTemas().then(pintarLista).catch(e => { console.warn(e); A.$('#tm-lista', vista).innerHTML = '<div class="tarjeta-c ayuda">No se pudieron leer las copias' + (A.webError === 'permiso' ? ': falta activar el permiso.' : '.') + '</div>'; });

    const escalar = () => { const m = A.$('#tm-mini', vista); if (m) m.querySelector('iframe').style.transform = 'scale(' + (m.clientWidth / 1280) + ')'; };
    escalar(); window.addEventListener('resize', escalar);

    A.$('#tm-duplicar', vista).addEventListener('click', async () => {
      const nombre = await pedirNombre('Duplicar tema', 'Copia de ' + A.nombreTemaVivo());
      if (!nombre) return;
      try { await A.ref.temas.add({ nombre: nombre, tema: A.temaVigente(), creado: new Date().toISOString(), actualizado: new Date().toISOString() }); await A.cargarTemas(); pintarLista(); A.toast('Copia creada ✓'); } catch (e) { A.errorGuardar(e); }
    });
    A.$('#tm-mas', vista).addEventListener('click', async () => {
      const r = await A.modal({ titulo: 'Tema actual', html: '<p class="ayuda">¿Qué quieres hacer con el tema publicado?</p>',
        botones: [{ texto: 'Cambiar nombre', valor: 'ren' }, { texto: 'Descargar copia', valor: 'des' }, { texto: 'Volver al diseño original', clase: 'btn-peligro', valor: 'orig' }] });
      if (r === 'des') descargarTema(A.nombreTemaVivo(), A.temaVigente());
      if (r === 'ren') { const n = await pedirNombre('Cambiar nombre', A.nombreTemaVivo()); if (n) { try { await A.ref.web.set({ nombreTema: n }, { merge: true }); A.repintar(); } catch (e) { A.errorGuardar(e); } } }
      if (r === 'orig') {
        if (!(await A.confirmar('La web vuelve a los textos, colores e imágenes originales de la web nueva. Antes se guarda una copia del tema actual en la biblioteca, por si quieres volver.', { titulo: '¿Volver al diseño original?', si: 'Volver al original', peligro: true }))) return;
        try {
          await A.ref.temas.add({ nombre: 'Respaldo de ' + A.nombreTemaVivo() + ' (' + new Date().toLocaleDateString('es-CL') + ')', tema: A.temaVigente(), automatico: true, creado: new Date().toISOString(), actualizado: new Date().toISOString() });
          await A.guardarTemaVivo(A.copia(A.temaDefecto()), 'Karivé');
          A.toast('Listo. La web vuelve al diseño original en unos minutos.'); A.repintar();
        } catch (e) { A.errorGuardar(e); }
      }
    });
    A.$('#tm-subir', vista).addEventListener('click', async () => {
      const f = await A.elegirArchivo('.json,application/json'); if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        const tema = d.tema || d;
        if (!tema || typeof tema !== 'object' || !(tema.portada || tema.colores || tema.paginas)) throw new Error('El archivo no parece un tema de Karivé.');
        await A.ref.temas.add({ nombre: (d.nombre || f.name.replace(/\.json$/i, '')) + ' (subido)', tema: A.mezclar(A.temaDefecto(), tema), creado: new Date().toISOString(), actualizado: new Date().toISOString() });
        await A.cargarTemas(); pintarLista(); A.toast('Tema subido a la biblioteca ✓');
      } catch (e) { A.avisar('No se pudo subir: ' + e.message); }
    });

    async function publicarCopia(x) {
      if (!(await A.confirmar('«' + x.nombre + '» pasa a ser lo que ve todo el mundo (en unos minutos). El tema actual se guarda en la biblioteca, así puedes volver cuando quieras.', { titulo: '¿Publicar este tema?', si: 'Publicar' }))) return;
      try {
        await A.ref.temas.add({ nombre: A.nombreTemaVivo() + ' (antes de publicar «' + x.nombre + '»)', tema: A.temaVigente(), automatico: true, creado: new Date().toISOString(), actualizado: new Date().toISOString() });
        await A.guardarTemaVivo(A.mezclar(A.temaDefecto(), x.tema), x.nombre);
        await A.ref.temas.doc(x.id).delete();
        A.toast('Tema publicado ✓ La web se actualiza en unos minutos.');
        await A.cargarTemas(); A.repintar();
      } catch (e) { A.errorGuardar(e); }
    }
    async function renombrar(x) {
      const n = await pedirNombre('Cambiar nombre', x.nombre);
      if (!n) return;
      try { await A.ref.temas.doc(x.id).update({ nombre: n }); x.nombre = n; pintarLista(); } catch (e) { A.errorGuardar(e); }
    }
  }, ['web']);

  function pedirNombre(titulo, valor) {
    return A.modal({ titulo: titulo, html: '<label class="campo"><span>Nombre</span><input id="pn-nombre" value="' + h(valor || '') + '" maxlength="60"></label>',
      botones: [{ texto: 'Cancelar' }, { texto: 'Guardar', clase: 'btn-primario', accion: (c) => A.$('#pn-nombre', c).value.trim() || false }] });
  }
  function descargarTema(nombre, tema) {
    A.descargar('tema-' + A.sinTildes(nombre || 'karive').replace(/[^a-z0-9]+/g, '-') + '-' + A.diaClave(Date.now()) + '.json', JSON.stringify({ nombre: nombre, fecha: new Date().toISOString(), tema: tema }, null, 2));
  }

  // ============================================================
  //  editor con vista en vivo
  // ============================================================
  const SECCIONES = {
    hero: { nombre: 'Portada principal', ruta: 'portada.hero', campos: [['titulo', 'texto', 'Título'], ['texto', 'area', 'Texto'], ['boton1', 'boton', 'Botón principal'], ['boton2', 'boton', 'Botón secundario'], ['imagen', 'imagen', 'Imagen', { aspecto: '4/3' }], ['imagenAlt', 'texto', 'Descripción de la imagen (para Google)'], ['sello', 'texto', 'Sello sobre la imagen'], ['tarjetaNuevo', 'si', 'Mostrar el último producto subido sobre la foto']] },
    cinta: { nombre: 'Cinta en movimiento', ruta: 'portada.cinta', campos: [['items', 'textos', 'Frases que pasan']], ayuda: 'Frases cortas. Se desplazan solas y se detienen al pasar el mouse.' },
    confianza: { nombre: 'Beneficios', ruta: 'portada.confianza', campos: [['items', 'objetos', 'Beneficios', { icono: 'Ícono', titulo: 'Título', texto: 'Texto' }]] },
    colecciones: { nombre: 'Colecciones', ruta: 'portada.colecciones', campos: [['titulo', 'texto', 'Título'], ['enlace', 'texto', 'Texto del enlace'], ['botonTarjeta', 'texto', 'Texto al pasar sobre una colección (ej: Ver colección)']], ayuda: 'Las fotos de cada colección se cambian más abajo, en el grupo «Colecciones» (una por una).' },
    favoritos: { nombre: 'Los más queridos', ruta: 'portada.favoritos', campos: [['titulo', 'texto', 'Título'], ['enlace', 'texto', 'Texto del enlace'], ['cantidad', 'numero', 'Cuántos productos']], ayuda: 'Muestra la lista de «Lo más visto» (Descuentos) y la completa con un producto de cada colección.' },
    taller: { nombre: 'Nuestro taller', ruta: 'portada.taller', campos: [['titulo', 'texto', 'Título'], ['texto', 'area', 'Texto'], ['imagen', 'imagen', 'Imagen', { aspecto: '4/3' }], ['imagenAlt', 'texto', 'Descripción de la imagen'], ['pasos', 'textos', 'Pasos'], ['boton', 'boton', 'Botón'], ['circulo', 'texto', 'Texto del círculo que gira sobre la foto']] },
    nuevos: { nombre: 'Lo nuevo', ruta: 'portada.nuevos', campos: [['titulo', 'texto', 'Título'], ['enlace', 'texto', 'Texto del enlace'], ['cantidad', 'numero', 'Cuántos productos']], ayuda: 'Muestra los productos subidos más recientemente.' },
    instagram: { nombre: 'Instagram', ruta: 'portada.instagram', campos: [['titulo', 'texto', 'Título'], ['enlace', 'texto', 'Texto del enlace'], ['cantidad', 'numero', 'Cuántas publicaciones (máximo 12)']], ayuda: 'Muestra tus últimos videos (reels) de Instagram con el mismo estilo de las colecciones. Se actualizan solos cuando subes uno nuevo (Apps → Instagram).' },
    sobre: { nombre: 'Sobre nosotros', ruta: 'portada.sobre', campos: [['antetitulo', 'texto', 'Texto chico de arriba'], ['titulo', 'texto', 'Título'], ['texto', 'area', 'Texto'], ['boton', 'boton', 'Botón'],
      ['imagenes.0', 'imagen', 'Foto grande del centro (vertical)'], ['imagenes.1', 'imagen', 'Foto chica 1 (arriba a la izquierda)'], ['imagenes.2', 'imagen', 'Foto chica 2 (arriba a la derecha)'], ['imagenes.3', 'imagen', 'Foto chica 3 (abajo a la derecha)'], ['imagenes.4', 'imagen', 'Foto chica 4 (abajo a la izquierda)']],
      ayuda: 'Al aparecer en pantalla, las 4 fotos chicas se abren en abanico alrededor de la grande. Las chicas se recortan cuadradas: mejor fotos con el aro al centro.' },
    especial: { nombre: 'Diseños a pedido', ruta: 'portada.especial', campos: [['titulo', 'texto', 'Título'], ['texto', 'area', 'Texto'], ['boton', 'texto', 'Texto del botón'], ['mensaje', 'area', 'Mensaje que se escribe solo en WhatsApp']] }
  };
  const EFECTOS_PORTADA = { destello: 'Destello: la foto se descubre y la cruza una luz', lento: 'Movimiento lento: la foto se acerca despacio, siempre', cortina: 'Cortina morada que la descubre', arco: 'Arco que se abre', profundidad: 'Profundidad: se mueve con el mouse', ninguno: 'Sin efecto' };
  const TRANSICIONES = { profundidad: 'Profundidad: la página se aleja y la nueva llega desde adelante', vuela: 'La foto vuela del producto a su ficha', cortina: 'Cortina: la página nueva sube desde abajo', deslizar: 'Deslizar de lado', ninguna: 'Sin transición' };
  const GLOBALES = {
    anuncio: { nombre: 'Barra de anuncio', ruta: 'anuncio', campos: [['activo', 'si', 'Mostrar la barra de anuncio'], ['texto', 'texto', 'Texto']], ayuda: 'Escribe **así** para poner una parte en negrita.' },
    menu: { nombre: 'Menú', enlace: 'tienda/navegacion' },
    pie: { nombre: 'Pie de página', ruta: 'pie', campos: [['texto', 'area', 'Texto sobre la tienda'], ['boletinTitulo', 'texto', 'Título del boletín'], ['boletinTexto', 'texto', 'Texto del boletín'], ['final', 'texto', 'Frase final'], ['tiktok', 'texto', 'Enlace de TikTok (opcional; Instagram, Facebook, WhatsApp y correo se cambian en Configuración → General)']] },
    colores: { nombre: 'Colores', ruta: 'colores', campos: [['fondo', 'color', 'Fondo'], ['fondo2', 'color', 'Fondo secundario'], ['texto', 'color', 'Texto'], ['suave', 'color', 'Texto suave'], ['borde', 'color', 'Bordes'], ['principal', 'color', 'Color principal'], ['oscuro', 'color', 'Color oscuro (botones, títulos)'], ['lila', 'color', 'Lila'], ['dorado', 'color', 'Dorado'], ['doradoClaro', 'color', 'Dorado claro']] },
    whatsapp: { nombre: 'Botón de WhatsApp', ruta: '', campos: [['whatsappFlotante', 'si', 'Mostrar el botón flotante de WhatsApp'], ['whatsappRespira', 'si', 'Que respire (se agranda suavecito, para que se note)']], ayuda: 'El número se cambia en Configuración → General.' },
    logo: { nombre: 'Logo', ruta: 'logo', campos: [['imagen', 'imagen', 'Imagen del logo'], ['alto', 'rango', 'Tamaño en el computador', { min: 28, max: 110 }], ['altoMovil', 'rango', 'Tamaño en el celular', { min: 24, max: 80 }], ['altoPie', 'rango', 'Tamaño en el pie de página', { min: 30, max: 120 }]], ayuda: 'Para cambiar la imagen usa un PNG con fondo transparente. Al bajar por la página, en el computador el logo se achica un poco.' },
    efectos: { nombre: 'Efectos y movimiento', ruta: 'efectos', campos: [['portada', 'opciones', 'Efecto de la foto de portada', EFECTOS_PORTADA], ['transicion', 'opciones', 'Al abrir una colección o un producto', TRANSICIONES]], ayuda: 'La transición entre páginas se ve en Chrome, Edge y Safari (iPhone) actualizados; en los demás la página simplemente cambia. Quien tenga activado «reducir movimiento» no ve efectos.' },
    olas: { nombre: 'Olas antes del pie', ruta: 'olas', campos: [['activo', 'si', 'Mostrar las olas'], ['animacion', 'si', 'Que se muevan'], ['rotar', 'si', 'Darlas vuelta (de derecha a izquierda)'], ['alto', 'rango', 'Alto en el computador', { min: 30, max: 220 }], ['altoMovil', 'rango', 'Alto en el celular', { min: 20, max: 160 }], ['color', 'colorOpc', 'Color de las olas']], ayuda: 'Si no eliges color, usan el del pie de página (Colores → Color oscuro).' },
    chat: { nombre: 'Asistente (chat)', ruta: 'chat', campos: [['activo', 'si', 'Mostrar el asistente'], ['nombre', 'texto', 'Nombre'], ['saludo', 'area', 'Saludo'], ['mensajes', 'textos', 'Mensajes que aparecen junto al botón (de a uno, máximo 6 por visita)']], ayuda: 'Responde con la IA del publicador (Apps → Asistente IA) y, si no está disponible, con respuestas automáticas que usan tus productos, precios y envíos reales.' },
    producto: { nombre: 'Ficha de producto', ruta: 'producto', campos: [['beneficios', 'textos', 'Beneficios bajo el botón de compra'], ['verDetalle', 'texto', 'Texto al pasar sobre un producto (ej: Ver detalle)']],
      ayuda: 'El nombre, el precio, las fotos y la descripción de cada producto se cambian en Productos (toca un producto en la vista previa y aparece el botón para editarlo).' },
    pago: { nombre: 'Pago y envíos', ruta: 'pago', campos: [['tarjetas', 'si', 'Mostrar las tarjetas que acepta Mercado Pago (Visa, Mastercard, American Express)'], ['couriers', 'couriers', 'Empresas de envío']], ayuda: 'El pago es con Mercado Pago (su logo siempre se muestra). Las empresas de envío aparecen en la página de pago y en la página Envíos, bajo la tabla de precios. Sirve cualquier logo: si viene con margen blanco, se recorta solo.' }
  };
  // páginas con foto de portada (Personalizar → Páginas)
  const PAGINAS_FOTO = { nosotros: ['Nosotros', '/nosotros.html'], preguntas: ['Preguntas frecuentes', '/preguntas-frecuentes.html'], contacto: ['Contacto', '/contacto.html'],
    envios: ['Envíos', '/envios.html'], devoluciones: ['Cambios y devoluciones', '/devoluciones.html'], privacidad: ['Privacidad', '/privacidad.html'] };
  const PAGINAS_PREV = [['/', 'Inicio'], ['/tienda/', 'Tienda'], ['col', 'Una colección'], ['prod', 'Un producto'], ['/nosotros.html', 'Nosotros'], ['/contacto.html', 'Contacto'], ['/envios.html', 'Envíos'], ['/preguntas-frecuentes.html', 'Preguntas frecuentes'], ['/devoluciones.html', 'Cambios y devoluciones'], ['/finalizar-compra.html?vista=1', 'Página de pago']];

  let ed = null;   // estado del editor
  A.pagina('tienda/editor', (v) => abrirEditor(v, null), []);
  A.pagina('tienda/editor/:id', (v, p) => abrirEditor(v, p.id), []);

  async function abrirEditor(vista, idCopia) {
    document.body.classList.add('en-editor');
    if (!A.temaPublicado) { vista.innerHTML = A.cargandoHtml; await A.cargarTemaPublicado(); if (!A.temaPublicado) { vista.innerHTML = '<div class="pag"><div class="nota mal">No se pudo cargar el tema.</div></div>'; return; } }
    try { await A.cargarMedios(); } catch (e) { A.medios = A.medios || {}; }
    let nombre = A.nombreTemaVivo(), base;
    if (idCopia) {
      const d = await A.ref.temas.doc(idCopia).get().catch(() => null);
      if (!d || !d.exists) { document.body.classList.remove('en-editor'); vista.innerHTML = '<div class="pag">' + A.cab('Tema', { volver: 'tienda' }) + '<div class="tarjeta">' + A.vacio('🔍', 'No encontramos esta copia', '') + '</div></div>'; return; }
      nombre = d.data().nombre || 'Copia';
      base = A.mezclar(A.temaDefecto(), d.data().tema);
    } else base = A.temaVigente();
    ed = { id: idCopia, nombre: nombre, tema: A.copia(base), inicial: JSON.stringify(base), sec: null, pagina: '/', dispositivo: 'escritorio' };

    const prodCod = (A.productos.find(p => p.stock === true) || A.productos[0] || {}).code;
    vista.innerHTML = '<div class="editor">' +
      '<div class="editor-sup"><a class="btn btn-plano" href="#/tienda" id="ed-salir">' + A.ic.volver + ' Salir</a>' +
        '<div class="t">' + h(nombre) + '<small>' + (idCopia ? 'copia sin publicar' : 'publicado') + '</small></div>' +
        '<div class="centro"><select id="ed-pagina" aria-label="Página que estás viendo">' + PAGINAS_PREV.filter(p => p[0] !== 'prod' || prodCod).map(p => '<option value="' + p[0] + '">' + p[1] + '</option>').join('') + '</select>' +
          '<div class="grupo-btn"><button class="btn btn-chico activo" data-disp="escritorio" title="Computador">' + A.ic.escritorio + '</button><button class="btn btn-chico" data-disp="movil" title="Celular">' + A.ic.movil + '</button></div></div>' +
        (idCopia ? '<button class="btn" id="ed-publicar">Publicar</button>' : '') +
        '<button class="btn btn-primario" id="ed-guardar" disabled>Guardar</button></div>' +
      '<div class="editor-cuerpo"><aside class="editor-panel" id="ed-panel"></aside><div class="editor-prev" id="ed-prev"><iframe id="ed-marco" title="Vista previa" src="/"></iframe></div></div></div>' +
      (A.webError === 'permiso' ? '<div style="position:fixed;bottom:12px;left:12px;right:12px;z-index:30;max-width:640px;margin:auto">' + A.avisoPermisoWeb() + '</div>' : '');

    const marco = A.$('#ed-marco', vista);
    marco.addEventListener('load', () => {
      const doc = marco.contentDocument; if (!doc) return;
      A.aplicarTema(doc, ed.tema);
      // Como en Shopify: tocar algo en la vista abre su sección y marca el campo
      // exacto (un texto, una foto, una pregunta…). Tocar una colección entra a
      // ella; tocar un producto abre su ficha. Los enlaces no navegan.
      doc.addEventListener('click', (e) => {
        const a = e.target.closest('a,button'); if (a) e.preventDefault();
        const t = e.target;
        // 1) un campo concreto
        const campo = t.closest('[data-kv],[data-kv-img],[data-kv-html],[data-kv-lista],[data-kv-coldesc],[data-kv-coltit],[data-kv-circulo],[data-kv-colimg]');
        const ruta = campo && (campo.dataset.kv || campo.dataset.kvImg || campo.dataset.kvHtml || campo.dataset.kvLista ||
          (campo.dataset.kvColdesc && 'coleccionPagina.descripciones.' + campo.dataset.kvColdesc) || (campo.dataset.kvColtit && 'coleccionPagina.titulos.' + campo.dataset.kvColtit) ||
          (campo.dataset.kvCirculo != null && 'portada.taller.circulo'));
        // una tarjeta de colección (portada): entra a esa colección
        const tarjCol = t.closest('.coleccion:not(.ig-tarjeta)');
        if (tarjCol && !(campo && campo.dataset.kv)) {
          const img = tarjCol.querySelector('[data-kv-colimg]');
          if (img) { abrirSeccion('col:' + img.dataset.kvColimg, true); return; }
        }
        // un producto: se abre su ficha (sus datos se editan en Productos)
        const tarjProd = t.closest('[data-tarjeta]');
        if (tarjProd && !(campo && campo.dataset.kv)) {
          const l = tarjProd.querySelector('a[href^="/p/"]');
          if (l) { verPagina(l.getAttribute('href')); ed.prodId = tarjProd.dataset.tarjeta; abrirSeccion('producto', true); return; }
        }
        let rutaCampo = ruta;
        if (campo && campo.dataset.kvLista && ruta) {   // un ítem de una lista: el que tocaste
          const hijo = Array.from(campo.children).find(x => x.contains(t));
          const i = hijo ? Array.from(campo.children).filter(x => !x.classList.contains('cinta-copia') && !x.classList.contains('cinta-sep')).indexOf(hijo) : -1;
          if (i >= 0) rutaCampo = ruta + '.' + i;
        }
        const k = ruta && seccionDeRuta(ruta);
        if (k === 'menu') { A.toast('El menú se cambia en Navegación: toca «Menú» en la lista de la izquierda.'); return; }
        if (k) { abrirSeccion(k, true); marcarCampo(rutaCampo); return; }
        // 2) bloques sin campo propio
        const ban = t.closest('[data-kv-banner]'), banPag = t.closest('[data-kv-banner-pag]');
        if (ban) return abrirSeccion('col:' + ban.dataset.kvBanner, true);
        if (banPag) return abrirSeccion('pag:' + banPag.dataset.kvBannerPag, true);
        const sec = t.closest('[data-kv-sec]');
        if (sec) return abrirSeccion(sec.dataset.kvSec, true);
        const pares = [['.anuncio', 'anuncio'], ['.logo', 'logo'], ['.olas', 'olas'], ['.chat-btn,.chat-globo,.chat-caja', 'chat'], ['.wa-flota', 'whatsapp'],
          ['.pie', 'pie'], ['#pago,.pago', 'pago'], ['[data-ficha],.ficha', 'producto'], ['.migas,.filtros,#grilla-tienda', 'col:todo']];
        for (const [sel, sk] of pares) if (t.closest(sel)) { if (sk === 'producto') { const f = t.closest('[data-ficha]'); if (f) ed.prodId = f.dataset.ficha; } return abrirSeccion(sk, true); }
        const pag = PAGINA_DE_RUTA[ed.pagina]; if (pag) return abrirSeccion('pag:' + pag, true);
        if (/^\/p\//.test(ed.pagina)) { const f = doc.querySelector('[data-ficha]'); if (f) ed.prodId = f.dataset.ficha; return abrirSeccion('producto', true); }
        if (/^\/tienda\//.test(ed.pagina)) return abrirSeccion('col:todo', true);
        const ct = doc.querySelector('[data-kv-coltit]'); if (ct) return abrirSeccion('col:' + ct.dataset.kvColtit, true);
      }, true);
      const css = doc.createElement('style');
      css.textContent = '[data-kv-sec]:hover{outline:2px dashed rgba(91,42,130,.45);outline-offset:-2px;cursor:pointer}[data-kv-sec].kv-sel{outline:2px solid #5B2A82;outline-offset:-2px}' +
        '[data-kv]:hover,[data-kv-img]:hover,[data-kv-html]:hover,[data-kv-lista]:hover,[data-kv-coldesc]:hover,[data-kv-coltit]:hover,[data-kv-banner]:hover,[data-kv-banner-pag]:hover,.coleccion:hover,[data-tarjeta]:hover{outline:1.5px solid rgba(91,42,130,.7);outline-offset:2px;border-radius:4px;cursor:pointer}';
      doc.head.appendChild(css);
      marcarSeleccion();
    });
    A.$('#ed-pagina', vista).addEventListener('change', (e) => {
      let u = e.target.value;
      if (u === 'prod') u = '/p/' + encodeURIComponent(prodCod) + '.html';
      if (u === 'col') { const l = marco.contentDocument && marco.contentDocument.querySelector('a[href^="/c/"]'); u = l ? l.getAttribute('href') : '/tienda/'; }
      ed.pagina = u; marco.src = u;
    });
    A.$$('[data-disp]', vista).forEach(b => b.addEventListener('click', () => {
      A.$$('[data-disp]', vista).forEach(x => x.classList.toggle('activo', x === b));
      A.$('#ed-prev', vista).classList.toggle('movil', b.dataset.disp === 'movil');
    }));
    A.$('#ed-guardar', vista).addEventListener('click', guardarEditor);
    if (A.$('#ed-publicar', vista)) A.$('#ed-publicar', vista).addEventListener('click', async () => {
      if (hayCambiosEd()) { const ok = await guardarEditor(); if (!ok) return; }
      if (!(await A.confirmar('«' + ed.nombre + '» pasa a ser lo que ve todo el mundo (en unos minutos). El tema actual se guarda en la biblioteca.', { titulo: '¿Publicar este tema?', si: 'Publicar' }))) return;
      try {
        await A.ref.temas.add({ nombre: A.nombreTemaVivo() + ' (antes de publicar «' + ed.nombre + '»)', tema: A.temaVigente(), automatico: true, creado: new Date().toISOString(), actualizado: new Date().toISOString() });
        await A.guardarTemaVivo(ed.tema, ed.nombre);
        await A.ref.temas.doc(ed.id).delete();
        ed.inicial = JSON.stringify(ed.tema); A.limpiarCambios();
        A.toast('Tema publicado ✓'); A.ir('tienda');
      } catch (e) { A.errorGuardar(e); }
    });
    pintarPanel();
  }

  const hayCambiosEd = () => ed && JSON.stringify(ed.tema) !== ed.inicial;
  function cambio() {
    const doc = A.$('#ed-marco') && A.$('#ed-marco').contentDocument;
    clearTimeout(cambio._t);
    cambio._t = setTimeout(() => A.aplicarTema(doc, ed.tema), 60);
    const hay = hayCambiosEd();
    A.$('#ed-guardar').disabled = !hay;
    if (hay) A.marcarCambios(guardarEditor, () => { A.limpiarCambios(); A.repintar(); }); else A.limpiarCambios();
  }
  async function guardarEditor() {
    const b = A.$('#ed-guardar'); if (b) { b.disabled = true; b.textContent = 'Guardando…'; }
    try {
      if (ed.id) await A.ref.temas.doc(ed.id).update({ tema: ed.tema, actualizado: new Date().toISOString() });
      else await A.guardarTemaVivo(ed.tema);
      ed.inicial = JSON.stringify(ed.tema);
      A.limpiarCambios();
      A.toast(ed.id ? 'Copia guardada ✓' : 'Guardado ✓ La web se actualiza en unos 2 a 3 minutos.');
      if (b) b.textContent = 'Guardar';
      return true;
    } catch (e) { A.errorGuardar(e); if (b) { b.disabled = false; b.textContent = 'Guardar'; } return false; }
  }

  function marcarSeleccion() {
    const doc = A.$('#ed-marco') && A.$('#ed-marco').contentDocument; if (!doc) return;
    doc.querySelectorAll('.kv-sel').forEach(x => x.classList.remove('kv-sel'));
    if (ed.sec && SECCIONES[ed.sec]) {
      const s = doc.querySelector('[data-kv-sec="' + ed.sec + '"]');
      if (s) { s.classList.add('kv-sel'); s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
  }
  /* De la ruta de un texto o foto del tema a la sección del editor que lo tiene. */
  const PAGINA_DE_RUTA = { '/nosotros.html': 'nosotros', '/contacto.html': 'contacto', '/envios.html': 'envios', '/preguntas-frecuentes.html': 'preguntas', '/devoluciones.html': 'devoluciones', '/privacidad.html': 'privacidad' };
  function seccionDeRuta(r) {
    const p = r.split('.');
    if (p[0] === 'portada' && SECCIONES[p[1]]) return p[1];
    if (p[0] === 'paginas' && PAGINAS_FOTO[p[1]]) return 'pag:' + p[1];
    if (p[0] === 'coleccionPagina' && p[2]) return 'col:' + p[2];
    if (p[0] === 'tiendaPagina') return 'col:todo';
    if (p[0] === 'menu' || p[0] === 'menuPie') return p[0] === 'menu' ? 'menu' : 'pie';
    if (GLOBALES[p[0]]) return p[0];
    return null;
  }
  /* Deja a la vista y resalta el campo que corresponde a esa ruta. */
  function marcarCampo(ruta) {
    setTimeout(() => {
      const panel = A.$('#ed-panel'); if (!panel) return;
      const esc = CSS.escape(ruta);
      let el = panel.querySelector('[data-r="' + esc + '"],[data-img="' + esc + '"],[data-rico-campo="' + esc + '"],[data-r^="' + esc + '."]');
      if (!el) return;
      const caja = el.closest('.campo,.ed-foto,.ed-lista-item,[data-rico-campo]') || el;
      caja.scrollIntoView({ block: 'center', behavior: 'smooth' });
      caja.classList.remove('ed-marcado'); void caja.offsetWidth; caja.classList.add('ed-marcado');
      const foco = caja.querySelector('input:not([type=color]):not([type=range]):not([type=checkbox]),textarea,.rico-area');
      if (foco && !/^(1|true)$/.test(foco.dataset.noFoco || '')) foco.focus({ preventScroll: true });
    }, 60);
  }
  /* Abre una sección en su desplegable (y cierra la anterior). Tocar la que
     está abierta la cierra; desde la vista previa siempre se abre. */
  function abrirSeccion(k, forzar) {
    if (GLOBALES[k] && GLOBALES[k].enlace) { if (A.hayCambios()) { A.toast('Guarda primero tus cambios'); return; } A.ir(GLOBALES[k].enlace); return; }
    ed.sec = (ed.sec === k && !forzar) ? null : k;
    pintarPanel(); marcarSeleccion();
    const fila = ed.sec && A.$('#ed-panel [data-sec="' + CSS.escape(ed.sec) + '"]');
    if (fila) fila.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (ed.sec === 'col:todo') { if (ed.pagina !== '/tienda/') verPagina('/tienda/'); }
    else if (ed.sec && ed.sec.indexOf('col:') === 0) { const c = A.colecciones().find(x => x.id === ed.sec.slice(4)); if (c) verColeccion(c.nombre); }
    else if (ed.sec && ed.sec.indexOf('pag:') === 0) { const pg = PAGINAS_FOTO[ed.sec.slice(4)]; if (pg && ed.pagina !== pg[1]) verPagina(pg[1]); }
    else if (ed.sec === 'pago' && ed.pagina.indexOf('/finalizar-compra') !== 0) verPagina('/finalizar-compra.html?vista=1');
    else if (ed.sec === 'producto' && ed.pagina.indexOf('/p/') !== 0) { const sel = A.$('#ed-pagina'); if (sel) { sel.value = 'prod'; sel.dispatchEvent(new Event('change')); } }
    else if (ed.sec && SECCIONES[ed.sec] && ed.pagina !== '/') verPagina('/');
  }
  function verPagina(u) {
    const marco = A.$('#ed-marco'); if (!marco) return;
    ed.pagina = u; marco.src = u;
    const sel = A.$('#ed-pagina'); if (sel) sel.value = u;
  }
  /* En la vista previa abre la página de una colección (por su nombre, o la primera). */
  function verColeccion(nombre) {
    const marco = A.$('#ed-marco'), d = marco && marco.contentDocument; if (!d) return;
    const ls = Array.from(d.querySelectorAll('a[href^="/c/"]'));
    const l = ls.find(a => a.textContent.trim() === nombre) || ls[0]; if (!l) return;
    const u = l.getAttribute('href'); if (ed.pagina === u) return;
    ed.pagina = u; marco.src = u;
    const sel = A.$('#ed-pagina'); if (sel) sel.value = 'col';
  }

  function pintarPanel() {
    const panel = A.$('#ed-panel'); if (!panel) return;
    const P = ed.tema.portada;
    const ocultas = P.ocultas || [];
    // secciones nuevas aparecen en su lugar de fábrica (igual que en construir.py)
    const orden = ordenPortada(P).filter(k => SECCIONES[k]);
    const fila = (k, nombre, extra, clase) => '<div class="ed-sec' + (ed.sec === k ? ' abierta' : '') + (clase || '') + '" data-sec="' + h(k) + '">' +
      '<span class="chev"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8 5 5 5-5 5"/></svg></span><span class="nombre">' + h(nombre) + '</span>' + (extra || '') + '</div>' +
      (ed.sec === k ? '<div class="ed-cuerpo"></div>' : '');
    const global = (k) => GLOBALES[k].enlace
      ? '<div class="ed-sec" data-sec="' + k + '"><span class="chev"></span><span class="nombre">' + h(GLOBALES[k].nombre) + '</span>' + A.ic.externo + '</div>'
      : fila(k, GLOBALES[k].nombre);
    panel.innerHTML = '<div class="ed-secciones">' +
      '<div class="ed-grupo">Encabezado</div>' + ['anuncio', 'logo', 'menu'].map(global).join('') +
      '<div class="ed-grupo">Portada</div>' +
      orden.map((k, i) => fila(k, SECCIONES[k].nombre,
        '<button class="mini" data-sub="' + i + '" title="Subir"' + (i ? '' : ' disabled') + '>' + A.ic.arriba + '</button><button class="mini" data-baja="' + i + '" title="Bajar"' + (i < orden.length - 1 ? '' : ' disabled') + '>' + A.ic.abajo + '</button>' +
        '<button class="mini" data-ojo="' + k + '" title="' + (ocultas.indexOf(k) !== -1 ? 'Mostrar' : 'Ocultar') + '">' + (ocultas.indexOf(k) !== -1 ? A.ic.ojoNo : A.ic.ojo) + '</button>',
        ocultas.indexOf(k) !== -1 ? ' oculta' : '')).join('') +
      '<div class="ed-grupo">Colecciones</div>' +
      fila('col:todo', 'Ver todo (todos los productos)') + A.colecciones().map(c => fila('col:' + c.id, c.nombre)).join('') +
      '<a class="ed-sec" href="#/colecciones" style="text-decoration:none;color:inherit"><span class="chev"></span><span class="nombre">Nombres, orden y productos</span>' + A.ic.externo + '</a>' +
      '<div class="ed-grupo">Producto y compra</div>' + ['producto', 'pago'].map(global).join('') +
      '<div class="ed-grupo">Pie de página</div>' + ['olas', 'pie'].map(global).join('') +
      '<div class="ed-grupo">Estilo y botones</div>' + ['colores', 'efectos', 'whatsapp', 'chat'].map(global).join('') +
      '<div class="ed-grupo">Páginas</div>' + Object.keys(PAGINAS_FOTO).map(k => fila('pag:' + k, PAGINAS_FOTO[k][0])).join('') +
      '<a class="ed-sec" href="#/contenido/paginas" style="text-decoration:none;color:inherit"><span class="chev"></span><span class="nombre">Textos de las páginas</span>' + A.ic.externo + '</a>' +
      '</div>';
    A.$$('[data-sec]', panel).forEach(f => f.addEventListener('click', (e) => { if (!e.target.closest('button')) abrirSeccion(f.dataset.sec); }));
    A.$$('[data-sub],[data-baja]', panel).forEach(b => b.addEventListener('click', () => {
      const i = +(b.dataset.sub != null ? b.dataset.sub : b.dataset.baja), j = i + (b.dataset.sub != null ? -1 : 1);
      const t = orden[i]; orden[i] = orden[j]; orden[j] = t;
      P.orden = orden.slice(); pintarPanel(); cambio();
    }));
    A.$$('[data-ojo]', panel).forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.ojo; P.ocultas = (P.ocultas || []).slice();
      const i = P.ocultas.indexOf(k); if (i === -1) P.ocultas.push(k); else P.ocultas.splice(i, 1);
      pintarPanel(); cambio();
    }));
    const cuerpo = A.$('.ed-cuerpo', panel);
    if (cuerpo && ed.sec) pintarFormulario(cuerpo, ed.sec);
  }
  const NOMBRE_ICONO = { camion: 'Camión', tarjeta: 'Tarjeta', escudo: 'Escudo', mano: 'Mano', corazon: 'Corazón', regalo: 'Regalo', estrella: 'Estrella', flor: 'Flor', reloj: 'Reloj', chispa: 'Destello' };
  const EMOJI_ICONO = { '🚚': 'camion', '💳': 'tarjeta', '🛡️': 'escudo', '🛡': 'escudo', '✋': 'mano', '💜': 'corazon', '🎁': 'regalo', '⭐': 'estrella', '🌸': 'flor', '✨': 'chispa' };
  A.claveIcono = (v) => EMOJI_ICONO[String(v || '').trim()] || String(v || '').trim();
  function selectorIcono(ruta, v) {
    const k = A.claveIcono(v);
    return '<select class="inp" data-r="' + ruta + '" style="margin-bottom:6px">' + Object.keys(NOMBRE_ICONO).map(x => '<option value="' + x + '"' + (x === k ? ' selected' : '') + '>Ícono: ' + NOMBRE_ICONO[x] + '</option>').join('') + '</select>';
  }
  /* foto que hoy usa la tarjeta de la colección en la web */
  function imgColActual(id) {
    const d = A.$('#ed-marco') && A.$('#ed-marco').contentDocument;
    const im = d && d.querySelector('[data-kv-colimg="' + id + '"]');
    return (im && im.dataset.original) || (im && im.getAttribute('src')) || A.SIN_FOTO;
  }
  function filaGlobal(k) { return '<div class="ed-sec" data-sec="' + k + '"><span class="nombre">' + h(GLOBALES[k].nombre) + '</span>' + (GLOBALES[k].enlace ? A.ic.externo : '') + '</div>'; }

  /* Foto con encuadre: se arrastra para moverla dentro del marco (con la
     misma forma que tiene en la web). Guarda «x% y%» en rFoco. */
  function fotoFoco(etq, rImg, rFoco, url, aspecto, opc) {
    opc = opc || {};
    const f = focoValido(obtener(ed.tema, rFoco)) || '50% 50%';
    const [aw, ah] = String(aspecto).split('/').map(Number), vertical = aw < ah;
    return '<div class="campo ed-foto"><span>' + h(etq) + '</span>' +
      (url ? '<div class="ed-foco" data-foco="' + rFoco + '" style="aspect-ratio:' + aspecto + (vertical ? ';max-width:210px' : '') + '" title="Arrastra para encuadrar"><img src="' + h(url) + '" alt="" draggable="false" style="object-position:' + f + '"><span class="ed-foco-guia">Arrastra para encuadrar</span></div>'
           : '<div class="ed-foco vacia" style="aspect-ratio:' + aspecto + '"><span>' + h(opc.vacio || 'Sin foto') + '</span></div>') +
      '<div class="ed-foto-acc"><button class="btn btn-chico" data-img="' + rImg + '"' + (opc.vercol ? ' data-vercol="' + h(opc.vercol) + '"' : '') + '>' + A.ic.subir + (url ? ' Cambiar' : ' Subir') + '</button>' +
      (url ? '<button class="btn btn-chico btn-plano" data-focoreset="' + rFoco + '">Centrar</button>' : '') +
      (opc.quitar && obtener(ed.tema, rImg) ? '<button class="btn btn-chico btn-plano" data-imgquitar="' + rImg + '">' + h(opc.quitar) + '</button>' : '') +
      (opc.original ? '<button class="btn btn-chico btn-plano" data-imgdef="' + rImg + '">Usar la original</button>' : '') + '</div></div>';
  }
  function pintarFormulario(panel, k) {
    let def = SECCIONES[k] || GLOBALES[k];
    let html = '<div class="ed-form">';
    if (k === 'col:todo') {
      // la página «Ver todo» (/tienda/): título, texto y foto de portada
      const b = obtener(ed.tema, 'coleccionPagina.banners.todo') || {};
      html += '<label class="campo"><span>Título</span><input data-r="tiendaPagina.titulo" value="' + h(obtener(ed.tema, 'tiendaPagina.titulo') || '') + '"></label>' +
        '<label class="campo"><span>Texto junto a la cantidad de productos</span><input data-r="tiendaPagina.texto" value="' + h(obtener(ed.tema, 'tiendaPagina.texto') || '') + '"></label>' +
        fotoFoco('Foto de portada · computador', 'coleccionPagina.banners.todo.pc', 'coleccionPagina.banners.todo.foco', A.urlImagen(b.pc), '16/5', { quitar: 'Quitar', vacio: 'Sin foto: la página se ve sin portada' }) +
        fotoFoco('Foto de portada · celular (opcional)', 'coleccionPagina.banners.todo.movil', 'coleccionPagina.banners.todo.focoMovil', A.urlImagen(b.movil) || A.urlImagen(b.pc), '16/9', { quitar: A.urlImagen(b.movil) ? 'Usar la del computador' : '', vacio: 'Usa la del computador' }) +
        '<p class="ayuda">Fotos horizontales 3:2 (1536×1024). Arrastra cada foto para elegir qué parte se ve.</p>';
      def = { campos: [] };
    }
    else if (k.indexOf('col:') === 0) {
      // una colección: foto de la tarjeta y foto al abrirla (computador y celular)
      const id = k.slice(4), c = A.colecciones().find(x => x.id === id) || { nombre: id };
      const b = obtener(ed.tema, 'coleccionPagina.banners.' + id) || {};
      const tarjeta = A.urlImagen((obtener(ed.tema, 'portada.colecciones.imagenes') || {})[id]) || imgColActual(id);
      html += '<label class="campo"><span>Título al abrir la colección</span><input data-r="coleccionPagina.titulos.' + h(id) + '" value="' + h(obtener(ed.tema, 'coleccionPagina.titulos.' + id) || '') + '" placeholder="Si lo dejas vacío se usa el de siempre"></label>' +
        '<label class="campo"><span>Descripción (se ve arriba al abrir la colección)</span><textarea data-r="coleccionPagina.descripciones.' + h(id) + '" rows="4">' + h(obtener(ed.tema, 'coleccionPagina.descripciones.' + id) || '') + '</textarea></label>' +
        fotoFoco('Foto de la tarjeta en la portada', 'portada.colecciones.imagenes.' + id, 'portada.colecciones.focos.' + id, tarjeta, '4/5', { quitar: 'Usar la actual' }) +
        fotoFoco('Foto al abrir la colección · computador', 'coleccionPagina.banners.' + id + '.pc', 'coleccionPagina.banners.' + id + '.foco', A.urlImagen(b.pc), '16/5', { quitar: 'Quitar', vercol: c.nombre, vacio: 'Sin foto: la colección se ve sin portada' }) +
        fotoFoco('Foto al abrir la colección · celular (opcional)', 'coleccionPagina.banners.' + id + '.movil', 'coleccionPagina.banners.' + id + '.focoMovil', A.urlImagen(b.movil) || A.urlImagen(b.pc), '16/9', { quitar: A.urlImagen(b.movil) ? 'Usar la del computador' : '', vercol: c.nombre, vacio: 'Usa la del computador' }) +
        '<p class="ayuda">Fotos horizontales 3:2 (1536×1024). Arrastra cada foto para elegir qué parte se ve.</p>' +
        '<a class="btn btn-chico" href="#/colecciones/' + encodeURIComponent(id) + '">Editar nombre y productos ' + A.ic.externo + '</a>';
      def = { campos: [] };
    }
    if (k.indexOf('pag:') === 0) {
      // una página: su foto de portada (computador y celular)
      const id = k.slice(4), r = 'paginas.' + id + '.portada', b = obtener(ed.tema, r) || {};
      html += fotoFoco('Foto de portada · computador', r + '.pc', r + '.foco', A.urlImagen(b.pc), '16/6', { quitar: 'Quitar', vacio: 'Sin foto: la página se ve solo con texto' }) +
        fotoFoco('Foto de portada · celular (opcional)', r + '.movil', r + '.focoMovil', A.urlImagen(b.movil) || A.urlImagen(b.pc), '16/9', { quitar: A.urlImagen(b.movil) ? 'Usar la del computador' : '', vacio: 'Usa la del computador' }) +
        '<p class="ayuda">Fotos horizontales 3:2 (1536×1024). Va arriba de la página, del mismo ancho que el texto. Arrastra cada foto para elegir qué parte se ve.</p>' +
        (id === 'envios' ? '<a class="btn btn-chico" href="#/config/envios">Cambiar los precios de envío por región ' + A.ic.externo + '</a>' : '') +
        (id === 'contacto' ? '<a class="btn btn-chico" href="#/config/general">Cambiar WhatsApp, Instagram y correo ' + A.ic.externo + '</a>' : '');
      const vars = 'Puedes escribir {envio_rm}, {envio_regiones} o {envio_rango} para los costos de envío' + (id === 'envios' ? ', y {tabla_envios} para la tabla de precios por región' : '') +
        (id === 'contacto' || id === 'devoluciones' ? ', y {tarjetas_contacto} para los botones de WhatsApp, Instagram y correo' : '') + '. Se reemplazan solos.';
      def = { ruta: 'paginas.' + id, campos: [['antetitulo', 'texto', 'Texto chico de arriba'], ['titulo', 'texto', 'Título'],
        id === 'preguntas' ? ['items', 'objetos', 'Preguntas y respuestas', { q: 'Pregunta', a: 'Respuesta' }] : ['html', 'rico', 'Contenido de la página', { ayuda: h(vars) }]] };
    }
    const base = def.ruta ? def.ruta + '.' : '';
    const val = (c) => obtener(ed.tema, base + c);
    html += def.ayuda ? '<p class="ayuda">' + h(def.ayuda) + '</p>' : '';
    def.campos.forEach(([c, tipo, etq, sub]) => {
      const ruta = base + c, v = val(c);
      if (tipo === 'texto') html += '<label class="campo"><span>' + h(etq) + '</span><input data-r="' + ruta + '" value="' + h(v || '') + '"></label>';
      else if (tipo === 'area') html += '<label class="campo"><span>' + h(etq) + '</span><textarea data-r="' + ruta + '" rows="4">' + h(v || '') + '</textarea></label>';
      else if (tipo === 'numero') html += '<label class="campo"><span>' + h(etq) + '</span><input data-r="' + ruta + '" data-num="1" type="number" min="1" max="24" value="' + h(v || 8) + '" style="max-width:100px"></label>';
      else if (tipo === 'si') html += A.interruptor('si-' + c, v !== false && v != null ? !!v : false, h(etq), ' data-r="' + ruta + '" data-si="1"');
      else if (tipo === 'opciones') html += '<label class="campo"><span>' + h(etq) + '</span><select class="inp" data-r="' + ruta + '">' + Object.keys(sub).map(o => '<option value="' + o + '"' + (o === v ? ' selected' : '') + '>' + h(sub[o]) + '</option>').join('') + '</select></label>';
      else if (tipo === 'rango') html += '<label class="campo"><span>' + h(etq) + ' <b class="rango-v">' + h(v || sub.min) + ' px</b></span><input type="range" data-r="' + ruta + '" data-num="1" data-min="' + sub.min + '" data-max="' + sub.max + '" min="' + sub.min + '" max="' + sub.max + '" value="' + h(v || sub.min) + '"></label>';
      else if (tipo === 'colorOpc') html += '<label class="color-campo"><input type="color" data-r="' + ruta + '" value="' + h(v || '#2A123E') + '"><span>' + h(etq) + '</span><code>' + h(v || 'el del pie') + '</code></label>' +
        '<button class="btn btn-chico btn-plano" data-colorquitar="' + ruta + '" style="margin:-4px 0 12px">Usar el color del pie</button>';
      else if (tipo === 'color') html += '<label class="color-campo"><input type="color" data-r="' + ruta + '" value="' + h(v || '#ffffff') + '"><span>' + h(etq) + '</span><code>' + h(v || '') + '</code></label>';
      else if (tipo === 'boton') html += '<div class="campo"><span>' + h(etq) + '</span><input class="inp" data-r="' + ruta + '.texto" value="' + h((v || {}).texto || '') + '" placeholder="Texto" style="margin-bottom:6px"><input class="inp" data-r="' + ruta + '.url" value="' + h((v || {}).url || '') + '" placeholder="Enlace (ej: /tienda/)"></div>';
      else if (tipo === 'imagen' && sub && sub.aspecto) html += fotoFoco(etq, ruta, ruta + 'Foco', A.urlImagen(v), sub.aspecto, { original: true });
      else if (tipo === 'imagen') {
        const u = A.urlImagen(v);
        html += '<div class="campo"><span>' + h(etq) + '</span><div class="ed-img">' + (u ? '<img src="' + h(u) + '" alt="">' : '<div class="ayuda" style="padding:20px;text-align:center">Sin imagen</div>') + '</div>' +
          '<div style="display:flex;gap:6px"><button class="btn btn-chico" data-img="' + ruta + '">' + A.ic.subir + ' Cambiar</button><button class="btn btn-chico btn-plano" data-imgdef="' + ruta + '">Usar la original</button></div></div>';
      }
      else if (tipo === 'couriers') {
        let lista = v;
        if (!Array.isArray(lista)) {   // antes había una sola empresa (courierNombre / courierLogo)
          const pg = ed.tema.pago || {};
          lista = pg.courierNombre || pg.courierLogo ? [{ nombre: pg.courierNombre || '', logo: pg.courierLogo || '' }] : [];
          poner(ed.tema, ruta, lista);
        }
        html += '<span class="etq">' + h(etq) + '</span>' + lista.map((it, i) => {
          const u = A.urlImagen(it.logo);
          return '<div class="ed-lista-item"><div class="cab">' + (i + 1) +
            '<button class="mini" data-lsub="' + ruta + '|' + i + '"' + (i ? '' : ' disabled') + '>' + A.ic.arriba + '</button><button class="mini" data-lbaja="' + ruta + '|' + i + '"' + (i < lista.length - 1 ? '' : ' disabled') + '>' + A.ic.abajo + '</button><button class="mini" data-lborrar="' + ruta + '|' + i + '" style="color:var(--rojo)" aria-label="Quitar">' + A.ic.basura + '</button></div>' +
            '<input class="inp" data-r="' + ruta + '.' + i + '.nombre" value="' + h(it.nombre || '') + '" placeholder="Nombre (ej: Bluexpress, Starken, Chilexpress)" style="margin-bottom:8px">' +
            '<div style="display:flex;gap:10px;align-items:center">' + (u ? '<span class="ed-courier"><img src="' + h(logoAjustado(u)) + '" alt=""></span>' : '<span class="ed-courier vacio">Sin logo</span>') +
            '<button class="btn btn-chico" data-img="' + ruta + '.' + i + '.logo">' + A.ic.subir + (u ? ' Cambiar logo' : ' Subir logo') + '</button>' +
            (u ? '<button class="btn btn-chico btn-plano" data-imgquitar="' + ruta + '.' + i + '.logo" title="Quitar el logo">✕</button>' : '') + '</div></div>';
        }).join('') + '<button class="btn btn-chico" data-lmas="' + ruta + '|objetos">' + A.ic.mas + ' Agregar empresa de envío</button>';
      }
      else if (tipo === 'rico') {
        html += '<div class="campo" data-rico-campo="' + ruta + '"><span>' + h(etq) + '</span>' + A.editorRico('ed-rico-' + c.replace(/\W/g, ''), v || '') +
          (sub && sub.ayuda ? '<small>' + sub.ayuda + '</small>' : '') + '</div>';
      }
      else if (tipo === 'bannersCol') {
        html += '<span class="etq">' + h(etq) + '</span>' + A.colecciones().map(c => {
          const b = (v || {})[c.id] || {}, pc = A.urlImagen(b.pc), mo = A.urlImagen(b.movil);
          const mini = (u, w, hh, t) => u ? '<img src="' + h(u) + '" alt="" style="width:' + w + 'px;height:' + hh + 'px;object-fit:cover;border-radius:6px;background:#F4EEF6">'
            : '<span style="display:flex;align-items:center;justify-content:center;width:' + w + 'px;height:' + hh + 'px;border-radius:6px;background:#F4EEF6;color:var(--tenue);font-size:11px">' + t + '</span>';
          return '<div class="ed-lista-item"><b style="font-weight:500">' + h(c.nombre) + '</b>' +
            '<div style="display:flex;gap:10px;align-items:flex-end;margin-top:8px">' +
              '<div>' + mini(pc, 96, 64, 'Sin foto') + '<div style="display:flex;gap:4px;margin-top:4px"><button class="btn btn-chico" data-img="' + ruta + '.' + c.id + '.pc" data-vercol="' + h(c.nombre) + '">Computador</button>' + (pc ? '<button class="btn btn-chico btn-plano" data-imgquitar="' + ruta + '.' + c.id + '.pc" title="Quitar">✕</button>' : '') + '</div></div>' +
              '<div>' + mini(mo, 64, 64, 'Opcional') + '<div style="display:flex;gap:4px;margin-top:4px"><button class="btn btn-chico" data-img="' + ruta + '.' + c.id + '.movil" data-vercol="' + h(c.nombre) + '">Celular</button>' + (mo ? '<button class="btn btn-chico btn-plano" data-imgquitar="' + ruta + '.' + c.id + '.movil" title="Quitar">✕</button>' : '') + '</div></div>' +
            '</div></div>';
        }).join('');
      }
      else if (tipo === 'fotosCol') {
        html += '<span class="etq">' + h(etq) + '</span>' + A.colecciones().map(c => {
          const r = ruta + '.' + c.id, u = A.urlImagen((v || {})[c.id]);
          return '<div class="ed-lista-item" style="display:flex;gap:10px;align-items:center"><img src="' + h(u || imgColActual(c.id)) + '" alt="" style="width:56px;height:70px;object-fit:cover;border-radius:8px;background:#F4EEF6">' +
            '<div style="flex:1;min-width:0"><b style="font-weight:500">' + h(c.nombre) + '</b><div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><button class="btn btn-chico" data-img="' + r + '">Cambiar</button>' +
            (u ? '<button class="btn btn-chico btn-plano" data-imgquitar="' + r + '">Usar la actual</button>' : '') + '</div></div></div>';
        }).join('');
      }
      else if (tipo === 'textos' || tipo === 'objetos') {
        const lista = v || [];
        html += '<span class="etq">' + h(etq) + '</span>' + lista.map((it, i) => '<div class="ed-lista-item"><div class="cab">' + (i + 1) +
          '<button class="mini" data-lsub="' + ruta + '|' + i + '"' + (i ? '' : ' disabled') + '>' + A.ic.arriba + '</button><button class="mini" data-lbaja="' + ruta + '|' + i + '"' + (i < lista.length - 1 ? '' : ' disabled') + '>' + A.ic.abajo + '</button><button class="mini" data-lborrar="' + ruta + '|' + i + '" style="color:var(--rojo)">' + A.ic.basura + '</button></div>' +
          (tipo === 'textos' ? '<textarea class="inp" rows="2" data-r="' + ruta + '.' + i + '">' + h(it) + '</textarea>'
            : Object.keys(sub).map(sk => sk === 'icono' ? selectorIcono(ruta + '.' + i + '.icono', it.icono)
              : sk === 'a' ? '<textarea class="inp" rows="4" data-r="' + ruta + '.' + i + '.' + sk + '" placeholder="' + h(sub[sk]) + '" style="margin-bottom:6px">' + h(it[sk] || '') + '</textarea>'
              : '<input class="inp" data-r="' + ruta + '.' + i + '.' + sk + '" value="' + h(it[sk] || '') + '" placeholder="' + h(sub[sk]) + '" style="margin-bottom:6px">').join('')) + '</div>').join('') +
          '<button class="btn btn-chico" data-lmas="' + ruta + '|' + tipo + '">' + A.ic.mas + ' Agregar</button>';
      }
    });
    if (k === 'colores') html += '<button class="btn btn-chico mt" id="ed-col-orig">Volver a los colores originales</button>';
    if (k === 'producto' && ed.prodId) {
      const pr = (A.productos || []).find(x => x.id === ed.prodId);
      html += '<a class="btn btn-chico mt" href="#/productos/' + encodeURIComponent(ed.prodId) + '">Editar ' + h(pr ? pr.name : 'este producto') + ' (nombre, precio, fotos) ' + A.ic.externo + '</a>';
    }
    html += '</div>';
    panel.innerHTML = html;
    A.$$('[data-rico-campo]', panel).forEach(c => {
      const caja = c.querySelector('.rico');
      A.conectarRico(caja, () => { poner(ed.tema, c.dataset.ricoCampo, A.leerRico(caja)); cambio(); });
    });
    // encuadre: arrastrar la foto
    A.$$('[data-foco]', panel).forEach(caja => {
      const img = caja.querySelector('img'); let ini = null;
      const lim = (n) => Math.max(0, Math.min(100, n));
      caja.addEventListener('pointerdown', (e) => {
        e.preventDefault(); caja.setPointerCapture(e.pointerId);
        const [x, y] = (img.style.objectPosition || '50% 50%').split(' ').map(parseFloat);
        ini = { px: e.clientX, py: e.clientY, x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y, w: caja.clientWidth, h: caja.clientHeight };
        caja.classList.add('moviendo');
      });
      caja.addEventListener('pointermove', (e) => {
        if (!ini) return;
        const v = lim(ini.x - (e.clientX - ini.px) / ini.w * 160).toFixed(1) + '% ' + lim(ini.y - (e.clientY - ini.py) / ini.h * 160).toFixed(1) + '%';
        img.style.objectPosition = v; poner(ed.tema, caja.dataset.foco, v); cambio();
      });
      const fin = () => { if (!ini) return; ini = null; caja.classList.remove('moviendo'); cambio(); };
      caja.addEventListener('pointerup', fin); caja.addEventListener('pointercancel', fin);
    });
    A.$$('[data-focoreset]', panel).forEach(b => b.addEventListener('click', () => { poner(ed.tema, b.dataset.focoreset, ''); pintarFormulario(panel, k); cambio(); }));
    A.$$('[data-r]', panel).forEach(inp => {
      const ev = inp.type === 'checkbox' ? 'change' : 'input';
      inp.addEventListener(ev, () => {
        let v = inp.dataset.si ? inp.checked : inp.value;
        if (inp.dataset.num) v = Math.max(+(inp.dataset.min || 1), Math.min(+(inp.dataset.max || 24), A.num(v) || 1));
        poner(ed.tema, inp.dataset.r.replace(/^\./, ''), v);
        if (inp.type === 'color') inp.parentNode.querySelector('code').textContent = v;
        if (inp.type === 'range') inp.parentNode.querySelector('.rango-v').textContent = v + ' px';
        cambio();
      });
    });
    const lista = (s) => { const [r, i] = s.split('|'); return [obtener(ed.tema, r) || [], +i, r]; };
    A.$$('[data-lsub],[data-lbaja]', panel).forEach(b => b.addEventListener('click', () => {
      const [l, i] = lista(b.dataset.lsub || b.dataset.lbaja), j = i + (b.dataset.lsub ? -1 : 1);
      const t = l[i]; l[i] = l[j]; l[j] = t; pintarFormulario(panel, k); cambio();
    }));
    A.$$('[data-lborrar]', panel).forEach(b => b.addEventListener('click', () => { const [l, i] = lista(b.dataset.lborrar); l.splice(i, 1); pintarFormulario(panel, k); cambio(); }));
    A.$$('[data-lmas]', panel).forEach(b => b.addEventListener('click', () => {
      const [r, tipo] = b.dataset.lmas.split('|');
      const l = obtener(ed.tema, r) || []; l.push(tipo === 'textos' ? '' : {}); poner(ed.tema, r, l);
      pintarFormulario(panel, k); cambio();
    }));
    A.$$('[data-colorquitar]', panel).forEach(b => b.addEventListener('click', () => { poner(ed.tema, b.dataset.colorquitar, ''); pintarFormulario(panel, k); cambio(); }));
    A.$$('[data-img]', panel).forEach(b => b.addEventListener('click', async () => {
      const m = await A.elegirMedio(); if (!m) return;
      poner(ed.tema, b.dataset.img, m); pintarFormulario(panel, k); cambio();
      if (b.dataset.vercol) verColeccion(b.dataset.vercol);
    }));
    A.$$('[data-imgquitar]', panel).forEach(b => b.addEventListener('click', () => {
      const ks = b.dataset.imgquitar.split('.'), id = ks.pop(), m = obtener(ed.tema, ks.join('.')) || {};
      delete m[id]; poner(ed.tema, ks.join('.'), m); pintarFormulario(panel, k); cambio();
    }));
    A.$$('[data-imgdef]', panel).forEach(b => b.addEventListener('click', () => {
      poner(ed.tema, b.dataset.imgdef, obtener(A.temaDefecto(), b.dataset.imgdef)); pintarFormulario(panel, k); cambio();
    }));
    const co = A.$('#ed-col-orig', panel);
    if (co) co.addEventListener('click', () => { ed.tema.colores = A.copia(A.temaDefecto().colores); pintarFormulario(panel, k); cambio(); });
  }

  // ============================================================
  //  navegación (menús)
  // ============================================================
  A.pagina('tienda/navegacion', function (vista) {
    const t = A.temaVigente();
    if (!t) { vista.innerHTML = A.cargandoHtml; return; }
    const menus = { menu: A.copia(t.menu || []), menuPie: A.copia(t.menuPie || []) };
    const inicial = JSON.stringify(menus);
    const destinos = [['/', 'Inicio'], ['/tienda/', 'Tienda (todos los productos)'], ['@colecciones', 'Colecciones (menú desplegable)']]
      .concat(A.colecciones().map(c => ['/c/' + A.sinTildes(c.nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.html', 'Colección: ' + c.nombre]))
      .concat([['/nosotros.html', 'Página: Nosotros'], ['/contacto.html', 'Página: Contacto'], ['/envios.html', 'Página: Envíos'], ['/preguntas-frecuentes.html', 'Página: Preguntas frecuentes'], ['/devoluciones.html', 'Página: Cambios y devoluciones'], ['/privacidad.html', 'Página: Privacidad']])
      .concat((t.paginas.extra || []).map(x => ['/paginas/' + A.sinTildes(x.slug || x.titulo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.html', 'Página: ' + x.titulo]));
    const pintar = () => {
      ['menu', 'menuPie'].forEach(m => {
        A.$('#nv-' + m, vista).innerHTML = menus[m].map((it, i) => {
          const dest = it.tipo === 'colecciones' ? '@colecciones' : it.url;
          const conocido = destinos.some(d => d[0] === dest);
          return '<div class="linea-item"><div class="t" style="display:grid;grid-template-columns:1fr 1.3fr;gap:8px">' +
            '<input class="inp" data-m="' + m + '" data-i="' + i + '" data-k="texto" value="' + h(it.texto || '') + '" placeholder="Texto">' +
            '<select class="inp" data-m="' + m + '" data-i="' + i + '" data-k="destino">' + destinos.filter(d => m === 'menu' || d[0] !== '@colecciones').map(d => '<option value="' + h(d[0]) + '"' + (d[0] === dest ? ' selected' : '') + '>' + h(d[1]) + '</option>').join('') +
              '<option value="@otro"' + (conocido ? '' : ' selected') + '>Otro enlace…</option></select>' +
            (conocido ? '' : '<input class="inp" style="grid-column:1/-1" data-m="' + m + '" data-i="' + i + '" data-k="url" value="' + h(it.url || '') + '" placeholder="https://… o /ruta">') + '</div>' +
            '<button class="btn btn-chico btn-plano" data-mv="' + m + '|' + i + '|-1"' + (i ? '' : ' disabled') + '>' + A.ic.arriba + '</button><button class="btn btn-chico btn-plano" data-mv="' + m + '|' + i + '|1"' + (i < menus[m].length - 1 ? '' : ' disabled') + '>' + A.ic.abajo + '</button>' +
            '<button class="btn btn-chico btn-plano" data-del="' + m + '|' + i + '" style="color:var(--rojo)">' + A.ic.basura + '</button></div>';
        }).join('') || '<p class="ayuda">Sin enlaces.</p>';
      });
      A.$$('[data-k]', vista).forEach(x => x.addEventListener(x.tagName === 'SELECT' ? 'change' : 'input', () => {
        const it = menus[x.dataset.m][+x.dataset.i];
        if (x.dataset.k === 'texto') it.texto = x.value;
        else if (x.dataset.k === 'url') it.url = x.value;
        else {
          delete it.tipo;
          if (x.value === '@colecciones') { it.tipo = 'colecciones'; delete it.url; }
          else if (x.value === '@otro') it.url = it.url || '';
          else { it.url = x.value; if (!it.texto) it.texto = (destinos.find(d => d[0] === x.value) || [])[1].replace(/^(Página|Colección): /, ''); }
          pintar();
        }
        revisar();
      }));
      A.$$('[data-mv]', vista).forEach(b => b.addEventListener('click', () => { const [m, i, d] = b.dataset.mv.split('|'); const l = menus[m], a = +i, z = a + (+d); const t2 = l[a]; l[a] = l[z]; l[z] = t2; pintar(); revisar(); }));
      A.$$('[data-del]', vista).forEach(b => b.addEventListener('click', () => { const [m, i] = b.dataset.del.split('|'); menus[m].splice(+i, 1); pintar(); revisar(); }));
    };
    const revisar = () => {
      if (JSON.stringify(menus) !== inicial) A.marcarCambios(async () => {
        const tema = A.temaVigente(); tema.menu = menus.menu.filter(x => x.texto); tema.menuPie = menus.menuPie.filter(x => x.texto);
        try { await A.guardarTemaVivo(tema); A.toast('Menús guardados ✓ Se ven en la web en unos minutos.'); setTimeout(A.repintar, 0); return true; } catch (e) { A.errorGuardar(e); return false; }
      }, () => { A.limpiarCambios(); A.repintar(); });
      else A.limpiarCambios();
    };
    vista.innerHTML = '<div class="pag angosta no-refrescar">' + A.cab('Navegación', { volver: 'tienda' }) + A.avisoPermisoWeb() +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Menú principal</h2><span class="ayuda">arriba de la web</span><div class="acciones"><button class="btn btn-chico" data-mas="menu">' + A.ic.mas + ' Agregar enlace</button></div></div><div class="tarjeta-c" id="nv-menu"></div></div>' +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Menú del pie</h2><span class="ayuda">columna «Ayuda»</span><div class="acciones"><button class="btn btn-chico" data-mas="menuPie">' + A.ic.mas + ' Agregar enlace</button></div></div><div class="tarjeta-c" id="nv-menuPie"></div></div>' +
      '<p class="ayuda">En el celular, el menú muestra estos mismos enlaces y abajo los del pie.</p></div>';
    A.$$('[data-mas]', vista).forEach(b => b.addEventListener('click', () => { menus[b.dataset.mas].push({ texto: '', url: '/' }); pintar(); revisar(); }));
    pintar();
  }, ['web']);

  // ============================================================
  //  preferencias
  // ============================================================
  A.pagina('tienda/preferencias', function (vista) {
    const t = A.temaVigente();
    if (!t) { vista.innerHTML = A.cargandoHtml; return; }
    const seo = Object.assign({}, t.seo);
    vista.innerHTML = '<div class="pag angosta no-refrescar" id="pf">' + A.cab('Preferencias', { volver: 'tienda' }) + A.avisoPermisoWeb() +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Título y descripción de la página de inicio</h2></div><div class="tarjeta-c">' +
        '<div style="border:1px solid var(--borde);border-radius:10px;padding:12px;margin-bottom:12px"><div style="color:#1a0dab;font-size:17px" id="pf-g-t"></div><div style="color:#006621;font-size:13px">karivejoyas.cl</div><div style="color:#545454;font-size:13px" id="pf-g-d"></div></div>' +
        '<label class="campo"><span>Título de la página de inicio</span><input id="pf-tit" value="' + h(seo.titulo || '') + '" maxlength="70"><small id="pf-tit-n"></small></label>' +
        '<label class="campo"><span>Descripción</span><textarea id="pf-desc" rows="3" maxlength="170">' + h(seo.descripcion || '') + '</textarea><small id="pf-desc-n"></small></label>' +
      '</div></div>' +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Imagen para compartir en redes</h2></div><div class="tarjeta-c">' +
        '<p class="ayuda">Es la imagen que aparece cuando alguien comparte tu web por WhatsApp, Facebook o Instagram.</p>' +
        '<div class="ed-img" style="max-width:360px"><img id="pf-img" src="' + h(A.urlImagen(seo.imagen) || '/assets/modelo-portada.jpg') + '" alt="" style="height:190px"></div>' +
        '<button class="btn btn-chico" id="pf-img-btn">' + A.ic.subir + ' Cambiar imagen</button>' +
      '</div></div>' +
      '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:8px">Más ajustes</h2><p class="ayuda" style="margin:0">La barra de anuncio, los colores y el botón de WhatsApp están en <a href="#/tienda/editor">Personalizar tema</a>. El nombre, el correo y las redes, en <a href="#/config/general">Configuración → General</a>.</p></div>' +
    '</div>';
    const $ = (id) => A.$('#' + id, vista);
    const google = () => {
      $('pf-g-t').textContent = $('pf-tit').value || 'Título'; $('pf-g-d').textContent = $('pf-desc').value;
      $('pf-tit-n').textContent = $('pf-tit').value.length + ' de 60 caracteres recomendados';
      $('pf-desc-n').textContent = $('pf-desc').value.length + ' de 155 caracteres recomendados';
    };
    google();
    const leer = () => ({ titulo: $('pf-tit').value.trim(), descripcion: $('pf-desc').value.trim(), imagen: seo.imagen });
    const ini = JSON.stringify(leer());
    const revisar = () => {
      google();
      if (JSON.stringify(leer()) !== ini) A.marcarCambios(async () => {
        const tema = A.temaVigente(); tema.seo = Object.assign({}, tema.seo, leer());
        if (!tema.seo.titulo) { A.avisar('El título no puede quedar vacío.'); return false; }
        try { await A.guardarTemaVivo(tema); A.toast('Preferencias guardadas ✓'); setTimeout(A.repintar, 0); return true; } catch (e) { A.errorGuardar(e); return false; }
      }, () => { A.limpiarCambios(); A.repintar(); });
      else A.limpiarCambios();
    };
    $('pf').addEventListener('input', revisar);
    $('pf-img-btn').addEventListener('click', async () => {
      const m = await A.elegirMedio(); if (!m) return;
      seo.imagen = m; $('pf-img').src = A.urlImagen(m); revisar();
    });
    A.cargarMedios().then(() => { if (String(seo.imagen).indexOf('medio:') === 0) $('pf-img').src = A.urlImagen(seo.imagen); }).catch(() => {});
  }, ['web']);

})();
