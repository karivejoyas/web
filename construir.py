#!/usr/bin/env python3
"""
Construye la web nueva de Karivé Joyas (karivejoyas.cl) en dist/,
leyendo el catálogo EN VIVO desde Firestore.

  python3 construir.py

Reutiliza las funciones del generador del catálogo actual
(herramientas/paginas-producto.py) sin modificarlo. Solo lee la base de datos:
no escribe nada ni cambia ningún producto. La web antigua
(karivejoyas.github.io/catalogo) no se toca.

GitHub Actions lo corre con cada cambio y todas las noches
(.github/workflows/publicar.yml) y publica dist/ en GitHub Pages.
"""
import csv, html, importlib.util, json, os, re, shutil, sys, urllib.request
from datetime import date

RAIZ_REPO = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ_REPO)
spec = importlib.util.spec_from_file_location("gen", "herramientas/paginas-producto.py")
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

SITIO = "https://karivejoyas.cl/"
DIST = "dist"
EST = "estatico"
MARCA = gen.MARCA
WA = gen.WHATSAPP
IG, FBK = gen.INSTAGRAM, gen.FACEBOOK
ENV_RM, ENV_RESTO = gen.ENVIO_RM, gen.ENVIO_RESTO
VERSION = date.today().strftime("%Y%m%d")
e = lambda s: html.escape(str(s), quote=True)
pesos = gen.pesos

# los datos estructurados apuntan al dominio nuevo
gen.BASE = SITIO
gen.LOGO = SITIO + "assets/logo-karive.png"
gen.ORG_ID = SITIO + "#organizacion"
gen.WEB_ID = SITIO + "#sitio"


# ------------------------------------------------------------------ datos

def descuento_global():
    """Mismo criterio que kvDescuentoActivo (comun.js): si hay descuento general
    vigente, el precio de las tarjetas ya lo muestra."""
    try:
        with urllib.request.urlopen(gen.RAIZ + "/catalog/settings?mask.fieldPaths=descuentoGlobal&mask.fieldPaths=masVistos", timeout=40) as r:
            f = json.load(r).get("fields", {})
    except Exception:
        return None, []
    d = f.get("descuentoGlobal", {}).get("mapValue", {}).get("fields", {})
    pct, hasta = gen.valor(d.get("pct")), gen.valor(d.get("hasta")) or ""
    activo = bool(pct) and (not hasta or hasta >= date.today().isoformat())
    mv = f.get("masVistos", {}).get("mapValue", {}).get("fields", {})
    ids = [gen.valor(x) for x in mv.get("ids", {}).get("arrayValue", {}).get("values", [])] if gen.valor(mv.get("activo")) else []
    return (pct if activo else None), ids


def imagenes_colecciones():
    """La foto de portada de cada colección (vive en la base como base64)."""
    out = {}
    try:
        with urllib.request.urlopen(gen.RAIZ + "/catalog/settings?mask.fieldPaths=categorias", timeout=60) as r:
            vals = json.load(r).get("fields", {}).get("categorias", {}).get("arrayValue", {}).get("values", [])
    except Exception:
        return out
    os.makedirs(DIST + "/assets/colecciones", exist_ok=True)
    import base64
    for v in vals:
        f = v.get("mapValue", {}).get("fields", {})
        ident, img = gen.valor(f.get("id")), gen.valor(f.get("imagen")) or ""
        if not ident or not img:
            continue
        destino = DIST + "/assets/colecciones/%s.jpg" % gen.slug(ident)
        try:
            if img.startswith("data:"):
                open(destino, "wb").write(base64.b64decode(img.split(",", 1)[1]))
            elif os.path.exists(img):
                shutil.copy(img, destino)
            else:
                continue
            if gen.Image:
                im = gen.Image.open(destino).convert("RGB")
                if im.width > 900:
                    im = im.resize((900, round(im.height * 900 / im.width)), gen.Image.LANCZOS)
                im.save(destino[:-4] + ".webp", "WEBP", quality=80, method=6)
                out[ident] = "/assets/colecciones/%s.webp" % gen.slug(ident)
            else:
                out[ident] = "/assets/colecciones/%s.jpg" % gen.slug(ident)
        except Exception as err:
            print("sin imagen de colección", ident, err)
    return out


def precio_vigente(precio, oferta, pct):
    mejor = oferta if 0 < oferta < precio else 0
    if pct and precio:
        g = round(precio * (1 - pct / 100) / 10) * 10
        if 0 < g < precio and (not mejor or g < mejor):
            mejor = g
    return mejor


def cargar():
    info = gen.colecciones()
    campos = ["code", "name", "price", "priceOffer", "stock", "cantidad", "detail", "category", "order", "photo"]
    docs = gen.documentos("catalog/products/items", campos)
    if len(docs) < 20:
        sys.exit("Solo llegaron %d productos. Se aborta sin publicar nada." % len(docs))
    pct, mas_vistos = descuento_global()
    prods = []
    for doc in docs:
        f = doc.get("fields", {})
        p0 = {c: gen.valor(f.get(c)) for c in campos}
        cod = (p0.get("code") or "").strip()
        ruta = gen.foto_publica(cod, p0.get("photo") or "") if cod else None
        if not cod or not ruta or ruta.startswith("http"):
            continue
        cat = p0.get("category") or ""
        ic = info.get(cat, {"nombre": cat.capitalize() or "Otros", "sub": "", "orden": 99})
        precio, oferta = int(p0.get("price") or 0), int(p0.get("priceOffer") or 0)
        prods.append({
            "id": doc["name"].split("/")[-1], "codigo": cod, "nombre": gen.limpio(p0.get("name")),
            "medida": gen.limpio(p0.get("detail")), "cat": cat, "col": ic,
            "precio": precio, "oferta": oferta, "vigente": precio_vigente(precio, oferta, pct) or precio,
            "rebajado": bool(precio_vigente(precio, oferta, pct)),
            "hay": p0.get("stock") is True, "cantidad": p0.get("cantidad"), "orden": p0.get("order") or 0,
            "ruta": ruta, "dim": gen.medidas(ruta), "color": gen.color_de(p0.get("name")),
            "actualizado": (doc.get("updateTime") or "")[:10], "creado": doc.get("createTime") or "",
        })
    conteo = {}
    for p in prods:
        conteo[gen.sin_tildes(p["nombre"])] = conteo.get(gen.sin_tildes(p["nombre"]), 0) + 1
    for p in prods:
        p["repetido"] = conteo[gen.sin_tildes(p["nombre"])] > 1
    cols = []
    for cid, ic in sorted(info.items(), key=lambda kv: kv[1].get("orden", 99)):
        vis = sorted([p for p in prods if p["cat"] == cid and p["hay"]], key=lambda p: p["orden"])
        if vis:
            ic.update({"id": cid, "slug": gen.slug(ic["nombre"]), "_prods": vis})
            cols.append(ic)
    for p in prods:
        p["col"].setdefault("slug", gen.slug(p["col"]["nombre"]))
        p["col"].setdefault("id", p["cat"])
    return prods, cols, mas_vistos


