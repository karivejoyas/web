/* Karivé Joyas · diseño de la web: anuncio con flechas, carruseles,
   preguntas y videos de Instagram aquí mismo. El carrito, el buscador y la
   suscripción están en tienda.js. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // anuncio: una parte del texto a la vez, con flechas
  const an = $('.anuncio-flechas');
  if (an) {
    let partes = []; try { partes = JSON.parse($('#an-partes').textContent); } catch (e) {}
    const txt = $('.an-txt', an); let i = 0, reloj = null;
    const paso = (d) => { if (partes.length < 2) return; i = (i + d + partes.length) % partes.length; txt.classList.add('cambia'); setTimeout(() => { txt.innerHTML = partes[i]; txt.classList.remove('cambia'); }, 200); };
    const auto = () => { clearInterval(reloj); if (!quieto) reloj = setInterval(() => paso(1), 4000); };
    $$('[data-an]', an).forEach(b => b.addEventListener('click', () => { paso(+b.dataset.an); auto(); }));
    auto();
  }
  /* ---------- cintas que avanzan solas (colecciones, más queridos, Instagram) ----------
     Cada tarjeta se mueve por separado (transform): la que sale por un lado
     reaparece por el otro fuera de la pantalla; así el iPhone no deja tramos
     en blanco ni se ve un salto al volver a empezar.
     - avanza sin fin (al final se repiten los productos con una copia oculta)
     - se detiene con el mouse encima, al tocarla o al usar el teclado dentro
     - se arrastra con el mouse o se desliza con el dedo (con inercia)
     - quien pidió «reducir movimiento» la ve quieta y la mueve a mano */
  const tactil = matchMedia('(hover: none)').matches;
  function cinta(pista, opc) {
    // la «vista» recorta la fila; si no existe, se crea alrededor
    let vista = opc.vista;
    if (!vista) { vista = document.createElement('div'); pista.parentNode.insertBefore(vista, pista); vista.appendChild(pista); }
    vista.classList.add('cinta-vista'); pista.classList.add('cinta-pista');
    // Instagram en el celular: la foto en vez del video (los videos parpadeaban al entrar y salir de la pantalla)
    if (opc.fotosEnTactil && tactil) pista.querySelectorAll('video').forEach(v => {
      const im = document.createElement('img'); im.src = v.getAttribute('poster') || ''; im.alt = v.getAttribute('aria-label') || '';
      im.width = 480; im.height = 600; v.parentNode.replaceChild(im, v);
    });
    const orig = Array.from(pista.children);
    if (orig.length < 2) return null;
    // se muestran desde el inicio (el efecto de «aparecer al verse» llegaba tarde en una fila que se mueve)
    orig.forEach(n => { n.classList.add('visto'); n.querySelectorAll('[data-revelar]').forEach(x => x.classList.add('visto')); });
    // las fotos se piden de una vez (las «lazy» de una fila que se mueve sola tardaban en aparecer)
    pista.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
    // y se decodifican antes de que entren a la pantalla (si no, la primera pasada daba un tirón)
    pista.querySelectorAll('img').forEach(i => { i.decoding = 'async'; if (i.decode) i.decode().catch(() => {}); });
    const dir = opc.dir || 1;   // 1: de derecha a izquierda · -1: de izquierda a derecha
    const vel = () => innerWidth < 768 ? (opc.velMovil || 26) : (opc.vel || 40);
    const copiar = () => orig.forEach(n => {
      const c = n.cloneNode(true);
      c.setAttribute('aria-hidden', 'true'); c.classList.add('cinta-clon', 'visto');
      c.querySelectorAll('a, button, video, input, [tabindex]').forEach(x => x.setAttribute('tabindex', '-1'));
      c.querySelectorAll('[data-revelar]').forEach(x => x.classList.add('visto'));
      c.querySelectorAll('video').forEach(v => { v.muted = true; verVideo(v); });
      pista.appendChild(c);
    });
    /* Cada tarjeta se mueve por separado: la que sale por un lado reaparece por
       el otro, fuera de la pantalla. No hay una fila enorme que el iPhone deba
       dibujar entera ni un «volver al inicio»: el movimiento es continuo. */
    let items = [], paso = 0, L = 0, anchoVista = 0, pos = 0;
    const pintar = () => {
      if (!L) return;
      pos = ((pos % L) + L) % L;
      for (let i = 0; i < items.length; i++) {
        let x = (((i * paso - pos) % L) + L) % L;
        if (x > L - paso) x -= L;
        items[i].style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
      }
    };
    const medir = () => {
      pista.classList.remove('cinta-abs'); pista.style.height = '';
      pista.style.removeProperty('--alto');
      items.forEach(n => { n.style.transform = ''; });
      anchoVista = vista.clientWidth;
      pista.style.setProperty('--cw', anchoVista + 'px');
      const ancho = orig[0].getBoundingClientRect().width;
      paso = ancho + (parseFloat(getComputedStyle(pista).columnGap) || 0);
      // tarjetas suficientes para cubrir la pantalla y una más a cada lado
      for (let k = 0; k < 6 && pista.children.length * paso < anchoVista + 2 * paso; k++) copiar();
      items = Array.from(pista.children);
      L = items.length * paso;
      const cs = getComputedStyle(pista), pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
      const alto = Math.max.apply(null, items.map(n => n.getBoundingClientRect().height));
      pista.style.setProperty('--ancho', ancho + 'px');
      pista.style.setProperty('--pt', pt + 'px');
      pista.style.setProperty('--alto', Math.ceil(alto) + 'px');
      pista.style.height = Math.ceil(alto + (cs.boxSizing === 'border-box' ? pt + pb : 0)) + 'px';
      pista.classList.add('cinta-abs');
      pintar();
    };
    medir();
    addEventListener('resize', () => { if (vista.clientWidth !== anchoVista) medir(); });
    addEventListener('load', medir);   // ya con las fotos cargadas, por si cambió el alto
    let t0 = 0, hasta = 0, encima = false, foco = false, visible = true, arr = null, movio = false, empuje = null, inercia = 0;
    // con el mouse encima no se detiene: va más lento (a la dueña le gusta así)
    const LENTO = 0.3;
    // velocidad que se busca en cada momento; la real (vAct) la sigue suave, sin frenazos ni arranques bruscos
    const objetivo = () => (foco || !visible || document.hidden || performance.now() < hasta) ? 0 : dir * vel() * (encima ? LENTO : 1);
    let vAct = dir * vel();
    function paso1(t) {
      const dt = t0 ? Math.min(50, t - t0) / 1000 : 0; t0 = t;
      if (L > 0 && !arr) {
        if (empuje) {
          const k = Math.min(1, (t - empuje.t) / 450);
          pos = empuje.de + (empuje.a - empuje.de) * (1 - Math.pow(1 - k, 3));
          if (k >= 1) empuje = null;
          pintar();
        } else if (Math.abs(inercia) > 15) {       // sigue un poco después de soltarla con el dedo
          pos += inercia * dt; inercia *= Math.exp(-dt * 3.2); pintar();
          hasta = Math.max(hasta, performance.now() + 1800); vAct = 0;
        } else {
          inercia = 0;
          vAct += (objetivo() - vAct) * (1 - Math.exp(-dt * 3));   // ~1/3 s para cambiar de velocidad
          if (Math.abs(vAct) > 0.02) { pos += vAct * dt; pintar(); }
        }
      }
      requestAnimationFrame(paso1);
    }
    requestAnimationFrame(paso1);
    // mouse encima (solo mouse: en el celular un toque no debe dejarla quieta para siempre)
    vista.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') encima = true; });
    vista.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') encima = false; });
    // teclado: se detiene y muestra la tarjeta enfocada
    vista.addEventListener('focusin', e => {
      let kb = false; try { kb = e.target.matches(':focus-visible'); } catch (err) {}
      foco = kb; vista.scrollLeft = 0;
      if (kb) { const i = items.indexOf(e.target.closest('.cinta-pista > *')); if (i >= 0) { pos = i * paso - 16; pintar(); } }
    });
    vista.addEventListener('focusout', () => { foco = false; });
    // arrastrar (mouse) o deslizar (dedo)
    let hist = [];
    vista.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (e.pointerType === 'mouse') e.preventDefault();
      arr = { x: e.clientX, pos: pos, id: e.pointerId }; movio = false; empuje = null; inercia = 0; vAct = 0; hist = [[performance.now(), 0]];
    });
    addEventListener('pointermove', e => {
      if (!arr || e.pointerId !== arr.id) return;
      const d = e.clientX - arr.x;
      if (!movio) {
        if (Math.abs(d) < 6) return;
        movio = true; vista.classList.add('arrastrando');
        try { vista.setPointerCapture(e.pointerId); } catch (err) {}
      }
      hist.push([performance.now(), d]); if (hist.length > 6) hist.shift();
      pos = arr.pos - d; pintar();
    }, { passive: true });
    const soltar = e => {
      if (!arr || (e && e.pointerId !== arr.id)) return;
      const fue = movio, tipo = e && e.pointerType;
      arr = null; vista.classList.remove('arrastrando');
      if (fue) {
        const a = hist[0], b = hist[hist.length - 1], dtm = Math.max(16, b[0] - a[0]);
        if (tipo !== 'mouse' && performance.now() - b[0] < 120) inercia = Math.max(-2500, Math.min(2500, -(b[1] - a[1]) / dtm * 1000));
        // con el mouse: si quedó encima sigue lenta (como siempre con el mouse encima); al sacarlo, vuelve a su velocidad
        if (tipo === 'mouse') { try { encima = vista.matches(':hover'); } catch (err) { encima = false; } }
      }
      hasta = performance.now() + 2000;
    };
    addEventListener('pointerup', soltar);
    addEventListener('pointercancel', soltar);
    vista.addEventListener('click', e => { if (movio) { e.preventDefault(); e.stopPropagation(); movio = false; } }, true);
    vista.addEventListener('dragstart', e => e.preventDefault());
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { rootMargin: '200px 0px' }).observe(vista);
    return { empujar: (n) => { empuje = { de: pos, a: pos + n * paso, t: performance.now() }; hasta = performance.now() + 3000; } };
  }
  // los videos de Instagram de las copias también se reproducen solo cuando se ven (computador)
  const ioCopias = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { v.preload = 'auto'; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); } else v.pause();
  }), { rootMargin: '120px 0px' }) : null;
  function verVideo(v) { if (ioCopias && !quieto) ioCopias.observe(v); }
  const cintas = {};
  if (!quieto) {
    const marcoEst = $('.estilos-marco'), listaEst = $('.estilos');
    if (marcoEst && listaEst) cintas.estilos = cinta(listaEst, { vista: marcoEst, dir: 1, vel: 45, velMovil: 30 });
    const pistaFav = $('.ecm-pista');
    if (pistaFav) cintas.favoritos = cinta(pistaFav, { dir: -1, vel: 35, velMovil: 26 });
    const ig = $('.ecm-ig .ig-grilla');
    if (ig) cintas.instagram = cinta(ig, { dir: 1, vel: 35, velMovil: 26, fotosEnTactil: true });
  }
  // ficha en el celular: barra fija con precio y «Agregar al carrito» cuando el botón principal no se ve
  const btnFicha = $('#ficha-agregar'), barra = $('.barra-compra');
  if (btnFicha && barra && 'IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => document.body.classList.toggle('ver-barra-compra', !en.isIntersecting && en.boundingClientRect.top < 0))
      .observe(btnFicha);
    const bb = $('button', barra);
    new MutationObserver(() => { bb.disabled = btnFicha.disabled; bb.textContent = btnFicha.textContent; }).observe(btnFicha, { attributes: true, childList: true, characterData: true, subtree: true });
  }
  // ficha de producto: la foto se agranda donde apunta el mouse (solo con mouse)
  const fichaFoto = $('.ficha-foto');
  if (fichaFoto && !quieto && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const img = $('img', fichaFoto);
    fichaFoto.addEventListener('mousemove', (e) => {
      const r = fichaFoto.getBoundingClientRect();
      img.style.transformOrigin = ((e.clientX - r.left) / r.width * 100).toFixed(1) + '% ' + ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%';
      fichaFoto.classList.add('acercar');
    });
    fichaFoto.addEventListener('mouseleave', () => fichaFoto.classList.remove('acercar'));
  }
  // portada con carrusel
  const hero = $('.ecm-hero');
  if (hero) {
    const sl = $$('.slide', hero); let i = 0, reloj = null;
    const ir = (d) => { sl[i].classList.remove('activa'); i = (i + d + sl.length) % sl.length; sl[i].classList.add('activa'); };
    const auto = () => { clearInterval(reloj); if (!quieto && sl.length > 1) reloj = setInterval(() => ir(1), 6000); };
    $$('[data-hero]', hero).forEach(b => b.addEventListener('click', () => { ir(+b.dataset.hero); auto(); }));
    auto();
  }
  // carrusel de destacados
  const pista = $('.ecm-pista');
  if (pista && cintas.favoritos) {
    // con la cinta en movimiento, las flechas la empujan una tarjeta; los puntos sobran
    $$('[data-pista]').forEach(b => b.addEventListener('click', () => cintas.favoritos.empujar(+b.dataset.pista)));
    const pu = $('.ecm-puntos'); if (pu) pu.hidden = true;
  } else if (pista) {
    const puntos = $('.ecm-puntos');
    const n = () => Math.max(1, Math.ceil(pista.scrollWidth / pista.clientWidth - 0.05));
    const pintar = () => { const k = n(); puntos.innerHTML = Array.from({ length: k }, () => '<i></i>').join(''); marcar(); };
    const marcar = () => { const p = pista.scrollLeft / ((pista.scrollWidth - pista.clientWidth) || 1), k = Math.round(p * (n() - 1)); $$('i', puntos).forEach((d, j) => d.classList.toggle('on', j === k)); };
    $$('[data-pista]').forEach(b => b.addEventListener('click', () => pista.scrollBy({ left: +b.dataset.pista * pista.clientWidth, behavior: quieto ? 'auto' : 'smooth' })));
    pista.addEventListener('scroll', marcar, { passive: true });
    addEventListener('resize', pintar); pintar();
  }
  // reseñas
  const res = $('.res-pista');
  if (res) $$('[data-res]').forEach(b => b.addEventListener('click', () => res.scrollBy({ left: +b.dataset.res * res.clientWidth, behavior: quieto ? 'auto' : 'smooth' })));
  // preguntas: una abierta a la vez
  const acc = $$('.ecm-faq .acc');
  acc.forEach(a => $('button', a).addEventListener('click', () => {
    const abierta = a.classList.contains('abierta');
    acc.forEach(x => { x.classList.remove('abierta'); $('button', x).setAttribute('aria-expanded', 'false'); });
    if (!abierta) { a.classList.add('abierta'); $('button', a).setAttribute('aria-expanded', 'true'); }
  }));
  // Instagram: el video o la foto se ve aquí mismo (reproductor de Instagram)
  const tarjIg = $$('.ecm-ig .ig-tarjeta');
  if (tarjIg.length) {
    const m = document.createElement('div');
    m.className = 'ig-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Publicación de Instagram');
    m.innerHTML = '<div class="ig-modal-caja"><button class="ig-modal-cerrar" type="button" aria-label="Cerrar">×</button><iframe title="Publicación de Instagram" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>' +
      '<div class="ig-modal-pie"><span>@karive.joyas</span><a target="_blank" rel="noopener">Ver en Instagram ↗</a></div></div>';
    document.body.appendChild(m);
    const fr = $('iframe', m), enlace = $('.ig-modal-pie a', m);
    const cerrar = () => { m.classList.remove('abierto'); fr.src = 'about:blank'; document.body.style.overflow = ''; };
    $('.ig-modal-cerrar', m).addEventListener('click', cerrar);
    m.addEventListener('click', (e) => { if (e.target === m) cerrar(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && m.classList.contains('abierto')) cerrar(); });
    tarjIg.forEach(t => t.addEventListener('click', (e) => {
      const u = t.getAttribute('href') || ''; if (!/^https:\/\/www\.instagram\.com\/(p|reel|tv)\//.test(u)) return;
      e.preventDefault();
      fr.src = u.replace(/\/?(\?.*)?$/, '/') + 'embed/captioned/';
      enlace.href = u; m.classList.add('abierto'); document.body.style.overflow = 'hidden';
      $('.ig-modal-cerrar', m).focus();
    }));
  }
})();
