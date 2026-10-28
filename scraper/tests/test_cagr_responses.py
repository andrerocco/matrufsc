import os
import tempfile
import unittest
from unittest import mock

import get_turmas
from get_turmas import CagrSession, active_page, go_on, iter_pages, make_page_form, make_search_form, parse_ajax_xml, probe_semester_availability
from parse_turmas import announced_total
from main import parse_and_write_xmls
from parse_turmas import count_rows_in_xml_text, iter_rows_from_xml_text, parse_xml_text
from cagr_xml import cagr_row, cagr_table

XML_HEADER = '<?xml version="1.0"?>'


def row(codigo, turma="01208"):
    return cagr_row(codigo, turma, nome=f"Nome de {codigo}", curso_id=208, nome_curso="ENGENHARIA MECANICA",
                    horarios=("2.1330-2 / CTC-CTC102",), professores=("Professor Um",))


def scroller(active, has_next):
    cells = [f'<td class="rich-datascr-act">{active}</td>']
    if has_next:
        cells.append("<td class=\"rich-datascr-button\" onclick=\"Event.fire(this, 'rich:datascroller:onscroll', {'page': 'next'});\">»</td>")
    return (
        '<table id="formBusca:dataScroller1_table"><tbody><tr>' + "".join(cells) + "</tr></tbody></table>"
    )


def table(rows):
    return cagr_table(rows)


def scroll_response(rows, active=2, has_next=True, with_scroller=True):
    body = (scroller(active, has_next) if with_scroller else "") + table(rows)
    return f'{XML_HEADER}<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><span id="a"/>{body}</body></html>'


def total_group(inner, total):
    """`formBusca:dataTableGroup`, que só a resposta do botão "Buscar" atualiza:
    a frase com o total (omitida quando não há resultado), o scroller e a tabela."""
    phrase = f'<span style="font-weight: bold;">{total}</span> resultados foram encontrados<br/>' if total else "<br/>"
    return f'<span id="formBusca:dataTableGroup"><br/>{phrase}<br/>{inner}</span>'


def search_response(rows, active=1, has_next=True, total=None, group=True):
    inner = "".join(f'<span id="s{i}"/>' for i in range(5))
    if rows:
        inner += scroller(active, has_next)
    inner += table(rows)
    if group:
        inner = total_group(inner, len(rows) if total is None else total)
    return f'{XML_HEADER}<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><div id="wrap">{inner}</div></body></html>'


class RowLocationTests(unittest.TestCase):
    def test_rows_found_in_scroll_response(self):
        xml = scroll_response([row("ACL5134"), row("ACL5134", "01209")])
        self.assertEqual(count_rows_in_xml_text(xml), 2)

    def test_rows_found_in_search_response(self):
        xml = search_response([row("EMB5001")])
        self.assertEqual(count_rows_in_xml_text(xml), 1)

    def test_empty_search_response_has_no_rows(self):
        self.assertEqual(count_rows_in_xml_text(search_response([])), 0)

    def test_concatenated_pages_are_all_read(self):
        xml = search_response([row("EMB5001")]) + scroll_response([row("EMB5002")], has_next=False)
        self.assertEqual([r[3].text for r in iter_rows_from_xml_text(xml)], ["EMB5001", "EMB5002"])

    def test_parse_groups_turmas_by_disciplina(self):
        xml = search_response([row("EMB5001", "01208"), row("EMB5001", "01209"), row("EMB5005")])
        materias, _ = parse_xml_text(xml)
        self.assertEqual([m[0] for m in materias], ["EMB5001", "EMB5005"])
        self.assertEqual([t[0] for t in materias[0][2]], ["01208", "01209"])


class ScrollerTests(unittest.TestCase):
    def test_go_on_and_active_page(self):
        xml = parse_ajax_xml(scroll_response([row("ACL5134")], active=3, has_next=True))
        self.assertTrue(go_on(xml))
        self.assertEqual(active_page(xml), 3)

    def test_last_page(self):
        xml = parse_ajax_xml(scroll_response([row("ACL5134")], active=7, has_next=False))
        self.assertFalse(go_on(xml))
        self.assertEqual(active_page(xml), 7)

    def test_no_scroller_when_empty(self):
        xml = parse_ajax_xml(search_response([]))
        self.assertFalse(go_on(xml))
        self.assertIsNone(active_page(xml))


class FormTests(unittest.TestCase):
    def test_search_form_presses_button_without_scrolling(self):
        form = make_search_form("20271", "JOI", "vs", "formBusca:j_id119")
        self.assertEqual(form["formBusca:j_id119"], "formBusca:j_id119")
        self.assertEqual(form["isoladas"], "")
        self.assertNotIn("formBusca:dataScroller1", form)
        self.assertEqual(form["formBusca:selectSemestre"], "20271")
        self.assertEqual(form["formBusca:selectCampus"], "2")

    def test_page_form_scrolls_without_button(self):
        form = make_page_form("20271", "CBS", 4, "vs")
        self.assertEqual(form["formBusca:dataScroller1"], "4")
        self.assertNotIn("isoladas", form)
        self.assertEqual(form["formBusca:selectCampus"], "3")


