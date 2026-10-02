'use strict';

const KV_CATEGORIAS = [
  { id: 'flores',   nombre: 'Flores',              sub: 'Aros de flores hechos a mano, livianos e hipoalergénicos', imagen: 'assets/productos/floron-rojo.jpg', prefijo: 'FL' },
  { id: 'charms',   nombre: 'Charms',              sub: 'Argollita de acero con tu charm favorito colgando', imagen: 'assets/productos/charms-flor-azul-oro.jpg', prefijo: 'CH' },
  { id: 'argollas', nombre: 'Argollas de cristal', sub: 'Acero inoxidable hipoalergénico, dorado o plateado, con cristales', imagen: 'assets/modelo-argollas.jpg', prefijo: 'AG' },
  { id: 'topos',    nombre: 'Topos',               sub: 'Aros pequeños tipo botón, ideales para el día a día', imagen: 'assets/productos/topos-corazon-dorado.jpg', prefijo: 'TP' },
  { id: 'otros',    nombre: 'Otros',               sub: 'Otros accesorios de la colección', imagen: 'assets/productos/floron-blanco-perla.jpg', prefijo: 'OT' }
];

/* defaults editables desde el panel admin (se guardan en settings) */
const KV_THEME_DEFAULT = { morado: '#5B2A82', moradoProf: '#3A1D4E', dorado: '#E3C572', lila: '#CFC4DF' };
const KV_COVER_DEFAULT = { image: 'assets/modelo-portada.jpg', tagline: 'Accesorios hechos a mano, con amor' };
const KV_INFO_DEFAULT = {
  titulo: 'Accesorios que iluminan, hechos con amor',
  b1: 'Todas nuestras piezas tienen base de acero inoxidable hipoalergénico.',
  b2: '¿Eres alérgica/o? Tenemos opción de plata 925, solo pregúntanos ✨',
  b3: 'Hacemos envíos a todo Chile.',
  b4: 'Si sueñas con un diseño especial, lo creamos juntas/os — envíanos una fotito de referencia y te damos el presupuesto.'
};

const KV_HOWTO_DEFAULT = {
  titulo: '¿Cómo comprar?',
  p1t: '1 · Agrega al carrito',      p1d: 'Toca "🛒 Agregar al carrito" en tus joyas favoritas.',
  p2t: '2 · Completa tus datos',     p2d: 'Abre el carrito, pon tu dirección y elige tu región: el envío se calcula solo.',
  p3t: '3 · Transfiere el total',    p3d: 'Copia nuestros datos con un toque y transfiere desde tu banco.',
  p4t: '4 · Adjunta el comprobante', p4d: 'Envía tu pedido y recibe al instante tu número y confirmación al correo.',
  p5t: '5 · Enviamos con amor',      p5d: 'Preparamos tu joya a mano y te avisamos con el seguimiento del envío.',
  p6t: '6 · ¿Dudas o prefieres otra vía?', p6d: 'También puedes comprar como siempre: escríbenos por WhatsApp o DM y te ayudamos 💜'
};
/* Cuando el pago con tarjeta esta encendido, los pasos 3 y 4 cambian: ya no se
   habla solo de transferir. Se eligen segun la configuracion, asi que si alguna
   vez se apaga Mercado Pago el texto vuelve al de transferencia y la pagina
   nunca queda prometiendo algo que no existe. Igual se puede reescribir todo
   desde el panel, en "Como comprar". */
const KV_HOWTO_TARJETA = {
  p3t: '3 · Elige cómo pagar', p3d: 'Con tarjeta de débito o crédito, o por transferencia. Tú decides.',
  p4t: '4 · Paga y listo',     p4d: 'Con tarjeta te llevamos a Mercado Pago y no necesitas comprobante. Si transfieres, copia nuestros datos con un toque y adjunta el comprobante.'
};
function kvHowtoDefault(settings) {
  const base = Object.assign({}, KV_HOWTO_DEFAULT);
  return kvMercadoPago(settings).activo ? Object.assign(base, KV_HOWTO_TARJETA) : base;
}
const KV_DESPEDIDA_DEFAULT = {
  titulo: '¡Gracias por tu visita!',
  mensaje: 'Esperamos que hayas encontrado tu joya favorita. Escríbenos cuando quieras — nos encanta verte brillar ✦'
};

/* lista de colecciones vigente: la guardada en settings.categorias, o los
   valores por defecto (migrando ediciones antiguas de settings.cats). */
function kvCategorias(settings) {
  settings = settings || {};
  if (Array.isArray(settings.categorias) && settings.categorias.length) {
    return settings.categorias.map(c => Object.assign({}, c));
  }
  return KV_CATEGORIAS.map(base => {
    const ov = (settings.cats && settings.cats[base.id]) || {};
    return Object.assign({}, base, ov);
  });
}

/* devuelve una colección por id */
function kvCat(id, settings) {
  return kvCategorias(settings).find(c => c.id === id) || { id: id, nombre: 'Otros', sub: '', imagen: '', prefijo: 'PR' };
}

/* aplica los colores guardados a las variables CSS */
function kvApplyTheme(t) {
  t = t || {};
  const r = document.documentElement.style;
  if (t.morado)     r.setProperty('--kv-morado', t.morado);
  if (t.moradoProf) r.setProperty('--kv-morado-prof', t.moradoProf);
  if (t.dorado)     r.setProperty('--kv-dorado-cl', t.dorado);
  if (t.lila)       r.setProperty('--kv-lila-fondo', t.lila);
}

function KV_PRODUCTOS_INICIALES() {
  const p = (code, name, detail, price, photo, category, order) =>
    ({ code, name, detail, price, photo: 'assets/productos/' + photo + '.jpg', category, order, stock: true });
  return [
    // ---- FLORES ----
    p('FL-001', 'Florón rojo',            'Aprox. 5cm de diámetro', 13990, 'floron-rojo', 'flores', 1),
    p('FL-002', 'Florón morado',          'Aprox. 5cm de diámetro', 13990, 'floron-morado', 'flores', 2),
    p('FL-003', 'Florón azul',            'Aprox. 5cm de diámetro', 13990, 'floron-azul', 'flores', 3),
    p('FL-004', 'Florón naranjo',         'Aprox. 5cm de diámetro', 13990, 'floron-naranjo', 'flores', 4),
    p('FL-005', 'Florón negro',           'Aprox. 5cm de diámetro', 13990, 'floron-negro', 'flores', 5),
    p('FL-006', 'Florón cobre',           'Aprox. 5cm de diámetro', 13990, 'floron-cobre', 'flores', 6),
    p('FL-007', 'Florón blanco',          'Aprox. 5cm de diámetro', 13990, 'floron-blanco', 'flores', 7),
    p('FL-008', 'Florón blanco perla',    'Aprox. 5cm de diámetro', 13990, 'floron-blanco-perla', 'flores', 8),
    p('FL-009', 'Flores cristal',         'Aprox. 4cm de diámetro', 11990, 'flores-cristal', 'flores', 9),
    p('FL-010', 'Flores plateadas',       'Aprox. 4cm de diámetro', 11990, 'flores-plateadas', 'flores', 10),
    p('FL-011', 'Flores amarillo & negro','Aprox. 4cm de diámetro', 11990, 'flores-amarillo-negro', 'flores', 11),
    p('FL-012', 'Flores blanco & negro',  'Aprox. 4cm de diámetro', 11990, 'flores-blanco-negro-stand', 'flores', 12),
    p('FL-013', 'Flores amarillas',       'Aprox. 4cm de diámetro', 10990, 'flores-amarillas', 'flores', 13),
    p('FL-014', 'Mini flores amarillas',  'Aprox. 3cm de diámetro', 9990,  'flores-amarillas-mini', 'flores', 14),
    p('FL-015', 'Flores amarillas & blancas','Elige tu color', 10990, 'flores-amarillas-blancas', 'flores', 15),
    p('FL-016', 'Margaritas blancas',     'Aprox. 3cm de diámetro', 9990,  'margaritas-blancas', 'flores', 16),
    p('FL-017', 'Margaritas blancas texturadas','Aprox. 3.5cm de diámetro', 10990, 'margaritas-blancas-texturadas', 'flores', 17),
    p('FL-018', 'Margaritas grises',      'Aprox. 5cm de diámetro', 11990, 'margaritas-grises', 'flores', 18),
    p('FL-019', 'Margaritas blancas colgantes','Aprox. 4cm de largo', 10990, 'margaritas-blancas-colg', 'flores', 19),
    p('FL-020', 'Margaritas blancas topo','Aprox. 2.5cm de diámetro', 8990, 'margaritas-blancas-topo', 'flores', 20),
    p('FL-021', 'Margaritas rojas',       'Aprox. 2.5cm de diámetro', 8990, 'margaritas-rojas', 'flores', 21),
    p('FL-022', 'Margaritas colgantes',   'Aprox. 4cm de largo', 10990, 'margaritas-blancas-colg2', 'flores', 22),
    // ---- CHARMS (argollita + charm) ----
    p('CH-023', 'Charms flor azul (oro)',    'Argolla dorada · flor azul', 9500, 'charms-flor-azul-oro', 'charms', 23),
    p('CH-024', 'Charms flor azul (negro)',  'Argolla negra · flor azul', 9500, 'charms-flor-azul-negro', 'charms', 24),
    p('CH-025', 'Charms flor blanca (oro)',  'Argolla dorada · flor blanca', 9500, 'charms-flor-blanca-oro', 'charms', 25),
    p('CH-026', 'Charms flor blanca (plata)','Argolla plateada · flor blanca', 9500, 'charms-flor-blanca-plata', 'charms', 26),
    p('CH-027', 'Charms donut azul',         'Argolla · donut de arcilla', 9500, 'charms-donut-azul', 'charms', 27),
    p('CH-028', 'Charms donut marino',       'Argolla · donut de arcilla', 9500, 'charms-donut-marino', 'charms', 28),
    p('CH-029', 'Charms donut blanco',       'Argolla · donut de arcilla', 9500, 'charms-donut-blanco', 'charms', 29),
    // ---- ARGOLLAS DE CRISTAL ----
    p('AG-030', 'Argollas cristal amarillo',   'Acero dorado · cristales', 10990, 'argollas-amarillo', 'argollas', 30),
    p('AG-031', 'Argollas cristal azul',       'Acero dorado · cristales', 10990, 'argollas-azul', 'argollas', 31),
    p('AG-032', 'Argollas cristal azul rey',   'Acero dorado · cristales', 10990, 'argollas-azul-rey', 'argollas', 32),
    p('AG-033', 'Argollas cristal verde',      'Acero dorado · cristales', 10990, 'argollas-verde', 'argollas', 33),
    p('AG-034', 'Argollas cristal verde oliva','Acero dorado · cristales', 10990, 'argollas-verde-oliva', 'argollas', 34),
    p('AG-035', 'Argollas cristal rojo',       'Acero dorado · cristales', 10990, 'argollas-rojo', 'argollas', 35),
    p('AG-036', 'Argollas cristal rojo intenso','Acero dorado · cristales', 10990, 'argollas-rojo2', 'argollas', 36),
    p('AG-037', 'Argollas cristal turquesa',   'Acero dorado · cristales', 10990, 'argollas-turquesa', 'argollas', 37),
    p('AG-038', 'Argollas cristal turquesa II', 'Acero dorado · cristales', 10990, 'argollas-turquesa2', 'argollas', 38),
    p('AG-039', 'Argollas cristal lila',       'Acero dorado · cristales', 10990, 'argollas-lila', 'argollas', 39),
    p('AG-040', 'Argollas cristal negro',      'Acero dorado · cristales', 10990, 'argollas-negro', 'argollas', 40),
    p('AG-041', 'Argollas cristal multicolor', 'Acero dorado · cristales', 11990, 'argollas-multicolor', 'argollas', 41),
    p('AG-042', 'Argollas cristal transparente','Acero dorado · cristales', 10990, 'argollas-transparente', 'argollas', 42),
    p('AG-043', 'Argollas cristal transparente II','Acero dorado · cristales', 10990, 'argollas-transparente2', 'argollas', 43),
    p('AG-044', 'Argollas cristal pavé',       'Acero · pavé de cristales', 12990, 'argollas-pave', 'argollas', 44),
    p('AG-045', 'Argollas abanico negro',      'Acero dorado · cristales', 12990, 'argollas-negro-abanico', 'argollas', 45),
    p('AG-046', 'Argollas mandala dorado',     'Tejido a mano · dorado', 13990, 'argollas-mandala-dorado', 'argollas', 46),
    // ---- TOPOS ----
    p('TP-047', 'Topos corazón dorado',   'Aprox. 1.5cm', 7990, 'topos-corazon-dorado', 'topos', 47),
    p('TP-048', 'Topos corazón celeste',  'Aprox. 1.5cm', 7990, 'topos-corazon-celeste', 'topos', 48),
    p('TP-049', 'Topos botón celeste',    'Aprox. 1.2cm', 6990, 'topos-boton-celeste', 'topos', 49)
  ];
}

