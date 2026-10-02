#!/usr/bin/env python3
"""
Genera, leyendo el catálogo EN VIVO desde Firestore:

  p/<CODIGO>.html        una página real por producto (con precio visible)
  c/<coleccion>.html     una página por colección (para búsquedas tipo
                         "aros de flores hechos a mano")
  catalogo-google.csv    el feed para las fichas gratuitas de Google Shopping
  sitemap.xml            con las fotos de cada producto (Google Imágenes)
  productos-fotos.json   dónde está la foto de cada producto como archivo, para
                         que el catálogo no tenga que bajar 15 MB de fotos
                         guardadas dentro de la base de datos
  llms.txt               la marca y los productos en texto simple, para las
                         IA que buscan en la web (ChatGPT, Gemini, Perplexity…)
  assets/productos/w/    versiones livianas (WebP) de cada foto

Por qué páginas de verdad: el catálogo es una sola página que arma todo con
JavaScript. Google y Merchant Center necesitan una dirección que muestre el
producto y su precio sin depender de eso, y WhatsApp e Instagram necesitan
una página con etiquetas Open Graph para mostrar la foto al compartir.

Uso, parado en la raíz del repositorio:
    python3 herramientas/paginas-producto.py

Solo lee Firestore; no escribe nada en la base de datos. Los nombres, precios
y medidas se muestran TAL CUAL están en el catálogo: aquí no se corrige nada
de los productos.
"""
import base64, csv, html, json, os, re, sys, urllib.parse, urllib.request
from datetime import date, datetime, timezone

PROYECTO = "karive-catalogo"
BASE = "https://karivejoyas.github.io/catalogo/"
RAIZ = "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents" % PROYECTO
EXT = {"jpeg": "jpg", "jpg": "jpg", "png": "png", "webp": "webp"}
MARCA = "Karivé Joyas"
CAT_GOOGLE = "Apparel & Accessories > Jewelry > Earrings"
WHATSAPP = "56988829803"
INSTAGRAM = "https://www.instagram.com/karive.joyas/"
FACEBOOK = "https://www.facebook.com/karive.joyas"
ENVIO_RM, ENVIO_RESTO = 2990, 3990          # lo mismo que cobra el carrito del catálogo
LOGO = BASE + "assets/logo-karive.png"
ORG_ID = BASE + "#organizacion"
WEB_ID = BASE + "#sitio"

# Cómo se busca cada colección en Google. Solo cambia cómo se presenta la
# página de la colección; los productos no se tocan.
SEO_COLECCION = {
    "flores":    ("Aros de flores hechos a mano", "aros de flores artesanales de arcilla polimérica"),
    "charms":    ("Charms y aros colgantes artesanales", "charms de arcilla y aros colgantes hechos a mano"),
    "argollas":  ("Argollas de cristal artesanales", "argollas con cristales hechas a mano"),
    "topos":     ("Aros de corazón hechos a mano", "aros de corazón pequeños, tipo topo, para el día a día"),
    "marina":    ("Aros de conchas y estrellas de mar", "aros de conchitas y piezas inspiradas en el mar"),
    "cmu236iia": ("Aros para fiestas y fechas especiales", "aros para Fiestas Patrias y fechas especiales"),
    "otros":     ("Más aros artesanales", "aros artesanales de diferentes formas y estilos"),
}

COLORES = {
    "rojo": "Rojo", "roja": "Rojo", "rojas": "Rojo", "rojos": "Rojo",
    "azul": "Azul", "azules": "Azul",
    "blanco": "Blanco", "blanca": "Blanco", "blancas": "Blanco", "blancos": "Blanco",
    "negro": "Negro", "negra": "Negro", "negras": "Negro", "negros": "Negro",
    "dorado": "Dorado", "dorada": "Dorado", "doradas": "Dorado", "dorados": "Dorado",
    "plateado": "Plateado", "plateada": "Plateado", "plateadas": "Plateado", "plateados": "Plateado",
    "morado": "Morado", "morada": "Morado", "moradas": "Morado",
    "celeste": "Celeste", "celestes": "Celeste",
    "verde": "Verde", "verdes": "Verde",
    "amarillo": "Amarillo", "amarilla": "Amarillo",
    "naranjo": "Naranjo", "naranja": "Naranjo",
    "rosa": "Rosa", "rosado": "Rosa", "rosada": "Rosa", "rosas": "Rosa",
    "turquesa": "Turquesa", "mostaza": "Mostaza", "cobre": "Cobre", "beige": "Beige",
    "marino": "Azul", "petroleo": "Azul", "lila": "Lila", "violeta": "Violeta",
    "fucsia": "Fucsia", "gris": "Gris", "cafe": "Café", "burdeo": "Burdeo",
    "coral": "Coral", "arena": "Beige", "perla": "Blanco",
    "transparente": "Transparente", "multicolor": "Multicolor",
    "tricolor": "Multicolor", "glitter": "Multicolor",
}

try:                                    # versiones WebP livianas (si Pillow está instalado)
    from PIL import Image
except Exception:
    Image = None


# ---------------------------------------------------------------- utilidades

