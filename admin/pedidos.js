/* Panel · Pedidos (lista, detalle) y carritos abandonados.
   Misma lógica que el panel antiguo: verificar el pago descuenta el stock una
   sola vez, "Marcar enviado" no avisa a nadie y el correo sale con su botón. */
(function () {
  'use strict';
  const h = A.h;

  // ---------- estados ----------
  function estadoPago(p) {
    if (p.medioPago === 'mercadopago') {
      const e = p.pagoEstado || '';
      if (e === 'approved') return ['Pagado', 'verde'];
      if (e === 'esperando-pago') return ['Esperando pago', 'ambar'];
      if (e === 'por-verificar') return ['Por verificar', 'ambar'];
      if (e === 'rejected') return ['Rechazado', 'rojo'];
      if (e === 'sin-pago') return ['Sin pago', 'rojo'];
      if (e === 'cancelled') return ['Cancelado', 'rojo'];
      return [e ? e : 'Pendiente', 'ambar'];
    }
    return (p.estado || 'nuevo') === 'nuevo' ? ['Pago por verificar', 'ambar'] : ['Pagado', 'verde'];
  }
  function estadoPrep(p) {
    const e = p.estado || 'nuevo';
    if (e === 'enviado') return ['Enviado', 'verde'];
    if (e === 'preparando') return ['Preparando', 'azul'];
    return ['No preparado', 'ambar'];
  }
  A.estadoPedido = function (p) {
    const a = estadoPago(p), b = estadoPrep(p);
    return { pago: a, prep: b, html: '<span class="ins ' + a[1] + '">' + h(a[0]) + '</span>' };
  };
  const ins = (x) => '<span class="ins ' + x[1] + '">' + h(x[0]) + '</span>';
  const articulos = (p) => (p.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const sinPagar = (p) => p.medioPago === 'mercadopago' && /^(esperando-pago|sin-pago|rejected|cancelled)$/.test(p.pagoEstado || '');
  function ordenar(lista) {
    return lista.slice().sort((a, b) => {
      if (!a.num !== !b.num) return a.num ? 1 : -1;      // sin número = recién se fue a pagar: arriba
      if (!a.num && !b.num) return String(b.fecha || '').localeCompare(String(a.fecha || ''));
      return (b.num || 0) - (a.num || 0);
    });
  }

  // ============================================================
  //  lista
  // ============================================================
  let filtroTexto = '';
  const PESTANAS = [
    ['todos', 'Todos', () => true],
    ['nuevo', 'Por verificar', A.pedidoEsNuevo],
    ['preparar', 'Por preparar', p => p.estado === 'verificado' || p.estado === 'preparando'],
    ['enviado', 'Enviados', p => p.estado === 'enviado'],
    ['sinpago', 'Sin pagar', sinPagar]
  ];
  A.pagina('pedidos', function (vista) {
    const q = A.query();
    const pest = PESTANAS.find(x => x[0] === q.estado) || PESTANAS[0];
    const txt = A.sinTildes(filtroTexto);
    const lista = ordenar(A.pedidos.filter(pest[2]).filter(p => !txt || A.sinTildes(
      '#' + (p.num || '') + ' ' + ((p.cliente || {}).nombre || '') + ' ' + ((p.cliente || {}).correo || '') + ' ' + ((p.cliente || {}).telefono || '') + ' ' + (p.items || []).map(i => i.name + ' ' + i.code).join(' ')
    ).indexOf(txt) !== -1));
    vista.innerHTML = '<div class="pag ancha">' +
      A.cab('Pedidos', { acciones: '<button class="btn" id="ped-exportar">' + A.ic.descargar + ' Exportar</button>' }) +
      (!A.pubClave() && A.pubUrl() ? '<div class="nota">⚠ En <b>este</b> dispositivo no está guardada tu clave secreta, así que los correos a las clientas y la verificación de Mercado Pago no van a funcionar. <a href="#/config/notificaciones">Escríbela aquí</a> (es la misma del panel antiguo).</div>' : '') +
      '<div class="tarjeta">' +
        '<div class="pestanas">' + PESTANAS.map(x => {
          const n = A.pedidos.filter(x[2]).length;
          return '<button class="pestana' + (x === pest ? ' activa' : '') + '" data-pest="' + x[0] + '">' + x[1] + (x[0] !== 'todos' && n ? '<span class="n">' + n + '</span>' : '') + '</button>';
        }).join('') + '</div>' +
        '<div class="filtros"><label class="buscar">' + A.ic.buscar + '<input id="ped-buscar" placeholder="Buscar por número, nombre, correo o producto" value="' + h(filtroTexto) + '"></label></div>' +
        (!A.listo.pedidos ? A.cargandoHtml : !lista.length ? A.vacio('🛍', A.pedidos.length ? 'No hay pedidos aquí' : 'Aún no hay pedidos', A.pedidos.length ? 'Prueba con otra pestaña o búsqueda.' : 'Cuando alguien compre en la web, aparecerá aquí.') :
        '<div class="tabla-env"><table class="tabla"><thead><tr><th>Pedido</th><th class="om">Fecha</th><th>Cliente</th><th class="num">Total</th><th>Estado del pago</th><th class="om">Preparación</th><th class="num om">Artículos</th><th class="om">Medio</th></tr></thead><tbody>' +
        lista.map(p => {
          const e = A.estadoPedido(p);
          return '<tr class="click" data-id="' + p.id + '"><td class="min"><b>' + (p.num ? '#' + p.num : 'sin N°') + '</b></td>' +
            '<td class="tenue om" style="white-space:nowrap">' + h(A.fecha(p.fecha)) + '</td>' +
            '<td>' + h((p.cliente || {}).nombre || 'Sin nombre') + '</td>' +
            '<td class="num">' + A.clp(p.total) + '</td><td>' + ins(e.pago) + '</td><td class="om">' + ins(e.prep) + '</td>' +
            '<td class="num om">' + articulos(p) + '</td><td class="tenue om">' + (p.medioPago === 'mercadopago' ? 'Tarjeta' : 'Transferencia') + '</td></tr>';
        }).join('') + '</tbody></table></div>') +
      '</div></div>';
    A.$$('[data-pest]', vista).forEach(b => b.addEventListener('click', () => A.ir('pedidos' + (b.dataset.pest === 'todos' ? '' : '?estado=' + b.dataset.pest))));
    A.$$('tr[data-id]', vista).forEach(tr => tr.addEventListener('click', () => A.ir('pedidos/' + tr.dataset.id)));
    const bus = A.$('#ped-buscar', vista);
    bus.addEventListener('input', () => { filtroTexto = bus.value; clearTimeout(bus._t); bus._t = setTimeout(() => { A.repintar(); const b2 = A.$('#ped-buscar'); b2.focus(); b2.setSelectionRange(b2.value.length, b2.value.length); }, 250); });
    A.$('#ped-exportar', vista).addEventListener('click', () => {
      const filas = [['Pedido', 'Fecha', 'Cliente', 'Correo', 'Teléfono', 'Dirección', 'Comuna', 'Región', 'Productos', 'Subtotal', 'Cupón', 'Descuento', 'Envío', 'Total', 'Medio de pago', 'Estado', 'Courier', 'Seguimiento']];
      lista.forEach(p => {
        const c = p.cliente || {}, d = p.direccion || {};
        filas.push([p.num || '', A.fecha(p.fecha), c.nombre, c.correo, c.telefono, d.calle, d.comuna, d.region,
          (p.items || []).map(i => i.qty + 'x ' + i.name + ' (' + (i.code || '') + ')').join(' | '), p.subtotal || '', (p.cupon || {}).codigo || '', (p.cupon || {}).descuento || '',
          (p.envio || {}).costo || '', p.total || '', p.medioPago === 'mercadopago' ? 'Mercado Pago' : 'Transferencia', kvPedidoEstado(p.estado).nombre, p.courier || '', p.tracking || '']);
      });
      A.descargar('pedidos-karive-' + A.diaClave(Date.now()) + '.csv', A.csv(filas), 'text/csv;charset=utf-8');
    });
  }, ['pedidos']);

  // ============================================================
  //  detalle
  // ============================================================
  A.pagina('pedidos/:id', function (vista, params) {
    if (!A.listo.pedidos) { vista.innerHTML = A.cargandoHtml; return; }
    const p = A.pedidos.find(x => x.id === params.id);
    if (!p) { vista.innerHTML = '<div class="pag">' + A.cab('Pedido', { volver: 'pedidos' }) + '<div class="tarjeta">' + A.vacio('🔍', 'No encontramos este pedido', 'Puede que se haya eliminado.') + '</div></div>'; return; }
    const e = A.estadoPedido(p), est = p.estado || 'nuevo';
    const cli = p.cliente || {}, dir = p.direccion || {};
    const tel = String(cli.telefono || '').replace(/[^0-9]/g, '');
    const telWa = tel.length <= 9 ? '56' + tel : tel;
    const ojo = kvCorreoOjo(cli.correo || '');
    const otros = otrosPedidos(p);

    const itemsHtml = (p.items || []).map(it => {
      const prod = A.productos.find(x => x.id === it.id);
      return '<div class="linea-item">' + (prod ? A.imgProd(prod) : '<img class="miniatura" src="' + A.SIN_FOTO + '" alt="">') +
        '<div class="t">' + (prod ? '<a href="#/productos/' + prod.id + '">' + h(it.name) + '</a>' : h(it.name)) + '<small>' + h(it.code || '') + '</small></div>' +
        '<span class="tenue">' + A.clp(it.precio) + ' × ' + it.qty + '</span><b style="min-width:80px;text-align:right">' + A.clp((it.precio || 0) * it.qty) + '</b></div>';
    }).join('');

    let accion = '';
    if (est === 'nuevo') accion = '<button class="btn btn-primario" data-acc="verificar">✅ Marcar pago verificado</button>';
    else if (est === 'verificado') accion = '<button class="btn btn-primario" data-acc="preparar">📦 Empezar a preparar</button>';
    const envioForm = (est === 'preparando' || est === 'enviado') ?
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Envío</h2>' + ins(e.prep) + '</div><div class="tarjeta-c">' +
        '<div class="fila-campos tres"><label class="campo"><span>Courier</span><input id="pe-courier" value="' + h(p.courier || 'Bluexpress') + '"></label>' +
        '<label class="campo"><span>N° de seguimiento</span><input id="pe-track" value="' + h(p.tracking || '') + '"></label>' +
        '<label class="campo"><span>Link de seguimiento</span><input id="pe-turl" value="' + h(p.trackingUrl || '') + '" placeholder="https://…"></label></div>' +
        (p.avisoFecha ? '<div class="nota ok">✉️ Avisada por correo el ' + h(A.fecha(p.avisoFecha)) + '</div>' : (est === 'enviado' ? '<div class="nota">✉️ Todavía no le has avisado por correo.</div>' : '')) +
      '</div><div class="tarjeta-pie">' +
        (est === 'preparando' ? '<button class="btn btn-primario" data-acc="enviado">🚚 Marcar enviado</button>' : '<button class="btn" data-acc="guardar-envio">Guardar seguimiento</button>') +
        '<button class="btn" data-acc="avisar">✉️ Avisar por correo</button>' +
      '</div></div>' : '';

    const pagoHtml = p.medioPago === 'mercadopago'
      ? '<div class="nota ' + (p.pagoEstado === 'approved' ? 'ok' : /rejected|sin-pago|cancelled/.test(p.pagoEstado || '') ? 'mal' : '') + '">💳 Mercado Pago · ' + (p.pagoId ? 'N° ' + h(p.pagoId) : 'ref. ' + h(p.pagoRef || '—')) + '<br>' + ({
          approved: '✅ Pago confirmado con Mercado Pago', 'esperando-pago': '⏳ Se fue a pagar con tarjeta: verifica si pagó', 'por-verificar': '⏳ Aún no verificado: verifica antes de enviar',
          rejected: '❌ Mercado Pago rechazó el pago', 'sin-pago': '❌ No hay ningún pago con esta referencia (no completó la compra)' }[p.pagoEstado] || (p.pagoEstado ? '⚠ ' + h(p.pagoEstado) : '')) +
        (p.pagoDetalle ? '<br><small>' + h(p.pagoDetalle) + '</small>' : '') + '</div>' +
        '<button class="btn" data-acc="verificar-mp">🔎 Verificar pago con Mercado Pago</button>'
      : (p.comprobante ? '<a class="comprobante" href="' + h(p.comprobante) + '" target="_blank" rel="noopener" style="background-image:url(\'' + h(p.comprobante) + '\')" title="Ver comprobante en grande"></a><p class="ayuda mt">Toca el comprobante para verlo en grande.</p>' : '<div class="nota">⚠ La clienta no adjuntó comprobante.</div>');

    const hitos = [];
    hitos.push(['Pedido recibido', p.fecha, true]);
    if (p.datosCorregidos) hitos.push(['Corregiste los datos de la clienta', p.datosCorregidos, true]);
    if (est !== 'nuevo') hitos.push(['Pago verificado' + (p.stockDescontado ? ' · stock descontado' : ''), '', true]);
    if (est === 'preparando' || est === 'enviado') hitos.push(['En preparación', '', true]);
    if (p.enviadoFecha) hitos.push(['Enviado' + (p.tracking ? ' · ' + (p.courier || '') + ' ' + p.tracking : ''), p.enviadoFecha, true]);
    if (p.avisoFecha) hitos.push(['Se le avisó por correo', p.avisoFecha, true]);

    vista.innerHTML = '<div class="pag">' +
      A.cab((p.num ? '#' + p.num : 'Pedido sin número') + ' ' + ins(e.pago) + ' ' + ins(e.prep), {
        volver: 'pedidos',
        acciones: '<button class="btn" data-acc="imprimir">' + A.ic.imprimir + ' Imprimir</button>' +
          (est !== 'nuevo' ? '<button class="btn" data-acc="retroceder">↩ Retroceder estado</button>' : '') +
          '<button class="btn btn-peligro" data-acc="eliminar">' + A.ic.basura + ' Eliminar</button>'
      }) +
      '<p class="pag-sub">' + h(A.fecha(p.fecha)) + ' · ' + (p.medioPago === 'mercadopago' ? 'Pago con tarjeta (Mercado Pago)' : 'Transferencia bancaria') + '</p>' +
      '<div class="dos-col"><div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Artículos</h2>' + ins(e.prep) + '</div><div class="tarjeta-c">' + itemsHtml + '</div>' +
          (accion ? '<div class="tarjeta-pie">' + accion + '</div>' : '') + '</div>' +
        envioForm +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Pago</h2>' + ins(e.pago) + '</div><div class="tarjeta-c">' +
          '<div class="resumen-fila"><span>Subtotal · ' + articulos(p) + ' artículo' + (articulos(p) === 1 ? '' : 's') + '</span><span>' + A.clp(p.subtotal || (p.items || []).reduce((s, i) => s + (i.precio || 0) * i.qty, 0)) + '</span></div>' +
          (p.cupon ? '<div class="resumen-fila"><span>Cupón <code>' + h(p.cupon.codigo || '') + '</code></span><span>−' + A.clp(p.cupon.descuento) + '</span></div>' : '') +
          '<div class="resumen-fila"><span>Envío · ' + h((p.envio || {}).region || '') + '</span><span>' + A.clp((p.envio || {}).costo) + '</span></div>' +
          '<div class="resumen-fila total"><span>Total</span><span>' + A.clp(p.total) + '</span></div>' +
          '<div class="sep"></div>' + pagoHtml +
        '</div></div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Cronología</h2></div><div class="tarjeta-c"><div class="cronologia">' +
          hitos.map(x => '<div class="hito ok">' + h(x[0]) + (x[1] ? '<small>' + h(A.fecha(x[1])) + '</small>' : '') + '</div>').join('') +
        '</div></div></div>' +
      '</div><div>' +
        (p.notas ? '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:6px">Notas de la clienta</h2><p style="margin:0;white-space:pre-line">' + h(p.notas) + '</p></div>' : '') +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Cliente</h2><div class="acciones"><button class="btn btn-plano btn-chico" data-acc="corregir">' + A.ic.lapiz + ' Corregir</button></div></div><div class="tarjeta-c">' +
          '<div class="dato-cli"><a href="#/clientes/' + encodeURIComponent(String(cli.correo || '').toLowerCase()) + '"><b>' + h(cli.nombre || 'Sin nombre') + '</b></a><div class="tenue">' + (otros.length ? otros.length + ' pedido' + (otros.length > 1 ? 's' : '') + ' anterior' + (otros.length > 1 ? 'es' : '') : 'Primera compra') + '</div></div>' +
          '<div class="dato-cli"><div class="etq">Contacto</div><a href="mailto:' + h(cli.correo || '') + '">' + h(cli.correo || '—') + '</a>' +
            (ojo ? '<div class="nota">⚠ Este correo parece mal escrito. ¿Será <b>' + h(ojo) + '</b>? Confírmalo por WhatsApp antes de enviar.</div>' : '') +
            '<div><a target="_blank" rel="noopener" href="https://wa.me/' + telWa + '">' + h(cli.telefono || '') + '</a></div></div>' +
          '<div class="dato-cli"><div class="etq">Dirección de envío</div>' + h(dir.calle || '') + '<br>' + h(dir.comuna || '') + '<br>' + h(dir.region || '') + '</div>' +
          (otros.length && p.cupon ? '<div class="nota">⚠ Usó el cupón <b>' + h(p.cupon.codigo) + '</b> y ya había comprado antes (pedido #' + h(otros[0].num || '?') + ').</div>' : '') +
        '</div></div>' +
        (otros.length ? '<div class="tarjeta"><div class="tarjeta-cab"><h2>Pedidos anteriores</h2></div><div class="tarjeta-c">' + otros.slice(0, 5).map(o =>
          '<div class="resumen-fila"><a href="#/pedidos/' + o.id + '">#' + h(o.num || '—') + '</a><span class="tenue">' + h(A.fecha(o.fecha, false)) + '</span><span>' + A.clp(o.total) + '</span></div>').join('') + '</div></div>' : '') +
      '</div></div></div>';

    A.$$('[data-acc]', vista).forEach(b => b.addEventListener('click', () => acciones[b.dataset.acc](p, b)));
  }, ['pedidos', 'productos']);

  function otrosPedidos(p) {
    const cli = p.cliente || {}, dir = p.direccion || {};
    const mail = String(cli.correo || '').toLowerCase().trim();
    const fono = String(cli.telefono || '').replace(/[^0-9]/g, '').slice(-8);
    const calle = String(dir.calle || '').toLowerCase().replace(/\s+/g, ' ').trim();
    return A.pedidos.filter(o => o.id !== p.id && A.fechaPedido(o) < A.fechaPedido(p) && (() => {
      const c = o.cliente || {}, d = o.direccion || {};
      return (mail && String(c.correo || '').toLowerCase().trim() === mail) ||
        (fono && String(c.telefono || '').replace(/[^0-9]/g, '').slice(-8) === fono) ||
        (calle && String(d.calle || '').toLowerCase().replace(/\s+/g, ' ').trim() === calle);
    })()).sort((a, b) => A.fechaPedido(b) - A.fechaPedido(a));
  }

  const actualizar = (id, datos) => A.ref.pedidos.doc(id).update(datos);
  const datosEnvio = (p) => ({
    courier: ((A.$('#pe-courier') || {}).value || p.courier || 'Bluexpress').trim(),
    tracking: ((A.$('#pe-track') || {}).value || p.tracking || '').trim(),
    trackingUrl: ((A.$('#pe-turl') || {}).value || p.trackingUrl || '').trim()
  });

  /* Descuenta del stock lo que lleva el pedido (una sola vez por pedido). Solo
     toca los productos que tienen cantidad anotada. */
  async function descontarStock(p) {
    if (p.stockDescontado) return;
    const avisos = [];
    if (!A.productos.length) await A.cargarProductos();
    const lote = A.db.batch();
    (p.items || []).forEach(it => {
      const prod = A.productos.find(x => x.id === it.id);
      const c = kvStockCantidad(prod);
      if (c === null) return;
      const nueva = Math.max(0, c - (it.qty || 0));
      if (c < (it.qty || 0)) avisos.push(prod.name + ' (quedaban ' + c + ', pidió ' + it.qty + ')');
      lote.update(A.ref.items.doc(it.id), { cantidad: nueva });
      A.productoLocal(it.id, { cantidad: nueva });
    });
    lote.update(A.ref.pedidos.doc(p.id), { stockDescontado: true });
    await lote.commit();
    if (avisos.length) A.avisar('Ojo con el stock:\n\n• ' + avisos.join('\n• ') + '\n\nQuedaron en 0. Revisa si alcanzas a cumplir el pedido.', 'Stock');
  }

  async function pedirNumero(p) {
    try {
      const d = await A.publicador({ accion: 'pedido', comprobante: '', pedido: {
        cliente: p.cliente || {}, direccion: p.direccion || {}, items: p.items || [], subtotal: p.subtotal || 0, cupon: p.cupon || null,
        envio: p.envio || null, total: p.total || 0, notas: p.notas || '', medioPago: p.medioPago || '', pagoRef: p.pagoRef || '' } });
      return (d && d.ok && d.num) ? d.num : 0;
    } catch (e) { console.warn(e); return 0; }
  }

  const acciones = {
    async verificar(p) {
      if (p.medioPago === 'mercadopago' && p.pagoEstado !== 'approved' &&
        !(await A.confirmar('Mercado Pago todavía no confirma este pago. ¿Lo marcas como verificado igual?', { si: 'Marcar verificado' }))) return;
      try { await descontarStock(p); await actualizar(p.id, { estado: 'verificado' }); A.toast('Pago verificado ✓'); } catch (e) { A.errorGuardar(e); }
    },
    async preparar(p) { try { await actualizar(p.id, { estado: 'preparando' }); A.toast('Pedido en preparación'); } catch (e) { A.errorGuardar(e); } },
    async enviado(p, b) {
      const d = datosEnvio(p); b.disabled = true;
      try { await actualizar(p.id, Object.assign({ estado: 'enviado', enviadoFecha: new Date().toISOString() }, d)); A.toast('Marcado como enviado. Si quieres, ahora avísale por correo.'); }
      catch (e) { A.errorGuardar(e); b.disabled = false; }
    },
    async 'guardar-envio'(p) { try { await actualizar(p.id, datosEnvio(p)); A.toast('Seguimiento guardado'); } catch (e) { A.errorGuardar(e); } },
    async retroceder(p) {
      const i = KV_PEDIDO_ESTADOS.findIndex(x => x.id === (p.estado || 'nuevo'));
      const ant = KV_PEDIDO_ESTADOS[Math.max(0, i - 1)];
      if (!(await A.confirmar('El pedido vuelve a «' + ant.nombre + '». El stock ya descontado no se devuelve.', { si: 'Retroceder' }))) return;
      try { await actualizar(p.id, { estado: ant.id }); } catch (e) { A.errorGuardar(e); }
    },
    async eliminar(p) {
      if (!(await A.confirmar('Se borra del panel. No le avisa nada a la clienta y no se puede deshacer.', { titulo: '¿Eliminar el pedido ' + (p.num ? '#' + p.num : '') + '?', si: 'Eliminar', peligro: true }))) return;
      try { await A.ref.pedidos.doc(p.id).delete(); A.toast('Pedido eliminado'); A.ir('pedidos'); } catch (e) { A.errorGuardar(e); }
    },
    async avisar(p, b) {
      const d = datosEnvio(p);
      const correo = String((p.cliente || {}).correo || '').trim();
      if (!d.tracking && !(await A.confirmar('Este pedido no tiene número de seguimiento. ¿Le mando el correo igual?', { si: 'Enviar igual' }))) return;
      let motivo = '';
      if (!A.pubUrl()) motivo = 'Falta la dirección del publicador (Configuración → Notificaciones).';
      else if (!A.pubClave()) motivo = 'En este dispositivo no está guardada tu clave secreta. Escríbela una vez en Configuración → Notificaciones (es la misma del panel antiguo).';
      else if (!correo) motivo = 'El pedido no trae el correo de la clienta. Agrégalo con «Corregir».';
      if (motivo) { A.avisar('No se pudo mandar el correo.\n\n' + motivo, 'Correo no enviado'); return; }
      b.disabled = true; b.textContent = 'Enviando…';
      try {
        const r = await A.publicador({ accion: 'pedido-envio', clave: A.pubClave(), num: p.num, correo: correo, nombre: (p.cliente || {}).nombre || '', courier: d.courier, tracking: d.tracking, trackingUrl: d.trackingUrl });
        if (!r || !r.ok) throw new Error((r && r.error) || 'el publicador no pudo enviarlo');
        await actualizar(p.id, Object.assign({ avisoFecha: new Date().toISOString() }, d));
        A.toast('Correo enviado a ' + correo + ' ✓');
      } catch (e) {
        const ojo = kvCorreoOjo(correo);
        A.avisar('No se pudo mandar el correo: ' + e.message + (ojo ? '\n\nOjo: el correo parece mal escrito. ¿Será ' + ojo + '?' : '') + '\n\nEl pedido no cambió. Puedes avisarle por WhatsApp.', 'Correo no enviado');
        b.disabled = false; b.textContent = '✉️ Avisar por correo';
      }
    },
    async 'verificar-mp'(p, b) {
      if (!A.pubUrl() || !A.pubClave()) { A.avisar('Para consultar a Mercado Pago falta la dirección del publicador o tu clave secreta en este dispositivo (Configuración → Notificaciones).'); return; }
      if (!p.pagoId && !p.pagoRef) { A.avisar('Este pedido no tiene datos de pago de Mercado Pago.'); return; }
      b.disabled = true; b.textContent = 'Consultando…';
      try {
        const d = await A.publicador({ accion: 'mp-verificar', clave: A.pubClave(), pagoId: p.pagoId || '', referencia: p.pagoRef || '' });
        if (!d || !d.ok) throw new Error((d && d.error) || 'No se pudo consultar');
        if (d.estado === 'sin-pago') {
          await actualizar(p.id, { pagoEstado: 'sin-pago', pagoDetalle: 'Consultado el ' + new Date().toLocaleString('es-CL') + ': no hay ningún pago con esta referencia.' });
          A.avisar('Mercado Pago no tiene ningún pago con esta referencia.\n\nLo más probable es que la clienta se arrepintiera antes de pagar. Puedes eliminar este pedido.', 'Sin pago');
        } else {
          const ok = d.estado === 'approved', montoOk = Math.abs(Number(d.monto || 0) - Number(p.total || 0)) < 1;
          await actualizar(p.id, { pagoEstado: d.estado, pagoId: d.pagoId || p.pagoId || '', pagoMedio: d.medio || '',
            pagoDetalle: (ok ? 'Verificado el ' + new Date().toLocaleString('es-CL') : (d.detalle || '')) + (ok && !montoOk ? ' · ⚠ el monto pagado (' + A.clp(d.monto) + ') NO calza con el total del pedido' : '') });
          let extra = '';
          if (ok && !p.num) {
            const n = await pedirNumero(p);
            if (n) { await actualizar(p.id, { num: n }); extra = '\n\nComo la clienta no volvió del pago, recién ahora se le asignó el número #' + n + ' y se le mandó el correo de confirmación.'; }
            else extra = '\n\n⚠ No se pudo asignar el número ni mandar el correo de confirmación. El pedido igual está aquí.';
          }
          A.avisar((ok ? (montoOk ? '✅ Pago confirmado por ' + A.clp(d.monto) + '. Ya puedes preparar el pedido.' : '⚠ El pago está aprobado pero por ' + A.clp(d.monto) + ', y el pedido es de ' + A.clp(p.total) + '. Revisa antes de enviar.')
            : '⚠ Mercado Pago dice que el pago está en estado «' + d.estado + '». No envíes el pedido hasta que aparezca aprobado.') + extra, 'Mercado Pago');
        }
      } catch (e) { A.avisar('No se pudo verificar el pago: ' + e.message); }
      b.disabled = false; b.textContent = '🔎 Verificar pago con Mercado Pago';
    },
    corregir(p) { corregirDatos(p); },
    imprimir(p) { imprimir(p); }
  };

  /* Corregir los datos de la clienta (correo mal escrito, dirección incompleta).
     Los artículos y el total no se tocan, salvo el envío si cambia la región. */
  function corregirDatos(p) {
    const cli = p.cliente || {}, dir = p.direccion || {};
    const opcComunas = (reg, actualC) => {
      const cs = kvComunasDe(reg);
      return (actualC && cs.indexOf(actualC) < 0 ? '<option selected>' + h(actualC) + '</option>' : '') + cs.map(c => '<option' + (c === actualC ? ' selected' : '') + '>' + h(c) + '</option>').join('');
    };
    A.modal({
      titulo: 'Corregir datos de la clienta',
      html: '<label class="campo"><span>Nombre</span><input id="cd-nombre" value="' + h(cli.nombre || '') + '"></label>' +
        '<div class="fila-campos"><label class="campo"><span>Correo</span><input id="cd-correo" type="email" value="' + h(cli.correo || '') + '"></label>' +
        '<label class="campo"><span>Teléfono</span><input id="cd-tel" type="tel" value="' + h(cli.telefono || '') + '"></label></div>' +
        '<label class="campo"><span>Dirección</span><input id="cd-calle" value="' + h(dir.calle || '') + '"></label>' +
        '<div class="fila-campos"><label class="campo"><span>Región</span><select id="cd-region">' + KV_REGIONES.map(r => '<option' + (r === dir.region ? ' selected' : '') + '>' + h(r) + '</option>').join('') + '</select></label>' +
        '<label class="campo"><span>Comuna</span><select id="cd-comuna">' + opcComunas(dir.region, dir.comuna) + '</select></label></div>' +
        '<p class="ayuda">El costo del envío se recalcula solo si cambias de región.</p>',
      alAbrir: (c) => { A.$('#cd-region', c).addEventListener('change', () => { A.$('#cd-comuna', c).innerHTML = opcComunas(A.$('#cd-region', c).value, ''); }); },
      botones: [{ texto: 'Cancelar' }, { texto: 'Guardar', clase: 'btn-primario', accion: async (c) => {
        const v = (id) => A.$('#' + id, c).value.trim();
        const correo = v('cd-correo');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) { A.toast('Revisa el correo: no parece válido.', true); return false; }
        const region = v('cd-region');
        const cambios = {
          cliente: Object.assign({}, cli, { nombre: v('cd-nombre'), correo: correo, telefono: v('cd-tel') }),
          direccion: Object.assign({}, dir, { calle: v('cd-calle'), comuna: v('cd-comuna'), region: region }),
          datosCorregidos: new Date().toISOString()
        };
        if (region !== (dir.region || '')) {
          const envio = kvEnvioCosto(region);
          const total = Math.max(0, Number(p.total || 0) - Number((p.envio || {}).costo || 0)) + envio;
          A.cerrarModal();
          if (!(await A.confirmar('Cambiaste la región. El envío pasa de ' + A.clp((p.envio || {}).costo) + ' a ' + A.clp(envio) + ', y el total de ' + A.clp(p.total) + ' a ' + A.clp(total) + '. ¿Lo dejo así?', { si: 'Sí, guardar' }))) return;
          cambios.envio = Object.assign({}, p.envio || {}, { region: region, costo: envio });
          cambios.total = total;
        }
        try { await actualizar(p.id, cambios); A.toast('Datos corregidos ✓'); } catch (e) { A.errorGuardar(e); }
      } }]
    });
  }

  function imprimir(p) {
    const cli = p.cliente || {}, dir = p.direccion || {};
    const w = window.open('', '_blank');
    if (!w) { A.toast('Permite las ventanas emergentes para imprimir.', true); return; }
    w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Pedido ' + h(p.num || '') + '</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:30px auto;color:#2A1838;padding:0 16px}h1{font-family:Georgia,serif;font-weight:500;margin:0}table{width:100%;border-collapse:collapse;margin:18px 0}td,th{padding:8px 4px;border-bottom:1px solid #ddd;text-align:left}td:last-child,th:last-child{text-align:right}.cols{display:flex;gap:30px;margin-top:20px}.cols div{flex:1}small{color:#777}</style></head><body>' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><div><h1>Karivé Joyas</h1><small>karivejoyas.cl</small></div><div style="text-align:right"><b style="font-size:22px">Pedido ' + (p.num ? '#' + h(p.num) : '') + '</b><br><small>' + h(A.fecha(p.fecha)) + '</small></div></div>' +
      '<div class="cols"><div><b>Enviar a</b><br>' + h(cli.nombre || '') + '<br>' + h(dir.calle || '') + '<br>' + h(dir.comuna || '') + ', ' + h(dir.region || '') + '<br>' + h(cli.telefono || '') + '</div><div><b>Contacto</b><br>' + h(cli.correo || '') + '</div></div>' +
      '<table><tr><th>Producto</th><th>Código</th><th>Cant.</th><th>Total</th></tr>' + (p.items || []).map(i => '<tr><td>' + h(i.name) + '</td><td>' + h(i.code || '') + '</td><td>' + i.qty + '</td><td>' + A.clp((i.precio || 0) * i.qty) + '</td></tr>').join('') +
      (p.cupon ? '<tr><td colspan="3">Cupón ' + h(p.cupon.codigo || '') + '</td><td>−' + A.clp(p.cupon.descuento) + '</td></tr>' : '') +
      '<tr><td colspan="3">Envío</td><td>' + A.clp((p.envio || {}).costo) + '</td></tr><tr><th colspan="3">Total</th><th>' + A.clp(p.total) + '</th></tr></table>' +
      (p.notas ? '<p><b>Notas:</b> ' + h(p.notas) + '</p>' : '') + '<p style="text-align:center;margin-top:40px"><small>¡Gracias por tu compra! 💜</small></p><script>window.print()<\/script></body></html>');
    w.document.close();
  }

  // ============================================================
  //  carritos abandonados (de las visitas)
  // ============================================================
  let abPeriodo = '7';
  A.pagina('pedidos/pendientes', function (vista) {
    const per = A.periodo(abPeriodo);
    const ab = A.visitas.filter(v => !v.hizoPedido && (v.carritoActual || []).length && new Date(v.ultima || v.creada || 0).getTime() >= per.desde);
    const con = ab.filter(v => (v.contacto || {}).correo);
    const plata = ab.reduce((s, v) => s + (Number(v.carritoTotal) || 0), 0);
    vista.innerHTML = '<div class="pag">' + A.cab('Carritos abandonados') +
      '<p class="pag-sub">Personas que pusieron productos en el carrito pero no terminaron la compra. Si alcanzaron a dejar sus datos, puedes escribirles.</p>' +
      '<div class="selector-periodo"><div class="grupo-btn">' + [['7', '7 días'], ['30', '30 días'], ['90', '90 días']].map(x => '<button class="btn btn-chico' + (abPeriodo === x[0] ? ' activo' : '') + '" data-per="' + x[0] + '">' + x[1] + '</button>').join('') + '</div></div>' +
      '<div class="metricas tres"><div class="metrica"><span>Carritos abandonados</span><b>' + ab.length + '</b></div><div class="metrica"><span>Quedó sin vender</span><b>' + A.clp(plata) + '</b></div><div class="metrica"><span>Se pueden recuperar</span><b>' + con.length + '</b></div></div>' +
      '<div class="tarjeta">' + (!con.length ? A.vacio('🎉', 'Nada que recuperar', ab.length ? 'Hubo ' + ab.length + ' carritos, pero nadie alcanzó a dejar sus datos.' : 'Ningún carrito abandonado en este periodo.') :
        '<div class="tabla-env"><table class="tabla"><thead><tr><th>Cliente</th><th>Carrito</th><th class="num">Total</th><th>Fecha</th><th></th></tr></thead><tbody>' +
        con.map(v => {
          const c = v.contacto || {};
          return '<tr><td><b>' + h(c.nombre || 'Sin nombre') + '</b><div class="tenue">' + h(c.correo) + (c.telefono ? ' · ' + h(c.telefono) : '') + '</div></td>' +
            '<td>' + (v.carritoActual || []).map(it => h(it.qty + '× ' + it.name)).join('<br>') + '</td><td class="num">' + A.clp(v.carritoTotal) + '</td>' +
            '<td class="tenue" style="white-space:nowrap">' + h(A.hace(v.ultima || v.creada)) + '</td><td class="min">' + botonesRecuperar(v) + '</td></tr>';
        }).join('') + '</tbody></table></div>') + '</div></div>';
    A.$$('[data-per]', vista).forEach(b => b.addEventListener('click', () => { abPeriodo = b.dataset.per; A.repintar(); }));
  }, ['visitas']);

  function botonesRecuperar(v) {
    const c = v.contacto || {};
    const nombre = String(c.nombre || '').split(' ')[0] || 'hola';
    const lista = (v.carritoActual || []).map(it => '• ' + it.qty + '× ' + it.name).join('\n');
    const cup = kvCupones(A.settings).find(x => x.activo !== false);
    const gancho = cup ? '\n\nSi quieres, usa el código ' + cup.codigo + ' (' + kvCuponTexto(cup) + ') 💜' : '';
    const msg = 'Hola ' + nombre + ' 💜 Soy de Karivé Joyas. Vi que dejaste esto en tu carrito:\n\n' + lista + '\n\n¿Te ayudo a terminar tu compra? Quedan poquitas unidades ✨' + gancho;
    const tel = String(c.telefono || '').replace(/[^0-9]/g, '');
    let s = '<div style="display:flex;gap:6px">';
    if (tel) s += '<a class="btn btn-chico" target="_blank" rel="noopener" href="https://wa.me/' + (tel.length <= 9 ? '56' + tel : tel) + '?text=' + encodeURIComponent(msg) + '">WhatsApp</a>';
    s += '<a class="btn btn-chico" href="mailto:' + h(c.correo) + '?subject=' + encodeURIComponent('Se te quedó algo en el carrito 💜 Karivé Joyas') + '&body=' + encodeURIComponent(msg) + '">Correo</a></div>';
    return s;
  }
  A.botonesRecuperar = botonesRecuperar;
})();
