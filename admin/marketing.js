/* Panel · Descuentos: descuento a toda la tienda, cupones, regalo de
   bienvenida y la lista de "Lo más visto" (los favoritos de la portada). */
(function () {
  'use strict';
  const h = A.h;
  const guardarSettings = (datos) => A.ref.settings.set(datos, { merge: true });

  function usos(codigo) {
    const c = kvCuponNormalizar(codigo);
    return A.pedidos.filter(p => p.cupon && kvCuponNormalizar(p.cupon.codigo) === c).length;
  }
  function estadoCupon(c) {
    if (c.activo === false) return ['Desactivado', ''];
    if (c.hasta && new Date(c.hasta + 'T23:59:59') < new Date()) return ['Vencido', 'rojo'];
    return ['Activo', 'verde'];
  }
  const fechaBonita = (iso) => iso ? iso.split('-').reverse().join('-') : '';

  /* Ranking de lo más visto: 1 punto por abrir el producto, 2 por ponerlo en
     el carrito y 3 por comprarlo (igual que el panel antiguo). */
  A.rankingVistos = function () {
    const cuenta = new Map();
    const sumar = (id, n) => { if (id) cuenta.set(id, (cuenta.get(id) || 0) + n); };
    A.visitas.forEach(v => { (v.productosIds || []).forEach(id => sumar(id, 1)); (v.carritoActual || []).forEach(it => sumar(it.id, 2)); });
    A.pedidos.forEach(p => (p.items || []).forEach(it => sumar(it.id, 3)));
    return [...cuenta.entries()].map(([id, n]) => ({ p: A.productos.find(x => x.id === id), n: n })).filter(r => r.p).sort((a, b) => b.n - a.n);
  };

  A.pagina('descuentos', function (vista) {
    const s = A.settings;
    const dg = kvDescuentoConfig(s), vig = kvDescuentoActivo(s);
    const cups = kvCupones(s);
    const b = kvBienvenida(s);
    const existeBien = cups.some(c => kvCuponNormalizar(c.codigo) === b.codigo);
    const mv = s.masVistos || {};
    const rank = A.rankingVistos();

    vista.innerHTML = '<div class="pag">' + A.cab('Descuentos', { acciones: '<button class="btn btn-primario" id="ds-nuevo">Crear cupón</button>' }) +
      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Cupones de descuento</h2></div>' +
      (!cups.length ? A.vacio('🎟', 'Aún no hay cupones', 'Crea un código para regalar a tus clientas.') :
        '<div class="tabla-env mt"><table class="tabla"><thead><tr><th>Código</th><th>Descuento</th><th>Condiciones</th><th>Estado</th><th class="num">Usos</th><th></th></tr></thead><tbody>' +
        cups.map((c, i) => { const e = estadoCupon(c); return '<tr><td><code style="font-size:14px">' + h(c.codigo) + '</code></td><td>' + h(kvCuponTexto(c)) + '</td>' +
          '<td class="tenue">' + (Number(c.minimo) > 0 ? 'Compras sobre ' + A.clp(c.minimo) + '<br>' : '') + (c.hasta ? 'Hasta el ' + h(fechaBonita(c.hasta)) : 'Sin vencimiento') + '</td>' +
          '<td><span class="ins ' + e[1] + '">' + e[0] + '</span></td><td class="num">' + usos(c.codigo) + '</td>' +
          '<td class="min"><button class="btn btn-chico" data-editar="' + i + '">Editar</button> <button class="btn btn-chico" data-alternar="' + i + '">' + (c.activo === false ? 'Activar' : 'Desactivar') + '</button> <button class="btn btn-chico btn-plano" data-borrar="' + i + '" aria-label="Eliminar">' + A.ic.basura + '</button></td></tr>'; }).join('') +
        '</tbody></table></div>') + '</div>' +

      '<div class="tarjeta no-refrescar-x" id="ds-global"><div class="tarjeta-cab"><h2>Descuento a toda la tienda</h2>' + (vig ? '<span class="ins verde">Activo −' + vig.pct + '%</span>' : '<span class="ins">Sin descuento</span>') + '</div><div class="tarjeta-c">' +
        '<p class="ayuda">Rebaja todos los productos en la web nueva y en el catálogo antiguo. Si un producto tiene precio de oferta, se cobra el menor.</p>' +
        A.interruptor('dg-activo', (Number(dg.pct) || 0) > 0, 'Activar descuento general') +
        '<div class="fila-campos"><label class="campo"><span>Porcentaje</span><div class="campo-pre"><input id="dg-pct" inputmode="numeric" value="' + ((Number(dg.pct) || 0) > 0 ? dg.pct : 20) + '"><span>%</span></div></label>' +
        '<label class="campo"><span>Termina el</span><input id="dg-hasta" type="date" value="' + h(dg.hasta || '') + '"><small>Vacío = sin fecha de término.</small></label></div>' +
        (dg.hasta && (Number(dg.pct) || 0) > 0 && !vig ? '<div class="nota">Este descuento venció el ' + h(fechaBonita(dg.hasta)) + '.</div>' : '') +
      '</div><div class="tarjeta-pie"><button class="btn btn-primario" id="dg-guardar">Guardar descuento</button></div></div>' +

      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Regalo de bienvenida</h2>' + (b.activo ? '<span class="ins verde">Activo</span>' : '<span class="ins">Apagado</span>') + '</div><div class="tarjeta-c">' +
        '<p class="ayuda">Una ventanita en el catálogo antiguo invita a dejar el correo a cambio de un descuento. Los correos quedan en Clientes → Suscriptores.</p>' +
        A.interruptor('bi-activo', b.activo, 'Mostrar el regalo de bienvenida') +
        '<div class="fila-campos"><label class="campo"><span>Descuento</span><div class="campo-pre"><input id="bi-pct" inputmode="numeric" value="' + b.pct + '"><span>%</span></div></label>' +
        '<label class="campo"><span>Código del cupón</span><input id="bi-codigo" value="' + h(b.codigo) + '" style="text-transform:uppercase"></label></div>' +
        '<label class="campo"><span>Título</span><input id="bi-titulo" value="' + h(b.titulo) + '"></label>' +
        '<label class="campo"><span>Texto</span><textarea id="bi-texto" rows="2">' + h(b.texto) + '</textarea><small>{PCT} se reemplaza por el porcentaje.</small></label>' +
        (b.activo && !existeBien ? '<div class="nota">⚠ El cupón «' + h(b.codigo) + '» todavía no existe, así que el descuento no se podrá usar. <button class="btn btn-chico" id="bi-crear">Crearlo ahora</button></div>' : (b.activo ? '<div class="nota ok">✓ El cupón «' + h(b.codigo) + '» existe y está listo.</div>' : '')) +
      '</div><div class="tarjeta-pie"><button class="btn btn-primario" id="bi-guardar">Guardar</button></div></div>' +

      '<div class="tarjeta"><div class="tarjeta-cab"><h2>Lo más visto</h2>' + (mv.activo ? '<span class="ins verde">Publicado</span>' : '<span class="ins">Apagado</span>') + '</div><div class="tarjeta-c">' +
        '<p class="ayuda">Arma la lista de favoritos con lo que más miran, ponen en el carrito y compran. En la web nueva se muestran en «Los más queridos» de la portada.</p>' +
        A.interruptor('mv-activo', !!mv.activo, 'Usar lo más visto') +
        '<label class="campo"><span>Cuántos productos</span><select id="mv-cuantos" class="inp" style="max-width:120px">' + [4, 6, 8, 10, 12].map(n => '<option' + ((mv.cuantos || 8) === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
        (rank.length ? '<div class="barras-h">' + rank.slice(0, 10).map(r => '<div class="bh"><span>' + h(r.p.name) + ' <small class="tenue">' + h(r.p.code || '') + '</small></span><div class="bh-pista"><div class="bh-relleno" style="width:' + Math.max(3, Math.round(r.n * 100 / rank[0].n)) + '%"></div></div><b>' + r.n + '</b></div>').join('') + '</div>' +
          '<p class="ayuda mt">Puntos: 1 por abrirlo, 2 por ponerlo en el carrito, 3 por comprarlo.' + (mv.fecha ? ' Última publicación: ' + h(A.fecha(mv.fecha)) + '.' : '') + '</p>'
          : '<p class="ayuda">Todavía no hay visitas suficientes para armar el ranking.</p>') +
      '</div><div class="tarjeta-pie"><button class="btn btn-primario" id="mv-guardar">Guardar y publicar la lista</button></div></div>' +
    '</div>';

    const $ = (id) => A.$('#' + id, vista);
    $('ds-nuevo').addEventListener('click', () => editarCupon(-1));
    A.$$('[data-editar]', vista).forEach(x => x.addEventListener('click', () => editarCupon(+x.dataset.editar)));
    A.$$('[data-alternar]', vista).forEach(x => x.addEventListener('click', async () => {
      const l = kvCupones(A.settings).slice(), i = +x.dataset.alternar;
      l[i] = Object.assign({}, l[i], { activo: l[i].activo === false });
      try { await guardarSettings({ cupones: l }); A.toast(l[i].activo ? 'Cupón activado' : 'Cupón desactivado'); } catch (e) { A.errorGuardar(e); }
    }));
    A.$$('[data-borrar]', vista).forEach(x => x.addEventListener('click', async () => {
      const l = kvCupones(A.settings).slice(), i = +x.dataset.borrar;
      if (!(await A.confirmar('Quien tenga el código «' + l[i].codigo + '» ya no podrá usarlo.', { titulo: '¿Eliminar cupón?', si: 'Eliminar', peligro: true }))) return;
      l.splice(i, 1);
      try { await guardarSettings({ cupones: l }); A.toast('Cupón eliminado'); } catch (e) { A.errorGuardar(e); }
    }));
    $('dg-guardar').addEventListener('click', async () => {
      const on = $('dg-activo').checked, pct = Math.max(0, Math.min(90, A.num($('dg-pct').value)));
      const hasta = $('dg-hasta').value || '';
      if (on && !pct) { A.toast('Escribe el porcentaje', true); return; }
      if (on && !(await A.confirmar('Todos los productos van a quedar con −' + pct + '%' + (hasta ? ' hasta el ' + fechaBonita(hasta) : ' sin fecha de término') + ', en la web nueva y en el catálogo antiguo.', { si: 'Activar descuento' }))) return;
      try { await guardarSettings({ descuentoGlobal: on && pct ? { pct: pct, hasta: hasta } : { pct: 0, hasta: '' } }); A.toast('Descuento guardado ✓'); } catch (e) { A.errorGuardar(e); }
    });
    $('bi-guardar').addEventListener('click', async () => {
      const pct = A.num($('bi-pct').value);
      try {
        await guardarSettings({ bienvenida: { activo: $('bi-activo').checked, pct: pct || 10, codigo: kvCuponNormalizar($('bi-codigo').value) || 'BIENVENIDA10', titulo: $('bi-titulo').value.trim(), texto: $('bi-texto').value.trim() } });
        A.toast('Regalo de bienvenida guardado ✓');
      } catch (e) { A.errorGuardar(e); }
    });
    if ($('bi-crear')) $('bi-crear').addEventListener('click', async () => {
      const l = kvCupones(A.settings).concat([{ codigo: b.codigo, tipo: 'pct', valor: b.pct, minimo: 0, hasta: '', activo: true }]);
      try { await guardarSettings({ cupones: l }); A.toast('Cupón ' + b.codigo + ' creado ✓'); } catch (e) { A.errorGuardar(e); }
    });
    $('mv-guardar').addEventListener('click', async () => {
      const n = A.num($('mv-cuantos').value) || 8;
      const ids = A.rankingVistos().slice(0, n).map(r => r.p.id);
      if ($('mv-activo').checked && !ids.length) { A.avisar('Todavía no hay visitas suficientes para armar la lista.'); return; }
      try {
        await guardarSettings({ masVistos: Object.assign({}, A.settings.masVistos || {}, { activo: $('mv-activo').checked, cuantos: n, ids: ids, fecha: new Date().toISOString() }) });
        A.toast('Lista publicada ✓ La web se actualiza en unos minutos.');
      } catch (e) { A.errorGuardar(e); }
    });
  }, ['settings', 'pedidos']);

  function editarCupon(i) {
    const lista = kvCupones(A.settings);
    const c = i >= 0 ? lista[i] : { codigo: '', tipo: 'pct', valor: '', minimo: '', hasta: '', activo: true };
    A.modal({
      titulo: i >= 0 ? 'Editar cupón' : 'Crear cupón',
      html: '<label class="campo"><span>Código</span><input id="cu-codigo" value="' + h(c.codigo) + '" placeholder="EJ: VERANO15" style="text-transform:uppercase"' + (i >= 0 ? ' readonly' : '') + '><small>' + (i >= 0 ? 'El código no se puede cambiar: crea otro cupón si necesitas uno distinto.' : 'Lo que escriben tus clientas al pagar.') + '</small></label>' +
        '<div class="fila-campos"><label class="campo"><span>Tipo</span><select id="cu-tipo"><option value="pct"' + (c.tipo !== 'monto' ? ' selected' : '') + '>Porcentaje</option><option value="monto"' + (c.tipo === 'monto' ? ' selected' : '') + '>Monto fijo</option></select></label>' +
        '<label class="campo"><span>Valor</span><input id="cu-valor" inputmode="numeric" value="' + h(c.valor) + '" placeholder="15"></label></div>' +
        '<div class="fila-campos"><label class="campo"><span>Compra mínima</span><div class="campo-pre"><span>$</span><input id="cu-min" inputmode="numeric" value="' + h(Number(c.minimo) > 0 ? c.minimo : '') + '" placeholder="Sin mínimo"></div></label>' +
        '<label class="campo"><span>Válido hasta</span><input id="cu-hasta" type="date" value="' + h(c.hasta || '') + '"></label></div>',
      botones: [{ texto: 'Cancelar' }, { texto: i >= 0 ? 'Guardar' : 'Crear cupón', clase: 'btn-primario', accion: async (m) => {
        const codigo = kvCuponNormalizar(A.$('#cu-codigo', m).value), tipo = A.$('#cu-tipo', m).value, valor = A.num(A.$('#cu-valor', m).value);
        if (!codigo) { A.toast('Escribe el código', true); return false; }
        if (!(valor > 0)) { A.toast('Escribe el valor del descuento', true); return false; }
        if (tipo === 'pct' && valor > 90) { A.toast('El porcentaje no puede pasar de 90%', true); return false; }
        if (i < 0 && lista.some(x => kvCuponNormalizar(x.codigo) === codigo)) { A.toast('Ya existe un cupón con ese código', true); return false; }
        const nuevo = Object.assign({}, c, { codigo: codigo, tipo: tipo, valor: valor, minimo: A.num(A.$('#cu-min', m).value), hasta: A.$('#cu-hasta', m).value || '' });
        const l = lista.slice(); if (i >= 0) l[i] = nuevo; else l.push(Object.assign(nuevo, { activo: true }));
        try { await guardarSettings({ cupones: l }); A.toast(i >= 0 ? 'Cupón guardado ✓' : 'Cupón ' + codigo + ' creado ✓'); } catch (e) { A.errorGuardar(e); return false; }
      } }]
    });
  }
})();