def medidas(ruta):
    """Ancho y alto de un JPEG o PNG, sin librerías externas."""
    import struct
    try:
        with open(ruta, "rb") as f:
            cab = f.read(26)
            if cab[:8] == b"\x89PNG\r\n\x1a\n":
                return struct.unpack(">II", cab[16:24])
            if cab[:2] != b"\xff\xd8":
                return None
            f.seek(2)
            while True:
                b = f.read(1)
                while b and b != b"\xff":
                    b = f.read(1)
                m = f.read(1)
                while m == b"\xff":
                    m = f.read(1)
                if not m:
                    return None
                if m[0] in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    f.read(3)
                    alto, ancho = struct.unpack(">HH", f.read(4))
                    return ancho, alto
                largo = struct.unpack(">H", f.read(2))[0]
                f.read(largo - 2)
    except Exception:
        return None


def limpio(t):
    return re.sub(r"\s+", " ", str(t or "")).strip()


def sin_tildes(t):
    import unicodedata
    t = unicodedata.normalize("NFD", str(t or "").lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def slug(t):
    return re.sub(r"[^a-z0-9]+", "-", sin_tildes(t)).strip("-") or "coleccion"


def color_de(nombre):
    n = sin_tildes(nombre)
    if not n:
        return ""
    mejor, pos = "", -1
    for clave, valor_color in COLORES.items():
        m = re.search(r"\b" + clave + r"\b", n)
        if m and m.start() > pos:
            pos, mejor = m.start(), valor_color
    return mejor


def valor(c):
    if c is None:
        return None
    for k in ("stringValue", "booleanValue", "doubleValue"):
        if k in c:
            return c[k]
    if "integerValue" in c:
        return int(c["integerValue"])
    return None


def documentos(ruta, campos):
    mask = "&".join("mask.fieldPaths=%s" % c for c in campos)
    docs, token = [], None
    while True:
        url = "%s/%s?pageSize=100&%s" % (RAIZ, ruta, mask)
        if token:
            url += "&pageToken=" + urllib.parse.quote(token)
        with urllib.request.urlopen(url, timeout=90) as r:
            d = json.load(r)
        docs += d.get("documents", [])
        token = d.get("nextPageToken")
        if not token:
            return docs


def colecciones():
    """{id: {nombre, sub, prefijo, orden}} en el orden del panel."""
    with urllib.request.urlopen(RAIZ + "/catalog/settings?mask.fieldPaths=categorias&mask.fieldPaths=cats", timeout=60) as r:
        s = json.load(r).get("fields", {})
    n = {}
    for i, v in enumerate(s.get("categorias", {}).get("arrayValue", {}).get("values", [])):
        f = v.get("mapValue", {}).get("fields", {})
        ident = valor(f.get("id"))
        if ident:
            n[ident] = {"nombre": valor(f.get("nombre")) or ident, "sub": limpio(valor(f.get("sub"))), "orden": i}
    for ident, v in s.get("cats", {}).get("mapValue", {}).get("fields", {}).items():
        nom = valor(v.get("mapValue", {}).get("fields", {}).get("nombre"))
        if nom:
            n.setdefault(ident, {"sub": "", "orden": 99})["nombre"] = nom
    return n


def foto_publica(codigo, foto):
    if not foto:
        return None
    if foto.startswith("http"):
        return foto
    if not foto.startswith("data:"):
        return foto if os.path.exists(foto) else None
    m = re.match(r"data:image/([a-zA-Z]+);base64,(.*)$", foto, re.S)
    if not m:
        return None
    destino = "assets/productos/%s.%s" % (codigo, EXT.get(m.group(1).lower(), "jpg"))
    datos = base64.b64decode(m.group(2))
    if not (os.path.exists(destino) and open(destino, "rb").read() == datos):
        open(destino, "wb").write(datos)
    return destino


def webp(ruta, ancho=480):
    """Versión liviana para las grillas (colecciones y "también te puede gustar").
    Se rehace solo si la foto original cambió."""
    if not Image or not ruta or ruta.startswith("http") or not os.path.exists(ruta):
        return None
    os.makedirs("assets/productos/w", exist_ok=True)
    base = os.path.splitext(os.path.basename(ruta))[0]
    destino = "assets/productos/w/%s-%d.webp" % (base, ancho)
    if os.path.exists(destino) and os.path.getmtime(destino) >= os.path.getmtime(ruta):
        return destino
    try:
        im = Image.open(ruta)
        im = im.convert("RGB")
        if im.width > ancho:
            im = im.resize((ancho, round(im.height * ancho / im.width)), Image.LANCZOS)
        im.save(destino, "WEBP", quality=78, method=6)
        return destino
    except Exception:
        return None


def pesos(n):
    return "$" + format(int(n), ",d").replace(",", ".")


def corta(t, n):
    """Corta en la última palabra que cabe."""
    t = limpio(t)
    if len(t) <= n:
        return t
    return t[:n].rsplit(" ", 1)[0].rstrip(",.;:·-") + "…"


e = lambda s: html.escape(str(s), quote=True)


# ------------------------------------------------------------ piezas comunes

CSS = """:root{--m-osc:#2A123E;--m-prof:#3A1D4E;--dor:#C9A24B;--dor-cl:#E3C572;--lav:#CBB7D8;--cre:#FBF6EE;}
*{box-sizing:border-box}body{margin:0;background:var(--m-osc);color:var(--cre);font-family:'Jost',system-ui,-apple-system,'Segoe UI',sans-serif;font-weight:300;line-height:1.6}
a{color:var(--dor-cl)}a:focus-visible,button:focus-visible{outline:2px solid var(--dor-cl);outline-offset:3px;border-radius:6px}
.env{max-width:1040px;margin:0 auto;padding:18px 16px 64px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.logo img{display:block;height:48px;width:auto}
.top nav a{font-size:14px;text-decoration:none;margin-left:14px}
.migas{font-size:13px;color:var(--lav);margin:0 0 18px}.migas ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.migas li+li:before{content:"›";margin-right:6px;color:var(--dor)}.migas a{text-decoration:none}
.ficha{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;align-items:start}
.ficha figure{margin:0}.foto{width:100%;height:auto;border-radius:16px;border:1px solid rgba(201,162,75,.3);background:var(--m-prof);display:block}
figcaption{font-size:12px;color:var(--lav);margin-top:6px}
h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:34px;line-height:1.15;margin:0 0 6px;color:var(--cre)}
h2{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:26px;color:var(--dor-cl);margin:40px 0 12px}
h3{font-size:16px;font-weight:500;margin:18px 0 4px;color:var(--cre)}
.codigo{font-size:12px;letter-spacing:.14em;color:var(--lav);text-transform:uppercase;margin-bottom:12px}
.precio{font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;color:var(--dor-cl);margin:8px 0 2px}
.precio s{font-size:22px;color:var(--lav);margin-left:10px}
.stock{font-size:14px;color:#BFE3C8;margin-bottom:14px}.stock.no{color:#F0B8B8}
.datos{border-top:1px solid rgba(201,162,75,.22);margin:16px 0 0;padding-top:14px;font-size:15px;color:var(--lav)}
.datos div{display:flex;gap:8px;margin-bottom:4px}.datos dt{min-width:90px;color:var(--cre)}.datos dd{margin:0}
.acciones{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 22px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:500}
.btn-1{background:linear-gradient(135deg,var(--dor),var(--dor-cl));color:#2A123E}.btn-2{border:1px solid rgba(201,162,75,.6);color:var(--dor-cl)}
.confianza{list-style:none;padding:0;margin:18px 0 0;font-size:14px;color:var(--lav)}.confianza li{margin-bottom:4px}
.texto{font-size:15.5px;color:var(--lav);max-width:720px}
.faq details{border-bottom:1px solid rgba(201,162,75,.18);padding:10px 0;max-width:760px}.faq summary{cursor:pointer;color:var(--cre);font-weight:400}
.faq p{margin:8px 0 0;color:var(--lav);font-size:15px}
.grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:18px;list-style:none;padding:0;margin:0}
.grilla a{display:block;text-decoration:none;color:var(--cre)}.grilla img{width:100%;height:auto;aspect-ratio:1;object-fit:cover;border-radius:12px;background:var(--m-prof);display:block}
.grilla .n{font-size:14.5px;margin-top:6px;line-height:1.3}.grilla .p{color:var(--dor-cl);font-size:15px}
.cols{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0;margin:0}.cols a{display:inline-flex;align-items:center;min-height:44px;padding:9px 16px;border:1px solid rgba(201,162,75,.4);border-radius:999px;text-decoration:none;font-size:14px}
footer{margin-top:56px;padding-top:18px;border-top:1px solid rgba(201,162,75,.18);font-size:13px;color:var(--lav)}footer p{margin:6px 0}
@media (max-width:720px){.ficha{grid-template-columns:1fr;gap:20px}h1{font-size:28px}.precio{font-size:31px}.btn{flex:1 1 100%}}"""

FUENTES = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
           '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
           # la hoja de fuentes no bloquea el primer dibujo de la página
           '<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Jost:wght@300;400;500&display=swap">\n'
           '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Jost:wght@300;400;500&display=swap" media="print" onload="this.media=\'all\'">')


