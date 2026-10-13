#!/usr/bin/env python3
"""
Firma de los datos de la web: cantidad de productos + su última modificación,
y la última modificación de la configuración y del tema. Si cambia algo
(un producto subido con el bot, un cupón, una foto de colección…), cambia la firma.

construir.py la deja en dist/firma.txt; el workflow la compara cada 10 minutos
con la de la web publicada y vuelve a publicar solo si es distinta.
"""
import json, urllib.parse, urllib.request

RAIZ = "https://firestore.googleapis.com/v1/projects/karive-catalogo/databases/(default)/documents"


def _get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def _fecha_doc(ruta, campo):
    try:
        return _get("%s/%s?mask.fieldPaths=%s" % (RAIZ, ruta, campo)).get("updateTime", "")
    except Exception:
        return ""


def firma():
    total, ultima, token = 0, "", ""
    while True:
        d = _get("%s/catalog/products/items?pageSize=300&mask.fieldPaths=code%s"
                 % (RAIZ, "&pageToken=" + urllib.parse.quote(token) if token else ""))
        for doc in d.get("documents", []):
            total += 1
            ultima = max(ultima, doc.get("updateTime", ""))
        token = d.get("nextPageToken")
        if not token:
            break
    return "%d|%s|%s|%s" % (total, ultima, _fecha_doc("catalog/settings", "whatsapp"), _fecha_doc("catalog/web", "nombreTema"))


if __name__ == "__main__":
    print(firma())