# --------------------------------------------------------- fotos publicadas

def publicar_fotos(prods):
    """Copia a dist la foto original (Google, Merchant, foto ampliada) y crea
    las versiones WebP para las tarjetas y la ficha."""
    os.makedirs(DIST + "/assets/productos", exist_ok=True)
    for p in prods:
        nombre = os.path.basename(p["ruta"])
        shutil.copy(p["ruta"], DIST + "/assets/productos/" + nombre)
        p["foto"] = "/assets/productos/" + nombre
        p["foto_abs"] = SITIO + "assets/productos/" + nombre
        w800 = gen.webp(p["ruta"], 800)
        w480 = gen.webp(p["ruta"], 480)
        if w800 and w480:
            os.makedirs(DIST + "/assets/productos/w", exist_ok=True)
            for w in (w800, w480):
                shutil.copy(w, DIST + "/assets/productos/w/" + os.path.basename(w))
            p["img"] = "/assets/productos/w/" + os.path.basename(w800)
            p["img_chica"] = "/assets/productos/w/" + os.path.basename(w480)
        else:
            p["img"] = p["img_chica"] = p["foto"]
        p["url"] = "/p/%s.html" % p["codigo"]


# ------------------------------------------------------------ piezas comunes

ICONOS = {
    "buscar": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4" stroke-linecap="round"/></svg>',
    "carro": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7Z" stroke-linejoin="round"/><path d="M9 7a3 3 0 0 1 6 0" stroke-linecap="round"/></svg>',
    "menu": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/></svg>',
    "cerrar": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke-linecap="round"/></svg>',
    "wa": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z"/></svg>',
}

FUENTES = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
           '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@400;500;600&display=swap" media="print" onload="this.media=\'all\'">')


def cabeza(titulo, desc, ruta, imagen, jsonld=None, tipo="website", robots="index, follow, max-image-preview:large", extra=""):
    url = SITIO + ruta.lstrip("/")
    j = ('<script type="application/ld+json">%s</script>' % json.dumps(jsonld, ensure_ascii=False).replace("</", "<\\/")) if jsonld else ""
    return """<!doctype html>
<html lang="es-CL">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{t}</title>
<meta name="description" content="{d}">
<meta name="robots" content="{rob}">
<link rel="canonical" href="{u}">
<meta name="theme-color" content="#2A123E">
<meta property="og:type" content="{tipo}"><meta property="og:site_name" content="{m}"><meta property="og:locale" content="es_CL">
<meta property="og:title" content="{t}"><meta property="og:description" content="{d}"><meta property="og:url" content="{u}">
<meta property="og:image" content="{img}">{extra}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{t}"><meta name="twitter:description" content="{d}"><meta name="twitter:image" content="{img}">
<link rel="icon" href="/assets/logo-avatar.png" type="image/png"><link rel="apple-touch-icon" href="/assets/logo-avatar.png"><link rel="manifest" href="/manifest.webmanifest">
{fuentes}
<link rel="stylesheet" href="/estatico/tienda.css?v={v}">
{j}
</head>
""".format(t=e(titulo), d=e(desc), u=e(url), img=e(imagen), tipo=tipo, m=e(MARCA), rob=robots, fuentes=FUENTES, v=VERSION, j=j, extra=extra)


def encabezado(cols, actual=""):
    sub = "".join('<a href="/c/%s.html">%s</a>' % (e(c["slug"]), e(c["nombre"])) for c in cols)
    sub_movil = "".join('<a href="/c/%s.html">%s</a>' % (e(c["slug"]), e(c["nombre"])) for c in cols)
    marca = lambda k: ' aria-current="page"' if actual == k else ""
    return """<body>
<a class="sr" href="#contenido">Saltar al contenido</a>
<div class="anuncio">Envíos a todo Chile · <b>Hecho a mano en Santiago</b> · 3 meses de garantía</div>
<header class="cabecera">
  <div class="envoltura">
    <button class="icono hamburguesa" id="btn-menu" aria-label="Abrir menú">{i_menu}</button>
    <a class="logo" href="/"><img src="/assets/logo-karive-web.png" alt="{m}" width="89" height="44"></a>
    <nav class="menu" aria-label="Principal">
      <a href="/tienda/"{a1}>Tienda</a>
      <div class="desplegable"><button type="button" aria-expanded="false" aria-haspopup="true">Colecciones ▾</button><div class="desplegable-panel">{sub}<a href="/tienda/">Ver todo</a></div></div>
      <a href="/nosotros.html"{a2}>Nosotros</a>
      <a href="/preguntas-frecuentes.html"{a3}>Preguntas</a>
      <a href="/contacto.html"{a4}>Contacto</a>
    </nav>
    <div class="iconos">
      <button class="icono" id="btn-buscar" aria-label="Buscar">{i_buscar}</button>
      <button class="icono" id="btn-carro" aria-label="Ver carrito">{i_carro}<span class="contador" hidden>0</span></button>
    </div>
  </div>
</header>
<div class="cajon" id="cajon-menu" aria-label="Menú">
  <div class="cajon-fondo" data-cerrar="cajon-menu"></div>
  <div class="cajon-panel" role="dialog" aria-modal="true" aria-label="Menú">
    <div class="cajon-top"><img src="/assets/logo-karive-web.png" alt="{m}" width="89" height="44"><button class="icono" data-cerrar="cajon-menu" aria-label="Cerrar menú">{i_cerrar}</button></div>
    <nav aria-label="Menú del celular"><a href="/">Inicio</a><a href="/tienda/">Tienda</a><div class="sub">{sub_movil}</div>
      <a href="/nosotros.html">Nosotros</a><a href="/preguntas-frecuentes.html">Preguntas frecuentes</a><a href="/envios.html">Envíos</a><a href="/contacto.html">Contacto</a></nav>
  </div>
</div>
<div class="cajon" id="cajon-carro">
  <div class="cajon-fondo" data-cerrar="cajon-carro"></div>
  <div class="cajon-panel derecha" role="dialog" aria-modal="true" aria-label="Carrito">
    <div class="cajon-top"><h2 style="margin:0;font-size:28px">Tu carrito</h2><button class="icono" data-cerrar="cajon-carro" aria-label="Cerrar carrito">{i_cerrar}</button></div>
    <div id="carro-cuerpo"><p class="vacio">Cargando…</p></div>
  </div>
</div>
<div class="buscador" id="buscador" role="dialog" aria-modal="true" aria-label="Buscar">
  <div class="buscador-panel"><div class="buscador-campo"><input id="buscar-texto" type="search" placeholder="Buscar aros: corazón, flores, azul…" aria-label="Buscar productos" autocomplete="off">
    <button class="icono" data-cerrar-buscador aria-label="Cerrar buscador" onclick="document.getElementById('buscador').classList.remove('abierto');document.body.style.overflow=''">{i_cerrar}</button></div>
    <div id="buscar-res"></div></div>
</div>
<main id="contenido">
""".format(i_menu=ICONOS["menu"], i_buscar=ICONOS["buscar"], i_carro=ICONOS["carro"], i_cerrar=ICONOS["cerrar"], m=e(MARCA),
           sub=sub, sub_movil=sub_movil, a1=marca("tienda"), a2=marca("nosotros"), a3=marca("preguntas"), a4=marca("contacto"))


