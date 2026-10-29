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
import base64, csv, html, importlib.util, json, os, re, shutil, sys, urllib.error, urllib.parse, urllib.request
from datetime import date

RAIZ_REPO = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAIZ_REPO)
spec = importlib.util.spec_from_file_location("gen", "herramientas/paginas-producto.py")
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)
import tema as T

_organizacion = gen.organizacion


def _organizacion_web():
    """La de paginas-producto.py, con la descripción de la web nueva."""
    o = _organizacion()
    o["description"] = ("Joyería artesanal hecha a mano en Chile: aros de arcilla polimérica, argollas de cristal y mostacillas, "
                        "corazones, conchitas y charms. Envíos a todo Chile.")
    return o


gen.organizacion = _organizacion_web

SITIO = "https://karivejoyas.cl/"
DIST = "dist"
EST = "estatico"
MARCA = gen.MARCA
# estos se completan en main() con lo que diga la base (panel → Configuración)
WA = gen.WHATSAPP
IG, FBK = gen.INSTAGRAM, gen.FACEBOOK
ENV_RM, ENV_RESTO = gen.ENVIO_RM, gen.ENVIO_RESTO
ENV_POR_REGION = {}          # Configuración → Envío: precio de cada región (si se fijó)
REGIONES = ["Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso", "Metropolitana de Santiago",
            "O'Higgins", "Maule", "Ñuble", "Biobío", "La Araucanía", "Los Ríos", "Los Lagos", "Aysén", "Magallanes"]
REGION_RM = "Metropolitana de Santiago"


def envio_de(region):
    """Lo mismo que kvEnvioDe() en comun.js."""
    n = ENV_POR_REGION.get(region) or 0
    if n > 0:
        return n
    return ENV_RM if region == REGION_RM else ENV_RESTO


# códigos ISO de las regiones y días hábiles que tarda Blue Express desde Santiago
REGION_ISO = {"Arica y Parinacota": "CL-AP", "Tarapacá": "CL-TA", "Antofagasta": "CL-AN", "Atacama": "CL-AT", "Coquimbo": "CL-CO",
              "Valparaíso": "CL-VS", "Metropolitana de Santiago": "CL-RM", "O'Higgins": "CL-LI", "Maule": "CL-ML", "Ñuble": "CL-NB",
              "Biobío": "CL-BI", "La Araucanía": "CL-AR", "Los Ríos": "CL-LR", "Los Lagos": "CL-LL", "Aysén": "CL-AI", "Magallanes": "CL-MA"}
DIAS_TRANSITO = {"Metropolitana de Santiago": (1, 1), "Arica y Parinacota": (3, 4), "Tarapacá": (2, 3), "Antofagasta": (2, 3),
                 "Aysén": (8, 10), "Magallanes": (10, 12)}
ENVIOS_SCHEMA = []


def envios_schema():
    """Envío para los datos de Google (OfferShippingDetails): las mismas tarifas
    por región que cobra la web, con preparación de 1 a 2 días y el tránsito de
    Blue Express. Las regiones con igual precio y plazo van juntas."""
    grupos = {}
    for r in REGIONES:
        grupos.setdefault((envio_de(r), DIAS_TRANSITO.get(r, (2, 3))), []).append(REGION_ISO[r])
    dias = lambda a, b: {"@type": "QuantitativeValue", "minValue": a, "maxValue": b, "unitCode": "DAY"}
    return [{"@type": "OfferShippingDetails",
             "shippingRate": {"@type": "MonetaryAmount", "value": precio, "currency": "CLP"},
             "shippingDestination": [{"@type": "DefinedRegion", "addressCountry": "CL", "addressRegion": iso} for iso in isos],
             "deliveryTime": {"@type": "ShippingDeliveryTime", "handlingTime": dias(1, 2), "transitTime": dias(*transito)}}
            for (precio, transito), isos in grupos.items()]


def envio_rango():
    otras = [envio_de(r) for r in REGIONES if r != REGION_RM]
    todas = otras + [envio_de(REGION_RM)]
    return min(todas), max(todas), min(otras), max(otras)
CORREO = "karive.joyas@gmail.com"
WA_MSG = ""
RESENAS = []
TEMA = T.TEMA_DEFECTO
VARS = {}
import time as _time
VERSION = _time.strftime("%Y%m%d%H%M%S", _time.gmtime())   # cambia en cada publicación: el navegador no usa copias viejas
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


# Lo que la web necesita para vender (los mismos campos públicos que lee
# tienda.js). Se publica una copia en /ajustes.json: si un día la base no
# responde (por ejemplo, si se acaba la cuota diaria), el carrito y el pago
# siguen funcionando con esta copia.
CAMPOS_AJUSTES = ["igPubUrl", "pedidos", "pagos", "cupones", "bienvenida", "descuentoGlobal", "whatsapp", "instagram", "facebook", "whatsappMsg", "envioTarifas"]


def ajustes_respaldo():
    d = leer_doc("catalog/settings", CAMPOS_AJUSTES)
    if not d.get("igPubUrl"):
        print("⚠ No se pudo leer la configuración para el respaldo; se deja el anterior si existe.")
        try:
            with urllib.request.urlopen((os.environ.get("SITIO_ACTUAL") or SITIO).rstrip("/") + "/ajustes.json", timeout=30) as r:
                d = json.load(r)
        except Exception:
            return
    json.dump(d, open(DIST + "/ajustes.json", "w"), ensure_ascii=False)


def solo_digitos(s):
    return re.sub(r"[^0-9]", "", str(s or ""))


def ajustes_tienda():
    """WhatsApp, redes, correo y envíos: lo que se edita en el panel."""
    global WA, IG, FBK, ENV_RM, ENV_RESTO, ENV_POR_REGION, CORREO, WA_MSG, TEMA, VARS, RESENAS
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
    for r, n in (tar.get("porRegion") or {}).items():
        try:
            if int(n or 0) > 0:
                ENV_POR_REGION[r] = int(n)
        except (TypeError, ValueError):
            pass
    web = leer_doc("catalog/web")
    TEMA = T.actualizar_textos(T.migrar(T.mezclar(T.TEMA_DEFECTO, web.get("tema") or {})))
    CORREO = ((web.get("general") or {}).get("correo") or CORREO).strip()
    VARS = variables_envio()


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
    campos = ["code", "name", "price", "priceOffer", "stock", "cantidad", "detail", "category", "order", "photo", "color"]
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
            "ruta": ruta, "dim": gen.medidas(ruta), "color": str(p0.get("color") or "").strip() or gen.color_de(p0.get("name")),
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
    "carro": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.3 8h11.4a1 1 0 0 1 1 1.1l-.9 9.9a2.2 2.2 0 0 1-2.2 2H8.4a2.2 2.2 0 0 1-2.2-2l-.9-9.9a1 1 0 0 1 1-1.1Z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/></svg>',
    "abajo": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    "menu": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/></svg>',
    "cerrar": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke-linecap="round"/></svg>',
    "wa": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z"/></svg>',
}

FUENTES = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
           '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cabin:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap" media="print" onload="this.media=\'all\'">')


COLOR_VARS = {"fondo": "--crema", "fondo2": "--crema2", "texto": "--tinta", "suave": "--suave", "borde": "--borde",
              "principal": "--morado", "oscuro": "--morado-osc", "lila": "--lila", "dorado": "--dorado", "doradoClaro": "--dorado-cl"}


def estilo_colores():
    c = TEMA.get("colores") or {}
    pares = ["%s:%s" % (var, c[k]) for k, var in COLOR_VARS.items() if re.match(r"^#[0-9A-Fa-f]{3,8}$", str(c.get(k) or ""))]
    pares += ["%s:%dpx" % (var, n) for var, n in medidas_tema().items()]
    ola = str((TEMA.get("olas") or {}).get("color") or "")
    if re.match(r"^#[0-9A-Fa-f]{3,8}$", ola):
        pares.append("--ola-color:" + ola)
    return '<style id="kv-colores">:root{%s}</style>' % ";".join(pares)


def entero(v, defecto, minimo, maximo):
    try:
        return max(minimo, min(maximo, int(float(v))))
    except (TypeError, ValueError):
        return defecto


def medidas_tema():
    """Tamaños que se ajustan en Personalizar (logo y olas), en píxeles."""
    lo, ol = TEMA.get("logo") or {}, TEMA.get("olas") or {}
    return {"--logo-h": entero(lo.get("alto"), 44, 28, 110), "--logo-hm": entero(lo.get("altoMovil"), 38, 24, 80),
            "--logo-pie": entero(lo.get("altoPie"), 52, 30, 120),
            "--ola": entero(ol.get("alto"), 110, 30, 220), "--ola-m": entero(ol.get("altoMovil"), 64, 20, 160)}


def efectos():
    ef = TEMA.get("efectos") or {}
    por = ef.get("portada") if ef.get("portada") in T.EFECTOS_PORTADA else "destello"
    tr = ef.get("transicion") if ef.get("transicion") in T.TRANSICIONES else "profundidad"
    return por, tr


