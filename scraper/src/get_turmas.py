#!/usr/bin/env python3

from io import BytesIO
from bs4 import BeautifulSoup
from parse_turmas import count_rows_in_xml_text, find_id
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
SEARCH_BUTTON_LABEL = "Buscar"


def _scroller_cells(xml):
    scroller = find_id(xml, "formBusca:dataScroller1_table")
    if scroller is None:
        return []
    return list(scroller[0][0])


def go_on(xml):
    for cell in _scroller_cells(xml):
        onclick = cell.get("onclick")
        if onclick is not None and "next" in onclick:
            return True
    return False


def active_page(xml):
    for cell in _scroller_cells(xml):
        if "rich-datascr-act" in (cell.get("class") or "").split():
            return int(cell.text)
    return None


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
        self.search_button = self._extract_search_button()
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

    def _extract_search_button(self):
        form = self.soup.find("form", {"id": "formBusca"})
        button = form.find("input", {"type": "submit", "value": SEARCH_BUTTON_LABEL}) if form else None
        if button is None or not button.get("name"):
            raise RuntimeError(f"Could not find the '{SEARCH_BUTTON_LABEL}' button on CAGR")
        return button["name"]

    def available_semesters(self):
        select = self.soup.find("select", {"id": "formBusca:selectSemestre"})
        if select is None:
            raise RuntimeError("Could not find semester select element on CAGR")
        return [opt["value"] for opt in select.find_all("option") if opt.get("value")]

    def _post(self, form):
        resp = self.opener.open(
            self.request,
            urllib.parse.urlencode(form).encode(),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        return read_response(resp)

    def search(self, semester, campus_code):
        """Page 1 of a fresh query.

        CAGR only re-runs the query on the "Buscar" button event or on a page
        change; a scroller request for the page it is already on returns the
        previous result and ignores the submitted semester and campus.
        """
        data = self._post(make_search_form(semester, campus_code, self.view_state, self.search_button))
        _check_page(data, 1, semester, campus_code)
        return data

    def fetch_page(self, semester, campus_code, page):
        if page < 2:
            raise ValueError("page 1 comes from search()")
        data = self._post(make_page_form(semester, campus_code, page, self.view_state))
        _check_page(data, page, semester, campus_code)
        return data

    def campus_has_rows(self, semester, campus_code):
        return count_rows_in_xml_text(self.search(semester, campus_code)) > 0


def _check_page(data, expected, semester, campus_code):
    seen = active_page(parse_ajax_xml(data))
    if seen is None and expected == 1:
        return
    if seen != expected:
        shown = "nenhuma" if seen is None else seen
        raise RuntimeError(f"CAGR devolveu a pagina {shown} em vez da {expected} para {semester}-{campus_code}")


def _filter_form(semestre, campus_code, view_state):
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
        "AJAX:EVENTS_COUNT": "1",
    }


def make_search_form(semestre, campus_code, view_state, search_button):
    form = _filter_form(semestre, campus_code, view_state)
    form[search_button] = search_button
    form["isoladas"] = ""
    return form


def make_page_form(semestre, campus_code, page, view_state):
    form = _filter_form(semestre, campus_code, view_state)
    form["formBusca:dataScroller1"] = str(page)
    return form


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


def iter_pages(session, semestre, campus_code):
    data = session.search(semestre, campus_code)
    page = 1
    while True:
        yield data
        if not go_on(parse_ajax_xml(data)):
            return
        page += 1
        if page > MAX_PAGES_PER_CAMPUS:
            raise RuntimeError(f"Campus {campus_code} excedeu {MAX_PAGES_PER_CAMPUS} paginas em {semestre}; abortando")
        data = session.fetch_page(semestre, campus_code, page)


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
        with open(output_path, "w", encoding="utf-8") as outfile:
            for data in iter_pages(session, semestre, campus_code):
                outfile.write(data)
        xml_files.append(output_path)

    return xml_files


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: %s <semestre>" % sys.argv[0])
        sys.exit(1)

    scrape(sys.argv[1])
