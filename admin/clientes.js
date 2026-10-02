/* Panel · Clientes (se arman con los pedidos) y suscriptores del boletín. */
(function () {
  'use strict';
  const h = A.h;

  A.clientes = function () {
    const mapa = new Map();
    A.pedidos.forEach(p => {
      const c = p.cliente || {};
      const clave = String(c.correo || '').toLowerCase().trim() || ('tel:' + String(c.telefono || '').replace(/[^0-9]/g, '').slice(-8));
      if (!clave || clave === 'tel:') return;
      const x = mapa.get(clave) || { clave: clave, nombre: '', correo: '', telefono: '', region: '', comuna: '', pedidos: [], gastado: 0, ultimo: 0, suscrito: false };
      const t = A.fechaPedido(p);
      if (t >= x.ultimo) { x.nombre = c.nombre || x.nombre; x.correo = c.correo || x.correo; x.telefono = c.telefono || x.telefono; x.region = (p.direccion || {}).region || x.region; x.comuna = (p.direccion || {}).comuna || x.comuna; x.ultimo = t; }
      x.pedidos.push(p);
      if (A.esVenta(p)) x.gastado += Number(p.total) || 0;
      mapa.set(clave, x);
    });
    const sus = new Set(A.suscritos.map(s => String(s.correo || '').toLowerCase().trim()));
    mapa.forEach(x => { x.suscrito = sus.has(String(x.correo).toLowerCase()); x.ventas = x.pedidos.filter(A.esVenta).length; });
    return [...mapa.values()].sort((a, b) => b.ultimo - a.ultimo);
  };

  let txt = '', orden = 'reciente';
  A.pagina('clientes', function (vista) {
    const t = A.sinTildes(txt);
    let lista = A.clientes().filter(c => !t || A.sinTildes(c.nombre + ' ' + c.correo + ' ' + c.telefono + ' ' + c.comuna).indexOf(t) !== -1);
    if (orden === 'gasto') lista.sort((a, b) => b.gastado - a.gastado);
    if (orden === 'pedidos') lista.sort((a, b) => b.ventas - a.ventas);
    const recurrentes = A.clientes().filter(c => c.ventas > 1).length;
    vista.innerHTML = '<div class="pag ancha">' + A.cab('Clientes', { acciones: '<button class="btn" id="cl-exportar">' + A.ic.descargar + ' Exportar</button>' }) +
      '<div class="metricas tres"><div class="metrica"><span>Clientes</span><b>' + A.clientes().length + '</b></div><div class="metrica"><span>Compraron más de una vez</span><b>' + recurrentes + '</b></div><div class="metrica"><span>Suscriptores</span><b>' + new Set(A.suscritos.map(s => String(s.correo || '').toLowerCase())).size + '</b></div></div>' +
      '<div class="tarjeta"><div class="filtros"><label class="buscar">' + A.ic.buscar + '<input id="cl-buscar" placeholder="Buscar por nombre, correo, teléfono o comuna" value="' + h(txt) + '"></label>' +
        '<select id="cl-orden">' + [['reciente', 'Última compra'], ['gasto', 'Más gastado'], ['pedidos', 'Más pedidos']].map(o => '<option value="' + o[0] + '"' + (orden === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      (!lista.length ? A.vacio('👤', 'Aún no hay clientes', 'Las personas que compren aparecerán aquí.') :
      '<div class="tabla-env"><table class="tabla"><thead><tr><th>Cliente</th><th>Ubicación</th><th>Suscripción</th><th class="num">Pedidos</th><th class="num">Gastado</th><th>Última compra</th></tr></thead><tbody>' +
      lista.map(c => '<tr class="click" data-c="' + h(c.clave) + '"><td><b>' + h(c.nombre || 'Sin nombre') + '</b><div class="tenue">' + h(c.correo || c.telefono) + '</div></td><td class="tenue">' + h([c.comuna, c.region].filter(Boolean).join(', ')) + '</td>' +
        '<td>' + (c.suscrito ? '<span class="ins verde">Suscrita</span>' : '<span class="ins">No suscrita</span>') + '</td><td class="num">' + c.ventas + '</td><td class="num">' + A.clp(c.gastado) + '</td><td class="tenue">' + h(A.hace(new Date(c.ultimo).toISOString())) + '</td></tr>').join('') +
      '</tbody></table></div>') + '</div></div>';
    const b = A.$('#cl-buscar', vista);
    b.addEventListener('input', () => { txt = b.value; clearTimeout(b._t); b._t = setTimeout(() => { A.repintar(); const x = A.$('#cl-buscar'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 220); });
    A.$('#cl-orden', vista).addEventListener('change', (e) => { orden = e.target.value; A.repintar(); });
    A.$$('tr[data-c]', vista).forEach(tr => tr.addEventListener('click', () => A.ir('clientes/' + encodeURIComponent(tr.dataset.c))));
    A.$('#cl-exportar', vista).addEventListener('click', () => {
      const filas = [['Nombre', 'Correo', 'Teléfono', 'Comuna', 'Región', 'Pedidos', 'Gastado', 'Suscrita']];
      lista.forEach(c => filas.push([c.nombre, c.correo, c.telefono, c.comuna, c.region, c.ventas, c.gastado, c.suscrito ? 'Sí' : 'No']));
      A.descargar('clientes-karive-' + A.diaClave(Date.now()) + '.csv', A.csv(filas), 'text/csv;charset=utf-8');
    });
  }, ['pedidos', 'suscritos']);

  A.pagina('clientes/:id', function (vista, params) {
    if (params.id === 'suscriptores') return suscriptores(vista);
    const c = A.clientes().find(x => x.clave === String(params.id).toLowerCase());
    if (!c) { vista.innerHTML = '<div class="pag">' + A.cab('Cliente', { volver: 'clientes' }) + '<div class="tarjeta">' + A.vacio('👤', 'No encontramos a esta persona', 'Los clientes se arman con los pedidos.') + '</div></div>'; return; }
    const tel = String(c.telefono || '').replace(/[^0-9]/g, '');
    const prods = {};
    c.pedidos.filter(A.esVenta).forEach(p => (p.items || []).forEach(i => { prods[i.name] = (prods[i.name] || 0) + i.qty; }));
    vista.innerHTML = '<div class="pag">' + A.cab(h(c.nombre || 'Sin nombre'), { volver: 'clientes' }) +
      '<p class="pag-sub">' + (c.region ? h(c.comuna + ', ' + c.region) + ' · ' : '') + 'cliente desde ' + h(A.fecha(c.pedidos[c.pedidos.length - 1].fecha, false)) + '</p>' +
      '<div class="metricas tres"><div class="metrica"><span>Gastado</span><b>' + A.clp(c.gastado) + '</b></div><div class="metrica"><span>Pedidos</span><b>' + c.ventas + '</b></div><div class="metrica"><span>Ticket promedio</span><b>' + A.clp(c.ventas ? c.gastado / c.ventas : 0) + '</b></div></div>' +
      '<div class="dos-col"><div><div class="tarjeta"><div class="tarjeta-cab"><h2>Pedidos</h2></div><div class="tabla-env mt"><table class="tabla"><tbody>' +
        c.pedidos.slice().sort((a, b) => A.fechaPedido(b) - A.fechaPedido(a)).map(p => '<tr class="click" data-p="' + p.id + '"><td><b>' + (p.num ? '#' + p.num : '—') + '</b></td><td class="tenue">' + h(A.fecha(p.fecha)) + '</td><td>' + A.estadoPedido(p).html + '</td><td class="num">' + A.clp(p.total) + '</td></tr>').join('') +
      '</tbody></table></div></div>' +
      (Object.keys(prods).length ? '<div class="tarjeta tarjeta-c"><h2 style="margin-bottom:8px">Lo que ha comprado</h2>' + Object.keys(prods).map(n => '<div class="resumen-fila"><span>' + h(n) + '</span><span>' + prods[n] + '</span></div>').join('') + '</div>' : '') +
      '</div><div><div class="tarjeta tarjeta-c"><h2 style="margin-bottom:10px">Contacto</h2>' +
        (c.correo ? '<div class="dato-cli"><div class="etq">Correo</div><a href="mailto:' + h(c.correo) + '">' + h(c.correo) + '</a></div>' : '') +
        (tel ? '<div class="dato-cli"><div class="etq">Teléfono</div><a target="_blank" rel="noopener" href="https://wa.me/' + (tel.length <= 9 ? '56' + tel : tel) + '">' + h(c.telefono) + ' · WhatsApp</a></div>' : '') +
        '<div class="dato-cli"><div class="etq">Boletín</div>' + (c.suscrito ? '<span class="ins verde">Suscrita</span>' : '<span class="ins">No suscrita</span>') + '</div>' +
      '</div></div></div></div>';
    A.$$('tr[data-p]', vista).forEach(tr => tr.addEventListener('click', () => A.ir('pedidos/' + tr.dataset.p)));
  }, ['pedidos', 'suscritos']);

  // ---------- suscriptores ----------
  function suscriptores(vista) {
    const mapa = new Map();
    A.suscritos.forEach(s => {
      const c = String(s.correo || '').toLowerCase().trim(); if (!c) return;
      if (!mapa.has(c)) mapa.set(c, Object.assign({}, s, { correo: c, ids: [s.id] })); else mapa.get(c).ids.push(s.id);
    });
    const lista = [...mapa.values()];
    const compraron = new Set(A.pedidos.filter(A.esVenta).map(p => String((p.cliente || {}).correo || '').toLowerCase()));
    vista.innerHTML = '<div class="pag">' + A.cab('Suscriptores', { volver: 'clientes', acciones: '<button class="btn" id="su-copiar">' + A.ic.copiar + ' Copiar correos</button><button class="btn" id="su-exportar">' + A.ic.descargar + ' Exportar</button>' }) +
      '<p class="pag-sub">Correos que dejaron en el boletín o en el regalo de bienvenida. ' + lista.length + ' en total, ' + lista.filter(s => compraron.has(s.correo)).length + ' ya compraron.</p>' +
      '<div class="tarjeta">' + (!lista.length ? A.vacio('💌', 'Aún no hay suscriptores', 'Activa el regalo de bienvenida en Descuentos para empezar a juntarlos.') :
      '<div class="tabla-env"><table class="tabla"><thead><tr><th>Correo</th><th>Fecha</th><th>Origen</th><th>Compró</th><th></th></tr></thead><tbody>' +
      lista.map(s => '<tr><td>' + h(s.correo) + '</td><td class="tenue">' + h(A.fecha(s.fecha)) + '</td><td class="tenue">' + h(s.origen || '') + '</td><td>' + (compraron.has(s.correo) ? '<span class="ins verde">Sí</span>' : '<span class="ins">No</span>') + '</td>' +
        '<td class="min"><button class="btn btn-chico btn-plano" data-borrar="' + h(s.ids.join(',')) + '" aria-label="Eliminar">' + A.ic.basura + '</button></td></tr>').join('') +
      '</tbody></table></div>') + '</div></div>';
    A.$('#su-copiar', vista).addEventListener('click', async () => {
      const t = lista.map(s => s.correo).join(', ');
      try { await navigator.clipboard.writeText(t); A.toast(lista.length + ' correos copiados'); } catch (e) { window.prompt('Copia los correos:', t); }
    });
    A.$('#su-exportar', vista).addEventListener('click', () => A.descargar('suscriptores-karive.csv', A.csv([['Correo', 'Fecha', 'Origen']].concat(lista.map(s => [s.correo, s.fecha || '', s.origen || '']))), 'text/csv;charset=utf-8'));
    A.$$('[data-borrar]', vista).forEach(b => b.addEventListener('click', async () => {
      if (!(await A.confirmar('Se quita este correo de la lista.', { si: 'Eliminar', peligro: true }))) return;
      try { await Promise.all(b.dataset.borrar.split(',').map(id => A.ref.suscritos.doc(id).delete())); } catch (e) { A.errorGuardar(e); }
    }));
  }
})();