def cabeza(titulo, desc, ruta, imagen_url, jsonld=None, tipo="website", robots="index, follow, max-image-preview:large", extra=""):
    url = SITIO + ruta.lstrip("/")
    j = ('<script type="application/ld+json">%s</script>' % json.dumps(jsonld, ensure_ascii=False).replace("</", "<\\/")) if jsonld else ""
    ef_por, ef_tr = efectos()
    # transición al pasar de una página a otra (navegadores que la soportan);
    # en el celular no: Safari del iPhone dejaba un recuadro blanco en la cabecera
    vt = "" if ef_tr == "ninguna" else '<style id="kv-transicion">@media (prefers-reduced-motion:no-preference) and (min-width:768px){@view-transition{navigation:auto}}</style>\n'
    return """<!doctype html>
<html lang="es-CL" data-ef-portada="{ef_por}" data-tr="{ef_tr}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{t}</title>
<meta name="description" content="{d}">
<meta name="robots" content="{rob}">
<meta name="google-site-verification" content="gntO12xw5MtwsQ7yMhAah_xzH_QfZygK2XTzN83ulyM">
<meta name="google-site-verification" content="SiVit-HXZLFAfeKjKZUczVcrXe4KV9qn7xE_ECb6DeA">
<link rel="canonical" href="{u}">
<meta name="theme-color" content="{tc}">
<meta property="og:type" content="{tipo}"><meta property="og:site_name" content="{m}"><meta property="og:locale" content="es_CL">
<meta property="og:title" content="{t}"><meta property="og:description" content="{d}"><meta property="og:url" content="{u}">
<meta property="og:image" content="{img}">{extra}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{t}"><meta name="twitter:description" content="{d}"><meta name="twitter:image" content="{img}">
<link rel="icon" href="/assets/logo-avatar.png" type="image/png"><link rel="apple-touch-icon" href="/assets/logo-avatar.png"><link rel="manifest" href="/manifest.webmanifest">
{fuentes}
<link rel="stylesheet" href="/estatico/tienda.css?v={v}">
<link rel="stylesheet" href="/estatico/diseno.css?v={v}">
{vt}<meta name="kv-version" content="{v}">
<script>document.documentElement.classList.add('js');setTimeout(function(){{if(!window.kvRevela)document.documentElement.classList.add('revelar-todo')}},2500);
addEventListener('pagereveal',function(e){{var n=window.navigation&&navigation.activation,h=document.documentElement;if(!e.viewTransition||!n||n.navigationType!=='traverse')return;h.dataset.dir='atras';e.viewTransition.finished.finally(function(){{delete h.dataset.dir}})}})</script>
{colores}
{j}
</head>
""".format(t=e(titulo), d=e(desc), u=e(url), img=e(imagen_url), tipo=tipo, m=e(MARCA), rob=robots, fuentes=FUENTES, v=VERSION, j=j, extra=extra,
           colores=estilo_colores(), tc=e((TEMA.get("colores") or {}).get("oscuro") or "#2A123E"), ef_por=ef_por, ef_tr=ef_tr, vt=vt)


ACTUAL_URL = {"tienda": "/tienda/", "nosotros": "/nosotros.html", "preguntas": "/preguntas-frecuentes.html", "contacto": "/contacto.html"}


def menu_html(cols, movil=False, actual=""):
    sub = "".join('<a href="/c/%s.html">%s</a>' % (e(c["slug"]), e(c["nombre"])) for c in cols)
    out = []
    for it in TEMA.get("menu") or []:
        t = e(it.get("texto") or "")
        if it.get("tipo") == "colecciones":
            if movil:
                out.append('<details class="pliegue"><summary>%s%s</summary><div class="sub">%s</div></details>' % (t, ICONOS["abajo"], sub))
            else:
                out.append('<div class="desplegable"><button type="button" aria-expanded="false" aria-haspopup="true">%s ▾</button>'
                           '<div class="desplegable-panel">%s<a href="/tienda/">Ver todo</a></div></div>' % (t, sub))
        else:
            u = it.get("url") or "/"
            out.append('<a href="%s"%s>%s</a>' % (e(u), ' aria-current="page"' if ACTUAL_URL.get(actual) == u else "", t))
    return "".join(out)


def logo_cabecera():
    """El logo morado con más brillo (o el que se suba en Personalizar)."""
    return imagen((TEMA.get("logo") or {}).get("imagen")) or "/assets/logo-brillo.png"


def logo_claro():
    """El logo en colores claros (crema y dorado), para el pie oscuro."""
    return "/assets/logo-claro.png" if os.path.exists("assets/logo-claro.png") else logo_url()


def anuncio_html():
    """Barra de anuncio: una parte del texto a la vez (se separan con «·»), con flechas."""
    an = TEMA.get("anuncio") or {}
    partes = [x.strip() for x in str(an.get("texto") or "").split("·") if x.strip()] or [""]
    return ('<div class="anuncio anuncio-flechas"%s><button type="button" data-an="-1" aria-label="Anterior">‹</button>'
            '<span class="an-txt" aria-live="polite">%s</span><button type="button" data-an="1" aria-label="Siguiente">›</button>'
            '<script type="application/json" id="an-partes">%s</script></div>'
            % ("" if an.get("activo", True) else " hidden", tx(partes[0]), json.dumps([tx(x) for x in partes], ensure_ascii=False).replace("</", "<\\/")))


def menu_pie():
    """Enlaces de ayuda del tema, más «Mi pedido» si todavía no está."""
    l = list(TEMA.get("menuPie") or [])
    if not any("mi-pedido" in str(it.get("url") or "") for it in l):
        l.insert(0, {"texto": "Mi pedido", "url": "/mi-pedido.html"})
    return l


def encabezado(cols, actual="", inicio=False):
    """Cabecera de todas las páginas. En la portada va transparente sobre la
    foto; en el resto, sobre una franja morada oscura."""
    pie_links = "".join('<a href="%s">%s</a>' % (e(it.get("url") or "/"), e(it.get("texto") or "")) for it in menu_pie())
    return """<body class="ecm-muestra{interior}" data-portada="nueva">
<a class="sr" href="#contenido">Saltar al contenido</a>
{anuncio}
<header class="cabecera">
  <div class="envoltura">
    <button class="icono hamburguesa" id="btn-menu" aria-label="Abrir menú">{i_menu}</button>
    <a class="logo" href="/"><img src="{logo_cab}" alt="{m}" width="130" height="66" data-kv-logo></a>
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
    <div class="cajon-top"><img class="cajon-logo" src="{logo}" alt="{m}" width="89" height="44" data-kv-logo><button class="icono" data-cerrar="cajon-menu" aria-label="Cerrar menú">{i_cerrar}</button></div>
    <nav aria-label="Menú del celular"><a href="/">Inicio</a><span data-kv-lista="menu-movil">{menu_movil}</span><details class="pliegue"><summary>Ayuda{i_abajo}</summary><div class="sub sub-ayuda">{pie_links}</div></details></nav>
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
""".format(i_menu=ICONOS["menu"], i_buscar=ICONOS["buscar"], i_carro=ICONOS["carro"], i_cerrar=ICONOS["cerrar"], m=e(MARCA), logo=e(logo_url()), i_abajo=ICONOS["abajo"],
           menu=menu_html(cols, False, actual), menu_movil=menu_html(cols, True), pie_links=pie_links,
           interior="" if inicio else " ecm-interior", anuncio=anuncio_html(), logo_cab=e(logo_cabecera()))


# ------------------------------------------------------------------ Instagram
IG_HOSTS = (".cdninstagram.com", ".fbcdn.net")
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def bajar(url, destino):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (KariveWeb)"})
    with urllib.request.urlopen(req, timeout=40) as r:
        open(destino, "wb").write(r.read())


def ffmpeg_exe():
    """ffmpeg para aligerar los videos de Instagram (imageio-ffmpeg o el del sistema)."""
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return shutil.which("ffmpeg") or ""


def video_ig(url, ident):
    """Baja el video de un reel y lo deja liviano para la portada: sin sonido,
    480 px de ancho y hasta 15 segundos, en bucle. Devuelve la ruta o ""."""
    destino = DIST + "/assets/ig/%s.mp4" % ident
    crudo = destino[:-4] + "-original.mp4"
    try:
        bajar(url, crudo)
    except Exception as ex:
        print("No se pudo bajar el video de Instagram %s: %s" % (ident, ex))
        return ""
    ff = ffmpeg_exe()
    if ff:
        try:
            import subprocess
            subprocess.run([ff, "-y", "-loglevel", "error", "-i", crudo, "-t", "15", "-an", "-vf", "scale=480:-2", "-c:v", "libx264",
                            "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", destino], check=True, timeout=180)
            os.remove(crudo)
            return "/assets/ig/%s.mp4" % ident
        except Exception as ex:
            print("No se pudo aligerar el video %s (%s); se usa el original." % (ident, ex))
    os.replace(crudo, destino)
    return "/assets/ig/%s.mp4" % ident