def cabeza(titulo, desc, url, imagen, imagen_alt, dim, tipo_og, extra_meta, jsonld, robots="index, follow, max-image-preview:large"):
    medidas_og = ('\n<meta property="og:image:width" content="%d">\n<meta property="og:image:height" content="%d">' % dim) if dim else ""
    return """<!doctype html>
<html lang="es-CL" prefix="og: https://ogp.me/ns# product: https://ogp.me/ns/product#">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t}</title>
<meta name="description" content="{d}">
<meta name="robots" content="{rob}">
<link rel="canonical" href="{u}">
<meta name="theme-color" content="#2A123E">
<meta property="og:type" content="{tipo}">
<meta property="og:site_name" content="{m}">
<meta property="og:locale" content="es_CL">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{u}">
<meta property="og:image" content="{img}">
<meta property="og:image:secure_url" content="{img}">
<meta property="og:image:alt" content="{alt}">{mog}{extra}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{img}">
<meta name="twitter:image:alt" content="{alt}">
<link rel="icon" href="../assets/logo-avatar.png" type="image/png">
<link rel="apple-touch-icon" href="../assets/logo-avatar.png">
<link rel="manifest" href="../manifest.webmanifest">
{fuentes}
<script type="application/ld+json">{j}</script>
<style>{css}</style>
</head>
""".format(t=e(titulo), d=e(desc), u=e(url), img=e(imagen), alt=e(imagen_alt), mog=medidas_og, tipo=tipo_og,
           m=e(MARCA), extra=extra_meta, j=json.dumps(jsonld, ensure_ascii=False).replace("</", "<\\/"),
           css=CSS, fuentes=FUENTES, rob=robots)


