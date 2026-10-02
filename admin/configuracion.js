/* Panel · Configuración: general, pagos, envíos, notificaciones, dominios y
   respaldos (copias de seguridad de la web, la configuración y los productos). */
(function () {
  'use strict';
  const h = A.h;

  // Los costos de envío se pueden cambiar desde aquí (la web nueva los usa).
  const ENVIO_DEF = { rm: 2990, regiones: 3990 };
  A.tarifas = () => Object.assign({}, ENVIO_DEF, A.settings.envioTarifas || {});
  window.kvEnvioCosto = function (region) { const t = A.tarifas(); return region === KV_REGION_RM ? Number(t.rm) : Number(t.regiones); };

  const SECCIONES = [
    ['general', 'General', '<svg viewBox="0 0 20 20"><path d="M3 8.5 4.2 4h11.6L17 8.5M3 8.5h14M3 8.5V16h14V8.5"/></svg>'],
    ['pagos', 'Pagos', '<svg viewBox="0 0 20 20"><rect x="2.5" y="5" width="15" height="10" rx="1.5"/><path d="M2.5 8.5h15M5.5 12.5h3"/></svg>'],
    ['envios', 'Envío y entrega', '<svg viewBox="0 0 20 20"><path d="M2.5 5.5h9v8h-9zM11.5 8.5h3.5l2.5 2.5v2.5h-6"/><circle cx="6" cy="14.5" r="1.5"/><circle cx="14.5" cy="14.5" r="1.5"/></svg>'],
    ['notificaciones', 'Notificaciones', '<svg viewBox="0 0 20 20"><path d="M5 14V9a5 5 0 0 1 10 0v5l1.5 1.5h-13L5 14ZM8 17.5a2 2 0 0 0 4 0"/></svg>'],
    ['dominios', 'Dominios', '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15M10 2.5c2.2 2.4 2.2 12.6 0 15M10 2.5c-2.2 2.4-2.2 12.6 0 15"/></svg>'],
    ['respaldos', 'Respaldos y permisos', '<svg viewBox="0 0 20 20"><path d="M10 2.5 3.5 5v5c0 3.8 2.8 6.6 6.5 7.5 3.7-.9 6.5-3.7 6.5-7.5V5L10 2.5Z"/><path d="m7.5 10 1.8 1.8L13 8"/></svg>']
  ];
  function marco(sec, contenido) {
    return '<div class="config"><nav class="config-menu"><div class="tienda"><img src="/assets/logo-avatar.png" width="34" height="34" alt="" style="border-radius:8px"><div><b>Karivé Joyas</b><small>' + h(location.host) + '</small></div></div>' +
      SECCIONES.map(s => '<a href="#/config/' + s[0] + '" class="' + (s[0] === sec ? 'activo' : '') + '">' + s[2] + s[1] + '</a>').join('') + '</nav><div>' + contenido + '</div></div>';
  }
  A.pagina('config', () => A.ir('config/general'), []);
  A.pagina('config/:sec', function (vista, params) {
    const f = { general: general, pagos: pagos, envios: envios, notificaciones: notificaciones, dominios: dominios, respaldos: respaldos }[params.sec] || general;
    f(vista);
  }, ['settings', 'web']);

  /* Arma una tarjeta con campos y la barra de guardar. */
  function formulario(vista, leer, guardar) {
    const raiz = A.$('.config > div', vista);
    raiz.classList.add('no-refrescar');
    const ini = JSON.stringify(leer());
    const revisar = () => {
      if (JSON.stringify(leer()) !== ini) A.marcarCambios(async () => { try { const r = await guardar(leer()); if (r === false) return false; A.toast('Guardado ✓'); setTimeout(A.repintar, 0); return true; } catch (e) { A.errorGuardar(e); return false; } }, () => { A.limpiarCambios(); A.repintar(); });
      else A.limpiarCambios();
    };
    raiz.addEventListener('input', revisar); raiz.addEventListener('change', revisar);
  }

  // ---------- general ----------
  function general(vista) {
    const s = A.settings, g = (A.web || {}).general || {};
    vista.innerHTML = marco('general', A.cab('General') +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Datos de la tienda</h2></div><div class="tarjeta-c">' +
        '<label class="campo"><span>Correo de contacto</span><input id="cg-correo" type="email" value="' + h(g.correo || (A.temaPublicado || {}).correo || 'karive.joyas@gmail.com') + '"><small>Aparece en la página de Contacto de la web nueva.</small></label>' +
      '</div></div>' +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>WhatsApp y redes sociales</h2></div><div class="tarjeta-c">' +
        '<p class="ayuda">Se usan en la web nueva y en el catálogo antiguo.</p>' +
        '<label class="campo"><span>WhatsApp</span><input id="cg-wa" type="tel" value="' + h(s.whatsapp || '') + '" placeholder="+56 9 1234 5678"></label>' +
        '<label class="campo"><span>Mensaje que se escribe solo al abrir WhatsApp</span><textarea id="cg-wamsg" rows="2">' + h(s.whatsappMsg != null ? s.whatsappMsg : KV_WHATSAPP_MSG_DEFAULT) + '</textarea></label>' +
        '<div class="fila-campos"><label class="campo"><span>Instagram</span><input id="cg-ig" value="' + h(s.instagram || '') + '" placeholder="@karive.joyas"></label>' +
        '<label class="campo"><span>Facebook</span><input id="cg-fb" value="' + h(s.facebook || '') + '" placeholder="https://facebook.com/…"></label></div>' +
      '</div></div>');
    const $ = (id) => A.$('#' + id, vista).value.trim();
    formulario(vista, () => ({ correo: $('cg-correo'), wa: $('cg-wa'), msg: $('cg-wamsg'), ig: $('cg-ig'), fb: $('cg-fb') }), async (v) => {
      if (v.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.correo)) { A.avisar('Revisa el correo: no parece válido.'); return false; }
      const digitos = v.wa.replace(/[^0-9]/g, '');
      if (v.wa && digitos.length < 9) { A.avisar('Revisa el número de WhatsApp: le faltan dígitos.'); return false; }
      await A.ref.settings.set({ whatsapp: v.wa, whatsappMsg: v.msg, instagram: v.ig, facebook: v.fb }, { merge: true });
      if (v.correo !== (((A.web || {}).general || {}).correo || '')) await A.ref.web.set({ general: { correo: v.correo } }, { merge: true });
    });
  }

  // ---------- pagos ----------
  function pagos(vista) {
    const mp = kvMercadoPago(A.settings), tr = kvTransferencia(A.settings);
    const campo = (id, etq, v, ph) => '<label class="campo"><span>' + etq + '</span><input id="' + id + '" value="' + h(v || '') + '" placeholder="' + h(ph || '') + '"></label>';
    vista.innerHTML = marco('pagos', A.cab('Pagos') +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>💳 Mercado Pago (tarjetas de débito y crédito)</h2>' + (mp.activo ? '<span class="ins verde">Activo</span>' : '<span class="ins">Desactivado</span>') + '</div><div class="tarjeta-c">' +
        '<p class="ayuda">Las clientas pagan con tarjeta en la página de Mercado Pago y vuelven a la tienda. La clave de Mercado Pago (Access Token) vive en el script de Google, no aquí.</p>' +
        A.interruptor('cp-mp', mp.activo, 'Aceptar pagos con tarjeta') + A.interruptor('cp-prueba', mp.prueba, 'Modo de prueba (no cobra de verdad)') +
      '</div></div>' +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>🏦 Transferencia bancaria</h2><span class="ins verde">Activo</span></div><div class="tarjeta-c">' +
        '<p class="ayuda">Estos datos se muestran al elegir transferencia; la clienta adjunta el comprobante.</p>' +
        '<div class="fila-campos">' + campo('ct-titular', 'Titular', tr.titular) + campo('ct-rut', 'RUT', tr.rut) + '</div>' +
        '<div class="fila-campos">' + campo('ct-banco', 'Banco', tr.banco) + campo('ct-tipo', 'Tipo de cuenta', tr.tipo) + '</div>' +
        '<div class="fila-campos">' + campo('ct-numero', 'Número de cuenta', tr.numero) + campo('ct-correo', 'Correo para el comprobante', tr.correo) + '</div>' +
      '</div></div>');
    const $ = (id) => A.$('#' + id, vista);
    formulario(vista, () => ({ mp: $('cp-mp').checked, prueba: $('cp-prueba').checked, tr: ['titular', 'rut', 'banco', 'tipo', 'numero', 'correo'].reduce((o, k) => { o[k] = $('ct-' + k).value.trim(); return o; }, {}) }), async (v) => {
      if (v.mp && !mp.activo && !(await A.confirmar('¿Ya está pegado tu Access Token en el script de Google? Si no, el botón de tarjeta les dará error a tus clientas.', { si: 'Sí, activar' }))) return false;
      await A.ref.settings.set({ pagos: { mercadopago: { activo: v.mp, prueba: v.prueba } }, pedidos: Object.assign({}, A.settings.pedidos || {}, { transferencia: v.tr }) }, { merge: true });
    });
  }

  // ---------- envíos ----------
  function envios(vista) {
    const t = A.tarifas();
    vista.innerHTML = marco('envios', A.cab('Envío y entrega') +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Tarifas de envío</h2></div><div class="tarjeta-c">' +
        '<div class="fila-campos"><label class="campo"><span>Región Metropolitana</span><div class="campo-pre"><span>$</span><input id="ce-rm" inputmode="numeric" value="' + t.rm + '"></div></label>' +
        '<label class="campo"><span>Resto de Chile</span><div class="campo-pre"><span>$</span><input id="ce-reg" inputmode="numeric" value="' + t.regiones + '"></div></label></div>' +
        '<div class="nota info">Se cobran en la web nueva y se actualizan solos en los textos que dicen {envio_rm} y {envio_regiones}. El catálogo antiguo sigue cobrando $2.990 y $3.990 hasta que se haga el cambio de dominio.</div>' +
      '</div></div>' +
      '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:6px">Retiro en tienda</h2><p class="ayuda" style="margin:0">No disponible: la tienda es solo en línea y despacha desde Santiago.</p></div>');
    formulario(vista, () => ({ rm: A.num(A.$('#ce-rm', vista).value), regiones: A.num(A.$('#ce-reg', vista).value) }), async (v) => {
      if (!(v.rm > 0) || !(v.regiones > 0)) { A.avisar('Las dos tarifas deben ser mayores que cero.'); return false; }
      await A.ref.settings.set({ envioTarifas: v }, { merge: true });
    });
  }

  // ---------- notificaciones ----------
  function notificaciones(vista) {
    vista.innerHTML = marco('notificaciones', A.cab('Notificaciones') +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Correos automáticos</h2></div><div class="tarjeta-c">' +
        '<p class="ayuda">Los correos («recibimos tu pedido», «tu pedido va en camino», el regalo de bienvenida) y el pago con Mercado Pago pasan por tu script de Google (el «publicador»).</p>' +
        '<label class="campo"><span>Dirección del publicador</span><input id="cn-url" value="' + h(A.pubUrl()) + '" placeholder="https://script.google.com/macros/s/…/exec"></label>' +
        '<label class="campo"><span>Clave secreta en este dispositivo</span><input id="cn-clave" type="password" value="' + h(A.pubClave()) + '" autocomplete="off"><small>Es la misma del panel antiguo. Se guarda solo en este navegador (no en la base), así que hay que escribirla una vez en cada computador o celular.</small></label>' +
        (A.pubClave() ? '<div class="nota ok">✓ Este dispositivo tiene la clave guardada.</div>' : '<div class="nota">⚠ Sin la clave no salen los correos de envío ni se puede verificar Mercado Pago desde aquí.</div>') +
      '</div></div>');
    formulario(vista, () => ({ url: A.$('#cn-url', vista).value.trim(), clave: A.$('#cn-clave', vista).value.trim() }), async (v) => {
      if (v.url && !/^https:\/\/script\.google(usercontent)?\.com\//.test(v.url)) { A.avisar('La dirección debería empezar con https://script.google.com/'); return false; }
      A.guardarPubClave(v.clave);
      if (v.url !== A.pubUrl()) await A.ref.settings.set({ igPubUrl: v.url }, { merge: true });
    });
  }

  // ---------- dominios ----------
  function dominios(vista) {
    const fila = (d, est, nota) => '<div class="linea-item"><div class="t"><b>' + d + '</b><small>' + nota + '</small></div>' + est + '</div>';
    vista.innerHTML = marco('dominios', A.cab('Dominios') +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Tus dominios</h2></div><div class="tarjeta-c">' +
        fila(h(location.host), '<span class="ins verde">Conectado</span>', 'Dirección donde estás viendo la web nueva ahora.') +
        fila('karivejoyas.cl', '<span class="ins ambar">Pendiente</span>', 'Se conecta cuando apruebes la web nueva. El catálogo antiguo sigue funcionando hasta entonces.') +
        fila('karivejoyas.github.io/catalogo', '<span class="ins">Catálogo antiguo</span>', 'Al cambiar de dominio, sus páginas mandarán a las de karivejoyas.cl para no perder Google.') +
      '</div></div>' +
      '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:6px">¿Cómo funciona?</h2><p class="ayuda" style="margin:0">El dominio está en Cloudflare y la web se publica gratis con GitHub Pages. El paso a karivejoyas.cl lo hacemos juntos cuando des el visto bueno: se cambia en GitHub y Cloudflare, y luego Merchant Center y Search Console.</p></div>');
  }

  // ============================================================
  //  respaldos y permisos
  // ============================================================
  const PESADOS = ['fondoInfo', 'fondoProd', 'igPubClave'];
  const CAMPOS_PROD = ['name', 'detail', 'price', 'priceOffer', 'code', 'category', 'stock', 'cantidad', 'order'];
  function settingsLiviano() {
    const s = A.copia(A.settings) || {};
    PESADOS.forEach(k => delete s[k]);
    if (Array.isArray(s.categorias)) s.categorias = s.categorias.map(c => Object.assign({}, c, { imagen: /^data:/.test(c.imagen || '') ? '' : c.imagen }));
    if (s.masVistos && /^data:/.test(s.masVistos.imagen || '')) s.masVistos.imagen = '';
    return s;
  }
  function productosLivianos() {
    return A.productos.map(p => { const o = { id: p.id }; CAMPOS_PROD.forEach(k => { if (p[k] !== undefined) o[k] = p[k]; }); return o; });
  }
  async function crearRespaldo(automatico) {
    if (!A.productos.length) await A.cargarProductos();
    if (A.productos.length < 20) throw new Error('llegaron muy pocos productos; no se hizo el respaldo para no guardar algo incompleto');
    const r = { fecha: new Date().toISOString(), automatico: !!automatico, tema: A.temaVigente(), nombreTema: A.nombreTemaVivo(), settings: settingsLiviano(), productos: productosLivianos() };
    const ref = await A.ref.respaldos.add(r);
    return ref.id;
  }
  /* Una vez al día, al entrar al panel, se guarda un respaldo automático
     (sin fotos, liviano). Se guardan los últimos 30. */
  A.respaldoAutomatico = async function () {
    try {
      const s = await A.ref.respaldos.orderBy('fecha', 'desc').limit(40).get();
      const lista = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      const ultimo = lista[0];
      if (ultimo && Date.now() - new Date(ultimo.fecha).getTime() < 22 * 3600 * 1000) return;
      await A.cargarProductos();
      await crearRespaldo(true);
      lista.filter(x => x.automatico).slice(29).forEach(x => A.ref.respaldos.doc(x.id).delete().catch(() => {}));
    } catch (e) { console.warn('respaldo automático:', e.message || e); }
  };

  const REGLAS = "    match /catalog/web {\n      allow read: if true;\n      allow write: if request.auth != null && request.auth.token.email == 'karive.joyas@gmail.com';\n    }\n" +
    "    match /catalog/web/medios/{id} {\n      allow read: if true;\n      allow write: if request.auth != null && request.auth.token.email == 'karive.joyas@gmail.com';\n    }\n" +
    "    match /catalog/web/temas/{id} {\n      allow read, write: if request.auth != null && request.auth.token.email == 'karive.joyas@gmail.com';\n    }\n" +
    "    match /catalog/web/respaldos/{id} {\n      allow read, write: if request.auth != null && request.auth.token.email == 'karive.joyas@gmail.com';\n    }";

  function respaldos(vista) {
    const ok = A.webError !== 'permiso';
    vista.innerHTML = marco('respaldos', A.cab('Respaldos y permisos') +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Permiso para guardar la web</h2>' + (ok ? '<span class="ins verde">Activo</span>' : '<span class="ins rojo">Falta activarlo</span>') + '</div><div class="tarjeta-c">' +
        (ok ? '<p class="ayuda" style="margin:0">Todo bien: el panel puede guardar los textos, imágenes, temas y respaldos de la web.</p>' :
        '<p>Para que el panel pueda guardar la web, hay que agregar unas líneas en las reglas de seguridad de Firebase. <b>No cambia nada de lo que ya existe</b>: solo da permiso a la parte nueva (la web). Los pedidos siguen privados.</p>' +
        '<ol style="padding-left:20px;margin:0 0 12px"><li>Entra a <a href="https://console.firebase.google.com/project/karive-catalogo/firestore/rules" target="_blank" rel="noopener">Firebase → Firestore → Reglas</a> con la cuenta de Karivé.</li>' +
        '<li>Busca la línea <code>match /databases/{database}/documents {</code></li>' +
        '<li>Justo debajo de esa línea, pega esto (botón «Copiar»):</li></ol>' +
        '<pre style="background:#2A123E;color:#F6EEFB;border-radius:10px;padding:12px;overflow:auto;font-size:12px;margin:0 0 8px">' + h(REGLAS) + '</pre>' +
        '<button class="btn" id="cr-copiar">' + A.ic.copiar + ' Copiar</button>' +
        '<ol start="4" style="padding-left:20px;margin:12px 0 0"><li>Aprieta <b>Publicar</b> y vuelve a cargar esta página.</li></ol>') +
      '</div></div>' +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Respaldos</h2><div class="acciones"><button class="btn btn-primario btn-chico" id="cr-crear"' + (ok ? '' : ' disabled') + '>Crear respaldo ahora</button></div></div>' +
        '<p class="ayuda" style="padding:6px 16px 0">Cada respaldo guarda los textos y diseño de la web, la configuración (cupones, colecciones, pagos…) y los datos de todos los productos (nombre, precio, stock, código), sin las fotos. Se hace uno automático cada día.</p>' +
        '<div id="cr-lista">' + (ok ? A.cargandoHtml : '') + '</div></div>' +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Respaldo completo en tu computador</h2></div><div class="tarjeta-c">' +
        '<p class="ayuda">Descarga un archivo con TODO, incluidas las fotos de los productos y las imágenes de la web. Guárdalo en tu computador o en Drive. Puede pesar varios MB.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="cr-descargar">' + A.ic.descargar + ' Descargar respaldo completo</button><button class="btn" id="cr-subir">' + A.ic.subir + ' Restaurar desde un archivo</button></div>' +
      '</div></div>');

    if (A.$('#cr-copiar', vista)) A.$('#cr-copiar', vista).addEventListener('click', async () => { try { await navigator.clipboard.writeText(REGLAS); A.toast('Reglas copiadas'); } catch (e) { window.prompt('Copia las reglas:', REGLAS); } });
    A.$('#cr-crear', vista).addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = 'Creando…';
      try { await crearRespaldo(false); A.toast('Respaldo creado ✓'); pintarLista(); } catch (err) { A.errorGuardar(err); }
      e.target.disabled = false; e.target.textContent = 'Crear respaldo ahora';
    });
    A.$('#cr-descargar', vista).addEventListener('click', async (e) => {
      const b = e.target; b.disabled = true; b.textContent = 'Juntando todo…';
      try {
        const [ps, ss] = await Promise.all([A.ref.items.get(), A.ref.settings.get()]);
        let medios = {}; try { medios = await A.cargarMedios(); } catch (x) {}
        const datos = { tipo: 'respaldo-karive', fecha: new Date().toISOString(), nombreTema: A.nombreTemaVivo(), tema: A.temaVigente(), settings: ss.data() || {},
          productos: ps.docs.map(d => Object.assign({ id: d.id }, d.data())), medios: medios };
        A.descargar('respaldo-karive-' + A.diaClave(Date.now()) + '.json', JSON.stringify(datos));
        A.toast('Respaldo descargado ✓');
      } catch (err) { A.errorGuardar(err); }
      b.disabled = false; b.innerHTML = A.ic.descargar + ' Descargar respaldo completo';
    });
    A.$('#cr-subir', vista).addEventListener('click', async () => {
      const f = await A.elegirArchivo('.json,application/json'); if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!d || (!d.productos && !d.tema && !d.settings)) throw new Error('El archivo no parece un respaldo de Karivé.');
        restaurar(d, 'el archivo «' + f.name + '»');
      } catch (e) { A.avisar('No se pudo leer el archivo: ' + e.message); }
    });

    let lista = [];
    async function pintarLista() {
      const caja = A.$('#cr-lista', vista); if (!caja || !ok) return;
      try {
        const s = await A.ref.respaldos.orderBy('fecha', 'desc').limit(40).get();
        lista = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      } catch (e) { caja.innerHTML = '<div class="tarjeta-c ayuda">No se pudieron leer los respaldos.</div>'; return; }
      caja.innerHTML = !lista.length ? '<div class="vacio" style="padding:22px">Todavía no hay respaldos. Crea el primero.</div>' :
        '<div class="tabla-env mt"><table class="tabla"><tbody>' + lista.map(r => '<tr><td><b>' + h(A.fecha(r.fecha)) + '</b><div class="tenue">' + (r.automatico ? 'Automático' : 'Hecho a mano') + ' · ' + (r.productos || []).length + ' productos · tema «' + h(r.nombreTema || '') + '»</div></td>' +
          '<td class="min"><button class="btn btn-chico" data-rest="' + r.id + '">Restaurar…</button> <button class="btn btn-chico" data-des="' + r.id + '" aria-label="Descargar">' + A.ic.descargar + '</button> <button class="btn btn-chico btn-plano" data-del="' + r.id + '" aria-label="Eliminar">' + A.ic.basura + '</button></td></tr>').join('') + '</tbody></table></div>';
      A.$$('[data-rest]', caja).forEach(b => b.addEventListener('click', () => { const r = lista.find(x => x.id === b.dataset.rest); restaurar(r, 'el respaldo del ' + A.fecha(r.fecha)); }));
      A.$$('[data-des]', caja).forEach(b => b.addEventListener('click', () => { const r = lista.find(x => x.id === b.dataset.des); A.descargar('respaldo-karive-' + A.diaClave(r.fecha) + '-sin-fotos.json', JSON.stringify(Object.assign({ tipo: 'respaldo-karive' }, r))); }));
      A.$$('[data-del]', caja).forEach(b => b.addEventListener('click', async () => {
        if (!(await A.confirmar('Se borra este respaldo.', { si: 'Eliminar', peligro: true }))) return;
        try { await A.ref.respaldos.doc(b.dataset.del).delete(); pintarLista(); } catch (e) { A.errorGuardar(e); }
      }));
    }
    pintarLista();
  }

  /* Restaurar: tú eliges qué partes. Los productos que no estaban en el
     respaldo NO se borran; solo se devuelven los datos de los que sí estaban. */
  async function restaurar(r, origen) {
    if (!A.productos.length) await A.cargarProductos();
    const cambiosProd = [], recrear = [];
    (r.productos || []).forEach(bp => {
      const p = A.productos.find(x => x.id === bp.id);
      if (!p) { recrear.push(bp); return; }
      const dif = {};
      CAMPOS_PROD.forEach(k => { if (bp[k] !== undefined && !A.igual(bp[k], p[k] === undefined ? null : p[k]) && !(bp[k] == null && p[k] == null)) dif[k] = bp[k]; });
      if (bp.photo && typeof bp.photo === 'string') dif._foto = bp.photo;
      if (Object.keys(dif).filter(k => k !== '_foto').length) cambiosProd.push([bp.id, dif, p, bp]);
    });
    const res = await A.modal({
      titulo: 'Restaurar desde ' + origen,
      html: '<p class="ayuda">Elige qué quieres recuperar. Antes de restaurar se crea un respaldo de cómo está todo ahora, por si te arrepientes.</p>' +
        (r.tema ? '<label class="check" style="margin-bottom:8px"><input type="checkbox" id="rs-tema"> Textos, imágenes y diseño de la web (tema «' + h(r.nombreTema || '') + '»)</label>' : '') +
        (r.settings ? '<label class="check" style="margin-bottom:8px"><input type="checkbox" id="rs-conf"> Configuración: cupones, descuentos, colecciones, pagos, opiniones, WhatsApp</label>' : '') +
        (r.productos ? '<label class="check" style="margin-bottom:4px"><input type="checkbox" id="rs-prod"> Productos: ' + cambiosProd.length + ' cambian' + (recrear.length ? ' y ' + recrear.length + ' se vuelven a crear' : '') + '</label>' +
          (cambiosProd.length ? '<details style="margin:0 0 8px 24px"><summary class="ayuda">Ver qué cambia</summary><div style="max-height:200px;overflow:auto;font-size:12.5px">' + cambiosProd.map(([id, d, p]) => '<div>' + h(p.code + ' · ' + p.name) + ': ' + Object.keys(d).filter(k => k !== '_foto').map(k => h(k) + ' ' + h(JSON.stringify(p[k] === undefined ? null : p[k])) + ' → ' + h(JSON.stringify(d[k]))).join(', ') + '</div>').join('') + '</div></details>' : '') +
          '<p class="ayuda" style="margin:0 0 0 24px">Los productos creados después del respaldo no se tocan.' + (r.productos.some(x => x.photo) ? ' Las fotos se recuperan del archivo.' : ' Las fotos actuales se mantienen.') + '</p>' : ''),
      botones: [{ texto: 'Cancelar' }, { texto: 'Restaurar', clase: 'btn-peligro-solido', accion: (c) => ({ tema: !!(A.$('#rs-tema', c) || {}).checked, conf: !!(A.$('#rs-conf', c) || {}).checked, prod: !!(A.$('#rs-prod', c) || {}).checked }) }]
    });
    if (!res || !(res.tema || res.conf || res.prod)) return;
    try {
      await crearRespaldo(false).catch(e => { throw new Error('no se pudo respaldar lo actual antes de restaurar (' + e.message + ')'); });
      if (res.tema && r.tema) await A.guardarTemaVivo(A.mezclar(A.temaDefecto(), r.tema), r.nombreTema || undefined);
      if (res.conf && r.settings) {
        const s = A.copia(r.settings);
        PESADOS.forEach(k => delete s[k]);
        if (Array.isArray(s.categorias)) {   // las fotos de colecciones que no venían en el respaldo se mantienen
          const actuales = A.colecciones();
          s.categorias = s.categorias.map(c => { if (c.imagen) return c; const a = actuales.find(x => x.id === c.id); return Object.assign({}, c, { imagen: (a && a.imagen) || '' }); });
        }
        if (s.masVistos && !s.masVistos.imagen && A.settings.masVistos) s.masVistos.imagen = A.settings.masVistos.imagen || '';
        await A.ref.settings.set(s, { merge: true });
      }
      if (res.prod) {
        let lote = A.db.batch(), n = 0;
        const enviar = async () => { if (n) { await lote.commit(); lote = A.db.batch(); n = 0; } };
        for (const [id, d] of cambiosProd) {
          const datos = Object.assign({}, d); delete datos._foto;
          if (d._foto) datos.photo = d._foto;
          lote.update(A.ref.items.doc(id), datos); if (++n >= 20) await enviar();
        }
        for (const bp of recrear) {
          const datos = {}; CAMPOS_PROD.forEach(k => { if (bp[k] !== undefined) datos[k] = bp[k]; });
          datos.photo = bp.photo || null;
          if (!bp.photo) datos.stock = false;
          lote.set(A.ref.items.doc(bp.id), datos); if (++n >= 20) await enviar();
        }
        await enviar();
        if (r.medios) for (const id of Object.keys(r.medios)) await A.ref.medios.doc(id).set(r.medios[id]).catch(() => {});
        A.medios = null;
        await A.cargarProductos();
      }
      A.avisar('Listo. Lo elegido quedó como estaba en ' + origen + '. La web se actualiza en unos minutos.\n\nSi algo no te gustó, en la lista de respaldos está el que se creó justo antes de restaurar.', 'Restaurado ✓');
      A.repintar();
    } catch (e) { A.avisar('No se pudo terminar de restaurar: ' + e.message + '\n\nLo que alcanzó a restaurarse quedó guardado. Revisa y vuelve a intentar.', 'Error'); }
  }
})();