def instagram():
    """Últimas publicaciones de Instagram para la portada.
    Llegan desde el publicador (web.gs las manda al pedir la publicación, en
    IG_DATOS). Si esta vez no vienen, se reutilizan las de la web publicada
    (instagram.json y sus miniaturas), así nunca se pierden."""
    os.makedirs(DIST + "/assets/ig", exist_ok=True)
    nuevos = []
    try:
        nuevos = json.loads(os.environ.get("IG_DATOS") or "[]")
    except ValueError:
        print("IG_DATOS no es JSON válido; se usan las publicaciones anteriores.")
    lista = []
    for it in nuevos if isinstance(nuevos, list) else []:
        ident = re.sub(r"[^0-9A-Za-z_]", "", str(it.get("id") or ""))[:40]
        img, url = str(it.get("img") or ""), str(it.get("url") or "")
        host = urllib.parse.urlparse(img).hostname or ""
        if not ident or not img.startswith("https://") or not host.endswith(IG_HOSTS) or not url.startswith("https://www.instagram.com/"):
            continue
        destino = DIST + "/assets/ig/%s.jpg" % ident
        try:
            bajar(img, destino)
            if gen.Image:
                im = gen.Image.open(destino).convert("RGB")
                if im.width > 640:
                    im = im.resize((640, round(im.height * 640 / im.width)), gen.Image.LANCZOS)
                im.save(destino[:-4] + ".webp", "WEBP", quality=80, method=6)
                os.remove(destino)
                destino = destino[:-4] + ".webp"
        except Exception as ex:
            print("No se pudo bajar la miniatura de Instagram %s: %s" % (ident, ex))
            continue
        nuevo = {"id": ident, "tipo": str(it.get("tipo") or ""), "url": url, "img": "/" + destino[len(DIST) + 1:],
                 "texto": str(it.get("texto") or "")[:220], "fecha": str(it.get("fecha") or "")[:25]}
        vid = str(it.get("video") or "")
        if vid.startswith("https://") and (urllib.parse.urlparse(vid).hostname or "").endswith(IG_HOSTS) and len([x for x in lista if x.get("video")]) < 12:
            nuevo["video"] = video_ig(vid, ident)
        lista.append(nuevo)
    if not lista:
        for base in [os.environ.get("SITIO_ACTUAL") or "", SITIO, "https://nueva.karivejoyas.cl/"]:
            if not base:
                continue
            base = base.rstrip("/") + "/"
            try:
                with urllib.request.urlopen(base + "instagram.json", timeout=30) as r:
                    viejos = json.load(r).get("publicaciones") or []
                for it in viejos:
                    ruta = str(it.get("img") or "")
                    if not re.match(r"^/assets/ig/[0-9A-Za-z_]+\.(webp|jpg)$", ruta):
                        continue
                    bajar(base + ruta.lstrip("/"), DIST + ruta)
                    v = str(it.get("video") or "")
                    if v:
                        if re.match(r"^/assets/ig/[0-9A-Za-z_]+\.mp4$", v):
                            try:
                                bajar(base + v.lstrip("/"), DIST + v)
                            except Exception:
                                it = dict(it, video="")
                        else:
                            it = dict(it, video="")
                    lista.append(it)
                if lista:
                    break
            except Exception:
                continue
    json.dump({"publicaciones": lista}, open(DIST + "/instagram.json", "w"), ensure_ascii=False)
    print("instagram: %d publicaciones" % len(lista))
    return lista


def fecha_corta(iso):
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", iso or "")
    return "%d %s" % (int(m.group(3)), MESES[int(m.group(2)) - 1]) if m else ""


def ig_html(IGD, pubs):
    """Tarjetas con los últimos videos (o publicaciones) de Instagram, con el
    mismo estilo que las colecciones."""
    n = entero(IGD.get("cantidad"), 6, 1, 12)
    videos = [x for x in pubs if x.get("tipo") in ("VIDEO", "REELS")]
    elegidas = (videos if len(videos) >= min(n, 3) else pubs)[:n]
    if not elegidas:
        return ""
    def titulo(t):
        t = re.split(r"[\n.!?]", re.sub(r"#\S+", "", t or "").strip())[0].strip()
        return (t[:52].rsplit(" ", 1)[0] + "…") if len(t) > 55 else (t or "Ver en Instagram")
    tarj = "".join(
        '<a class="coleccion ig-tarjeta" href="{u}" target="_blank" rel="noopener" style="--i:{i}" data-revelar>'
        '<span class="coleccion-foto">{media}{play}'
        '<span class="coleccion-ver" aria-hidden="true">Ver en Instagram {fl}</span></span>'
        '<span class="coleccion-txt"><b>{t}</b><small>{f}</small></span></a>'.format(
            u=e(x["url"]), t=e(titulo(x.get("texto"))), f=e(fecha_corta(x.get("fecha"))), i=i, fl=FLECHA_DER,
            media=('<video src="%s" poster="%s" muted loop playsinline preload="none" aria-label="%s" data-ig-video width="480" height="600"></video>'
                   % (e(x["video"]), e(x["img"]), e(titulo(x.get("texto")))) if x.get("video") else
                   '<img src="%s" alt="%s" loading="lazy" width="480" height="600">' % (e(x["img"]), e(titulo(x.get("texto"))))),
            play=IG_PLAY if x.get("tipo") in ("VIDEO", "REELS") and not x.get("video") else "")
        for i, x in enumerate(elegidas))
    return ('<section class="seccion envoltura" id="instagram"><div class="seccion-cab"><h2 class="con-ig"><span class="ig-logo" aria-hidden="true">' + REDES_ICONOS["instagram"] + '</span><span%s>%s</span></h2><a class="ver-todo" href="%s" target="_blank" rel="noopener"%s>%s</a></div>'
            '<div class="colecciones ig-grilla">%s</div></section>'
            % (kv("portada.instagram.titulo"), tx(IGD.get("titulo")), e(IG), kv("portada.instagram.enlace"), tx(IGD.get("enlace")), tarj))


IG_PLAY = ('<span class="ig-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></span>')


def foco(v):
    """Encuadre de una foto («50% 30%»), tal como se mueve en Personalizar."""
    m = re.match(r"^\s*(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%\s*$", str(v or ""))
    if not m:
        return ""
    x, y = (min(100.0, float(n)) for n in m.groups())
    return "%g%% %g%%" % (x, y)


def estilo_foco(v):
    f = foco(v)
    return (' style="object-position:%s"' % f) if f else ""


def lista_couriers():
    """Empresas de envío (Personalizar → Página de pago): [{nombre, logo}].
    Antes era una sola (courierNombre / courierLogo); se lee igual."""
    pg = TEMA.get("pago") or {}
    l = pg.get("couriers")
    if not isinstance(l, list):
        l = [{"nombre": pg.get("courierNombre") or "", "logo": pg.get("courierLogo") or ""}]
    out = []
    for c in l:
        if isinstance(c, dict) and (str(c.get("nombre") or "").strip() or c.get("logo")):
            out.append({"nombre": str(c.get("nombre") or "").strip(), "logo": logo_ajustado(c.get("logo"))})
    return out


def logo_ajustado(ruta):
    """Logo sin el margen liso que suelen traer (blanco o transparente): así se
    ve grande aunque lo hayan subido cuadrado, como el de Bluexpress."""
    url = imagen(ruta)
    if not url.startswith("/assets/medios/") or not gen.Image:
        return url
    destino = "/assets/medios/%s-logo.webp" % url.rsplit("/", 1)[1].rsplit(".", 1)[0]
    if os.path.exists(DIST + destino):
        return destino
    try:
        from PIL import ImageChops
        im = gen.Image.open(DIST + url).convert("RGBA")
        fondo = im.getpixel((0, 0))
        if fondo[3] < 30:
            caja = im.getchannel("A").point(lambda a: 255 if a > 30 else 0).getbbox()
        else:
            dif = ImageChops.difference(im.convert("RGB"), gen.Image.new("RGB", im.size, fondo[:3])).convert("L")
            caja = dif.point(lambda p: 255 if p > 30 else 0).getbbox()
        if caja:
            m = round(max(caja[2] - caja[0], caja[3] - caja[1]) * 0.03)
            im = im.crop((max(0, caja[0] - m), max(0, caja[1] - m), min(im.width, caja[2] + m), min(im.height, caja[3] + m)))
        if im.height > 120:
            im = im.resize((round(im.width * 120 / im.height), 120), gen.Image.LANCZOS)
        im.save(DIST + destino, "WEBP", quality=90, method=6)
        return destino
    except Exception as err:
        print("logo sin recortar", ruta, err)
        return url


def couriers_html(clase="envio-empresas", texto="Enviamos con"):
    """Logos de las empresas de envío (página Envíos)."""
    l = lista_couriers()
    chips = "".join(('<span class="courier-chip"><img src="%s" alt="%s" title="%s" loading="lazy"></span>' % (e(c["logo"]), e(c["nombre"] or "Empresa de envío"), e(c["nombre"])))
                    if c["logo"] else '<span class="courier-chip solo-nombre">%s</span>' % e(c["nombre"]) for c in l)
    return '<div class="%s" data-kv-couriers%s><span>%s</span><div class="courier-lista">%s</div></div>' % (
        clase, "" if l else " hidden", e(texto), chips)


def datos_pago():
    """Lo que la página de pago muestra además (Personalizar → Página de pago):
    los logos de las tarjetas y de las empresas de envío."""
    pg = TEMA.get("pago") or {}
    return " data-tarjetas=\"%s\" data-couriers=\"%s\"" % (
        "0" if pg.get("tarjetas") is False else "1",
        e(json.dumps([[c["nombre"], c["logo"]] for c in lista_couriers()], ensure_ascii=False)))


def portada_ancha(datos, atributo, alt, clase=""):
    """Foto ancha y baja con bordes redondeados (colecciones y páginas), con su
    encuadre de computador y de celular. Sin foto queda oculta (la vista previa
    del panel la muestra al subir una)."""
    datos = datos or {}
    pc, mov = imagen(datos.get("pc")), imagen(datos.get("movil"))
    pc = pc or mov
    f_pc, f_mov = foco(datos.get("foco")), foco(datos.get("focoMovil"))
    vars_foco = ";".join(x for x in (("--foco:" + f_pc) if f_pc else "", ("--foco-m:" + f_mov) if f_mov else "") if x)
    return ('<div class="col-portada%s%s" %s%s%s><picture><source media="(max-width:699px)"%s><img%s alt="%s" width="1600" height="600" fetchpriority="high" decoding="async"></picture></div>'
            % (clase, "" if mov else " solo-pc", atributo, "" if pc else " hidden", (' style="%s"' % vars_foco) if vars_foco else "",
               (' srcset="%s"' % e(mov or pc)) if pc else "", (' src="%s"' % e(pc)) if pc else "", e(alt))), bool(pc)


