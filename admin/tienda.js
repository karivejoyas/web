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
    return actualizarTextos(A.mezclar(A.mezclar(A.temaPublicado.defecto, A.temaPublicado.tema), (A.web || {}).tema || {}));
  };
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
  const VARS = () => {
    const e = (A.temaPublicado && A.temaPublicado.envio) || { rm: 2990, regiones: 3990 };
    const t = A.settings.envioTarifas || {};
    return { envio_rm: A.clp(t.rm || e.rm), envio_regiones: A.clp(t.regiones || e.regiones) };
  };
  function reemplazos(s, extra) { Object.keys(extra).forEach(k => { s = s.split('{' + k + '}').join(extra[k]); }); return s; }
  A.textoTema = function (s) {
    return reemplazos(h(s == null ? '' : s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'), VARS());
  };

  /* Aplica un tema a una página de la web ya cargada (la vista previa del
     editor). Usa las marcas data-kv que pone construir.py. */
  /* Orden de las secciones de la portada; las que se agregaron después de
     guardar el tema van en su lugar de fábrica (igual que en construir.py). */
  function ordenPortada(P) {
    const fab = ((A.temaDefecto() || {}).portada || {}).orden || Object.keys(SECCIONES);
    const orden = (P.orden || []).filter(k => fab.indexOf(k) !== -1 || SECCIONES[k]);
    fab.forEach((k, i) => { if (orden.indexOf(k) === -1) { const antes = fab.slice(0, i).filter(x => orden.indexOf(x) !== -1); orden.splice(antes.length ? orden.indexOf(antes[antes.length - 1]) + 1 : 0, 0, k); } });
    Object.keys(SECCIONES).forEach(k => { if (orden.indexOf(k) === -1) orden.push(k); });
    return orden;
  }
  A.aplicarTema = function (doc, t) {
    if (!doc || !doc.documentElement) return;
    const cache = doc.__kv || (doc.__kv = {
      sub: (doc.querySelector('.desplegable-panel') || {}).innerHTML || '',
      subMovil: (doc.querySelector('#cajon-menu .sub:not(.sub-ayuda)') || {}).innerHTML || '',
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
    });
    doc.querySelectorAll('[data-kv-img]').forEach(el => { const u = A.urlImagen(obtener(t, el.dataset.kvImg)); if (u) { el.src = u; el.removeAttribute('srcset'); } });
    doc.querySelectorAll('[data-kv-html]').forEach(el => {
      const v = obtener(t, el.dataset.kvHtml); if (v == null) return;
      el.innerHTML = reemplazos(String(v), Object.assign(VARS(), { tabla_envios: cache.tabla, tarjetas_contacto: cache.tarjetas }));
    });
    // listas
    const menuItem = (it, movil) => it.tipo === 'colecciones'
      ? (movil ? '<div class="sub">' + cache.subMovil + '</div>' : '<div class="desplegable"><button type="button" aria-expanded="false" aria-haspopup="true">' + h(it.texto) + ' ▾</button><div class="desplegable-panel">' + cache.sub + '</div></div>')
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
          '<p class="ayuda" style="margin:0">Los cambios que guardes aparecen en la web en unos 15 a 20 minutos.</p>' +
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
    hero: { nombre: 'Portada principal', ruta: 'portada.hero', campos: [['titulo', 'texto', 'Título'], ['texto', 'area', 'Texto'], ['boton1', 'boton', 'Botón principal'], ['boton2', 'boton', 'Botón secundario'], ['imagen', 'imagen', 'Imagen'], ['imagenAlt', 'texto', 'Descripción de la imagen (para Google)'], ['sello', 'texto', 'Sello sobre la imagen'], ['tarjetaNuevo', 'si', 'Mostrar el último producto subido sobre la foto']] },
    cinta: { nombre: 'Cinta en movimiento', ruta: 'portada.cinta', campos: [['items', 'textos', 'Frases que pasan']], ayuda: 'Frases cortas. Se desplazan solas y se detienen al pasar el mouse.' },
    confianza: { nombre: 'Beneficios', ruta: 'portada.confianza', campos: [['items', 'objetos', 'Beneficios', { icono: 'Ícono', titulo: 'Título', texto: 'Texto' }]] },
    colecciones: { nombre: 'Colecciones', ruta: 'portada.colecciones', campos: [['titulo', 'texto', 'Título'], ['enlace', 'texto', 'Texto del enlace'], ['imagenes', 'fotosCol', 'Foto de cada colección']], ayuda: 'El nombre y el orden de las colecciones se cambian en Productos → Colecciones. Las fotos de aquí son solo para la portada.' },
    favoritos: { nombre: 'Los más queridos', ruta: 'portada.favoritos', campos: [['titulo', 'texto', 'Título'], ['enlace', 'texto', 'Texto del enlace'], ['cantidad', 'numero', 'Cuántos productos']], ayuda: 'Muestra la lista de «Lo más visto» (Descuentos) y la completa con un producto de cada colección.' },
    taller: { nombre: 'Nuestro taller', ruta: 'portada.taller', campos: [['titulo', 'texto', 'Título'], ['texto', 'area', 'Texto'], ['imagen', 'imagen', 'Imagen'], ['imagenAlt', 'texto', 'Descripción de la imagen'], ['pasos', 'textos', 'Pasos'], ['boton', 'boton', 'Botón']] },
    nuevos: { nombre: 'Lo nuevo', ruta: 'portada.nuevos', campos: [['titulo', 'texto', 'Título'], ['enlace', 'texto', 'Texto del enlace'], ['cantidad', 'numero', 'Cuántos productos']], ayuda: 'Muestra los productos subidos más recientemente.' },
    instagram: { nombre: 'Instagram', ruta: 'portada.instagram', campos: [['titulo', 'texto', 'Título'], ['enlace', 'texto', 'Texto del enlace'], ['cantidad', 'numero', 'Cuántas publicaciones (máximo 12)']], ayuda: 'Muestra tus últimos videos (reels) de Instagram con el mismo estilo de las colecciones. Se actualizan solos cuando subes uno nuevo (Apps → Instagram).' },
    especial: { nombre: 'Diseños a pedido', ruta: 'portada.especial', campos: [['titulo', 'texto', 'Título'], ['texto', 'area', 'Texto'], ['boton', 'texto', 'Texto del botón'], ['mensaje', 'area', 'Mensaje que se escribe solo en WhatsApp']] }
  };
  const EFECTOS_PORTADA = { destello: 'Destello: la foto se descubre y la cruza una luz', lento: 'Movimiento lento: la foto se acerca despacio, siempre', cortina: 'Cortina morada que la descubre', arco: 'Arco que se abre', profundidad: 'Profundidad: se mueve con el mouse', ninguno: 'Sin efecto' };
  const TRANSICIONES = { profundidad: 'Profundidad: la página se aleja y la nueva llega desde adelante', vuela: 'La foto vuela del producto a su ficha', cortina: 'Cortina: la página nueva sube desde abajo', deslizar: 'Deslizar de lado', ninguna: 'Sin transición' };
  const GLOBALES = {
    anuncio: { nombre: 'Barra de anuncio', ruta: 'anuncio', campos: [['activo', 'si', 'Mostrar la barra de anuncio'], ['texto', 'texto', 'Texto']], ayuda: 'Escribe **así** para poner una parte en negrita.' },
    menu: { nombre: 'Menú', enlace: 'tienda/navegacion' },
    pie: { nombre: 'Pie de página', ruta: 'pie', campos: [['texto', 'area', 'Texto sobre la tienda'], ['boletinTitulo', 'texto', 'Título del boletín'], ['boletinTexto', 'texto', 'Texto del boletín'], ['final', 'texto', 'Frase final']] },
    colores: { nombre: 'Colores', ruta: 'colores', campos: [['fondo', 'color', 'Fondo'], ['fondo2', 'color', 'Fondo secundario'], ['texto', 'color', 'Texto'], ['suave', 'color', 'Texto suave'], ['borde', 'color', 'Bordes'], ['principal', 'color', 'Color principal'], ['oscuro', 'color', 'Color oscuro (botones, títulos)'], ['lila', 'color', 'Lila'], ['dorado', 'color', 'Dorado'], ['doradoClaro', 'color', 'Dorado claro']] },
    whatsapp: { nombre: 'Botón de WhatsApp', ruta: '', campos: [['whatsappFlotante', 'si', 'Mostrar el botón flotante de WhatsApp'], ['whatsappRespira', 'si', 'Que respire (se agranda suavecito, para que se note)']], ayuda: 'El número se cambia en Configuración → General.' },
    logo: { nombre: 'Logo', ruta: 'logo', campos: [['imagen', 'imagen', 'Imagen del logo'], ['alto', 'rango', 'Tamaño en el computador', { min: 28, max: 110 }], ['altoMovil', 'rango', 'Tamaño en el celular', { min: 24, max: 80 }], ['altoPie', 'rango', 'Tamaño en el pie de página', { min: 30, max: 120 }]], ayuda: 'Para cambiar la imagen usa un PNG con fondo transparente. Al bajar por la página, en el computador el logo se achica un poco.' },
    efectos: { nombre: 'Efectos y movimiento', ruta: 'efectos', campos: [['portada', 'opciones', 'Efecto de la foto de portada', EFECTOS_PORTADA], ['transicion', 'opciones', 'Al abrir una colección o un producto', TRANSICIONES]], ayuda: 'La transición entre páginas se ve en Chrome, Edge y Safari (iPhone) actualizados; en los demás la página simplemente cambia. Quien tenga activado «reducir movimiento» no ve efectos.' },
    olas: { nombre: 'Olas antes del pie', ruta: 'olas', campos: [['activo', 'si', 'Mostrar las olas'], ['animacion', 'si', 'Que se muevan'], ['rotar', 'si', 'Darlas vuelta (de derecha a izquierda)'], ['alto', 'rango', 'Alto en el computador', { min: 30, max: 220 }], ['altoMovil', 'rango', 'Alto en el celular', { min: 20, max: 160 }], ['color', 'colorOpc', 'Color de las olas']], ayuda: 'Si no eliges color, usan el del pie de página (Colores → Color oscuro).' },
    chat: { nombre: 'Asistente (chat)', ruta: 'chat', campos: [['activo', 'si', 'Mostrar el asistente'], ['nombre', 'texto', 'Nombre'], ['saludo', 'area', 'Saludo'], ['mensajes', 'textos', 'Mensajes que aparecen junto al botón (de a uno, máximo 6 por visita)'], ['mensajeWhatsapp', 'texto', 'Mensaje que aparece sobre el botón de WhatsApp']], ayuda: 'Responde con la IA del publicador (Apps → Asistente IA) y, si no está disponible, con respuestas automáticas que usan tus productos, precios y envíos reales.' },
    producto: { nombre: 'Ficha de producto', ruta: 'producto', campos: [['beneficios', 'textos', 'Beneficios bajo el botón de compra']] }
  };
  const PAGINAS_PREV = [['/', 'Inicio'], ['/tienda/', 'Tienda'], ['col', 'Una colección'], ['prod', 'Un producto'], ['/nosotros.html', 'Nosotros'], ['/contacto.html', 'Contacto'], ['/envios.html', 'Envíos'], ['/preguntas-frecuentes.html', 'Preguntas frecuentes'], ['/devoluciones.html', 'Cambios y devoluciones']];

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
      // tocar algo en la vista abre su sección; los enlaces no navegan
      doc.addEventListener('click', (e) => {
        const a = e.target.closest('a,button'); if (a) e.preventDefault();
        const sec = e.target.closest('[data-kv-sec]');
        if (sec) { abrirSeccion(sec.dataset.kvSec); return; }
        if (e.target.closest('.anuncio')) abrirSeccion('anuncio');
        else if (e.target.closest('.logo')) abrirSeccion('logo');
        else if (e.target.closest('.olas')) abrirSeccion('olas');
        else if (e.target.closest('.chat-btn')) abrirSeccion('chat');
        else if (e.target.closest('.wa-flota')) abrirSeccion('whatsapp');
        else if (e.target.closest('.pie')) abrirSeccion('pie');
      }, true);
      const css = doc.createElement('style');
      css.textContent = '[data-kv-sec]:hover{outline:2px dashed rgba(91,42,130,.45);outline-offset:-2px;cursor:pointer}[data-kv-sec].kv-sel{outline:2px solid #5B2A82;outline-offset:-2px}';
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
      A.toast(ed.id ? 'Copia guardada ✓' : 'Guardado ✓ La web se actualiza en unos 15 a 20 minutos.');
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
  function abrirSeccion(k) {
    if (GLOBALES[k] && GLOBALES[k].enlace) { if (A.hayCambios()) { A.toast('Guarda primero tus cambios'); return; } A.ir(GLOBALES[k].enlace); return; }
    ed.sec = k; pintarPanel(); marcarSeleccion();
  }

  function pintarPanel() {
    const panel = A.$('#ed-panel'); if (!panel) return;
    if (ed.sec) { pintarFormulario(panel, ed.sec); return; }
    const P = ed.tema.portada;
    const ocultas = P.ocultas || [];
    // secciones nuevas aparecen en su lugar de fábrica (igual que en construir.py)
    const orden = ordenPortada(P).filter(k => SECCIONES[k]);
    panel.innerHTML = '<div class="ed-secciones">' +
      '<div class="ed-grupo">Encabezado</div>' + ['anuncio', 'logo', 'menu'].map(k => filaGlobal(k)).join('') +
      '<div class="ed-grupo">Portada</div>' +
      orden.map((k, i) => '<div class="ed-sec' + (ocultas.indexOf(k) !== -1 ? ' oculta' : '') + '" data-sec="' + k + '"><span class="nombre">' + h(SECCIONES[k].nombre) + '</span>' +
        '<button class="mini" data-sub="' + i + '" title="Subir"' + (i ? '' : ' disabled') + '>' + A.ic.arriba + '</button><button class="mini" data-baja="' + i + '" title="Bajar"' + (i < orden.length - 1 ? '' : ' disabled') + '>' + A.ic.abajo + '</button>' +
        '<button class="mini" data-ojo="' + k + '" title="' + (ocultas.indexOf(k) !== -1 ? 'Mostrar' : 'Ocultar') + '">' + (ocultas.indexOf(k) !== -1 ? A.ic.ojoNo : A.ic.ojo) + '</button></div>').join('') +
      '<div class="ed-grupo">Pie de página</div>' + ['olas', 'pie'].map(filaGlobal).join('') +
      '<div class="ed-grupo">Configuración del tema</div>' + ['efectos', 'colores', 'whatsapp', 'chat', 'producto'].map(filaGlobal).join('') +
      '<div class="ed-grupo">Páginas</div><a class="ed-sec" href="#/contenido/paginas" style="text-decoration:none;color:inherit"><span class="nombre">Nosotros, Envíos, Preguntas…</span>' + A.ic.externo + '</a>' +
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

  function pintarFormulario(panel, k) {
    const def = SECCIONES[k] || GLOBALES[k];
    const base = def.ruta ? def.ruta + '.' : '';
    const val = (c) => obtener(ed.tema, base + c);
    let html = '<div class="ed-form"><h3><button class="btn btn-plano btn-chico" id="ed-atras" aria-label="Volver">' + A.ic.volver + '</button>' + h(def.nombre) + '</h3>' + (def.ayuda ? '<p class="ayuda">' + h(def.ayuda) + '</p>' : '');
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
      else if (tipo === 'imagen') {
        const u = A.urlImagen(v);
        html += '<div class="campo"><span>' + h(etq) + '</span><div class="ed-img">' + (u ? '<img src="' + h(u) + '" alt="">' : '<div class="ayuda" style="padding:20px;text-align:center">Sin imagen</div>') + '</div>' +
          '<div style="display:flex;gap:6px"><button class="btn btn-chico" data-img="' + ruta + '">' + A.ic.subir + ' Cambiar</button><button class="btn btn-chico btn-plano" data-imgdef="' + ruta + '">Usar la original</button></div></div>';
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
              : '<input class="inp" data-r="' + ruta + '.' + i + '.' + sk + '" value="' + h(it[sk] || '') + '" placeholder="' + h(sub[sk]) + '" style="margin-bottom:6px">').join('')) + '</div>').join('') +
          '<button class="btn btn-chico" data-lmas="' + ruta + '|' + tipo + '">' + A.ic.mas + ' Agregar</button>';
      }
    });
    if (k === 'colores') html += '<button class="btn btn-chico mt" id="ed-col-orig">Volver a los colores originales</button>';
    html += '</div>';
    panel.innerHTML = html;
    A.$('#ed-atras', panel).addEventListener('click', () => { ed.sec = null; pintarPanel(); marcarSeleccion(); });
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
