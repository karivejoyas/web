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
    "cinta": "Cinta en movimiento",
    "confianza": "Beneficios",
    "colecciones": "Colecciones",
    "favoritos": "Los más queridos",
    "taller": "Nuestro taller",
    "nuevos": "Lo nuevo",
    "especial": "Diseños a pedido",
    "instagram": "Instagram",
}

# opciones de los efectos (Personalizar → Efectos)
EFECTOS_PORTADA = {
    "destello": "Destello (la foto se descubre y la cruza una luz)",
    "lento": "Movimiento lento (la foto se acerca despacio, siempre)",
    "cortina": "Cortina morada",
    "arco": "Arco que se abre",
    "profundidad": "Profundidad con el mouse",
    "ninguno": "Sin efecto",
}
TRANSICIONES = {
    "profundidad": "Profundidad (la página se aleja y la nueva llega desde adelante)",
    "vuela": "La foto vuela (la foto del producto viaja a la ficha)",
    "cortina": "Cortina que sube",
    "deslizar": "Deslizar de lado",
    "ninguna": "Sin transición",
}

TEMA_DEFECTO = {
    "colores": {
        "fondo": "#FBF7F1", "fondo2": "#F4ECE1", "texto": "#2A1838", "suave": "#6B5A7B", "borde": "#E7DDEB",
        "principal": "#5B2A82", "oscuro": "#2A123E", "lila": "#CFC4DF", "dorado": "#B8902F", "doradoClaro": "#E3C572",
    },
    "anuncio": {"activo": True, "texto": "Envíos a todo Chile · **Hecho a mano en Santiago** · 3 meses de garantía"},
    "menu": [
        {"texto": "Ver todo", "url": "/tienda/"},
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
    "whatsappRespira": True,
    "logo": {"alto": 44, "altoMovil": 38, "altoPie": 52},
    "efectos": {"portada": "destello", "transicion": "profundidad"},
    "olas": {"activo": True, "animacion": True, "alto": 110, "altoMovil": 64, "color": ""},
    "chat": {
        "activo": True,
        "nombre": "Asistente Karivé",
        "saludo": "¡Hola! 💜 Soy la asistente de Karivé Joyas. Te ayudo a encontrar aros, ver precios, envíos o cómo comprar.",
        "invitacion": "",
        "mensajes": [
            "¿Te ayudo? 💜",
            "¿Buscas un regalo? Te ayudo a elegir 🎁",
            "Dime tu presupuesto y te muestro opciones ✨",
        ],
    },
    "seo": {
        "titulo": MARCA + " | Aros artesanales hechos a mano en Chile",
        "descripcion": "Aros artesanales hechos a mano en Santiago: flores de arcilla, argollas de cristal, corazones, conchas y charms. Compra online con envío a todo Chile.",
        "imagen": "/assets/modelo-portada.jpg",
    },
    "portada": {
        "orden": ["hero", "cinta", "confianza", "colecciones", "favoritos", "taller", "nuevos", "instagram", "especial"],
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
            "tarjetaNuevo": True,
        },
        "cinta": {"items": [
            "Hecho a mano en Santiago", "Flores de arcilla", "Argollas de cristal", "Envíos a todo Chile",
            "Base de acero quirúrgico", "Piezas únicas", "Listos para regalar",
        ]},
        "confianza": {"items": [
            {"icono": "camion", "titulo": "Envíos a todo Chile", "texto": "{envio_rm} RM · {envio_regiones} regiones"},
            {"icono": "tarjeta", "titulo": "Pago seguro", "texto": "Tarjeta de débito o crédito"},
            {"icono": "escudo", "titulo": "3 meses de garantía", "texto": "Si llega con falla, lo solucionamos"},
            {"icono": "mano", "titulo": "Hecho a mano", "texto": "Cada par es único"},
        ]},
        "colecciones": {"antetitulo": "Colecciones", "titulo": "Encuentra tu estilo", "enlace": "Ver todo →", "imagenes": {}},
        "favoritos": {"antetitulo": "Favoritos", "titulo": "Los más queridos", "enlace": "Ver la tienda →", "cantidad": 8},
        "taller": {
            "antetitulo": "Nuestro taller",
            "titulo": "Hechos a mano en Santiago, con calma y con cariño",
            "texto": "Cada par de aros se modela, se hornea y se arma a mano. Por eso ningún par es idéntico a otro: esas pequeñas diferencias son parte de lo que los hace únicos.",
            "imagen": "/assets/modelo-argollas.jpg",
            "imagenAlt": "Argollas de cristal hechas a mano por Karivé Joyas",
            "pasos": [
                "Elige tus favoritos y agrégalos al carrito.",
                "Paga con tarjeta de débito o crédito (Mercado Pago).",
                "Los enviamos en su empaque, listos para regalar, a cualquier lugar de Chile.",
            ],
            "boton": {"texto": "Conoce Karivé", "url": "/nosotros.html"},
        },
        "nuevos": {"antetitulo": "Recién llegados", "titulo": "Lo nuevo del taller", "enlace": "Ver lo nuevo →", "cantidad": 8},
        "instagram": {"antetitulo": "Instagram", "titulo": "Lo último en nuestro Instagram", "enlace": "Síguenos →", "cantidad": 6},
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
            "💳 Paga con tarjeta de débito o crédito (Mercado Pago)",
            "🛡️ 3 meses de garantía por fallas",
        ],
    },
    "pie": {
        "texto": "Aros artesanales hechos a mano, uno por uno, en Santiago de Chile. Flores de arcilla, argollas de cristal, corazones, conchas y charms.",
        "boletinTitulo": "Novedades",
        "boletinTexto": "Entérate primero de los modelos nuevos.",
        "final": "Hecho a mano en Chile 💜",
        "tiktok": "",
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
                {"q": "¿Cómo puedo pagar?", "a": "Con tarjeta de débito o crédito a través de Mercado Pago, directo en la web. Si prefieres pagar por transferencia, escríbenos por WhatsApp y lo coordinamos."},
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


# íconos de línea para los beneficios (en vez de emojis)
ICONOS_TEMA = {
    "camion": '<path d="M3 6.5h11v9H3zM14 9.5h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    "tarjeta": '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 14.5h4"/>',
    "escudo": '<path d="M12 3 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6l-7-3Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    "mano": '<path d="M8 12V5.8a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-4.5a1.5 1.5 0 0 1 3 0V14c0 4-2.7 7-6.5 7-2.7 0-4.3-1.3-5.8-3.6L3.7 14.6a1.6 1.6 0 0 1 2.6-1.8L8 15"/>',
    "corazon": '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
    "regalo": '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18v3H3zM12 9v11M12 9S10.5 4 8 4.5 7.5 9 12 9Zm0 0s1.5-5 4-4.5S16.5 9 12 9Z"/>',
    "estrella": '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"/>',
    "flor": '<circle cx="12" cy="12" r="2.4"/><path d="M12 9.6C9.5 6 10 3.5 12 3.5s2.5 2.5 0 6.1Zm0 4.8c2.5 3.6 2 6.1 0 6.1s-2.5-2.5 0-6.1ZM9.6 12C6 14.5 3.5 14 3.5 12S6 9.5 9.6 12Zm4.8 0c3.6-2.5 6.1-2 6.1 0s-2.5 2.5-6.1 0Z"/>',
    "reloj": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    "chispa": '<path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z"/>',
}
EMOJI_ICONO = {"🚚": "camion", "💳": "tarjeta", "🛡️": "escudo", "🛡": "escudo", "✋": "mano", "💜": "corazon", "🎁": "regalo", "⭐": "estrella", "🌸": "flor", "✨": "chispa"}


def icono(nombre):
    """SVG de un ícono del tema; si viene un emoji antiguo se traduce."""
    k = EMOJI_ICONO.get(str(nombre or "").strip(), str(nombre or "").strip())
    d = ICONOS_TEMA.get(k)
    if not d:
        return html.escape(str(nombre or ""))
    return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true">%s</svg>' % d)


# Textos que cambiaron de fábrica: si el tema guardado todavía tiene el texto
# antiguo tal cual (o sea, nunca lo editaste), se usa el nuevo.
TEXTOS_ANTIGUOS = {
    '¿Te ayudo a encontrar tus aros? 💜': '¿Te ayudo? 💜',
    'Mercado Pago o transferencia': 'Tarjeta de débito o crédito',
    'Paga con tarjeta (Mercado Pago) o transferencia.': 'Paga con tarjeta de débito o crédito (Mercado Pago).',
    '💳 Paga con tarjeta (Mercado Pago) o transferencia': '💳 Paga con tarjeta de débito o crédito (Mercado Pago)',
    'Con tarjeta de débito o crédito a través de Mercado Pago, o por transferencia bancaria (en ese caso adjuntas el comprobante al terminar la compra).': 'Con tarjeta de débito o crédito a través de Mercado Pago, directo en la web. Si prefieres pagar por transferencia, escríbenos por WhatsApp y lo coordinamos.',
}


def actualizar_textos(v, menu=True):
    """Pasa los textos antiguos de fábrica a los nuevos (ver TEXTOS_ANTIGUOS).
    En el menú, «Tienda» (que lleva a /tienda/) pasa a llamarse «Ver todo»."""
    if menu and isinstance(v, dict) and isinstance(v.get("menu"), list):
        v = dict(v)
        v["menu"] = [dict(it, texto="Ver todo") if isinstance(it, dict) and it.get("texto") == "Tienda" and it.get("url") == "/tienda/" else it for it in v["menu"]]
    if isinstance(v, dict):
        return {k: actualizar_textos(x, False) for k, x in v.items()}
    if isinstance(v, list):
        return [actualizar_textos(x, False) for x in v]
    if isinstance(v, str):
        return TEXTOS_ANTIGUOS.get(v, v)
    return v


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
