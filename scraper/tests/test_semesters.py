import json
import os
import tempfile
import unittest

from semesters import validate_data_dir, write_campus_if_changed

LEGACY_TURMA = ["01208", 72, 50, 10, 0, 40, 0, ["2.1330-2 / CTC-CTC102"], ["Professor Um"]]
TURMA = LEGACY_TURMA + [208, None]
CURSOS = {"208": "ENGENHARIA MECANICA"}


def campus_file(disciplinas, cursos=None):
    data = {"campus": "JOI", "data_extracao": "01/01/27 - 03:00", "disciplinas": disciplinas}
    if cursos is not None:
        data["cursos"] = cursos
    return data


class ValidateDataDirTests(unittest.TestCase):
    def write(self, tmp, data, semester="20271", campus="JOI"):
        path = os.path.join(tmp, semester[:4], f"{semester}-{campus}.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)

    def validate(self, data):
        with tempfile.TemporaryDirectory() as tmp:
            self.write(tmp, data)
            for campus in ("FLO", "CBS", "ARA", "BLN"):
                self.write(tmp, {**data, "campus": campus}, campus=campus)
            validate_data_dir(tmp)

    def test_legacy_file_accepts_nine_fields(self):
        self.validate(campus_file([["EMB5001", "NOME", "Nome", [LEGACY_TURMA]]]))

    def test_current_file_accepts_eleven_fields(self):
        self.validate(campus_file([["EMB5001", "NOME", "Nome", [TURMA]]], CURSOS))

    def test_legacy_file_rejects_eleven_fields(self):
        with self.assertRaisesRegex(RuntimeError, "deve ter 9 campos"):
            self.validate(campus_file([["EMB5001", "NOME", "Nome", [TURMA]]]))

    def test_current_file_rejects_nine_fields(self):
        with self.assertRaisesRegex(RuntimeError, "deve ter 11 campos"):
            self.validate(campus_file([["EMB5001", "NOME", "Nome", [LEGACY_TURMA]]], CURSOS))

    def test_current_file_rejects_curso_missing_from_map(self):
        with self.assertRaisesRegex(RuntimeError, r"20271-\w+ EMB5001 turma 01208: curso 999 nao consta"):
            self.validate(campus_file([["EMB5001", "NOME", "Nome", [LEGACY_TURMA + [999, None]]]], CURSOS))
        with self.assertRaisesRegex(RuntimeError, r"curso deve ser inteiro \('208'\)"):
            self.validate(campus_file([["EMB5001", "NOME", "Nome", [LEGACY_TURMA + ["208", None]]]], CURSOS))

    def test_current_file_rejects_status_leaked_into_nome(self):
        with self.assertRaisesRegex(RuntimeError, "EMB5001: nome da disciplina com status vazado"):
            self.validate(campus_file([["EMB5001", "NOME", "Nome [Cancelada]", [TURMA]]], CURSOS))
        self.validate(campus_file([["EMB5001", "NOME", "Nome [Cancelada] *CURSO", [LEGACY_TURMA]]]))

    def test_current_file_rejects_repeated_turma(self):
        with self.assertRaisesRegex(RuntimeError, "EMB5001: turma 01208 repetida"):
            self.validate(campus_file([["EMB5001", "NOME", "Nome", [TURMA, TURMA]]], CURSOS))

    def test_legacy_file_accepts_repeated_codigo(self):
        disciplina = ["EMB5001", "NOME", "Nome", [LEGACY_TURMA]]
        self.validate(campus_file([disciplina, disciplina]))

    def test_current_file_rejects_empty_cursos(self):
        with self.assertRaisesRegex(RuntimeError, "cursos deve ser um mapa nao vazio"):
            self.validate(campus_file([["EMB5001", "NOME", "Nome", [TURMA]]], {}))

    def test_current_file_rejects_non_canonical_curso_key(self):
        for key in ("0208", "²", "a"):
            with self.assertRaisesRegex(RuntimeError, "chave de curso invalida"):
                self.validate(campus_file([["EMB5001", "NOME", "Nome", [LEGACY_TURMA + [208, None]]]], {key: "X"}))

    def test_current_file_rejects_repeated_codigo(self):
        disciplina = ["EMB5001", "NOME", "Nome", [TURMA]]
        with self.assertRaisesRegex(RuntimeError, r"20271-\w+.json possui o codigo EMB5001 repetido"):
            self.validate(campus_file([disciplina, disciplina], CURSOS))

    def test_status_must_be_string_or_null(self):
        with self.assertRaisesRegex(RuntimeError, "status deve ser string"):
            self.validate(campus_file([["EMB5001", "NOME", "Nome", [LEGACY_TURMA + [208, ""]]]], CURSOS))

    def test_legacy_and_current_semesters_side_by_side(self):
        legacy = campus_file([["EMB5001", "NOME", "Nome", [LEGACY_TURMA]]])
        current = campus_file([["EMB5001", "NOME", "Nome", [TURMA]]], CURSOS)
        with tempfile.TemporaryDirectory() as tmp:
            for campus in ("FLO", "JOI", "CBS", "ARA", "BLN"):
                self.write(tmp, {**legacy, "campus": campus}, semester="20262", campus=campus)
                self.write(tmp, {**current, "campus": campus}, semester="20271", campus=campus)
            validate_data_dir(tmp)


class WriteCampusTests(unittest.TestCase):
    def test_legacy_file_is_rewritten_in_the_current_format(self):
        disciplinas = [["EMB5001", "NOME", "Nome", [LEGACY_TURMA]]]
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "2027", "20271-JOI.json")
            os.makedirs(os.path.dirname(path))
            with open(path, "w", encoding="utf-8") as f:
                json.dump(campus_file(disciplinas), f)
            self.assertTrue(write_campus_if_changed(tmp, "20271", "JOI", disciplinas, CURSOS, "t1"))
            with open(path, encoding="utf-8") as f:
                self.assertEqual(f.read(), json.dumps(
                    {"campus": "JOI", "data_extracao": "t1", "cursos": CURSOS, "disciplinas": disciplinas},
                    ensure_ascii=False, separators=(",", ":"),
                ))

    def test_cursos_change_rewrites_the_file(self):
        disciplinas = [["EMB5001", "NOME", "Nome", [TURMA]]]
        with tempfile.TemporaryDirectory() as tmp:
            self.assertTrue(write_campus_if_changed(tmp, "20271", "JOI", disciplinas, CURSOS, "t1"))
            self.assertFalse(write_campus_if_changed(tmp, "20271", "JOI", disciplinas, CURSOS, "t2"))
            self.assertTrue(write_campus_if_changed(tmp, "20271", "JOI", disciplinas, {"208": "OUTRO"}, "t3"))
            with open(os.path.join(tmp, "2027", "20271-JOI.json"), encoding="utf-8") as f:
                self.assertEqual(json.load(f)["cursos"], {"208": "OUTRO"})


if __name__ == "__main__":
    unittest.main()
