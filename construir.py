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
import base64, csv, html, importlib.util, json, os, re, shutil, sys, urllib.error, urllib.request
from datetime import date

RAIZ_REPO = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ_REPO)
spec = importlib.util.spec_from_file_location("gen", "herramientas/paginas-producto.py")
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)
import tema as T

SITIO = "https://karivejoyas.cl/"
DIST = "dist"
EST = "estatico"
MARCA = gen.MARCA
# estos se completan en main() con lo que diga la base (panel → Configuración)
WA = gen.WHATSAPP
IG, FBK = gen.INSTAGRAM, gen.FACEBOOK
ENV_RM, ENV_RESTO = gen.ENVIO_RM, gen.ENVIO_RESTO
CORREO = "karive.joyas@gmail.com"
WA_MSG = ""
RESENAS = []
TEMA = T.TEMA_DEFECTO
VARS = {}
VERSION = date.today().strftime("%Y%m%d")
e = lambda s: html.escape(str(s), quote=True)
pesos = gen.pesos

# los datos estructurados apuntan al dominio nuevo
gen.BASE = SITIO
gen.LOGO = SITIO + "assets/logo-karive.png"
gen.ORG_ID = SITIO + "#organizacion"
gen.WEB_ID = SITIO + "#sitio"


# ------------------------------------------------------------------ datos

def fs_py(v):
    """Valor de la API REST de Firestore → valor de Python (con mapas y listas)."""
    if not isinstance(v, dict):
        return None
    if "mapValue" in v:
        return {k: fs_py(x) for k, x in v["mapValue"].get("fields", {}).items()}
    if "arrayValue" in v:
        return [fs_py(x) for x in v["arrayValue"].get("values", [])]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "nullValue" in v:
        return None
    for k in ("stringValue", "booleanValue", "doubleValue", "timestampValue"):
        if k in v:
            return v[k]
    return None


def leer_doc(ruta, campos=None):
    url = gen.RAIZ + "/" + ruta
    if campos:
        url += "?" + "&".join("mask.fieldPaths=%s" % c for c in campos)
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            return {k: fs_py(v) for k, v in json.load(r).get("fields", {}).items()}
    except urllib.error.HTTPError as err:
        print("No se pudo leer %s (%s): se usan los valores de fábrica" % (ruta, err.code))
    except Exception as err:
        print("No se pudo leer %s (%s): se usan los valores de fábrica" % (ruta, err))
    return {}


def solo_digitos(s):
    return re.sub(r"[^0-9]", "", str(s or ""))


def ajustes_tienda():
    """WhatsApp, redes, correo y envíos: lo que se edita en el panel."""
    global WA, IG, FBK, ENV_RM, ENV_RESTO, CORREO, WA_MSG, TEMA, VARS, RESENAS
    s = leer_doc("catalog/settings", ["whatsapp", "instagram", "facebook", "whatsappMsg", "envioTarifas", "resenas"])
    RESENAS = [r for r in (s.get("resenas") or []) if isinstance(r, dict) and r.get("producto")]
    wa = solo_digitos(s.get("whatsapp"))
    if len(wa) == 9:
        wa = "56" + wa
    if len(wa) >= 11:
        WA = wa
    ig = str(s.get("instagram") or "").strip()
    if ig:
        IG = ig if ig.startswith("http") else "https://www.instagram.com/%s/" % ig.lstrip("@").strip("/")
    fb = str(s.get("facebook") or "").strip()
    if fb:
        FBK = fb if fb.startswith("http") else "https://www.facebook.com/%s" % fb.lstrip("@")
    WA_MSG = s.get("whatsappMsg") or ""
    tar = s.get("envioTarifas") or {}
    if int(tar.get("rm") or 0) > 0:
        ENV_RM = int(tar["rm"])
    if int(tar.get("regiones") or 0) > 0:
        ENV_RESTO = int(tar["regiones"])
    web = leer_doc("catalog/web")
    TEMA = T.mezclar(T.TEMA_DEFECTO, web.get("tema") or {})
    CORREO = ((web.get("general") or {}).get("correo") or CORREO).strip()
    VARS = {"envio_rm": pesos(ENV_RM), "envio_regiones": pesos(ENV_RESTO)}


MEDIOS = {}

