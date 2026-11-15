import contextlib
import io
import json
import os
import tempfile
import unittest
from unittest import mock

import main
from cagr_xml import cagr_page, cagr_row

CAMPI = ("FLO", "JOI", "CBS", "ARA", "BLN")


class FakeSession:
    def available_semesters(self):
        return ["20271", "20262"]


def fake_scrape(codigo=lambda semestre, campus: f"{campus}{semestre[3:]}00"):
    """Substitui o scrape: um XML por campus, com uma disciplina cujo codigo vem de `codigo`."""
    calls = []

    def scrape(semestre, output_dir, campus_codes, session):
        calls.append((semestre, session))
        paths = []
        for campus in campus_codes:
            path = os.path.join(output_dir, f"{semestre}_{campus}.xml")
            with open(path, "w", encoding="utf-8") as f:
                f.write(cagr_page([cagr_row(codigo(semestre, campus), "01302")]))
            paths.append(path)
        return paths

    scrape.calls = calls
    return scrape


class MainTests(unittest.TestCase):
    def run_main(self, argv, scrape, sessions=None):
        """Roda main() num staging temporario; devolve (codigo de saida, stderr, staging lido, sessoes criadas)."""
        created = []

        def new_session():
            created.append(sessions.pop(0) if sessions else FakeSession())
            return created[-1]

        with tempfile.TemporaryDirectory() as tmp:
            stage = os.path.join(tmp, "stage")
            stderr = io.StringIO()
            with (
                mock.patch.object(main, "CagrSession", new_session),
                mock.patch.object(main, "scrape_semester", scrape),
                mock.patch.object(main, "check_stage", wraps=main.check_stage) as check,
                contextlib.redirect_stdout(io.StringIO()),
                contextlib.redirect_stderr(stderr),
            ):
                code = 0
                try:
                    main.main([*argv, "--stage-dir", stage, "--public-data-dir", os.path.join(tmp, "public")])
                except SystemExit as e:
                    code = e.code
            staged = {}
            for root, _, files in os.walk(stage):
                for name in files:
                    with open(os.path.join(root, name), encoding="utf-8") as f:
                        staged[name] = json.load(f)
            return code, stderr.getvalue(), staged, created, check.call_count

    def test_several_semesters_go_into_one_staging_checked_once(self):
        scrape = fake_scrape()
        code, _, staged, sessions, checks = self.run_main(["--semester", "20262", "20271"], scrape)

        self.assertEqual(code, 0)
        self.assertEqual(staged["index.json"], {"semesters": ["20271", "20262"]})
        self.assertEqual(
            sorted(name for name in staged if name != "index.json"),
            sorted(f"{semestre}-{campus}.json" for semestre in ("20262", "20271") for campus in CAMPI),
        )
        self.assertEqual(staged["20262-JOI.json"]["disciplinas"][0][0], "JOI6200")
        self.assertEqual(checks, 1)

    def test_each_forced_semester_gets_its_own_session(self):
        scrape = fake_scrape()
        _, _, _, sessions, _ = self.run_main(["--semester", "20262", "20271", "20262"], scrape)

        self.assertEqual([semestre for semestre, _ in scrape.calls], ["20262", "20271"])
        self.assertEqual(len(sessions), 2)
        self.assertIsNot(scrape.calls[0][1], scrape.calls[1][1])

    def test_semester_missing_from_the_cagr_select_aborts_before_scraping(self):
        scrape = fake_scrape()
        code, stderr, _, _, checks = self.run_main(["--semester", "20261"], scrape)

        self.assertEqual(code, 1)
        self.assertIn("Semestre 20261 nao consta na lista de semestres do CAGR", stderr)
        self.assertEqual(scrape.calls, [])
        self.assertEqual(checks, 0)

    def test_two_semesters_with_the_same_disciplinas_abort(self):
        scrape = fake_scrape(codigo=lambda semestre, campus: f"{campus}0000")
        code, stderr, _, _, checks = self.run_main(["--semester", "20262", "20271"], scrape)

        self.assertEqual(code, 1)
        self.assertIn("20271-FLO e 20262-FLO retornaram as mesmas disciplinas", stderr)
        self.assertEqual(checks, 0)

    def test_semester_that_is_not_five_digits_is_refused(self):
        for value in ("2026.2", "20262,20271", "41"):
            code, stderr, _, sessions, _ = self.run_main(["--semester", value], fake_scrape())
            self.assertEqual(code, 2)
            self.assertIn(f"semestre invalido: '{value}'", stderr)
            self.assertEqual(sessions, [])

    def test_daily_run_scrapes_with_the_session_that_probed(self):
        scrape = fake_scrape()
        with mock.patch.object(main, "choose_target_semester", lambda session, public: ("20271", "refresh")):
            code, _, staged, sessions, checks = self.run_main([], scrape)

        self.assertEqual(code, 0)
        self.assertEqual(len(sessions), 1)
        self.assertIs(scrape.calls[0][1], sessions[0])
        self.assertEqual(staged["index.json"], {"semesters": ["20271"]})
        self.assertEqual(checks, 1)


if __name__ == "__main__":
    unittest.main()