def logo_url():
    return imagen((TEMA.get("logo") or {}).get("imagen")) or "/assets/logo-karive-web.png"


OLA = "M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z"


def chat_html():
    """Datos del asistente (el botón y el panel los arma chat.js)."""
    c = TEMA.get("chat") or {}
    if not c.get("activo", True):
        return ""
    datos = {"nombre": c.get("nombre") or "Asistente Karivé", "saludo": c.get("saludo") or "", "invitacion": c.get("invitacion") or "",
             "mensajes": [str(x) for x in (c.get("mensajes") or []) if str(x).strip()][:8],
             "wa": WA, "ig": IG, "fb": FBK}
    return '\n<script id="kv-chat-datos" type="application/json">%s</script>' % json.dumps(datos, ensure_ascii=False).replace("</", "<\\/")


def pie(cols, scripts=""):
    """Banda de suscripción, olas y pie oscuro (todas las páginas)."""
    pi = TEMA.get("pie") or {}
    o = TEMA.get("olas") or {}
    flota = '<a class="wa-flota%s" href="https://wa.me/%s" aria-label="Escríbenos por WhatsApp" rel="noopener" data-kv-si="whatsappFlotante"%s>%s</a>' % (
        " respira" if TEMA.get("whatsappRespira", True) else "", WA, "" if TEMA.get("whatsappFlotante", True) else " hidden", ICONOS["wa"])
    redes = [("instagram", "Instagram", IG), ("facebook", "Facebook", FBK), ("tiktok", "TikTok", str(pi.get("tiktok") or "").strip())]
    pagos = "".join('<img src="/assets/pagos/%s" alt="%s" width="38" height="24" loading="lazy">' % x
                    for x in (("visa.svg", "Visa"), ("mastercard.svg", "Mastercard"), ("amex.svg", "American Express"), ("mercadopago.webp", "Mercado Pago")))
    olas = olas_ecm("ola-sube", "ola-sube" + ("" if o.get("animacion", True) else " quietas")) if o.get("activo", True) else ""
    return """</main>
{olas}<section class="ecm-boletin"><div class="envoltura"><div><h2{k_bt}>{bt}</h2><p{k_bx}>{bx}</p></div>
<div><form class="boletin" id="boletin"><input name="correo" type="email" placeholder="Correo electrónico…" aria-label="Tu correo" required><button class="btn ecm-btn" type="submit">Enviar</button></form>
<div class="boletin-msg" id="boletin-msg" role="status"></div></div></div></section>
<footer class="ecm-pie"><div class="envoltura">
  <div class="f-grid">
    <div><a class="f-logo" href="/"><img src="{logo}" alt="{m}" width="160" height="81" loading="lazy"></a><p{k_txt}>{txt}</p></div>
    <div><h4>Tienda</h4><ul>{cols}<li><a href="/tienda/">Ver todo</a></li></ul></div>
    <div><h4>Servicio al cliente</h4><ul data-kv-lista="menuPie">{ayuda}</ul></div>
    <div><h4>Contacto</h4>{contacto}<p class="loc">Santiago, Chile<small>Envíos a todo el país</small></p></div>
  </div>
  <div class="f-bajo">
    <div>Encuéntranos también en:<div class="redes">{redes}</div></div>
    <div><b>© {anio} {m}</b><br><span{k_fin}>{fin}</span></div>
    <div><div class="pagos">{pagos}</div><i>Pagos seguros con Mercado Pago</i></div>
  </div>
</div></footer>
{flota}{chat}
<script src="/estatico/comun.js?v={v}" defer></script>
<script src="/estatico/tienda.js?v={v}" defer></script>
<script src="/estatico/diseno.js?v={v}" defer></script>{scripts}{chat_js}
</body>
</html>
""".format(olas=olas, m=e(MARCA), logo=e(logo_cabecera()), v=VERSION, scripts=scripts, flota=flota, chat=chat_html(), anio=date.today().year,
           k_bt=kv("pie.boletinTitulo"), bt=tx(pi.get("boletinTitulo")), k_bx=kv("pie.boletinTexto"), bx=tx(pi.get("boletinTexto")),
           k_txt=kv("pie.texto"), txt=tx(pi.get("texto")), k_fin=kv("pie.final"), fin=tx(pi.get("final")), pagos=pagos,
           cols="".join('<li><a href="/c/%s.html">%s</a></li>' % (e(c["slug"]), e(c["nombre"])) for c in cols),
           ayuda="".join('<li><a href="%s">%s</a></li>' % (e(it.get("url") or "/"), e(it.get("texto") or "")) for it in menu_pie()),
           contacto=('<a class="f-fila" href="https://wa.me/%s" rel="noopener">%s %s</a>' % (WA, ICONOS["wa"], e(fono_bonito(WA))) if WA else "") +
                    ('<a class="f-fila" href="mailto:%s">%s %s</a>' % (e(CORREO), REDES_ICONOS["correo"], e(CORREO)) if CORREO else ""),
           redes="".join('<a href="%s" target="_blank" rel="noopener" aria-label="%s">%s</a>' % (e(u), n, REDES_ICONOS[k]) for k, n, u in redes if u.startswith("http")),
           chat_js=('\n<script src="/estatico/chat.js?v=%s" defer></script>' % VERSION) if (TEMA.get("chat") or {}).get("activo", True) else "")


def fono_bonito(n):
    """56922234457 → +56 9 2223 4457"""
    d = re.sub(r"\D", "", str(n or ""))
    if len(d) == 11 and d.startswith("569"):
        return "+56 9 %s %s" % (d[3:7], d[7:])
    return ("+" + d) if d else ""


REDES_ICONOS = {
    "instagram": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>',
    "facebook": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z"/></svg>',
    "tiktok": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 3c.4 2.2 1.7 3.6 3.9 3.8v3a7 7 0 0 1-3.9-1.2v6.2A5.8 5.8 0 1 1 10.8 9v3.1a2.8 2.8 0 1 0 2.8 2.8V3h3Z"/></svg>',
    "correo": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg>',
}


def contacto_pie(pi):
    """Contacto del pie: WhatsApp y correo con su ícono, y las redes en círculos."""
    filas = ""
    if WA:
        filas += ('<a class="pie-fila" href="https://wa.me/%s" rel="noopener"><span class="pie-ic">%s</span><span><small>WhatsApp</small><b>%s</b></span></a>'
                  % (WA, ICONOS["wa"], e(fono_bonito(WA))))
    if CORREO:
        filas += ('<a class="pie-fila" href="mailto:%s"><span class="pie-ic">%s</span><span><small>Correo</small><b>%s</b></span></a>'
                  % (e(CORREO), REDES_ICONOS["correo"], e(CORREO)))
    redes = [("instagram", "Instagram", IG), ("facebook", "Facebook", FBK), ("tiktok", "TikTok", str(pi.get("tiktok") or "").strip())]
    circulos = "".join('<a href="%s" target="_blank" rel="noopener" aria-label="%s">%s</a>' % (e(u), n, REDES_ICONOS[k])
                       for k, n, u in redes if u.startswith("http"))
    return filas + ('<div class="pie-redes">%s</div>' % circulos if circulos else "")


def tarjeta(p, i=0, lazy=True):
    etiqueta = ""
    if not p["hay"]:
        etiqueta = '<span class="etiqueta">Agotado</span>'
    elif p["rebajado"]:
        etiqueta = '<span class="etiqueta oro">Oferta</span>'
    elif p["cantidad"] is not None and 0 < p["cantidad"] <= 3:
        etiqueta = '<span class="etiqueta">Últimas</span>'
    precio = pesos(p["vigente"]) + (("<s>%s</s>" % pesos(p["precio"])) if p["rebajado"] else "")
    return ('<li class="tarjeta" data-tarjeta="{id}" data-col="{col}" data-precio="{pv}" data-i="{i}" data-n="{n}" style="--i:{im}">'
            '<a class="tarjeta-foto" href="{url}"><img src="{img}" alt="{alt}" width="480" height="480"{lz}>{et}<span class="tarjeta-ver" aria-hidden="true"><span data-kv="producto.verDetalle">' + e((TEMA.get("producto") or {}).get("verDetalle") or "Ver detalle") + '</span> ' + FLECHA_DER + '</span></a>'
            '<div class="tarjeta-txt"><a class="tarjeta-nombre" href="{url}">{nom}</a><span class="precio">{precio}</span>'
            '<div class="agregar"><button type="button" class="btn btn-2" data-agregar="{id}"{dis}>{txt}</button></div></div></li>').format(
        id=e(p["id"]), col=e(p["col"]["slug"]), pv=p["vigente"], i=i, im=i % 4, n=p["creado"][:19].replace("-", "").replace(":", "").replace("T", ""),
        url=e(p["url"]), img=e(p["img_chica"]), alt=e("%s, aros hechos a mano – %s" % (p["nombre"], MARCA)),
        lz=' loading="lazy" decoding="async"' if lazy else "", et=etiqueta, nom=e(p["nombre"]), precio=precio,
        dis="" if p["hay"] else " disabled", txt="Agregar al carrito" if p["hay"] else "Agotado")


def escribir(ruta, contenido):
    destino = os.path.join(DIST, ruta.lstrip("/"))
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    open(destino, "w", encoding="utf-8").write(contenido)


# --------------------------------------------------------------- páginas