def encabezado(migas):
    li = "".join('<li><a href="%s">%s</a></li>' % (e(h), e(t)) if h else '<li aria-current="page">%s</li>' % e(t) for t, h in migas)
    return """<body>
<div class="env">
  <header class="top">
    <a class="logo" href="../"><img src="../assets/logo-karive-crop.png" alt="Karivé Joyas, inicio" width="146" height="48"></a>
    <nav aria-label="Principal"><a href="../">Catálogo</a><a href="https://wa.me/{w}">WhatsApp</a></nav>
  </header>
  <nav class="migas" aria-label="Estás en"><ol>{li}</ol></nav>
""".format(li=li, w=WHATSAPP)


def pie(cols):
    enlaces = " · ".join('<a href="../c/%s.html">%s</a>' % (e(c["slug"]), e(c["nombre"])) for c in cols)
    return """  <footer>
    <p><strong>{m}</strong> · Joyería artesanal hecha a mano en Santiago, Chile · Envíos a todo Chile</p>
    <p>Colecciones: {enl}</p>
    <p><a href="../">Catálogo completo</a> · <a href="../devoluciones.html">Cambios y devoluciones</a> · <a href="../privacidad.html">Privacidad</a> ·
       <a href="{ig}" rel="noopener">Instagram</a> · <a href="{fb}" rel="noopener">Facebook</a> · <a href="https://wa.me/{w}">WhatsApp +56 9 8882 9803</a></p>
  </footer>
</div>
</body>
</html>
""".format(m=e(MARCA), enl=enlaces, ig=INSTAGRAM, fb=FACEBOOK, w=WHATSAPP)


def organizacion():
    return {
        "@type": ["Organization", "OnlineStore"], "@id": ORG_ID, "name": MARCA, "url": BASE,
        "logo": LOGO, "image": LOGO,
        "description": "Joyería artesanal hecha a mano en Santiago, Chile: aros de arcilla polimérica, argollas de cristal y charms, con base de acero. Envíos a todo Chile.",
        "email": "karive.joyas@gmail.com", "telephone": "+56988829803",
        "address": {"@type": "PostalAddress", "addressLocality": "Santiago", "addressRegion": "Región Metropolitana", "addressCountry": "CL"},
        "areaServed": {"@type": "Country", "name": "Chile"},
        "sameAs": [INSTAGRAM, FACEBOOK],
        "contactPoint": {"@type": "ContactPoint", "contactType": "customer service", "telephone": "+56988829803",
                         "availableLanguage": "es", "areaServed": "CL"},
    }


def politica_devolucion():
    return {
        "@type": "MerchantReturnPolicy",
        "applicableCountry": "CL",
        # no hay cambios por arrepentimiento (joyas de uso personal); las fallas
        # tienen la garantía legal de 3 meses: ver devoluciones.html
        "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
        "merchantReturnLink": BASE + "devoluciones.html",
    }


def envios():
    return [
        {"@type": "OfferShippingDetails",
         "shippingRate": {"@type": "MonetaryAmount", "value": ENVIO_RM, "currency": "CLP"},
         "shippingDestination": {"@type": "DefinedRegion", "addressCountry": "CL", "addressRegion": "CL-RM"}},
        {"@type": "OfferShippingDetails",
         "shippingRate": {"@type": "MonetaryAmount", "value": ENVIO_RESTO, "currency": "CLP"},
         "shippingDestination": {"@type": "DefinedRegion", "addressCountry": "CL"}},
    ]


def preguntas(nombre, medida):
    """Preguntas reales de quien compra; las respuestas salen de la política
    publicada y del carrito, nada inventado."""
    return [
        ("¿De qué material son los %s?" % nombre,
         "Son aros artesanales hechos a mano en Chile, con base de acero quirúrgico. Si tienes la piel muy sensible, escríbenos antes de comprar."),
        ("¿Cuánto miden?",
         ("Miden %s." % medida.rstrip(".")) if medida else "Escríbenos y te contamos la medida exacta."),
        ("¿Hacen envíos a regiones?",
         "Sí, enviamos a todo Chile desde Santiago: $%s a la Región Metropolitana y $%s al resto del país."
         % (format(ENVIO_RM, ",d").replace(",", "."), format(ENVIO_RESTO, ",d").replace(",", "."))),
        ("¿Cómo compro?",
         "Agrégalo al carrito en el catálogo y paga con Mercado Pago o transferencia, o escríbenos por WhatsApp o Instagram."),
        ("¿Qué pasa si llega con una falla?",
         "Tienes 3 meses de garantía legal: lo cambiamos, lo reparamos o te devolvemos el dinero, y el envío de vuelta lo pagamos nosotros."),
    ]


# --------------------------------------------------------------- las páginas

