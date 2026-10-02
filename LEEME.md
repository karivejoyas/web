# Karivé Joyas · web (karivejoyas.cl)

Tienda web de Karivé Joyas. Se arma sola desde el catálogo en vivo (Firestore,
proyecto `karive-catalogo`): productos, precios, stock y colecciones salen de la
misma base que usan el panel, el catálogo y el bot de Telegram.

- `construir.py` arma el sitio en `dist/` (no se guarda en el repositorio).
- `estatico/` CSS y JavaScript: carrito, buscador y pago.
- `comun.js` mismas reglas del catálogo (ofertas, cupones, envío, stock).
- `herramientas/paginas-producto.py` funciones compartidas con el generador del catálogo.
- `.github/workflows/publicar.yml` publica en GitHub Pages con cada cambio y cada noche.

El pago usa el mismo publicador (Apps Script), Mercado Pago, pedidos y correos
que el catálogo. Solo lee la base de datos: no cambia ningún producto.

El catálogo antiguo (repositorio `catalogo`, karivejoyas.github.io/catalogo)
es independiente y sigue funcionando igual.
