#!/usr/bin/env python3

"""
Determina o próximo semestre a ser scrapeado.

Verifica o último semestre no index.json, calcula o próximo,
checa se já existe localmente, e consulta o CAGR para saber
se está disponível.

Saída (stdout): o código do próximo semestre (ex: 20262)
Exit codes:
  0 - próximo semestre disponível para scrape
  1 - semestre já existe localmente ou não está disponível no CAGR
"""

from bs4 import BeautifulSoup
import http.cookiejar
import urllib.request
import json
import glob
import sys
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "../../matrufsc/public/data")
INDEX_PATH = os.path.join(DATA_DIR, "index.json")


def get_latest_semester():
    with open(INDEX_PATH) as f:
        data = json.load(f)
    return data["semesters"][0]["value"]


def calc_next_semester(current):
    year = int(current[:4])
    half = current[4]
    if half == "1":
        return f"{year}2"
    else:
        return f"{year + 1}1"


def semester_exists_locally(semester):
    year = semester[:4]
    pattern = os.path.join(DATA_DIR, year, f"{semester}-*.json")
    return len(glob.glob(pattern)) > 0


def semester_available_on_cagr(semester):
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(debuglevel=0),
    )
    resp = opener.open(
        "https://cagr.sistemas.ufsc.br/modules/comunidade/cadastroTurmas/"
    )
    soup = BeautifulSoup(resp, features="html.parser")
    select = soup.find("select", {"id": "formBusca:selectSemestre"})
    if select is None:
        print("Could not find semester select element on CAGR", file=sys.stderr)
        return False
    available = [opt["value"] for opt in select.find_all("option") if opt["value"]]
    return semester in available


def main():
    latest = get_latest_semester()
    next_sem = calc_next_semester(latest)
    print(f"Latest: {latest}, Next: {next_sem}", file=sys.stderr)

    if semester_exists_locally(next_sem):
        print(f"Semester {next_sem} already exists locally", file=sys.stderr)
        sys.exit(1)

    if not semester_available_on_cagr(next_sem):
        print(f"Semester {next_sem} not available on CAGR yet", file=sys.stderr)
        sys.exit(1)

    print(f"Semester {next_sem} is available for scraping", file=sys.stderr)
    print(next_sem)


if __name__ == "__main__":
    main()
