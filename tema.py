"""
Tema de la web: todos los textos, imágenes, colores, menús y páginas que se
editan desde el panel (Tienda online → Personalizar, Contenido → Páginas).

Lo que se guarda en el panel vive en Firestore, en catalog/web (campo "tema").
Lo que no esté ahí sale de TEMA_DEFECTO, así la web nunca queda en blanco.

En los textos se puede escribir:
  **así**            → negrita
  {envio_rm}         → costo de envío a la Región Metropolitana ($2.990)
  {envio_regiones}   → costo de envío a regiones ($3.990, o "$3.990 a $5.990" si varía)
  {envio_rango}      → de lo más barato a lo más caro ("$2.990 a $5.990")
y en el HTML de las páginas además:
  {tabla_envios}       → tabla con los costos de envío
  {tarjetas_contacto}  → tarjetas de WhatsApp, Instagram y correo
"""
import copy, html, json, re

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
    "sobre": "Sobre nosotros",
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

# ---------------------------------------------------------------------------
#  Textos de octubre 2026 (sin acero ni garantía de 3 meses; envíos por región;
#  sección «Sobre nosotros»). Se usan en TEMA_DEFECTO y en MIGRACIONES.
# ---------------------------------------------------------------------------
T_ANUNCIO = "Envíos a todo Chile · **Joyas hechas a mano** · ¿Dudas? Escríbenos por WhatsApp o Instagram"
T_CINTA = ["Hecho a mano", "Flores de arcilla", "Argollas de cristal", "Mostacillas", "Envíos a todo Chile {envio_rango}",
           "Diseños únicos", "Colores con personalidad"]
T_CONFIANZA = [
    {"icono": "camion", "titulo": "Envíos a todo Chile", "texto": "{envio_rm} RM · {envio_regiones} regiones"},
    {"icono": "tarjeta", "titulo": "Pago seguro", "texto": "Tarjeta de débito o crédito"},
    {"icono": "chat", "titulo": "¿Dudas? Escríbenos", "texto": "Te respondemos por WhatsApp o Instagram"},
    {"icono": "mano", "titulo": "Hecho a mano", "texto": "Cada par es único"},
]
T_BENEFICIOS = [
    "🚚 Envío a todo Chile: {envio_rm} en la RM · {envio_regiones} a regiones",
    "💳 Paga con tarjeta de débito o crédito (Mercado Pago)",
    "💬 ¿Dudas? Escríbenos por WhatsApp o Instagram",
]
T_HERO = ("Flores de arcilla polimérica, argollas de cristal y mostacillas, corazones y conchitas. "
          "Piezas livianas, alegres y únicas, para usar todos los días.")