def pie(cols, scripts=""):
    return """</main>
<footer class="pie">
  <div class="envoltura">
    <div><a class="pie-logo" href="/"><img src="/assets/logo-karive-web.png" alt="{m}" width="105" height="52" loading="lazy"></a>
      <p style="margin-top:12px">Aros artesanales hechos a mano, uno por uno, en Santiago de Chile. Flores de arcilla, argollas de cristal, corazones, conchas y charms.</p>
      <p><a href="{ig}" rel="noopener">Instagram</a> · <a href="{fb}" rel="noopener">Facebook</a> · <a href="https://wa.me/{wa}">WhatsApp</a></p></div>
    <div><h3>Colecciones</h3><ul>{cols}<li><a href="/tienda/">Ver todo</a></li></ul></div>
    <div><h3>Ayuda</h3><ul><li><a href="/preguntas-frecuentes.html">Preguntas frecuentes</a></li><li><a href="/envios.html">Envíos</a></li>
      <li><a href="/devoluciones.html">Cambios y devoluciones</a></li><li><a href="/privacidad.html">Privacidad</a></li><li><a href="/contacto.html">Contacto</a></li></ul></div>
    <div><h3>Novedades</h3><p>Entérate primero de los modelos nuevos.</p>
      <form class="boletin" id="boletin"><input name="correo" type="email" placeholder="Tu correo" aria-label="Tu correo" required><button class="btn btn-oro" type="submit">Suscribirme</button></form>
      <div class="boletin-msg" id="boletin-msg" role="status"></div></div>
  </div>
  <div class="pie-final">© {anio} {m} · Hecho a mano en Chile 💜</div>
</footer>
<a class="wa-flota" href="https://wa.me/{wa}" aria-label="Escríbenos por WhatsApp" rel="noopener">{i_wa}</a>
<script src="/estatico/comun.js?v={v}" defer></script>
<script src="/estatico/tienda.js?v={v}" defer></script>{scripts}
</body>
</html>
""".format(m=e(MARCA), ig=IG, fb=FBK, wa=WA, anio=date.today().year, v=VERSION, scripts=scripts, i_wa=ICONOS["wa"],
           cols="".join('<li><a href="/c/%s.html">%s</a></li>' % (e(c["slug"]), e(c["nombre"])) for c in cols))


def tarjeta(p, i=0, lazy=True):
    etiqueta = ""
    if not p["hay"]:
        etiqueta = '<span class="etiqueta">Agotado</span>'
    elif p["rebajado"]:
        etiqueta = '<span class="etiqueta oro">Oferta</span>'
    elif p["cantidad"] is not None and 0 < p["cantidad"] <= 3:
        etiqueta = '<span class="etiqueta">Últimas</span>'
    precio = pesos(p["vigente"]) + (("<s>%s</s>" % pesos(p["precio"])) if p["rebajado"] else "")
    return ('<li class="tarjeta" data-tarjeta="{id}" data-col="{col}" data-precio="{pv}" data-i="{i}" data-n="{n}">'
            '<a class="tarjeta-foto" href="{url}"><img src="{img}" alt="{alt}" width="480" height="480"{lz}>{et}</a>'
            '<div class="tarjeta-txt"><a class="tarjeta-nombre" href="{url}">{nom}</a><span class="precio">{precio}</span>'
            '<div class="agregar"><button type="button" class="btn btn-2" data-agregar="{id}"{dis}>{txt}</button></div></div></li>').format(
        id=e(p["id"]), col=e(p["col"]["slug"]), pv=p["vigente"], i=i, n=p["creado"][:19].replace("-", "").replace(":", "").replace("T", ""),
        url=e(p["url"]), img=e(p["img_chica"]), alt=e("%s, aros hechos a mano – %s" % (p["nombre"], MARCA)),
        lz=' loading="lazy" decoding="async"' if lazy else "", et=etiqueta, nom=e(p["nombre"]), precio=precio,
        dis="" if p["hay"] else " disabled", txt="Agregar al carrito" if p["hay"] else "Agotado")


def escribir(ruta, contenido):
    destino = os.path.join(DIST, ruta.lstrip("/"))
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    open(destino, "w", encoding="utf-8").write(contenido)


# --------------------------------------------------------------- páginas

