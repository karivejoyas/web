/* Panel · Encargos: pedidos informales (por WhatsApp, Instagram, en persona…).
   Aros nuevos que le piden a Karivé o reposiciones de uno que se agotó.
   Se guardan en catalog/encargos/items (privado: solo el panel los lee). */
(function () {
  'use strict';
  const h = A.h;

  A.encargos = [];
  A.encargosError = '';

  // permiso de Firebase que hace falta (una vez) para guardar encargos
  const REGLAS_ENC = "    match /catalog/encargos/items/{id} {\n      allow read, write: if request.auth != null && request.auth.token.email == 'karive.joyas@gmail.com';\n    }";

  const hoyClave = () => A.diaClave(Date.now());
  const pendiente = (e) => !e.entregado;
  const porCobrar = (e) => e.pagado ? 0 : Math.max(0, (Number(e.precio) || 0) - (Number(e.abono) || 0));
  function diasPara(e) {
    if (!e.fechaEntrega) return null;
    const a = new Date(e.fechaEntrega + 'T12:00:00'), b = new Date(hoyClave() + 'T12:00:00');
    return Math.round((a - b) / 86400000);
  }
  function aviso(e) {
    if (e.entregado) return '<span class="ins verde">Entregado</span>';
    const d = diasPara(e);
    if (d === null) return '<span class="ins ambar">Pendiente</span>';
    if (d < 0) return '<span class="ins rojo">Atrasado ' + (-d) + ' día' + (d === -1 ? '' : 's') + '</span>';
    if (d === 0) return '<span class="ins rojo">Para hoy</span>';
    if (d <= 3) return '<span class="ins ambar">En ' + d + ' día' + (d === 1 ? '' : 's') + '</span>';
    return '<span class="ins azul">Para el ' + h(A.fecha(e.fechaEntrega + 'T12:00:00', false)) + '</span>';
  }
  // para el Inicio: encargos pendientes atrasados, para hoy y para mañana
  A.encargosUrgentes = function () {
    const pend = A.encargos.filter(pendiente), en = (f) => pend.filter(e => { const d = diasPara(e); return d !== null && f(d); });
    return { atrasados: en(d => d < 0), hoy: en(d => d === 0), manana: en(d => d === 1), pendientes: pend.length };
  };
  // WhatsApp: acepta 9 1234 5678, +56 9…, 12345678
  function whatsapp(contacto) {
    let d = String(contacto || '').replace(/[^0-9]/g, '');
    if (d.length === 8) d = '569' + d;
    else if (d.length === 9 && d[0] === '9') d = '56' + d;
    return d.length >= 11 ? 'https://wa.me/' + d : '';
  }
  const fotoDe = (e) => e.foto || (e.productoId && A.foto ? A.foto({ id: e.productoId }) : '') || '';
  const producto = (id) => (A.productos || []).find(p => p.id === id);

  /* Un encargo entregado se puede registrar como venta: queda en Pedidos, en
     Clientes y en Informes. No descuenta stock (stockDescontado) ni manda
     correos (no pasa por el publicador y no tiene número de pedido web). */
  async function registrarVenta(e) {
    const p = producto(e.productoId), ahora = new Date().toISOString(), precio = Number(e.precio) || 0;
    const esTel = !!whatsapp(e.contacto);
    const nombreItem = (e.tipo === 'reposicion' && p ? p.name : '') || String(e.que || '').split('\n')[0].slice(0, 90) || (p && p.name) || 'Encargo';
    const ref = await A.ref.pedidos.add({
      fecha: e.entregadoEl || ahora, origen: 'encargo', encargoId: e.id,
      cliente: { nombre: e.nombre || '', correo: '', telefono: esTel ? e.contacto : '', instagram: esTel ? '' : (e.contacto || '') },
      direccion: {}, items: [{ id: e.productoId || '', code: p ? p.code || '' : '', name: nombreItem, precio: precio, qty: 1 }],
      subtotal: precio, total: precio, envio: null, cupon: null,
      notas: 'Encargo anotado en el panel' + (e.notas ? ' · ' + e.notas : ''),
      medioPago: 'encargo', pagoEstado: 'approved', estado: 'enviado', verificadoFecha: ahora, enviadoFecha: ahora,
      courier: 'Entrega en persona', stockDescontado: true
    });
    await A.ref.encargos.doc(e.id).update({ pedidoId: ref.id, actualizado: ahora });
    return ref.id;
  }
  async function ofrecerVenta(e) {
    if (!e || e.pedidoId || !(Number(e.precio) > 0)) return;
    if (!(await A.confirmar('¿Lo registro como venta de ' + A.clp(e.precio) + '?\n\nQueda en Pedidos, Clientes e Informes, así tus números incluyen los encargos. No descuenta stock ni le manda correos a nadie.', { titulo: 'Encargo entregado ✓', si: 'Registrar venta' }))) return;
    try { await registrarVenta(e); A.toast('Venta registrada ✓'); } catch (err) { A.errorGuardar(err); }
  }

  A.actualizarEncargosN = function () {
    const n = A.encargos.filter(pendiente).length;
    const b = A.$('#nav-encargos-n'); if (b) { b.textContent = n; b.hidden = !n; }
  };

  // escucha en vivo (la llama nucleo.js al entrar)
  A.escucharEncargos = function () {
    return A.ref.encargos.onSnapshot(s => {
      A.encargos = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      A.encargosError = '';
      A.listo.encargos = true; A.actualizarEncargosN(); A.refrescar('encargos');
    }, e => {
      console.warn('encargos', e);
      A.encargosError = /permission/i.test(e.code || e.message) ? 'permiso' : 'error';
      A.listo.encargos = true; A.refrescar('encargos');
    });
  };

  function tarjetaPermiso() {
    return '<div class="tarjeta"><div class="tarjeta-cab"><h2>Falta un permiso (se hace una sola vez)</h2><span class="ins rojo">Falta activarlo</span></div><div class="tarjeta-c">' +
      '<p>Para que el panel pueda guardar los encargos hay que agregar unas líneas en las reglas de seguridad de Firebase. <b>No cambia nada de lo que ya existe</b> y los encargos quedan privados: solo los ve quien entra al panel.</p>' +
      '<ol style="padding-left:20px;margin:0 0 12px"><li>Entra a <a href="https://console.firebase.google.com/project/karive-catalogo/firestore/rules" target="_blank" rel="noopener">Firebase → Firestore → Reglas</a> con la cuenta de Karivé.</li>' +
      '<li>Busca la línea <code>match /databases/{database}/documents {</code></li>' +
      '<li>Justo debajo, pega esto (botón «Copiar»):</li></ol>' +
      '<pre style="background:#2A123E;color:#F6EEFB;border-radius:10px;padding:12px;overflow:auto;font-size:12px;margin:0 0 8px">' + h(REGLAS_ENC) + '</pre>' +
      '<button class="btn" id="en-copiar">' + A.ic.copiar + ' Copiar</button>' +
      '<ol start="4" style="padding-left:20px;margin:12px 0 0"><li>Aprieta <b>Publicar</b> y vuelve a cargar esta página.</li></ol>' +
    '</div></div>';
  }
  function activarCopiar(vista) {
    const b = A.$('#en-copiar', vista);
    if (b) b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(REGLAS_ENC); A.toast('Reglas copiadas'); } catch (e) { window.prompt('Copia las reglas:', REGLAS_ENC); } });
  }

  // ---------------------------------------------------------------- lista
  let pest = 'pendientes', txt = '';
  const PEST = [['pendientes', 'Pendientes', pendiente], ['entregados', 'Entregados', e => e.entregado], ['todos', 'Todos', () => true]];

  A.pagina('encargos', function (vista) {
    if (!A.listo.encargos) { vista.innerHTML = A.cargandoHtml; return; }
    const nuevoBtn = '<a class="btn btn-primario" href="#/encargos/nuevo">' + A.ic.mas + ' Anotar encargo</a>';
    if (A.encargosError === 'permiso') {
      vista.innerHTML = '<div class="pag">' + A.cab('Encargos') + tarjetaPermiso() + '</div>';
      activarCopiar(vista); return;
    }
    const pend = A.encargos.filter(pendiente);
    const atrasados = pend.filter(e => { const d = diasPara(e); return d !== null && d < 0; }).length;
    const semana = pend.filter(e => { const d = diasPara(e); return d !== null && d >= 0 && d <= 7; }).length;
    const cobrar = A.encargos.reduce((s, e) => s + porCobrar(e), 0);
    const filtro = (PEST.find(p => p[0] === pest) || PEST[0])[2];
    const t = A.sinTildes(txt);
    const lista = A.encargos.filter(filtro)
      .filter(e => !t || A.sinTildes([e.nombre, e.contacto, e.que, e.notas, (producto(e.productoId) || {}).name].join(' ')).indexOf(t) !== -1)
      .sort((a, b) => {
        if (!a.entregado && !b.entregado) {   // pendientes: primero lo que vence antes; los sin fecha al final
          const da = a.fechaEntrega || '9999', db = b.fechaEntrega || '9999';
          if (da !== db) return da < db ? -1 : 1;
        }
        return String(b.creado || '').localeCompare(String(a.creado || ''));
      });

    vista.innerHTML = '<div class="pag ancha">' + A.cab('Encargos', { acciones: nuevoBtn }) +
      '<p class="pag-sub">Pedidos que te hacen por WhatsApp, Instagram o en persona: aros nuevos o reposiciones de alguno que se acabó. Así no se olvida ninguno.</p>' +
      '<div class="metricas"><div class="metrica"><span>Pendientes</span><b>' + pend.length + '</b></div>' +
        '<div class="metrica"><span>Atrasados</span><b' + (atrasados ? ' style="color:var(--rojo)"' : '') + '>' + atrasados + '</b></div>' +
        '<div class="metrica"><span>Para esta semana</span><b>' + semana + '</b></div>' +
        '<div class="metrica"><span>Por cobrar</span><b>' + A.clp(cobrar) + '</b></div></div>' +
      '<div class="tarjeta">' +
        '<div class="pestanas">' + PEST.map(x => '<button class="pestana' + (x[0] === pest ? ' activa' : '') + '" data-pest="' + x[0] + '">' + x[1] + '<span class="n">' + A.encargos.filter(x[2]).length + '</span></button>').join('') + '</div>' +
        '<div class="filtros"><label class="buscar">' + A.ic.buscar + '<input id="en-buscar" placeholder="Buscar por nombre, contacto o qué pidió" value="' + h(txt) + '"></label></div>' +
        (!lista.length ? A.vacio('📝', pest === 'entregados' ? 'Aún no hay encargos entregados' : txt ? 'Nada coincide con la búsqueda' : 'No hay encargos pendientes',
          pest === 'entregados' ? 'Cuando marques uno como entregado aparecerá aquí.' : 'Anota aquí cada encargo que te hagan para no olvidarlo.', pest === 'entregados' || txt ? '' : nuevoBtn) :
        '<div class="enc-lista">' + lista.map(fila).join('') + '</div>') +
      '</div></div>';

    A.$$('.pestana', vista).forEach(b => b.addEventListener('click', () => { pest = b.dataset.pest; A.repintar(); }));
    const bu = A.$('#en-buscar', vista);
    bu.addEventListener('input', () => { txt = bu.value; clearTimeout(bu._t); bu._t = setTimeout(() => { A.repintar(); const x = A.$('#en-buscar'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 220); });
    A.$$('.enc-fila', vista).forEach(f => f.addEventListener('click', (ev) => { if (ev.target.closest('a, button, label, input')) return; A.ir('encargos/' + f.dataset.id); }));
    // marcar entregado / pagado desde la lista, sin abrir el encargo
    A.$$('input[data-marca]', vista).forEach(c => c.addEventListener('change', async () => {
      const campo = c.dataset.marca, id = c.closest('.enc-fila').dataset.id;
      const datos = { [campo]: c.checked, actualizado: new Date().toISOString() };
      if (campo === 'entregado') datos.entregadoEl = c.checked ? new Date().toISOString() : null;
      try { await A.ref.encargos.doc(id).update(datos); A.toast(campo === 'entregado' ? (c.checked ? 'Marcado como entregado ✓' : 'Vuelve a pendientes') : (c.checked ? 'Marcado como pagado ✓' : 'Marcado como no pagado')); }
      catch (e) { c.checked = !c.checked; A.errorGuardar(e); return; }
      if (campo === 'entregado' && c.checked) ofrecerVenta(Object.assign({}, A.encargos.find(x => x.id === id), datos));
    }));
  }, ['encargos', 'productos']);

  function fila(e) {
    const f = fotoDe(e), p = producto(e.productoId), wa = whatsapp(e.contacto);
    const resto = porCobrar(e);
    return '<div class="enc-fila' + (e.entregado ? ' hecho' : '') + '" data-id="' + h(e.id) + '">' +
      '<div class="enc-foto">' + (e.foto ? '<img src="' + h(e.foto) + '" alt="" loading="lazy">' : e.productoId ? '<img data-foto="' + h(e.productoId) + '" src="' + h(f || A.SIN_FOTO) + '" alt="" loading="lazy">' : '<span>📝</span>') + '</div>' +
      '<div class="enc-info"><div class="enc-tit"><b>' + h(e.nombre || 'Sin nombre') + '</b> ' + aviso(e) +
        (e.tipo === 'reposicion' ? ' <span class="ins morado sin-punto">Reposición</span>' : ' <span class="ins oro sin-punto">Aro nuevo</span>') + '</div>' +
        '<div class="enc-que">' + h(e.que || (p ? p.name : '') || 'Sin descripción') + '</div>' +
        '<div class="enc-meta tenue">' + [e.precio ? A.clp(e.precio) : 'Sin precio', e.pagado ? 'Pagado' : (e.abono ? 'Abonó ' + A.clp(e.abono) + ' · falta ' + A.clp(resto) : ''), e.pedidoId ? 'Venta registrada' : '', e.contacto ? h(e.contacto) : '', 'Anotado ' + h(A.hace(e.creado))].filter(Boolean).join(' · ') + '</div></div>' +
      '<div class="enc-acc">' +
        (wa ? '<a class="btn btn-chico" href="' + h(wa) + '" target="_blank" rel="noopener" title="Escribirle por WhatsApp">WhatsApp</a>' : '') +
        '<label class="enc-check"><input type="checkbox" data-marca="pagado"' + (e.pagado ? ' checked' : '') + '> Pagado</label>' +
        '<label class="enc-check"><input type="checkbox" data-marca="entregado"' + (e.entregado ? ' checked' : '') + '> Entregado</label>' +
      '</div></div>';
  }

  // ---------------------------------------------------------------- ficha (nuevo o editar)
  A.pagina('encargos/:id', function (vista, params) {
    if (!A.listo.encargos) { vista.innerHTML = A.cargandoHtml; return; }
    if (A.encargosError === 'permiso') { vista.innerHTML = '<div class="pag">' + A.cab('Encargo', { volver: 'encargos' }) + tarjetaPermiso() + '</div>'; activarCopiar(vista); return; }
    const nuevo = params.id === 'nuevo';
    const orig = nuevo ? { nombre: '', contacto: '', que: '', tipo: 'nuevo', productoId: '', precio: 0, abono: 0, pagado: false, entregado: false, fechaEntrega: '', notas: '', foto: '' }
      : A.encargos.find(x => x.id === params.id);
    if (!orig) { vista.innerHTML = '<div class="pag">' + A.cab('Encargo', { volver: 'encargos' }) + '<div class="tarjeta">' + A.vacio('🔍', 'No encontramos este encargo', 'Puede que se haya eliminado.') + '</div></div>'; return; }
    let foto = orig.foto || '';
    const prods = (A.productos || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const p0 = producto(orig.productoId);
    const etiquetaProd = (p) => p ? (p.name || '') + ' · ' + (p.code || '') : '';

    vista.innerHTML = '<div class="pag">' +
      A.cab(nuevo ? 'Anotar encargo' : h(orig.nombre || 'Encargo'), { volver: 'encargos' }) +
      '<div class="dos-col no-refrescar" id="ef"><div>' +
        '<div class="tarjeta tarjeta-c">' +
          '<div class="fila-campos"><label class="campo"><span>Nombre de quien lo pidió</span><input id="ef-nombre" value="' + h(orig.nombre) + '" placeholder="Ej: Camila" maxlength="80"></label>' +
          '<label class="campo"><span>Teléfono o Instagram</span><input id="ef-contacto" value="' + h(orig.contacto) + '" placeholder="Ej: 9 1234 5678 o @camila" maxlength="80"><small>Si es un teléfono aparece el botón de WhatsApp.</small></label></div>' +
          '<label class="campo"><span>¿Qué pidió?</span><textarea id="ef-que" rows="3" placeholder="Ej: argollas de cristal verde, como las de la foto, para el 15">' + h(orig.que) + '</textarea></label>' +
          '<div class="campo"><span>Tipo</span><div class="enc-tipos">' +
            '<label><input type="radio" name="ef-tipo" value="nuevo"' + (orig.tipo !== 'reposicion' ? ' checked' : '') + '> Aro nuevo (hecho a pedido)</label>' +
            '<label><input type="radio" name="ef-tipo" value="reposicion"' + (orig.tipo === 'reposicion' ? ' checked' : '') + '> Reposición de un producto que se acabó</label></div></div>' +
          '<label class="campo" id="ef-prod-c"' + (orig.tipo === 'reposicion' ? '' : ' hidden') + '><span>¿Cuál producto?</span>' +
            '<input id="ef-prod" list="ef-prods" value="' + h(etiquetaProd(p0)) + '" placeholder="Escribe el nombre o el código"><datalist id="ef-prods">' +
            prods.map(p => '<option value="' + h(etiquetaProd(p)) + '">').join('') + '</datalist><small>Opcional. Si no subes una foto, se muestra la del producto.</small></label>' +
          '<label class="campo"><span>Notas</span><textarea id="ef-notas" rows="2" placeholder="Ej: lo retira en persona, quiere caja de regalo…">' + h(orig.notas) + '</textarea></label>' +
        '</div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Foto</h2></div><div class="tarjeta-c">' +
          '<div class="foto-prod" id="ef-foto" role="button" tabindex="0" aria-label="Subir foto">' + (orig.foto ? '<img src="' + h(orig.foto) + '" alt="">' : orig.productoId ? '<img data-foto="' + h(orig.productoId) + '" src="' + h(fotoDe(orig) || A.SIN_FOTO) + '" alt="">' : '<div class="sin">' + A.ic.subir + '<br>Toca o arrastra aquí la foto</div>') + '</div>' +
          '<div class="foto-acc"><button class="btn btn-chico" id="ef-foto-btn" type="button">' + A.ic.subir + ' ' + (foto ? 'Cambiar foto' : 'Subir foto') + '</button>' +
          '<button class="btn btn-chico btn-peligro" id="ef-foto-quitar" type="button"' + (foto ? '' : ' hidden') + '>Quitar foto</button></div>' +
          '<p class="ayuda mt" style="margin:8px 0 0">Una referencia de lo que pidió: una captura del chat, una foto que te mandó o el aro terminado.</p>' +
        '</div></div>' +
      '</div><div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Estado</h2></div><div class="tarjeta-c">' +
          A.interruptor('ef-entregado', orig.entregado, 'Entregado') +
          A.interruptor('ef-pagado', orig.pagado, 'Pagado completo') +
          '<label class="campo mt"><span>¿Para cuándo?</span><input type="date" id="ef-fecha" value="' + h(orig.fechaEntrega || '') + '"><small>Opcional. Si se pasa la fecha, el encargo aparece como «Atrasado».</small></label>' +
        '</div></div>' +
        '<div class="tarjeta"><div class="tarjeta-cab"><h2>Precio</h2></div><div class="tarjeta-c">' +
          '<label class="campo"><span>Precio acordado</span><div class="campo-pre"><span>$</span><input id="ef-precio" inputmode="numeric" value="' + (orig.precio || '') + '"></div></label>' +
          '<label class="campo"><span>Abono (lo que ya pagó)</span><div class="campo-pre"><span>$</span><input id="ef-abono" inputmode="numeric" value="' + (orig.abono || '') + '" placeholder="0"></div><small id="ef-falta"></small></label>' +
        '</div></div>' +
        (nuevo ? '<button class="btn btn-primario" id="ef-guardar" style="width:100%">Guardar encargo</button>' :
          (orig.pedidoId ? '<div class="tarjeta tarjeta-c"><p style="margin:0 0 8px">✅ Registrado como venta: cuenta en Pedidos, Clientes e Informes.</p><a class="btn btn-chico" href="#/pedidos/' + h(orig.pedidoId) + '">Ver la venta</a></div>'
            : orig.entregado && orig.precio ? '<div class="tarjeta tarjeta-c"><p class="ayuda" style="margin:0 0 8px">Ya está entregado. Si lo registras como venta, se suma en Pedidos e Informes (sin descontar stock ni mandar correos).</p><button class="btn btn-chico" id="ef-venta" type="button">Registrar como venta</button></div>' : '') +
          '<div class="derecha"><button class="btn btn-peligro" id="ef-eliminar">' + A.ic.basura + ' Eliminar encargo</button></div>' +
          '<p class="ayuda" style="margin-top:10px">Anotado ' + h(A.fecha(orig.creado, true)) + (orig.entregadoEl ? ' · entregado ' + h(A.fecha(orig.entregadoEl, false)) : '') + '</p>') +
      '</div></div></div>';

    const $ = (id) => A.$('#' + id, vista);
    const prodDeTexto = () => { const v = $('ef-prod').value.trim(); const p = prods.find(x => etiquetaProd(x) === v); return p ? p.id : ''; };
    const leer = () => ({
      nombre: $('ef-nombre').value.trim(), contacto: $('ef-contacto').value.trim(), que: $('ef-que').value.trim(),
      tipo: (A.$('input[name="ef-tipo"]:checked', vista) || {}).value || 'nuevo',
      productoId: (A.$('input[name="ef-tipo"]:checked', vista) || {}).value === 'reposicion' ? prodDeTexto() : '',
      notas: $('ef-notas').value.trim(), precio: A.num($('ef-precio').value), abono: A.num($('ef-abono').value),
      pagado: $('ef-pagado').checked, entregado: $('ef-entregado').checked, fechaEntrega: $('ef-fecha').value || '', foto: foto
    });
    const falta = () => { const v = leer(); $('ef-falta').textContent = v.pagado ? 'Pagado completo.' : v.precio ? 'Falta cobrar ' + A.clp(Math.max(0, v.precio - v.abono)) + '.' : ''; };
    falta();
    A.$$('input[name="ef-tipo"]', vista).forEach(r => r.addEventListener('change', () => { $('ef-prod-c').hidden = r.value !== 'reposicion' || !r.checked; if (r.checked && r.value === 'reposicion') $('ef-prod').focus(); }));
    $('ef-prod').addEventListener('change', () => {   // reposición sin foto propia: se ve la del producto
      if (foto) return; const id = prodDeTexto();
      $('ef-foto').innerHTML = id ? '<img data-foto="' + h(id) + '" src="' + h(A.foto({ id: id }) || A.SIN_FOTO) + '" alt="">' : '<div class="sin">' + A.ic.subir + '<br>Toca o arrastra aquí la foto</div>';
    });

    async function usarFoto(f) {
      if (!f) return;
      if (!/^image\//.test(f.type || '')) { A.toast('Ese archivo no es una foto.', true); return; }
      try {
        foto = await A.comprimir(f, 1200, 0.82);
        $('ef-foto').innerHTML = '<img src="' + foto + '" alt="">';
        $('ef-foto-quitar').hidden = false; $('ef-foto-btn').lastChild.textContent = ' Cambiar foto';
        revisar();
      } catch (e) { A.toast('No se pudo leer la foto.', true); }
    }
    const subir = async () => usarFoto(await A.elegirArchivo('image/*'));
    $('ef-foto').addEventListener('click', subir);
    $('ef-foto').addEventListener('keydown', (e) => { if (e.key === 'Enter') subir(); });
    $('ef-foto-btn').addEventListener('click', subir);
    ['dragenter', 'dragover'].forEach(t => $('ef-foto').addEventListener(t, (e) => { e.preventDefault(); $('ef-foto').classList.add('arrastrando'); }));
    ['dragleave', 'dragend'].forEach(t => $('ef-foto').addEventListener(t, () => $('ef-foto').classList.remove('arrastrando')));
    $('ef-foto').addEventListener('drop', (e) => { e.preventDefault(); $('ef-foto').classList.remove('arrastrando'); usarFoto(Array.from(e.dataTransfer.files || []).find(f => /^image\//.test(f.type))); });
    $('ef-foto-quitar').addEventListener('click', () => {
      foto = ''; $('ef-foto-quitar').hidden = true; $('ef-foto-btn').lastChild.textContent = ' Subir foto';
      $('ef-prod').dispatchEvent(new Event('change'));
      if (!prodDeTexto()) $('ef-foto').innerHTML = '<div class="sin">' + A.ic.subir + '<br>Toca o arrastra aquí la foto</div>';
      revisar();
    });

    async function guardar() {
      const v = leer();
      if (!v.nombre && !v.que) { A.avisar('Anota al menos el nombre de quien lo pidió o qué pidió.'); return false; }
      const ahora = new Date().toISOString();
      const datos = Object.assign({}, v, { actualizado: ahora });
      if (v.entregado && !orig.entregado) datos.entregadoEl = ahora;
      if (!v.entregado) datos.entregadoEl = null;
      try {
        if (nuevo) {
          datos.creado = ahora;
          const ref = await A.ref.encargos.add(datos);
          A.limpiarCambios(); A.toast('Encargo anotado ✓'); A.ir('encargos');
          if (v.entregado) ofrecerVenta(Object.assign({ id: ref.id }, datos));
        } else {
          await A.ref.encargos.doc(orig.id).update(datos);
          A.limpiarCambios(); A.toast('Encargo guardado ✓');
          if (v.entregado && !orig.entregado) ofrecerVenta(Object.assign({}, orig, datos));
        }
        return true;
      } catch (e) { A.errorGuardar(e); return false; }
    }
    const revisar = A.formulario($('ef'), leer, guardar);
    $('ef').addEventListener('input', falta); $('ef').addEventListener('change', falta);
    if ($('ef-guardar')) $('ef-guardar').addEventListener('click', async (e) => { e.target.disabled = true; const ok = await guardar(); if (!ok) e.target.disabled = false; });
    if ($('ef-venta')) $('ef-venta').addEventListener('click', async (e) => {
      if (A.hayCambios()) { A.avisar('Primero guarda los cambios del encargo.'); return; }
      e.target.disabled = true;
      try { await registrarVenta(orig); A.toast('Venta registrada ✓'); } catch (err) { A.errorGuardar(err); e.target.disabled = false; }
    });
    if ($('ef-eliminar')) $('ef-eliminar').addEventListener('click', async () => {
      if (!(await A.confirmar('El encargo de «' + (orig.nombre || 'sin nombre') + '» se borra y no se puede deshacer.\n\nSi ya lo entregaste, mejor márcalo como «Entregado»: así queda el historial.', { titulo: '¿Eliminar encargo?', si: 'Eliminar', peligro: true }))) return;
      try { await A.ref.encargos.doc(orig.id).delete(); A.limpiarCambios(); A.toast('Encargo eliminado'); A.ir('encargos'); } catch (e) { A.errorGuardar(e); }
    });
    if (nuevo) setTimeout(() => $('ef-nombre').focus(), 50);
  }, ['encargos', 'productos']);
})();