def imagen(ruta):
    """Ruta de una imagen del tema. Las que se suben desde el panel vienen
    como "medio:ID" y se guardan en catalog/web/medios/ID."""
    ruta = str(ruta or "")
    if not ruta.startswith("medio:"):
        return ruta
    ident = re.sub(r"[^A-Za-z0-9_-]", "", ruta[6:])
    if ident in MEDIOS:
        return MEDIOS[ident]
    MEDIOS[ident] = ""
    d = leer_doc("catalog/web/medios/" + ident, ["data"])
    data = d.get("data") or ""
    if not data.startswith("data:"):
        return ""
    os.makedirs(DIST + "/assets/medios", exist_ok=True)
    ext = "png" if data.startswith("data:image/png") else "jpg"
    destino = DIST + "/assets/medios/%s.%s" % (ident, ext)
    open(destino, "wb").write(base64.b64decode(data.split(",", 1)[1]))
    MEDIOS[ident] = "/assets/medios/%s.%s" % (ident, ext)
    if gen.Image and ext == "jpg":
        try:
            im = gen.Image.open(destino).convert("RGB")
            if im.width > 1600:
                im = im.resize((1600, round(im.height * 1600 / im.width)), gen.Image.LANCZOS)
            im.save(destino[:-4] + ".webp", "WEBP", quality=82, method=6)
            MEDIOS[ident] = "/assets/medios/%s.webp" % ident
        except Exception as err:
            print("medio sin webp", ident, err)
    return MEDIOS[ident]


def tx(s):
    return T.texto(s, VARS)


def tp(s):
    return T.plano(s, VARS)


def kv(ruta):
    """Marca un elemento para que el editor del panel lo actualice en vivo."""
    return ' data-kv="%s"' % ruta

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


COLOR_VARS = {"fondo": "--crema", "fondo2": "--crema2", "texto": "--tinta", "suave": "--suave", "borde": "--borde",
              "principal": "--morado", "oscuro": "--morado-osc", "lila": "--lila", "dorado": "--dorado", "doradoClaro": "--dorado-cl"}


def estilo_colores():
    c = TEMA.get("colores") or {}
    pares = ["%s:%s" % (var, c[k]) for k, var in COLOR_VARS.items() if re.match(r"^#[0-9A-Fa-f]{3,8}$", str(c.get(k) or ""))]
    return '<style id="kv-colores">:root{%s}</style>' % ";".join(pares)


def cabeza(titulo, desc, ruta, imagen_url, jsonld=None, tipo="website", robots="index, follow, max-image-preview:large", extra=""):
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
<meta name="theme-color" content="{tc}">
<meta property="og:type" content="{tipo}"><meta property="og:site_name" content="{m}"><meta property="og:locale" content="es_CL">
<meta property="og:title" content="{t}"><meta property="og:description" content="{d}"><meta property="og:url" content="{u}">
<meta property="og:image" content="{img}">{extra}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{t}"><meta name="twitter:description" content="{d}"><meta name="twitter:image" content="{img}">
<link rel="icon" href="/assets/logo-avatar.png" type="image/png"><link rel="apple-touch-icon" href="/assets/logo-avatar.png"><link rel="manifest" href="/manifest.webmanifest">
{fuentes}
<link rel="stylesheet" href="/estatico/tienda.css?v={v}">
{colores}
{j}
</head>
""".format(t=e(titulo), d=e(desc), u=e(url), img=e(imagen_url), tipo=tipo, m=e(MARCA), rob=robots, fuentes=FUENTES, v=VERSION, j=j, extra=extra,
           colores=estilo_colores(), tc=e((TEMA.get("colores") or {}).get("oscuro") or "#2A123E"))


ACTUAL_URL = {"tienda": "/tienda/", "nosotros": "/nosotros.html", "preguntas": "/preguntas-frecuentes.html", "contacto": "/contacto.html"}


def menu_html(cols, movil=False, actual=""):
    sub = "".join('<a href="/c/%s.html">%s</a>' % (e(c["slug"]), e(c["nombre"])) for c in cols)
    out = []
    for it in TEMA.get("menu") or []:
        t = e(it.get("texto") or "")
        if it.get("tipo") == "colecciones":
            if movil:
                out.append('<div class="sub">%s</div>' % sub)
            else:
                out.append('<div class="desplegable"><button type="button" aria-expanded="false" aria-haspopup="true">%s ▾</button>'
                           '<div class="desplegable-panel">%s<a href="/tienda/">Ver todo</a></div></div>' % (t, sub))
        else:
            u = it.get("url") or "/"
            out.append('<a href="%s"%s>%s</a>' % (e(u), ' aria-current="page"' if ACTUAL_URL.get(actual) == u else "", t))
    return "".join(out)


def encabezado(cols, actual=""):
    an = TEMA.get("anuncio") or {}
    pie_links = "".join('<a href="%s">%s</a>' % (e(it.get("url") or "/"), e(it.get("texto") or "")) for it in TEMA.get("menuPie") or [])
    return """<body>
