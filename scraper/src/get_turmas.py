#!/usr/bin/env python3

from io import BytesIO
from bs4 import BeautifulSoup
from parse_turmas import count_rows_in_xml_text
from semesters import CAMPUS_FORM_VALUES, campus_codes_for_semester
from xml.etree import ElementTree as ET
import http.cookiejar
import gzip
import os
import ssl
import sys
import urllib.parse
import urllib.request

BASE_URL = "https://cagr.sistemas.ufsc.br/modules/comunidade/cadastroTurmas/"
SEARCH_URL = f"{BASE_URL}index.xhtml"
REQUEST_TIMEOUT_SECONDS = 30
MAX_PAGES_PER_CAMPUS = 500


def find_id(xml, id):
    for x in xml:
        if x.get("id") == id:
            return x
        else:
            y = find_id(x, id)
            if y is not None:
                return y
    return None


def go_on(xml):
    scroller = find_id(xml, "formBusca:dataScroller1_table")
    if scroller is None:
        return False
    for x in scroller[0][0]:
        onclick = x.get("onclick")
        if onclick is not None and "next" in onclick:
            return True
    return False


def parse_ajax_xml(data):
    parser = ET.XMLParser()
    parser.entity.update(
        {
            "aacute": "á",
            "atilde": "ã",
            "ccedil": "ç",
            "eacute": "é",
            "ecirc": "ê",
            "Aacute": "Á",
            "Atilde": "Ã",
            "Ccedil": "Ç",
            "Eacute": "É",
            "Ecirc": "Ê",
        }
    )
    return ET.XML(data, parser=parser)


def build_opener():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(debuglevel=0, context=ssl._create_unverified_context()),
    )


def read_response(resp):
    if resp.info().get("Content-Encoding") == "gzip":
        buf = BytesIO(resp.read())
        f = gzip.GzipFile(fileobj=buf)
        return f.read().decode()

    return resp.read().decode()


class CagrSession:
    def __init__(self):
        self.opener = build_opener()
        self.soup = self._load_initial_page()
        self.view_state = self._extract_view_state()
        self.request = urllib.request.Request(SEARCH_URL)
        self.request.add_header("Accept-encoding", "gzip")

    def _load_initial_page(self):
        resp = self.opener.open(BASE_URL, timeout=REQUEST_TIMEOUT_SECONDS)
        return BeautifulSoup(resp, features="html.parser")

    def _extract_view_state(self):
        view_state = self.soup.find("input", {"name": "javax.faces.ViewState"})
        if view_state is None:
            raise RuntimeError("Could not find javax.faces.ViewState on CAGR")
        return view_state["value"]

    def available_semesters(self):
        select = self.soup.find("select", {"id": "formBusca:selectSemestre"})
        if select is None:
            raise RuntimeError("Could not find semester select element on CAGR")
        return [opt["value"] for opt in select.find_all("option") if opt.get("value")]

    def fetch_page(self, semester, campus_code, page=1):
        page_form = make_page_form(semester, campus_code, page, self.view_state)
        resp = self.opener.open(
            self.request,
            urllib.parse.urlencode(page_form).encode(),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        return read_response(resp)

    def campus_has_rows(self, semester, campus_code):
        data = self.fetch_page(semester, campus_code, page=1)
        return count_rows_in_xml_text(data) > 0


def make_page_form(semestre, campus_code, page, view_state):
    return {
        "AJAXREQUEST": "_viewRoot",
        "formBusca:selectSemestre": semestre,
        "formBusca:selectDepartamento": "",
        "formBusca:selectCampus": CAMPUS_FORM_VALUES[campus_code],
        "formBusca:selectCursosGraduacao": "0",
        "formBusca:codigoDisciplina": "",
        "formBusca:j_id135_selection": "",
        "formBusca:filterDisciplina": "",
        "formBusca:j_id139": "",
        "formBusca:j_id143_selection": "",
        "formBusca:filterProfessor": "",
        "formBusca:selectDiaSemana": "0",
        "formBusca:selectHorarioSemana": "",
        "formBusca": "formBusca",
        "autoScroll": "",
        "javax.faces.ViewState": view_state,
        "formBusca:dataScroller1": str(page),
        "AJAX:EVENTS_COUNT": "1",
    }


def probe_semester_availability(semestre, campus_codes=None, session=None):
    """Returns {campus_code: bool}, requiring actual rows for each campus."""
    session = session or CagrSession()
    campus_codes = campus_codes or campus_codes_for_semester(semestre)

    if semestre not in session.available_semesters():
        return {campus: False for campus in campus_codes}

    return {
        campus: session.campus_has_rows(semestre, campus)
        for campus in campus_codes
    }


def scrape(semestre, output_dir=".", campus_codes=None, session=None):
    """Faz o scrape do semestre e retorna a lista de XMLs gerados."""
    session = session or CagrSession()
    campus_codes = campus_codes or campus_codes_for_semester(semestre)

    print("Semestre: %s" % semestre)

    os.makedirs(output_dir, exist_ok=True)
    xml_files = []
    for campus_code in campus_codes:
        print("campus " + campus_code)
        output_path = os.path.join(output_dir, f"{semestre}_{campus_code}.xml")
        pagina = 1
        with open(output_path, "w", encoding="utf-8") as outfile:
            while pagina <= MAX_PAGES_PER_CAMPUS:
                data = session.fetch_page(semestre, campus_code, page=pagina)
                outfile.write(data)
                xml = parse_ajax_xml(data)
                if not go_on(xml):
                    break
                pagina = pagina + 1
            else:
                raise RuntimeError(
                    f"Campus {campus_code} excedeu {MAX_PAGES_PER_CAMPUS} paginas em {semestre}; abortando"
                )
        xml_files.append(output_path)

    return xml_files


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: %s <semestre>" % sys.argv[0])
        sys.exit(1)

    scrape(sys.argv[1])