def portada(prods, cols, mas_vistos, img_cols):
    vis = [p for p in prods if p["hay"]]
    porid = {p["id"]: p for p in vis}
    nuevos = sorted(vis, key=lambda p: p["creado"], reverse=True)[:8]
    # favoritos: los que el panel marca como "lo más visto" y, para completar,
    # el primero de cada colección (sin repetir lo que ya sale en "lo nuevo")
    destacados = [porid[i] for i in mas_vistos if i in porid]
    ronda = 0
    while len(destacados) < 8 and ronda < 10:
        for c in cols:
            cand = [p for p in c["_prods"] if p not in destacados and p not in nuevos]
            if len(cand) > ronda and len(destacados) < 8:
                destacados.append(cand[ronda])
        ronda += 1
    jsonld = {"@context": "https://schema.org", "@graph": [
        gen.organizacion(),
        {"@type": "WebSite", "@id": SITIO + "#sitio", "url": SITIO, "name": MARCA, "inLanguage": "es-CL", "publisher": {"@id": SITIO + "#organizacion"},
         "potentialAction": {"@type": "SearchAction", "target": {"@type": "EntryPoint", "urlTemplate": SITIO + "tienda/?q={search_term_string}"},
                             "query-input": "required name=search_term_string"}},
        {"@type": "WebPage", "@id": SITIO + "#portada", "url": SITIO, "name": MARCA + " | Aros artesanales hechos a mano en Chile",
         "isPartOf": {"@id": SITIO + "#sitio"}, "about": {"@id": SITIO + "#organizacion"}, "inLanguage": "es-CL"},
    ]}
    tarj_cols = "".join(
        '<a class="coleccion" href="/c/{s}.html"><img src="{img}" alt="{alt}" loading="lazy" width="450" height="560"><span>{n}<small>{k} modelos</small></span></a>'.format(
            s=e(c["slug"]), img=e(img_cols.get(c["id"]) or c["_prods"][0]["img"]), alt=e(gen.SEO_COLECCION.get(c["id"], (c["nombre"],))[0]),
            n=e(c["nombre"]), k=len(c["_prods"])) for c in cols)
    h = cabeza(MARCA + " | Aros artesanales hechos a mano en Chile",
               "Aros artesanales hechos a mano en Santiago: flores de arcilla, argollas de cristal, corazones, conchas y charms. Compra online con envío a todo Chile.",
               "/", SITIO + "assets/modelo-portada.jpg", jsonld)
    h += encabezado(cols)
    h += """<section class="envoltura hero">
  <div class="hero-txt">
    <div class="antetitulo">Joyería artesanal · Santiago, Chile</div>
    <h1>Aros hechos a mano, uno por uno</h1>
    <p>Flores de arcilla polimérica, argollas de cristal, corazones y conchitas con base de acero. Piezas livianas, alegres y únicas, para usar todos los días o para regalar.</p>
    <div class="hero-acc"><a class="btn btn-1" href="/tienda/">Ver la tienda</a><a class="btn btn-2" href="#colecciones">Colecciones</a></div>
  </div>
  <div class="hero-img"><img src="/assets/modelo-portada.jpg" alt="Modelo usando aros de flor hechos a mano de Karivé Joyas" width="860" height="645" fetchpriority="high"><span class="hero-sello">✦ Hecho a mano en Chile</span></div>
</section>
<div class="envoltura"><div class="confianza">
  <div><span class="ic">🚚</span><span><b>Envíos a todo Chile</b>$2.990 RM · $3.990 regiones</span></div>
  <div><span class="ic">💳</span><span><b>Pago seguro</b>Mercado Pago o transferencia</span></div>
  <div><span class="ic">🛡️</span><span><b>3 meses de garantía</b>Si llega con falla, lo solucionamos</span></div>
  <div><span class="ic">✋</span><span><b>Hecho a mano</b>Cada par es único</span></div>
</div></div>
<section class="seccion envoltura" id="colecciones">
  <div class="seccion-cab"><div><div class="antetitulo">Colecciones</div><h2>Encuentra tu estilo</h2></div><a class="ver-todo" href="/tienda/">Ver todo →</a></div>
  <div class="colecciones">{cols}</div>
</section>
<section class="seccion envoltura">
  <div class="seccion-cab"><div><div class="antetitulo">Favoritos</div><h2>Los más queridos</h2></div><a class="ver-todo" href="/tienda/">Ver la tienda →</a></div>
  <ul class="grilla">{dest}</ul>
</section>
<section class="franja">
  <div class="envoltura">
    <img src="/assets/modelo-argollas.jpg" alt="Argollas de cristal hechas a mano por Karivé Joyas" loading="lazy" width="900" height="675">
    <div>
      <div class="antetitulo">Nuestro taller</div>
      <h2>Hechos a mano en Santiago, con calma y con cariño</h2>
      <p>Cada par de aros se modela, se hornea y se arma a mano. Por eso ningún par es idéntico a otro: esas pequeñas diferencias son parte de lo que los hace únicos.</p>
      <ol class="pasos">
        <li><span class="n">1</span><span>Elige tus favoritos y agrégalos al carrito.</span></li>
        <li><span class="n">2</span><span>Paga con tarjeta (Mercado Pago) o transferencia.</span></li>
        <li><span class="n">3</span><span>Los enviamos en su empaque, listos para regalar, a cualquier lugar de Chile.</span></li>
      </ol>
      <p style="margin-top:18px"><a class="btn btn-oro" href="/nosotros.html">Conoce Karivé</a></p>
    </div>
  </div>
</section>
<section class="seccion envoltura">
  <div class="seccion-cab"><div><div class="antetitulo">Recién llegados</div><h2>Lo nuevo del taller</h2></div><a class="ver-todo" href="/tienda/?orden=nuevos">Ver lo nuevo →</a></div>
  <ul class="grilla">{nuevos}</ul>
</section>
<section class="seccion envoltura" style="text-align:center">
  <div class="antetitulo">¿Buscas un diseño especial?</div>
  <h2>Hacemos tus colores favoritos</h2>
  <p style="max-width:560px;margin:0 auto 18px;color:var(--suave)">Si te gusta un modelo pero lo imaginas en otro color, escríbenos y lo creamos para ti.</p>
  <a class="btn btn-wa" href="https://wa.me/{wa}?text={wat}">{i_wa} Escríbenos por WhatsApp</a>
</section>
""".format(cols=tarj_cols, dest="".join(tarjeta(p, i) for i, p in enumerate(destacados[:8])),
           nuevos="".join(tarjeta(p, i) for i, p in enumerate(nuevos)), wa=WA, i_wa=ICONOS["wa"],
           wat=gen.urllib.parse.quote("¡Hola Karivé! Quiero consultar por un diseño en otros colores 💜"))
    h += pie(cols)
    escribir("index.html", h)


def tienda(prods, cols):
    vis = sorted([p for p in prods if p["hay"]], key=lambda p: (cols.index(next(c for c in cols if c["id"] == p["cat"])) if any(c["id"] == p["cat"] for c in cols) else 99, p["orden"]))
    jsonld = {"@context": "https://schema.org", "@graph": [
        gen.organizacion(),
        {"@type": "CollectionPage", "@id": SITIO + "tienda/", "url": SITIO + "tienda/", "name": "Tienda · " + MARCA, "isPartOf": {"@id": SITIO + "#sitio"},
         "mainEntity": {"@type": "ItemList", "numberOfItems": len(vis), "itemListElement": [
             {"@type": "ListItem", "position": i + 1, "url": SITIO + "p/%s.html" % p["codigo"], "name": p["nombre"]} for i, p in enumerate(vis)]}},
    ]}
    h = cabeza("Tienda de aros artesanales | " + MARCA,
               "Todos los aros hechos a mano de Karivé Joyas: %d modelos de flores, argollas de cristal, corazones, conchas y charms. Envío a todo Chile." % len(vis),
               "/tienda/", SITIO + "assets/modelo-portada.jpg", jsonld)
    h += encabezado(cols, "tienda")
    chips = '<button type="button" class="chip" data-filtro="">Todo</button>' + "".join(
        '<button type="button" class="chip" data-filtro="%s">%s</button>' % (e(c["slug"]), e(c["nombre"])) for c in cols)
    h += """<section class="envoltura" style="padding-top:28px">
  <div class="antetitulo">Tienda</div><h1>Aros hechos a mano</h1>
  <p style="color:var(--suave)"><span id="cuenta">{n} productos</span> · envío a todo Chile</p>
  <div class="filtros" role="group" aria-label="Filtrar por colección">{chips}
    <select id="orden" aria-label="Ordenar"><option value="recomendado">Recomendados</option><option value="nuevos">Más nuevos</option><option value="menor">Menor precio</option><option value="mayor">Mayor precio</option></select></div>
  <ul class="grilla" id="grilla-tienda">{tarj}</ul>
</section>
<script>(function(){{var o=new URLSearchParams(location.search).get('orden');if(o){{var s=document.getElementById('orden');if(s)s.value=o;}}}})();</script>
""".format(n=len(vis), chips=chips, tarj="".join(tarjeta(p, i, lazy=i > 7) for i, p in enumerate(vis)))
    h += pie(cols)
    escribir("tienda/index.html", h)