<a class="sr" href="#contenido">Saltar al contenido</a>
<div class="anuncio"{an_kv}{an_oculto}>{an_txt}</div>
<header class="cabecera">
  <div class="envoltura">
    <button class="icono hamburguesa" id="btn-menu" aria-label="Abrir menú">{i_menu}</button>
    <a class="logo" href="/"><img src="/assets/logo-karive-web.png" alt="{m}" width="89" height="44"></a>
    <nav class="menu" aria-label="Principal" data-kv-lista="menu">{menu}</nav>
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
    <nav aria-label="Menú del celular"><a href="/">Inicio</a><span data-kv-lista="menu-movil">{menu_movil}</span><div class="sub sub-ayuda">{pie_links}</div></nav>
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
           menu=menu_html(cols, False, actual), menu_movil=menu_html(cols, True), pie_links=pie_links,
           an_kv=kv("anuncio.texto"), an_oculto="" if an.get("activo", True) else " hidden", an_txt=tx(an.get("texto")))


def pie(cols, scripts=""):
    pi = TEMA.get("pie") or {}
    ayuda = "".join('<li><a href="%s">%s</a></li>' % (e(it.get("url") or "/"), e(it.get("texto") or "")) for it in TEMA.get("menuPie") or [])
    flota = ('<a class="wa-flota" href="https://wa.me/%s" aria-label="Escríbenos por WhatsApp" rel="noopener" data-kv-si="whatsappFlotante">%s</a>' % (WA, ICONOS["wa"])) \
        if TEMA.get("whatsappFlotante", True) else ('<a class="wa-flota" hidden href="https://wa.me/%s" aria-label="Escríbenos por WhatsApp" data-kv-si="whatsappFlotante">%s</a>' % (WA, ICONOS["wa"]))
    return """</main>
<footer class="pie">
  <div class="envoltura">
    <div><a class="pie-logo" href="/"><img src="/assets/logo-karive-web.png" alt="{m}" width="105" height="52" loading="lazy"></a>
      <p style="margin-top:12px"{k_txt}>{txt}</p>
      <p><a href="{ig}" rel="noopener">Instagram</a> · <a href="{fb}" rel="noopener">Facebook</a> · <a href="https://wa.me/{wa}">WhatsApp</a></p></div>
    <div><h3>Colecciones</h3><ul>{cols}<li><a href="/tienda/">Ver todo</a></li></ul></div>
    <div><h3>Ayuda</h3><ul data-kv-lista="menuPie">{ayuda}</ul></div>
    <div><h3{k_bt}>{bt}</h3><p{k_bx}>{bx}</p>
      <form class="boletin" id="boletin"><input name="correo" type="email" placeholder="Tu correo" aria-label="Tu correo" required><button class="btn btn-oro" type="submit">Suscribirme</button></form>
      <div class="boletin-msg" id="boletin-msg" role="status"></div></div>
  </div>
  <div class="pie-final">© {anio} {m} · <span{k_fin}>{fin}</span></div>
</footer>
{flota}
<script src="/estatico/comun.js?v={v}" defer></script>
<script src="/estatico/tienda.js?v={v}" defer></script>{scripts}
</body>
</html>
""".format(m=e(MARCA), ig=e(IG), fb=e(FBK), wa=WA, anio=date.today().year, v=VERSION, scripts=scripts, flota=flota, ayuda=ayuda,
           txt=tx(pi.get("texto")), k_txt=kv("pie.texto"), bt=tx(pi.get("boletinTitulo")), k_bt=kv("pie.boletinTitulo"),
           bx=tx(pi.get("boletinTexto")), k_bx=kv("pie.boletinTexto"), fin=tx(pi.get("final")), k_fin=kv("pie.final"),
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

def boton(b, clase, ruta):
    b = b or {}
    return '<a class="btn %s" href="%s"%s>%s</a>' % (clase, e(b.get("url") or "/"), kv(ruta), e(b.get("texto") or ""))


def portada(prods, cols, mas_vistos, img_cols):
    P = TEMA["portada"]
    vis = [p for p in prods if p["hay"]]
    porid = {p["id"]: p for p in vis}
    n_nuevos = max(1, min(24, int(P["nuevos"].get("cantidad") or 8)))
    n_fav = max(1, min(24, int(P["favoritos"].get("cantidad") or 8)))
    nuevos = sorted(vis, key=lambda p: p["creado"], reverse=True)[:n_nuevos]
    # favoritos: los que el panel marca como "lo más visto" y, para completar,
    # el primero de cada colección (sin repetir lo que ya sale en "lo nuevo")
    destacados = [porid[i] for i in mas_vistos if i in porid]
    ronda = 0
    while len(destacados) < n_fav and ronda < 10:
        for c in cols:
            cand = [p for p in c["_prods"] if p not in destacados and p not in nuevos]
            if len(cand) > ronda and len(destacados) < n_fav:
                destacados.append(cand[ronda])
        ronda += 1
    seo = TEMA.get("seo") or {}
    jsonld = {"@context": "https://schema.org", "@graph": [
        gen.organizacion(),
        {"@type": "WebSite", "@id": SITIO + "#sitio", "url": SITIO, "name": MARCA, "inLanguage": "es-CL", "publisher": {"@id": SITIO + "#organizacion"},
         "potentialAction": {"@type": "SearchAction", "target": {"@type": "EntryPoint", "urlTemplate": SITIO + "tienda/?q={search_term_string}"},
                             "query-input": "required name=search_term_string"}},
        {"@type": "WebPage", "@id": SITIO + "#portada", "url": SITIO, "name": tp(seo.get("titulo")),
         "isPartOf": {"@id": SITIO + "#sitio"}, "about": {"@id": SITIO + "#organizacion"}, "inLanguage": "es-CL"},
    ]}
    tarj_cols = "".join(
        '<a class="coleccion" href="/c/{s}.html"><img src="{img}" alt="{alt}" loading="lazy" width="450" height="560"><span>{n}<small>{k} modelos</small></span></a>'.format(
            s=e(c["slug"]), img=e(img_cols.get(c["id"]) or c["_prods"][0]["img"]), alt=e(gen.SEO_COLECCION.get(c["id"], (c["nombre"],))[0]),
            n=e(c["nombre"]), k=len(c["_prods"])) for c in cols)
    img_seo = imagen(seo.get("imagen")) or "/assets/modelo-portada.jpg"
    h = cabeza(tp(seo.get("titulo")), tp(seo.get("descripcion")), "/", SITIO + img_seo.lstrip("/"), jsonld)
    h += encabezado(cols)

    H, C, CO, F, TA, N, ES = (P[k] for k in ("hero", "confianza", "colecciones", "favoritos", "taller", "nuevos", "especial"))
    sec = {}
    sec["hero"] = """<section class="envoltura hero">
  <div class="hero-txt">
    <div class="antetitulo"{k1}>{ante}</div>
    <h1{k2}>{tit}</h1>
    <p{k3}>{txt}</p>
    <div class="hero-acc">{b1}{b2}</div>
  </div>
  <div class="hero-img"><img src="{img}" alt="{alt}" width="860" height="645" fetchpriority="high" data-kv-img="portada.hero.imagen"><span class="hero-sello"{k4}>{sello}</span></div>
</section>""".format(k1=kv("portada.hero.antetitulo"), ante=tx(H.get("antetitulo")), k2=kv("portada.hero.titulo"), tit=tx(H.get("titulo")),
                     k3=kv("portada.hero.texto"), txt=tx(H.get("texto")), b1=boton(H.get("boton1"), "btn-1", "portada.hero.boton1"),
                     b2=boton(H.get("boton2"), "btn-2", "portada.hero.boton2"), img=e(imagen(H.get("imagen")) or "/assets/modelo-portada.jpg"),
                     alt=e(H.get("imagenAlt") or MARCA), k4=kv("portada.hero.sello"), sello=tx(H.get("sello")))
    sec["confianza"] = '<div class="envoltura"><div class="confianza" data-kv-lista="portada.confianza.items">%s</div></div>' % "".join(
        '<div><span class="ic">%s</span><span><b>%s</b>%s</span></div>' % (e(it.get("icono") or ""), tx(it.get("titulo")), tx(it.get("texto")))
        for it in C.get("items") or [])
    def cab(d, ruta, url, extra=""):
        return ('<div class="seccion-cab"><div><div class="antetitulo"%s>%s</div><h2%s>%s</h2></div><a class="ver-todo" href="%s"%s>%s</a></div>'
                % (kv(ruta + ".antetitulo"), tx(d.get("antetitulo")), kv(ruta + ".titulo"), tx(d.get("titulo")), url, kv(ruta + ".enlace"), tx(d.get("enlace"))))
    sec["colecciones"] = '<section class="seccion envoltura" id="colecciones">%s<div class="colecciones">%s</div></section>' % (
        cab(CO, "portada.colecciones", "/tienda/"), tarj_cols)
    sec["favoritos"] = '<section class="seccion envoltura">%s<ul class="grilla">%s</ul></section>' % (
        cab(F, "portada.favoritos", "/tienda/"), "".join(tarjeta(p, i) for i, p in enumerate(destacados[:n_fav])))
    sec["taller"] = """<section class="franja">
  <div class="envoltura">
    <img src="{img}" alt="{alt}" loading="lazy" width="900" height="675" data-kv-img="portada.taller.imagen">
    <div>
      <div class="antetitulo"{k1}>{ante}</div>
      <h2{k2}>{tit}</h2>
      <p{k3}>{txt}</p>
      <ol class="pasos" data-kv-lista="portada.taller.pasos">{pasos}</ol>
      <p style="margin-top:18px">{bt}</p>
    </div>
  </div>
</section>""".format(img=e(imagen(TA.get("imagen")) or "/assets/modelo-argollas.jpg"), alt=e(TA.get("imagenAlt") or MARCA),
                     k1=kv("portada.taller.antetitulo"), ante=tx(TA.get("antetitulo")), k2=kv("portada.taller.titulo"), tit=tx(TA.get("titulo")),
                     k3=kv("portada.taller.texto"), txt=tx(TA.get("texto")), bt=boton(TA.get("boton"), "btn-oro", "portada.taller.boton"),
                     pasos="".join('<li><span class="n">%d</span><span>%s</span></li>' % (i + 1, tx(x)) for i, x in enumerate(TA.get("pasos") or [])))
    sec["nuevos"] = '<section class="seccion envoltura">%s<ul class="grilla">%s</ul></section>' % (
        cab(N, "portada.nuevos", "/tienda/?orden=nuevos"), "".join(tarjeta(p, i) for i, p in enumerate(nuevos)))
    sec["especial"] = """<section class="seccion envoltura" style="text-align:center">
  <div class="antetitulo"{k1}>{ante}</div>
  <h2{k2}>{tit}</h2>
  <p style="max-width:560px;margin:0 auto 18px;color:var(--suave)"{k3}>{txt}</p>
  <a class="btn btn-wa" href="https://wa.me/{wa}?text={wat}">{i_wa} <span{k4}>{bt}</span></a>
</section>""".format(k1=kv("portada.especial.antetitulo"), ante=tx(ES.get("antetitulo")), k2=kv("portada.especial.titulo"), tit=tx(ES.get("titulo")),
                     k3=kv("portada.especial.texto"), txt=tx(ES.get("texto")), wa=WA, wat=gen.urllib.parse.quote(ES.get("mensaje") or ""),
                     i_wa=ICONOS["wa"], k4=kv("portada.especial.boton"), bt=tx(ES.get("boton")))
    orden = [k for k in (P.get("orden") or []) if k in sec] + [k for k in sec if k not in (P.get("orden") or [])]
    ocultas = set(P.get("ocultas") or [])
    h += '<div data-kv-secciones>\n'
    for k in orden:
        h += '<div data-kv-sec="%s"%s>%s</div>\n' % (k, " hidden" if k in ocultas else "", sec[k])
    h += '</div>\n'
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
    <ul class="lista-confianza" data-kv-lista="producto.beneficios">{benef}</ul>
    <div class="acordeon">
      <details open><summary>Descripción</summary><p>{texto} Al ser piezas hechas a mano, cada par puede tener pequeñas diferencias: eso las hace únicas. Se envían en su empaque, listos para regalar.</p></details>
      <details><summary>Medidas y material</summary><ul>{medida}<li>Base de acero quirúrgico</li><li>Hecho a mano en Chile</li>{color}</ul></details>
      <details><summary>Envíos</summary><p>Despachamos desde Santiago a todo Chile: {rm} a la Región Metropolitana y {resto} al resto del país. <a href="/envios.html">Más sobre envíos</a>.</p></details>
      <details><summary>Cambios y garantía</summary><p>Si tu pedido llega con una falla, tienes 3 meses de garantía legal: lo cambiamos, lo reparamos o te devolvemos el dinero. Por higiene no hay cambios por arrepentimiento. <a href="/devoluciones.html">Política completa</a>.</p></details>
    </div>
  </div>
</article>
{opiniones}<section class="seccion" style="padding-top:20px"><h2>Preguntas frecuentes</h2><div class="faq">{faq}</div></section>
{rel}
</div>
""".format(cs=e(col["slug"]), cn=e(col["nombre"]), nom=e(p["nombre"]), id=e(p["id"]), foto=e(p["foto"]), img=e(p["img"]),
           alt=e(alt), w=w, hh=hh, cod=e(p["codigo"]), precio=precio, scls=stock_cls, stxt=stock_txt,
           dis="" if p["hay"] else " disabled", btxt="Agregar al carrito" if p["hay"] else "Agotado", wa=WA, wat=wa_txt,
           rm=pesos(ENV_RM), resto=pesos(ENV_RESTO), texto=e(texto),
           opiniones=opiniones_html(p["id"]),
           benef="".join("<li>%s</li>" % tx(x) for x in (TEMA.get("producto") or {}).get("beneficios") or []),
           medida=("<li>Medida: %s</li>" % e(p["medida"])) if p["medida"] else "",
           color=("<li>Color: %s</li>" % e(p["color"])) if p["color"] else "",
           faq="".join("<details><summary>%s</summary><p>%s</p></details>" % (e(q), e(a)) for q, a in faq),
           rel=('<section class="seccion" style="padding-top:10px"><div class="seccion-cab"><h2>También te pueden gustar</h2><a class="ver-todo" href="/c/%s.html">Ver %s →</a></div><ul class="grilla">%s</ul></section>'
                % (e(col["slug"]), e(col["nombre"]), "".join(tarjeta(q, i) for i, q in enumerate(otros)))) if otros else "")
    h += pie(cols)
    escribir(ruta, h)


def opiniones_html(pid):
    lista = [r for r in RESENAS if r.get("producto") == pid]
    if not lista:
        return ""
    prom = sum(int(r.get("estrellas") or 0) for r in lista) / len(lista)
    est = lambda n: '<span class="estrellas" aria-label="%d de 5 estrellas">%s</span>' % (n, "★" * n + "☆" * (5 - n))
    return ('<section class="seccion opiniones" style="padding-top:20px"><h2>Opiniones</h2><p>%s <b>%s</b> · %d opinión%s</p>%s</section>'
            % (est(round(prom)), ("%.1f" % prom).replace(".", ","), len(lista), "" if len(lista) == 1 else "es",
               "".join('<div class="opinion">%s <b>%s</b><p>%s</p></div>' % (est(int(r.get("estrellas") or 0)), e(r.get("nombre") or ""), e(r.get("texto") or ""))
                       for r in sorted(lista, key=lambda r: r.get("fecha") or "", reverse=True))))


def pagina_texto(ruta, titulo, desc, cuerpo_html, cols, actual="", jsonld=None, robots="index, follow"):
    h = cabeza(titulo, desc, ruta, SITIO + "assets/modelo-portada.jpg", jsonld, robots=robots)
    h += encabezado(cols, actual)
    h += '<div class="envoltura"><div class="texto-pag">%s</div></div>\n' % cuerpo_html
    h += pie(cols)
    escribir(ruta, h)


def tabla_envios():
    td = 'style="padding:10px;border-bottom:1px solid var(--borde)"'
    return ('<table class="tabla-envios" style="width:100%%;border-collapse:collapse;margin:10px 0 20px"><tr><th style="text-align:left;padding:10px;border-bottom:1px solid var(--borde)">Destino</th>'
            '<th style="text-align:right;padding:10px;border-bottom:1px solid var(--borde)">Costo</th></tr>'
            '<tr><td %s>Región Metropolitana</td><td %s>%s</td></tr><tr><td style="padding:10px">Resto de Chile</td><td style="text-align:right;padding:10px">%s</td></tr></table>'
            % (td, td.replace('style="', 'style="text-align:right;'), pesos(ENV_RM), pesos(ENV_RESTO)))


def tarjetas_contacto():
    ig = IG.rstrip("/").split("/")[-1]
    wa = WA[2:] if WA.startswith("56") else WA
    wa_txt = "+56 %s %s %s" % (wa[:1], wa[1:5], wa[5:]) if len(wa) == 9 else "+" + WA
    return ('<div class="contacto-grilla"><a href="https://wa.me/%s"><b>WhatsApp</b>%s</a><a href="%s" rel="noopener"><b>Instagram</b>@%s</a>'
            '<a href="mailto:%s"><b>Correo</b>%s</a></div>' % (WA, e(wa_txt), e(IG), e(ig), e(CORREO), e(CORREO)))


def html_pagina(s):
    """HTML de una página escrita en el panel, con sus {variables}."""
    return T.reemplazos(str(s or ""), dict(VARS, tabla_envios=tabla_envios(), tarjetas_contacto=tarjetas_contacto()))


def pagina_tema(clave, ruta, actual="", jsonld=None, robots="index, follow"):
    pg = TEMA["paginas"][clave]
    cuerpo = ('<div class="antetitulo"%s>%s</div><h1%s>%s</h1><div class="pagina-html" data-kv-html="paginas.%s.html">%s</div>'
              % (kv("paginas.%s.antetitulo" % clave), tx(pg.get("antetitulo")), kv("paginas.%s.titulo" % clave), tx(pg.get("titulo")),
                 clave, html_pagina(pg.get("html"))))
    pagina_texto(ruta, tp(pg.get("seoTitulo") or (pg.get("titulo") + " | " + MARCA)), tp(pg.get("seoDesc") or pg.get("titulo")),
                 cuerpo, cols_global, actual, jsonld, robots)


def legales_por_defecto():
    """Devoluciones y privacidad: si en el panel no se escribió nada, se usa el
    texto de las páginas del catálogo antiguo."""
    for archivo in ("devoluciones", "privacidad"):
        pg = TEMA["paginas"][archivo]
        if (pg.get("html") or "").strip():
            continue
        crudo = open(archivo + ".html", encoding="utf-8").read()
        m = re.search(r'<div class="caja">(.*?)</div>\s*</body>', crudo, re.S)
        cuerpo = m.group(1) if m else ""
        cuerpo = re.sub(r'<div class="marca">.*?</div>', "", cuerpo, flags=re.S)
        cuerpo = cuerpo.replace('href="privacidad.html"', 'href="/privacidad.html"').replace('href="devoluciones.html"', 'href="/devoluciones.html"')
        t = re.search(r"<h1>(.*?)</h1>", cuerpo, re.S)
        cuerpo = re.sub(r"\s*<h1>.*?</h1>", "", cuerpo, count=1, flags=re.S).strip()
        d = re.search(r'name="description" content="(.*?)"', crudo)
        tt = re.search(r"<title>(.*?)</title>", crudo).group(1)
        pg.update({"titulo": pg.get("titulo") or (html.unescape(t.group(1)) if t else tt), "antetitulo": pg.get("antetitulo") or "Ayuda",
                   "seoTitulo": pg.get("seoTitulo") or tt.replace("·", "|"),
                   "seoDesc": pg.get("seoDesc") or (html.unescape(d.group(1)) if d else tt), "html": cuerpo})


cols_global = []


def paginas_texto(cols):
    global cols_global
    cols_global = cols
    pq = TEMA["paginas"]["preguntas"]
    items = [it for it in pq.get("items") or [] if it.get("q")]
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": tp(it["q"]), "acceptedAnswer": {"@type": "Answer", "text": tp(it.get("a"))}} for it in items]}
    pagina_texto("/preguntas-frecuentes.html", tp(pq.get("seoTitulo")), tp(pq.get("seoDesc")),
                 '<div class="antetitulo"%s>%s</div><h1%s>%s</h1><div class="faq" data-kv-lista="paginas.preguntas.items">' % (
                     kv("paginas.preguntas.antetitulo"), tx(pq.get("antetitulo")), kv("paginas.preguntas.titulo"), tx(pq.get("titulo"))) +
                 "".join("<details><summary>%s</summary><p>%s</p></details>" % (tx(it["q"]), tx(it.get("a"))) for it in items) +
                 '</div><p style="margin-top:24px">¿Te quedó alguna duda? <a href="/contacto.html">Escríbenos</a>.</p>', cols, "preguntas", faq_ld)
    pagina_tema("nosotros", "/nosotros.html", "nosotros")
    pagina_tema("contacto", "/contacto.html", "contacto")
    pagina_tema("envios", "/envios.html")
    legales_por_defecto()
    pagina_tema("devoluciones", "/devoluciones.html")
    pagina_tema("privacidad", "/privacidad.html", robots="noindex, follow")
    for x in TEMA["paginas"].get("extra") or []:
        slug = gen.slug(x.get("slug") or x.get("titulo") or "")
        if not slug or x.get("visible") is False:
            continue
        TEMA["paginas"]["_x_" + slug] = x
        pagina_tema("_x_" + slug, "/paginas/%s.html" % slug)

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
        for x in TEMA["paginas"].get("extra") or []:
            slug = gen.slug(x.get("slug") or x.get("titulo") or "")
            if slug and x.get("visible") is not False:
                fh.write("  <url><loc>%spaginas/%s.html</loc><lastmod>%s</lastmod></url>\n" % (SITIO, slug, ult))
        for c in cols:
            fh.write("  <url><loc>%sc/%s.html</loc><lastmod>%s</lastmod></url>\n" % (SITIO, c["slug"], ult))
        for p in sorted(vis, key=lambda p: p["codigo"]):
            fh.write("  <url><loc>%sp/%s.html</loc><lastmod>%s</lastmod><image:image><image:loc>%s</image:loc></image:image></url>\n"
                     % (SITIO, p["codigo"], p["actualizado"] or hoy, html.escape(p["foto_abs"])))
        fh.write("</urlset>\n")
    open(DIST + "/robots.txt", "w").write("User-agent: *\nAllow: /\nDisallow: /finalizar-compra.html\nDisallow: /admin/\n\nSitemap: %ssitemap.xml\n" % SITIO)

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
              "- Tienda: %stienda/" % SITIO, "- Instagram: %s" % IG, "- Facebook: %s" % FBK, "- WhatsApp: +%s" % WA,
              "- Envíos: a todo Chile desde Santiago (%s Región Metropolitana, %s resto de Chile). Sin retiro en tienda." % (pesos(ENV_RM), pesos(ENV_RESTO)),
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


# ------------------------------------------------------------------ panel

def panel():
    """El panel de administración (dist/admin) y el tema tal como quedó
    publicado, para que el editor parta desde lo que se ve en la web."""
    shutil.copytree("admin", DIST + "/admin")
    import time
    ix = DIST + "/admin/index.html"
    contenido = open(ix, encoding="utf-8").read().replace("__V__", str(int(time.time())))
    open(ix, "w", encoding="utf-8").write(contenido)
    t = {k: v for k, v in TEMA.items()}
    t["paginas"] = {k: v for k, v in TEMA["paginas"].items() if not k.startswith("_x_")}
    json.dump({"tema": t, "defecto": T.TEMA_DEFECTO, "secciones": T.SECCIONES_PORTADA, "generado": date.today().isoformat(),
               "envio": {"rm": ENV_RM, "regiones": ENV_RESTO}, "whatsapp": WA, "instagram": IG, "facebook": FBK, "correo": CORREO},
              open(DIST + "/admin/tema-actual.json", "w", encoding="utf-8"), ensure_ascii=False)


# ---------------------------------------------------------------- programa

def main():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    ajustes_tienda()
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
    panel()
    total = sum(len(fs) for _, _, fs in os.walk(DIST))
    print("productos: %d | colecciones: %d | archivos en %s: %d" % (len(prods), len(cols), DIST, total))


if __name__ == "__main__":
    main()