def sello_gira(texto):
    """El círculo que gira (Nuestro taller). Su texto se cambia en Personalizar → Nuestro taller."""
    t = (str(texto or "").strip() or "Hecho a mano · Mostacilla · Arcilla").upper().rstrip(" ·") + " ·"
    return ('<svg class="sello-gira" viewBox="0 0 120 120" aria-hidden="true"><defs><path id="circ" d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0"/></defs>'
            '<text textLength="272" lengthAdjust="spacing"><textPath href="#circ" data-kv-circulo>%s</textPath></text><path d="M60 47c1.6 6.4 4.6 9.4 11 11-6.4 1.6-9.4 4.6-11 11-1.6-6.4-4.6-9.4-11-11 6.4-1.6 9.4-4.6 11-11Z"/></svg>' % e(t))


FLECHA_DER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
FLECHA_IZQ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>'


def medidas_dist(ruta):
    """Ancho y alto reales de una imagen ya copiada a dist (para que la galería no salte al cargar)."""
    try:
        with gen.Image.open(os.path.join(DIST, ruta.lstrip("/"))) as im:
            return im.size
    except Exception:
        return 4, 5


def clase_mosaico(i, n):
    """Mosaico de colecciones en escritorio (4 columnas): la primera es grande
    (2×2) y las últimas se ensanchan para que no quede ningún hueco."""
    if n < 4:
        return ""
    if i == 0:
        return " grande"
    resto = (n - 1) % 4
    desde_el_final = n - 1 - i
    if resto == 1 and desde_el_final == 0:
        return " ancha-4"
    if resto == 2 and desde_el_final < 2:
        return " ancha"
    if resto == 3 and desde_el_final == 0:
        return " ancha"
    return ""


def cinta_html(items):
    """Cinta con frases que se desplazan sin parar (la lista va dos veces para que el giro no se note)."""
    fila = "".join('<span>%s</span><svg class="cinta-sep" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.7 5.3 3 7.6 10 10-7 2.4-9.3 4.7-10 10-.7-5.3-3-7.6-10-10 7-2.4 9.3-4.7 10-10Z"/></svg>' % tx(x) for x in items if str(x).strip())
    return ('<div class="cinta" aria-label="%s"><div class="cinta-pista" data-kv-lista="portada.cinta.items">%s<span aria-hidden="true" class="cinta-copia">%s</span></div></div>'
            % (e(" · ".join(tp(x) for x in items)), fila, fila))


def tarjeta_nuevo(p, activo):
    """Tarjetita de vidrio sobre la foto de portada con el último producto subido."""
    if not p:
        return ""
    return ('<a class="hero-nuevo vidrio" href="%s" data-kv-si="portada.hero.tarjetaNuevo"%s><img src="%s" alt="" width="64" height="64">'
            '<span><small>Nuevo en el taller</small><b>%s</b>%s</span></a>'
            % (e(p["url"]), "" if activo else " hidden", e(p["img_chica"]), e(p["nombre"]), pesos(p["vigente"])))


def boton(b, clase, ruta):
    b = b or {}
    return '<a class="btn %s" href="%s"%s>%s</a>' % (clase, e(b.get("url") or "/"), kv(ruta), e(b.get("texto") or ""))


def sobre_html(SO):
    """«Sobre nosotros»: texto a la izquierda y 5 fotos que se abren en abanico
    alrededor de la grande al aparecer en pantalla (estilo Ecomify)."""
    fotos = list(SO.get("imagenes") or []) + [""] * 5
    defecto = T.T_SOBRE["imagenes"]
    imgs = "".join('<img class="kv-aiwt__img kv-aiwt__img--%d" src="%s" alt="" width="600" height="%d" loading="lazy" data-kv-img="portada.sobre.imagenes.%d">'
                   % (i + 1, e(imagen(fotos[i]) or defecto[i]), 800 if i == 0 else 600, i) for i in range(5))
    cab = lambda clase: ('<div class="%s kv-anim kv-anim--fast kv-hidden" data-kv-anim="kv-fadeInUp" style="animation-delay:400ms"><p class="kv-aiwt__subtitle"%s>%s</p></div>'
                         '<div class="%s kv-anim kv-anim--fast kv-hidden" data-kv-anim="kv-fadeInUp" style="animation-delay:600ms"><h2 class="kv-aiwt__title"%s>%s</h2></div>'
                         % (clase, kv("portada.sobre.antetitulo"), tx(SO.get("antetitulo")), clase, kv("portada.sobre.titulo"), tx(SO.get("titulo"))))
    return ('<section class="kv-aiwt" id="sobre-nosotros"><div class="kv-aiwt__container">'
            '<div class="kv-aiwt__mobile-head">%s</div>'
            '<div class="kv-aiwt__row"><div class="kv-aiwt__col kv-aiwt__fotos">%s</div>'
            '<div class="kv-aiwt__col kv-aiwt__text kv-anim kv-anim--faster kv-hidden" data-kv-anim="kv-fadeInLeft">%s'
            '<div class="kv-anim kv-anim--fast kv-hidden" data-kv-anim="kv-fadeInUp" style="animation-delay:800ms"><div class="kv-aiwt__desc"><p%s>%s</p></div></div>'
            '<div class="kv-aiwt__cta kv-anim kv-anim--fast kv-hidden" data-kv-anim="kv-fadeInUp" style="animation-delay:1200ms">%s</div>'
            '</div></div></div></section>'
            % (cab("kv-aiwt__m"), imgs, cab("kv-aiwt__desk"), kv("portada.sobre.texto"), tx(SO.get("texto")), boton(SO.get("boton"), "kv-aiwt__btn", "portada.sobre.boton")))


ICONOS_FAQ = [
    '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    '<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
    '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
    '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>',
    '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 14.5h4"/>',
    '<path d="M4 5.5h16v10H9l-4 3.5v-3.5H4z"/><path d="M8 10h8M8 12.8h5"/>',
    '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
]


def olas_ecm(id_, clase):
    """Las olas de la web (4 capas que van y vuelven en sentidos distintos)."""
    return ('<div class="olas ecm-olas %s" aria-hidden="true"><svg viewBox="0 24 150 28" preserveAspectRatio="none">'
            '<defs><path id="%s" d="%s"/></defs>'
            '<g class="ola ola1"><use href="#%s" x="48" y="0"/></g><g class="ola ola2"><use href="#%s" x="48" y="3"/></g>'
            '<g class="ola ola3"><use href="#%s" x="48" y="5"/></g><g class="ola ola4"><use href="#%s" x="48" y="7"/></g></svg></div>'
            % (clase, id_, OLA, id_, id_, id_, id_))