T_PIE = "Joyas hechas a mano, diseños únicos, colores y mucha personalidad."
T_NOSOTROS_SEO = "Karivé Joyas es un taller de joyería artesanal en Chile: aros hechos a mano con arcilla polimérica, cristales y mostacillas."
T_NOSOTROS = """<p>Karivé Joyas nació del amor por crear joyas con nuestras propias manos: aros de arcilla polimérica, cristales y mostacillas, pensados para quienes disfrutan los colores y los detalles que no se encuentran en cualquier tienda.</p>
<p>Cada pieza se hace a mano, una por una, en nuestro taller: se modela la arcilla, se hornea, se lija, se pinta o se teje con cristales y mostacillas. Por eso ningún par es exactamente igual a otro.</p>
<h2>Cómo trabajamos</h2>
<p>Preferimos pocas piezas bien hechas a muchas iguales. Revisamos cada par antes de enviarlo y lo despachamos con cuidado a cualquier lugar de Chile.</p>
<p>Si sueñas con un diseño o un color especial, <a href="/contacto.html">escríbenos</a>: nos encanta crear piezas a pedido.</p>
<p style="margin-top:28px"><a class="btn btn-1" href="/tienda/">Ver la tienda</a></p>"""
T_PREGUNTAS_SEO = "Respuestas sobre materiales, cuidados, envíos a todo Chile, pagos y diseños a pedido de los aros hechos a mano de Karivé Joyas."
T_PREGUNTAS = [
    {"q": "¿De qué material son los aros?", "a": "Los hacemos a mano con arcilla polimérica, cristales, mostacillas y otros materiales que elegimos con cuidado para cada diseño."},
    {"q": "¿Cómo cuido mis aros?", "a": "**Arcilla polimérica:** es liviana y resistente, pero evita golpes y caídas. Límpiala con un paño suave y seco.\n"
                                        "**Cristales y mostacillas:** no los mojes ni los dejes en contacto con perfumes o cremas, y no tires del tejido para que no se suelte.\n"
                                        "**Partes metálicas:** si se mojan, sécalas bien para que mantengan su brillo.\n"
                                        "**Siempre:** sácatelos para ducharte, nadar o hacer deporte, y guárdalos por separado en un lugar seco, en su bolsita o cajita."},
    {"q": "¿Hacen envíos a regiones?", "a": "Sí, enviamos a todo Chile: {envio_rm} a la Región Metropolitana y {envio_regiones} a regiones, según la región. El costo exacto aparece al elegir tu región en la página de pago. No tenemos retiro en tienda."},
    {"q": "¿Cuánto demora mi pedido?", "a": "Preparamos tu pedido apenas verificamos el pago y te avisamos por correo o WhatsApp cuando va en camino, con su número de seguimiento."},
    {"q": "¿Cómo puedo pagar?", "a": "Con tarjeta de débito o crédito a través de Mercado Pago, directo en la web. Si prefieres pagar por transferencia, escríbenos por WhatsApp y lo coordinamos."},
    {"q": "¿Puedo pedir un modelo en otros colores?", "a": "Sí. Si te gusta un diseño pero lo imaginas en otro color, escríbenos por WhatsApp o Instagram y lo creamos para ti."},
    {"q": "¿Qué pasa si mi pedido llega con algún problema?", "a": "Escríbenos por WhatsApp o Instagram e intentaremos solucionar tu problema lo más pronto posible, según sea el caso."},
    {"q": "¿Son iguales a las fotos?", "a": "Sí, aunque al ser hechos a mano cada par puede tener pequeñas diferencias de tono o forma. Eso es parte de que sean únicos."},
]
T_CONTACTO = """<p>Escríbenos por tu canal favorito:</p>
{tarjetas_contacto}
<p>Somos una tienda en línea: despachamos desde Santiago a todo Chile y no tenemos retiro en tienda.</p>"""
T_ENVIOS_SEO = "Enviamos a todo Chile desde Santiago: {envio_rm} a la Región Metropolitana y {envio_regiones} a regiones. Así funcionan los despachos de Karivé Joyas."
T_ENVIOS = """{tabla_envios}
<p>Despachamos desde Santiago. Preparamos tu pedido apenas verificamos el pago y te avisamos por correo o WhatsApp cuando va en camino, con su número de seguimiento.</p>
<p>No tenemos retiro en tienda.</p>
<p>Si tu pedido llega con algún problema, escríbenos por WhatsApp o Instagram e intentaremos solucionarlo lo más pronto posible, según sea el caso.</p>"""
T_DEVOLUCIONES_SEO = "Cambios y devoluciones en Karivé Joyas: qué hacer si tu pedido llega con algún problema y cómo contactarnos."
T_DEVOLUCIONES = """<p>Cada par de aros se hace a mano y lo revisamos antes de enviarlo.</p>
<p>No tenemos cambios ni devoluciones por arrepentimiento (no aplica el derecho a retracto de las compras a distancia). Si algo no salió como esperabas, escríbenos: cada caso lo conversamos contigo y buscamos la mejor solución.</p>
<h2>Si tu pedido llega con algún problema</h2>
<p>Escríbenos por WhatsApp o Instagram e intentaremos solucionar tu problema lo más pronto posible, según sea el caso.</p>
{tarjetas_contacto}
<p>Para ayudarte más rápido, cuéntanos el <strong>código del producto</strong> (por ejemplo FL-001), qué pasó y, si puedes, mándanos una <strong>foto</strong>.</p>
<h2>Antes de comprar</h2>
<p>Para evitar sorpresas, en cada producto publicamos la <strong>medida aproximada</strong> y varias fotos. Si tienes dudas del tamaño, del color real o del material, escríbenos antes de comprar y te respondemos con gusto. Preferimos aclararte una duda a que recibas algo que no esperabas.</p>"""
T_PRIVACIDAD_SEO = "Política de privacidad de Karivé Joyas: qué datos usamos y para qué."
T_PRIVACIDAD = """<h2>Quiénes somos</h2>
<p>Karivé Joyas es un emprendimiento chileno de joyas artesanales hechas a mano. Este sitio web es nuestra tienda en línea.</p>
<h2>Qué datos usamos</h2>
<ul>
<li>No pedimos registro ni creación de cuentas.</li>
<li>Al comprar te pedimos nombre, correo, teléfono y dirección de envío, solo para preparar y enviar tu pedido.</li>
<li>Si te suscribes a las novedades, guardamos tu correo para avisarte de modelos nuevos.</li>
<li>No usamos cookies de seguimiento ni publicidad.</li>
</ul>
<h2>Estadísticas de visitas</h2>
<p>Para saber qué colecciones interesan más, guardamos de forma anónima: ciudad y región aproximadas (calculadas a partir de tu conexión, sin guardar la dirección IP), tipo de dispositivo y navegador, el sitio desde el que llegaste (por ejemplo Instagram) y qué colecciones o productos viste. Estos datos no incluyen tu nombre ni ningún dato que te identifique.</p>
<h2>Pedidos y contacto</h2>
<p>Puedes hacer tu pedido directamente en esta página o escribirnos por Instagram, Facebook o WhatsApp. Los datos que nos entregues (nombre, correo, teléfono y dirección de envío) se usan únicamente para preparar y enviar tu pedido y avisarte cómo va. El pago con tarjeta lo procesa Mercado Pago: nosotros no vemos ni guardamos los datos de tu tarjeta. Solo compartimos tu nombre y dirección con la empresa de envío que lleva tu pedido.</p>
<h2>Aplicaciones conectadas a redes sociales</h2>
<p>Utilizamos herramientas de Meta (Instagram y Facebook) exclusivamente para publicar el contenido de nuestro propio catálogo en nuestras propias cuentas oficiales. Estas herramientas no acceden, recopilan ni almacenan datos de otros usuarios.</p>"""
T_SOBRE = {
    "antetitulo": "Sobre nosotros",
    "titulo": "Pasión por los aros hechos a mano",
    "texto": "En Karivé Joyas amamos crear aros únicos. Cada par se diseña y se arma a mano en nuestro taller: flores de arcilla polimérica, argollas tejidas con cristales y mostacillas, corazones, charms y conchitas. Hacemos series pequeñas para que cada pieza sea tan especial como quien la usa.",
    "boton": {"texto": "Ver todos los productos", "url": "/tienda/"},
    "imagenes": ["/assets/sobre/argollas-mandala-dorado.jpg", "/assets/sobre/floron-morado.jpg", "/assets/sobre/TP-005.jpg",
                 "/assets/sobre/MA-002.jpg", "/assets/sobre/argollas-lila.jpg"],
}
T_DESCRIPCIONES = {
    "flores": "Flores de arcilla polimérica modeladas y pintadas a mano, pétalo por pétalo. Colores vivos, piezas livianas y un toque romántico para iluminar tu look, del día a día a una ocasión especial.",
    "charms": "Pequeños charms de arcilla que se mueven contigo: divertidos, coloridos y fáciles de combinar. Perfectos para darle personalidad a tus looks de todos los días.",
    "argollas": "Argollas tejidas a mano con cristales y mostacillas que atrapan la luz en cada movimiento. Brillo delicado, colores para todos los gustos y un diseño que no pasa desapercibido.",
    "topos": "Corazones pequeños tipo botón, livianos y cómodos para usar todo el día. Un detalle tierno y versátil que combina con todo, ideal para tener en varios colores.",
    "marina": "Conchitas, estrellas de mar y detalles inspirados en la costa, con terminaciones doradas y nacaradas. Para llevar el verano contigo todo el año.",
    "cmu236iia": "Diseños especiales para celebrar: Fiestas Patrias, Navidad y esas fechas que merecen algo distinto. Aros alegres y llenos de color para lucir en cada celebración.",
    "otros": "Formas, texturas y colores que no caben en una sola colección: piezas creativas, con mucha personalidad y hechas en series pequeñas.",
}

