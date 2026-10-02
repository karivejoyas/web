/* Panel · Productos, Colecciones e Inventario.
   Los productos SOLO cambian cuando tú aprietas Guardar: nada se escribe solo.
   Mismas reglas que el panel antiguo: código correlativo por colección, y para
   dejar un producto visible tiene que tener nombre, precio y foto. */
(function () {
  'use strict';
  const h = A.h;

  const visible = (p) => p.stock === true;
  function estadoProd(p) {
    if (!visible(p)) return ['Oculto', ''];
    if (kvStockCantidad(p) === 0) return ['Agotado', 'rojo'];
    return ['Activo', 'verde'];
  }
  const ins = (x) => '<span class="ins ' + x[1] + '">' + h(x[0]) + '</span>';
  function inventarioTxt(p) {
    const c = kvStockCantidad(p);
    if (c === null) return '<span class="tenue">Sin control</span>';
    if (c === 0) return '<span style="color:var(--rojo)">0 en stock</span>';
    return c + ' en stock' + (c <= 3 ? ' <span class="ins ambar sin-punto">pocas</span>' : '');
  }
  function precioTxt(p) {
    const of = kvPrecioOferta(p);
    return of && of < p.price ? A.clp(of) + ' <s class="tenue">' + A.clp(p.price) + '</s>' : A.clp(p.price);
  }
  function codigoSiguiente(catId, sinId) {
    const cat = A.colecciones().find(c => c.id === catId);
    const otros = A.productos.filter(p => p.id !== sinId);
    return ((cat && cat.prefijo) || 'PR') + '-' + String(kvNextNumCat(otros, catId)).padStart(3, '0');
  }
  function ordenFinal(catId, sinId) {
    const ords = A.productos.filter(p => p.category === catId && p.id !== sinId).map(p => Number(p.order) || 0);
    return (ords.length ? Math.max.apply(null, ords) : 0) + 1;
  }

  // ============================================================
  //  lista de productos
  // ============================================================
  const filtro = { pest: 'todos', col: '', txt: '', orden: 'manual' };
  const elegidos = new Set();
  const PEST = [['todos', 'Todos', () => true], ['activos', 'Activos', p => visible(p) && kvStockCantidad(p) !== 0], ['ocultos', 'Ocultos', p => !visible(p)], ['agotados', 'Agotados', p => visible(p) && kvStockCantidad(p) === 0]];

  A.pagina('productos', function (vista) {
    if (!A.listo.productos) { vista.innerHTML = '<div class="pag ancha">' + A.cab('Productos') + '<div class="tarjeta">' + A.cargandoHtml + '</div></div>'; return; }
    const cols = A.colecciones();
    const pest = PEST.find(x => x[0] === filtro.pest) || PEST[0];
    const t = A.sinTildes(filtro.txt);
    let lista = A.productos.filter(pest[2]).filter(p => (!filtro.col || p.category === filtro.col) && (!t || A.sinTildes(p.name + ' ' + p.code + ' ' + (p.detail || '')).indexOf(t) !== -1));
    const posCol = (p) => { const i = cols.findIndex(c => c.id === p.category); return i < 0 ? 99 : i; };
    const ord = {
      manual: (a, b) => posCol(a) - posCol(b) || (Number(a.order) || 0) - (Number(b.order) || 0),
      nombre: (a, b) => String(a.name).localeCompare(String(b.name), 'es'),
      codigo: (a, b) => String(a.code).localeCompare(String(b.code), 'es', { numeric: true }),
      precio: (a, b) => (a.price || 0) - (b.price || 0),
      precioDesc: (a, b) => (b.price || 0) - (a.price || 0),
      nuevos: (a, b) => String(b.creado).localeCompare(String(a.creado)),
      inventario: (a, b) => (kvStockCantidad(a) ?? 9999) - (kvStockCantidad(b) ?? 9999)
    }[filtro.orden];
    lista = lista.sort(ord);
    [...elegidos].forEach(id => { if (!A.productos.some(p => p.id === id)) elegidos.delete(id); });

    vista.innerHTML = '<div class="pag ancha">' +
      A.cab('Productos', { acciones: '<button class="btn" id="pr-exportar">' + A.ic.descargar + ' Exportar</button><button class="btn" id="pr-recargar" title="Volver a leer los productos (por si subiste algo con el bot)">↻ Actualizar</button><a class="btn btn-primario" href="#/productos/nuevo">Agregar producto</a>' }) +
      '<div class="tarjeta">' +
        '<div class="pestanas">' + PEST.map(x => '<button class="pestana' + (x === pest ? ' activa' : '') + '" data-pest="' + x[0] + '">' + x[1] + '<span class="n">' + A.productos.filter(x[2]).length + '</span></button>').join('') + '</div>' +
        '<div class="filtros"><label class="buscar">' + A.ic.buscar + '<input id="pr-buscar" placeholder="Buscar por nombre, código o medida" value="' + h(filtro.txt) + '"></label>' +
          '<select id="pr-col"><option value="">Todas las colecciones</option>' + cols.map(c => '<option value="' + h(c.id) + '"' + (filtro.col === c.id ? ' selected' : '') + '>' + h(c.nombre) + '</option>').join('') + '</select>' +
          '<select id="pr-orden">' + [['manual', 'Orden de la tienda'], ['nuevos', 'Más nuevos'], ['nombre', 'Nombre A–Z'], ['codigo', 'Código'], ['precio', 'Precio: menor a mayor'], ['precioDesc', 'Precio: mayor a menor'], ['inventario', 'Menos inventario']]
            .map(o => '<option value="' + o[0] + '"' + (filtro.orden === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
        (elegidos.size ? '<div class="acciones-lote"><b>' + elegidos.size + ' seleccionado' + (elegidos.size > 1 ? 's' : '') + '</b><button class="btn btn-chico" data-lote="mostrar">Hacer visibles</button><button class="btn btn-chico" data-lote="ocultar">Ocultar</button><button class="btn btn-chico" data-lote="coleccion">Cambiar colección</button><button class="btn btn-chico btn-plano" data-lote="ninguno">Quitar selección</button></div>' : '') +
        (!lista.length ? A.vacio('🏷', 'No hay productos aquí', 'Prueba con otro filtro.') :
        '<div class="tabla-env"><table class="tabla"><thead><tr><th class="min"><input type="checkbox" class="check" id="pr-todos"' + (lista.every(p => elegidos.has(p.id)) ? ' checked' : '') + ' aria-label="Seleccionar todos"></th><th>Producto</th><th>Estado</th><th class="om">Inventario</th><th class="om">Colección</th><th class="num">Precio</th></tr></thead><tbody>' +
        lista.map(p => '<tr class="click" data-id="' + p.id + '"><td class="min"><input type="checkbox" data-sel="' + p.id + '"' + (elegidos.has(p.id) ? ' checked' : '') + ' aria-label="Seleccionar"></td>' +
          '<td><div class="celda-prod">' + A.imgProd(p) + '<div><b>' + h(p.name || '(sin nombre)') + '</b><small>' + h(p.code || '') + (p.detail ? ' · ' + h(p.detail) : '') + '</small></div></div></td>' +
          '<td>' + ins(estadoProd(p)) + '</td><td class="om">' + inventarioTxt(p) + '</td><td class="om">' + h(A.nombreCol(p.category)) + '</td><td class="num">' + precioTxt(p) + '</td></tr>').join('') +
        '</tbody></table></div>') +
      '</div><p class="ayuda derecha">' + lista.length + ' de ' + A.productos.length + ' productos</p></div>';

    A.$$('[data-pest]', vista).forEach(b => b.addEventListener('click', () => { filtro.pest = b.dataset.pest; A.repintar(); }));
    A.$('#pr-col', vista).addEventListener('change', (e) => { filtro.col = e.target.value; A.repintar(); });
    A.$('#pr-orden', vista).addEventListener('change', (e) => { filtro.orden = e.target.value; A.repintar(); });
    const bus = A.$('#pr-buscar', vista);
    bus.addEventListener('input', () => { filtro.txt = bus.value; clearTimeout(bus._t); bus._t = setTimeout(() => { A.repintar(); const b = A.$('#pr-buscar'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }, 220); });
    A.$$('tr[data-id]', vista).forEach(tr => tr.addEventListener('click', (e) => { if (!e.target.closest('input')) A.ir('productos/' + tr.dataset.id); }));
    A.$$('[data-sel]', vista).forEach(c => c.addEventListener('change', () => { c.checked ? elegidos.add(c.dataset.sel) : elegidos.delete(c.dataset.sel); A.repintar(); }));
    const todos = A.$('#pr-todos', vista);
    if (todos) todos.addEventListener('change', () => { lista.forEach(p => todos.checked ? elegidos.add(p.id) : elegidos.delete(p.id)); A.repintar(); });
    A.$$('[data-lote]', vista).forEach(b => b.addEventListener('click', () => accionLote(b.dataset.lote)));
    A.$('#pr-recargar', vista).addEventListener('click', () => { A.cargarProductos().then(() => A.toast('Productos actualizados')); });
    A.$('#pr-exportar', vista).addEventListener('click', () => {
      const filas = [['Código', 'Nombre', 'Medida', 'Colección', 'Precio', 'Precio oferta', 'Visible', 'Cantidad']];
      lista.forEach(p => filas.push([p.code, p.name, p.detail || '', A.nombreCol(p.category), p.price || 0, p.priceOffer || '', visible(p) ? 'Sí' : 'No', kvStockCantidad(p) ?? '']));
      A.descargar('productos-karive-' + A.diaClave(Date.now()) + '.csv', A.csv(filas), 'text/csv;charset=utf-8');
    });
  }, ['productos', 'settings']);

  async function accionLote(acc) {
    const ids = [...elegidos];
    if (acc === 'ninguno') { elegidos.clear(); A.repintar(); return; }
    if (acc === 'coleccion') {
      const r = await A.modal({ titulo: 'Cambiar de colección', html: '<p class="ayuda">Cada producto se va al final de la colección nueva, con el código que le corresponda (igual que en el panel antiguo).</p><label class="campo"><span>Colección</span><select id="lt-col">' +
        A.colecciones().map(c => '<option value="' + h(c.id) + '">' + h(c.nombre) + '</option>').join('') + '</select></label>',
        botones: [{ texto: 'Cancelar' }, { texto: 'Cambiar ' + ids.length, clase: 'btn-primario', accion: (c) => A.$('#lt-col', c).value }] });
      if (!r) return;
      const lote = A.db.batch(); const locales = [];
      ids.forEach(id => {
        const p = A.productos.find(x => x.id === id); if (!p || p.category === r) return;
        const cambios = { category: r, code: codigoSiguiente(r, id), order: ordenFinal(r, id) };
        Object.assign(p, cambios); locales.push([id, cambios]);
        lote.update(A.ref.items.doc(id), cambios);
      });
      try { await lote.commit(); elegidos.clear(); A.toast(locales.length + ' producto(s) cambiados de colección'); A.repintar(); } catch (e) { A.errorGuardar(e); A.cargarProductos(); }
      return;
    }
    const mostrar = acc === 'mostrar';
    const aplicar = ids.filter(id => { const p = A.productos.find(x => x.id === id); return p && visible(p) !== mostrar; });
    const malos = mostrar ? aplicar.filter(id => { const p = A.productos.find(x => x.id === id); return !String(p.name || '').trim() || !(p.price > 0); }) : [];
    if (malos.length) { A.avisar(malos.length + ' producto(s) no tienen nombre o precio, así que no se pueden mostrar. Ábrelos y complétalos primero.'); return; }
    if (!aplicar.length) { A.toast('No hay nada que cambiar'); return; }
    if (!(await A.confirmar((mostrar ? 'Se harán visibles ' : 'Se ocultarán ') + aplicar.length + ' producto(s) en la tienda.', { si: mostrar ? 'Hacer visibles' : 'Ocultar' }))) return;
    const lote = A.db.batch();
    aplicar.forEach(id => { lote.update(A.ref.items.doc(id), { stock: mostrar }); A.productos.find(x => x.id === id).stock = mostrar; });
    try { await lote.commit(); elegidos.clear(); A.toast('Listo ✓'); A.repintar(); } catch (e) { A.errorGuardar(e); A.cargarProductos(); }
  }

  // ============================================================
  //  ficha de producto (editar o crear)
  // ============================================================
  A.pagina('productos/:id', function (vista, params) {
    const nuevo = params.id === 'nuevo';
    if (!nuevo && !A.listo.productos) { vista.innerHTML = A.cargandoHtml; return; }
    const orig = nuevo ? { name: '', detail: '', price: 0, priceOffer: 0, category: (A.query().col || (A.colecciones()[0] || {}).id || 'otros'), stock: false, cantidad: null } : A.productos.find(x => x.id === params.id);
    if (!orig) { vista.innerHTML = '<div class="pag">' + A.cab('Producto', { volver: 'productos' }) + '<div class="tarjeta">' + A.vacio('🔍', 'No encontramos este producto', 'Puede que se haya eliminado.') + '</div></div>'; return; }
    let fotoNueva = null, fotoQuitada = false;
    const cols = A.colecciones();
    const desc = kvDescuentoActivo(A.settings);
    const ctrl = kvStockCantidad(orig) !== null;
    const enlaceWeb = '/p/' + encodeURIComponent(orig.code || '') + '.html';

    vista.innerHTML = '<div class="pag">' +
      A.cab(nuevo ? 'Agregar producto' : h(orig.name || '(sin nombre)') + ' ' + ins(estadoProd(orig)), {
        volver: 'productos',
        acciones: nuevo ? '' : '<a class="btn" href="' + h(enlaceWeb) + '" target="_blank" rel="noopener">' + A.ic.ojo + ' Ver en la web</a><button class="btn" id="pf-duplicar">' + A.ic.copiar + ' Duplicar</button>'
      }) +
      '<div class="dos-col no-refrescar" id="pf"><div>' +
        '<div class="tarjeta tarjeta-c">' +
          '<label class="campo"><span>Nombre</span><input id="pf-nombre" value="' + h(orig.name || '') + '" placeholder="Ej: Aros flor lila" maxlength="80"></label>' +
          '<label class="campo"><span>Medida o detalle</span><textarea id="pf-detalle" rows="2" placeholder="Ej: 3,5 cm de largo">' + h(orig.detail || '') + '</textarea><small>Es lo que aparece como «Medida» en la ficha de la web.</small></label>' +
        '</div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Foto</h2></div><div class="tarjeta-c">' +
          '<div class="foto-prod" id="pf-foto" role="button" tabindex="0" aria-label="Cambiar la foto">' + (nuevo ? '<div class="sin">' + A.ic.subir + '<br>Toca para subir la foto</div>' : '<img id="pf-img" data-foto="' + orig.id + '" src="' + h(A.foto(orig) || A.SIN_FOTO) + '" alt="">') + '</div>' +
          '<div class="foto-acc"><button class="btn btn-chico" id="pf-foto-btn">' + A.ic.subir + ' ' + (nuevo ? 'Subir foto' : 'Cambiar foto') + '</button>' + (nuevo ? '' : '<button class="btn btn-chico btn-peligro" id="pf-foto-quitar">Quitar foto</button>') + '</div>' +
          '<p class="ayuda mt" style="margin:8px 0 0">Se achica sola para que la web cargue rápido. Usa una foto cuadrada y bien iluminada.</p>' +
        '</div></div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Precio</h2></div><div class="tarjeta-c">' +
          '<div class="fila-campos"><label class="campo"><span>Precio</span><div class="campo-pre"><span>$</span><input id="pf-precio" inputmode="numeric" value="' + (orig.price || '') + '"></div></label>' +
          '<label class="campo"><span>Precio de oferta</span><div class="campo-pre"><span>$</span><input id="pf-oferta" inputmode="numeric" value="' + (orig.priceOffer || '') + '" placeholder="Vacío = sin oferta"></div><small>Si lo llenas, se muestra tachado el precio normal.</small></label></div>' +
          (desc ? '<div class="nota info">Hay un descuento general de −' + desc.pct + '% activo' + (desc.hasta ? ' hasta el ' + h(desc.hasta) : '') + ': en la web se cobra el menor de los dos.</div>' : '') +
        '</div></div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Inventario</h2></div><div class="tarjeta-c">' +
          '<label class="campo"><span>Código (SKU)</span><input id="pf-codigo" value="' + h(nuevo ? codigoSiguiente(orig.category) : orig.code || '') + '" style="max-width:200px;text-transform:uppercase"><small>Se asigna solo según la colección. Cámbialo solo si sabes lo que haces.</small></label>' +
          A.interruptor('pf-ctrl', ctrl, 'Controlar cantidad') +
          '<label class="campo" id="pf-cant-c"' + (ctrl ? '' : ' hidden') + '><span>Unidades disponibles</span><input id="pf-cant" inputmode="numeric" value="' + (ctrl ? kvStockCantidad(orig) : '') + '" style="max-width:140px"><small>Al llegar a 0 se muestra «Agotado». Se descuenta solo al verificar el pago de un pedido.</small></label>' +
        '</div></div>' +
        (nuevo ? '' : '<div class="derecha"><button class="btn btn-peligro" id="pf-eliminar">' + A.ic.basura + ' Eliminar producto</button></div>') +
      '</div><div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Estado</h2></div><div class="tarjeta-c">' +
          '<select class="inp" id="pf-estado"><option value="1"' + (orig.stock ? ' selected' : '') + '>Activo (visible en la web)</option><option value="0"' + (orig.stock ? '' : ' selected') + '>Oculto</option></select>' +
          '<p class="ayuda mt" style="margin:8px 0 0">Para dejarlo visible necesita nombre, precio y foto.</p>' +
        '</div></div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Organización</h2></div><div class="tarjeta-c">' +
          '<label class="campo"><span>Colección</span><select id="pf-col">' + cols.map(c => '<option value="' + h(c.id) + '"' + (c.id === orig.category ? ' selected' : '') + '>' + h(c.nombre) + '</option>').join('') +
            (cols.some(c => c.id === orig.category) ? '' : '<option value="' + h(orig.category || '') + '" selected>Sin colección</option>') + '</select></label>' +
          '<p class="ayuda" id="pf-col-nota" hidden></p>' +
        '</div></div>' +
        (nuevo ? '' : '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:6px">Información</h2>' +
          '<div class="resumen-fila"><span class="tenue">Creado</span><span>' + h(A.fecha(orig.creado)) + '</span></div>' +
          '<div class="resumen-fila"><span class="tenue">Última modificación</span><span>' + h(A.fecha(orig.actualizado)) + '</span></div>' +
          '<div class="resumen-fila"><span class="tenue">Ventas</span><span>' + A.pedidos.filter(A.esVenta).reduce((s, p) => s + (p.items || []).filter(i => i.id === orig.id).reduce((a, i) => a + i.qty, 0), 0) + ' unid.</span></div>' +
          '<div class="resumen-fila"><span class="tenue">Visitas que lo abrieron</span><span>' + A.visitas.filter(v => (v.productosIds || []).indexOf(orig.id) !== -1).length + '</span></div></div>') +
      '</div></div></div>';

    const $ = (id) => A.$('#' + id, vista);
    const leer = () => {
      const ctrlOn = $('pf-ctrl').checked;
      return {
        name: $('pf-nombre').value.trim(), detail: $('pf-detalle').value.trim(),
        price: A.num($('pf-precio').value), priceOffer: A.num($('pf-oferta').value),
        code: $('pf-codigo').value.trim().toUpperCase(), category: $('pf-col').value,
        stock: $('pf-estado').value === '1',
        cantidad: ctrlOn ? Math.max(0, A.num($('pf-cant').value)) : null,
        _foto: fotoNueva ? 'nueva' : fotoQuitada ? 'quitada' : ''
      };
    };
    const base = { name: orig.name || '', detail: orig.detail || '', price: orig.price || 0, priceOffer: orig.priceOffer || 0, code: String(nuevo ? codigoSiguiente(orig.category) : orig.code || '').toUpperCase(), category: orig.category, stock: !!orig.stock, cantidad: kvStockCantidad(orig), _foto: '' };
    const revisar = () => {
      if (nuevo || !A.igual(leer(), base)) A.marcarCambios(guardar, () => { A.limpiarCambios(); A.repintar(); });
      else A.limpiarCambios();
    };
    A.$('#pf', vista).addEventListener('input', revisar);
    A.$('#pf', vista).addEventListener('change', revisar);
    if (nuevo) A.marcarCambios(guardar, () => A.ir('productos'));

    $('pf-ctrl').addEventListener('change', () => { $('pf-cant-c').hidden = !$('pf-ctrl').checked; if ($('pf-ctrl').checked && $('pf-cant').value === '') $('pf-cant').value = 1; });
    $('pf-col').addEventListener('change', () => {
      const c = $('pf-col').value;
      if (c === orig.category && !nuevo) { $('pf-codigo').value = orig.code || ''; $('pf-col-nota').hidden = true; return; }
      const cod = codigoSiguiente(c, orig.id);
      $('pf-codigo').value = cod;
      $('pf-col-nota').hidden = nuevo;
      $('pf-col-nota').textContent = 'Se irá al final de la colección y su código pasará a ' + cod + '.';
    });
    const subir = async () => {
      const f = await A.elegirArchivo('image/*'); if (!f) return;
      try {
        fotoNueva = await A.comprimir(f, 1600, 0.87); fotoQuitada = false;
        $('pf-foto').innerHTML = '<img src="' + fotoNueva + '" alt="">';
        revisar();
      } catch (e) { A.toast(e.message, true); }
    };
    $('pf-foto').addEventListener('click', subir);
    $('pf-foto').addEventListener('keydown', (e) => { if (e.key === 'Enter') subir(); });
    $('pf-foto-btn').addEventListener('click', subir);
    if ($('pf-foto-quitar')) $('pf-foto-quitar').addEventListener('click', async () => {
      if (!(await A.confirmar('La foto se quita cuando aprietes Guardar. Si te arrepientes, aprieta Descartar.', { si: 'Quitar foto' }))) return;
      fotoQuitada = true; fotoNueva = null;
      $('pf-foto').innerHTML = '<div class="sin">' + A.ic.subir + '<br>Sin foto</div>';
      if ($('pf-estado').value === '1') $('pf-estado').value = '0';
      revisar();
    });
    if ($('pf-eliminar')) $('pf-eliminar').addEventListener('click', async () => {
      if (!(await A.confirmar('«' + (orig.name || '') + '» (' + (orig.code || '') + ') se borra de la base y desaparece de la web y del panel antiguo. No se puede deshacer.\n\nSi solo quieres que no se vea, mejor déjalo Oculto.', { titulo: '¿Eliminar producto?', si: 'Eliminar', peligro: true }))) return;
      try { await A.ref.items.doc(orig.id).delete(); A.productos = A.productos.filter(x => x.id !== orig.id); A.limpiarCambios(); A.toast('Producto eliminado'); A.ir('productos'); } catch (e) { A.errorGuardar(e); }
    });
    if ($('pf-duplicar')) $('pf-duplicar').addEventListener('click', () => duplicar(orig));

    async function guardar() {
      const v = leer();
      const tieneFoto = v._foto === 'nueva' || (!nuevo && v._foto !== 'quitada' && await tieneFotoGuardada(orig.id));
      const errores = [], avisos = [];
      if (!v.name) errores.push('falta el nombre');
      if (!(v.price > 0)) errores.push('falta el precio');
      if (!tieneFoto) errores.push('falta la foto');
      if (!v.code) errores.push('falta el código');
      if (v.stock && errores.length) { A.avisar('Para dejarlo visible primero completa:\n\n• ' + errores.join('\n• ') + '\n\nMientras tanto puedes guardarlo como «Oculto».', 'Faltan datos'); return false; }
      if (!v.name) { A.avisar('Ponle al menos un nombre.'); return false; }
      if (v.code && !/^[A-ZÑ]{2,4}-?\d{1,4}$/.test(v.code)) avisos.push('el código «' + v.code + '» se ve raro (lo normal es como AG-014)');
      if (A.productos.some(x => x.id !== orig.id && String(x.code || '').toUpperCase() === v.code)) avisos.push('el código «' + v.code + '» ya lo usa otro producto');
      if (v.priceOffer > 0 && v.priceOffer >= v.price) avisos.push('la oferta debería ser menor que el precio normal');
      if (!v.detail) avisos.push('no pusiste la medida o detalle');
      if (avisos.length && !(await A.confirmar('Revisa esto:\n\n• ' + avisos.join('\n• '), { titulo: '¿Guardar de todas formas?', si: 'Guardar igual' }))) return false;

      const datos = {};
      ['name', 'detail', 'price', 'priceOffer', 'code', 'category', 'stock', 'cantidad'].forEach(k => { if (nuevo || !A.igual(v[k], base[k])) datos[k] = v[k]; });
      if (v._foto === 'nueva') datos.photo = fotoNueva;
      if (v._foto === 'quitada') datos.photo = null;
      if (!nuevo && v.category !== orig.category) datos.order = ordenFinal(v.category, orig.id);
      try {
        if (nuevo) {
          datos.order = ordenFinal(v.category);
          const ref = await A.ref.items.add(datos);
          A.productos.push(Object.assign({ id: ref.id, creado: new Date().toISOString(), actualizado: new Date().toISOString() }, datos, { photo: undefined }));
          if (fotoNueva) A.ponerFoto(ref.id, fotoNueva);
          A.limpiarCambios(); A.toast('Producto creado ✓');
          A.ir('productos/' + ref.id);
        } else {
          if (!Object.keys(datos).length) return true;
          await A.ref.items.doc(orig.id).update(datos);
          if (v._foto === 'nueva') A.ponerFoto(orig.id, fotoNueva);
          if (v._foto === 'quitada') A.ponerFoto(orig.id, '');
          delete datos.photo;
          A.limpiarCambios();
          A.productoLocal(orig.id, datos);
          A.toast('Producto guardado ✓');
          A.repintar();
        }
        return true;
      } catch (e) { A.errorGuardar(e); return false; }
    }
  }, ['productos', 'settings']);

  async function tieneFotoGuardada(id) {
    try {
      const r = await fetch(A.REST + '/catalog/products/items/' + id + '?mask.fieldPaths=photo');
      const d = await r.json();
      return !!A.fsValor((d.fields || {}).photo);
    } catch (e) { return true; }   // si no se puede revisar, no se bloquea
  }

  async function duplicar(p) {
    if (!(await A.confirmar('Se crea una copia OCULTA de «' + p.name + '», con la misma foto y precio y un código nuevo. Después la editas y la haces visible.', { titulo: 'Duplicar producto', si: 'Duplicar' }))) return;
    try {
      const snap = await A.ref.items.doc(p.id).get();
      const d = snap.data() || {};
      const copia = { name: (d.name || '') + ' (copia)', detail: d.detail || '', price: d.price || 0, priceOffer: d.priceOffer || 0, photo: d.photo || null,
        category: d.category, code: codigoSiguiente(d.category), order: ordenFinal(d.category), stock: false };
      if (d.foco) copia.foco = d.foco;
      if (d.focoMovil) copia.focoMovil = d.focoMovil;
      if (kvStockCantidad(d) !== null) copia.cantidad = kvStockCantidad(d);
      const ref = await A.ref.items.add(copia);
      A.productos.push(Object.assign({ id: ref.id, creado: new Date().toISOString() }, copia, { photo: undefined }));
      if (copia.photo) A.ponerFoto(ref.id, /^data:|^https?:/.test(copia.photo) ? copia.photo : A.CATALOGO_ANTIGUO + copia.photo);
      A.toast('Copia creada ✓');
      A.ir('productos/' + ref.id);
    } catch (e) { A.errorGuardar(e); }
  }

  // ============================================================
  //  colecciones
  // ============================================================
  let colBorrador = null;   // orden de colecciones sin guardar
  A.pagina('colecciones', function (vista) {
    const cols = colBorrador || A.colecciones();
    vista.innerHTML = '<div class="pag">' + A.cab('Colecciones', { acciones: '<a class="btn btn-primario" href="#/colecciones/nueva">Crear colección</a>' }) +
      '<p class="pag-sub">El orden de esta lista es el orden en que aparecen en la web y en el menú. Usa las flechas para moverlas.</p>' +
      '<div class="tarjeta"><div class="tabla-env"><table class="tabla"><thead><tr><th class="min">Orden</th><th>Colección</th><th>Código</th><th class="num">Visibles</th><th class="num">Total</th><th></th></tr></thead><tbody>' +
      cols.map((c, i) => {
        const prods = A.productos.filter(p => p.category === c.id);
        return '<tr class="click" data-id="' + h(c.id) + '"><td class="min"><button class="btn btn-chico btn-plano" data-mover="' + i + '" data-dir="-1"' + (i ? '' : ' disabled') + ' aria-label="Subir">' + A.ic.arriba + '</button><button class="btn btn-chico btn-plano" data-mover="' + i + '" data-dir="1"' + (i < cols.length - 1 ? '' : ' disabled') + ' aria-label="Bajar">' + A.ic.abajo + '</button></td>' +
          '<td><div class="celda-prod"><img class="miniatura grande" src="' + h(imgCol(c)) + '" alt=""><div><b>' + h(c.nombre) + '</b><small>' + h(c.sub || '') + '</small></div></div></td>' +
          '<td><code>' + h(c.prefijo || 'PR') + '</code></td><td class="num">' + prods.filter(visible).length + '</td><td class="num">' + prods.length + '</td><td class="min">' + A.ic.volver.replace('M12.5 4 6.5 10l6 6', 'M7.5 4l6 6-6 6') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      (A.productos.some(p => !cols.some(c => c.id === p.category)) ? '<div class="nota">Hay ' + A.productos.filter(p => !cols.some(c => c.id === p.category)).length + ' producto(s) sin colección. Búscalos en Productos y asígnales una.</div>' : '') +
      '</div>';
    A.$$('tr[data-id]', vista).forEach(tr => tr.addEventListener('click', (e) => { if (!e.target.closest('button')) A.ir('colecciones/' + tr.dataset.id); }));
    A.$$('[data-mover]', vista).forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.mover, j = i + (+b.dataset.dir);
      const c = (colBorrador || A.colecciones()).slice();
      const t = c[i]; c[i] = c[j]; c[j] = t;
      colBorrador = c;
      A.marcarCambios(async () => {
        try { await A.ref.settings.set({ categorias: colBorrador }, { merge: true }); colBorrador = null; A.toast('Orden guardado ✓'); return true; }
        catch (e) { A.errorGuardar(e); return false; }
      }, () => { colBorrador = null; A.repintar(); });
      A.repintar();
    }));
  }, ['productos', 'settings']);

  function imgCol(c) {
    const i = c.imagen || '';
    if (!i) return A.SIN_FOTO;
    return /^data:|^https?:/.test(i) ? i : A.CATALOGO_ANTIGUO + i.replace(/^\//, '');
  }

  A.pagina('colecciones/:id', function (vista, params) {
    const nueva = params.id === 'nueva';
    const cols = A.colecciones();
    const orig = nueva ? { id: 'c' + Date.now().toString(36), nombre: '', sub: '', imagen: '', prefijo: '' } : cols.find(c => c.id === params.id);
    if (!orig) { vista.innerHTML = '<div class="pag">' + A.cab('Colección', { volver: 'colecciones' }) + '<div class="tarjeta">' + A.vacio('🔍', 'No encontramos esta colección', '') + '</div></div>'; return; }
    let imagenNueva = null;
    let orden = A.productos.filter(p => p.category === orig.id).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)).map(p => p.id);
    const ordenInicial = orden.slice();

    const pintarOrden = () => {
      const caja = A.$('#cf-prods', vista); if (!caja) return;
      caja.innerHTML = orden.length ? orden.map((id, i) => {
        const p = A.productos.find(x => x.id === id);
        return '<div class="linea-item"><span class="tenue" style="width:22px;text-align:right">' + (i + 1) + '</span>' + A.imgProd(p) + '<div class="t"><a href="#/productos/' + p.id + '">' + h(p.name) + '</a><small>' + h(p.code || '') + '</small></div>' + ins(estadoProd(p)) +
          '<button class="btn btn-chico btn-plano" data-ord="' + i + '" data-dir="-1"' + (i ? '' : ' disabled') + ' aria-label="Subir">' + A.ic.arriba + '</button><button class="btn btn-chico btn-plano" data-ord="' + i + '" data-dir="1"' + (i < orden.length - 1 ? '' : ' disabled') + ' aria-label="Bajar">' + A.ic.abajo + '</button></div>';
      }).join('') : '<p class="ayuda">Esta colección todavía no tiene productos.</p>';
      A.$$('[data-ord]', caja).forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.ord, j = i + (+b.dataset.dir);
        const t = orden[i]; orden[i] = orden[j]; orden[j] = t;
        pintarOrden(); revisar();
      }));
    };

    vista.innerHTML = '<div class="pag">' + A.cab(nueva ? 'Crear colección' : h(orig.nombre), { volver: 'colecciones', acciones: nueva ? '' : '<a class="btn" href="/c/' + h(slug(orig.nombre)) + '.html" target="_blank" rel="noopener">' + A.ic.ojo + ' Ver en la web</a>' }) +
      '<div class="dos-col no-refrescar" id="cf"><div>' +
        '<div class="tarjeta tarjeta-c">' +
          '<label class="campo"><span>Nombre</span><input id="cf-nombre" value="' + h(orig.nombre || '') + '" placeholder="Ej: Corazones"></label>' +
          '<label class="campo"><span>Descripción</span><textarea id="cf-sub" rows="3">' + h(orig.sub || '') + '</textarea><small>Aparece en la página de la colección.</small></label>' +
        '</div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Productos</h2><span class="ayuda">orden en la web</span><div class="acciones">' + (nueva ? '' : '<a class="btn btn-chico" href="#/productos/nuevo?col=' + h(orig.id) + '">Agregar producto</a>') + '</div></div><div class="tarjeta-c" id="cf-prods"></div></div>' +
        (nueva ? '' : '<div class="derecha"><button class="btn btn-peligro" id="cf-eliminar">' + A.ic.basura + ' Eliminar colección</button></div>') +
      '</div><div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Imagen</h2></div><div class="tarjeta-c">' +
          '<div class="foto-prod" id="cf-img" role="button" tabindex="0" style="aspect-ratio:4/5">' + (orig.imagen ? '<img src="' + h(imgCol(orig)) + '" alt="" style="object-fit:cover">' : '<div class="sin">' + A.ic.subir + '<br>Subir imagen</div>') + '</div>' +
          '<p class="ayuda mt" style="margin:8px 0 0">Es la foto de la tarjeta de la colección en la portada.</p>' +
        '</div></div>' +
        '<div class="tarjeta tarjeta-c"><label class="campo" style="margin:0"><span>Código de los productos</span><input id="cf-pref" value="' + h(orig.prefijo || '') + '" maxlength="4" placeholder="CO" style="max-width:110px;text-transform:uppercase;letter-spacing:.1em"><small>2 a 4 letras. Los productos nuevos de esta colección se numeran así: ' + h((orig.prefijo || 'XX') + '-001') + '.</small></label></div>' +
      '</div></div></div>';
    pintarOrden();

    const $ = (id) => A.$('#' + id, vista);
    const leer = () => ({ nombre: $('cf-nombre').value.trim(), sub: $('cf-sub').value.trim(), prefijo: ($('cf-pref').value.trim().toUpperCase().replace(/[^A-ZÑ]/g, '').slice(0, 4)), img: !!imagenNueva, orden: orden.join() });
    const base = { nombre: orig.nombre || '', sub: orig.sub || '', prefijo: orig.prefijo || '', img: false, orden: ordenInicial.join() };
    function revisar() {
      if (nueva || !A.igual(leer(), base)) A.marcarCambios(guardar, () => { A.limpiarCambios(); A.repintar(); });
      else A.limpiarCambios();
    }
    A.$('#cf', vista).addEventListener('input', revisar);
    if (nueva) A.marcarCambios(guardar, () => A.ir('colecciones'));
    const subir = async () => {
      const f = await A.elegirArchivo(); if (!f) return;
      try { imagenNueva = await A.comprimir(f, 1000, 0.82); $('cf-img').innerHTML = '<img src="' + imagenNueva + '" alt="" style="object-fit:cover">'; revisar(); } catch (e) { A.toast(e.message, true); }
    };
    $('cf-img').addEventListener('click', subir);
    if ($('cf-eliminar')) $('cf-eliminar').addEventListener('click', async () => {
      const n = A.productos.filter(p => p.category === orig.id).length;
      if (!(await A.confirmar(n ? 'La colección tiene ' + n + ' producto(s). Si la eliminas, quedan «sin colección» (no se borran) y tendrás que asignarles otra.' : 'La colección está vacía.', { titulo: '¿Eliminar «' + orig.nombre + '»?', si: 'Eliminar', peligro: true }))) return;
      try { await A.ref.settings.set({ categorias: A.colecciones().filter(c => c.id !== orig.id) }, { merge: true }); A.limpiarCambios(); A.toast('Colección eliminada'); A.ir('colecciones'); } catch (e) { A.errorGuardar(e); }
    });

    async function guardar() {
      const v = leer();
      if (!v.nombre) { A.avisar('Ponle un nombre a la colección.'); return false; }
      const pref = v.prefijo || 'PR';
      if (A.colecciones().some(c => c.id !== orig.id && (c.prefijo || '').toUpperCase() === pref)) {
        if (!(await A.confirmar('Otra colección ya usa el código «' + pref + '». Los códigos de productos podrían repetirse.', { si: 'Guardar igual' }))) return false;
      }
      const lista = A.colecciones();
      const i = lista.findIndex(c => c.id === orig.id);
      const col = Object.assign({}, i >= 0 ? lista[i] : orig, { nombre: v.nombre, sub: v.sub, prefijo: pref });
      if (imagenNueva) col.imagen = imagenNueva;
      if (i >= 0) lista[i] = col; else lista.push(col);
      const peso = A.pesoSettings({ categorias: lista });
      if (peso > 1040000 && peso > A.pesoSettings()) { A.avisar('No cabe: la configuración de la tienda quedaría muy pesada (' + Math.round(peso / 1024) + ' KB de 1.000 KB). Usa una imagen más liviana o quita la imagen de otra colección.', 'Imagen muy pesada'); return false; }
      try {
        await A.ref.settings.set({ categorias: lista }, { merge: true });
        if (v.orden !== base.orden) {
          const ords = ordenInicial.map(id => Number((A.productos.find(p => p.id === id) || {}).order) || 0).sort((a, b) => a - b);
          const lote = A.db.batch(); let n = 0;
          orden.forEach((id, k) => { const p = A.productos.find(x => x.id === id); if ((Number(p.order) || 0) !== ords[k]) { lote.update(A.ref.items.doc(id), { order: ords[k] }); p.order = ords[k]; n++; } });
          if (n) await lote.commit();
        }
        A.limpiarCambios(); A.toast(nueva ? 'Colección creada ✓' : 'Colección guardada ✓');
        if (nueva) A.ir('colecciones/' + orig.id); else A.repintar();
        return true;
      } catch (e) { A.errorGuardar(e); return false; }
    }
  }, ['productos', 'settings']);

  function slug(t) { return A.sinTildes(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  // ============================================================
  //  inventario
  // ============================================================
  const invCambios = {};   // id -> {stock?, cantidad?}
  A.pagina('inventario', function (vista) {
    if (!A.listo.productos) { vista.innerHTML = A.cargandoHtml; return; }
    const q = A.query();
    const f = q.filtro || 'todos';
    const val = (p, k) => (invCambios[p.id] && k in invCambios[p.id]) ? invCambios[p.id][k] : (k === 'cantidad' ? kvStockCantidad(p) : p[k]);
    const FIL = { todos: () => true, pocos: p => { const c = kvStockCantidad(p); return visible(p) && c !== null && c > 0 && c <= 3; }, agotados: p => visible(p) && kvStockCantidad(p) === 0, sin: p => kvStockCantidad(p) === null, ocultos: p => !visible(p) };
    const cols = A.colecciones();
    const posCol = (p) => { const i = cols.findIndex(c => c.id === p.category); return i < 0 ? 99 : i; };
    const lista = A.productos.filter(FIL[f] || FIL.todos).sort((a, b) => posCol(a) - posCol(b) || (Number(a.order) || 0) - (Number(b.order) || 0));
    vista.innerHTML = '<div class="pag ancha">' + A.cab('Inventario', { volver: 'productos' }) +
      '<p class="pag-sub">Cambia la cantidad o la visibilidad de varios productos y guarda todo junto. Deja la cantidad vacía para no controlarla.</p>' +
      '<div class="tarjeta"><div class="pestanas">' + [['todos', 'Todos'], ['pocos', 'Pocas unidades'], ['agotados', 'Agotados'], ['sin', 'Sin control'], ['ocultos', 'Ocultos']]
        .map(x => '<button class="pestana' + (f === x[0] ? ' activa' : '') + '" data-f="' + x[0] + '">' + x[1] + '<span class="n">' + A.productos.filter(FIL[x[0]]).length + '</span></button>').join('') + '</div>' +
      (!lista.length ? A.vacio('📦', 'Nada por aquí', '') :
      '<div class="tabla-env"><table class="tabla"><thead><tr><th>Producto</th><th>Colección</th><th>Visible</th><th>Cantidad</th></tr></thead><tbody>' +
      lista.map(p => '<tr><td><div class="celda-prod">' + A.imgProd(p) + '<div><a href="#/productos/' + p.id + '"><b>' + h(p.name) + '</b></a><small>' + h(p.code || '') + '</small></div></div></td><td class="tenue">' + h(A.nombreCol(p.category)) + '</td>' +
        '<td><label class="interruptor" style="margin:0"><input type="checkbox" data-vis="' + p.id + '"' + (val(p, 'stock') ? ' checked' : '') + '><span class="pista"></span></label></td>' +
        '<td><input class="inp" style="width:90px" inputmode="numeric" data-cant="' + p.id + '" value="' + (val(p, 'cantidad') == null ? '' : val(p, 'cantidad')) + '" placeholder="—"></td></tr>').join('') +
      '</tbody></table></div>') + '</div></div>';
    A.$$('[data-f]', vista).forEach(b => b.addEventListener('click', () => A.ir('inventario' + (b.dataset.f === 'todos' ? '' : '?filtro=' + b.dataset.f))));
    const marcar = () => {
      Object.keys(invCambios).forEach(id => {
        const p = A.productos.find(x => x.id === id), c = invCambios[id];
        if ('stock' in c && c.stock === !!p.stock) delete c.stock;
        if ('cantidad' in c && c.cantidad === kvStockCantidad(p)) delete c.cantidad;
        if (!Object.keys(c).length) delete invCambios[id];
      });
      if (Object.keys(invCambios).length) A.marcarCambios(guardarInv, () => { Object.keys(invCambios).forEach(k => delete invCambios[k]); A.repintar(); });
      else A.limpiarCambios();
    };
    A.$$('[data-vis]', vista).forEach(c => c.addEventListener('change', () => { (invCambios[c.dataset.vis] = invCambios[c.dataset.vis] || {}).stock = c.checked; marcar(); }));
    A.$$('[data-cant]', vista).forEach(c => c.addEventListener('input', () => {
      const t = c.value.replace(/[^0-9]/g, ''); if (t !== c.value) c.value = t;
      (invCambios[c.dataset.cant] = invCambios[c.dataset.cant] || {}).cantidad = t === '' ? null : parseInt(t, 10);
      marcar();
    }));
  }, ['productos']);

  async function guardarInv() {
    const ids = Object.keys(invCambios);
    const malos = ids.filter(id => { const p = A.productos.find(x => x.id === id); return invCambios[id].stock === true && (!String(p.name || '').trim() || !(p.price > 0)); });
    if (malos.length) { A.avisar(malos.length + ' producto(s) no tienen nombre o precio y no se pueden hacer visibles. Ábrelos y complétalos.'); return false; }
    const lote = A.db.batch();
    ids.forEach(id => lote.update(A.ref.items.doc(id), invCambios[id]));
    try {
      await lote.commit();
      ids.forEach(id => { Object.assign(A.productos.find(x => x.id === id), invCambios[id]); delete invCambios[id]; });
      A.toast(ids.length + ' producto(s) actualizados ✓');
      setTimeout(A.repintar, 0);
      return true;
    } catch (e) { A.errorGuardar(e); return false; }
  }
})();
