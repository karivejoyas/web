/* Panel · Informes y estadísticas, y Vista en tiempo real.
   Las visitas son anónimas: solo ciudad aproximada, dispositivo, de dónde
   llegó y qué miró (igual que en el panel antiguo). */
(function () {
  'use strict';
  const h = A.h;
  const pct = (a, b) => b ? Math.round(a * 1000 / b) / 10 : 0;
  const coma = (n) => String(n).replace('.', ',');
  const fechaVisita = (v) => new Date(v.creada || v.ultima || 0).getTime();

  function barras(titulo, filas, total) {
    return '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:12px">' + titulo + '</h2>' + (!filas.length ? '<p class="ayuda">Sin datos todavía.</p>' :
      '<div class="barras-h">' + filas.map(f => '<div class="bh"><span title="' + h(f.k) + '">' + h(f.k) + '</span><div class="bh-pista"><div class="bh-relleno" style="width:' + Math.max(2, pct(f.n, total || filas[0].n)) + '%"></div></div><b>' + (f.txt || f.n) + '</b></div>').join('') + '</div>') + '</div>';
  }
  function top(lista, sacar, n) {
    const c = {};
    lista.forEach(x => { const k = sacar(x); if (k) c[k] = (c[k] || 0) + 1; });
    return Object.keys(c).map(k => ({ k: k, n: c[k] })).sort((a, b) => b.n - a.n).slice(0, n || 6);
  }

  let periodo = '30';
  A.pagina('informes', function (vista) {
    const per = A.periodo(periodo);
    const ventas = A.pedidos.filter(p => A.esVenta(p) && A.fechaPedido(p) >= per.desde);
    const total = ventas.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const vis = A.visitas.filter(v => fechaVisita(v) >= per.desde);
    const vieron = vis.filter(v => Math.max((v.productos || []).length, (v.productosIds || []).length) > 0).length;
    const carrito = vis.filter(v => v.agregoCarrito || (v.carritoActual || []).length).length;
    const pidieron = vis.filter(v => v.hizoPedido).length;

    // productos y colecciones más vendidos
    const vendidos = {}, porCol = {};
    ventas.forEach(p => (p.items || []).forEach(it => {
      const k = it.id || it.code;
      vendidos[k] = vendidos[k] || { nombre: it.name, code: it.code, n: 0, plata: 0 };
      vendidos[k].n += it.qty; vendidos[k].plata += (it.precio || 0) * it.qty;
      const prod = A.productos.find(x => x.id === it.id);
      const col = prod ? A.nombreCol(prod.category) : 'Sin colección';
      porCol[col] = (porCol[col] || 0) + (it.precio || 0) * it.qty;
    }));
    const topVend = Object.values(vendidos).sort((a, b) => b.n - a.n).slice(0, 10);
    const cols = Object.keys(porCol).map(k => ({ k: k, n: porCol[k], txt: A.clp(porCol[k]) })).sort((a, b) => b.n - a.n);
    const cupones = top(ventas.filter(p => p.cupon), p => p.cupon.codigo, 6);
    const medios = top(ventas, p => p.medioPago === 'mercadopago' ? 'Tarjeta (Mercado Pago)' : 'Transferencia', 3);
    const regiones = top(ventas, p => (p.direccion || {}).region, 6);
    const vistos = {};
    vis.forEach(v => (v.productosIds || []).forEach(id => { vistos[id] = (vistos[id] || 0) + 1; }));
    const topVistos = Object.keys(vistos).map(id => ({ p: A.productos.find(x => x.id === id), n: vistos[id] })).filter(x => x.p).sort((a, b) => b.n - a.n).slice(0, 8);

    vista.innerHTML = '<div class="pag ancha">' + A.cab('Informes y estadísticas', { acciones: '<a class="btn" href="#/informes/vivo"><span class="pulso"></span> Vista en tiempo real</a>' }) +
      '<div class="selector-periodo"><div class="grupo-btn">' + [['hoy', 'Hoy'], ['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['365', '12 meses']].map(x => '<button class="btn btn-chico' + (periodo === x[0] ? ' activo' : '') + '" data-per="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
        '<span class="ayuda">Las visitas cuentan las últimas ' + A.visitas.length + ' registradas.</span></div>' +
      '<div class="metricas">' +
        '<div class="metrica"><span>Ventas totales</span><b>' + A.clp(total) + '</b></div>' +
        '<div class="metrica"><span>Pedidos</span><b>' + ventas.length + '</b><small>ticket promedio ' + A.clp(ventas.length ? total / ventas.length : 0) + '</small></div>' +
        '<div class="metrica"><span>Sesiones</span><b>' + vis.length + '</b></div>' +
        '<div class="metrica"><span>Conversión</span><b>' + coma(pct(pidieron, vis.length)) + '%</b></div>' +
      '</div>' +
      '<div class="rejilla-2">' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Ventas</h2></div>' + A.grafico(A.serie(per, A.pedidos.filter(A.esVenta), A.fechaPedido, p => Number(p.total) || 0).map(d => Object.assign(d, { tip: A.clp(d.valor) })), { titulo: 'Ventas', formato: (v) => v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + v }) + '</div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Sesiones</h2></div>' + A.grafico(A.serie(per, A.visitas, fechaVisita, () => 1).map(d => Object.assign(d, { tip: d.valor + ' sesiones' })), { titulo: 'Sesiones' }) + '</div>' +
      '</div>' +
      '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:12px">Embudo de compra</h2><div class="barras-h">' +
        [['Entraron a la tienda', vis.length], ['Abrieron un producto', vieron], ['Agregaron al carrito', carrito], ['Hicieron el pedido', pidieron]].map(x =>
          '<div class="bh"><span>' + x[0] + '</span><div class="bh-pista"><div class="bh-relleno" style="width:' + Math.max(1.5, pct(x[1], vis.length)) + '%"></div></div><b>' + x[1] + ' <small class="tenue">(' + coma(pct(x[1], vis.length)) + '%)</small></b></div>').join('') +
      '</div></div>' +
      '<div class="rejilla-2">' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Productos más vendidos</h2></div>' + (!topVend.length ? '<div class="tarjeta-c ayuda">Sin ventas en este periodo.</div>' :
          '<div class="tabla-env mt"><table class="tabla"><thead><tr><th>Producto</th><th class="num">Unid.</th><th class="num">Ventas</th></tr></thead><tbody>' + topVend.map(x => '<tr><td>' + h(x.nombre) + ' <span class="tenue">' + h(x.code || '') + '</span></td><td class="num">' + x.n + '</td><td class="num">' + A.clp(x.plata) + '</td></tr>').join('') + '</tbody></table></div>') + '</div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Productos más vistos</h2></div>' + (!topVistos.length ? '<div class="tarjeta-c ayuda">Sin datos todavía.</div>' :
          '<div class="tabla-env mt"><table class="tabla"><tbody>' + topVistos.map(x => '<tr class="click" data-p="' + x.p.id + '"><td><div class="celda-prod">' + A.imgProd(x.p) + '<div><b>' + h(x.p.name) + '</b><small>' + h(x.p.code || '') + '</small></div></div></td><td class="num">' + x.n + ' visitas</td></tr>').join('') + '</tbody></table></div>') + '</div>' +
        barras('Ventas por colección', cols) +
        barras('Ventas por región', regiones) +
        barras('De dónde llegan', top(vis, v => v.origenTipo || 'Directo'), vis.length) +
        barras('Dispositivo', top(vis, v => v.dispositivo), vis.length) +
        barras('Ciudad', top(vis, v => v.ciudad, 8), vis.length) +
        barras('Medio de pago', medios, ventas.length) +
        (cupones.length ? barras('Cupones usados', cupones, ventas.length) : '') +
      '</div></div>';
    A.$$('[data-per]', vista).forEach(b => b.addEventListener('click', () => { periodo = b.dataset.per; A.repintar(); }));
    A.$$('tr[data-p]', vista).forEach(tr => tr.addEventListener('click', () => A.ir('productos/' + tr.dataset.p)));
  }, ['pedidos', 'productos']);

  // ============================================================
  //  vista en tiempo real
  // ============================================================
  let reloj = null;
  const ICONO_DISP = { 'Móvil': '📱', 'Tablet': '📲', 'Escritorio': '💻' };
  A.pagina('informes/vivo', function (vista) {
    clearInterval(reloj);
    reloj = setInterval(() => { if (A.rutaActual() === 'informes/vivo') A.refrescar('reloj'); else clearInterval(reloj); }, 20000);
    const ahora = Date.now(), hace5 = ahora - 5 * 60000;
    const hoy = A.periodo('hoy').desde;
    const activos = A.visitas.filter(v => new Date(v.ultima || 0).getTime() >= hace5);
    const deHoy = A.visitas.filter(v => fechaVisita(v) >= hoy);
    const ventasHoy = A.pedidos.filter(p => A.esVenta(p) && A.fechaPedido(p) >= hoy);
    const carritos = activos.filter(v => (v.carritoActual || []).length && !v.hizoPedido).length;
    const enPago = activos.filter(v => (v.contacto || {}).correo && !v.hizoPedido).length;
    const compras = deHoy.filter(v => v.hizoPedido).length;
    const lugares = top(deHoy, v => [v.ciudad, (v.region || '').replace(/Metropolitan$/i, 'Metropolitana')].filter(Boolean).join(', ') || v.pais, 10);
    const recientes = A.visitas.slice(0, 25);

    vista.innerHTML = '<div class="pag ancha">' + A.cab('Vista en tiempo real <span class="ins azul sin-punto"><span class="pulso"></span>&nbsp;Ahora mismo</span>', { volver: 'informes' }) +
      '<div class="metricas"><div class="metrica"><span>Visitantes ahora mismo</span><b>' + activos.length + '</b><small>últimos 5 minutos</small></div>' +
        '<div class="metrica"><span>Ventas de hoy</span><b>' + A.clp(ventasHoy.reduce((s, p) => s + (Number(p.total) || 0), 0)) + '</b></div>' +
        '<div class="metrica"><span>Sesiones de hoy</span><b>' + deHoy.length + '</b></div>' +
        '<div class="metrica"><span>Pedidos de hoy</span><b>' + ventasHoy.length + '</b></div></div>' +
      '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:10px">Comportamiento de clientes</h2><div class="metricas tres" style="box-shadow:none;margin:0">' +
        '<div class="metrica"><span>Carritos activos</span><b>' + carritos + '</b></div><div class="metrica"><span>En el pago</span><b>' + enPago + '</b></div><div class="metrica"><span>Compras realizadas hoy</span><b>' + compras + '</b></div></div></div>' +
      '<div class="vivo">' +
        barras('Sesiones de hoy por ubicación', lugares, deHoy.length) +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Actividad reciente</h2></div><div class="actividad mt">' + (!recientes.length ? '<div class="tarjeta-c ayuda">Aún no hay visitas.</div>' : recientes.map(v => {
          const enLinea = new Date(v.ultima || 0).getTime() >= hace5;
          const ubic = [v.ciudad, v.pais].filter(Boolean).join(', ') || 'Ubicación desconocida';
          const vio = (v.productos || []).slice(-3);
          const carro = (v.carritoActual || []);
          return '<div class="act"><span class="ic">' + (ICONO_DISP[v.dispositivo] || '💻') + '</span><div style="flex:1;min-width:0"><b>' + h(ubic) + '</b> ' + (enLinea ? '<span class="ins azul">en línea</span>' : '') + (v.hizoPedido ? ' <span class="ins verde">compró</span>' : '') +
            '<small>' + h(A.hace(v.ultima || v.creada)) + ' · llegó desde ' + h(v.origenTipo || 'Directo') + (v.sitio ? ' · ' + h(v.sitio) : '') + '</small>' +
            (vio.length ? '<small>Vio: ' + h(vio.join(', ')) + '</small>' : '') +
            (carro.length && !v.hizoPedido ? '<small>🛒 ' + carro.map(it => h(it.qty + '× ' + it.name)).join(', ') + ' — ' + A.clp(v.carritoTotal) + '</small>' : '') +
          '</div></div>';
        }).join('')) + '</div></div>' +
      '</div></div>';
  }, ['visitas', 'pedidos', 'reloj']);
})();