function formatCLP(n) {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('es-CL');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const KV_SIN_FOTO = 'repeating-linear-gradient(45deg, rgba(122,47,176,0.08) 0 11px, rgba(122,47,176,0.02) 11px 22px)';

/* ¿el producto está disponible? (sin campo = disponible) */
/* Stock: el interruptor "en stock" manda. Además, si el producto tiene una
   CANTIDAD anotada, al llegar a 0 se oculta solo. Sin cantidad anotada (null)
   funciona como siempre: visible mientras el interruptor esté encendido. */
function kvStockCantidad(p) {
  if (!p || p.cantidad == null || p.cantidad === '') return null;
  const n = parseInt(p.cantidad, 10);
  return isNaN(n) ? null : Math.max(0, n);
}
function kvEnStock(p) {
  if (!p) return true;
  if (p.stock === false) return false;
  const c = kvStockCantidad(p);
  return c === null ? true : c > 0;
}
/* quedan pocas unidades: sirve para mostrar "¡Últimas 2!" y apurar la compra */
var KV_STOCK_BAJO = 3;
function kvStockBajo(p) {
  const c = kvStockCantidad(p);
  return c !== null && c > 0 && c <= KV_STOCK_BAJO;
}

/* ---------- descuento global a todo el catálogo ---------- */
// por defecto (hasta que la admin lo configure): 20% hasta el 19-07-2026 (una semana)
function kvDescuentoDefault() { return { pct: 20, hasta: '2026-07-19' }; }
function kvDescuentoConfig(settings) {
  settings = settings || {};
  return (settings.descuentoGlobal !== undefined && settings.descuentoGlobal !== null)
    ? settings.descuentoGlobal : kvDescuentoDefault();
}
// devuelve {pct, hasta} si el descuento está activo (pct>0 y no vencido), o null
function kvDescuentoActivo(settings) {
  const d = kvDescuentoConfig(settings);
  const pct = Number(d && d.pct) || 0;
  if (pct <= 0) return null;
  const hasta = (d && d.hasta) || '';
  if (hasta) {
    const fin = new Date(hasta + 'T23:59:59');
    if (!isNaN(fin.getTime()) && Date.now() > fin.getTime()) return null;   // ya venció
  }
  return { pct: pct, hasta: hasta };
}
// estado global que leen kvPrecioOferta y compañía (lo fija cada página al cargar la config)
var _kvDesc = null;
function kvSetDescuento(settings) { _kvDesc = kvDescuentoActivo(settings); }
function kvDescuentoVigente() { return _kvDesc; }

/* precio de oferta válido (mayor que 0 y menor que el original), o 0 si no hay.
   considera la oferta manual del producto Y el descuento global; gana el menor precio. */
function kvPrecioOferta(p) {
  const base = Number(p && p.price) || 0;
  let mejor = 0;
  const o = Number(p && p.priceOffer) || 0;
  if (o > 0 && o < base) mejor = o;
  if (_kvDesc && base > 0) {
    const g = Math.round(base * (1 - _kvDesc.pct / 100) / 10) * 10;   // redondeado a $10
    if (g > 0 && g < base && (mejor === 0 || g < mejor)) mejor = g;
  }
  return mejor;
}

/* encuadre de la foto: posición X/Y (%) y zoom (%) — por defecto centrado */
function kvFoco(p) {
  const f = (p && p.foco) || {};
  return {
    x: f.x != null ? f.x : 50,
    y: f.y != null ? f.y : 50,
    zoom: f.zoom != null ? f.zoom : 100
  };
}

/* encuadre PROPIO para la publicación de Instagram (independiente del catálogo):
   por defecto la foto completa y centrada (zoom 100), pero editable en la vista previa */
function kvFocoIG(p) {
  const f = (p && p.igFoco) || {};
  return {
    x: f.x != null ? f.x : 50,
    y: f.y != null ? f.y : 50,
    zoom: f.zoom != null ? f.zoom : 100
  };
}

/* encuadre PROPIO para celular: en el teléfono el marco de la foto es más ALTO que
   ancho, y en PC más ancho que alto, así que un encuadre bueno en PC a veces corta
   la joya en el celular. Si no se ajustó aparte, usa el mismo del PC. */
/* El catálogo público SIEMPRE usa el que corresponde a la pantalla.
   El modo 'pc' / 'movil' existe solo para la vista previa del panel. */
function kvFocoMovil(p) {
  const f = (p && p.focoMovil) || null;
  if (!f) return kvFoco(p);
  return {
    x: f.x != null ? f.x : 50,
    y: f.y != null ? f.y : 50,
    zoom: f.zoom != null ? f.zoom : 100
  };
}
function kvTieneFocoMovil(p) { return !!(p && p.focoMovil); }

/* encuadre de la FOTO DE PORTADA de una colección (para que el texto no tape la joya) */
function kvFocoCat(cat) {
  const f = (cat && cat.foco) || {};
  return { x: f.x != null ? f.x : 50, y: f.y != null ? f.y : 50, zoom: f.zoom != null ? f.zoom : 100 };
}
function kvFocoCatCss(cat) {
  const f = kvFocoCat(cat);
  if (f.x === 50 && f.y === 50 && f.zoom === 100) return '';
  return 'background-position:' + f.x + '% ' + f.y + '%;background-size:' + (f.zoom === 100 ? 'contain' : (f.zoom + '%')) + ';';
}

/* una capa de imagen con el encuadre aplicado */
function kvCapaFoto(url, f, clase) {
  // se invierte (100 - x) para que el deslizador sea intuitivo: mover a la derecha = la imagen va a la derecha
  const px = 100 - f.x, py = 100 - f.y;
  return '<div class="kv-fbg' + (clase ? ' ' + clase : '') + '" style="background-image:url(\'' + url + '\');' +
         'background-position:' + px + '% ' + py + '%;' +
         'transform:scale(' + (f.zoom / 100) + ');transform-origin:' + px + '% ' + py + '%;"></div>';
}

/* capa(s) de imagen con el encuadre aplicado. '' si no hay foto.
   modo 'pc' o 'movil' = una sola capa (vista previa del admin);
   sin modo = las dos capas y el CSS muestra la que corresponde a la pantalla */
function kvFotoInner(p, modo) {
  if (!p || !p.photo) return '';
  if (modo === 'pc') return kvCapaFoto(p.photo, kvFoco(p), 'kv-fbg-solo');
  if (modo === 'movil') return kvCapaFoto(p.photo, kvFocoMovil(p), 'kv-fbg-solo');
  // las dos capas: el CSS muestra la que corresponde a la pantalla.
  // En las tarjetas se usa la versión liviana (WebP) si existe; la foto
  // completa se baja recién al abrir el producto.
  const url = p.photoMini || p.photo;
  return kvCapaFoto(url, kvFoco(p), 'kv-fbg-pc') +
         kvCapaFoto(url, kvFocoMovil(p), 'kv-fbg-mov');
}

/* foto para la vista ampliada: la joya SIEMPRE completa y centrada,
   con los bordes rellenos por la misma foto difuminada (como los posts de IG) */
function kvFotoContain(p) {
  if (!p || !p.photo) return '';
  return '<div class="kv-fbg kv-fbg-blur" style="background-image:url(\'' + p.photo + '\');"></div>' +
         '<div class="kv-fbg kv-fbg-entera" style="background-image:url(\'' + p.photo + '\');"></div>';
}


/* siguiente número correlativo global (a partir del número más alto en todos los códigos) */
function kvNextNum(products) {
  let max = 0;
  (products || []).forEach(p => {
    const m = String(p.code || '').match(/(\d+)\s*$/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return max + 1;
}

/* siguiente número correlativo DE UNA COLECCIÓN (continúa la numeración de esa colección) */
function kvNextNumCat(products, categoria) {
  let max = 0;
  (products || []).forEach(p => {
    if (p.category !== categoria) return;
    const m = String(p.code || '').match(/(\d+)\s*$/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return max + 1;
}

/* HTML del precio (con oferta si corresponde) para la tarjeta pública */
function kvPrecioHtml(p) {
  const of = kvPrecioOferta(p);
  if (of) {
    return '<span class="cat-card-precios">' +
      '<span class="cat-card-precio-old">' + formatCLP(p.price) + '</span>' +
      '<span class="cat-card-precio cat-card-precio-of">' + formatCLP(of) + '</span>' +
    '</span>';
  }
  return '<span class="cat-card-precio">' + formatCLP(p.price) + '</span>';
}

/* ---------- contacto: Instagram / Facebook / WhatsApp ---------- */
const KV_ICONOS = {
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.43-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07c-1.27.06-2.15.26-2.91.56-.79.31-1.46.72-2.13 1.38C1.35 2.68.94 3.35.63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.66 1.34 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.38.66-.67 1.07-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.38-2.13C21.32 1.35 20.65.94 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm6.41-11.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.67-.51-.17 0-.37-.01-.57-.01-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12 22a10 10 0 0 1-5.1-1.4l-.36-.22-3.79 1 1.01-3.7-.24-.38A9.9 9.9 0 0 1 2 12a10 10 0 1 1 10 10zm0-22C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.98L0 24l6.18-1.62A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0z"/></svg>'
};

function kvContactos(settings) {
  settings = settings || {};
  const ig = (settings.instagram || '').trim();
  const fb = (settings.facebook || '').trim();
  const wa = (settings.whatsapp || '').trim();
  const out = [];
  if (ig) out.push({ tipo: 'instagram', texto: ig, url: 'https://instagram.com/' + ig.replace(/^@/, '').replace(/\s+/g, '') });
  if (fb) {
    let url, texto;
    if (/^https?:\/\//i.test(fb)) { url = fb; texto = fb.replace(/^https?:\/\/(www\.)?(m\.)?facebook\.com\//i, '').replace(/\/$/, '') || 'Facebook'; }
    else { url = 'https://facebook.com/' + fb.replace(/^@/, ''); texto = fb.replace(/^@/, ''); }
    // si el enlace es del tipo profile.php?id=… (feo), muestra una etiqueta limpia
    if (/^profile\.php/i.test(texto) || /facebook/i.test(texto) || texto.length > 24) texto = 'Karivé Joyas';
    out.push({ tipo: 'facebook', texto: texto, url: url });
  }
  if (wa) {
    let url = 'https://wa.me/' + wa.replace(/[^0-9]/g, '');
    const msg = (settings.whatsappMsg || '').trim();
    if (msg) url += '?text=' + encodeURIComponent(msg);
    out.push({ tipo: 'whatsapp', texto: wa, url: url });
  }
  return out;
}

const KV_WHATSAPP_MSG_DEFAULT = '¡Hola Karivé Joyas! ✨ Vi su catálogo y me encantó una pieza, ¿me podrían dar más información? 💛';

/* fondo de una página (color sólido o imagen con transparencia) */
function kvFondo(f) {
  f = f || {};
  let base = '', imgUrl = null, imgOp = 0.35;
  if (f.tipo === 'color' && f.color) base = 'background:' + f.color + ';';
  if (f.tipo === 'imagen' && f.imagen) { imgUrl = f.imagen; imgOp = (f.opacidad != null ? f.opacidad : 35) / 100; }
  return { base: base, imgUrl: imgUrl, imgOp: imgOp };
}
/* fondos sugeridos por defecto (se muestran si el admin no configuró otro) */
const KV_FONDO_PROD_DEFAULT = { tipo: 'imagen', imagen: 'assets/fondo-productos.jpg', opacidad: 55 };
const KV_FONDO_INFO_DEFAULT = { tipo: 'imagen', imagen: 'assets/fondo-info.jpg', opacidad: 85 };

/* fondo de las páginas de productos */
function kvFondoProd(settings) {
  const f = settings && settings.fondoProd;
  return kvFondo(f && f.tipo ? f : KV_FONDO_PROD_DEFAULT);
}
/* fondo de las páginas de texto (información, cómo comprar, despedida) */
function kvFondoInfo(settings) {
  const f = settings && settings.fondoInfo;
  return kvFondo(f && f.tipo ? f : KV_FONDO_INFO_DEFAULT);
}

/* ---------- Kit para Instagram: caption + imagen de post ----------
   Plantilla ÚNICA para la descripción (vista previa y botón Texto).
   Marcadores que puedes usar o borrar:
     {productos} = lista con precio y código (una línea por producto)
     {nombres}   = solo los nombres, separados por comas (sin precios)
     {hashtags}  = los hashtags activos
   También sirven {nombre} {precio} {detalle} {codigo} (del primer producto). */
const KV_IG_CAPTION_DEFAULT =
  '✨ Nuevas joyitas Karivé, hechas a mano ✨\n\n{productos}\n\n🤍 Hechas a mano, con mucho amor\n📩 Pedidos por DM\n🚚 Envíos a todo Chile\n\n{hashtags}';

/* descripción del botón "Texto" de un producto (usa la misma plantilla) */
function kvCaptionIG(p, settings) {
  return kvCaptionMulti([p], settings, kvTagsActivos([p], settings));
}

/* hashtags predefinidos (la dueña activa/desactiva los que quiera) */
const KV_IG_TAGS_BASE = ['#KariveJoyas', '#HechoAManoConAmor', '#ArcillaPolimerica', '#JoyasArtesanales', '#AccesoriosChile', '#ArosArtesanales', '#HechoEnChile', '#Handmade', '#EmprendimientoChileno', '#Miyuki', '#Mostacillas'];

/* convierte un nombre ("Argollas de cristal") en hashtag (#argollasdecristal) */
function kvTagDeNombre(n) {
  n = String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return n ? '#' + n : '';
}

/* hashtags automáticos según las colecciones de los productos seleccionados */
function kvTagsDeProductos(prods, settings) {
  const out = [];
  (prods || []).forEach(p => {
    const t = kvTagDeNombre(kvCat(p.category, settings).nombre);
    if (t && t !== '#otros' && out.indexOf(t) === -1) out.push(t);
  });
  return out;
}

/* hashtags activos = auto (de colección) + predefinidos + propios, menos los apagados */
function kvTagsActivos(prods, settings) {
  settings = settings || {};
  const off = Array.isArray(settings.igTagsOff) ? settings.igTagsOff : [];
  const extras = Array.isArray(settings.igTagsExtra) ? settings.igTagsExtra : [];
  const auto = kvTagsDeProductos(prods, settings);
  const base = KV_IG_TAGS_BASE.concat(extras.filter(t => KV_IG_TAGS_BASE.indexOf(t) === -1));
  const todos = auto.concat(base.filter(b => auto.map(a => a.toLowerCase()).indexOf(b.toLowerCase()) === -1));
  return todos.filter(x => off.indexOf(x) === -1);
}

/* descripción a partir de la plantilla editable (reemplaza los marcadores) */
function kvCaptionMulti(prods, settings, tags) {
  prods = prods || [];
  let t = (settings && settings.igCaption != null) ? settings.igCaption : KV_IG_CAPTION_DEFAULT;
  const linea = p => '💜 ' + (p.name || '') + ' — ' + formatCLP(kvPrecioOferta(p) || p.price) + (p.code ? ' · ' + p.code : '');
  const productos = prods.map(linea).join('\n');
  const nombres = prods.map(p => p.name || '').filter(Boolean).join(', ');
  const p0 = prods[0] || {}, of0 = kvPrecioOferta(p0);
  const tagsTxt = (tags && tags.length) ? tags.join(' ') : '';
  return t
    .replace(/\{productos\}/g, productos)
    .replace(/\{nombres\}/g, nombres)
    .replace(/\{hashtags\}/g, tagsTxt)
    .replace(/\{nombre\}/g, p0.name || '')
    .replace(/\{precio\}/g, of0 ? (formatCLP(of0) + ' (antes ' + formatCLP(p0.price) + ')') : formatCLP(p0.price || 0))
    .replace(/\{detalle\}/g, p0.detail || '')
    .replace(/\{codigo\}/g, p0.code || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ===================== MERCADO LIBRE =====================
   Con qué título, precio, cantidad y descripción se publica un producto en
   Mercado Libre. Todo se arma al vuelo a partir de plantillas editables desde
   el panel: NADA de esto se guarda dentro del producto ni lo modifica. */

/* Mercado Libre corta los títulos en 60 caracteres. */
var KV_ML_TITULO_MAX = 60;

/* Palabras que se agregan al título mientras quepan, en este orden. */
const KV_ML_EXTRAS_DEFAULT = 'Acero Quirúrgico, Mujer, Hechos A Mano, Artesanales';

const KV_ML_DESC_DEFAULT =
  '{nombre} de Karivé Joyas.\n\n' +
  'Aros hechos a mano en Chile, con base de acero quirúrgico.\n' +
  '{medida}\n\n' +
  'Al ser artesanales, cada par puede tener pequeñas diferencias entre uno y otro: ' +
  'eso es parte de que sean hechos a mano y no en serie.\n' +
  'Se envían en su empaque, listos para regalo.\n' +
  'Despacho desde Santiago a todo Chile.';

function kvMlExtras(settings) {
  const t = (settings && settings.mlExtras != null) ? settings.mlExtras : KV_ML_EXTRAS_DEFAULT;
  return String(t).split(',').map(s => s.trim()).filter(Boolean);
}

/* título para Mercado Libre: el nombre del producto (siempre empezando por
   "Aros") más las palabras extra que alcancen a caber en los 60 caracteres.
   Las que no caben se omiten: nunca se corta una palabra por la mitad. */
function kvMlTitulo(p, settings) {
  let t = String((p && p.name) || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (!/^aros\b/i.test(t)) t = 'Aros ' + t;
  kvMlExtras(settings).forEach(ex => {
    if ((t + ' ' + ex).length <= KV_ML_TITULO_MAX) t += ' ' + ex;
  });
  return t.slice(0, KV_ML_TITULO_MAX);
}

/* descripción a partir de la plantilla editable */
function kvMlDescripcion(p, settings) {
  p = p || {};
  const plantilla = (settings && settings.mlDescripcion != null) ? settings.mlDescripcion : KV_ML_DESC_DEFAULT;
  const cruda = String(p.detail || '').replace(/^aprox\.?\s*/i, '').trim();
  return String(plantilla)
    .replace(/\{nombre\}/g, p.name || '')
    .replace(/\{medida\}/g, cruda ? 'Medida aproximada: ' + cruda + '.' : '')
    .replace(/\{detalle\}/g, cruda)
    .replace(/\{codigo\}/g, p.code || '')
    .replace(/\{coleccion\}/g, kvCat(p.category, settings).nombre || '')
    .replace(/\{precio\}/g, formatCLP(kvMlPrecio(p, settings)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* precio con que se publica en Mercado Libre.

   Mercado Libre te descuenta el despacho aunque diga que lo paga quien compra,
   y ese cobro es casi el mismo para un aro de $3.000 que para uno de $15.000.
   Por eso el precio de allá puede ser distinto al de tu catálogo: se le suma un
   recargo y, si queda muy bajo, se sube a un mínimo.

   NADA de esto toca el producto: el precio de tu catálogo queda igual. */
function kvMlPrecio(p, settings) {
  settings = settings || {};
  const normal = Number((p && p.price) || 0);
  const base = settings.mlUsarOferta ? (kvPrecioOferta(p) || normal) : normal;
  if (!base) return 0;

  const fijo = Number(settings.mlRecargoFijo || 0);
  const pct = Number(settings.mlRecargoPct || 0);
  let v = base + fijo + Math.round(base * pct / 100);

  const min = Number(settings.mlPrecioMin || 0);
  if (min && v < min) v = min;

  return kvMlRedondear(v, settings.mlRedondeo);
}

/* deja el precio con una terminación bonita, siempre hacia arriba */
function kvMlRedondear(v, modo) {
  v = Math.max(0, Math.round(Number(v) || 0));
  if (!v) return 0;
  if (modo === '990') {
    let r = Math.floor(v / 1000) * 1000 + 990;
    if (r < v) r += 1000;
    return r;
  }
  if (modo === '500') return Math.ceil(v / 500) * 500;
  if (modo === '100') return Math.ceil(v / 100) * 100;
  return v;
}

/* cuánto te queda después de la comisión y el despacho, con los números que
   Mercado Libre le mostró a Karivé: comisión 20% en Premium y 9,46% en
   Clásica, más ~$869 de envío que te descuentan igual. */
var KV_ML_ENVIO_APROX = 869;
function kvMlRecibes(precio, tipo) {
  precio = Number(precio) || 0;
  if (!precio) return 0;
  const com = tipo === 'gold_pro' ? 0.20 : 0.0946;
  return Math.round(precio - precio * com - KV_ML_ENVIO_APROX);
}

/* cantidad a publicar: la del producto si la tiene, si no la de por defecto */
function kvMlCantidad(p, settings) {
  const c = kvStockCantidad(p);
  if (c !== null) return Math.max(0, c);
  const d = parseInt((settings && settings.mlCantidad) || 1, 10);
  return isNaN(d) || d < 1 ? 1 : d;
}

/* todo lo que se manda al publicador para un producto */
function kvMlItem(p, settings) {
  p = p || {};
  return {
    id: p.id || '',
    codigo: p.code || '',
    titulo: kvMlTitulo(p, settings),
    precio: kvMlPrecio(p, settings),
    cantidad: kvMlCantidad(p, settings),
    descripcion: kvMlDescripcion(p, settings),
    categoria: String((settings && settings.mlCategoria) || '').trim(),
    tipo: String((settings && settings.mlTipo) || 'gold_special'),
    // Mercado Libre exige estos datos según la categoría. "Modelo" es
    // obligatorio en joyas: se usa el código del producto, que es único.
    marca: String((settings && settings.mlMarca) || 'Karivé Joyas'),
    material: String((settings && settings.mlMaterial) || 'Acero quirúrgico'),
    // "Modelo" lo VE quien compra, en las características del aviso: va el
    // nombre del producto, no el código. El código es interno y viaja aparte,
    // en SELLER_SKU.
    modelo: String(p.name || p.code || '').replace(/^aros\s+/i, '').trim(),
    // vacío = no se manda nada y Mercado Libre aplica la configuración de la
    // cuenta, igual que hace su propio publicador masivo
    envio: String((settings && settings.mlEnvio) || ''),
    envioGratis: !!(settings && settings.mlEnvioGratis),
    retiro: !!(settings && settings.mlRetiro),
    // color y largo, sacados del nombre y de la medida. Van desde el primer
    // día para que los avisos nuevos no nazcan con la nota baja y haya que
    // completarlos después.
    color: kvMlColor(p),
    largoCm: kvMlLargoCm(p),
    foto: p.photo || ''
  };
}

/* revisa un producto antes de publicarlo. Devuelve la lista de problemas:
   vacía = se puede publicar. Vale más avisar acá que recibir un error de
   Mercado Libre a mitad de camino. */
function kvMlProblemas(p, settings) {
  const m = [];
  const it = kvMlItem(p, settings);
  if (!it.titulo) m.push('no tiene nombre');
  if (it.titulo.length > KV_ML_TITULO_MAX) m.push('el título pasa los ' + KV_ML_TITULO_MAX + ' caracteres');
  if (!it.precio || it.precio <= 0) m.push('no tiene precio');
  if (!it.foto) m.push('no tiene foto');
  if (it.cantidad < 1) m.push('no hay stock');
  if (!it.categoria) m.push('falta elegir la categoría de Mercado Libre');
  // Mercado Libre rechaza el envío gratis cuando el despacho cuesta más que
  // el producto: responde "Free shipping costs exceeds sale".
  if (it.envioGratis && it.precio > 0 && it.precio < 10000) m.push('con envío gratis y precio bajo Mercado Libre lo rechaza');
  return m;
}

/* publicaciones ya hechas: { CODIGO: {itemId, permalink, fecha} }.
   Vive en su propio documento (catalog/mercadolibre), NO dentro de los
   productos, para no tocarlos nunca. */
function kvMlPublicados(ml) {
  return (ml && ml.items) || {};
}

/* ===== CARACTERÍSTICAS PARA MERCADO LIBRE =====
   Mercado Libre le sube la nota al aviso cuando están completas, y las
   compradoras filtran por ellas. Se sacan de lo que ya tienes escrito:
   el color del nombre del producto y la medida del detalle.
   Si no se reconocen con seguridad, se dejan vacías: es mejor no poner nada
   que poner algo equivocado. */

/* colores que aparecen en los nombres de Karivé. La clave es lo que se busca
   en el nombre; el valor es cómo se llama el color en Mercado Libre. */
var KV_COLORES = {
  'rojo': 'Rojo', 'roja': 'Rojo', 'rojas': 'Rojo', 'rojos': 'Rojo',
  'azul': 'Azul', 'azules': 'Azul',
  'blanco': 'Blanco', 'blanca': 'Blanco', 'blancas': 'Blanco', 'blancos': 'Blanco',
  'negro': 'Negro', 'negra': 'Negro', 'negras': 'Negro', 'negros': 'Negro',
  'dorado': 'Dorado', 'dorada': 'Dorado', 'doradas': 'Dorado', 'dorados': 'Dorado',
  'plateado': 'Plateado', 'plateada': 'Plateado', 'plateadas': 'Plateado', 'plateados': 'Plateado',
  'morado': 'Morado', 'morada': 'Morado', 'moradas': 'Morado',
  'celeste': 'Celeste', 'celestes': 'Celeste',
  'verde': 'Verde', 'verdes': 'Verde',
  'amarillo': 'Amarillo', 'amarilla': 'Amarillo',
  'naranjo': 'Naranjo', 'naranja': 'Naranjo',
  'rosa': 'Rosa', 'rosado': 'Rosa', 'rosada': 'Rosa', 'rosas': 'Rosa',
  'turquesa': 'Turquesa', 'mostaza': 'Mostaza', 'cobre': 'Cobre', 'beige': 'Beige',
  'marino': 'Azul', 'petroleo': 'Azul', 'lila': 'Lila', 'violeta': 'Violeta',
  'fucsia': 'Fucsia', 'gris': 'Gris', 'cafe': 'Café', 'burdeo': 'Burdeo',
  'coral': 'Coral', 'arena': 'Beige', 'perla': 'Blanco',
  'transparente': 'Transparente', 'multicolor': 'Multicolor',
  'tricolor': 'Multicolor', 'glitter': 'Multicolor'
};

function kvSinTildes(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* color del producto, sacado de su nombre. '' si no se reconoce ninguno. */
function kvMlColor(p) {
  const n = kvSinTildes(p && p.name);
  if (!n) return '';
  // gana la palabra que aparece más tarde: en "Flor Blanca Dorado" el color
  // del aro es el último, el primero suele describir la flor
  let mejor = '', pos = -1;
  Object.keys(KV_COLORES).forEach(k => {
    const m = n.match(new RegExp('\\b' + k + '\\b'));
    if (m && m.index > pos) { pos = m.index; mejor = KV_COLORES[k]; }
  });
  return mejor;
}

/* medida en centímetros, sacada del detalle ("Aprox. 3.5cm" -> 3.5) */
function kvMlMedidaCm(p) {
  const m = String((p && p.detail) || '').match(/([\d]+[.,]?[\d]*)\s*cm/i);
  if (!m) return 0;
  const v = parseFloat(String(m[1]).replace(',', '.'));
  return (isNaN(v) || v <= 0 || v > 30) ? 0 : v;
}

/* Si el detalle dice "de diámetro", esa medida es el DIÁMETRO y no el largo:
   son dos características distintas en Mercado Libre y ponerlas al revés
   confunde a quien compra. */
function kvMlEsDiametro(p) { return /di[áa]metro/i.test(String((p && p.detail) || '')); }
function kvMlLargoCm(p)    { return kvMlEsDiametro(p) ? 0 : kvMlMedidaCm(p); }
function kvMlDiametroCm(p) { return kvMlEsDiametro(p) ? kvMlMedidaCm(p) : 0; }

/* Qué tipo de aro es, según la colección. Lo que no se sabe se deja vacío. */
var KV_TIPO_ARO = {
  argollas: 'Argolla',
  topos: 'Topo',
  charms: 'Colgante',
  flores: 'Colgante',
  marina: 'Colgante'
};
function kvMlTipoAro(p) { return KV_TIPO_ARO[String((p && p.category) || '').toLowerCase()] || ''; }

/* todo lo que se puede completar solo de un producto */
function kvMlCaracteristicas(p, settings) {
  settings = settings || {};
  const out = {};
  const c = kvMlColor(p);
  if (c) out.color = c;
  const l = kvMlLargoCm(p);
  if (l) out.largoCm = l;
  const d = kvMlDiametroCm(p);
  if (d) out.diametroCm = d;
  const t = kvMlTipoAro(p);
  if (t) out.tipoAro = t;
  const mat = String(settings.mlMaterial || 'Acero quirúrgico').trim();
  if (mat) out.material = mat;
  // se venden por par: son dos aros en cada publicación
  out.formatoVenta = 'Par';
  out.cantidadAros = 2;
  // esto lo decide la dueña una vez y vale para todo el catálogo
  if (settings.mlHipoalergenico) out.hipoalergenico = 'Sí';
  if (settings.mlConCierre) out.tipoCierre = String(settings.mlConCierre);
  return out;
}

/* color de fondo de una foto: promedio de sus bordes (para rellenar sin cortar el producto) */
function kvColorFondo(img) {
  try {
    const n = 12, c = document.createElement('canvas'); c.width = n; c.height = n;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, n, n);
    const d = g.getImageData(0, 0, n, n).data;
    let r = 0, gr = 0, b = 0, k = 0;
    for (let i = 0; i < n; i++) {
      [[i, 0], [i, n - 1], [0, i], [n - 1, i]].forEach(pt => {
        const o = (pt[1] * n + pt[0]) * 4; r += d[o]; gr += d[o + 1]; b += d[o + 2]; k++;
      });
    }
    return 'rgb(' + Math.round(r / k) + ',' + Math.round(gr / k) + ',' + Math.round(b / k) + ')';
  } catch (e) { return '#F0EAE0'; }
}

function kvCargarImagen(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

/* parte el texto en como máximo `maxLineas` líneas que quepan en `maxW` */
function kvWrap(ctx, text, maxW, maxLineas) {
  const palabras = String(text || '').split(/\s+/).filter(Boolean);
  const lineas = []; let cur = '';
  palabras.forEach(w => {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lineas.push(cur); cur = w; } else cur = t;
  });
  if (cur) lineas.push(cur);
  if (lineas.length > maxLineas) { lineas.length = maxLineas; lineas[maxLineas - 1] = lineas[maxLineas - 1].replace(/\s*\S*$/, '') + '…'; }
  return lineas;
}

/* genera una imagen cuadrada 1080x1080 lista para Instagram (Promise<dataURL jpeg>):
   la foto completa con el encuadre del producto + el logo solo (sin círculo), sin textos */
function kvGenerarPostIG(p, settings, focoOverride) {
  const theme = Object.assign({}, KV_THEME_DEFAULT, (settings && settings.theme) || {});
  const S = 1080;
  const listo = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  return listo
    .then(() => Promise.all([kvCargarImagen(p.photo), kvCargarImagen('assets/logo-karive-crop.png')]))
    .then(([foto, logo]) => {
      const c = document.createElement('canvas'); c.width = S; c.height = S;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';   // sin esto el navegador escala en calidad baja (foto y logo pixelados)
      // ---- foto COMPLETA (contain) sin barras planas: el fondo se rellena con la misma foto difuminada ----
      if (foto) {
        g.fillStyle = kvColorFondo(foto); g.fillRect(0, 0, S, S);   // base por si el navegador no soporta desenfoque
        // 1) fondo: la misma foto ampliada (cover) y difuminada. Se dibuja un poco más grande
        //    que el lienzo para que el desenfoque no deje un borde oscuro en los bordes.
        const cov = Math.max(S / foto.width, S / foto.height) * 1.22;
        const cw = foto.width * cov, ch = foto.height * cov;
        g.save();
        g.filter = 'blur(34px) brightness(1.03)';
        g.drawImage(foto, (S - cw) / 2, (S - ch) / 2, cw, ch);
        g.restore();
        // 2) foto nítida y completa encima (con el encuadre elegido en la vista previa)
        const f = focoOverride || kvFocoIG(p), zoom = f.zoom / 100;
        const scale = Math.min(S / foto.width, S / foto.height) * zoom;  // contain * zoom
        const dw = foto.width * scale, dh = foto.height * scale;
        const dx = (S - dw) * (f.x / 100), dy = (S - dh) * (f.y / 100);
        g.drawImage(foto, dx, dy, dw, dh);
      } else { g.fillStyle = '#EFEAF5'; g.fillRect(0, 0, S, S); }
      // ---- logo solo, sin círculo (arriba izquierda), con sombra suave para que se lea ----
      if (logo) {
        const lw = 210, lh = lw * (logo.height / logo.width);
        g.save();
        g.shadowColor = 'rgba(255,255,255,0.85)'; g.shadowBlur = 26;
        g.drawImage(logo, 44, 40, lw, lh);
        g.shadowColor = 'rgba(0,0,0,0.18)'; g.shadowBlur = 10;
        g.drawImage(logo, 44, 40, lw, lh);
        g.restore();
      }
      // (sin etiqueta "OFERTA": las imágenes que se publican salen limpias)
      return c.toDataURL('image/jpeg', 0.95);
    });
}

/* fila de contactos con ícono + enlace. `tipos` opcional filtra cuáles mostrar. */
function kvContactoRow(settings, tipos) {
  let cs = kvContactos(settings);
  if (tipos) cs = cs.filter(c => tipos.indexOf(c.tipo) !== -1);
  if (!cs.length) return '';
  return '<div class="fb-contactos">' + cs.map(c =>
    '<a class="fb-contacto fb-contacto-' + c.tipo + '" href="' + c.url + '" target="_blank" rel="noopener">' +
      '<span class="fb-contacto-ico">' + KV_ICONOS[c.tipo] + '</span>' +
      '<span class="fb-contacto-txt">' + escapeHtml(c.texto) + '</span>' +
    '</a>'
  ).join('') + '</div>';
}

/* tarjeta pública (estilo Amore: foto + barra de etiqueta), clickeable para ampliar */
var _kvSettings = null;
function kvSetSettings(s) { _kvSettings = s; }
function kvCardHtml(p) {
  const rp = _kvSettings ? kvResenaPromedio(_kvSettings, p.id) : null;
  const estrellas = rp ? '<div class="cat-card-estrellas">' + kvEstrellas(rp.prom, 'kv-estrellas chico') + '<span>(' + rp.n + ')</span></div>' : '';
  const oferta = kvPrecioOferta(p) ? '<span class="cat-card-oferta">Oferta</span>' : '';
  const pocas = kvStockBajo(p)
    ? '<span class="cat-card-pocas">¡Última' + (kvStockCantidad(p) === 1 ? '!' : 's ' + kvStockCantidad(p) + '!') + '</span>' : '';
  return (
    '<div class="cat-card cat-card-click" data-id="' + p.id + '" role="button" tabindex="0" aria-label="Ver ' + escapeHtml(p.name) + '">' +
      '<div class="cat-card-foto' + (!p.photo ? ' sin-foto' : '') + '">' +
        kvFotoInner(p) +
        (!p.photo ? '<span class="cat-card-sinfoto">✦</span>' : '') +
        oferta + pocas +
        '<span class="cat-card-zoom" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><line x1="16" y1="16" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="11" y1="8" x2="11" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>' +
      '</div>' +
      '<div class="cat-card-etiqueta">' +
        '<div class="cat-card-nombre"><span>' + escapeHtml(p.name) + '</span></div>' +
        estrellas +
        '<div class="cat-card-pie"><span class="cat-card-codigo">' + escapeHtml(p.code) + '</span>' + kvPrecioHtml(p) + '</div>' +
        '<div class="cat-card-botones">' +
          '<button type="button" class="cat-card-verbtn" data-role="cart-ver" data-id="' + p.id + '">👁 Ver</button>' +
          '<button type="button" class="cat-card-addbtn" data-role="cart-add" data-id="' + p.id + '">🛒 Agregar</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

/* tarjeta de edición (panel admin) */
/* Dirección pública de la ficha de un producto. Es la que conviene compartir por
   WhatsApp o Instagram: muestra la foto y el precio en la vista previa, cosa que
   el enlace del catálogo completo no hace. */
var KV_SITIO = 'https://karivejoyas.github.io/catalogo/';
function kvEnlaceProducto(code) {
  const c = String(code || '').trim();
  return c ? KV_SITIO + 'p/' + c + '.html' : '';
}

function kvCardEditHtml(p, cats, modo) {
  cats = cats || KV_CATEGORIAS;
  modo = modo === 'movil' ? 'movil' : 'pc';
  const opciones = cats.map(c =>
    '<option value="' + c.id + '"' + (p.category === c.id ? ' selected' : '') + '>' + escapeHtml(c.nombre) + '</option>').join('');
  const f = modo === 'movil' ? kvFocoMovil(p) : kvFoco(p);
  const enStock = kvEnStock(p);
  const of = p.priceOffer != null && Number(p.priceOffer) > 0 ? p.priceOffer : '';
  return (
    '<div class="cat-card cat-card-edit' + (enStock ? '' : ' sin-stock') + '" data-id="' + p.id + '">' +
      '<div class="cat-card-foto' + (!p.photo ? ' sin-foto' : '') + (modo === 'movil' ? ' ed-foto-movil' : '') + '">' +
        kvFotoInner(p, modo) +
        (!p.photo ? '<span class="cat-card-sinfoto">✦</span>' : '') +
        (enStock ? '' : '<span class="ed-badge-sin">Sin stock</span>') +
        '<div class="ed-orden">' +
          '<button type="button" class="ed-mini-btn" data-role="mover" data-dir="prev" data-id="' + p.id + '" title="Mover antes" aria-label="Mover antes">‹</button>' +
          '<button type="button" class="ed-mini-btn" data-role="mover" data-dir="next" data-id="' + p.id + '" title="Mover después" aria-label="Mover después">›</button>' +
        '</div>' +
        '<div class="ed-foto-botones">' +
          '<label class="ed-btn-foto">' + (p.photo ? 'Cambiar foto' : 'Agregar foto') +
            '<input type="file" accept="image/*" data-role="upload" data-id="' + p.id + '" style="display:none;" />' +
          '</label>' +
          (p.photo ? '<button type="button" class="ed-btn-foto-ghost" data-role="remove-photo" data-id="' + p.id + '">Quitar</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ed-cuerpo">' +
        '<details class="ed-encuadre"' + (modo === 'movil' ? ' open' : '') + '>' +
          '<summary class="ed-encuadre-tit">🎯 Ajustar encuadre de la foto</summary>' +
          '<div class="ed-encuadre-body">' +
            '<div class="ed-foco-tabs">' +
              '<button type="button" class="ed-foco-tab' + (modo === 'pc' ? ' is-active' : '') + '" data-role="foco-modo" data-modo="pc" data-id="' + p.id + '">💻 PC</button>' +
              '<button type="button" class="ed-foco-tab' + (modo === 'movil' ? ' is-active' : '') + '" data-role="foco-modo" data-modo="movil" data-id="' + p.id + '">📱 Celular' +
                (kvTieneFocoMovil(p) ? ' <span class="ed-foco-punto" title="Tiene su propio encuadre">●</span>' : '') + '</button>' +
            '</div>' +
            '<p class="ed-foco-ayuda">' + (modo === 'movil'
              ? 'Encuadre para el marco alto del celular. Ajusta para que la joya no quede cortada.'
              : 'Encuadre para el marco ancho del computador.') + '</p>' +
            '<label class="ed-slider"><span>Zoom</span><input type="range" min="100" max="250" step="1" data-role="foco-zoom" data-id="' + p.id + '" value="' + f.zoom + '" /></label>' +
            '<label class="ed-slider"><span>Horizontal</span><input type="range" min="0" max="100" step="1" data-role="foco-x" data-id="' + p.id + '" value="' + f.x + '" /></label>' +
            '<label class="ed-slider"><span>Vertical</span><input type="range" min="0" max="100" step="1" data-role="foco-y" data-id="' + p.id + '" value="' + f.y + '" /></label>' +
            (modo === 'movil' && kvTieneFocoMovil(p)
              ? '<button type="button" class="ed-foco-reset" data-role="foco-igualar" data-id="' + p.id + '">↩ Copiar el encuadre del PC</button>' : '') +
          '</div>' +
        '</details>' +
        '<div class="ed-fila">' +
          '<input class="ed-input ed-codigo" data-role="code" data-id="' + p.id + '" value="' + escapeHtml(p.code) + '" placeholder="Código" />' +
          (p.code ? '<button type="button" class="ed-btn-enlace" data-role="copiar-enlace" data-code="' + escapeHtml(p.code) + '" title="Copiar el enlace de este producto para compartirlo">🔗 Enlace</button>' : '') +
          '<button type="button" class="ed-btn-eliminar" data-role="delete" data-id="' + p.id + '">Eliminar</button>' +
        '</div>' +
        '<input class="ed-input ed-nombre" data-role="name" data-id="' + p.id + '" value="' + escapeHtml(p.name) + '" placeholder="Nombre" />' +
        '<input class="ed-input ed-detalle" data-role="detail" data-id="' + p.id + '" value="' + escapeHtml(p.detail || '') + '" placeholder="Detalle (ej: 5cm de diámetro)" />' +
        '<div class="ed-precios">' +
          '<label class="ed-precio-campo"><span class="ed-precio-lbl">Precio</span>' +
            '<span class="ed-precio-box"><span class="ed-peso">$</span>' +
            '<input class="ed-input ed-precio" data-role="price" data-id="' + p.id + '" value="' + p.price + '" inputmode="numeric" /></span>' +
          '</label>' +
          '<label class="ed-precio-campo"><span class="ed-precio-lbl">Oferta <span class="ed-opc">(opcional)</span></span>' +
            '<span class="ed-precio-box"><span class="ed-peso">$</span>' +
            '<input class="ed-input ed-precio ed-precio-of" data-role="priceOffer" data-id="' + p.id + '" value="' + of + '" inputmode="numeric" placeholder="—" /></span>' +
          '</label>' +
        '</div>' +
        '<div class="ed-coleccion">' +
          '<label class="ed-coleccion-label">📁 Colección:</label>' +
          '<select class="ed-input ed-categoria" data-role="category" data-id="' + p.id + '">' + opciones + '</select>' +
        '</div>' +
        '<label class="ed-cant">' +
          '<span class="ed-cant-lbl">📦 Cantidad</span>' +
          '<input class="ed-input ed-cant-input" data-role="cantidad" data-id="' + p.id + '" inputmode="numeric" placeholder="sin control" value="' + (kvStockCantidad(p) == null ? '' : kvStockCantidad(p)) + '" />' +
          '<span class="ed-cant-ayuda">' + (kvStockCantidad(p) == null
            ? 'Vacío = sin control de cantidad'
            : (kvStockCantidad(p) === 0 ? 'Agotado: se oculta solo' : 'Al llegar a 0 se oculta solo')) + '</span>' +
        '</label>' +
        '<label class="ed-stock' + (enStock ? '' : ' is-off') + '">' +
          '<input type="checkbox" data-role="stock" data-id="' + p.id + '"' + (enStock ? ' checked' : '') + ' />' +
          '<span class="ed-stock-sw"></span>' +
          '<span class="ed-stock-txt">' + (enStock ? 'En stock (visible)' : 'Sin stock (oculto)') + '</span>' +
        '</label>' +
        '<div class="ed-guardar">' +
          '<span class="ed-pend">● cambios sin guardar</span>' +
          '<button type="button" class="ed-btn-guardar" data-role="save" data-id="' + p.id + '">💾 Guardar</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

/* ============================================================
   PEDIDOS (carrito de compras)
   ============================================================ */
var KV_REGIONES = [
  'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo',
  'Valparaíso', 'Metropolitana de Santiago', "O'Higgins", 'Maule', 'Ñuble',
  'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes'
];
var KV_REGION_RM = 'Metropolitana de Santiago';

/* Las 346 comunas de Chile agrupadas por region. Salen de un listado publico
   con los codigos oficiales del INE, cotejado con una segunda fuente
   independiente: las dos coinciden en el total y en el reparto por region.
   Sirven para que la clienta elija su comuna de una lista en vez de
   escribirla a mano, asi no llegan direcciones mal escritas. */
var KV_COMUNAS = {
  "Arica y Parinacota": ["Arica", "Camarones", "General Lagos", "Putre"],
  "Tarapacá": ["Alto Hospicio", "Camiña", "Colchane", "Huara", "Iquique", "Pica", "Pozo Almonte"],
  "Antofagasta": ["Antofagasta", "Calama", "María Elena", "Mejillones", "Ollagüe", "San Pedro de Atacama", "Sierra Gorda", "Taltal", "Tocopilla"],
  "Atacama": ["Alto del Carmen", "Caldera", "Chañaral", "Copiapó", "Diego de Almagro", "Freirina", "Huasco", "Tierra Amarilla", "Vallenar"],
  "Coquimbo": ["Andacollo", "Canela", "Combarbalá", "Coquimbo", "Illapel", "La Higuera", "La Serena", "Los Vilos", "Monte Patria", "Ovalle", "Paihuano", "Punitaqui", "Río Hurtado", "Salamanca", "Vicuña"],
  "Valparaíso": ["Algarrobo", "Cabildo", "Calle Larga", "Cartagena", "Casablanca", "Catemu", "Concón", "El Quisco", "El Tabo", "Hijuelas", "Isla de Pascua", "Juan Fernández", "La Calera", "La Cruz", "La Ligua", "Limache", "Llaillay", "Los Andes", "Nogales", "Olmué", "Panquehue", "Papudo", "Petorca", "Puchuncaví", "Putaendo", "Quillota", "Quilpué", "Quintero", "Rinconada", "San Antonio", "San Esteban", "San Felipe", "Santa María", "Santo Domingo", "Valparaíso", "Villa Alemana", "Viña del Mar", "Zapallar"],
  "Metropolitana de Santiago": ["Alhué", "Buin", "Calera de Tango", "Cerrillos", "Cerro Navia", "Colina", "Conchalí", "Curacaví", "El Bosque", "El Monte", "Estación Central", "Huechuraba", "Independencia", "Isla de Maipo", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Lampa", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "María Pinto", "Melipilla", "Padre Hurtado", "Paine", "Pedro Aguirre Cerda", "Peñaflor", "Peñalolén", "Pirque", "Providencia", "Pudahuel", "Puente Alto", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Bernardo", "San Joaquín", "San José de Maipo", "San Miguel", "San Pedro", "San Ramón", "Santiago", "Talagante", "Tiltil", "Vitacura", "Ñuñoa"],
  "O'Higgins": ["Chimbarongo", "Chépica", "Codegua", "Coinco", "Coltauco", "Doñihue", "Graneros", "La Estrella", "Las Cabras", "Litueche", "Lolol", "Machalí", "Malloa", "Marchihue", "Mostazal", "Nancagua", "Navidad", "Olivar", "Palmilla", "Paredones", "Peralillo", "Peumo", "Pichidegua", "Pichilemu", "Placilla", "Pumanque", "Quinta de Tilcoco", "Rancagua", "Rengo", "Requínoa", "San Fernando", "San Vicente", "Santa Cruz"],
  "Maule": ["Cauquenes", "Chanco", "Colbún", "Constitución", "Curepto", "Curicó", "Empedrado", "Hualañé", "Licantén", "Linares", "Longaví", "Maule", "Molina", "Parral", "Pelarco", "Pelluhue", "Pencahue", "Rauco", "Retiro", "Romeral", "Río Claro", "Sagrada Familia", "San Clemente", "San Javier", "San Rafael", "Talca", "Teno", "Vichuquén", "Villa Alegre", "Yerbas Buenas"],
  "Ñuble": ["Bulnes", "Chillán", "Chillán Viejo", "Cobquecura", "Coelemu", "Coihueco", "El Carmen", "Ninhue", "Pemuco", "Pinto", "Portezuelo", "Quillón", "Quirihue", "Ránquil", "San Carlos", "San Fabián", "San Ignacio", "San Nicolás", "Trehuaco", "Yungay", "Ñiquén"],
  "Biobío": ["Alto Biobío", "Antuco", "Arauco", "Cabrero", "Cañete", "Chiguayante", "Concepción", "Contulmo", "Coronel", "Curanilahue", "Florida", "Hualpén", "Hualqui", "Laja", "Lebu", "Los Álamos", "Los Ángeles", "Lota", "Mulchén", "Nacimiento", "Negrete", "Penco", "Quilaco", "Quilleco", "San Pedro de la Paz", "San Rosendo", "Santa Bárbara", "Santa Juana", "Talcahuano", "Tirúa", "Tomé", "Tucapel", "Yumbel"],
  "La Araucanía": ["Angol", "Carahue", "Cholchol", "Collipulli", "Cunco", "Curacautín", "Curarrehue", "Ercilla", "Freire", "Galvarino", "Gorbea", "Lautaro", "Loncoche", "Lonquimay", "Los Sauces", "Lumaco", "Melipeuco", "Nueva Imperial", "Padre Las Casas", "Perquenco", "Pitrufquén", "Pucón", "Purén", "Renaico", "Saavedra", "Temuco", "Teodoro Schmidt", "Toltén", "Traiguén", "Victoria", "Vilcún", "Villarrica"],
  "Los Ríos": ["Corral", "Futrono", "La Unión", "Lago Ranco", "Lanco", "Los Lagos", "Mariquina", "Máfil", "Paillaco", "Panguipulli", "Río Bueno", "Valdivia"],
  "Los Lagos": ["Ancud", "Calbuco", "Castro", "Chaitén", "Chonchi", "Cochamó", "Curaco de Vélez", "Dalcahue", "Fresia", "Frutillar", "Futaleufú", "Hualaihué", "Llanquihue", "Los Muermos", "Maullín", "Osorno", "Palena", "Puerto Montt", "Puerto Octay", "Puerto Varas", "Puqueldón", "Purranque", "Puyehue", "Queilén", "Quellón", "Quemchi", "Quinchao", "Río Negro", "San Juan de la Costa", "San Pablo"],
  "Aysén": ["Aysén", "Chile Chico", "Cisnes", "Cochrane", "Coyhaique", "Guaitecas", "Lago Verde", "O'Higgins", "Río Ibáñez", "Tortel"],
  "Magallanes": ["Antártica", "Cabo de Hornos", "Laguna Blanca", "Natales", "Porvenir", "Primavera", "Punta Arenas", "Río Verde", "San Gregorio", "Timaukel", "Torres del Paine"]
};
function kvComunasDe(region) { return (region && KV_COMUNAS[region]) || []; }
function kvEnvioCosto(region) { return region === KV_REGION_RM ? 2990 : 3990; }

/* Un correo mal escrito es una venta que se pierde en silencio: la clienta no
   recibe nada y despues el panel no puede avisarle el envio. Estas son las
   equivocaciones tipicas al teclear ('.con' por '.com', 'gmial' por 'gmail').
   No se rechaza el correo: se sugiere el arreglo y ella decide. */
var KV_TLD_MALOS = { 'con':'com', 'cmo':'com', 'ocm':'com', 'xom':'com', 'vom':'com', 'clm':'com', 'coom':'com', 'comm':'com', 'cpm':'com' };
var KV_DOMINIOS_MALOS = {
  'gmial.com':'gmail.com', 'gmai.com':'gmail.com', 'gamil.com':'gmail.com', 'gmaill.com':'gmail.com', 'gmail.cl':'gmail.com',
  'hotmial.com':'hotmail.com', 'hotmai.com':'hotmail.com', 'hotmail.cl':'hotmail.com', 'hotmial.cl':'hotmail.com',
  'outlok.com':'outlook.com', 'outllok.com':'outlook.com', 'yahho.com':'yahoo.com', 'yaho.com':'yahoo.com'
};
/* Devuelve el correo corregido si parece un error de tipeo, o "" si se ve bien. */
function kvCorreoOjo(correo) {
  const c = String(correo || '').trim().toLowerCase();
  const arroba = c.lastIndexOf('@');
  if (arroba < 1) return '';
  const dom = c.slice(arroba + 1);
  if (KV_DOMINIOS_MALOS[dom]) return c.slice(0, arroba + 1) + KV_DOMINIOS_MALOS[dom];
  const punto = dom.lastIndexOf('.');
  if (punto < 1) return '';
  const tld = dom.slice(punto + 1);
  if (KV_TLD_MALOS[tld]) return c.slice(0, arroba + 1) + dom.slice(0, punto + 1) + KV_TLD_MALOS[tld];
  return '';
}

var KV_PEDIDO_ESTADOS = [
  { id: 'nuevo',      nombre: 'Nuevo',            emoji: '🆕' },
  { id: 'verificado', nombre: 'Pago verificado',  emoji: '✅' },
  { id: 'preparando', nombre: 'Preparando',       emoji: '📦' },
  { id: 'enviado',    nombre: 'Enviado',          emoji: '🚚' }
];
function kvPedidoEstado(id) {
  return KV_PEDIDO_ESTADOS.find(e => e.id === id) || KV_PEDIDO_ESTADOS[0];
}

/* datos de transferencia configurados en el admin (con textos de ejemplo si faltan) */
function kvTransferencia(settings) {
  const t = (settings && settings.pedidos && settings.pedidos.transferencia) || {};
  return {
    titular: t.titular || '',
    rut: t.rut || '',
    banco: t.banco || '',
    tipo: t.tipo || '',
    numero: t.numero || '',
    correo: t.correo || ''
  };
}
function kvTransferenciaLista(settings) {
  const t = kvTransferencia(settings);
  return !!(t.titular && t.banco && t.numero);
}

/* ============================================================
   RESEÑAS
   Las reseñas nuevas llegan a una colección privada y TÚ las apruebas
   en el panel. Las aprobadas se copian a la configuración (que es
   pública) para que el catálogo pueda mostrarlas sin dar acceso a las
   que están pendientes.
   ============================================================ */
function kvResenas(settings, productoId) {
  const r = (settings && settings.resenas) || [];
  if (!Array.isArray(r)) return [];
  return productoId ? r.filter(x => x.producto === productoId) : r;
}
function kvResenaPromedio(settings, productoId) {
  const rs = kvResenas(settings, productoId);
  if (!rs.length) return null;
  const suma = rs.reduce((a, b) => a + (Number(b.estrellas) || 0), 0);
  return { prom: Math.round((suma / rs.length) * 10) / 10, n: rs.length };
}
/* dibuja 5 estrellas: llenas, media y vacías */
function kvEstrellas(valor, clase) {
  let h = '<span class="' + (clase || 'kv-estrellas') + '" aria-label="' + valor + ' de 5">';
  for (let i = 1; i <= 5; i++) {
    h += '<span class="' + (valor >= i - 0.25 ? 'llena' : (valor >= i - 0.75 ? 'media' : '')) + '">★</span>';
  }
  return h + '</span>';
}

/* ============================================================
   MEDIOS DE PAGO
   El token secreto de Mercado Pago NO vive acá: está solo en el
   Apps Script (que es privado). Acá solo se sabe si está activo.
   ============================================================ */
function kvMercadoPago(settings) {
  const m = (settings && settings.pagos && settings.pagos.mercadopago) || {};
  return { activo: !!m.activo, prueba: !!m.prueba };
}

/* ============================================================
   LO MÁS VISTO
   La lista la calcula el panel de admin (que sí puede leer las visitas)
   y la guarda en la configuración, que es pública. Acá solo se lee.
   ============================================================ */
function kvMasVistosIds(settings) {
  const m = settings && settings.masVistos;
  return (m && Array.isArray(m.ids)) ? m.ids : [];
}
function kvMasVistosActivo(settings) {
  return !!(settings && settings.masVistos && settings.masVistos.activo);
}
/* devuelve los productos (en orden de más visto) que siguen existiendo y con stock */
function kvMasVistos(settings, productos) {
  if (!kvMasVistosActivo(settings)) return [];
  return kvMasVistosIds(settings)
    .map(id => productos.find(p => p.id === id))
    .filter(p => p && kvEnStock(p));
}

/* ============================================================
   CUPONES DE DESCUENTO
   ============================================================ */
function kvCupones(settings) {
  const c = settings && settings.cupones;
  return Array.isArray(c) ? c : [];
}
function kvCuponNormalizar(codigo) {
  return String(codigo || '').trim().toUpperCase().replace(/\s+/g, '');
}
/* configuración del "regalo de bienvenida" por dejar el correo */
function kvBienvenida(settings) {
  const b = (settings && settings.bienvenida) || {};
  return {
    activo: !!b.activo,
    pct: b.pct != null ? Number(b.pct) : 10,
    codigo: kvCuponNormalizar(b.codigo || 'BIENVENIDA10'),
    titulo: b.titulo || '¿Primera vez por acá? 💜',
    texto: b.texto || 'Déjanos tu correo y te regalamos un {PCT}% de descuento en tu primera compra.'
  };
}

/* Revisa un cupón contra el subtotal. Devuelve {ok, error, cupon, descuento}.
   `hoy` se puede pasar para poder probarlo con otra fecha. */
function kvCuponValidar(codigo, settings, subtotal, hoy) {
  const cod = kvCuponNormalizar(codigo);
  if (!cod) return { ok: false, error: 'Escribe un código.' };
  const c = kvCupones(settings).find(x => kvCuponNormalizar(x.codigo) === cod);
  if (!c) return { ok: false, error: 'Ese código no existe. Revísalo e intenta de nuevo.' };
  if (c.activo === false) return { ok: false, error: 'Ese cupón ya no está disponible.' };
  if (c.hasta) {
    const fin = new Date(c.hasta + 'T23:59:59');
    const ahora = hoy ? new Date(hoy) : new Date();
    if (!isNaN(fin.getTime()) && ahora > fin) return { ok: false, error: 'Ese cupón venció el ' + c.hasta + '.' };
  }
  const min = Number(c.minimo || 0);
  if (min > 0 && subtotal < min) {
    return { ok: false, error: 'Este cupón es para compras sobre ' + formatCLP(min) + '.' };
  }
  const descuento = kvCuponDescuento(c, subtotal);
  if (descuento <= 0) return { ok: false, error: 'Ese cupón no aplica a tu carrito.' };
  return { ok: true, cupon: c, descuento: descuento };
}
function kvCuponDescuento(c, subtotal) {
  if (!c) return 0;
  const val = Number(c.valor || 0);
  if (val <= 0) return 0;
  const d = c.tipo === 'monto' ? val : Math.round(subtotal * val / 100);
  return Math.max(0, Math.min(d, subtotal));   // nunca más que el subtotal
}
function kvCuponTexto(c) {
  if (!c) return '';
  return c.tipo === 'monto' ? formatCLP(Number(c.valor || 0)) + ' de descuento' : Number(c.valor || 0) + '% de descuento';
}

/* ---------- visitas (analítica anónima: sin IP exacta ni datos personales) ---------- */
function kvVisitaDispositivo() {
  const ua = navigator.userAgent || '';
  const plat = navigator.platform || '';
  const esIOS = /iPhone|iPad|iPod/.test(ua) || (plat === 'MacIntel' && navigator.maxTouchPoints > 1);
  const esTablet = /iPad/.test(ua) || (plat === 'MacIntel' && navigator.maxTouchPoints > 1) || (/Android/.test(ua) && !/Mobile/.test(ua));
  const esMovil = !esTablet && (/Mobi|Android|iPhone/.test(ua) || esIOS);
  const dispositivo = esTablet ? 'Tablet' : (esMovil ? 'Móvil' : 'Escritorio');
  let so = 'Otro';
  if (esIOS) so = 'iOS';
  else if (/Android/.test(ua)) so = 'Android';
  else if (/Win/.test(plat)) so = 'Windows';
  else if (/Mac/.test(plat)) so = 'Mac';
  else if (/Linux/.test(plat)) so = 'Linux';
  let navegador = 'Otro';
  if (/Edg\//.test(ua)) navegador = 'Edge';
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) navegador = 'Opera';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) navegador = 'Chrome';
  else if (/Firefox\//.test(ua)) navegador = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) navegador = 'Safari';
  return { dispositivo: dispositivo, so: so, navegador: navegador };
}
function kvVisitaOrigen(ref) {
  if (!ref) return { tipo: 'Directo', host: '' };
  let host = '';
  try { host = new URL(ref).hostname.replace(/^www\./, ''); } catch (e) { return { tipo: 'Otro', host: '' }; }
  if (/instagram\.com/.test(host)) return { tipo: 'Instagram', host: host };
  if (/facebook\.com|fb\.com/.test(host)) return { tipo: 'Facebook', host: host };
  if (/whatsapp\.com/.test(host)) return { tipo: 'WhatsApp', host: host };
  if (/google\./.test(host)) return { tipo: 'Google', host: host };
  return { tipo: 'Otro', host: host };
}

function kvCompressPhoto(file, cb, max, quality) {
  if (!file) return;
  max = max || 700;
  quality = quality || 0.82;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const render = (mx, q) => {
        let w = img.width, h = img.height;
        const scale = Math.min(1, mx / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        try { return c.toDataURL('image/jpeg', q); } catch (err) { return ev.target.result; }
      };
      // la foto debe caber holgada en la base (límite de 1MB por producto):
      // si sale muy pesada se reintenta un poco más chica hasta que quepa
      const pasos = [
        [max, quality],
        [Math.round(max * 0.85), Math.min(quality, 0.8)],
        [Math.round(max * 0.7), 0.75],
        [900, 0.72]
      ];
      let data = ev.target.result;
      for (const [mx, q] of pasos) { data = render(mx, q); if (data.length < 950000) break; }
      cb(data);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
