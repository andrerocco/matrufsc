#!/usr/bin/env python3

"""
Verifica se um semestre está disponível no CAGR.

Uso: python check_semestre.py <semestre>
Retorna exit code 0 se disponível, 1 se não.
"""

from bs4 import BeautifulSoup
import http.cookiejar
import urllib.request
import sys

if len(sys.argv) < 2:
    print("usage: %s <semestre>" % sys.argv[0])
    sys.exit(1)

semestre = sys.argv[1]

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(jar), urllib.request.HTTPSHandler(debuglevel=0)
)

resp = opener.open("https://cagr.sistemas.ufsc.br/modules/comunidade/cadastroTurmas/")
soup = BeautifulSoup(resp, features="html.parser")

select = soup.find("select", {"id": "formBusca:selectSemestre"})
if select is None:
    print("Could not find semester select element")
    sys.exit(1)

available = [option["value"] for option in select.find_all("option") if option["value"]]
print("Available semesters: %s" % ", ".join(available))

if semestre in available:
    print("Semester %s is available" % semestre)
    sys.exit(0)
else:
    print("Semester %s is NOT available" % semestre)
    sys.exit(1)