# Migración de lo guardado en el panel: si un texto todavía contiene la marca
# (o sea, es el texto antiguo de fábrica), se cambia por el nuevo. Si ya lo
# editaste a tu gusto y no tiene la marca, no se toca.  [ruta, marca, nuevo]
MIGRACIONES = [
    ["anuncio.texto", "3 meses de garantía", T_ANUNCIO],
    ["portada.cinta.items", "Base de acero quirúrgico", T_CINTA],
    ["portada.confianza.items", "3 meses de garantía", T_CONFIANZA],
    ["producto.beneficios", "3 meses de garantía", T_BENEFICIOS],
    ["portada.hero.texto", "con base de acero", T_HERO],
    ["pie.texto", "uno por uno, en Santiago de Chile", T_PIE],
    ["paginas.nosotros.html", "base de acero", T_NOSOTROS],
    ["paginas.nosotros.seoDesc", "base de acero", T_NOSOTROS_SEO],
    ["paginas.preguntas.items", "acero quirúrgico", T_PREGUNTAS],
    ["paginas.preguntas.seoDesc", "pagos, garantía", T_PREGUNTAS_SEO],
    ["paginas.contacto.html", "Escríbenos por donde te acomode", T_CONTACTO],
    ["paginas.envios.html", "si se extravía", T_ENVIOS],
    ["paginas.envios.seoDesc", "al resto del país", T_ENVIOS_SEO],
    ["paginas.devoluciones.html", "3 meses de garantía", T_DEVOLUCIONES],
    ["paginas.devoluciones.html", "antes de enviarlo.</p>\\n<h2>Si tu pedido llega", T_DEVOLUCIONES],   # sin cambios por arrepentimiento (la marca va como queda en JSON)
    ["paginas.devoluciones.seoDesc", "3 meses", T_DEVOLUCIONES_SEO],
    ["paginas.privacidad.html", "catálogo de solo lectura", T_PRIVACIDAD],
]


