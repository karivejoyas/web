/* ============================================================
   Karivé Joyas · asistente de la tienda (chat con IA)
   Responde con los datos reales de la tienda. Primero le pregunta a la
   IA del publicador (la misma del catálogo, con la clave escondida en
   Google); si no responde, contesta con reglas locales (gratis y sin
   límite). Los textos se cambian en Personalizar → Asistente.
   ============================================================ */
(function () {
  'use strict';
  const cfgEl = document.getElementById('kv-chat-datos');
  if (!cfgEl || !window.KV) return;
  let CFG = {};
  try { CFG = JSON.parse(cfgEl.textContent) || {}; } catch (e) {}
  const KV = window.KV;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => escapeHtml(String(s == null ? '' : s));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const ORIGEN = location.origin;

  /* ---------- datos ---------- */
  let lista = [];
  async function cargar() {
    try { lista = (await KV.productos()).filter(p => kvEnStock(p)); } catch (e) { lista = []; }
    return lista;
  }
  const precio = (p) => KV.precioDe(p);
  function envios() {
    const r = kvEnvioRango(window.kvEnvioTarifas);
    return { rm: r.rm, reg: r.regMin, regMax: r.regMax };
  }
  function contacto() {
    const out = [];
    if (CFG.wa) out.push('<a href="https://wa.me/' + esc(CFG.wa) + '" target="_blank" rel="noopener">WhatsApp</a>');
    if (CFG.ig) out.push('<a href="' + esc(CFG.ig) + '" target="_blank" rel="noopener">Instagram</a>');
    return out.join(' · ');
  }

  /* tarjetitas de producto dentro del chat */
  function tarjetas(ps) {
    if (!ps.length) return '';
    return '<div class="chat-prods">' + ps.slice(0, 6).map(p => {
      const of = kvPrecioOferta(p);
      return '<a class="chat-prod" href="' + esc(p.url) + '"><img src="' + esc(p.img) + '" alt="" loading="lazy" width="48" height="48">' +
        '<span><b>' + esc(p.name) + '</b><small>' + formatCLP(precio(p)) + (of ? ' <s>' + formatCLP(p.price) + '</s>' : '') + '</small></span></a>';
    }).join('') + '</div>';
  }
  function cuantoPlata(t) {
    let m = t.match(/(\d+)\s*(mil|lucas?)/);
    if (m) return parseInt(m[1], 10) * 1000;
    m = t.replace(/(\d)\.(?=\d{3}\b)/g, '$1').match(/\$?\s*(\d{3,7})/);
    return m ? parseInt(m[1], 10) : null;
  }
  const COMO_COMPRAR = 'Agregas tus aros al carrito y pagas aquí mismo en la web, con <b>tarjeta de débito o crédito</b> (Mercado Pago). Si prefieres transferencia, escríbenos por WhatsApp.';

  /* ---------- respuestas locales (respaldo sin IA) ---------- */
  function responder(pregunta) {
    const t = norm(pregunta);
    const vis = lista;
    const env = envios();
    if (!vis.length) return 'Estamos renovando la tienda ✨ Escríbenos y te ayudamos: ' + contacto();
    const cols = Array.from(new Set(vis.map(p => p.col).filter(Boolean)));

    const plata = cuantoPlata(t);
    if (plata && plata >= 500) {
      const dentro = vis.filter(p => precio(p) <= plata * 1.15).sort((a, b) => precio(b) - precio(a));
      if (dentro.length) return 'Con ' + formatCLP(plata) + ' tienes estas opciones lindas 💜' + tarjetas(dentro) + COMO_COMPRAR;
      const baratos = vis.slice().sort((a, b) => precio(a) - precio(b));
      return 'Por ahora nuestros aros parten un poquito más arriba de ' + formatCLP(plata) + '. Los más accesibles son:' + tarjetas(baratos.slice(0, 3));
    }
    if (/(oferta|descuento|rebaja|promo|cupon)/.test(t)) {
      const ofs = vis.filter(p => kvPrecioOferta(p));
      return ofs.length ? '¡Sí! Estos aros están en oferta 🎉' + tarjetas(ofs) : 'Por ahora no tenemos ofertas activas. Síguenos en ' + contacto() + ' para enterarte primero 💜';
    }
    if (/(mas barat|mas economic|menor precio|mas accesible)/.test(t))
      return 'Los más accesibles de la tienda 💜' + tarjetas(vis.slice().sort((a, b) => precio(a) - precio(b)).slice(0, 4));
    if (/(envio|despacho|retiro|region|entrega|llega|demora|santiago|courier)/.test(t))
      return 'Hacemos <b>envíos a todo Chile</b> desde Santiago 🚚<br>• Región Metropolitana: <b>' + formatCLP(env.rm) + '</b><br>• Resto de Chile: <b>' + formatCLP(env.reg) + (env.regMax > env.reg ? ' a ' + formatCLP(env.regMax) + '</b> según la región' : '</b>') +
        '<br>No tenemos retiro en tienda. Apenas verificamos el pago preparamos tu pedido y te avisamos con el número de seguimiento.';
    if (/(comprar|compro|pedido|pedir|encargar|pagar|pago|transferencia|tarjeta|mercado ?pago)/.test(t))
      return 'Comprar es facilito 💜<br>1. Toca <b>Agregar al carrito</b> en los aros que te gusten.<br>2. Abre el carrito y toca <b>Finalizar compra</b>.<br>3. Pagas con <b>tarjeta de débito o crédito</b> (Mercado Pago) y te lo enviamos a todo Chile 🚚<br>¿Prefieres transferencia? Escríbenos por ' + contacto() + ' y lo coordinamos.';
    if (/(cuid|limpi|moja|agua|perfume|crema|fragil|alergi|acero|material|hipoalerg)/.test(t))
      return 'Los hacemos a mano con <b>arcilla polimérica, cristales y mostacillas</b> 💜<br><br>Para que te duren mucho:<br>• <b>Arcilla:</b> evita golpes y caídas; límpiala con un paño suave y seco.<br>• <b>Cristales y mostacillas:</b> no los mojes ni les eches perfume o crema.<br>• <b>Siempre:</b> sácatelos para ducharte o hacer deporte y guárdalos en un lugar seco ✨';
    if (/(garantia|falla|roto|cambio|devoluc)/.test(t))
      return 'Si tu pedido llega con algún problema, escríbenos por ' + contacto() + ' e intentaremos solucionarlo lo más pronto posible, según sea el caso 💜';
    if (/(color|medida|a pedido|personaliz|especial|otro tono)/.test(t))
      return '¡Sí hacemos diseños a pedido! Si te gusta un modelo en otro color, escríbenos y lo creamos para ti 💜 ' + contacto();
    if (/(instagram|facebook|whatsapp|wsp|telefono|numero|contact|redes|escribir|hablar)/.test(t))
      return 'Puedes escribirnos aquí 💜 ' + contacto();
    if (/(regalo|regalar|cumple|mama|amiga|polola|novia)/.test(t)) {
      const rec = vis.slice().sort(() => Math.random() - .5).slice(0, 4);
      return 'Para regalar, todos van en su empaque listo para entregar 🎁 Algunas ideas:' + tarjetas(rec);
    }
    if (/(que (tipo|clase|estilo)|que venden|que tienen|coleccion|catalogo|que hay)/.test(t))
      return 'Somos <b>Karivé Joyas</b> 💜, aros hechos a mano en Santiago. Nuestras colecciones:<br>' +
        cols.map(c => { const it = vis.filter(p => p.col === c); return '• <b>' + esc(c) + '</b>: ' + it.length + ' modelos desde ' + formatCLP(Math.min.apply(null, it.map(precio))); }).join('<br>');

    let coinc = vis.filter(p => p.col && t.indexOf(norm(p.col)) >= 0);
    if (!coinc.length) {
      const pal = t.split(/[^a-z0-9ñ]+/).filter(w => w.length >= 4);
      coinc = vis.filter(p => { const n = norm(p.name + ' ' + (p.color || '')); return pal.some(w => n.indexOf(w) >= 0); });
    }
    if (coinc.length) return '¡Tenemos esto que te puede encantar! 💜' + tarjetas(coinc);
    if (t.length < 30 && /(^| )(hola|buenas|buenos dias|alo|hey)/.test(t))
      return '¡Hola! 💜 Cuéntame qué buscas: ¿aros para regalo, algo dentro de un presupuesto o conocer las colecciones?';
    return 'Te puedo ayudar con los <b>modelos</b>, <b>precios</b> (dime tu presupuesto, ej. «algo de 5 mil»), <b>ofertas</b>, <b>envíos</b> y <b>cómo comprar</b> ✨ Para lo demás: ' + contacto();
  }

  /* ---------- IA del publicador ---------- */
  const hist = [];
  function contexto() {
    const env = envios();
    const lineas = lista.slice(0, 140).map(p => {
      const of = kvPrecioOferta(p);
      return '- ' + p.name + ' | ' + formatCLP(precio(p)) + (of ? ' (oferta, antes ' + formatCLP(p.price) + ')' : '') +
        ' | colección ' + (p.col || '') + ' | código ' + (p.code || '') + (p.detail ? ' | ' + p.detail : '');
    });
    return 'PRODUCTOS DISPONIBLES EN LA WEB:\n' + lineas.join('\n') +
      '\n\nCÓMO SE COMPRA: en esta misma web (' + ORIGEN + '), agregando los aros al carrito y pagando con tarjeta de débito o crédito (Mercado Pago). Quien quiera pagar por transferencia debe escribir por WhatsApp para coordinarlo. ' +
      'NO se coordina por DM. Envíos a todo Chile desde Santiago: Región Metropolitana ' + formatCLP(env.rm) + ', resto de Chile ' + formatCLP(env.reg) + (env.regMax > env.reg ? ' a ' + formatCLP(env.regMax) + ' según la región (el costo exacto aparece al elegir la región en la página de pago)' : '') + '. NO hay retiro en tienda. ' +
      'Si un pedido llega con algún problema: que escriba por WhatsApp o Instagram y lo solucionamos lo más pronto posible según el caso (NO prometas plazos de garantía ni devoluciones). Hacemos diseños a pedido por WhatsApp. NO menciones acero. ' +
      '\nCuando recomiendes un producto, escribe su código entre paréntesis, por ejemplo (TP-016): la web muestra su foto y enlace.';
  }
  async function ia() {
    let url = '';
    try { url = String((await KV.ajustes()).igPubUrl || '').trim(); } catch (e) {}
    if (!url) return null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'chat', historial: hist.slice(-8), catalogo: contexto() }), signal: ctrl.signal });
      clearTimeout(timer);
      const d = await r.json();
      if (d && d.ok && d.texto) return String(d.texto);
    } catch (e) {}
    return null;
  }
  function formatear(txt) {
    let h = esc(txt.trim());
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
    h = h.replace(/(^|[^"'>])(https?:\/\/[^\s<]+)/g, (m, a, u) => a + '<a href="' + u + '"' + (u.indexOf(ORIGEN) === 0 ? '' : ' target="_blank" rel="noopener"') + '>' + (u.indexOf(ORIGEN) === 0 ? 'ver aquí' : u) + '</a>');
    h = h.replace(/\n/g, '<br>');
    // si la IA nombra códigos, se muestran sus fotos con enlace
    const cods = Array.from(new Set((txt.match(/\b[A-Z]{1,4}-\d{2,4}\b/g) || [])));
    const ps = cods.map(c => lista.find(p => p.code === c)).filter(Boolean);
    return h + tarjetas(ps);
  }

  /* ---------- interfaz ---------- */
  const ICO_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const ICO_ENV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12 20 4l-6 16-3-7-7-1Z"/></svg>';
  const SUGERENCIAS = ['Aros para regalo', 'Algo de 5 mil', '¿Cuánto cuesta el envío?', '¿Cómo compro?'];

  const btn = document.createElement('button');
  btn.className = 'chat-btn'; btn.type = 'button';
  btn.setAttribute('aria-label', 'Abrir el asistente'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'chat-panel');
  btn.innerHTML = '<img src="/assets/logo-avatar.png" alt="" width="56" height="56">';
  // burbujas de mensajes (como las del catálogo), al lado del asistente
  const globo = document.createElement('div');
  globo.className = 'chat-globo'; globo.hidden = true;
  globo.innerHTML = '<button type="button" class="chat-globo-txt"></button><button type="button" class="chat-globo-x" aria-label="No mostrar más mensajes">' + ICO_X + '</button>';
  const panel = document.createElement('section');
  panel.className = 'chat-panel'; panel.id = 'chat-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', CFG.nombre || 'Asistente');
  panel.innerHTML =
    '<header class="chat-top"><img src="/assets/logo-avatar.png" alt="" width="38" height="38"><span><b>' + esc(CFG.nombre || 'Asistente Karivé') + '</b><small>Responde al tiro</small></span>' +
    '<button type="button" class="chat-x" aria-label="Cerrar el asistente">' + ICO_X + '</button></header>' +
    '<div class="chat-msgs" aria-live="polite"><div class="chat-m bot">' + esc(CFG.saludo || '¡Hola! 💜 ¿Qué andas buscando?') + '</div>' +
    '<div class="chat-sug">' + SUGERENCIAS.map(s => '<button type="button">' + esc(s) + '</button>').join('') + '</div></div>' +
    '<form class="chat-fila"><input type="text" placeholder="Escribe tu pregunta…" autocomplete="off" aria-label="Tu pregunta" maxlength="400">' +
    '<button type="submit" aria-label="Enviar">' + ICO_ENV + '</button></form>';
  document.body.append(btn, globo, panel);

  const msgs = $('.chat-msgs', panel), input = $('input', panel), enviarBtn = $('.chat-fila button', panel);
  function agregar(html, cls) {
    const d = document.createElement('div');
    d.className = 'chat-m ' + cls; d.innerHTML = html;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    return d;
  }
  let ocupado = false;
  async function enviar(q) {
    q = String(q || '').trim();
    if (!q || ocupado) return;
    ocupado = true; enviarBtn.disabled = true; input.value = '';
    const sug = $('.chat-sug', msgs); if (sug) sug.remove();
    agregar(esc(q), 'yo');
    hist.push({ role: 'user', content: q });
    const pensando = agregar('<span class="chat-puntos"><i></i><i></i><i></i></span>', 'bot');
    if (!lista.length) await cargar();
    const r = await ia();
    pensando.remove();
    const html = r ? formatear(r) : responder(q);
    agregar(html, 'bot');
    hist.push({ role: 'assistant', content: r || html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() });
    if (hist.length > 16) hist.splice(0, hist.length - 16);
    ocupado = false; enviarBtn.disabled = false;
    if (matchMedia('(hover:hover)').matches) input.focus();
  }
  // en el celular el panel ocupa la pantalla y se ajusta cuando sale el teclado
  function ajustar() {
    if (panel.hidden || innerWidth > 640 || !window.visualViewport) { panel.style.height = ''; panel.style.transform = ''; return; }
    const vv = visualViewport;
    panel.style.height = vv.height + 'px';
    panel.style.transform = 'translateY(' + vv.offsetTop + 'px)';
    msgs.scrollTop = msgs.scrollHeight;
  }
  if (window.visualViewport) { visualViewport.addEventListener('resize', ajustar); visualViewport.addEventListener('scroll', ajustar); }
  function abrir() {
    panel.hidden = false; globo.hidden = true; btn.classList.remove('llama');
    btn.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('chat-abierto');
    if (innerWidth <= 640) document.body.style.overflow = 'hidden';
    try { sessionStorage.setItem('kv_chat_visto', '1'); } catch (e) {}
    cargar(); ajustar();
    if (matchMedia('(hover:hover)').matches) input.focus();
  }
  function cerrar() {
    input.blur(); panel.hidden = true; panel.style.transform = ''; panel.style.height = '';
    btn.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('chat-abierto');
    document.body.style.overflow = '';
  }
  btn.addEventListener('click', () => panel.hidden ? abrir() : cerrar());
  $('.chat-globo-txt', globo).addEventListener('click', abrir);
  $('.chat-globo-x', globo).addEventListener('click', () => { globo.hidden = true; btn.classList.remove('llama'); basta = true; try { sessionStorage.setItem('kv_chat_basta', '1'); } catch (e) {} });
  $('.chat-x', panel).addEventListener('click', cerrar);
  $('.chat-fila', panel).addEventListener('submit', e => { e.preventDefault(); enviar(input.value); });
  msgs.addEventListener('click', e => { const b = e.target.closest('.chat-sug button'); if (b) enviar(b.textContent); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) cerrar(); });

  // mensajes: aparecen de a uno, se van solos y no se repiten demasiado
  // (máximo 6 por visita; se acaban al abrir el chat o al cerrar una burbuja)
  const MENSAJES = (Array.isArray(CFG.mensajes) ? CFG.mensajes : []).concat(CFG.invitacion ? [CFG.invitacion] : []).filter((x, i, l) => String(x || '').trim() && l.indexOf(x) === i);
  if (!MENSAJES.length) MENSAJES.push('¿Te ayudo a encontrar tus aros? 💜');
  const ses = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };
  let mostrados = +(ses('kv_chat_n') || 0);
  let basta = ses('kv_chat_basta') === '1' || ses('kv_chat_visto') === '1';
  let quitarT = null;
  function burbuja() {
    if (basta || !panel.hidden || mostrados >= 6 || document.hidden || /finalizar-compra/.test(location.pathname)) return;
    {
      const txt = $('.chat-globo-txt', globo);
      txt.innerHTML = '<span class="chat-puntos"><i></i><i></i><i></i></span>';
      globo.hidden = false; btn.classList.add('llama');
      const k = +(ses('kv_chat_m') || 0); ses('kv_chat_m', String(k + 1));
      setTimeout(() => { txt.textContent = MENSAJES[k % MENSAJES.length]; }, 900);
    }
    mostrados++; ses('kv_chat_n', String(mostrados));
    clearTimeout(quitarT);
    quitarT = setTimeout(() => { globo.hidden = true; }, 9000);
  }
  [5000, 30000, 60000, 95000].forEach(t => setTimeout(burbuja, t));
})();
