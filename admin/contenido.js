/* Panel · Contenido: páginas de la web, archivos (imágenes) y opiniones. */
(function () {
  'use strict';
  const h = A.h;

  // ============================================================
  //  editor de texto con formato (para las páginas)
  // ============================================================
  A.editorRico = function (id, html) {
    return '<div class="rico" id="' + id + '"><div class="rico-barra">' +
      '<button type="button" data-cmd="bold" title="Negrita"><b>N</b></button><button type="button" data-cmd="italic" title="Cursiva"><i>K</i></button>' +
      '<span class="sepv"></span><button type="button" data-cmd="formatBlock" data-val="h2" title="Subtítulo">T</button><button type="button" data-cmd="formatBlock" data-val="p" title="Párrafo">¶</button>' +
      '<button type="button" data-cmd="insertUnorderedList" title="Lista">• —</button><button type="button" data-cmd="insertOrderedList" title="Lista numerada">1.</button>' +
      '<span class="sepv"></span><button type="button" data-cmd="createLink" title="Enlace">🔗</button><button type="button" data-cmd="unlink" title="Quitar enlace">⛓</button>' +
      '<button type="button" data-cmd="removeFormat" title="Quitar formato">✕</button><span class="sepv"></span><button type="button" data-html title="Ver el código HTML">&lt;/&gt;</button>' +
      '</div><div class="rico-area" contenteditable="true">' + (html || '') + '</div><textarea class="rico-html" hidden spellcheck="false"></textarea></div>';
  };
  A.conectarRico = function (caja, alCambiar) {
    const area = caja.querySelector('.rico-area'), cod = caja.querySelector('.rico-html');
    caja.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('mousedown', (e) => {
      e.preventDefault();
      let val = b.dataset.val || null;
      if (b.dataset.cmd === 'createLink') { val = window.prompt('Dirección del enlace (ej: /tienda/ o https://…)'); if (!val) return; }
      document.execCommand(b.dataset.cmd, false, val);
      alCambiar && alCambiar();
    }));
    caja.querySelector('[data-html]').addEventListener('click', () => {
      if (cod.hidden) { cod.value = area.innerHTML; cod.hidden = false; area.hidden = true; }
      else { area.innerHTML = cod.value; cod.hidden = true; area.hidden = false; }
    });
    area.addEventListener('input', () => alCambiar && alCambiar());
    cod.addEventListener('input', () => alCambiar && alCambiar());
    // al pegar desde Word o una web se pega solo el texto
    area.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
  };
  A.leerRico = function (caja) {
    const area = caja.querySelector('.rico-area'), cod = caja.querySelector('.rico-html');
    return (cod.hidden ? area.innerHTML : cod.value).replace(/<div><br><\/div>/g, '').trim();
  };

  // ============================================================
  //  páginas
  // ============================================================
  const FIJAS = [['nosotros', 'Nosotros', '/nosotros.html'], ['contacto', 'Contacto', '/contacto.html'], ['envios', 'Envíos', '/envios.html'],
    ['preguntas', 'Preguntas frecuentes', '/preguntas-frecuentes.html'], ['devoluciones', 'Cambios y devoluciones', '/devoluciones.html'], ['privacidad', 'Política de privacidad', '/privacidad.html']];
  const slug = (t) => A.sinTildes(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  A.pagina('contenido', (vista) => { A.ir('contenido/paginas'); }, []);
  A.pagina('contenido/paginas', function (vista) {
    const t = A.temaVigente();
    if (!t) { vista.innerHTML = A.cargandoHtml; return; }
    const extra = t.paginas.extra || [];
    vista.innerHTML = '<div class="pag">' + A.cab('Páginas', { acciones: '<a class="btn btn-primario" href="#/contenido/paginas/nueva">Agregar página</a>' }) + A.avisoPermisoWeb() +
      '<div class="tarjeta"><div class="tabla-env"><table class="tabla"><thead><tr><th>Título</th><th>Dirección</th><th>Estado</th></tr></thead><tbody>' +
      FIJAS.map(f => '<tr class="click" data-p="' + f[0] + '"><td><b>' + h((t.paginas[f[0]] || {}).titulo || f[1]) + '</b><div class="tenue">' + h(f[1]) + '</div></td><td class="tenue">' + h(f[2]) + '</td><td><span class="ins verde">Visible</span></td></tr>').join('') +
      extra.map((x, i) => '<tr class="click" data-p="extra-' + i + '"><td><b>' + h(x.titulo || 'Sin título') + '</b></td><td class="tenue">/paginas/' + h(slug(x.slug || x.titulo || '')) + '.html</td><td>' + (x.visible === false ? '<span class="ins">Oculta</span>' : '<span class="ins verde">Visible</span>') + '</td></tr>').join('') +
      '</tbody></table></div></div><p class="ayuda">Las páginas nuevas no aparecen solas en el menú: agrégalas en Tienda online → Navegación.</p></div>';
    A.$$('tr[data-p]', vista).forEach(tr => tr.addEventListener('click', () => A.ir('contenido/paginas/' + tr.dataset.p)));
  }, ['web']);

  A.pagina('contenido/paginas/:clave', function (vista, params) {
    const t = A.temaVigente();
    if (!t) { vista.innerHTML = A.cargandoHtml; return; }
    const nueva = params.clave === 'nueva';
    const esExtra = nueva || params.clave.indexOf('extra-') === 0;
    const idx = esExtra && !nueva ? +params.clave.slice(6) : -1;
    const fija = FIJAS.find(f => f[0] === params.clave);
    const pg = nueva ? { titulo: '', antetitulo: '', html: '<p></p>', seoTitulo: '', seoDesc: '', visible: true, slug: '' } : esExtra ? (t.paginas.extra || [])[idx] : t.paginas[params.clave];
    if (!pg) { vista.innerHTML = '<div class="pag">' + A.cab('Página', { volver: 'contenido/paginas' }) + '<div class="tarjeta">' + A.vacio('🔍', 'No encontramos esta página', '') + '</div></div>'; return; }
    const esFaq = params.clave === 'preguntas';
    const url = fija ? fija[2] : '/paginas/' + slug(pg.slug || pg.titulo || 'nueva') + '.html';
    let faq = esFaq ? A.copia(pg.items || []) : null;

    vista.innerHTML = '<div class="pag">' + A.cab(nueva ? 'Agregar página' : h(pg.titulo || (fija && fija[1]) || 'Página'), { volver: 'contenido/paginas', acciones: nueva ? '' : '<a class="btn" href="' + h(url) + '" target="_blank" rel="noopener">' + A.ic.ojo + ' Ver página</a>' }) + A.avisoPermisoWeb() +
      '<div class="dos-col no-refrescar" id="pg"><div>' +
        '<div class="tarjeta tarjeta-c">' +
          '<label class="campo"><span>Título</span><input id="pg-titulo" value="' + h(pg.titulo || '') + '"></label>' +
          '<label class="campo"><span>Texto pequeño sobre el título</span><input id="pg-ante" value="' + h(pg.antetitulo || '') + '" placeholder="Ej: Ayuda"></label>' +
          (esFaq ? '<span class="etq">Preguntas y respuestas</span><div id="pg-faq"></div><button class="btn btn-chico" id="pg-faq-mas">' + A.ic.mas + ' Agregar pregunta</button>'
            : '<span class="etq">Contenido</span>' + A.editorRico('pg-html', pg.html) +
              '<p class="ayuda mt">Puedes escribir <code>{envio_rm}</code> y <code>{envio_regiones}</code> para los costos de envío' + (params.clave === 'envios' ? ', y <code>{tabla_envios}</code> para la tabla' : '') + (params.clave === 'contacto' ? ', y <code>{tarjetas_contacto}</code> para los botones de WhatsApp, Instagram y correo' : '') + '. Se reemplazan solos.</p>') +
        '</div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Vista en buscadores</h2></div><div class="tarjeta-c">' +
          '<div style="border:1px solid var(--borde);border-radius:10px;padding:12px;margin-bottom:12px"><div style="color:#1a0dab;font-size:17px" id="pg-g-t"></div><div style="color:#006621;font-size:13px">karivejoyas.cl' + h(url) + '</div><div style="color:#545454;font-size:13px" id="pg-g-d"></div></div>' +
          '<label class="campo"><span>Título para Google</span><input id="pg-seot" value="' + h(pg.seoTitulo || '') + '" maxlength="70"><small id="pg-seot-n"></small></label>' +
          '<label class="campo"><span>Descripción para Google</span><textarea id="pg-seod" rows="3" maxlength="170">' + h(pg.seoDesc || '') + '</textarea><small id="pg-seod-n"></small></label>' +
        '</div></div>' +
        (esExtra && !nueva ? '<div class="derecha"><button class="btn btn-peligro" id="pg-borrar">' + A.ic.basura + ' Eliminar página</button></div>' : '') +
      '</div><div>' +
        (esExtra ? '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:10px">Visibilidad</h2>' + A.interruptor('pg-visible', pg.visible !== false, 'Publicada') +
          '<label class="campo"><span>Dirección</span><div class="campo-pre"><span>/paginas/</span><input id="pg-slug" value="' + h(slug(pg.slug || pg.titulo || '')) + '"></div></label></div>' :
          '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:6px">Dirección</h2><p class="ayuda" style="margin:0">karivejoyas.cl' + h(url) + '</p></div>') +
        '<div class="tarjeta tarjeta-c"><p class="ayuda" style="margin:0">Al guardar, la página se actualiza en la web en unos 5 a 8 minutos.</p></div>' +
      '</div></div></div>';

    const $ = (id) => A.$('#' + id, vista);
    const rico = $('pg-html');
    const pintarFaq = () => {
      $('pg-faq').innerHTML = faq.map((it, i) => '<div class="ed-lista-item"><div class="cab">Pregunta ' + (i + 1) +
        '<button class="mini" style="margin-left:auto;border:0;background:none;cursor:pointer" data-fsub="' + i + '"' + (i ? '' : ' disabled') + '>' + A.ic.arriba + '</button><button class="mini" data-fbaja="' + i + '"' + (i < faq.length - 1 ? '' : ' disabled') + ' style="border:0;background:none;cursor:pointer">' + A.ic.abajo + '</button><button class="mini" data-fborrar="' + i + '" style="border:0;background:none;cursor:pointer;color:var(--rojo)">' + A.ic.basura + '</button></div>' +
        '<input class="inp" data-fq="' + i + '" value="' + h(it.q) + '" placeholder="Pregunta" style="margin-bottom:6px"><textarea class="inp" data-fa="' + i + '" rows="3" placeholder="Respuesta">' + h(it.a) + '</textarea></div>').join('');
      A.$$('[data-fq]', vista).forEach(x => x.addEventListener('input', () => { faq[+x.dataset.fq].q = x.value; revisar(); }));
      A.$$('[data-fa]', vista).forEach(x => x.addEventListener('input', () => { faq[+x.dataset.fa].a = x.value; revisar(); }));
      A.$$('[data-fsub],[data-fbaja]', vista).forEach(x => x.addEventListener('click', () => {
        const i = +(x.dataset.fsub || x.dataset.fbaja), j = i + (x.dataset.fsub != null ? -1 : 1);
        const tmp = faq[i]; faq[i] = faq[j]; faq[j] = tmp; pintarFaq(); revisar();
      }));
      A.$$('[data-fborrar]', vista).forEach(x => x.addEventListener('click', () => { faq.splice(+x.dataset.fborrar, 1); pintarFaq(); revisar(); }));
    };
    if (esFaq) { pintarFaq(); $('pg-faq-mas').addEventListener('click', () => { faq.push({ q: '', a: '' }); pintarFaq(); revisar(); }); }

    const leer = () => {
      const o = { titulo: $('pg-titulo').value.trim(), antetitulo: $('pg-ante').value.trim(), seoTitulo: $('pg-seot').value.trim(), seoDesc: $('pg-seod').value.trim() };
      if (esFaq) o.items = faq.map(x => ({ q: x.q.trim(), a: x.a.trim() })); else o.html = A.leerRico(rico);
      if (esExtra) { o.visible = $('pg-visible').checked; o.slug = slug($('pg-slug').value || o.titulo); }
      return o;
    };
    const inicial = JSON.stringify(leer());
    const vistaGoogle = () => {
      const v = leer();
      $('pg-g-t').textContent = v.seoTitulo || (v.titulo ? v.titulo + ' | Karivé Joyas' : 'Título de la página');
      $('pg-g-d').textContent = v.seoDesc || 'Escribe una descripción corta para que Google muestre algo atractivo.';
      $('pg-seot-n').textContent = v.seoTitulo.length + ' de 60 caracteres recomendados';
      $('pg-seod-n').textContent = v.seoDesc.length + ' de 155 caracteres recomendados';
    };
    function revisar() {
      vistaGoogle();
      if (nueva || JSON.stringify(leer()) !== inicial) A.marcarCambios(guardar, () => { A.limpiarCambios(); A.repintar(); });
      else A.limpiarCambios();
    }
    vistaGoogle();
    if (rico) A.conectarRico(rico, revisar);
    A.$('#pg', vista).addEventListener('input', revisar);
    A.$('#pg', vista).addEventListener('change', revisar);
    if ($('pg-borrar')) $('pg-borrar').addEventListener('click', async () => {
      if (!(await A.confirmar('La página deja de existir en la web. Si está en el menú, quítala también de Navegación.', { titulo: '¿Eliminar página?', si: 'Eliminar', peligro: true }))) return;
      const tema = A.temaVigente(); tema.paginas.extra.splice(idx, 1);
      try { await A.guardarTemaVivo(tema); A.limpiarCambios(); A.toast('Página eliminada'); A.ir('contenido/paginas'); } catch (e) { A.errorGuardar(e); }
    });

    async function guardar() {
      const v = leer();
      if (!v.titulo) { A.avisar('Ponle un título a la página.'); return false; }
      const tema = A.temaVigente();
      if (esExtra) {
        tema.paginas.extra = tema.paginas.extra || [];
        const ocupado = FIJAS.some(f => slug(f[1]) === v.slug) || tema.paginas.extra.some((x, i) => i !== idx && slug(x.slug || x.titulo) === v.slug);
        if (ocupado) { A.avisar('Ya hay otra página con esa dirección. Cámbiala.'); return false; }
        if (nueva) tema.paginas.extra.push(v); else tema.paginas.extra[idx] = Object.assign({}, tema.paginas.extra[idx], v);
      } else tema.paginas[params.clave] = Object.assign({}, tema.paginas[params.clave], v);
      try {
        await A.guardarTemaVivo(tema);
        A.limpiarCambios(); A.toast('Página guardada ✓ Se verá en la web en unos minutos.');
        if (nueva) A.ir('contenido/paginas/extra-' + (tema.paginas.extra.length - 1)); else A.repintar();
        return true;
      } catch (e) { A.errorGuardar(e); return false; }
    }
  }, ['web']);

  // ============================================================
  //  archivos (imágenes subidas para la web)
  // ============================================================
  A.medios = null;   // id -> {nombre, data, fecha, ancho, alto}
  A.cargarMedios = async function () {
    if (A.medios) return A.medios;
    const snap = await A.ref.medios.get();
    A.medios = {};
    snap.forEach(d => { A.medios[d.id] = d.data(); });
    return A.medios;
  };
  A.subirMedio = async function (file) {
    let data = await A.comprimir(file, 1800, 0.85);
    if (data.length > 950000) data = await A.comprimir(file, 1200, 0.78);
    const dim = await new Promise(r => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.onerror = () => r([0, 0]); i.src = data; });
    const id = 'm' + A.id();
    const doc = { nombre: (file.name || 'imagen').replace(/\.[a-z0-9]+$/i, '').slice(0, 60), data: data, ancho: dim[0], alto: dim[1], peso: data.length, fecha: new Date().toISOString() };
    await A.ref.medios.doc(id).set(doc);
    (A.medios = A.medios || {})[id] = doc;
    return id;
  };
  /* Dónde se usa una imagen del tema (para no borrar algo que está en la web). */
  A.usosMedio = function (id) {
    const t = JSON.stringify(A.temaVigente() || {});
    return t.split('medio:' + id).length - 1;
  };
  /* Ventana para elegir una imagen ya subida o subir una nueva. */
  A.elegirMedio = async function () {
    try { await A.cargarMedios(); } catch (e) { A.errorGuardar(e); return null; }
    const pintar = (caja) => {
      const ids = Object.keys(A.medios).sort((a, b) => String(A.medios[b].fecha).localeCompare(String(A.medios[a].fecha)));
      A.$('#em-lista', caja).innerHTML = ids.length ? ids.map(id => '<div class="medio elegible" data-m="' + id + '"><img src="' + A.medios[id].data + '" alt=""><div><span>' + h(A.medios[id].nombre) + '</span></div></div>').join('') : '<p class="ayuda" style="grid-column:1/-1">Aún no has subido imágenes.</p>';
      A.$$('[data-m]', caja).forEach(m => m.addEventListener('click', () => A.cerrarModal('medio:' + m.dataset.m)));
    };
    return A.modal({
      titulo: 'Elegir imagen', ancho: true,
      html: '<div class="zona-subir" id="em-subir" style="margin:0 0 6px">' + A.ic.subir + ' Subir una imagen nueva</div><div class="medios" id="em-lista" style="padding:10px 0 0"></div>',
      alAbrir: (caja) => {
        pintar(caja);
        A.$('#em-subir', caja).addEventListener('click', async () => {
          const f = await A.elegirArchivo(); if (!f) return;
          A.$('#em-subir', caja).textContent = 'Subiendo…';
          try { const id = await A.subirMedio(f); A.cerrarModal('medio:' + id); } catch (e) { A.errorGuardar(e); A.$('#em-subir', caja).textContent = 'Subir una imagen nueva'; }
        });
      },
      botones: [{ texto: 'Cancelar' }]
    });
  };
  A.urlImagen = function (ruta) {
    ruta = String(ruta || '');
    if (ruta.indexOf('medio:') === 0) { const m = A.medios && A.medios[ruta.slice(6)]; return m ? m.data : ''; }
    return ruta;
  };

  A.pagina('contenido/archivos', function (vista) {
    vista.innerHTML = '<div class="pag">' + A.cab('Archivos') + A.avisoPermisoWeb() +
      '<p class="pag-sub">Imágenes para la web: portada, banners y páginas. Las fotos de los productos se suben en cada producto.</p>' +
      '<div class="tarjeta"><div class="zona-subir" id="ar-subir">' + A.ic.subir + '<br>Arrastra imágenes aquí o toca para elegirlas</div><div class="medios" id="ar-lista">' + A.cargandoHtml + '</div></div></div>';
    const lista = A.$('#ar-lista', vista), zona = A.$('#ar-subir', vista);
    const pintar = () => {
      const ids = Object.keys(A.medios || {}).sort((a, b) => String(A.medios[b].fecha).localeCompare(String(A.medios[a].fecha)));
      lista.innerHTML = ids.length ? ids.map(id => {
        const m = A.medios[id], u = A.usosMedio(id);
        return '<div class="medio"><img src="' + m.data + '" alt="" data-ver="' + id + '"><div><span title="' + h(m.nombre) + '">' + h(m.nombre) + '</span><button class="mini btn-plano btn btn-chico" data-borrar="' + id + '" aria-label="Eliminar">' + A.ic.basura + '</button></div>' +
          '<div class="tenue" style="padding-top:0">' + (m.ancho ? m.ancho + '×' + m.alto + ' · ' : '') + Math.round((m.peso || 0) / 1365) + ' KB' + (u ? ' · <b style="color:var(--verde)">en uso</b>' : '') + '</div></div>';
      }).join('') : '<p class="ayuda" style="grid-column:1/-1;text-align:center">Aún no has subido imágenes.</p>';
      A.$$('[data-borrar]', lista).forEach(b => b.addEventListener('click', async () => {
        const id = b.dataset.borrar;
        if (A.usosMedio(id)) { A.avisar('Esta imagen se está usando en la web. Cámbiala primero en Tienda online → Personalizar.'); return; }
        if (!(await A.confirmar('Se borra la imagen «' + A.medios[id].nombre + '».', { si: 'Eliminar', peligro: true }))) return;
        try { await A.ref.medios.doc(id).delete(); delete A.medios[id]; pintar(); } catch (e) { A.errorGuardar(e); }
      }));
      A.$$('[data-ver]', lista).forEach(i => i.addEventListener('click', () => window.open().document.write('<img src="' + A.medios[i.dataset.ver].data + '" style="max-width:100%">')));
    };
    const subir = async (files) => {
      for (const f of files) {
        zona.textContent = 'Subiendo ' + f.name + '…';
        try { await A.subirMedio(f); } catch (e) { A.errorGuardar(e); }
      }
      zona.innerHTML = A.ic.subir + '<br>Arrastra imágenes aquí o toca para elegirlas';
      pintar();
    };
    zona.addEventListener('click', () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.onchange = () => subir([...i.files]); i.click(); });
    zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('sobre'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('sobre'));
    zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('sobre'); subir([...e.dataTransfer.files].filter(f => /^image\//.test(f.type))); });
    A.cargarMedios().then(pintar).catch(e => { lista.innerHTML = '<p class="ayuda">No se pudieron leer los archivos. ' + (A.webError === 'permiso' ? 'Falta activar el permiso (mira el aviso de arriba).' : '') + '</p>'; console.warn(e); });
  }, []);

  // ============================================================
  //  opiniones
  // ============================================================
  let estrellas = 5;
  A.pagina('contenido/opiniones', function (vista) {
    const lista = kvResenas(A.settings);
    const prods = A.productos.slice().sort((a, b) => String(a.code).localeCompare(String(b.code), 'es', { numeric: true }));
    vista.innerHTML = '<div class="pag">' + A.cab('Opiniones') +
      '<p class="pag-sub">Comentarios que te dejan tus clientas (por WhatsApp, Instagram…). Tú los publicas aquí y aparecen en la ficha de cada producto.</p>' +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Agregar opinión</h2></div><div class="tarjeta-c">' +
        '<label class="campo"><span>Producto</span><select id="op-prod">' + prods.map(p => '<option value="' + p.id + '">' + h((p.code || '') + ' · ' + p.name) + '</option>').join('') + '</select></label>' +
        '<div class="fila-campos"><label class="campo"><span>Nombre de la clienta</span><input id="op-nombre" maxlength="40" placeholder="Ej: Camila"></label>' +
        '<div class="campo"><span>Estrellas</span><div class="estrellas-sel" id="op-est">' + [1, 2, 3, 4, 5].map(n => '<button type="button" data-n="' + n + '" class="' + (n <= estrellas ? 'on' : '') + '">★</button>').join('') + '</div></div></div>' +
        '<label class="campo"><span>Comentario</span><textarea id="op-texto" rows="3" maxlength="400"></textarea></label>' +
      '</div><div class="tarjeta-pie"><button class="btn btn-primario" id="op-agregar">Publicar opinión</button></div></div>' +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Publicadas (' + lista.length + ')</h2></div>' + (!lista.length ? A.vacio('⭐', 'Aún no hay opiniones', '') :
        '<div class="tabla-env mt"><table class="tabla"><tbody>' + lista.map((r, i) => {
          const p = A.productos.find(x => x.id === r.producto);
          return '<tr><td><div class="celda-prod">' + (p ? A.imgProd(p) : '') + '<div><b>' + h(p ? p.name : 'Producto eliminado') + '</b><small><span class="estrellas">' + '★'.repeat(Number(r.estrellas) || 0) + '</span> · ' + h(r.nombre || '') + ' · ' + h(A.fecha(r.fecha, false)) + '</small></div></div>' +
            (r.texto ? '<p style="margin:6px 0 0">' + h(r.texto) + '</p>' : '') + '</td><td class="min"><button class="btn btn-chico btn-plano" data-borrar="' + i + '" aria-label="Quitar">' + A.ic.basura + '</button></td></tr>';
        }).join('') + '</tbody></table></div>') + '</div></div>';
    A.$$('#op-est button', vista).forEach(b => b.addEventListener('click', () => { estrellas = +b.dataset.n; A.$$('#op-est button', vista).forEach(x => x.classList.toggle('on', +x.dataset.n <= estrellas)); }));
    A.$('#op-agregar', vista).addEventListener('click', async () => {
      const nombre = A.$('#op-nombre', vista).value.trim();
      if (!nombre) { A.toast('Escribe el nombre de la clienta', true); return; }
      const l = kvResenas(A.settings).concat([{ producto: A.$('#op-prod', vista).value, estrellas: estrellas, nombre: nombre.slice(0, 40), texto: A.$('#op-texto', vista).value.trim().slice(0, 400), fecha: new Date().toISOString() }]);
      try { await A.ref.settings.set({ resenas: l }, { merge: true }); A.toast('Opinión publicada ✓'); } catch (e) { A.errorGuardar(e); }
    });
    A.$$('[data-borrar]', vista).forEach(b => b.addEventListener('click', async () => {
      if (!(await A.confirmar('Se quita esta opinión de la web.', { si: 'Quitar', peligro: true }))) return;
      const l = kvResenas(A.settings).slice(); l.splice(+b.dataset.borrar, 1);
      try { await A.ref.settings.set({ resenas: l }, { merge: true }); } catch (e) { A.errorGuardar(e); }
    }));
  }, ['settings', 'productos']);
})();