def portada(prods, cols, mas_vistos, img_cols, ig_pubs=()):
    """La portada: carrusel con velo morado, lo nuevo, ¿por qué elegirnos?,
    favoritos, Instagram, sobre nosotros y preguntas frecuentes."""
    P = TEMA["portada"]
    vis = [p for p in prods if p["hay"]]
    porid = {p["id"]: p for p in vis}
    nuevos = sorted(vis, key=lambda p: p["creado"], reverse=True)[:15]
    destacados = [porid[i] for i in mas_vistos if i in porid]
    ronda = 0
    while len(destacados) < 10 and ronda < 10:
        for c in cols:
            cand = [p for p in c["_prods"] if p not in destacados and p not in nuevos and p["hay"]]
            if len(cand) > ronda and len(destacados) < 10:
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
    img_seo = imagen(seo.get("imagen")) or "/assets/modelo-portada.jpg"
    h = cabeza(tp(seo.get("titulo")), tp(seo.get("descripcion")), "/", SITIO + img_seo.lstrip("/"), jsonld)
    h += encabezado(cols, inicio=True)
    H, C, F, N = P["hero"], P["confianza"], P["favoritos"], P["nuevos"]
    sec = {}
    # portada con carrusel: la foto principal y las portadas de 2 colecciones
    bans = (TEMA.get("coleccionPagina") or {}).get("banners") or {}
    original = lambda u: (u[:-5] + ".jpg") if u.startswith("/assets/medios/") and u.endswith(".webp") and os.path.exists(DIST + u[:-5] + ".jpg") else u
    b1 = H.get("boton1") or {"texto": "Ver la tienda", "url": "/tienda/"}
    slides = ['<div class="slide activa"><img class="r" src="%s" alt="%s" style="object-position:%s" fetchpriority="high" data-kv-img="portada.hero.imagen">'
              '<div class="caption left"><small%s>%s</small><h1%s>%s</h1><a href="%s" class="btn ecm-btn"%s>%s</a></div></div>'
              % (e(original(imagen(H.get("imagen")) or "/assets/modelo-portada.jpg")), e(H.get("imagenAlt") or MARCA), e(foco(H.get("imagenFoco")) or "50% 30%"),
                 kv("portada.hero.antetitulo"), tx(H.get("antetitulo")), kv("portada.hero.titulo"), tx(H.get("titulo")),
                 e(b1.get("url") or "/tienda/"), kv("portada.hero.boton1"), e(b1.get("texto") or ""))]
    for c in cols:
        b = bans.get(c["id"]) or {}
        if imagen(b.get("pc")) and len(slides) < 3:
            titulo = str(((TEMA.get("coleccionPagina") or {}).get("titulos") or {}).get(c["id"]) or gen.SEO_COLECCION.get(c["id"], (c["nombre"],))[0])
            slides.append('<div class="slide"><img class="r" src="%s" alt="%s" style="object-position:%s" loading="lazy">'
                          '<div class="caption left"><small>Colección %s</small><h2>%s</h2><a href="/c/%s.html" class="btn ecm-btn">%s</a></div></div>'
                          % (e(original(imagen(b.get("pc")))), e(titulo + " – " + MARCA), e(foco(b.get("foco")) or "50% 50%"), e(c["nombre"]), e(titulo), e(c["slug"]),
                             e(P["colecciones"].get("botonTarjeta") or "Ver colección")))
    flechas = ('<button class="flecha prev" type="button" data-hero="-1" aria-label="Anterior">‹</button>'
               '<button class="flecha next" type="button" data-hero="1" aria-label="Siguiente">›</button>') if len(slides) > 1 else ""
    sec["hero"] = '<section class="ecm-hero" aria-roledescription="carrusel">%s%s</section>%s' % ("".join(slides), flechas, olas_ecm("ola-baja", "ola-baja"))
    # lo nuevo, en grilla de 5 columnas
    sec["nuevos"] = ('<section class="ecm-seccion envoltura"><div class="ecm-hr"></div><h2 class="ecm-titulo"%s>%s</h2><ul class="grilla ecm-grilla">%s</ul>'
                     '<div class="centro"><a class="btn ecm-btn" href="/tienda/?orden=nuevos">%s</a></div></section>'
                     % (kv("portada.nuevos.titulo"), tx(N.get("titulo")), "".join(tarjeta(p, i) for i, p in enumerate(nuevos)),
                        tx(str(N.get("enlace") or "Ver lo nuevo").rstrip(" →"))))
    # ¿por qué elegirnos? (con los beneficios)
    sec["confianza"] = ('<section class="envoltura ecm-espacio"><div class="ecm-hr"></div><div class="ecm-oscuro"><div class="cab"><span class="pildora"><em>Karivé</em> · Joyas</span>'
                        '<h2>¿Por qué elegirnos?</h2></div><div class="ecm-por-que">%s</div></div></section>'
                        % "".join('<div><span class="ic">%s</span><h3>%s</h3><p>%s</p></div>' % (T.icono(it.get("icono")), tx(it.get("titulo")), tx(it.get("texto")))
                                  for it in C.get("items") or []))
    # favoritos, en carrusel
    sec["favoritos"] = ('<section class="ecm-seccion envoltura"><div class="ecm-hr"></div><h2 class="ecm-titulo"%s>%s</h2><div class="ecm-slider">'
                        '<button class="s-flecha prev" type="button" data-pista="-1" aria-label="Anterior">‹</button><ul class="grilla ecm-pista">%s</ul>'
                        '<button class="s-flecha next" type="button" data-pista="1" aria-label="Siguiente">›</button></div><div class="ecm-puntos"></div>'
                        '<div class="centro"><a href="/tienda/" class="btn ecm-btn">%s</a></div></section>'
                        % (kv("portada.favoritos.titulo"), tx(F.get("titulo")), "".join(tarjeta(p, i) for i, p in enumerate(destacados)),
                           tx(str(F.get("enlace") or "Ver la tienda").rstrip(" →"))))
    # Instagram: una fila; los videos se mueven solos y se abren aquí mismo
    ig = ig_html(dict(P.get("instagram") or {}, cantidad=6), list(ig_pubs))
    if ig:
        sec["instagram"] = '<div class="ecm-ig">%s</div>' % ig
    sec["sobre"] = sobre_html(P.get("sobre") or {})
    # preguntas frecuentes con íconos
    pq = TEMA["paginas"].get("preguntas") or {}
    sec["preguntas"] = ('<section class="ecm-seccion envoltura ecm-faq"><span class="ojo">Karivé · Ayuda rápida</span><h2>%s</h2>%s'
                        '<div class="pie-faq"><p>¿Te quedó una duda? Te respondemos rápido por WhatsApp.</p><div class="btns"><a href="/tienda/" class="btn ecm-btn">Ver productos</a>'
                        '<a href="https://wa.me/%s" class="btn ecm-btn-borde">Hablar por WhatsApp</a></div></div></section>'
                        % (tx(pq.get("titulo") or "Preguntas frecuentes"), "".join(
                            '<div class="acc"><button type="button" aria-expanded="false"><span class="ic"><svg viewBox="0 0 24 24">%s</svg></span><span>%s</span><span class="chev" aria-hidden="true">▾</span></button>'
                            '<div class="ans"><p>%s</p></div></div>' % (ICONOS_FAQ[i % len(ICONOS_FAQ)], tx(it.get("q")), tx(it.get("a")))
                            for i, it in enumerate([x for x in pq.get("items") or [] if x.get("q")][:6])), WA))
    # orden fijo del diseño; las secciones que se ocultan en el panel (Tienda online → Secciones) no se muestran
    ocultas = set(P.get("ocultas") or []) - {"hero"}
    h += '<div data-kv-secciones data-kv-fijo>\n'
    for k in ("hero", "nuevos", "confianza", "favoritos", "instagram", "sobre", "preguntas"):
        if k in sec:
            h += '<div data-kv-sec="%s"%s>%s</div>\n' % (k, " hidden" if k in ocultas else "", sec[k])
    h += '</div>\n'
    h += pie(cols)
    escribir("index.html", h)
    # la dirección de la muestra ahora lleva a la portada
    escribir("muestra/index.html", '<!doctype html><html lang="es-CL"><head><meta charset="utf-8"><meta name="robots" content="noindex">'
                                   '<link rel="canonical" href="%s"><meta http-equiv="refresh" content="0;url=/"><title>%s</title></head>'
                                   '<body><a href="/">Ir a la portada</a></body></html>' % (SITIO, e(MARCA)))


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
    TP = TEMA.get("tiendaPagina") or {}
    foto, _ = portada_ancha(((TEMA.get("coleccionPagina") or {}).get("banners") or {}).get("todo") or {}, 'data-kv-banner="todo"', TP.get("titulo") or "Todos los aros")
    h += """<section class="envoltura" style="padding-top:28px">
  {foto}<h1{k1}>{tit}</h1>
  <p style="color:var(--suave)"><span id="cuenta">{n} productos</span> · <span{k2}>{txt}</span></p>
  <div class="filtros" role="group" aria-label="Filtrar por colección">{chips}
    <select id="orden" aria-label="Ordenar"><option value="recomendado">Recomendados</option><option value="nuevos">Más nuevos</option><option value="menor">Menor precio</option><option value="mayor">Mayor precio</option></select></div>
  <ul class="grilla" id="grilla-tienda">{tarj}</ul>
</section>
<script>(function(){{var o=new URLSearchParams(location.search).get('orden');if(o){{var s=document.getElementById('orden');if(s)s.value=o;}}}})();</script>
""".format(n=len(vis), chips=chips, tarj="".join(tarjeta(p, i, lazy=i > 7) for i, p in enumerate(vis)), foto=foto,
           k1=kv("tiendaPagina.titulo"), tit=tx(TP.get("titulo")), k2=kv("tiendaPagina.texto"), txt=tx(TP.get("texto")))
    h += pie(cols)
    escribir("tienda/index.html", h)


def preguntas_producto(nombre, medida):
    """Las preguntas de la ficha (las de paginas-producto.py, con los textos de la web nueva)."""
    out = []
    for q, a in gen.preguntas(nombre, medida):
        if "material" in q:
            a = "Son aros artesanales hechos a mano en Chile, con arcilla polimérica, cristales, mostacillas y otros materiales según el diseño."
        elif "regiones" in q:
            a = "Sí, enviamos a todo Chile: %s a la Región Metropolitana y %s a regiones, según la región." % (VARS["envio_rm"], VARS["envio_regiones"])
        elif "falla" in q:
            q, a = "¿Qué pasa si llega con algún problema?", "Escríbenos por WhatsApp o Instagram e intentaremos solucionar tu problema lo más pronto posible, según sea el caso."
        elif "compro" in q:
            a = "Agrégalo al carrito y paga con tarjeta de débito o crédito (Mercado Pago), o escríbenos por WhatsApp o Instagram."
        out.append((q, a))
    return out


def descripcion_col(c):
    """Texto de la colección en la web (Personalizar → Colecciones). Si no hay,
    se usa el de la colección en el panel (Colecciones → descripción)."""
    return str(((TEMA.get("coleccionPagina") or {}).get("descripciones") or {}).get(c["id"]) or "").strip()


def coleccion(c, cols):
    h1, frase = gen.SEO_COLECCION.get(c["id"], ("Aros %s hechos a mano" % c["nombre"].lower(), "aros artesanales"))
    h1 = str(((TEMA.get("coleccionPagina") or {}).get("titulos") or {}).get(c["id"]) or "").strip() or h1
    prods = c["_prods"]
    desde = min(p["vigente"] for p in prods)
    ruta = "/c/%s.html" % c["slug"]
    url = SITIO + ruta.lstrip("/")
    desc = "%s: %d modelos desde %s, hechos a mano en Santiago. Envío a todo Chile." % (h1, len(prods), pesos(desde))
    intro = descripcion_col(c) or "En %s hacemos %s a mano.%s" % (MARCA, frase, (" " + c["sub"].rstrip(".") + ".") if c.get("sub") else "")
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
    # imagen de portada de la colección (Personalizar → Página de colección)
    ban = ((TEMA.get("coleccionPagina") or {}).get("banners") or {}).get(c["id"]) or {}
    migas = '<nav class="migas" aria-label="Estás en"><ol><li><a href="/">Inicio</a></li><li><a href="/tienda/">Ver todo</a></li><li aria-current="page">%s</li></ol></nav>' % e(c["nombre"])
    # la foto va arriba, sin nada encima; el título y el texto, debajo
    foto, _ = portada_ancha(ban, 'data-kv-banner="%s"' % e(c["id"]), h1)
    h += '<div class="envoltura">%s%s' % (migas, foto)
    h += """{cab}
  <ul class="grilla" style="margin-top:24px">{tarj}</ul>
  <h2 style="margin-top:48px">Otras colecciones</h2><div class="filtros">{otras}</div>
</div>
""".format(cab='<div class="col-cab"><h1 data-kv-coltit="%s">%s</h1><p style="max-width:720px;color:var(--suave)" data-kv-coldesc="%s">%s</p></div>' % (e(c["id"]), e(h1), e(c["id"]), e(intro)),
           tarj="".join(tarjeta(p, i, lazy=i > 3) for i, p in enumerate(prods)), otras=otras)
    h += pie(cols)
    escribir(ruta, h)