def coleccion(c, cols):
    h1, frase = gen.SEO_COLECCION.get(c["id"], ("Aros %s hechos a mano" % c["nombre"].lower(), "aros artesanales"))
    prods = c["_prods"]
    desde = min(p["vigente"] for p in prods)
    ruta = "/c/%s.html" % c["slug"]
    url = SITIO + ruta.lstrip("/")
    desc = "%s: %d modelos desde %s, hechos a mano en Santiago. Envío a todo Chile." % (h1, len(prods), pesos(desde))
    intro = "En %s hacemos %s a mano, uno por uno, en Santiago de Chile.%s" % (MARCA, frase, (" " + c["sub"].rstrip(".") + ".") if c.get("sub") else "")
    jsonld = {"@context": "https://schema.org", "@graph": [
        gen.organizacion(),
        {"@type": "CollectionPage", "@id": url, "url": url, "name": h1, "description": desc, "isPartOf": {"@id": SITIO + "#sitio"},
         "mainEntity": {"@type": "ItemList", "numberOfItems": len(prods), "itemListElement": [
             {"@type": "ListItem", "position": i + 1, "url": SITIO + "p/%s.html" % p["codigo"], "name": p["nombre"]} for i, p in enumerate(prods)]}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITIO},
            {"@type": "ListItem", "position": 2, "name": "Tienda", "item": SITIO + "tienda/"},
            {"@type": "ListItem", "position": 3, "name": c["nombre"], "item": url}]},
    ]}
    h = cabeza("%s | %s" % (h1, MARCA), desc, ruta, SITIO + prods[0]["img"].lstrip("/"), jsonld)
    h += encabezado(cols)
    otras = "".join('<a class="chip" href="/c/%s.html">%s</a>' % (e(o["slug"]), e(o["nombre"])) for o in cols if o["id"] != c["id"])
    h += """<div class="envoltura"><nav class="migas" aria-label="Estás en"><ol><li><a href="/">Inicio</a></li><li><a href="/tienda/">Tienda</a></li><li aria-current="page">{nom}</li></ol></nav>
  <div class="antetitulo">Colección {nom}</div><h1>{h1}</h1>
  <p style="max-width:720px;color:var(--suave)">{intro}</p>
  <ul class="grilla" style="margin-top:24px">{tarj}</ul>
  <h2 style="margin-top:48px">Otras colecciones</h2><div class="filtros">{otras}</div>
</div>
""".format(nom=e(c["nombre"]), h1=e(h1), intro=e(intro), tarj="".join(tarjeta(p, i, lazy=i > 3) for i, p in enumerate(prods)), otras=otras)
    h += pie(cols)
    escribir(ruta, h)