class ReconcileGuardTests(unittest.TestCase):
    def write_xml(self, directory, name, xml):
        path = os.path.join(directory, name)
        with open(path, "w", encoding="utf-8") as f:
            f.write(xml)
        return path

    def test_identical_campi_abort(self):
        with tempfile.TemporaryDirectory() as tmp:
            stage = os.path.join(tmp, "stage")
            os.makedirs(stage)
            same = search_response([row("EMB5001")], has_next=False)
            files = [
                self.write_xml(tmp, "20271_JOI.xml", same),
                self.write_xml(tmp, "20271_CBS.xml", same),
            ]
            with self.assertRaisesRegex(RuntimeError, "mesmas disciplinas"):
                parse_and_write_xmls(files, stage)

    def test_distinct_campi_are_written(self):
        with tempfile.TemporaryDirectory() as tmp:
            stage = os.path.join(tmp, "stage")
            os.makedirs(stage)
            files = [
                self.write_xml(tmp, "20271_JOI.xml", search_response([row("EMB5001")], has_next=False)),
                self.write_xml(tmp, "20271_CBS.xml", search_response([row("ABF7010")], has_next=False)),
            ]
            self.assertTrue(parse_and_write_xmls(files, stage))
            self.assertTrue(os.path.exists(os.path.join(stage, "2027", "20271-JOI.json")))

    def test_empty_campus_aborts(self):
        with tempfile.TemporaryDirectory() as tmp:
            stage = os.path.join(tmp, "stage")
            os.makedirs(stage)
            files = [self.write_xml(tmp, "20271_JOI.xml", search_response([]))]
            with self.assertRaisesRegex(RuntimeError, "nao possui disciplinas"):
                parse_and_write_xmls(files, stage)


class FakeCagr(CagrSession):
    def __init__(self, responses):
        self.view_state = "vs"
        self.search_button = "formBusca:j_id119"
        self.responses = list(responses)
        self.forms = []

    def _post(self, form):
        self.forms.append(form)
        return self.responses.pop(0)


class AnnouncedTotalTests(unittest.TestCase):
    def test_total_comes_from_the_phrase_above_the_table(self):
        self.assertEqual(announced_total(parse_ajax_xml(search_response([row("EMB5001")], total=5372))), 5372)

    def test_empty_search_omits_the_phrase(self):
        self.assertEqual(announced_total(parse_ajax_xml(search_response([]))), 0)

    def test_search_without_the_group_raises(self):
        with self.assertRaisesRegex(RuntimeError, "sem formBusca:dataTableGroup"):
            announced_total(parse_ajax_xml(search_response([row("EMB5001")], group=False)))

    def test_scroll_page_has_no_group(self):
        with self.assertRaisesRegex(RuntimeError, "sem formBusca:dataTableGroup"):
            announced_total(parse_ajax_xml(scroll_response([row("EMB5001")])))

    def test_total_that_is_not_a_number_raises(self):
        xml = search_response([row("EMB5001")], total="muitos")
        with self.assertRaisesRegex(RuntimeError, "fora do padrao.*muitos"):
            announced_total(parse_ajax_xml(xml))


