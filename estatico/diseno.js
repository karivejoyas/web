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
  if (pista) {
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
