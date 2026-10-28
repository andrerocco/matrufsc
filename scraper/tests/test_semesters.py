import json
import os
import tempfile
import unittest

from semesters import write_campus_if_changed

TURMA = ["01208", 72, 50, 10, 0, 40, 0, ["2.1330-2 / CTC-CTC102"], ["Professor Um"], 208, None]
CURSOS = {"208": "ENGENHARIA MECANICA"}


class WriteCampusTests(unittest.TestCase):
    def test_changed_disciplinas_rewrite_the_file(self):
        before = {"campus": "JOI", "data_extracao": "t0", "cursos": CURSOS, "disciplinas": [["EMB5001", "Nome", [TURMA]]]}
        disciplinas = [["EMB5001", "Nome", [TURMA[:3] + [11] + TURMA[4:]]]]
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "2027", "20271-JOI.json")
            os.makedirs(os.path.dirname(path))
            with open(path, "w", encoding="utf-8") as f:
                json.dump(before, f)
            self.assertTrue(write_campus_if_changed(tmp, "20271", "JOI", disciplinas, CURSOS, "t1"))
            with open(path, encoding="utf-8") as f:
                self.assertEqual(f.read(), json.dumps(
                    {"campus": "JOI", "data_extracao": "t1", "cursos": CURSOS, "disciplinas": disciplinas},
                    ensure_ascii=False, separators=(",", ":"),
                ))

    def test_cursos_change_rewrites_the_file(self):
        disciplinas = [["EMB5001", "Nome", [TURMA]]]
        with tempfile.TemporaryDirectory() as tmp:
            self.assertTrue(write_campus_if_changed(tmp, "20271", "JOI", disciplinas, CURSOS, "t1"))
            self.assertFalse(write_campus_if_changed(tmp, "20271", "JOI", disciplinas, CURSOS, "t2"))
            self.assertTrue(write_campus_if_changed(tmp, "20271", "JOI", disciplinas, {"208": "OUTRO"}, "t3"))
            with open(os.path.join(tmp, "2027", "20271-JOI.json"), encoding="utf-8") as f:
                self.assertEqual(json.load(f)["cursos"], {"208": "OUTRO"})


if __name__ == "__main__":
    unittest.main()