def pagina_producto(p, rel, cols):
    nombre, cod, col = p["nombre"], p["codigo"], p["col"]
    url = BASE + "p/" + cod + ".html"
    titulo_h1 = nombre
    etiqueta = nombre if not p["repetido"] else "%s (%s)" % (nombre, cod)
    titulo = "%s | Aros hechos a mano | %s" % (etiqueta, MARCA)
    if len(titulo) > 65:
        titulo = "%s | %s" % (etiqueta, MARCA)
    # se arma con lo más importante primero y se quitan colas hasta que quepa (sin cortar frases)
    etiqueta_desc = etiqueta if p["repetido"] else nombre
    partes = ["%s a %s: aros artesanales hechos a mano en Chile%s." % (etiqueta_desc, pesos(p["vigente"]), (", " + p["medida"].lower()) if p["medida"] else ""),
              "Envío a todo Chile desde Santiago.", "Compra online o por WhatsApp."]
    while len(" ".join(partes)) > 158 and len(partes) > 1:
        partes.pop()
    desc = corta(" ".join(partes), 158)
    alt = "%s, aros artesanales hechos a mano%s – %s" % (nombre, (" color " + p["color"].lower()) if p["color"] else "", MARCA)

    texto = ("%s es un par de aros artesanales de la colección %s de %s, hechos a mano uno por uno en Santiago de Chile, con base de acero quirúrgico."
             % (nombre, col["nombre"], MARCA))
    if col.get("sub"):
        texto += " " + col["sub"].rstrip(".") + "."
    if p["medida"]:
        texto += " Medida: %s." % p["medida"].rstrip(".")
    texto += " Al ser piezas hechas a mano, cada par puede tener pequeñas diferencias: eso las hace únicas. Se envían en su empaque, listos para regalar."

    faq = preguntas(nombre, p["medida"])
    oferta_txt = ('<s>%s</s>' % pesos(p["precio"])) if p["oferta"] else ""

    producto = {
        "@type": "Product", "@id": url + "#producto", "name": nombre, "sku": cod, "mpn": cod,
        "url": url, "description": texto, "category": "Joyería > Aros",
        "image": [{"@type": "ImageObject", "url": p["imagen"], "contentUrl": p["imagen"], "caption": alt,
                   **({"width": p["dim"][0], "height": p["dim"][1]} if p["dim"] else {})}],
        "brand": {"@type": "Brand", "name": MARCA}, "manufacturer": {"@id": ORG_ID},
        "material": "Acero quirúrgico", "audience": {"@type": "PeopleAudience", "suggestedGender": "female"},
        "additionalProperty": [{"@type": "PropertyValue", "name": "Hecho a mano", "value": "Sí"}]
                              + ([{"@type": "PropertyValue", "name": "Medida", "value": p["medida"]}] if p["medida"] else []),
        "offers": {
            "@type": "Offer", "url": url, "priceCurrency": "CLP", "price": str(p["vigente"]),
            "availability": "https://schema.org/%s" % ("InStock" if p["hay"] else "OutOfStock"),
            "itemCondition": "https://schema.org/NewCondition",
            "seller": {"@id": ORG_ID},
            "shippingDetails": envios(),
            "hasMerchantReturnPolicy": politica_devolucion(),
        },
    }
    if p["color"]:
        producto["color"] = p["color"]
    if p["resenas"]:
        n, prom = p["resenas"]
        producto["aggregateRating"] = {"@type": "AggregateRating", "ratingValue": prom, "reviewCount": n, "bestRating": 5, "worstRating": 1}

    migas = [("Inicio", "../"), (col["nombre"], "../c/%s.html" % col["slug"]), (nombre, None)]
    jsonld = {"@context": "https://schema.org", "@graph": [
        organizacion(),
        {"@type": "WebPage", "@id": url, "url": url, "name": titulo, "isPartOf": {"@id": WEB_ID},
         "primaryImageOfPage": {"@type": "ImageObject", "url": p["imagen"]}, "inLanguage": "es-CL",
         "breadcrumb": {"@id": url + "#migas"}, "mainEntity": {"@id": url + "#producto"}},
        producto,
        {"@type": "BreadcrumbList", "@id": url + "#migas", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Inicio", "item": BASE},
            {"@type": "ListItem", "position": 2, "name": col["nombre"], "item": BASE + "c/%s.html" % col["slug"]},
            {"@type": "ListItem", "position": 3, "name": nombre, "item": url}]},
        {"@type": "FAQPage", "@id": url + "#preguntas", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]},
    ]}
    extra = ('\n<meta property="product:price:amount" content="%d">\n<meta property="product:price:currency" content="CLP">'
             '\n<meta property="product:availability" content="%s">\n<meta property="product:brand" content="%s">'
             '\n<meta property="product:retailer_item_id" content="%s">'
             % (p["vigente"], "in stock" if p["hay"] else "out of stock", e(MARCA), e(cod)))

    ancho, alto = p["dim"] or (1000, 1000)
    datos = [("Medida", p["medida"])] if p["medida"] else []
    datos += [("Material", "Base de acero quirúrgico"), ("Hecho", "A mano en Chile")]
    if p["color"]:
        datos.append(("Color", p["color"]))
    datos += [("Colección", '<a href="../c/%s.html">%s</a>' % (e(col["slug"]), e(col["nombre"])))]

    h = cabeza(titulo, desc, url, p["imagen"], alt, p["dim"], "product", extra, jsonld)
    h += encabezado(migas)
    h += """  <main>
  <article class="ficha">
    <figure>
      <img class="foto" src="{img}" alt="{alt}" width="{w}" height="{hh}" fetchpriority="high" decoding="async">
      <figcaption>{nom} · {m}</figcaption>
    </figure>
    <div>
      <h1>{h1}</h1>
      <div class="codigo">Código {cod} · {coln}</div>
      <div class="precio">{precio}{oferta}</div>
      <div class="stock{cs}">{ts}</div>
      <dl class="datos">{datos}</dl>
      <div class="acciones">
        <a class="btn btn-1" href="../?p={cod}">Comprar en el catálogo</a>
        <a class="btn btn-2" href="https://wa.me/{wa}?text={wat}">Consultar por WhatsApp</a>
      </div>
      <ul class="confianza">
        <li>🚚 Envío a todo Chile: {rm} en la RM · {resto} a regiones</li>
        <li>💳 Paga con Mercado Pago o transferencia</li>
        <li>🛡️ 3 meses de garantía por fallas · <a href="../devoluciones.html">ver política</a></li>
      </ul>
    </div>
  </article>

  <section aria-labelledby="t-desc"><h2 id="t-desc">Sobre estos aros</h2><p class="texto">{texto}</p></section>

  <section class="faq" aria-labelledby="t-faq"><h2 id="t-faq">Preguntas frecuentes</h2>
{faq}
  </section>
""".format(img=e(rel["img"]), alt=e(alt), w=ancho, hh=alto, nom=e(nombre), m=e(MARCA), h1=e(titulo_h1), cod=e(cod),
           coln=e(col["nombre"]), precio=pesos(p["vigente"]), oferta=oferta_txt,
           cs="" if p["hay"] else " no", ts="Disponible" if p["hay"] else "Por ahora sin stock",
           datos="".join("<div><dt>%s</dt><dd>%s</dd></div>" % (k, v if k == "Colección" else e(v)) for k, v in datos),
           wa=WHATSAPP, wat=urllib.parse.quote("¡Hola! Me interesan los %s (%s)" % (nombre, cod)),
           rm=pesos(ENVIO_RM), resto=pesos(ENVIO_RESTO), texto=e(texto),
           faq="\n".join("    <details><summary>%s</summary><p>%s</p></details>" % (e(q), e(a)) for q, a in faq))
    if rel["otros"]:
        h += '  <section aria-labelledby="t-mas"><h2 id="t-mas">También te pueden gustar</h2>\n' + grilla(rel["otros"]) + "\n  </section>\n"
    h += "  </main>\n" + pie(cols)
    return h


