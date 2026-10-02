/* Panel · Inicio: resumen del día, la tienda y lo que hay que hacer. */
(function () {
  'use strict';
  const h = A.h;

  /* Un pedido cuenta como venta si ya tiene número o el pago está aprobado,
     y no es un pago con tarjeta que nunca se completó. */
  A.esVenta = function (p) {
    if (/^(sin-pago|rejected|cancelled|esperando-pago)$/.test(p.pagoEstado || '')) return false;
    return !!p.num || p.pagoEstado === 'approved';
  };
  A.fechaPedido = (p) => new Date(p.fecha || 0).getTime();

  A.periodo = function (clave) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dias = { hoy: 1, '7': 7, '30': 30, '90': 90, '365': 365 }[clave] || 7;
    const desde = new Date(hoy); desde.setDate(desde.getDate() - (dias - 1));
    return { desde: desde.getTime(), dias: dias, clave: clave };
  };

  /* Gráfico de columnas (una sola serie, morado de la marca), con tooltip.
     datos: [{etq, valor, tip}] */
  A.grafico = function (datos, opc) {
    opc = opc || {};
    const W = 640, H = opc.alto || 200, izq = 46, der = 8, arr = 10, abj = 26;
    const max = Math.max(1, ...datos.map(d => d.valor));
    const paso = A.pasoEje(max);
    const tope = Math.ceil(max / paso) * paso;
    const ancho = (W - izq - der) / Math.max(1, datos.length);
    const bw = Math.max(3, Math.min(24, ancho - 6));
    const y = (v) => arr + (H - arr - abj) * (1 - v / tope);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + h(opc.titulo || 'Gráfico') + '">';
    for (let v = 0; v <= tope; v += paso) {
      s += '<line class="rejilla-l" x1="' + izq + '" x2="' + (W - der) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
        '<text class="eje" x="' + (izq - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + h(opc.formato ? opc.formato(v, true) : v) + '</text>';
    }
    const cadaEtq = Math.ceil(datos.length / 10);
    datos.forEach((d, i) => {
      const x = izq + i * ancho + (ancho - bw) / 2;
      const yy = y(d.valor), alto = Math.max(0, H - abj - yy);
      const r = Math.min(4, alto / 2, bw / 2);
      const path = alto > 0
        ? 'M' + x + ',' + (H - abj) + 'V' + (yy + r) + 'Q' + x + ',' + yy + ' ' + (x + r) + ',' + yy + 'H' + (x + bw - r) + 'Q' + (x + bw) + ',' + yy + ' ' + (x + bw) + ',' + (yy + r) + 'V' + (H - abj) + 'Z'
        : '';
      s += '<g data-i="' + i + '"><rect class="barra-hit" x="' + (izq + i * ancho) + '" y="' + arr + '" width="' + ancho + '" height="' + (H - arr - abj) + '"/>' +
        (path ? '<path class="barra" d="' + path + '"/>' : '') + '</g>';
      if (i % cadaEtq === 0) s += '<text class="eje" x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + h(d.etq) + '</text>';
    });
    s += '</svg>';
    const id = 'g' + A.id();
    setTimeout(() => conectar(id, datos), 0);
    return '<div class="grafico" id="' + id + '">' + s + '<div class="tooltip" hidden></div></div>';
  };
  A.pasoEje = function (max) {
    const bruto = max / 4, mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const n = bruto / mag;
    return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag);
  };
  function conectar(id, datos) {
    const el = document.getElementById(id); if (!el) return;
    const tip = el.querySelector('.tooltip'), svg = el.querySelector('svg');
    el.querySelectorAll('g[data-i]').forEach(g => {
      const mostrar = () => {
        const d = datos[+g.dataset.i];
        el.querySelectorAll('g.activa').forEach(x => x.classList.remove('activa'));
        g.classList.add('activa');
        const hit = g.querySelector('.barra-hit').getBoundingClientRect(), caja = el.getBoundingClientRect();
        const barra = g.querySelector('.barra');
        const top = barra ? barra.getBoundingClientRect().top : hit.bottom - 30;
        tip.innerHTML = '<b>' + h(d.tip || d.valor) + '</b>' + h(d.etqLarga || d.etq);
        tip.style.left = (hit.left - caja.left + hit.width / 2) + 'px';
        tip.style.top = (top - caja.top - 4) + 'px';
        tip.hidden = false;
      };
      g.addEventListener('mouseenter', mostrar);
      g.addEventListener('touchstart', mostrar, { passive: true });
    });
    svg.addEventListener('mouseleave', () => { tip.hidden = true; el.querySelectorAll('g.activa').forEach(x => x.classList.remove('activa')); });
  }

  /* Serie diaria (o por hora si es "hoy") de un valor. */
  A.serie = function (per, elementos, fechaDe, valorDe) {
    const datos = [];
    if (per.clave === 'hoy') {
      for (let hr = 0; hr < 24; hr++) datos.push({ etq: String(hr).padStart(2, '0'), etqLarga: 'Hoy a las ' + hr + ':00', valor: 0 });
      elementos.forEach(x => { const t = fechaDe(x); if (t >= per.desde) datos[new Date(t).getHours()].valor += valorDe(x); });
      return datos;
    }
    const idx = {};
    for (let i = 0; i < per.dias; i++) {
      const d = new Date(per.desde); d.setDate(d.getDate() + i);
      idx[A.diaClave(d)] = datos.length;
      datos.push({ etq: d.getDate() + (per.dias > 31 ? '/' + (d.getMonth() + 1) : ''), etqLarga: d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }), valor: 0 });
    }
    elementos.forEach(x => { const t = fechaDe(x); if (t >= per.desde) { const k = idx[A.diaClave(t)]; if (k != null) datos[k].valor += valorDe(x); } });
    return datos;
  };

  let periodo = 'hoy', marcoTienda = null;
  A.pagina('inicio', function (vista) {
    const per = A.periodo(periodo);
    const ventas = A.pedidos.filter(p => A.esVenta(p) && A.fechaPedido(p) >= per.desde);
    const total = ventas.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const vis = A.visitas.filter(v => new Date(v.creada || v.ultima || 0).getTime() >= per.desde);
    const conv = vis.length ? Math.round(ventas.length * 1000 / vis.length) / 10 : 0;
    const porVerificar = A.pedidos.filter(A.pedidoEsNuevo);
    const porPreparar = A.pedidos.filter(p => p.estado === 'verificado' || p.estado === 'preparando');
    const visibles = A.productos.filter(p => p.stock === true);
    const agotados = A.productos.filter(p => p.stock === true && kvStockCantidad(p) === 0);
    const bajos = A.productos.filter(p => p.stock === true && (kvStockCantidad(p) || 0) > 0 && kvStockCantidad(p) <= 3);
    const desde7 = A.periodo('7').desde;
    const abandonados = A.visitas.filter(v => !v.hizoPedido && (v.carritoActual || []).length && (v.contacto || {}).correo && new Date(v.ultima || 0).getTime() >= desde7);
    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

    const tareas = [];
    if (porVerificar.length) tareas.push(['#/pedidos?estado=nuevo', '🧾', '<b>' + porVerificar.length + ' pedido' + (porVerificar.length > 1 ? 's' : '') + '</b> por verificar el pago']);
    if (porPreparar.length) tareas.push(['#/pedidos?estado=preparar', '📦', '<b>' + porPreparar.length + ' pedido' + (porPreparar.length > 1 ? 's' : '') + '</b> por preparar y enviar']);
    if (abandonados.length) tareas.push(['#/pedidos/pendientes', '🛒', '<b>' + abandonados.length + ' carrito' + (abandonados.length > 1 ? 's' : '') + ' abandonado' + (abandonados.length > 1 ? 's' : '') + '</b> que puedes recuperar']);
    if (agotados.length) tareas.push(['#/inventario?filtro=agotados', '⚠️', '<b>' + agotados.length + ' producto' + (agotados.length > 1 ? 's' : '') + '</b> visibles con 0 unidades']);
    if (bajos.length) tareas.push(['#/inventario?filtro=pocos', '📉', '<b>' + bajos.length + ' producto' + (bajos.length > 1 ? 's' : '') + '</b> con pocas unidades']);
    if (A.webError === 'permiso') tareas.push(['#/config/respaldos', '🔐', '<b>Falta activar un permiso</b> para guardar los cambios de la web']);

    const ultimos = A.pedidos.slice().sort((a, b) => A.fechaPedido(b) - A.fechaPedido(a)).slice(0, 5);

    vista.innerHTML = '<div class="pag">' +
      '<div class="saludo">' + saludo + ', Karina</div>' +
      '<p class="ayuda" style="margin:0 0 16px">Esto es lo que está pasando en tu tienda.</p>' +
      '<div class="selector-periodo"><div class="grupo-btn">' +
        [['hoy', 'Hoy'], ['7', '7 días'], ['30', '30 días']].map(x => '<button class="btn btn-chico' + (periodo === x[0] ? ' activo' : '') + '" data-per="' + x[0] + '">' + x[1] + '</button>').join('') +
      '</div></div>' +
      '<div class="metricas">' +
        '<div class="metrica"><span>Sesiones</span><b>' + vis.length + '</b></div>' +
        '<div class="metrica"><span>Ventas totales</span><b>' + A.clp(total) + '</b></div>' +
        '<div class="metrica"><span>Pedidos</span><b>' + ventas.length + '</b></div>' +
        '<div class="metrica"><span>Conversión</span><b>' + String(conv).replace('.', ',') + '%</b></div>' +
      '</div>' +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Ventas ' + (periodo === 'hoy' ? 'de hoy por hora' : 'por día') + '</h2></div>' +
        A.grafico(A.serie(per, A.pedidos.filter(A.esVenta), A.fechaPedido, p => Number(p.total) || 0).map(d => Object.assign(d, { tip: A.clp(d.valor) })), { alto: 170, titulo: 'Ventas', formato: (v, eje) => eje && v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : A.clp(v) }) +
      '</div>' +
      '<div class="dos-col"><div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Por hacer</h2></div><div class="tareas mt">' +
          (tareas.length ? tareas.map(t => '<a href="' + t[0] + '"><span class="ic">' + t[1] + '</span><span>' + t[2] + '</span>' + A.ic.volver.replace('M12.5 4 6.5 10l6 6', 'M7.5 4l6 6-6 6') + '</a>').join('')
            : '<div class="vacio" style="padding:22px"><span class="ic">✨</span>Todo al día. No hay nada pendiente.</div>') +
        '</div></div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Últimos pedidos</h2><div class="acciones"><a class="btn btn-plano btn-chico" href="#/pedidos">Ver todos</a></div></div>' +
          (ultimos.length ? '<div class="tabla-env mt"><table class="tabla"><tbody>' + ultimos.map(p => {
            const e = A.estadoPedido(p);
            return '<tr class="click" data-ir="pedidos/' + p.id + '"><td class="min"><b>' + (p.num ? '#' + p.num : '—') + '</b></td><td>' + h((p.cliente || {}).nombre || 'Sin nombre') + '<div class="tenue">' + A.hace(p.fecha) + '</div></td><td>' + e.html + '</td><td class="num">' + A.clp(p.total) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : A.vacio('🛍', 'Aún no hay pedidos', '')) +
        '</div>' +
      '</div><div>' +
        '<div class="vista-tienda"><div class="vista-tienda-barra"><i></i><i></i><span>' + h(location.host) + '</span></div>' +
          '<div class="vista-tienda-marco" id="ini-marco"><iframe src="/" title="Vista de la tienda" loading="lazy" tabindex="-1"></iframe></div></div>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px"><a class="btn btn-primario" href="#/tienda/editor">Personalizar tema</a><a class="btn" href="/" target="_blank" rel="noopener">Ver tienda ' + A.ic.externo + '</a></div>' +
        '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:8px">Tu catálogo</h2>' +
          '<div class="resumen-fila"><span>Productos visibles</span><b>' + visibles.length + '</b></div>' +
          '<div class="resumen-fila"><span>Ocultos o sin stock</span><b>' + (A.productos.length - visibles.length) + '</b></div>' +
          '<div class="resumen-fila"><span>Colecciones</span><b>' + A.colecciones().length + '</b></div>' +
          '<div class="resumen-fila"><span>Suscriptores</span><b>' + new Set(A.suscritos.map(s => String(s.correo || '').toLowerCase())).size + '</b></div>' +
          (A.generadoWeb ? '<p class="ayuda mt" style="margin:10px 0 0">La web se publicó por última vez el ' + h(A.generadoWeb.split('-').reverse().join('-')) + '. Los cambios aparecen solos en unos 5 a 8 minutos.</p>' : '') +
        '</div>' +
      '</div></div>' +
    '</div>';

    A.$$('[data-per]', vista).forEach(b => b.addEventListener('click', () => { periodo = b.dataset.per; A.repintar(); }));
    A.$$('[data-ir]', vista).forEach(tr => tr.addEventListener('click', () => A.ir(tr.dataset.ir)));
    const marco = A.$('#ini-marco', vista);
    const escalar = () => { const f = marco.querySelector('iframe'); const s = marco.clientWidth / 1280; f.style.transform = 'scale(' + s + ')'; marco.style.height = Math.round(760 * s) + 'px'; };
    escalar(); window.addEventListener('resize', escalar, { once: true });
  }, ['pedidos', 'productos']);   // las visitas cambian a cada rato: no recargan la vista de la tienda
})();