def producto(p, cols):
    col = p["col"]
    ruta = p["url"]
    url = SITIO + ruta.lstrip("/")
    etiqueta = p["nombre"] if not p["repetido"] else "%s (%s)" % (p["nombre"], p["codigo"])
    titulo = "%s | Aros hechos a mano | %s" % (etiqueta, MARCA)
    if len(titulo) > 65:
        titulo = "%s | %s" % (etiqueta, MARCA)
    partes = ["%s a %s: aros artesanales hechos a mano en Chile%s." % (etiqueta, pesos(p["vigente"]), (", " + p["medida"].lower()) if p["medida"] else ""),
              "Envío a todo Chile desde Santiago.", "Compra online o por WhatsApp."]
    while len(" ".join(partes)) > 158 and len(partes) > 1:
        partes.pop()
    desc = gen.corta(" ".join(partes), 158)
    alt = "%s, aros artesanales hechos a mano%s – %s" % (p["nombre"], (" color " + p["color"].lower()) if p["color"] else "", MARCA)
    texto = ("%s: aros artesanales de la colección %s, hechos a mano uno por uno en Santiago de Chile, con base de acero quirúrgico."
             % (p["nombre"], col["nombre"]))
    if col.get("sub"):
        texto += " " + col["sub"].rstrip(".") + "."
    faq = gen.preguntas(p["nombre"], p["medida"])
    otros = [q for q in col.get("_prods", []) if q["codigo"] != p["codigo"]][:4]
    w, hh = p["dim"] or (1000, 1000)
    prod = {
        "@type": "Product", "@id": url + "#producto", "name": p["nombre"], "sku": p["codigo"], "mpn": p["codigo"], "url": url,
        "description": texto, "category": "Joyería > Aros",
        "image": [{"@type": "ImageObject", "url": p["foto_abs"], "contentUrl": p["foto_abs"], "caption": alt, "width": w, "height": hh}],
        "brand": {"@type": "Brand", "name": MARCA}, "manufacturer": {"@id": SITIO + "#organizacion"}, "material": "Acero quirúrgico",
        "offers": {"@type": "Offer", "url": url, "priceCurrency": "CLP", "price": str(p["vigente"]),
                   "availability": "https://schema.org/%s" % ("InStock" if p["hay"] else "OutOfStock"),
                   "itemCondition": "https://schema.org/NewCondition", "seller": {"@id": SITIO + "#organizacion"},
                   "shippingDetails": gen.envios(), "hasMerchantReturnPolicy": gen.politica_devolucion()},
    }
    if p["color"]:
        prod["color"] = p["color"]
    jsonld = {"@context": "https://schema.org", "@graph": [
        gen.organizacion(), prod,
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITIO},
            {"@type": "ListItem", "position": 2, "name": col["nombre"], "item": SITIO + "c/%s.html" % col["slug"]},
            {"@type": "ListItem", "position": 3, "name": p["nombre"], "item": url}]},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]},
    ]}
    extra = ('<meta property="product:price:amount" content="%d"><meta property="product:price:currency" content="CLP">'
             '<meta property="product:availability" content="%s"><meta property="product:retailer_item_id" content="%s">'
             % (p["vigente"], "in stock" if p["hay"] else "out of stock", e(p["codigo"])))
    h = cabeza(titulo, desc, ruta, p["foto_abs"], jsonld, tipo="product", extra=extra)
    h += encabezado(cols)
    tope = p["cantidad"]
    stock_txt, stock_cls = ("Disponible · listo para enviar", "stock") if p["hay"] else ("Agotado por ahora", "stock no")
    if p["hay"] and tope is not None and 0 < tope <= 3:
        stock_txt, stock_cls = ("¡Queda solo 1!" if tope == 1 else "¡Quedan solo %d!" % tope), "stock pocas"
    precio = pesos(p["vigente"]) + (("<s>%s</s>" % pesos(p["precio"])) if p["rebajado"] else "")
    wa_txt = gen.urllib.parse.quote("¡Hola Karivé! Me interesan los %s (%s) 💜" % (p["nombre"], p["codigo"]))
    h += """<div class="envoltura">
<nav class="migas" aria-label="Estás en"><ol><li><a href="/">Inicio</a></li><li><a href="/c/{cs}.html">{cn}</a></li><li aria-current="page">{nom}</li></ol></nav>
<article class="ficha" data-ficha="{id}">
  <div class="ficha-foto" data-grande="{foto}" role="button" tabindex="0" aria-label="Ver la foto en grande">
    <picture><source srcset="{img}" type="image/webp"><img src="{foto}" alt="{alt}" width="{w}" height="{hh}" fetchpriority="high"></picture>
  </div>
  <div class="ficha-info">
    <div class="ficha-codigo">{cn} · {cod}</div>
    <h1>{nom}</h1>
    <div class="precio" id="ficha-precio">{precio}</div>
    <div class="{scls}" id="ficha-stock">{stxt}</div>
    <div class="comprar">
      <div class="cantidad"><button type="button" data-mas="-1" aria-label="Uno menos">−</button><span id="ficha-cantidad">1</span><button type="button" data-mas="1" aria-label="Uno más">+</button></div>
      <button type="button" class="btn btn-1" id="ficha-agregar" data-agregar="{id}" data-cantidad-de="#ficha-cantidad"{dis}>{btxt}</button>
    </div>
    <a class="btn btn-2 btn-bloque" href="https://wa.me/{wa}?text={wat}">Consultar por WhatsApp</a>
    <ul class="lista-confianza">
      <li>🚚 Envío a todo Chile: {rm} en la RM · {resto} a regiones</li>
      <li>💳 Paga con tarjeta (Mercado Pago) o transferencia</li>
      <li>🛡️ 3 meses de garantía por fallas · <a href="/devoluciones.html">ver política</a></li>
    </ul>
    <div class="acordeon">
      <details open><summary>Descripción</summary><p>{texto} Al ser piezas hechas a mano, cada par puede tener pequeñas diferencias: eso las hace únicas. Se envían en su empaque, listos para regalar.</p></details>
      <details><summary>Medidas y material</summary><ul>{medida}<li>Base de acero quirúrgico</li><li>Hecho a mano en Chile</li>{color}</ul></details>
      <details><summary>Envíos</summary><p>Despachamos desde Santiago a todo Chile: {rm} a la Región Metropolitana y {resto} al resto del país. <a href="/envios.html">Más sobre envíos</a>.</p></details>
      <details><summary>Cambios y garantía</summary><p>Si tu pedido llega con una falla, tienes 3 meses de garantía legal: lo cambiamos, lo reparamos o te devolvemos el dinero. Por higiene no hay cambios por arrepentimiento. <a href="/devoluciones.html">Política completa</a>.</p></details>
    </div>
  </div>
</article>
<section class="seccion" style="padding-top:20px"><h2>Preguntas frecuentes</h2><div class="faq">{faq}</div></section>
{rel}
</div>
""".format(cs=e(col["slug"]), cn=e(col["nombre"]), nom=e(p["nombre"]), id=e(p["id"]), foto=e(p["foto"]), img=e(p["img"]),
           alt=e(alt), w=w, hh=hh, cod=e(p["codigo"]), precio=precio, scls=stock_cls, stxt=stock_txt,
           dis="" if p["hay"] else " disabled", btxt="Agregar al carrito" if p["hay"] else "Agotado", wa=WA, wat=wa_txt,
           rm=pesos(ENV_RM), resto=pesos(ENV_RESTO), texto=e(texto),
           medida=("<li>Medida: %s</li>" % e(p["medida"])) if p["medida"] else "",
           color=("<li>Color: %s</li>" % e(p["color"])) if p["color"] else "",
           faq="".join("<details><summary>%s</summary><p>%s</p></details>" % (e(q), e(a)) for q, a in faq),
           rel=('<section class="seccion" style="padding-top:10px"><div class="seccion-cab"><h2>También te pueden gustar</h2><a class="ver-todo" href="/c/%s.html">Ver %s →</a></div><ul class="grilla">%s</ul></section>'
                % (e(col["slug"]), e(col["nombre"]), "".join(tarjeta(q, i) for i, q in enumerate(otros)))) if otros else "")
    h += pie(cols)
    escribir(ruta, h)


def pagina_texto(ruta, titulo, desc, cuerpo_html, cols, actual="", jsonld=None, robots="index, follow"):
    h = cabeza(titulo, desc, ruta, SITIO + "assets/modelo-portada.jpg", jsonld, robots=robots)
    h += encabezado(cols, actual)
    h += '<div class="envoltura"><div class="texto-pag">%s</div></div>\n' % cuerpo_html
    h += pie(cols)
    escribir(ruta, h)


PREGUNTAS_GENERALES = [
    ("¿De qué material son los aros?", "Los hacemos a mano con arcilla polimérica, cristales, mostacillas y otros materiales, siempre sobre una base de acero quirúrgico. Si tienes la piel muy sensible, escríbenos antes de comprar."),
    ("¿Hacen envíos a regiones?", "Sí, enviamos a todo Chile desde Santiago: $2.990 a la Región Metropolitana y $3.990 al resto del país. No tenemos retiro en tienda."),
    ("¿Cuánto demora mi pedido?", "Preparamos tu pedido apenas verificamos el pago y te avisamos cuando va en camino, con su número de seguimiento."),
    ("¿Cómo puedo pagar?", "Con tarjeta de débito o crédito a través de Mercado Pago, o por transferencia bancaria (en ese caso adjuntas el comprobante al terminar la compra)."),
    ("¿Puedo pedir un modelo en otros colores?", "Sí. Si te gusta un diseño pero lo imaginas en otro color, escríbenos por WhatsApp o Instagram y lo creamos para ti."),
    ("¿Qué pasa si mi pedido llega con una falla?", "Tienes 3 meses de garantía legal: lo cambiamos, lo reparamos o te devolvemos el dinero, y el envío de vuelta lo pagamos nosotros. Por higiene no aceptamos cambios por arrepentimiento."),
    ("¿Son iguales a las fotos?", "Sí, aunque al ser hechos a mano cada par puede tener pequeñas diferencias de tono o forma. Eso es parte de que sean únicos."),
    ("¿Sirven para regalo?", "¡Claro! Todos nuestros aros se envían en su empaque, listos para regalar."),
]


