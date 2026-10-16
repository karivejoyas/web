/* ============================================================
   Panel · Apps: Mercado Libre, Instagram y Facebook, Asistente IA.

   El código de las tres apps viene del panel antiguo (catalogo/admin.js)
   casi sin cambios, para que todo lo que ya publica siga funcionando igual.
   Su HTML vive en apps.html: se carga una vez, la primera vez que abres una
   app, y cada app se muestra dentro de la página del panel nuevo.

   Un "puente" les entrega lo que usaban en el panel antiguo:
   · products  → los productos CON foto (las apps la necesitan para armar
                 las imágenes de Instagram y los avisos de Mercado Libre);
   · settings  → la configuración del panel nuevo (A.settings), al día;
   · pubClave  → la clave del publicador de Configuración → Notificaciones.
   ⚠ Ninguna app cambia productos sola: solo lo que tú hagas en ellas
     (por ejemplo, el encuadre de la foto para Instagram).
   ============================================================ */
(function () {
  'use strict';
  const A = window.A;

  // ---------- puente con el panel nuevo ----------
  const paneles = {};            // instagram | mercadolibre | ia -> su bloque de HTML
  const $ = (id) => {
    const n = document.getElementById(id);
    if (n) return n;
    for (const k in paneles) { const m = paneles[k].querySelector('#' + CSS.escape(id)); if (m) return m; }
    return null;
  };
  let products = [];
  let settings = A.settings || {};
  const settingsRef = A.ref.settings;
  const itemsCol = A.ref.items;
  const guardado = (id) => { const n = $(id); if (!n) return; n.hidden = false; setTimeout(() => { n.hidden = true; }, 2000); };
  const activo = () => document.activeElement;
  function actualizar(id, campo, valor) {   // solo lo usa el encuadre de la foto de Instagram (acción tuya)
    itemsCol.doc(id).update({ [campo]: valor }).catch(err => console.error('Error guardando:', err));
  }
  // fotos guardadas como ruta del catálogo antiguo → dirección completa
  function conFoto(p) {
    const f = String(p.photo || '');
    if (f && !/^(data:|https?:)/i.test(f)) p.photo = A.CATALOGO_ANTIGUO + f.replace(/^\//, '');
    return p;
  }

  let apps = null;               // lo que exporta iniciar()
  let mlAlEntrar = () => {};

  /* ============================================================
     Código de las apps (del panel antiguo)
     ============================================================ */
  function iniciar() {
    // ---------- INSTAGRAM (kit de publicaciones) ----------
    $('adm-ig-guardar').addEventListener('click', () => {
      settingsRef.set({ igCaption: $('adm-ig-caption').value }, { merge: true })
        .then(() => guardado('adm-ig-ok')).catch(err => console.error(err));
    });
    $('adm-ig-reset').addEventListener('click', () => {
      $('adm-ig-caption').value = KV_IG_CAPTION_DEFAULT;
    });

    // selección de productos para publicar (persiste entre re-renders)
    /* Anota qué productos se publicaron en redes y cuándo, para que el resumen
       diario pueda avisar de los productos nuevos que todavía no se muestran.
       Solo se registra lo que se publica desde este panel. */
    function registrarEnRedes(prods, igOk, fbOk) {
      const ahora = new Date().toISOString();
      const redes = {};
      prods.forEach(p => {
        if (!p.code) return;
        redes[p.code] = { fecha: ahora, ig: !!igOk, fb: !!fbOk };
      });
      if (!Object.keys(redes).length) return;
      settingsRef.set({ redes: redes }, { merge: true }).catch(err => console.error('No se pudo registrar la publicación en redes:', err));
    }

    const igSel = new Set();
    function igActualizarBarra() {
      contarGrupos($('adm-ig-lista'), 'ig-sel');
      const n = igSel.size;
      $('adm-ig-selcount').textContent = n + (n === 1 ? ' producto seleccionado' : ' productos seleccionados') + (n > 1 ? ' → carrusel' : '');
      $('adm-ig-preview').disabled = n === 0;
      const des = $('adm-ig-deseleccionar'); if (des) des.hidden = n === 0;
    }
    const igDesBtn = $('adm-ig-deseleccionar');
    if (igDesBtn) igDesBtn.addEventListener('click', () => { igSel.clear(); renderIG(); });

    function renderIG() {
      const cont = $('adm-ig-lista'); if (!cont) return;
      const enStock = products.filter(kvEnStock);
      // limpiar selecciones de productos que ya no existen o quedaron sin stock
      [...igSel].forEach(id => { if (!enStock.some(p => p.id === id)) igSel.delete(id); });
      $('adm-ig-contador').textContent = enStock.length + ' productos con stock';
      const fila = p =>
        '<div class="ig-fila" data-id="' + p.id + '">' +
          '<label class="ig-check"><input type="checkbox" data-role="ig-sel" data-id="' + p.id + '"' + (igSel.has(p.id) ? ' checked' : '') + ' /><span></span></label>' +
          '<div class="ig-thumb"' + (p.photo ? ' style="background-image:url(\'' + p.photo + '\')"' : '') + '>' + (p.photo ? '' : '✦') + '</div>' +
          '<div class="ig-info">' +
            '<div class="ig-nombre">' + escapeHtml(p.name || '') + '</div>' +
            '<div class="ig-precio">' + formatCLP(kvPrecioOferta(p) || p.price) + (kvPrecioOferta(p) ? ' <span class="ig-of">Oferta</span>' : '') + '</div>' +
            '<div class="ig-codigo">' + escapeHtml(p.code || '') + '</div>' +
          '</div>' +
          '<div class="ig-acciones">' +
            '<button type="button" class="adm-btn-solido ig-btn" data-role="ig-img" data-id="' + p.id + '">⬇ Imagen</button>' +
            '<button type="button" class="adm-btn-borde ig-btn" data-role="ig-txt" data-id="' + p.id + '">📋 Texto</button>' +
          '</div>' +
        '</div>';
      const cats = kvCategorias(settings);
      const huer = enStock.filter(p => !cats.some(c => c.id === p.category));
      let html = '';
      cats.forEach(cat => {
        const items = enStock.filter(p => p.category === cat.id);
        if (items.length) html += grupoHtml('ig-grupo-' + cat.id, cat.nombre, items.length, items.map(fila).join(''));
      });
      if (huer.length) html += grupoHtml('ig-grupo-otros', 'Otros', huer.length, huer.map(fila).join(''));
      cont.innerHTML = html;
      conectarGrupos(cont);
      cont.querySelectorAll('[data-role="ig-img"]').forEach(n => n.addEventListener('click', e => descargarPostIG(e.currentTarget.dataset.id, e.currentTarget)));
      cont.querySelectorAll('[data-role="ig-txt"]').forEach(n => n.addEventListener('click', e => copiarCaptionIG(e.currentTarget.dataset.id, e.currentTarget)));
      cont.querySelectorAll('[data-role="ig-sel"]').forEach(n => n.addEventListener('change', e => {
        if (e.target.checked) igSel.add(e.target.dataset.id); else igSel.delete(e.target.dataset.id);
        igActualizarBarra(); renderIGTags();
      }));
      igActualizarBarra(); renderIGTags();
    }

    // ---------- hashtags (predefinidos + de colección + propios) ----------
    function igTagsTodos() {
      const extras = Array.isArray(settings.igTagsExtra) ? settings.igTagsExtra : [];
      const auto = kvTagsDeProductos(products.filter(p => igSel.has(p.id)), settings);
      const base = KV_IG_TAGS_BASE.concat(extras.filter(t => KV_IG_TAGS_BASE.indexOf(t) === -1));
      return { base: base, auto: auto.filter(t => base.map(b => b.toLowerCase()).indexOf(t.toLowerCase()) === -1) };
    }
    function igTagsActivos() {
      return kvTagsActivos(products.filter(p => igSel.has(p.id)), settings);
    }
    function renderIGTags() {
      const cont = $('adm-ig-tags'); if (!cont) return;
      const off = Array.isArray(settings.igTagsOff) ? settings.igTagsOff : [];
      const t = igTagsTodos();
      const chip = (tag, auto) =>
        '<button type="button" class="ig-tag' + (off.indexOf(tag) === -1 ? ' is-on' : '') + (auto ? ' is-auto' : '') + '" data-tag="' + escapeHtml(tag) + '">' +
          (auto ? '✦ ' : '') + escapeHtml(tag) + '</button>';
      cont.innerHTML = t.auto.map(x => chip(x, true)).join('') + t.base.map(x => chip(x, false)).join('');
      cont.querySelectorAll('.ig-tag').forEach(n => n.addEventListener('click', e => {
        const tag = e.currentTarget.dataset.tag;
        const cur = Array.isArray(settings.igTagsOff) ? settings.igTagsOff.slice() : [];
        const i = cur.indexOf(tag);
        if (i === -1) cur.push(tag); else cur.splice(i, 1);
        settings.igTagsOff = cur;                       // reflejo inmediato
        renderIGTags();
        settingsRef.set({ igTagsOff: cur }, { merge: true }).catch(err => console.error(err));
      }));
    }
    $('adm-ig-tag-add').addEventListener('click', () => {
      let t = $('adm-ig-tag-nuevo').value.trim().replace(/\s+/g, '');
      if (!t) return;
      if (t[0] !== '#') t = '#' + t;
      const cur = Array.isArray(settings.igTagsExtra) ? settings.igTagsExtra.slice() : [];
      if (cur.indexOf(t) === -1 && KV_IG_TAGS_BASE.indexOf(t) === -1) {
        cur.push(t);
        settings.igTagsExtra = cur;
        renderIGTags();
        settingsRef.set({ igTagsExtra: cur }, { merge: true }).catch(err => console.error(err));
      }
      $('adm-ig-tag-nuevo').value = '';
    });

    // ---------- vista previa + publicar ----------
    let igPreviewImgs = [];        // dataURLs, alineadas con igPreviewProds
    let igPreviewProds = [];       // productos que están en la vista previa
    const igFocoTimer = {};
    const igModal = $('ig-modal');
    function igEstado(msg) { $('ig-m-estado').textContent = msg || ''; }
    function cerrarIGModal() { igModal.hidden = true; igEstado(''); clearInterval(igProgTimer); const pr = $('ig-m-progreso'); if (pr) pr.hidden = true; }
    igModal.querySelectorAll('[data-role="ig-close"]').forEach(n => n.addEventListener('click', cerrarIGModal));

    function igSlider(label, role, id, min, max, val) {
      return '<label class="ed-slider"><span>' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="1" data-role="' + role + '" data-id="' + id + '" value="' + val + '" /></label>';
    }
    function igFocoDe(id) {
      const cont = $('ig-m-fotos');
      const gv = role => { const el = cont.querySelector('[data-role="' + role + '"][data-id="' + id + '"]'); return el ? parseInt(el.value, 10) : null; };
      return { x: gv('igfoco-x'), y: gv('igfoco-y'), zoom: gv('igfoco-zoom') };
    }
    // mueve/hace zoom en vivo mientras arrastra el slider (regenera esa sola foto)
    function igFocoInput(id) {
      const i = igPreviewProds.findIndex(p => p.id === id);
      if (i < 0) return;
      const f = igFocoDe(id);
      clearTimeout(igFocoTimer[id]);
      igFocoTimer[id] = setTimeout(async () => {
        igPreviewImgs[i] = await kvGenerarPostIG(igPreviewProds[i], settings, f);
        const img = $('ig-m-fotos').querySelector('.ig-m-foto[data-i="' + i + '"] img');
        if (img) img.src = igPreviewImgs[i];
      }, 80);
    }
    // al soltar el slider, guarda el encuadre para que se recuerde
    function igFocoGuardar(id) {
      const f = igFocoDe(id);
      actualizar(id, 'igFoco', f);
      const p = igPreviewProds.find(x => x.id === id); if (p) p.igFoco = f;
      const g = products.find(x => x.id === id); if (g) g.igFoco = f;
    }
    function igQuitarDePreview(id) {
      igSel.delete(id);
      const i = igPreviewProds.findIndex(p => p.id === id);
      if (i >= 0) { igPreviewProds.splice(i, 1); igPreviewImgs.splice(i, 1); }
      renderPreviewFotos();
      renderIG();  // sincroniza las casillas y la barra de la lista de atrás
    }
    function renderPreviewFotos() {
      const cont = $('ig-m-fotos');
      const n = igPreviewProds.length;
      if (!n) { cont.innerHTML = '<div class="ig-m-cargando">No quedan productos. Cierra y elige al menos uno.</div>'; $('ig-m-publicar').disabled = true; igEstado(''); return; }
      $('ig-m-publicar').disabled = false;
      cont.innerHTML = igPreviewProds.map((p, i) => {
        const f = kvFocoIG(p);
        return '<div class="ig-m-foto" data-i="' + i + '">' +
          '<div class="ig-m-foto-img">' +
            '<img src="' + (igPreviewImgs[i] || '') + '" alt="Foto ' + (i + 1) + '" />' +
            (n > 1 ? '<span class="ig-m-num">' + (i + 1) + '/' + n + '</span>' : '') +
            '<button type="button" class="ig-m-quitar" data-role="ig-quitar" data-id="' + p.id + '" title="Quitar de la publicación">✕</button>' +
          '</div>' +
          '<div class="ig-m-fnombre">' + escapeHtml(p.name || '') + '</div>' +
          '<div class="ig-m-controles">' +
            igSlider('Zoom', 'igfoco-zoom', p.id, 100, 260, f.zoom) +
            igSlider('Horizontal', 'igfoco-x', p.id, 0, 100, f.x) +
            igSlider('Vertical', 'igfoco-y', p.id, 0, 100, f.y) +
          '</div>' +
        '</div>';
      }).join('');
      cont.querySelectorAll('[data-role="ig-quitar"]').forEach(b => b.addEventListener('click', e => igQuitarDePreview(e.currentTarget.dataset.id)));
      cont.querySelectorAll('[data-role^="igfoco-"]').forEach(s => {
        s.addEventListener('input', e => igFocoInput(e.target.dataset.id));
        s.addEventListener('change', e => igFocoGuardar(e.target.dataset.id));
      });
      igEstado(n > 1 ? 'Se publicará como carrusel de ' + n + ' fotos. Ajusta el zoom y la posición de cada foto; el logo queda fijo.' : 'Ajusta el zoom y la posición con los controles de abajo; el logo queda fijo.');
    }

    $('adm-ig-preview').addEventListener('click', async () => {
      const prods = products.filter(p => igSel.has(p.id));
      if (!prods.length) return;
      if (prods.length > 10) { window.alert('Instagram permite máximo 10 fotos por publicación. Quita algunos productos.'); return; }
      igModal.hidden = false;
      $('ig-m-fotos').innerHTML = '<div class="ig-m-cargando">Generando imágenes… ⏳</div>';
      $('ig-m-caption').value = kvCaptionMulti(prods, settings, igTagsActivos());
      igPreviewProds = prods.slice();
      igPreviewImgs = [];
      try {
        for (let i = 0; i < igPreviewProds.length; i++) igPreviewImgs[i] = await kvGenerarPostIG(igPreviewProds[i], settings);
        renderPreviewFotos();
      } catch (err) {
        console.error(err);
        $('ig-m-fotos').innerHTML = '<div class="ig-m-cargando">⚠ No se pudieron generar las imágenes.</div>';
      }
    });

    // barra de progreso estimada (no hay progreso real: es una sola llamada al publicador)
    let igProgTimer = null;
    function igProgresoPintar(pct, etapa) {
      const f = $('ig-m-progreso-fill'); if (f) f.style.width = Math.round(pct) + '%';
      const p = $('ig-m-progreso-pct'); if (p) p.textContent = Math.round(pct) + '%';
      if (etapa) { const e = $('ig-m-progreso-etapa'); if (e) e.textContent = etapa; }
    }
    function igProgresoIniciar(nFotos, destino) {
      const conIG = destino !== 'fb', conFB = destino !== 'ig';
      const prog = $('ig-m-progreso'); if (prog) prog.hidden = false;
      igProgresoPintar(0, 'Preparando las imágenes…');
      const total = 9000 + nFotos * 7000;   // duración estimada en ms
      const t0 = Date.now();
      clearInterval(igProgTimer);
      igProgTimer = setInterval(() => {
        const t = Date.now() - t0;
        const p = 95 * (1 - Math.exp(-3 * t / total));   // sube y se acerca a 95% sin llegar
        let etapa = 'Preparando las imágenes…';
        if (p >= 12) etapa = conIG ? '📸 Publicando en Instagram…' : '📘 Publicando en Facebook…';
        if (p >= 55 && conIG && conFB) etapa = '📘 Publicando en Facebook…';
        if (p >= 85) etapa = '🔎 Verificando la publicación…';
        igProgresoPintar(p, etapa);
      }, 220);
    }
    function igProgresoFin(exito) {
      clearInterval(igProgTimer); igProgTimer = null;
      igProgresoPintar(100, exito ? '✅ ¡Listo!' : 'Terminado');
      setTimeout(() => { const pr = $('ig-m-progreso'); if (pr) pr.hidden = true; }, exito ? 1400 : 500);
    }

    // el texto del botón sigue a la opción elegida
    const IG_DEST_TXT = { ambas: '🚀 Publicar en Instagram y Facebook', ig: '🚀 Publicar solo en Instagram', fb: '🚀 Publicar solo en Facebook' };
    function igDestino() { return (document.querySelector('input[name="ig-m-dest"]:checked') || {}).value || 'ambas'; }
    document.querySelectorAll('input[name="ig-m-dest"]').forEach(r => r.addEventListener('change', () => {
      $('ig-m-publicar').textContent = IG_DEST_TXT[igDestino()];
    }));

    $('ig-m-publicar').addEventListener('click', async () => {
      const url = String(settings.igPubUrl || '').trim();
      const clave = pubClave();
      if (!url) { igEstado('⚠ Falta configurar la URL del publicador (sección "Conexión con el publicador", abajo).'); return; }
      if (!clave) { igEstado('⚠ Falta la clave secreta en este navegador: escríbela en "Conexión con el publicador" y guarda.'); return; }
      if (!igPreviewImgs.length) { igEstado('⚠ Primero genera la vista previa.'); return; }
      const destino = igDestino();
      const btn = $('ig-m-publicar');
      btn.disabled = true;
      igEstado('Publicando… no cierres esta ventana ⏳');
      igProgresoIniciar(igPreviewImgs.length, destino);
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // simple request: evita bloqueos CORS
          body: JSON.stringify({ clave: clave, destino: destino, caption: $('ig-m-caption').value, images: igPreviewImgs.map(u => u.split(',')[1]) })
        });
        const d = await r.json();
        if (d && d.ok) {
          igProgresoFin(true);
          const igOk = d.ig ? d.ig === 'ok' : destino !== 'fb';   // scripts antiguos no informan "ig"
          const fbOk = d.fb === 'ok';
          const donde = [igOk ? 'Instagram' : null, fbOk ? 'Facebook' : null].filter(Boolean).join(' y ');
          let msg = '✅ ¡Publicado en ' + (donde || 'tus redes') + '! Revisa tu perfil.';
          if (d.fb && ['ok', 'no configurado', 'omitido'].indexOf(d.fb) < 0) msg += ' ⚠ Facebook: ' + d.fb;
          igEstado(msg);
          registrarEnRedes(products.filter(p => igSel.has(p.id)), igOk, fbOk);
          igSel.clear(); renderIG();
        } else {
          igProgresoFin(false);
          igEstado('❌ ' + ((d && d.error) || 'Error desconocido al publicar.'));
        }
      } catch (err) {
        igProgresoFin(false);
        igEstado('❌ No se pudo contactar al publicador: ' + err.message);
      }
      btn.disabled = false;
    });

    // ---------- MERCADO LIBRE ----------
    // Publica productos del catálogo como avisos de Mercado Libre. El panel solo
    // arma y revisa los datos; quien habla con Mercado Libre es el publicador de
    // Google (Apps Script), que es donde viven los tokens.
    //
    // ⚠ Nada de esto toca los productos. El registro de lo ya publicado vive en
    // su propio documento (catalog/mercadolibre), no dentro de cada producto.
    const mlRef = kvDb.collection('catalog').doc('mercadolibre');
    let mlDatos = {};            // { items: { CODIGO: {itemId, permalink, fecha} } }
    const mlSel = new Set();
    let mlRevData = [];          // lo que quedó en la pantalla de revisión
    const ML_MAX_LOTE = 20;      // el publicador de Google se corta a los 6 minutos

    mlRef.onSnapshot(
      (doc) => { mlDatos = doc.data() || {}; renderML(); },
      (err) => console.warn('No se pudo leer el registro de Mercado Libre:', err)
    );

    function mlEstado(msg) { const n = $('adm-ml-estado'); if (n) n.textContent = msg || ''; }
    function mlEstadoLista(msg) { const n = $('adm-ml-estado-lista'); if (n) n.textContent = msg || ''; }
    function mlPublicados() { return kvMlPublicados(mlDatos); }
    /* ¿este producto ya está arriba? Se mira lo que Mercado Libre tiene AHORA,
       no solo mi registro. Confiar solo en el registro fue lo que dejó publicar
       duplicados: productos que ya estaban arriba salían como "faltantes". */
    function mlYaPublicado(p) {
      if (p.code && mlPublicados()[p.code]) return true;
      if (!mlPubsCache.length) return false;
      return mlPubsCache.some(pub => {
        if (pub.estado === 'closed') return false;
        const prod = mlProductoDeAviso(pub);
        return prod && prod.id === p.id;
      });
    }

    /* la foto tal como la necesita el publicador: las guardadas como archivo van
       por URL absoluta, las pegadas a mano van como base64 para que él las suba. */
    function mlFoto(p) {
      const f = String(p.photo || '');
      if (!f) return null;
      if (/^data:/i.test(f)) return { base64: f.split(',')[1] || '', tipo: (f.match(/^data:([^;]+)/) || [])[1] || 'image/jpeg' };
      try { return { url: new URL(f, location.href).href }; } catch (e) { return { url: f }; }
    }

    function mlActualizarBarra() {
      contarGrupos($('adm-ml-lista'), 'ml-sel');
      const n = mlSel.size;
      $('adm-ml-selcount').textContent = n + (n === 1 ? ' producto seleccionado' : ' productos seleccionados');
      $('adm-ml-revisar').disabled = n === 0;
      const des = $('adm-ml-deseleccionar'); if (des) des.hidden = n === 0;
    }

    function renderML() {
      const cont = $('adm-ml-lista'); if (!cont) return;
      const enStock = products.filter(kvEnStock);
      [...mlSel].forEach(id => { if (!enStock.some(p => p.id === id)) mlSel.delete(id); });

      const pubs = mlPublicados();
      const yaN = enStock.filter(mlYaPublicado).length;
      $('adm-ml-contador').textContent = enStock.length + ' productos con stock · ' + yaN + ' ya publicados';

      const fila = p => {
        const problemas = kvMlProblemas(p, settings);
        const ya = mlYaPublicado(p);
        const reg = ya ? pubs[p.code] : null;
        let etiqueta = '';
        if (ya) etiqueta = '<span class="ml-badge ml-badge-pub">✓ publicado</span>';
        else if (problemas.length) etiqueta = '<span class="ml-badge ml-badge-mal">' + escapeHtml(problemas[0]) + '</span>';
        const bloqueado = ya || problemas.length > 0;
        return '<div class="ig-fila' + (bloqueado ? ' ml-fila-mal' : '') + '" data-id="' + p.id + '">' +
          '<label class="ig-check"><input type="checkbox" data-role="ml-sel" data-id="' + p.id + '"' +
            (mlSel.has(p.id) ? ' checked' : '') + (bloqueado ? ' disabled' : '') + ' /><span></span></label>' +
          '<div class="ig-thumb"' + (p.photo ? ' style="background-image:url(\'' + p.photo + '\')"' : '') + '>' + (p.photo ? '' : '✦') + '</div>' +
          '<div class="ig-info">' +
            '<div class="ig-nombre">' + escapeHtml(p.name || '') + etiqueta + '</div>' +
            '<div class="ig-precio">' + formatCLP(kvMlPrecio(p, settings)) + '</div>' +
            '<div class="ig-codigo">' + escapeHtml(p.code || '') +
              (reg && reg.permalink ? ' · <a href="' + escapeHtml(reg.permalink) + '" target="_blank" rel="noopener">ver el aviso</a>' : '') +
            '</div>' +
          '</div>' +
        '</div>';
      };

      const cats = kvCategorias(settings);
      const huer = enStock.filter(p => !cats.some(c => c.id === p.category));
      let html = '';
      const grupo = (id, nombre, items) => {
        if (!items.length) return '';
        const libres = items.filter(p => !mlYaPublicado(p) && !kvMlProblemas(p, settings).length);
        const ya = items.filter(mlYaPublicado).length;
        return grupoHtml(id, nombre, items.length, items.map(fila).join(''),
          (libres.length ? '<div class="app-grupo-acc"><button type="button" class="adm-btn-borde" data-role="ml-todos" data-grupo="' + id + '">Marcar los ' + libres.length + ' que faltan</button></div>' : ''),
          ya ? ya + ' publicado' + (ya > 1 ? 's' : '') : '');
      };
      cats.forEach(cat => { html += grupo('ml-grupo-' + cat.id, cat.nombre, enStock.filter(p => p.category === cat.id)); });
      html += grupo('ml-grupo-otros', 'Otros', huer);

      cont.innerHTML = html;
      conectarGrupos(cont);
      mlActualizarBarra();
    }

    // marcar / desmarcar
    document.addEventListener('change', (e) => {
      const c = e.target.closest('input[data-role="ml-sel"]'); if (!c) return;
      if (c.checked) mlSel.add(c.dataset.id); else mlSel.delete(c.dataset.id);
      mlActualizarBarra();
    });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-role="ml-todos"]'); if (!b) return;
      const cont = document.getElementById(b.dataset.grupo); if (!cont) return;
      cont.querySelectorAll('input[data-role="ml-sel"]:not(:disabled)').forEach(c => { c.checked = true; mlSel.add(c.dataset.id); });
      mlActualizarBarra();
      mlActualizarBarra();
    });
    const mlDes = $('adm-ml-deseleccionar');
    if (mlDes) mlDes.addEventListener('click', () => { mlSel.clear(); renderML(); });
    const mlRef2 = $('adm-ml-refrescar');
    if (mlRef2) mlRef2.addEventListener('click', () => { renderML(); mlEstado(''); });

    // ---------- reconocer publicaciones hechas por fuera del panel ----------
    // Si publicaste antes con la planilla de carga masiva, el panel no sabe
    // cuáles ya están arriba y te dejaría subirlas de nuevo, duplicadas.
    $('adm-ml-sincronizar').addEventListener('click', async () => {
      const btn = $('adm-ml-sincronizar');
      btn.disabled = true;
      mlEstadoLista('Comparando tu catálogo con lo que ya tienes publicado…');
      try {
        const d = await mlPublicador({
          accion: 'ml-sincronizar',
          productos: products.filter(p => p.code).map(p => ({ codigo: p.code, nombre: p.name || '' }))
        });
        if (!d || !d.ok) { mlEstadoLista('❌ ' + ((d && d.error) || 'No se pudo.')); btn.disabled = false; return; }
        if (d.emparejados) {
          await mlRef.set({ items: Object.assign({}, mlPublicados(), d.items) }, { merge: true });
        }
        let msg = '✓ Reconocidos ' + d.emparejados + ' de ' + d.total + ' avisos que ya tenías en Mercado Libre. '
                + 'Esos quedan marcados y no se pueden volver a publicar.';
        if (d.porSku != null) msg += '\n\n' + d.porSku + ' se reconocieron por su código (exacto) y ' + d.porNombre + ' comparando el nombre (puede fallar).';
        if ((d.sinDueno || []).length) {
          msg += '\n\nNo pude emparejar ' + d.sinDueno.length + ' (revísalos por si están duplicados o ya no están en tu catálogo):\n'
               + d.sinDueno.map(t => '• ' + t).join('\n');
        }
        mlEstadoLista(msg);
        renderML();
      } catch (e) { mlEstadoLista('❌ ' + e.message); }
      btn.disabled = false;
    });

    // ---------- revisión ----------
    $('adm-ml-revisar').addEventListener('click', () => {
      const elegidos = products.filter(p => mlSel.has(p.id));
      if (!elegidos.length) return;
      mlRevData = elegidos.map(p => ({ prod: p, item: kvMlItem(p, settings) }));
      const cont = $('adm-ml-revision');
      cont.innerHTML = mlRevData.map((r, i) => {
        const it = r.item;
        return '<div class="ml-rev">' +
          '<div class="ml-rev-top">' +
            '<div class="ml-rev-thumb"' + (it.foto ? ' style="background-image:url(\'' + it.foto + '\')"' : '') + '></div>' +
            '<div class="ml-rev-campos">' +
              '<input class="adm-input ml-rev-titulo" data-role="ml-titulo" data-i="' + i + '" value="' + escapeHtml(it.titulo) + '" maxlength="' + KV_ML_TITULO_MAX + '" />' +
              '<div class="ml-rev-cuenta" data-role="ml-cuenta" data-i="' + i + '"><b>' + it.titulo.length + '</b> de ' + KV_ML_TITULO_MAX + ' caracteres</div>' +
            '</div>' +
          '</div>' +
          '<div class="ml-rev-datos">' +
            '<span>Precio <b>' + formatCLP(it.precio) + '</b>' +
              (r.prod.price && r.prod.price !== it.precio ? ' <span class="ml-rev-catalogo">(catálogo ' + formatCLP(r.prod.price) + ')</span>' : '') +
            '</span>' +
            '<label class="ml-rev-stock">Stock <input class="adm-input" type="number" min="1" step="1" data-role="ml-stock-rev" data-i="' + i + '" value="' + it.cantidad + '" /></label>' +
            '<span>Código <b>' + escapeHtml(it.codigo || '—') + '</b></span>' +
          '</div>' +
          '<details class="ml-rev-desc"><summary>Ver la descripción</summary><pre>' + escapeHtml(it.descripcion) + '</pre></details>' +
        '</div>';
      }).join('');
      $('ml-sec-revision').hidden = false;
      mlEstado(mlRevData.length > ML_MAX_LOTE
        ? 'Elegiste ' + mlRevData.length + '. Se van a publicar en tandas de ' + ML_MAX_LOTE + ', una tras otra, hasta terminar con todos.'
        : '');
      $('ml-sec-revision').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // editar el título en la revisión (solo para esta publicación)
    document.addEventListener('input', (e) => {
      const c = e.target.closest('input[data-role="ml-titulo"]'); if (!c) return;
      const i = +c.dataset.i;
      if (!mlRevData[i]) return;
      mlRevData[i].item.titulo = c.value;
      const n = document.querySelector('[data-role="ml-cuenta"][data-i="' + i + '"]');
      if (n) {
        n.innerHTML = '<b>' + c.value.length + '</b> de ' + KV_ML_TITULO_MAX + ' caracteres';
        n.classList.toggle('ml-pasado', c.value.length > KV_ML_TITULO_MAX);
      }
    });

    // ---------- variar las descripciones con IA ----------
    // Cada aviso lleva una descripción distinta pero con el mismo estándar:
    // Mercado Libre penaliza las publicaciones que repiten el mismo texto, y a
    // quien compra le da más confianza leer algo escrito para ese producto.
    //
    // Usa iaLlamar, la MISMA vía que el generador de Instagram: las claves viven
    // en este navegador. Antes iba por el publicador de Google, que guarda otras
    // claves aparte y estaban vacías o vencidas.
    const ML_IA_LOTE = 6;   // de a pocos: pedir 20 de una vez trunca la respuesta

    const ML_IA_SISTEMA =
      'Redactas las descripciones de Karivé Joyas, marca chilena de joyas artesanales hechas a mano, ' +
      'para publicaciones de Mercado Libre. Español de Chile, cercano pero sobrio.\n\n' +
      'CADA descripción DEBE decir: que son hechos a mano en Chile, el material, la medida si la hay, ' +
      'que al ser artesanales cada par puede variar un poco, que se envían en su empaque listos para regalo, ' +
      'y que se despacha desde Santiago a todo Chile.\n\n' +
      'PROHIBIDO: inventar materiales, medidas, piedras, colores o garantías que no estén en los datos; ' +
      'poner precios, teléfonos, correos, links ni otras tiendas; usar emojis; escribir en MAYÚSCULAS; ' +
      'repetir signos de exclamación.\n\n' +
      'FORMATO: entre 60 y 130 palabras, en 3 o 4 párrafos cortos separados por una línea en blanco. ' +
      'VARÍA la redacción entre un producto y otro: distinto comienzo, distinto orden. Que no parezcan copiadas.\n\n' +
      'Responde SOLO un JSON válido, sin explicaciones y sin comillas de bloque:\n' +
      '[{"codigo":"FL-001","texto":"..."}]  — una entrada por producto.';

    /* las IA a veces envuelven el JSON en comillas de bloque o le agregan
       texto alrededor: esto rescata el arreglo que viene adentro */
    function mlLeerJson(txt) {
      const s = String(txt || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const a = s.indexOf('['), b = s.lastIndexOf(']');
      if (a < 0 || b < a) return null;
      try { const arr = JSON.parse(s.slice(a, b + 1)); return Array.isArray(arr) ? arr : null; }
      catch (e) { return null; }
    }

    $('adm-ml-ia').addEventListener('click', async () => {
      if (!mlRevData.length) return;
      const btn = $('adm-ml-ia'), info = $('adm-ml-ia-estado');
      btn.disabled = true;
      let hechas = 0; const fallos = [];

      // de a ML_IA_LOTE para que la respuesta no se corte a la mitad
      for (let d = 0; d < mlRevData.length; d += ML_IA_LOTE) {
        const lote = mlRevData.slice(d, d + ML_IA_LOTE);
        info.textContent = 'Escribiendo… (' + Math.min(d + lote.length, mlRevData.length) + ' de ' + mlRevData.length + ')';
        const datos = lote.map(r =>
          '- codigo: ' + r.item.codigo +
          ' | nombre: ' + (r.prod.name || '') +
          ' | coleccion: ' + (kvCat(r.prod.category, settings).nombre || '') +
          ' | material: ' + (settings.mlMaterial || 'Acero quirúrgico') +
          ' | medida: ' + (String(r.prod.detail || '').replace(/^aprox\.?\s*/i, '').trim() || 'no indicada')
        ).join('\n');

        try {
          const txt = await iaLlamar([
            { role: 'system', content: ML_IA_SISTEMA },
            { role: 'user', content: 'Escribe una descripción para cada uno de estos productos:\n\n' + datos }
          ], false);
          const arr = mlLeerJson(txt);
          if (!arr || !arr.length) { fallos.push('la IA contestó, pero no en el formato pedido'); continue; }
          arr.forEach(x => {
            const i = mlRevData.findIndex(r => String(r.item.codigo) === String(x.codigo));
            const t = String((x && x.texto) || '').trim();
            if (i < 0 || t.length < 40) return;            // si se saltó uno, ese conserva su texto normal
            mlRevData[i].item.descripcion = t;
            const pre = document.querySelectorAll('#adm-ml-revision .ml-rev-desc pre')[i];
            if (pre) pre.textContent = t;
            const det = document.querySelectorAll('#adm-ml-revision .ml-rev-desc')[i];
            if (det) det.open = true;
            hechas++;
          });
        } catch (err) { fallos.push(err.message); }
      }

      info.textContent = hechas
        ? ('✓ ' + hechas + ' descripción(es) nuevas. Revísalas: si alguna no te gusta, aprieta de nuevo.' +
           (fallos.length ? ' (' + fallos.length + ' lote(s) fallaron: ' + fallos[0] + ')' : ''))
        : ('❌ No se pudo: ' + (fallos[0] || 'la IA no devolvió nada') + '. Se mantienen las descripciones de siempre.');
      btn.disabled = false;
    });

    // stock por producto, editable justo antes de publicar
    document.addEventListener('input', (e) => {
      const c = e.target.closest('input[data-role="ml-stock-rev"]'); if (!c) return;
      const i = +c.dataset.i;
      if (!mlRevData[i]) return;
      const n = parseInt(c.value, 10);
      mlRevData[i].item.cantidad = (isNaN(n) || n < 1) ? 1 : n;
    });

    // todos con el mismo stock, de una
    const mlStockTodos = $('adm-ml-stock-todos');
    if (mlStockTodos) mlStockTodos.addEventListener('click', () => {
      const v = parseInt($('adm-ml-stock-todos-n').value, 10);
      if (isNaN(v) || v < 1) return;
      mlRevData.forEach((r, i) => {
        r.item.cantidad = v;
        const c = document.querySelector('input[data-role="ml-stock-rev"][data-i="' + i + '"]');
        if (c) c.value = v;
      });
    });

    // ---------- publicar ----------
    async function mlEnviar(soloProbar) {
      const url = String(settings.igPubUrl || '').trim();
      const clave = pubClave();
      if (!url) { mlEstado('⚠ Falta la URL del publicador. Se configura en la pestaña «Instagram y Facebook».'); return; }
      if (!clave) { mlEstado('⚠ Falta la clave secreta en este navegador. Se escribe en la pestaña «Instagram y Facebook».'); return; }
      if (!mlRevData.length) { mlEstado('⚠ Primero elige productos y aprieta «Revisar».'); return; }

      const largos = mlRevData.filter(r => r.item.titulo.length > KV_ML_TITULO_MAX);
      if (largos.length) { mlEstado('⚠ ' + largos.length + ' título(s) pasan los ' + KV_ML_TITULO_MAX + ' caracteres. Acórtalos antes de publicar.'); return; }

      const btnP = $('adm-ml-publicar'), btnT = $('adm-ml-probar');
      btnP.disabled = true; if (btnT) btnT.disabled = true;

      // Se manda de a ML_MAX_LOTE porque el publicador de Google se corta a los
      // 6 minutos, pero se siguen mandando tandas hasta terminar con TODOS los
      // elegidos. Antes se publicaban solo los primeros 20 y el resto quedaba
      // esperando sin que se notara.
      const total = mlRevData.length;
      const bienTodos = [], malTodos = [];
      let hechos = 0;

      while (mlRevData.length && hechos < total) {
        const lote = mlRevData.slice(0, ML_MAX_LOTE);
        mlEstado((soloProbar ? 'Comprobando' : 'Publicando') + ' ' + (hechos + 1) + '–' + (hechos + lote.length) + ' de ' + total + '… no cierres esta ventana ⏳');

        let d = null;
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // simple request: evita bloqueos CORS
            body: JSON.stringify({
              clave: clave,
              accion: soloProbar ? 'ml-validar' : 'ml-publicar',
              items: lote.map(r => Object.assign({}, r.item, { foto: undefined, imagen: mlFoto(r.prod) }))
            })
          });
          d = await r.json();
        } catch (err) {
          malTodos.push({ codigo: '(tanda)', error: 'no se pudo contactar al publicador: ' + err.message });
          break;
        }
        if (!d || !d.ok) { malTodos.push({ codigo: '(tanda)', error: (d && d.error) || 'error desconocido' }); break; }

        const res = d.resultados || [];
        const bien = res.filter(x => x.ok), mal = res.filter(x => !x.ok);
        bien.forEach(x => bienTodos.push(x));
        mal.forEach(x => malTodos.push(x));
        hechos += lote.length;

        if (!soloProbar && bien.length) {
          // se anota lo publicado en su propio documento, nunca en los productos
          const mapa = Object.assign({}, mlPublicados());
          bien.forEach(x => { mapa[x.codigo] = { itemId: x.itemId || '', permalink: x.permalink || '', fecha: new Date().toISOString() }; });
          await mlRef.set({ items: mapa }, { merge: true });
          bien.forEach(x => { const p = products.find(pp => pp.code === x.codigo); if (p) mlSel.delete(p.id); });
        }

        // fuera los que ya se resolvieron (bien o mal) para pasar a la tanda siguiente
        const resueltos = res.map(x => String(x.codigo));
        mlRevData = mlRevData.filter(r => resueltos.indexOf(String(r.item.codigo)) < 0);
        if (!res.length) break;                       // nada se resolvió: no insistir en vano
      }

      let msg = soloProbar
        ? '🧪 Prueba: ' + bienTodos.length + ' de ' + total + ' están correctos (no se publicó nada).'
        : '✅ Publicados ' + bienTodos.length + ' de ' + total + '.';
      if (malTodos.length) {
        msg += '\n\nCon problemas (' + malTodos.length + '):\n' +
          malTodos.slice(0, 15).map(x => '• ' + x.codigo + ': ' + x.error).join('\n') +
          (malTodos.length > 15 ? '\n…y ' + (malTodos.length - 15) + ' más' : '');
      }
      if (mlRevData.length) msg += '\n\nQuedaron ' + mlRevData.length + ' sin intentar. Aprieta «Publicar» de nuevo para seguir.';
      mlEstado(msg);

      if (!soloProbar) { renderML(); if (!mlRevData.length) $('ml-sec-revision').hidden = true; }
      btnP.disabled = false; if (btnT) btnT.disabled = false;
    }

    $('adm-ml-probar').addEventListener('click', () => mlEnviar(true));
    $('adm-ml-publicar').addEventListener('click', () => {
      const n = mlRevData.length;
      if (!window.confirm('Se van a crear ' + n + ' aviso(s) REALES en Mercado Libre, a la venta.\n\n¿Seguimos?')) return;
      mlEnviar(false);
    });

    // ---------- configuración ----------
    // Guardar principal: precio, tipo de publicación y stock
    $('adm-ml-guardar-cfg').addEventListener('click', () => {
      settingsRef.set({
        mlTipo: $('adm-ml-tipo').value,
        mlCantidad: Math.max(1, parseInt($('adm-ml-cantidad').value, 10) || 1),
        mlRecargoFijo: Math.max(0, parseInt($('adm-ml-recargo-fijo').value, 10) || 0),
        mlRecargoPct: Math.max(0, parseInt($('adm-ml-recargo-pct').value, 10) || 0),
        mlPrecioMin: Math.max(0, parseInt($('adm-ml-precio-min').value, 10) || 0),
        mlRedondeo: $('adm-ml-redondeo').value
      }, { merge: true }).then(() => guardado('adm-ml-cfg-ok')).catch(err => console.error(err));
    });

    // Guardar avanzados: categoría, marca, material y envío
    const btnAvz = $('adm-ml-guardar-avz');
    if (btnAvz) btnAvz.addEventListener('click', () => {
      settingsRef.set({
        mlCategoria: $('adm-ml-categoria').value.trim(),
        mlMarca: $('adm-ml-marca').value.trim(),
        mlMaterial: $('adm-ml-material').value.trim(),
        mlEnvio: $('adm-ml-envio').value,
        mlEnvioGratis: $('adm-ml-enviogratis').checked,
        mlUsarOferta: $('adm-ml-oferta').checked,
        mlConCierre: $('adm-ml-cierre').value,
        mlHipoalergenico: $('adm-ml-hipo').checked
      }, { merge: true }).then(() => guardado('adm-ml-avz-ok')).catch(err => console.error(err));
    });

    $('adm-ml-guardar-txt').addEventListener('click', () => {
      settingsRef.set({ mlExtras: $('adm-ml-extras').value.trim(), mlDescripcion: $('adm-ml-desc').value }, { merge: true })
        .then(() => guardado('adm-ml-txt-ok')).catch(err => console.error(err));
    });
    $('adm-ml-reset-txt').addEventListener('click', () => {
      $('adm-ml-extras').value = KV_ML_EXTRAS_DEFAULT;
      $('adm-ml-desc').value = KV_ML_DESC_DEFAULT;
    });

    // ---------- comisiones reales de Mercado Libre ----------
    // Mi estimación se equivocaba feo con los productos baratos: en un aro de
    // $2.990 cobra 16%, no el 9,46% de los de $10.990. Mejor preguntárselo.
    const mlTarifas = {};                       // { "gold_special|6990": 1039.5 }
    function mlTarifaClave(p, tipo) { return tipo + '|' + p; }

    async function mlPedirTarifas(precios, tipo) {
      const faltan = [...new Set(precios)].filter(p => p && mlTarifas[mlTarifaClave(p, tipo)] === undefined);
      if (!faltan.length) return;
      try {
        const d = await mlPublicador({ accion: 'ml-tarifas', precios: faltan.slice(0, 40), tipo: tipo });
        if (d && d.ok && d.tarifas) {
          Object.keys(d.tarifas).forEach(p => { mlTarifas[mlTarifaClave(Number(p), tipo)] = Number(d.tarifas[p]); });
        }
        faltan.forEach(p => { if (mlTarifas[mlTarifaClave(p, tipo)] === undefined) mlTarifas[mlTarifaClave(p, tipo)] = null; });
      } catch (e) { /* si no se puede, se sigue con la estimación */ }
    }

    /* lo que te queda: con la comisión real si la tenemos, si no con la estimación */
    function mlRecibe(precio, tipo) {
      const real = mlTarifas[mlTarifaClave(precio, tipo)];
      if (real == null) return { valor: kvMlRecibes(precio, tipo), real: false };
      return { valor: Math.round(precio - real - KV_ML_ENVIO_APROX), real: true };
    }

    // vista previa en vivo de cómo quedan los precios de Mercado Libre
    function mlPrecioMuestra() {
      const cont = $('adm-ml-precio-muestra'); if (!cont) return;
      const s = {
        mlRecargoFijo: parseInt($('adm-ml-recargo-fijo').value, 10) || 0,
        mlRecargoPct: parseInt($('adm-ml-recargo-pct').value, 10) || 0,
        mlPrecioMin: parseInt($('adm-ml-precio-min').value, 10) || 0,
        mlRedondeo: $('adm-ml-redondeo').value,
        mlUsarOferta: $('adm-ml-oferta').checked
      };
      const tipo = $('adm-ml-tipo').value;
      const muestra = [3000, 4990, 6990, 8990, 10990, 12990]
        .map(v => ({ p: { price: v }, cat: v }))
        .map(x => ({ cat: x.cat, ml: kvMlPrecio(x.p, s) }));
      cont.innerHTML =
        '<div class="ml-precio-tit">Así quedarían (y lo que te llega después de comisión y despacho):</div>' +
        '<table class="ml-precio-tabla"><tr><th>En tu catálogo</th><th>En Mercado Libre</th><th>Recibes</th></tr>' +
        muestra.map(x => {
          const rec = kvMlRecibes(x.ml, tipo);
          const pct = x.ml ? Math.round(rec / x.ml * 100) : 0;
          return '<tr><td>' + formatCLP(x.cat) + '</td><td><b>' + formatCLP(x.ml) + '</b></td>' +
            '<td class="' + (pct < 70 ? 'ml-precio-malo' : pct < 78 ? 'ml-precio-medio' : 'ml-precio-bueno') + '">' +
            formatCLP(rec) + ' <span>(' + pct + '%)</span></td></tr>';
        }).join('') + '</table>';
    }
    ['adm-ml-recargo-fijo', 'adm-ml-recargo-pct', 'adm-ml-precio-min', 'adm-ml-redondeo', 'adm-ml-tipo', 'adm-ml-oferta']
      .forEach(id => { const n = $(id); if (n) n.addEventListener('input', mlPrecioMuestra); });

    function poblarML() {
      const act = document.activeElement;
      const set = (id, v) => { const n = $(id); if (n && act !== n) n.value = v; };
      set('adm-ml-categoria', settings.mlCategoria || '');
      set('adm-ml-tipo', settings.mlTipo || 'gold_special');
      set('adm-ml-cantidad', settings.mlCantidad || 1);
      set('adm-ml-extras', settings.mlExtras != null ? settings.mlExtras : KV_ML_EXTRAS_DEFAULT);
      set('adm-ml-desc', settings.mlDescripcion != null ? settings.mlDescripcion : KV_ML_DESC_DEFAULT);
      set('adm-ml-envio', settings.mlEnvio || '');
      set('adm-ml-marca', settings.mlMarca != null ? settings.mlMarca : 'Karivé Joyas');
      set('adm-ml-material', settings.mlMaterial != null ? settings.mlMaterial : 'Acero quirúrgico');
      const of = $('adm-ml-oferta'); if (of && act !== of) of.checked = !!settings.mlUsarOferta;
      set('adm-ml-recargo-fijo', settings.mlRecargoFijo || 0);
      set('adm-ml-recargo-pct', settings.mlRecargoPct || 0);
      set('adm-ml-precio-min', settings.mlPrecioMin || 0);
      set('adm-ml-redondeo', settings.mlRedondeo || '');
      set('adm-ml-cierre', settings.mlConCierre || '');
      const eg = $('adm-ml-enviogratis'); if (eg && act !== eg) eg.checked = !!settings.mlEnvioGratis;
      const hp = $('adm-ml-hipo'); if (hp && act !== hp) hp.checked = !!settings.mlHipoalergenico;
      mlPrecioMuestra();
    }

    // ---------- conexión con Mercado Libre ----------
    async function mlPublicador(cuerpo) {
      const url = String(settings.igPubUrl || '').trim();
      const clave = pubClave();
      if (!url) throw new Error('Falta la URL del publicador (pestaña «Instagram y Facebook»).');
      if (!clave) throw new Error('Falta la clave secreta en este navegador (pestaña «Instagram y Facebook»).');
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ clave: clave }, cuerpo))
      });
      return r.json();
    }
    function mlCuenta(msg) { const n = $('adm-ml-cuenta'); if (n) n.textContent = msg || ''; }

    $('adm-ml-guardar-cred').addEventListener('click', async () => {
      const id = $('adm-ml-clientid').value.trim(), sec = $('adm-ml-secret').value.trim();
      if (!id || !sec) { mlCuenta('⚠ Faltan el Client ID o el Client Secret.'); return; }
      mlCuenta('Guardando…');
      try {
        const d = await mlPublicador({ accion: 'ml-credenciales', clientId: id, clientSecret: sec });
        if (d && d.ok) { guardado('adm-ml-cred-ok'); $('adm-ml-secret').value = ''; mlCuenta('✓ Guardadas dentro del publicador. Ahora aprieta «Conectar mi cuenta».'); }
        else mlCuenta('❌ ' + ((d && d.error) || 'No se pudieron guardar.'));
      } catch (e) { mlCuenta('❌ ' + e.message); }
    });

    $('adm-ml-conectar').addEventListener('click', async () => {
      mlCuenta('Pidiendo el enlace de autorización…');
      try {
        const d = await mlPublicador({ accion: 'ml-autorizar' });
        if (d && d.ok && d.url) { mlCuenta('Se abrió Mercado Libre en otra pestaña. Autoriza ahí y vuelve a apretar «Ver estado».'); window.open(d.url, '_blank', 'noopener'); }
        else mlCuenta('❌ ' + ((d && d.error) || 'No se pudo obtener el enlace.'));
      } catch (e) { mlCuenta('❌ ' + e.message); }
    });

    $('adm-ml-estado-cuenta').addEventListener('click', async () => {
      mlCuenta('Consultando…');
      try {
        const d = await mlPublicador({ accion: 'ml-estado' });
        if (d && d.ok) mlCuenta(d.conectado ? ('✓ Conectado como ' + (d.nick || d.userId || 'tu cuenta') + '.') : '⚠ Todavía no está conectada. Aprieta «Conectar mi cuenta».');
        else mlCuenta('❌ ' + ((d && d.error) || 'No se pudo consultar.'));
      } catch (e) { mlCuenta('❌ ' + e.message); }
    });

    // ---------- ventas hechas en Mercado Libre ----------
    const ML_ESTADO_VENTA = {
      paid: '✓ pagada', confirmed: 'confirmada', payment_required: 'esperando pago',
      payment_in_process: 'pago en proceso', cancelled: '✕ cancelada', invalid: 'inválida'
    };
    // las ventas se traen una vez y las usan «Ventas» y «Resumen»
    let mlVentas = null, mlVentasPidiendo = null, mlVentasError = '';
    function mlTraerVentas() {
      if (mlVentasPidiendo) return mlVentasPidiendo;
      mlVentasPidiendo = mlPublicador({ accion: 'ml-ventas', limite: 50 }).then(d => {
        if (!d || !d.ok) throw new Error((d && d.error) || 'No se pudo consultar.');
        mlVentas = { ventas: d.ventas || [], total: d.total || (d.ventas || []).length, cuando: Date.now() };
        mlVentasError = '';
        return mlVentas;
      }).catch(e => { mlVentasError = e.message; throw e; }).finally(() => { mlVentasPidiendo = null; });
      return mlVentasPidiendo;
    }
    $('adm-ml-ver-ventas').addEventListener('click', () => mlPintarVentas(true));
    async function mlPintarVentas(nuevas) {
      const cont = $('adm-ml-ventas'), info = $('adm-ml-ventas-contador');
      info.textContent = 'Consultando a Mercado Libre…';
      cont.innerHTML = '';
      try {
        const d = (!nuevas && mlVentas) || await mlTraerVentas();
        const v = d.ventas || [];
        info.textContent = v.length ? (v.length + ' venta(s) · ' + (d.total || v.length) + ' en total') : 'Todavía no tienes ventas en Mercado Libre.';
        cont.innerHTML = v.map(x => {
          const prods = (x.productos || []).map(p =>
            '<div class="ml-vta-prod">' + escapeHtml(p.titulo) + ' <b>×' + p.cantidad + '</b> · ' + formatCLP(p.precio) + '</div>').join('');
          const f = x.fecha ? new Date(x.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
          return '<div class="ml-vta">' +
            '<div class="ml-vta-top">' +
              '<span class="ml-vta-fecha">' + escapeHtml(f) + '</span>' +
              '<span class="ml-vta-estado">' + escapeHtml(ML_ESTADO_VENTA[x.estado] || x.estado || '') + '</span>' +
              '<span class="ml-vta-total">' + formatCLP(x.total || 0) + '</span>' +
            '</div>' + prods +
            (x.comprador ? '<div class="ml-vta-comp">Compradora: ' + escapeHtml(x.comprador) + '</div>' : '') +
          '</div>';
        }).join('');
      } catch (e) { info.textContent = '❌ ' + e.message; }
      if (nuevas) mlPintarResumen();
    }

    // ---------- resumen de Mercado Libre ----------
    const ventaVale = (v) => !/^(cancelled|invalid|payment_required)$/.test(v.estado || '');
    const fechaVenta = (v) => new Date(v.fecha || 0).getTime();
    function periodoApp(clave) {
      if (clave !== 'mes') return A.periodo(clave);
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime(), dias: hoy.getDate(), clave: 'mes' };
    }
    const PERIODOS_APP = [['7', '7 días'], ['30', '30 días'], ['mes', 'Este mes'], ['90', '90 días']];
    const selectorPeriodo = (act, extra) => '<div class="selector-periodo"><div class="grupo-btn">' +
      PERIODOS_APP.map(x => '<button class="btn btn-chico' + (act === x[0] ? ' activo' : '') + '" data-res-per="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' + (extra || '') + '</div>';
    const cambio = (ahora, antes) => {
      if (antes == null) return '';
      if (!antes) return ahora ? '<small class="res-sube">nuevo en este período</small>' : '';
      const p = Math.round((ahora - antes) * 100 / antes);
      return '<small class="' + (p >= 0 ? 'res-sube' : 'res-baja') + '">' + (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p) + '% vs. período anterior</small>';
    };
    const formatoPesos = (v) => v >= 1000000 ? '$' + (Math.round(v / 100000) / 10).toString().replace('.', ',') + 'M' : v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + v;
    function barrasRes(filas, vacio) {
      if (!filas.length) return '<p class="ayuda">' + vacio + '</p>';
      const max = Math.max(...filas.map(f => f.n)) || 1;
      return '<div class="barras-h">' + filas.map(f => '<div class="bh"><span title="' + escapeHtml(f.k) + '">' + escapeHtml(f.k) + '</span><div class="bh-pista"><div class="bh-relleno" style="width:' + Math.max(2, f.n * 100 / max) + '%"></div></div><b>' + (f.txt || f.n) + '</b></div>').join('') + '</div>';
    }

    let mlResPer = '30';
    function mlPintarResumen() {
      const cont = $('adm-ml-resumen'); if (!cont) return;
      if (!String(settings.igPubUrl || '').trim() || !pubClave()) {
        cont.innerHTML = '<div class="nota">Para ver el resumen de Mercado Libre falta conectar el publicador: <a href="#/config/notificaciones">Configuración → Notificaciones</a>.</div>';
        return;
      }
      if (!mlVentas) {
        if (mlVentasError) {
          cont.innerHTML = '<div class="nota mal">No pude traer tus ventas: ' + escapeHtml(mlVentasError) + '</div><button class="adm-btn-solido" data-res-act>↻ Reintentar</button>';
          cont.querySelector('[data-res-act]').addEventListener('click', () => { mlVentasError = ''; mlPintarResumen(); });
          return;
        }
        cont.innerHTML = '<div class="res-cargando">' + A.cargandoHtml + '<p class="ayuda">Trayendo tus ventas de Mercado Libre…</p></div>';
        mlTraerVentas().then(() => { mlPintarResumen(); }).catch(() => mlPintarResumen());
        return;
      }
      const per = periodoApp(mlResPer), hasta = Date.now();
      const todas = mlVentas.ventas.filter(ventaVale);
      const enPer = todas.filter(v => fechaVenta(v) >= per.desde);
      const masVieja = mlVentas.ventas.reduce((m, v) => Math.min(m, fechaVenta(v) || m), hasta);
      const incompleto = mlVentas.total > mlVentas.ventas.length;          // ML solo entrega las últimas 50
      const cubre = (desde) => !incompleto || masVieja <= desde;
      const largo = per.clave === 'mes' ? per.dias * 864e5 : per.dias * 864e5;
      const antDesde = per.desde - largo;
      const anteriores = cubre(antDesde) ? todas.filter(v => fechaVenta(v) >= antDesde && fechaVenta(v) < per.desde) : null;
      const suma = (l) => l.reduce((s, v) => s + (Number(v.total) || 0), 0);
      const unidades = (l) => l.reduce((s, v) => s + (v.productos || []).reduce((t, p) => t + (Number(p.cantidad) || 1), 0), 0);
      const tipo = settings.mlTipo || 'gold_special';
      const quedan = enPer.reduce((s, v) => s + Math.max(0, (Number(v.total) || 0) - Math.round((Number(v.total) || 0) * (tipo === 'gold_pro' ? 0.20 : 0.0946)) - KV_ML_ENVIO_APROX), 0);
      const total = suma(enPer);
      // lo más vendido en el período
      const top = {};
      enPer.forEach(v => (v.productos || []).forEach(p => {
        const k = p.titulo || '—'; top[k] = top[k] || { k: k, n: 0, plata: 0 };
        top[k].n += Number(p.cantidad) || 1; top[k].plata += (Number(p.precio) || 0) * (Number(p.cantidad) || 1);
      }));
      const topL = Object.values(top).sort((a, b) => b.n - a.n || b.plata - a.plata).slice(0, 6).map(x => Object.assign(x, { txt: x.n + ' · ' + A.clp(x.plata) }));
      // avisos
      const ps = mlPubsCache || [];
      const activos = ps.filter(p => p.estado === 'active'), pausados = ps.filter(p => p.estado === 'paused');
      const sinStock = ps.filter(p => p.estado !== 'closed' && !(Number(p.stock) > 0));
      const siempre = ps.filter(p => p.vendidos > 0).sort((a, b) => b.vendidos - a.vendidos).slice(0, 6).map(p => ({ k: p.titulo || p.id, n: p.vendidos }));
      const ultimas = mlVentas.ventas.slice().sort((a, b) => fechaVenta(b) - fechaVenta(a)).slice(0, 5);

      cont.innerHTML = selectorPeriodo(mlResPer, '<span class="ayuda">Actualizado ' + escapeHtml(A.hace(new Date(mlVentas.cuando).toISOString())) + '</span><button class="adm-btn-borde" data-res-act>↻ Actualizar</button>') +
        (incompleto && !cubre(per.desde) ? '<div class="nota">Mercado Libre entrega tus últimas ' + mlVentas.ventas.length + ' ventas (de ' + mlVentas.total + '): en este período puede faltar alguna más antigua.</div>' : '') +
        '<div class="metricas">' +
          '<div class="metrica"><span>Vendido</span><b>' + A.clp(total) + '</b>' + cambio(total, anteriores && suma(anteriores)) + '</div>' +
          '<div class="metrica"><span>Ventas</span><b>' + enPer.length + '</b>' + cambio(enPer.length, anteriores && anteriores.length) + '</div>' +
          '<div class="metrica"><span>Unidades</span><b>' + unidades(enPer) + '</b><small>ticket promedio ' + A.clp(enPer.length ? total / enPer.length : 0) + '</small></div>' +
          '<div class="metrica"><span>Te quedan (aprox.)</span><b>' + A.clp(quedan) + '</b><small>después de comisión y envío</small></div>' +
        '</div>' +
        '<div class="tarjeta res-tarjeta"><div class="tarjeta-cab"><h2>Ventas por día</h2></div>' +
          A.grafico(A.serie(per, todas, fechaVenta, v => Number(v.total) || 0).map(d => Object.assign(d, { tip: A.clp(d.valor) })), { titulo: 'Ventas por día en Mercado Libre', formato: formatoPesos, alto: 180 }) + '</div>' +
        '<div class="rejilla-2">' +
          '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:12px">Lo más vendido en el período</h2>' + barrasRes(topL, 'Sin ventas en este período.') + '</div>' +
          '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:12px">Tus avisos</h2>' +
            (ps.length ? '<div class="res-chips"><button data-ir-pest="avisos"><b>' + activos.length + '</b> activos</button><button data-ir-pest="avisos"><b>' + pausados.length + '</b> pausados</button>' +
              '<button data-ir-pest="avisos"' + (sinStock.length ? ' class="ojo"' : '') + '><b>' + sinStock.length + '</b> sin stock</button></div>' +
              '<h3 class="res-sub">Más vendidos de siempre</h3>' + barrasRes(siempre, 'Todavía no hay avisos con ventas.')
              : '<p class="ayuda">Revisando tus avisos…</p>') + '</div>' +
        '</div>' +
        '<div class="tarjeta tarjeta-c"><div class="res-cab"><h2>Últimas ventas</h2><button class="adm-btn-borde" data-ir-pest="ventas">Ver todas</button></div>' +
          (ultimas.length ? '<div class="res-lista">' + ultimas.map(v => '<div class="res-fila"><span class="res-fecha">' + escapeHtml(v.fecha ? new Date(v.fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : '') + '</span>' +
            '<span class="res-que">' + escapeHtml((v.productos || []).map(p => (p.cantidad > 1 ? p.cantidad + '× ' : '') + p.titulo).join(', ')) + (ventaVale(v) ? '' : ' <em>(' + escapeHtml(ML_ESTADO_VENTA[v.estado] || v.estado) + ')</em>') + '</span>' +
            '<b>' + A.clp(v.total) + '</b></div>').join('') + '</div>' : '<p class="ayuda">Todavía no tienes ventas en Mercado Libre.</p>') + '</div>';
      cont.querySelectorAll('[data-res-per]').forEach(b => b.addEventListener('click', () => { mlResPer = b.dataset.resPer; mlPintarResumen(); }));
      cont.querySelector('[data-res-act]').addEventListener('click', () => { mlVentas = null; mlPintarResumen(); if (mlCargarPubs) mlCargarPubs().then(mlPintarResumen); });
      cont.querySelectorAll('[data-ir-pest]').forEach(b => b.addEventListener('click', () => A.appPestana('mercadolibre', b.dataset.irPest)));
    }

    // ---------- resumen de Instagram y Facebook ----------
    let igResPer = '30', igPubs = null;
    function igPintarResumen() {
      const cont = $('adm-ig-resumen'); if (!cont) return;
      if (igPubs == null) {
        igPubs = [];
        fetch('/instagram.json', { cache: 'no-store' }).then(r => r.json()).then(d => { igPubs = (d.publicaciones || []).slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))); igPintarResumen(); }).catch(() => {});
      }
      const per = periodoApp(igResPer);
      const fv = (v) => new Date(v.creada || v.ultima || 0).getTime();
      const vis = (A.visitas || []).filter(v => fv(v) >= per.desde);
      const deIG = vis.filter(v => v.origenTipo === 'Instagram'), deFB = vis.filter(v => v.origenTipo === 'Facebook');
      const redes = deIG.concat(deFB);
      const pidieron = redes.filter(v => v.hizoPedido).length;
      const enPer = igPubs.filter(x => new Date(x.fecha).getTime() >= per.desde);
      const ultima = igPubs[0] ? new Date(igPubs[0].fecha).getTime() : 0;
      const diasSin = ultima ? Math.floor((Date.now() - ultima) / 864e5) : null;
      const ventas = (A.pedidos || []).filter(p => A.esVenta(p) && A.fechaPedido(p) >= per.desde);
      const vistos = {};
      redes.forEach(v => (v.productosIds || []).forEach(id => { vistos[id] = (vistos[id] || 0) + 1; }));
      const topVistos = Object.keys(vistos).map(id => ({ p: (A.productos || []).find(x => x.id === id), n: vistos[id] })).filter(x => x.p).sort((a, b) => b.n - a.n).slice(0, 6)
        .map(x => ({ k: x.p.name, n: x.n, txt: x.n + ' visita' + (x.n > 1 ? 's' : '') }));
      const fechaCorta = (f) => f ? new Date(f).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : '';

      cont.innerHTML = selectorPeriodo(igResPer) +
        (diasSin != null && diasSin >= 7 ? '<div class="nota">Hace <b>' + diasSin + ' días</b> que no publicas en Instagram. <button class="adm-btn-borde" data-ir-pest="publicar" style="margin-left:6px">Elegir productos para publicar</button></div>' : '') +
        '<div class="metricas">' +
          '<div class="metrica"><span>Visitas desde Instagram</span><b>' + deIG.length + '</b><small>a tu web</small></div>' +
          '<div class="metrica"><span>Visitas desde Facebook</span><b>' + deFB.length + '</b><small>a tu web</small></div>' +
          '<div class="metrica"><span>Pedidos desde redes</span><b>' + pidieron + '</b><small>de quienes llegaron por Instagram o Facebook</small></div>' +
          '<div class="metrica"><span>Ventas de la web</span><b>' + A.clp(ventas.reduce((s, p) => s + (Number(p.total) || 0), 0)) + '</b><small>' + ventas.length + ' pedido' + (ventas.length === 1 ? '' : 's') + ' en total · <a href="#/informes">ver informes</a></small></div>' +
        '</div>' +
        '<div class="tarjeta res-tarjeta"><div class="tarjeta-cab"><h2>Visitas desde Instagram y Facebook por día</h2></div>' +
          A.grafico(A.serie(per, (A.visitas || []).filter(v => v.origenTipo === 'Instagram' || v.origenTipo === 'Facebook'), fv, () => 1).map(d => Object.assign(d, { tip: d.valor + ' visita' + (d.valor === 1 ? '' : 's') })), { titulo: 'Visitas desde redes por día', alto: 180 }) + '</div>' +
        '<div class="rejilla-2">' +
          '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:12px">Lo que más miran quienes llegan desde redes</h2>' + barrasRes(topVistos, 'Sin visitas desde redes en este período.') + '</div>' +
          '<div class="tarjeta tarjeta-c"><div class="res-cab"><h2>Tus últimas publicaciones</h2>' + (igPubs.length ? '<span class="ayuda">' + enPer.length + ' en este período</span>' : '') + '</div>' +
            (igPubs.length ? '<div class="res-ig">' + igPubs.slice(0, 6).map(x => '<a href="' + escapeHtml(x.url) + '" target="_blank" rel="noopener" title="' + escapeHtml(x.texto || '') + '"><img src="' + escapeHtml(x.img) + '" alt="" loading="lazy">' +
              '<span>' + (x.tipo === 'VIDEO' ? '▶ ' : '') + escapeHtml(fechaCorta(x.fecha)) + '</span></a>').join('') + '</div>'
              : '<p class="ayuda">Aún no hay publicaciones de Instagram en la web. Aparecen cuando el publicador las trae (Apps Script, web.gs).</p>') + '</div>' +
        '</div>' +
        '<p class="ayuda">Las visitas cuentan a quienes entraron a tu web desde un enlace de Instagram o Facebook (perfil, historias o publicaciones).</p>';
      cont.querySelectorAll('[data-res-per]').forEach(b => b.addEventListener('click', () => { igResPer = b.dataset.resPer; igPintarResumen(); }));
      cont.querySelectorAll('[data-ir-pest]').forEach(b => b.addEventListener('click', () => A.appPestana('instagram', b.dataset.irPest)));
    }

    function alCambiarPestana(app, k) {
      if (app === 'mercadolibre' && k === 'resumen') mlPintarResumen();
      if (app === 'mercadolibre' && k === 'ventas' && !$('adm-ml-ventas').children.length) mlPintarVentas(false);
      if (app === 'instagram' && k === 'resumen') igPintarResumen();
    }

    // ---------- publicaciones ya hechas (precio, stock, pausar) ----------
    $('adm-ml-ver-pubs').addEventListener('click', () => mlCargarPubs());

    // Al entrar a la pestaña se traen las publicaciones una sola vez. Sin esto el
    // panel no sabe qué hay realmente en Mercado Libre y puede ofrecer publicar
    // productos que ya están arriba, que es como se crearon los duplicados.
    let mlPubsPedidas = false;
    mlAlEntrar = () => {
      if (mlPubsPedidas) return;
      if (!String(settings.igPubUrl || '').trim() || !pubClave()) return;
      mlPubsPedidas = true;
      mlEstadoLista('Revisando qué tienes publicado en Mercado Libre…');
      mlCargarPubs().then(() => { mlEstadoLista(''); renderML(); }).catch(() => { mlEstadoLista(''); });
    };

    // ---------- ponerle su código a cada aviso ----------
    // Mientras los avisos no traigan el código del producto hay que adivinar
    // comparando nombres, y eso confunde productos parecidos. Con el código
    // grabado dentro del aviso, todo pasa a ser exacto.
    let mlSkuPlan = [];

    function mlArmarPlanSku() {
      mlSkuPlan = [];
      mlPubsCache.forEach(pub => {
        if (pub.estado === 'closed') return;
        const prod = mlProductoDeAviso(pub);
        const yaOk = pub.sku && prod && String(pub.sku).toUpperCase() === String(prod.code || '').toUpperCase();
        if (yaOk) return;                                   // ya lo tiene bien
        mlSkuPlan.push({
          itemId: pub.id, titulo: pub.titulo, skuActual: pub.sku || '',
          codigo: prod ? (prod.code || '') : '', producto: prod ? prod.name : '',
          // "Modelo" lo ve quien compra: va el nombre del producto, no el código
          modelo: prod ? kvMlItem(prod, settings).modelo : '',
          marcado: !!(prod && prod.code)                    // los sin producto van desmarcados
        });
      });
      return mlSkuPlan;
    }

    function mlPintarPlanSku() {
      const cont = $('adm-ml-sku-plan'); if (!cont) return;
      if (!mlPubsCache.length) { cont.innerHTML = '<p class="adm-seccion-sub">Primero aprieta «Ver mis publicaciones».</p>'; $('adm-ml-sku-aplicar').hidden = true; return; }
      if (!mlSkuPlan.length) { cont.innerHTML = '<p class="adm-seccion-sub">✓ Todos tus avisos ya tienen su código puesto.</p>'; $('adm-ml-sku-aplicar').hidden = true; return; }

      const sinProd = mlSkuPlan.filter(x => !x.codigo).length;
      // los códigos repetidos en la propuesta casi siempre son un emparejamiento malo
      const cuenta = {};
      mlSkuPlan.forEach(x => { if (x.codigo) cuenta[x.codigo] = (cuenta[x.codigo] || 0) + 1; });

      cont.innerHTML =
        '<p class="adm-seccion-sub"><b>' + mlSkuPlan.length + '</b> aviso(s) sin código. Revisa que cada uno apunte al producto correcto y ' +
        '<b>desmarca los que estén mal</b> antes de aplicar.' +
        (sinProd ? ' ' + sinProd + ' no calzan con ningún producto (van desmarcados).' : '') + '</p>' +
        '<table class="ml-precio-tabla ml-sku-tabla"><tr><th></th><th>Aviso en Mercado Libre</th><th>Código (interno)</th><th>Modelo (lo ve quien compra)</th></tr>' +
        mlSkuPlan.map((x, i) => {
          const dup = x.codigo && cuenta[x.codigo] > 1;
          return '<tr class="' + (dup ? 'ml-sku-dudoso' : '') + '">' +
            '<td><input type="checkbox" data-role="ml-sku-chk" data-i="' + i + '"' + (x.marcado ? ' checked' : '') + (x.codigo ? '' : ' disabled') + ' /></td>' +
            '<td>' + escapeHtml(String(x.titulo || '').slice(0, 52)) + (x.skuActual ? ' <span>(hoy: ' + escapeHtml(x.skuActual) + ')</span>' : '') + '</td>' +
            '<td>' + (x.codigo
              ? '<b>' + escapeHtml(x.codigo) + '</b>' + (dup ? ' <span class="ml-precio-malo">⚠ repetido</span>' : '')
              : '<span class="ml-precio-malo">sin producto que calce</span>') + '</td>' +
            '<td>' + escapeHtml(String(x.modelo || '—').slice(0, 34)) + '</td>' +
          '</tr>';
        }).join('') + '</table>';
      $('adm-ml-sku-aplicar').hidden = false;
    }

    document.addEventListener('change', e => {
      const c = e.target.closest('input[data-role="ml-sku-chk"]'); if (!c) return;
      const i = +c.dataset.i;
      if (mlSkuPlan[i]) mlSkuPlan[i].marcado = c.checked;
    });

    const btnSkuVer = $('adm-ml-sku-ver');
    if (btnSkuVer) btnSkuVer.addEventListener('click', () => { mlArmarPlanSku(); mlPintarPlanSku(); });

    const btnSkuAplicar = $('adm-ml-sku-aplicar');
    if (btnSkuAplicar) btnSkuAplicar.addEventListener('click', async () => {
      const elegidos = mlSkuPlan.filter(x => x.marcado && x.codigo);
      if (!elegidos.length) { $('adm-ml-sku-estado').textContent = 'No hay ninguno marcado.'; return; }
      if (!window.confirm('Se le va a grabar su código a ' + elegidos.length + ' aviso(s) de Mercado Libre.\n\n' +
        'Es solo una etiqueta interna: no cambia el título, el precio ni nada que vea quien compra.\n\n¿Seguimos?')) return;
      btnSkuAplicar.disabled = true;
      let ok = 0; const malos = [];
      const LOTE = 25;
      for (let d = 0; d < elegidos.length; d += LOTE) {
        const lote = elegidos.slice(d, d + LOTE);
        $('adm-ml-sku-estado').textContent = 'Grabando ' + Math.min(d + lote.length, elegidos.length) + ' de ' + elegidos.length + '…';
        try {
          const r = await mlPublicador({ accion: 'ml-sku', pares: lote.map(x => ({ itemId: x.itemId, codigo: x.codigo, modelo: x.modelo })) });
          if (!r || !r.ok) { malos.push((r && r.error) || 'error desconocido'); continue; }
          (r.resultados || []).forEach(x => {
            if (x.ok) { ok++; const p = mlPubsCache.find(pp => pp.id === x.itemId); if (p) p.sku = x.codigo; }
            else malos.push((x.codigo || x.itemId) + ': ' + x.error);
          });
        } catch (e) { malos.push(e.message); }
      }
      $('adm-ml-sku-estado').textContent = '✓ Grabados ' + ok + ' de ' + elegidos.length +
        (malos.length ? ' · no se pudo con ' + malos.length + ' (' + malos[0] + ')' : '');
      mlArmarPlanSku(); mlPintarPlanSku(); mlPintarPubs();
      btnSkuAplicar.disabled = false;
    });

    // ---------- subir los precios de lo que ya está publicado ----------
    // Compara lo que cobra hoy cada aviso con lo que debería cobrar según el
    // recargo configurado, y deja aplicar los cambios después de revisarlos.
    let mlPreciosPlan = [];

    /* A qué producto del catálogo corresponde un aviso de Mercado Libre.
       Primero por el código guardado en el aviso (exacto). Si no lo trae —los
       avisos viejos no lo tienen— se compara el nombre, igual que al sincronizar. */
    function mlProductoDeAviso(pub) {
      if (pub.sku) {
        const porSku = products.find(p => String(p.code || '').toUpperCase() === String(pub.sku).toUpperCase());
        if (porSku) return porSku;
      }
      const t = mlTituloClave(pub.titulo);
      if (!t) return null;
      // el nombre más largo que calce gana, para no confundir "Flor Roja" con "Flor Roja Grande"
      let mejor = null;
      products.forEach(p => {
        const n = mlTituloClave(p.name);
        if (!n || n.length < 4) return;
        if (t === n || t.indexOf(n) === 0) { if (!mejor || n.length > mlTituloClave(mejor.name).length) mejor = p; }
      });
      return mejor;
    }

    /* Arma la lista de precios a cambiar mirando TODOS los avisos que Mercado
       Libre devuelve, no solo los que tengo anotados. Antes filtraba por mi
       propio registro y los avisos que no estaban ahí se saltaban en silencio:
       por eso aparecía uno solo. */
    let mlPreciosSinDuenoN = 0;
    function mlArmarPlanPrecios() {
      mlPreciosPlan = [];
      mlPreciosSinDuenoN = 0;
      mlPubsCache.forEach(pub => {
        if (pub.estado === 'closed') return;
        const prod = mlProductoDeAviso(pub);
        if (!prod) { mlPreciosSinDuenoN++; return; }
        const nuevo = kvMlPrecio(prod, settings);
        if (!nuevo || nuevo === pub.precio) return;
        mlPreciosPlan.push({
          itemId: pub.id, codigo: prod.code || '', titulo: pub.titulo,
          antes: pub.precio, despues: nuevo, catalogo: prod.price
        });
      });
      return mlPreciosPlan;
    }

    function mlPintarPlanPrecios() {
      const cont = $('adm-ml-precios-plan'); if (!cont) return;
      if (!mlPreciosPlan.length) {
        cont.innerHTML = '<p class="adm-seccion-sub">No hay precios que cambiar: o ya están al día, o todavía no has apretado «Ver mis publicaciones».</p>';
        $('adm-ml-precios-aplicar').hidden = true;
        return;
      }
      const tipo = String(settings.mlTipo || 'gold_special');
      const suben = mlPreciosPlan.filter(x => x.despues > x.antes).length;
      const activos = mlPubsCache.filter(p => p.estado !== 'closed').length;
      cont.innerHTML =
        '<p class="adm-seccion-sub">De <b>' + activos + '</b> aviso(s) activos: <b>' + mlPreciosPlan.length + '</b> cambiarían de precio (' + suben + ' suben), ' +
        (activos - mlPreciosPlan.length - mlPreciosSinDuenoN) + ' ya están al día' +
        (mlPreciosSinDuenoN ? ' y <b>' + mlPreciosSinDuenoN + '</b> no los pude emparejar con ningún producto del catálogo' : '') +
        '. Tu catálogo no se toca.</p>' +
        '<table class="ml-precio-tabla"><tr><th>Producto</th><th>Ahora</th><th>Quedaría</th><th>Recibes</th></tr>' +
        mlPreciosPlan.map(x => {
          const r = mlRecibe(x.despues, tipo);
          const rec = r.valor, pct = Math.round(rec / x.despues * 100);
          return '<tr><td>' + escapeHtml(x.codigo) + ' · ' + escapeHtml(String(x.titulo || '').slice(0, 34)) + '</td>' +
            '<td>' + formatCLP(x.antes) + '</td>' +
            '<td><b>' + formatCLP(x.despues) + '</b></td>' +
            '<td class="' + (pct < 70 ? 'ml-precio-malo' : pct < 78 ? 'ml-precio-medio' : 'ml-precio-bueno') + '">' +
              formatCLP(rec) + ' <span>(' + pct + '%' + (r.real ? '' : ' aprox') + ')</span></td></tr>';
        }).join('') + '</table>';
      $('adm-ml-precios-aplicar').hidden = false;
    }

    const btnVerPrecios = $('adm-ml-precios-ver');
    if (btnVerPrecios) btnVerPrecios.addEventListener('click', async () => {
      if (!mlPubsCache.length) { $('adm-ml-precios-plan').innerHTML = '<p class="adm-seccion-sub">Primero aprieta «Ver mis publicaciones» para traerlas.</p>'; return; }
      btnVerPrecios.disabled = true;
      mlArmarPlanPrecios();
      $('adm-ml-precios-estado').textContent = 'Preguntándole a Mercado Libre cuánto cobra por cada precio…';
      await mlPedirTarifas(mlPreciosPlan.map(x => x.despues), String(settings.mlTipo || 'gold_special'));
      $('adm-ml-precios-estado').textContent = '';
      mlPintarPlanPrecios();
      btnVerPrecios.disabled = false;
    });

    const btnAplicarPrecios = $('adm-ml-precios-aplicar');
    if (btnAplicarPrecios) btnAplicarPrecios.addEventListener('click', async () => {
      if (!mlPreciosPlan.length) return;
      if (!window.confirm('Se van a cambiar los precios de ' + mlPreciosPlan.length + ' aviso(s) en Mercado Libre.\n\n' +
        'Los precios de tu catálogo NO cambian.\n\n¿Seguimos?')) return;
      btnAplicarPrecios.disabled = true;
      const cont = $('adm-ml-precios-plan');
      let ok = 0, viaVariantes = 0; const malos = [];
      for (let i = 0; i < mlPreciosPlan.length; i++) {
        const x = mlPreciosPlan[i];
        cont.insertAdjacentHTML('afterbegin', '');
        $('adm-ml-precios-estado').textContent = 'Cambiando ' + (i + 1) + ' de ' + mlPreciosPlan.length + '… (' + x.codigo + ')';
        try {
          const d = await mlPublicador({ accion: 'ml-actualizar', itemId: x.itemId, precio: x.despues });
          if (d && d.ok) { ok++; if (d.via === 'variantes') viaVariantes++; const p = mlPubsCache.find(pp => pp.id === x.itemId); if (p) p.precio = x.despues; }
          else malos.push(x.codigo + ': ' + ((d && d.error) || 'no se pudo'));
        } catch (e) { malos.push(x.codigo + ': ' + e.message); }
      }
      // con 85 fallas iguales, mostrar solo la primera no sirve: se agrupan por motivo
      let resumen = '✓ Cambiados ' + ok + ' de ' + mlPreciosPlan.length;
      if (viaVariantes) resumen += ' (' + viaVariantes + ' por sus variantes)';
      if (malos.length) {
        const porMotivo = {};
        malos.forEach(m => {
          const motivo = m.replace(/^[A-Z]{2}-\d+: /, '').replace(/MLC\d+/g, 'ese aviso').slice(0, 120);
          (porMotivo[motivo] = porMotivo[motivo] || []).push(m.split(':')[0]);
        });
        resumen += '\n\nNo se pudo con ' + malos.length + ':\n' +
          Object.keys(porMotivo).map(m =>
            '• ' + porMotivo[m].length + ' aviso(s): ' + m +
            '\n   (' + porMotivo[m].slice(0, 6).join(', ') + (porMotivo[m].length > 6 ? '…' : '') + ')'
          ).join('\n');
      }
      $('adm-ml-precios-estado').textContent = resumen;
      mlArmarPlanPrecios();
      mlPintarPlanPrecios();
      mlPintarPubs();
      btnAplicarPrecios.disabled = false;
    });

    // ---------- ver un aviso tal como está en Mercado Libre ----------
    // Para comprobar con los ojos que los cambios del panel llegaron de verdad.
    const btnVerAviso = $('adm-ml-ver-aviso');
    if (btnVerAviso) btnVerAviso.addEventListener('click', async () => {
      const cont = $('adm-ml-aviso');
      btnVerAviso.disabled = true;
      cont.innerHTML = '<p class="adm-seccion-sub">Consultando a Mercado Libre…</p>';
      try {
        const itemId = String($('adm-ml-aviso-id').value || '').trim();
        const d = await mlPublicador({ accion: 'ml-ver', itemId: itemId });
        if (!d || !d.ok) { cont.innerHTML = '<p class="adm-seccion-sub">❌ ' + escapeHtml((d && d.error) || 'No se pudo.') + '</p>'; btnVerAviso.disabled = false; return; }
        const f = new Date(d.actualizado || 0);
        cont.innerHTML =
          '<div class="ml-rev">' +
            '<div class="ml-pub-tit">' + (d.url ? '<a href="' + escapeHtml(d.url) + '" target="_blank" rel="noopener">' + escapeHtml(d.titulo || d.id) + '</a>' : escapeHtml(d.titulo || d.id)) + '</div>' +
            '<div class="ml-rev-datos">' +
              '<span>Precio <b>' + formatCLP(d.precio || 0) + '</b></span>' +
              '<span>Stock <b>' + (d.stock || 0) + '</b></span>' +
              '<span>Fotos <b class="' + (d.fotos <= 1 ? 'ml-precio-malo' : '') + '">' + (d.fotos || 0) + '</b></span>' +
              (d.nota != null ? '<span>Nota <b>' + d.nota + '%</b></span>' : '') +
              (d.actualizado ? '<span>Último cambio <b>' + f.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</b></span>' : '') +
            '</div>' +
            '<table class="ml-precio-tabla" style="margin-top:12px;"><tr><th>Característica</th><th>Valor</th></tr>' +
            (d.caracteristicas || []).map(c =>
              '<tr><td>' + escapeHtml(c.nombre) + '</td><td><b>' + escapeHtml(String(c.valor)) + '</b></td></tr>').join('') +
            '</table>' +
            (d.descripcion ? '<details class="ml-rev-desc"><summary>Ver la descripción que tiene ahora</summary><pre>' + escapeHtml(d.descripcion) + '</pre></details>' : '') +
          '</div>';
      } catch (e) { cont.innerHTML = '<p class="adm-seccion-sub">❌ ' + escapeHtml(e.message) + '</p>'; }
      btnVerAviso.disabled = false;
    });

    // ---------- completar las características de todos, de una ----------
    // Un solo botón: recorre todos los avisos activos, les completa color,
    // largo y material sacados del catálogo, y avisa al final. No hay que
    // quedarse mirando ni ir producto por producto.
    const btnCompletar = $('adm-ml-completar');
    if (btnCompletar) btnCompletar.addEventListener('click', async () => {
      if (!mlPubsCache.length) { $('adm-ml-calidad').innerHTML = '<p class="adm-seccion-sub">Espera a que carguen tus publicaciones y vuelve a apretar.</p>'; return; }
      const cat = String(settings.mlCategoria || '').trim();
      if (!cat) { $('adm-ml-calidad').innerHTML = '<p class="adm-seccion-sub">Falta la categoría de Mercado Libre, en Configuración.</p>'; return; }

      // se arma el trabajo: aviso → características sacadas de su producto
      const trabajo = [];
      let sinProducto = 0;
      mlPubsCache.forEach(pub => {
        if (pub.estado === 'closed') return;
        const prod = mlProductoDeAviso(pub);
        if (!prod) { sinProducto++; return; }
        const c = kvMlCaracteristicas(prod, settings);
        if (!c.color && !c.largoCm) return;          // nada que completar con seguridad
        trabajo.push(Object.assign({ itemId: pub.id }, c));
      });

      if (!trabajo.length) { $('adm-ml-calidad').innerHTML = '<p class="adm-seccion-sub">No hay nada que completar con seguridad.</p>'; return; }
      if (!window.confirm('Se van a completar las características de ' + trabajo.length + ' aviso(s):\n\n' +
        '· Color, sacado del nombre del producto\n· Largo, sacado de la medida\n· Material\n\n' +
        'Si algún valor no calza con lo que acepta Mercado Libre, ese se deja vacío en vez de poner algo equivocado.\n\n¿Seguimos?')) return;

      btnCompletar.disabled = true;
      const cont = $('adm-ml-calidad');
      let ok = 0, puestas = 0, pedidas = 0, notas = []; const malos = [];
      const LOTE = 20;
      for (let d = 0; d < trabajo.length; d += LOTE) {
        const lote = trabajo.slice(d, d + LOTE);
        cont.innerHTML = '<p class="adm-seccion-sub">Completando ' + Math.min(d + lote.length, trabajo.length) + ' de ' + trabajo.length + '… puedes cerrar y volver después ⏳</p>';
        try {
          const r = await mlPublicador({ accion: 'ml-completar', categoria: cat, items: lote });
          if (!r || !r.ok) { malos.push((r && r.error) || 'error desconocido'); continue; }
          (r.resultados || []).forEach(x => {
            puestas += (x.puestos || 0);
            pedidas += (x.pedidos || 0);
            if (x.ok) { ok++; if (x.nota != null) notas.push(x.nota); }
            else malos.push(x.itemId + ': ' + (x.error || 'sin detalle'));
          });
        } catch (e) { malos.push(e.message); }
      }

      let h = '<p class="adm-seccion-sub">Quedaron completas <b>' + ok + '</b> de ' + trabajo.length + ' publicaciones · ' +
        '<b>' + puestas + '</b> de ' + pedidas + ' características entraron de verdad.' +
        (notas.length ? ' Nota promedio ahora: <b>' + Math.round(notas.reduce((a, n) => a + n, 0) / notas.length) + '%</b>.' : '') +
        (sinProducto ? ' (' + sinProducto + ' avisos no calzan con ningún producto del catálogo.)' : '') + '</p>';
      if (malos.length) {
        const porMotivo = {};
        malos.forEach(m => { const k = m.replace(/^MLC\d+: /, '').slice(0, 110); (porMotivo[k] = porMotivo[k] || []).push(1); });
        h += '<p class="adm-seccion-sub">No se pudo con ' + malos.length + ':</p><ul class="adm-ayuda">' +
          Object.keys(porMotivo).map(k => '<li>' + porMotivo[k].length + ': ' + escapeHtml(k) + '</li>').join('') + '</ul>';
      }
      h += '<p class="adm-seccion-sub">Aprieta <b>Revisar la calidad</b> para ver cómo quedaron las notas.</p>';
      cont.innerHTML = h;
      btnCompletar.disabled = false;
    });

    // ---------- revisar la calidad de los avisos ----------
    // Mercado Libre le pone nota a cada aviso y muestra "objetivos" sin explicar
    // bien cuáles. Esto los lee y los junta para ver qué conviene arreglar primero.
    let mlCalidadDatos = null;

    const btnCalidad = $('adm-ml-calidad-ver');
    if (btnCalidad) btnCalidad.addEventListener('click', async () => {
      btnCalidad.disabled = true;
      const cont = $('adm-ml-calidad');
      cont.innerHTML = '<p class="adm-seccion-sub">Revisando tus avisos uno por uno en Mercado Libre… esto demora un poco ⏳</p>';
      try {
        const d = await mlPublicador({ accion: 'ml-calidad', categoria: String(settings.mlCategoria || '').trim(), limite: 30 });
        if (!d || !d.ok) { cont.innerHTML = '<p class="adm-seccion-sub">❌ ' + escapeHtml((d && d.error) || 'No se pudo.') + '</p>'; btnCalidad.disabled = false; return; }
        mlCalidadDatos = d;
        mlPintarCalidad();
      } catch (e) { cont.innerHTML = '<p class="adm-seccion-sub">❌ ' + escapeHtml(e.message) + '</p>'; }
      btnCalidad.disabled = false;
    });

    function mlPintarCalidad() {
      const d = mlCalidadDatos, cont = $('adm-ml-calidad');
      if (!d) return;
      const faltan = Object.keys(d.faltan || {}).map(k => ({ k: k, n: d.faltan[k] })).sort((a, b) => b.n - a.n);
      const peores = (d.avisos || []).filter(a => a.nota != null).sort((a, b) => a.nota - b.nota).slice(0, 10);

      let h = '<p class="adm-seccion-sub">Revisé <b>' + d.revisados + '</b> de tus ' + d.total + ' avisos activos' +
        (d.notaPromedio != null ? ' · nota promedio <b>' + d.notaPromedio + '%</b>' : ' · <b>la nota no la entrega Mercado Libre por esta vía</b>, míralas en tu lista de publicaciones') +
        ' · <b>' + d.fotosPromedio + '</b> fotos por aviso.</p>';

      // lo que más se repite, que es por donde conviene partir
      h += '<h3 class="ml-cfg-tit">Por dónde partir</h3>';
      const pasos = [];
      if (d.unaFoto) pasos.push({ t: '<b>' + d.unaFoto + ' aviso(s) tienen una sola foto.</b> Mercado Libre pide varias y es lo que más pesa en la nota. Con 3 o 4 fotos por aro (puesto, de cerca, con la mano para el tamaño) la nota sube parejo.', peso: 'alto' });
      if (faltan.length) pasos.push({ t: '<b>Faltan características.</b> La categoría pide ' + d.pideCategoria + ' y a tus avisos les faltan varias — abajo está el detalle.', peso: 'alto' });
      // la descripción no viene en los datos del aviso, así que no se puede
      // saber desde acá si falta. Antes se avisaba que faltaban y era falso.
      h += pasos.length
        ? '<ul class="adm-ayuda">' + pasos.map(p => '<li>' + p.t + '</li>').join('') + '</ul>'
        : '<p class="adm-seccion-sub">No encontré nada grande que arreglar.</p>';

      if (faltan.length) {
        h += '<h3 class="ml-cfg-tit">Características que faltan</h3>' +
          '<table class="ml-precio-tabla"><tr><th>Característica</th><th>A cuántos avisos les falta</th></tr>' +
          faltan.slice(0, 20).map(x =>
            '<tr><td>' + escapeHtml(x.k) + '</td><td><b>' + x.n + '</b> de ' + d.revisados + '</td></tr>').join('') +
          '</table>' +
          '<p class="adm-seccion-sub">Las <b>obligatorias</b> son las que más suben la nota. Si alguna no aplica a tus aros (tipo de piedra, por ejemplo), márcala como <b>«No aplica»</b> en Mercado Libre: eso también cuenta como completada.</p>';
      }

      if (peores.length) {
        h += '<h3 class="ml-cfg-tit">Los avisos con peor nota</h3>' +
          '<table class="ml-precio-tabla"><tr><th>Aviso</th><th>Nota</th><th>Fotos</th><th>Le falta</th></tr>' +
          peores.map(a =>
            '<tr><td>' + escapeHtml(String(a.titulo || '').slice(0, 38)) + '</td>' +
            '<td class="' + (a.nota < 50 ? 'ml-precio-malo' : a.nota < 75 ? 'ml-precio-medio' : 'ml-precio-bueno') + '"><b>' + a.nota + '%</b></td>' +
            '<td class="' + (a.fotos <= 1 ? 'ml-precio-malo' : '') + '">' + a.fotos + '</td>' +
            '<td>' + escapeHtml((a.falta || []).slice(0, 4).join(', ') || '—') + '</td></tr>').join('') +
          '</table>';
      }
      cont.innerHTML = h;
    }

    // ---------- borrar definitivamente los avisos cerrados ----------
    // Un aviso cerrado deja de venderse pero sigue ocupando lugar en la lista.
    // Borrarlo lo saca del todo, y ESO NO TIENE VUELTA ATRÁS.
    async function mlBorrarCerrados() {
      const cerrados = mlPubsCache.filter(p => p.estado === 'closed' && !p.vendidos);
      const conVentas = mlPubsCache.filter(p => p.estado === 'closed' && p.vendidos);
      if (!cerrados.length) {
        $('adm-ml-pubs-contador').textContent = conVentas.length
          ? 'No hay avisos cerrados para borrar. Los ' + conVentas.length + ' que quedan tienen ventas y conviene conservarlos.'
          : 'No hay avisos cerrados para borrar.';
        return;
      }
      if (!window.confirm('Se van a BORRAR ' + cerrados.length + ' aviso(s) cerrados de Mercado Libre.\n\n' +
        'Esto NO tiene vuelta atrás: desaparecen del todo, con sus preguntas y sus visitas.\n' +
        (conVentas.length ? '\nLos ' + conVentas.length + ' cerrados que SÍ tienen ventas no se tocan, para no perder ese historial.\n' : '') +
        '\n¿Seguimos?')) return;
      if (!window.confirm('Última confirmación.\n\nBorrar ' + cerrados.length + ' aviso(s) definitivamente. No se pueden recuperar.\n\n¿Lo hago?')) return;

      const btn = $('adm-ml-borrar');
      if (btn) btn.disabled = true;
      const info = $('adm-ml-pubs-contador');
      let ok = 0; const malos = [];
      const LOTE = 25;
      for (let d = 0; d < cerrados.length; d += LOTE) {
        const lote = cerrados.slice(d, d + LOTE);
        info.textContent = 'Borrando ' + Math.min(d + lote.length, cerrados.length) + ' de ' + cerrados.length + '…';
        try {
          const r = await mlPublicador({ accion: 'ml-borrar', itemIds: lote.map(p => p.id) });
          if (!r || !r.ok) { malos.push((r && r.error) || 'error desconocido'); continue; }
          (r.resultados || []).forEach(x => {
            if (x.ok) { ok++; mlPubsCache = mlPubsCache.filter(p => p.id !== x.itemId); }
            else malos.push(x.itemId + ': ' + x.error);
          });
        } catch (e) { malos.push(e.message); }
      }
      const resumen = '✓ Borrados ' + ok + ' de ' + cerrados.length +
        (malos.length ? ' · no se pudo con ' + malos.length + ' (' + malos[0] + ')' : '');
      mlPintarPubs();
      info.textContent = resumen;
      if (btn) btn.disabled = false;
    }
    const btnBorrar = $('adm-ml-borrar');
    if (btnBorrar) btnBorrar.addEventListener('click', mlBorrarCerrados);

    // ---------- pasar publicaciones de Premium a Clásica (o al revés) ----------
    const ML_TIPO_NOMBRE = { gold_pro: 'Premium', gold_special: 'Clásica' };
    const ML_TIPO_LOTE = 25;   // el publicador de Google se corta a los 6 minutos

    async function mlCambiarTipoLote(destino) {
      const ps = mlPubsCache.filter(p => p.estado !== 'closed');
      if (!ps.length) { $('adm-ml-pubs-contador').textContent = 'Primero trae tus publicaciones.'; return; }
      const nombre = ML_TIPO_NOMBRE[destino] || destino;
      if (!window.confirm('Se van a pasar ' + ps.length + ' publicación(es) a ' + nombre + '.\n\n' +
        (destino === 'gold_special'
          ? 'Clásica cobra cerca de la mitad de comisión que Premium, y la visibilidad es la misma. Lo que se pierde son las cuotas sin interés para quien compra.'
          : 'Premium cobra cerca del doble de comisión. A cambio, quien compra puede pagar en cuotas sin interés.') +
        '\n\n¿Seguimos?')) return;

      const info = $('adm-ml-pubs-contador');
      let ok = 0; const malos = [];
      for (let d = 0; d < ps.length; d += ML_TIPO_LOTE) {
        const lote = ps.slice(d, d + ML_TIPO_LOTE);
        info.textContent = 'Cambiando ' + Math.min(d + lote.length, ps.length) + ' de ' + ps.length + '…';
        try {
          const r = await mlPublicador({ accion: 'ml-tipo', tipo: destino, itemIds: lote.map(p => p.id) });
          if (!r || !r.ok) { malos.push((r && r.error) || 'error desconocido'); continue; }
          (r.resultados || []).forEach(x => { if (x.ok) ok++; else malos.push(x.itemId + ': ' + x.error); });
        } catch (e) { malos.push(e.message); }
      }
      const resumen = '✓ Pasadas a ' + nombre + ': ' + ok + ' de ' + ps.length +
        (malos.length ? ' · no se pudo con ' + malos.length + ' (' + malos[0] + ')' : '');
      if (ok) await mlCargarPubs();          // se recarga primero, si no el resumen se pierde
      info.textContent = resumen;
    }

    const btnClasica = $('adm-ml-a-clasica');
    if (btnClasica) btnClasica.addEventListener('click', () => mlCambiarTipoLote('gold_special'));

    /* deja un título comparable: sin tildes, sin signos y sin las palabras de
       relleno que Mercado Libre agrega, para reconocer dos avisos del mismo aro */
    function mlTituloClave(t) {
      return String(t || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\b(mujer|karive|joyas|acero|quirurgico|hechos?|a|mano|artesanales?|aros?)\b/g, ' ')
        .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /* agrupa las publicaciones que apuntan al mismo producto.
       Se conserva la que tiene ventas; si ninguna vendió, la primera. */
    function mlAgruparDuplicadas(ps) {
      const grupos = {};
      ps.forEach(p => {
        // Dos avisos son el mismo producto si apuntan al MISMO producto del
        // catálogo. Antes bastaba con que el título se pareciera, y eso juntaba
        // productos distintos que se llaman casi igual.
        const prod = mlProductoDeAviso(p);
        const k = prod ? ('cod:' + prod.code) : ('tit:' + mlTituloClave(p.titulo));
        (grupos[k] = grupos[k] || []).push(p);
      });
      const dup = {};
      Object.keys(grupos).forEach(k => {
        const g = grupos[k];
        if (g.length < 2) return;
        const orden = g.slice().sort((a, b) => {
          const v = (b.vendidos || 0) - (a.vendidos || 0);
          if (v) return v;                                   // primero el que vendió
          return String(a.desde || '').localeCompare(String(b.desde || ''));   // luego el más antiguo
        });
        const quedarse = orden[0];
        g.forEach(p => {
          dup[p.id] = {
            total: g.length,
            sobra: p.id !== quedarse.id,
            // con cuál se repite: sin esto no hay forma de comprobar si acerté
            pareja: g.filter(o => o.id !== p.id).map(o => ({ id: o.id, titulo: o.titulo, url: o.url, vendidos: o.vendidos || 0 }))
          };
        });
      });
      return dup;
    }

    let mlPubsCache = [];
    let mlSoloDup = false;

    async function mlCargarPubs() {
      const cont = $('adm-ml-pubs'), info = $('adm-ml-pubs-contador');
      info.textContent = 'Consultando a Mercado Libre…';
      cont.innerHTML = '';
      try {
        const d = await mlPublicador({ accion: 'ml-publicaciones' });
        if (!d || !d.ok) { info.textContent = '❌ ' + ((d && d.error) || 'No se pudo consultar.'); return; }
        mlPubsCache = d.publicaciones || [];
        mlPintarPubs();
        if ($('ml-sec-resumen') && !$('ml-sec-resumen').classList.contains('fuera-pest')) mlPintarResumen();
      } catch (e) { info.textContent = '❌ ' + e.message; }
    }

    function mlPintarPubs() {
      const cont = $('adm-ml-pubs'), info = $('adm-ml-pubs-contador');
      const ps = mlPubsCache;
      const dup = mlAgruparDuplicadas(ps);
      const sobran = ps.filter(p => dup[p.id] && dup[p.id].sobra && p.estado !== 'closed');

      const activas = ps.filter(p => p.estado === 'active').length;
      const cerradas = ps.filter(p => p.estado === 'closed').length;
      info.textContent = ps.length
        ? (ps.length + ' publicación(es) · ' + activas + ' activas' +
           (cerradas ? ' · ' + cerradas + ' cerradas' : '') +
           (sobran.length ? ' · ⚠ ' + sobran.length + ' repetidas' : ''))
        : 'Todavía no tienes publicaciones.';
      const bb = document.getElementById('adm-ml-borrar');
      if (bb) bb.hidden = !cerradas;

      const barra = $('adm-ml-dup-barra');
      if (barra) {
        barra.hidden = !sobran.length;
        if (sobran.length) {
          barra.innerHTML =
            '<span>⚠ Hay <b>' + sobran.length + '</b> aviso(s) repetido(s): más de uno para el mismo aro. ' +
            'Se conserva el que tiene ventas y sobran los demás. Dos avisos del mismo producto se quitan visitas entre ellos.</span>' +
            '<div class="ml-dup-btns">' +
              '<button type="button" class="adm-btn-borde" data-role="ml-ver-dup">' + (mlSoloDup ? 'Ver todas' : 'Ver solo las repetidas') + '</button>' +
              '<button type="button" class="adm-btn-solido" data-role="ml-cerrar-dup">Cerrar las ' + sobran.length + ' repetidas</button>' +
            '</div>';
        }
      }

      const lista = mlSoloDup ? ps.filter(p => dup[p.id]) : ps;
      cont.innerHTML = lista.map(p => {
        const dd = dup[p.id];
        const sobra = dd && dd.sobra && p.estado !== 'closed';
        let etq = '<span class="ml-badge ' + (p.estado === 'active' ? 'ml-badge-pub' : 'ml-badge-mal') + '">' +
          (p.estado === 'active' ? 'activa' : p.estado === 'paused' ? 'pausada' : p.estado === 'closed' ? 'cerrada' : escapeHtml(p.estado || '')) + '</span>';
        if (dd) etq += '<span class="ml-badge ' + (sobra ? 'ml-badge-mal' : 'ml-badge-pub') + '">' +
          (sobra ? 'repetida — sobra' : 'repetida — esta se queda') + '</span>';
        const pareja = dd && dd.pareja && dd.pareja.length
          ? '<div class="ml-pub-pareja">Se repite con: ' + dd.pareja.map(o =>
              (o.url ? '<a href="' + escapeHtml(o.url) + '" target="_blank" rel="noopener">' + escapeHtml(o.titulo || o.id) + '</a>' : escapeHtml(o.titulo || o.id)) +
              ' <span>(' + o.vendidos + ' vendidos)</span>').join(' · ') +
            '</div>'
          : '';
        return '<div class="ml-pub' + (sobra ? ' ml-pub-dup' : '') + '" data-item="' + escapeHtml(p.id) + '">' +
          '<div class="ml-pub-tit">' +
            (p.url ? '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener">' + escapeHtml(p.titulo || p.id) + '</a>' : escapeHtml(p.titulo || p.id)) +
            etq +
          '</div>' +
          '<div class="ml-pub-campos">' +
            '<label>Precio <input class="adm-input" type="number" min="0" step="10" data-role="ml-precio" value="' + (p.precio || 0) + '" /></label>' +
            '<label>Stock <input class="adm-input" type="number" min="0" step="1" data-role="ml-stock" value="' + (p.stock || 0) + '" /></label>' +
            '<span class="ml-pub-vend">Vendidos <b>' + (p.vendidos || 0) + '</b></span>' +
            '<button class="adm-btn-solido" data-role="ml-guardar-pub">Guardar</button>' +
            '<button class="adm-btn-borde" data-role="ml-pausar" data-estado="' + escapeHtml(p.estado || '') + '">' +
              (p.estado === 'active' ? 'Pausar' : 'Activar') + '</button>' +
            (sobra ? '<button class="adm-btn-borde ml-btn-cerrar" data-role="ml-cerrar">Cerrar esta</button>' : '') +
          '</div>' +
          pareja +
          '<div class="ml-pub-msg"></div>' +
        '</div>';
      }).join('');
    }

    // ver solo las repetidas
    document.addEventListener('click', e => {
      if (!e.target.closest('[data-role="ml-ver-dup"]')) return;
      mlSoloDup = !mlSoloDup;
      mlPintarPubs();
    });

    /* cerrar un aviso: deja de aparecer y nadie lo puede comprar.
       Mercado Libre lo guarda en tu historial, no lo borra del todo. */
    async function mlCerrarAviso(itemId) {
      const d = await mlPublicador({ accion: 'ml-actualizar', itemId: itemId, estado: 'closed' });
      if (!d || !d.ok) throw new Error((d && d.error) || 'no se pudo cerrar');
      const p = mlPubsCache.find(x => x.id === itemId);
      if (p) p.estado = 'closed';
    }

    // cerrar una sola
    document.addEventListener('click', async e => {
      const b = e.target.closest('button[data-role="ml-cerrar"]'); if (!b) return;
      const caja = b.closest('.ml-pub'); if (!caja) return;
      const tit = (caja.querySelector('.ml-pub-tit a') || caja.querySelector('.ml-pub-tit')).textContent.trim();
      if (!window.confirm('Se va a CERRAR este aviso en Mercado Libre:\n\n' + tit +
        '\n\nDeja de aparecer y nadie puede comprarlo. Queda en tu historial, no se borra.\n\n¿Seguimos?')) return;
      b.disabled = true;
      const msg = caja.querySelector('.ml-pub-msg');
      msg.textContent = 'Cerrando…';
      try { await mlCerrarAviso(caja.dataset.item); mlPintarPubs(); }
      catch (err) { msg.textContent = '❌ ' + err.message; b.disabled = false; }
    });

    // cerrar todas las que sobran
    document.addEventListener('click', async e => {
      const b = e.target.closest('button[data-role="ml-cerrar-dup"]'); if (!b) return;
      const dup = mlAgruparDuplicadas(mlPubsCache);
      const sobran = mlPubsCache.filter(p => dup[p.id] && dup[p.id].sobra && p.estado !== 'closed');
      if (!sobran.length) return;
      if (!window.confirm('Se van a CERRAR ' + sobran.length + ' avisos repetidos en Mercado Libre.\n\n' +
        'De cada aro repetido se conserva el que tiene ventas; se cierran los demás.\n' +
        'Los cerrados dejan de aparecer, pero quedan en tu historial.\n\n¿Seguimos?')) return;
      b.disabled = true;
      const info = $('adm-ml-pubs-contador');
      let ok = 0; const malos = [];
      for (let i = 0; i < sobran.length; i++) {
        info.textContent = 'Cerrando ' + (i + 1) + ' de ' + sobran.length + '…';
        try { await mlCerrarAviso(sobran[i].id); ok++; }
        catch (err) { malos.push(sobran[i].titulo + ': ' + err.message); }
      }
      mlPintarPubs();
      info.textContent = '✓ Cerrados ' + ok + ' de ' + sobran.length +
        (malos.length ? ' · no se pudo con ' + malos.length + ' (' + malos[0] + ')' : '');
      b.disabled = false;
    });

    document.addEventListener('click', async (e) => {
      const bG = e.target.closest('button[data-role="ml-guardar-pub"]');
      const bP = e.target.closest('button[data-role="ml-pausar"]');
      if (!bG && !bP) return;
      const caja = (bG || bP).closest('.ml-pub'); if (!caja) return;
      const msg = caja.querySelector('.ml-pub-msg');
      const itemId = caja.dataset.item;
      const cuerpo = { accion: 'ml-actualizar', itemId: itemId };
      if (bG) {
        cuerpo.precio = caja.querySelector('[data-role="ml-precio"]').value;
        cuerpo.stock = caja.querySelector('[data-role="ml-stock"]').value;
      } else {
        cuerpo.estado = bP.dataset.estado === 'active' ? 'paused' : 'active';
        if (!window.confirm(cuerpo.estado === 'paused'
          ? 'La publicación se va a pausar: deja de aparecer y nadie puede comprarla. ¿Seguimos?'
          : 'La publicación se va a activar y vuelve a quedar a la venta. ¿Seguimos?')) return;
      }
      (bG || bP).disabled = true;
      msg.textContent = 'Guardando…';
      try {
        const d = await mlPublicador(cuerpo);
        msg.textContent = (d && d.ok) ? '✓ Guardado en Mercado Libre' : ('❌ ' + ((d && d.error) || 'No se pudo guardar.'));
        if (d && d.ok && bP) mlCargarPubs();
      } catch (err) { msg.textContent = '❌ ' + err.message; }
      (bG || bP).disabled = false;
    });

    // revisar qué admite la cuenta (en vez de adivinar con los errores de ML)
    $('adm-ml-diagnostico').addEventListener('click', async () => {
      const btn = $('adm-ml-diagnostico');
      btn.disabled = true;
      mlCuenta('Preguntándole a Mercado Libre por tu cuenta…');
      try {
        const d = await mlPublicador({ accion: 'ml-diagnostico', categoria: String(settings.mlCategoria || '').trim() });
        mlCuenta((d && d.ok) ? (d.texto || 'Sin datos.') : ('❌ ' + ((d && d.error) || 'No se pudo.')));
      } catch (e) { mlCuenta('❌ ' + e.message); }
      btn.disabled = false;
    });

    // leer la configuración de envío de un aviso que YA está publicado y sirve
    let mlReceta = null;
    $('adm-ml-envio-ok').addEventListener('click', async () => {
      const btn = $('adm-ml-envio-ok');
      btn.disabled = true;
      mlCuenta('Mirando cómo quedaron tus avisos que ya funcionan…');
      $('adm-ml-receta-fila').hidden = true;
      try {
        const d = await mlPublicador({ accion: 'ml-envio-ok' });
        if (!d || !d.ok) { mlCuenta('❌ ' + ((d && d.error) || 'No se pudo.')); btn.disabled = false; return; }
        mlCuenta(d.texto || '');
        mlReceta = d.receta || null;
        $('adm-ml-receta-fila').hidden = !mlReceta;
      } catch (e) { mlCuenta('❌ ' + e.message); }
      btn.disabled = false;
    });

    $('adm-ml-usar-receta').addEventListener('click', () => {
      if (!mlReceta) return;
      const cambios = { mlEnvio: mlReceta.envio || '', mlEnvioGratis: !!mlReceta.envioGratis };
      if (mlReceta.categoria) cambios.mlCategoria = mlReceta.categoria;
      if (mlReceta.tipo) cambios.mlTipo = mlReceta.tipo;
      settingsRef.set(cambios, { merge: true })
        .then(() => { guardado('adm-ml-receta-ok'); mlCuenta('✓ Guardado. Ahora prueba de nuevo con «Probar sin publicar».'); })
        .catch(err => mlCuenta('❌ ' + err.message));
    });

    // ver (y volver a leer) el molde: la forma de un aviso que ya está vendiendo
    $('adm-ml-plantilla').addEventListener('click', async () => {
      const btn = $('adm-ml-plantilla');
      btn.disabled = true;
      mlCuenta('Leyendo el molde…');
      try {
        const d = await mlPublicador({ accion: 'ml-plantilla', forzar: true });
        mlCuenta((d && d.ok) ? (d.texto || '') : ('❌ ' + ((d && d.error) || 'No se pudo.')));
      } catch (e) { mlCuenta('❌ ' + e.message); }
      btn.disabled = false;
    });

    $('adm-ml-buscarcat').addEventListener('click', async () => {
      const p = products.filter(kvEnStock)[0];
      if (!p) { mlCuenta('No hay productos con stock para usar de ejemplo.'); return; }
      const n = $('adm-ml-catnombre'); if (n) n.textContent = 'Buscando…';
      try {
        const d = await mlPublicador({ accion: 'ml-categoria', titulo: kvMlTitulo(p, settings) });
        if (d && d.ok && d.categoria) {
          $('adm-ml-categoria').value = d.categoria;
          if (n) n.textContent = '→ ' + (d.nombre || d.categoria) + ' (revisa que corresponda y Guarda)';
        } else if (n) n.textContent = '❌ ' + ((d && d.error) || 'No se pudo averiguar.');
      } catch (e) { if (n) n.textContent = '❌ ' + e.message; }
    });

    // ---------- IA (Gemini principal / Groq respaldo) ----------
    // Las claves viven SOLO en este navegador (localStorage): la configuración del
    // catálogo es públicamente legible y guardarlas ahí las expondría.
    const IA_LS = { or: 'kv_ia_or', gem: 'kv_ia_gemini', groq: 'kv_ia_groq', pref: 'kv_ia_pref' };
    function iaKeys() {
      return {
        or: localStorage.getItem(IA_LS.or) || '',
        gem: localStorage.getItem(IA_LS.gem) || '',
        groq: localStorage.getItem(IA_LS.groq) || '',
        pref: localStorage.getItem(IA_LS.pref) || 'gemini'
      };
    }
    $('ia-guardar').addEventListener('click', () => {
      localStorage.setItem(IA_LS.or, $('ia-key-or').value.trim());
      localStorage.setItem(IA_LS.gem, $('ia-key-gemini').value.trim());
      localStorage.setItem(IA_LS.groq, $('ia-key-groq').value.trim());
      localStorage.setItem(IA_LS.pref, (document.querySelector('input[name="ia-pref"]:checked') || {}).value || 'gemini');
      _orModelosCache = null; _iaGemModelosCache = null;
      guardado('ia-keys-ok');
      iaORConsultarUso().then(renderIAUso);
      renderIAUso();
      // también se guardan escondidas en el publicador: el chat del catálogo las usa
      // y aparecerán solas en cualquier otro navegador donde configures la conexión
      sincronizarClavesIA().then(ok => {
        const el = $('ia-keys-ok');
        if (el && !el.hidden) el.textContent = ok ? '✓ Guardado aquí y en tu publicador (chat del catálogo ✓)' : '✓ Guardado en este navegador (no se pudo avisar al publicador)';
      });
    });
    (function poblarIAKeys() {
      const k = iaKeys();
      $('ia-key-or').value = k.or;
      $('ia-key-gemini').value = k.gem;
      $('ia-key-groq').value = k.groq;
      document.querySelectorAll('input[name="ia-pref"]').forEach(r => { r.checked = (r.value === k.pref); });
    })();

    // ---------- uso diario de cada IA (conteo local + estado real de OpenRouter) ----------
    function iaUsoDatos() {
      const hoy = new Date().toISOString().slice(0, 10);
      let u = {};
      try { u = JSON.parse(localStorage.getItem('kv_ia_uso') || '{}'); } catch (e) {}
      if (u.fecha !== hoy) u = { fecha: hoy, openrouter: 0, gemini: 0, groq: 0 };
      return u;
    }
    function iaUsoSumar(p) {
      const u = iaUsoDatos();
      u[p] = (u[p] || 0) + 1;
      localStorage.setItem('kv_ia_uso', JSON.stringify(u));
      renderIAUso();
    }
    let orInfo = null;
    async function iaORConsultarUso() {
      const k = iaKeys();
      if (!k.or) { orInfo = null; return; }
      for (const ep of ['https://openrouter.ai/api/v1/key', 'https://openrouter.ai/api/v1/auth/key']) {
        try {
          const r = await fetch(ep, { headers: { 'Authorization': 'Bearer ' + k.or } });
          if (r.ok) { const d = await r.json(); orInfo = d.data || d; return; }
        } catch (e) {}
      }
      orInfo = { error: true };
    }
    function renderIAUso() {
      const cont = $('ia-uso'); if (!cont) return;
      const k = iaKeys(); const u = iaUsoDatos();
      const fila = (nom, txts) => '<div class="ia-uso-fila"><div class="ia-uso-nombre">' + nom + '</div>' + txts.map(t => '<div class="ia-uso-det">' + t + '</div>').join('') + '</div>';
      let html = '';
      const orTxts = [];
      if (!k.or) orTxts.push('Sin clave configurada.');
      else {
        orTxts.push('Hoy: <b>' + (u.openrouter || 0) + '</b> solicitudes desde este navegador.');
        if (orInfo && !orInfo.error) {
          orTxts.push('Crédito usado: <b>US$ ' + (Number(orInfo.usage) || 0).toFixed(2) + '</b>' + (orInfo.limit != null ? ' de US$ ' + orInfo.limit : ' (sin tope de crédito)') + ' — los modelos <b>:free</b> no gastan crédito.');
          orTxts.push(orInfo.is_free_tier
            ? 'Cuenta gratis: ~<b>50 solicitudes al día</b> a modelos gratis (sube a ~1.000/día si cargas US$10 una sola vez).'
            : 'Cuenta con crédito: hasta ~<b>1.000 solicitudes al día</b> a modelos gratis.');
        } else if (orInfo && orInfo.error) orTxts.push('⚠ No se pudo consultar el estado de la clave (revisa que sea válida).');
      }
      html += fila('🌐 OpenRouter — principal', orTxts);
      html += fila('✨ Gemini — respaldo', [k.gem
        ? 'Hoy: <b>' + (u.gemini || 0) + '</b> solicitudes desde este navegador. Límite gratis aproximado: ~1.000/día con flash-lite (Google no permite consultar cuánto te queda).'
        : 'Sin clave configurada.']);
      html += fila('⚡ Groq — respaldo', [k.groq
        ? 'Hoy: <b>' + (u.groq || 0) + '</b> solicitudes desde este navegador. Límite gratis aproximado: ~1.000/día según el modelo (Groq tampoco permite consultarlo).'
        : 'Sin clave configurada.']);
      cont.innerHTML = html;
    }
    const iaUsoBtn = $('ia-uso-refrescar');
    if (iaUsoBtn) iaUsoBtn.addEventListener('click', async () => { await iaORConsultarUso(); renderIAUso(); });
    renderIAUso();
    iaORConsultarUso().then(renderIAUso);

    // lista por defecto, del que MENOS consume (lite) al que más; se actualiza sola con la lista real de Google
    const IA_GEM_MODELOS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    const IA_GROQ_TXT = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    const IA_GROQ_VIS = ['meta-llama/llama-4-scout-17b-16e-instruct'];
    let _iaGemModelosCache = null;

    // pregunta a Google qué modelos hay disponibles y los ordena del que menos consume al que más
    async function iaGemModelos(key) {
      if (_iaGemModelosCache) return _iaGemModelosCache;
      try {
        const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key));
        const d = await r.json();
        if (d && d.models) {
          const disp = d.models
            .filter(m => (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0)
            .map(m => (m.name || '').replace(/^models\//, ''))
            .filter(n => /^gemini/.test(n) && /flash|lite/.test(n) && !/pro|vision|embedding|image|tts|audio/.test(n));
          // menor puntaje = menos consumo/más cuota gratis: primero los "lite" y los estables
          const puntaje = n => (/lite/.test(n) ? 0 : 100) + (/(exp|preview|thinking)/.test(n) ? 30 : 0) + (/latest/.test(n) ? 5 : 0);
          disp.sort((a, b) => puntaje(a) - puntaje(b));
          if (disp.length) { _iaGemModelosCache = disp; return disp; }
        }
      } catch (e) {}
      return IA_GEM_MODELOS;
    }

    async function iaGemini(key, msgs) {
      const sys = msgs.find(m => m.role === 'system');
      const contents = msgs.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }].concat((m.images || []).map(b => ({ inline_data: { mime_type: 'image/jpeg', data: b } })))
      }));
      const body = { contents: contents };
      if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };
      let ultimo = '';
      const modelos = await iaGemModelos(key);
      for (const modelo of modelos) {
        const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent?key=' + encodeURIComponent(key), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          const t = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts.map(p => p.text || '').join('');
          if (t) return t;
          ultimo = 'respuesta vacía';
        } else {
          ultimo = (d.error && d.error.message) || ('HTTP ' + r.status);
          // prueba otro modelo si éste no existe (404/400) o si se agotó su cuota (429): cada modelo tiene su propio límite
          if (r.status !== 404 && r.status !== 400 && r.status !== 429) break;
        }
      }
      throw new Error('Gemini: ' + ultimo);
    }

    // ---------- OpenRouter (principal): modelos GRATIS, priorizando los Gemini con visión ----------
    const IA_OR_FALLBACK = ['google/gemini-2.0-flash-exp:free', 'meta-llama/llama-4-maverick:free', 'qwen/qwen2.5-vl-72b-instruct:free', 'mistralai/mistral-small-3.1-24b-instruct:free'];
    let _orModelosCache = null;
    // pregunta a OpenRouter qué modelos gratis hay y los ordena: Gemini primero (lee mejor las fotos)
    async function iaORModelos() {
      if (_orModelosCache) return _orModelosCache;
      try {
        const r = await fetch('https://openrouter.ai/api/v1/models');
        const d = await r.json();
        if (d && d.data) {
          const libres = d.data.filter(m => m.pricing && parseFloat(m.pricing.prompt || '1') === 0 && parseFloat(m.pricing.completion || '1') === 0);
          const conVision = libres.filter(m => {
            const a = m.architecture || {};
            return ((a.input_modalities || []).join(',') + ',' + (a.modality || '')).indexOf('image') >= 0;
          });
          const punt = id => (/google\/gemini/.test(id) ? 0 : /llama/.test(id) ? 10 : /qwen/.test(id) ? 20 : 30) + (/preview|exp/.test(id) ? 1 : 0);
          const ids = (conVision.length ? conVision : libres).map(m => m.id).sort((a, b) => punt(a) - punt(b)).slice(0, 5);
          if (ids.length) { _orModelosCache = ids; return ids; }
        }
      } catch (e) {}
      return IA_OR_FALLBACK;
    }

    async function iaOpenRouter(key, msgs) {
      const messages = msgs.map(m => {
        if (m.images && m.images.length) {
          return { role: m.role, content: [{ type: 'text', text: m.content }].concat(m.images.map(b => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b } }))) };
        }
        return { role: m.role, content: m.content };
      });
      let ultimo = '';
      const modelos = await iaORModelos();
      for (const modelo of modelos) {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({ model: modelo, messages: messages, temperature: 0.7 })
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          const t = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
          if (t) return t;
          ultimo = (d.error && d.error.message) || 'respuesta vacía';
        } else {
          ultimo = (d.error && d.error.message) || ('HTTP ' + r.status);
          // con estos códigos vale la pena probar el siguiente modelo; con otros (ej. clave mala) no
          if ([400, 402, 404, 408, 429, 502, 503].indexOf(r.status) < 0) break;
        }
      }
      throw new Error('OpenRouter: ' + ultimo);
    }

    async function iaGroq(key, msgs, conImagenes) {
      const modelos = conImagenes ? IA_GROQ_VIS.concat(IA_GROQ_TXT) : IA_GROQ_TXT;
      const messages = msgs.map(m => {
        if (m.images && m.images.length) {
          return { role: m.role, content: [{ type: 'text', text: m.content }].concat(m.images.map(b => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b } }))) };
        }
        return { role: m.role, content: m.content };
      });
      let ultimo = '';
      for (const modelo of modelos) {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({ model: modelo, messages: messages, temperature: 0.7 })
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          const t = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
          if (t) return t;
          ultimo = 'respuesta vacía';
        } else {
          ultimo = (d.error && d.error.message) || ('HTTP ' + r.status);
          if (r.status !== 404 && r.status !== 400) break;
        }
      }
      throw new Error('Groq: ' + ultimo);
    }

    // popup: muestra el error de la IA principal y pregunta si usar la de respaldo
    function iaPopupCambiar(principal, err, respaldo) {
      return new Promise(resolve => {
        const pop = $('ia-pop'); if (!pop) { resolve(true); return; }
        $('ia-pop-tit').textContent = '⚠ ' + principal + ' no pudo responder';
        $('ia-pop-msg').innerHTML = '<b>Motivo (' + escapeHtml(principal) + '):</b><br>' + escapeHtml(err) +
          '<br><br>¿Quieres intentar con <b>' + escapeHtml(respaldo) + '</b> (tu IA de respaldo)?';
        $('ia-pop-si').textContent = 'Sí, usar ' + respaldo;
        pop.hidden = false;
        const cerrar = val => { pop.hidden = true; $('ia-pop-si').onclick = null; $('ia-pop-no').onclick = null; resolve(val); };
        $('ia-pop-si').onclick = () => cerrar(true);
        $('ia-pop-no').onclick = () => cerrar(false);
      });
    }

    /* cadena de IAs: OpenRouter primero; si falla, popup con el error y pregunta si usar el siguiente respaldo */
    async function iaLlamar(msgs, conImagenes) {
      const k = iaKeys();
      const nombre = { openrouter: 'OpenRouter', gemini: 'Gemini', groq: 'Groq' };
      const hayKey = p => p === 'openrouter' ? !!k.or : p === 'gemini' ? !!k.gem : !!k.groq;
      const correr = p => p === 'openrouter' ? iaOpenRouter(k.or, msgs) : p === 'gemini' ? iaGemini(k.gem, msgs) : iaGroq(k.groq, msgs, conImagenes);
      const respaldos = k.pref === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq'];
      const cadena = ['openrouter'].concat(respaldos).filter(hayKey);
      if (!cadena.length) throw new Error('No hay claves de IA. Ponlas en la pestaña "Asistente IA".');
      for (let i = 0; i < cadena.length; i++) {
        const p = cadena[i];
        try {
          iaUsoSumar(p);
          return await correr(p);
        } catch (err) {
          const sig = cadena[i + 1];
          if (!sig) throw err;                                        // no queda respaldo: se muestra este error
          const usar = await iaPopupCambiar(nombre[p], err.message, nombre[sig]);
          if (!usar) throw err;                                       // eligió no cambiar: conserva el error
        }
      }
    }

    /* miniatura base64 (sin encabezado) de una foto, para enviarla a la IA */
    function iaMiniatura(src, max) {
      return kvCargarImagen(src).then(img => {
        if (!img) return null;
        const c = document.createElement('canvas');
        const s = Math.min(1, (max || 512) / Math.max(img.width, img.height));
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', 0.8).split(',')[1];
      });
    }

    const IA_SISTEMA_MARCA = 'Eres la community manager de Karivé Joyas, una marca chilena de joyas artesanales hechas a mano (arcilla polimérica, miyuki, mostacillas). Escribes en español de Chile, con tono cálido y cercano. La marca solo hace envíos a todo Chile (NO hay retiros) y los pedidos son por DM de Instagram.\n\n' +
      'GUÍA DE ESTILO (basada en lo que mejor funciona en cuentas de joyería artesanal exitosas — síguela siempre):\n' +
      '- Parte con un GANCHO breve que conecte con una emoción o un momento de uso (ej: "Ese detalle que transforma un look sencillo…", "Para regalarte o sorprender a alguien especial…", o una pregunta directa). NUNCA partas con fórmulas planas tipo "Descubre nuestra nueva colección".\n' +
      '- Vende el SIGNIFICADO, no la ficha técnica: qué transmite la pieza, cómo se siente usarla, para qué ocasión sirve (regalo, uso diario, fecha especial).\n' +
      '- Destaca el valor de lo hecho a mano: cada pieza es única, hay dedicación y detalle detrás, es apoyar un emprendimiento chileno.\n' +
      '- Tono de emprendimiento profesional y serio, pero cercano y humano. Emojis con moderación (3 a 6 en todo el post), nada recargado.\n' +
      '- Cierra siempre con una llamada a la acción clara antes de las líneas fijas.\n' +
      '- LÍNEAS FIJAS DE LA MARCA (van siempre al final del post, cada una en su propia línea, y NUNCA las borres ni las cambies):\n' +
      '💜 Hecho a mano con mucho amor\n📩 Pedidos por DM\n🚚 Envíos a todo Chile';

    // datos reales de los productos elegidos, para que la IA los mencione por su nombre
    function igIAContexto(prods) {
      const l = prods.map(p => '- ' + (p.name || '') + ' (colección ' + kvCat(p.category, settings).nombre + ')' + (p.detail ? ', ' + p.detail : ''));
      return 'Productos de esta publicación (menciónalos por su nombre real):\n' + l.join('\n');
    }

    const KV_CATALOGO_URL = 'https://karivejoyas.github.io/catalogo/';
    // contexto GENERAL: solo las colecciones, sin nombres ni precios de productos
    function igIAContextoGeneral(prods) {
      const cols = [...new Set(prods.map(p => kvCat(p.category, settings).nombre).filter(Boolean))];
      return cols.length ? 'Colecciones que aparecen en las fotos: ' + cols.join(', ') + '.' : '';
    }

    // --- botón: descripción con IA (general, inspirada en las fotos, sin nombres ni precios) ---
    $('ig-m-ia-desc').addEventListener('click', async () => {
      const prods = products.filter(p => igSel.has(p.id));
      if (!prods.length) return;
      const btn = $('ig-m-ia-desc');
      btn.disabled = true; igEstado('✨ La IA está mirando tus joyas…');
      try {
        const imgs = [];
        for (const p of prods.slice(0, 4)) { const b = await iaMiniatura(p.photo, 512); if (b) imgs.push(b); }
        const tags = igTagsActivos();
        const texto = await iaLlamar([
          { role: 'system', content: IA_SISTEMA_MARCA },
          { role: 'user', content: 'Escribe una descripción atractiva para un post de Instagram, inspirándote en las fotos (su estilo, colores, lo hechas a mano).\n' +
            'REGLAS:\n' +
            '- SÍ puedes hablar del TIPO o TEMA de las joyas que se ven (por ejemplo: si son corazones, flores, mariposas…) y describir ese estilo de forma general y bonita.\n' +
            '- NO menciones nombres de productos, NI precios, NI enumeres los colores uno por uno (nada de "el corazón rojo, el verde, el azul…"). Habla del conjunto, no de piezas individuales.\n' +
            '- Invita a ver el catálogo completo así: una línea que diga "🔗 Míralo en el link de nuestra bio" y, en la línea de abajo, el enlace tal cual: ' + KV_CATALOGO_URL + '\n' +
            '- Termina con las 3 líneas fijas de la marca (💜 Hecho a mano con mucho amor / 📩 Pedidos por DM / 🚚 Envíos a todo Chile), cada una en su línea.\n' +
            '- Texto bien espaciado (frases cortas con saltos de línea), cálido y natural.\n\n' +
            igIAContextoGeneral(prods) + (tags.length ? '\n\nAgrega al final, en su propia línea, estos hashtags tal cual:\n' + tags.join(' ') : '') +
            '\n\nResponde SOLO con la descripción, sin comentarios.', images: imgs }
        ], imgs.length > 0);
        $('ig-m-caption').value = texto.trim();
        igEstado('✨ Descripción generada — revísala y edítala si quieres.');
      } catch (err) { igEstado('❌ IA: ' + err.message); }
      btn.disabled = false;
    });

    // --- pedirle un cambio a la IA escribiendo libremente (sin límites) ---
    async function igIAAplicar() {
      const pedido = $('ig-m-ia-pedido').value.trim();
      if (!pedido) { igEstado('Escribe primero qué quieres (ej: "hazla elegante y menciona los aros de media flor").'); return; }
      const prods = products.filter(p => igSel.has(p.id));
      const btn = $('ig-m-ia-aplicar');
      btn.disabled = true; igEstado('✨ Trabajando en tu pedido…');
      try {
        const actual = $('ig-m-caption').value;
        const texto = await iaLlamar([
          { role: 'system', content: IA_SISTEMA_MARCA + '\n\n' + igIAContexto(prods) + '\n\nREGLAS DE FORMATO (respétalas siempre):\n' +
            '- Devuelve el texto BIEN ESPACIADO, como un post real de Instagram: frases cortas, con saltos de línea y una línea en blanco entre bloques. NUNCA lo dejes todo pegado en un solo párrafo.\n' +
            '- Conserva SIEMPRE las 3 líneas fijas del cierre, cada una en su propia línea: "💜 Hecho a mano con mucho amor", "📩 Pedidos por DM" y "🚚 Envíos a todo Chile". Si alguna falta en el texto actual, agrégala. NUNCA las borres aunque el pedido parezca implicarlo.\n' +
            '- Si el texto actual trae hashtags al final, déjalos en su propia línea al final (a menos que te pidan quitarlos).\n' +
            '- Modifica SOLO lo que la usuaria pide; el resto de la estructura la mantienes.' },
          { role: 'user', content: 'Este es el texto actual del post (respétale la estructura y el espaciado):\n---\n' + actual + '\n---\n\nHaz esto que te pido: ' + pedido + '\n\nUsa los nombres reales de los productos cuando corresponda. Responde SOLO con la descripción final, ya formateada con sus saltos de línea, sin explicaciones ni comentarios.' }
        ], false);
        $('ig-m-caption').value = texto.trim();
        $('ig-m-ia-pedido').value = '';
        igEstado('✨ Listo — revisa cómo quedó.');
      } catch (err) { igEstado('❌ IA: ' + err.message); }
      btn.disabled = false;
    }
    $('ig-m-ia-aplicar').addEventListener('click', igIAAplicar);
    $('ig-m-ia-pedido').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); igIAAplicar(); } });

    // --- botón: hashtags nuevos con IA (se agregan tocándolos) ---
    $('ig-m-ia-tags').addEventListener('click', async () => {
      const prods = products.filter(p => igSel.has(p.id));
      if (!prods.length) return;
      const btn = $('ig-m-ia-tags');
      btn.disabled = true; igEstado('#️⃣ Buscando hashtags nuevos…');
      try {
        const datos = prods.map(p => p.name + ' (' + kvCat(p.category, settings).nombre + ')').join(', ');
        const actuales = igTagsActivos().join(' ');
        const texto = await iaLlamar([
          { role: 'system', content: IA_SISTEMA_MARCA },
          { role: 'user', content: 'Sugiere 8 hashtags NUEVOS y relevantes en español para un post de Instagram con: ' + datos + '. NO repitas ninguno de estos: ' + actuales + '. Responde SOLO los hashtags separados por espacios.' }
        ], false);
        const ya = igTagsActivos().map(t => t.toLowerCase());
        const sugs = [];
        (texto.match(/#[\wáéíóúñÁÉÍÓÚÑ]+/g) || []).forEach(t => {
          if (ya.indexOf(t.toLowerCase()) === -1 && sugs.map(x => x.toLowerCase()).indexOf(t.toLowerCase()) === -1) sugs.push(t);
        });
        if (!sugs.length) { igEstado('La IA no encontró hashtags nuevos. Intenta de nuevo.'); btn.disabled = false; return; }
        const cont = $('ig-m-sugeridos');
        cont.innerHTML = sugs.slice(0, 10).map(t => '<button type="button" class="ig-tag" data-tag="' + escapeHtml(t) + '">+ ' + escapeHtml(t) + '</button>').join('');
        cont.querySelectorAll('.ig-tag').forEach(n => n.addEventListener('click', e => {
          const tag = e.currentTarget.dataset.tag;
          const ta = $('ig-m-caption');
          ta.value = ta.value.replace(/\s*$/, '') + ' ' + tag;   // lo agrega al final de la descripción
          e.currentTarget.disabled = true; e.currentTarget.classList.add('is-on');
        }));
        igEstado('Toca los hashtags que quieras agregar a la descripción. 👇');
      } catch (err) { igEstado('❌ IA: ' + err.message); }
      btn.disabled = false;
    });

    // --- asistente de chat sobre el catálogo ---
    const iaHist = [];
    function contextoCatalogo() {
      const cats = kvCategorias(settings);
      let s = 'CATÁLOGO ACTUAL DE KARIVÉ JOYAS\n';
      cats.forEach(c => {
        const items = products.filter(p => p.category === c.id);
        if (!items.length) return;
        s += '\n' + c.nombre + ' (' + items.length + ' productos):\n';
        items.forEach(p => {
          const of = kvPrecioOferta(p);
          s += '- ' + (p.code || '') + ' ' + (p.name || '') + ' · ' + formatCLP(p.price) + (of ? ' (en oferta a ' + formatCLP(of) + ')' : '') + (kvEnStock(p) ? '' : ' [SIN STOCK]') + '\n';
        });
      });
      const huer = products.filter(p => !cats.some(c => c.id === p.category));
      if (huer.length) { s += '\nSin colección:\n'; huer.forEach(p => { s += '- ' + (p.code || '') + ' ' + (p.name || '') + ' · ' + formatCLP(p.price) + '\n'; }); }
      s += '\nContacto: Instagram ' + (settings.instagram || '') + ' · Facebook ' + (settings.facebook || '') + ' · WhatsApp ' + (settings.whatsapp || '');
      s += '\nCatálogo web: https://karivejoyas.github.io/catalogo/';
      return s.slice(0, 9000);
    }
    function iaChatAdd(rol, texto) {
      const div = document.createElement('div');
      div.className = 'ia-msg ia-' + rol;
      div.textContent = texto;
      $('ia-chat').appendChild(div);
      $('ia-chat').scrollTop = $('ia-chat').scrollHeight;
      return div;
    }
    async function iaPreguntar() {
      const q = $('ia-preg').value.trim();
      if (!q) return;
      $('ia-preg').value = '';
      iaChatAdd('user', q);
      iaHist.push({ role: 'user', content: q });
      while (iaHist.length > 12) iaHist.shift();
      const pensando = iaChatAdd('bot', 'Pensando…');
      pensando.classList.add('ia-pensando');
      try {
        const resp = await iaLlamar([
          { role: 'system', content: IA_SISTEMA_MARCA + ' Responde breve y útil, usando SOLO estos datos reales del catálogo (no inventes productos ni precios):\n\n' + contextoCatalogo() }
        ].concat(iaHist), false);
        iaHist.push({ role: 'assistant', content: resp });
        pensando.classList.remove('ia-pensando');
        pensando.textContent = resp;
      } catch (err) {
        pensando.classList.remove('ia-pensando');
        pensando.textContent = '⚠ ' + err.message;
      }
      $('ia-chat').scrollTop = $('ia-chat').scrollHeight;
    }
    $('ia-enviar').addEventListener('click', iaPreguntar);
    $('ia-preg').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); iaPreguntar(); } });

    // ---------- conexión con el publicador ----------
    // La URL va a la base (el catálogo la necesita para el chat), pero la CLAVE queda
    // SOLO en este navegador: la configuración de la base es públicamente legible y
    // guardarla ahí dejaría el publicador abierto a cualquiera.
    function pubClave() { return A.pubClave(); }

    // empuja las claves de IA al publicador: quedan escondidas en Google y las usa el chat del catálogo
    async function sincronizarClavesIA() {
      const url = String(settings.igPubUrl || '').trim(), clave = pubClave();
      if (!url || !clave) return false;
      const k = iaKeys();
      if (!k.or && !k.gem && !k.groq) return false;   // sin claves aquí: no borrar las de la bóveda
      try {
        const r = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'config', clave: clave, claves: { or: k.or, gemini: k.gem, groq: k.groq } })
        });
        const d = await r.json();
        return !!(d && d.ok);
      } catch (e) { return false; }
    }

    // trae las claves guardadas en el publicador, para que aparezcan solas en cualquier navegador
    let clavesTraidas = false;
    async function traerClavesIA() {
      const k = iaKeys();
      if (k.or || k.gem || k.groq) return;               // este navegador ya las tiene
      const url = String(settings.igPubUrl || '').trim(), clave = pubClave();
      if (!url || !clave || clavesTraidas) return;
      clavesTraidas = true;
      try {
        const r = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'config', clave: clave, leer: true })
        });
        const d = await r.json();
        if (d && d.ok && d.claves) {
          if (d.claves.or) localStorage.setItem(IA_LS.or, d.claves.or);
          if (d.claves.gemini) localStorage.setItem(IA_LS.gem, d.claves.gemini);
          if (d.claves.groq) localStorage.setItem(IA_LS.groq, d.claves.groq);
          $('ia-key-or').value = d.claves.or || '';
          $('ia-key-gemini').value = d.claves.gemini || '';
          $('ia-key-groq').value = d.claves.groq || '';
          renderIAUso();
          iaORConsultarUso().then(renderIAUso);
        }
      } catch (e) {}
    }

    function descargarPostIG(id, btn) {
      const p = products.find(x => x.id === id); if (!p) return Promise.resolve();
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando…'; }
      return kvGenerarPostIG(p, settings).then(url => {
        const a = document.createElement('a');
        a.href = url; a.download = 'karive-' + (p.code || id) + '.jpg';
        document.body.appendChild(a); a.click(); a.remove();
        if (btn) { btn.disabled = false; btn.textContent = '✓ Descargada'; setTimeout(() => { btn.textContent = '⬇ Imagen'; }, 1800); }
      }).catch(err => { console.error('Error generando post:', err); if (btn) { btn.disabled = false; btn.textContent = '⬇ Imagen'; } });
    }

    function copiarCaptionIG(id, btn) {
      const p = products.find(x => x.id === id); if (!p) return;
      const txt = kvCaptionIG(p, settings);
      const ok = () => { if (btn) { btn.textContent = '✓ Copiado'; setTimeout(() => { btn.textContent = '📋 Texto'; }, 1800); } };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok).catch(() => window.prompt('Copia el texto:', txt));
      else window.prompt('Copia el texto:', txt);
    }

    $('adm-ig-todas').addEventListener('click', async () => {
      const enStock = products.filter(kvEnStock);
      if (!enStock.length) return;
      if (!window.confirm('Se descargarán ' + enStock.length + ' imágenes, una por una. Puede que tu navegador pida permiso para descargas múltiples. ¿Continuar?')) return;
      const btn = $('adm-ig-todas'); btn.disabled = true;
      for (let i = 0; i < enStock.length; i++) {
        btn.textContent = 'Descargando ' + (i + 1) + '/' + enStock.length + '…';
        await descargarPostIG(enStock[i].id);
        await new Promise(r => setTimeout(r, 700));
      }
      btn.disabled = false; btn.textContent = '⬇ Descargar todas las imágenes';
    });

    return { renderIG: renderIG, renderML: renderML, poblarML: poblarML, traerClavesIA: traerClavesIA, renderIAUso: renderIAUso, alCambiarPestana: alCambiarPestana, igPintarResumen: igPintarResumen };
  }

  // ---------- carga (una sola vez) ----------
  let montaje = null;
  function montar() {
    if (montaje) return montaje;
    montaje = (async () => {
      const s = A.$('script[src*="apps.js"]');
      const v = s ? (s.getAttribute('src').split('v=')[1] || '') : '';
      const r = await fetch('apps.html?v=' + v);
      if (!r.ok) throw new Error('No se pudo cargar apps.html (' + r.status + ')');
      const caja = document.createElement('div');
      caja.innerHTML = await r.text();
      const guarda = document.createElement('div');
      guarda.className = 'apps-guarda'; guarda.hidden = true;
      caja.querySelectorAll('[data-app]').forEach(p => { paneles[p.dataset.app] = p; guarda.appendChild(p); });
      document.body.appendChild(guarda);
      const modales = caja.querySelector('.apps-modales');
      if (modales) document.body.appendChild(modales);
      settings = A.settings || {};
      apps = iniciar();
      poblarCampos();
      await new Promise((listo) => {
        itemsCol.orderBy('order').onSnapshot((snap) => {
          products = snap.docs.map(d => conFoto(Object.assign({ id: d.id }, d.data())));
          try { apps.renderIG(); apps.renderML(); } catch (e) { console.error(e); }
          listo();
        }, (err) => { console.error('Error leyendo productos:', err); listo(); });
      });
    })();
    montaje.catch(() => { montaje = null; });
    return montaje;
  }
  function poblarCampos() {
    const cap = $('adm-ig-caption');
    if (cap && activo() !== cap) cap.value = settings.igCaption != null ? settings.igCaption : KV_IG_CAPTION_DEFAULT;
  }
  // cuando cambia la configuración, las apps se ponen al día
  const refrescar = A.refrescar;
  A.refrescar = function (tipo) {
    if (tipo === 'settings' && apps) {
      settings = A.settings || {};
      try { apps.renderIG(); apps.poblarML(); apps.renderML(); poblarCampos(); } catch (e) { console.error(e); }
    }
    return refrescar.apply(this, arguments);
  };
  // al salir de una app, su bloque vuelve a su lugar (con todo lo que tenía)
  window.addEventListener('hashchange', () => {
    const guarda = A.$('.apps-guarda'); if (!guarda) return;
    Object.keys(paneles).forEach(k => { if (!guarda.contains(paneles[k]) && !paneles[k].isConnected) guarda.appendChild(paneles[k]); });
  });

  // ---------- colecciones desplegables y buscador (Publicar) ----------
  const gruposAbiertos = new Set();
  function grupoHtml(id, nombre, n, filas, arriba, extra) {
    return '<details class="app-grupo" id="' + id + '"' + (gruposAbiertos.has(id) ? ' open' : '') + '><summary>' +
      '<span class="app-grupo-nom">' + A.h(nombre) + '</span><span class="app-grupo-n">' + n + '</span>' +
      (extra ? '<span class="app-grupo-extra">' + A.h(extra) + '</span>' : '') + '<span class="app-grupo-sel" data-sel></span>' +
      '<svg class="chev" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</summary><div class="app-grupo-c">' + (arriba || '') + filas + '</div></details>';
  }
  function conectarGrupos(cont) {
    if (!cont) return;
    cont.querySelectorAll('details.app-grupo').forEach(d => d.addEventListener('toggle', () => {
      if (cont.dataset.buscando) return;                 // el buscador abre y cierra solo
      if (d.open) gruposAbiertos.add(d.id); else gruposAbiertos.delete(d.id);
    }));
    buscarEn(cont);
  }
  function contarGrupos(cont, rol) {
    if (!cont) return;
    cont.querySelectorAll('details.app-grupo').forEach(d => {
      const n = d.querySelectorAll('input[data-role="' + rol + '"]:checked').length, el = d.querySelector('[data-sel]');
      if (el) el.textContent = n ? '✓ ' + n + ' marcado' + (n > 1 ? 's' : '') : '';
    });
  }
  /* filtra los productos de la lista por nombre o código; abre las colecciones con resultados */
  function buscarEn(cont) {
    const caja = cont && cont.parentNode && cont.parentNode.querySelector('.app-buscar[data-lista="' + cont.id + '"] input');
    const q = A.sinTildes((caja && caja.value || '').trim());
    if (q) cont.dataset.buscando = '1'; else delete cont.dataset.buscando;
    let total = 0;
    cont.querySelectorAll('details.app-grupo').forEach(d => {
      let n = 0;
      d.querySelectorAll('.ig-fila').forEach(f => {
        const ok = !q || A.sinTildes(f.querySelector('.ig-info') ? f.querySelector('.ig-info').textContent : f.textContent).indexOf(q) !== -1;
        f.hidden = !ok; if (ok) n++;
      });
      total += n;
      d.hidden = !!q && !n;
      d.open = q ? n > 0 : gruposAbiertos.has(d.id);
    });
    const msg = cont.parentNode.querySelector('.app-buscar[data-lista="' + cont.id + '"] .app-buscar-msg');
    if (msg) msg.textContent = q ? (total ? total + ' resultado' + (total > 1 ? 's' : '') : 'Nada con «' + caja.value.trim() + '»') : '';
  }
  function prepararBuscador(panel) {
    panel.querySelectorAll('.app-buscar[data-lista]').forEach(b => {
      if (b.dataset.listo) return; b.dataset.listo = '1';
      b.innerHTML = '<div class="app-buscar-caja">' + A.ic.buscar + '<input type="search" class="adm-input" placeholder="Buscar por nombre o código…" aria-label="Buscar producto"></div>' +
        '<span class="app-buscar-msg"></span>' +
        '<button type="button" class="adm-btn-borde" data-todas="1">Abrir todas</button><button type="button" class="adm-btn-borde" data-todas="0">Cerrar todas</button>';
      const cont = () => panel.querySelector('#' + b.dataset.lista);
      b.querySelector('input').addEventListener('input', () => buscarEn(cont()));
      b.querySelectorAll('[data-todas]').forEach(x => x.addEventListener('click', () => {
        const c = cont(); if (!c) return;
        b.querySelector('input').value = '';
        c.querySelectorAll('details.app-grupo').forEach(d => { if (x.dataset.todas === '1') gruposAbiertos.add(d.id); else gruposAbiertos.delete(d.id); });
        buscarEn(c);
      }));
    });
  }

  // ---------- pestañas de cada app ----------
  const PESTANAS = {
    mercadolibre: [['resumen', '📊', 'Resumen'], ['publicar', '➕', 'Publicar'], ['ventas', '💰', 'Ventas'], ['avisos', '📦', 'Mis avisos'], ['calidad', '⭐', 'Calidad'], ['ajustes', '⚙️', 'Ajustes']],
    instagram: [['resumen', '📊', 'Resumen'], ['publicar', '➕', 'Publicar'], ['texto', '✍️', 'Texto y hashtags']],
    ia: [['preguntar', '💬', 'Preguntar'], ['claves', '🔑', 'Claves y uso']]
  };
  const pestanaGuardada = (app) => { try { return localStorage.getItem('kv_app_pest_' + app) || ''; } catch (e) { return ''; } };
  function pestanas(app, elegida) {
    const panel = paneles[app], defs = PESTANAS[app]; if (!panel || !defs) return;
    let nav = panel.querySelector('.app-pestanas');
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'app-pestanas'; nav.setAttribute('role', 'tablist');
      nav.innerHTML = defs.map(d => '<button type="button" role="tab" data-pest="' + d[0] + '"><span aria-hidden="true">' + d[1] + '</span>' + d[2] + '</button>').join('');
      panel.insertBefore(nav, panel.firstChild);
      nav.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pest]'); if (!b) return;
        pestanas(app, b.dataset.pest);
        // si estabas más abajo, la pestaña nueva se ve desde su comienzo
        const sup = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sup')) || 56;
        const y = panel.getBoundingClientRect().top + window.scrollY - sup - 8;
        if (window.scrollY > y) window.scrollTo(0, Math.max(0, y));
      });
      // secciones plegables (Ajustes, Texto y hashtags): se abren y cierran tocando el título
      panel.querySelectorAll('[data-pliegue]').forEach(sec => {
        const t = sec.querySelector('.adm-seccion-titulo'); if (!t) return;
        sec.classList.add('plegable'); if (sec.dataset.pliegue !== 'abierto') sec.classList.add('cerrado');
        t.setAttribute('role', 'button'); t.tabIndex = 0;
        t.insertAdjacentHTML('beforeend', '<svg class="chev" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>');
        const alternar = () => { sec.classList.toggle('cerrado'); t.setAttribute('aria-expanded', !sec.classList.contains('cerrado')); };
        t.setAttribute('aria-expanded', !sec.classList.contains('cerrado'));
        t.addEventListener('click', alternar);
        t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); } });
      });
      prepararBuscador(panel);
    }
    let k = elegida || pestanaGuardada(app);
    if (!defs.some(d => d[0] === k)) k = defs[0][0];
    try { localStorage.setItem('kv_app_pest_' + app, k); } catch (e) {}
    nav.querySelectorAll('[data-pest]').forEach(b => b.setAttribute('aria-selected', b.dataset.pest === k ? 'true' : 'false'));
    panel.querySelectorAll('[data-tab]').forEach(el => el.classList.toggle('fuera-pest', el.dataset.tab !== k));
    panel.dataset.pest = k;
    if (apps && apps.alCambiarPestana) apps.alCambiarPestana(app, k);
  }
  A.appPestana = (app, k) => pestanas(app, k);

  const APPS = {
    mercadolibre: { titulo: 'Mercado Libre', sub: 'Resumen de ventas, publicar, precios, stock y calidad de los avisos.' },
    instagram: { titulo: 'Instagram y Facebook', sub: 'Resumen de tus redes, imágenes de tus productos y publicaciones.' },
    ia: { titulo: 'Asistente IA', sub: 'Preguntas sobre tu catálogo y las claves de la IA (también las usa el chat de la web).' }
  };
  async function mostrar(vista, app) {
    const a = APPS[app];
    vista.innerHTML = '<div class="pag pag-app">' + A.cab(a.titulo, { volver: 'apps' }) +
      (A.pubUrl() && A.pubClave() ? '' : '<div class="nota">Para usar esta app falta conectar el publicador: <a href="#/config/notificaciones">Configuración → Notificaciones</a>.</div>') +
      '<div class="no-refrescar" id="apps-lugar">' + A.cargandoHtml + '</div></div>';
    const lugar = A.$('#apps-lugar', vista);
    try { await montar(); }
    catch (e) { lugar.innerHTML = '<div class="nota mal">No se pudo abrir la app: ' + A.h(e.message) + '</div>'; return; }
    if (!lugar.isConnected) return;               // ya te fuiste a otra página
    lugar.innerHTML = '';
    lugar.appendChild(paneles[app]);
    pestanas(app);
    if (app === 'mercadolibre') mlAlEntrar();
    if (app === 'ia') { apps.traerClavesIA(); apps.renderIAUso(); }
  }
  A.pagina('apps/mercadolibre', (v) => mostrar(v, 'mercadolibre'), []);
  A.pagina('apps/instagram', (v) => mostrar(v, 'instagram'), []);
  A.pagina('apps/ia', (v) => mostrar(v, 'ia'), []);

  // ---------- página de Apps ----------
  A.pagina('apps', function (vista) {
    const app = (ic, t, d, enlace) => '<div class="tarjeta app-tarjeta"><div class="app-ic">' + ic + '</div><div class="t"><b>' + t + '</b><small>' + d + '</small></div>' + enlace + '</div>';
    const ir = (r) => '<a class="btn" href="#/' + r + '">Abrir</a>';
    vista.innerHTML = '<div class="pag">' + A.cab('Apps') +
      app('🛒', APPS.mercadolibre.titulo, APPS.mercadolibre.sub, ir('apps/mercadolibre')) +
      app('📷', APPS.instagram.titulo, APPS.instagram.sub, ir('apps/instagram')) +
      app('✨', APPS.ia.titulo, APPS.ia.sub, ir('apps/ia')) +
      '<h2 style="font-size:15px;margin:22px 0 10px">Para Google</h2>' +
      app('🛍️', 'Google Merchant Center', 'Archivo de productos para Google Shopping. Se actualiza solo.', '<button class="btn" data-copiar="' + location.origin + '/catalogo-google.csv">Copiar enlace</button>') +
      app('🔎', 'Google Search Console', 'Mapa del sitio para que Google encuentre todas las páginas.', '<button class="btn" data-copiar="' + location.origin + '/sitemap.xml">Copiar enlace</button>') +
    '</div>';
    A.$$('[data-copiar]', vista).forEach(b => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copiar); A.toast('Enlace copiado: ' + b.dataset.copiar); } catch (e) { window.prompt('Copia el enlace:', b.dataset.copiar); }
    }));
  }, []);
})();