class PaginationTests(unittest.TestCase):
    def test_page_one_comes_from_search_and_the_rest_from_scroller(self):
        session = FakeCagr([
            search_response([row("EMB5001")], has_next=True, total=3),
            scroll_response([row("EMB5002")], active=2, has_next=True),
            scroll_response([row("EMB5003")], active=3, has_next=False),
            search_response([row("EMB5001")], has_next=True, total=3),
        ])
        pages = list(iter_pages(session, "20271", "JOI"))
        self.assertEqual(len(pages), 3)
        self.assertIn("formBusca:j_id119", session.forms[0])
        self.assertNotIn("formBusca:dataScroller1", session.forms[0])
        self.assertEqual([f.get("formBusca:dataScroller1") for f in session.forms[1:3]], ["2", "3"])
        self.assertTrue(all("formBusca:j_id119" not in f for f in session.forms[1:3]))
        self.assertTrue(all(f["formBusca:selectCampus"] == "2" for f in session.forms))

    def test_campus_ends_with_a_new_search_to_confirm_the_total(self):
        session = FakeCagr([
            search_response([row("EMB5001")], has_next=False),
            search_response([row("EMB5001")], has_next=False),
        ])
        self.assertEqual(len(list(iter_pages(session, "20271", "JOI"))), 1)
        self.assertEqual(len(session.forms), 2)
        self.assertIn("formBusca:j_id119", session.forms[1])
        self.assertNotIn("formBusca:dataScroller1", session.forms[1])

    def test_empty_campus_yields_one_page_without_rows(self):
        session = FakeCagr([search_response([]), search_response([])])
        pages = list(iter_pages(session, "20271", "JOI"))
        self.assertEqual(count_rows_in_xml_text("".join(pages)), 0)

    def test_fewer_rows_than_announced_raises(self):
        """Turma removida no CAGR durante a paginacao: a pagina seguinte pula uma linha."""
        session = FakeCagr([
            search_response([row("EMB5001")], has_next=True, total=3),
            scroll_response([row("EMB5003")], active=2, has_next=False),
        ])
        with self.assertRaisesRegex(RuntimeError, "20271-JOI: a busca anunciou 3 resultados e a paginacao coletou 2 linhas em 2 pagina"):
            list(iter_pages(session, "20271", "JOI"))

    def test_more_rows_than_announced_raises(self):
        """Turma inserida no CAGR durante a paginacao: a pagina seguinte repete uma linha."""
        session = FakeCagr([
            search_response([row("EMB5001")], has_next=True, total=2),
            scroll_response([row("EMB5001"), row("EMB5002")], active=2, has_next=False),
        ])
        with self.assertRaisesRegex(RuntimeError, "anunciou 2 resultados e a paginacao coletou 3 linhas"):
            list(iter_pages(session, "20271", "JOI"))

    def test_total_changed_by_the_end_raises(self):
        session = FakeCagr([
            search_response([row("EMB5001")], has_next=False),
            search_response([row("EMB5001")], has_next=False, total=2),
        ])
        with self.assertRaisesRegex(RuntimeError, "20271-JOI: a busca anunciava 1 resultados antes da paginacao e 2 depois"):
            list(iter_pages(session, "20271", "JOI"))

    def test_search_without_total_raises_before_paging(self):
        session = FakeCagr([search_response([row("EMB5001")], has_next=True, group=False)])
        with self.assertRaisesRegex(RuntimeError, "sem formBusca:dataTableGroup"):
            next(iter_pages(session, "20271", "JOI"))
        self.assertEqual(len(session.forms), 1)

    def test_wrong_page_raises(self):
        session = FakeCagr([
            search_response([row("EMB5001")], has_next=True),
            scroll_response([row("EMB5001")], active=1, has_next=True),
        ])
        with self.assertRaisesRegex(RuntimeError, "pagina 1 em vez da 2"):
            list(iter_pages(session, "20271", "JOI"))

    def test_missing_scroller_on_later_page_raises(self):
        session = FakeCagr([
            search_response([row("EMB5001")], has_next=True),
            scroll_response([row("EMB5002")], with_scroller=False),
        ])
        with self.assertRaisesRegex(RuntimeError, "pagina nenhuma em vez da 2"):
            list(iter_pages(session, "20271", "JOI"))

    def test_search_result_on_unexpected_page_raises(self):
        session = FakeCagr([search_response([row("EMB5001")], active=3)])
        with self.assertRaisesRegex(RuntimeError, "pagina 3 em vez da 1"):
            session.search("20271", "JOI")

    def test_fetch_page_rejects_page_one(self):
        with self.assertRaises(ValueError):
            FakeCagr([]).fetch_page("20271", "JOI", 1)

    def test_max_pages_aborts(self):
        session = FakeCagr([
            search_response([row("EMB5001")], has_next=True),
            scroll_response([row("EMB5002")], active=2, has_next=True),
            scroll_response([row("EMB5003")], active=3, has_next=True),
        ])
        with mock.patch.object(get_turmas, "MAX_PAGES_PER_CAMPUS", 2):
            with self.assertRaisesRegex(RuntimeError, "excedeu 2 paginas"):
                list(iter_pages(session, "20271", "JOI"))

    def test_probe_runs_a_real_search_per_campus(self):
        session = FakeCagr([
            search_response([row("ACL5134")], has_next=True),
            search_response([]),
        ])
        session.available_semesters = lambda: ["20271", "20262"]
        self.assertEqual(
            probe_semester_availability("20271", campus_codes=("FLO", "JOI"), session=session),
            {"FLO": True, "JOI": False},
        )
        for form, campus in zip(session.forms, ("1", "2")):
            self.assertIn("formBusca:j_id119", form)
            self.assertNotIn("formBusca:dataScroller1", form)
            self.assertEqual(form["formBusca:selectCampus"], campus)

    def test_probe_skips_semester_missing_from_select(self):
        session = FakeCagr([])
        session.available_semesters = lambda: ["20262"]
        self.assertEqual(
            probe_semester_availability("20271", campus_codes=("FLO", "JOI"), session=session),
            {"FLO": False, "JOI": False},
        )
        self.assertEqual(session.forms, [])

    def test_active_page_tolerates_extra_classes(self):
        xml = scroll_response([row("ACL5134")], active=4).replace(
            'class="rich-datascr-act"', 'class="rich-datascr-act extra"'
        )
        self.assertEqual(active_page(parse_ajax_xml(xml)), 4)


if __name__ == "__main__":
    unittest.main()