def paginas_texto(cols):
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in PREGUNTAS_GENERALES]}
    pagina_texto("/preguntas-frecuentes.html", "Preguntas frecuentes | " + MARCA,
                 "Respuestas sobre materiales, envíos a todo Chile, pagos, garantía y diseños a pedido de los aros hechos a mano de Karivé Joyas.",
                 '<div class="antetitulo">Ayuda</div><h1>Preguntas frecuentes</h1><div class="faq">' +
                 "".join("<details><summary>%s</summary><p>%s</p></details>" % (e(q), e(a)) for q, a in PREGUNTAS_GENERALES) +
                 '</div><p style="margin-top:24px">¿Te quedó alguna duda? <a href="/contacto.html">Escríbenos</a>.</p>', cols, "preguntas", faq_ld)

    pagina_texto("/nosotros.html", "Nosotros: joyería artesanal hecha a mano | " + MARCA,
                 "Karivé Joyas es un taller de joyería artesanal en Santiago de Chile: aros hechos a mano, uno por uno, con arcilla polimérica, cristales y base de acero.",
                 """<div class="antetitulo">Nosotros</div><h1>Accesorios que iluminan, hechos con amor</h1>
<p>Karivé Joyas nació en Santiago de Chile de las ganas de crear aros alegres, livianos y distintos a los que se encuentran en cualquier tienda.</p>
<p>Cada pieza se hace a mano, una por una, en nuestro taller: se modela la arcilla polimérica, se hornea, se lija, se pinta o se arma con cristales y mostacillas, y se monta sobre una base de acero. Por eso ningún par es exactamente igual a otro.</p>
<h2>Lo que hacemos</h2>
<ul><li><a href="/c/flores.html">Aros de flores</a> de arcilla polimérica, en muchos colores.</li><li><a href="/c/argollas-de-cristal.html">Argollas de cristal</a> hechas a mano.</li>
<li><a href="/c/corazones.html">Corazones</a> pequeños para el día a día.</li><li><a href="/c/marina.html">Conchitas y estrellas de mar</a>, inspiradas en la costa.</li>
<li><a href="/c/charms.html">Charms</a> y piezas para fechas especiales.</li></ul>
<h2>Cómo trabajamos</h2>
<p>Preferimos pocas piezas bien hechas a muchas iguales. Revisamos cada par antes de enviarlo y lo despachamos en su empaque, listo para regalar, a cualquier lugar de Chile.</p>
<p>Si sueñas con un diseño o un color especial, <a href="/contacto.html">escríbenos</a>: nos encanta crear piezas a pedido.</p>
<p style="margin-top:28px"><a class="btn btn-1" href="/tienda/">Ver la tienda</a></p>""", cols, "nosotros")

    pagina_texto("/contacto.html", "Contacto | " + MARCA,
                 "Escríbenos por WhatsApp, Instagram o correo. Respondemos dudas de modelos, medidas, envíos y diseños a pedido.",
                 """<div class="antetitulo">Contacto</div><h1>Conversemos</h1>
<p>¿Dudas sobre un modelo, una medida o tu pedido? Escríbenos por donde te acomode.</p>
<div class="contacto-grilla">
<a href="https://wa.me/{wa}"><b>WhatsApp</b>+56 9 8882 9803</a>
<a href="{ig}" rel="noopener"><b>Instagram</b>@karive.joyas</a>
<a href="mailto:karive.joyas@gmail.com"><b>Correo</b>karive.joyas@gmail.com</a>
</div>
<p>Somos una tienda en línea: despachamos desde Santiago a todo Chile y no tenemos retiro en tienda.</p>""".format(wa=WA, ig=IG), cols, "contacto")

    pagina_texto("/envios.html", "Envíos a todo Chile | " + MARCA,
                 "Enviamos a todo Chile desde Santiago: $2.990 a la Región Metropolitana y $3.990 al resto del país. Así funcionan los despachos de Karivé Joyas.",
                 """<div class="antetitulo">Ayuda</div><h1>Envíos</h1>
<table style="width:100%;border-collapse:collapse;margin:10px 0 20px"><tr><th style="text-align:left;padding:10px;border-bottom:1px solid var(--borde)">Destino</th><th style="text-align:right;padding:10px;border-bottom:1px solid var(--borde)">Costo</th></tr>
<tr><td style="padding:10px;border-bottom:1px solid var(--borde)">Región Metropolitana</td><td style="text-align:right;padding:10px;border-bottom:1px solid var(--borde)">$2.990</td></tr>
<tr><td style="padding:10px">Resto de Chile</td><td style="text-align:right;padding:10px">$3.990</td></tr></table>
<p>Despachamos desde Santiago. Preparamos tu pedido apenas verificamos el pago y te avisamos cuando va en camino, con su número de seguimiento.</p>
<p>No tenemos retiro en tienda. Si tu pedido no llega en el plazo estimado, escríbenos y lo rastreamos contigo; si se extravía, te lo reenviamos o te devolvemos el dinero.</p>""", cols)

    for archivo, actual in (("devoluciones.html", ""), ("privacidad.html", "")):
        crudo = open(archivo, encoding="utf-8").read()
        m = re.search(r'<div class="caja">(.*?)</div>\s*</body>', crudo, re.S)
        cuerpo = m.group(1) if m else ""
        cuerpo = re.sub(r'<div class="marca">.*?</div>', "", cuerpo, flags=re.S)
        cuerpo = cuerpo.replace('href="privacidad.html"', 'href="/privacidad.html"').replace('href="devoluciones.html"', 'href="/devoluciones.html"')
        t = re.search(r"<title>(.*?)</title>", crudo).group(1)
        d = re.search(r'name="description" content="(.*?)"', crudo)
        pagina_texto("/" + archivo, t, html.unescape(d.group(1)) if d else t, cuerpo, cols,
                     robots="index, follow" if archivo == "devoluciones.html" else "noindex, follow")

    pagina_texto("/finalizar-compra.html", "Finalizar compra | " + MARCA, "Completa tus datos y paga tu pedido de Karivé Joyas.",
                 '<h1 style="margin-bottom:0">Finalizar compra</h1>', cols, robots="noindex, nofollow")
    # la de pago necesita su propio contenedor y su script
    ruta = DIST + "/finalizar-compra.html"
    h = open(ruta, encoding="utf-8").read()
    h = h.replace('<div class="envoltura"><div class="texto-pag"><h1 style="margin-bottom:0">Finalizar compra</h1></div></div>',
                  '<div class="envoltura"><h1 style="margin:28px 0 0;font-size:40px">Finalizar compra</h1><div class="pago" id="pago"></div></div>')
    h = h.replace('<script src="/estatico/tienda.js?v=%s" defer></script>' % VERSION,
                  '<script src="/estatico/tienda.js?v=%s" defer></script>\n<script src="/estatico/compra.js?v=%s" defer></script>' % (VERSION, VERSION))
    open(ruta, "w", encoding="utf-8").write(h)

    pagina_texto("/404.html", "Página no encontrada | " + MARCA, "Esta página no existe.",
                 '<h1>No encontramos esta página</h1><p>Puede que el producto ya no esté disponible.</p><p><a class="btn btn-1" href="/tienda/">Ir a la tienda</a></p>',
                 cols, robots="noindex, follow")