def grilla(prods):
    items = []
    for q in prods:
        img = q["mini"] or q["img_rel"]
        items.append('<li><a href="../p/%s.html"><img src="%s" alt="%s" width="480" height="480" loading="lazy" decoding="async">'
                     '<div class="n">%s</div><div class="p">%s</div></a></li>'
                     % (e(q["codigo"]), e(img), e(q["nombre"] + " – aros hechos a mano"), e(q["nombre"]), pesos(q["vigente"])))
    return '<ul class="grilla">%s</ul>' % "".join(items)


def pagina_coleccion(col, prods, cols):
    url = BASE + "c/%s.html" % col["slug"]
    h1, frase = SEO_COLECCION.get(col["id"], ("Aros %s hechos a mano" % col["nombre"].lower(), "aros artesanales de la colección " + col["nombre"]))
    titulo = "%s | %s" % (h1, MARCA)
    precios = [q["vigente"] for q in prods]
    desde = min(precios) if precios else 0
    partes = ["%s: %d modelos%s, hechos a mano en Santiago." % (h1, len(prods), (" desde " + pesos(desde)) if desde else ""),
              "Envío a todo Chile.", (col.get("sub") or "").rstrip(".") + "." if col.get("sub") else ""]
    partes = [x for x in partes if x]
    while len(" ".join(partes)) > 158 and len(partes) > 1:
        partes.pop()
    desc = corta(" ".join(partes), 158)
    intro = ("En %s hacemos %s a mano, uno por uno, en Santiago de Chile. %s Encuentra aquí los %d modelos disponibles de la colección %s%s, "
             "con envío a todo Chile." % (MARCA, frase, (col.get("sub", "").rstrip(".") + ".") if col.get("sub") else "",
                                           len(prods), col["nombre"], (", desde " + pesos(desde)) if desde else ""))
    img = prods[0]["imagen"] if prods else LOGO
    lista = {"@type": "ItemList", "@id": url + "#lista", "numberOfItems": len(prods), "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": BASE + "p/%s.html" % q["codigo"], "name": q["nombre"]} for i, q in enumerate(prods)]}
    jsonld = {"@context": "https://schema.org", "@graph": [
        organizacion(),
        {"@type": "CollectionPage", "@id": url, "url": url, "name": titulo, "description": desc, "inLanguage": "es-CL",
         "isPartOf": {"@id": WEB_ID}, "breadcrumb": {"@id": url + "#migas"}, "mainEntity": {"@id": url + "#lista"},
         "primaryImageOfPage": {"@type": "ImageObject", "url": img}},
        lista,
        {"@type": "BreadcrumbList", "@id": url + "#migas", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Inicio", "item": BASE},
            {"@type": "ListItem", "position": 2, "name": col["nombre"], "item": url}]},
    ]}
    h = cabeza(titulo, desc, url, img, h1 + " – " + MARCA, None, "website", "", jsonld)
    h += encabezado([("Inicio", "../"), (col["nombre"], None)])
    otras = [c for c in cols if c["id"] != col["id"]]
    h += """  <main>
  <h1>{h1}</h1>
  <p class="texto">{intro}</p>
  <div class="acciones"><a class="btn btn-1" href="../">Ver el catálogo y comprar</a><a class="btn btn-2" href="https://wa.me/{w}">Consultar por WhatsApp</a></div>
  <h2>Modelos de la colección {nom}</h2>
  {grilla}
  <h2>Otras colecciones</h2>
  <ul class="cols">{otras}</ul>
  </main>
""".format(h1=e(h1), intro=e(intro), w=WHATSAPP, nom=e(col["nombre"]), grilla=grilla(prods),
           otras="".join('<li><a href="%s.html">%s</a></li>' % (e(c["slug"]), e(c["nombre"])) for c in otras))
    h += pie(cols)
    return h, desc


