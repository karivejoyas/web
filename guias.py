"""
Guías de Karivé Joyas (karivejoyas.cl/guias/). Textos para quienes buscan en
Google cómo cuidar sus aros, qué regalar o qué es la arcilla polimérica.
construir.py arma una página por guía y el índice /guias/.

Para cambiar un texto, edítalo aquí (es HTML simple). Los enlaces a
colecciones usan las direcciones de la tienda (/c/…).
"""

GUIAS = [
    {
        "slug": "como-cuidar-tus-aros",
        "titulo": "Cómo cuidar tus aros hechos a mano",
        "seo": "Cómo cuidar tus aros hechos a mano | Karivé Joyas",
        "desc": "Consejos simples para que tus aros de arcilla polimérica, cristales y mostacillas se mantengan lindos por mucho tiempo: cómo guardarlos, limpiarlos y qué evitar.",
        "resumen": "Cómo guardarlos, limpiarlos y qué evitar para que te duren mucho tiempo.",
        "imagen": "/assets/sobre/argollas-lila.jpg",
        "html": """
<p>Cada par de aros Karivé se hace a mano, pieza por pieza. Con unos cuidados muy simples se mantienen como nuevos por mucho tiempo. Aquí te contamos cómo.</p>

<h2>Lo básico, para todos tus aros</h2>
<ul>
  <li><strong>Póntelos al final.</strong> Primero el perfume, la crema, el maquillaje y el spray para el pelo; los aros, al último. Así no les caen productos que opacan los colores y los metales.</li>
  <li><strong>Sácatelos para el agua.</strong> Antes de ducharte, bañarte en la piscina o en el mar, y para hacer deporte. El agua, el cloro, la sal y el sudor desgastan las terminaciones.</li>
  <li><strong>Guárdalos por separado.</strong> En su bolsita o caja, o en un joyero con divisiones, para que no se rayen ni se enreden entre ellos.</li>
  <li><strong>Lejos del sol y del calor.</strong> No los dejes al sol directo ni dentro del auto: el calor fuerte y la luz constante pueden apagar los colores.</li>
  <li><strong>Límpialos con suavidad.</strong> Un paño suave y seco después de usarlos basta. Nada de cloro, alcohol ni productos abrasivos.</li>
</ul>

<h2>Aros de arcilla polimérica (como las flores)</h2>
<p>La arcilla polimérica, una vez horneada, queda firme y liviana. Es resistente para el uso diario, pero los detalles finos —como los pétalos de las flores— se cuidan mejor si no se doblan ni se golpean.</p>
<ul>
  <li>Si se ensucian, pásales un paño apenas húmedo y sécalos enseguida.</li>
  <li>No los dejes en el agua ni los laves bajo la llave.</li>
  <li>Guárdalos sin peso encima, para que las piezas con relieve no se deformen ni se quiebren.</li>
</ul>

<h2>Argollas de cristal y mostacillas</h2>
<p>Están tejidas a mano, cristal por cristal, con hilo. Su brillo se mantiene si las tratas con cariño:</p>
<ul>
  <li>No tires de los cristales ni las enganches en la ropa al sacarte el chaleco o la polera.</li>
  <li>Guárdalas abiertas o colgadas, sin aplastarlas, para que el tejido conserve su forma.</li>
  <li>Para limpiarlas, un paño seco. Si notas un hilo suelto, escríbenos antes de que se suelte más.</li>
</ul>

<h2>Las partes metálicas (ganchos, argollas y bases)</h2>
<ul>
  <li>Sécalas bien si se mojan y guárdalas en un lugar seco: la humedad es lo que más las opaca.</li>
  <li>Evita el contacto con perfumes y cremas, que con el tiempo cambian su color.</li>
  <li>Si tienes la piel sensible a algún metal, escríbenos antes de comprar y te contamos qué materiales lleva cada modelo.</li>
</ul>

<h2>¿Y si algo le pasa a tus aros?</h2>
<p>Escríbenos por WhatsApp o Instagram con una foto y el código del producto (está en su ficha). Vemos cada caso contigo y buscamos la mejor solución.</p>
""",
    },
    {
        "slug": "aros-para-regalar",
        "titulo": "Ideas de aros para regalar",
        "seo": "Ideas de aros para regalar: guía por estilo y ocasión | Karivé Joyas",
        "desc": "¿Buscas un regalo especial? Ideas de aros hechos a mano para regalar según el estilo de quien los recibe y la ocasión: cumpleaños, aniversarios, Navidad y más.",
        "resumen": "Qué elegir según el estilo de quien los recibe y la ocasión.",
        "imagen": "/assets/sobre/argollas-mandala-dorado.jpg",
        "html": """
<p>Unos aros hechos a mano son un regalo que se nota pensado: piezas únicas, livianas y con personalidad. Aquí van ideas para acertar según a quién se los vas a regalar.</p>

<h2>Según su estilo</h2>
<ul>
  <li><strong>Romántica y femenina:</strong> las <a href="/c/flores.html">flores de arcilla polimérica</a>, modeladas y pintadas a mano pétalo por pétalo, o los <a href="/c/corazones.html">corazones</a>.</li>
  <li><strong>Le encanta el brillo:</strong> las <a href="/c/argollas-de-cristal.html">argollas de cristal</a>, tejidas con cristales y mostacillas que atrapan la luz.</li>
  <li><strong>Divertida y llena de color:</strong> los <a href="/c/charms.html">charms</a>, que se mueven con ella y combinan con todo.</li>
  <li><strong>Ama la playa:</strong> la <a href="/c/marina.html">colección Marina</a>, con conchitas, estrellas de mar y detalles inspirados en la costa.</li>
  <li><strong>Busca algo distinto:</strong> la colección <a href="/c/otros.html">Otros</a>, con formas y texturas que no se ven en cualquier tienda.</li>
</ul>

<h2>Según la ocasión</h2>
<ul>
  <li><strong>Cumpleaños:</strong> elige su color favorito; si no lo sabes, los tonos dorados, blancos y lilas combinan con casi todo.</li>
  <li><strong>Aniversario o San Valentín:</strong> los corazones son un clásico que nunca falla.</li>
  <li><strong>Fiestas Patrias, Navidad y fechas especiales:</strong> mira la colección <a href="/c/fiestas.html">Fiestas</a>.</li>
  <li><strong>Día de la Madre, amigas o profesoras:</strong> un par de flores o de argollas es un detalle que se usa todos los días.</li>
  <li><strong>Para ti:</strong> porque un buen regalo también puede ser propio.</li>
</ul>

<h2>Consejos para acertar</h2>
<ul>
  <li><strong>Mira la medida.</strong> En cada ficha publicamos la medida aproximada. Si quien los recibe usa aros pequeños, elige una medida discreta; si le gustan los llamativos, atrévete con los más grandes.</li>
  <li><strong>Fíjate en sus aros de siempre.</strong> Si usa colgantes, argollas o aros pegados a la oreja, te da una buena pista.</li>
  <li><strong>Pregúntanos.</strong> Escríbenos por WhatsApp con lo que sabes de la persona y te ayudamos a elegir.</li>
</ul>

<h2>Listos para regalar</h2>
<p>Todos los aros se envían en su empaque, listos para entregar. Despachamos a todo Chile: si quieres, el pedido puede llegar directo a la dirección de quien lo recibe; agrégalo en la nota del pedido.</p>
""",
    },
    {
        "slug": "aros-de-arcilla-polimerica",
        "titulo": "Aros de arcilla polimérica: qué son y por qué enamoran",
        "seo": "Aros de arcilla polimérica: qué son, cómo se hacen y cómo cuidarlos | Karivé Joyas",
        "desc": "Qué es la arcilla polimérica, cómo se hacen los aros a mano, por qué son tan livianos y cómo cuidarlos. Todo sobre los aros de arcilla polimérica de Karivé Joyas.",
        "resumen": "Qué es, cómo se trabaja a mano y por qué los aros son tan livianos.",
        "imagen": "/assets/sobre/floron-morado.jpg",
        "html": """
<p>Si te has preguntado por qué nuestros aros de flores son tan livianos y coloridos, la respuesta está en el material: la arcilla polimérica.</p>

<h2>¿Qué es la arcilla polimérica?</h2>
<p>Es una pasta para modelar que se mantiene blanda mientras se trabaja y se endurece al hornearla a baja temperatura. Una vez horneada, queda firme, liviana y con el color fijo: no se pinta encima de un molde, el color es parte de la pieza.</p>

<h2>Cómo hacemos nuestros aros</h2>
<ol>
  <li><strong>Mezclamos los colores</strong> a mano hasta lograr el tono buscado.</li>
  <li><strong>Modelamos cada pieza</strong> a mano: en las flores, pétalo por pétalo.</li>
  <li><strong>Horneamos</strong> para que la pieza quede firme.</li>
  <li><strong>Lijamos, pintamos los detalles y armamos</strong> cada par con sus ganchos.</li>
  <li><strong>Revisamos cada par</strong> antes de enviarlo.</li>
</ol>
<p>Como todo es hecho a mano, cada par puede tener pequeñas diferencias de color o de forma. Eso es justamente lo que los hace únicos.</p>

<h2>¿Por qué elegir aros de arcilla polimérica?</h2>
<ul>
  <li><strong>Son muy livianos:</strong> puedes usar aros grandes y llamativos sin que te pesen en la oreja.</li>
  <li><strong>Tienen colores vivos</strong> que no se ven en la joyería tradicional.</li>
  <li><strong>Son piezas únicas</strong>, hechas en series pequeñas.</li>
</ul>

<h2>Cómo cuidarlos</h2>
<p>Mantenlos secos, guárdalos sin peso encima y límpialos con un paño suave. Te lo explicamos con detalle en nuestra guía <a href="/guias/como-cuidar-tus-aros.html">Cómo cuidar tus aros hechos a mano</a>.</p>

<h2>Míralos en la tienda</h2>
<p>Encuentra nuestros aros de arcilla polimérica en la colección <a href="/c/flores.html">Flores</a>. Si quieres saber de qué está hecho un modelo en particular, escríbenos y te contamos.</p>
""",
    },
]
