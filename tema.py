"""
Tema de la web: todos los textos, imágenes, colores, menús y páginas que se
editan desde el panel (Tienda online → Personalizar, Contenido → Páginas).

Lo que se guarda en el panel vive en Firestore, en catalog/web (campo "tema").
Lo que no esté ahí sale de TEMA_DEFECTO, así la web nunca queda en blanco.

En los textos se puede escribir:
  **así**            → negrita
  {envio_rm}         → costo de envío a la Región Metropolitana ($2.990)
  {envio_regiones}   → costo de envío al resto de Chile ($3.990)
y en el HTML de las páginas además:
  {tabla_envios}       → tabla con los costos de envío
  {tarjetas_contacto}  → tarjetas de WhatsApp, Instagram y correo
"""
import copy, html, re

MARCA = "Karivé Joyas"

SECCIONES_PORTADA = {
    "hero": "Portada principal",
    "confianza": "Beneficios",
    "colecciones": "Colecciones",
    "favoritos": "Los más queridos",
    "taller": "Nuestro taller",
    "nuevos": "Lo nuevo",
    "especial": "Diseños a pedido",
}

TEMA_DEFECTO = {
    "colores": {
        "fondo": "#FBF7F1", "fondo2": "#F4ECE1", "texto": "#2A1838", "suave": "#6B5A7B", "borde": "#E7DDEB",
        "principal": "#5B2A82", "oscuro": "#2A123E", "lila": "#CFC4DF", "dorado": "#B8902F", "doradoClaro": "#E3C572",
    },
    "anuncio": {"activo": True, "texto": "Envíos a todo Chile · **Hecho a mano en Santiago** · 3 meses de garantía"},
    "menu": [
        {"texto": "Tienda", "url": "/tienda/"},
        {"texto": "Colecciones", "tipo": "colecciones"},
        {"texto": "Nosotros", "url": "/nosotros.html"},
        {"texto": "Preguntas", "url": "/preguntas-frecuentes.html"},
        {"texto": "Contacto", "url": "/contacto.html"},
    ],
    "menuPie": [
        {"texto": "Preguntas frecuentes", "url": "/preguntas-frecuentes.html"},
        {"texto": "Envíos", "url": "/envios.html"},
        {"texto": "Cambios y devoluciones", "url": "/devoluciones.html"},
        {"texto": "Privacidad", "url": "/privacidad.html"},
        {"texto": "Contacto", "url": "/contacto.html"},
    ],
    "whatsappFlotante": True,
    "seo": {
        "titulo": MARCA + " | Aros artesanales hechos a mano en Chile",
        "descripcion": "Aros artesanales hechos a mano en Santiago: flores de arcilla, argollas de cristal, corazones, conchas y charms. Compra online con envío a todo Chile.",
        "imagen": "/assets/modelo-portada.jpg",
    },
    "portada": {
        "orden": ["hero", "confianza", "colecciones", "favoritos", "taller", "nuevos", "especial"],
        "ocultas": [],
        "hero": {
            "antetitulo": "Joyería artesanal · Santiago, Chile",
            "titulo": "Aros hechos a mano, uno por uno",
            "texto": "Flores de arcilla polimérica, argollas de cristal, corazones y conchitas con base de acero. Piezas livianas, alegres y únicas, para usar todos los días o para regalar.",
            "boton1": {"texto": "Ver la tienda", "url": "/tienda/"},
            "boton2": {"texto": "Colecciones", "url": "#colecciones"},
            "imagen": "/assets/modelo-portada.jpg",
            "imagenAlt": "Modelo usando aros de flor hechos a mano de Karivé Joyas",
            "sello": "✦ Hecho a mano en Chile",
        },
        "confianza": {"items": [
            {"icono": "🚚", "titulo": "Envíos a todo Chile", "texto": "{envio_rm} RM · {envio_regiones} regiones"},
            {"icono": "💳", "titulo": "Pago seguro", "texto": "Mercado Pago o transferencia"},
            {"icono": "🛡️", "titulo": "3 meses de garantía", "texto": "Si llega con falla, lo solucionamos"},
            {"icono": "✋", "titulo": "Hecho a mano", "texto": "Cada par es único"},
        ]},
        "colecciones": {"antetitulo": "Colecciones", "titulo": "Encuentra tu estilo", "enlace": "Ver todo →"},
        "favoritos": {"antetitulo": "Favoritos", "titulo": "Los más queridos", "enlace": "Ver la tienda →", "cantidad": 8},
        "taller": {
            "antetitulo": "Nuestro taller",
            "titulo": "Hechos a mano en Santiago, con calma y con cariño",
            "texto": "Cada par de aros se modela, se hornea y se arma a mano. Por eso ningún par es idéntico a otro: esas pequeñas diferencias son parte de lo que los hace únicos.",
            "imagen": "/assets/modelo-argollas.jpg",
            "imagenAlt": "Argollas de cristal hechas a mano por Karivé Joyas",
            "pasos": [
                "Elige tus favoritos y agrégalos al carrito.",
                "Paga con tarjeta (Mercado Pago) o transferencia.",
                "Los enviamos en su empaque, listos para regalar, a cualquier lugar de Chile.",
            ],
            "boton": {"texto": "Conoce Karivé", "url": "/nosotros.html"},
        },
        "nuevos": {"antetitulo": "Recién llegados", "titulo": "Lo nuevo del taller", "enlace": "Ver lo nuevo →", "cantidad": 8},
        "especial": {
            "antetitulo": "¿Buscas un diseño especial?",
            "titulo": "Hacemos tus colores favoritos",
            "texto": "Si te gusta un modelo pero lo imaginas en otro color, escríbenos y lo creamos para ti.",
            "boton": "Escríbenos por WhatsApp",
            "mensaje": "¡Hola Karivé! Quiero consultar por un diseño en otros colores 💜",
        },
    },
    "producto": {
        "beneficios": [
            "🚚 Envío a todo Chile: {envio_rm} en la RM · {envio_regiones} a regiones",
            "💳 Paga con tarjeta (Mercado Pago) o transferencia",
            "🛡️ 3 meses de garantía por fallas",
        ],
    },
    "pie": {
        "texto": "Aros artesanales hechos a mano, uno por uno, en Santiago de Chile. Flores de arcilla, argollas de cristal, corazones, conchas y charms.",
        "boletinTitulo": "Novedades",
        "boletinTexto": "Entérate primero de los modelos nuevos.",
        "final": "Hecho a mano en Chile 💜",
    },
    "paginas": {
        "nosotros": {
            "antetitulo": "Nosotros",
            "titulo": "Accesorios que iluminan, hechos con amor",
            "seoTitulo": "Nosotros: joyería artesanal hecha a mano | " + MARCA,
            "seoDesc": "Karivé Joyas es un taller de joyería artesanal en Santiago de Chile: aros hechos a mano, uno por uno, con arcilla polimérica, cristales y base de acero.",
            "html": """<p>Karivé Joyas nació en Santiago de Chile de las ganas de crear aros alegres, livianos y distintos a los que se encuentran en cualquier tienda.</p>
<p>Cada pieza se hace a mano, una por una, en nuestro taller: se modela la arcilla polimérica, se hornea, se lija, se pinta o se arma con cristales y mostacillas, y se monta sobre una base de acero. Por eso ningún par es exactamente igual a otro.</p>
<h2>Lo que hacemos</h2>
<ul><li><a href="/c/flores.html">Aros de flores</a> de arcilla polimérica, en muchos colores.</li><li><a href="/c/argollas-de-cristal.html">Argollas de cristal</a> hechas a mano.</li>
<li><a href="/c/corazones.html">Corazones</a> pequeños para el día a día.</li><li><a href="/c/marina.html">Conchitas y estrellas de mar</a>, inspiradas en la costa.</li>
<li><a href="/c/charms.html">Charms</a> y piezas para fechas especiales.</li></ul>
<h2>Cómo trabajamos</h2>
<p>Preferimos pocas piezas bien hechas a muchas iguales. Revisamos cada par antes de enviarlo y lo despachamos en su empaque, listo para regalar, a cualquier lugar de Chile.</p>
<p>Si sueñas con un diseño o un color especial, <a href="/contacto.html">escríbenos</a>: nos encanta crear piezas a pedido.</p>
<p style="margin-top:28px"><a class="btn btn-1" href="/tienda/">Ver la tienda</a></p>""",
        },
        "contacto": {
            "antetitulo": "Contacto",
            "titulo": "Conversemos",
            "seoTitulo": "Contacto | " + MARCA,
            "seoDesc": "Escríbenos por WhatsApp, Instagram o correo. Respondemos dudas de modelos, medidas, envíos y diseños a pedido.",
            "html": """<p>¿Dudas sobre un modelo, una medida o tu pedido? Escríbenos por donde te acomode.</p>
{tarjetas_contacto}
<p>Somos una tienda en línea: despachamos desde Santiago a todo Chile y no tenemos retiro en tienda.</p>""",
        },
        "envios": {
            "antetitulo": "Ayuda",
            "titulo": "Envíos",
            "seoTitulo": "Envíos a todo Chile | " + MARCA,
            "seoDesc": "Enviamos a todo Chile desde Santiago: {envio_rm} a la Región Metropolitana y {envio_regiones} al resto del país. Así funcionan los despachos de Karivé Joyas.",
            "html": """{tabla_envios}
<p>Despachamos desde Santiago. Preparamos tu pedido apenas verificamos el pago y te avisamos cuando va en camino, con su número de seguimiento.</p>
<p>No tenemos retiro en tienda. Si tu pedido no llega en el plazo estimado, escríbenos y lo rastreamos contigo; si se extravía, te lo reenviamos o te devolvemos el dinero.</p>""",
        },
        "preguntas": {
            "antetitulo": "Ayuda",
            "titulo": "Preguntas frecuentes",
            "seoTitulo": "Preguntas frecuentes | " + MARCA,
            "seoDesc": "Respuestas sobre materiales, envíos a todo Chile, pagos, garantía y diseños a pedido de los aros hechos a mano de Karivé Joyas.",
            "items": [
                {"q": "¿De qué material son los aros?", "a": "Los hacemos a mano con arcilla polimérica, cristales, mostacillas y otros materiales, siempre sobre una base de acero quirúrgico. Si tienes la piel muy sensible, escríbenos antes de comprar."},
                {"q": "¿Hacen envíos a regiones?", "a": "Sí, enviamos a todo Chile desde Santiago: {envio_rm} a la Región Metropolitana y {envio_regiones} al resto del país. No tenemos retiro en tienda."},
                {"q": "¿Cuánto demora mi pedido?", "a": "Preparamos tu pedido apenas verificamos el pago y te avisamos cuando va en camino, con su número de seguimiento."},
                {"q": "¿Cómo puedo pagar?", "a": "Con tarjeta de débito o crédito a través de Mercado Pago, o por transferencia bancaria (en ese caso adjuntas el comprobante al terminar la compra)."},
                {"q": "¿Puedo pedir un modelo en otros colores?", "a": "Sí. Si te gusta un diseño pero lo imaginas en otro color, escríbenos por WhatsApp o Instagram y lo creamos para ti."},
                {"q": "¿Qué pasa si mi pedido llega con una falla?", "a": "Tienes 3 meses de garantía legal: lo cambiamos, lo reparamos o te devolvemos el dinero, y el envío de vuelta lo pagamos nosotros. Por higiene no aceptamos cambios por arrepentimiento."},
                {"q": "¿Son iguales a las fotos?", "a": "Sí, aunque al ser hechos a mano cada par puede tener pequeñas diferencias de tono o forma. Eso es parte de que sean únicos."},
                {"q": "¿Sirven para regalo?", "a": "¡Claro! Todos nuestros aros se envían en su empaque, listos para regalar."},
            ],
        },
        # devoluciones y privacidad: si no hay texto guardado se usa el de las
        # páginas del catálogo antiguo (devoluciones.html y privacidad.html)
        "devoluciones": {"titulo": "", "seoTitulo": "", "seoDesc": "", "html": ""},
        "privacidad": {"titulo": "", "seoTitulo": "", "seoDesc": "", "html": ""},
        "extra": [],
    },
}


def mezclar(base, encima):
    """Combina el tema guardado sobre el de fábrica. Las listas guardadas
    reemplazan completas a las de fábrica (así se pueden borrar ítems)."""
    if not isinstance(encima, dict):
        return copy.deepcopy(base)
    out = copy.deepcopy(base)
    for k, v in encima.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = mezclar(out[k], v)
        elif v is not None:
            out[k] = copy.deepcopy(v)
    return out


def pesos(n):
    return "$" + format(int(n or 0), ",").replace(",", ".")


def reemplazos(s, extra):
    for k, v in extra.items():
        s = s.replace("{%s}" % k, v)
    return s


def texto(s, extra):
    """Texto plano del tema → HTML seguro (con **negrita**, saltos y {variables})."""
    s = html.escape(str(s or ""), quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = s.replace("\n", "<br>")
    return reemplazos(s, extra)


def plano(s, extra):
    """Para títulos y descripciones de buscadores: sin HTML."""
    return reemplazos(re.sub(r"\*\*(.+?)\*\*", r"\1", str(s or "")), extra)
