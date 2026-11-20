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
     - avanzan sin fin (los productos se repiten al final con una copia oculta)
     - se detienen con el mouse encima, al tocarlas o al usar el teclado dentro
     - se pueden arrastrar con el mouse y deslizar con el dedo
     - quien pidió «reducir movimiento» las ve quietas y las mueve a mano */
  function cinta(sc, lista, opc) {
    const orig = Array.from(lista.children);
    if (orig.length < 2) return null;
    sc.classList.add('cinta-js');
    // en el iPhone las fotos «lazy» de una fila que se mueve sola a veces no cargan: se piden de una vez
    lista.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
    const dir = opc.dir || 1;   // 1: de derecha a izquierda · -1: de izquierda a derecha
    const vel = () => innerWidth < 768 ? (opc.velMovil || 26) : (opc.vel || 40);
    const copiar = () => orig.forEach(n => {
      const c = n.cloneNode(true);
      c.setAttribute('aria-hidden', 'true'); c.classList.add('cinta-clon', 'visto');
      c.querySelectorAll('a, button, video, input, [tabindex]').forEach(x => x.setAttribute('tabindex', '-1'));
      c.querySelectorAll('[data-revelar]').forEach(x => x.classList.add('visto'));
      c.querySelectorAll('video').forEach(v => { v.muted = true; verVideo(v); });
      lista.appendChild(c);
    });
    copiar();
    let P = 0;
    const medir = () => {
      P = lista.querySelector('.cinta-clon').offsetLeft - orig[0].offsetLeft;
      for (let k = 0; k < 4 && P > 0 && sc.scrollWidth < P + sc.clientWidth + 2; k++) copiar();
    };
    medir(); addEventListener('resize', medir);
    let pos = 0, ultimo = 0, t0 = 0, hasta = 0, encima = false, tocando = false, foco = false, visible = true, arr = null, movio = false, empuje = null;
    const poner = () => { if (P > 0) { pos = ((pos % P) + P) % P; } sc.scrollLeft = pos; ultimo = sc.scrollLeft; };
    const quieta = () => encima || tocando || foco || arr || !visible || document.hidden || performance.now() < hasta;
    function paso(t) {
      const dt = t0 ? Math.min(64, t - t0) / 1000 : 0; t0 = t;
      if (P > 0 && !arr) {
        if (Math.abs(sc.scrollLeft - ultimo) > 1) pos = sc.scrollLeft;   // la movieron a mano
        if (empuje) {
          const k = Math.min(1, (t - empuje.t) / 450);
          pos = empuje.de + (empuje.a - empuje.de) * (1 - Math.pow(1 - k, 3));
          if (k >= 1) empuje = null;
          poner();
        } else if (!quieta()) { pos += dir * vel() * dt; poner(); }
        else if (!tocando && (pos < 1 || pos >= P)) poner();   // da la vuelta también si la movieron a mano
      }
      requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
    sc.addEventListener('mouseenter', () => { encima = true; });
    sc.addEventListener('mouseleave', () => { encima = false; });
    // solo el foco del teclado la detiene (un clic con el mouse no la deja quieta para siempre)
    sc.addEventListener('focusin', e => { try { foco = e.target.matches(':focus-visible'); } catch (err) { foco = false; } });
    sc.addEventListener('focusout', () => { foco = false; });
    sc.addEventListener('touchstart', () => { tocando = true; }, { passive: true });
    const soltar = () => { tocando = false; hasta = performance.now() + 2000; };
    sc.addEventListener('touchend', soltar, { passive: true });
    sc.addEventListener('touchcancel', soltar, { passive: true });
    // arrastrar con el mouse
    sc.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0) return; e.preventDefault(); arr = { x: e.clientX, pos: pos }; movio = false; empuje = null; });
    addEventListener('pointermove', e => {
      if (!arr) return;
      const d = e.clientX - arr.x;
      if (!movio && Math.abs(d) > 5) { movio = true; sc.classList.add('arrastrando'); }
      if (!movio) return;
      pos = arr.pos - d;
      if (P > 0 && pos >= P) { pos -= P; arr.pos -= P; } else if (P > 0 && pos < 0) { pos += P; arr.pos += P; }
      sc.scrollLeft = pos; ultimo = sc.scrollLeft;
    });
    // al soltar sigue sola a los 2 s, aunque el mouse quede encima (vuelve a detenerse si sale y entra de nuevo)
    addEventListener('pointerup', () => { if (!arr) return; const fue = movio; arr = null; sc.classList.remove('arrastrando'); if (fue) { encima = false; hasta = performance.now() + 2000; } });
    sc.addEventListener('click', e => { if (movio) { e.preventDefault(); e.stopPropagation(); movio = false; } }, true);
    sc.addEventListener('dragstart', e => e.preventDefault());
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(sc);
    return { empujar: (n) => { const ancho = orig[0].getBoundingClientRect().width + (parseFloat(getComputedStyle(lista).columnGap) || 0); empuje = { de: pos, a: pos + n * ancho, t: performance.now() }; hasta = performance.now() + 3000; } };
  }
  // los videos de Instagram de las copias también se reproducen solo cuando se ven
  const ioCopias = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { v.preload = 'auto'; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); } else v.pause();
  }), { rootMargin: '120px 0px' }) : null;
  function verVideo(v) { if (ioCopias && !quieto) ioCopias.observe(v); }
  const cintas = {};
  if (!quieto) {
    const marcoEst = $('.estilos-marco'), listaEst = $('.estilos');
    if (marcoEst && listaEst) cintas.estilos = cinta(marcoEst, listaEst, { dir: 1, vel: 45, velMovil: 30 });
    const pistaFav = $('.ecm-pista');
    if (pistaFav) cintas.favoritos = cinta(pistaFav, pistaFav, { dir: -1, vel: 35, velMovil: 26 });
    const ig = $('.ecm-ig .ig-grilla');
    if (ig) cintas.instagram = cinta(ig, ig, { dir: 1, vel: 35, velMovil: 26 });
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