def producto(p, cols):
    col = p["col"]
    ruta = p["url"]
    url = SITIO + ruta.lstrip("/")
    etiqueta = p["nombre"] if not p["repetido"] else "%s (%s)" % (p["nombre"], p["codigo"])
    # títulos de hasta 60 caracteres, lo que Google muestra completo
    titulo = "%s | Aros hechos a mano | %s" % (etiqueta, MARCA)
    if len(titulo) > 60:
        titulo = "%s · Hecho a mano | %s" % (etiqueta, MARCA)
    if len(titulo) > 60:
        titulo = "%s | %s" % (etiqueta, MARCA)
    partes = ["%s a %s: aros artesanales hechos a mano en Chile%s." % (etiqueta, pesos(p["vigente"]), (", " + p["medida"].lower()) if p["medida"] else ""),
              "Envío a todo Chile desde Santiago.", "Compra online o por WhatsApp."]
    while len(" ".join(partes)) > 158 and len(partes) > 1:
        partes.pop()
    desc = gen.corta(" ".join(partes), 158)
    alt = "%s, aros artesanales hechos a mano%s – %s" % (p["nombre"], (" color " + p["color"].lower()) if p["color"] else "", MARCA)
    texto = "%s: aros artesanales de la colección %s, hechos a mano." % (p["nombre"], col["nombre"])
    if descripcion_col(col):
        texto += " " + descripcion_col(col)
    faq = preguntas_producto(p["nombre"], p["medida"])
    otros = [q for q in col.get("_prods", []) if q["codigo"] != p["codigo"]][:4]
    w, hh = p["dim"] or (1000, 1000)
    prod = {
        "@type": "Product", "@id": url + "#producto", "name": p["nombre"], "sku": p["codigo"], "mpn": p["codigo"], "url": url,
        "description": texto, "category": "Joyería > Aros",
        "image": [{"@type": "ImageObject", "url": p["foto_abs"], "contentUrl": p["foto_abs"], "caption": alt, "width": w, "height": hh}],
        "brand": {"@type": "Brand", "name": MARCA}, "manufacturer": {"@id": SITIO + "#organizacion"},
        "offers": {"@type": "Offer", "url": url, "priceCurrency": "CLP", "price": str(p["vigente"]),
                   "availability": "https://schema.org/%s" % ("InStock" if p["hay"] else "OutOfStock"),
                   "itemCondition": "https://schema.org/NewCondition", "seller": {"@id": SITIO + "#organizacion"},
                   "shippingDetails": ENVIOS_SCHEMA, "hasMerchantReturnPolicy": gen.politica_devolucion()},
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
      <details><summary>Medidas y material</summary><ul>{medida}<li>Hecho a mano en Chile</li>{color}</ul></details>
      <details><summary>Envíos</summary><p>Despachamos desde Santiago a todo Chile: {rm} a la Región Metropolitana y {resto} a regiones, según la región. <a href="/envios.html">Más sobre envíos</a>.</p></details>
      <details><summary>¿Llegó con algún problema?</summary><p>Escríbenos por WhatsApp o Instagram e intentaremos solucionar tu problema lo más pronto posible, según sea el caso. <a href="/devoluciones.html">Cambios y devoluciones</a>.</p></details>
    </div>
  </div>
</article>
{opiniones}<section class="seccion" style="padding-top:20px"><h2>Preguntas frecuentes</h2><div class="faq">{faq}</div></section>
{rel}
</div>
""".format(cs=e(col["slug"]), cn=e(col["nombre"]), nom=e(p["nombre"]), id=e(p["id"]), foto=e(p["foto"]), img=e(p["img"]),
           alt=e(alt), w=w, hh=hh, cod=e(p["codigo"]), precio=precio, scls=stock_cls, stxt=stock_txt,
           dis="" if p["hay"] else " disabled", btxt="Agregar al carrito" if p["hay"] else "Agotado", wa=WA, wat=wa_txt,
           rm=VARS["envio_rm"], resto=VARS["envio_regiones"], texto=e(texto),
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


def pagina_texto(ruta, titulo, desc, cuerpo_html, cols, actual="", jsonld=None, robots="index, follow", clave=""):
    h = cabeza(titulo, desc, ruta, SITIO + "assets/modelo-portada.jpg", jsonld, robots=robots)
    h += encabezado(cols, actual)
    foto, hay = ("", False)
    if clave:   # foto de portada de la página (Personalizar → Páginas)
        foto, hay = portada_ancha((TEMA["paginas"].get(clave) or {}).get("portada"), 'data-kv-banner-pag="%s"' % e(clave),
                                  re.sub(r"<[^>]+>", "", cuerpo_html.split("</h1>")[0]), " pag-portada")
    h += '<div class="envoltura">%s<div class="texto-pag%s">%s</div></div>\n' % (foto, " con-foto" if hay else "", cuerpo_html)
    h += pie(cols)
    escribir(ruta, h)


def variables_envio():
    """{envio_rm}, {envio_regiones} ("$3.990" o "$3.990 a $5.990"), {envio_min}, {envio_max}
    y {envio_rango} ("$2.990 a $5.990"). Igual que en el panel (admin/tienda.js)."""
    mn, mx, rmn, rmx = envio_rango()
    rango = lambda a, b: pesos(a) if a == b else "%s a %s" % (pesos(a), pesos(b))
    return {"envio_rm": pesos(envio_de(REGION_RM)), "envio_regiones": rango(rmn, rmx), "envio_min": pesos(mn), "envio_max": pesos(mx), "envio_rango": rango(mn, mx)}


def tabla_envios():
    """Costo por región; las regiones con el mismo precio van juntas."""
    grupos = {}
    for r in REGIONES:
        grupos.setdefault(envio_de(r), []).append("Región Metropolitana" if r == REGION_RM else r)
    filas = "".join('<tr><td>%s</td><td class="num">%s</td></tr>' % (e(", ".join(rs)), pesos(n)) for n, rs in sorted(grupos.items()))
    return '<table class="tabla-envios"><thead><tr><th>Región</th><th class="num">Envío</th></tr></thead><tbody>%s</tbody></table>' % filas


def tarjetas_contacto():
    ig = IG.rstrip("/").split("/")[-1]
    wa = WA[2:] if WA.startswith("56") else WA
    wa_txt = "+56 %s %s %s" % (wa[:1], wa[1:5], wa[5:]) if len(wa) == 9 else "+" + WA
    return ('<div class="contacto-grilla"><a href="https://wa.me/%s"><b>WhatsApp</b>%s</a><a href="%s" rel="noopener"><b>Instagram</b>@%s</a>'
            '<a href="mailto:%s"><b>Correo</b>%s</a></div>' % (WA, e(wa_txt), e(IG), e(ig), e(CORREO), e(CORREO)))


def html_pagina(s):
    """HTML de una página escrita en el panel, con sus {variables}."""
    return T.reemplazos(str(s or ""), dict(VARS, tabla_envios=tabla_envios(), tarjetas_contacto=tarjetas_contacto(), empresas_envio=couriers_html()))


def pagina_tema(clave, ruta, actual="", jsonld=None, robots="index, follow"):
    pg = TEMA["paginas"][clave]
    if clave == "envios" and "{empresas_envio}" not in str(pg.get("html") or ""):
        # los logos de las empresas de envío van bajo la tabla de precios
        h = str(pg.get("html") or "")
        pg = dict(pg, html=h.replace("{tabla_envios}", "{tabla_envios}{empresas_envio}", 1) if "{tabla_envios}" in h else h + "{empresas_envio}")
    cuerpo = ('<h1%s>%s</h1><div class="pagina-html" data-kv-html="paginas.%s.html">%s</div>'
              % (kv("paginas.%s.titulo" % clave), tx(pg.get("titulo")),
                 clave, html_pagina(pg.get("html"))))
    pagina_texto(ruta, tp(pg.get("seoTitulo") or (pg.get("titulo") + " | " + MARCA)), tp(pg.get("seoDesc") or pg.get("titulo")),
                 cuerpo, cols_global, actual, jsonld, robots, clave=clave)


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
                 '<h1%s>%s</h1><div class="faq" data-kv-lista="paginas.preguntas.items">' % (
                     kv("paginas.preguntas.titulo"), tx(pq.get("titulo"))) +
                 "".join("<details><summary>%s</summary><p>%s</p></details>" % (tx(it["q"]), tx(it.get("a"))) for it in items) +
                 '</div><p style="margin-top:24px">¿Te quedó alguna duda? <a href="/contacto.html">Escríbenos</a>.</p>', cols, "preguntas", faq_ld, clave="preguntas")
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

    # «Mi pedido»: número + correo → en qué va el pedido (estatico/mi-pedido.js)
    pagina_texto("/mi-pedido.html", "Mi pedido | " + MARCA, "Revisa en qué va tu pedido de Karivé Joyas con tu número de pedido y tu correo.",
                 '<h1>Mi pedido</h1><p>Escribe el número de tu pedido (está en el correo de confirmación) y el correo con que compraste.</p>'
                 '<div class="mi-pedido" id="mi-pedido" data-wa="%s"><form novalidate>'
                 '<label class="campo"><span>N° de pedido</span><input name="num" inputmode="numeric" autocomplete="off" placeholder="Ej: 128" required></label>'
                 '<label class="campo"><span>Correo</span><input name="correo" type="email" autocomplete="email" spellcheck="false" autocapitalize="off" placeholder="tucorreo@ejemplo.cl" required></label>'
                 '<button class="btn ecm-btn" type="submit">Ver mi pedido</button></form><div id="mp-resultado" aria-live="polite"></div></div>' % e(WA),
                 cols, robots="noindex, follow")
    ruta_mp = DIST + "/mi-pedido.html"
    h_mp = open(ruta_mp, encoding="utf-8").read().replace('<script src="/estatico/tienda.js?v=%s" defer></script>' % VERSION,
        '<script src="/estatico/tienda.js?v=%s" defer></script>\n<script src="/estatico/mi-pedido.js?v=%s" defer></script>' % (VERSION, VERSION), 1)
    open(ruta_mp, "w", encoding="utf-8").write(h_mp)

    pagina_texto("/finalizar-compra.html", "Finalizar compra | " + MARCA, "Completa tus datos y paga tu pedido de Karivé Joyas.",
                 '<h1 style="margin-bottom:0">Finalizar compra</h1>', cols, robots="noindex, nofollow")
    # la de pago necesita su propio contenedor y su script
    ruta = DIST + "/finalizar-compra.html"
    h = open(ruta, encoding="utf-8").read()
    h = h.replace('<div class="envoltura"><div class="texto-pag"><h1 style="margin-bottom:0">Finalizar compra</h1></div></div>',
                  '<div class="envoltura"><h1 style="margin:28px 0 0;font-size:40px">Finalizar compra</h1><div class="pago" id="pago"%s></div></div>' % datos_pago())
    h = h.replace('<script src="/estatico/tienda.js?v=%s" defer></script>' % VERSION,
                  '<script src="/estatico/tienda.js?v=%s" defer></script>\n<script src="/estatico/compra.js?v=%s" defer></script>' % (VERSION, VERSION))
    # al pagar no van los botones flotantes (tapaban el cupón en el celular; WhatsApp sigue en el resumen)
    h = re.sub(r'<a class="wa-flota[^"]*"[^>]*>.*?</a>', '', h, count=1, flags=re.S)
    h = h.replace('<script src="/estatico/chat.js?v=%s" defer></script>' % VERSION, '')
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
    open(DIST + "/robots.txt", "w").write("User-agent: *\nAllow: /\nDisallow: /finalizar-compra.html\nDisallow: /admin/\nDisallow: /demo/\n\nSitemap: %ssitemap.xml\n" % SITIO)

    filas = []
    for p in sorted(prods, key=lambda p: (p["cat"], p["orden"])):
        filas.append({
            "id": p["codigo"], "title": gen.corta("%s – Aros artesanales hechos a mano | %s" % (p["nombre"], MARCA), 150),
            "description": ("%s de %s. Aros artesanales hechos a mano en Chile.%s Colección %s. Código %s."
                            % (p["nombre"], MARCA, (" Medida %s." % p["medida"].rstrip(".")) if p["medida"] else "", p["col"]["nombre"], p["codigo"])),
            "link": SITIO + "p/%s.html" % p["codigo"], "image_link": p["foto_abs"],
            "availability": "in_stock" if p["hay"] else "out_of_stock",
            "price": "%d CLP" % p["precio"], "sale_price": ("%d CLP" % p["vigente"]) if p["rebajado"] else "",
            "condition": "new", "brand": MARCA, "mpn": p["codigo"], "identifier_exists": "no",
            "google_product_category": gen.CAT_GOOGLE, "product_type": "Joyería > Aros > " + p["col"]["nombre"],
            "color": p["color"], "gender": "female", "age_group": "adult", "custom_label_0": p["col"]["nombre"],
        })
    with open(DIST + "/catalogo-google.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(filas[0].keys()))
        w.writeheader()
        w.writerows(filas)

    lineas = ["# %s" % MARCA, "", "> Joyería artesanal hecha a mano en Santiago, Chile. Aros de arcilla polimérica, argollas de cristal, corazones, "
              "conchitas y charms, con mostacillas y cristales. Tienda online con envíos a todo Chile.", "",
              "- Tienda: %stienda/" % SITIO, "- Instagram: %s" % IG, "- Facebook: %s" % FBK, "- WhatsApp: +%s" % WA,
              "- Envíos: a todo Chile desde Santiago (%s Región Metropolitana, %s resto de Chile, según la región). Sin retiro en tienda." % (VARS["envio_rm"], VARS["envio_regiones"]),
              "- Pagos: tarjeta de débito o crédito (Mercado Pago); transferencia coordinándola por WhatsApp.", "- Si un pedido llega con algún problema: escribir por WhatsApp o Instagram (%sdevoluciones.html)." % SITIO,
              "- Preguntas frecuentes: %spreguntas-frecuentes.html" % SITIO, "", "## Colecciones", ""]
    for c in cols:
        lineas.append("- [%s](%sc/%s.html): %s" % (c["nombre"], SITIO, c["slug"], descripcion_col(c) or c.get("sub") or ""))
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
    # clave de IndexNow (Bing y otros buscadores): herramientas/indexnow.py
    try:
        clave = re.search(r'CLAVE = "([0-9a-f]+)"', open("herramientas/indexnow.py", encoding="utf-8").read()).group(1)
        open(DIST + "/%s.txt" % clave, "w").write(clave)
    except (OSError, AttributeError):
        pass


# ------------------------------------------------------------------ panel

def panel():
    """El panel de administración (dist/admin) y el tema tal como quedó
    publicado, para que el editor parta desde lo que se ve en la web."""
    shutil.copytree("admin", DIST + "/admin")
    if os.path.isdir("demo"):
        shutil.copytree("demo", DIST + "/demo")      # páginas de prueba (no se indexan)
    import time
    ix = DIST + "/admin/index.html"
    contenido = open(ix, encoding="utf-8").read().replace("__V__", str(int(time.time())))
    open(ix, "w", encoding="utf-8").write(contenido)
    t = {k: v for k, v in TEMA.items()}
    t["paginas"] = {k: v for k, v in TEMA["paginas"].items() if not k.startswith("_x_")}
    json.dump({"tema": t, "defecto": T.TEMA_DEFECTO, "secciones": T.SECCIONES_PORTADA, "generado": date.today().isoformat(),
               "envio": {"rm": envio_de(REGION_RM), "regiones": ENV_RESTO}, "iconos": {k: T.icono(k) for k in T.ICONOS_TEMA}, "textosAntiguos": T.TEXTOS_ANTIGUOS, "migraciones": T.MIGRACIONES, "whatsapp": WA, "instagram": IG, "facebook": FBK, "correo": CORREO},
              open(DIST + "/admin/tema-actual.json", "w", encoding="utf-8"), ensure_ascii=False)


# ---------------------------------------------------------------- programa

def main():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    sys.path.insert(0, "herramientas")
    import firma as F
    firma_datos = F.firma()          # se toma ANTES de leer los datos: si algo cambia mientras se arma, la próxima revisión lo nota
    ajustes_tienda()
    ENVIOS_SCHEMA[:] = envios_schema()        # con las tarifas ya leídas de Configuración → Envío
    os.makedirs(DIST + "/estatico", exist_ok=True)
    for f in os.listdir(EST):
        shutil.copy(os.path.join(EST, f), DIST + "/estatico/" + f)
    shutil.copy("comun.js", DIST + "/estatico/comun.js")          # mismas reglas que el catálogo
    os.makedirs(DIST + "/assets", exist_ok=True)
    for f in ("logo-karive-web.png", "logo-karive.png", "logo-avatar.png", "modelo-portada.jpg", "modelo-argollas.jpg", "fondo-info.jpg") + tuple(f for f in ("logo-claro.png", "logo-original.png", "logo-brillo.png") if os.path.exists("assets/" + f)):
        shutil.copy("assets/" + f, DIST + "/assets/" + f)
    shutil.copytree("assets/pagos", DIST + "/assets/pagos")      # logos de tarjetas (página de pago)
    shutil.copytree("assets/sobre", DIST + "/assets/sobre", dirs_exist_ok=True)   # fotos de «Sobre nosotros»

    prods, cols, mas_vistos = cargar()
    publicar_fotos(prods)
    img_cols = imagenes_colecciones()
    ig_pubs = instagram()
    portada(prods, cols, mas_vistos, img_cols, ig_pubs)
    tienda(prods, cols)
    for c in cols:
        coleccion(c, cols)
    for p in prods:
        producto(p, cols)
    paginas_texto(cols)
    archivos_buscadores(prods, cols)
    panel()
    ajustes_respaldo()
    open(DIST + "/firma.txt", "w").write(firma_datos + "\n")
    open(DIST + "/version.txt", "w").write(VERSION)
    total = sum(len(fs) for _, _, fs in os.walk(DIST))
    print("productos: %d | colecciones: %d | archivos en %s: %d" % (len(prods), len(cols), DIST, total))


if __name__ == "__main__":
    main()