# ---------------------------------------------------- archivos para buscadores

def archivos_buscadores(prods, cols):
    hoy = date.today().isoformat()
    vis = [p for p in prods]
    ult = max([p["actualizado"] for p in prods if p["actualizado"]] or [hoy])
    with open(DIST + "/sitemap.xml", "w", encoding="utf-8") as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n')
        for r in ["", "tienda/", "nosotros.html", "preguntas-frecuentes.html", "envios.html", "contacto.html", "devoluciones.html"]:
            fh.write("  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>\n" % (SITIO, r, ult))
        for c in cols:
            fh.write("  <url><loc>%sc/%s.html</loc><lastmod>%s</lastmod></url>\n" % (SITIO, c["slug"], ult))
        for p in sorted(vis, key=lambda p: p["codigo"]):
            fh.write("  <url><loc>%sp/%s.html</loc><lastmod>%s</lastmod><image:image><image:loc>%s</image:loc></image:image></url>\n"
                     % (SITIO, p["codigo"], p["actualizado"] or hoy, html.escape(p["foto_abs"])))
        fh.write("</urlset>\n")
    open(DIST + "/robots.txt", "w").write("User-agent: *\nAllow: /\nDisallow: /finalizar-compra.html\n\nSitemap: %ssitemap.xml\n" % SITIO)

    filas = []
    for p in sorted(prods, key=lambda p: (p["cat"], p["orden"])):
        filas.append({
            "id": p["codigo"], "title": gen.corta("%s – Aros artesanales hechos a mano | %s" % (p["nombre"], MARCA), 150),
            "description": ("%s de %s. Aros artesanales hechos a mano en Chile, con base de acero quirúrgico.%s Colección %s. Código %s."
                            % (p["nombre"], MARCA, (" Medida %s." % p["medida"].rstrip(".")) if p["medida"] else "", p["col"]["nombre"], p["codigo"])),
            "link": SITIO + "p/%s.html" % p["codigo"], "image_link": p["foto_abs"],
            "availability": "in_stock" if p["hay"] else "out_of_stock",
            "price": "%d CLP" % p["precio"], "sale_price": ("%d CLP" % p["vigente"]) if p["rebajado"] else "",
            "condition": "new", "brand": MARCA, "mpn": p["codigo"], "identifier_exists": "no",
            "google_product_category": gen.CAT_GOOGLE, "product_type": "Joyería > Aros > " + p["col"]["nombre"],
            "color": p["color"], "gender": "female", "age_group": "adult", "material": "Acero quirúrgico", "custom_label_0": p["col"]["nombre"],
        })
    with open(DIST + "/catalogo-google.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(filas[0].keys()))
        w.writeheader()
        w.writerows(filas)

    lineas = ["# %s" % MARCA, "", "> Joyería artesanal hecha a mano en Santiago, Chile. Aros de arcilla polimérica, argollas de cristal, corazones, "
              "conchitas y charms, con base de acero. Tienda online con envíos a todo Chile.", "",
              "- Tienda: %stienda/" % SITIO, "- Instagram: %s" % IG, "- Facebook: %s" % FBK, "- WhatsApp: +56 9 8882 9803",
              "- Envíos: a todo Chile desde Santiago ($2.990 Región Metropolitana, $3.990 resto de Chile). Sin retiro en tienda.",
              "- Pagos: tarjeta (Mercado Pago) o transferencia.", "- Garantía: 3 meses por fallas (%sdevoluciones.html)." % SITIO,
              "- Preguntas frecuentes: %spreguntas-frecuentes.html" % SITIO, "", "## Colecciones", ""]
    for c in cols:
        lineas.append("- [%s](%sc/%s.html): %s" % (c["nombre"], SITIO, c["slug"], c.get("sub") or ""))
    lineas += ["", "## Productos disponibles", ""]
    for c in cols:
        for p in c["_prods"]:
            lineas.append("- [%s](%sp/%s.html) (%s): %s%s" % (p["nombre"], SITIO, p["codigo"], p["codigo"], pesos(p["vigente"]), (", " + p["medida"]) if p["medida"] else ""))
    open(DIST + "/llms.txt", "w", encoding="utf-8").write("\n".join(lineas) + "\n")

    json.dump({"generado": hoy, "productos": [{
        "id": p["id"], "code": p["codigo"], "name": p["nombre"], "price": p["precio"], "priceOffer": p["oferta"],
        "category": p["cat"], "col": p["col"]["nombre"], "color": p["color"], "stock": p["hay"],
        **({"cantidad": p["cantidad"]} if p["cantidad"] is not None else {}),
        "img": p["img_chica"], "url": p["url"]} for p in prods]},
        open(DIST + "/productos.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    json.dump({"name": "Karivé Joyas", "short_name": "Karivé", "lang": "es-CL", "start_url": "/", "display": "standalone",
               "background_color": "#FBF7F1", "theme_color": "#2A123E",
               "icons": [{"src": "/assets/logo-avatar.png", "sizes": "512x512", "type": "image/png"}]},
              open(DIST + "/manifest.webmanifest", "w", encoding="utf-8"), ensure_ascii=False)

    # Cloudflare Pages: caché larga para fotos y estáticos; la dirección de
    # prueba (*.pages.dev) no se indexa, solo karivejoyas.cl
    open(DIST + "/_headers", "w").write(
        "https://:project.pages.dev/*\n  X-Robots-Tag: noindex\n\n"
        "/assets/*\n  Cache-Control: public, max-age=2592000\n\n"
        "/estatico/*\n  Cache-Control: public, max-age=604800\n\n"
        "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n")
    open(DIST + "/_redirects", "w").write("/catalogo/* /:splat 301\n/index.html / 301\n")


# ---------------------------------------------------------------- programa

def main():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST + "/estatico", exist_ok=True)
    for f in os.listdir(EST):
        shutil.copy(os.path.join(EST, f), DIST + "/estatico/" + f)
    shutil.copy("comun.js", DIST + "/estatico/comun.js")          # mismas reglas que el catálogo
    os.makedirs(DIST + "/assets", exist_ok=True)
    for f in ("logo-karive-web.png", "logo-karive.png", "logo-avatar.png", "modelo-portada.jpg", "modelo-argollas.jpg"):
        shutil.copy("assets/" + f, DIST + "/assets/" + f)

    prods, cols, mas_vistos = cargar()
    publicar_fotos(prods)
    img_cols = imagenes_colecciones()
    portada(prods, cols, mas_vistos, img_cols)
    tienda(prods, cols)
    for c in cols:
        coleccion(c, cols)
    for p in prods:
        producto(p, cols)
    paginas_texto(cols)
    archivos_buscadores(prods, cols)
    total = sum(len(fs) for _, _, fs in os.walk(DIST))
    print("productos: %d | colecciones: %d | archivos en %s: %d" % (len(prods), len(cols), DIST, total))


if __name__ == "__main__":
    main()