def _obtener(o, ruta):
    for k in ruta.split("."):
        if not isinstance(o, dict):
            return None
        o = o.get(k)
    return o


def _poner(o, ruta, v):
    ks = ruta.split(".")
    for k in ks[:-1]:
        if not isinstance(o.get(k), dict):
            o[k] = {}
        o = o[k]
    o[ks[-1]] = copy.deepcopy(v)


def migrar(t):
    """Aplica MIGRACIONES y pone «Sobre nosotros» donde estaba «Diseños a
    pedido» (que queda oculta). Igual que migrar() en admin/tienda.js."""
    t = copy.deepcopy(t)
    for ruta, marca, nuevo in MIGRACIONES:
        v = _obtener(t, ruta)
        if v is not None and marca in json.dumps(v, ensure_ascii=False):
            _poner(t, ruta, nuevo)
    p = t.get("portada") or {}
    orden = list(p.get("orden") or [])
    if orden and "sobre" not in orden:
        if "especial" in orden:
            orden[orden.index("especial")] = "sobre"
            ocultas = list(p.get("ocultas") or [])
            if "especial" not in ocultas:
                ocultas.append("especial")
            p["ocultas"] = ocultas
        else:
            orden.append("sobre")
        p["orden"] = orden
    return t


TEMA_DEFECTO = {
    "colores": {
        "fondo": "#FBF7F1", "fondo2": "#F4ECE1", "texto": "#2A1838", "suave": "#6B5A7B", "borde": "#E7DDEB",
        "principal": "#5B2A82", "oscuro": "#2A123E", "lila": "#CFC4DF", "dorado": "#B8902F", "doradoClaro": "#E3C572",
    },
    "anuncio": {"activo": True, "texto": T_ANUNCIO},
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
    "coleccionPagina": {"banners": {}, "descripciones": T_DESCRIPCIONES},
    "tiendaPagina": {"titulo": "Aros hechos a mano", "texto": "envío a todo Chile"},
    "pago": {"tarjetas": True, "courierNombre": "Bluexpress", "courierLogo": ""},
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
        "orden": ["hero", "cinta", "confianza", "colecciones", "favoritos", "taller", "nuevos", "instagram", "sobre", "especial"],
        "ocultas": ["especial"],
        "hero": {
            "antetitulo": "Joyería artesanal · Santiago, Chile",
            "titulo": "Aros hechos a mano, uno por uno",
            "texto": T_HERO,
            "boton1": {"texto": "Ver la tienda", "url": "/tienda/"},
            "boton2": {"texto": "Colecciones", "url": "#colecciones"},
            "imagen": "/assets/modelo-portada.jpg",
            "imagenAlt": "Modelo usando aros de flor hechos a mano de Karivé Joyas",
            "sello": "✦ Hecho a mano en Chile",
            "tarjetaNuevo": True,
        },
        "cinta": {"items": T_CINTA},
        "confianza": {"items": T_CONFIANZA},
        "colecciones": {"antetitulo": "Colecciones", "titulo": "Encuentra tu estilo", "enlace": "Ver todo →", "botonTarjeta": "Ver colección", "imagenes": {}},
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
            "circulo": "Hecho a mano · Mostacilla · Arcilla",
        },
        "nuevos": {"antetitulo": "Recién llegados", "titulo": "Lo nuevo del taller", "enlace": "Ver lo nuevo →", "cantidad": 8},
        "instagram": {"antetitulo": "Instagram", "titulo": "Lo último en nuestro Instagram", "enlace": "Síguenos →", "cantidad": 6},
        "sobre": T_SOBRE,
        "especial": {
            "antetitulo": "¿Buscas un diseño especial?",
            "titulo": "Hacemos tus colores favoritos",
            "texto": "Si te gusta un modelo pero lo imaginas en otro color, escríbenos y lo creamos para ti.",
            "boton": "Escríbenos por WhatsApp",
            "mensaje": "¡Hola Karivé! Quiero consultar por un diseño en otros colores 💜",
        },
    },
    "producto": {"beneficios": T_BENEFICIOS, "verDetalle": "Ver detalle"},
    "pie": {
        "texto": T_PIE,
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
            "seoDesc": T_NOSOTROS_SEO,
            "html": T_NOSOTROS,
        },
        "contacto": {
            "antetitulo": "Contacto",
            "titulo": "Conversemos",
            "seoTitulo": "Contacto | " + MARCA,
            "seoDesc": "Escríbenos por WhatsApp, Instagram o correo. Respondemos dudas de modelos, medidas, envíos y diseños a pedido.",
            "html": T_CONTACTO,
        },
        "envios": {
            "antetitulo": "Ayuda",
            "titulo": "Envíos",
            "seoTitulo": "Envíos a todo Chile | " + MARCA,
            "seoDesc": T_ENVIOS_SEO,
            "html": T_ENVIOS,
        },
        "preguntas": {
            "antetitulo": "Ayuda",
            "titulo": "Preguntas frecuentes",
            "seoTitulo": "Preguntas frecuentes | " + MARCA,
            "seoDesc": T_PREGUNTAS_SEO,
            "items": T_PREGUNTAS,
        },
        # devoluciones y privacidad: si no hay texto guardado se usa el de las
        # páginas del catálogo antiguo (devoluciones.html y privacidad.html)
        "devoluciones": {"antetitulo": "Ayuda", "titulo": "Cambios y devoluciones", "seoTitulo": "Cambios y devoluciones | " + MARCA, "seoDesc": T_DEVOLUCIONES_SEO, "html": T_DEVOLUCIONES},
        "privacidad": {"antetitulo": "Ayuda", "titulo": "Política de privacidad", "seoTitulo": "Política de privacidad | " + MARCA, "seoDesc": T_PRIVACIDAD_SEO, "html": T_PRIVACIDAD},
        "extra": [],
    },
}


# íconos de línea para los beneficios (en vez de emojis)
ICONOS_TEMA = {
    "camion": '<path d="M3 6.5h11v9H3zM14 9.5h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    "tarjeta": '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 14.5h4"/>',
    "chat": '<path d="M4 5.5h16v10H9l-4 3.5v-3.5H4z"/><path d="M8 10h8M8 12.8h5"/>',
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