# ------------------------------------------------------------------ programa

def main():
    if not os.path.isdir("assets/productos"):
        sys.exit("Ejecuta esto parado en la raíz del repositorio.")
    os.makedirs("p", exist_ok=True)
    os.makedirs("c", exist_ok=True)
    info_cols = colecciones()
    campos = ["code", "name", "price", "priceOffer", "stock", "detail", "category", "order", "photo"]
    docs = documentos("catalog/products/items", campos)
    if len(docs) < 20:
        sys.exit("Solo llegaron %d productos. Se aborta sin escribir nada." % len(docs))

    # reseñas reales (si algún día hay): {producto_id: (n, promedio)}
    resenas = {}
    try:
        with urllib.request.urlopen(RAIZ + "/catalog/settings?mask.fieldPaths=resenas", timeout=40) as r:
            vals = json.load(r).get("fields", {}).get("resenas", {}).get("arrayValue", {}).get("values", [])
        tmp = {}
        for v in vals:
            f = v.get("mapValue", {}).get("fields", {})
            pid, est = valor(f.get("producto")), valor(f.get("estrellas"))
            if pid and est:
                tmp.setdefault(pid, []).append(float(est))
        resenas = {k: (len(v), round(sum(v) / len(v), 1)) for k, v in tmp.items()}
    except Exception:
        pass

    prods, sin_foto, fotos_idx = [], [], {}
    for doc in docs:
        f = doc.get("fields", {})
        p0 = {c: valor(f.get(c)) for c in campos}
        cod = (p0.get("code") or "").strip()
        if not cod:
            continue
        ruta = foto_publica(cod, p0.get("photo") or "")
        doc_id = doc["name"].split("/")[-1]
        if not ruta:
            sin_foto.append(cod)
            continue
        if not ruta.startswith("http"):
            # [foto original, cuándo cambió el producto, versión liviana para las tarjetas del catálogo]
            fotos_idx[doc_id] = [ruta, doc.get("updateTime", ""), webp(ruta, 800) or ""]
        cat = p0.get("category") or ""
        ic = info_cols.get(cat, {"nombre": cat.capitalize() or "Otros", "sub": "", "orden": 99})
        precio = int(p0.get("price") or 0)
        oferta = int(p0.get("priceOffer") or 0)
        oferta = oferta if 0 < oferta < precio else 0
        prods.append({
            "id": doc_id, "codigo": cod, "nombre": limpio(p0.get("name")), "medida": limpio(p0.get("detail")),
            "cat": cat, "col": ic, "precio": precio, "oferta": oferta, "vigente": oferta or precio,
            "hay": p0.get("stock") is True, "orden": p0.get("order") or 0,
            "ruta": ruta, "imagen": ruta if ruta.startswith("http") else BASE + ruta,
            "img_rel": ruta if ruta.startswith("http") else "../" + ruta,
            "dim": medidas(ruta) if not ruta.startswith("http") else None,
            "mini": ("../" + webp(ruta)) if webp(ruta) else None,
            "color": color_de(p0.get("name")), "resenas": resenas.get(doc_id),
            "actualizado": (doc.get("updateTime") or "")[:10],
        })

    # nombres repetidos (hay modelos con el mismo nombre en otra variante): el
    # código va en el título para que Google no los tome como páginas duplicadas
    conteo = {}
    for p in prods:
        conteo[sin_tildes(p["nombre"])] = conteo.get(sin_tildes(p["nombre"]), 0) + 1
    for p in prods:
        p["repetido"] = conteo[sin_tildes(p["nombre"])] > 1

    # colecciones con al menos un producto visible
    cols = []
    for cid, ic in sorted(info_cols.items(), key=lambda kv: kv[1].get("orden", 99)):
        visibles = sorted([p for p in prods if p["cat"] == cid and p["hay"]], key=lambda p: p["orden"])
        if visibles:
            ic.update({"id": cid, "slug": slug(ic["nombre"])})
            cols.append(ic)
            ic["_prods"] = visibles
    for p in prods:
        p["col"].setdefault("slug", slug(p["col"]["nombre"]))
        p["col"].setdefault("id", p["cat"])

    # páginas de producto
    for p in prods:
        otros = [q for q in p["col"].get("_prods", []) if q["codigo"] != p["codigo"]][:8]
        open("p/%s.html" % p["codigo"], "w", encoding="utf-8").write(
            pagina_producto(p, {"img": p["img_rel"], "otros": otros}, cols))

    # páginas de colección (y se borran las de colecciones que ya no existen)
    hechas = set()
    for c in cols:
        pag, _ = pagina_coleccion(c, c["_prods"], cols)
        open("c/%s.html" % c["slug"], "w", encoding="utf-8").write(pag)
        hechas.add(c["slug"] + ".html")
    for viejo in os.listdir("c"):
        if viejo.endswith(".html") and viejo not in hechas:
            os.remove(os.path.join("c", viejo))

    # feed de Google Merchant
    filas = []
    for p in sorted(prods, key=lambda p: (p["cat"], p["orden"])):
        desc = ("%s de %s. Aros artesanales hechos a mano en Chile, con base de acero quirúrgico.%s Colección %s. Código %s."
                % (p["nombre"], MARCA, (" Medida %s." % p["medida"].rstrip(".")) if p["medida"] else "", p["col"]["nombre"], p["codigo"]))
        filas.append({
            "id": p["codigo"],
            "title": corta("%s – Aros artesanales hechos a mano | %s" % (p["nombre"], MARCA), 150),
            "description": desc[:5000],
            "link": BASE + "p/" + p["codigo"] + ".html",
            "image_link": p["imagen"],
            "availability": "in_stock" if p["hay"] else "out_of_stock",
            "price": "%d CLP" % p["precio"],
            "sale_price": ("%d CLP" % p["oferta"]) if p["oferta"] else "",
            "condition": "new",
            "brand": MARCA,
            "mpn": p["codigo"],
            "identifier_exists": "no",
            "google_product_category": CAT_GOOGLE,
            "product_type": "Joyería > Aros > " + p["col"]["nombre"],
            "color": p["color"],
            "gender": "female",
            "age_group": "adult",
            "material": "Acero quirúrgico",
            "custom_label_0": p["col"]["nombre"],
        })
    with open("catalogo-google.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(filas[0].keys()))
        w.writeheader()
        w.writerows(filas)

    # sitemap con imágenes (Google Imágenes) y fecha de última modificación
    hoy = date.today().isoformat()
    ult = max([p["actualizado"] for p in prods if p["actualizado"]] or [hoy])
    with open("sitemap.xml", "w", encoding="utf-8") as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        fh.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n')
        fh.write("  <url><loc>%s</loc><lastmod>%s</lastmod></url>\n" % (BASE, ult))
        for c in cols:
            fh.write("  <url><loc>%sc/%s.html</loc><lastmod>%s</lastmod></url>\n" % (BASE, c["slug"], ult))
        for p in sorted(prods, key=lambda p: p["codigo"]):
            fh.write("  <url><loc>%sp/%s.html</loc>%s<image:image><image:loc>%s</image:loc></image:image></url>\n"
                     % (BASE, p["codigo"], ("<lastmod>%s</lastmod>" % p["actualizado"]) if p["actualizado"] else "", html.escape(p["imagen"])))
        fh.write("  <url><loc>%sdevoluciones.html</loc></url>\n" % BASE)
        fh.write("</urlset>\n")

    # índice de fotos como archivo, para que el catálogo cargue liviano
    with open("productos-fotos.json", "w", encoding="utf-8") as fh:
        json.dump({"generado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "fotos": fotos_idx}, fh, separators=(",", ":"))

    # llms.txt: la marca y los productos en texto simple para buscadores con IA
    lineas = ["# %s" % MARCA, "",
              "> Joyería artesanal hecha a mano en Santiago, Chile. Aros de arcilla polimérica, argollas de cristal, "
              "charms y aros de conchas, con base de acero. Venta online con envíos a todo Chile.", "",
              "- Sitio y catálogo: %s" % BASE,
              "- Instagram: %s (@karive.joyas)" % INSTAGRAM,
              "- Facebook: %s" % FACEBOOK,
              "- WhatsApp: +56 9 8882 9803",
              "- Envíos: a todo Chile desde Santiago ($%s Región Metropolitana, $%s resto de Chile). No hay retiro en tienda."
              % (format(ENVIO_RM, ",d").replace(",", "."), format(ENVIO_RESTO, ",d").replace(",", ".")),
              "- Pagos: Mercado Pago o transferencia.",
              "- Garantía: 3 meses por fallas (%sdevoluciones.html)." % BASE, "",
              "## Colecciones", ""]
    for c in cols:
        lineas.append("- [%s](%sc/%s.html): %s" % (c["nombre"], BASE, c["slug"], c.get("sub") or SEO_COLECCION.get(c["id"], ("", ""))[1]))
    lineas += ["", "## Productos disponibles", ""]
    for c in cols:
        for p in c["_prods"]:
            lineas.append("- [%s](%sp/%s.html) (%s): %s%s" % (p["nombre"], BASE, p["codigo"], p["codigo"], pesos(p["vigente"]),
                                                              (", " + p["medida"]) if p["medida"] else ""))
    open("llms.txt", "w", encoding="utf-8").write("\n".join(lineas) + "\n")

    # enlaces a las colecciones en la portada (para quien no tiene JavaScript y para los buscadores)
    try:
        idx = open("index.html", encoding="utf-8").read()
        bloque = "".join('<li><a href="c/%s.html">%s</a></li>' % (e(c["slug"]), e(SEO_COLECCION.get(c["id"], (c["nombre"],))[0])) for c in cols)
        nuevo = re.sub(r"(<!-- COLECCIONES -->).*?(<!-- /COLECCIONES -->)", lambda m: m.group(1) + bloque + m.group(2), idx, flags=re.S)
        if nuevo != idx:
            open("index.html", "w", encoding="utf-8").write(nuevo)
    except Exception as err:
        print("no pude actualizar la portada:", err)

    print("páginas de producto :", len(prods))
    print("páginas de colección:", len(cols))
    print("filas en el feed    :", len(filas))
    print("sin stock           :", sum(1 for p in prods if not p["hay"]))
    print("versiones WebP      :", sum(1 for p in prods if p["mini"]) if Image else "sin Pillow (se omiten)")
    if sin_foto:
        print("SIN FOTO (fuera)    :", ", ".join(sin_foto))


if __name__ == "__main__":
    main()
