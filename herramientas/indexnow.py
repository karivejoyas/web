"""
Avisa a los buscadores que usan IndexNow (Bing, Yandex, Seznam, Naver…) de las
páginas nuevas o cambiadas de karivejoyas.cl, para que las vuelvan a leer pronto.
Google no usa IndexNow: a Google le llega el mapa del sitio por Search Console.

Lo corre el workflow de publicación:
  python3 herramientas/indexnow.py preparar   (antes de publicar: compara el mapa
                                               del sitio nuevo con el que está en línea)
  python3 herramientas/indexnow.py avisar     (después de publicar: manda la lista)

Nunca hace fallar la publicación: si algo no responde, solo lo dice.
"""
import json
import re
import sys
import time
import urllib.request

SITIO = "https://karivejoyas.cl/"
CLAVE = "9566e3447e3961800182495270ba2e74"
PENDIENTES = "indexnow-pendientes.json"


def leer(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "KariveJoyas-publicador"}), timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def mapa(xml):
    """{url: lastmod} de un sitemap.xml"""
    return {m.group(1): m.group(2) or "" for m in re.finditer(r"<loc>([^<]+)</loc>(?:<lastmod>([^<]+)</lastmod>)?", xml)}


def preparar():
    nuevo = mapa(open("dist/sitemap.xml", encoding="utf-8").read())
    try:
        clave_en_linea = leer(SITIO + CLAVE + ".txt").strip() == CLAVE
    except Exception:
        clave_en_linea = False
    if not clave_en_linea:
        cambios = list(nuevo)          # primera vez en el dominio: se avisan todas
    else:
        try:
            antes = mapa(leer(SITIO + "sitemap.xml"))
        except Exception:
            antes = {}
        cambios = [u for u, f in nuevo.items() if antes.get(u) != f]
    json.dump(cambios, open(PENDIENTES, "w"))
    print("IndexNow: %d página(s) para avisar" % len(cambios))


def avisar():
    try:
        cambios = json.load(open(PENDIENTES))
    except Exception:
        cambios = []
    if not cambios:
        print("IndexNow: nada nuevo que avisar.")
        return
    # GitHub Pages tarda un poco en mostrar lo recién publicado
    for intento in range(8):
        try:
            if leer(SITIO + CLAVE + ".txt").strip() == CLAVE:
                break
        except Exception:
            pass
        time.sleep(20)
    else:
        print("IndexNow: karivejoyas.cl todavía no responde con la clave (¿el dominio ya apunta a la web?). Se avisará en la próxima publicación.")
        return
    datos = json.dumps({"host": "karivejoyas.cl", "key": CLAVE, "keyLocation": SITIO + CLAVE + ".txt", "urlList": cambios[:10000]}).encode()
    try:
        req = urllib.request.Request("https://api.indexnow.org/indexnow", data=datos, method="POST",
                                     headers={"Content-Type": "application/json; charset=utf-8"})
        with urllib.request.urlopen(req, timeout=30) as r:
            print("IndexNow: avisadas %d página(s) (respuesta %s)" % (len(cambios), r.status))
    except Exception as ex:
        print("IndexNow: no se pudo avisar (%s)" % ex)


if __name__ == "__main__":
    try:
        {"preparar": preparar, "avisar": avisar}[sys.argv[1] if len(sys.argv) > 1 else ""]()
    except Exception as ex:
        print("IndexNow:", ex)
