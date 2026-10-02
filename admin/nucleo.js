/* ============================================================
   Karivé Joyas · panel de administración — núcleo
   Conexión con la base, ingreso, rutas, barra de guardar y
   herramientas que usan todas las páginas.

   Usa la MISMA base de datos y la misma contraseña que el panel
   antiguo (karivejoyas.github.io/catalogo/admin.html), que sigue
   funcionando igual. Nada se escribe solo: cada cambio sale de un
   botón que tú aprietas.
   ============================================================ */
(function () {
  'use strict';

  firebase.initializeApp({
    apiKey: 'AIzaSyC6XWnbq6QEg4DjldVKvoafbe9dtZdyLqI',
    authDomain: 'karive-catalogo.firebaseapp.com',
    projectId: 'karive-catalogo',
    storageBucket: 'karive-catalogo.firebasestorage.app',
    messagingSenderId: '262475026396',
    appId: '1:262475026396:web:34ee4bf36dbebdcc468919'
  });
  const db = firebase.firestore();
  const auth = firebase.auth();
  window.kvDb = db;

  const ADMIN_EMAIL = 'karive.joyas@gmail.com';
  const REST = 'https://firestore.googleapis.com/v1/projects/karive-catalogo/databases/(default)/documents';
  const CATALOGO_ANTIGUO = 'https://karivejoyas.github.io/catalogo/';
  const cat = db.collection('catalog');

  const A = window.A = {
    db: db, auth: auth, REST: REST, CATALOGO_ANTIGUO: CATALOGO_ANTIGUO, ADMIN_EMAIL: ADMIN_EMAIL,
    ref: {
      items: cat.doc('products').collection('items'),
      settings: cat.doc('settings'),
      pedidos: cat.doc('pedidos').collection('items'),
      visitas: cat.doc('visitas').collection('items'),
      suscritos: cat.doc('suscriptores').collection('items'),
      web: cat.doc('web'),
      temas: cat.doc('web').collection('temas'),
      medios: cat.doc('web').collection('medios'),
      respaldos: cat.doc('web').collection('respaldos')
    },
    // datos en memoria
    productos: [], settings: {}, pedidos: [], visitas: [], suscritos: [], web: null,
    webError: '', temaPublicado: null, listo: {}
  };

  // ============================================================
  //  herramientas
  // ============================================================
  A.$ = (sel, raiz) => (raiz || document).querySelector(sel);
  A.$$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));
  A.h = (s) => escapeHtml(s == null ? '' : String(s));
  A.clp = (n) => formatCLP(Math.round(Number(n) || 0));
  A.num = (v) => { const n = parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10); return isNaN(n) ? 0 : n; };
  A.copia = (o) => JSON.parse(JSON.stringify(o == null ? null : o));
  A.igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  A.id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  A.fecha = function (iso, conHora) {
    if (!iso) return '';
    const d = new Date(iso); if (isNaN(d)) return String(iso).slice(0, 16);
    const f = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
    return conHora === false ? f : f + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  };
  A.hace = function (iso) {
    const t = new Date(iso).getTime(); if (!t) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'hace un momento';
    if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
    if (s < 86400 * 7) { const d = Math.round(s / 86400); return 'hace ' + d + (d === 1 ? ' día' : ' días'); }
    return A.fecha(iso, false);
  };
  A.diaClave = (d) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };

  A.ic = {
    volver: '<svg viewBox="0 0 20 20"><path d="M12.5 4 6.5 10l6 6"/></svg>',
    mas: '<svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12"/></svg>',
    ojo: '<svg viewBox="0 0 20 20"><path d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5S2 10 2 10Z"/><circle cx="10" cy="10" r="2.3"/></svg>',
    ojoNo: '<svg viewBox="0 0 20 20"><path d="M3 3l14 14M8.3 5A8 8 0 0 1 10 4.5c5 0 8 5.5 8 5.5a14 14 0 0 1-2.4 3M5.2 6.6A14 14 0 0 0 2 10s3 5.5 8 5.5a7.6 7.6 0 0 0 3.5-.9"/></svg>',
    arriba: '<svg viewBox="0 0 20 20"><path d="M10 15V5M5.5 9.5 10 5l4.5 4.5"/></svg>',
    abajo: '<svg viewBox="0 0 20 20"><path d="M10 5v10M5.5 10.5 10 15l4.5-4.5"/></svg>',
    basura: '<svg viewBox="0 0 20 20"><path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10h7.4l.8-10"/></svg>',
    copiar: '<svg viewBox="0 0 20 20"><rect x="7" y="7" width="9" height="9" rx="1.5"/><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7"/></svg>',
    descargar: '<svg viewBox="0 0 20 20"><path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12"/></svg>',
    subir: '<svg viewBox="0 0 20 20"><path d="M10 13V4M6 7.5l4-4 4 4M4 16.5h12"/></svg>',
    buscar: '<svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="5.5"/><path d="m13.5 13.5 3.5 3.5"/></svg>',
    escritorio: '<svg viewBox="0 0 20 20"><rect x="2.5" y="4" width="15" height="10" rx="1.5"/><path d="M7 17h6"/></svg>',
    movil: '<svg viewBox="0 0 20 20"><rect x="6" y="2.5" width="8" height="15" rx="1.8"/><path d="M9.3 15h1.4"/></svg>',
    lapiz: '<svg viewBox="0 0 20 20"><path d="M4 16l1-4L13.5 3.5l3 3L8 15l-4 1Z"/></svg>',
    puntos: '<svg viewBox="0 0 20 20"><circle cx="5" cy="10" r="1.2"/><circle cx="10" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/></svg>',
    externo: '<svg viewBox="0 0 20 20"><path d="M11 4h5v5M16 4l-7 7M14 12v4H4V6h4"/></svg>',
    imprimir: '<svg viewBox="0 0 20 20"><path d="M6 7V3h8v4M6 14H4V8h12v6h-2M6 11h8v6H6z"/></svg>'
  };

  // ---------- avisos ----------
  A.toast = function (msg, mal) {
    const t = document.createElement('div');
    t.className = 'toast' + (mal ? ' mal' : '');
    t.textContent = msg;
    A.$('#toasts').appendChild(t);
    setTimeout(() => t.remove(), mal ? 5200 : 2800);
  };
  A.errorGuardar = function (err) {
    console.error(err);
    const permiso = err && /permission|insufficient/i.test(String(err.code || err.message));
    A.toast(permiso ? 'La base no dio permiso para guardar esto. Revisa Configuración → Respaldos y permisos.' : 'No se pudo guardar: ' + ((err && err.message) || 'revisa tu conexión'), true);
  };

  // ---------- ventana modal ----------
  let modalResolver = null;
  A.modal = function (opc) {
    const caja = A.$('#modal-caja');
    caja.className = 'modal-caja' + (opc.ancho ? ' ancho' : '');
    caja.innerHTML =
      '<div class="modal-cab"><h2>' + A.h(opc.titulo || '') + '</h2><button class="icono-btn" data-cerrar-modal aria-label="Cerrar"><svg viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div>' +
      '<div class="modal-c">' + (opc.html || '') + '</div>' +
      ((opc.botones || []).length ? '<div class="modal-pie">' + opc.botones.map((b, i) =>
        '<button class="btn ' + (b.clase || '') + '" data-boton="' + i + '">' + A.h(b.texto) + '</button>').join('') + '</div>' : '');
    A.$('#modal').hidden = false;
    const f = caja.querySelector('input,select,textarea') || caja.querySelector('[data-boton]:last-child');
    if (f) setTimeout(() => f.focus(), 30);
    return new Promise((res) => {
      modalResolver = res;
      caja.querySelectorAll('[data-boton]').forEach(b => b.addEventListener('click', async () => {
        const btn = opc.botones[+b.dataset.boton];
        if (btn.accion) {
          b.disabled = true;
          let r;
          try { r = await btn.accion(caja); } catch (e) { console.error(e); r = false; }
          b.disabled = false;
          if (r === false) return;            // la acción pide no cerrar
          A.cerrarModal(r === undefined ? btn.valor : r);
        } else A.cerrarModal(btn.valor);
      }));
      if (opc.alAbrir) opc.alAbrir(caja);
    });
  };
  A.cerrarModal = function (valor) {
    A.$('#modal').hidden = true;
    A.$('#modal-caja').innerHTML = '';
    const r = modalResolver; modalResolver = null;
    if (r) r(valor);
  };
  document.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar-modal]')) A.cerrarModal(undefined); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !A.$('#modal').hidden) A.cerrarModal(undefined); });

  A.confirmar = function (texto, opc) {
    opc = opc || {};
    return A.modal({
      titulo: opc.titulo || '¿Confirmas?',
      html: '<p style="margin:0;white-space:pre-line">' + A.h(texto) + '</p>',
      botones: [{ texto: opc.no || 'Cancelar', valor: false }, { texto: opc.si || 'Aceptar', clase: opc.peligro ? 'btn-peligro-solido' : 'btn-primario', valor: true }]
    }).then(v => v === true);
  };
  A.avisar = function (texto, titulo) {
    return A.modal({ titulo: titulo || 'Aviso', html: '<p style="margin:0;white-space:pre-line">' + A.h(texto) + '</p>', botones: [{ texto: 'Entendido', clase: 'btn-primario' }] });
  };

  // ---------- barra "Cambios no guardados" ----------
  let cambios = null;   // { guardar: fn, descartar: fn }
  A.marcarCambios = function (guardar, descartar) {
    cambios = { guardar: guardar, descartar: descartar };
    A.$('#barra-guardar').hidden = false;
  };
  A.limpiarCambios = function () { cambios = null; A.$('#barra-guardar').hidden = true; };
  A.hayCambios = () => !!cambios;
  A.$('#barra-guardar-btn').addEventListener('click', async () => {
    if (!cambios) return;
    const b = A.$('#barra-guardar-btn'); b.disabled = true; b.textContent = 'Guardando…';
    try { const ok = await cambios.guardar(); if (ok !== false) A.limpiarCambios(); }
    catch (e) { A.errorGuardar(e); }
    b.disabled = false; b.textContent = 'Guardar';
  });
  A.$('#barra-descartar').addEventListener('click', async () => {
    if (!cambios) return;
    if (!(await A.confirmar('Se perderán los cambios que no has guardado.', { titulo: '¿Descartar cambios?', si: 'Descartar', peligro: true }))) return;
    const d = cambios.descartar; A.limpiarCambios(); if (d) d();
  });
  window.addEventListener('beforeunload', (e) => { if (cambios) { e.preventDefault(); e.returnValue = ''; } });

  // ============================================================
  //  rutas
  // ============================================================
  const paginas = [];   // { patron:['pedidos', ':id'], fn, datos:[...] }
  let actual = null, hashAnterior = '';
  A.pagina = function (patron, fn, datos) {
    paginas.push({ patron: patron.split('/').filter(Boolean), fn: fn, datos: datos || [], nombre: patron });
  };
  function buscarPagina(partes) {
    let mejor = null;
    paginas.forEach(p => {
      if (p.patron.length !== partes.length) return;
      const params = {}; let fijos = 0;
      for (let i = 0; i < partes.length; i++) {
        if (p.patron[i].startsWith(':')) params[p.patron[i].slice(1)] = decodeURIComponent(partes[i]);
        else if (p.patron[i] === partes[i]) fijos++;
        else return;
      }
      if (!mejor || fijos > mejor.fijos) mejor = { p: p, params: params, fijos: fijos };
    });
    return mejor;
  }
  A.ir = function (ruta) { location.hash = '#/' + String(ruta || '').replace(/^#?\/?/, ''); };
  A.rutaActual = () => (actual ? actual.p.nombre : '');

  async function navegar() {
    const hash = location.hash || '#/';
    if (cambios && hash !== hashAnterior) {
      const salir = await A.confirmar('Tienes cambios sin guardar. Si sales, se pierden.', { titulo: '¿Salir sin guardar?', si: 'Salir sin guardar', peligro: true });
      if (!salir) { history.replaceState(null, '', hashAnterior || '#/'); return; }
      A.limpiarCambios();
    }
    hashAnterior = hash;
    const partes = hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
    const m = buscarPagina(partes) || buscarPagina(['inicio']);
    actual = m;
    document.body.classList.remove('en-editor');
    marcarMenu(partes);
    cerrarMenuMovil();
    window.scrollTo(0, 0);
    pintar();
  }
  function pintar() {
    if (!actual) return;
    const vista = A.$('#vista');
    try { actual.p.fn(vista, actual.params); }
    catch (e) { console.error(e); vista.innerHTML = '<div class="pag"><div class="tarjeta tarjeta-c"><b>Algo falló al mostrar esta página.</b><p class="ayuda">' + A.h(e.message) + '</p></div></div>'; }
  }
  /* Cuando llegan datos nuevos se vuelve a pintar la página, salvo que estés
     editando algo (para no borrarte lo que escribiste). */
  A.refrescar = function (tipo) {
    if (!actual || cambios) return;
    if (actual.p.datos.indexOf(tipo) === -1) return;
    const ae = document.activeElement;
    if (ae && ae.closest('#vista') && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && ae.type !== 'checkbox') return;
    if (A.$('#vista .no-refrescar')) return;
    const y = window.scrollY;
    pintar();
    window.scrollTo(0, y);
  };
  A.repintar = pintar;
  window.addEventListener('hashchange', navegar);

  function marcarMenu(partes) {
    const r = partes.join('/') || 'inicio';
    let mejor = null;
    A.$$('.lateral .nav[data-ruta]').forEach(n => {
      const k = n.dataset.ruta;
      if ((r === k || r.indexOf(k + '/') === 0) && (!mejor || k.length > mejor.dataset.ruta.length)) mejor = n;
    });
    if (r.indexOf('config') === 0) mejor = A.$('.nav-config');
    A.$$('.lateral .nav').forEach(n => n.classList.toggle('activo', n === mejor));
    const raiz = (mejor && mejor.dataset.ruta || '').split('/')[0];
    const familia = { colecciones: 'productos', inventario: 'productos' }[raiz] || raiz;
    A.$$('.subnav').forEach(s => s.classList.toggle('abierto', s.dataset.de === familia));
    // dentro de una subsección, la principal no se ve "activa"
    if (mejor && mejor.classList.contains('sub')) {
      const padre = A.$('.lateral .nav[data-ruta="' + familia + '"]:not(.sub)');
      if (padre) padre.classList.add('activo');
    }
  }
  function cerrarMenuMovil() { A.$('#lateral').classList.remove('abierto'); A.$('#lateral-fondo').classList.remove('abierto'); }
  A.$('#btn-menu').addEventListener('click', () => { A.$('#lateral').classList.toggle('abierto'); A.$('#lateral-fondo').classList.toggle('abierto'); });
  A.$('#lateral-fondo').addEventListener('click', cerrarMenuMovil);

  // menú de la cuenta
  A.$('#cuenta-btn').addEventListener('click', (e) => { e.stopPropagation(); A.$('#cuenta-menu').hidden = !A.$('#cuenta-menu').hidden; });
  document.addEventListener('click', (e) => { if (!e.target.closest('#cuenta')) A.$('#cuenta-menu').hidden = true; });
  A.$('#btn-salir').addEventListener('click', async () => {
    if (cambios && !(await A.confirmar('Tienes cambios sin guardar.', { si: 'Salir igual', peligro: true }))) return;
    A.limpiarCambios(); auth.signOut();
  });
  A.$('#btn-campana').addEventListener('click', () => A.ir('pedidos?estado=nuevo'));

  // ============================================================
  //  datos
  // ============================================================
  const escuchas = [];
  const emitir = (tipo) => { A.listo[tipo] = true; actualizarContadores(); A.refrescar(tipo); };

  function escuchar() {
    escuchas.push(A.ref.settings.onSnapshot(d => {
      A.settings = d.data() || {};
      kvSetDescuento(A.settings);
      emitir('settings');
    }, e => console.error('settings', e)));
    escuchas.push(A.ref.pedidos.onSnapshot(s => {
      A.pedidos = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      emitir('pedidos');
    }, e => console.error('pedidos', e)));
    escuchas.push(A.ref.visitas.orderBy('ultima', 'desc').limit(1500).onSnapshot(s => {
      A.visitas = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      emitir('visitas');
    }, e => console.error('visitas', e)));
    escuchas.push(A.ref.suscritos.orderBy('fecha', 'desc').limit(2000).onSnapshot(s => {
      A.suscritos = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      emitir('suscritos');
    }, e => console.error('suscritos', e)));
    escuchas.push(A.ref.web.onSnapshot(d => {
      A.web = d.exists ? d.data() : {};
      A.webError = '';
      emitir('web');
    }, e => {
      console.warn('catalog/web', e);
      A.web = {};
      A.webError = /permission/i.test(e.code || e.message) ? 'permiso' : 'error';
      emitir('web');
    }));
    A.cargarProductos();
    A.cargarTemaPublicado();
  }
  function dejarDeEscuchar() { while (escuchas.length) { try { escuchas.pop()(); } catch (e) {} } }

  // ---------- productos (sin la foto, que pesa mucho; la foto va aparte) ----------
  A.fsValor = function fsValor(v) {
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
  };
  const CAMPOS_PROD = ['code', 'name', 'price', 'priceOffer', 'stock', 'cantidad', 'detail', 'category', 'order', 'foco', 'focoMovil'];
  let cargandoProd = null;
  A.cargarProductos = function () {
    if (cargandoProd) return cargandoProd;
    cargandoProd = (async () => {
      const lista = []; let token = '';
      const mask = CAMPOS_PROD.map(c => 'mask.fieldPaths=' + c).join('&');
      do {
        const r = await fetch(REST + '/catalog/products/items?pageSize=300&' + mask + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        (d.documents || []).forEach(doc => {
          const p = { id: doc.name.split('/').pop(), creado: doc.createTime, actualizado: doc.updateTime };
          const f = doc.fields || {};
          CAMPOS_PROD.forEach(c => { if (c in f) p[c] = A.fsValor(f[c]); });
          lista.push(p);
        });
        token = d.nextPageToken || '';
      } while (token);
      lista.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      A.productos = lista;
      A.productosHora = Date.now();
      emitir('productos');
      return lista;
    })().catch(e => { console.error('productos', e); A.toast('No se pudieron leer los productos. Revisa tu conexión.', true); }).finally(() => { cargandoProd = null; });
    return cargandoProd;
  };
  A.productoLocal = function (id, cambiosProd) {
    const p = A.productos.find(x => x.id === id);
    if (p) Object.assign(p, cambiosProd, { actualizado: new Date().toISOString() });
    emitir('productos');
  };

  /* Fotos: primero la miniatura que publica la web (liviana). Si el producto es
     nuevo o cambió después de la última publicación, se baja su foto de la base. */
  const fotos = {};          // id -> url
  const pidiendo = {};
  let mapaWeb = null;
  fetch('/productos.json', { cache: 'no-cache' }).then(r => r.json()).then(d => {
    mapaWeb = {};
    (d.productos || []).forEach(p => { mapaWeb[p.id] = p.img; });
    A.generadoWeb = d.generado || '';
    A.refrescar('productos');
  }).catch(() => { mapaWeb = {}; });
  A.foto = function (p) {
    if (!p) return '';
    if (fotos[p.id]) return fotos[p.id];
    if (mapaWeb && mapaWeb[p.id] && !A.fotoCambiada[p.id]) return mapaWeb[p.id];
    if (mapaWeb && !pidiendo[p.id]) {
      pidiendo[p.id] = true;
      fetch(REST + '/catalog/products/items/' + p.id + '?mask.fieldPaths=photo').then(r => r.json()).then(d => {
        const v = A.fsValor((d.fields || {}).photo) || '';
        fotos[p.id] = !v ? '' : (/^data:|^https?:/.test(v) ? v : CATALOGO_ANTIGUO + v.replace(/^\//, ''));
        A.$$('img[data-foto="' + p.id + '"]').forEach(img => { img.src = fotos[p.id] || A.SIN_FOTO; });
      }).catch(() => {});
    }
    return '';
  };
  A.fotoCambiada = {};
  A.ponerFoto = function (id, url) { fotos[id] = url; A.fotoCambiada[id] = true; };
  A.SIN_FOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#F4EEF6"/><path d="M13 27l5-6 4 4 3-3 4 5z" fill="#CFC4DF"/><circle cx="24" cy="15" r="2.5" fill="#CFC4DF"/></svg>');
  A.imgProd = function (p, clase) {
    const src = A.foto(p);
    return '<img class="miniatura ' + (clase || '') + '" data-foto="' + A.h(p.id) + '" src="' + A.h(src || A.SIN_FOTO) + '" alt="" loading="lazy">';
  };

  A.cargarTemaPublicado = function () {
    return fetch('/admin/tema-actual.json', { cache: 'no-cache' }).then(r => r.json()).then(d => {
      A.temaPublicado = d; emitir('web');
    }).catch(e => console.warn('tema-actual.json', e));
  };

  // ---------- conteos de la barra lateral ----------
  A.pedidoEsNuevo = (p) => (p.estado || 'nuevo') === 'nuevo' && !(p.medioPago === 'mercadopago' && /^(esperando-pago|sin-pago|rejected|cancelled)$/.test(p.pagoEstado || ''));
  function actualizarContadores() {
    const n = A.pedidos.filter(A.pedidoEsNuevo).length;
    const b = A.$('#nav-pedidos-n'); b.textContent = n; b.hidden = !n;
    const c = A.$('#campana-n'); c.textContent = n; c.hidden = !n;
    document.title = (n ? '(' + n + ') ' : '') + 'Administrador · Karivé Joyas';
  }

  // ---------- publicador (Apps Script: correos y Mercado Pago) ----------
  A.pubUrl = () => String(A.settings.igPubUrl || '').trim();
  A.pubClave = function () {
    try { const c = localStorage.getItem('kv_pub_clave'); if (c) return c.trim(); } catch (e) {}
    return String(A.settings.igPubClave || '').trim();
  };
  A.guardarPubClave = function (c) { try { localStorage.setItem('kv_pub_clave', String(c || '').trim()); } catch (e) {} };
  A.publicador = async function (cuerpo) {
    const url = A.pubUrl();
    if (!url) throw new Error('Falta la dirección del publicador (Configuración → Notificaciones).');
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) });
    return r.json();
  };

  // ---------- colecciones ----------
  A.colecciones = () => kvCategorias(A.settings);
  A.nombreCol = (id) => { const c = A.colecciones().find(x => x.id === id); return c ? c.nombre : 'Sin colección'; };

  /* Tamaño aproximado del documento de configuración. Firestore no deja guardar
     más de 1 MB por documento y ahí viven las fotos de las colecciones. */
  A.pesoSettings = function (extra) {
    const s = Object.assign({}, A.settings, extra || {});
    return new Blob([JSON.stringify(s)]).size;
  };

  // ---------- comprimir imágenes ----------
  A.comprimir = function (file, max, calidad) {
    return new Promise((res, rej) => {
      if (!file || !/^image\//.test(file.type)) return rej(new Error('El archivo no es una imagen'));
      kvCompressPhoto(file, res, max || 1600, calidad || 0.85);
    });
  };
  A.elegirArchivo = function (accept) {
    return new Promise((res) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept || 'image/*';
      inp.onchange = () => res(inp.files && inp.files[0]);
      inp.click();
    });
  };
  A.descargar = function (nombre, contenido, tipo) {
    const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  A.csv = function (filas) {
    return '﻿' + filas.map(f => f.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  };

  // ---------- piezas de interfaz ----------
  A.cab = function (titulo, opc) {
    opc = opc || {};
    return '<div class="pag-cab">' + (opc.volver ? '<a class="volver" href="#/' + opc.volver + '" aria-label="Volver">' + A.ic.volver + '</a>' : '') +
      '<h1>' + titulo + '</h1>' + (opc.acciones ? '<div class="acciones">' + opc.acciones + '</div>' : '') + '</div>';
  };
  A.interruptor = function (id, marcado, texto, extra) {
    return '<label class="interruptor"><input type="checkbox" id="' + id + '"' + (marcado ? ' checked' : '') + (extra || '') + '><span class="pista"></span><span>' + texto + '</span></label>';
  };
  A.vacio = function (ic, titulo, texto, boton) {
    return '<div class="vacio"><span class="ic">' + ic + '</span><h3>' + titulo + '</h3><p>' + (texto || '') + '</p>' + (boton || '') + '</div>';
  };
  A.cargandoHtml = '<div class="vacio"><div class="giro" style="margin:0 auto"></div></div>';
  A.query = function () {
    const q = (location.hash.split('?')[1] || '');
    const o = {}; q.split('&').forEach(par => { const [k, v] = par.split('='); if (k) o[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return o;
  };
  A.sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* Detecta cambios en los campos de un formulario y muestra la barra de
     guardar. `leer()` devuelve el estado actual; si vuelve a ser igual al
     inicial, la barra se esconde. */
  A.formulario = function (raiz, leer, guardar, descartar) {
    const inicial = JSON.stringify(leer());
    const revisar = () => {
      if (JSON.stringify(leer()) !== inicial) A.marcarCambios(guardar, descartar || (() => A.repintar()));
      else A.limpiarCambios();
    };
    raiz.addEventListener('input', revisar);
    raiz.addEventListener('change', revisar);
    return revisar;
  };

  // ============================================================
  //  buscador global (Ctrl+K)
  // ============================================================
  const buscador = A.$('#buscar-global'), res = A.$('#buscar-res');
  let selIdx = -1;
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); buscador.focus(); buscador.select(); }
  });
  buscador.addEventListener('input', buscarGlobal);
  buscador.addEventListener('focus', buscarGlobal);
  buscador.addEventListener('blur', () => setTimeout(() => { res.hidden = true; }, 180));
  buscador.addEventListener('keydown', (e) => {
    const items = A.$$('.buscar-item', res);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      selIdx = Math.max(0, Math.min(items.length - 1, selIdx + (e.key === 'ArrowDown' ? 1 : -1)));
      items.forEach((it, i) => it.classList.toggle('sel', i === selIdx));
    } else if (e.key === 'Enter' && items.length) {
      (items[selIdx] || items[0]).click(); buscador.blur();
    } else if (e.key === 'Escape') buscador.blur();
  });
  function buscarGlobal() {
    const q = A.sinTildes(buscador.value.trim());
    selIdx = -1;
    if (!q) {
      res.innerHTML = '<div class="buscar-grupo">Ir a</div>' + [['pedidos', 'Pedidos'], ['productos', 'Productos'], ['tienda', 'Tienda online · Temas'], ['tienda/editor', 'Personalizar la web'], ['config/pagos', 'Configuración · Pagos']]
        .map(x => '<a class="buscar-item" href="#/' + x[0] + '">' + x[1] + '</a>').join('');
      res.hidden = false; return;
    }
    const prods = A.productos.filter(p => A.sinTildes((p.name || '') + ' ' + (p.code || '')).indexOf(q) !== -1).slice(0, 6);
    const peds = A.pedidos.filter(p => A.sinTildes('#' + (p.num || '') + ' ' + ((p.cliente || {}).nombre || '') + ' ' + ((p.cliente || {}).correo || '')).indexOf(q) !== -1)
      .sort((a, b) => (b.num || 0) - (a.num || 0)).slice(0, 5);
    const secciones = [['Inicio', ''], ['Pedidos', 'pedidos'], ['Carritos abandonados', 'pedidos/pendientes'], ['Productos', 'productos'], ['Colecciones', 'colecciones'], ['Inventario', 'inventario'],
      ['Clientes', 'clientes'], ['Suscriptores', 'clientes/suscriptores'], ['Descuentos y cupones', 'descuentos'], ['Páginas', 'contenido/paginas'], ['Archivos', 'contenido/archivos'],
      ['Opiniones', 'contenido/opiniones'], ['Informes', 'informes'], ['Vista en tiempo real', 'informes/vivo'], ['Temas', 'tienda'], ['Personalizar tema', 'tienda/editor'],
      ['Navegación (menús)', 'tienda/navegacion'], ['Preferencias (SEO)', 'tienda/preferencias'], ['Apps: Mercado Libre, Instagram', 'apps'], ['Configuración general', 'config/general'],
      ['Pagos y Mercado Pago', 'config/pagos'], ['Transferencia bancaria', 'config/pagos'], ['Envíos', 'config/envios'], ['Notificaciones y correos', 'config/notificaciones'],
      ['Dominios', 'config/dominios'], ['Respaldos y copias', 'config/respaldos']]
      .filter(s => A.sinTildes(s[0]).indexOf(q) !== -1).slice(0, 5);
    let h = '';
    if (secciones.length) h += '<div class="buscar-grupo">Secciones</div>' + secciones.map(s => '<a class="buscar-item" href="#/' + s[1] + '">' + A.h(s[0]) + '</a>').join('');
    if (prods.length) h += '<div class="buscar-grupo">Productos</div>' + prods.map(p => '<a class="buscar-item" href="#/productos/' + p.id + '">' + A.imgProd(p) + '<span>' + A.h(p.name) + '</span><small>' + A.h(p.code || '') + '</small></a>').join('');
    if (peds.length) h += '<div class="buscar-grupo">Pedidos</div>' + peds.map(p => '<a class="buscar-item" href="#/pedidos/' + p.id + '"><b>#' + A.h(p.num || '—') + '</b><span>' + A.h((p.cliente || {}).nombre || '') + '</span><small>' + A.clp(p.total) + '</small></a>').join('');
    res.innerHTML = h || '<div class="buscar-grupo">Sin resultados</div>';
    res.hidden = false;
  }

  // ============================================================
  //  ingreso
  // ============================================================
  A.$('#ingreso-form').addEventListener('submit', (e) => {
    e.preventDefault();
    A.$('#ingreso-error').hidden = true;
    auth.signInWithEmailAndPassword(ADMIN_EMAIL, A.$('#ingreso-clave').value)
      .then(() => { A.$('#ingreso-clave').value = ''; })
      .catch(() => { A.$('#ingreso-error').hidden = false; });
  });

  A.arrancar = function () {
    auth.onAuthStateChanged((user) => {
      A.$('#cargando').hidden = true;
      if (user) {
        A.$('#ingreso').hidden = true;
        A.$('#app').hidden = false;
        A.$('#cuenta-correo').textContent = user.email || '';
        if (!escuchas.length) escuchar();
        navegar();
        if (A.respaldoAutomatico) setTimeout(A.respaldoAutomatico, 8000);
      } else {
        dejarDeEscuchar();
        A.$('#app').hidden = true;
        A.$('#ingreso').hidden = false;
        setTimeout(() => A.$('#ingreso-clave').focus(), 50);
      }
    });
  };
})();
