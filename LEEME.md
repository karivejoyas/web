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

## Panel de administración (nueva.karivejoyas.cl/admin)

Panel estilo Shopify, en `admin/` (se copia tal cual a `dist/admin`). Usa la misma
base de datos y la misma contraseña que el panel antiguo, que sigue funcionando.

- **Pedidos, Productos, Colecciones, Inventario, Clientes, Descuentos, Informes**: misma
  lógica del panel antiguo (verificar pago descuenta stock una vez, códigos correlativos…).
- **Tienda online → Temas**: el tema publicado (textos, imágenes, colores, menús y páginas)
  vive en Firestore `catalog/web` (campo `tema`); las copias, en `catalog/web/temas`; las
  imágenes subidas, en `catalog/web/medios`; los respaldos, en `catalog/web/respaldos`.
  `tema.py` tiene los valores de fábrica y `construir.py` mezcla ambos al armar la web.
  `dist/admin/tema-actual.json` es el tema tal como quedó publicado (punto de partida del editor).
- **Editor en vivo**: carga la web en un marco y le aplica el borrador usando las marcas
  `data-kv`, `data-kv-img`, `data-kv-html`, `data-kv-lista` y `data-kv-sec` que pone `construir.py`.
- **Permiso necesario** (una vez): reglas de Firestore para `catalog/web` (las muestra el
  panel en Configuración → Respaldos y permisos).
- `herramientas/web.gs` vuelve a publicar la web cuando cambian productos, configuración o tema.
